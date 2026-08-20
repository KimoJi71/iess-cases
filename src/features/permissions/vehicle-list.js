/*
 * features/permissions/vehicle-list.js — 車輛管理：列表
 * props: { vehicles, setVehicles, cases, maintenanceCases, projectCases,
 *          setEditingCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var iconActionBtn = IESS.iconActionBtn;

  function renderEllipsisCell(value, extraClass) {
    var text = value == null || value === '' ? '—' : String(value);
    return h('td', { className: 'p-3 max-w-0 ' + (extraClass || '') },
      h('div', {
        className: 'truncate',
        title: text !== '—' ? text : undefined
      }, text)
    );
  }

  function VehicleList(props) {
    var vehicles = props.vehicles;
    var setVehicles = props.setVehicles;
    var cases = props.cases;
    var maintenanceCases = props.maintenanceCases;
    var projectCases = props.projectCases;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    var keyword = '';
    var appliedKeyword = '';
    var deleteModal = { show: false, id: null, plateNo: '' };
    var listPagination = IESS.createListPagination();

    function getFilteredVehicles() {
      var list = vehicles;
      if (appliedKeyword.trim()) {
        list = vehicles.filter(function (v) {
          return VehicleUtils.matchesKeyword(v, appliedKeyword);
        });
      }
      return list.slice().sort(function (a, b) {
        return new Date(b.createdDate) - new Date(a.createdDate);
      });
    }

    return stateful(function (rerender) {
      var filteredVehicles = getFilteredVehicles();
      var pageResult = listPagination.slice(filteredVehicles);

      function handleSearch() { appliedKeyword = keyword; listPagination.resetPage(); rerender(); }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }

      function handleDelete(id) {
        var target = vehicles.find(function (v) { return v.id === id; });
        if (!target) {
          deleteModal = { show: false, id: null, plateNo: '' };
          rerender();
          return;
        }
        if (VehicleUtils.hasOpenCasesForVehicle(
          target, cases, maintenanceCases, projectCases
        )) {
          showToast('此車輛仍有未結案案件，無法刪除', 'error');
          deleteModal = { show: false, id: null, plateNo: '' };
          rerender();
          return;
        }
        setVehicles(vehicles.filter(function (v) { return v.id !== id; }));
        deleteModal = { show: false, id: null, plateNo: '' };
        showToast('車輛已刪除');
      }

      return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h('div', { className: 'flex flex-col md:flex-row justify-between items-start mb-6 gap-4' },
          h('div', { className: 'bg-gray-50 p-4 rounded-lg border border-gray-200 flex-1' },
          h('div', { className: 'flex flex-wrap items-end gap-3' },
            h('div', { className: 'min-w-0' },
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '關鍵字'),
              h('input', {
                type: 'text',
                value: keyword,
                onChange: function (e) { keyword = e.target.value; rerender(); },
                onKeyDown: handleKeyDown,
                placeholder: '請輸入關鍵字',
                className: 'w-72 max-w-full p-2.5 border rounded-md outline-none bg-white'
              })
            ),
            h('button', {
              onClick: handleSearch,
              className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md shadow-sm transition-colors min-h-[42px]'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
          )),
          iconActionBtn({
            label: '新增車輛',
            className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors shrink-0',
            onClick: function () { setEditingCase(null); setView('vehicle-add'); },
            icon: Icons.Plus({ className: 'h-5 w-5' })
          })
        ),
        h('div', { className: 'overflow-x-auto border rounded-lg' },
          h('table', { className: 'w-full table-fixed text-left text-sm text-gray-600' },
            h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
              h('tr', null,
                h('th', { className: 'p-3 font-semibold text-center w-36' }, '操作'),
                h('th', { className: 'p-3 font-semibold w-40' }, '車號'),
                h('th', { className: 'p-3 font-semibold w-32' }, '負責人'),
                h('th', { className: 'p-3 font-semibold w-48' }, '車輛所有人'),
                h('th', { className: 'p-3 font-semibold' }, '公司')
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-100' },
              filteredVehicles.length === 0
                ? h('tr', null, h('td', { colspan: 5, className: 'p-10 text-center text-gray-400 text-base' }, '無資料'))
                : pageResult.items.map(function (v) {
                    return h('tr', { key: v.id, className: 'hover:bg-blue-50/50 transition-colors' },
                      h('td', { className: 'p-3 whitespace-nowrap' },
                        h('div', { className: 'flex items-center justify-center space-x-2' },
                          h('button', {
                            onClick: function () { setEditingCase(v); setView('vehicle-edit'); },
                            className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                            title: '編輯'
                          }, Icons.Edit({ className: 'h-4 w-4' })),
                          iconActionBtn({
                            label: '刪除',
                            onClick: function () {
                              deleteModal = { show: true, id: v.id, plateNo: v.plateNo };
                              rerender();
                            },
                            className: 'p-1.5 text-red-600 hover:bg-red-100 rounded',
                            icon: Icons.Trash2({ className: 'h-4 w-4' })
                          })
                        )
                      ),
                      renderEllipsisCell(v.plateNo, 'font-medium text-gray-800'),
                      renderEllipsisCell(v.personInCharge),
                      renderEllipsisCell(v.owner),
                      renderEllipsisCell(v.company)
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
              '確定要刪除車輛「' + deleteModal.plateNo + '」嗎？若仍有未結案案件則無法刪除。'),
            h('div', { className: 'flex justify-end space-x-3' },
              h('button', {
                onClick: function () { deleteModal = { show: false, id: null, plateNo: '' }; rerender(); },
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

  window.VehicleList = VehicleList;
})();
