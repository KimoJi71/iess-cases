/*
 * features/repair/case-extension.js — 延伸案件（待料件／尚未處理完成結案）
 *
 * 處理狀態為「待料件」「尚未處理完成」的案件結案時，複製一筆新案件回到
 * 「案件處理」列表，承接原案尚未完成（待處理）的服務項目。
 *
 * 編號沿用原始案件遞增：20260825001 → -1 → -2 → -3（不逐層疊加）。
 * 三個關聯欄位：rootCaseNumber（原始編號）、extensionSeq（序號）、prevCaseId（上一筆的 id）。
 */
(function () {
  'use strict';

  // 來源案件若已是延伸案件就沿用它的 root，否則它自己就是 root。
  function getRootCaseNumber(c) {
    if (!c) return '';
    return c.rootCaseNumber || c.caseNumber || '';
  }

  // 同一條延伸鏈中最大的序號 + 1；中間有案件被刪除也不會撞號。
  function getNextExtensionSeq(cases, rootCaseNumber) {
    var max = 0;
    (cases || []).forEach(function (c) {
      if (!c || c.rootCaseNumber !== rootCaseNumber) return;
      var seq = Number(c.extensionSeq) || 0;
      if (seq > max) max = seq;
    });
    return max + 1;
  }

  function getNextExtensionCaseNumber(original, cases) {
    var root = getRootCaseNumber(original);
    return root + '-' + getNextExtensionSeq(cases, root);
  }

  // 只承接「待處理」的服務項目；原案件的那份保留不動（歷史紀錄）。
  function copyPendingRecords(original) {
    var records = (original && original.processRecords) || [];
    var stamp = Date.now();
    return records.filter(function (r) {
      return ProcessMethodUtils.getCaseRecordStatus(r) === '待處理';
    }).map(function (r, idx) {
      return Object.assign({}, r, { id: stamp + idx });
    });
  }

  function copyEquipment(original) {
    var eq = original && original.equipment;
    return eq ? JSON.parse(JSON.stringify(eq)) : null;
  }

  /*
   * 帶入：案件資料、設備、組別／人員／協力廠商／車輛、實際維修原因、待處理服務項目。
   * 清空：處理狀態、時間紀錄、預計日期時間（需重新排程）、結案／績效／退回欄位。
   */
  function buildExtensionCase(original, cases) {
    return {
      id: 'C' + Date.now(),
      caseNumber: getNextExtensionCaseNumber(original, cases),
      rootCaseNumber: getRootCaseNumber(original),
      extensionSeq: getNextExtensionSeq(cases, getRootCaseNumber(original)),
      prevCaseId: original.id,

      workCategory: original.workCategory,
      customerName: original.customerName,
      storeName: original.storeName,
      companyCity: original.companyCity || '',
      companyDistrict: original.companyDistrict || '',
      storeAddress: original.storeAddress || '',
      serviceLevel: original.serviceLevel || '',
      repairItem: original.repairItem || '',
      repairReason: original.repairReason || '',
      faultDesc: original.faultDesc || '',
      reporter: original.reporter || '',
      actualReason: original.actualReason || '',

      assignees: (original.assignees || []).slice(),
      assigneeMemberIds: (original.assigneeMemberIds || []).slice(),
      partnerVendorIds: (original.partnerVendorIds || []).slice(),
      vehicleId: original.vehicleId || '',

      equipment: copyEquipment(original),
      processRecords: copyPendingRecords(original),

      processStatus: null,
      completionDate: '',
      reRepairDate: '',
      expectedDate: '',
      expectedTimeStart: '',
      expectedTimeEnd: '',
      planDate: '',
      planTimeStart: '',
      planTimeEnd: '',

      isClosed: false,
      isListClosed: false,
      closeDate: '',
      isPerformanceIncluded: false,
      performanceAssignees: [],
      performanceAssignee: '',
      performanceMemberIds: [],

      indicator: original.workCategory === '緊急叫修' ? 'urgent' : 'completed',
      repairDate: IESS.caseDateTime.now(),
      createdAt: new Date().toISOString()
    };
  }

  // 結案時是否已經建立過延伸案件：原案件的 extensionCaseId 若指向仍存在的案件，
  // 代表退回重開後再次結案，不應該再多建一筆，回傳既有的那筆讓呼叫端提示使用者。
  function findExistingExtensionCase(original, cases) {
    if (!original || !original.extensionCaseId) return null;
    return (cases || []).filter(function (c) {
      return c.id === original.extensionCaseId;
    })[0] || null;
  }

  // 明細頁／編輯頁共用的「先前案件」按鈕：找不到來源案件或未提供 openPrevCase 時不顯示。
  function buildPrevCaseAction(opts) {
    opts = opts || {};
    var cases = opts.cases || [];
    var targetCase = opts.targetCase;
    var currentView = opts.currentView;
    var openPrevCase = opts.openPrevCase;
    if (!targetCase || !targetCase.prevCaseId || !openPrevCase) return [];
    var prev = cases.filter(function (c) { return c.id === targetCase.prevCaseId; })[0];
    if (!prev) return [];
    var h = IESS.h;
    return [h('button', {
      type: 'button',
      className: 'px-3 py-1.5 text-sm border rounded-md text-blue-600 hover:bg-blue-50 ' +
        'flex items-center gap-1.5 shrink-0',
      title: '檢視先前案件 ' + prev.caseNumber,
      onClick: function () {
        openPrevCase(prev, currentView, targetCase);
      }
    }, IESS.Icons.History({ className: 'h-4 w-4' }), '先前案件')];
  }

  window.CaseExtensionUtils = {
    getRootCaseNumber: getRootCaseNumber,
    getNextExtensionSeq: getNextExtensionSeq,
    getNextExtensionCaseNumber: getNextExtensionCaseNumber,
    buildExtensionCase: buildExtensionCase,
    findExistingExtensionCase: findExistingExtensionCase,
    buildPrevCaseAction: buildPrevCaseAction
  };
})();
