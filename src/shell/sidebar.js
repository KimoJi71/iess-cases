/*
 * shell/sidebar.js — 戰情室左側選單（可展開的功能群組）
 * props: { currentSubMenu, expandedSidebar, setCurrentSubMenu, toggleExpand }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons;

  var MENU_TREE = [
    {
      id: '維修服務', children: [
        { id: '案件處理', label: '案件處理' },
        { id: '叫修案件紀錄', label: '叫修案件紀錄' },
        { id: '保養計劃進度', label: '保養計劃進度' },
        { id: '案件銷案審核', label: '案件銷案審核' }
      ]
    },
    {
      id: '工程服務', children: [
        { id: '工程立案', label: '工程立案' },
        { id: '現勘表收集', label: '現勘表收集' }
      ]
    },
    {
      id: '客戶建檔', children: [
        { id: '客戶管理', label: '客戶管理' },
        { id: '門市管理', label: '門市管理' },
        { id: '設備管理', label: '設備管理' },
        { id: '廠商管理', label: '廠商管理' }
      ]
    }
  ];

  function Sidebar(props) {
    var currentSubMenu = props.currentSubMenu;
    var expandedSidebar = props.expandedSidebar;
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

  window.Sidebar = Sidebar;
})();
