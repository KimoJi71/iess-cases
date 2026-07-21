/*
 * features/repair/case-review.js — 案件銷案審核列表（列入績效）
 * props: { cases, setCases, setViewingCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll;

  function CaseReviewList(props) {
    var cases = props.cases;
    var setCases = props.setCases;
    var setViewingCase = props.setViewingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    var startDate = todayDate;
    var endDate = todayDate;
    var appliedDateRange = { start: todayDate, end: todayDate };
    var includeConfirmModal = { show: false, caseId: null };
    var dragProps = useDragScroll();

    return stateful(function (rerender) {
      function handleSearch() {
        appliedDateRange = { start: startDate, end: endDate };
        rerender();
      }

      var filteredCases = cases.filter(function (c) {
        return c.isClosed && !c.isPerformanceIncluded &&
          (c.repairDate || '').slice(0, 10) >= appliedDateRange.start &&
          (c.repairDate || '').slice(0, 10) <= appliedDateRange.end;
      }).sort(function (a, b) { return new Date(b.repairDate) - new Date(a.repairDate); });

      function handleIncludePerformance(caseId) {
        setCases(cases.map(function (c) {
          return c.id === caseId ? Object.assign({}, c, { isPerformanceIncluded: true }) : c;
        }));
        includeConfirmModal = { show: false, caseId: null };
        showToast('已成功列入案件績效');
      }

      return h('div', {
        className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100'
      },
        h('div', { className: 'flex items-center gap-3 mb-6 pb-6 border-b' },
          Icons.Calendar({ className: 'h-5 w-5 text-gray-500' }),
          h('span', { className: 'font-medium text-gray-700' }, '查詢區間：'),
          h('input', {
            type: 'date',
            value: startDate,
            onChange: function (e) { startDate = e.target.value; rerender(); },
            className: 'p-2 border rounded-md outline-none'
          }),
          h('span', { className: 'text-gray-500' }, '至'),
          h('input', {
            type: 'date',
            value: endDate,
            onChange: function (e) { endDate = e.target.value; rerender(); },
            className: 'p-2 border rounded-md outline-none'
          }),
          h('button', {
            onClick: handleSearch,
            className: 'bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors hover:bg-blue-700'
          }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
        ),
        h('div', Object.assign({
          className: 'overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing'
        }, dragProps),
          h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap select-none' },
            h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
              h('tr', null,
                h('th', { className: 'p-3 w-24 text-center' }, '操作'),
                h('th', { className: 'p-3 font-semibold' }, '叫修時間'),
                h('th', { className: 'p-3 font-semibold' }, '案件編號'),
                h('th', { className: 'p-3 font-semibold' }, '客戶名稱'),
                h('th', { className: 'p-3 font-semibold' }, '門市名稱'),
                h('th', { className: 'p-3 font-semibold' }, '行政區域'),
                h('th', { className: 'p-3 font-semibold' }, '服務等級'),
                h('th', { className: 'p-3 font-semibold' }, '工項分類'),
                h('th', { className: 'p-3 font-semibold' }, '叫修項目'),
                h('th', { className: 'p-3 font-semibold' }, '叫修原因'),
                h('th', { className: 'p-3 font-semibold max-w-[150px]' }, '實際原因'),
                h('th', { className: 'p-3 font-semibold' }, '指派人員')
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-100' },
              filteredCases.length === 0 ? h('tr', null,
                h('td', { colspan: '12', className: 'text-center p-8 text-gray-400' }, '無資料符合目前搜尋區間')
              ) : filteredCases.map(function (c) {
                return h('tr', { key: c.id, className: 'hover:bg-gray-50 transition-colors' },
                  h('td', { className: 'p-3' },
                    h('div', { className: 'flex items-center justify-center space-x-2' },
                      h('button', {
                        onClick: function () { setViewingCase(c); setView('review-view'); },
                        className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                        title: '查看明細'
                      }, Icons.Eye({ className: 'h-4 w-4' })),
                      h('button', {
                        onClick: function () { includeConfirmModal = { show: true, caseId: c.id }; rerender(); },
                        className: 'p-1.5 text-amber-500 hover:bg-amber-100 rounded',
                        title: '列入案件績效'
                      }, Icons.Star({ className: 'h-4 w-4' }))
                    )
                  ),
                  h('td', { className: 'p-3' }, IESS.caseDateTime.format(c.repairDate)),
                  h('td', { className: 'p-3 font-medium text-blue-700' }, c.caseNumber),
                  h('td', { className: 'p-3' }, c.customerName),
                  h('td', { className: 'p-3' }, c.storeName),
                  h('td', { className: 'p-3' }, c.district),
                  h('td', { className: 'p-3' }, c.serviceLevel),
                  h('td', { className: 'p-3' }, c.workCategory),
                  h('td', { className: 'p-3' }, c.repairItem),
                  h('td', { className: 'p-3' }, c.repairReason),
                  h('td', { className: 'p-3 max-w-[150px] truncate', title: c.actualReason }, c.actualReason || '-'),
                  h('td', { className: 'p-3' }, c.assignee)
                );
              })
            )
          )
        ),
        includeConfirmModal.show && h('div', {
          className: 'fixed inset-0 bg-black/40 flex items-center justify-center z-50'
        },
          h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4' },
            h('div', { className: 'flex items-center space-x-3 text-amber-500 mb-4' },
              Icons.Star({ className: 'h-6 w-6' }),
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '列入績效')
            ),
            h('p', { className: 'text-gray-600 mb-6' },
              '確定要將此案件列入績效計算嗎？操作後將從此審核列表中移除。'),
            h('div', { className: 'flex justify-end space-x-3' },
              h('button', {
                onClick: function () { includeConfirmModal = { show: false, caseId: null }; rerender(); },
                className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
              }, '取消'),
              h('button', {
                onClick: function () { handleIncludePerformance(includeConfirmModal.caseId); },
                className: 'px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors'
              }, '確認列入')
            )
          )
        )
      );
    });
  }

  window.CaseReviewList = CaseReviewList;
})();
