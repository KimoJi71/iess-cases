/*
 * shell/permissions-sidebar.js — 系統權限左側選單
 * props: { currentSubMenu, setCurrentSubMenu }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons;

  var MENU_ITEMS = [
    { id: '帳號設定', icon: 'Settings' }
  ];

  function PermissionsSidebar(props) {
    var currentSubMenu = props.currentSubMenu;
    var setCurrentSubMenu = props.setCurrentSubMenu;

    return h('aside', {
      className: 'w-56 bg-white border-r border-gray-200 shadow-sm flex flex-col shrink-0 z-0'
    },
      h('div', { className: 'p-4 border-b border-gray-100 bg-gray-50/50' },
        h('h2', { className: 'text-base font-bold text-gray-700 tracking-wide' }, '系統權限 選單')
      ),
      h('nav', { className: 'flex-1 p-3 space-y-1 overflow-y-auto' },
        MENU_ITEMS.map(function (item) {
          var Icon = Icons[item.icon] || Icons.FileText;
          var isActive = currentSubMenu === item.id;
          return h('button', {
            key: item.id,
            onClick: function () { setCurrentSubMenu(item.id); },
            className: 'w-full flex items-center space-x-3 px-3 py-3 rounded-md transition-all ' +
              (isActive
                ? 'bg-blue-50 text-blue-700 font-bold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600')
          },
            Icon({ className: 'h-5 w-5 ' + (isActive ? 'text-blue-600' : 'text-gray-400') }),
            h('span', null, item.id)
          );
        })
      )
    );
  }

  window.PermissionsSidebar = PermissionsSidebar;
})();
