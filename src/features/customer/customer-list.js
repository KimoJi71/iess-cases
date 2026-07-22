/*
 * features/customer/customer-list.js — 客戶建檔：客戶列表
 * props: { cases, setCases, setEditingCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll;

  function enabledBadge(enabled) {
    var isEnabled = enabled !== false;
    return h('span', {
      className: 'px-2 py-0.5 rounded-full text-xs font-medium ' +
        (isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600')
    }, isEnabled ? '啟用' : '停用');
  }

  function CustomerList(props) {
    var cases = props.cases;
    var setCases = props.setCases;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    // 區域狀態
    var keyword = '';
    var appliedKeyword = '';
    var enabledFilter = '全部';
    var dragProps = useDragScroll();

    return stateful(function (rerender) {
      var filteredCustomers = (function () {
        var kw = appliedKeyword.trim().toLowerCase();
        var list = cases;
        if (enabledFilter === '啟用') {
          list = list.filter(function (c) { return c.enabled !== false; });
        } else if (enabledFilter === '停用') {
          list = list.filter(function (c) { return c.enabled === false; });
        }
        if (kw) {
          list = list.filter(function (c) {
            return c.name && String(c.name).toLowerCase().includes(kw);
          });
        }
        return list.slice().sort(function (a, b) { return new Date(b.createdDate) - new Date(a.createdDate); });
      })();

      function enabledFilterBtn(filter, label) {
        return h('button', {
          onClick: function () { enabledFilter = filter; rerender(); },
          className: 'px-4 py-2 rounded-full text-sm font-medium transition-all ' +
            (enabledFilter === filter
              ? 'bg-blue-100 text-blue-800 border-2 border-blue-500'
              : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50')
        }, label);
      }

      function handleSearch() { appliedKeyword = keyword; rerender(); }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }

      return h('div', {
        className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100'
      },
        h('div', {
          className: 'flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4'
        },
          h('div', { className: 'flex flex-col gap-3' },
            h('div', { className: 'flex flex-wrap gap-2' },
              CUSTOMER_ENABLED_FILTERS.map(function (filter) {
                return enabledFilterBtn(filter, filter);
              })
            ),
            h('div', { className: 'flex flex-wrap items-end gap-3' },
            h('div', null,
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '關鍵字'),
              h('input', {
                type: 'text',
                value: keyword,
                onChange: function (e) { keyword = e.target.value; rerender(); },
                onKeyDown: handleKeyDown,
                placeholder: '客戶名稱',
                className: 'w-64 p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('button', {
              onClick: handleSearch,
              className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
            )
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
                h('th', { className: 'p-3 font-semibold' }, '客戶名稱'),
                h('th', { className: 'p-3 font-semibold' }, '啟用狀態')
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-100' },
              filteredCustomers.length === 0
                ? h('tr', null,
                    h('td', { colspan: 3, className: 'p-10 text-center text-gray-400 text-base' }, '無資料'))
                : filteredCustomers.map(function (c) {
                    return h('tr', { key: c.id, className: 'hover:bg-blue-50/50 transition-colors' },
                      h('td', { className: 'p-3' },
                        h('div', { className: 'flex items-center justify-center space-x-2' },
                          h('button', {
                            onClick: function () { setEditingCase(c); setView('customer-edit'); },
                            className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                            title: '編輯'
                          }, Icons.Edit({ className: 'h-4 w-4' }))
                        )
                      ),
                      h('td', { className: 'p-3 font-medium text-gray-800' }, c.name),
                      h('td', { className: 'p-3' }, enabledBadge(c.enabled))
                    );
                  })
            )
          )
        )
      );
    });
  }

  window.CustomerList = CustomerList;
})();
