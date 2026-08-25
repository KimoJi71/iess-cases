/*
 * features/repair/case-service-item-card.js — 一筆設備＋其服務項目的卡片
 * readOnly 供案件唯讀明細重用，避免編輯／檢視兩份版面走樣。
 */
(function () {
  'use strict';

  function cardTitle(index, item) {
    var eq = item.equipment || {};
    var name = eq.deviceName || eq.name || '未指定設備';
    return '設備 ' + (index + 1) + '　' + name + (eq.model ? ' ' + eq.model : '');
  }

  function RepairCaseServiceItemCard(props) {
    var h = props.h || IESS.h;
    var Icons = IESS.Icons;
    var item = props.item;
    var readOnly = !!props.readOnly;
    var processMethods = props.processMethods || [];
    var pmColumns = ProcessMethodUtils.CASE_DISPLAY_COLUMNS;
    var newRecord = props.newRecord;
    var selectedPm = readOnly
      ? null
      : ProcessMethodUtils.findProcessMethodForSelection(processMethods, newRecord);
    var selectedUnit = selectedPm ? selectedPm.unit : '';

    function formatPoints(r) {
      var pts = ProcessMethodUtils.resolveCaseRecordPoints(r, processMethods, props.isClosed);
      return pts === null ? '—' : String(pts);
    }

    function patchNewRecord(patch) {
      props.onNewRecordChange(ProcessMethodUtils.normalizeProcessMethodSelection(
        processMethods, Object.assign({}, newRecord, patch)
      ));
    }

    function selectField(label, value, options, patch, widthCls) {
      return h('div', { className: widthCls },
        h('span', { className: 'text-xs text-gray-500 block mb-1' }, label),
        h('select', {
          value: value,
          onChange: function (e) { patch(e.target.value); },
          disabled: !processMethods.length,
          className: 'w-full p-2 border rounded outline-none text-sm'
        }, options.map(function (c) { return h('option', { key: c, value: c }, c); }))
      );
    }

    function renderPicker() {
      var cat1 = ProcessMethodUtils.getCat1OptionsFromMethods(processMethods);
      var cat2 = ProcessMethodUtils.getCat2OptionsFromMethods(processMethods, newRecord.category1);
      var cat3 = ProcessMethodUtils.getCat3OptionsFromMethods(
        processMethods, newRecord.category1, newRecord.category2
      );
      var specs = ProcessMethodUtils.getSpecOptionsFromMethods(
        processMethods, newRecord.category1, newRecord.category2, newRecord.category3
      );
      return h('div', {
        className: 'flex flex-wrap gap-3 items-end bg-gray-50 p-4 rounded-md border border-gray-200 mb-4'
      },
        selectField('大類', newRecord.category1, cat1, function (v) {
          patchNewRecord({ category1: v, category2: '', category3: '', specification: '' });
        }, 'flex-1 min-w-[100px]'),
        selectField('中類', newRecord.category2, cat2, function (v) {
          patchNewRecord({ category2: v, category3: '', specification: '' });
        }, 'flex-1 min-w-[100px]'),
        selectField('小類', newRecord.category3, cat3, function (v) {
          patchNewRecord({ category3: v, specification: '' });
        }, 'flex-1 min-w-[120px]'),
        selectField('規格', newRecord.specification, specs, function (v) {
          patchNewRecord({ specification: v });
        }, 'flex-1 min-w-[120px]'),
        h('div', { className: 'w-20' },
          h('span', { className: 'text-xs text-gray-500 block mb-1' }, '積分數'),
          h('div', { className: 'p-2 text-sm text-gray-700 text-center' },
            selectedPm && selectedPm.points != null ? String(selectedPm.points) : '—')
        ),
        h('div', { className: 'flex items-end gap-2' },
          h('div', { className: 'w-20' },
            h('span', { className: 'text-xs text-gray-500 block mb-1' }, '數量'),
            h('input', {
              type: 'number',
              min: '1',
              value: newRecord.qty,
              onChange: function (e) { patchNewRecord({ qty: e.target.value }); },
              className: 'w-full p-2 border rounded outline-none text-sm text-center'
            })
          ),
          h('span', { className: 'text-sm text-gray-600 pb-2 min-w-[2rem]' }, selectedUnit || '—')
        ),
        h('div', { className: 'flex items-end gap-2' },
          h('button', {
            type: 'button',
            onClick: function () {
              props.onAddRecord(selectedPm, newRecord.qty, ProcessMethodUtils.PROCESS_RECORD_STATUS.PENDING);
            },
            className: 'bg-white text-amber-700 border border-amber-400 px-4 py-2 rounded text-sm hover:bg-amber-50 h-[38px]'
          }, '待處理'),
          h('button', {
            type: 'button',
            onClick: function () {
              props.onAddRecord(selectedPm, newRecord.qty, ProcessMethodUtils.PROCESS_RECORD_STATUS.DONE);
            },
            className: 'bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 h-[38px]'
          }, '已處理')
        )
      );
    }

    function renderRows() {
      var records = item.processRecords || [];
      var colCount = pmColumns.length + (readOnly ? 3 : 4);
      if (!records.length) {
        return h('tr', null, h('td', {
          colspan: String(colCount),
          className: 'p-4 text-center text-gray-400'
        }, readOnly
          ? '無處理方式紀錄'
          : (processMethods.length ? '尚未加入處理項目' : '請至系統權限建立處理方式')));
      }
      return ProcessMethodUtils.sortCaseProcessRecords(records).map(function (r, idx) {
        var isDone = ProcessMethodUtils.isCaseRecordDone(r);
        return h('tr', { key: r.id || idx },
          pmColumns.map(function (col) {
            return h('td', { key: col.key, className: 'p-2 pl-4 first:pl-4' }, r[col.key] || '—');
          }),
          h('td', { className: 'p-2' },
            h('span', { className: ProcessMethodUtils.getCaseRecordStatusBadgeClass(r) },
              ProcessMethodUtils.getCaseRecordStatus(r))
          ),
          h('td', { className: 'p-2 ' + (isDone ? '' : 'text-gray-400') },
            formatPoints(r),
            isDone ? null : h('span', { className: 'text-xs text-gray-400 ml-1' }, '不計分')
          ),
          h('td', { className: 'p-2' },
            r.qty,
            r.unit ? h('span', { className: 'text-gray-500 ml-1' }, r.unit) : null
          ),
          readOnly ? null : h('td', { className: 'p-2 text-right pr-4' },
            h('div', { className: 'flex items-center justify-end gap-2' },
              h('button', {
                type: 'button',
                onClick: function () { props.onToggleRecordStatus(r.id); },
                title: isDone ? '轉為待處理' : '轉為已處理',
                className: 'px-2 py-1 rounded border text-xs ' + (isDone
                  ? 'border-amber-400 text-amber-700 hover:bg-amber-50'
                  : 'border-blue-500 text-blue-600 hover:bg-blue-50')
              }, isDone ? '轉待處理' : '轉已處理'),
              h('button', {
                type: 'button',
                onClick: function () { props.onRemoveRecord(r.id); },
                title: '移除此處理方式',
                className: 'text-red-500'
              }, Icons.X({ className: 'h-4 w-4' }))
            )
          )
        );
      });
    }

    function renderReason() {
      if (props.isOther) return null;
      if (readOnly) {
        return h('div', null,
          h('span', { className: 'text-gray-500 block mb-1 text-xs' }, '實際維修原因'),
          h('div', {
            className: 'font-medium p-2.5 rounded-md border bg-gray-50 border-gray-100 min-h-[42px]'
          }, item.actualReason || '-')
        );
      }
      return h('div', null,
        h('label', { className: 'block text-sm mb-1' }, '實際維修原因'),
        h('textarea', {
          value: item.actualReason || '',
          onChange: function (e) { props.onReasonChange(e.target.value); },
          rows: '2',
          className: 'w-full p-2.5 border rounded-md outline-none'
        })
      );
    }

    return h('div', { className: 'border border-gray-200 rounded-lg overflow-hidden mb-4' },
      h('div', { className: 'flex justify-between items-center bg-gray-50 border-b px-4 py-2' },
        h('span', { className: 'font-semibold text-gray-700 text-sm' }, cardTitle(props.index, item)),
        readOnly ? null : h('button', {
          type: 'button',
          onClick: function () { props.onRemoveItem(); },
          className: 'text-red-600 border border-red-200 px-3 py-1 rounded text-sm hover:bg-red-50'
        }, '移除')
      ),
      h('div', { className: 'p-4 space-y-4' },
        h(RepairCaseEquipment.Panel, {
          h: h,
          equipment: item.equipment,
          caseContext: props.caseContext || {},
          deviceCategories: props.deviceCategories,
          emptyText: '此卡片尚未指定設備'
        }),
        renderReason(),
        h('div', null,
          h('span', { className: 'block text-sm font-medium text-gray-700 mb-2' }, '處理方式'),
          readOnly ? null : renderPicker(),
          h('div', { className: 'border rounded-md overflow-x-auto table-scroll-hint' },
            h('table', { className: 'w-full text-left text-sm whitespace-nowrap' },
              h('thead', { className: 'bg-gray-100' },
                h('tr', null,
                  pmColumns.map(function (col) {
                    return h('th', { key: col.key, className: 'p-2 pl-4 first:pl-4' }, col.label);
                  }),
                  h('th', { className: 'p-2' }, '狀態'),
                  h('th', { className: 'p-2' }, '積分數'),
                  h('th', { className: 'p-2' }, '數量'),
                  readOnly ? null : h('th', { className: 'p-2 text-right pr-4' }, '操作')
                )
              ),
              h('tbody', { className: 'divide-y' }, renderRows())
            )
          )
        )
      )
    );
  }

  window.RepairCaseServiceItemCard = RepairCaseServiceItemCard;
})();
