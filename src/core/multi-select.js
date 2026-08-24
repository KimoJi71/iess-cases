/*
 * core/multi-select.js — 下拉式複選選單（收合時於欄位內以 chips 顯示已選項目）
 *
 * MultiSelect({ id, options, value, onChange, placeholder, disabled, className })
 *   id       全域唯一字串；父層 rerender 重建元件後仍能維持展開狀態
 *   options  可選項目，支援兩種形態：
 *              A. string[]（既有呼叫端）
 *              B. [{ group, options: [{ value, label, chipLabel, hint }] }]
 *                 依上層分組顯示（如客戶→門市），同名選項可用不同 value 區分；
 *                 hint 為選項次要說明（如組別的成員名單），只出現在展開的選單裡
 *   value    string[] 已選項目（受控，元件不保存資料），內容為 option 的 value
 *   onChange function (nextValues)
 *   showEmptyGroups
 *            預設 false：沒有選項的群組整個略過不畫（多數呼叫端的群組只是分類，
 *            空群組畫出來只是雜訊）。設為 true 時改為畫出群組標題並在其下標註
 *            emptyGroupText——用在「群組本身就是使用者剛選的東西」的情境（例如
 *            指派人員：使用者選了 B組卻什麼都沒出現，會誤以為是壞掉）。
 *   emptyGroupText
 *            showEmptyGroups 時，空群組底下顯示的說明文字，預設「無可選項目」
 *
 * 選單以 portal 掛在 document.body 並 fixed 定位，避免被外層 overflow 裁切
 * （與 core/searchable-select.js 相同策略）。同一時間只會有一個選單展開。
 *
 * 選單頂端固定一列關鍵字輸入框，比對 label／chipLabel／hint／value。
 * 篩選只縮小選單的可見範圍，不影響已選項目（chips 照舊全數顯示）；
 * 關鍵字在展開期間有效，收合時清空。
 */
