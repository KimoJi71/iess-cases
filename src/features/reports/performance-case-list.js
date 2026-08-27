/*
 * features/reports/performance-case-list.js — 案件績效統計圖卡「查看」的當季案件列表
 *
 * 兩種來源共用同一支列表，只差欄位與取數條件（scope.type）：
 *   assignee        各組達成率與積分的圖卡 → 當季已完成的保養案件 + 分到本組的增額案件
 *   region-customer 區域總目標達成率的客戶圖卡 → 當季該客戶在該區域的保養案件
 *
 * props: {
 *   scope, cases, maintenanceCases, assignees, stores, serviceLevels, accounts,
 *   maintenanceAllocations, performanceAreas, onBack, onView
 * }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  function PerformanceCaseList(props) {
    var scope = props.scope || {};
    var isAssigneeScope = scope.type === 'assignee';
    var stores = props.stores || [];
    var quarter = PerformanceUtils.getQuarterRange(new Date());
    var quarterYear = Number(String(quarter.start).slice(0, 4));

    var keyword = '';
    var appliedKeyword = '';
    // 預設先看最近結案的；規格要求「客戶名稱」與「完成日期」兩欄可排序
    var sortKey = 'closeDate';
    var sortDir = -1;
    var listPagination = IESS.createListPagination();

    function getAreaDistricts() {
      var area = (props.performanceAreas || []).find(function (a) { return a.id === scope.areaId; });
      return (area && area.districts) || [];
    }

    function getRows() {
      if (isAssigneeScope) {
        return PerformanceUtils.collectAssigneeQuarterCases({
          cases: props.cases || [],
          maintenanceCases: props.maintenanceCases || [],
          serviceLevels: props.serviceLevels || [],
          accounts: props.accounts || [],
          assigneeProfiles: props.assignees || [],
          stores: stores,
          quarter: quarter,
          assigneeName: scope.assigneeName
        });
      }
      return PerformanceUtils.collectRegionCustomerQuarterCases({
        maintenanceCases: props.maintenanceCases || [],
        stores: stores,
        quarter: quarter,
        customerName: scope.customerName,
        areaDistricts: getAreaDistricts()
      });
    }

    function matchesKeyword(row, kw) {
      return [
        row.caseNumber, row.customerName, row.storeName, row.serviceLevel, row.area,
        row.workCategory, row.repairItem, row.repairReason, row.actualReason,
        row.assigneeText, row.closeDate
      ].filter(Boolean).some(function (v) {
        return String(v).toLowerCase().includes(kw);
      });
    }

    function getVisibleRows() {
      var kw = appliedKeyword.trim().toLowerCase();
      var rows = getRows().filter(function (row) {
        return !kw || matchesKeyword(row, kw);
      });
      return rows.sort(function (a, b) {
        var av = String(a[sortKey] || '');
        var bv = String(b[sortKey] || '');
        var cmp = sortKey === 'customerName'
          ? av.localeCompare(bv, 'zh-Hant')
          : av.localeCompare(bv);
        return cmp * sortDir;
      });
    }

    // 積分依處理方式加總後可能帶小數，顯示時收到小數點一位（與圖卡一致）
    function formatPoints(value) {
      return String(Math.round((Number(value) || 0) * 10) / 10);
    }

    function cell(text, opts) {
      opts = opts || {};
      var display = text === '' || text == null ? (opts.blank ? '' : '—') : text;
      return h('td', {
        className: 'p-3' + (opts.className ? ' ' + opts.className : ''),
        title: typeof text === 'string' ? text : ''
      }, display);
    }

    return stateful(function (rerender) {
      var rows = getVisibleRows();
      var pageResult = listPagination.slice(rows);

      function handleSearch() {
        appliedKeyword = keyword;
        listPagination.resetPage();
        rerender();
      }

      function toggleSort(key) {
        if (sortKey === key) {
          sortDir = sortDir === 1 ? -1 : 1;
        } else {
          sortKey = key;
          sortDir = key === 'customerName' ? 1 : -1;
        }
        listPagination.resetPage();
        rerender();
      }

      function sortableTh(label, key) {
        var active = sortKey === key;
        return h('th', {
          className: 'p-3 font-semibold cursor-pointer select-none hover:bg-gray-100',
          title: '依' + label + '排序',
          'aria-sort': !active ? 'none' : (sortDir === 1 ? 'ascending' : 'descending'),
          onClick: function () { toggleSort(key); }
        },
          h('span', { className: 'inline-flex items-center gap-0.5' },
            label,
            Icons.ChevronDown({
              className: 'h-3.5 w-3.5' +
                (active && sortDir === 1 ? ' rotate-180' : '') +
                (active ? '' : ' opacity-40')
            })
          )
        );
      }

      function renderTargetSummary() {
        if (!isAssigneeScope) return null;
        var breakdown = PerformanceUtils.getAllocationTargetBreakdown(
          props.maintenanceAllocations || [],
          {
            months: PerformanceUtils.getQuarterMonths(quarter),
            year: quarterYear,
            assigneeId: scope.assigneeId
          }
        );
        return h('div', {
          className: 'mb-6 rounded-lg border border-sky-100 bg-sky-50/70 px-4 py-3'
        },
          h('div', { className: 'text-xs font-semibold text-sky-800 mb-1' }, '當季保養資訊'),
          h('div', { className: 'text-sm text-slate-700' },
            h('span', { className: 'font-medium' }, '當季保養目標店數：'),
            h('span', { className: 'font-bold text-sky-700' }, '總店數 ' + breakdown.total),
            breakdown.items.length
              ? h('span', { className: 'text-slate-500' },
                  '（' + breakdown.items.map(function (item) {
                    return item.customerName + ' ' + item.target;
                  }).join(' / ') + '）')
              : null
          )
        );
      }

      var colCount = isAssigneeScope ? 13 : 7;

      return h('div', { className: 'bg-white rounded-lg shadow-sm border border-gray-100' },
        PageHeader({
          title: isAssigneeScope
            ? scope.assigneeName + ' 當季案件'
            : scope.customerName + ' 當季保養案件',
          badge: isAssigneeScope
            ? quarter.label
            : quarter.label + ' / ' + (scope.areaName || ''),
          onClose: props.onBack,
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200'
        }),
        h('div', { className: 'p-6' },
          renderTargetSummary(),
          h('div', { className: 'bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6' },
            h('div', { className: 'flex flex-wrap items-end gap-3' },
              h('div', { className: 'min-w-0' },
                h('label', { className: 'block text-xs text-gray-500 mb-1' }, '關鍵字'),
                h('input', {
                  type: 'text',
                  value: keyword,
                  onChange: function (e) { keyword = e.target.value; rerender(); },
                  onKeyDown: function (e) { if (e.key === 'Enter') handleSearch(); },
                  placeholder: '請輸入關鍵字',
                  className: 'w-64 max-w-full p-2.5 border rounded-md outline-none bg-white'
                })
              ),
              h('button', {
                type: 'button',
                onClick: handleSearch,
                className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md shadow-sm transition-colors min-h-[42px]'
              }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
            )
          ),
          h('div', { className: 'overflow-x-auto border rounded-lg' },
            h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap' },
              h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
                isAssigneeScope
                  ? h('tr', null,
                      h('th', { className: 'p-3 w-20 text-center font-semibold' }, '操作'),
                      h('th', { className: 'p-3 font-semibold' }, '案件編號'),
                      sortableTh('結案日期', 'closeDate'),
                      sortableTh('客戶名稱', 'customerName'),
                      h('th', { className: 'p-3 font-semibold' }, '門市名稱'),
                      h('th', { className: 'p-3 font-semibold' }, '服務等級'),
                      h('th', { className: 'p-3 font-semibold' }, '行政區域'),
                      h('th', { className: 'p-3 font-semibold' }, '工項分類'),
                      h('th', { className: 'p-3 font-semibold' }, '叫修項目'),
                      h('th', { className: 'p-3 font-semibold' }, '叫修原因'),
                      h('th', { className: 'p-3 font-semibold' }, '實際原因'),
                      h('th', { className: 'p-3 font-semibold' }, '組別'),
                      h('th', { className: 'p-3 font-semibold text-right' }, '總積分')
                    )
                  : h('tr', null,
                      h('th', { className: 'p-3 w-20 text-center font-semibold' }, '操作'),
                      sortableTh('結案日期', 'closeDate'),
                      // 區域卡片只看單一客戶，這欄整列都一樣，不必排序
                      h('th', { className: 'p-3 font-semibold' }, '客戶名稱'),
                      h('th', { className: 'p-3 font-semibold' }, '門市名稱'),
                      h('th', { className: 'p-3 font-semibold' }, '服務等級'),
                      h('th', { className: 'p-3 font-semibold' }, '行政區域'),
                      h('th', { className: 'p-3 font-semibold' }, '組別')
                    )
              ),
              h('tbody', { className: 'divide-y divide-gray-100' },
                rows.length === 0
                  ? h('tr', null, h('td', {
                      colspan: colCount,
                      className: 'p-10 text-center text-gray-400 text-base'
                    }, '無資料'))
                  : pageResult.items.map(function (row) {
                      var viewCell = h('td', { className: 'p-3 text-center' },
                        h('button', {
                          type: 'button',
                          onClick: function () { props.onView(row); },
                          className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                          title: '查看明細'
                        }, Icons.Eye({ className: 'h-4 w-4' }))
                      );
                      if (!isAssigneeScope) {
                        return h('tr', { key: row.id, className: 'hover:bg-blue-50/50 transition-colors' },
                          viewCell,
                          cell(row.closeDate),
                          cell(row.customerName),
                          cell(row.storeName),
                          cell(row.serviceLevel),
                          cell(row.area),
                          cell(row.assigneeText)
                        );
                      }
                      return h('tr', { key: row.id, className: 'hover:bg-blue-50/50 transition-colors' },
                        viewCell,
                        // 保養類型沒有案件編號／叫修項目／叫修原因，欄位留白而不是補「—」
                        // 案件編號沿用其他列表的藍色強調樣式；保養列留白
                        cell(row.caseNumber, { blank: true, className: 'font-medium text-blue-700' }),
                        cell(row.closeDate),
                        cell(row.customerName),
                        cell(row.storeName),
                        cell(row.serviceLevel),
                        cell(row.area),
                        cell(row.workCategory),
                        cell(row.repairItem, { blank: true }),
                        cell(row.repairReason, { blank: true }),
                        cell(row.actualReason, { className: 'max-w-[220px] truncate' }),
                        cell(row.assigneeText),
                        // 保養單沒有積分，這欄留白而不是印 0
                        h('td', { className: 'p-3 text-right tabular-nums' },
                          row.points == null ? '' : formatPoints(row.points))
                      );
                    })
              )
            )
          ),
          listPagination.renderBar(pageResult, rerender)
        )
      );
    });
  }

  window.PerformanceCaseList = PerformanceCaseList;
})();
