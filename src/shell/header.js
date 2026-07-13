/*
 * shell/header.js — 頂部藍色列（logo + 主選單 + 使用者）
 * props: { currentTopMenu, setCurrentTopMenu }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons;

  function Header(props) {
    var currentTopMenu = props.currentTopMenu;
    var setCurrentTopMenu = props.setCurrentTopMenu;

    var menus = ['戰情室', '案件排程', '報表統計', '系統權限'];

    return h('header', { className: 'bg-blue-900 text-white shadow-md shrink-0' },
      h('div', { className: 'flex items-center justify-between px-6 py-3' },
        h('div', { className: 'flex items-center space-x-8' },
          h('div', { className: 'flex items-center space-x-2' },
            Icons.Wrench({ className: 'h-6 w-6 text-blue-300' }),
            h('h1', { className: 'text-xl font-bold tracking-wider' }, '晉詮系統')
          ),
          h('nav', { className: 'hidden md:flex space-x-1' },
            menus.map(function (menu) {
              return h('button', {
                key: menu,
                onClick: function () { setCurrentTopMenu(menu); },
                className: 'px-4 py-2 rounded-md transition-colors ' +
                  (currentTopMenu === menu
                    ? 'bg-blue-800 text-white font-medium'
                    : 'text-blue-200 hover:bg-blue-800 hover:text-white')
              }, menu);
            })
          )
        ),
        h('div', { className: 'flex items-center space-x-4' },
          h('button', { className: 'text-blue-200 hover:text-white' },
            Icons.Bell({ className: 'h-5 w-5' })
          ),
          h('div', { className: 'flex items-center space-x-2 text-sm' },
            h('div', { className: 'bg-blue-800 p-1.5 rounded-full' },
              Icons.User({ className: 'h-4 w-4' })
            ),
            h('span', { className: 'hidden sm:inline' }, '管理員')
          )
        )
      )
    );
  }

  window.Header = Header;
})();
