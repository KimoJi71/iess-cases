/*
 * core/signature-pad.js — 簽名板（Modal）
 *
 * IESS.SignaturePadModal({ title, value, onConfirm(dataUrl), onClose })
 * 以 canvas 手寫簽名，確認後回傳 PNG dataURL（未簽名回傳空字串＝清除簽名）。
 * 畫布內容存在 canvas 本身，因此整個 modal 期間不重繪，改以直接操作 DOM 切換按鈕狀態。
 */
(function (global) {
  'use strict';

  var CANVAS_W = 640;
  var CANVAS_H = 260;

  function SignaturePadModal(props) {
    var h = IESS.h, Icons = IESS.Icons;
    var onConfirm = props.onConfirm;
    var onClose = props.onClose;
    var hasStroke = false;

    var canvas = h('canvas', {
      width: String(CANVAS_W),
      height: String(CANVAS_H),
      className: 'w-full h-[260px] bg-white rounded-md border border-dashed border-gray-300 touch-none cursor-crosshair'
    });
    var ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1f2937';

    // 帶入既有簽名，讓使用者可以接續補簽或整張清除重簽
    if (props.value) {
      var img = new Image();
      img.onload = function () { ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H); };
      img.src = props.value;
      hasStroke = true;
    }

    function pointOf(e) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
        y: (e.clientY - rect.top) * (CANVAS_H / rect.height)
      };
    }

    var drawing = false;
    canvas.addEventListener('pointerdown', function (e) {
      drawing = true;
      hasStroke = true;
      // 觸控筆拖出畫布時仍持續接收事件；非真實指標（測試合成事件）會丟例外，忽略即可
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      var p = pointOf(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var p = pointOf(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      e.preventDefault();
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (name) {
      canvas.addEventListener(name, function () { drawing = false; });
    });

    function handleClear() {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      hasStroke = false;
    }

    function handleConfirm() {
      onConfirm(hasStroke ? canvas.toDataURL('image/png') : '');
    }

    return h('div', { className: 'app-modal-overlay p-4' },
      h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl m-4' },
        h('div', { className: 'flex justify-between items-center mb-4' },
          h('h3', { className: 'text-lg font-bold text-gray-800' }, props.title || '客戶簽收'),
          h('button', {
            type: 'button',
            onClick: onClose,
            className: 'text-gray-400 hover:text-gray-600'
          }, Icons.X({ className: 'h-5 w-5' }))
        ),
        h('p', { className: 'text-sm text-gray-500 mb-2' }, '請客戶在下方空白處簽名'),
        canvas,
        h('div', { className: 'mt-4 flex justify-between items-center' },
          h('button', {
            type: 'button',
            onClick: handleClear,
            className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
          }, '清除重簽'),
          h('div', { className: 'flex gap-3' },
            h('button', {
              type: 'button',
              onClick: onClose,
              className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
            }, '取消'),
            h('button', {
              type: 'button',
              onClick: handleConfirm,
              className: 'px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
            }, '確認簽收')
          )
        )
      )
    );
  }

  global.IESS = global.IESS || {};
  global.IESS.SignaturePadModal = SignaturePadModal;
})(window);
