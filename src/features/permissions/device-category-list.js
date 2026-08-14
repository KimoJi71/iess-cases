/*
 * features/permissions/device-category-list.js — 設備分類管理：列表
 * props: { deviceCategories, setDeviceCategories, equipments, setEditingCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var iconActionBtn = IESS.iconActionBtn;

  var COLUMNS = [
    { key: 'category', label: '設備分類' },
    { key: 'brand', label: '品牌' },
    { key: 'deviceName', label: '設備名稱' },
    { key: 'specification', label: '設備規格' },
    { key: 'model', label: '型號' },
    { key: 'refrigerant', label: '冷媒' },
    { key: 'powerSource', label: '電源' }
  ];

  function DeviceCategoryList(props) {
    var deviceCategories = props.deviceCategories;
    var setDeviceCategories = props.setDeviceCategories;
    var equipments = props.equipments;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    var keyword = '';
    var appliedKeyword = '';
    var deleteModal = { show: false, id: null, label: '' };
    var listPagination = IESS.createListPagination();

    function getFilteredCategories() {
      var kw = appliedKeyword.trim().toLowerCase();
      var list = deviceCategories;
      if (kw) {
        list = deviceCategories.filter(function (dc) {
          return COLUMNS.some(function (col) {
            return String(dc[col.key] || '').toLowerCase().includes(kw);
          });
        });
      }
      return list.slice().sort(function (a, b) {
        var aKey = [a.category, a.brand, a.model].join('\0');
        var bKey = [b.category, b.brand, b.model].join('\0');
        return aKey.localeCompare(bKey, 'zh-Hant');
      });
    }

    return stateful(function (rerender) {
      var filteredCategories = getFilteredCategories();
      var pageResult = listPagination.slice(filteredCategories);

      function handleSearch() { appliedKeyword = keyword; listPagination.resetPage(); rerender(); }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }

      function handleDelete(id) {
        var target = deviceCategories.find(function (dc) { return dc.id === id; });
        if (!target) {
          deleteModal = { show: false, id: null, label: '' };
          rerender();
          return;
        }
        if (DeviceCategoryUtils.isDeviceCategoryInUse(target.model, equipments)) {
          showToast('此設備分類已被設備資料使用，無法刪除', 'error');
          deleteModal = { show: false, id: null, label: '' };
          rerender();
          return;
        }
        setDeviceCategories(deviceCategories.filter(function (dc) { return dc.id !== id; }));
        deleteModal = { show: false, id: null, label: '' };
        showToast('設備分類已刪除');
      }

      return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h('div', { className: 'flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4' },
          h('div', { className: 'flex flex-wrap items-end gap-3' },
            h('div', null,
              h('input', {
                type: 'text',
                value: keyword,
                onChange: function (e) { keyword = e.target.value; rerender(); },
                onKeyDown: handleKeyDown,
                placeholder: '請輸入關鍵字',
                className: 'w-64 p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('button', {
              onClick: handleSearch,
              className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
          ),
          iconActionBtn({
            label: '新增設備分類',
            className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors shrink-0',
            onClick: function () { setEditingCase(null); setView('device-category-add'); },
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
              filteredCategories.length === 0
                ? h('tr', null, h('td', { colspan: COLUMNS.length + 1, className: 'p-10 text-center text-gray-400 text-base' }, '無資料'))
                : pageResult.items.map(function (dc) {
                    return h('tr', { key: dc.id, className: 'hover:bg-blue-50/50 transition-colors' },
                      h('td', { className: 'p-3' },
                        h('div', { className: 'flex items-center justify-center space-x-2' },
                          h('button', {
                            onClick: function () { setEditingCase(dc); setView('device-category-edit'); },
                            className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                            title: '編輯'
                          }, Icons.Edit({ className: 'h-4 w-4' })),
                          iconActionBtn({ label: '刪除', onClick: function () {
                              deleteModal = {
                                show: true,
                                id: dc.id,
                                label: DeviceCategoryUtils.formatRecordLabel(dc)
                              };
                              rerender();
                            },
                            className: 'p-1.5 text-red-600 hover:bg-red-100 rounded', icon: Icons.Trash2({ className: 'h-4 w-4' }) })
                        )
                      ),
                      COLUMNS.map(function (col) {
                        return h('td', { key: col.key, className: 'p-3 font-medium text-gray-800' },
                          dc[col.key] || '—');
                      })
                    );
                  })
            )
          )
        ),
        listPagination.renderBar(pageResult, rerender),
        deleteModal.show && h('div', {
          className: 'app-modal-overlay'
        },
          h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4' },
            h('div', { className: 'flex items-center space-x-3 text-red-600 mb-4' },
              Icons.AlertCircle({ className: 'h-6 w-6' }),
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '確認刪除')
            ),
            h('p', { className: 'text-gray-600 mb-6' },
              '確定要刪除設備分類「' + deleteModal.label + '」嗎？若已被設備資料使用則無法刪除。'),
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

  window.DeviceCategoryList = DeviceCategoryList;
})();
