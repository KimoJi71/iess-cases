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

  /* tooltip 以 absolute 貼在按鈕上方時，會被列表的 overflow-x-auto 容器裁掉
   * （文字較長的提示尤其明顯），z-index 無法跨出 overflow 容器，
   * 因此 hover／focus 當下改用 fixed 定位並依按鈕位置計算座標，必要時往下翻。 */
  var TIP_GAP = 6;
  var TIP_EDGE = 8;

  function positionTip(wrapper, tip) {
    var trigger = wrapper.querySelector('button') || wrapper;
    var rect = trigger.getBoundingClientRect();
    tip.style.position = 'fixed';
    tip.style.transform = 'none';
    tip.style.bottom = 'auto';
    tip.style.right = 'auto';

    var width = tip.offsetWidth;
    var height = tip.offsetHeight;
    var left = rect.left + rect.width / 2 - width / 2;
    var maxLeft = window.innerWidth - width - TIP_EDGE;
    if (left > maxLeft) left = maxLeft;
    if (left < TIP_EDGE) left = TIP_EDGE;

    var top = rect.top - height - TIP_GAP;
    if (top < TIP_EDGE) top = rect.bottom + TIP_GAP;

    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  function bindTipPositioning(wrapper, tip) {
    var reposition = function () { positionTip(wrapper, tip); };
    var tracking = false;

    function startTracking() {
      positionTip(wrapper, tip);
      if (tracking) return;
      tracking = true;
      window.addEventListener('scroll', reposition, true);
      window.addEventListener('resize', reposition);
    }

    function stopTracking() {
      if (!tracking) return;
      tracking = false;
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    }

    wrapper.addEventListener('mouseenter', startTracking);
    wrapper.addEventListener('mouseleave', stopTracking);
    wrapper.addEventListener('focusin', startTracking);
    wrapper.addEventListener('focusout', stopTracking);
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

    var tip = label
      ? nativeH('span', { className: 'icon-tooltip__tip', role: 'tooltip' }, label)
      : null;
    var wrapper = nativeH('span',
      { className: 'icon-tooltip' + (opts.wrapperClassName ? ' ' + opts.wrapperClassName : '') },
      nativeH('button', btnProps, opts.icon),
      tip
    );
    if (tip) bindTipPositioning(wrapper, tip);
    return wrapper;
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
