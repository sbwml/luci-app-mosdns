'use strict';
'require form';
'require fs';
'require uci';
'require ui';
'require view';

function ruleUsesDnsGroup(rule, targetGroup, groups) {
	var mode = rule.mode || 'custom';
	var bt = rule.builtin_type || '';

	if (mode !== 'custom' && !(mode === 'builtin' &&
		(bt === 'cn_domain' || bt === 'noncn_domain' || bt === 'apple_domain' || bt === 'stream_media')))
		return false;

	var ref = rule.dns_group;
	if (!ref)
		return false;
	if (ref === targetGroup)
		return true;

	var m = /^@dns_group\[(\d+)\]$/.exec(ref);
	if (!m)
		return false;

	var idx = +m[1];
	return !!(groups[idx] && groups[idx]['.name'] === targetGroup);
}

function resolveGroupName(section_id, groups) {
	if (!section_id)
		return null;

	var m = /^@dns_group\[(\d+)\]$/.exec(section_id);
	if (!m)
		return section_id;

	var idx = +m[1];
	return groups[idx] ? groups[idx]['.name'] : null;
}

return view.extend({
	load: function () {
		return uci.load('mosdns');
	},

	render: function () {
		var m, s, o;

		m = new form.Map('mosdns', _('DNS Groups'),
			_('Manage upstream DNS groups. One group must be set as default fallback.'));

		s = m.section(form.GridSection, 'dns_group', _('DNS Group List'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = false;
		s.nodescriptions = true;
		s.modaltitle = _('DNS Group');
		s.addbtntitle = _('Add DNS Group');
		s.handleRemove = function (section_id, ev) {
			var groups = uci.sections('mosdns', 'dns_group');
			var resolved = resolveGroupName(section_id, groups);

			if (!resolved)
				return Promise.resolve();

			if (uci.get('mosdns', resolved, 'is_default') === '1') {
				ui.addNotification(null,
					E('p', _('Default DNS group cannot be deleted. Please set another group as default first.')),
					'error');
				return Promise.resolve();
			}

			if (uci.sections('mosdns', 'rule').some(function (r) { return ruleUsesDnsGroup(r, resolved, groups); })) {
				ui.addNotification(null,
					E('p', _('This DNS group is referenced by rules and cannot be deleted.')),
					'error');
				return Promise.resolve();
			}

			return form.GridSection.prototype.handleRemove.apply(this, [ resolved, ev ]);
		};

		o = s.option(form.Value, 'name', _('Group Name'));
		o.rmempty = false;
		o.placeholder = _('DNS Group');
		o.sortable = false;

		o = s.option(form.DynamicList, 'dns', _('DNS Servers'));
		o.rmempty = false;
		o.depends('use_default_dns', '0');
		o.value('119.29.29.29', _('Tencent Public DNS (119.29.29.29)'));
		o.value('119.28.28.28', _('Tencent Public DNS (119.28.28.28)'));
		o.value('223.5.5.5', _('Aliyun Public DNS (223.5.5.5)'));
		o.value('223.6.6.6', _('Aliyun Public DNS (223.6.6.6)'));
		o.value('114.114.114.114', _('Xinfeng Public DNS (114.114.114.114)'));
		o.value('114.114.115.115', _('Xinfeng Public DNS (114.114.115.115)'));
		o.value('180.76.76.76', _('Baidu Public DNS (180.76.76.76)'));
		o.value('tls://1.1.1.1', _('CloudFlare Public DNS (DoT 1.1.1.1)'));
		o.value('tls://1.0.0.1', _('CloudFlare Public DNS (DoT 1.0.0.1)'));
		o.value('tls://8.8.8.8', _('Google Public DNS (DoT 8.8.8.8)'));
		o.value('tls://8.8.4.4', _('Google Public DNS (DoT 8.8.4.4)'));
		o.value('https://dns.alidns.com/dns-query', _('Aliyun Public DNS (DoH)'));
		o.value('h3://dns.alidns.com/dns-query', _('Aliyun Public DNS (DoH3)'));
		o.value('https://doh.pub/dns-query', _('Tencent Public DNS (DoH)'));
		o.value('quic://dns.alidns.com', _('Aliyun Public DNS (DoQ)'));
		o.textvalue = function (section_id) {
			if (uci.get('mosdns', section_id, 'use_default_dns') === '1')
				return _('Use Interface Default DNS');

			var v = uci.get('mosdns', section_id, 'dns');
			if (Array.isArray(v) && v.length)
				return v.join(', ');
			if (typeof v === 'string' && v.length)
				return v;
			return '-';
		};
		o.sortable = false;

		o = s.option(form.Flag, 'use_default_dns', _('Use Interface Default DNS'),
			_('Use DNS from WAN static config or PPPoE/DHCP dynamic assignment.'));
		o.rmempty = false;
		o.default = '0';
		o.modalonly = true;
		o.sortable = false;

		o = s.option(form.DummyValue, '_default_state', _('Default'));
		o.cfgvalue = function (section_id) {
			return uci.get('mosdns', section_id, 'is_default') === '1' ? _('Yes') : _('No');
		};
		o.sortable = false;

		o = s.option(form.Button, '_set_default', _('Set As Default'));
		o.inputtitle = _('Set As Default');
		o.inputstyle = 'apply';
		o.modalonly = true;
		o.onclick = function (arg1, arg2) {
			var section_id = null;

			if (typeof arg1 === 'string')
				section_id = arg1;
			else if (typeof arg2 === 'string')
				section_id = arg2;

			if (!section_id && this && typeof this.section === 'string')
				section_id = this.section;
			if (!section_id && this && this.section && typeof this.section.section === 'string')
				section_id = this.section.section;

			if (!section_id) {
				ui.addNotification(null, E('p', _('Failed to identify current DNS group.')), 'error');
				return Promise.resolve();
			}

			uci.sections('mosdns', 'dns_group', function (sec) {
				uci.set('mosdns', sec['.name'], 'is_default', sec['.name'] === section_id ? '1' : '0');
			});

			ui.addNotification(null,
				E('p', _('Default DNS group marked. Please click Save or Save & Apply to take effect.')),
				'info');

			return Promise.resolve();
		};
		o.sortable = false;

		o = s.option(form.Value, 'bootstrap_dns', _('Bootstrap DNS servers'));
		o.modalonly = true;
		o.sortable = false;

		o = s.option(form.Value, 'concurrent', _('Concurrent'));
		o.datatype = 'and(uinteger,min(1),max(3))';
		o.modalonly = true;
		o.sortable = false;

		return m.render();
	}
});
