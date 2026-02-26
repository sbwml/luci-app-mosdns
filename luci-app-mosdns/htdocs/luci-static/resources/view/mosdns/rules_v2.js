'use strict';
'require form';
'require fs';
'require rpc';
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

var RULE_TYPE_META = {
	adblock: {
		label: _('ADBlock Rule'),
		desc: _('Filter advertisement domains using preset sources.')
	},
	apple_domain: {
		label: _('Apple Domain Optimization'),
		desc: _('Route Apple domains to the selected DNS group.')
	},
	cn_domain: {
		label: _('China Domain'),
		desc: _('Route China domains to the selected DNS group.')
	},
	noncn_domain: {
		label: _('Global Domain'),
		desc: _('Route non-China domains to the selected DNS group.')
	},
	hosts: {
		label: _('HOSTS'),
		desc: _('Resolve domains from HOSTS list with fixed IP mapping.')
	},
	redirect: {
		label: _('Redirect'),
		desc: _('Rewrite queried domains to another domain.')
	},
	blacklist_ptr: {
		label: _('PTR Blacklist'),
		desc: _('Block PTR reverse-lookup domains in list.')
	},
	blacklist_domain: {
		label: _('Domain Blacklist'),
		desc: _('Block domains in list.')
	},
	custom: {
		label: _('Custom Rule'),
		desc: _('Apply custom domain rules (plain/full/keyword/regexp). You can set TTL as needed.')
	}
};

var callUciOrder = rpc.declare({
	object: 'uci',
	method: 'order',
	params: [ 'config', 'sections' ],
	expect: { '': 0 }
});

var RULE_CONTENT_SAMPLES = {
	blacklist_domain: [
		'# domain blacklist examples',
		'ads.example.com',
		'tracker.example.net'
	].join('\n'),
	blacklist_ptr: [
		'# ptr blacklist examples',
		'10.in-addr.arpa',
		'127.in-addr.arpa',
		'16.172.in-addr.arpa',
		'17.172.in-addr.arpa',
		'18.172.in-addr.arpa',
		'19.172.in-addr.arpa',
		'20.172.in-addr.arpa',
		'21.172.in-addr.arpa',
		'22.172.in-addr.arpa',
		'23.172.in-addr.arpa',
		'24.172.in-addr.arpa',
		'25.172.in-addr.arpa',
		'26.172.in-addr.arpa',
		'27.172.in-addr.arpa',
		'28.172.in-addr.arpa',
		'29.172.in-addr.arpa',
		'30.172.in-addr.arpa',
		'31.172.in-addr.arpa',
		'64.100.in-addr.arpa',
		'65.100.in-addr.arpa',
		'66.100.in-addr.arpa',
		'67.100.in-addr.arpa',
		'68.100.in-addr.arpa',
		'69.100.in-addr.arpa',
		'70.100.in-addr.arpa',
		'71.100.in-addr.arpa',
		'72.100.in-addr.arpa',
		'73.100.in-addr.arpa',
		'74.100.in-addr.arpa',
		'75.100.in-addr.arpa',
		'76.100.in-addr.arpa',
		'77.100.in-addr.arpa',
		'78.100.in-addr.arpa',
		'79.100.in-addr.arpa',
		'80.100.in-addr.arpa',
		'81.100.in-addr.arpa',
		'82.100.in-addr.arpa',
		'83.100.in-addr.arpa',
		'84.100.in-addr.arpa',
		'85.100.in-addr.arpa',
		'86.100.in-addr.arpa',
		'87.100.in-addr.arpa',
		'88.100.in-addr.arpa',
		'89.100.in-addr.arpa',
		'90.100.in-addr.arpa',
		'91.100.in-addr.arpa',
		'92.100.in-addr.arpa',
		'93.100.in-addr.arpa',
		'94.100.in-addr.arpa',
		'95.100.in-addr.arpa',
		'96.100.in-addr.arpa',
		'97.100.in-addr.arpa',
		'98.100.in-addr.arpa',
		'99.100.in-addr.arpa',
		'100.100.in-addr.arpa',
		'101.100.in-addr.arpa',
		'102.100.in-addr.arpa',
		'103.100.in-addr.arpa',
		'104.100.in-addr.arpa',
		'105.100.in-addr.arpa',
		'106.100.in-addr.arpa',
		'107.100.in-addr.arpa',
		'108.100.in-addr.arpa',
		'109.100.in-addr.arpa',
		'110.100.in-addr.arpa',
		'111.100.in-addr.arpa',
		'112.100.in-addr.arpa',
		'113.100.in-addr.arpa',
		'114.100.in-addr.arpa',
		'115.100.in-addr.arpa',
		'116.100.in-addr.arpa',
		'117.100.in-addr.arpa',
		'118.100.in-addr.arpa',
		'119.100.in-addr.arpa',
		'120.100.in-addr.arpa',
		'121.100.in-addr.arpa',
		'122.100.in-addr.arpa',
		'123.100.in-addr.arpa',
		'124.100.in-addr.arpa',
		'125.100.in-addr.arpa',
		'126.100.in-addr.arpa',
		'127.100.in-addr.arpa',
		'2.0.192.in-addr.arpa',
		'168.192.in-addr.arpa',
		'255.255.255.255.in-addr.arpa',
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

function getRuleTypeId(section_id) {
	var mode = uci.get('mosdns', section_id, 'mode') || 'custom';
	var bt = uci.get('mosdns', section_id, 'builtin_type') || '';
	var blt = uci.get('mosdns', section_id, 'blacklist_type') || 'domain';

	if (mode === 'builtin')
		return bt || 'custom';

	if (mode === 'blacklist')
		return blt === 'ptr' ? 'blacklist_ptr' : 'blacklist_domain';

	if (mode === 'hosts')
		return 'hosts';

	if (mode === 'redirect')
		return 'redirect';

	if (mode === 'ip_map')
		return 'ip_map';

	return 'custom';
}

function ruleTypeLabel(section_id) {
	var t = getRuleTypeId(section_id);
	return (RULE_TYPE_META[t] && RULE_TYPE_META[t].label) || _('Custom Rule');
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
	}).catch(function () {
		return;
	});
}

