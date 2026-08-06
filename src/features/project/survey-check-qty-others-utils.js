/*
 * features/project/survey-check-qty-others-utils.js
 * 現勘表「多選＋數量」可多筆其他：遷移／CRUD／PDF 格式化
 * 對外：window.SurveyCheckQtyOthersUtils
 */
(function () {
  'use strict';

  var GROUPS = [
    { checkName: 'copperSizes', qtyMapName: 'copperSizesQty' },
    { checkName: 'copperFittings', qtyMapName: 'copperFittingsQty' },
    { checkName: 'pvcDrain', qtyMapName: 'pvcDrainQty' },
    { checkName: 'drainInsulation', qtyMapName: 'drainInsulationQty' },
    { checkName: 'chilledFittings', qtyMapName: 'chilledFittingsQty' },
    { checkName: 'chilledPipe', qtyMapName: 'chilledPipeQty' },
    { checkName: 'chilledInsulation', qtyMapName: 'chilledInsulationQty' },
    { checkName: 'channelFittings', qtyMapName: 'channelFittingsQty' },
    { checkName: 'controlSignalWire', qtyMapName: 'controlSignalWireQty' },
    { checkName: 'powerCableWire', qtyMapName: 'powerCableWireQty' },
    { checkName: 'insulatedHose', qtyMapName: 'insulatedHoseQty' },
    { checkName: 'uninsulatedHose', qtyMapName: 'uninsulatedHoseQty' },
    { checkName: 'ventOutlets', qtyMapName: 'ventOutletsQty' },
    { checkName: 'parts', qtyMapName: 'partsQty' }
  ];

  var _idSeq = 0;
  function newId() {
    _idSeq += 1;
    return 'o_' + Date.now().toString(36) + '_' + _idSeq;
  }

  function othersKey(checkName) {
    return checkName + 'Others';
  }

  function getOthers(sd, checkName) {
    var key = othersKey(checkName);
    return Array.isArray(sd && sd[key]) ? sd[key] : [];
  }

  function hasLegacyOther(sd, checkName, qtyMapName) {
    var selected = sd[checkName];
    var qtyMap = sd[qtyMapName] || {};
    var otherText = sd[checkName + '_other'];
    return (Array.isArray(selected) && selected.indexOf('其他') !== -1) ||
      (otherText != null && String(otherText) !== '') ||
      (qtyMap['其他'] != null && String(qtyMap['其他']) !== '');
  }

  function clearLegacyOther(sd, checkName, qtyMapName) {
    if (Array.isArray(sd[checkName])) {
      sd[checkName] = sd[checkName].filter(function (v) { return v !== '其他'; });
    }
    delete sd[checkName + '_other'];
    if (sd[qtyMapName] && Object.prototype.hasOwnProperty.call(sd[qtyMapName], '其他')) {
      var m = Object.assign({}, sd[qtyMapName]);
      delete m['其他'];
      sd[qtyMapName] = m;
    }
  }

  function migrateOne(sd, checkName, qtyMapName) {
    var key = othersKey(checkName);
    var existing = sd[key];
    var hasOthersArray = Array.isArray(existing);
    if (!hasOthersArray && hasLegacyOther(sd, checkName, qtyMapName)) {
      var qtyMap = sd[qtyMapName] || {};
      sd[key] = [{
        id: newId(),
        label: sd[checkName + '_other'] != null ? String(sd[checkName + '_other']) : '',
        qty: qtyMap['其他'] != null ? String(qtyMap['其他']) : ''
      }];
    } else if (!hasOthersArray) {
      // leave undefined until user adds
    }
    if (hasLegacyOther(sd, checkName, qtyMapName) || hasOthersArray) {
      clearLegacyOther(sd, checkName, qtyMapName);
    }
  }

  function migrateSurveyData(sd) {
    if (!sd || typeof sd !== 'object') return sd || {};
    GROUPS.forEach(function (g) {
      migrateOne(sd, g.checkName, g.qtyMapName);
    });
    return sd;
  }

  function addOther(sd, checkName) {
    var key = othersKey(checkName);
    var list = (Array.isArray(sd[key]) ? sd[key] : []).slice();
    var row = { id: newId(), label: '', qty: '' };
    list.push(row);
    sd[key] = list;
    return row;
  }

  function updateOther(sd, checkName, id, patch) {
    var key = othersKey(checkName);
    var list = (Array.isArray(sd[key]) ? sd[key] : []).map(function (row) {
      if (row.id !== id) return row;
      return Object.assign({}, row, patch, { id: row.id });
    });
    sd[key] = list;
  }

  function removeOther(sd, checkName, id) {
    var key = othersKey(checkName);
    sd[key] = (Array.isArray(sd[key]) ? sd[key] : []).filter(function (row) {
      return row.id !== id;
    });
  }

  function formatOtherItem(item, unit) {
    if (!item) return '其他';
    var label = item.label != null ? String(item.label).trim() : '';
    var qty = item.qty != null ? String(item.qty).trim() : '';
    var u = unit || '';
    if (label && qty) return '其他：' + label + ' ' + qty + u;
    if (label) return '其他：' + label;
    if (qty) return '其他 ' + qty + u;
    return '其他';
  }

  function formatOthersList(others, unit) {
    if (!Array.isArray(others) || !others.length) return '';
    return others.map(function (item) {
      return formatOtherItem(item, unit);
    }).join('、');
  }

  window.SurveyCheckQtyOthersUtils = {
    GROUPS: GROUPS,
    othersKey: othersKey,
    newId: newId,
    migrateSurveyData: migrateSurveyData,
    getOthers: getOthers,
    addOther: addOther,
    updateOther: updateOther,
    removeOther: removeOther,
    formatOtherItem: formatOtherItem,
    formatOthersList: formatOthersList
  };
})();
