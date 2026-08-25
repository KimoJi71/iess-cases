/*
 * core/action-menu.js — 「更多」動作選單（圖示鈕 + 浮動選單）
 *
 * actionMenuBtn({ label, icon, className, items: [{ label, icon, onClick, className, disabled }] })
 *
 * 列表操作欄放在 overflow-x-auto 的表格裡，選單若用 absolute 會被裁掉，
 * 因此比照 searchable-select 以 fixed 定位掛到 document.body，
 * 並在捲動／縮放時重新定位、元件被換掉時自動收起。
 */
(function (global) {
  'use strict';

  var current = null; // { menuEl, triggerEl, scrollHandler, keyHandler, downHandler, detachTimer }

  function closeMenu() {
    if (!current) return;
    var open = current;
    current = null;
    document.removeEventListener('mousedown', open.downHandler, true);
    document.removeEventListener('keydown', open.keyHandler, true);
    window.removeEventListener('scroll', open.scrollHandler, true);
    window.removeEventListener('resize', open.scrollHandler);
    clearInterval(open.detachTimer);
    if (open.menuEl.parentNode) open.menuEl.parentNode.removeChild(open.menuEl);
  }

  function positionMenu(menuEl, triggerEl) {
    var rect = triggerEl.getBoundingClientRect();
    var width = menuEl.offsetWidth;
    var left = rect.right - width;
    if (left < 8) left = 8;
    var maxLeft = window.innerWidth - width - 8;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    var top = rect.bottom + 4;
    var overflowBottom = top + menuEl.offsetHeight - window.innerHeight + 8;
    if (overflowBottom > 0) {
      var above = rect.top - menuEl.offsetHeight - 4;
      if (above >= 8) top = above;
    }
    menuEl.style.top = top + 'px';
    menuEl.style.left = left + 'px';
  }

  function buildMenu(items) {
    var menuEl = document.createElement('div');
    menuEl.className = 'action-menu__menu';
    menuEl.setAttribute('role', 'menu');
    items.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'action-menu__item' + (item.className ? ' ' + item.className : '');
      btn.setAttribute('role', 'menuitem');
      if (item.disabled) btn.disabled = true;
      if (item.icon) {
        var iconWrap = document.createElement('span');
        iconWrap.className = 'action-menu__item-icon';
        iconWrap.appendChild(item.icon);
        btn.appendChild(iconWrap);
      }
      var text = document.createElement('span');
      text.textContent = item.label;
      btn.appendChild(text);
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        if (item.onClick) item.onClick(e);
      });
      menuEl.appendChild(btn);
    });
    return menuEl;
  }

  function openMenu(triggerEl, items) {
    var menuEl = buildMenu(items);
    document.body.appendChild(menuEl);

    var open = {
      menuEl: menuEl,
      triggerEl: triggerEl,
      scrollHandler: function () { positionMenu(menuEl, triggerEl); },
      keyHandler: function (e) { if (e.key === 'Escape') closeMenu(); },
      downHandler: function (e) {
        if (menuEl.contains(e.target) || triggerEl.contains(e.target)) return;
        closeMenu();
      },
      // 選單開著時列表可能被整批重繪／切換頁面，觸發鈕會直接從文件消失，
      // 沒有 click 或 blur 可依靠，浮動選單就會留在畫面上。
      detachTimer: setInterval(function () {
        if (!document.body.contains(triggerEl)) closeMenu();
      }, 200)
    };
    current = open;

    positionMenu(menuEl, triggerEl);
    document.addEventListener('mousedown', open.downHandler, true);
    document.addEventListener('keydown', open.keyHandler, true);
    window.addEventListener('scroll', open.scrollHandler, true);
    window.addEventListener('resize', open.scrollHandler);
  }

  function actionMenuBtn(opts) {
    opts = opts || {};
    var items = (opts.items || []).filter(Boolean);
    var Icons = global.IESS.Icons;
    return global.IESS.iconActionBtn({
      label: opts.label || '更多',
      className: opts.className,
      disabled: items.length === 0,
      icon: opts.icon || (Icons && Icons.MoreHorizontal
        ? Icons.MoreHorizontal({ className: 'h-4 w-4' })
        : null),
      onClick: function (e) {
        e.preventDefault();
        e.stopPropagation();
        var triggerEl = e.currentTarget;
        var wasOpen = current && current.triggerEl === triggerEl;
        closeMenu();
        if (!wasOpen) openMenu(triggerEl, items);
      }
    });
  }

  global.IESS = global.IESS || {};
  global.IESS.actionMenuBtn = actionMenuBtn;
  global.IESS.closeActionMenu = closeMenu;
})(window);
