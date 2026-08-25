/*
 * features/repair/case-service-item-pager.js — 設備卡片的左右切換列
 *
 * 多筆設備時一次只顯示一張卡片，此列負責換台：「‹ 設備 2 / 3 ›」。
 * 編輯表單／唯讀明細／派工明細共用同一份版面，避免三處各自拼字串走樣。
 * 目前是第幾台由呼叫端持有：派工明細的欄位輸入會從外層重建整個彈窗，
 * 狀態若放在本元件內就會在每次輸入後被重設回第一台。
 */
(function () {
  'use strict';

  function RepairCaseServiceItemPager(props) {
    var h = props.h || IESS.h;
    var Icons = IESS.Icons;
    var total = props.total || 0;
    // 只有一台（或沒有設備）時整列不出現，不佔版面也不會讓人誤以為還有別台
    if (total <= 1) return null;

    var index = Math.min(Math.max(props.index || 0, 0), total - 1);
    var btnClass = 'p-1.5 rounded-md border border-gray-200 text-gray-600 '
      + 'hover:bg-gray-50 disabled:text-gray-300 disabled:hover:bg-transparent '
      + 'disabled:cursor-not-allowed';

    // 只放圖示的按鈕會被 icon-button 的 tooltip 包裝重建（自訂屬性不會保留），
    // 因此以 aria-label 作為對外可辨識的把手
    function arrow(dir, label, icon, disabled, nextIndex) {
      return h('button', {
        type: 'button',
        title: label,
        disabled: disabled,
        onClick: function () {
          if (dir === 'prev') props.onPrev(nextIndex);
          else props.onNext(nextIndex);
        },
        className: btnClass
      }, icon({ className: 'h-4 w-4' }));
    }

    return h('div', {
      'data-role': 'service-item-pager',
      className: 'flex items-center gap-2 text-sm text-gray-600'
    },
      arrow('prev', '上一台設備', Icons.ChevronLeft, index === 0, index - 1),
      h('span', {
        'data-role': 'service-item-pager-label',
        className: 'font-medium min-w-[5.5rem] text-center'
      },
        '設備 ' + (index + 1) + ' / ' + total),
      arrow('next', '下一台設備', Icons.ChevronRight, index === total - 1, index + 1)
    );
  }

  window.RepairCaseServiceItemPager = RepairCaseServiceItemPager;
})();
