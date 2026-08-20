/*
 * features/repair/case-record.js — 案件處理：案件記錄列表（已結案，依查詢區間）
 * props: { cases, setViewingCase, setView }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  function matchKeyword(c, kw) {
    if (!kw) return true;
    return [
      c.caseNumber, c.customerName, c.storeName, c.workCategory,
      c.repairItem, c.repairReason, c.faultDesc, c.actualReason,
      StoreUtils.getRecordArea(c),
      CaseAssigneeUtils.formatAssignees(c),
      CaseAssigneeUtils.formatAssigneeMembers(c)
    ].filter(Boolean).some(function (v) {
      return String(v).toLowerCase().includes(kw);
    });
  }

  function CaseRecordList(props) {
    var cases = props.cases;
    var setViewingCase = props.setViewingCase;
    var setView = props.setView;

    var startDate = todayDate;
    var endDate = todayDate;
    var appliedDateRange = { start: todayDate, end: todayDate };
    var keyword = '';
    var appliedKeyword = '';
    var listPagination = IESS.createListPagination();

    return stateful(function (rerender) {
      function handleSearch() {
        appliedDateRange = { start: startDate, end: endDate };
        appliedKeyword = keyword;
        listPagination.resetPage();
        rerender();
      }

      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }

      var kw = appliedKeyword.trim().toLowerCase();
      var filteredCases = cases.filter(function (c) {
        if (!c.isClosed) return false;
        var date = (c.repairDate || '').slice(0, 10);
        if (date < appliedDateRange.start || date > appliedDateRange.end) return false;
        return matchKeyword(c, kw);
      }).sort(function (a, b) { return new Date(b.repairDate) - new Date(a.repairDate); });
      var pageResult = listPagination.slice(filteredCases);

      return h('div', {
        className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100'
      },
        h('div', {
          className: 'bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6'
        },
          h('div', {
            className: 'flex flex-wrap items-end gap-4'
          },
            h('div', { className: 'min-w-0' },
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '開始日期'),
              h('input', {
                type: 'date',
                value: startDate,
                onChange: function (e) { startDate = e.target.value; rerender(); },
                className: 'p-2.5 border rounded-md outline-none bg-white'
              })
            ),
            h('div', { className: 'min-w-0' },
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '結束日期'),
              h('input', {
                type: 'date',
                value: endDate,
                onChange: function (e) { endDate = e.target.value; rerender(); },
                className: 'p-2.5 border rounded-md outline-none bg-white'
              })
            ),
            h('div', { className: 'min-w-0' },
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '關鍵字'),
              h('input', {
                type: 'text',
                value: keyword,
                onChange: function (e) { keyword = e.target.value; rerender(); },
                onKeyDown: handleKeyDown,
                placeholder: '請輸入關鍵字',
                className: 'w-80 max-w-full p-2.5 border rounded-md outline-none bg-white'
              })
            ),
            h('button', {
              type: 'button',
              onClick: handleSearch,
              className: 'bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[42px] transition-colors'
            }, Icons.Search({ className: 'h-4 w-4 shrink-0' }), '搜尋'),
            !!appliedKeyword && h('button', {
              type: 'button',
              onClick: function () {
                keyword = '';
                appliedKeyword = '';
                listPagination.resetPage();
                rerender();
              },
              className: 'px-5 py-2 border rounded-md text-gray-600 bg-white hover:bg-gray-50 transition-colors min-h-[42px]'
            }, '清除')
          )
        ),
        h('div', {
          className: 'overflow-x-auto border rounded-lg'
        },
          h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap' },
            h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
              h('tr', null,
                h('th', { className: 'p-3 w-20 text-center' }, '操作'),
                h('th', { className: 'p-3 font-semibold' }, '叫修時間'),
                h('th', { className: 'p-3 font-semibold' }, '案件編號'),
                h('th', { className: 'p-3 font-semibold' }, '客戶名稱'),
                h('th', { className: 'p-3 font-semibold' }, '門市名稱'),
                h('th', { className: 'p-3 font-semibold' }, '公司區域'),
                h('th', { className: 'p-3 font-semibold' }, '工項分類'),
                h('th', { className: 'p-3 font-semibold' }, '叫修項目'),
                h('th', { className: 'p-3 font-semibold' }, '叫修原因'),
                h('th', { className: 'p-3 font-semibold max-w-[150px]' }, '故障描述'),
                h('th', { className: 'p-3 font-semibold max-w-[150px]' }, '實際原因'),
                h('th', { className: 'p-3 font-semibold' }, '組別'),
                h('th', { className: 'p-3 font-semibold' }, '指派人員')
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-100' },
              filteredCases.length === 0 ? h('tr', null,
                h('td', { colspan: '13', className: 'text-center p-8 text-gray-400' }, '無資料符合目前搜尋條件')
              ) : pageResult.items.map(function (c) {
                return h('tr', { key: c.id, className: 'hover:bg-gray-50 transition-colors' },
                  h('td', { className: 'p-3 text-center' },
                    h('button', {
                      onClick: function () { setViewingCase(c); setView('record-view'); },
                      className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                      title: '查看明細'
                    }, Icons.Eye({ className: 'h-4 w-4' }))
                  ),
                  h('td', { className: 'p-3' }, IESS.caseDateTime.format(c.repairDate)),
                  h('td', { className: 'p-3 font-medium text-blue-700' }, c.caseNumber),
                  h('td', { className: 'p-3' }, c.customerName),
                  h('td', { className: 'p-3' }, c.storeName),
                  h('td', { className: 'p-3' }, StoreUtils.getRecordArea(c) || '—'),
                  h('td', { className: 'p-3' }, c.workCategory),
                  h('td', { className: 'p-3' }, c.repairItem),
                  h('td', { className: 'p-3' }, c.repairReason),
                  h('td', { className: 'p-3 max-w-[150px] truncate', title: c.faultDesc }, c.faultDesc),
                  h('td', { className: 'p-3 max-w-[150px] truncate', title: c.actualReason }, c.actualReason || '-'),
                  h('td', { className: 'p-3' }, CaseAssigneeUtils.formatAssignees(c)),
                  h('td', { className: 'p-3' }, CaseAssigneeUtils.formatAssigneeMembers(c) || '—')
                );
              })
            )
          )
        ),
        listPagination.renderBar(pageResult, rerender)
      );
    });
  }

  window.CaseRecordList = CaseRecordList;
})();