(function (global) {
  'use strict';

  var h = global.IESS.h;
  var stateful = global.IESS.stateful;

  var openId = null;
  var menuEl = null;
  var listEl = null;
  var searchEl = null;
  var listeners = null;
  var autoIdSeq = 0;
  // 關鍵字是「目前展開的那個選單」的狀態，與 openId/menuEl 同層級（一次只有一個選單）。
  // 刻意不放進 destroyMenu 清除：勾選選項會讓父層 rerender → syncMenu 重建選單，
  // 關鍵字必須撐過這個重建，使用者才能連續勾選多個搜尋結果。只在開合選單時重置。
  var filterText = '';
  var isComposing = false;

  // options 支援兩種形態：
  //   A. string[]（既有呼叫端）
  //   B. [{ group, options: [{ value, label, chipLabel }] }]（依上層分組，如客戶→門市）
  // 內部一律轉成形態 B 的結構處理，形態 A 視為單一個 group 為 null 的群組。
  function normalizeOption(opt) {
    if (typeof opt === 'string') {
      return { value: opt, label: opt, chipLabel: opt, hint: '' };
    }
    var value = String(opt.value);
    var label = opt.label != null ? opt.label : value;
    return {
      value: value,
      label: label,
      chipLabel: opt.chipLabel != null ? opt.chipLabel : label,
      hint: opt.hint != null ? String(opt.hint) : ''
    };
  }

  function normalizeGroups(options) {
    var list = options || [];
    var grouped = list.length && list[0] && typeof list[0] === 'object'
      && Array.isArray(list[0].options);
    if (!grouped) {
      return [{ group: null, options: list.map(normalizeOption) }];
    }
    return list.map(function (g) {
      return { group: g.group, options: (g.options || []).map(normalizeOption) };
    });
  }

  function renderChevron(className) {
    var Icons = global.IESS.Icons;
    if (Icons && Icons.ChevronDown) return Icons.ChevronDown({ className: className });
    return null;
  }

  function normalizeQuery(text) {
    return String(text || '').trim().toLowerCase();
  }

  // 比對 label／chipLabel／hint／value：跨群組同名門市只有 chipLabel 分得出來，
  // hint 則是組別的成員名單這類次要說明，使用者常直接搜成員名字。
  function optionMatchesQuery(opt, query) {
    if (!query) return true;
    return normalizeQuery(opt.label).indexOf(query) >= 0 ||
      normalizeQuery(opt.chipLabel).indexOf(query) >= 0 ||
      normalizeQuery(opt.hint).indexOf(query) >= 0 ||
      normalizeQuery(opt.value).indexOf(query) >= 0;
  }

  function filterGroups(groups, query) {
    if (!query) return groups;
    return groups.map(function (g) {
      return {
        group: g.group,
        options: g.options.filter(function (opt) { return optionMatchesQuery(opt, query); })
      };
    });
  }

  function destroyMenu() {
    if (listeners) {
      window.removeEventListener('scroll', listeners.reposition, true);
      window.removeEventListener('resize', listeners.reposition);
      document.removeEventListener('mousedown', listeners.outside, true);
      document.removeEventListener('keydown', listeners.key, true);
      listeners = null;
    }
    if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
    menuEl = null;
    listEl = null;
    searchEl = null;
  }

  function MultiSelect(props) {
    autoIdSeq += 1;
    var id = props.id || ('multi-select-' + autoIdSeq);
    if (!props.id) console.warn('IESS.MultiSelect: props.id is required to keep the menu open across rerenders');
    var rootEl = null;
    var controlEl = null;

    return stateful(function (rerender) {
      var groups = normalizeGroups(props.options);
      var flatOptions = groups.reduce(function (acc, g) { return acc.concat(g.options); }, []);
      var chipLabels = {};
      flatOptions.forEach(function (o) { chipLabels[o.value] = o.chipLabel; });
      // 對照不到時退回顯示 value 原文：資料來源變動時 chip 不會變成空白。
      // 但 value 可能是帶控制字元（U+0001）的複合鍵，原封不動顯示會黏成一團看不出分界，
      // 故把控制字元換成看得見的分隔符號。
      function chipLabelOf(v) {
        if (chipLabels[v] != null) return chipLabels[v];
        return String(v).replace(/[\x00-\x1f]/g, ' · ');
      }
      var value = (props.value || []).map(String);
      var disabled = !!props.disabled;
      var placeholder = props.placeholder || '請選擇';
      var showEmptyGroups = !!props.showEmptyGroups;
      var emptyGroupText = props.emptyGroupText || '無可選項目';
      var className = props.className || '';
      var onChange = props.onChange;

      function isOpen() {
        return openId === id;
      }

      function emit(next) {
        if (disabled || !onChange) return;
        onChange(next);
      }

      function toggleOption(opt) {
        var next = value.slice();
        var idx = next.indexOf(opt);
        if (idx === -1) next.push(opt);
        else next.splice(idx, 1);
        emit(next);
      }

      function removeOption(opt) {
        emit(value.filter(function (v) { return v !== opt; }));
      }

      function positionMenu() {
        if (!menuEl || !controlEl) return;
        // 若選單仍存在，但擁有它的 controlEl（本次 render 閉包所捕獲的節點）已不在文件內，
        // 代表使用者是在沒有經過 mousedown/outside 清理流程的情況下離開了這個表單
        // （例如在文字欄位按 Enter 送出表單），選單淪為孤兒。此處補做清理，
        // 避免浮動選單與全域監聽器繼續留在畫面上。
        // 正常情況下「同一 id 的新實例接手」會在 syncMenu 裡先 destroyMenu() 再 buildMenu()，
        // 屆時這個舊實例的 positionMenu 已不再被任何監聽器引用，不會誤觸此處的守衛。
        if (!document.body.contains(controlEl)) {
          openId = null;
          destroyMenu();
          return;
        }
        var rect = controlEl.getBoundingClientRect();
        menuEl.style.top = (rect.bottom + 2) + 'px';
        menuEl.style.left = rect.left + 'px';
        menuEl.style.width = rect.width + 'px';
      }

      function closeMenu() {
        openId = null;
        filterText = '';
        isComposing = false;
        destroyMenu();
        rerender();
      }

      function buildMenu() {
        menuEl = document.createElement('div');
        menuEl.className = 'multi-select__menu';
        document.body.appendChild(menuEl);

        buildSearch();

        listEl = document.createElement('ul');
        listEl.className = 'multi-select__list';
        listEl.setAttribute('role', 'listbox');
        listEl.setAttribute('aria-multiselectable', 'true');
        menuEl.appendChild(listEl);

        listeners = {
          reposition: function () { if (isOpen()) positionMenu(); },
          outside: function (e) {
            if (menuEl && menuEl.contains(e.target)) return;
            if (rootEl && rootEl.contains(e.target)) return;
            closeMenu();
          },
          key: function (e) {
            if (e.key === 'Escape') closeMenu();
          }
        };
        window.addEventListener('scroll', listeners.reposition, true);
        window.addEventListener('resize', listeners.reposition);
        document.addEventListener('mousedown', listeners.outside, true);
        document.addEventListener('keydown', listeners.key, true);

        positionMenu();
        renderList();
        focusSearch();
      }

      // 展開時把游標直接放進搜尋框，使用者不必再點一次就能打字。
      // 勾選選項會讓父層 rerender、整個選單重建，這裡一併把焦點與游標位置接回去，
      // 才能連續勾選多筆搜尋結果而不用每次重打關鍵字。
      function focusSearch() {
        if (!searchEl) return;
        searchEl.focus();
        var end = searchEl.value.length;
        try { searchEl.setSelectionRange(end, end); } catch (err) { /* ignore */ }
      }

      function buildSearch() {
        var wrap = document.createElement('div');
        wrap.className = 'multi-select__search';

        searchEl = document.createElement('input');
        searchEl.type = 'text';
        searchEl.className = 'multi-select__search-input';
        searchEl.placeholder = '輸入關鍵字篩選';
        searchEl.setAttribute('aria-label', '輸入關鍵字篩選選項');
        searchEl.autocomplete = 'off';
        searchEl.spellcheck = false;
        searchEl.value = filterText;

        // 注音／倉頡組字期間的 input 事件帶的是還沒組好的字根，拿去比對只會把選項全篩掉，
        // 使用者會以為選單壞了。等 compositionend 拿到組好的字再套用。
        searchEl.addEventListener('compositionstart', function () { isComposing = true; });
        searchEl.addEventListener('compositionend', function () {
          isComposing = false;
          applyFilter();
        });
        searchEl.addEventListener('input', function () {
          if (isComposing) return;
          applyFilter();
        });
        // 選單內按 Escape 由全域 keydown 監聽器關閉；此處只擋住 Enter，
        // 避免在表單裡打關鍵字時不小心送出整張表單。
        searchEl.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') e.preventDefault();
        });

        wrap.appendChild(searchEl);
        menuEl.appendChild(wrap);
      }

      function applyFilter() {
        filterText = searchEl ? searchEl.value : '';
        renderList();
        positionMenu();
      }

      function renderList() {
        if (!listEl) return;
        listEl.innerHTML = '';

        var query = normalizeQuery(filterText);
        var visibleGroups = filterGroups(groups, query);
        var visibleCount = visibleGroups.reduce(function (n, g) { return n + g.options.length; }, 0);
        // 有關鍵字時 showEmptyGroups 暫時失效：搜尋結果若夾雜一排「無可選項目」的空群組，
        // 反而看不出真正命中的是哪幾筆。清空關鍵字就回到原本行為。
        var keepEmptyGroups = showEmptyGroups && !query;

        if (!visibleCount && !keepEmptyGroups) {
          var empty = document.createElement('li');
          empty.className = 'multi-select__empty';
          empty.textContent = query ? '找不到符合的選項' : '無可選項目';
          listEl.appendChild(empty);
          return;
        }

        visibleGroups.forEach(function (group) {
          if (!group.options.length && !(keepEmptyGroups && group.group != null)) return;
          if (group.group != null) {
            var head = document.createElement('li');
            head.className = 'multi-select__group';
            head.setAttribute('role', 'presentation');
            head.textContent = group.group;
            listEl.appendChild(head);
          }
          if (!group.options.length) {
            var groupEmpty = document.createElement('li');
            groupEmpty.className = 'multi-select__empty';
            groupEmpty.textContent = emptyGroupText;
            listEl.appendChild(groupEmpty);
            return;
          }
          group.options.forEach(function (opt) {
            var checked = value.indexOf(opt.value) !== -1;
            var item = document.createElement('li');
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('role', 'option');
            btn.setAttribute('aria-selected', checked ? 'true' : 'false');
            btn.className = 'multi-select__option' + (checked ? ' multi-select__option--selected' : '');

            var box = document.createElement('span');
            box.className = 'multi-select__checkbox' + (checked ? ' multi-select__checkbox--checked' : '');
            box.textContent = checked ? '✓' : '';
            btn.appendChild(box);
            var body = document.createElement('span');
            body.className = 'multi-select__option-body';
            var labelEl = document.createElement('span');
            labelEl.className = 'multi-select__option-label';
            labelEl.textContent = opt.label;
            body.appendChild(labelEl);
            if (opt.hint) {
              var hintEl = document.createElement('span');
              hintEl.className = 'multi-select__option-hint';
              hintEl.textContent = opt.hint;
              body.appendChild(hintEl);
              btn.title = opt.label + '（' + opt.hint + '）';
            }
            btn.appendChild(body);
            // 群組標題是 role="presentation"，螢幕閱讀器讀不到；跨群組同名選項（不同客戶的同名門市）
            // 必須靠 chipLabel 才分得出彼此，否則聽起來是兩個一模一樣的「甲一店」。
            var ariaLabel = opt.chipLabel && opt.chipLabel !== opt.label ? opt.chipLabel : opt.label;
            if (opt.hint) ariaLabel += '（' + opt.hint + '）';
            if (ariaLabel !== opt.label) btn.setAttribute('aria-label', ariaLabel);

            // 用 click 而非 mousedown：click 才會被鍵盤 Enter/Space 觸發（button 原生行為），
            // 讓鍵盤使用者也能選取選項。改用 click 不會被 outside 監聽器誤判成「點外面」而先關閉選單，
            // 因為 outside 監聽器（mousedown 階段）已用 menuEl.contains(e.target) 排除選單內部。
            btn.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              toggleOption(opt.value);
            });

            item.appendChild(btn);
            listEl.appendChild(item);
          });
        });
      }

      // 只有「目前展開且已掛載到文件」的實例才重建選單，
      // 避免被丟棄的舊實例把新實例的選單關掉或定位到已卸載的節點。
      function syncMenu() {
        if (!isOpen()) return;
        if (!controlEl || !document.body.contains(controlEl)) return;
        if (disabled) { closeMenu(); return; }
        destroyMenu();
        buildMenu();
      }

      function handleControlClick(e) {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        if (isOpen()) {
          closeMenu();
          return;
        }
        destroyMenu();
        filterText = '';
        isComposing = false;
        openId = id;
        rerender();
      }

      var node = h('div', {
        className: 'multi-select ' + className,
        ref: function (el) { rootEl = el; }
      },
        h('div', {
          className: 'multi-select__control' + (disabled ? ' multi-select__control--disabled' : ''),
          role: 'combobox',
          'aria-expanded': isOpen() ? 'true' : 'false',
          tabIndex: disabled ? -1 : 0,
          ref: function (el) { controlEl = el; },
          onClick: handleControlClick,
          onKeyDown: function (e) {
            if (e.target !== controlEl) return;
            if (e.key === 'Enter' || e.key === ' ') handleControlClick(e);
          }
        },
          h('div', { className: 'multi-select__chips' },
            value.length
              ? value.map(function (v) {
                  var text = chipLabelOf(v);
                  return h('span', { className: 'multi-select__chip' },
                    text,
                    disabled ? null : h('button', {
                      type: 'button',
                      className: 'multi-select__chip-remove',
                      'aria-label': '移除 ' + text,
                      'data-no-tooltip': true,
                      onMouseDown: function (e) { e.preventDefault(); e.stopPropagation(); },
                      onClick: function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        removeOption(v);
                      }
                    }, '×')
                  );
                })
              : h('span', { className: 'multi-select__placeholder' }, placeholder)
          ),
          renderChevron('multi-select__chevron' + (isOpen() ? ' multi-select__chevron--open' : ''))
        )
      );

      // 節點要等父層插入 DOM 後才量得到位置，故延到下一個 tick 再同步選單
      setTimeout(syncMenu, 0);

      return node;
    });
  }

  // 供呼叫端在「卸載目前選單所屬的整個面板」前主動清理用（例如切換案件類型時
  // 整批換掉 filter 面板）。一般的滑鼠/Escape/失焦流程無需呼叫此函式，
  // 只有在面板會被整批換掉、且新面板可能沒有相同 id 的實例可以接手清理時才需要。
  function closeAll() {
    openId = null;
    filterText = '';
    isComposing = false;
    destroyMenu();
  }

  global.IESS = global.IESS || {};
  global.IESS.MultiSelect = MultiSelect;
  global.IESS.MultiSelect.closeAll = closeAll;
})(window);