function createRuleByType(typeId, defaultGroup, cnGroup, globalGroup) {
	var sid = uci.add('mosdns', 'rule', 'rule_' + String(Date.now()));
	var name = _('New Rule');

	if (!sid)
		return Promise.reject(new Error('failed to add uci rule section'));

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
		uci.set('mosdns', sid, 'ip_strategy', 'ipv4');
		uci.set('mosdns', sid, 'rule_file', '/var/mosdns/geosite_geolocation-!cn.txt');
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
	} else {
		uci.set('mosdns', sid, 'name', name);
		uci.set('mosdns', sid, 'mode', 'custom');
		uci.set('mosdns', sid, 'dns_group', defaultGroup || '');
		ensureRuleFile(sid);
	}

	return ensureRuleSample(sid).then(function () { return sid; });
}

function moveRuleToTop(section_id) {
	if (!section_id)
		return Promise.resolve();

	var order = [ section_id ];
	uci.sections('mosdns', 'rule').forEach(function (sec) {
		if (sec['.name'] !== section_id)
			order.push(sec['.name']);
	});

	return callUciOrder('mosdns', order);
}

function bindNewRuleModalCancel(section, section_id) {
	window.setTimeout(function () {
		var modal = document.getElementById('modal_overlay');
		if (!modal)
			return;

		var committed = false;
		var buttons = modal.querySelectorAll('button, .btn');

		for (var i = 0; i < buttons.length; i++) {
			buttons[i].addEventListener('click', function (ev) {
				var cls = String((ev.currentTarget && ev.currentTarget.className) || '');
				var txt = String((ev.currentTarget && (ev.currentTarget.textContent || ev.currentTarget.innerText)) || '').trim().toLowerCase();

				if (cls.indexOf('cbi-button-save') >= 0 || cls.indexOf('cbi-button-apply') >= 0 || cls.indexOf('cbi-button-positive') >= 0 || txt === 'save' || txt === '保存')
					committed = true;

				if (cls.indexOf('cbi-button-reset') >= 0 || cls.indexOf('cbi-button-negative') >= 0 || txt === 'cancel' || txt === '取消' || txt === 'dismiss' || txt === 'close' || txt === '关闭') {
					if (!committed) {
						uci.remove('mosdns', section_id);
						section.__newOrder = (section.__newOrder || []).filter(function (id) {
							return id !== section_id;
						});
						window.setTimeout(function () { window.location.reload(); }, 0);
					}
				}
			});
		}
	}, 120);
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

function ensureRuleModalHiddenFieldsStyle() {
	var id = 'mosdns-rules-modal-hidden-fields';
	if (document.getElementById(id))
		return;

	var style = document.createElement('style');
	style.id = id;
	style.textContent = [
		'#modal_overlay .cbi-value[data-name="mode"] { display: none !important; }',
		'#modal_overlay .cbi-value[data-name="builtin_type"] { display: none !important; }',
		'#modal_overlay .cbi-value[data-name="blacklist_type"] { display: none !important; }'
	].join('\n');
	document.head.appendChild(style);
}

function hideRuleInternalFieldsInModal() {
	var modal = document.getElementById('modal_overlay');
	if (!modal)
		return;

	var rows = modal.querySelectorAll('.cbi-value');
	for (var i = 0; i < rows.length; i++) {
		var row = rows[i];
		var name = row.getAttribute('data-name') || '';
		var title = (row.querySelector('.cbi-value-title') && row.querySelector('.cbi-value-title').textContent || '').trim();

		if (name === 'mode' || name === 'builtin_type' || name === 'blacklist_type' ||
			title === 'Mode' || title === 'Built-in Type' || title === 'Blacklist Type' || title === '模式') {
			row.style.display = 'none';
		}
	}
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
		ensureRuleModalHiddenFieldsStyle();
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
		s.__newOrder = [];
		s.cfgsections = function () {
			var ids = uci.sections('mosdns', 'rule')
				.sort(function (a, b) {
					return (a['.index'] || 0) - (b['.index'] || 0);
				})
				.map(function (sec) { return sec['.name']; });

			(this.__newOrder || []).forEach(function (sid) {
				if (ids.indexOf(sid) >= 0)
					ids = [ sid ].concat(ids.filter(function (id) { return id !== sid; }));
			});

			return ids;
		};
		s.handleAdd = function (ev) {
			if (ev)
				ev.preventDefault();

			return new Promise(function (resolve) {
				var builtinChoices = [
					{ id: 'builtin_adblock', key: 'adblock' },
					{ id: 'builtin_apple', key: 'apple_domain' },
					{ id: 'builtin_cn', key: 'cn_domain' },
					{ id: 'builtin_global', key: 'noncn_domain' }
				];
				var otherChoices = [
					{ id: 'hosts', key: 'hosts' },
					{ id: 'redirect', key: 'redirect' },
					{ id: 'blacklist_ptr', key: 'blacklist_ptr' },
					{ id: 'blacklist_domain', key: 'blacklist_domain' },
					{ id: 'custom', key: 'custom' }
				];
				var choices = builtinChoices.concat(otherChoices);
				var optionNodes = [];

				builtinChoices.forEach(function (it) {
					optionNodes.push(E('option', { value: it.id }, [ RULE_TYPE_META[it.key].label ]));
				});
				optionNodes.push(E('option', { value: '__sep__', disabled: 'disabled' }, [ '────────' ]));
				otherChoices.forEach(function (it) {
					optionNodes.push(E('option', { value: it.id }, [ RULE_TYPE_META[it.key].label ]));
				});

				var selector = E('select', { 'class': 'cbi-input-select' }, optionNodes);
				var descBox = E('p', { 'style': 'margin-top:0.6em; opacity:.9' }, [ '' ]);

				var updateDesc = function () {
					var t = selector.value || 'custom';
					var row = choices.filter(function (x) { return x.id === t; })[0] || choices[choices.length - 1];
					descBox.textContent = RULE_TYPE_META[row.key].desc;
				};
				selector.addEventListener('change', updateDesc);
				updateDesc();

				ui.showModal(_('Add Rule'), [
					E('div', { 'class': 'cbi-section' }, [
						E('p', _('Select a rule type to create. Type cannot be changed later.')),
						selector,
						descBox
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
								var createdSid = null;
								var typeId = selector.value || 'custom';
								if (typeId === '__sep__')
									typeId = 'custom';
								createRuleByType(typeId, defaultGroup, cnGroup, globalGroup).then(function (sid) {
									createdSid = sid;
									s.__newOrder = [ sid ].concat((s.__newOrder || []).filter(function (id) {
										return id !== sid;
									}));
									return m.render();
								}).then(function () {
									ui.hideModal();
									if (typeof s.renderMoreOptionsModal === 'function') {
										s.renderMoreOptionsModal(createdSid);
										bindNewRuleModalCancel(s, createdSid);
									}
									resolve();
								}).catch(function (err) {
									ui.addNotification(null, E('p', _('Failed to create rule.') + ' ' + (err && err.message ? err.message : '')), 'error');
									resolve();
								});
							}
						}, [ _('Add') ])
					])
				]);
			});
		};

		var _renderMoreOptionsModal = s.renderMoreOptionsModal;
		s.renderMoreOptionsModal = function (section_id) {
			var rv = _renderMoreOptionsModal.apply(this, arguments);
			return Promise.resolve(rv).then(function () {
				hideRuleInternalFieldsInModal();
				return rv;
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

		o = s.option(form.DummyValue, '_rule_type', _('Rule Type'));
		o.cfgvalue = function (section_id) {
			return ruleTypeLabel(section_id);
		};
		o.sortable = false;

		o = s.option(form.ListValue, 'mode', _('Mode'));
		o.value('blacklist', _('Blacklist'));
		o.value('builtin', _('Built-in Rule'));
		o.value('ip_map', _('IP Mapping'));
		o.value('hosts', _('HOSTS'));
		o.value('redirect', _('Redirect'));
		o.value('custom', _('Custom Rule'));
		o.default = 'custom';
		o.readonly = true;
		o.modalonly = true;
		o.textvalue = function (section_id) {
			return ruleTypeLabel(section_id);
		};
		o.sortable = false;

		o = s.option(form.ListValue, 'blacklist_type', _('Blacklist Type'));
		o.value('domain', _('Domain Blacklist'));
		o.value('ptr', _('PTR Blacklist'));
		o.default = 'domain';
		o.readonly = true;
		o.modalonly = true;
		o.depends('mode', 'blacklist');
		o.sortable = false;

		o = s.option(form.ListValue, 'builtin_type', _('Built-in Type'));
		o.value('adblock', _('ADBlock Rule'));
		o.value('cn_domain', _('China Domain'));
		o.value('noncn_domain', _('Global Domain'));
		o.value('apple_domain', _('Apple Domain Optimization'));
		o.default = 'adblock';
		o.readonly = true;
		o.modalonly = true;
		o.depends('mode', 'builtin');
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
		o.modalonly = true;
		o.depends('mode', 'custom');
		o.depends({ mode: 'builtin', builtin_type: 'cn_domain' });
		o.depends({ mode: 'builtin', builtin_type: 'noncn_domain' });
		o.depends({ mode: 'builtin', builtin_type: 'apple_domain' });
		o.sortable = false;

		o = s.option(form.Value, 'ttl', _('TTL Override'));
		o.datatype = 'and(uinteger,min(0),max(604800))';
		o.default = '0';
		o.modalonly = true;
		o.depends('mode', 'custom');
		o.sortable = false;

		o = s.option(form.TextValue, '_rule_content', _('Rule Content'));
		o.rows = 16;
		o.modalonly = true;
		o.sortable = false;
		o.depends('mode', 'blacklist');
		o.depends('mode', 'ip_map');
		o.depends('mode', 'hosts');
		o.depends('mode', 'redirect');
		o.depends('mode', 'custom');
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
		o.sortable = false;
		o.depends('mode', 'blacklist');
		o.depends('mode', 'ip_map');
		o.depends('mode', 'hosts');
		o.depends('mode', 'redirect');
		o.depends('mode', 'custom');
		o.cfgvalue = function (section_id) {
			return uci.get('mosdns', section_id, 'rule_file') || ensureRuleFile(section_id);
		};

		return m.render();
	}
});
