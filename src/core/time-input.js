/*
 * core/time-input.js — 24 小時制時間選擇器（時／分下拉）
 * props: { value, onChange, name, className, disabled, readOnly }
 * onChange 接收合成事件：{ target: { name, value } }，value 為 HH:mm
 */
(function () {
  'use strict';
  var h = IESS.h;

  var HOURS = [];
  var MINUTES = [];
  var i;
  for (i = 0; i < 24; i++) HOURS.push(String(i).padStart(2, '0'));
  for (i = 0; i < 60; i++) MINUTES.push(String(i).padStart(2, '0'));

  function parseTime(val) {
    if (!val) return { hour: '', minute: '' };
    var parts = String(val).split(':');
    var hour = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0));
    var minute = Math.min(59, Math.max(0, parseInt(parts[1] || '0', 10)));
    return {
      hour: String(hour).padStart(2, '0'),
      minute: String(minute).padStart(2, '0')
    };
  }

  function TimeInput24(props) {
    var value = props.value || '';
    var name = props.name || '';
    var disabled = props.disabled;
    var readOnly = props.readOnly;
    var className = props.className || '';
    var onChange = props.onChange;
    var parsed = parseTime(value);

    function emit(hour, minute) {
      if (readOnly || disabled || !onChange) return;
      if (!hour) {
        onChange({ target: { name: name, value: '' } });
        return;
      }
      onChange({ target: { name: name, value: hour + ':' + (minute || '00') } });
    }

    var selectCls = 'h-[42px] px-2 border rounded-md outline-none focus:border-blue-500 bg-white min-w-0 flex-1';
    if (readOnly || disabled) selectCls += ' bg-gray-50 cursor-not-allowed';

    if (readOnly) {
      return h('span', { className: (className ? className + ' ' : '') + 'inline-block py-2 text-gray-800' },
        value ? parsed.hour + ':' + parsed.minute : '—'
      );
    }

    return h('div', { className: 'flex items-center gap-1 ' + className },
      h('select', {
        value: parsed.hour,
        disabled: disabled,
        onChange: function (e) { emit(e.target.value, parsed.minute); },
        className: selectCls,
        'aria-label': '小時'
      },
        h('option', { key: '', value: '' }, '—'),
        HOURS.map(function (hr) {
          return h('option', { key: hr, value: hr }, hr);
        })
      ),
      h('span', { className: 'text-gray-500 font-medium shrink-0' }, ':'),
      h('select', {
        value: parsed.minute,
        disabled: disabled || !parsed.hour,
        onChange: function (e) { emit(parsed.hour, e.target.value); },
        className: selectCls,
        'aria-label': '分鐘'
      },
        h('option', { key: '', value: '' }, '—'),
        MINUTES.map(function (mn) {
          return h('option', { key: mn, value: mn }, mn);
        })
      )
    );
  }

  window.IESS = window.IESS || {};
  window.IESS.TimeInput24 = TimeInput24;
})();
