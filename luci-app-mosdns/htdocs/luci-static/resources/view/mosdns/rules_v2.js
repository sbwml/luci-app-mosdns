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

var RULE_CONTENT_SAMPLES = {
	blacklist_domain: [
		'# domain blacklist examples',
		'ads.example.com',
		'tracker.example.net'
	].join('\n'),
	blacklist_ptr: [
		'# ptr blacklist examples',
		'10.in-addr.arpa',
		'168.192.in-addr.arpa',
		'domain:ip6.arpa'
	].join('\n'),
	hosts: [
		'# hosts rewrite examples',
		'a.com 127.0.0.4',
		'b.com 127.0.0.5'
	].join('\n'),
	redirect: [
		'# redirect examples',
		'a.com b.com',
		'foo.example bar.example'
	].join('\n'),
	custom: [
		'# custom rule examples',
		'example.com',
		'full:www.example.com',
		'keyword:stream',
		'regexp:^ads[0-9]*\\.example\\.com$'
	].join('\n'),
	ip_map: [
		'# ip or cidr list examples',
		'1.1.1.1',
		'1.0.0.0/24'
	].join('\n')
};

function ruleTypeLabel(mode, blacklistType, builtinType) {
	var base = {
		blacklist: _('Blacklist'),
		builtin: _('Built-in Rule'),
		ip_map: _('IP Mapping'),
		hosts: _('HOSTS'),
		redirect: _('Redirect'),
		custom: _('Custom Rule')
	}[mode] || mode;

	if (mode === 'blacklist') {
		var sub = blacklistType === 'ptr' ? _('PTR Blacklist') : _('Domain Blacklist');
		return '%s (%s)'.format(base, sub);
	}

	if (mode === 'builtin') {
		var sub2 = {
			adblock: _('ADBlock Rule'),
			cn_domain: _('China Domain'),
			noncn_domain: _('Global Domain'),
			apple_domain: _('Apple Domain Optimization')
		}[builtinType] || builtinType;
		return '%s (%s)'.format(base, sub2);
	}

	return base;
}

function ensureRuleSample(section_id) {
	var mode = uci.get('mosdns', section_id, 'mode') || 'custom';
	var bt = uci.get('mosdns', section_id, 'blacklist_type') || 'domain';
	var key = null;

	if (mode === 'blacklist')
		key = bt === 'ptr' ? 'blacklist_ptr' : 'blacklist_domain';
	else if (mode === 'hosts')
		key = 'hosts';
	else if (mode === 'redirect')
		key = 'redirect';
	else if (mode === 'custom')
		key = 'custom';
	else if (mode === 'ip_map')
		key = 'ip_map';

	if (!key)
		return Promise.resolve();

	var file = ensureRuleFile(section_id);
	if (!file)
		return Promise.resolve();

	return fs.trimmed(file).catch(function () { return ''; }).then(function (old) {
		if (old && old.trim().length)
			return;
		return fs.write(file, RULE_CONTENT_SAMPLES[key] + '\n');
	});
}

