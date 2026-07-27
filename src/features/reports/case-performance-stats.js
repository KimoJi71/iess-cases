/*
 * features/reports/case-performance-stats.js — 案件績效統計（環形儀表板）
 * props: {
 *   cases, maintenanceCases, assignees,
 *   maintenanceAllocations, stores, performanceAreas
 * }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var RING_R = 44;
  var RING_C = 2 * Math.PI * RING_R;

  var THEME = {
    assignee: { stroke: '#0ea5e9', text: '#0369a1' },
    region: { stroke: '#14b8a6', text: '#0f766e' },
    customer: { stroke: '#93c5fd', text: '#1e40af' }
  };

  function createRingSvg(rate, theme, idSuffix) {
    var clamped = Math.min(Math.max(Number(rate) || 0, 0), 100);
    var filled = (clamped / 100) * RING_C;
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('class', 'w-24 h-24 mx-auto');
    svg.setAttribute('aria-hidden', 'true');

    var track = document.createElementNS(SVG_NS, 'circle');
    track.setAttribute('cx', '60');
    track.setAttribute('cy', '60');
    track.setAttribute('r', String(RING_R));
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', '#e2e8f0');
    track.setAttribute('stroke-width', '10');
    svg.appendChild(track);

    var arc = document.createElementNS(SVG_NS, 'circle');
    arc.setAttribute('cx', '60');
    arc.setAttribute('cy', '60');
    arc.setAttribute('r', String(RING_R));
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', theme.stroke);
    arc.setAttribute('stroke-width', '10');
    arc.setAttribute('stroke-linecap', 'round');
    arc.setAttribute('stroke-dasharray', filled + ' ' + RING_C);
    arc.setAttribute('transform', 'rotate(-90 60 60)');
    svg.appendChild(arc);

    var label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', '60');
    label.setAttribute('y', '66');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', theme.text);
    label.setAttribute('font-size', '22');
    label.setAttribute('font-weight', '700');
    label.textContent = clamped + '%';
    svg.appendChild(label);

    return svg;
  }

  function RingStatCard(props) {
    var title = props.title;
    var rate = props.rate;
    var target = props.target;
    var completed = props.completed;
    var bonusPoints = props.bonusPoints;
    var showBonus = !!props.showBonus;
    var theme = THEME[props.variant] || THEME.assignee;
    var emphasize = !!props.emphasize;

    return h('div', {
      className: 'rounded-xl overflow-hidden shadow-sm border bg-white ' +
        (emphasize ? 'border-teal-200' : 'border-slate-200')
    },
      h('div', {
        className: 'px-4 py-3 border-b border-slate-100 ' +
          (emphasize ? 'bg-teal-50/80' : 'bg-slate-50')
      },
        h('span', {
          className: 'text-slate-800 font-bold text-base truncate block',
          title: title
        }, title)
      ),
      h('div', { className: 'px-5 pt-5 pb-4' },
        h('p', { className: 'text-slate-500 text-sm mb-2 text-center' },
          props.subtitle || '本季保養目標達成率'),
        createRingSvg(rate, theme, title),
        h('div', {
          className: 'mt-4 grid gap-2 text-center text-xs text-slate-500 ' +
            (showBonus ? 'grid-cols-3' : 'grid-cols-2')
        },
          h('div', null,
            h('div', null, '目標店數'),
            h('div', { className: 'text-slate-900 font-bold text-base mt-0.5' },
              String(target))
          ),
          h('div', null,
            h('div', null, '完成店數'),
            h('div', { className: 'text-slate-900 font-bold text-base mt-0.5' },
              String(completed))
          ),
          showBonus && h('div', null,
            h('div', null, '增額積分'),
            h('div', { className: 'text-sky-700 font-bold text-base mt-0.5' },
              String(bonusPoints))
          )
        )
      )
    );
  }

  function CasePerformanceStats(props) {
    var cases = props.cases || [];
    var maintenanceCases = props.maintenanceCases || [];
    var assignees = props.assignees || [];
    var allocations = props.maintenanceAllocations || [];
    var stores = props.stores || [];
    var performanceAreas = props.performanceAreas || [];
    var quarter = PerformanceUtils.getQuarterRange(new Date());

    var assigneeRows = PerformanceUtils.computeAssigneePerformance({
      cases: cases,
      maintenanceCases: maintenanceCases,
      assignees: assignees,
      allocations: allocations,
      quarter: quarter
    });

    var regionRows = PerformanceUtils.computeRegionPerformance({
      maintenanceCases: maintenanceCases,
      stores: stores,
      performanceAreas: performanceAreas,
      allocations: allocations,
      quarter: quarter
    });

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
          '上半顯示各指派人員當季績效；下半依績效區域顯示總達成率與客戶達成率。',
          '完成店數僅計已列入績效之保養案件；增額積分僅計服務等級 C／D 之叫修案件。')
      ),

      h('section', { className: 'mb-8' },
        h('h3', { className: 'text-lg font-bold text-gray-800 mb-4' }, '指派人員績效'),
        assigneeRows.length === 0
          ? h('div', {
              className: 'rounded-lg border border-dashed border-gray-200 p-10 text-center text-gray-400'
            }, '尚無指派人員')
          : h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5' },
              assigneeRows.map(function (row) {
                return h(RingStatCard, {
                  key: row.id,
                  title: row.name,
                  rate: row.rate,
                  target: row.target,
                  completed: row.completed,
                  bonusPoints: row.bonusPoints,
                  showBonus: true,
                  variant: 'assignee'
                });
              })
            )
      ),

      h('section', null,
        h('h3', { className: 'text-lg font-bold text-gray-800 mb-4' }, '績效區域達成率'),
        regionRows.length === 0
          ? h('div', {
              className: 'rounded-lg border border-dashed border-gray-200 p-10 text-center text-gray-400'
            }, '尚無績效區域，請至系統權限設定')
          : regionRows.map(function (region) {
              return h('div', {
                key: region.id,
                className: 'mb-8 last:mb-0'
              },
                h('div', { className: 'max-w-sm mb-4' },
                  h(RingStatCard, {
                    title: region.name + '總目標達成率',
                    rate: region.rate,
                    target: region.target,
                    completed: region.completed,
                    showBonus: false,
                    variant: 'region',
                    emphasize: true
                  })
                ),
                region.customers.length === 0
                  ? h('p', { className: 'text-sm text-gray-400 mb-2' },
                      '此區域尚無對應門市客戶')
                  : h('div', {
                      className: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5'
                    },
                      region.customers.map(function (cust) {
                        return h(RingStatCard, {
                          key: region.id + ':' + cust.customerName,
                          title: cust.customerName,
                          rate: cust.rate,
                          target: cust.target,
                          completed: cust.completed,
                          showBonus: false,
                          variant: 'customer'
                        });
                      })
                    )
              );
            })
      )
    );
  }

  window.CasePerformanceStats = CasePerformanceStats;
})();
