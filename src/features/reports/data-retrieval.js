/*
 * features/reports/data-retrieval.js — 資料調閱（raw data 篩選與匯出）
 * props: { cases, maintenanceCases, projectCases, customers, stores, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  var inputCls = 'w-full p-2 border rounded-md outline-none bg-white text-sm';
  var labelCls = 'block text-xs text-gray-500 mb-1';

  function FilterMultiSelect(props) {
    return h('div', { className: props.className || 'min-w-0' },
      h('label', { className: labelCls }, props.label),
      IESS.MultiSelect({
        id: props.id,
        options: props.options || [],
        value: props.value || [],
        onChange: props.onChange,
        placeholder: '全部'
      })
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
    var filterWorkCategory = [];
    var filterRepairItem = [];
    var filterRepairReason = [];
    var filterCustomer = [];
    var filterStore = [];
    var filterAssignee = [];
    var filterServiceLevel = [];
    var filterContactPerson = [];
    var filterCity = [];
    var filterDistrict = [];
    var applied = null;
    var listPagination = IESS.createListPagination();

    function resetApplied() {
      applied = null;
      listPagination.resetPage();
    }

    function handleCaseTypeChange(nextType, rerender) {
      // 切換案件類型會整批換掉 filter 面板；鍵盤操作（Tab 到案件類型按鈕再 Enter）
      // 不會觸發 MultiSelect 的 outside mousedown 監聽器，選單可能孤兒化並持續浮動
      // 在新面板之上（見 core/multi-select.js closeAll 的說明）。先強制關閉再重置狀態。
      if (IESS.MultiSelect.closeAll) IESS.MultiSelect.closeAll();
      caseType = nextType;
      filterWorkCategory = [];
      filterRepairItem = [];
      filterRepairReason = [];
      filterCustomer = [];
      filterStore = [];
      filterAssignee = [];
      filterServiceLevel = [];
      filterContactPerson = [];
      filterCity = [];
      filterDistrict = [];
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
      var customerOptions = CustomerUtils.getCustomerNameOptions(customers, null, true);
      var storeOptions = DataRetrievalUtils.getStoreGroupsForCustomers(stores, filterCustomer);
      var districtOptions = DataRetrievalUtils.getDistrictGroupsForCities(filterCity);
      var repairWorkCategories = WORK_CATEGORY_OPTIONS.filter(function (w) { return w !== '保養'; });
      var assigneeOptions = AssigneeUtils.getSelectOptions();

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
          FilterMultiSelect({
            id: 'dr-workCategory',
            label: '工程類型',
            value: filterWorkCategory,
            onChange: function (next) { filterWorkCategory = next; rerender(); },
            options: PROJECT_WORK_CATEGORIES
          }),
          FilterMultiSelect({
            id: 'dr-contactPerson',
            label: '負責人員',
            value: filterContactPerson,
            onChange: function (next) { filterContactPerson = next; rerender(); },
            options: PROJECT_ASSIGNEES.slice()
          }),
          FilterMultiSelect({
            id: 'dr-customer',
            label: '客戶名稱',
            value: filterCustomer,
            onChange: function (next) { filterCustomer = next; rerender(); },
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
          FilterMultiSelect({
            id: 'dr-workCategory',
            label: '工項分類',
            value: filterWorkCategory,
            onChange: function (next) { filterWorkCategory = next; rerender(); },
            options: repairWorkCategories
          }),
          FilterMultiSelect({
            id: 'dr-repairItem',
            label: '叫修項目',
            value: filterRepairItem,
            onChange: function (next) { filterRepairItem = next; rerender(); },
            options: REPAIR_ITEMS
          }),
          FilterMultiSelect({
            id: 'dr-repairReason',
            label: '叫修原因',
            value: filterRepairReason,
            onChange: function (next) { filterRepairReason = next; rerender(); },
            options: REPAIR_REASONS
          }),
          FilterMultiSelect({
            id: 'dr-customer',
            label: '客戶名稱',
            value: filterCustomer,
            onChange: function (next) {
              filterCustomer = next;
              filterStore = [];
              rerender();
            },
            options: customerOptions
          }),
          FilterMultiSelect({
            id: 'dr-store',
            label: '門市名稱',
            value: filterStore,
            onChange: function (next) { filterStore = next; rerender(); },
            options: storeOptions
          }),
          FilterMultiSelect({
            id: 'dr-assignee',
            label: '維修人員',
            value: filterAssignee,
            onChange: function (next) { filterAssignee = next; rerender(); },
            options: assigneeOptions
          }),
          FilterMultiSelect({
            id: 'dr-serviceLevel',
            label: '服務等級',
            value: filterServiceLevel,
            onChange: function (next) { filterServiceLevel = next; rerender(); },
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
          FilterMultiSelect({
            id: 'dr-city',
            label: '縣市',
            value: filterCity,
            onChange: function (next) {
              filterCity = next;
              filterDistrict = [];
              rerender();
            },
            options: TAIWAN_CITY_OPTIONS
          }),
          FilterMultiSelect({
            id: 'dr-district',
            label: '行政區',
            value: filterDistrict,
            onChange: function (next) { filterDistrict = next; rerender(); },
            options: districtOptions
          }),
          FilterMultiSelect({
            id: 'dr-customer',
            label: '客戶名稱',
            value: filterCustomer,
            onChange: function (next) { filterCustomer = next; rerender(); },
            options: customerOptions
          }),
          FilterMultiSelect({
            id: 'dr-assignee',
            label: '維修人員',
            value: filterAssignee,
            onChange: function (next) { filterAssignee = next; rerender(); },
            options: assigneeOptions
          }),
          FilterMultiSelect({
            id: 'dr-serviceLevel',
            label: '服務等級',
            value: filterServiceLevel,
            onChange: function (next) { filterServiceLevel = next; rerender(); },
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
              h('div', {
                className: 'overflow-x-auto border rounded-lg'
              },
                h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap' },
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
