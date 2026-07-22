/*
 * features/repair/case-equipment.js — 叫修案件設備資料：欄位定義與共用顯示
 */
(function () {
  'use strict';

  var FIELD_DEFS = [
    { key: 'customerName', label: '客戶名稱', caseFallback: 'customerName' },
    { key: 'storeName', label: '門市名稱', caseFallback: 'storeName' },
    { key: 'category', label: '設備分類' },
    { key: 'brand', label: '品牌' },
    { key: 'deviceName', label: '設備名稱', altKey: 'name' },
    { key: 'specification', label: '設備規格' },
    { key: 'model', label: '型號' },
    { key: 'area', label: '設備區域' },
    { key: 'manufactureDate', label: '出廠日期' },
    { key: 'installDate', label: '安裝日期' },
    { key: 'assetNumber', label: '資產編號' },
    { key: 'status', label: '設備狀態' }
  ];

  function getFieldValue(equipment, caseContext, def) {
    equipment = equipment || {};
    caseContext = caseContext || {};
    var val = equipment[def.key];
    if (!val && def.altKey) val = equipment[def.altKey];
    if (!val && def.caseFallback) val = caseContext[def.caseFallback];
    return val ? String(val).trim() : '';
  }

  function getDisplayFields(equipment, caseContext) {
    return FIELD_DEFS.map(function (def) {
      return {
        label: def.label,
        value: getFieldValue(equipment, caseContext, def)
      };
    });
  }

  function findEquipmentForScan(equipments, formData) {
    if (!equipments || !equipments.length) return null;
    var customerName = String(formData.customerName || '').trim();
    var storeName = String(formData.storeName || '').trim();
    var matched = equipments.filter(function (eq) {
      return eq.customerName === customerName && eq.storeName === storeName;
    });
    var source = matched.length ? matched[0] : equipments[0];
    return Object.assign({}, source);
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

    var fields = getDisplayFields(equipment, caseContext);
    return h('div', { className: gridClass },
      fields.map(function (field) {
        if (FieldComponent) {
          return h(FieldComponent, { key: field.label, label: field.label, value: field.value });
        }
        return h('div', { key: field.label },
          h('span', { className: 'text-gray-500 block mb-1 text-xs' }, field.label),
          h('div', {
            className: 'font-medium bg-gray-50 p-2.5 rounded-md border border-gray-100 min-h-[42px] flex items-center'
          }, field.value || '-')
        );
      })
    );
  }

  window.RepairCaseEquipment = {
    FIELD_DEFS: FIELD_DEFS,
    getFieldValue: getFieldValue,
    getDisplayFields: getDisplayFields,
    findEquipmentForScan: findEquipmentForScan,
    Panel: Panel
  };
})();
