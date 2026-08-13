/*
 * features/repair/case-list.js — 案件處理：案件列表（未結案）
 * props: { cases, setCases, stores, setStores, setEditingCase, setView, showToast, statusFilter, setStatusFilter }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var caseStatus = IESS.caseStatus;

  function formatCreatedAt(c) {
    return IESS.caseDateTime.format(c.createdAt || c.repairDate);
  }

  function formatExpectedDate(c) {
    return c.expectedDate || c.planDate || '—';
  }

  function formatExpectedTime(c) {
    var start = c.expectedTimeStart || c.planTimeStart;
    var end = c.expectedTimeEnd || c.planTimeEnd;
    if (!start) return '—';
    return end && end !== start ? start + ' ~ ' + end : start;
  }

  function iconActionBtn(opts) {
    return IESS.iconActionBtn(opts);
  }

  function CaseList(props) {
    var cases = props.cases;
    var setCases = props.setCases;
    var stores = props.stores;
    var setStores = props.setStores;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;
    var statusFilter = props.statusFilter;
    var setStatusFilter = props.setStatusFilter;

    var closeConfirmModal = { show: false, caseId: null, mode: 'close' };
    var listPagination = IESS.createListPagination();

    function isActiveInList(c) {
      if (!c.isClosed) return true;
      return caseStatus.isTransferStatus(c.processStatus) && c.isListClosed;
    }

    function getFiltered() {
      return cases.filter(function (c) {
        if (!isActiveInList(c)) return false;
        if (statusFilter === '未處理') return !c.processStatus;
        return c.processStatus === statusFilter;
      }).sort(function (a, b) {
        return new Date(b.createdAt || b.repairDate) - new Date(a.createdAt || a.repairDate);
      });
    }

    function getStatusCounts() {
      return cases.filter(isActiveInList).reduce(function (acc, c) {
        var key = c.processStatus || '未處理';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    }

    function handleCopyUrl(caseNumber) {
      navigator.clipboard.writeText('https://system.jinchuan.com/case/' + caseNumber);
      showToast('已複製 ' + caseNumber + ' 案件連結');
    }

    function updateStoreLastRepairDate(targetCase) {
      if (!setStores || !stores || !targetCase) return;
      var stamp = IESS.caseDateTime.now();
      setStores(stores.map(function (s) {
        return s.customerName === targetCase.customerName && s.storeName === targetCase.storeName
          ? Object.assign({}, s, { lastRepairDate: stamp })
          : s;
      }));
    }

    function handleCloseCase(caseId) {
      var target = cases.find(function (c) { return c.id === caseId; });
      if (!target) return;

      updateStoreLastRepairDate(target);
      var stamp = IESS.caseDateTime.now();

      if (caseStatus.isTransferStatus(target.processStatus)) {
        setCases(cases.map(function (c) {
          if (c.id !== caseId) return c;
          return Object.assign({}, c, {
            isClosed: true,
            isListClosed: true,
            closeDate: stamp
          });
        }));
        showToast('案件已結案，並移至「案件銷案審核」列表，請完成後點選「' +
          caseStatus.getInterimCompleteLabel(target.processStatus) + '」');
        return;
      }

      setCases(cases.map(function (c) {
        if (c.id !== caseId) return c;
        return Object.assign({}, c, {
          isClosed: true,
          closeDate: stamp
        });
      }));
      showToast('案件已結案，並移至「案件銷案審核」列表');
    }

    function handleInterimComplete(caseId) {
      setCases(cases.map(function (c) {
        if (c.id !== caseId) return c;
        return Object.assign({}, c, { isListClosed: false });
      }));
      showToast('案件已完成，已自案件處理列表移除');
    }

    function getIndicatorColor(c) {
      return caseStatus.getCaseListIndicatorClass(c);
    }

    function renderRowActions(c, rerender) {
      var actions = [
        iconActionBtn({
          label: '編輯',
          className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
          onClick: function () { setEditingCase(c); setView('edit'); },
          icon: Icons.Edit({ className: 'h-4 w-4' })
        })
      ];

      if (caseStatus.showsCaseCloseButton(c)) {
        actions.push(iconActionBtn({
          label: '案件結案',
          className: 'p-1.5 text-green-600 hover:bg-green-100 rounded',
          onClick: function () {
            closeConfirmModal = { show: true, caseId: c.id, mode: 'close' };
            rerender();
          },
          icon: Icons.CheckCircle({ className: 'h-4 w-4' })
        }));
      }

      if (caseStatus.showsInterimCompleteButton(c)) {
        var completeLabel = caseStatus.getInterimCompleteLabel(c.processStatus);
        actions.push(iconActionBtn({
          label: completeLabel,
          className: 'p-1.5 text-indigo-600 hover:bg-indigo-100 rounded',
          onClick: function () {
            closeConfirmModal = { show: true, caseId: c.id, mode: 'complete' };
            rerender();
          },
          icon: Icons.CheckCircle({ className: 'h-4 w-4' })
        }));
      }

      actions.push(iconActionBtn({
        label: '複製URL',
        className: 'p-1.5 text-gray-500 hover:bg-gray-200 rounded',
        onClick: function () { handleCopyUrl(c.caseNumber); },
        icon: Icons.Copy({ className: 'h-4 w-4' })
      }));

      return actions;
    }

    return stateful(function (rerender) {
      var filteredCases = getFiltered();
      var pageResult = listPagination.slice(filteredCases);
      var statusCounts = getStatusCounts();
      var modalCase = closeConfirmModal.show
        ? cases.find(function (c) { return c.id === closeConfirmModal.caseId; })
        : null;

      function statusFilterBtn(status, label) {
        return h('button', {
          onClick: function () { setStatusFilter(status); },
          className: 'px-4 py-2 rounded-full text-sm font-medium transition-all ' +
            (statusFilter === status
              ? 'bg-blue-100 text-blue-800 border-2 border-blue-500'
              : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50')
        }, label,
          statusCounts[status] > 0 && h('span', {
            className: 'ml-2 bg-blue-500 text-white text-xs py-0.5 px-2 rounded-full'
          }, statusCounts[status]));
      }

      return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h('div', { className: 'flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4' },
          h('div', { className: 'flex flex-wrap gap-2' },
            CASE_LIST_STATUS_FILTERS.map(function (status) { return statusFilterBtn(status, status); })
          ),
          iconActionBtn({
            label: '新增叫修案件',
            className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors',
            onClick: function () { setView('add'); },
            icon: Icons.Plus({ className: 'h-5 w-5' })
          })
        ),
        h('div', {
          className: 'overflow-x-auto border rounded-lg table-scroll-hint'
        },
          h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap' },
            h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
              h('tr', null,
                h('th', { className: 'p-3 font-semibold text-center min-w-[140px]' }, '操作'),
                h('th', { className: 'p-3 font-semibold text-center' }, '燈號'),
                h('th', { className: 'p-3 font-semibold' }, '案件狀態'),
                h('th', { className: 'p-3 font-semibold' }, '客戶名稱'),
                h('th', { className: 'p-3 font-semibold' }, '門市名稱'),
                h('th', { className: 'p-3 font-semibold' }, '工項分類'),
                h('th', { className: 'p-3 font-semibold' }, '案件編號'),
                h('th', { className: 'p-3 font-semibold' }, '建立日期'),
                h('th', { className: 'p-3 font-semibold' }, '行政區域'),
                h('th', { className: 'p-3 font-semibold' }, '叫修項目'),
                h('th', { className: 'p-3 font-semibold' }, '叫修原因'),
                h('th', { className: 'p-3 font-semibold min-w-[200px]' }, '故障描述'),
                h('th', { className: 'p-3 font-semibold min-w-[150px]' }, '實際原因'),
                h('th', { className: 'p-3 font-semibold' }, '組別'),
                h('th', { className: 'p-3 font-semibold' }, '預計日期'),
                h('th', { className: 'p-3 font-semibold' }, '預計時間'),
                h('th', { className: 'p-3 font-semibold' }, '退回原因')
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-100' },
              pageResult.items.length === 0
                ? h('tr', null, h('td', { colspan: 17, className: 'p-10 text-center text-gray-400 text-base' }, '無資料'))
                : pageResult.items.map(function (c) {
                var isOther = c.workCategory === '其他';
                return h('tr', { key: c.id, className: 'hover:bg-blue-50/50 transition-colors' },
                  h('td', { className: 'p-3' },
                    h('div', { className: 'flex items-center justify-center flex-wrap gap-1' },
                      renderRowActions(c, rerender)
                    )
                  ),
                  h('td', { className: 'p-3 text-center' },
                    h('div', { className: 'inline-block w-3 h-3 rounded-full ' + getIndicatorColor(c) })
                  ),
                  h('td', { className: 'p-3' },
                    (function () {
                      var dispatchStatus = caseStatus.getCaseListDispatchStatus(c);
                      return h('span', {
                        className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ' +
                          caseStatus.getCaseListDispatchBadgeClass(dispatchStatus)
                      }, dispatchStatus);
                    })()
                  ),
                  h('td', { className: 'p-3' }, c.customerName),
                  h('td', { className: 'p-3' }, c.storeName),
                  h('td', { className: 'p-3' },
                    h('span', {
                      className: 'px-2 py-1 rounded text-xs ' +
                        (c.workCategory === '緊急叫修' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700')
                    }, c.workCategory)
                  ),
                  h('td', { className: 'p-3 font-medium text-blue-700' }, c.caseNumber),
                  h('td', { className: 'p-3' }, formatCreatedAt(c)),
                  h('td', { className: 'p-3' }, StoreUtils.getRecordArea(c) || '—'),
                  h('td', { className: 'p-3' }, isOther ? '' : (c.repairItem || '—')),
                  h('td', { className: 'p-3' }, isOther ? '' : (c.repairReason || '—')),
                  h('td', { className: 'p-3 max-w-[200px] truncate', title: c.faultDesc }, c.faultDesc),
                  h('td', {
                    className: 'p-3 max-w-[150px] truncate',
                    title: c.actualReason || ''
                  }, c.actualReason || '—'),
                  h('td', { className: 'p-3' }, CaseAssigneeUtils.formatAssignees(c)),
                  h('td', { className: 'p-3' }, formatExpectedDate(c)),
                  h('td', { className: 'p-3' }, formatExpectedTime(c)),
                  h('td', {
                    className: 'p-3 max-w-[150px] truncate',
                    title: c.returnReason ? ((c.returnedAt ? c.returnedAt + ' ' : '') + c.returnReason) : ''
                  }, c.returnReason || '—')
                );
              })
            )
          )
        ),
        listPagination.renderBar(pageResult, rerender),
        closeConfirmModal.show && h('div', {
          className: 'app-modal-overlay'
        },
          h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4' },
            h('div', { className: 'flex items-center space-x-3 text-yellow-600 mb-4' },
              Icons.AlertCircle({ className: 'h-6 w-6' }),
              h('h3', { className: 'text-lg font-bold text-gray-800' },
                closeConfirmModal.mode === 'complete' && modalCase
                  ? '確認' + caseStatus.getInterimCompleteLabel(modalCase.processStatus)
                  : '確認結案'
              )
            ),
            h('p', { className: 'text-gray-600 mb-6' },
              closeConfirmModal.mode === 'complete'
                ? '確定要標記為已完成嗎？完成後將自案件處理列表移除（仍保留於案件銷案審核）。'
                : modalCase && caseStatus.isTransferStatus(modalCase.processStatus)
                  ? '確定要將此案件結案嗎？結案後將同步移至「案件銷案審核」列表，並保留於本列表，待完成後請點選對應完成按鈕。'
                  : '確定要將此案件結案嗎？結案後將移至「案件銷案審核」列表。'
            ),
            h('div', { className: 'flex justify-end space-x-3' },
              h('button', {
                onClick: function () { closeConfirmModal = { show: false, caseId: null, mode: 'close' }; rerender(); },
                className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
              }, '取消'),
              h('button', {
                onClick: function () {
                  if (closeConfirmModal.mode === 'complete') {
                    handleInterimComplete(closeConfirmModal.caseId);
                  } else {
                    handleCloseCase(closeConfirmModal.caseId);
                  }
                  closeConfirmModal = { show: false, caseId: null, mode: 'close' };
                  rerender();
                },
                className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
              }, '確認')
            )
          )
        )
      );
    });
  }

  window.CaseList = CaseList;
})();
