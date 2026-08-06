/*
 * features/project/survey-vent-linear-sizes-utils.js
 * 現勘表線型出風口多筆寬高數量：遷移／CRUD／PDF 格式化
 * 對外：window.SurveyVentLinearSizesUtils
 */
(function () {
  'use strict';

  var SIZES_KEY = 'ventLinearSizes';
  var LABEL = '線型出風口';
  var QTY_MAP = 'ventOutletsQty';

  var _idSeq = 0;
  function newId() {
    _idSeq += 1;
    return 'ls_' + Date.now().toString(36) + '_' + _idSeq;
  }

  function getSizes(sd) {
    return Array.isArray(sd && sd[SIZES_KEY]) ? sd[SIZES_KEY] : [];
  }

  function ensureLinearChecked(sd) {
    var selected = Array.isArray(sd.ventOutlets) ? sd.ventOutlets.slice() : [];
    if (selected.indexOf(LABEL) === -1) {
      selected.push(LABEL);
      sd.ventOutlets = selected;
    }
  }

  function isLinearChecked(sd) {
    return Array.isArray(sd.ventOutlets) && sd.ventOutlets.indexOf(LABEL) !== -1;
  }

  function hasLegacyLinear(sd) {
    var qtyMap = sd[QTY_MAP] || {};
    var hasQty = qtyMap[LABEL] != null && String(qtyMap[LABEL]) !== '';
    var hasW = sd.ventLinearWidth != null && String(sd.ventLinearWidth) !== '';
    var hasH = sd.ventLinearHeight != null && String(sd.ventLinearHeight) !== '';
    return hasQty || hasW || hasH;
  }

  function clearLegacyLinear(sd) {
    delete sd.ventLinearWidth;
    delete sd.ventLinearHeight;
    if (sd[QTY_MAP] && Object.prototype.hasOwnProperty.call(sd[QTY_MAP], LABEL)) {
      var m = Object.assign({}, sd[QTY_MAP]);
      delete m[LABEL];
      sd[QTY_MAP] = m;
    }
  }

  function addSize(sd) {
    var list = getSizes(sd).slice();
    var row = { id: newId(), width: '', height: '', qty: '' };
    list.push(row);
    sd[SIZES_KEY] = list;
    return row;
  }

  function updateSize(sd, id, patch) {
    sd[SIZES_KEY] = getSizes(sd).map(function (row) {
      if (row.id !== id) return row;
      return Object.assign({}, row, patch, { id: row.id });
    });
  }

  function removeSize(sd, id) {
    sd[SIZES_KEY] = getSizes(sd).filter(function (row) {
      return row.id !== id;
    });
  }

  function ensureBlankIfChecked(sd) {
    if (!sd || typeof sd !== 'object') return;
    if (!isLinearChecked(sd)) return;
    if (getSizes(sd).length === 0) addSize(sd);
  }

  function migrateSurveyData(sd) {
    if (!sd || typeof sd !== 'object') return sd || {};
    var hasArray = Array.isArray(sd[SIZES_KEY]);

    if (!hasArray && hasLegacyLinear(sd)) {
      var qtyMap = sd[QTY_MAP] || {};
      sd[SIZES_KEY] = [{
        id: newId(),
        width: sd.ventLinearWidth != null ? String(sd.ventLinearWidth) : '',
        height: sd.ventLinearHeight != null ? String(sd.ventLinearHeight) : '',
        qty: qtyMap[LABEL] != null ? String(qtyMap[LABEL]) : ''
      }];
      ensureLinearChecked(sd);
    }

    clearLegacyLinear(sd);
    ensureBlankIfChecked(sd);
    return sd;
  }

  function formatSizeItem(item) {
    if (!item) return LABEL;
    var w = item.width != null ? String(item.width).trim() : '';
    var h = item.height != null ? String(item.height).trim() : '';
    var qty = item.qty != null ? String(item.qty).trim() : '';
    var text = LABEL + (qty ? ' ' + qty + '個' : '');
    if (w || h) {
      text += '（' + w + '×' + h + ' cm）';
    }
    return text;
  }

  function formatSizesList(sizes) {
    if (!Array.isArray(sizes) || !sizes.length) return '';
    return sizes.map(formatSizeItem).join('、');
  }

  window.SurveyVentLinearSizesUtils = {
    SIZES_KEY: SIZES_KEY,
    LABEL: LABEL,
    newId: newId,
    getSizes: getSizes,
    addSize: addSize,
    updateSize: updateSize,
    removeSize: removeSize,
    ensureBlankIfChecked: ensureBlankIfChecked,
    migrateSurveyData: migrateSurveyData,
    formatSizeItem: formatSizeItem,
    formatSizesList: formatSizesList
  };
})();
