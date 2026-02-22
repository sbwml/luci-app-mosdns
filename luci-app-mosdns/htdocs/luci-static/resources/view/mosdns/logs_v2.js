'use strict';
'require dom';
'require fs';
'require poll';
'require view';

var scrollPosition = 0;
var userScrolled = false;
var logTextarea;

function pollLog() {
	return Promise.all([
		fs.exec_direct('/usr/share/mosdns/mosdns.sh', ['printlog']).then(function (res) {
			return res.trim().split(/\n/).join('\n');
		}),
	]).then(function (data) {
		logTextarea.value = data[0] || _('No log data.');

		if (!userScrolled) {
			logTextarea.scrollTop = logTextarea.scrollHeight;
		} else {
			logTextarea.scrollTop = scrollPosition;
		}
	});
};

return view.extend({
	handleCleanLogs: function () {
		return fs.exec('/usr/share/mosdns/mosdns.sh', ['cleanlog'])
			.catch(function (e) { ui.addNotification(null, E('p', e.message)) });
	},

	render: function () {
		logTextarea = E('textarea', {
			'class': 'cbi-input-textarea',
			'wrap': 'off',
			'readonly': 'readonly',
			'style': 'width: calc(100% - 20px);height: 535px;margin: 10px;overflow-y: scroll;',
		});

		logTextarea.addEventListener('scroll', function () {
			userScrolled = true;
			scrollPosition = logTextarea.scrollTop;
		});

		var log_textarea_wrapper = E('div', { 'id': 'log_textarea' }, logTextarea);

		poll.add(pollLog);

		var clear_logs_button = E('input', { 'class': 'btn cbi-button-action', 'type': 'button', 'style': 'margin-left: 10px; margin-top: 10px;', 'value': _('Clear logs') });
		clear_logs_button.addEventListener('click', this.handleCleanLogs.bind(this));

		return E([
			E('div', { 'class': 'cbi-map' }, [
				E('h2', { 'name': 'content' }, '%s - %s'.format(_('MosDNS'), _('Log Data'))),
				E('div', { 'class': 'cbi-section' }, [
					clear_logs_button,
					log_textarea_wrapper,
					E('div', { 'style': 'text-align:right' },
						E('small', {}, _('Refresh every %s seconds.').format(L.env.pollinterval))
					)
				])
			])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
