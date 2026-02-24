'use strict';
'require form';
'require fs';
'require uci';
'require ui';
'require view';

var PRESET_AD_SOURCES = [
	'geosite.dat',
	'https://raw.githubusercontent.com/privacy-protection-tools/anti-AD/master/anti-ad-domains.txt',
	'https://raw.githubusercontent.com/Cats-Team/AdRules/main/mosdns_adrules.txt',
	'https://raw.githubusercontent.com/neodevpro/neodevhost/master/domain'
];

var PRESET_AD_SOURCE_MAP = PRESET_AD_SOURCES.reduce(function (m, v) {
	m[v] = true;
	return m;
}, {});

function ensureRuleFile(section_id) {
	if (!isRuleContentEditable(section_id))
		return uci.get('mosdns', section_id, 'rule_file') || '';

	var p = uci.get('mosdns', section_id, 'rule_file');
	if (p)
		return p;
	p = '/etc/mosdns/rule/rule-' + section_id + '.txt';
	uci.set('mosdns', section_id, 'rule_file', p);
	return p;
}

function isRuleContentEditable(section_id) {
	var mode = uci.get('mosdns', section_id, 'mode');
	return mode === 'blacklist' || mode === 'ip_map' || mode === 'hosts' ||
		mode === 'redirect' || mode === 'custom';
}

