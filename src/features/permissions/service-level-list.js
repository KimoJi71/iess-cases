/*
 * features/permissions/service-level-list.js — 服務等級管理：列表
 * props: { serviceLevels, setServiceLevels, customers, stores, cases, maintenanceCases,
 *          projectCases, surveyCases, personnelStatus, setEditingCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var iconActionBtn = IESS.iconActionBtn;

  var COLUMNS = [
    { key: 'name', label: '服務等級名稱' },
    { key: 'maintenanceCount', label: '每年保養次數' },
    { key: 'countsBonusPoints', label: '是否計算增額積分' }
  ];

  function renderCellText(record, key) {
    if (key === 'countsBonusPoints') return record.countsBonusPoints ? '是' : '否';
    if (key === 'maintenanceCount') return String(Number(record.maintenanceCount) || 0);
    return record.name || '—';
  }

  function ServiceLevelList(props) {
    var serviceLevels = props.serviceLevels || [];
    var setServiceLevels = props.setServiceLevels;
    var customers = props.customers || [];
    var stores = props.stores || [];
    var cases = props.cases || [];
    var maintenanceCases = props.maintenanceCases || [];
    var projectCases = props.projectCases || [];
    var surveyCases = props.surveyCases || [];
    var personnelStatus = props.personnelStatus || [];
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    var keyword = '';
    var appliedKeyword = '';
    var deleteModal = { show: false, id: null, label: '' };
    var listPagination = IESS.createListPagination();

    function getFilteredLevels() {
      var kw = appliedKeyword.trim().toLowerCase();
      if (!kw) return serviceLevels.slice();
      return serviceLevels.filter(function (sl) {
        return String(sl.name || '').toLowerCase().includes(kw);
      });
    }

    return stateful(function (rerender) {
      var filteredLevels = getFilteredLevels();
      var pageResult = listPagination.slice(filteredLevels);

      function handleSearch() { appliedKeyword = keyword; listPagination.resetPage(); rerender(); }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }

      function handleDelete(id) {
        var target = serviceLevels.find(function (sl) { return sl.id === id; });
        if (!target) {
          deleteModal = { show: false, id: null, label: '' };
          rerender();
          return;
        }
        if (ServiceLevelUtils.isServiceLevelInUse(target.name, {
          customers: customers,
          stores: stores,
          cases: cases,
          maintenanceCases: maintenanceCases,
          projectCases: projectCases,
          surveyCases: surveyCases,
          personnelStatus: personnelStatus
        })) {
          showToast('此服務等級已被客戶或門市使用，無法刪除', 'error');
          deleteModal = { show: false, id: null, label: '' };
          rerender();
          return;
        }
        setServiceLevels(serviceLevels.filter(function (sl) { return sl.id !== id; }));
        deleteModal = { show: false, id: null, label: '' };
        showToast('服務等級已刪除');
      }

      return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h('div', { className: 'flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4' },
          h('div', { className: 'flex flex-wrap items-end gap-3' },
            h('div', null,
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '關鍵字'),
              h('input', {
                type: 'text',
                value: keyword,
                onChange: function (e) { keyword = e.target.value; rerender(); },
                onKeyDown: handleKeyDown,
                placeholder: '服務等級名稱…',
                className: 'w-64 p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('button', {
              onClick: handleSearch,
              className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
          ),
          iconActionBtn({
            label: '新增服務等級',
            className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors shrink-0',
            onClick: function () { setEditingCase(null); setView('service-level-add'); },
            icon: Icons.Plus({ className: 'h-5 w-5' })
          })
        ),
        h('div', {
          className: 'overflow-x-auto border rounded-lg'
        },
          h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap' },
            h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
              h('tr', null,
                h('th', { className: 'p-3 font-semibold text-center w-36' }, '操作'),
                COLUMNS.map(function (col) {
                  return h('th', { key: col.key, className: 'p-3 font-semibold' }, col.label);
                })
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-100' },
              filteredLevels.length === 0
                ? h('tr', null, h('td', { colspan: COLUMNS.length + 1, className: 'p-10 text-center text-gray-400 text-base' }, '無資料'))
                : pageResult.items.map(function (sl) {
                    return h('tr', { key: sl.id, className: 'hover:bg-blue-50/50 transition-colors' },
                      h('td', { className: 'p-3' },
                        h('div', { className: 'flex items-center justify-center space-x-2' },
                          h('button', {
                            onClick: function () { setEditingCase(sl); setView('service-level-edit'); },
                            className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                            title: '編輯'
                          }, Icons.Edit({ className: 'h-4 w-4' })),
                          iconActionBtn({
                            label: '刪除',
                            onClick: function () {
                              deleteModal = { show: true, id: sl.id, label: sl.name };
                              rerender();
                            },
                            className: 'p-1.5 text-red-600 hover:bg-red-100 rounded',
                            icon: Icons.Trash2({ className: 'h-4 w-4' })
                          })
                        )
                      ),
                      COLUMNS.map(function (col) {
                        return h('td', { key: col.key, className: 'p-3 font-medium text-gray-800' },
                          renderCellText(sl, col.key));
                      })
                    );
                  })
            )
          )
        ),
        listPagination.renderBar(pageResult, rerender),
        deleteModal.show && h('div', { className: 'app-modal-overlay' },
          h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4' },
            h('div', { className: 'flex items-center space-x-3 text-red-600 mb-4' },
              Icons.AlertCircle({ className: 'h-6 w-6' }),
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '確認刪除')
            ),
            h('p', { className: 'text-gray-600 mb-6' },
              '確定要刪除服務等級「' + deleteModal.label + '」嗎？若已被客戶或門市使用則無法刪除。'),
            h('div', { className: 'flex justify-end space-x-3' },
              h('button', {
                onClick: function () { deleteModal = { show: false, id: null, label: '' }; rerender(); },
                className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
              }, '取消'),
              h('button', {
                onClick: function () { handleDelete(deleteModal.id); },
                className: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors'
              }, '確認刪除')
            )
          )
        )
      );
    });
  }

  window.ServiceLevelList = ServiceLevelList;
})();
