'use strict';
'require dom';
'require poll';
'require rpc';
'require ui';
'require view';

const callGetStats = rpc.declare({
	object: 'luci.mosdns',
	method: 'get_stats',
	expect: { '': {} }
});

const callGetTop = rpc.declare({
	object: 'luci.mosdns',
	method: 'get_top',
	params: ['limit'],
	expect: { '': {} }
});

const callGetLogs = rpc.declare({
	object: 'luci.mosdns',
	method: 'get_logs',
	params: ['limit', 'offset', 'search', 'filter'],
	expect: { '': {} }
});

const callClearQueryLogs = rpc.declare({
	object: 'luci.mosdns',
	method: 'clear_query_logs',
	expect: { '': {} }
});

let filterVal = 'all';
let searchVal = '';
let pageIdx = 0;
const PAGE_SIZE = 20;

let nodeStats;
let nodeTop;
let nodeLogs;

const injectStyles = () => {
	if (document.getElementById('mosdns-statistics-styles'))
		return;

	/* HTML Styles provided by DeepSeek Chat */
	const css = [
		'.mosdns-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }',
		'.mosdns-rankings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }',
		'.mosdns-card { margin: 0 !important; padding: 1rem !important; display: flex; flex-direction: column; justify-content: space-between; border-radius: 6px; }',
		'.mosdns-progress-bg { margin-top: .5rem; height: 6px; background: rgba(125,125,125,.15); border-radius: 3px; overflow: hidden; }',
		'.mosdns-progress-bar { height: 100%; border-radius: 3px; transition: width .3s ease; }',
		'.mosdns-badge { display: inline-block; padding: .2em .5em; font-size: .75rem; font-weight: bold; border-radius: 4px; line-height: 1.2; text-align: center; white-space: nowrap; box-sizing: border-box; }',
		'.mosdns-status-badge { width: 78px; text-align: center; }',
		'.badge-danger { background: rgba(229,62,62,.18); color: #e53e3e; border: 1px solid rgba(229,62,62,.3); }',
		'.badge-teal { background: rgba(49,151,149,.18); color: #319795; border: 1px solid rgba(49,151,149,.3); }',
		'.badge-primary { background: rgba(49,130,206,.18); color: #3182ce; border: 1px solid rgba(49,130,206,.3); }',
		'.badge-neutral { background: rgba(113,128,150,.18); color: #718096; border: 1px solid rgba(113,128,150,.3); }',
		'.badge-tag { margin-left: .5rem; background: rgba(125,125,125,.12); font-size: .75rem; font-weight: normal; }',
		'.mosdns-rank-item { position: relative; overflow: hidden; border-radius: 4px; padding: .4rem .6rem; display: flex; justify-content: space-between; align-items: center; background: rgba(125,125,125,.05); border: 1px solid rgba(125,125,125,.08); margin-bottom: .4rem; }',
		'.mosdns-rank-bar { position: absolute; left: 0; top: 0; bottom: 0; opacity: .18; pointer-events: none; transition: width .3s ease; }',
		'.dns-latency-fastest { color: #38a169; font-weight: bold; }',
		'.dns-latency-fast { color: #48bb78; font-weight: bold; }',
		'.dns-latency-normal { color: #4299e1; font-weight: bold; }',
		'.dns-latency-slow { color: #ecc94b; font-weight: bold; }',
		'.dns-latency-slower { color: #ed8936; font-weight: bold; }',
		'.dns-latency-timeout { color: #e53e3e; font-weight: bold; }',
		'@media (prefers-color-scheme: dark) {',
		'	.dns-latency-fastest { color: #4fd1c5; }',
		'	.dns-latency-fast { color: #68d391; }',
		'	.dns-latency-normal { color: #63b3ed; }',
		'	.dns-latency-slow { color: #f6e05e; }',
		'	.dns-latency-slower { color: #f6ad55; }',
		'	.dns-latency-timeout { color: #fc8181; }',
		'}'
	].join('\n');

	document.head.appendChild(E('style', { id: 'mosdns-statistics-styles' }, css));
};

const debounce = (fn, delay = 300) => {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), delay);
	};
};

const formatTimestamp = iso => {
	if (!iso) return '-';
	const d = new Date(iso);
	return isNaN(d) ? iso : d.toTimeString().slice(0, 8);
};

const getLatencyClass = elapsedMs => {
	const val = parseFloat(elapsedMs) || 0;
	if (val < 5)   return 'dns-latency-fastest';
	if (val < 20)  return 'dns-latency-fast';
	if (val < 50)  return 'dns-latency-normal';
	if (val < 100) return 'dns-latency-slow';
	if (val < 300) return 'dns-latency-slower';
	return 'dns-latency-timeout';
};