return view.extend({
	load: function () {
		return uci.load('mosdns');
	},

		render: function () {
		var m, s, o, a;
		var groups = uci.sections('mosdns', 'dns_group');
		var groupNameMap = {};
		var defaultGroup = null;

		groups.forEach(function (g, idx) {
			var label = g.name || g['.name'];
			groupNameMap[g['.name']] = label;
			if (g.is_default === '1')
				defaultGroup = g['.name'];
		});

		if (!defaultGroup && groups.length)
			defaultGroup = groups[0]['.name'];

		m = new form.Map('mosdns', _('Rule Settings'),
			_('Rules are matched from top to bottom. If no rule matches, the default DNS group is used as fallback.'));

		a = m.section(form.TypedSection, 'mosdns', _('Default Actions'));
		a.anonymous = true;
		a.addremove = false;
		a.cfgsections = function () {
			return [ 'config' ];
		};

		o = a.option(form.Button, '_restore_defaults', _('Restore Default Rules'));
		o.inputtitle = _('Restore Default Rules');
		o.inputstyle = 'remove';
		o.onclick = function () {
			if (!confirm(_('This operation will clear current rule settings and restore default DNS groups (CN/Global). Continue?')))
				return Promise.resolve();

			return fs.exec('/usr/share/mosdns/mosdns.sh', ['restore_rule_defaults'])
				.then(function (res) {
					if (res.code !== 0) {
						ui.addNotification(null, E('p', _('Failed to restore default rules.')), 'error');
						return;
					}

					return fs.exec('/etc/init.d/mosdns', ['restart'])
						.then(function () {
							ui.addNotification(null, E('p', _('Default rules restored.')), 'info');
							window.location.reload();
						});
				});
		};

		o = a.option(form.Button, '_restore_rules_only', _('Restore Default Rules (Keep DNS Groups)'));
		o.inputtitle = _('Restore Default Rules (Keep DNS Groups)');
		o.inputstyle = 'remove';
		o.onclick = function () {
			if (!confirm(_('This operation will clear current rule settings only and keep current DNS groups. Continue?')))
				return Promise.resolve();

			return fs.exec('/usr/share/mosdns/mosdns.sh', ['restore_rule_defaults_keep_groups'])
				.then(function (res) {
					if (res.code !== 0) {
						ui.addNotification(null, E('p', _('Failed to restore default rules.')), 'error');
						return;
					}

					return fs.exec('/etc/init.d/mosdns', ['restart'])
						.then(function () {
							ui.addNotification(null, E('p', _('Default rules restored.')), 'info');
							window.location.reload();
						});
				});
		};

		o = a.option(form.ListValue, 'fallback_ip_strategy', _('Fallback IP Strategy'),
			_('IP resolve strategy for fallback queries when no rule matches.'));
		o.value('auto', _('Auto'));
		o.value('ipv4', _('IPv4 Only'));
		o.value('ipv6', _('IPv6 Only'));
		o.value('ipv4_first', _('IPv4 First'));
		o.value('ipv6_first', _('IPv6 First'));
		o.default = 'auto';
		o.rmempty = false;

		s = m.section(form.GridSection, 'rule', _('Rule List'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.modaltitle = _('Rule');
		s.addbtntitle = _('Add Rule');
		s.cfgsections = function () {
			return uci.sections('mosdns', 'rule')
				.sort(function (a, b) {
					return (a['.index'] || 0) - (b['.index'] || 0);
				})
				.map(function (sec) { return sec['.name']; });
		};

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.rmempty = false;
		o.default = '1';
		o.sortable = false;

		o = s.option(form.Value, 'name', _('Rule Name'));
		o.rmempty = false;
		o.placeholder = _('New Rule');
		o.sortable = false;

		o = s.option(form.ListValue, 'mode', _('Mode'));
		o.value('blacklist', _('Blacklist'));
		o.value('builtin', _('Built-in Rule'));
		o.value('ip_map', _('IP Mapping'));
		o.value('hosts', _('HOSTS'));
		o.value('redirect', _('Redirect'));
		o.value('custom', _('Custom Rule'));
		o.default = 'custom';
		o.rmempty = false;
		o.textvalue = function (section_id) {
			var mode = uci.get('mosdns', section_id, 'mode') || 'custom';
			var base = {
				blacklist: _('Blacklist'),
				builtin: _('Built-in Rule'),
				ip_map: _('IP Mapping'),
				hosts: _('HOSTS'),
				redirect: _('Redirect'),
				custom: _('Custom Rule')
			}[mode] || mode;

			if (mode === 'blacklist') {
				var b = uci.get('mosdns', section_id, 'blacklist_type') || 'domain';
				var sub = b === 'ptr' ? _('PTR Blacklist') : _('Domain Blacklist');
				return '%s (%s)'.format(base, sub);
			}

			if (mode === 'builtin') {
				var t = uci.get('mosdns', section_id, 'builtin_type') || 'adblock';
				var sub2 = {
					adblock: _('ADBlock Rule'),
					cn_domain: _('China Domain'),
					noncn_domain: _('Global Domain'),
					apple_domain: _('Apple Domain Optimization'),
					stream_media: _('Streaming Media')
				}[t] || t;
				return '%s (%s)'.format(base, sub2);
			}

			return base;
		};
		o.sortable = false;

		o = s.option(form.ListValue, 'blacklist_type', _('Blacklist Type'));
		o.value('domain', _('Domain Blacklist'));
		o.value('ptr', _('PTR Blacklist'));
		o.default = 'domain';
		o.depends('mode', 'blacklist');
		o.modalonly = true;
		o.sortable = false;

		o = s.option(form.ListValue, 'builtin_type', _('Built-in Type'));
		o.value('adblock', _('ADBlock Rule'));
		o.value('cn_domain', _('China Domain'));
		o.value('noncn_domain', _('Global Domain'));
		o.value('apple_domain', _('Apple Domain Optimization'));
		o.value('stream_media', _('Streaming Media'));
		o.default = 'adblock';
		o.depends('mode', 'builtin');
		o.modalonly = true;
		o.sortable = false;

		o = s.option(form.DynamicList, 'ad_source', _('ADblock Source'),
			_('Use preset AD rule sources only. Custom URLs or local files are not allowed.'));
		o.value('geosite.dat', 'v2ray-geosite');
		o.value('https://raw.githubusercontent.com/privacy-protection-tools/anti-AD/master/anti-ad-domains.txt', 'anti-AD');
		o.value('https://raw.githubusercontent.com/Cats-Team/AdRules/main/mosdns_adrules.txt', 'Cats-Team/AdRules');
		o.value('https://raw.githubusercontent.com/neodevpro/neodevhost/master/domain', 'NEO DEV HOST');
		o.default = 'geosite.dat';
		o.validate = function (section_id, value) {
			if (!value || PRESET_AD_SOURCE_MAP[value])
				return true;
			return _('Only preset ADblock sources are allowed.');
		};
		o.depends({ mode: 'builtin', builtin_type: 'adblock' });
		o.modalonly = true;
		o.sortable = false;

		o = s.option(form.DynamicList, 'ip_map_target', _('Mapped IP'));
		o.datatype = 'ipaddr';
		o.depends('mode', 'ip_map');
		o.modalonly = true;
		o.sortable = false;

		o = s.option(form.ListValue, 'dns_group', _('DNS Group'));
		groups.forEach(function (g) {
			var label = g.name || g['.name'];
			o.value(g['.name'], label);
		});
		if (defaultGroup)
			o.default = defaultGroup;
		o.textvalue = function (section_id) {
			var mode = uci.get('mosdns', section_id, 'mode');
			var bt = uci.get('mosdns', section_id, 'builtin_type');
			if (mode !== 'custom' && !(mode === 'builtin' && (bt === 'cn_domain' || bt === 'noncn_domain' || bt === 'apple_domain' || bt === 'stream_media')))
				return '-';

			var v = uci.get('mosdns', section_id, 'dns_group');
			if (!v)
				return _('Default DNS Group');

			var m = /^@dns_group\[(\d+)\]$/.exec(v || '');
			if (m) {
				var idx = +m[1];
				return (groups[idx] && (groups[idx].name || groups[idx]['.name'])) || _('Default DNS Group');
			}
			return groupNameMap[v] || _('Default DNS Group');
		};
		o.depends('mode', 'custom');
		o.depends({ mode: 'builtin', builtin_type: 'cn_domain' });
		o.depends({ mode: 'builtin', builtin_type: 'noncn_domain' });
		o.depends({ mode: 'builtin', builtin_type: 'apple_domain' });
		o.depends({ mode: 'builtin', builtin_type: 'stream_media' });
		o.sortable = false;

		o = s.option(form.ListValue, 'ip_strategy', _('IP Resolve Strategy'));
		o.value('auto', _('Auto'));
		o.value('ipv4', _('IPv4 Only'));
		o.value('ipv6', _('IPv6 Only'));
		o.value('ipv4_first', _('IPv4 First'));
		o.value('ipv6_first', _('IPv6 First'));
		o.default = 'auto';
		o.depends('mode', 'custom');
		o.depends({ mode: 'builtin', builtin_type: 'cn_domain' });
		o.depends({ mode: 'builtin', builtin_type: 'noncn_domain' });
		o.depends({ mode: 'builtin', builtin_type: 'apple_domain' });
		o.depends({ mode: 'builtin', builtin_type: 'stream_media' });
		o.modalonly = true;
		o.sortable = false;

		o = s.option(form.Value, 'ttl', _('TTL Override'));
		o.datatype = 'and(uinteger,min(0),max(604800))';
		o.default = '0';
		o.depends('mode', 'custom');
		o.modalonly = true;
		o.sortable = false;

		o = s.option(form.TextValue, '_rule_content', _('Rule Content'));
		o.rows = 16;
		o.modalonly = true;
		o.depends('mode', 'blacklist');
		o.depends('mode', 'ip_map');
		o.depends('mode', 'hosts');
		o.depends('mode', 'redirect');
		o.depends('mode', 'custom');
		o.sortable = false;
		o.cfgvalue = function (section_id) {
			if (!isRuleContentEditable(section_id))
				return '';
			return fs.trimmed(ensureRuleFile(section_id)).catch(function () { return ''; });
		};
		o.write = function (section_id, formvalue) {
			if (!isRuleContentEditable(section_id))
				return Promise.resolve();

			return fs.write(ensureRuleFile(section_id), (formvalue || '').trim().replace(/\r\n/g, '\n') + '\n')
				.catch(function (e) {
					ui.addNotification(null, E('p', _('Unable to save contents: %s').format(e.message)));
				});
		};

		o = s.option(form.Value, 'rule_file', _('Rule File'));
		o.readonly = true;
		o.rmempty = false;
		o.modalonly = true;
		o.depends('mode', 'blacklist');
		o.depends('mode', 'ip_map');
		o.depends('mode', 'hosts');
		o.depends('mode', 'redirect');
		o.depends('mode', 'custom');
		o.sortable = false;
		o.cfgvalue = function (section_id) {
			return uci.get('mosdns', section_id, 'rule_file') || ensureRuleFile(section_id);
		};

		return m.render();
	}
});