function createRuleByType(typeId, defaultGroup, cnGroup, globalGroup) {
	var sid = uci.add('mosdns', 'rule');
	var name = _('New Rule');

	uci.set('mosdns', sid, 'enabled', '1');
	uci.set('mosdns', sid, 'ip_strategy', 'auto');
	uci.set('mosdns', sid, 'ttl', '0');

	if (typeId === 'builtin_adblock') {
		uci.set('mosdns', sid, 'name', _('ADBlock Rule'));
		uci.set('mosdns', sid, 'mode', 'builtin');
		uci.set('mosdns', sid, 'builtin_type', 'adblock');
		uci.set('mosdns', sid, 'ad_source', 'geosite.dat');
		uci.set('mosdns', sid, 'enabled', '0');
	} else if (typeId === 'builtin_apple') {
		uci.set('mosdns', sid, 'name', _('Apple Domain Optimization'));
		uci.set('mosdns', sid, 'mode', 'builtin');
		uci.set('mosdns', sid, 'builtin_type', 'apple_domain');
		uci.set('mosdns', sid, 'dns_group', cnGroup || defaultGroup || '');
		uci.set('mosdns', sid, 'rule_file', '/var/mosdns/geosite_apple.txt');
		uci.set('mosdns', sid, 'enabled', '0');
	} else if (typeId === 'builtin_cn') {
		uci.set('mosdns', sid, 'name', _('China Domain'));
		uci.set('mosdns', sid, 'mode', 'builtin');
		uci.set('mosdns', sid, 'builtin_type', 'cn_domain');
		uci.set('mosdns', sid, 'dns_group', cnGroup || defaultGroup || '');
		uci.set('mosdns', sid, 'rule_file', '/var/mosdns/geosite_cn.txt');
	} else if (typeId === 'builtin_global') {
		uci.set('mosdns', sid, 'name', _('Global Domain'));
		uci.set('mosdns', sid, 'mode', 'builtin');
		uci.set('mosdns', sid, 'builtin_type', 'noncn_domain');
		uci.set('mosdns', sid, 'dns_group', globalGroup || defaultGroup || '');
		uci.set('mosdns', sid, 'rule_file', '/var/mosdns/geosite_geolocation-!cn.txt');
	} else if (typeId === 'custom_ddns') {
		uci.set('mosdns', sid, 'name', _('DDNS Lists'));
		uci.set('mosdns', sid, 'mode', 'custom');
		uci.set('mosdns', sid, 'dns_group', cnGroup || defaultGroup || '');
		uci.set('mosdns', sid, 'ttl', '5');
		uci.set('mosdns', sid, 'rule_file', '/etc/mosdns/rule/ddnslist.txt');
	} else if (typeId === 'blacklist_domain') {
		uci.set('mosdns', sid, 'name', _('Domain Blacklist'));
		uci.set('mosdns', sid, 'mode', 'blacklist');
		uci.set('mosdns', sid, 'blacklist_type', 'domain');
		ensureRuleFile(sid);
	} else if (typeId === 'blacklist_ptr') {
		uci.set('mosdns', sid, 'name', _('PTR Blacklist'));
		uci.set('mosdns', sid, 'mode', 'blacklist');
		uci.set('mosdns', sid, 'blacklist_type', 'ptr');
		ensureRuleFile(sid);
	} else if (typeId === 'hosts') {
		uci.set('mosdns', sid, 'name', _('HOSTS'));
		uci.set('mosdns', sid, 'mode', 'hosts');
		ensureRuleFile(sid);
	} else if (typeId === 'redirect') {
		uci.set('mosdns', sid, 'name', _('Redirect'));
		uci.set('mosdns', sid, 'mode', 'redirect');
		ensureRuleFile(sid);
	} else if (typeId === 'ip_map') {
		uci.set('mosdns', sid, 'name', _('IP Mapping'));
		uci.set('mosdns', sid, 'mode', 'ip_map');
		ensureRuleFile(sid);
	} else {
		uci.set('mosdns', sid, 'name', name);
		uci.set('mosdns', sid, 'mode', 'custom');
		uci.set('mosdns', sid, 'dns_group', defaultGroup || '');
		ensureRuleFile(sid);
	}

	return ensureRuleSample(sid).then(function () { return sid; });
}

function isIpToken(s) {
	return /^(\d{1,3}\.){3}\d{1,3}$/.test(s) || /:/.test(s);
}

function normalizeHostsContent(raw) {
	return (raw || '').split(/\n/).map(function (line) {
		var t = line.trim();
		if (!t || t.charAt(0) === '#')
			return line;

		var parts = t.split(/\s+/);
		if (parts.length >= 2 && isIpToken(parts[0]) && !isIpToken(parts[1]))
			return [ parts[1], parts[0] ].concat(parts.slice(2)).join(' ');

		return t;
	}).join('\n');
}

function logUiEvent(evt) {
	return fs.exec('/usr/share/mosdns/mosdns.sh', [ 'ui_event', evt, 'rules_v2' ]).catch(function () { return null; });
}

