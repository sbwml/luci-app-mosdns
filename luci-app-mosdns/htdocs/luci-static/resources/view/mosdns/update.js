'use strict';
'require form';
'require fs';
'require ui';
'require view';
'require rpc';

const callStartUpdate = rpc.declare({
	object: 'luci.mosdns',
	method: 'start_update',
	expect: { '': {} }
});

const callGetUpdateLog = rpc.declare({
	object: 'luci.mosdns',
	method: 'get_update_log',
	expect: { '': {} }
});

return view.extend({
	handleUpdate() {
		const statusMsg = E('p', { 'class': 'spinning' }, _('Please wait, this may take a few moments...'));

		const logTextarea = E('textarea', {
			'class': 'cbi-input-textarea',
			'readonly': 'readonly',
			'style': 'width: 100%; height: 300px; font-family: monospace; font-size: 12px; margin-top: 10px;',
			'placeholder': _('Starting update...')
		});

		const closeButton = E('button', {
			'class': 'btn',
			'style': 'display: none;',
			'click': ui.hideModal
		}, _('Close'));

		ui.showModal(_('Updating Database...'), [
			statusMsg,
			logTextarea,
			E('div', { 'class': 'right' }, [ closeButton ])
		]);

		const pollLog = () => {
			return callGetUpdateLog().then(res => {
				if (res && res.log) {
					logTextarea.value = res.log;
					logTextarea.scrollTop = logTextarea.scrollHeight;

					if (res.log.match(/UPDATE_FINISHED/)) {
						statusMsg.textContent = _('Update success');
						statusMsg.classList.remove('spinning');
						statusMsg.style.color = '#19be6b';
						statusMsg.style.fontWeight = 'bold';
						closeButton.style.display = 'inline';
						return false;
					}

					if (res.log.match(/UPDATE_EXITED/)) {
						statusMsg.textContent = _('Update failed');
						statusMsg.classList.remove('spinning');
						statusMsg.style.color = '#ed4014';
						statusMsg.style.fontWeight = 'bold';
						closeButton.style.display = 'inline';
						return false;
					}

					if (res.log.match(/Another update is already in progress/)) {
						statusMsg.textContent = _('Another update is already in progress.');
						statusMsg.classList.remove('spinning');
						statusMsg.style.color = '#ff9900';
						closeButton.style.display = 'inline';
						return false;
					}
				}
				return true;
			});
		};

		return callStartUpdate().then(res => {
			if (res.success) {
				const interval = window.setInterval(() => {
					pollLog().then(continuePolling => {
						if (!continuePolling) {
							window.clearInterval(interval);
						}
					});
				}, 1000);
			} else {
				if (res.error && res.error.match(/Another update is already in progress/)) {
					statusMsg.textContent = _('Another update is already in progress.');
					statusMsg.style.color = '#ff9900';
					callGetUpdateLog().then(logRes => {
						if (logRes && logRes.log) {
							logTextarea.value = logRes.log;
							logTextarea.scrollTop = logTextarea.scrollHeight;
						}
					});
				} else {
					statusMsg.textContent = res.error || _('Failed to start update.');
					statusMsg.style.color = '#ed4014';
				}
				statusMsg.classList.remove('spinning');
				closeButton.style.display = 'inline';
			}
		}).catch(e => {
			statusMsg.textContent = _('Update failed: %s').format(e.message);
			statusMsg.classList.remove('spinning');
			statusMsg.style.color = '#ed4014';
			closeButton.style.display = 'inline';
		});
	},

	render() {
		let m, s, o;

		m = new form.Map('mosdns', _('Update GeoIP & GeoSite databases'),
			_('Automatically update GeoIP and GeoSite databases as well as ad filtering rules through scheduled tasks.'));

		s = m.section(form.TypedSection);
		s.anonymous = true;

		o = s.option(form.Flag, 'geo_auto_update', _('Enable Auto Database Update'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'geo_update_week_time', _('Update Cycle'));
		o.value('*', _('Every Day'));
		o.value('1', _('Every Monday'));
		o.value('2', _('Every Tuesday'));
		o.value('3', _('Every Wednesday'));
		o.value('4', _('Every Thursday'));
		o.value('5', _('Every Friday'));
		o.value('6', _('Every Saturday'));
		o.value('0', _('Every Sunday'));
		o.default = 3;

		o = s.option(form.ListValue, 'geo_update_day_time', _('Update Time'));
		for (let t = 0; t < 24; t++) {
			o.value(t, t + ':00');
		}
		o.default = 3;

		o = s.option(form.ListValue, 'geoip_type', _('GeoIP Type'),
			_('Little: only include Mainland China and Private IP addresses.') +
			'<br>' +
			_('Full: includes all Countries and Private IP addresses.')
		);
		o.value('geoip', _('Full'));
		o.value('geoip-only-cn-private', _('Little'));
		o.rmempty = false;
		o.default = 'geoip-only-cn-private';

		o = s.option(form.Value, 'github_proxy', _('GitHub Proxy'),
			_('Update data files with GitHub Proxy, leave blank to disable proxy downloads.'));
		o.value('https://gh-proxy.com', _('https://gh-proxy.com'));
		o.rmempty = true;
		o.default = '';

		o = s.option(form.Button, '_udpate', null,
			_('Check And Update GeoData.'));
		o.title = _('Database Update');
		o.inputtitle = _('Check And Update');
		o.inputstyle = 'apply';
		o.onclick = () => this.handleUpdate();

		return m.render();
	}
});
