'use strict';
'require form';
'require fs';
'require ui';
'require view';

return view.extend({
	render() {
		const m = new form.Map('mosdns', _('Rule Settings'),
			_('The list of rules only apply to \'Default Config\' profiles.'));

		const s = m.section(form.TypedSection);
		s.anonymous = true;
		s.sortable = true;

		const handleSaveError = e => {
			ui.addNotification(null, E('p', _('Unable to save contents: %s').format(e.message)));
		};

		const rules = [
			{
				name: 'whitelist',
				title: _('White Lists'),
				file: '/etc/mosdns/rule/whitelist.txt',
				desc: '<font color=\'red\'>'
					+ _('Added domain names always permit resolution using \'local DNS\' with the highest priority (one domain per line, supports domain matching rules).')
					+ '</font>'
			},
			{
				name: 'blocklist',
				title: _('Block Lists'),
				file: '/etc/mosdns/rule/blocklist.txt',
				desc: '<font color=\'red\'>'
					+ _('Added domain names will block DNS resolution (one domain per line, supports domain matching rules).')
					+ '</font>'
			},
			{
				name: 'greylist',
				title: _('Grey Lists'),
				file: '/etc/mosdns/rule/greylist.txt',
				desc: '<font color=\'red\'>'
					+ _('Added domain names will always use \'Remote DNS\' for resolution (one domain per line, supports domain matching rules).')
					+ '</font>'
			},
			{
				name: 'ddnslist',
				title: _('DDNS Lists'),
				file: '/etc/mosdns/rule/ddnslist.txt',
				desc: '<font color=\'red\'>'
					+ _('Added domain names will always use \'Local DNS\' for resolution, with a forced TTL of 5 seconds, and results will not be cached (one domain per line, supports domain matching rules).')
					+ '</font>'
			},
			{
				name: 'hostslist',
				title: _('Hosts'),
				file: '/etc/mosdns/rule/hosts.txt',
				desc: '<font color=\'red\'>'
					+ _('Custom Hosts rewrite, for example: baidu.com 10.0.0.1 (one rule per line, supports domain matching rules).')
					+ '</font>'
			},
			{
				name: 'redirectlist',
				title: _('Redirect'),
				file: '/etc/mosdns/rule/redirect.txt',
				desc: '<font color=\'red\'>'
					+ _('Redirecting requests for domain names. Request domain A, but return records for domain B, for example: baidu.com qq.com (one rule per line).')
					+ '</font>'
			},
			{
				name: 'localptrlist',
				title: _('Block PTR'),
				file: '/etc/mosdns/rule/local-ptr.txt',
				desc: '<font color=\'red\'>'
					+ _('Added domain names will block PTR requests (one domain per line, supports domain matching rules).')
					+ '</font>'
			},
			{
				name: 'streamingmedialist',
				title: _('Streaming Media'),
				file: '/etc/mosdns/rule/streaming.txt',
				desc: '<font color=\'red\'>'
					+ _('When enabling \'Custom Stream Media DNS\', added domains will always use the \'Streaming Media DNS server\' for resolution (one domain per line, supports domain matching rules).')
					+ '</font>'
			}
		];

		rules.forEach(rule => {
			s.tab(rule.name, rule.title);

			const o = s.taboption(rule.name, form.TextValue, '_' + rule.name, null, rule.desc);
			o.rows = 25;
			o.cfgvalue = () => fs.trimmed(rule.file).catch(() => '');
			o.write = function(section_id, formvalue) {
				return this.cfgvalue(section_id).then(value => {
					if (value === formvalue) {
						return;
					}
					const content = (formvalue && formvalue.trim()) ? formvalue.trim().replace(/\r\n/g, '\n') + '\n' : '';
					return fs.write(rule.file, content).catch(handleSaveError);
				});
			};
			o.remove = () => fs.write(rule.file, '').catch(handleSaveError);
		});

		return m.render();
	},

	handleSaveApply(ev) {
		return this.handleSave(ev).then(() => {
			window.location.reload();
		});
	},

	handleReset: null
});
