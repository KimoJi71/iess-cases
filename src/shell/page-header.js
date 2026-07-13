/*
 * shell/page-header.js — 新增／查看／編輯頁面的統一頁首
 *
 * 左側：標題（無 icon，統一樣式），可選帶入一個 badge（如案號／立案號）。
 * 右側：關閉按鈕（X），點擊回到列表頁。
 *
 * opts: { title, badge?, onClose, wrapperClass? }
 *   wrapperClass 預設為卡片內頁首（mb-6 pb-4）；若頁面為 flex-col 捲動容器，
 *   傳入 'flex justify-between items-center p-6 border-b border-gray-200 shrink-0'。
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons;

  function PageHeader(opts) {
    var wrapperClass = opts.wrapperClass ||
      'flex justify-between items-center mb-6 pb-4 border-b border-gray-200';

    return h('div', { className: wrapperClass },
      h('div', { className: 'flex items-center gap-3 min-w-0' },
        h('h2', { className: 'text-2xl font-bold text-gray-800 whitespace-nowrap' }, opts.title),
        opts.badge
          ? h('span', {
              className: 'text-base font-medium text-blue-700 bg-blue-50 px-3 py-1 rounded-full whitespace-nowrap'
            }, opts.badge)
          : null
      ),
      h('button', {
        type: 'button',
        onClick: opts.onClose,
        title: '關閉並返回列表',
        className: 'shrink-0 ml-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors'
      }, Icons.X({ className: 'h-6 w-6' }))
    );
  }

  window.PageHeader = PageHeader;
})();
