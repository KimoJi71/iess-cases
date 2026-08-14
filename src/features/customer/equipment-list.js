/*
 * features/customer/equipment-list.js — 客戶建檔（設備管理）：設備列表
 * props: {
 *   equipments, setEquipments, customers, stores, deviceCategories,
 *   repairCases, projectCases, setProjectCases,
 *   equipmentCustomer, setEquipmentCustomer, equipmentStore, setEquipmentStore,
 *   openStoreEdit, openStoreHistory, setEditingCase, setView, showToast
 * }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var iconActionBtn = IESS.iconActionBtn;

  function EquipmentList(props) {
    var equipments = props.equipments;
    var setEquipments = props.setEquipments;
    var customers = props.customers;
    var stores = props.stores;
    var deviceCategories = props.deviceCategories || [];
    var repairCases = props.repairCases || [];
    var projectCases = props.projectCases || [];
    var setProjectCases = props.setProjectCases;
    var equipmentCustomer = props.equipmentCustomer;
    var setEquipmentCustomer = props.setEquipmentCustomer;
    var equipmentStore = props.equipmentStore;
    var setEquipmentStore = props.setEquipmentStore;
    var openStoreEdit = props.openStoreEdit;
    var openStoreHistory = props.openStoreHistory;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    var deleteModal = { show: false, id: null };
    var listPagination = IESS.createListPagination();

    function getStoreOptions() {
      if (!equipmentCustomer) return [];
      return StoreUtils.getStoreNameOptions(stores, equipmentCustomer, equipmentStore, true);
    }

    function getCurrentStore() {
      if (!equipmentCustomer || !equipmentStore) return null;
      return stores.find(function (s) {
        return s.customerName === equipmentCustomer && s.storeName === equipmentStore;
      }) || null;
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

    function storeStatusBadge(status) {
      var map = {
        正常營業: 'bg-green-100 text-green-700',
        整裝: 'bg-amber-100 text-amber-700',
        撤店: 'bg-gray-200 text-gray-600'
      };
      return h('span', {
        className: 'px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ' + (map[status] || 'bg-gray-100 text-gray-600')
      }, status || '—');
    }

    return stateful(function (rerender) {
      var filtered = getFilteredEquipments();
      var pageResult = listPagination.slice(filtered);
      var storeOptions = getStoreOptions();
      var currentStore = getCurrentStore();
      var customerSelectOptions = CustomerUtils.getCustomerNameOptions(customers, equipmentCustomer, true);
      var canQuery = !!(equipmentCustomer && equipmentStore);

      function openCurrentStoreDetail() {
        if (!currentStore) {
          showToast('找不到對應門市資料', 'error');
          return;
        }
        openStoreEdit(currentStore, 'equipment-list');
      }

      function openCurrentStoreHistory() {
        if (!currentStore) {
          showToast('找不到對應門市資料', 'error');
          return;
        }
        openStoreHistory(currentStore, 'equipment-list');
      }

      function tryOpenDeleteModal(id) {
        var blockedReason = EquipmentUtils.getEquipmentDeleteBlockedReason(id, repairCases);
        if (blockedReason) {
          showToast(blockedReason, 'error');
          return;
        }
        deleteModal = { show: true, id: id };
        rerender();
      }

      function handleDelete(id) {
        var blockedReason = EquipmentUtils.getEquipmentDeleteBlockedReason(id, repairCases);
        if (blockedReason) {
          showToast(blockedReason, 'error');
          deleteModal = { show: false, id: null };
          rerender();
          return;
        }
        setEquipments(equipments.filter(function (e) { return e.id !== id; }));
        if (setProjectCases) {
          setProjectCases(EquipmentUtils.removeEquipmentFromProjectCases(id, projectCases));
        }
        deleteModal = { show: false, id: null };
        showToast('設備已刪除');
        rerender();
      }

      return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h('div', { className: 'flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4' },
          h('div', { className: 'flex flex-wrap items-end gap-3' },
            h('div', null,
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '客戶名稱 ',
                h('span', { className: 'text-red-500' }, '*')),
              h('select', {
                value: equipmentCustomer,
                onChange: function (e) {
                  setEquipmentCustomer(e.target.value);
                  setEquipmentStore('');
                  listPagination.resetPage();
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
                onChange: function (e) { setEquipmentStore(e.target.value); listPagination.resetPage(); },
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
          iconActionBtn({
            label: '新增設備',
            className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors shrink-0' +
              (!canQuery ? ' opacity-50 cursor-not-allowed' : ''),
            disabled: !canQuery,
            onClick: function () {
              if (!canQuery) {
                showToast('請先篩選客戶與門市', 'error');
                return;
              }
              setEditingCase(null);
              setView('equipment-add');
            },
            icon: Icons.Plus({ className: 'h-5 w-5' })
          })
        ),
        canQuery && h('div', {
          className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg'
        },
          h('div', { className: 'flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0' },
            h('span', { className: 'text-xs font-medium text-slate-500 uppercase tracking-wide shrink-0' }, '目前門市'),
            h('span', {
              className: 'text-sm font-semibold text-slate-800 truncate',
              title: equipmentCustomer + ' / ' + equipmentStore
            }, equipmentCustomer + ' / ' + equipmentStore),
            currentStore && currentStore.storeCode
              ? h('span', { className: 'text-xs text-slate-500 shrink-0' }, '店編 ' + currentStore.storeCode)
              : null,
            currentStore && currentStore.storeStatus
              ? storeStatusBadge(currentStore.storeStatus)
              : null
          ),
          h('div', { className: 'flex flex-wrap items-center gap-2 shrink-0' },
            h('button', {
              type: 'button',
              onClick: openCurrentStoreDetail,
              className: 'flex items-center gap-1.5 text-sm bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-md transition-colors',
              title: '查看門市明細'
            }, Icons.Eye({ className: 'h-4 w-4' }), '門市明細'),
            h('button', {
              type: 'button',
              onClick: openCurrentStoreHistory,
              className: 'flex items-center gap-1.5 text-sm bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-md transition-colors',
              title: '查看門市歷史紀錄'
            }, Icons.Clock({ className: 'h-4 w-4' }), '歷史紀錄')
          )
        ),
        !canQuery
          ? h('div', {
              className: 'p-12 text-center text-gray-400 text-base border border-dashed rounded-lg'
            }, '請先篩選客戶與門市，才可查詢設備列表')
          : h('div', {
              className: 'overflow-x-auto border rounded-lg'
            },
            h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap' },
              h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
                h('tr', null,
                  h('th', { className: 'p-3 font-semibold text-center w-24' }, '操作'),
                  EquipmentUtils.renderListHeaderCells(h)
                )
              ),
              h('tbody', { className: 'divide-y divide-gray-100' },
                filtered.length === 0
                  ? h('tr', null, h('td', {
                      colspan: 1 + EquipmentUtils.LIST_COLUMNS.length,
                      className: 'p-10 text-center text-gray-400 text-base'
                    }, '無資料'))
                  : pageResult.items.map(function (eq) {
                      return h('tr', { key: eq.id, className: 'hover:bg-blue-50/50 transition-colors' },
                        h('td', { className: 'p-3' },
                          h('div', { className: 'flex items-center justify-center space-x-2' },
                            h('button', {
                              onClick: function () { setEditingCase(eq); setView('equipment-edit'); },
                              className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                              title: '編輯'
                            }, Icons.Edit({ className: 'h-4 w-4' })),
                            iconActionBtn({ label: '刪除', onClick: function () { tryOpenDeleteModal(eq.id); },
                              className: 'p-1.5 text-red-600 hover:bg-red-100 rounded', icon: Icons.Trash2({ className: 'h-4 w-4' }) })
                          )
                        ),
                        EquipmentUtils.renderListDataCells(h, eq)
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
              '確定要刪除此設備嗎？已有叫修紀錄的設備無法刪除；刪除後無法復原。'),
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
