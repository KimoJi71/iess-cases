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

  function renderChevron(className) {
    var Icons = global.IESS.Icons;
    if (Icons && Icons.ChevronDown) {
      return Icons.ChevronDown({ className: className });
    }
    return null;
  }

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
          hint: child.getAttribute('data-hint') || '',
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
      normalizeQuery(option.value).indexOf(query) >= 0 ||
      normalizeQuery(option.hint).indexOf(query) >= 0;
  }

  function SearchableSelect(props) {
    var isOpen = false;
    var filterText = '';
    var hasTyped = false;
    var activeIndex = 0;
    var isComposing = false;
    var pendingValue = null;
    var rootEl = null;
    var inputEl = null;
    var menuEl = null;
    var blurTimer = null;
    var menuScrollHandler = null;

    return stateful(function (rerender) {
      var options = props.options || [];
      var value = props.value != null ? String(props.value) : '';
      var disabled = !!props.disabled;
      var readOnly = !!props.readOnly;
      var className = props.className || '';
      var name = props.name || '';
      var onChange = props.onChange;
      var required = props.required;

      if (pendingValue != null && String(pendingValue) === String(value)) {
        pendingValue = null;
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

      function getEffectiveValue() {
        return pendingValue != null ? pendingValue : value;
      }

      function getDisplayValue() {
        if (isOpen && hasTyped) return filterText;
        return getLabel(getEffectiveValue());
      }

      function getPlaceholder() {
        for (var i = 0; i < options.length; i++) {
          if (options[i].value === '') return options[i].label;
        }
        return '請選擇';
      }

      function menuOptions() {
        return options.filter(function (opt) {
          if (opt.value === '' || opt.disabled) return false;
          return true;
        });
      }

      function filteredOptions() {
        var query = normalizeQuery(filterText);
        return menuOptions().filter(function (opt) {
          return optionMatchesQuery(opt, query);
        });
      }

      function findActiveIndex(list) {
        var current = getEffectiveValue();
        for (var i = 0; i < list.length; i++) {
          if (String(list[i].value) === current) return i;
        }
        return 0;
      }

      function positionMenu() {
        if (!menuEl || !inputEl) return;
        var rect = inputEl.getBoundingClientRect();
        menuEl.style.position = 'fixed';
        menuEl.style.top = (rect.bottom + 2) + 'px';
        menuEl.style.left = rect.left + 'px';
        menuEl.style.width = rect.width + 'px';
        menuEl.style.right = 'auto';
        menuEl.style.zIndex = '100';
      }

      function bindMenuListeners() {
        if (menuScrollHandler) return;
        menuScrollHandler = function () {
          if (isOpen) positionMenu();
        };
        window.addEventListener('scroll', menuScrollHandler, true);
        window.addEventListener('resize', menuScrollHandler);
      }

      function unbindMenuListeners() {
        if (!menuScrollHandler) return;
        window.removeEventListener('scroll', menuScrollHandler, true);
        window.removeEventListener('resize', menuScrollHandler);
        menuScrollHandler = null;
      }

      function removeMenu() {
        unbindMenuListeners();
        if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
        menuEl = null;
      }

      function syncMenu() {
        if (!rootEl || !isOpen || disabled || readOnly) {
          removeMenu();
          return;
        }

        var list = filteredOptions();
        if (activeIndex >= list.length) activeIndex = 0;

        if (!menuEl) {
          menuEl = document.createElement('ul');
          menuEl.className = 'searchable-select__menu searchable-select__menu--portal';
          menuEl.setAttribute('role', 'listbox');
          menuEl.addEventListener('mousedown', function (e) {
            e.preventDefault();
          });
          document.body.appendChild(menuEl);
          bindMenuListeners();
        }

        positionMenu();
        menuEl.innerHTML = '';

        if (!list.length) {
          var empty = document.createElement('li');
          empty.className = 'searchable-select__empty';
          empty.setAttribute('role', 'presentation');
          empty.textContent = '找不到符合的選項';
          menuEl.appendChild(empty);
          return;
        }

        var currentValue = getEffectiveValue();
        list.forEach(function (opt, idx) {
          var item = document.createElement('li');
          item.setAttribute('role', 'presentation');

          var btn = document.createElement('button');
          btn.type = 'button';
          btn.setAttribute('role', 'option');
          var labelEl = document.createElement('span');
          labelEl.className = 'searchable-select__option-label';
          labelEl.textContent = opt.label;
          btn.appendChild(labelEl);
          if (opt.hint) {
            var hintEl = document.createElement('span');
            hintEl.className = 'searchable-select__option-hint';
            hintEl.textContent = opt.hint;
            btn.appendChild(hintEl);
            btn.title = opt.label + '（' + opt.hint + '）';
            btn.setAttribute('aria-label', opt.label + '（' + opt.hint + '）');
          }
          btn.className = 'searchable-select__option';
          if (idx === activeIndex) btn.className += ' searchable-select__option--active';
          if (String(opt.value) === currentValue) btn.className += ' searchable-select__option--selected';
          if (opt.disabled) {
            btn.className += ' searchable-select__option--disabled';
            btn.disabled = true;
          }
          btn.setAttribute('aria-selected', String(opt.value) === currentValue ? 'true' : 'false');

          btn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (!opt.disabled) chooseOption(opt);
          });
          btn.addEventListener('mouseenter', function () {
            if (activeIndex === idx) return;
            var prev = menuEl.querySelector('.searchable-select__option--active');
            if (prev) prev.classList.remove('searchable-select__option--active');
            activeIndex = idx;
            btn.classList.add('searchable-select__option--active');
          });

          item.appendChild(btn);
          menuEl.appendChild(item);
        });

        var activeBtn = menuEl.querySelector('.searchable-select__option--active');
        if (activeBtn) activeBtn.scrollIntoView({ block: 'nearest' });
      }

      function openMenu() {
        if (disabled || readOnly) return;
        clearBlurTimer();
        isOpen = true;
        hasTyped = false;
        filterText = '';
        activeIndex = findActiveIndex(filteredOptions());
        rerender();
        syncMenu();
        setTimeout(function () {
          if (inputEl) {
            inputEl.focus();
            try { inputEl.select(); } catch (err) { /* ignore */ }
          }
        }, 0);
      }

      function closeMenu() {
        clearBlurTimer();
        isOpen = false;
        filterText = '';
        hasTyped = false;
        activeIndex = 0;
        removeMenu();
        rerender();
      }

      function scheduleClose() {
        clearBlurTimer();
        blurTimer = setTimeout(function () {
          var active = document.activeElement;
          if (rootEl && rootEl.contains(active)) return;
          if (menuEl && menuEl.contains(active)) return;
          closeMenu();
        }, 150);
      }

      function emitChange(nextValue) {
        if (disabled || readOnly || !onChange) return;
        onChange({ target: { name: name, value: nextValue } });
      }

      function chooseOption(option) {
        if (!option || option.disabled) return;
        pendingValue = option.value;
        closeMenu();
        emitChange(option.value);
        rerender();
      }

      function applyFilterFromInput() {
        filterText = inputEl ? inputEl.value : '';
        hasTyped = true;
        activeIndex = 0;
        syncMenu();
        rerender();
      }

      function handleInputMouseDown(e) {
        if (disabled || readOnly) return;
        if (!isOpen) {
          e.preventDefault();
          openMenu();
        }
      }

      function handleFocus() {
        if (!isOpen) openMenu();
      }

      function handleBlur() {
        scheduleClose();
      }

      function handleInput() {
        if (!isOpen || isComposing) return;
        applyFilterFromInput();
      }

      function handleCompositionStart() {
        isComposing = true;
      }

      function handleCompositionEnd() {
        isComposing = false;
        if (isOpen) applyFilterFromInput();
      }

      function handleKeyDown(e) {
        if (disabled || readOnly) return;
        if (e.isComposing || isComposing) return;

        var list = filteredOptions();

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!isOpen) openMenu();
          else if (list.length) activeIndex = (activeIndex + 1) % list.length;
          syncMenu();
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (!isOpen) openMenu();
          else if (list.length) activeIndex = (activeIndex - 1 + list.length) % list.length;
          syncMenu();
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

      function handleToggleMouseDown(e) {
        e.preventDefault();
      }

      function handleToggleClick(e) {
        e.preventDefault();
        e.stopPropagation();
        if (disabled || readOnly) return;
        clearBlurTimer();
        if (isOpen) closeMenu();
        else openMenu();
      }

      var inputCls = 'searchable-select__input ' + className;
      if (disabled) inputCls += ' bg-gray-50 cursor-not-allowed';
      else if (readOnly) inputCls += ' bg-gray-50 cursor-default';
      else if (!isOpen) inputCls += ' cursor-pointer';

      var wrapCls = 'searchable-select';
      if (disabled) wrapCls += ' searchable-select--disabled';
      else if (readOnly) wrapCls += ' searchable-select--readonly';
      if (props.compact === true || props['data-compact'] === true || props['data-compact'] === 'true') {
        wrapCls += ' searchable-select--compact';
      }

      return h('div', {
        className: wrapCls,
        ref: function (node) {
          if (rootEl && rootEl !== node) removeMenu();
          rootEl = node;
        }
      },
        h('input', {
          type: 'text',
          role: 'combobox',
          'aria-expanded': isOpen ? 'true' : 'false',
          'aria-autocomplete': 'list',
          name: name,
          value: getDisplayValue(),
          placeholder: getPlaceholder(),
          disabled: disabled,
          readOnly: disabled || readOnly || !isOpen,
          required: required,
          className: inputCls,
          autoComplete: 'off',
          autoCorrect: 'off',
          spellCheck: false,
          ref: function (node) {
            inputEl = node;
          },
          onMouseDown: handleInputMouseDown,
          onFocus: handleFocus,
          onBlur: handleBlur,
          onInput: handleInput,
          onCompositionStart: handleCompositionStart,
          onCompositionEnd: handleCompositionEnd,
          onKeyDown: handleKeyDown
        }),
        h('button', {
          type: 'button',
          className: 'searchable-select__toggle',
          disabled: disabled,
          tabIndex: -1,
          'data-no-tooltip': true,
          'aria-label': isOpen ? '收合選項' : '展開選項',
          onMouseDown: handleToggleMouseDown,
          onClick: handleToggleClick
        }, renderChevron('searchable-select__chevron' + (isOpen ? ' searchable-select__chevron--open' : '')))
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
