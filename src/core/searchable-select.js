/*
 * core/searchable-select.js — 可輸入文字過濾的下拉選單
 *
 * 攔截 h('select', ...) 並改為此元件，保留原有 props / onChange 語意。
 * 若需保留原生 <select>，可加上 data-native="true"。
 */
(function (global) {
  'use strict';

  var h = global.IESS.h;
  var stateful = global.IESS.stateful;
  var deferRerenderWhileComposing = global.IESS.deferRerenderWhileComposing;

  function extractSelectOptions(children) {
    var options = [];
    function walk(child) {
      if (child == null || child === false || child === true) return;
      if (Array.isArray(child)) {
        child.forEach(walk);
        return;
      }
      if (child.nodeType === 11) {
        Array.prototype.forEach.call(child.childNodes, walk);
        return;
      }
      if (child.nodeType === 1 && child.tagName === 'OPTION') {
        options.push({
          value: child.getAttribute('value') != null ? child.getAttribute('value') : child.textContent,
          label: child.textContent,
          disabled: child.disabled
        });
      }
    }
    walk(children);
    return options;
  }

  function normalizeQuery(text) {
    return String(text || '').trim().toLowerCase();
  }

  function optionMatchesQuery(option, query) {
    if (!query) return true;
    return normalizeQuery(option.label).indexOf(query) >= 0 ||
      normalizeQuery(option.value).indexOf(query) >= 0;
  }

  function SearchableSelect(props) {
    var isOpen = false;
    var filterText = '';
    var hasTyped = false;
    var activeIndex = 0;
    var rootEl = null;
    var blurTimer = null;

    return stateful(function (rerender) {
      var options = props.options || [];
      var value = props.value != null ? String(props.value) : '';
      var disabled = !!props.disabled;
      var readOnly = !!props.readOnly;
      var className = props.className || '';
      var name = props.name || '';
      var onChange = props.onChange;
      var required = props.required;

      function doRerender() {
        return rerender();
      }

      function refocusInput() {
        setTimeout(function () {
          if (!rootEl || !isOpen) return;
          var input = rootEl.querySelector('.searchable-select__input');
          if (input) input.focus();
        }, 0);
      }

      function safeRerender() {
        var shouldRefocus = isOpen;
        function run() {
          doRerender();
          if (shouldRefocus) refocusInput();
        }
        if (deferRerenderWhileComposing(run)) return;
        run();
      }

      function clearBlurTimer() {
        if (blurTimer) {
          clearTimeout(blurTimer);
          blurTimer = null;
        }
      }

      function getLabel(val) {
        for (var i = 0; i < options.length; i++) {
          if (String(options[i].value) === String(val)) return options[i].label;
        }
        return val || '';
      }

      function getPlaceholder() {
        for (var i = 0; i < options.length; i++) {
          if (options[i].value === '') return options[i].label;
        }
        return '請選擇';
      }

      function selectableOptions() {
        return options.filter(function (opt) {
          return !(opt.disabled && opt.value === '');
        });
      }

      function filteredOptions() {
        var query = normalizeQuery(filterText);
        return selectableOptions().filter(function (opt) {
          return optionMatchesQuery(opt, query);
        });
      }

      function openMenu() {
        if (disabled || readOnly) return;
        clearBlurTimer();
        isOpen = true;
        activeIndex = 0;
        safeRerender();
      }

      function closeMenu() {
        clearBlurTimer();
        isOpen = false;
        filterText = '';
        hasTyped = false;
        activeIndex = 0;
        safeRerender();
      }

      function scheduleClose() {
        clearBlurTimer();
        blurTimer = setTimeout(function () {
          if (rootEl && rootEl.contains(document.activeElement)) return;
          closeMenu();
        }, 120);
      }

      function emitChange(nextValue) {
        if (disabled || readOnly || !onChange) return;
        onChange({ target: { name: name, value: nextValue } });
      }

      function chooseOption(option) {
        if (!option || option.disabled) return;
        emitChange(option.value);
        closeMenu();
      }

      function handleFocus(e) {
        hasTyped = false;
        filterText = '';
        openMenu();
        if (e && e.target && typeof e.target.select === 'function') {
          setTimeout(function () {
            try { e.target.select(); } catch (err) { /* ignore */ }
          }, 0);
        }
      }

      function handleBlur() {
        scheduleClose();
      }

      function handleInput(e) {
        hasTyped = true;
        filterText = e.target.value;
        isOpen = true;
        activeIndex = 0;
        safeRerender();
      }

      function handleKeyDown(e) {
        if (disabled || readOnly) return;
        var list = filteredOptions();
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!isOpen) openMenu();
          else if (list.length) activeIndex = (activeIndex + 1) % list.length;
          safeRerender();
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (!isOpen) openMenu();
          else if (list.length) activeIndex = (activeIndex - 1 + list.length) % list.length;
          safeRerender();
          return;
        }
        if (e.key === 'Enter') {
          if (isOpen && list.length) {
            e.preventDefault();
            chooseOption(list[activeIndex] || list[0]);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          closeMenu();
        }
      }

      var visibleOptions = isOpen ? filteredOptions() : [];
      if (activeIndex >= visibleOptions.length) activeIndex = 0;

      var displayValue = isOpen
        ? (hasTyped ? filterText : getLabel(value))
        : getLabel(value);
      var placeholder = getPlaceholder();
      var inputCls = 'searchable-select__input ' + className;
      if (disabled) inputCls += ' bg-gray-50 cursor-not-allowed';
      else if (readOnly) inputCls += ' bg-gray-50 cursor-default';

      return h('div', {
        className: 'searchable-select',
        ref: function (node) { rootEl = node; }
      },
        h('input', {
          type: 'search',
          role: 'combobox',
          'aria-expanded': isOpen ? 'true' : 'false',
          'aria-autocomplete': 'list',
          name: name,
          value: displayValue,
          placeholder: placeholder,
          disabled: disabled,
          readOnly: readOnly || (!isOpen && !disabled),
          required: required,
          className: inputCls,
          autoComplete: 'off',
          autoCorrect: 'off',
          spellCheck: false,
          onFocus: handleFocus,
          onBlur: handleBlur,
          onInput: handleInput,
          onKeyDown: handleKeyDown
        }),
        isOpen && !disabled && !readOnly && h('ul', {
          className: 'searchable-select__menu',
          role: 'listbox'
        },
          visibleOptions.length
            ? visibleOptions.map(function (opt, idx) {
              var isActive = idx === activeIndex;
              var isSelected = String(opt.value) === value;
              var itemCls = 'searchable-select__option';
              if (isActive) itemCls += ' searchable-select__option--active';
              if (isSelected) itemCls += ' searchable-select__option--selected';
              if (opt.disabled) itemCls += ' searchable-select__option--disabled';
              return h('li', { key: opt.value + '-' + idx, role: 'presentation' },
                h('button', {
                  type: 'button',
                  role: 'option',
                  'aria-selected': isSelected ? 'true' : 'false',
                  disabled: opt.disabled,
                  className: itemCls,
                  onMouseDown: function (e) { e.preventDefault(); },
                  onMouseEnter: function () { activeIndex = idx; safeRerender(); },
                  onClick: function () { chooseOption(opt); }
                }, opt.label)
              );
            })
            : h('li', { className: 'searchable-select__empty', role: 'presentation' }, '找不到符合的選項')
        )
      );
    });
  }

  var nativeH = global.IESS.h;
  function patchedH(tag, props) {
    var args = arguments;
    var children = Array.prototype.slice.call(args, 2);
    if (tag === 'select') {
      props = props || {};
      if (props.native !== true && props['data-native'] !== true && !props.multiple) {
        var options = extractSelectOptions(children);
        var selectProps = Object.assign({}, props, { options: options });
        delete selectProps.children;
        return SearchableSelect(selectProps);
      }
    }
    return nativeH.apply(null, args);
  }

  global.IESS = global.IESS || {};
  global.IESS.SearchableSelect = SearchableSelect;
  global.IESS.h = patchedH;
})(window);
