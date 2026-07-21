/*
 * core/icon-button.js — 圖示按鈕（含 hover tooltip）
 *
 * iconActionBtn({ label, icon, onClick, className, disabled })
 *
 * 攔截 h('button', { title, ... }, Icons.*) 且僅含圖示時，自動改為含 tooltip 的按鈕。
 * 若需保留原生行為，加上 data-no-tooltip="true"。
 */
(function (global) {
  'use strict';

  var nativeH = global.IESS.h;

  function isIconNode(node) {
    if (!node || node.nodeType !== 1) return false;
    return node.tagName === 'svg' || (node.tagName === 'SPAN' && node.querySelector && node.querySelector('svg'));
  }

  function isIconOnlyChildren(children) {
    var items = [];
    function walk(child) {
      if (child == null || child === false || child === true) return;
      if (Array.isArray(child)) { child.forEach(walk); return; }
      items.push(child);
    }
    walk(children);
    return items.length === 1 && isIconNode(items[0]);
  }

  function iconActionBtn(opts) {
    opts = opts || {};
    var label = String(opts.label || opts.title || '').trim();
    var btnProps = {
      type: 'button',
      className: opts.className,
      disabled: !!opts.disabled,
      'data-no-tooltip': true
    };
    if (opts.onClick) btnProps.onClick = opts.onClick;
    if (opts.disabled !== undefined) btnProps.disabled = !!opts.disabled;
    if (label) btnProps['aria-label'] = label;

    return nativeH('span', { className: 'icon-tooltip' + (opts.wrapperClassName ? ' ' + opts.wrapperClassName : '') },
      nativeH('button', btnProps, opts.icon),
      label ? nativeH('span', { className: 'icon-tooltip__tip', role: 'tooltip' }, label) : null
    );
  }

  function patchedH(tag, props) {
    var args = arguments;
    var children = Array.prototype.slice.call(args, 2);

    if (tag === 'button' || tag === 'button') {
      props = props || {};
      var label = props.title || props['aria-label'];
      if (label && props['data-no-tooltip'] !== true && isIconOnlyChildren(children)) {
        return iconActionBtn({
          label: label,
          onClick: props.onClick,
          className: props.className,
          disabled: props.disabled,
          icon: children[0]
        });
      }
    }

    return nativeH.apply(null, args);
  }

  global.IESS = global.IESS || {};
  global.IESS.iconActionBtn = iconActionBtn;
  global.IESS.h = patchedH;
})(window);
