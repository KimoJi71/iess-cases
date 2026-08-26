/*
 * core/status-badge.js — 列表狀態標籤
 *
 * 全站列表的狀態標籤統一走這裡，樣式以「案件處理」列表的案件狀態為準：
 * 圓角膠囊、細邊框、xs 字級。
 *
 * IESS.statusBadge(label, tone, extraClass)
 *   tone: 'green' | 'blue' | 'amber' | 'red' | 'gray'（預設 gray）
 */
(function (global) {
  'use strict';
  var h = global.IESS && global.IESS.h;

  var BASE_CLASS = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ';

  var TONES = {
    green: 'bg-green-100 text-green-700 border-green-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    gray: 'bg-gray-100 text-gray-600 border-gray-200'
  };

  function statusBadgeClass(tone, extraClass) {
    return BASE_CLASS + (TONES[tone] || TONES.gray) + (extraClass ? ' ' + extraClass : '');
  }

  function statusBadge(label, tone, extraClass) {
    return h('span', { className: statusBadgeClass(tone, extraClass) }, label);
  }

  global.IESS.STATUS_BADGE_TONES = TONES;
  global.IESS.statusBadgeClass = statusBadgeClass;
  global.IESS.statusBadge = statusBadge;
})(window);