const renderOverviewStats = stats => {
	if (!stats || stats.error) {
		return E('div', { class: 'cbi-section' }, [
			E('div', { class: 'alert-message warning' },
				_('MosDNS API is unreachable. Please ensure MosDNS is running and stats_api plugin is enabled.'))
		]);
	}

	const {
		total_queries: total = 0,
		blocked_queries: blocked = 0,
		cached_queries: cached = 0,
		blocked_percentage: blocked_pct = 0,
		cached_percentage: cached_pct = 0,
		avg_latency_ms: avg_ms = 0
	} = stats;

	return E('div', { class: 'mosdns-grid' }, [
		E('div', { class: 'cbi-section mosdns-card' }, [
			E('div', { style: 'font-size: 0.9rem; opacity: 0.8;' }, _('DNS Queries')),
			E('div', { style: 'font-size: 1.8rem; font-weight: bold; line-height: 1.2;' }, total.toLocaleString()),
			E('div', { style: 'font-size: 0.85rem; margin-top: 0.5rem; opacity: 0.75;' }, _('Avg Latency') + ': ' + avg_ms + ' ms')
		]),

		E('div', { class: 'cbi-section mosdns-card' }, [
			E('div', { style: 'display: flex; justify-content: space-between; align-items: center;' }, [
				E('span', { style: 'font-size: 0.9rem; opacity: 0.8;' }, _('Blocked Queries')),
				E('span', { class: 'mosdns-badge badge-danger' }, blocked_pct + '%')
			]),
			E('div', { style: 'font-size: 1.8rem; font-weight: bold; color: #e53e3e; line-height: 1.2;' }, blocked.toLocaleString()),
			E('div', { class: 'mosdns-progress-bg' }, [
				E('div', { class: 'mosdns-progress-bar', style: 'width: ' + blocked_pct + '%; background-color: #e53e3e;' })
			])
		]),

		E('div', { class: 'cbi-section mosdns-card' }, [
			E('div', { style: 'display: flex; justify-content: space-between; align-items: center;' }, [
				E('span', { style: 'font-size: 0.9rem; opacity: 0.8;' }, _('Cached Queries')),
				E('span', { class: 'mosdns-badge badge-teal' }, cached_pct + '%')
			]),
			E('div', { style: 'font-size: 1.8rem; font-weight: bold; color: #319795; line-height: 1.2;' }, cached.toLocaleString()),
			E('div', { class: 'mosdns-progress-bg' }, [
				E('div', { class: 'mosdns-progress-bar', style: 'width: ' + cached_pct + '%; background-color: #319795;' })
			])
		]),

		E('div', { class: 'cbi-section mosdns-card' }, [
			E('div', { style: 'font-size: 0.9rem; opacity: 0.8;' }, _('Average Processing Time')),
			E('div', { style: 'font-size: 1.8rem; font-weight: bold; color: #3182ce; line-height: 1.2;' }, avg_ms + ' ms'),
			E('div', { style: 'font-size: 0.85rem; margin-top: 0.5rem; opacity: 0.75;' }, _('Per Query Latency'))
		])
	]);
};

const renderTopRankings = topData => {
	if (!topData || topData.error) return E('div', {});

	const { top_blocked = [], top_domains = [], top_clients = [] } = topData;

	const renderList = (items, key, color) => {
		if (!items || !items.length) {
			return E('div', { style: 'padding: 1rem; text-align: center; opacity: 0.6;' }, _('No data available'));
		}
		const maxCount = Math.max(...items.map(i => i.count || 1));
		return E('div', { style: 'display: flex; flex-direction: column;' },
			items.map(item => {
				const val = item[key] || '-';
				const cnt = item.count || 0;
				const pct = Math.round((cnt / maxCount) * 100);
				return E('div', { class: 'mosdns-rank-item' }, [
					E('div', { class: 'mosdns-rank-bar', style: 'width: ' + pct + '%; background: ' + color + ';' }),
					E('span', { style: 'font-family: monospace; font-size: 0.85rem; z-index: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 0.5rem;' }, val),
					E('span', { class: 'mosdns-badge badge-neutral', style: 'z-index: 1;' }, cnt.toLocaleString())
				]);
			})
		);
	};

	return E('div', { class: 'mosdns-rankings-grid' }, [
		E('div', { class: 'cbi-section', style: 'margin: 0; padding: 1rem;' }, [
			E('h4', { style: 'margin-top: 0; margin-bottom: 0.75rem; color: #3182ce;' }, _('Top Queried Domains')),
			renderList(top_domains, 'domain', '#3182ce')
		]),
		E('div', { class: 'cbi-section', style: 'margin: 0; padding: 1rem;' }, [
			E('h4', { style: 'margin-top: 0; margin-bottom: 0.75rem; color: #e53e3e;' }, _('Top Blocked Domains')),
			renderList(top_blocked, 'domain', '#e53e3e')
		]),
		E('div', { class: 'cbi-section', style: 'margin: 0; padding: 1rem;' }, [
			E('h4', { style: 'margin-top: 0; margin-bottom: 0.75rem; color: #38a169;' }, _('Top Clients')),
			renderList(top_clients, 'client_ip', '#38a169')
		])
	]);
};

