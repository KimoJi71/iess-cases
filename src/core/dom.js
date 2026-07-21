/*
 * core/dom.js — 極輕量的 DOM 建構工具
 *
 * h(tag, props, ...children) 對應原本 React.createElement 的語意，
 * 讓元件寫法近乎 1:1，但完全不依賴任何框架。
 *
 * 事件屬性（onClick、onChange...）以駝峰命名；其餘皆視為 HTML 屬性。
 * onChange 依元素型別自動對應原生 'input' 或 'change' 事件（貼近 React 語意）。
 */
(function (global) {
  'use strict';

  var Fragment = '__FRAGMENT__';

  // 需以 setAttribute 以外方式處理的特殊屬性
  var EVENT_RE = /^on[A-Z]/;

  function eventName(propName, tag, type) {
    var raw = propName.slice(2).toLowerCase(); // onClick -> click
    if (raw === 'change') {
      // React 的 onChange 對文字類欄位其實是 input 事件
      var isChangeType =
        tag === 'select' ||
        type === 'checkbox' ||
        type === 'radio' ||
        type === 'file' ||
        type === 'date' ||
        type === 'datetime-local' ||
        type === 'month';
      return isChangeType ? 'change' : 'input';
    }
    return raw;
  }

  function appendChild(node, child) {
    if (child === null || child === undefined || child === false || child === true) return;
    if (Array.isArray(child)) {
      child.forEach(function (c) { appendChild(node, c); });
      return;
    }
    if (child instanceof Node) {
      node.appendChild(child);
      return;
    }
    node.appendChild(document.createTextNode(String(child)));
  }

  function h(tag, props) {
    var children = Array.prototype.slice.call(arguments, 2);

    if (tag === Fragment) {
      var frag = document.createDocumentFragment();
      children.forEach(function (c) { appendChild(frag, c); });
      return frag;
    }

    // 允許 tag 為「元件函式」：h(Comp, props, ...) => Comp(propsWithChildren)
    if (typeof tag === 'function') {
      var p = props || {};
      if (children.length) p = Object.assign({}, p, { children: children });
      return tag(p);
    }

    var node = document.createElement(tag);
    props = props || {};
    var type = props.type;
    var deferredValue; // <select> 的 value 需在 <option> 子節點加入後才能設定
    var hasDeferredValue = false;
    var refFn = null;

    Object.keys(props).forEach(function (name) {
      var value = props[name];
      if (value === null || value === undefined || value === false) {
        // 略過（disabled=false 之類）
        if (name === 'className' && value === '') node.className = '';
        return;
      }

      if (name === 'children') {
        appendChild(node, value);
      } else if (EVENT_RE.test(name)) {
        node.addEventListener(eventName(name, tag, type), value);
      } else if (name === 'className') {
        node.className = value;
      } else if (name === 'htmlFor') {
        node.setAttribute('for', value);
      } else if (name === 'style' && typeof value === 'object') {
        Object.assign(node.style, value);
      } else if (name === 'value') {
        if (tag === 'select') { deferredValue = value; hasDeferredValue = true; }
        else node.value = value;
      } else if (name === 'checked') {
        node.checked = !!value;
      } else if (name === 'disabled' || name === 'readOnly' || name === 'multiple' || name === 'selected') {
        node[name] = !!value;
      } else if (name === 'dangerouslySetInnerHTML') {
        node.innerHTML = value.__html;
      } else if (name === 'ref' && typeof value === 'function') {
        refFn = value; // 延後到子節點與 value 設定完成後再呼叫
      } else {
        node.setAttribute(name, value);
      }
    });

    children.forEach(function (c) { appendChild(node, c); });
    if (hasDeferredValue) node.value = deferredValue;
    if (refFn) refFn(node);
    return node;
  }

  // 清空節點並填入新內容
  function mount(node, content) {
    node.textContent = '';
    appendChild(node, content);
    return node;
  }

  // IME 組字期間延後重繪，避免輸入框被重建導致注音無法選字
  var isComposing = false;
  var deferredRerenders = [];

  document.addEventListener('compositionstart', function () { isComposing = true; }, true);
  document.addEventListener('compositionend', function () {
    isComposing = false;
    var queue = deferredRerenders.slice();
    deferredRerenders = [];
    queue.forEach(function (fn) { fn(); });
  }, true);

  function deferRerenderWhileComposing(rerenderFn) {
    if (isComposing) {
      if (deferredRerenders.indexOf(rerenderFn) === -1) {
        deferredRerenders.push(rerenderFn);
      }
      return true;
    }
    return false;
  }

  /*
   * stateful(build) — 具區域狀態的元件基座
   *
   * build(rerender) 回傳一個 DOM 節點；元件的狀態放在 build 外層的閉包變數，
   * 事件處理器改變狀態後呼叫 rerender() 重建整棵子樹並就地替換。
   *
   * 組字期間（注音/拼音）會自動延後重繪，避免 IME 選字被中斷。
   */
  function stateful(build) {
    var node;

    // 以「子節點索引路徑」定位目前聚焦的元素，重繪後於相同路徑還原聚焦與游標位置
    function pathTo(root, el) {
      var path = [];
      var cur = el;
      while (cur && cur !== root) {
        var parent = cur.parentNode;
        if (!parent) return null;
        path.unshift(Array.prototype.indexOf.call(parent.childNodes, cur));
        cur = parent;
      }
      return cur === root ? path : null;
    }
    function nodeAt(root, path) {
      var cur = root;
      for (var i = 0; i < path.length; i++) {
        if (!cur) return null;
        cur = cur.childNodes[path[i]];
      }
      return cur;
    }

    function doRerender() {
      var active = document.activeElement;
      var path = null, selStart = null, selEnd = null;
      if (active && node && node.contains && node.contains(active)) {
        path = pathTo(node, active);
        try { selStart = active.selectionStart; selEnd = active.selectionEnd; } catch (e) { /* 某些型別不支援 */ }
      }
      var next = build(rerender);
      if (node && node.parentNode) node.parentNode.replaceChild(next, node);
      node = next;
      if (path) {
        var target = nodeAt(node, path);
        if (target && typeof target.focus === 'function') {
          target.focus();
          try { if (selStart != null) target.setSelectionRange(selStart, selEnd); } catch (e) { /* 略過 */ }
        }
      }
      return node;
    }

    function rerender() {
      if (deferRerenderWhileComposing(doRerender)) return node;
      return doRerender();
    }

    node = build(rerender);
    return node;
  }

  /*
   * useDragScroll() — 以滑鼠拖曳橫向捲動容器（對應原本的自訂 hook）
   * 用法：Object.assign({ className: '...' }, useDragScroll()) 展開到容器 props。
   */
  function useDragScroll() {
    var el = null;
    var isDragging = false;
    var startX = 0;
    var scrollLeft = 0;
    return {
      ref: function (n) { el = n; },
      onMouseDown: function (e) {
        if (!el) return;
        isDragging = true;
        startX = e.pageX - el.offsetLeft;
        scrollLeft = el.scrollLeft;
      },
      onMouseLeave: function () { isDragging = false; },
      onMouseUp: function () { isDragging = false; },
      onMouseMove: function (e) {
        if (!isDragging || !el) return;
        e.preventDefault();
        var x = e.pageX - el.offsetLeft;
        var walk = (x - startX) * 1.5;
        el.scrollLeft = scrollLeft - walk;
      }
    };
  }

  global.IESS = global.IESS || {};
  global.IESS.h = h;
  global.IESS.Fragment = Fragment;
  global.IESS.mount = mount;
  global.IESS.stateful = stateful;
  global.IESS.useDragScroll = useDragScroll;
  global.IESS.deferRerenderWhileComposing = deferRerenderWhileComposing;
})(window);
