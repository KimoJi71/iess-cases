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
      processRecords: []
    };
  }

  function normalizeItem(item) {
    item = item || {};
    return {
      id: item.id || nextId(),
      equipment: item.equipment || null,
      actualReason: item.actualReason || '',
      processRecords: Array.isArray(item.processRecords) ? item.processRecords.slice() : []
    };
  }

  // 舊案件把設備與服務項目攤在案件層級，摺成單筆卡片；三者皆空視為尚未加入設備。
  function normalizeServiceItems(record) {
    if (!record) return [];
    if (Array.isArray(record.serviceItems)) return record.serviceItems.map(normalizeItem);
    var hasLegacy = !!record.equipment
      || !!(record.actualReason && String(record.actualReason).trim())
      || !!(Array.isArray(record.processRecords) && record.processRecords.length);
    if (!hasLegacy) return [];
    return [normalizeItem({
      equipment: record.equipment || null,
      actualReason: record.actualReason || '',
      processRecords: record.processRecords || []
    })];
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

  window.RepairCaseServiceItems = {
    createItem: createItem,
    normalizeItem: normalizeItem,
    normalizeServiceItems: normalizeServiceItems,
    getItems: getItems,
    getEquipments: getEquipments,
    getAllProcessRecords: getAllProcessRecords,
    hasAnyProcessData: hasAnyProcessData,
    removeItem: removeItem,
    updateItem: updateItem
  };
})();
