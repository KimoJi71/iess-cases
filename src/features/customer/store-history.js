/*
 * features/customer/store-history.js — 客戶建檔（門市管理）：門市歷史紀錄（整頁）
 * props: { store, cases, maintenanceCases, projectCases, equipments, openStoreHistoryDetail, setHistoryStore, setView, backView, clearCustomerBackView }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll;
  var fmt = StoreUtils.formatHistoryDateTime;

  function StoreHistory(props) {
    var store = props.store;
    var cases = props.cases || [];
    var maintenanceCases = props.maintenanceCases || [];
    var projectCases = props.projectCases || [];
    var equipments = props.equipments || [];
    var openStoreHistoryDetail = props.openStoreHistoryDetail;
    var setHistoryStore = props.setHistoryStore;
    var setView = props.setView;
    var backView = props.backView === undefined ? 'store-list' : props.backView;
    var clearCustomerBackView = props.clearCustomerBackView;

    var caseType = 'repair-maintenance';
    var startDate = todayDate;
    var endDate = todayDate;
    var keyword = '';
    var appliedFilter = { caseType: 'repair-maintenance', start: todayDate, end: todayDate, keyword: '' };
    var dragProps = useDragScroll();

    function getRows() {
      if (!store) return [];
      if (appliedFilter.caseType === 'project') {
        return StoreUtils.buildProjectHistoryRows(store, projectCases);
      }
      return StoreUtils.buildRepairMaintenanceHistoryRows(store, cases, maintenanceCases, equipments);
    }

    function getFilteredRows() {
      var kw = appliedFilter.keyword.trim().toLowerCase();
      return getRows().filter(function (rec) {
        if (appliedFilter.start && (rec.sortDate || '') < appliedFilter.start) return false;
        if (appliedFilter.end && (rec.sortDate || '') > appliedFilter.end) return false;
        if (!kw) return true;
        if (appliedFilter.caseType === 'project') {
          return [rec.caseNumber, rec.storeName, rec.workCategory, rec.assignee]
            .filter(Boolean)
            .some(function (v) { return String(v).toLowerCase().includes(kw); });
        }
        return [rec.caseNumber, rec.storeName, rec.workCategory, rec.equipmentCategory, rec.equipmentName,
          rec.equipmentArea, rec.repairItem, rec.repairReason, rec.assignee]
          .filter(Boolean)
          .some(function (v) { return String(v).toLowerCase().includes(kw); });
      });
    }

    function goBack() {
      setHistoryStore(null);
      if (clearCustomerBackView) clearCustomerBackView();
      setView(backView);
    }

    function findSourceCase(rec) {
      if (rec.sourceType === 'repair') {
        return cases.find(function (c) { return c.id === rec.sourceId; });
      }
      if (rec.sourceType === 'maintenance') {
        return maintenanceCases.find(function (c) { return c.id === rec.sourceId; });
      }
      if (rec.sourceType === 'project') {
        return projectCases.find(function (c) { return c.id === rec.sourceId; });
      }
      return null;
    }

    function handleView(rec) {
      var sourceCase = findSourceCase(rec);
      if (!sourceCase) return;
      if (rec.sourceType === 'project') {
        openStoreHistoryDetail('store-history-project-view', sourceCase);
        return;
      }
      openStoreHistoryDetail(
        rec.sourceType === 'maintenance' ? 'store-history-maintenance-view' : 'store-history-repair-view',
        sourceCase
      );
    }

    function viewBtn(rec) {
      return h('td', { className: 'p-3 text-center' },
        h('button', {
          type: 'button',
          onClick: function () { handleView(rec); },
          className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
          title: '查看明細'
        }, Icons.Eye({ className: 'h-4 w-4' }))
      );
    }

    function cell(text, opts) {
      opts = opts || {};
      var display = text === '' || text == null ? '—' : text;
      return h('td', {
        className: 'p-3' + (opts.pre ? ' whitespace-pre-line' : ''),
        title: opts.title || (typeof text === 'string' && text ? text : '')
      }, opts.blank ? (text || '') : display);
    }

    return stateful(function (rerender) {
      var rows = getFilteredRows();
      var isProject = appliedFilter.caseType === 'project';

      function handleSearch() {
        appliedFilter = { caseType: caseType, start: startDate, end: endDate, keyword: keyword };
        rerender();
      }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }
      function switchCaseType(nextType) {
        caseType = nextType;
        appliedFilter = Object.assign({}, appliedFilter, { caseType: nextType });
        rerender();
      }

      function caseTypeFilterBtn(type, label) {
        return h('button', {
          type: 'button',
          onClick: function () { switchCaseType(type); },
          className: 'px-4 py-2 rounded-full text-sm font-medium transition-all ' +
            (caseType === type
              ? 'bg-blue-100 text-blue-800 border-2 border-blue-500'
              : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50')
        }, label);
      }

      return h('div', { className: 'bg-white rounded-lg shadow-sm border border-gray-100' },
        PageHeader({
          title: '歷史紀錄',
          badge: store ? (store.customerName + ' / ' + store.storeName) : null,
          onClose: goBack,
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200'
        }),
        h('div', { className: 'p-6' },
          h('div', { className: 'flex flex-col gap-3 mb-6 pb-6 border-b' },
            h('div', { className: 'flex flex-wrap gap-2' },
              caseTypeFilterBtn('repair-maintenance', '叫修 / 保養'),
              caseTypeFilterBtn('project', '工程')
            ),
            h('div', { className: 'flex flex-wrap items-end gap-3' },
            h('div', null,
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '開始日期'),
              h('input', {
                type: 'date',
                value: startDate,
                max: endDate || undefined,
                onChange: function (e) { startDate = e.target.value; rerender(); },
                className: 'p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '結束日期'),
              h('input', {
                type: 'date',
                value: endDate,
                min: startDate || undefined,
                onChange: function (e) { endDate = e.target.value; rerender(); },
                className: 'p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '關鍵字'),
              h('input', {
                type: 'text',
                value: keyword,
                onChange: function (e) { keyword = e.target.value; rerender(); },
                onKeyDown: handleKeyDown,
                placeholder: isProject ? '案件編號 / 工項 / 負責人員' : '案件編號 / 設備 / 叫修項目 / 維修人員',
                className: 'w-64 p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
              })
            ),
            h('button', {
              onClick: handleSearch,
              className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
            )
          ),
          h('div', Object.assign({}, dragProps, {
            className: 'overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing'
          }),
            h('table', { className: 'w-full text-left text-sm text-gray-600 select-none' },
              h('thead', { className: 'bg-gray-50 text-gray-700 border-b whitespace-nowrap' },
                isProject
                  ? h('tr', null,
                      h('th', { className: 'p-3 w-20 text-center font-semibold' }, '操作'),
                      h('th', { className: 'p-3 font-semibold' }, '案件編號'),
                      h('th', { className: 'p-3 font-semibold' }, '門市名稱'),
                      h('th', { className: 'p-3 font-semibold' }, '工項分類'),
                      h('th', { className: 'p-3 font-semibold' }, '負責人員'),
                      h('th', { className: 'p-3 font-semibold' }, '立案時間'),
                      h('th', { className: 'p-3 font-semibold' }, '完成時間')
                    )
                  : h('tr', null,
                      h('th', { className: 'p-3 w-20 text-center font-semibold' }, '操作'),
                      h('th', { className: 'p-3 font-semibold' }, '案件編號'),
                      h('th', { className: 'p-3 font-semibold' }, '門市名稱'),
                      h('th', { className: 'p-3 font-semibold' }, '工項分類'),
                      h('th', { className: 'p-3 font-semibold' }, '設備分類'),
                      h('th', { className: 'p-3 font-semibold' }, '設備名稱'),
                      h('th', { className: 'p-3 font-semibold' }, '設備區域'),
                      h('th', { className: 'p-3 font-semibold' }, '叫修項目'),
                      h('th', { className: 'p-3 font-semibold' }, '叫修原因'),
                      h('th', { className: 'p-3 font-semibold' }, '維修人員'),
                      h('th', { className: 'p-3 font-semibold' }, '立案時間'),
                      h('th', { className: 'p-3 font-semibold' }, '完成時間')
                    )
              ),
              h('tbody', { className: 'divide-y divide-gray-100 whitespace-nowrap' },
                rows.length === 0
                  ? h('tr', null, h('td', {
                      colspan: isProject ? 7 : 12,
                      className: 'p-10 text-center text-gray-400 text-base'
                    }, '無資料'))
                  : rows.map(function (rec) {
                      if (isProject) {
                        return h('tr', { key: rec.id, className: 'hover:bg-blue-50/50 transition-colors' },
                          viewBtn(rec),
                          cell(rec.caseNumber),
                          cell(rec.storeName),
                          cell(rec.workCategory),
                          cell(rec.assignee),
                          cell(fmt(rec.filingTime)),
                          cell(fmt(rec.finishTime))
                        );
                      }
                      return h('tr', { key: rec.id, className: 'hover:bg-blue-50/50 transition-colors' },
                        viewBtn(rec),
                        cell(rec.caseNumber),
                        cell(rec.storeName),
                        cell(rec.workCategory),
                        cell(rec.equipmentCategory),
                        cell(rec.equipmentName, { title: rec.equipmentName }),
                        cell(rec.equipmentArea),
                        cell(rec.repairItem, { blank: true }),
                        cell(rec.repairReason, { blank: true }),
                        cell(rec.assignee),
                        cell(fmt(rec.filingTime)),
                        cell(fmt(rec.finishTime))
                      );
                    })
              )
            )
          )
        )
      );
    });
  }

  window.StoreHistory = StoreHistory;
})();
