/*
 * features/permissions/performance-area-list.js — 績效區域管理：列表
 * props: { performanceAreas, setPerformanceAreas, setEditingCase, setView, showToast }
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

  function PerformanceAreaList(props) {
    var performanceAreas = props.performanceAreas;
    var setPerformanceAreas = props.setPerformanceAreas;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    var keyword = '';
    var appliedKeyword = '';
    var deleteModal = { show: false, id: null, name: '' };
    var listPagination = IESS.createListPagination();

    function getFilteredAreas() {
      var kw = appliedKeyword.trim().toLowerCase();
      var list = performanceAreas;
      if (kw) {
        list = performanceAreas.filter(function (area) {
          return [
            area.name,
            AccountUtils.formatDistricts(area.districts)
          ].filter(Boolean).some(function (v) {
            return String(v).toLowerCase().includes(kw);
          });
        });
      }
      return list.slice().sort(function (a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
      });
    }

    return stateful(function (rerender) {
      var filteredAreas = getFilteredAreas();
      var pageResult = listPagination.slice(filteredAreas);

      function handleSearch() { appliedKeyword = keyword; listPagination.resetPage(); rerender(); }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }

      function handleDelete(id) {
        var target = performanceAreas.find(function (a) { return a.id === id; });
        if (!target) {
          deleteModal = { show: false, id: null, name: '' };
          rerender();
          return;
        }
        setPerformanceAreas(performanceAreas.filter(function (a) { return a.id !== id; }));
        deleteModal = { show: false, id: null, name: '' };
        showToast('績效區域已刪除');
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
                placeholder: '區域名稱 / 行政區',
                className: 'w-72 p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('button', {
              onClick: handleSearch,
              className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
          ),
          iconActionBtn({
            label: '新增績效區域',
            className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors shrink-0',
            onClick: function () { setEditingCase(null); setView('performance-area-add'); },
            icon: Icons.Plus({ className: 'h-5 w-5' })
          })
        ),
        h('div', {
          className: 'overflow-x-auto border rounded-lg'
        },
          h('table', { className: 'w-full table-fixed text-left text-sm text-gray-600' },
            h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
              h('tr', null,
                h('th', { className: 'p-3 font-semibold text-center w-36' }, '操作'),
                h('th', { className: 'p-3 font-semibold w-40' }, '區域名稱'),
                h('th', { className: 'p-3 font-semibold' }, '縣市行政區清單')
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-100' },
              filteredAreas.length === 0
                ? h('tr', null, h('td', { colspan: 3, className: 'p-10 text-center text-gray-400 text-base' }, '無資料'))
                : pageResult.items.map(function (area) {
                    return h('tr', { key: area.id, className: 'hover:bg-blue-50/50 transition-colors' },
                      h('td', { className: 'p-3 whitespace-nowrap' },
                        h('div', { className: 'flex items-center justify-center space-x-2' },
                          h('button', {
                            onClick: function () { setEditingCase(area); setView('performance-area-edit'); },
                            className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                            title: '編輯'
                          }, Icons.Edit({ className: 'h-4 w-4' })),
                          iconActionBtn({
                            label: '刪除',
                            onClick: function () {
                              deleteModal = { show: true, id: area.id, name: area.name };
                              rerender();
                            },
                            className: 'p-1.5 text-red-600 hover:bg-red-100 rounded',
                            icon: Icons.Trash2({ className: 'h-4 w-4' })
                          })
                        )
                      ),
                      renderEllipsisCell(area.name, 'font-medium text-gray-800'),
                      renderEllipsisCell(AccountUtils.formatDistricts(area.districts))
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
              '確定要刪除績效區域「' + deleteModal.name + '」嗎？'),
            h('div', { className: 'flex justify-end space-x-3' },
              h('button', {
                onClick: function () { deleteModal = { show: false, id: null, name: '' }; rerender(); },
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

  window.PerformanceAreaList = PerformanceAreaList;
})();
