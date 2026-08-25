/*
 * features/repair/case-service-items.js — 叫修案件「設備＋服務項目」卡片集合
 * 一筆設備對應一份服務項目（實際維修原因＋處理方式清單）。
 */
(function () {
  'use strict';

  // 同一毫秒內連續加入多張卡片也要有不同 id，故補一個遞增序號
  var seq = 0;
  function nextId() {
    seq += 1;
    return 'SI' + Date.now() + '-' + seq;
  }

  function deepCopy(value) {
    return value ? JSON.parse(JSON.stringify(value)) : null;
  }

  function createItem(equipment) {
    return {
      id: nextId(),
      equipment: deepCopy(equipment),
      actualReason: '',
      remarks: '',
      processRecords: []
    };
  }

  function normalizeItem(item) {
    item = item || {};
    return {
      id: item.id || nextId(),
      equipment: item.equipment || null,
      actualReason: item.actualReason || '',
      remarks: item.remarks || '',
      processRecords: Array.isArray(item.processRecords) ? item.processRecords.slice() : []
    };
  }

  // 備註改為跟著設備走：案件層級的舊備註併進第一張卡片，且只在所有卡片都還沒有
  // 備註時才併，避免重複遷移蓋掉使用者後來填的內容。沒有卡片就原封不動留在案件層級。
  function mergeLegacyRemarks(items, record) {
    var legacy = record && record.remarks ? String(record.remarks) : '';
    if (!items.length || !legacy.trim()) return items;
    var hasItemRemarks = items.some(function (it) {
      return !!(it.remarks && String(it.remarks).trim());
    });
    if (hasItemRemarks) return items;
    return items.map(function (it, idx) {
      return idx === 0 ? Object.assign({}, it, { remarks: legacy }) : it;
    });
  }

  // 舊案件把設備與服務項目攤在案件層級，摺成單筆卡片；四者皆空視為尚未加入設備。
  function normalizeServiceItems(record) {
    if (!record) return [];
    if (Array.isArray(record.serviceItems)) {
      return mergeLegacyRemarks(record.serviceItems.map(normalizeItem), record);
    }
    var hasLegacy = !!record.equipment
      || !!(record.actualReason && String(record.actualReason).trim())
      || !!(Array.isArray(record.processRecords) && record.processRecords.length);
    if (!hasLegacy) return [];
    return mergeLegacyRemarks([normalizeItem({
      equipment: record.equipment || null,
      actualReason: record.actualReason || '',
      processRecords: record.processRecords || []
    })], record);
  }

  function getItems(c) {
    return (c && Array.isArray(c.serviceItems)) ? c.serviceItems : [];
  }

  function getEquipments(c) {
    return getItems(c).map(function (it) {
      return it.equipment;
    }).filter(function (eq) {
      return !!eq;
    });
  }

  function getAllProcessRecords(c) {
    return getItems(c).reduce(function (acc, it) {
      return acc.concat(it.processRecords || []);
    }, []);
  }

  function hasAnyProcessData(c) {
    return getItems(c).some(function (it) {
      return !!(it.actualReason && String(it.actualReason).trim())
        || !!(it.processRecords && it.processRecords.length > 0);
    });
  }

  function removeItem(c, id) {
    return getItems(c).filter(function (it) {
      return it.id !== id;
    });
  }

  function updateItem(c, id, patch) {
    return getItems(c).map(function (it) {
      return it.id === id ? Object.assign({}, it, patch) : it;
    });
  }

  // 卡片標題（編輯卡片／唯讀明細／PDF／派工明細共用），避免各處各自拼字串走樣
  function formatItemTitle(index, item) {
    var eq = (item && item.equipment) || {};
    var name = eq.deviceName || eq.name || '未指定設備';
    return '設備 ' + (index + 1) + '　' + name + (eq.model ? ' ' + eq.model : '');
  }

  // 實際原因彙整字串（案件列表／紀錄／銷案審核／資料調閱四處共用），
  // 避免各處各自拼字串走樣；沒有卡片或案件為空時回空字串。
  function formatActualReasonSummary(c) {
    return getItems(c).map(function (it) {
      return it.actualReason;
    }).filter(Boolean).join('、');
  }

  window.RepairCaseServiceItems = {
    createItem: createItem,
    normalizeItem: normalizeItem,
    normalizeServiceItems: normalizeServiceItems,
    getItems: getItems,
    getEquipments: getEquipments,
    getAllProcessRecords: getAllProcessRecords,
    hasAnyProcessData: hasAnyProcessData,
    removeItem: removeItem,
    updateItem: updateItem,
    formatItemTitle: formatItemTitle,
    formatActualReasonSummary: formatActualReasonSummary
  };
})();
