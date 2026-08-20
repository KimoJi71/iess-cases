/*
 * features/project/survey-duct-box-combos-utils.js
 * 現勘表風箱多組合：遷移／CRUD／PDF 格式化
 * 對外：window.SurveyDuctBoxCombosUtils
 */
(function () {
  'use strict';

  var PREFIXES = [
    { prefix: 'ductHose', hasFlangeHoles: false, qtyUnit: '米' },
    { prefix: 'collectBox', hasFlangeHoles: true, qtyUnit: '個' },
    { prefix: 'outletBox', hasFlangeHoles: true, qtyUnit: '個' },
    { prefix: 'returnBox', hasFlangeHoles: true, qtyUnit: '個' },
    { prefix: 'forcedReturnBox', hasFlangeHoles: true, qtyUnit: '個' },
    { prefix: 'teeBox', hasFlangeHoles: false, qtyUnit: '個' },
    { prefix: 'embeddedBox', hasFlangeHoles: false, qtyUnit: '個' }
  ];

  var HOSE_LEGACY_GROUPS = [
    { material: '保溫軟管(玻璃棉)', checkName: 'insulatedHose', qtyMapName: 'insulatedHoseQty' },
    { material: '無保溫軟管(鋁箔)', checkName: 'uninsulatedHose', qtyMapName: 'uninsulatedHoseQty' }
  ];

  var HOSE_TEXT_LEGACY = [
    { material: '螺旋風管(鍍鋅鐵)', field: 'spiralDuct' },
    { material: '防火保溫軟管(玻璃棉)', field: 'fireInsulatedHose' }
  ];

  var _idSeq = 0;
  function newId() {
    _idSeq += 1;
    return 'db_' + Date.now().toString(36) + '_' + _idSeq;
  }

  function combosKey(prefix) {
    return prefix + 'Combos';
  }

  function findMeta(prefix) {
    for (var i = 0; i < PREFIXES.length; i++) {
      if (PREFIXES[i].prefix === prefix) return PREFIXES[i];
    }
    return { prefix: prefix, hasFlangeHoles: true, qtyUnit: '個' };
  }

  function blankRow(hasFlangeHoles) {
    var row = {
      id: newId(),
      material: '',
      materialOther: '',
      pipe: '',
      pipeOther: '',
      qty: ''
    };
    if (hasFlangeHoles) {
      row.flangeWidth = '';
      row.flangeHeight = '';
      row.holes = '';
    }
    return row;
  }

  function getCombos(sd, prefix) {
    var key = combosKey(prefix);
    return Array.isArray(sd && sd[key]) ? sd[key] : [];
  }

  function addCombo(sd, prefix) {
    var meta = findMeta(prefix);
    var list = getCombos(sd, prefix).slice();
    var row = blankRow(meta.hasFlangeHoles);
    list.push(row);
    sd[combosKey(prefix)] = list;
    return row;
  }

  function updateCombo(sd, prefix, id, patch) {
    var key = combosKey(prefix);
    sd[key] = getCombos(sd, prefix).map(function (row) {
      if (row.id !== id) return row;
      return Object.assign({}, row, patch, { id: row.id });
    });
  }

  function removeCombo(sd, prefix, id) {
    var key = combosKey(prefix);
    sd[key] = getCombos(sd, prefix).filter(function (row) {
      return row.id !== id;
    });
  }

  function ensureBlank(sd, prefix) {
    if (!sd || typeof sd !== 'object') return;
    if (getCombos(sd, prefix).length === 0) addCombo(sd, prefix);
  }

  function str(v) {
    return v != null ? String(v) : '';
  }

  function hasLegacy(sd, prefix) {
    if (sd[prefix + 'Material'] != null && str(sd[prefix + 'Material']) !== '') return true;
    if (sd[prefix + 'Material_other'] != null && str(sd[prefix + 'Material_other']) !== '') return true;
    if (sd[prefix + 'FlangeWidth'] != null && str(sd[prefix + 'FlangeWidth']) !== '') return true;
    if (sd[prefix + 'FlangeHeight'] != null && str(sd[prefix + 'FlangeHeight']) !== '') return true;
    if (Array.isArray(sd[prefix + 'Pipes']) && sd[prefix + 'Pipes'].length) return true;
    var holes = sd[prefix + 'PipesHoles'];
    if (holes && typeof holes === 'object' && Object.keys(holes).length) return true;
    var qty = sd[prefix + 'PipesQty'];
    if (qty && typeof qty === 'object' && Object.keys(qty).length) return true;
    return false;
  }

  function clearLegacy(sd, prefix) {
    delete sd[prefix + 'Material'];
    delete sd[prefix + 'Material_other'];
    delete sd[prefix + 'FlangeWidth'];
    delete sd[prefix + 'FlangeHeight'];
    delete sd[prefix + 'Pipes'];
    delete sd[prefix + 'PipesHoles'];
    delete sd[prefix + 'PipesQty'];
  }

  function migrateOne(sd, prefix, hasFlangeHoles) {
    var key = combosKey(prefix);
    var hasArray = Array.isArray(sd[key]);

    if (!hasArray && hasLegacy(sd, prefix)) {
      var material = str(sd[prefix + 'Material']);
      var materialOther = str(sd[prefix + 'Material_other']);
      var fw = str(sd[prefix + 'FlangeWidth']);
      var fh = str(sd[prefix + 'FlangeHeight']);
      var pipes = Array.isArray(sd[prefix + 'Pipes']) ? sd[prefix + 'Pipes'] : [];
      var holesMap = sd[prefix + 'PipesHoles'] || {};
      var qtyMap = sd[prefix + 'PipesQty'] || {};
      var rows = [];

      if (pipes.length) {
        pipes.forEach(function (p) {
          var row = {
            id: newId(),
            material: material,
            materialOther: materialOther,
            pipe: str(p),
            qty: qtyMap[p] != null ? str(qtyMap[p]) : ''
          };
          if (hasFlangeHoles) {
            row.flangeWidth = fw;
            row.flangeHeight = fh;
            row.holes = holesMap[p] != null ? str(holesMap[p]) : '';
          }
          rows.push(row);
        });
      } else {
        var empty = {
          id: newId(),
          material: material,
          materialOther: materialOther,
          pipe: '',
          qty: ''
        };
        if (hasFlangeHoles) {
          empty.flangeWidth = fw;
          empty.flangeHeight = fh;
          empty.holes = '';
        }
        rows.push(empty);
      }
      sd[key] = rows;
    }

    clearLegacy(sd, prefix);
    ensureBlank(sd, prefix);
  }

  function hoseRow(material, pipe, qty) {
    return {
      id: newId(),
      material: material || '',
      materialOther: '',
      pipe: pipe || '',
      qty: qty || ''
    };
  }

  function collectHoseLegacyRows(sd, group) {
    var rows = [];
    var selected = Array.isArray(sd[group.checkName]) ? sd[group.checkName] : [];
    var qtyMap = sd[group.qtyMapName] || {};
    selected.forEach(function (label) {
      if (label === '其他') return;
      rows.push(hoseRow(group.material, str(label), qtyMap[label] != null ? str(qtyMap[label]) : ''));
    });
    var others = Array.isArray(sd[group.checkName + 'Others']) ? sd[group.checkName + 'Others'] : [];
    if (others.length) {
      others.forEach(function (o) {
        var label = str(o && o.label);
        var qty = o && o.qty != null ? str(o.qty) : '';
        if (!label && !qty) return;
        rows.push(hoseRow(group.material, label, qty));
      });
    } else if (
      selected.indexOf('其他') !== -1 ||
      str(sd[group.checkName + '_other']) ||
      (qtyMap['其他'] != null && str(qtyMap['其他']))
    ) {
      rows.push(hoseRow(
        group.material,
        str(sd[group.checkName + '_other']),
        qtyMap['其他'] != null ? str(qtyMap['其他']) : ''
      ));
    }
    return rows;
  }

  function hasHoseLegacy(sd) {
    var i;
    for (i = 0; i < HOSE_LEGACY_GROUPS.length; i++) {
      var g = HOSE_LEGACY_GROUPS[i];
      if (Array.isArray(sd[g.checkName]) && sd[g.checkName].length) return true;
      var qtyMap = sd[g.qtyMapName];
      if (qtyMap && typeof qtyMap === 'object' && Object.keys(qtyMap).length) return true;
      if (Array.isArray(sd[g.checkName + 'Others']) && sd[g.checkName + 'Others'].length) return true;
      if (str(sd[g.checkName + '_other'])) return true;
    }
    for (i = 0; i < HOSE_TEXT_LEGACY.length; i++) {
      if (str(sd[HOSE_TEXT_LEGACY[i].field])) return true;
    }
    return false;
  }

  function clearHoseLegacy(sd) {
    HOSE_LEGACY_GROUPS.forEach(function (g) {
      delete sd[g.checkName];
      delete sd[g.qtyMapName];
      delete sd[g.checkName + 'Others'];
      delete sd[g.checkName + '_other'];
    });
    HOSE_TEXT_LEGACY.forEach(function (g) {
      delete sd[g.field];
    });
  }

  function migrateHoseLegacy(sd) {
    var key = combosKey('ductHose');
    if (!Array.isArray(sd[key]) && hasHoseLegacy(sd)) {
      var rows = [];
      HOSE_LEGACY_GROUPS.forEach(function (g) {
        rows = rows.concat(collectHoseLegacyRows(sd, g));
      });
      HOSE_TEXT_LEGACY.forEach(function (g) {
        var text = str(sd[g.field]);
        if (text) rows.push(hoseRow(g.material, '', text));
      });
      sd[key] = rows;
    }
    clearHoseLegacy(sd);
  }

  function migrateSurveyData(sd) {
    if (!sd || typeof sd !== 'object') return sd || {};
    migrateHoseLegacy(sd);
    PREFIXES.forEach(function (meta) {
      migrateOne(sd, meta.prefix, meta.hasFlangeHoles);
    });
    return sd;
  }

  function formatCombo(item, opts) {
    if (!item) return '';
    opts = opts || {};
    var hasFlangeHoles = opts.hasFlangeHoles !== false;
    var qtyUnit = opts.qtyUnit || '個';
    var parts = [];
    var material = item.material != null ? String(item.material).trim() : '';
    if (material && !opts.omitMaterial) {
      var matDisplay = material;
      if (material === '其他') {
        var other = item.materialOther != null ? String(item.materialOther).trim() : '';
        matDisplay = other || '其他';
      }
      parts.push('材質：' + matDisplay);
    }
    if (hasFlangeHoles) {
      var fw = item.flangeWidth != null ? String(item.flangeWidth).trim() : '';
      var fh = item.flangeHeight != null ? String(item.flangeHeight).trim() : '';
      if (fw || fh) parts.push('法蘭內徑 ' + fw + '×' + fh + ' cm');
    }
    var pipe = item.pipe != null ? String(item.pipe).trim() : '';
    if (pipe === '其他') {
      var pipeOther = item.pipeOther != null ? String(item.pipeOther).trim() : '';
      pipe = pipeOther || '其他';
    }
    var pipePart = pipe;
    if (hasFlangeHoles) {
      var holes = item.holes != null ? String(item.holes).trim() : '';
      if (holes) pipePart += (pipePart ? ' ' : '') + holes + '孔';
    }
    var qty = item.qty != null ? String(item.qty).trim() : '';
    if (qty) pipePart += (pipePart ? ' ' : '') + qty + qtyUnit;
    if (pipePart) parts.push(pipePart);
    return parts.join('；');
  }

  function formatCombosList(sd, prefix, opts) {
    opts = opts || {};
    var meta = findMeta(prefix);
    var list = getCombos(sd, prefix);
    if (opts.material) {
      list = list.filter(function (item) {
        return item && item.material === opts.material;
      });
    }
    if (!list.length) return '';
    var formatOpts = {
      hasFlangeHoles: meta.hasFlangeHoles,
      qtyUnit: meta.qtyUnit || '個',
      omitMaterial: !!opts.omitMaterial
    };
    return list
      .map(function (item) {
        return formatCombo(item, formatOpts);
      })
      .filter(function (t) {
        return t;
      })
      .join('；');
  }

  window.SurveyDuctBoxCombosUtils = {
    PREFIXES: PREFIXES,
    combosKey: combosKey,
    newId: newId,
    getCombos: getCombos,
    addCombo: addCombo,
    updateCombo: updateCombo,
    removeCombo: removeCombo,
    ensureBlank: ensureBlank,
    migrateSurveyData: migrateSurveyData,
    formatCombo: formatCombo,
    formatCombosList: formatCombosList
  };
})();
