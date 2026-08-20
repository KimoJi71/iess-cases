/*
 * features/customer/store-list.js — 客戶建檔（門市管理）：門市列表
 * props: { stores, setStores, customers, storeCustomer, setStoreCustomer, setEditingCase, openStoreEdit, openStoreHistory, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var iconActionBtn = IESS.iconActionBtn;

  function StoreList(props) {
    var stores = props.stores;
    var setStores = props.setStores;
    var customers = props.customers;
    var storeCustomer = props.storeCustomer;
    var setStoreCustomer = props.setStoreCustomer;
    var setEditingCase = props.setEditingCase;
    var openStoreEdit = props.openStoreEdit;
    var openStoreHistory = props.openStoreHistory;
    var setView = props.setView;
    var showToast = props.showToast;

    // 區域狀態
    var keyword = '';
    var appliedKeyword = '';
    var importMenuOpen = false;
    var listPagination = IESS.createListPagination();

    function openHistory(store) {
      openStoreHistory(store);
    }

    function getFilteredStores() {
      if (!storeCustomer) return [];
      var kw = appliedKeyword.trim().toLowerCase();
      var list = stores.filter(function (s) { return s.customerName === storeCustomer; });
      if (kw) {
        list = list.filter(function (s) {
          return [s.storeCode, s.storeName, s.companyCity, s.companyDistrict, s.companyPhone, s.serviceLevel]
            .filter(Boolean)
            .some(function (v) { return String(v).toLowerCase().includes(kw); });
        });
      }
      return list.slice().sort(function (a, b) { return new Date(b.createdDate) - new Date(a.createdDate); });
    }

    function statusBadge(status) {
      var map = {
        正常營業: 'bg-green-100 text-green-700',
        整裝: 'bg-amber-100 text-amber-700',
        撤店: 'bg-gray-200 text-gray-600'
      };
      return h('span', {
        className: 'px-2 py-0.5 rounded-full text-xs font-medium ' + (map[status] || 'bg-gray-100 text-gray-600')
      }, status);
    }

    return stateful(function (rerender) {
      var filteredStores = getFilteredStores();
      var pageResult = listPagination.slice(filteredStores);
      var customerSelectOptions = CustomerUtils.getCustomerNameOptions(customers, storeCustomer, true);
      var canQuery = !!storeCustomer;

      function handleSearch() { appliedKeyword = keyword; listPagination.resetPage(); rerender(); }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }

      function handleDownloadTemplate() {
        importMenuOpen = false;
        showToast('匯入範例檔案下載成功（demo）');
        rerender();
      }

      function handleImport() {
        importMenuOpen = false;
        if (!canQuery) {
          showToast('請先篩選客戶', 'error');
          rerender();
          return;
        }
        var customer = customers.find(function (c) { return c.name === storeCustomer; });
        var serviceLevel = (customer && customer.serviceLevel) || '';
        var stamp = Date.now();
        var demoRows = [
          {
            storeCode: 'IMP-001', storeName: '匯入示範一店',
            companyPhone: '02-2100-0001', companyFax: '02-2100-0002',
            companyCity: '台北市', companyDistrict: '中山區', companyAddress: '南京東路X號',
            openDate: '2024-03-01', closeDate: '', storeStatus: '正常營業',
            workOrderApply: '是', indoorHeight: '3.0m', outdoorHeight: '4.0m',
            remarks: '匯入示範資料。'
          },
          {
            storeCode: 'IMP-002', storeName: '匯入示範二店',
            companyPhone: '04-2300-0001', companyFax: '04-2300-0002',
            companyCity: '台中市', companyDistrict: '西區', companyAddress: '公益路X號',
            openDate: '2023-09-15', closeDate: '', storeStatus: '整裝',
            workOrderApply: '否', indoorHeight: '3.5m', outdoorHeight: '4.5m',
            remarks: '匯入示範資料。'
          },
          {
            storeCode: 'IMP-003', storeName: '匯入示範三店',
            companyPhone: '07-2400-0001', companyFax: '07-2400-0002',
            companyCity: '高雄市', companyDistrict: '前鎮區', companyAddress: '中山二路X號',
            openDate: '2022-06-10', closeDate: '', storeStatus: '正常營業',
            workOrderApply: '是', indoorHeight: '3.2m', outdoorHeight: '4.2m',
            remarks: '匯入示範資料。'
          }
        ];
        var imported = demoRows.map(function (row, idx) {
          return Object.assign({}, row, {
            id: 'STOREIMP' + (stamp + idx),
            customerName: storeCustomer,
            serviceLevel: serviceLevel,
            contacts: [],
            photos: [],
            history: [],
            createdDate: todayDate
          });
        });
        setStores(imported.concat(stores));
        showToast('已匯入 ' + imported.length + ' 筆門市');
      }

      function handleExport() {
        if (!canQuery) {
          showToast('請先篩選客戶', 'error');
          return;
        }
        showToast('已匯出 ' + filteredStores.length + ' 筆門市（demo）');
      }

      return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h('div', { className: 'flex flex-col md:flex-row justify-between items-start mb-6 gap-4' },
          h('div', { className: 'bg-gray-50 p-4 rounded-lg border border-gray-200 flex-1' },
          h('div', { className: 'flex flex-wrap items-end gap-3' },
            h('div', { className: 'min-w-0' },
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '客戶名稱 ',
                h('span', { className: 'text-red-500' }, '*')),
              h('select', {
                value: storeCustomer,
                onChange: function (e) {
                  importMenuOpen = false;
                  setStoreCustomer(e.target.value);
                  appliedKeyword = '';
                  keyword = '';
                  listPagination.resetPage();
                },
                className: 'w-56 max-w-full p-2.5 border rounded-md outline-none bg-white'
              },
                h('option', { value: '' }, '請選擇客戶'),
                customerSelectOptions.map(function (name) {
                  return h('option', { key: name, value: name }, name);
                })
              )
            ),
            h('div', { className: 'min-w-0' },
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '關鍵字'),
              h('input', {
                type: 'text',
                value: keyword,
                onChange: function (e) { keyword = e.target.value; rerender(); },
                onKeyDown: handleKeyDown,
                placeholder: '請輸入關鍵字',
                disabled: !storeCustomer,
                className: 'w-60 max-w-full p-2.5 border rounded-md outline-none bg-white disabled:bg-gray-100'
              })
            ),
            h('button', {
              onClick: handleSearch,
              disabled: !storeCustomer,
              className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md shadow-sm transition-colors min-h-[42px] disabled:opacity-50 disabled:cursor-not-allowed'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
          )),
          h('div', { className: 'flex items-center gap-2 shrink-0' },
            h('div', { className: 'relative' },
              importMenuOpen && h('div', {
                className: 'fixed inset-0 z-10',
                onClick: function () { importMenuOpen = false; rerender(); }
              }),
              iconActionBtn({
                label: '匯入',
                wrapperClassName: 'relative z-20',
                className: 'flex items-center justify-center bg-white hover:bg-gray-50 text-blue-600 border border-blue-200 p-2.5 rounded-full shadow-sm transition-colors shrink-0' +
                  (!canQuery ? ' opacity-50 cursor-not-allowed' : ''),
                disabled: !canQuery,
                onClick: function (e) {
                  e.stopPropagation();
                  if (!canQuery) {
                    showToast('請先篩選客戶', 'error');
                    return;
                  }
                  importMenuOpen = !importMenuOpen;
                  rerender();
                },
                icon: Icons.Download({ className: 'h-5 w-5' })
              }),
              importMenuOpen && h('div', {
                className: 'absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1'
              },
                h('button', {
                  type: 'button',
                  className: 'w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap',
                  onClick: handleDownloadTemplate
                }, '下載匯入範例'),
                h('button', {
                  type: 'button',
                  className: 'w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap',
                  onClick: handleImport
                }, '匯入門市')
              )
            ),
            iconActionBtn({
              label: '匯出門市',
              className: 'flex items-center justify-center bg-white hover:bg-gray-50 text-blue-600 border border-blue-200 p-2.5 rounded-full shadow-sm transition-colors shrink-0' +
                (!canQuery ? ' opacity-50 cursor-not-allowed' : ''),
              disabled: !canQuery,
              onClick: handleExport,
              icon: Icons.Upload({ className: 'h-5 w-5' })
            }),
            iconActionBtn({
              label: '新增門市',
              className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors shrink-0',
              onClick: function () {
                if (!storeCustomer) {
                  showToast('請先篩選客戶', 'error');
                  return;
                }
                setEditingCase(null);
                setView('store-add');
              },
              icon: Icons.Plus({ className: 'h-5 w-5' })
            })
          )
        ),
        !storeCustomer
          ? h('div', {
              className: 'p-12 text-center text-gray-400 text-base border border-dashed rounded-lg'
            }, '請先篩選客戶，才可查詢門市列表')
          : h('div', {
              className: 'overflow-x-auto border rounded-lg'
            },
            h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap' },
              h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
                h('tr', null,
                  h('th', { className: 'p-3 font-semibold text-center w-32' }, '操作'),
                  h('th', { className: 'p-3 font-semibold' }, '門市店編'),
                  h('th', { className: 'p-3 font-semibold' }, '門市名稱'),
                  h('th', { className: 'p-3 font-semibold' }, '門市電話'),
                  h('th', { className: 'p-3 font-semibold' }, '服務等級'),
                  h('th', { className: 'p-3 font-semibold' }, '門市狀態')
                )
              ),
              h('tbody', { className: 'divide-y divide-gray-100' },
                filteredStores.length === 0
                  ? h('tr', null, h('td', {
                      colspan: 6,
                      className: 'p-10 text-center text-gray-400 text-base'
                    }, '無資料'))
                  : pageResult.items.map(function (s) {
                      return h('tr', { key: s.id, className: 'hover:bg-blue-50/50 transition-colors' },
                        h('td', { className: 'p-3' },
                          h('div', { className: 'flex items-center justify-center space-x-2' },
                            h('button', {
                              onClick: function () { openStoreEdit(s, 'store-list'); },
                              className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                              title: '編輯'
                            }, Icons.Edit({ className: 'h-4 w-4' })),
                            iconActionBtn({ label: '歷史紀錄', onClick: function () { openHistory(s); },
                              className: 'p-1.5 text-gray-500 hover:bg-gray-100 rounded', icon: Icons.Clock({ className: 'h-4 w-4' }) })
                          )
                        ),
                        h('td', { className: 'p-3' }, s.storeCode || '—'),
                        h('td', { className: 'p-3 font-medium text-gray-800' }, s.storeName),
                        h('td', { className: 'p-3' }, s.companyPhone || '—'),
                        h('td', { className: 'p-3' }, s.serviceLevel || '—'),
                        h('td', { className: 'p-3' }, statusBadge(s.storeStatus))
                      );
                    })
              )
            )
          ),
        listPagination.renderBar(pageResult, rerender)
      );
    });
  }

  window.StoreList = StoreList;
})();