const showLogDetailsModal = item => {
	const answers = (item.answers && item.answers.length > 0)
		? E('div', { style: 'font-family: monospace; line-height: 1.6;' },
			item.answers.map(a => E('div', {}, a.data + ' (' + a.type + ', TTL ' + a.ttl + 's)')))
		: '-';

	const list = ui.itemlist(E('div'), [
		_('Domain'), (item.domain || '-') + ' (' + (item.qtype || 'A') + ')',
		_('Client IP'), item.client_ip || '-',
		_('Status / Latency'), (item.status || 'NOERROR') + ' (' + item.elapsed_ms + ' ms)',
		_('Upstream'), item.upstream || '-',
		_('Rule Hit'), item.rule || '-',
		_('Answers'), answers
	]);

	ui.showModal(_('Query Log Details'), [
		list,
		E('div', { class: 'right', style: 'margin-top: 1rem;' }, [
			E('button', {
				class: 'btn cbi-button cbi-button-neutral',
				click: ui.hideModal
			}, _('Close'))
		])
	]);
};

const renderLogsTable = logsData => {
	const { total = 0, items = [] } = logsData || {};
	const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

	const rows = items.map(item => {
		let statusBadge;
		if (item.is_blocked) {
			statusBadge = E('span', { class: 'mosdns-badge badge-danger mosdns-status-badge' }, 'BLOCKED');
		} else if (item.is_cached) {
			statusBadge = E('span', { class: 'mosdns-badge badge-teal mosdns-status-badge' }, 'CACHED');
		} else if (item.status === 'NOERROR') {
			statusBadge = E('span', { class: 'mosdns-badge badge-primary mosdns-status-badge' }, 'NOERROR');
		} else {
			statusBadge = E('span', { class: 'mosdns-badge badge-neutral mosdns-status-badge' }, item.status || 'NOERROR');
		}

		const answersText = (item.answers && item.answers.length > 0)
			? item.answers.map(a => a.data + ' (' + a.type + ', TTL ' + a.ttl + ')').join(', ')
			: '-';

		return E('tr', { class: 'tr' }, [
			E('td', { class: 'td', style: 'font-size: 0.85rem; opacity: 0.75; white-space: nowrap;' }, formatTimestamp(item.timestamp)),
			E('td', { class: 'td', style: 'font-family: monospace; font-size: 0.85rem;' }, item.client_ip || '-'),
			E('td', { class: 'td', style: 'max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;', title: item.domain || '-' }, [
				E('span', { style: 'font-family: monospace; font-weight: bold;' }, item.domain || '-'),
				E('span', { class: 'mosdns-badge badge-tag' }, item.qtype || 'A')
			]),
			E('td', { class: 'td' }, statusBadge),
			E('td', {
				class: 'td',
				style: 'font-family: monospace; font-size: 0.85rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;',
				title: _('Click to view full details'),
				click: () => showLogDetailsModal(item)
			}, answersText),
			E('td', { class: 'td ' + getLatencyClass(item.elapsed_ms), style: 'text-align: right; font-size: 0.85rem;' }, item.elapsed_ms + ' ms')
		]);
	});

	if (!rows.length) {
		rows.push(E('tr', { class: 'tr' }, [
			E('td', { class: 'td', colspan: 6, style: 'text-align: center; opacity: 0.6; padding: 2rem;' }, _('No query log entries found.'))
		]));
	}

	return E('div', {}, [
		E('table', { class: 'table cbi-section-table', style: 'margin-top: 0.5rem;' }, [
			E('tr', { class: 'tr table-titles' }, [
				E('th', { class: 'th', style: 'width: 90px;' }, _('Time')),
				E('th', { class: 'th', style: 'width: 130px;' }, _('Client IP')),
				E('th', { class: 'th' }, _('Domain & Record')),
				E('th', { class: 'th', style: 'width: 100px;' }, _('Status')),
				E('th', { class: 'th' }, _('Answers')),
				E('th', { class: 'th', style: 'width: 100px; text-align: right;' }, _('Elapsed'))
			]),
			...rows
		]),

		E('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;' }, [
			E('span', { style: 'font-size: 0.85rem; opacity: 0.75;' }, _('Page') + ' ' + (pageIdx + 1) + ' / ' + totalPages + ' (' + total + ' ' + _('entries') + ')'),
			E('div', { style: 'display: flex; gap: 0.5rem;' }, [
				E('button', {
					class: 'btn cbi-button cbi-button-action',
					disabled: pageIdx === 0 ? 'disabled' : null,
					click: () => {
						if (pageIdx > 0) {
							pageIdx--;
							refreshLogs();
						}
					}
				}, _('Previous')),
				E('button', {
					class: 'btn cbi-button cbi-button-action',
					disabled: (pageIdx + 1) >= totalPages ? 'disabled' : null,
					click: () => {
						if ((pageIdx + 1) < totalPages) {
							pageIdx++;
							refreshLogs();
						}
					}
				}, _('Next'))
			])
		])
	]);
};

