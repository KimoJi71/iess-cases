/*
 * features/permissions/process-method-list.js — 處理方式與積分管理：列表
 * props: { processMethods, setProcessMethods, cases, maintenanceCases, projectCases, setEditingCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var iconActionBtn = IESS.iconActionBtn;

  var COLUMNS = [
    { key: 'category1', label: '大類' },
    { key: 'category2', label: '中類' },
    { key: 'category3', label: '小類' },
    { key: 'specification', label: '規格' },
    { key: 'unit', label: '單位' },
    { key: 'brand', label: '品牌' },
    { key: 'productCode', label: '產品編號' },
    { key: 'model', label: '型號' },
    { key: 'points', label: '積分數' }
  ];

  function ProcessMethodList(props) {
    var processMethods = props.processMethods;
    var setProcessMethods = props.setProcessMethods;
    var cases = props.cases;
    var maintenanceCases = props.maintenanceCases;
    var projectCases = props.projectCases;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    var keyword = '';
    var appliedKeyword = '';
    var deleteModal = { show: false, id: null, label: '' };
    var importMenuOpen = false;
    var listPagination = IESS.createListPagination();

    function getFilteredMethods() {
      var kw = appliedKeyword.trim().toLowerCase();
      var list = processMethods;
      if (kw) {
        list = processMethods.filter(function (pm) {
          return COLUMNS.some(function (col) {
            return String(pm[col.key] || '').toLowerCase().includes(kw);
          });
        });
      }
      return list.slice().sort(function (a, b) {
        var aKey = [a.category1, a.category2, a.category3, a.specification].join('\0');
        var bKey = [b.category1, b.category2, b.category3, b.specification].join('\0');
        return aKey.localeCompare(bKey, 'zh-Hant');
      });
    }

    return stateful(function (rerender) {
      var filteredMethods = getFilteredMethods();
      var pageResult = listPagination.slice(filteredMethods);

      function handleSearch() { appliedKeyword = keyword; listPagination.resetPage(); rerender(); }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }

      function handleDownloadTemplate() {
        importMenuOpen = false;
        showToast('匯入範例檔案下載成功（demo）');
        rerender();
      }

      function handleImport() {
        importMenuOpen = false;
        var stamp = Date.now();
        var demoRows = [
          {
            category1: '零件類', category2: '商用分離式', category3: '壓縮機',
            specification: '8馬力', unit: '台', brand: '日立',
            productCode: 'IMP0001', model: '2HA20088A', points: 5
          },
          {
            category1: '保養類', category2: '箱型機', category3: '濾網清洗',
            specification: '標準', unit: '式', brand: '大金',
            productCode: 'IMP0002', model: 'FVQ100', points: 3
          },
          {
            category1: '維修工資', category2: '通用', category3: '冷媒充填',
            specification: 'R410A', unit: '式', brand: '',
            productCode: 'IMP0003', model: '', points: 8
          }
        ];
        var imported = demoRows.map(function (row, idx) {
          return Object.assign({}, row, {
            id: 'PM' + (stamp + idx),
            createdDate: todayDate
          });
        });
        setProcessMethods(processMethods.concat(imported));
        showToast('已匯入 ' + imported.length + ' 筆處理方式與積分');
      }

      function handleDelete(id) {
        var target = processMethods.find(function (pm) { return pm.id === id; });
        if (!target) {
          deleteModal = { show: false, id: null, label: '' };
          rerender();
          return;
        }
        if (ProcessMethodUtils.hasUnincludedPerformanceCases(
          target, cases, maintenanceCases, projectCases
        )) {
          showToast('此處理方式有未列入績效之關聯案件，無法刪除', 'error');
          deleteModal = { show: false, id: null, label: '' };
          rerender();
          return;
        }
        setProcessMethods(processMethods.filter(function (pm) { return pm.id !== id; }));
        deleteModal = { show: false, id: null, label: '' };
        showToast('處理方式與積分已刪除');
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
                className: 'w-64 p-2.5 border rounded-md outline-none'
              })
            ),
            h('button', {
              onClick: handleSearch,
              className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md shadow-sm transition-colors'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
          ),
          h('div', { className: 'flex items-center gap-2 shrink-0' },
          h('div', { className: 'relative' },
            importMenuOpen && h('div', {
              className: 'fixed inset-0 z-10',
              onClick: function () { importMenuOpen = false; rerender(); }
            }),
            iconActionBtn({
              label: '匯入',
              wrapperClassName: 'relative z-20',
              className: 'flex items-center justify-center bg-white hover:bg-gray-50 text-blue-600 border border-blue-200 p-2.5 rounded-full shadow-sm transition-colors shrink-0',
              onClick: function (e) {
                e.stopPropagation();
                importMenuOpen = !importMenuOpen;
                rerender();
              },
              icon: Icons.Download({ className: 'h-5 w-5' })
            }),
            importMenuOpen && h('div', {
              className: 'absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1'
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
              }, '匯入處理方式與積分')
            )
          ),
          iconActionBtn({
            label: '新增處理方式與積分',
            className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors shrink-0',
            onClick: function () { setEditingCase(null); setView('process-method-add'); },
            icon: Icons.Plus({ className: 'h-5 w-5' })
          })
          )
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
              filteredMethods.length === 0
                ? h('tr', null, h('td', { colspan: COLUMNS.length + 1, className: 'p-10 text-center text-gray-400 text-base' }, '無資料'))
                : pageResult.items.map(function (pm) {
                    return h('tr', { key: pm.id, className: 'hover:bg-blue-50/50 transition-colors' },
                      h('td', { className: 'p-3' },
                        h('div', { className: 'flex items-center justify-center space-x-2' },
                          h('button', {
                            onClick: function () { setEditingCase(pm); setView('process-method-edit'); },
                            className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                            title: '編輯'
                          }, Icons.Edit({ className: 'h-4 w-4' })),
                          iconActionBtn({ label: '刪除', onClick: function () {
                              deleteModal = {
                                show: true,
                                id: pm.id,
                                label: ProcessMethodUtils.formatRecordLabel(pm)
                              };
                              rerender();
                            },
                            className: 'p-1.5 text-red-600 hover:bg-red-100 rounded', icon: Icons.Trash2({ className: 'h-4 w-4' }) })
                        )
                      ),
                      COLUMNS.map(function (col) {
                        var val = pm[col.key];
                        if (col.key === 'points') val = val != null && val !== '' ? val : '—';
                        else val = val || '—';
                        return h('td', { key: col.key, className: 'p-3 font-medium text-gray-800' }, val);
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
              '確定要刪除處理方式「' + deleteModal.label + '」嗎？若有未列入績效之關聯案件則無法刪除。'),
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

  window.ProcessMethodList = ProcessMethodList;
})();
