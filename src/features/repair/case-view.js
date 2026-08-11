/*
 * features/repair/case-view.js — 共用元件：查看案件明細
 * props: { viewingCase, setView, backView, deviceCategories }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll;
  var caseDT = IESS.caseDateTime;
  var caseStatus = IESS.caseStatus;

  function ViewCaseForm(props) {
    var viewingCase = props.viewingCase;
    var setView = props.setView;
    var backView = props.backView === undefined ? 'record-list' : props.backView;
    var processMethods = props.processMethods || [];
    var deviceCategories = props.deviceCategories || [];

    var dragProps = useDragScroll();
    var pmColumns = ProcessMethodUtils.CASE_DISPLAY_COLUMNS;

    function formatTimeRange(start, end) {
      if (!start) return '';
      return end && end !== start ? start + ' ~ ' + end : start;
    }

    function formatRecordPoints(r) {
      var isClosed = !!(viewingCase && viewingCase.isClosed);
      var pts = ProcessMethodUtils.resolveCaseRecordPoints(r, processMethods, isClosed);
      return pts === null ? '—' : String(pts);
    }

    function ReadOnlyField(p) {
      var label = p.label;
      var value = p.value;
      var fullWidth = p.fullWidth;
      return h('div', { className: fullWidth ? 'col-span-full' : '' },
        h('span', { className: 'text-gray-500 block mb-1 text-xs' }, label),
        h('div', {
          className: 'font-medium bg-gray-50 p-2.5 rounded-md border border-gray-100 min-h-[42px] flex items-center'
        }, value || '-')
      );
    }

    var showSecondRepairDate = viewingCase && caseStatus.isReRepairPendingStatus(viewingCase.processStatus);
    var isOther = viewingCase && viewingCase.workCategory === '其他';

    return h('div', {
      className: 'max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100'
    },
      PageHeader({
        title: '查看案件明細',
        badge: viewingCase && viewingCase.caseNumber,
        onClose: function () { setView(backView); },
        wrapperClass: 'page-header-sticky flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
      }),
      h('div', { className: 'p-4 sm:p-6 space-y-6 sm:space-y-8 bg-gray-50' },
        h('section', { className: 'bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100' },
          h('h3', { className: 'text-lg font-bold text-blue-800 border-b pb-2 mb-4' }, '1. 案件資料'),
          h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm items-start' },
            h(ReadOnlyField, { label: '客戶名稱', value: viewingCase && viewingCase.customerName }),
            h(ReadOnlyField, { label: '門市名稱', value: viewingCase && viewingCase.storeName }),
            h(ReadOnlyField, { label: '叫修人員', value: viewingCase && viewingCase.reporter }),
            h(ReadOnlyField, { label: '服務等級', value: viewingCase && viewingCase.serviceLevel }),
            h('div', { className: 'col-span-full md:col-span-4' },
              h(ReadOnlyField, { label: '門市地址', value: viewingCase && viewingCase.storeAddress })
            ),
            h(ReadOnlyField, { label: '工項分類', value: viewingCase && viewingCase.workCategory }),
            !isOther && h(ReadOnlyField, { label: '叫修項目', value: viewingCase && viewingCase.repairItem }),
            !isOther && h(ReadOnlyField, { label: '叫修原因', value: viewingCase && viewingCase.repairReason }),
            h(ReadOnlyField, {
              label: '指派人員',
              value: viewingCase && CaseAssigneeUtils.formatAssignees(viewingCase)
            }),
            h(ReadOnlyField, { label: '預計日期', value: viewingCase && (viewingCase.expectedDate || viewingCase.planDate) }),
            h(ReadOnlyField, {
              label: '預計時間',
              value: viewingCase && formatTimeRange(
                viewingCase.expectedTimeStart || viewingCase.planTimeStart,
                viewingCase.expectedTimeEnd || viewingCase.planTimeEnd
              )
            }),
            h(ReadOnlyField, {
              label: isOther ? '工作描述' : '故障描述',
              value: viewingCase && viewingCase.faultDesc,
              fullWidth: true
            })
          )
        ),
        h('section', { className: 'bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100' },
          h('h3', { className: 'text-lg font-bold text-blue-800 border-b pb-2 mb-4' }, '2. 設備資料'),
          h(RepairCaseEquipment.Panel, {
            h: h,
            equipment: viewingCase && viewingCase.equipment,
            caseContext: viewingCase,
            deviceCategories: deviceCategories,
            FieldComponent: ReadOnlyField,
            emptyText: '無設備資料'
          })
        ),
        isOther ? h('section', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
          h('h3', { className: 'text-lg font-bold text-blue-800 border-b pb-2 mb-4' }, '3. 備註'),
          h(ReadOnlyField, { label: '備註', value: viewingCase && viewingCase.remarks, fullWidth: true })
        ) : h('section', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
          h('h3', { className: 'text-lg font-bold text-blue-800 border-b pb-2 mb-4' }, '3. 服務項目'),
          h('div', { className: 'space-y-6' },
            h(ReadOnlyField, { label: '實際維修原因', value: viewingCase && viewingCase.actualReason, fullWidth: true }),
            h('div', null,
              h('span', { className: 'text-gray-500 block mb-2 text-sm' }, '處理方式'),
              h('div', Object.assign({ className: 'border rounded-md overflow-x-auto table-scroll-hint' }, dragProps),
                h('table', { className: 'w-full text-left text-sm whitespace-nowrap' },
                  h('thead', { className: 'bg-gray-100' },
                    h('tr', null,
                      pmColumns.map(function (col) {
                        return h('th', { key: col.key, className: 'p-2 pl-4' }, col.label);
                      }),
                      h('th', { className: 'p-2' }, '積分數'),
                      h('th', { className: 'p-2' }, '數量')
                    )
                  ),
                  h('tbody', { className: 'divide-y' },
                    (!viewingCase || !viewingCase.processRecords || viewingCase.processRecords.length === 0) ? h('tr', null,
                      h('td', { colspan: String(pmColumns.length + 2), className: 'p-4 text-center text-gray-400' }, '無處理方式紀錄')
                    ) : viewingCase.processRecords.map(function (r, idx) {
                      return h('tr', { key: r.id || idx },
                        pmColumns.map(function (col) {
                          return h('td', { key: col.key, className: 'p-2 pl-4' }, r[col.key] || '—');
                        }),
                        h('td', { className: 'p-2' }, formatRecordPoints(r)),
                        h('td', { className: 'p-2' },
                          r.qty,
                          r.unit ? h('span', { className: 'text-gray-500 ml-1' }, r.unit) : null
                        )
                      );
                    })
                  )
                )
              )
            ),
            h(ReadOnlyField, { label: '備註', value: viewingCase && viewingCase.remarks, fullWidth: true }),
            h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
              h(ReadOnlyField, { label: '處理狀態', value: (viewingCase && viewingCase.processStatus) || '—' })
            ),
            h('div', { className: 'pt-4 border-t border-gray-100' },
              h('h4', { className: 'text-sm font-semibold text-gray-800 mb-4' }, '時間紀錄'),
              h('div', {
                className: showSecondRepairDate
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'
                  : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              },
                h(ReadOnlyField, {
                  label: '叫修時間',
                  value: caseDT.format(viewingCase && (viewingCase.createdAt || viewingCase.repairDate))
                }),
                h(ReadOnlyField, { label: '維修時間', value: caseDT.format(viewingCase && viewingCase.reRepairDate) }),
                showSecondRepairDate ? h(ReadOnlyField, { label: '再次維修時間', value: caseDT.format(viewingCase && viewingCase.secondRepairDate) }) : null,
                h(ReadOnlyField, { label: '完成時間', value: caseDT.format(viewingCase && viewingCase.completionDate) })
              )
            )
          )
        )
      )
    );
  }

  window.ViewCaseForm = ViewCaseForm;
})();
