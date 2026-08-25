/*
 * features/repair/case-equipment.js — 叫修案件設備資料：欄位定義與共用顯示
 */
(function () {
  'use strict';

  // 欄位與「設備管理」列表一致；客戶／門市已在案件標頭，不再逐列重複
  var FIELD_DEFS = [
    { key: 'category', label: '設備分類' },
    { key: 'brand', label: '品牌' },
    { key: 'deviceName', label: '設備名稱', altKey: 'name' },
    { key: 'specification', label: '設備規格' },
    { key: 'model', label: '型號' },
    // 設備等級由設備管理設定，隨設備快照存進案件資料
    { key: 'equipmentLevel', label: '設備等級', derived: true },
    { key: 'area', label: '設備區域' },
    { key: 'acceptanceDate', label: '驗收日期' },
    { key: 'installer', label: '安裝人員' },
    { key: 'assetNumber', label: '資產編號' },
    { key: 'serialNumber', label: '流水序號' },
    { key: 'status', label: '設備狀態' }
  ];

  function getFieldValue(equipment, caseContext, def, deviceCategories) {
    equipment = equipment || {};
    caseContext = caseContext || {};
    if (def.derived && def.key === 'equipmentLevel') {
      return EquipmentUtils.formatLevel(equipment);
    }
    var val = equipment[def.key];
    if (!val && def.altKey) val = equipment[def.altKey];
    if (!val && def.caseFallback) val = caseContext[def.caseFallback];
    return val ? String(val).trim() : '';
  }

  function getDisplayFields(equipment, caseContext, deviceCategories) {
    return FIELD_DEFS.map(function (def) {
      var field = {
        label: def.label,
        value: getFieldValue(equipment, caseContext, def, deviceCategories)
      };
      // 達年限的設備狀態以紅字提醒
      if (def.key === 'status') {
        field.value = EquipmentUtils.normalizeStatus(field.value);
        if (EquipmentUtils.isOverAge(equipment)) field.tone = 'danger';
      }
      return field;
    });
  }

  function listForCase(equipments, formData) {
    var customerName = String((formData && formData.customerName) || '').trim();
    var storeName = String((formData && formData.storeName) || '').trim();
    if (!customerName || !storeName) return [];
    return (equipments || []).filter(function (eq) {
      return String(eq.customerName || '').trim() === customerName
        && String(eq.storeName || '').trim() === storeName;
    });
  }

  function normalizeAddedIds(addedIds) {
    return (addedIds || []).map(String);
  }

  // 同一筆設備在同一張案件只能出現一次
  function isAdded(equipment, addedIds) {
    if (!equipment) return false;
    return normalizeAddedIds(addedIds).indexOf(String(equipment.id)) !== -1;
  }

  // 已汰換與已加入本案件的設備都不可再被加入，掃描時一併排除
  function isSelectable(equipment, addedIds) {
    return !EquipmentUtils.isRetired(equipment) && !isAdded(equipment, addedIds);
  }

  // 掃描只在本案件的客戶／門市內取件；沒有可用的就回傳 null，不跨門市撈設備
  function findEquipmentForScan(equipments, formData, addedIds) {
    if (!equipments || !equipments.length) return null;
    var matched = listForCase(equipments, formData).filter(function (eq) {
      return isSelectable(eq, addedIds);
    });
    return matched.length ? Object.assign({}, matched[0]) : null;
  }

  function PickerModal(props) {
    var h = props.h || IESS.h;
    var Icons = IESS.Icons;
    var items = (props.items || []).slice().sort(function (a, b) {
      return new Date(b.createdDate) - new Date(a.createdDate);
    });
    var onSelect = props.onSelect;
    var onClose = props.onClose;
    var addedIds = normalizeAddedIds(props.addedIds);
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
        items.length === 0
          ? h('div', {
              className: 'p-8 text-center text-gray-400 border border-dashed rounded-md'
            }, '此門市尚無設備資料')
          : h('div', { className: 'overflow-x-auto border rounded-lg' },
              h('table', { className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap' },
                h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
                  h('tr', null,
                    h('th', { className: 'p-3 font-semibold text-center w-24' }, '操作'),
                    EquipmentUtils.renderListHeaderCells(h)
                  )
                ),
                h('tbody', { className: 'divide-y divide-gray-100' },
                  items.map(function (eq) {
                    // 達年限已由設備狀態的紅色標籤標示，整列不再上色
                    var retired = EquipmentUtils.isRetired(eq);
                    var added = isAdded(eq, addedIds);
                    var disabled = retired || added;
                    return h('tr', {
                      key: eq.id,
                      className: 'transition-colors ' + (
                        disabled ? 'bg-gray-50 text-gray-400' : 'hover:bg-blue-50/50'
                      )
                    },
                      h('td', { className: 'p-3 text-center' },
                        disabled
                          ? h('span', {
                              className: 'px-3 py-1.5 bg-gray-100 text-gray-400 rounded-md text-sm cursor-not-allowed',
                              title: retired ? '已汰換的設備無法加入' : '已加入此案件'
                            }, retired ? '已汰換' : '已加入')
                          : h('button', {
                              type: 'button',
                              onClick: function () { onSelect(eq); },
                              className: 'px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm'
                            }, '選擇')
                      ),
                      EquipmentUtils.renderListDataCells(h, eq)
                    );
                  })
                )
              )
            ),
        h('div', { className: 'mt-4 flex justify-end' },
          h('button', {
            type: 'button',
            onClick: onClose,
            className: 'px-4 py-2 border rounded-md'
          }, '取消')
        )
      )
    );
  }

  function Panel(props) {
    var h = props.h || IESS.h;
    var equipment = props.equipment;
    var caseContext = props.caseContext || {};
    var emptyText = props.emptyText || '無設備資料';
    var emptyClass = props.emptyClass || 'text-center py-4 text-gray-400 bg-gray-50 rounded-md border border-dashed';
    var gridClass = props.gridClass || 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-green-50/50 p-4 rounded-md border border-green-100';
    var FieldComponent = props.FieldComponent;

    if (!equipment) {
      return h('div', { className: emptyClass }, emptyText);
    }

    var fields = getDisplayFields(equipment, caseContext, props.deviceCategories);
    return h('div', { className: gridClass },
      fields.map(function (field) {
        if (FieldComponent) {
          return h(FieldComponent, { key: field.label, label: field.label, value: field.value });
        }
        return h('div', { key: field.label },
          h('span', { className: 'text-gray-500 block mb-1 text-xs' }, field.label),
          h('div', {
            className: 'font-medium p-2.5 rounded-md border min-h-[42px] flex items-center ' + (
              field.tone === 'danger'
                ? 'bg-red-50 border-red-100 text-red-600'
                : 'bg-gray-50 border-gray-100'
            )
          }, field.value || '-')
        );
      })
    );
  }

  window.RepairCaseEquipment = {
    FIELD_DEFS: FIELD_DEFS,
    getFieldValue: getFieldValue,
    getDisplayFields: getDisplayFields,
    listForCase: listForCase,
    isAdded: isAdded,
    isSelectable: isSelectable,
    findEquipmentForScan: findEquipmentForScan,
    PickerModal: PickerModal,
    Panel: Panel
  };
})();
