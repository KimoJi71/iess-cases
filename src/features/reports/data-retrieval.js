/*
 * features/reports/data-retrieval.js — 資料調閱（raw data 篩選與匯出）
 * props: { cases, maintenanceCases, projectCases, customers, stores, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll;

  var inputCls = 'w-full p-2 border rounded-md outline-none bg-white text-sm';
  var labelCls = 'block text-xs text-gray-500 mb-1';

  function FilterSelect(props) {
    return h('div', { className: props.className || 'min-w-0' },
      h('label', { className: labelCls }, props.label),
      h('select', {
        value: props.value,
        onChange: props.onChange,
        className: inputCls
      },
        h('option', { value: '全部' }, '全部'),
        (props.options || []).map(function (opt) {
          return h('option', { key: opt, value: opt }, opt);
        })
      )
    );
  }

  function FilterDateRange(props) {
    return h('div', { className: props.className || 'min-w-0 sm:col-span-2' },
      h('label', { className: labelCls }, '時間區間'),
      h('div', { className: 'flex flex-wrap items-center gap-2' },
        h('input', {
          type: 'date',
          value: props.startValue,
          onChange: props.onStartChange,
          className: inputCls + ' flex-1 min-w-[140px]'
        }),
        h('span', { className: 'text-gray-500 text-sm shrink-0' }, '至'),
        h('input', {
          type: 'date',
          value: props.endValue,
          onChange: props.onEndChange,
          className: inputCls + ' flex-1 min-w-[140px]'
        })
      )
    );
  }

  function DataRetrieval(props) {
    var cases = props.cases;
    var maintenanceCases = props.maintenanceCases;
    var projectCases = props.projectCases;
    var customers = props.customers;
    var stores = props.stores;
    var showToast = props.showToast;

    var caseType = '維修';
    var startDate = oneMonthAgoDate;
    var endDate = todayDate;
    var filterWorkCategory = '全部';
    var filterRepairItem = '全部';
    var filterRepairReason = '全部';
    var filterCustomer = '全部';
    var filterStore = '全部';
    var filterAssignee = '全部';
    var filterServiceLevel = '全部';
    var filterContactPerson = '全部';
    var filterCity = '全部';
    var filterDistrict = '全部';
    var applied = null;
    var dragProps = useDragScroll();
    var listPagination = IESS.createListPagination();

    function resetApplied() {
      applied = null;
      listPagination.resetPage();
    }

    function handleCaseTypeChange(nextType, rerender) {
      caseType = nextType;
      filterWorkCategory = '全部';
      filterRepairItem = '全部';
      filterRepairReason = '全部';
      filterCustomer = '全部';
      filterStore = '全部';
      filterAssignee = '全部';
      filterServiceLevel = '全部';
      filterContactPerson = '全部';
      filterCity = '全部';
      filterDistrict = '全部';
      resetApplied();
      rerender();
    }

    function getCurrentFilters() {
      return {
        startDate: startDate,
        endDate: endDate,
        workCategory: filterWorkCategory,
        repairItem: filterRepairItem,
        repairReason: filterRepairReason,
        customer: filterCustomer,
        store: filterStore,
        assignee: filterAssignee,
        serviceLevel: filterServiceLevel,
        contactPerson: filterContactPerson,
        city: filterCity,
        district: filterDistrict
      };
    }

    function runQuery() {
      var filters = getCurrentFilters();
      if (caseType === '工程') {
        return DataRetrievalUtils.filterProjectCases(projectCases, filters);
      }
      if (caseType === '維修') {
        return DataRetrievalUtils.filterRepairCases(cases, filters);
      }
      return DataRetrievalUtils.filterMaintenanceCases(maintenanceCases, stores, filters);
    }

    return stateful(function (rerender) {
      var customerOptions = CustomerUtils.getCustomerNameOptions(
        customers,
        filterCustomer !== '全部' ? filterCustomer : null,
        true
      );
      var storeOptions = filterCustomer === '全部'
        ? StoreUtils.getActiveStores(stores).map(function (s) { return s.storeName; }).filter(function (name, idx, arr) {
          return arr.indexOf(name) === idx;
        }).sort(function (a, b) { return a.localeCompare(b, 'zh-Hant'); })
        : StoreUtils.getStoreNameOptions(stores, filterCustomer, filterStore !== '全部' ? filterStore : null, true);
      var districtOptions = filterCity === '全部'
        ? []
        : StoreUtils.getDistrictsForCity(filterCity);
      var repairWorkCategories = WORK_CATEGORY_OPTIONS.filter(function (w) { return w !== '保養'; });
      var assigneeOptions = ASSIGNEES.slice();

      function handleSearch() {
        if (startDate > endDate) {
          showToast('時間區間起日不可晚於迄日', 'error');
          return;
        }
        applied = {
          caseType: caseType,
          filters: getCurrentFilters(),
          items: runQuery()
        };
        listPagination.resetPage();
        rerender();
      }

      function handleExport() {
        if (!applied || !applied.items.length) {
          showToast('請先查詢並確認有資料後再匯出', 'error');
          return;
        }
        var columns = DataRetrievalUtils.getColumns(applied.caseType);
        var rows = DataRetrievalUtils.buildRows(applied.caseType, applied.items, stores);
        var csv = DataRetrievalUtils.rowsToCsv(columns, rows);
        var stamp = new Date().toISOString().slice(0, 10);
        DataRetrievalUtils.downloadCsv('資料調閱_' + applied.caseType + '_' + stamp + '.csv', csv);
        showToast('已匯出 ' + applied.items.length + ' 筆資料');
      }

      var resultItems = applied ? applied.items : [];
      var pageResult = listPagination.slice(resultItems);
      var columns = DataRetrievalUtils.getColumns(applied ? applied.caseType : caseType);
      var tableRows = applied
        ? DataRetrievalUtils.buildRows(applied.caseType, pageResult.items, stores)
        : [];

      function renderProjectFilters() {
        return h('div', {
          className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end'
        },
          FilterSelect({
            label: '工程類型',
            value: filterWorkCategory,
            onChange: function (e) { filterWorkCategory = e.target.value; rerender(); },
            options: PROJECT_WORK_CATEGORIES
          }),
          FilterSelect({
            label: '負責人員',
            value: filterContactPerson,
            onChange: function (e) { filterContactPerson = e.target.value; rerender(); },
            options: PROJECT_ASSIGNEES.slice()
          }),
          FilterSelect({
            label: '客戶名稱',
            value: filterCustomer,
            onChange: function (e) { filterCustomer = e.target.value; rerender(); },
            options: customerOptions
          }),
          FilterDateRange({
            startValue: startDate,
            endValue: endDate,
            onStartChange: function (e) { startDate = e.target.value; rerender(); },
            onEndChange: function (e) { endDate = e.target.value; rerender(); }
          })
        );
      }

      function renderRepairFilters() {
        return h('div', {
          className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end'
        },
          FilterSelect({
            label: '工項分類',
            value: filterWorkCategory,
            onChange: function (e) { filterWorkCategory = e.target.value; rerender(); },
            options: repairWorkCategories
          }),
          FilterSelect({
            label: '叫修項目',
            value: filterRepairItem,
            onChange: function (e) { filterRepairItem = e.target.value; rerender(); },
            options: REPAIR_ITEMS
          }),
          FilterSelect({
            label: '叫修原因',
            value: filterRepairReason,
            onChange: function (e) { filterRepairReason = e.target.value; rerender(); },
            options: REPAIR_REASONS
          }),
          FilterSelect({
            label: '客戶名稱',
            value: filterCustomer,
            onChange: function (e) {
              filterCustomer = e.target.value;
              filterStore = '全部';
              rerender();
            },
            options: customerOptions
          }),
          FilterSelect({
            label: '門市名稱',
            value: filterStore,
            onChange: function (e) { filterStore = e.target.value; rerender(); },
            options: storeOptions
          }),
          FilterSelect({
            label: '維修人員',
            value: filterAssignee,
            onChange: function (e) { filterAssignee = e.target.value; rerender(); },
            options: assigneeOptions
          }),
          FilterSelect({
            label: '服務等級',
            value: filterServiceLevel,
            onChange: function (e) { filterServiceLevel = e.target.value; rerender(); },
            options: SERVICE_LEVEL_OPTIONS
          }),
          FilterDateRange({
            startValue: startDate,
            endValue: endDate,
            onStartChange: function (e) { startDate = e.target.value; rerender(); },
            onEndChange: function (e) { endDate = e.target.value; rerender(); }
          })
        );
      }

      function renderMaintenanceFilters() {
        return h('div', {
          className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end'
        },
          FilterSelect({
            label: '縣市',
            value: filterCity,
            onChange: function (e) {
              filterCity = e.target.value;
              filterDistrict = '全部';
              rerender();
            },
            options: TAIWAN_CITY_OPTIONS
          }),
          FilterSelect({
            label: '行政區',
            value: filterDistrict,
            onChange: function (e) { filterDistrict = e.target.value; rerender(); },
            options: districtOptions
          }),
          FilterSelect({
            label: '客戶名稱',
            value: filterCustomer,
            onChange: function (e) { filterCustomer = e.target.value; rerender(); },
            options: customerOptions
          }),
          FilterSelect({
            label: '維修人員',
            value: filterAssignee,
            onChange: function (e) { filterAssignee = e.target.value; rerender(); },
            options: assigneeOptions
          }),
          FilterSelect({
            label: '服務等級',
            value: filterServiceLevel,
            onChange: function (e) { filterServiceLevel = e.target.value; rerender(); },
            options: SERVICE_LEVEL_OPTIONS
          }),
          FilterDateRange({
            startValue: startDate,
            endValue: endDate,
            onStartChange: function (e) { startDate = e.target.value; rerender(); },
            onEndChange: function (e) { endDate = e.target.value; rerender(); }
          })
        );
      }

      return h('div', null,
        h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6' },
          h('div', { className: 'flex flex-wrap gap-2 mb-5' },
            DataRetrievalUtils.CASE_TYPES.map(function (type) {
              var active = caseType === type;
              return h('button', {
                key: type,
                type: 'button',
                onClick: function () { handleCaseTypeChange(type, rerender); },
                className: 'px-4 py-2 rounded-md text-sm font-medium transition-colors ' + (
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )
              }, type);
            })
          ),

          caseType === '工程' ? renderProjectFilters()
            : caseType === '維修' ? renderRepairFilters()
              : renderMaintenanceFilters(),

          h('div', { className: 'flex flex-wrap gap-3 mt-5 pt-5 border-t border-gray-100' },
            h('button', {
              type: 'button',
              onClick: handleSearch,
              className: 'bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md flex items-center gap-2 transition-colors'
            }, Icons.Search({ className: 'h-4 w-4' }), '查詢'),
            h('button', {
              type: 'button',
              onClick: handleExport,
              disabled: !applied || !resultItems.length,
              className: 'px-5 py-2 rounded-md flex items-center gap-2 transition-colors ' + (
                applied && resultItems.length
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )
            }, Icons.Download({ className: 'h-4 w-4' }), '匯出 CSV')
          )
        ),

        h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
          !applied
            ? h('p', { className: 'text-center text-gray-400 py-12' }, '請設定篩選條件後按「查詢」')
            : h('div', null,
              h('div', { className: 'flex items-center justify-end mb-3' },
                h('span', {
                  className: 'text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full'
                }, '共 ' + resultItems.length + ' 筆')
              ),
              h('div', Object.assign({
                className: 'overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing'
              }, dragProps),
                h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap select-none' },
                  h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
                    h('tr', null,
                      columns.map(function (col) {
                        return h('th', { key: col, className: 'p-3 font-semibold' }, col);
                      })
                    )
                  ),
                  h('tbody', { className: 'divide-y divide-gray-100' },
                    tableRows.length === 0
                      ? h('tr', null,
                        h('td', {
                          colSpan: String(columns.length),
                          className: 'text-center p-8 text-gray-400'
                        }, '無資料符合目前篩選條件')
                      )
                      : tableRows.map(function (row, idx) {
                        return h('tr', {
                          key: String(pageResult.start + idx),
                          className: 'hover:bg-gray-50 transition-colors'
                        },
                          columns.map(function (col) {
                            return h('td', {
                              key: col,
                              className: 'p-3 max-w-[220px] truncate',
                              title: row[col]
                            }, row[col]);
                          })
                        );
                      })
                  )
                )
              ),
              listPagination.renderBar(pageResult, rerender)
            )
        )
      );
    });
  }

  window.DataRetrieval = DataRetrieval;
})();
