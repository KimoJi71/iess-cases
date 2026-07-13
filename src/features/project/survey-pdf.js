/*
 * features/project/survey-pdf.js — 現勘表 PDF 匯出（A4 排版）
 * 對外：window.exportSurveyPdf(surveyCase, onError?)
 */
(function () {
  'use strict';

  var PDF_STYLES = [
    '@page { size: A4; margin: 12mm; }',
    '.survey-pdf { font-family: "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif; font-size: 11px; color: #000; line-height: 1.35; }',
    '.survey-pdf * { box-sizing: border-box; }',
    '.survey-pdf .pdf-title { font-size: 22px; font-weight: 700; margin: 0 0 4px; }',
    '.survey-pdf .pdf-sub { font-size: 11px; margin-bottom: 8px; }',
    '.survey-pdf .pdf-meta { text-align: right; font-size: 11px; margin-bottom: 10px; }',
    '.survey-pdf table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 10px; }',
    '.survey-pdf th, .survey-pdf td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; word-break: break-word; }',
    '.survey-pdf .lbl { background: #f7f7f7; font-weight: 600; white-space: nowrap; }',
    '.survey-pdf .sec { text-align: center; font-weight: 700; background: #efefef; }',
    '.survey-pdf .empty { min-height: 18px; }',
    '.survey-pdf .page-break { page-break-before: always; }',
    '.survey-pdf .nested td { padding: 3px 5px; }'
  ].join('\n');

  function val(v) {
    return v != null && v !== '' ? String(v) : '';
  }

  function arrVal(arr) {
    return Array.isArray(arr) && arr.length ? arr.join('、') : '';
  }

  function fmtDate(d) {
    if (!d) return '';
    var parts = String(d).split('-');
    if (parts.length === 3) return parts[0] + '/' + parts[1] + '/' + parts[2];
    return d;
  }

  function fmtDateTime(d) {
    var now = new Date();
    var dateStr = d ? fmtDate(d) : fmtDate(now.toISOString().split('T')[0]);
    var h = now.getHours();
    var m = String(now.getMinutes()).padStart(2, '0');
    var s = String(now.getSeconds()).padStart(2, '0');
    var ampm = h >= 12 ? '下午' : '上午';
    var h12 = h % 12 || 12;
    return dateStr + ' ' + ampm + ' ' + h12 + ':' + m + ':' + s;
  }

  function fmtCheckQtyFromMaps(checkName, qtyMapName, sd, unit) {
    var selected = sd[checkName];
    var qtyMap = sd[qtyMapName];
    if (!Array.isArray(selected) || !selected.length) return '';
    return selected.map(function (label) {
      var display = label;
      if (label === '其他') {
        display = sd[checkName + '_other'] || '其他';
      }
      var qty = qtyMap && qtyMap[label];
      return qty ? display + ' ' + qty + (unit || '') : display;
    }).join('、');
  }

  function fmtDuctBox(prefix, sd) {
    var parts = [];
    var mat = sd[prefix + 'Material'];
    if (mat) {
      parts.push('材質：' + (mat === '其他' ? sd[prefix + 'Material_other'] || mat : mat));
    }
    var fw = sd[prefix + 'FlangeWidth'];
    var fh = sd[prefix + 'FlangeHeight'];
    if (fw || fh) parts.push('法蘭內徑 ' + val(fw) + '×' + val(fh) + ' cm');
    var pipes = sd[prefix + 'Pipes'];
    var holes = sd[prefix + 'PipesHoles'];
    var qty = sd[prefix + 'PipesQty'];
    if (Array.isArray(pipes) && pipes.length) {
      pipes.forEach(function (p) {
        var line = p;
        if (holes && holes[p]) line += ' ' + holes[p] + '孔';
        if (qty && qty[p]) line += ' ' + qty[p] + '個';
        parts.push(line);
      });
    } else if (Array.isArray(pipes) === false && prefix === 'teeBox') {
      var teePipes = sd.teeBoxPipes;
      var teeQty = sd.teeBoxPipesQty;
      if (Array.isArray(teePipes)) {
        teePipes.forEach(function (p) {
          parts.push(p + (teeQty && teeQty[p] ? ' ' + teeQty[p] + '個' : ''));
        });
      }
    }
    return parts.join('；');
  }

  function fmtVentOutlets(sd) {
    var selected = sd.ventOutlets;
    if (!Array.isArray(selected) || !selected.length) return '';
    var qtyMap = sd.ventOutletsQty || {};
    return selected.map(function (label) {
      var display = label === '其他' ? (sd.ventOutlets_other || '其他') : label;
      var qty = qtyMap[label];
      var text = display + (qty ? ' ' + qty + '個' : '');
      if (label.indexOf('線型') >= 0 && (sd.ventLinearWidth || sd.ventLinearHeight)) {
        text += '（' + val(sd.ventLinearWidth) + '×' + val(sd.ventLinearHeight) + ' cm）';
      }
      return text;
    }).join('、');
  }

  function fmtEquipmentList(list) {
    if (!Array.isArray(list) || !list.length) return '';
    return list.map(function (eq, i) {
      return [
        eq.category,
        eq.brand,
        eq.name,
        eq.model,
        eq.area ? '區域:' + eq.area : ''
      ].filter(Boolean).join(' ');
    }).join('；');
  }

  function fmtParts(sd) {
    var selected = sd.parts;
    if (!Array.isArray(selected) || !selected.length) return '';
    var qtyMap = sd.partsQty || {};
    return selected.map(function (p) {
      var label = p === '其他' ? (sd.parts_other || '其他') : p;
      var qty = qtyMap[p];
      return qty ? label + ' ' + qty + '組' : label;
    }).join('、');
  }

  function fmtHoles(holes) {
    if (!Array.isArray(holes) || !holes.length) return '';
    return holes.map(function (h, i) {
      return '孔徑' + (h.diameter || '') + 'cm';
    }).join('、');
  }

  function specialEnvCell(sd, key, formVal) {
    var selected = sd.specialEnv || [];
    if (selected.indexOf(formVal) >= 0) return formVal;
    return '不需要特殊處理';
  }

  function outdoorRackRow(type, sd) {
    var cur = sd.outdoorRackType || '';
    var match = cur === type || (type === '沿用' && cur.indexOf('沿用') >= 0);
    if (!match) return '';
    var extra = [];
    if (sd.outdoorRackTons) extra.push(sd.outdoorRackTons + '噸');
    if (sd.outdoorRackQty) extra.push(sd.outdoorRackQty + '組');
    return extra.join(' ') || '✓';
  }

  function indoorHangRow(method, sd) {
    var selected = sd.indoorUnitHanging || [];
    return selected.indexOf(method) >= 0 ? '✓' : '';
  }

  function cell(content) {
    return val(content) || '&nbsp;';
  }

  function row2(label, value) {
    return '<tr><td class="lbl" colspan="2">' + label + '</td><td colspan="6">' + cell(value) + '</td></tr>';
  }

  function row4(l1, v1, l2, v2) {
    return '<tr><td class="lbl" colspan="2">' + l1 + '</td><td colspan="2">' + cell(v1) +
      '</td><td class="lbl" colspan="2">' + l2 + '</td><td colspan="2">' + cell(v2) + '</td></tr>';
  }

  function buildPage1(c, sd) {
    var customerLine = [c.customerName, c.storeName].filter(Boolean).join(' ');
    var trades = arrVal(sd.projectTrades);
    var specialConstruction = sd.specialConstruction === '其他'
      ? sd.specialConstruction_other || '其他'
      : sd.specialConstruction;
    var indoorArea = sd.indoorWorkArea === '其他'
      ? (sd.indoorWorkArea_other || '其他')
      : sd.indoorWorkArea;
    var reserved = (sd.reservedItems || []).map(function (item) {
      return item === '其他' ? (sd.reservedItems_other || '其他') : item;
    }).join('、');

    return [
      '<div class="pdf-header">',
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;">',
      '<div><div class="pdf-title">晉詮現勘表</div><div class="pdf-sub">報價發包看這邊</div></div>',
      '<div class="pdf-meta">填表日期：' + fmtDateTime(c.fillDate) + '</div>',
      '</div></div>',
      '<table>',
      row2('客戶名稱/門市名稱/店編', customerLine),
      row2('門市地址', c.storeAddress),
      row2('電子郵件', sd.email),
      row4('工程類型', sd.projectType, '工程工種', trades),
      row4('拆機撤店日期', sd.demolishDate, '驗收日期', sd.acceptanceDate),
      row4('工程進場日期', fmtDate(sd.entryDate), '完工日期', fmtDate(sd.completionDate)),
      row4('最遲進場日期', fmtDate(sd.latestEntryDate), '預估工時', sd.estimatedHours),
      row2('特殊作業時段', sd.specialWorkPeriod),
      row4('地段區域', sd.locationArea, '工單申請', sd.workOrderApplied),
      row4('樓板高度/米', sd.floorHeight, '天花板及暗架下高度/米', sd.ceilingHeight),
      row4('特殊施工', specialConstruction, '已偕同至現場勘查的廠商', sd.coSurveyContractor),
      row2('備註', sd.remarks),
      '<tr><td class="lbl" rowspan="3" colspan="2">特殊環境處理</td>',
      '<td class="lbl">防鹽</td><td colspan="5">' + cell(specialEnvCell(sd, 'salt', '防鹽害處理')) + '</td></tr>',
      '<tr><td class="lbl">防硫</td><td colspan="5">' + cell(specialEnvCell(sd, 'sulfur', '防硫處理')) + '</td></tr>',
      '<tr><td class="lbl">防沼</td><td colspan="5">' + cell(specialEnvCell(sd, 'marsh', '沼氣處理')) + '</td></tr>',
      row2('現場提供電源', sd.onSitePower),
      row2('新機設備規格', fmtEquipmentList(sd.equipmentList) || sd.newEquipmentSpec),
      row2('空調配件', fmtParts(sd)),
      row2('現場舊機沿用處理說明', sd.reuseEquipmentNote || sd.reuseEquipment || '無'),
      '</table>',
      '<table>',
      '<tr><td class="sec" colspan="8">其他</td></tr>',
      row4('施作區域', indoorArea, '電箱位置', sd.electricBoxLocation),
      row2('主樑及副樑高度/米', [sd.mainBeamHeight, sd.subBeamHeight].filter(Boolean).join(' / ')),
      row2('現場已預留說明', reserved),
      row2('配合水電/裝潢連絡電話', sd.decoratorContact),
      '</table>'
    ].join('');
  }

  function buildPage2(c, sd) {
    var outdoorTransport = (sd.outdoorUnitTransport || []).map(function (item) {
      return item === '其他' ? (sd.outdoorUnitTransport_other || '其他') : item;
    }).join('、');
    var crane = sd.craneRequirement === '其他'
      ? (sd.craneRequirement_other || '其他')
      : sd.craneRequirement;
    var indoorPos = (sd.indoorUnitPositioning || []).map(function (item) {
      return item === '其他' ? (sd.indoorUnitPositioning_other || '其他') : item;
    }).join('、');

    return [
      '<div class="page-break"></div>',
      '<table>',
      '<tr><td class="sec" colspan="8">室外機安裝內容</td></tr>',
      row4('室外機放置高度/公分', sd.outdoorUnitHeight, '室外機搬運', outdoorTransport),
      row4('室外機定位', arrVal(sd.outdoorUnitPositioning), '吊車需求', crane),
      '<tr><td class="lbl" rowspan="5" colspan="2">室外機架類型</td>',
      '<td class="lbl">白鐵</td><td colspan="5">' + cell(outdoorRackRow('白鐵', sd)) + '</td></tr>',
      '<tr><td class="lbl">鍍鋅</td><td colspan="5">' + cell(outdoorRackRow('鍍鋅', sd)) + '</td></tr>',
      '<tr><td class="lbl">ABS</td><td colspan="5">' + cell(outdoorRackRow('ABS', sd)) + '</td></tr>',
      '<tr><td class="lbl">沿用</td><td colspan="5">' + cell(outdoorRackRow('沿用', sd)) + '</td></tr>',
      '<tr><td class="lbl">數量</td><td colspan="5">' + cell(sd.outdoorRackQty ? sd.outdoorRackQty + '組' : '') + '</td></tr>',
      row4('室外機平台需求', sd.outdoorPlatformReq, '室外機架是否需加大', sd.outdoorUnitEnlarged),
      row2('2"角鋼增加數量/3支以上', sd.outdoorAngleSteelExtra ? sd.outdoorAngleSteelExtra + '支' : ''),
      '</table>',
      '<table>',
      '<tr><td class="sec" colspan="8">室內機安裝內容</td></tr>',
      row4('室內機安裝位置', arrVal(sd.indoorUnitLocation), '室內機安裝高度/公分', sd.indoorUnitHeight),
      row4('室內機定位方式', indoorPos, '室內機架1.5"角鋼需求數量', sd.indoorUnitAngleSteel ? sd.indoorUnitAngleSteel + '支' : ''),
      '<tr><td class="lbl" rowspan="3" colspan="2">室內機吊掛方式</td>',
      '<td class="lbl">膨脹螺絲</td><td colspan="5">' + cell(indoorHangRow('膨脹螺絲', sd)) + '</td></tr>',
      '<tr><td class="lbl">萬向接頭</td><td colspan="5">' + cell(indoorHangRow('萬向接頭', sd)) + '</td></tr>',
      '<tr><td class="lbl">C型鋼扣3/4</td><td colspan="5">' + cell(indoorHangRow('C型鋼扣3/4', sd)) + '</td></tr>',
      row4('室內機洗孔需求', fmtHoles(sd.indoorUnitHoles), '室內機洗孔尺寸及數量說明', sd.indoorHoleNote),
      '</table>',
      '<table>',
      '<tr><td class="sec" colspan="8">配管工程</td></tr>',
      row4('銅管管徑/米', fmtCheckQtyFromMaps('copperSizes', 'copperSizesQty', sd, '米'),
        '銅管配件', fmtCheckQtyFromMaps('copperFittings', 'copperFittingsQty', sd, '個')),
      row4('PVC(O)排水管徑/米', fmtCheckQtyFromMaps('pvcDrain', 'pvcDrainQty', sd, '米'),
        '排水保溫管管徑/米', fmtCheckQtyFromMaps('drainInsulation', 'drainInsulationQty', sd, '米')),
      '</table>',
      '<table>',
      '<tr><td class="sec" colspan="8">冰水管工程</td></tr>',
      row2('冰水管配件', fmtCheckQtyFromMaps('chilledFittings', 'chilledFittingsQty', sd, '個')),
      row4('冰水保溫管徑厚度/英吋', fmtCheckQtyFromMaps('chilledInsulation', 'chilledInsulationQty', sd, '米'),
        '冰水管徑/英吋', fmtCheckQtyFromMaps('chilledPipe', 'chilledPipeQty', sd, '米')),
      row4('管槽尺寸', sd.protectMaterial === 'ABS管槽' ? sd.absSize : sd.protectMaterial,
        '管槽尺寸配件說明', fmtCheckQtyFromMaps('channelFittings', 'channelFittingsQty', sd, '')),
      '</table>',
      '<table>',
      '<tr><td class="sec" colspan="8">配電工程</td></tr>',
      row4('控制及訊號線材/米', fmtCheckQtyFromMaps('controlSignalWire', 'controlSignalWireQty', sd, '米'),
        '電源線線材/米', fmtCheckQtyFromMaps('powerCableWire', 'powerCableWireQty', sd, '米')),
      '</table>'
    ].join('');
  }

  function buildPage3(c, sd) {
    var waste = sd.wasteDisposal === '其他'
      ? (sd.wasteDisposal_other || '其他')
      : sd.wasteDisposal;
    var oldMethod = sd.oldMachineMethod || '';

    return [
      '<div class="page-break"></div>',
      '<table>',
      '<tr><td class="sec" colspan="8">風管工程</td></tr>',
      row4('保溫軟管(玻璃棉)/米', fmtCheckQtyFromMaps('insulatedHose', 'insulatedHoseQty', sd, '米'),
        '無保溫軟管(鋁箔)/米', fmtCheckQtyFromMaps('uninsulatedHose', 'uninsulatedHoseQty', sd, '米')),
      row4('螺旋風管(鍍鋅鐵)/米', sd.spiralDuct, '防火保溫軟管(玻璃棉)/米', sd.fireInsulatedHose),
      row4('嵌入外接風箱管徑、數量', sd.embeddedBox, '集風箱管徑、數量', fmtDuctBox('collectBox', sd)),
      row4('出/線型風箱 管徑、數量、開孔尺寸公分', fmtDuctBox('outletBox', sd),
        '回風箱/管徑、孔數、數量', fmtDuctBox('returnBox', sd)),
      row4('強制回風箱/管徑、孔數、數量', fmtDuctBox('forcedReturnBox', sd),
        '三通風箱/管徑、數量', fmtDuctBox('teeBox', sd)),
      row4('出風口', fmtVentOutlets(sd), '回風口', fmtCheckQtyFromMaps('returnOutlets', 'returnOutletsQty', sd, '個')),
      row4('特製風箱', sd.customBox === '其他' ? sd.customBox_other : sd.customBox,
        '風管工程材料採購項目', sd.ductMaterialProcurement),
      '</table>',
      '<table>',
      '<tr><td class="sec" colspan="8">舊機拆除工程</td></tr>',
      row4('設備拆除/台', sd.demoEquip, '風管拆除/台', sd.demoDuct),
      row4('管路拆除/米', sd.demoPipe, '其他拆除項目、數量說明', sd.demoOther),
      '<tr><td class="lbl" rowspan="2" colspan="2">舊機處理方式</td>',
      '<td class="lbl">內機</td><td colspan="5">' + cell(sd.oldMachineSpec || oldMethod) + '</td></tr>',
      '<tr><td class="lbl">外機</td><td colspan="5">' + cell(sd.oldMachineOutdoor || oldMethod) + '</td></tr>',
      row2('廢棄物(舊風管)清運處理說明', waste),
      '</table>',
      '<table>',
      '<tr><td class="sec" colspan="8">汰換工程</td></tr>',
      row2('裝潢區開孔尺寸說明', sd.renovationHoleSize),
      row4('業主工務連絡電話', sd.ownerContact, '照片是否已上傳至NAS', sd.photosUploadedNSA),
      '</table>',
      '<table>',
      '<tr><td class="sec" colspan="8">汰換更新內容</td></tr>',
      '<tr><td class="lbl" colspan="2">控制/訊號線</td><td colspan="2">' + cell(sd['replace_控制/訊號線']) +
        '</td><td class="lbl" colspan="2">軟管</td><td colspan="2">' + cell(sd['replace_軟管']) + '</td></tr>',
      '<tr><td class="lbl" colspan="2">室外機電源線</td><td colspan="2">' + cell(sd['replace_室外機電源線']) +
        '</td><td class="lbl" colspan="2">集風箱</td><td colspan="2">' + cell(sd['replace_集風箱']) + '</td></tr>',
      '<tr><td class="lbl" colspan="2">室內機電源線</td><td colspan="2">' + cell(sd['replace_室內機電源線']) +
        '</td><td class="lbl" colspan="2">出/線型風箱</td><td colspan="2">' + cell(sd['replace_出/線型風箱']) + '</td></tr>',
      '<tr><td class="lbl" colspan="2">銅管更新</td><td colspan="2">' + cell(sd['replace_銅管']) +
        '</td><td class="lbl" colspan="2">回風箱</td><td colspan="2">' + cell(sd['replace_回風箱']) + '</td></tr>',
      '<tr><td class="lbl" colspan="2">冰水管</td><td colspan="2">' + cell(sd['replace_冰水管']) +
        '</td><td class="lbl" colspan="2">強制回風箱</td><td colspan="2">' + cell(sd['replace_強制回風箱']) + '</td></tr>',
      '<tr><td class="lbl" colspan="2">排水管</td><td colspan="2">' + cell(sd['replace_排水管']) +
        '</td><td class="lbl" colspan="2">三通風箱</td><td colspan="2">' + cell(sd['replace_三通風箱']) + '</td></tr>',
      '<tr><td class="lbl" colspan="2">保溫管</td><td colspan="2">' + cell(sd['replace_保溫管']) +
        '</td><td class="lbl" colspan="2">出風口</td><td colspan="2">' + cell(sd['replace_出風口']) + '</td></tr>',
      '<tr><td class="lbl" colspan="2">回風口</td><td colspan="2">' + cell(sd['replace_回風口']) +
        '</td><td class="lbl" colspan="2"></td><td colspan="2"></td></tr>',
      row2('備註', sd.replaceRemark),
      '</table>'
    ].join('');
  }

  function buildSurveyPdfHtml(surveyCase) {
    var sd = surveyCase.surveyData || {};
    return [
      '<div class="survey-pdf-root">',
      '<style>', PDF_STYLES, '</style>',
      '<div class="survey-pdf">',
      buildPage1(surveyCase, sd),
      buildPage2(surveyCase, sd),
      buildPage3(surveyCase, sd),
      '</div>',
      '</div>'
    ].join('');
  }

  function exportSurveyPdf(surveyCase, onError) {
    if (typeof html2pdf === 'undefined') {
      if (onError) onError('PDF 函式庫尚未載入');
      return Promise.reject(new Error('html2pdf not loaded'));
    }
    var fileName = (surveyCase.fileName || '現勘表') + '.pdf';
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;';
    wrapper.innerHTML = buildSurveyPdfHtml(surveyCase);
    document.body.appendChild(wrapper);
    var content = wrapper.querySelector('.survey-pdf-root');

    var opt = {
      margin: [10, 10, 10, 10],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], before: '.page-break' }
    };

    return html2pdf().set(opt).from(content || wrapper).save()
      .then(function () {
        document.body.removeChild(wrapper);
      })
      .catch(function (err) {
        document.body.removeChild(wrapper);
        if (onError) onError(err && err.message ? err.message : 'PDF 匯出失敗');
        throw err;
      });
  }

  window.exportSurveyPdf = exportSurveyPdf;
  window.buildSurveyPdfHtml = buildSurveyPdfHtml;
})();
