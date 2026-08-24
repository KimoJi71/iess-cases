/*
 * features/project/project-equip-picker.js — 工程立案：從門市設備列表多選設備
 * props: { equipments, customerName, storeName, addedIds, onConfirm, onClose }
 *
 * 工項分類為「汰換／撤店」時，立案單的設備來自該門市已建立的設備資料，
 * 因此改為多選既有設備，而非手動填寫新設備。
 *
 * 標題下有關鍵字搜尋框，比對設備列表上看得到的欄位（EquipmentUtils.listRowText）。
 * 關鍵字只縮小可見範圍：全選作用於目前篩選結果，被篩掉的已勾選設備確認時仍會加入。
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  function ProjectEquipPicker(props) {
    var customerName = String(props.customerName || '').trim();
    var storeName = String(props.storeName || '').trim();
    var addedIds = (props.addedIds || []).map(String);
    var onConfirm = props.onConfirm;
    var onClose = props.onClose;

    var items = RepairCaseEquipment.listForCase(props.equipments, {
      customerName: customerName,
      storeName: storeName
    }).slice().sort(function (a, b) {
      return new Date(b.createdDate) - new Date(a.createdDate);
    });

    // 已汰換與已加入本立案單的設備都不可再勾選
    function isAdded(eq) {
      return addedIds.indexOf(String(eq.id)) !== -1;
    }
    function isSelectable(eq) {
      return !EquipmentUtils.isRetired(eq) && !isAdded(eq);
    }

    var selectable = items.filter(isSelectable);
    var selectedIds = [];
    // 關鍵字只縮小視野，不影響已勾選的設備：搜了另一個關鍵字不該讓先前勾的東西被取消。
    var filterText = '';

    return stateful(function (rerender) {
      var query = String(filterText || '').trim().toLowerCase();
      var visibleItems = query
        ? items.filter(function (eq) {
            return EquipmentUtils.listRowText(eq).toLowerCase().indexOf(query) >= 0;
          })
        : items;
      var visibleSelectable = visibleItems.filter(isSelectable);

      function handleFilterInput(e) {
        filterText = e.target.value;
        rerender();
      }

      function isChecked(eq) {
        return selectedIds.indexOf(String(eq.id)) !== -1;
      }
      function toggle(eq) {
        var id = String(eq.id);
        var idx = selectedIds.indexOf(id);
        if (idx === -1) selectedIds = selectedIds.concat([id]);
        else selectedIds = selectedIds.filter(function (x) { return x !== id; });
        rerender();
      }
      // 全選／取消全選只作用於目前篩選結果中可選的設備；被關鍵字篩掉的勾選狀態原封不動。
      function toggleAll() {
        var visibleIds = visibleSelectable.map(function (eq) { return String(eq.id); });
        if (allChecked) {
          selectedIds = selectedIds.filter(function (id) { return visibleIds.indexOf(id) === -1; });
        } else {
          visibleIds.forEach(function (id) {
            if (selectedIds.indexOf(id) === -1) selectedIds = selectedIds.concat([id]);
          });
        }
        rerender();
      }
      function handleConfirm() {
        var picked = selectable.filter(isChecked).map(function (eq) {
          return Object.assign({}, eq, { sourceEquipmentId: eq.id });
        });
        onConfirm(picked);
      }

      var allChecked = visibleSelectable.length > 0 && visibleSelectable.every(isChecked);

      return h('div', { className: 'app-modal-overlay p-4' },
        h('div', {
          className: 'bg-white rounded-lg shadow-xl p-6 w-full max-w-7xl m-4 max-h-[80vh] overflow-hidden flex flex-col'
        },
          h('div', { className: 'flex justify-between items-center mb-4' },
            h('h3', { className: 'text-lg font-bold text-gray-800' }, '選擇設備'),
            h('button', {
              type: 'button',
              onClick: onClose,
              className: 'text-gray-400 hover:text-gray-600'
            }, Icons.X({ className: 'h-5 w-5' }))
          ),
          items.length === 0 ? null : h('div', { className: 'equip-picker__search mb-3' },
            h('input', {
              type: 'text',
              value: filterText,
              placeholder: '搜尋設備',
              'aria-label': '輸入關鍵字篩選設備',
              autoComplete: 'off',
              spellCheck: false,
              onInput: handleFilterInput,
              className: 'equip-picker__search-input w-full border rounded-md px-3 py-2 text-sm'
            })
          ),
          items.length === 0
            ? h('div', {
                className: 'p-8 text-center text-gray-400 border border-dashed rounded-md'
              }, '此門市尚無設備資料')
            : visibleItems.length === 0
            ? h('div', {
                className: 'equip-picker__empty p-8 text-center text-gray-400 border border-dashed rounded-md'
              }, '找不到符合的設備')
            : h('div', { className: 'overflow-x-auto border rounded-lg' },
                h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap' },
                  h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
                    h('tr', null,
                      h('th', { className: 'p-3 font-semibold text-center w-16' },
                        h('input', {
                          type: 'checkbox',
                          checked: allChecked,
                          disabled: visibleSelectable.length === 0,
                          onChange: toggleAll,
                          title: '全選',
                          className: 'h-4 w-4 cursor-pointer'
                        })),
                      EquipmentUtils.renderListHeaderCells(h)
                    )
                  ),
                  h('tbody', { className: 'divide-y divide-gray-100' },
                    visibleItems.map(function (eq) {
                      var disabled = !isSelectable(eq);
                      return h('tr', {
                        key: eq.id,
                        className: 'transition-colors ' + (
                          disabled ? 'bg-gray-50 text-gray-400' : 'hover:bg-blue-50/50'
                        )
                      },
                        h('td', { className: 'p-3 text-center' },
                          disabled
                            ? h('span', {
                                className: 'text-xs text-gray-400',
                                title: isAdded(eq) ? '已加入此立案單' : '已汰換的設備無法加入'
                              }, isAdded(eq) ? '已加入' : '已汰換')
                            : h('input', {
                                type: 'checkbox',
                                checked: isChecked(eq),
                                onChange: function () { toggle(eq); },
                                className: 'h-4 w-4 cursor-pointer'
                              })
                        ),
                        EquipmentUtils.renderListDataCells(h, eq)
                      );
                    })
                  )
                )
              ),
          h('div', { className: 'mt-4 flex justify-end gap-3' },
            h('button', {
              type: 'button',
              onClick: onClose,
              className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
            }, '取消'),
            h('button', {
              type: 'button',
              onClick: handleConfirm,
              disabled: selectedIds.length === 0,
              className: 'px-4 py-2 rounded-md transition-colors ' + (
                selectedIds.length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              )
            }, '加入所選（' + selectedIds.length + '）')
          )
        )
      );
    });
  }

  window.ProjectEquipPicker = ProjectEquipPicker;
})();
