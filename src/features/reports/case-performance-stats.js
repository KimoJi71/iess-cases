/*
 * features/reports/case-performance-stats.js — 案件績效統計（環形儀表板）
 * props: {
 *   cases, maintenanceCases, assignees,
 *   maintenanceAllocations, maintenanceAllocationYears,
 *   stores, performanceAreas, deviceCategories, serviceLevels
 * }
 */
(function () {
  'use strict';
  var h = IESS.h;
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
    var assignees = (props.assignees || []).filter(function (a) {
      return PERFORMANCE_ASSIGNEES.indexOf(a.name) !== -1;
    });
    var allocations = props.maintenanceAllocations || [];
    var stores = props.stores || [];
    var performanceAreas = props.performanceAreas || [];
    var deviceCategories = props.deviceCategories || [];
    var serviceLevels = props.serviceLevels || [];
    var allocationYears = props.maintenanceAllocationYears || [];
    var quarter = PerformanceUtils.getQuarterRange(new Date());
    // 每年 1 月 1 日起、到有人手動建立該年度分配表之前，目標一律是 0；
    // 沒有這行說明的話，畫面看起來就只是所有組達成率都掛 0%。
    var quarterYear = Number(String(quarter.start).slice(0, 4));
    var hasYearSnapshot = !!MaintenanceAllocationUtils.findYearSnapshot(allocationYears, quarterYear);

    var assigneeRows = PerformanceUtils.computeAssigneePerformance({
      cases: cases,
      maintenanceCases: maintenanceCases,
      assignees: assignees,
      allocations: allocations,
      deviceCategories: deviceCategories,
      serviceLevels: serviceLevels,
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
      h('div', { className: 'mb-6' },
        h('span', {
          className: 'inline-flex text-lg font-extrabold tracking-wide text-sky-700 bg-sky-50 px-4 py-2 rounded-lg border border-sky-100'
        }, quarter.label)
      ),

      hasYearSnapshot
        ? null
        : h('div', {
            className: 'mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'
          }, quarterYear + ' 年度分配表尚未建立，目標店數與達成率暫以 0 計'),

      h('section', { className: 'mb-10' },
        h('div', {
          className: 'flex items-center gap-3 mb-5 pb-3 border-b-2 border-sky-500'
        },
          h('span', {
            className: 'shrink-0 w-1.5 h-7 rounded-full bg-sky-500'
          }),
          h('h3', {
            className: 'text-xl font-extrabold tracking-wide text-slate-800'
          }, '各組達成率與積分')
        ),
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
        regionRows.length === 0
          ? h('div', {
              className: 'rounded-lg border border-dashed border-gray-200 p-10 text-center text-gray-400'
            }, '尚無績效區域，請至系統權限設定')
          : regionRows.map(function (region) {
              return h('div', {
                key: region.id,
                className: 'mb-10 last:mb-0'
              },
                h('div', {
                  className: 'flex items-center gap-3 mb-5 pb-3 border-b-2 border-teal-500'
                },
                  h('span', {
                    className: 'shrink-0 w-1.5 h-7 rounded-full bg-teal-500'
                  }),
                  h('h3', {
                    className: 'text-xl font-extrabold tracking-wide text-slate-800'
                  }, region.name + '總目標達成率')
                ),
                region.customers.length === 0
                  ? h('p', { className: 'text-sm text-gray-400 mb-2 pl-4' },
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
