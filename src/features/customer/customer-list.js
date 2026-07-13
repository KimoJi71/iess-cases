/*
 * features/customer/customer-list.js — 客戶建檔：客戶列表
 * props: { cases, setCases, setEditingCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll;

  function CustomerList(props) {
    var cases = props.cases;
    var setCases = props.setCases;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    // 區域狀態
    var keyword = '';
    var appliedKeyword = '';
    var deleteModal = { show: false, id: null };
    var dragProps = useDragScroll();

    return stateful(function (rerender) {
      var filteredCustomers = (function () {
        var kw = appliedKeyword.trim().toLowerCase();
        var list = cases;
        if (kw) {
          list = cases.filter(function (c) {
            return [c.name, c.taxId, c.principal, c.phone, c.address].filter(Boolean).some(function (v) {
              return String(v).toLowerCase().includes(kw);
            });
          });
        }
        return list.slice().sort(function (a, b) { return new Date(b.createdDate) - new Date(a.createdDate); });
      })();

      function handleSearch() { appliedKeyword = keyword; rerender(); }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }
      function handleDelete(id) {
        setCases(cases.filter(function (c) { return c.id !== id; }));
        deleteModal = { show: false, id: null };
        showToast('客戶已刪除');
      }

      return h('div', {
        className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100'
      },
        h('div', {
          className: 'flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4'
        },
          h('div', { className: 'flex flex-wrap items-end gap-3' },
            h('div', null,
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '關鍵字'),
              h('input', {
                type: 'text',
                value: keyword,
                onChange: function (e) { keyword = e.target.value; rerender(); },
                onKeyDown: handleKeyDown,
                placeholder: '客戶名稱 / 統一編號 / 負責人',
                className: 'w-64 p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('button', {
              onClick: handleSearch,
              className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
          ),
          h('button', {
            onClick: function () { setView('customer-add'); },
            className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors',
            title: '新增客戶'
          }, Icons.Plus({ className: 'h-5 w-5' }), ' 新增客戶')
        ),
        h('div', Object.assign({}, dragProps, {
          className: 'overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing'
        }),
          h('table', {
            className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap select-none'
          },
            h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
              h('tr', null,
                h('th', { className: 'p-3 font-semibold text-center w-24' }, '操作'),
                h('th', { className: 'p-3 font-semibold' }, '客戶名稱')
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-100' },
              filteredCustomers.length === 0
                ? h('tr', null,
                    h('td', { colspan: 2, className: 'p-10 text-center text-gray-400 text-base' }, '無資料'))
                : filteredCustomers.map(function (c) {
                    return h('tr', { key: c.id, className: 'hover:bg-blue-50/50 transition-colors' },
                      h('td', { className: 'p-3' },
                        h('div', { className: 'flex items-center justify-center space-x-2' },
                          h('button', {
                            onClick: function () { setEditingCase(c); setView('customer-edit'); },
                            className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                            title: '編輯'
                          }, Icons.Edit({ className: 'h-4 w-4' })),
                          h('button', {
                            onClick: function () { deleteModal = { show: true, id: c.id }; rerender(); },
                            className: 'p-1.5 text-red-600 hover:bg-red-100 rounded',
                            title: '刪除'
                          }, Icons.Trash2({ className: 'h-4 w-4' }))
                        )
                      ),
                      h('td', { className: 'p-3 font-medium text-gray-800' }, c.name)
                    );
                  })
            )
          )
        ),
        deleteModal.show && h('div', {
          className: 'fixed inset-0 bg-black/40 flex items-center justify-center z-50'
        },
          h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4' },
            h('div', { className: 'flex items-center space-x-3 text-red-600 mb-4' },
              Icons.AlertCircle({ className: 'h-6 w-6' }),
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '確認刪除')
            ),
            h('p', { className: 'text-gray-600 mb-6' }, '確定要刪除此客戶嗎？刪除後將無法復原。'),
            h('div', { className: 'flex justify-end space-x-3' },
              h('button', {
                onClick: function () { deleteModal = { show: false, id: null }; rerender(); },
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

  window.CustomerList = CustomerList;
})();