function flushAndRestartMosdns() {
	return fs.exec('/usr/share/mosdns/mosdns.sh', [ 'flush' ])
		.catch(function () { return null; })
		.then(function () {
			return fs.exec('/etc/init.d/mosdns', [ 'restart' ]);
		});
}

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

	handleSave: function () {
		if (!this.map)
			return Promise.resolve();

		return logUiEvent('save_click').then(L.bind(function () {
			return this.map.save(null, false);
		}, this));
	},

	handleSaveApply: function (ev) {
		return logUiEvent('save_apply_click').then(L.bind(function () {
			return this.handleSave(ev);
		}, this)).then(function () {
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
		var m, s, o, a;
		var groups = uci.sections('mosdns', 'dns_group');
		var groupNameMap = {};
		var defaultGroup = null;
		var cnGroup = null;
		var globalGroup = null;

		groups.forEach(function (g, idx) {
			var label = g.name || g['.name'];
			groupNameMap[g['.name']] = label;
			if (g.is_default === '1')
				defaultGroup = g['.name'];
			if (label === '国内' && !cnGroup)
				cnGroup = g['.name'];
			if (label === '国外' && !globalGroup)
				globalGroup = g['.name'];
		});

		if (!defaultGroup && groups.length)
			defaultGroup = groups[0]['.name'];

		m = new form.Map('mosdns', _('Rule Settings'),
			_('Rules are matched from top to bottom. If no rule matches, the default DNS group is used as fallback.'));
		this.map = m;

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
		s.handleAdd = function (ev) {
			if (ev)
				ev.preventDefault();

			return new Promise(function (resolve) {
				var choices = [
					{ id: 'builtin_adblock', label: _('ADBlock Rule') },
					{ id: 'builtin_apple', label: _('Apple Domain Optimization') },
					{ id: 'custom_ddns', label: _('DDNS Lists') },
					{ id: 'builtin_cn', label: _('China Domain') },
					{ id: 'builtin_global', label: _('Global Domain') },
					{ id: 'hosts', label: _('HOSTS') },
					{ id: 'redirect', label: _('Redirect') },
					{ id: 'blacklist_ptr', label: _('PTR Blacklist') },
					{ id: 'blacklist_domain', label: _('Domain Blacklist') },
					{ id: 'ip_map', label: _('IP Mapping') },
					{ id: 'custom', label: _('Custom Rule') }
				];
				var selector = E('select', { 'class': 'cbi-input-select' }, choices.map(function (it) {
					return E('option', { value: it.id }, [ it.label ]);
				}));

				ui.showModal(_('Add Rule'), [
					E('div', { 'class': 'cbi-section' }, [
						E('p', _('Select rule type for the new rule. Type cannot be changed later.')),
						selector
					]),
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'btn cbi-button cbi-button-reset',
							'click': function (e) {
								e.preventDefault();
								ui.hideModal();
								resolve();
							}
						}, [ _('Cancel') ]),
						' ',
						E('button', {
							'class': 'btn cbi-button cbi-button-add important',
							'click': function (e) {
								e.preventDefault();
								var typeId = selector.value || 'custom';
								createRuleByType(typeId, defaultGroup, cnGroup, globalGroup).then(function () {
									ui.hideModal();
									window.location.reload();
									resolve();
								}).catch(function () {
									ui.addNotification(null, E('p', _('Failed to create rule.')), 'error');
									resolve();
								});
							}
						}, [ _('Add') ])
					])
				]);
			});
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
		o.readonly = true;
		o.textvalue = function (section_id) {
			var mode = uci.get('mosdns', section_id, 'mode') || 'custom';
			var b = uci.get('mosdns', section_id, 'blacklist_type') || 'domain';
			var t = uci.get('mosdns', section_id, 'builtin_type') || 'adblock';
			return ruleTypeLabel(mode, b, t);
		};
		o.sortable = false;

		o = s.option(form.ListValue, 'blacklist_type', _('Blacklist Type'));
		o.value('domain', _('Domain Blacklist'));
		o.value('ptr', _('PTR Blacklist'));
		o.default = 'domain';
		o.depends('mode', 'blacklist');
		o.modalonly = true;
		o.readonly = true;
		o.sortable = false;

		o = s.option(form.ListValue, 'builtin_type', _('Built-in Type'));
		o.value('adblock', _('ADBlock Rule'));
		o.value('cn_domain', _('China Domain'));
		o.value('noncn_domain', _('Global Domain'));
		o.value('apple_domain', _('Apple Domain Optimization'));
		o.default = 'adblock';
		o.depends('mode', 'builtin');
		o.modalonly = true;
		o.readonly = true;
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
			if (mode !== 'custom' && !(mode === 'builtin' && (bt === 'cn_domain' || bt === 'noncn_domain' || bt === 'apple_domain')))
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
			var content = (formvalue || '').trim().replace(/\r\n/g, '\n');
			if (uci.get('mosdns', section_id, 'mode') === 'hosts')
				content = normalizeHostsContent(content);

			return fs.write(ensureRuleFile(section_id), content + '\n')
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
