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

const callGetHistory = rpc.declare({
	object: 'luci.mosdns',
	method: 'get_history',
	params: ['points'],
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
let isUserPaused = false;

let nodeStats;
let nodeTop;
let nodeLogs;
let autoStatusBadge;
let statsElements = null;
let currentBadgeState = null;
let lastTopJson = '';
let lastLogsJson = '';

const cleanIP = ip => {
	if (!ip) return '-';
	return ip.replace(/^::ffff:/i, '');
};

const injectStyles = () => {
	if (document.getElementById('mosdns-statistics-styles'))
		return;

	/* HTML Styles provided by DeepSeek Chat */
	const css = [
		'.mosdns-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }',
		'.mosdns-rankings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }',
		'.mosdns-stat-card { background: var(--cbi-section-bg, #fff); border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; padding: 1rem 1.2rem; box-shadow: 0 2px 6px rgba(0,0,0,0.03); display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; }',
		'.mosdns-stat-card .title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; font-size: 0.85rem; opacity: 0.75; font-weight: 500; }',
		'.mosdns-stat-card .metric-val { font-size: 1.85rem; font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; }',
		'.mosdns-stat-card .subtext { font-size: 0.8rem; opacity: 0.6; margin-top: 0.4rem; }',
		'.mosdns-sparkline-wrap { margin-top: 0.5rem; height: 44px; position: relative; overflow: visible; display: flex; align-items: flex-end; touch-action: none; -webkit-user-select: none; user-select: none; }',
		'.mosdns-sparkline { width: 100%; height: 100%; display: block; overflow: visible; }',
		'.mosdns-sparkline-tooltip { position: absolute; pointer-events: none; z-index: 20; padding: 0.25rem 0.5rem; border-radius: 5px; background: var(--cbi-section-bg, #fff); border: 1px solid rgba(0,0,0,0.12); box-shadow: 0 3px 10px rgba(0,0,0,0.12); line-height: 1.25; text-align: center; white-space: nowrap; transition: opacity 0.15s ease; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }',
		'.spark-hover-hitbox { touch-action: none; -webkit-user-select: none; user-select: none; cursor: crosshair; }',
		'.mosdns-rank-panel { background: var(--cbi-section-bg, #fff); border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; padding: 1rem 1.1rem; box-shadow: 0 2px 6px rgba(0,0,0,0.03); }',
		'.mosdns-rank-panel h4 { margin: 0 0 0.85rem 0; font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; justify-content: space-between; }',
		'.mosdns-rank-item { position: relative; overflow: hidden; border-radius: 6px; padding: 0.35rem 0.65rem; display: flex; justify-content: space-between; align-items: center; background: rgba(125,125,125,0.03); border: 1px solid rgba(125,125,125,0.08); margin-bottom: 0.35rem; }',
		'.mosdns-rank-bar { position: absolute; left: 0; top: 0; bottom: 0; opacity: 0.15; pointer-events: none; transition: width .3s ease; }',
		'.mosdns-badge { display: inline-block; padding: 0.15em 0.55em; font-size: 0.75rem; font-weight: 600; border-radius: 4px; line-height: 1.25; text-align: center; white-space: nowrap; box-sizing: border-box; }',
		'.mosdns-status-badge { min-width: 68px; }',
		'.badge-danger { background: rgba(239, 68, 68, 0.12); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.25); }',
		'.badge-teal { background: rgba(16, 185, 129, 0.12); color: #059669; border: 1px solid rgba(16, 185, 129, 0.25); }',
		'.badge-primary { background: rgba(59, 130, 246, 0.12); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.25); }',
		'.badge-neutral { background: rgba(107, 114, 128, 0.12); color: #4b5563; border: 1px solid rgba(107, 114, 128, 0.25); }',
		'.badge-qtype { font-family: monospace; font-size: 0.72rem; padding: 0.1em 0.4em; background: rgba(125,125,125,0.1); border-radius: 3px; opacity: 0.8; margin-left: 0.4rem; }',
		'.badge-pulse { animation: pulse 2s infinite; }',
		'.dns-latency-fastest { color: #10b981; font-weight: 600; }',
		'.dns-latency-fast { color: #059669; font-weight: 600; }',
		'.dns-latency-normal { color: #3b82f6; font-weight: 600; }',
		'.dns-latency-slow { color: #d97706; font-weight: 600; }',
		'.dns-latency-slower { color: #ea580c; font-weight: 600; }',
		'.dns-latency-timeout { color: #dc2626; font-weight: 600; }',
		'.mosdns-table td { vertical-align: middle !important; padding: 0.45rem 0.6rem !important; }',
		'.mosdns-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }',
		'.mosdns-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(125,125,125,0.15); flex-wrap: wrap; gap: 0.5rem; }',
		'.mosdns-modal-domain { font-size: 1.05rem; font-weight: 700; word-break: break-all; display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; }',
		'.mosdns-modal-meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.6rem; margin-bottom: 1rem; }',
		'.mosdns-modal-meta-item { background: rgba(125,125,125,0.04); border: 1px solid rgba(125,125,125,0.08); border-radius: 6px; padding: 0.5rem 0.75rem; }',
		'.mosdns-modal-meta-item .meta-label { font-size: 0.75rem; opacity: 0.6; margin-bottom: 0.2rem; font-weight: 600; }',
		'.mosdns-modal-meta-item .meta-val { font-size: 0.85rem; font-weight: 600; }',
		'.mosdns-modal-section-title { font-size: 0.9rem; font-weight: 700; margin: 0.85rem 0 0.45rem 0; display: flex; align-items: center; justify-content: space-between; }',
		'.mosdns-answers-list { display: flex; flex-direction: column; gap: 0.35rem; max-height: 240px; overflow-y: auto; }',
		'.mosdns-answer-row { display: flex; justify-content: space-between; align-items: center; background: rgba(125,125,125,0.04); border: 1px solid rgba(125,125,125,0.08); border-radius: 6px; padding: 0.4rem 0.65rem; gap: 0.5rem; font-size: 0.82rem; }',
		'.mosdns-answer-data { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }',
		'.mosdns-answer-ttl { font-size: 0.75rem; opacity: 0.65; white-space: nowrap; }',
		'@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }',
		'@media (prefers-color-scheme: dark) {',
		'	.mosdns-stat-card, .mosdns-rank-panel, .mosdns-modal-meta-item, .mosdns-answer-row { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.08); box-shadow: none; }',
		'	.mosdns-sparkline-tooltip { background: #1e242b; border-color: rgba(255,255,255,0.15); box-shadow: 0 4px 12px rgba(0,0,0,0.5); }',
		'	.badge-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; border-color: rgba(239, 68, 68, 0.35); }',
		'	.badge-teal { background: rgba(16, 185, 129, 0.2); color: #34d399; border-color: rgba(16, 185, 129, 0.35); }',
		'	.badge-primary { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border-color: rgba(59, 130, 246, 0.35); }',
		'	.badge-neutral { background: rgba(156, 163, 175, 0.2); color: #9ca3af; border-color: rgba(156, 163, 175, 0.3); }',
		'	.dns-latency-fastest { color: #34d399; }',
		'	.dns-latency-normal { color: #60a5fa; }',
		'	.dns-latency-timeout { color: #f87171; }',
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

const updateLiveStatusBadge = () => {
	if (!autoStatusBadge) return;
	const isLive = (pageIdx === 0 && !searchVal && !isUserPaused);
	const targetState = isLive ? 'live' : ('paused:' + pageIdx);

	if (currentBadgeState === targetState)
		return;

	currentBadgeState = targetState;

	if (isLive) {
		dom.content(autoStatusBadge, [
			E('span', { class: 'mosdns-badge badge-teal badge-pulse' }, _('● Live Auto-refresh'))
		]);
	} else {
		dom.content(autoStatusBadge, [
			E('span', { class: 'mosdns-badge badge-neutral' }, _('❚❚ Paused (Page %d)').format(pageIdx + 1))
		]);
	}
};

const createSparklineSVG = (strokeColor, fillGradId) => {
	const width = 300;
	const height = 44;
	const padTop = 4;
	const padBottom = 2;
	const drawHeight = height - padTop - padBottom;

	let coords = [];
	let isHovered = false;
	let currentIdx = -1;
	let hideTimer = null;

	const svgContainer = E('div', { class: 'mosdns-sparkline-wrap' });
	svgContainer.innerHTML =
		'<svg viewBox="0 0 ' + width + ' ' + height + '" class="mosdns-sparkline" preserveAspectRatio="none">' +
			'<defs>' +
				'<linearGradient id="' + fillGradId + '" x1="0" y1="0" x2="0" y2="1">' +
					'<stop offset="0%" stop-color="' + strokeColor + '" stop-opacity="0.30" />' +
					'<stop offset="100%" stop-color="' + strokeColor + '" stop-opacity="0.02" />' +
				'</linearGradient>' +
			'</defs>' +
			'<path class="spark-area-path" fill="url(#' + fillGradId + ')" />' +
			'<path class="spark-line-path" fill="none" stroke="' + strokeColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />' +
			'<g class="spark-hover-group" style="display: none;">' +
				'<line class="spark-hover-line" x1="0" y1="' + padTop + '" x2="0" y2="' + (height - padBottom) + '" stroke="' + strokeColor + '" stroke-width="1.2" stroke-dasharray="2 2" opacity="0.6" />' +
				'<circle class="spark-hover-dot" cx="0" cy="0" r="3.5" fill="' + strokeColor + '" stroke="#fff" stroke-width="1.5" />' +
			'</g>' +
			'<rect width="' + width + '" height="' + height + '" fill="transparent" class="spark-hover-hitbox" />' +
		'</svg>' +
		'<div class="mosdns-sparkline-tooltip" style="display: none;"></div>';

	const areaPath = svgContainer.querySelector('.spark-area-path');
	const linePath = svgContainer.querySelector('.spark-line-path');
	const hoverGroup = svgContainer.querySelector('.spark-hover-group');
	const hoverLine = svgContainer.querySelector('.spark-hover-line');
	const hoverDot = svgContainer.querySelector('.spark-hover-dot');
	const hitbox = svgContainer.querySelector('.spark-hover-hitbox');
	const tooltip = svgContainer.querySelector('.mosdns-sparkline-tooltip');

	const renderTooltipAndHover = idx => {
		if (idx < 0 || idx >= coords.length) return;
		const coord = coords[idx];
		if (!coord) return;

		hoverLine.setAttribute('x1', coord.x);
		hoverLine.setAttribute('x2', coord.x);
		hoverDot.setAttribute('cx', coord.x);
		hoverDot.setAttribute('cy', coord.y);
		hoverGroup.style.display = 'block';

		let timeStr = '-';
		if (coord.time) {
			const d = new Date(coord.time);
			if (!isNaN(d)) {
				const hh = String(d.getHours()).padStart(2, '0');
				timeStr = hh + ':00';
			} else {
				timeStr = coord.time.slice(11, 16) || coord.time;
			}
		}

		tooltip.innerHTML =
			'<div style="font-weight: 700; color: ' + strokeColor + '; font-size: 0.82rem; line-height: 1.1;">' + coord.val.toLocaleString() + '</div>' +
			'<div style="font-size: 0.72rem; opacity: 0.75; margin-top: 0.15rem;">' + timeStr + '</div>';
		tooltip.style.display = 'block';

		const rect = svgContainer.getBoundingClientRect();
		const containerWidth = rect.width || width;
		const tooltipX = (coord.x / width) * containerWidth;
		const ratio = coord.x / width;

		if (ratio > 0.65) {
			tooltip.style.left = 'auto';
			tooltip.style.right = (containerWidth - tooltipX + 8) + 'px';
		} else {
			tooltip.style.left = (tooltipX + 8) + 'px';
			tooltip.style.right = 'auto';
		}
		tooltip.style.top = '-6px';
	};

	const update = (dataItems, maxScale) => {
		let items = (dataItems && dataItems.length > 0) ? dataItems : [];
		if (!items.length) {
			items = new Array(24).fill(0).map(() => ({ time: '', val: 0 }));
		}
		if (items.length < 2) {
			items = [items[0] || { time: '', val: 0 }, items[0] || { time: '', val: 0 }];
		}

		const vals = items.map(i => i.val || 0);
		const maxVal = maxScale || Math.max(...vals, 1);
		const len = items.length;

		coords = items.map((item, idx) => {
			const x = (idx / (len - 1)) * width;
			const y = height - padBottom - ((item.val || 0) / maxVal) * drawHeight;
			return { x, y, time: item.time, val: item.val || 0 };
		});

		let pathD = 'M ' + coords[0].x.toFixed(1) + ',' + coords[0].y.toFixed(1);
		for (let i = 0; i < coords.length - 1; i++) {
			const p0 = coords[i === 0 ? 0 : i - 1];
			const p1 = coords[i];
			const p2 = coords[i + 1];
			const p3 = coords[i + 2 < coords.length ? i + 2 : i + 1];

			const cp1x = p1.x + (p2.x - p0.x) / 6;
			const cp1y = p1.y + (p2.y - p0.y) / 6;
			const cp2x = p2.x - (p3.x - p1.x) / 6;
			const cp2y = p2.y - (p3.y - p1.y) / 6;

			pathD += ' C ' + cp1x.toFixed(1) + ',' + cp1y.toFixed(1) + ' ' + cp2x.toFixed(1) + ',' + cp2y.toFixed(1) + ' ' + p2.x.toFixed(1) + ',' + p2.y.toFixed(1);
		}

		const areaD = pathD + ' L ' + width + ',' + height + ' L 0,' + height + ' Z';

		areaPath.setAttribute('d', areaD);
		linePath.setAttribute('d', pathD);

		if (isHovered && currentIdx >= 0) {
			renderTooltipAndHover(currentIdx);
		}
	};

	const onPositionMove = clientX => {
		if (hideTimer) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
		const rect = svgContainer.getBoundingClientRect();
		if (!rect.width || !coords.length) return;
		const mouseX = clientX - rect.left;
		const ratio = Math.max(0, Math.min(1, mouseX / rect.width));
		const idx = Math.round(ratio * (coords.length - 1));
		currentIdx = idx;
		isHovered = true;
		renderTooltipAndHover(idx);
	};

	const onLeave = (delay = 0) => {
		if (delay > 0) {
			if (hideTimer) clearTimeout(hideTimer);
			hideTimer = setTimeout(() => {
				isHovered = false;
				currentIdx = -1;
				hoverGroup.style.display = 'none';
				tooltip.style.display = 'none';
				hideTimer = null;
			}, delay);
		} else {
			if (hideTimer) {
				clearTimeout(hideTimer);
				hideTimer = null;
			}
			isHovered = false;
			currentIdx = -1;
			hoverGroup.style.display = 'none';
			tooltip.style.display = 'none';
		}
	};

	hitbox.addEventListener('mousemove', e => onPositionMove(e.clientX));
	hitbox.addEventListener('mouseenter', e => onPositionMove(e.clientX));
	hitbox.addEventListener('mouseleave', () => onLeave(0));

	hitbox.addEventListener('touchstart', e => {
		if (e.touches && e.touches.length > 0) {
			onPositionMove(e.touches[0].clientX);
		}
	}, { passive: true });

	hitbox.addEventListener('touchmove', e => {
		if (e.touches && e.touches.length > 0) {
			onPositionMove(e.touches[0].clientX);
		}
	}, { passive: true });

	hitbox.addEventListener('touchend', () => onLeave(1500), { passive: true });
	hitbox.addEventListener('touchcancel', () => onLeave(0), { passive: true });

	svgContainer.update = update;
	return svgContainer;
};

const createOverviewStatsDOM = () => {
	const metricTotal = E('div', { class: 'metric-val' }, '-');
	const subtextTotal = E('div', { class: 'subtext' }, '-');
	const sparklineTotal = createSparklineSVG('#3b82f6', 'spark-grad-total');

	const badgeBlocked = E('span', { class: 'mosdns-badge badge-danger' }, '-');
	const metricBlocked = E('div', { class: 'metric-val', style: 'color: #dc2626;' }, '-');
	const sparklineBlocked = createSparklineSVG('#dc2626', 'spark-grad-blocked');

	const badgeCached = E('span', { class: 'mosdns-badge badge-teal' }, '-');
	const metricCached = E('div', { class: 'metric-val', style: 'color: #059669;' }, '-');
	const sparklineCached = createSparklineSVG('#059669', 'spark-grad-cached');

	const metricLatency = E('div', { class: 'metric-val', style: 'color: #2563eb;' }, '-');
	const subtextLatency = E('div', { class: 'subtext' }, _('Per-query speed'));

	const grid = E('div', { class: 'mosdns-grid' }, [
		E('div', { class: 'mosdns-stat-card' }, [
			E('div', {}, [
				E('div', { class: 'title-row' }, [
					E('span', {}, _('DNS Queries Total')),
					E('span', { class: 'mosdns-badge badge-teal badge-pulse' }, _('● Live'))
				]),
				metricTotal,
				subtextTotal
			]),
			sparklineTotal
		]),

		E('div', { class: 'mosdns-stat-card' }, [
			E('div', {}, [
				E('div', { class: 'title-row' }, [
					E('span', {}, _('Blocked by Filters')),
					badgeBlocked
				]),
				metricBlocked
			]),
			sparklineBlocked
		]),

		E('div', { class: 'mosdns-stat-card' }, [
			E('div', {}, [
				E('div', { class: 'title-row' }, [
					E('span', {}, _('Cached Queries')),
					badgeCached
				]),
				metricCached
			]),
			sparklineCached
		]),

		E('div', { class: 'mosdns-stat-card' }, [
			E('div', {}, [
				E('div', { class: 'title-row' }, [
					E('span', {}, _('Average Processing Time')),
					E('span', { class: 'mosdns-badge badge-primary' }, _('Latency'))
				]),
				metricLatency,
				subtextLatency
			])
		])
	]);

	statsElements = {
		grid,
		metricTotal,
		subtextTotal,
		sparklineTotal,
		badgeBlocked,
		metricBlocked,
		sparklineBlocked,
		badgeCached,
		metricCached,
		sparklineCached,
		metricLatency,
		subtextLatency
	};

	return grid;
};

const updateOverviewStats = (stats, historyData) => {
	if (!stats || stats.error) {
		if (nodeStats) {
			dom.content(nodeStats, E('div', { class: 'alert-message warning' },
				_('MosDNS API is unreachable. Please ensure MosDNS is running and stats_api plugin is enabled.')));
			statsElements = null;
		}
		return;
	}

	if (!statsElements || !nodeStats.contains(statsElements.grid)) {
		dom.content(nodeStats, createOverviewStatsDOM());
	}

	const {
		total_queries: total = 0,
		blocked_queries: blocked = 0,
		cached_queries: cached = 0,
		blocked_percentage: blocked_pct = 0,
		cached_percentage: cached_pct = 0,
		avg_latency_ms: avg_ms = 0
	} = stats;

	const points = historyData?.points || [];
	const totalItems = points.map(p => ({ time: p.time, val: Number(p.total) || 0 }));
	const blockedItems = points.map(p => ({ time: p.time, val: Number(p.blocked) || 0 }));
	const cachedItems = points.map(p => ({ time: p.time, val: Number(p.cached) || 0 }));

	const baseMax = Math.max(...totalItems.map(i => i.val), 1);

	statsElements.metricTotal.textContent = total.toLocaleString();
	statsElements.subtextTotal.textContent = _('Avg Processing') + ': ' + avg_ms + ' ms';
	statsElements.sparklineTotal.update(totalItems, baseMax);

	statsElements.badgeBlocked.textContent = blocked_pct + '%';
	statsElements.metricBlocked.textContent = blocked.toLocaleString();
	statsElements.sparklineBlocked.update(blockedItems, baseMax);

	statsElements.badgeCached.textContent = cached_pct + '%';
	statsElements.metricCached.textContent = cached.toLocaleString();
	statsElements.sparklineCached.update(cachedItems, baseMax);

	statsElements.metricLatency.textContent = avg_ms + ' ms';
};

const renderTopRankings = topData => {
	if (!topData || topData.error) return E('div', {});

	const { top_blocked = [], top_domains = [], top_clients = [] } = topData;

	const renderList = (items, key, color, isClient = false) => {
		if (!items || !items.length) {
			return E('div', { style: 'padding: 1.5rem; text-align: center; opacity: 0.5; font-size: 0.85rem;' }, _('No data available'));
		}
		const maxCount = Math.max(...items.map(i => i.count || 1));
		return E('div', { style: 'display: flex; flex-direction: column;' },
			items.map(item => {
				let val = item[key] || '-';
				if (isClient) val = cleanIP(val);
				const cnt = item.count || 0;
				const pct = Math.round((cnt / maxCount) * 100);

				return E('div', { class: 'mosdns-rank-item' }, [
					E('div', { class: 'mosdns-rank-bar', style: 'width: ' + pct + '%; background-color: ' + color + ';' }),
					E('span', {
						class: 'mosdns-mono',
						style: 'font-size: 0.82rem; z-index: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 0.5rem;',
						title: val
					}, val),
					E('span', { class: 'mosdns-badge badge-neutral mosdns-mono', style: 'z-index: 1;' }, cnt.toLocaleString())
				]);
			})
		);
	};

	return E('div', { class: 'mosdns-rankings-grid' }, [
		E('div', { class: 'mosdns-rank-panel' }, [
			E('h4', { style: 'color: #2563eb;' }, [
				E('span', {}, _('Top Queried Domains')),
				E('span', { class: 'mosdns-badge badge-primary' }, top_domains.length)
			]),
			renderList(top_domains, 'domain', '#2563eb')
		]),
		E('div', { class: 'mosdns-rank-panel' }, [
			E('h4', { style: 'color: #dc2626;' }, [
				E('span', {}, _('Top Blocked Domains')),
				E('span', { class: 'mosdns-badge badge-danger' }, top_blocked.length)
			]),
			renderList(top_blocked, 'domain', '#dc2626')
		]),
		E('div', { class: 'mosdns-rank-panel' }, [
			E('h4', { style: 'color: #059669;' }, [
				E('span', {}, _('Top Clients')),
				E('span', { class: 'mosdns-badge badge-teal' }, top_clients.length)
			]),
			renderList(top_clients, 'client_ip', '#059669', true)
		])
	]);
};

const updateTopRankings = topData => {
	const json = JSON.stringify(topData || {});
	if (json === lastTopJson) return;
	lastTopJson = json;
	dom.content(nodeTop, renderTopRankings(topData));
};

const showLogDetailsModal = item => {
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

	const answersCount = (item.answers && item.answers.length) || 0;
	let answersContent;
	if (answersCount > 0) {
		answersContent = E('div', { class: 'mosdns-answers-list' },
			item.answers.map(a => E('div', { class: 'mosdns-answer-row' }, [
				E('div', { style: 'display: flex; align-items: center; gap: 0.5rem; overflow: hidden; flex: 1;' }, [
					E('span', { class: 'badge-qtype', style: 'margin: 0;' }, a.type || 'A'),
					E('span', { class: 'mosdns-mono mosdns-answer-data', title: a.data }, a.data)
				]),
				E('span', { class: 'mosdns-badge badge-neutral mosdns-mono mosdns-answer-ttl' }, 'TTL ' + a.ttl + 's')
			]))
		);
	} else {
		answersContent = E('div', {
			style: 'text-align: center; padding: 1.25rem; background: rgba(125,125,125,0.03); border: 1px dashed rgba(125,125,125,0.15); border-radius: 6px; opacity: 0.6; font-size: 0.85rem;'
		}, _('No DNS answer records returned.'));
	}

	const body = E('div', { style: 'padding: 0.25rem 0;' }, [
		E('div', { class: 'mosdns-modal-header' }, [
			E('div', { class: 'mosdns-modal-domain' }, [
				E('span', { class: 'mosdns-mono' }, item.domain || '-'),
				E('span', { class: 'badge-qtype' }, item.qtype || 'A')
			]),
			E('div', { style: 'display: flex; align-items: center; gap: 0.5rem;' }, [
				statusBadge,
				E('span', { class: 'mosdns-mono ' + getLatencyClass(item.elapsed_ms), style: 'font-size: 0.85rem;' }, item.elapsed_ms + ' ms')
			])
		]),

		E('div', { class: 'mosdns-modal-meta-grid' }, [
			E('div', { class: 'mosdns-modal-meta-item' }, [
				E('div', { class: 'meta-label' }, _('Client IP')),
				E('div', { class: 'meta-val mosdns-mono' }, cleanIP(item.client_ip))
			]),
			E('div', { class: 'mosdns-modal-meta-item' }, [
				E('div', { class: 'meta-label' }, _('Time')),
				E('div', { class: 'meta-val mosdns-mono' }, formatTimestamp(item.timestamp) + (item.timestamp ? ' (' + item.timestamp.slice(0, 10) + ')' : ''))
			]),
			E('div', { class: 'mosdns-modal-meta-item' }, [
				E('div', { class: 'meta-label' }, _('Upstream')),
				E('div', { class: 'meta-val mosdns-mono', style: 'word-break: break-all;' }, item.upstream || '-')
			]),
			E('div', { class: 'mosdns-modal-meta-item' }, [
				E('div', { class: 'meta-label' }, _('Rule Hit')),
				E('div', { class: 'meta-val mosdns-mono', style: 'word-break: break-all;' }, item.rule || '-')
			])
		]),

		E('div', { class: 'mosdns-modal-section-title' }, [
			E('span', {}, _('Answers')),
			E('span', { class: 'mosdns-badge badge-neutral' }, answersCount)
		]),
		answersContent
	]);

	ui.showModal(_('Query Log Details'), [
		body,
		E('div', { class: 'right', style: 'margin-top: 1.25rem;' }, [
			E('button', {
				class: 'btn cbi-button cbi-button-action',
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
			? item.answers.map(a => a.data + ' (' + a.type + ')').join(', ')
			: '-';

		return E('tr', { class: 'tr' }, [
			E('td', { class: 'td', style: 'font-size: 0.82rem; opacity: 0.7; white-space: nowrap;' }, formatTimestamp(item.timestamp)),
			E('td', { class: 'td mosdns-mono', style: 'font-size: 0.82rem; white-space: nowrap;' }, cleanIP(item.client_ip)),
			E('td', { class: 'td', style: 'max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;', title: item.domain || '-' }, [
				E('span', { class: 'mosdns-mono', style: 'font-weight: 600;' }, item.domain || '-'),
				E('span', { class: 'badge-qtype' }, item.qtype || 'A')
			]),
			E('td', { class: 'td' }, statusBadge),
			E('td', {
				class: 'td mosdns-mono',
				style: 'font-size: 0.82rem; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;',
				title: _('Click to view full details'),
				click: () => showLogDetailsModal(item)
			}, answersText),
			E('td', { class: 'td mosdns-mono ' + getLatencyClass(item.elapsed_ms), style: 'text-align: right; font-size: 0.82rem;' }, item.elapsed_ms + ' ms')
		]);
	});

	if (!rows.length) {
		rows.push(E('tr', { class: 'tr' }, [
			E('td', { class: 'td', colspan: 6, style: 'text-align: center; opacity: 0.5; padding: 2rem;' }, _('No query log entries found.'))
		]));
	}

	return E('div', {}, [
		E('table', { class: 'table cbi-section-table mosdns-table', style: 'margin-top: 0.25rem;' }, [
			E('tr', { class: 'tr table-titles' }, [
				E('th', { class: 'th', style: 'width: 85px;' }, _('Time')),
				E('th', { class: 'th', style: 'width: 125px;' }, _('Client IP')),
				E('th', { class: 'th' }, _('Domain & Record')),
				E('th', { class: 'th', style: 'width: 90px;' }, _('Status')),
				E('th', { class: 'th' }, _('Answers')),
				E('th', { class: 'th', style: 'width: 90px; text-align: right;' }, _('Elapsed'))
			]),
			...rows
		]),

		E('div', { style: 'display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem;' }, [
			E('span', { style: 'font-size: 0.85rem; opacity: 0.7;' }, _('Page %d / %d (%d entries)').format(pageIdx + 1, totalPages, total)),
			E('div', { style: 'display: flex; gap: 0.5rem;' }, [
				E('button', {
					class: 'btn cbi-button cbi-button-action',
					disabled: pageIdx === 0 ? 'disabled' : null,
					click: () => {
						if (pageIdx > 0) {
							pageIdx--;
							updateLiveStatusBadge();
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
							updateLiveStatusBadge();
							refreshLogs();
						}
					}
				}, _('Next'))
			])
		])
	]);
};

const pollScheduler = async () => {
	try {
		const promises = [
			callGetStats(),
			callGetTop(10),
			callGetHistory(24)
		];

		const shouldRefreshLogs = (pageIdx === 0 && !searchVal && !isUserPaused);
		if (shouldRefreshLogs) {
			promises.push(callGetLogs(PAGE_SIZE, 0, '', filterVal));
		}

		const results = await Promise.all(promises);

		updateOverviewStats(results[0], results[2]);
		updateTopRankings(results[1]);

		if (shouldRefreshLogs && results[3]) {
			const json = JSON.stringify(results[3]);
			if (json !== lastLogsJson) {
				lastLogsJson = json;
				dom.content(nodeLogs, renderLogsTable(results[3]));
			}
		}
		updateLiveStatusBadge();
	} catch (e) {
	}
};

const refreshLogs = async () => {
	try {
		const logs = await callGetLogs(PAGE_SIZE, pageIdx * PAGE_SIZE, searchVal, filterVal);
		lastLogsJson = JSON.stringify(logs || {});
		dom.content(nodeLogs, renderLogsTable(logs));
		updateLiveStatusBadge();
	} catch (e) {
		ui.addNotification(null, E('p', [_('Failed to update query logs: '), e.message]), 'error');
	}
};

return view.extend({
	async load() {
		return Promise.all([
			L.resolveDefault(callGetStats(), {}),
			L.resolveDefault(callGetTop(10), {}),
			L.resolveDefault(callGetLogs(PAGE_SIZE, 0, searchVal, filterVal), {}),
			L.resolveDefault(callGetHistory(24), {})
		]);
	},

	render(data) {
		injectStyles();

		statsElements = null;
		currentBadgeState = null;
		lastTopJson = '';
		lastLogsJson = '';

		nodeStats = E('div', { id: 'overview-stats' });
		nodeTop = E('div', { id: 'top-rankings' });
		nodeLogs = E('div', { id: 'logs-table' });
		autoStatusBadge = E('div', { style: 'display: inline-block;' });

		updateOverviewStats(data[0], data[3]);
		updateTopRankings(data[1]);
		lastLogsJson = JSON.stringify(data[2] || {});
		dom.content(nodeLogs, renderLogsTable(data[2]));
		updateLiveStatusBadge();

		const searchInput = E('input', {
			type: 'text',
			class: 'cbi-input-text',
			placeholder: _('Search domain or client IP...'),
			style: 'min-width: 220px;'
		});
		searchInput.addEventListener('input', debounce(() => {
			searchVal = searchInput.value.trim();
			pageIdx = 0;
			updateLiveStatusBadge();
			refreshLogs();
		}, 300));

		const filterSelect = E('select', { class: 'cbi-input-select' }, [
			E('option', { value: 'all', selected: filterVal === 'all' ? 'selected' : null }, _('All Queries')),
			E('option', { value: 'blocked', selected: filterVal === 'blocked' ? 'selected' : null }, _('Blocked Only')),
			E('option', { value: 'cached', selected: filterVal === 'cached' ? 'selected' : null }, _('Cached Only'))
		]);
		filterSelect.addEventListener('change', () => {
			filterVal = filterSelect.value;
			pageIdx = 0;
			updateLiveStatusBadge();
			refreshLogs();
		});

		const resetPageBtn = E('button', {
			class: 'cbi-button cbi-button-apply',
			click: () => {
				pageIdx = 0;
				updateLiveStatusBadge();
				refreshLogs();
			}
		}, _('First Page / Resume'));

		const clearBtn = E('button', {
			class: 'btn cbi-button cbi-button-remove',
			style: 'margin-left: auto;'
		}, _('Clear query logs'));

		clearBtn.addEventListener('click', () => {
			ui.showModal(_('Clear query logs'), [
				E('p', {}, _('Are you sure you want to clear all real-time query logs and top rankings?')),
				E('div', { class: 'right', style: 'margin-top: 1rem;' }, [
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
									await pollScheduler();
									await refreshLogs();
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

		const controlBar = E('div', { style: 'display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.75rem;' }, [
			searchInput,
			filterSelect,
			resetPageBtn,
			autoStatusBadge,
			clearBtn
		]);

		poll.add(pollScheduler);

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
