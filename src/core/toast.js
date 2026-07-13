/*
 * core/toast.js — 全域提示訊息（右上角浮出，3 秒後消失）
 *
 * 獨立管理自身 DOM，不觸發整頁重繪。用法：IESS.showToast('已儲存', 'success')。
 */
(function (global) {
  'use strict';

  var h = global.IESS.h;
  var Icons = global.IESS.Icons;

  var current = null; // 目前顯示的 toast 節點
  var timer = null;

  function showToast(message, type) {
    type = type || 'success';
    if (timer) clearTimeout(timer);
    if (current && current.parentNode) current.parentNode.removeChild(current);

    var icon = type === 'error'
      ? Icons.AlertCircle({ className: 'h-5 w-5' })
      : Icons.CheckCircle({ className: 'h-5 w-5' });

    current = h('div', {
      className: 'fixed top-20 right-6 px-6 py-3 rounded-md shadow-lg z-50 flex items-center gap-3 ' +
        'transform transition-all duration-300 translate-y-0 opacity-100 ' +
        (type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white')
    }, icon, h('span', { className: 'font-medium' }, message));

    document.body.appendChild(current);
    timer = setTimeout(function () {
      if (current && current.parentNode) current.parentNode.removeChild(current);
      current = null;
      timer = null;
    }, 3000);
  }

  global.IESS.showToast = showToast;
})(window);
