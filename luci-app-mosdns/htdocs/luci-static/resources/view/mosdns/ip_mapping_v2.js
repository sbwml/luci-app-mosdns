'use strict';
'require form';
'require fs';
'require uci';
'require ui';
'require view';

function ensureMapFile(section_id) {
	section_id = resolveSectionId(section_id);
	var p = uci.get('mosdns', section_id, 'rule_file');
	if (p)
		return p;
	p = '/etc/mosdns/rule/ip-map-' + section_id + '.txt';
	uci.set('mosdns', section_id, 'rule_file', p);
	return p;
}

function getMapFile(section_id) {
	section_id = resolveSectionId(section_id);
	return uci.get('mosdns', section_id, 'rule_file') || ('/etc/mosdns/rule/ip-map-' + section_id + '.txt');
}

function resolveSectionId(section_id) {
	if (typeof section_id !== 'string')
		return section_id;

	if (section_id.indexOf('cbid.mosdns.') === 0) {
		var parts = section_id.split('.');
		if (parts.length >= 3)
			return parts[2];
	}

	return section_id;
}

function deleteMapFileIfUnusedByPath(p) {
	if (!p)
		return Promise.resolve();

	var inUse = uci.sections('mosdns', 'ip_map').some(function (sec) {
		return getMapFile(sec['.name']) === p;
	});

	if (inUse)
		return Promise.resolve();

	return fs.remove(p).catch(function () { return null; });
}

function flushAndRestartMosdns() {
	return fs.exec('/usr/share/mosdns/mosdns.sh', ['flush'])
		.catch(function () { return null; })
		.then(function () {
			return fs.exec('/etc/init.d/mosdns', ['restart']);
		});
}

function persistMapContentFiles() {
	var tasks = [];

	uci.sections('mosdns', 'ip_map').forEach(function (sec) {
		var sid = sec['.name'];
		var content = uci.get('mosdns', sid, 'map_content');

		if (typeof content !== 'string')
			return;

		var p = ensureMapFile(sid);
		tasks.push(
			fs.exec('/bin/mkdir', [ '-p', '/etc/mosdns/rule' ])
				.catch(function () { return null; })
				.then(function () {
					return fs.write(p, content.trim().replace(/\r\n/g, '\n') + '\n');
				})
		);
	});

	return Promise.all(tasks);
}

return view.extend({
	load: function () {
		return uci.load('mosdns');
	},

	handleSave: function () {
		if (!this.map)
			return Promise.resolve();

		return this.map.save(null, false)
			.then(function () {
				return uci.load('mosdns');
			})
			.then(function () {
				return persistMapContentFiles();
			});
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
		s.handleRemove = function (section_id, ev) {
			var sid = resolveSectionId(section_id);
			var p = getMapFile(sid);

			return form.GridSection.prototype.handleRemove.apply(this, [ sid, ev ])
				.then(function () {
					return deleteMapFileIfUnusedByPath(p);
				});
		};
		s.handleModalSave = function (modalMap, ev) {
			var sid = resolveSectionId(modalMap && modalMap.section);
			var textarea = document.querySelector('#modal_overlay .cbi-value[data-name="map_content"] textarea');
			var content = textarea ? String(textarea.value || '') : null;

			return form.GridSection.prototype.handleModalSave.apply(this, [ modalMap, ev ])
				.then(function () {
					if (content == null)
						return Promise.resolve();

					var p = ensureMapFile(sid);
					return fs.exec('/bin/mkdir', [ '-p', '/etc/mosdns/rule' ])
						.catch(function () { return null; })
						.then(function () {
							return fs.write(p, content.trim().replace(/\r\n/g, '\n') + '\n');
						});
				});
		};

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
			var sid = resolveSectionId(section_id);
			var v = uci.get('mosdns', sid, 'ip_map_target');
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

		o = s.option(form.TextValue, 'map_content', _('IP/CIDR List'));
		o.rows = 16;
		o.modalonly = true;
		o.sortable = false;
		o.cfgvalue = function (section_id) {
			return fs.trimmed(ensureMapFile(section_id)).catch(function () { return ''; });
		};

		return m.render();
	}
});
