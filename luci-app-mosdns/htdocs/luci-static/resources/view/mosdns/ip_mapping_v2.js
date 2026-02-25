'use strict';
'require form';
'require fs';
'require uci';
'require ui';
'require view';

function ensureMapFile(section_id) {
	var p = uci.get('mosdns', section_id, 'rule_file');
	if (p)
		return p;
	p = '/etc/mosdns/rule/ip-map-' + section_id + '.txt';
	uci.set('mosdns', section_id, 'rule_file', p);
	return p;
}

function flushAndRestartMosdns() {
	return fs.exec('/usr/share/mosdns/mosdns.sh', ['flush'])
		.catch(function () { return null; })
		.then(function () {
			return fs.exec('/etc/init.d/mosdns', ['restart']);
		});
}

return view.extend({
	load: function () {
		return uci.load('mosdns');
	},

	handleSave: function () {
		if (!this.map)
			return Promise.resolve();

		return this.map.save(null, false);
	},

	handleSaveApply: function (ev) {
		return this.handleSave(ev).then(function () {
			return flushAndRestartMosdns();
		}).then(function () {
			return ui.changes.apply(false);
		});
	},

	addFooter: function () {
		return E('div', { 'class': 'cbi-page-actions' }, [
			E('button', {
				'class': 'cbi-button cbi-button-apply important',
				'click': L.bind(this.handleSaveApply, this)
			}, [ _('Save & Apply') ]),
			' ',
			E('button', {
				'class': 'cbi-button cbi-button-save',
				'click': L.bind(this.handleSave, this)
			}, [ _('Save') ]),
			' ',
			E('button', {
				'class': 'cbi-button cbi-button-reset',
				'click': L.bind(this.handleReset, this)
			}, [ _('Reset') ])
		]);
	},

	render: function () {
		var m, s, o;

		m = new form.Map('mosdns', _('IP Mapping'),
			_('Map response IPs by CIDR/IP lists. Rules are executed from top to bottom.') + ' ' +
			_('When multiple rules match, later rules continue to run.') + ' ' +
			_('Cloudflare legacy list is auto-migrated into IP mapping rules on service start.'));
		this.map = m;

		s = m.section(form.GridSection, 'ip_map', _('IP Mapping List'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.modaltitle = _('IP Mapping Rule');
		s.addbtntitle = _('Add IP Mapping Rule');

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.rmempty = false;
		o.default = '1';
		o.sortable = false;

		o = s.option(form.Value, 'name', _('Rule Name'));
		o.rmempty = false;
		o.placeholder = _('IP Mapping');
		o.sortable = false;

		o = s.option(form.DynamicList, 'ip_map_target', _('Mapped IP'));
		o.datatype = 'ipaddr';
		o.rmempty = true;
		o.modalonly = true;
		o.sortable = false;
		o.textvalue = function (section_id) {
			var v = uci.get('mosdns', section_id, 'ip_map_target');
			if (Array.isArray(v) && v.length)
				return v.join(', ');
			if (typeof v === 'string' && v.length)
				return v;
			return '-';
		};

		o = s.option(form.ListValue, 'continue_match', _('Continue Matching'));
		o.value('1', _('Continue'));
		o.value('0', _('Stop after match'));
		o.default = '1';
		o.rmempty = false;
		o.modalonly = true;
		o.sortable = false;

		o = s.option(form.TextValue, '_map_content', _('IP/CIDR List'));
		o.rows = 16;
		o.modalonly = true;
		o.sortable = false;
		o.cfgvalue = function (section_id) {
			return fs.trimmed(ensureMapFile(section_id)).catch(function () { return ''; });
		};
		o.write = function (section_id, formvalue) {
			return fs.write(ensureMapFile(section_id), (formvalue || '').trim().replace(/\r\n/g, '\n') + '\n')
				.catch(function (e) {
					ui.addNotification(null, E('p', _('Unable to save contents: %s').format(e.message)));
				});
		};

		return m.render();
	}
});
