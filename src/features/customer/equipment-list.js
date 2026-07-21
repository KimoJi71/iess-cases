/*
 * features/customer/equipment-list.js — 客戶建檔（設備管理）：設備列表
 * props: {
 *   equipments, setEquipments, customers, stores, cases, setCases,
 *   equipmentCustomer, setEquipmentCustomer, equipmentStore, setEquipmentStore,
 *   setEditingCase, setView, showToast
 * }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll;
  var iconActionBtn = IESS.iconActionBtn;

  function EquipmentList(props) {
    var equipments = props.equipments;
    var setEquipments = props.setEquipments;
    var customers = props.customers;
    var stores = props.stores;
    var cases = props.cases;
    var setCases = props.setCases;
    var equipmentCustomer = props.equipmentCustomer;
    var setEquipmentCustomer = props.setEquipmentCustomer;
    var equipmentStore = props.equipmentStore;
    var setEquipmentStore = props.setEquipmentStore;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    var deleteModal = { show: false, id: null };
    var dragProps = useDragScroll();

    function getStoreOptions() {
      if (!equipmentCustomer) return [];
      return stores
        .filter(function (s) { return s.customerName === equipmentCustomer; })
        .map(function (s) { return s.storeName; });
    }

    function getFilteredEquipments() {
      if (!equipmentCustomer || !equipmentStore) return [];
      return equipments
        .filter(function (e) {
          return e.customerName === equipmentCustomer && e.storeName === equipmentStore;
        })
        .slice()
        .sort(function (a, b) { return new Date(b.createdDate) - new Date(a.createdDate); });
    }

    return stateful(function (rerender) {
      var filtered = getFilteredEquipments();
      var storeOptions = getStoreOptions();
      var customerSelectOptions = CustomerUtils.getCustomerNameOptions(customers, equipmentCustomer, true);
      var canQuery = !!(equipmentCustomer && equipmentStore);

      function handleDelete(id) {
        setEquipments(equipments.filter(function (e) { return e.id !== id; }));
        setCases(cases.filter(function (c) {
          return !(c.equipment && c.equipment.id === id);
        }));
        deleteModal = { show: false, id: null };
        showToast('設備已刪除，關聯叫修案件已一併移除');
      }

      return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h('div', { className: 'flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4' },
          h('div', { className: 'flex flex-wrap items-end gap-3' },
            h('div', null,
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '客戶名稱 ',
                h('span', { className: 'text-red-500' }, '*')),
              h('select', {
                value: equipmentCustomer,
                onChange: function (e) {
                  setEquipmentCustomer(e.target.value);
                  setEquipmentStore('');
                },
                className: 'w-56 p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
              },
                h('option', { value: '' }, '請選擇客戶'),
                customerSelectOptions.map(function (name) {
                  return h('option', { key: name, value: name }, name);
                })
              )
            ),
            h('div', null,
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '門市名稱 ',
                h('span', { className: 'text-red-500' }, '*')),
              h('select', {
                value: equipmentStore,
                onChange: function (e) { setEquipmentStore(e.target.value); },
                disabled: !equipmentCustomer,
                className: 'w-56 p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white disabled:bg-gray-100'
              },
                h('option', { value: '' }, '請選擇門市'),
                storeOptions.map(function (name) {
                  return h('option', { key: name, value: name }, name);
                })
              )
            )
          ),
          h('button', {
            onClick: function () {
              if (!canQuery) {
                showToast('請先篩選客戶與門市', 'error');
                return;
              }
              setEditingCase(null);
              setView('equipment-add');
            },
            className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors',
            title: '新增設備'
          }, Icons.Plus({ className: 'h-5 w-5' }), ' 新增設備')
        ),
        !canQuery
          ? h('div', {
              className: 'p-12 text-center text-gray-400 text-base border border-dashed rounded-lg'
            }, '請先篩選客戶與門市，才可查詢設備列表')
          : h('div', Object.assign({}, dragProps, {
              className: 'overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing'
            }),
            h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap select-none' },
              h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
                h('tr', null,
                  h('th', { className: 'p-3 font-semibold text-center w-24' }, '操作'),
                  h('th', { className: 'p-3 font-semibold' }, '設備分類'),
                  h('th', { className: 'p-3 font-semibold' }, '品牌'),
                  h('th', { className: 'p-3 font-semibold' }, '設備名稱'),
                  h('th', { className: 'p-3 font-semibold' }, '型號'),
                  h('th', { className: 'p-3 font-semibold' }, '設備區域'),
                  h('th', { className: 'p-3 font-semibold' }, '出廠日期'),
                  h('th', { className: 'p-3 font-semibold' }, '安裝日期'),
                  h('th', { className: 'p-3 font-semibold' }, '資產編號'),
                  h('th', { className: 'p-3 font-semibold' }, '流水序號')
                )
              ),
              h('tbody', { className: 'divide-y divide-gray-100' },
                filtered.length === 0
                  ? h('tr', null, h('td', {
                      colspan: 10,
                      className: 'p-10 text-center text-gray-400 text-base'
                    }, '無資料'))
                  : filtered.map(function (eq) {
                      return h('tr', { key: eq.id, className: 'hover:bg-blue-50/50 transition-colors' },
                        h('td', { className: 'p-3' },
                          h('div', { className: 'flex items-center justify-center space-x-2' },
                            h('button', {
                              onClick: function () { setEditingCase(eq); setView('equipment-edit'); },
                              className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                              title: '編輯'
                            }, Icons.Edit({ className: 'h-4 w-4' })),
                            iconActionBtn({ label: '刪除', onClick: function () { deleteModal = { show: true, id: eq.id }; rerender(); },
                              className: 'p-1.5 text-red-600 hover:bg-red-100 rounded', icon: Icons.Trash2({ className: 'h-4 w-4' }) })
                          )
                        ),
                        h('td', { className: 'p-3' }, eq.category || '—'),
                        h('td', { className: 'p-3' }, eq.brand || '—'),
                        h('td', { className: 'p-3 font-medium text-gray-800' }, eq.name || '—'),
                        h('td', { className: 'p-3' }, eq.model || '—'),
                        h('td', { className: 'p-3' }, eq.area || '—'),
                        h('td', { className: 'p-3' }, eq.manufactureDate || '—'),
                        h('td', { className: 'p-3' }, eq.installDate || '—'),
                        h('td', { className: 'p-3' }, eq.assetNumber || '—'),
                        h('td', { className: 'p-3' }, eq.serialNumber || '—')
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
            h('p', { className: 'text-gray-600 mb-6' },
              '確定要刪除此設備嗎？刪除後將一併移除關聯的叫修案件，且無法復原。'),
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

  window.EquipmentList = EquipmentList;
})();
