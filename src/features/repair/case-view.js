/*
 * features/repair/case-view.js — 共用元件：查看案件明細
 * props: { viewingCase, setView, backView, deviceCategories, stores, notice }
 *
 * notice：可選的說明橫幅，用於告知使用者此頁為何唯讀（例：自案件處理列表點進已結案案件）。
 */
(function () {
  'use strict';
  var h = IESS.h;
  var caseDT = IESS.caseDateTime;

  function ViewCaseForm(props) {
    var viewingCase = props.viewingCase;
    var setView = props.setView;
    var backView = props.backView === undefined ? 'record-list' : props.backView;
    var processMethods = props.processMethods || [];
    var deviceCategories = props.deviceCategories || [];
    var vehicles = props.vehicles || [];
    var vendors = props.vendors || [];
    var cases = props.cases || [];
    var stores = props.stores || [];
    var openPrevCase = props.openPrevCase;
    var currentView = props.currentView || backView;
    var onClose = props.onClose;
    var notice = props.notice;

    // 多筆設備一次只顯示一張卡片；index 是這個區塊自己的區域狀態，
    // 用 stateful 包住區塊即可，不必為了換台重繪整份明細。
    function renderServiceItemSection() {
      var items = RepairCaseServiceItems.getItems(viewingCase);
      var activeIndex = 0;
      return IESS.stateful(function (rerender) {
        if (activeIndex > items.length - 1) activeIndex = Math.max(items.length - 1, 0);
        return h('section', { className: 'bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100' },
          h('div', { className: 'flex flex-wrap justify-between items-center gap-3 border-b pb-2 mb-4' },
            h('h3', { className: 'text-lg font-bold text-blue-800' }, '3. 設備與服務項目'),
            h(RepairCaseServiceItemPager, {
              h: h,
              index: activeIndex,
              total: items.length,
              onPrev: function (next) { activeIndex = next; rerender(); },
              onNext: function (next) { activeIndex = next; rerender(); }
            })
          ),
          items.length
            ? h(RepairCaseServiceItemCard, {
                key: items[activeIndex].id,
                h: h,
                index: activeIndex,
                item: items[activeIndex],
                caseContext: viewingCase,
                deviceCategories: deviceCategories,
                processMethods: processMethods,
                isOther: isOther,
                isClosed: viewingCase && viewingCase.isClosed,
                readOnly: true
              })
            : h('div', {
                className: 'text-center py-4 text-gray-400 bg-gray-50 rounded-md border border-dashed'
              }, '無設備資料')
        );
      });
    }

    function formatTimeRange(start, end) {
      if (!start) return '';
      return end && end !== start ? start + ' ~ ' + end : start;
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

    function buildPrevCaseAction() {
      return CaseExtensionUtils.buildPrevCaseAction({
        cases: cases,
        targetCase: viewingCase,
        currentView: currentView,
        openPrevCase: openPrevCase
      });
    }

    var isOther = viewingCase && viewingCase.workCategory === '其他';

    return h('div', {
      className: 'max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100'
    },
      PageHeader({
        title: '查看案件明細',
        badge: viewingCase && viewingCase.caseNumber,
        onClose: onClose || function () { setView(backView); },
        actions: buildPrevCaseAction(),
        wrapperClass: 'page-header-sticky flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
      }),
      h('div', { className: 'p-4 sm:p-6 space-y-6 sm:space-y-8 bg-gray-50' },
        notice && h('div', {
          className: 'flex items-start gap-2 p-3 rounded-md border border-amber-200 ' +
            'bg-amber-50 text-amber-800 text-sm'
        },
          IESS.Icons.AlertCircle({ className: 'h-4 w-4 mt-0.5 shrink-0' }),
          h('span', null, notice)
        ),
        h('section', { className: 'bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100' },
          h('h3', { className: 'text-lg font-bold text-blue-800 border-b pb-2 mb-4' }, '1. 排程資料'),
          h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm items-start' },
            h(ReadOnlyField, { label: '預計日期', value: viewingCase && (viewingCase.expectedDate || viewingCase.planDate) }),
            h(ReadOnlyField, {
              label: '預計時間',
              value: viewingCase && formatTimeRange(
                viewingCase.expectedTimeStart || viewingCase.planTimeStart,
                viewingCase.expectedTimeEnd || viewingCase.planTimeEnd
              )
            }),
            h(ReadOnlyField, {
              label: '組別',
              value: viewingCase && CaseAssigneeUtils.formatAssignees(viewingCase)
            }),
            h(ReadOnlyField, {
              label: '指派人員',
              value: viewingCase && CaseAssigneeUtils.formatAssigneeMembers(viewingCase)
            }),
            h(ReadOnlyField, {
              label: '使用車輛',
              value: viewingCase && VehicleUtils.formatLabel(vehicles, viewingCase.vehicleId)
            }),
            h(ReadOnlyField, {
              label: '協力廠商',
              value: viewingCase && VendorUtils.formatCooperatorLabels(vendors, viewingCase.partnerVendorIds)
            })
          )
        ),
        h('section', { className: 'bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-100' },
          h('h3', { className: 'text-lg font-bold text-blue-800 border-b pb-2 mb-4' }, '2. 案件資料'),
          h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm items-start' },
            h(ReadOnlyField, { label: '案件編號', value: viewingCase && viewingCase.caseNumber }),
            h(ReadOnlyField, { label: '工項分類', value: viewingCase && viewingCase.workCategory }),
            h(ReadOnlyField, { label: '叫修人員', value: viewingCase && viewingCase.reporter }),
            h(ReadOnlyField, { label: '客戶名稱', value: viewingCase && viewingCase.customerName }),
            h(ReadOnlyField, { label: '門市名稱', value: viewingCase && viewingCase.storeName }),
            h(ReadOnlyField, { label: '服務等級', value: viewingCase && viewingCase.serviceLevel }),
            h('div', { className: 'col-span-full md:col-span-4' },
              h(ReadOnlyField, { label: '門市地址', value: viewingCase && viewingCase.storeAddress })
            ),
            h('div', { className: 'col-span-full md:col-span-4' },
              h(ReadOnlyField, {
                label: '門市備註',
                value: StoreUtils.resolveStoreRemarks(stores, viewingCase)
              })
            ),
            !isOther && h(ReadOnlyField, { label: '叫修項目', value: viewingCase && viewingCase.repairItem }),
            !isOther && h(ReadOnlyField, { label: '叫修原因', value: viewingCase && viewingCase.repairReason }),
            h(ReadOnlyField, {
              label: isOther ? '工作描述' : '故障描述',
              value: viewingCase && viewingCase.faultDesc,
              fullWidth: true
            })
          )
        ),
        renderServiceItemSection(),
        h('section', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
          h('h3', { className: 'text-lg font-bold text-blue-800 border-b pb-2 mb-4' }, '4. 維修結果'),
          h('div', { className: 'space-y-6' },
            h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
              h(ReadOnlyField, { label: '處理狀態', value: (viewingCase && viewingCase.processStatus) || '—' }),
              // 待報價／轉汰換／轉原廠：接在處理狀態後方呈現後續處理的結果與時間。
              IESS.caseStatus.getFollowUpFields(viewingCase).map(function (f) {
                return h(ReadOnlyField, { key: f.key, label: f.label, value: f.value || '—' });
              }),
              h('div', null,
                h('span', { className: 'text-gray-500 block mb-1 text-xs' }, '客戶簽收'),
                viewingCase && viewingCase.customerSignature
                  ? h('img', {
                      src: viewingCase.customerSignature,
                      alt: '客戶簽名',
                      className: 'h-[42px] bg-white border border-gray-100 rounded-md'
                    })
                  : h('div', {
                      className: 'font-medium bg-gray-50 p-2.5 rounded-md border border-gray-100 min-h-[42px] flex items-center'
                    }, '尚未簽收')
              )
            ),
            h(ReadOnlyField, {
              label: '維修備註',
              value: viewingCase && viewingCase.repairRemark,
              fullWidth: true
            }),
            h('div', { className: 'pt-4 border-t border-gray-100' },
              h('h4', { className: 'text-sm font-semibold text-gray-800 mb-4' }, '時間紀錄'),
              h('div', {
                className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              },
                h(ReadOnlyField, {
                  label: '叫修時間',
                  value: caseDT.format(viewingCase && (viewingCase.createdAt || viewingCase.repairDate))
                }),
                h(ReadOnlyField, { label: '到店時間', value: caseDT.format(viewingCase && viewingCase.reRepairDate) }),
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
