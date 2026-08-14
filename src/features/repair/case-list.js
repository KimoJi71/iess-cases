/*
 * features/repair/case-list.js — 案件處理：案件列表（未結案）
 * props: { cases, setCases, stores, setStores, customers, setEditingCase, setView, showToast, statusFilter, setStatusFilter }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var caseStatus = IESS.caseStatus;
  var ALL_STATUS = '全部';

  // 關鍵字／燈號排序置於模組層，避免上層（狀態篩選）重繪時被清空
  var keyword = '';
  var appliedKeyword = '';
  var indicatorSortDir = 0;

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
    var customers = props.customers;
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

    function matchStatus(c) {
      if (statusFilter === ALL_STATUS) return true;
      if (statusFilter === '未處理') return !c.processStatus;
      return c.processStatus === statusFilter;
    }

    function getFiltered() {
      var kw = appliedKeyword.trim().toLowerCase();
      return cases.filter(function (c) {
        if (!isActiveInList(c)) return false;
        if (!matchStatus(c)) return false;
        return matchKeyword(c, kw);
      }).sort(function (a, b) {
        if (indicatorSortDir) {
          var diff = (caseStatus.getCaseListIndicatorRank(a, customers)
            - caseStatus.getCaseListIndicatorRank(b, customers)) * indicatorSortDir;
          if (diff) return diff;
        }
        return new Date(b.createdAt || b.repairDate) - new Date(a.createdAt || a.repairDate);
      });
    }

    function getStatusCounts() {
      var kw = appliedKeyword.trim().toLowerCase();
      return cases.filter(function (c) {
        return isActiveInList(c) && matchKeyword(c, kw);
      }).reduce(function (acc, c) {
        var key = c.processStatus || '未處理';
        acc[key] = (acc[key] || 0) + 1;
        acc[ALL_STATUS] = (acc[ALL_STATUS] || 0) + 1;
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
      return caseStatus.getCaseListIndicatorClass(c, customers);
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
          onClick: function () { listPagination.resetPage(); setStatusFilter(status); },
          className: 'px-4 py-2 rounded-full text-sm font-medium transition-all ' +
            (statusFilter === status
              ? 'bg-blue-100 text-blue-800 border-2 border-blue-500'
              : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50')
        }, label,
          statusCounts[status] > 0 && h('span', {
            className: 'ml-2 bg-blue-500 text-white text-xs py-0.5 px-2 rounded-full'
          }, statusCounts[status]));
      }

      function handleSearch() { appliedKeyword = keyword; listPagination.resetPage(); rerender(); }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }

      return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h('div', { className: 'flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4' },
          h('div', { className: 'flex flex-col gap-3' },
            h('div', { className: 'flex flex-wrap gap-2' },
              [ALL_STATUS].concat(CASE_LIST_STATUS_FILTERS).map(function (status) {
                return statusFilterBtn(status, status);
              })
            ),
            h('div', { className: 'flex flex-wrap items-end gap-3' },
              h('div', null,
                h('input', {
                  type: 'text',
                  value: keyword,
                  onChange: function (e) { keyword = e.target.value; rerender(); },
                  onKeyDown: handleKeyDown,
                  placeholder: '請輸入關鍵字',
                  className: 'w-80 max-w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
                })
              ),
              h('button', {
                onClick: handleSearch,
                className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors'
              }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋'),
              !!appliedKeyword && h('button', {
                onClick: function () {
                  keyword = '';
                  appliedKeyword = '';
                  listPagination.resetPage();
                  rerender();
                },
                className: 'px-4 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
              }, '清除')
            )
          ),
          iconActionBtn({
            label: '新增叫修案件',
            className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors shrink-0',
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
                h('th', {
                  className: 'p-3 font-semibold text-center cursor-pointer select-none hover:bg-gray-100',
                  title: '依燈號排序',
                  'aria-sort': indicatorSortDir === 1 ? 'ascending'
                    : indicatorSortDir === -1 ? 'descending' : 'none',
                  onClick: function () {
                    indicatorSortDir = indicatorSortDir === 1 ? -1 : 1;
                    listPagination.resetPage();
                    rerender();
                  }
                },
                  h('span', { className: 'inline-flex items-center justify-center gap-0.5' },
                    '燈號',
                    Icons.ChevronDown({
                      className: 'h-3.5 w-3.5' +
                        (indicatorSortDir === -1 ? ' rotate-180' : '') +
                        (indicatorSortDir === 0 ? ' opacity-40' : '')
                    })
                  )
                ),
                h('th', { className: 'p-3 font-semibold' }, '案件狀態'),
                h('th', { className: 'p-3 font-semibold' }, '客戶名稱'),
                h('th', { className: 'p-3 font-semibold' }, '門市名稱'),
                h('th', { className: 'p-3 font-semibold' }, '工項分類'),
                h('th', { className: 'p-3 font-semibold' }, '案件編號'),
                h('th', { className: 'p-3 font-semibold' }, '叫修日期'),
                h('th', { className: 'p-3 font-semibold' }, '行政區域'),
                h('th', { className: 'p-3 font-semibold' }, '叫修項目'),
                h('th', { className: 'p-3 font-semibold' }, '叫修原因'),
                h('th', { className: 'p-3 font-semibold min-w-[200px]' }, '故障描述'),
                h('th', { className: 'p-3 font-semibold min-w-[150px]' }, '實際原因'),
                h('th', { className: 'p-3 font-semibold' }, '組別'),
                h('th', { className: 'p-3 font-semibold' }, '指派人員'),
                h('th', { className: 'p-3 font-semibold' }, '預計日期'),
                h('th', { className: 'p-3 font-semibold' }, '預計時間'),
                h('th', { className: 'p-3 font-semibold' }, '退回原因')
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-100' },
              pageResult.items.length === 0
                ? h('tr', null, h('td', { colspan: 18, className: 'p-10 text-center text-gray-400 text-base' }, '無資料'))
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
                  h('td', { className: 'p-3' }, CaseAssigneeUtils.formatAssigneeMembers(c) || '—'),
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
