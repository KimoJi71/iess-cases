/*
 * features/reports/case-performance-stats.js — 案件績效統計（儀表板卡片）
 * props: { cases }
 *
 * 進入頁面即顯示所有指派人員當季績效（本季目標達成率）。
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function polar(cx, cy, r, angle) {
    return {
      x: cx + r * Math.cos(angle),
      y: cy - r * Math.sin(angle)
    };
  }

  function createGaugeSvg(rate, idSuffix) {
    var clamped = Math.min(Math.max(rate, 0), 100);
    var cx = 120;
    var cy = 108;
    var r = 82;
    var start = polar(cx, cy, r, Math.PI);
    var end = polar(cx, cy, r, 0);
    var needleAngle = Math.PI - (clamped / 100) * Math.PI;
    var needleTip = polar(cx, cy, 62, needleAngle);
    var needleBaseL = polar(cx, cy, 8, needleAngle + Math.PI / 2);
    var needleBaseR = polar(cx, cy, 8, needleAngle - Math.PI / 2);
    var gradId = 'gauge-gradient-' + idSuffix;

    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 240 150');
    svg.setAttribute('class', 'w-full max-w-[280px] mx-auto');
    svg.setAttribute('aria-hidden', 'true');

    var defs = document.createElementNS(SVG_NS, 'defs');
    var gradient = document.createElementNS(SVG_NS, 'linearGradient');
    gradient.setAttribute('id', gradId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '0%');
    gradient.innerHTML =
      '<stop offset="0%" stop-color="#22c55e"/>' +
      '<stop offset="50%" stop-color="#eab308"/>' +
      '<stop offset="100%" stop-color="#ef4444"/>';
    defs.appendChild(gradient);
    svg.appendChild(defs);

    var track = document.createElementNS(SVG_NS, 'path');
    track.setAttribute('d',
      'M ' + start.x + ' ' + start.y +
      ' A ' + r + ' ' + r + ' 0 0 1 ' + end.x + ' ' + end.y
    );
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', '#e5e7eb');
    track.setAttribute('stroke-width', '14');
    track.setAttribute('stroke-linecap', 'round');
    svg.appendChild(track);

    var arc = document.createElementNS(SVG_NS, 'path');
    arc.setAttribute('d',
      'M ' + start.x + ' ' + start.y +
      ' A ' + r + ' ' + r + ' 0 0 1 ' + end.x + ' ' + end.y
    );
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', 'url(#' + gradId + ')');
    arc.setAttribute('stroke-width', '14');
    arc.setAttribute('stroke-linecap', 'round');
    svg.appendChild(arc);

    for (var i = 0; i <= 10; i++) {
      var tickAngle = Math.PI - (i / 10) * Math.PI;
      var inner = polar(cx, cy, r - 10, tickAngle);
      var outer = polar(cx, cy, r - 2, tickAngle);
      var tick = document.createElementNS(SVG_NS, 'line');
      tick.setAttribute('x1', String(inner.x));
      tick.setAttribute('y1', String(inner.y));
      tick.setAttribute('x2', String(outer.x));
      tick.setAttribute('y2', String(outer.y));
      tick.setAttribute('stroke', '#9ca3af');
      tick.setAttribute('stroke-width', i % 2 === 0 ? '2' : '1');
      svg.appendChild(tick);
    }

    var needle = document.createElementNS(SVG_NS, 'polygon');
    needle.setAttribute('points',
      needleTip.x + ',' + needleTip.y + ' ' +
      needleBaseL.x + ',' + needleBaseL.y + ' ' +
      needleBaseR.x + ',' + needleBaseR.y
    );
    needle.setAttribute('fill', '#2563eb');
    svg.appendChild(needle);

    var hub = document.createElementNS(SVG_NS, 'circle');
    hub.setAttribute('cx', String(cx));
    hub.setAttribute('cy', String(cy));
    hub.setAttribute('r', '6');
    hub.setAttribute('fill', '#2563eb');
    svg.appendChild(hub);

    var label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', String(cx));
    label.setAttribute('y', String(cy + 34));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#1d4ed8');
    label.setAttribute('font-size', '28');
    label.setAttribute('font-weight', '700');
    label.textContent = clamped + '%';
    svg.appendChild(label);

    return svg;
  }

  function PerformanceGaugeCard(props) {
    var row = props.row;
    return h('div', {
      className: 'rounded-lg overflow-hidden shadow-sm border border-gray-200 bg-white'
    },
      h('div', {
        className: 'px-4 py-3 border-b border-gray-100 bg-gray-50'
      },
        h('span', { className: 'text-gray-800 font-bold text-lg truncate' }, row.assignee)
      ),
      h('div', { className: 'px-5 pt-5 pb-4' },
        h('p', { className: 'text-gray-600 text-sm mb-2' }, '本季目標達成率'),
        createGaugeSvg(row.rate, row.assignee),
        h('p', { className: 'text-gray-500 text-sm mt-3 text-center' },
          '增額案件達成數：',
          h('span', { className: 'text-blue-700 font-bold ml-1' }, String(row.completed))
        )
      )
    );
  }

  function CasePerformanceStats(props) {
    var cases = props.cases;
    var quarter = PerformanceUtils.getQuarterRange(new Date());
    var rows = PerformanceUtils.computePerformanceStats(
      cases, PERFORMANCE_ASSIGNEES, PERFORMANCE_QUARTERLY_TARGETS, quarter
    );

    return h('div', null,
      h('div', {
        className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6'
      },
        h('div', { className: 'flex flex-wrap items-center justify-between gap-3' },
          h('div', { className: 'flex items-center gap-3' },
            Icons.BarChart({ className: 'h-6 w-6 text-blue-600' }),
            h('h2', { className: 'text-2xl font-bold text-gray-800' }, '案件績效統計')
          ),
          h('span', {
            className: 'text-sm font-medium text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full'
          }, quarter.label)
        ),
        h('p', { className: 'text-sm text-gray-500 mt-3' },
          '顯示所有指派人員當季績效。達成率依「列入績效」之銷案件數 ÷ 本季目標件數計算。')
      ),
      h('div', {
        className: 'grid grid-cols-1 md:grid-cols-2 gap-5'
      },
        rows.map(function (row) {
          return h(PerformanceGaugeCard, { key: row.assignee, row: row });
        })
      )
    );
  }

  window.CasePerformanceStats = CasePerformanceStats;
})();
