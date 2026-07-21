/*
 * features/customer/store-history.js — 客戶建檔（門市管理）：門市歷史紀錄（整頁）
 * props: { store, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll;

  function StoreHistory(props) {
    var store = props.store;
    var setView = props.setView;

    // 篩選狀態
    var startDate = '';
    var endDate = '';
    var keyword = '';
    var appliedFilter = { start: '', end: '', keyword: '' };
    var dragProps = useDragScroll();

    function getFilteredHistory() {
      if (!store || !store.history) return [];
      var kw = appliedFilter.keyword.trim().toLowerCase();
      return store.history.filter(function (rec) {
        if (appliedFilter.start && (rec.repairDate || '').slice(0, 10) < appliedFilter.start) return false;
        if (appliedFilter.end && (rec.repairDate || '').slice(0, 10) > appliedFilter.end) return false;
        if (kw) {
          var hit = [rec.workCategory, rec.equipmentCategory, rec.equipmentName, rec.equipmentArea,
            rec.repairItem, rec.repairReason, rec.assignee]
            .filter(Boolean)
            .some(function (v) { return String(v).toLowerCase().includes(kw); });
          if (!hit) return false;
        }
        return true;
      }).slice().sort(function (a, b) { return new Date(b.repairDate) - new Date(a.repairDate); });
    }

    function goBack() { setView('store-list'); }

    return stateful(function (rerender) {
      var rows = getFilteredHistory();

      function handleSearch() {
        appliedFilter = { start: startDate, end: endDate, keyword: keyword };
        rerender();
      }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }
      function handleClear() {
        startDate = ''; endDate = ''; keyword = '';
        appliedFilter = { start: '', end: '', keyword: '' };
        rerender();
      }

      return h('div', { className: 'bg-white rounded-lg shadow-sm border border-gray-100' },
        PageHeader({
          title: '歷史紀錄',
          badge: store ? (store.customerName + ' / ' + store.storeName) : null,
          onClose: goBack,
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200'
        }),
        h('div', { className: 'p-6' },
          // 篩選列
          h('div', { className: 'flex flex-wrap items-end gap-3 mb-6 pb-6 border-b' },
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
                placeholder: '工項 / 設備 / 叫修項目 / 維修人員',
                className: 'w-64 p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
              })
            ),
            h('button', {
              onClick: handleSearch,
              className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋'),
            (appliedFilter.start || appliedFilter.end || appliedFilter.keyword) && h('button', {
              onClick: handleClear,
              className: 'px-4 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
            }, '清除')
          ),
          // 歷史紀錄表格
          h('div', Object.assign({}, dragProps, {
            className: 'overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing'
          }),
            h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap select-none' },
              h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
                h('tr', null,
                  h('th', { className: 'p-3 font-semibold' }, '工項分類'),
                  h('th', { className: 'p-3 font-semibold' }, '設備分類'),
                  h('th', { className: 'p-3 font-semibold' }, '設備名稱'),
                  h('th', { className: 'p-3 font-semibold' }, '設備區域'),
                  h('th', { className: 'p-3 font-semibold' }, '叫修項目'),
                  h('th', { className: 'p-3 font-semibold' }, '叫修原因'),
                  h('th', { className: 'p-3 font-semibold' }, '維修人員'),
                  h('th', { className: 'p-3 font-semibold' }, '叫修時間'),
                  h('th', { className: 'p-3 font-semibold' }, '銷案日期')
                )
              ),
              h('tbody', { className: 'divide-y divide-gray-100' },
                rows.length === 0
                  ? h('tr', null, h('td', {
                      colspan: 9,
                      className: 'p-10 text-center text-gray-400 text-base'
                    }, '無資料'))
                  : rows.map(function (rec) {
                      return h('tr', { key: rec.id, className: 'hover:bg-blue-50/50 transition-colors' },
                        h('td', { className: 'p-3' }, rec.workCategory || '—'),
                        h('td', { className: 'p-3' }, rec.equipmentCategory || '—'),
                        h('td', { className: 'p-3 font-medium text-gray-800' }, rec.equipmentName || '—'),
                        h('td', { className: 'p-3' }, rec.equipmentArea || '—'),
                        h('td', { className: 'p-3' }, rec.repairItem || '—'),
                        h('td', { className: 'p-3' }, rec.repairReason || '—'),
                        h('td', { className: 'p-3' }, rec.assignee || '—'),
                        h('td', { className: 'p-3' }, rec.repairDate || '—'),
                        h('td', { className: 'p-3' }, rec.closeDate || '—')
                      );
                    })
              )
            )
          ),
          h('div', { className: 'mt-6 flex justify-end' },
            h('button', {
              onClick: goBack,
              className: 'px-6 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
            }, '返回門市列表')
          )
        )
      );
    });
  }

  window.StoreHistory = StoreHistory;
})();
