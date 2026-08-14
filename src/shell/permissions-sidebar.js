/*
 * shell/permissions-sidebar.js — 系統權限左側選單（可展開的功能群組）
 * props: { currentSubMenu, expandedSidebar, setCurrentSubMenu, toggleExpand }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons;

  var MENU_TREE = [
    {
      id: '人員與權限', children: [
        { id: '帳號管理', label: '帳號管理' },
        { id: '組別管理', label: '組別管理' },
        { id: '車輛管理', label: '車輛管理' }
      ]
    },
    {
      id: '基礎資料設定', children: [
        { id: '服務等級管理', label: '服務等級管理' },
        { id: '處理方式與積分管理', label: '處理方式與積分管理' },
        { id: '設備分類管理', label: '設備分類管理' },
        { id: '績效區域管理', label: '績效區域管理' }
      ]
    },
    {
      id: '保養作業', children: [
        { id: '保養分配', label: '保養分配' }
      ]
    }
  ];

  function PermissionsSidebar(props) {
    var currentSubMenu = props.currentSubMenu;
    var expandedSidebar = props.expandedSidebar || [];
    var setCurrentSubMenu = props.setCurrentSubMenu;
    var toggleExpand = props.toggleExpand;
    var onClose = props.onClose;

    return h('aside', {
      className: 'app-sidebar bg-white border-r border-gray-200 shadow-sm flex flex-col shrink-0 z-0'
    },
      onClose && h('div', { className: 'p-4 border-b border-gray-100 bg-gray-50/50 app-sidebar__header' },
        h('button', {
          type: 'button',
          className: 'app-sidebar__close',
          onClick: onClose,
          'aria-label': '關閉選單'
        }, Icons.X({ className: 'h-5 w-5' }))
      ),
      h('nav', { className: 'flex-1 p-3 space-y-1 overflow-y-auto' },
        MENU_TREE.map(function (menu) {
          var isOpen = expandedSidebar.indexOf(menu.id) !== -1;
          return h('div', { key: menu.id, className: 'mb-1' },
            h('button', {
              onClick: function () { toggleExpand(menu.id); },
              className: 'w-full flex items-center justify-between px-3 py-3 rounded-md transition-all ' +
                (isOpen ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600')
            },
              h('span', { className: 'whitespace-nowrap' }, menu.id),
              Icons.ChevronDown({ className: 'h-4 w-4 shrink-0 transition-transform ' + (isOpen ? 'rotate-180' : '') })
            ),
            isOpen && h('div', {
              className: 'mt-1 ml-4 pl-4 border-l-2 border-gray-100 space-y-1'
            },
              menu.children.map(function (sub) {
                return h('button', {
                  key: sub.id,
                  onClick: function () { setCurrentSubMenu(sub.id); },
                  className: 'w-full text-left px-3 py-2 rounded-md transition-all text-sm whitespace-nowrap ' +
                    (currentSubMenu === sub.id
                      ? 'bg-blue-100/50 text-blue-700 font-bold'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-blue-600')
                }, sub.label);
              })
            )
          );
        })
      )
    );
  }

  window.PermissionsSidebar = PermissionsSidebar;
})();