const refreshAll = async () => {
	try {
		const [stats, top, logs] = await Promise.all([
			callGetStats(),
			callGetTop(10),
			callGetLogs(PAGE_SIZE, pageIdx * PAGE_SIZE, searchVal, filterVal)
		]);
		dom.content(nodeStats, renderOverviewStats(stats));
		dom.content(nodeTop, renderTopRankings(top));
		dom.content(nodeLogs, renderLogsTable(logs));
	} catch (e) {
		ui.addNotification(null, E('p', [_('Failed to update MosDNS status: '), e.message]), 'error');
	}
};

const refreshLogs = async () => {
	try {
		const logs = await callGetLogs(PAGE_SIZE, pageIdx * PAGE_SIZE, searchVal, filterVal);
		dom.content(nodeLogs, renderLogsTable(logs));
	} catch (e) {
		ui.addNotification(null, E('p', [_('Failed to update query logs: '), e.message]), 'error');
	}
};

return view.extend({
	async load() {
		return Promise.all([
			L.resolveDefault(callGetStats(), {}),
			L.resolveDefault(callGetTop(10), {}),
			L.resolveDefault(callGetLogs(PAGE_SIZE, 0, searchVal, filterVal), {})
		]);
	},

	render(data) {
		injectStyles();

		nodeStats = E('div', { id: 'overview-stats' });
		nodeTop = E('div', { id: 'top-rankings' });
		nodeLogs = E('div', { id: 'logs-table' });

		dom.content(nodeStats, renderOverviewStats(data[0]));
		dom.content(nodeTop, renderTopRankings(data[1]));
		dom.content(nodeLogs, renderLogsTable(data[2]));

		const searchInput = E('input', {
			type: 'text',
			class: 'cbi-input-text',
			placeholder: _('Search domain or client IP...'),
			style: 'min-width: 200px;'
		});
		searchInput.addEventListener('input', debounce(() => {
			searchVal = searchInput.value.trim();
			pageIdx = 0;
			refreshLogs();
		}, 300));

		const filterSelect = E('select', { class: 'cbi-input-select' }, [
			E('option', { value: 'all' }, _('All Queries')),
			E('option', { value: 'blocked' }, _('Blocked Only')),
			E('option', { value: 'cached' }, _('Cached Only'))
		]);
		filterSelect.addEventListener('change', () => {
			filterVal = filterSelect.value;
			pageIdx = 0;
			refreshLogs();
		});

		const clearBtn = E('button', {
			class: 'btn cbi-button cbi-button-remove',
			style: 'margin-left: auto;'
		}, _('Clear query logs'));

		clearBtn.addEventListener('click', () => {
			ui.showModal(_('Clear query logs'), [
				E('p', {}, _('Are you sure you want to clear all real-time query logs and top rankings?')),
				E('div', { class: 'right' }, [
					E('button', {
						class: 'btn cbi-button cbi-button-neutral',
						click: ui.hideModal
					}, _('Cancel')),
					' ',
					E('button', {
						class: 'btn cbi-button cbi-button-remove',
						click: async () => {
							ui.hideModal();
							try {
								const res = await callClearQueryLogs();
								if (res?.success) {
									ui.addNotification(null, E('p', _('Query logs cleared successfully.')), 'info');
									pageIdx = 0;
									await refreshAll();
								} else {
									ui.addNotification(null, E('p', [_('Failed to clear query logs: '), res?.error || '']), 'error');
								}
							} catch (e) {
								ui.addNotification(null, E('p', e.message), 'error');
							}
						}
					}, _('Clear'))
				])
			]);
		});

		const controlBar = E('div', { style: 'display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem;' }, [
			searchInput,
			filterSelect,
			clearBtn
		]);

		poll.add(refreshAll, 3);

		return E('div', { class: 'cbi-map' }, [
			E('h2', { name: 'content' }, '%s - %s'.format(_('MosDNS'), _('Statistics'))),
			nodeStats,
			nodeTop,
			E('div', { class: 'cbi-section' }, [
				E('h3', {}, _('Real-time Query Logs')),
				controlBar,
				nodeLogs
			])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
