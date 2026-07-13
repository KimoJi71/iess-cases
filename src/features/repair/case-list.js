/*
 * features/repair/case-list.js — 案件處理：案件列表（未結案）
 * props: { cases, setCases, setEditingCase, setView, showToast, statusFilter, setStatusFilter }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll;

  function CaseList(props) {
    var cases = props.cases;
    var setCases = props.setCases;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;
    var statusFilter = props.statusFilter;      // 來自 store（切換即整頁重繪）
    var setStatusFilter = props.setStatusFilter;

    // 區域狀態：結案確認 modal
    var closeConfirmModal = { show: false, caseId: null };
    var dragProps = useDragScroll();

    function getFiltered() {
      var filtered;
      if (statusFilter === '全部') {
        filtered = cases.filter(function (c) { return !c.isClosed; });
      } else {
        filtered = cases.filter(function (c) { return !c.isClosed && c.processStatus === statusFilter; });
      }
      return filtered.sort(function (a, b) { return new Date(b.repairDate) - new Date(a.repairDate); });
    }

    function getStatusCounts() {
      return cases.filter(function (c) { return !c.isClosed; }).reduce(function (acc, c) {
        acc[c.processStatus] = (acc[c.processStatus] || 0) + 1;
        return acc;
      }, {});
    }

    function handleCopyUrl(caseNumber) {
      navigator.clipboard.writeText('https://system.jinchuan.com/case/' + caseNumber);
      showToast('已複製 ' + caseNumber + ' 案件連結');
    }

    function handleCloseCase(caseId) {
      setCases(cases.map(function (c) {
        return c.id === caseId
          ? Object.assign({}, c, { isClosed: true, processStatus: '案件完成', completionDate: c.completionDate || todayDate })
          : c;
      }));
      // setCases 觸發整頁重繪，modal 隨之關閉
      showToast('案件已結案，並移至銷案審核列表');
    }

    function getIndicatorColor(c) {
      if (c.processStatus === '案件完成') return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]';
      if (c.workCategory === '緊急叫修') return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
      if (c.expectedDate && c.expectedDate < todayDate) return 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]';
      return 'bg-gray-300';
    }

    return stateful(function (rerender) {
      var filteredCases = getFiltered();
      var statusCounts = getStatusCounts();

      function statusFilterBtn(status, label) {
        return h('button', {
          onClick: function () { setStatusFilter(status); },
          className: 'px-4 py-2 rounded-full text-sm font-medium transition-all ' +
            (statusFilter === status
              ? 'bg-blue-100 text-blue-800 border-2 border-blue-500'
              : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50')
        }, label,
          status !== '全部' && statusCounts[status] > 0 && h('span', {
            className: 'ml-2 bg-blue-500 text-white text-xs py-0.5 px-2 rounded-full'
          }, statusCounts[status]));
      }

      return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h('div', { className: 'flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4' },
          h('div', { className: 'flex flex-wrap gap-2' },
            statusFilterBtn('全部', '全部'),
            PROCESS_STATUS_OPTIONS.map(function (status) { return statusFilterBtn(status, status); })
          ),
          h('button', {
            onClick: function () { setView('add'); },
            className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors',
            title: '新增叫修案件'
          }, Icons.Plus({ className: 'h-5 w-5' }))
        ),
        h('div', Object.assign({
          className: 'overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing'
        }, dragProps),
          h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap select-none' },
            h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
              h('tr', null,
                h('th', { className: 'p-3 font-semibold text-center w-32' }, '操作'),
                h('th', { className: 'p-3 font-semibold text-center' }, '燈號'),
                h('th', { className: 'p-3 font-semibold' }, '叫修日期'),
                h('th', { className: 'p-3 font-semibold' }, '案件編號'),
                h('th', { className: 'p-3 font-semibold' }, '客戶/門市名稱'),
                h('th', { className: 'p-3 font-semibold' }, '行政區域'),
                h('th', { className: 'p-3 font-semibold' }, '工項分類'),
                h('th', { className: 'p-3 font-semibold' }, '叫修項目/原因'),
                h('th', { className: 'p-3 font-semibold min-w-[200px]' }, '故障描述'),
                h('th', { className: 'p-3 font-semibold' }, '指派人員'),
                h('th', { className: 'p-3 font-semibold' }, '案件狀態')
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-100' },
              filteredCases.map(function (c) {
                return h('tr', { key: c.id, className: 'hover:bg-blue-50/50 transition-colors' },
                  h('td', { className: 'p-3' },
                    h('div', { className: 'flex items-center justify-center space-x-2' },
                      h('button', {
                        onClick: function () { setEditingCase(c); setView('edit'); },
                        className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded', title: '編輯'
                      }, Icons.Edit({ className: 'h-4 w-4' })),
                      h('button', {
                        onClick: function () { closeConfirmModal = { show: true, caseId: c.id }; rerender(); },
                        className: 'p-1.5 text-green-600 hover:bg-green-100 rounded', title: '結案'
                      }, Icons.CheckCircle({ className: 'h-4 w-4' })),
                      h('button', {
                        onClick: function () { handleCopyUrl(c.caseNumber); },
                        className: 'p-1.5 text-gray-500 hover:bg-gray-200 rounded', title: '複製URL'
                      }, Icons.Copy({ className: 'h-4 w-4' }))
                    )
                  ),
                  h('td', { className: 'p-3 text-center' },
                    h('div', { className: 'inline-block w-3 h-3 rounded-full ' + getIndicatorColor(c) })
                  ),
                  h('td', { className: 'p-3' }, c.repairDate),
                  h('td', { className: 'p-3 font-medium text-blue-700' }, c.caseNumber),
                  h('td', { className: 'p-3' },
                    h('div', null, c.customerName),
                    h('div', { className: 'text-xs text-gray-500' }, c.storeName)
                  ),
                  h('td', { className: 'p-3' }, c.district),
                  h('td', { className: 'p-3' },
                    h('span', {
                      className: 'px-2 py-1 rounded text-xs ' +
                        (c.workCategory === '緊急叫修' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700')
                    }, c.workCategory)
                  ),
                  h('td', { className: 'p-3' },
                    h('div', null, c.repairItem),
                    h('div', { className: 'text-xs text-gray-500' }, c.repairReason)
                  ),
                  h('td', { className: 'p-3 max-w-[200px] truncate', title: c.faultDesc }, c.faultDesc),
                  h('td', { className: 'p-3' }, c.assignee),
                  h('td', { className: 'p-3' },
                    h('span', {
                      className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200'
                    }, c.processStatus)
                  )
                );
              })
            )
          )
        ),
        closeConfirmModal.show && h('div', {
          className: 'fixed inset-0 bg-black/40 flex items-center justify-center z-50'
        },
          h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4' },
            h('div', { className: 'flex items-center space-x-3 text-yellow-600 mb-4' },
              Icons.AlertCircle({ className: 'h-6 w-6' }),
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '確認結案')
            ),
            h('p', { className: 'text-gray-600 mb-6' },
              '確定要將此案件標記為結案嗎？結案後狀態將更新並移至「案件銷案審核」列表。'),
            h('div', { className: 'flex justify-end space-x-3' },
              h('button', {
                onClick: function () { closeConfirmModal = { show: false, caseId: null }; rerender(); },
                className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
              }, '取消'),
              h('button', {
                onClick: function () { handleCloseCase(closeConfirmModal.caseId); },
                className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
              }, '確認結案')
            )
          )
        )
      );
    });
  }

  window.CaseList = CaseList;
})();
