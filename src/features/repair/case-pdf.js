/*
 * features/repair/case-pdf.js — 案件明細／保養明細 PDF 匯出（A4 排版）
 * 內容比照詳細頁，但改以表格呈現（去除輸入框樣式）
 * 對外：window.exportCasePdf(caseData, opts)、window.exportMaintenancePdf(caseData, opts)
 */
(function () {
  'use strict';

  var PDF_STYLES = [
    '@page { size: A4; margin: 12mm; }',
    '.case-pdf { font-family: "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif; font-size: 11px; color: #1f2937; line-height: 1.45; }',
    '.case-pdf * { box-sizing: border-box; }',
    '.case-pdf .pdf-head { border-bottom: 2px solid #1e40af; padding-bottom: 6px; margin-bottom: 12px; }',
    '.case-pdf .pdf-title { font-size: 20px; font-weight: 700; color: #1e3a8a; margin: 0; display: inline-block; }',
    '.case-pdf .pdf-badge { display: inline-block; margin-left: 8px; font-size: 11px; font-weight: 600; color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 1px 8px; vertical-align: 3px; }',
    '.case-pdf .pdf-meta { float: right; font-size: 10px; color: #6b7280; padding-top: 8px; }',
    '.case-pdf .sec { margin-bottom: 12px; page-break-inside: avoid; }',
    '.case-pdf .sec-title { font-size: 13px; font-weight: 700; color: #1e40af; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 6px; }',
    '.case-pdf table { width: 100%; border-collapse: collapse; table-layout: fixed; }',
    '.case-pdf td, .case-pdf th { border: 1px solid #d1d5db; padding: 5px 7px; vertical-align: middle; word-break: break-word; }',
    '.case-pdf td.lbl { background: #f3f4f6; color: #4b5563; font-weight: 600; white-space: nowrap; width: 12.5%; }',
    '.case-pdf td.val { background: #fff; font-weight: 500; }',
    '.case-pdf td.val.multi { white-space: pre-wrap; line-height: 1.6; }',
    '.case-pdf .danger { color: #dc2626; }',
    '.case-pdf .sub-title { font-size: 11px; font-weight: 700; color: #374151; margin: 8px 0 4px; }',
    '.case-pdf th { background: #f3f4f6; color: #374151; font-weight: 700; text-align: left; font-size: 10px; }',
    '.case-pdf table.grid { table-layout: auto; }',
    '.case-pdf table.grid td { font-size: 10px; }',
    '.case-pdf .empty { border: 1px dashed #d1d5db; background: #f9fafb; color: #9ca3af; text-align: center; padding: 12px; }',
    '.case-pdf .sign { max-height: 56px; }',
    '.case-pdf .page-break { page-break-before: always; }'
  ].join('\n');

  function esc(v) {
    if (v == null || v === '') return '';
    return String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cell(v) {
    var text = esc(v);
    return text ? text.replace(/\n/g, '<br/>') : '—';
  }

  function nowStamp() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // fields: [{ label, value, full }]，每列 4 組標籤／內容（共 8 欄）
  function fieldTable(fields) {
    var COLS = 8;
    var rows = [];
    var current = [];
    var used = 0;

    function flush() {
      if (!current.length) return;
      // 補滿整列，留白處不套標籤底色
      if (used < COLS) current.push('<td class="val" colspan="' + (COLS - used) + '"></td>');
      rows.push('<tr>' + current.join('') + '</tr>');
      current = [];
      used = 0;
    }

    fields.filter(Boolean).forEach(function (f) {
      var span = f.full ? COLS - 1 : 1;
      if (used + 1 + span > COLS) flush();
      var valClass = 'val' + (f.full ? ' multi' : '') + (f.tone === 'danger' ? ' danger' : '');
      current.push('<td class="lbl">' + esc(f.label) + '</td>' +
        '<td class="' + valClass + '" colspan="' + span + '">' + cell(f.value) + '</td>');
      used += 1 + span;
      if (used >= COLS) flush();
    });
    flush();
    return '<table>' + rows.join('') + '</table>';
  }

  function section(title, body) {
    return '<div class="sec"><div class="sec-title">' + esc(title) + '</div>' + body + '</div>';
  }

  function docHead(title, badge) {
    return '<div class="pdf-head">' +
      '<span class="pdf-meta">列印時間：' + esc(nowStamp()) + '</span>' +
      '<h1 class="pdf-title">' + esc(title) + '</h1>' +
      (badge ? '<span class="pdf-badge">' + esc(badge) + '</span>' : '') +
      '<div style="clear:both"></div></div>';
  }

  function wrap(inner) {
    return '<div class="case-pdf-root"><style>' + PDF_STYLES + '</style>' +
      '<div class="case-pdf">' + inner + '</div></div>';
  }

  function dataTable(headers, rows, emptyText) {
    if (!rows.length) return '<div class="empty">' + esc(emptyText) + '</div>';
    return '<table class="grid"><thead><tr>' +
      headers.map(function (t) { return '<th>' + esc(t) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' + r.map(function (c) { return '<td>' + cell(c) + '</td>'; }).join('') + '</tr>';
      }).join('') +
      '</tbody></table>';
  }

  /* ---------- 案件明細（比照 ViewCaseForm） ---------- */

  function formatTimeRange(start, end) {
    if (!start) return '';
    return end && end !== start ? start + ' ~ ' + end : start;
  }

  function buildCasePdfHtml(c, opts) {
    c = c || {};
    opts = opts || {};
    var processMethods = opts.processMethods || [];
    var vehicles = opts.vehicles || [];
    var vendors = opts.vendors || [];
    var caseDT = IESS.caseDateTime;
    var isOther = c.workCategory === '其他';

    var schedule = fieldTable([
      { label: '預計日期', value: c.expectedDate || c.planDate },
      { label: '預計時間', value: formatTimeRange(c.expectedTimeStart || c.planTimeStart, c.expectedTimeEnd || c.planTimeEnd) },
      { label: '組別', value: CaseAssigneeUtils.formatAssignees(c) },
      { label: '指派人員', value: CaseAssigneeUtils.formatAssigneeMembers(c) },
      { label: '使用車輛', value: VehicleUtils.formatLabel(vehicles, c.vehicleId) },
      { label: '協力廠商', value: VendorUtils.formatCooperatorLabels(vendors, c.partnerVendorIds) }
    ]);

    var info = fieldTable([
      { label: '案件編號', value: c.caseNumber },
      { label: '工項分類', value: c.workCategory },
      { label: '叫修人員', value: c.reporter },
      { label: '客戶名稱', value: c.customerName },
      { label: '門市名稱', value: c.storeName },
      { label: '服務等級', value: c.serviceLevel },
      { label: '門市地址', value: c.storeAddress, full: true },
      !isOther && { label: '叫修項目', value: c.repairItem },
      !isOther && { label: '叫修原因', value: c.repairReason },
      { label: isOther ? '工作描述' : '故障描述', value: c.faultDesc, full: true }
    ]);

    var pmColumns = ProcessMethodUtils.CASE_DISPLAY_COLUMNS;
    var items = RepairCaseServiceItems.getItems(c);
    // 一台設備一個小節：設備欄位 → 實際維修原因 → 處理方式表
    var serviceItems = items.length
      ? items.map(function (item, idx) {
          var title = RepairCaseServiceItems.formatItemTitle(idx, item);
          var records = ProcessMethodUtils.sortCaseProcessRecords(item.processRecords || []);
          var pmRows = records.map(function (r) {
            var isDone = ProcessMethodUtils.isCaseRecordDone(r);
            var pts = ProcessMethodUtils.resolveCaseRecordPoints(r, processMethods, !!c.isClosed);
            return pmColumns.map(function (col) { return r[col.key]; }).concat([
              ProcessMethodUtils.getCaseRecordStatus(r),
              (pts === null ? '—' : String(pts)) + (isDone ? '' : '（不計分）'),
              [r.qty, r.unit].filter(function (v) { return v != null && v !== ''; }).join(' ')
            ]);
          });
          return '<div class="sub-title">' + esc(title) + '</div>'
            + (item.equipment
              ? fieldTable(RepairCaseEquipment.getDisplayFields(item.equipment, c, opts.deviceCategories))
              : '<div class="empty">無設備資料</div>')
            + (isOther ? '' : fieldTable([{ label: '實際維修原因', value: item.actualReason, full: true }]))
            + dataTable(
                pmColumns.map(function (col) { return col.label; }).concat(['狀態', '積分數', '數量']),
                pmRows,
                '無處理方式紀錄'
              )
            + fieldTable([{ label: '備註', value: item.remarks, full: true }]);
        }).join('')
      : '<div class="empty">無設備資料</div>';
    // 備註跟著設備走，已在各設備小節內輸出，此處不再附加案件層級的整張備註
    var service = serviceItems;

    var caseSignature = c.customerSignature
      ? '<img class="sign" src="' + esc(c.customerSignature) + '" alt="客戶簽名"/>'
      : '尚未簽收';
    // 待報價／轉汰換／轉原廠：處理狀態後方接後續處理的結果與時間。
    var followUpFields = IESS.caseStatus.getFollowUpFields(c);
    var followUp = followUpFields.length ? fieldTable(followUpFields.map(function (f) {
      return { label: f.label, value: f.value };
    })) : '';
    var result = '<table>' +
      '<tr><td class="lbl">處理狀態</td><td class="val">' + cell(c.processStatus) + '</td>' +
      '<td class="lbl">客戶簽收</td><td class="val" colspan="5">' + caseSignature + '</td></tr>' +
      '</table>' +
      followUp +
      fieldTable([{ label: '維修備註', value: c.repairRemark, full: true }]) +
      '<div class="sub-title">時間紀錄</div>' +
      fieldTable([
        { label: '叫修時間', value: caseDT.format(c.createdAt || c.repairDate) },
        { label: '到店時間', value: caseDT.format(c.reRepairDate) },
        { label: '完成時間', value: caseDT.format(c.completionDate) }
      ]);

    return wrap(
      docHead('案件明細', c.caseNumber) +
      section('1. 排程資料', schedule) +
      section('2. 案件資料', info) +
      section('3. 設備與服務項目', service) +
      section('4. 維修結果', result)
    );
  }

  /* ---------- 保養明細（比照 MaintenanceViewEditForm 檢視模式） ---------- */

  // 對應 EquipmentUtils.renderListDataCells 的文字版（列表用 badge，PDF 用純文字）
  function equipCellText(eq, col) {
    eq = eq || {};
    if (col.kind === 'status') return EquipmentUtils.normalizeStatus(eq.status);
    if (col.kind === 'level') {
      return String(eq.model || '').trim() ? EquipmentUtils.getLevel(eq) : '';
    }
    var val = eq[col.key];
    if (!val && col.altKey) val = eq[col.altKey];
    return val ? String(val).trim() : '';
  }

  function buildMaintenancePdfHtml(target, opts) {
    opts = opts || {};
    var stores = opts.stores || [];
    var customers = opts.customers || [];
    var vendors = opts.vendors || [];
    var c = CaseAssigneeUtils.normalizeMaintenanceCase(target) || {};
    var store = ScheduleUtils.resolveStore(stores, c.customerName, c.storeName);

    var schedule = fieldTable([
      { label: '保養日期', value: c.planDate },
      { label: '保養開始時間', value: c.planTimeStart },
      { label: '保養結束時間', value: c.planTimeEnd },
      { label: '組別', value: CaseAssigneeUtils.formatMaintenanceAssignees(c) },
      { label: '指派人員', value: CaseAssigneeUtils.formatAssigneeMembers(c) },
      { label: '協力廠商', value: VendorUtils.formatCooperatorLabels(vendors, c.partnerVendorIds) }
    ]);

    var info = fieldTable([
      { label: '客戶名稱', value: c.customerName },
      { label: '門市名稱', value: c.storeName },
      { label: '行政區域', value: StoreUtils.getRecordArea(c) },
      { label: '服務等級', value: c.serviceLevel },
      { label: '保養區間', value: ScheduleUtils.formatPeriodRange(ScheduleUtils.resolveCasePeriod(c, customers)) },
      { label: '門市地址', value: (store && StoreUtils.buildFullAddress(store)) || c.storeAddress },
      { label: '室內機高度', value: store && store.indoorHeight },
      { label: '室外機高度', value: store && store.outdoorHeight }
    ]);

    var columns = EquipmentUtils.LIST_COLUMNS;
    var equipRows = (c.equipmentList || []).map(function (eq) {
      return columns.map(function (col) { return equipCellText(eq, col); });
    });
    var equipment = dataTable(
      columns.map(function (col) { return col.label; }),
      equipRows,
      '尚未加入任何設備資料'
    );

    var signature = c.customerSignature
      ? '<img class="sign" src="' + esc(c.customerSignature) + '" alt="客戶簽名"/>'
      : '尚未簽收';
    var result = '<table>' +
      '<tr><td class="lbl">保養狀態</td><td class="val">' + cell(c.status) + '</td>' +
      '<td class="lbl">完成時間</td><td class="val">' + cell(IESS.caseDateTime.format(c.completionDate)) + '</td>' +
      '<td class="lbl">客戶簽收</td><td class="val" colspan="3">' + signature + '</td></tr>' +
      '</table>' +
      fieldTable([{ label: '備註', value: c.remark, full: true }]);

    return wrap(
      docHead('保養明細', c.customerName && c.storeName ? c.customerName + ' / ' + c.storeName : '') +
      section('1. 排程資料', schedule) +
      section('2. 案件資料', info) +
      section('3. 設備資料', equipment) +
      section('4. 保養結果', result)
    );
  }

  /* ---------- 匯出 ---------- */

  function safeName(text) {
    return String(text || '').replace(/[\\/:*?"<>|]/g, '_');
  }

  function renderPdf(html, fileName, onError) {
    if (typeof html2pdf === 'undefined') {
      if (onError) onError('PDF 函式庫尚未載入');
      return Promise.reject(new Error('html2pdf not loaded'));
    }
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;';
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);
    var content = wrapper.querySelector('.case-pdf-root') || wrapper;

    var opt = {
      margin: [10, 10, 10, 10],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], before: '.page-break', avoid: '.sec' }
    };

    return html2pdf().set(opt).from(content).save()
      .then(function () { document.body.removeChild(wrapper); })
      .catch(function (err) {
        document.body.removeChild(wrapper);
        if (onError) onError(err && err.message ? err.message : 'PDF 匯出失敗');
        throw err;
      });
  }

  function buildFileName(prefix, parts) {
    var body = parts.filter(Boolean).map(safeName).join('_');
    return (body ? prefix + '_' + body : prefix) + '.pdf';
  }

  function exportCasePdf(caseData, opts) {
    opts = opts || {};
    var fileName = buildFileName('案件明細', [
      caseData && caseData.caseNumber,
      caseData && caseData.customerName,
      caseData && caseData.storeName
    ]);
    return renderPdf(buildCasePdfHtml(caseData, opts), fileName, opts.onError);
  }

  function exportMaintenancePdf(caseData, opts) {
    opts = opts || {};
    var fileName = buildFileName('保養明細', [
      caseData && caseData.customerName,
      caseData && caseData.storeName,
      caseData && caseData.planDate
    ]);
    return renderPdf(buildMaintenancePdfHtml(caseData, opts), fileName, opts.onError);
  }

  window.exportCasePdf = exportCasePdf;
  window.exportMaintenancePdf = exportMaintenancePdf;
  window.buildCasePdfHtml = buildCasePdfHtml;
  window.buildMaintenancePdfHtml = buildMaintenancePdfHtml;
})();
