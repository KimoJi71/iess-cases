/*
 * shell/header.js — 頂部藍色列（logo + 主選單 + 快捷操作 + 使用者）
 * props: { currentTopMenu, setCurrentTopMenu, quickActions, onMenuToggle?, mobileSidebarOpen? }
 *
 * quickActions: [{ id, label, icon, variant?, onClick, title? }]
 *   variant: 'primary' | 'secondary'（預設 secondary）
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, iconActionBtn = IESS.iconActionBtn;

  function renderQuickAction(action) {
    var Icon = Icons[action.icon];
    var variant = action.variant === 'primary' ? 'primary' : 'secondary';
    return iconActionBtn({
      label: action.title || action.label,
      onClick: action.onClick,
      className: 'header-quick-action header-quick-action--' + variant,
      icon: Icon && Icon({ className: 'header-quick-action__icon' })
    });
  }

  function Header(props) {
    var currentTopMenu = props.currentTopMenu;
    var setCurrentTopMenu = props.setCurrentTopMenu;
    var quickActions = props.quickActions || [];
    var onMenuToggle = props.onMenuToggle;
    var mobileSidebarOpen = props.mobileSidebarOpen;

    var menus = ['戰情室', '案件排程', '報表統計', '系統權限'];

    return h('header', { className: 'app-header shrink-0' },
      h('div', { className: 'app-header__inner' },
        h('div', { className: 'app-header__start' },
          onMenuToggle && h('button', {
            type: 'button',
            className: 'app-header__menu-btn',
            onClick: onMenuToggle,
            'aria-label': mobileSidebarOpen ? '關閉選單' : '開啟選單',
            'aria-expanded': mobileSidebarOpen ? 'true' : 'false'
          }, Icons.Menu({ className: 'h-6 w-6' })),
          h('div', { className: 'app-header__brand' },
            Icons.Wrench({ className: 'app-header__brand-icon' }),
            h('h1', { className: 'app-header__title' }, '晉詮系統')
          ),
          h('nav', { className: 'app-header__nav', 'aria-label': '主選單' },
            menus.map(function (menu) {
              return h('button', {
                key: menu,
                type: 'button',
                onClick: function () { setCurrentTopMenu(menu); },
                className: 'app-header__nav-item' +
                  (currentTopMenu === menu ? ' app-header__nav-item--active' : '')
              }, menu);
            })
          )
        ),
        h('div', { className: 'app-header__end' },
          quickActions.length > 0 && h('div', {
            className: 'header-quick-actions',
            role: 'toolbar',
            'aria-label': '快捷操作'
          },
            quickActions.map(renderQuickAction)
          ),
          quickActions.length > 0 && h('div', { className: 'app-header__divider', 'aria-hidden': 'true' }),
          h('div', { className: 'app-header__utilities' },
            iconActionBtn({ label: '通知', className: 'app-header__utility-btn', icon: Icons.Bell({ className: 'h-5 w-5' }) }),
            h('div', { className: 'app-header__user' },
              h('div', { className: 'app-header__user-avatar' },
                Icons.User({ className: 'h-4 w-4' })
              ),
              h('span', { className: 'app-header__user-name' }, '管理員')
            )
          )
        )
      ),
      h('nav', { className: 'app-header__mobile-nav', 'aria-label': '主選單（手機版）' },
        menus.map(function (menu) {
          return h('button', {
            key: menu,
            type: 'button',
            onClick: function () { setCurrentTopMenu(menu); },
            className: 'app-header__mobile-nav-item' +
              (currentTopMenu === menu ? ' app-header__mobile-nav-item--active' : '')
          }, menu);
        })
      )
    );
  }

  window.Header = Header;
})();
