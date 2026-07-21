/*
 * features/project/project-history.js — 專案：案件歷程對話框
 * props: { caseData, onClose, onAddComment }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  function ProjectHistoryModal(props) {
    var caseData = props.caseData;
    var onClose = props.onClose;
    var onAddComment = props.onAddComment;

    var inputText = '';
    var attachment = null;
    var tagMenu = {
      show: false,
      type: '',
      search: '',
      options: [],
      matchStart: 0,
      matchEnd: 0
    };
    var selectedIndex = 0;
    var fileInputRef = null;
    var messagesEndRef = null;
    var menuRef = null;

    // 捲動到最新訊息（對應 useEffect，依賴 caseData.comments）
    var lastComments = undefined;

    return stateful(function (rerender) {
      function handleInputChange(e) {
        var val = e.target.value;
        inputText = val;
        var cursorPos = e.target.selectionStart;
        var textBeforeCursor = val.slice(0, cursorPos);
        // 找出游標前最近的 @ 或 #
        var match = textBeforeCursor.match(/([@#])([^\s]*)$/);
        if (match) {
          var matchIndex = match.index;
          // 確保標記符號前是空白或為字串開頭
          var isPrecededBySpace = matchIndex === 0 || /\s/.test(textBeforeCursor[matchIndex - 1]);
          if (isPrecededBySpace) {
            var type = match[1];
            var search = match[2];
            var matchStart = matchIndex;
            var matchEnd = cursorPos;
            var options = [];
            if (type === '@') {
              options = PROJECT_ASSIGNEES.filter(function (a) { return a.toLowerCase().includes(search.toLowerCase()); });
            } else if (type === '#') {
              options = DYNAMIC_PROJECT_TAGS.filter(function (t) { return t.toLowerCase().includes(search.toLowerCase()); });
              // 若搜尋的標籤不存在，允許新增
              if (search && !DYNAMIC_PROJECT_TAGS.some(function (t) { return t.toLowerCase() === search.toLowerCase(); })) {
                options.push(search);
              }
            }
            if (options.length > 0) {
              tagMenu = {
                show: true,
                type: type,
                search: search,
                options: options,
                matchStart: matchStart,
                matchEnd: matchEnd
              };
              selectedIndex = 0;
              rerender();
            } else {
              tagMenu = Object.assign({}, tagMenu, { show: false });
              rerender();
            }
            return;
          }
        }
        tagMenu = Object.assign({}, tagMenu, { show: false });
        rerender();
      }

      function handleTagSelect(option) {
        // 若為新的標籤，加入全域暫存
        if (tagMenu.type === '#' && !DYNAMIC_PROJECT_TAGS.includes(option)) {
          DYNAMIC_PROJECT_TAGS.push(option);
        }
        var before = inputText.slice(0, tagMenu.matchStart);
        var after = inputText.slice(tagMenu.matchEnd);
        var newText = before + tagMenu.type + option + ' ' + after;
        inputText = newText;
        tagMenu = {
          show: false,
          type: '',
          search: '',
          options: [],
          matchStart: 0,
          matchEnd: 0
        };
        rerender();

        // 延遲讓 textarea 重新 focus 並設定正確的光標位置
        setTimeout(function () {
          var input = document.getElementById('chatInput');
          if (input) {
            input.focus();
            var newCursorPos = before.length + option.length + 2;
            input.setSelectionRange(newCursorPos, newCursorPos);
          }
        }, 0);
      }

      function scrollMenuItemIntoView(index) {
        if (menuRef) {
          var items = menuRef.querySelectorAll('button');
          if (items[index]) items[index].scrollIntoView({
            block: 'nearest'
          });
        }
      }

      function handleKeyDown(e) {
        if (tagMenu.show) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            var next = (selectedIndex + 1) % tagMenu.options.length;
            scrollMenuItemIntoView(next);
            selectedIndex = next;
            rerender();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            var nextUp = (selectedIndex - 1 + tagMenu.options.length) % tagMenu.options.length;
            scrollMenuItemIntoView(nextUp);
            selectedIndex = nextUp;
            rerender();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            handleTagSelect(tagMenu.options[selectedIndex]);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            tagMenu = Object.assign({}, tagMenu, { show: false });
            rerender();
          }
        } else {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }
      }

      function handleFileSelect(e) {
        if (e.target.files && e.target.files[0]) {
          var file = e.target.files[0];
          if (file.type !== 'application/pdf') {
            alert('請上傳 PDF 檔案');
            return;
          }
          attachment = file;
          rerender();
        }
      }

      function handleSend() {
        if (!inputText.trim() && !attachment) return;
        var now = new Date();
        var timeString = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        var newComment = {
          id: Date.now(),
          author: '管理員',
          timestamp: timeString,
          content: inputText.trim(),
          attachment: attachment ? attachment.name : null
        };
        onAddComment(caseData.id, newComment);
        inputText = '';
        attachment = null;
        tagMenu = {
          show: false,
          type: '',
          search: '',
          options: [],
          matchStart: 0,
          matchEnd: 0
        };
        rerender();
      }

      function renderContent(text) {
        if (!text) return null;
        var parts = text.split(/(@\S+|#\S+)/g);
        return parts.map(function (part, i) {
          if (part.startsWith('@')) return h('span', {
            key: i,
            className: 'text-blue-600 font-medium'
          }, part);
          if (part.startsWith('#')) return h('span', {
            key: i,
            className: 'text-indigo-600 font-medium'
          }, part);
          return h('span', {
            key: i
          }, part);
        });
      }

      return h('div', {
        className: 'fixed inset-0 bg-black/40 flex items-center justify-center z-50'
      }, h('div', {
        className: 'bg-white rounded-lg shadow-xl w-[600px] max-w-full m-4 flex flex-col h-[80vh]'
      }, h('div', {
        className: 'flex items-center justify-between p-4 border-b shrink-0 bg-gray-50 rounded-t-lg'
      }, h('h3', {
        className: 'text-lg font-bold text-gray-800 flex items-center gap-2'
      }, Icons.Clock({
        className: 'h-5 w-5 text-indigo-600'
      }), '案件歷程 ', h('span', {
        className: 'text-sm font-normal text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded'
      }, caseData.projectNumber)), h('button', {
        onClick: onClose,
        className: 'text-gray-500 hover:bg-gray-200 p-1.5 rounded-full transition-colors'
      }, Icons.X({
        className: 'h-5 w-5'
      }))), h('div', {
        className: 'flex-1 overflow-y-auto p-4 bg-gray-100/50 space-y-4'
      }, !caseData.comments || caseData.comments.length === 0 ? h('div', {
        className: 'text-center text-gray-400 py-8'
      }, '尚無任何註記說明') : caseData.comments.map(function (msg) { return h('div', {
        key: msg.id,
        className: 'flex flex-col gap-1 max-w-[85%]'
      }, h('div', {
        className: 'flex items-baseline gap-2 px-1'
      }, h('span', {
        className: 'font-bold text-gray-800 text-sm'
      }, msg.author), h('span', {
        className: 'text-xs text-gray-400'
      }, msg.timestamp)), h('div', {
        className: 'bg-white p-3 rounded-lg rounded-tl-none shadow-sm border border-gray-100 text-gray-700 text-sm whitespace-pre-wrap'
      }, renderContent(msg.content), msg.attachment && h('div', {
        className: 'mt-3 flex items-center gap-2 text-indigo-600 bg-indigo-50 p-2 rounded border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors'
      }, Icons.FileText({
        className: 'h-4 w-4 shrink-0'
      }), h('span', {
        className: 'truncate'
      }, msg.attachment)))); }), h('div', {
        ref: function (node) {
          messagesEndRef = node;
          // 捲動到最新訊息（對應 useEffect([caseData.comments])）
          if (node && lastComments !== caseData.comments) {
            lastComments = caseData.comments;
            node.scrollIntoView({ behavior: 'smooth' });
          }
        }
      })), h('div', {
        className: 'p-4 border-t bg-white shrink-0 relative rounded-b-lg'
      }, tagMenu.show && h('div', {
        ref: function (node) { menuRef = node; },
        className: 'absolute bottom-full mb-2 left-4 bg-white border border-gray-200 rounded-md shadow-lg py-1 w-48 max-h-48 overflow-y-auto z-10'
      }, h('div', {
        className: 'px-3 py-1 text-xs font-bold text-gray-400 bg-gray-50 border-b border-gray-100 mb-1 flex justify-between'
      }, h('span', null, tagMenu.type === '@' ? '標註人員' : '加入主題標籤'), h('span', {
        className: 'font-normal text-[10px]'
      }, '上下鍵選擇')), tagMenu.options.map(function (opt, idx) {
        var isSelected = idx === selectedIndex;
        var isNew = tagMenu.type === '#' && !DYNAMIC_PROJECT_TAGS.includes(opt);
        return h('button', {
          key: opt + '-' + idx,
          onClick: function () { handleTagSelect(opt); },
          onMouseEnter: function () { selectedIndex = idx; rerender(); },
          className: 'w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ' + (isSelected ? 'bg-indigo-100 text-indigo-800 font-medium' : 'text-gray-700 hover:bg-indigo-50')
        }, h('span', null, opt), isNew && h('span', {
          className: 'text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded shadow-sm border border-green-200'
        }, '新增'));
      })), attachment && h('div', {
        className: 'flex items-center justify-between bg-indigo-50 p-2 rounded mb-2 border border-indigo-100'
      }, h('div', {
        className: 'flex items-center gap-2 text-sm text-indigo-700 truncate'
      }, Icons.FileText({
        className: 'h-4 w-4 shrink-0'
      }), h('span', {
        className: 'truncate'
      }, attachment.name)), h('button', {
        onClick: function () { attachment = null; rerender(); },
        className: 'text-gray-400 hover:text-red-500 p-1'
      }, Icons.X({
        className: 'h-4 w-4'
      }))), h('div', {
        className: 'flex items-end gap-2'
      }, h('div', {
        className: 'flex-1 bg-gray-50 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all flex items-end'
      }, h('textarea', {
        id: 'chatInput',
        value: inputText,
        onChange: handleInputChange,
        onKeyDown: handleKeyDown,
        placeholder: '輸入註記說明... (使用 @ 標註人員，# 加入標籤)',
        className: 'w-full bg-transparent border-none focus:ring-0 resize-none p-3 text-sm outline-none',
        rows: '2'
      }), h('div', {
        className: 'p-2 shrink-0'
      }, h('input', {
        type: 'file',
        ref: function (node) { fileInputRef = node; },
        onChange: handleFileSelect,
        accept: '.pdf',
        className: 'hidden'
      }), h('button', {
        onClick: function () { if (fileInputRef) fileInputRef.click(); },
        className: 'p-2 rounded-full transition-colors ' + (attachment ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'),
        title: '上傳 PDF 附件'
      }, Icons.Paperclip({
        className: 'h-5 w-5'
      })))), h('button', {
        onClick: handleSend,
        disabled: !inputText.trim() && !attachment,
        className: 'p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0',
        title: '發送 (Enter)'
      }, Icons.Send({
        className: 'h-5 w-5'
      }))))));
    });
  }

  window.ProjectHistoryModal = ProjectHistoryModal;
})();
