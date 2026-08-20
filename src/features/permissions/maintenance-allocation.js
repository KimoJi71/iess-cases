/*
 * features/permissions/maintenance-allocation.js — 保養分配：客戶月份網格、編輯 Modal、刪除確認
 * props: { assignees, customers, stores, maintenanceCases, serviceLevels, maintenanceAllocations, setMaintenanceAllocations, maintenanceAllocationYears, setMaintenanceAllocationYears, showToast }
 */
(function () {
  'use strict';

  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  var SEGMENT_BG = ['bg-sky-50/70', 'bg-amber-50/70'];
  // 工具列的下拉、統計、按鈕共用同一組高度與圓角，整排才會對齊在同一條基線上
  var TOOLBAR_CONTROL = 'h-10 px-3 border rounded-md text-sm';
  var TOOLBAR_BUTTON = TOOLBAR_CONTROL
    + ' inline-flex items-center gap-1.5 whitespace-nowrap bg-white transition-colors';
  var persistedSelectedAssigneeId = '';
  var persistedSelectedYear = 0;
  var persistedScrollLeft = 0;

  function todayString() {
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function MaintenanceAllocation(props) {
    var assignees = props.assignees || [];
    var customers = props.customers || [];
    var stores = props.stores || [];
    var maintenanceCases = props.maintenanceCases || [];
    var serviceLevels = props.serviceLevels || [];
    var maintenanceAllocations = props.maintenanceAllocations || [];
    var setMaintenanceAllocations = props.setMaintenanceAllocations;
    var showToast = props.showToast;
    var maintenanceAllocationYears = props.maintenanceAllocationYears || [];
    var setMaintenanceAllocationYears = props.setMaintenanceAllocationYears;

    var availableYears = MaintenanceAllocationUtils.listYears(maintenanceAllocationYears);
    var thisYear = new Date().getFullYear();
    var selectedYear = persistedSelectedYear;
    if (availableYears.indexOf(selectedYear) === -1) {
      selectedYear = availableYears.indexOf(thisYear) !== -1
        ? thisYear
        : (availableYears[0] || 0);
      persistedSelectedYear = selectedYear;
    }

    var createModal = null;
    var resyncModal = null;
    // 上一次算出的 diffSnapshot；只在 Modal 開著時沿用（見 stateful 內的說明）
    var lastSnapshotDiff = null;

    var selectedAssigneeId = persistedSelectedAssigneeId;
    var editModal = null;
    var deleteModal = null;
    var scrollEl = null;

    function syncScrollFromEl() {
      if (scrollEl) persistedScrollLeft = scrollEl.scrollLeft;
    }

    function restoreScrollLeft(n) {
      if (!n) return;
      var left = persistedScrollLeft;
      n.scrollLeft = left;
      requestAnimationFrame(function () {
        if (n === scrollEl) n.scrollLeft = left;
      });
    }

    var scrollProps = {
      ref: function (n) {
        scrollEl = n;
        if (!n) return;
        restoreScrollLeft(n);
        n.addEventListener('scroll', syncScrollFromEl);
      }
    };

    function getSortedAssignees() {
      return assignees.slice().sort(function (a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
      });
    }

    function openEditModal(row, month) {
      var period = MaintenanceAllocationUtils.findPeriodInRow(row, month);
      if (!period) {
        showToast('此月份不在該年度的保養區間內', 'error');
        return false;
      }
      var existing = MaintenanceAllocationUtils.findAllocation(
        maintenanceAllocations,
        selectedYear,
        selectedAssigneeId,
        row.customerName,
        month
      );
      editModal = {
        customerName: row.customerName,
        month: month,
        visitIndex: period.visitIndex,
        period: period,
        row: row,
        targetCount: existing ? existing.targetCount : '',
        storeCount: row.storeCount,
        serviceLevel: row.serviceLevel
      };
      return true;
    }

    return stateful(function (rerender) {
      var sortedAssignees = getSortedAssignees();
      var assignee = assignees.find(function (item) {
        return item.id === selectedAssigneeId;
      }) || null;
      var snapshot = MaintenanceAllocationUtils.findYearSnapshot(
        maintenanceAllocationYears, selectedYear
      );
      var rows = (assignee && snapshot)
        ? MaintenanceAllocationUtils.getSnapshotRows(snapshot, selectedAssigneeId)
        : [];
      var removedGroups = (assignee && snapshot)
        ? MaintenanceAllocationUtils.getRemovedRowGroups(
            maintenanceAllocations, snapshot, selectedAssigneeId
          )
        : [];
      // 過去年度的骨架已凍結，主檔必然 drift：既不比對也不提供同步（見 renderFrozenNote）
      var isCurrentYear = Number(selectedYear) === Number(thisYear);
      var snapshotDiff = null;
      if (snapshot && isCurrentYear) {
        // Modal 開著時沿用上一次的結果：在「目標完成數」輸入框裡每按一鍵都會 rerender()，
        // 沒必要為此重跑一次全組別 × 全門市的 buildYearSnapshot。
        snapshotDiff = (editModal && lastSnapshotDiff)
          ? lastSnapshotDiff
          : MaintenanceAllocationUtils.diffSnapshot(
              snapshot, assignees, customers, stores, serviceLevels
            );
        lastSnapshotDiff = snapshotDiff;
      } else {
        lastSnapshotDiff = null;
      }
      var hasDiff = MaintenanceAllocationUtils.hasSnapshotDiff(snapshotDiff);

      if (selectedAssigneeId && !assignee) {
        selectedAssigneeId = '';
        persistedSelectedAssigneeId = '';
      }

      function closeEditModal() {
        editModal = null;
        rerender();
      }

      function closeDeleteModal() {
        deleteModal = null;
        rerender();
      }

      function handleSave() {
        if (!editModal || !selectedAssigneeId) return;
        syncScrollFromEl();

        var visitIndex = Number(editModal.visitIndex);
        var targetCount = Number(editModal.targetCount);
        var warnings = MaintenanceAllocationUtils.buildSaveWarnings({
          allocations: maintenanceAllocations,
          year: selectedYear,
          assigneeId: selectedAssigneeId,
          customerName: editModal.customerName,
          month: editModal.month,
          visitIndex: visitIndex,
          targetCount: targetCount,
          storeCount: editModal.storeCount,
          // 帶上快照的列，合計才會依「該月所屬區間」分組，而非格子上可能過期的 visitIndex
          row: editModal.row
        });

        setMaintenanceAllocations(MaintenanceAllocationUtils.upsertAllocation(maintenanceAllocations, {
          year: selectedYear,
          assigneeId: selectedAssigneeId,
          customerName: editModal.customerName,
          month: editModal.month,
          visitIndex: visitIndex,
          targetCount: targetCount
        }));

        editModal = null;

        if (warnings.length) {
          showToast('保養分配已儲存；' + warnings.join('；'), 'error');
          return;
        }
        showToast('保養分配已儲存');
      }

      function handleDelete() {
        if (!deleteModal || !selectedAssigneeId) return;
        syncScrollFromEl();

        setMaintenanceAllocations(MaintenanceAllocationUtils.removeAllocation(
          maintenanceAllocations,
          selectedYear,
          selectedAssigneeId,
          deleteModal.customerName,
          deleteModal.month
        ));
        deleteModal = null;
        showToast('保養分配已刪除');
      }

      function renderSelectionPrompt() {
        return h(
          'div',
          { className: 'border border-dashed border-gray-200 rounded-lg p-10 text-center text-gray-400 text-base' },
          '請先選擇組別'
        );
      }

      function renderEmptyYearPrompt() {
        return h(
          'div',
          { className: 'border border-dashed border-gray-200 rounded-lg p-10 text-center' },
          h('div', { className: 'text-gray-400 text-base mb-4' }, '尚未建立任何年度分配表'),
          h(
            'button',
            {
              type: 'button',
              onClick: openCreateModal,
              className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
            },
            '建立年度分配表'
          )
        );
      }

      /**
       * 過去年度改顯示中性說明：骨架凍結是刻意的，提示條掛在那裡只會變成永久噪音
       * （服務等級一改名，所有舊年度都會永遠顯示「N 列設定變動」），
       * 而提示條旁的同步鈕按下去等於用今天的主檔重寫歷史骨架。
       */
      function renderFrozenNote() {
        if (!snapshot || isCurrentYear) return null;
        return h(
          'div',
          { className: 'mb-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500' },
          selectedYear + ' 年度骨架已凍結（建立於 ' + (snapshot.createdAt || '—') + '）'
        );
      }

      function renderDiffBanner() {
        if (!isCurrentYear || !hasDiff) return null;
        return h(
          'div',
          {
            className: 'mb-4 flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'
          },
          Icons.AlertCircle({ className: 'h-4 w-4 shrink-0' }),
          h('span', { className: 'flex-1 min-w-0' },
            '主檔已變動：' + MaintenanceAllocationUtils.formatDiffSummary(snapshotDiff)
              + '。本年度骨架維持建立當時的設定，需要時可重新同步。')
        );
      }

      function renderMonthCell(row, month, segment) {
        var cell = MaintenanceAllocationUtils.findAllocation(
          maintenanceAllocations,
          selectedYear,
          selectedAssigneeId,
          row.customerName,
          month
        );
        // 標籤的次數以「該月所屬區段」為準：格子上存的 visitIndex 只是寫入當下的快取，
        // 重新同步後可能落在別的區段裡，照著畫會在第 2 次的區段中顯示「第3次」。
        var label = MaintenanceAllocationUtils.formatCellLabel(
          cell, segment ? segment.period.visitIndex : null
        );
        var isOrphan = cell && MaintenanceAllocationUtils.isOrphanAllocation(cell, snapshot);

        var tdClass = 'p-2 align-top';
        var header = null;
        if (segment) {
          var period = segment.period;
          tdClass += ' ' + SEGMENT_BG[segment.order % SEGMENT_BG.length];
          if (Number(period.startMonth) === month) tdClass += ' border-l-2 border-l-blue-300';
          if (Number(period.endMonth) === month) tdClass += ' border-r-2 border-r-blue-300';
          if (Number(period.startMonth) === month) {
            var done = MaintenanceAllocationUtils.countCompletedStores(
              maintenanceCases, assignee && assignee.name, row.customerName, period, selectedYear
            );
            header = h('div', { className: 'text-[11px] text-gray-500 mb-1 whitespace-nowrap' },
              '第' + period.visitIndex + '次 ' + done + '/' + row.storeCount);
          }
        }

        return h(
          'td',
          { key: month, className: tdClass },
          header,
          h(
            'div',
            {
              onClick: function () {
                syncScrollFromEl();
                if (isOrphan) {
                  deleteModal = {
                    customerName: row.customerName,
                    month: month,
                    label: row.customerName + ' ' + month + '月（' + label + '）'
                  };
                  showToast('此格已不在保養區間內，僅能刪除', 'error');
                  rerender();
                  return;
                }
                openEditModal(row, month);
                rerender();
              },
              className: 'min-h-[68px] rounded-md border ' +
                (isOrphan
                  ? 'border-red-300 border-dashed bg-red-50/50 hover:bg-red-100/50'
                  : (label
                      ? 'border-blue-200 bg-blue-50/70 hover:bg-blue-100/70'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/40')) +
                ' px-2 py-2 cursor-pointer transition-colors',
              title: isOrphan ? '此格已不在現行保養區間內' : ''
            },
            h(
              'div',
              { className: 'flex items-start justify-between gap-2' },
              h(
                'div',
                { className: 'flex-1 min-w-0 text-xs leading-5 text-gray-700 break-words' },
                (isOrphan && label) ? ('⚠ ' + label) : (label || h('span', { className: 'text-gray-300' }, ''))
              ),
              cell
                ? h(
                    'button',
                    {
                      type: 'button',
                      title: '刪除',
                      onClick: function (e) {
                        e.stopPropagation();
                        syncScrollFromEl();
                        deleteModal = {
                          customerName: row.customerName,
                          month: month,
                          label: row.customerName + ' ' + month + '月（' + label + '）'
                        };
                        rerender();
                      },
                      className: 'p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded transition-colors shrink-0'
                    },
                    Icons.Trash2({ className: 'h-3.5 w-3.5' })
                  )
                : null
            )
          )
        );
      }

      function openRemovedDelete(customerName, month, label) {
        syncScrollFromEl();
        deleteModal = {
          customerName: customerName,
          month: month,
          label: customerName + ' ' + month + '月（' + label + '）'
        };
        rerender();
      }

      /**
       * 整列已從快照消失的孤兒格：以唯讀列補在網格底部，只提供刪除。
       * 不畫這一列的話，這些格子看不見也刪不掉，卻仍留在資料裡。
       */
      function renderRemovedRow(group) {
        var byMonth = {};
        group.cells.forEach(function (c) { byMonth[Number(c.month)] = c; });
        return h(
          'tr',
          { key: '__removed__' + group.customerName, className: 'bg-red-50/30' },
          h(
            'td',
            { className: 'p-3' },
            h('div', { className: 'font-medium text-gray-800' }, group.customerName),
            h(
              'span',
              {
                className: 'inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium border border-red-200 bg-red-50 text-red-600'
              },
              '已不在本年度骨架中'
            )
          ),
          h('td', { className: 'p-3 text-center text-gray-400' }, '—'),
          MONTHS.map(function (month) {
            var cell = byMonth[month] || null;
            if (!cell) return h('td', { key: month, className: 'p-2 align-top' });
            var label = MaintenanceAllocationUtils.formatCellLabel(cell);
            return h(
              'td',
              { key: month, className: 'p-2 align-top' },
              h(
                'div',
                {
                  onClick: function () {
                    showToast('此客戶已不在本年度骨架中，僅能刪除', 'error');
                    openRemovedDelete(group.customerName, month, label);
                  },
                  className: 'min-h-[68px] rounded-md border border-red-300 border-dashed bg-red-50/50 '
                    + 'hover:bg-red-100/50 px-2 py-2 cursor-pointer transition-colors',
                  title: '此客戶已不在本年度骨架中'
                },
                h(
                  'div',
                  { className: 'flex items-start justify-between gap-2' },
                  h(
                    'div',
                    { className: 'flex-1 min-w-0 text-xs leading-5 text-gray-700 break-words' },
                    '⚠ ' + label
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      title: '刪除',
                      onClick: function (e) {
                        e.stopPropagation();
                        openRemovedDelete(group.customerName, month, label);
                      },
                      className: 'p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded transition-colors shrink-0'
                    },
                    Icons.Trash2({ className: 'h-3.5 w-3.5' })
                  )
                )
              )
            );
          })
        );
      }

      function renderGrid() {
        return h(
          'div',
          Object.assign({}, scrollProps, {
            className: 'overflow-x-auto border rounded-lg'
          }),
          h(
            'table',
            { className: 'w-full min-w-[1060px] table-fixed text-left text-sm text-gray-600' },
            h(
              'thead',
              { className: 'bg-gray-50 text-gray-700 border-b' },
              h(
                'tr',
                null,
                h('th', { className: 'p-3 font-semibold w-52' }, '客戶名稱'),
                h('th', { className: 'p-3 font-semibold text-center w-28' }, '負責門市數'),
                MONTHS.map(function (month) {
                  return h('th', { key: month, className: 'p-3 font-semibold text-center w-24' }, month + '月');
                })
              )
            ),
            h(
              'tbody',
              { className: 'divide-y divide-gray-100' },
              (rows.length === 0 && removedGroups.length === 0)
                ? h(
                    'tr',
                    null,
                    h('td', { colspan: 14, className: 'p-10 text-center text-gray-400 text-base' }, '尚無符合條件的客戶')
                  )
                : rows.map(function (row) {
                    var segments = MaintenanceAllocationUtils.buildSegmentMap(row);
                    return h(
                      'tr',
                      { key: row.customerName, className: 'hover:bg-blue-50/40 transition-colors' },
                      h(
                        'td',
                        { className: 'p-3' },
                        h('div', { className: 'font-medium text-gray-800' }, row.customerName),
                        h(
                          'span',
                          {
                            className: 'inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium border border-gray-200 bg-gray-50 text-gray-600'
                          },
                          row.serviceLevel || '—'
                        )
                      ),
                      h('td', { className: 'p-3 text-center' }, String(row.storeCount)),
                      MONTHS.map(function (month) {
                        return renderMonthCell(row, month, segments[month] || null);
                      })
                    );
                  }),
              removedGroups.map(renderRemovedRow)
            )
          )
        );
      }

      function renderEditDialog() {
        if (!editModal) return null;

        return h(
          'div',
          { className: 'app-modal-overlay' },
          h(
            'div',
            { className: 'bg-white rounded-lg shadow-xl p-6 w-[28rem] max-w-full m-4' },
            h('h3', { className: 'text-lg font-bold text-gray-800 mb-1' }, '編輯保養分配'),
            h(
              'p',
              { className: 'text-sm text-gray-500 mb-6' },
              selectedYear + ' 年 / ' + editModal.customerName + ' / ' + editModal.month
                + '月 / 負責門市數 ' + editModal.storeCount
            ),
            h(
              'div',
              { className: 'space-y-4' },
              h(
                'div',
                null,
                h('label', { className: 'block text-sm text-gray-600 mb-1' }, '月份'),
                h('div', { className: 'w-full p-2.5 border rounded-md bg-gray-50 text-gray-700' }, editModal.month + '月')
              ),
              h(
                'div',
                null,
                h('label', { className: 'block text-sm text-gray-600 mb-1' }, '保養次數'),
                h('div', { className: 'w-full p-2.5 border rounded-md bg-gray-50 text-gray-700' },
                  '第 ' + editModal.visitIndex + ' 次（'
                    + editModal.period.startMonth + '-' + editModal.period.endMonth + '月）')
              ),
              h(
                'div',
                null,
                h('label', { className: 'block text-sm text-gray-600 mb-1' }, '目標完成數'),
                h('input', {
                  type: 'number',
                  min: '0',
                  value: editModal.targetCount,
                  onChange: function (e) {
                    editModal.targetCount = e.target.value;
                    rerender();
                  },
                  className: 'w-full p-2.5 border rounded-md outline-none'
                })
              )
            ),
            h(
              'div',
              { className: 'flex justify-end gap-3 mt-8 pt-6 border-t' },
              h(
                'button',
                {
                  type: 'button',
                  onClick: closeEditModal,
                  className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
                },
                '取消'
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: handleSave,
                  className: 'flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
                },
                Icons.Save({ className: 'h-4 w-4' }),
                '儲存'
              )
            )
          )
        );
      }

      function renderDeleteDialog() {
        if (!deleteModal) return null;

        return h(
          'div',
          { className: 'app-modal-overlay' },
          h(
            'div',
            { className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4' },
            h(
              'div',
              { className: 'flex items-center space-x-3 text-red-600 mb-4' },
              Icons.AlertCircle({ className: 'h-6 w-6' }),
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '確認刪除')
            ),
            h('p', { className: 'text-gray-600 mb-6' }, '確定要刪除保養分配「' + deleteModal.label + '」嗎？'),
            h(
              'div',
              { className: 'flex justify-end space-x-3' },
              h(
                'button',
                {
                  type: 'button',
                  onClick: closeDeleteModal,
                  className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
                },
                '取消'
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: handleDelete,
                  className: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors'
                },
                '確認刪除'
              )
            )
          )
        );
      }

      function handleCreateYear() {
        if (!createModal) return;
        var year = Number(createModal.year);
        if (!year || year < 2000 || year > 2999) {
          showToast('請輸入 2000–2999 之間的年份', 'error');
          return;
        }
        if (MaintenanceAllocationUtils.findYearSnapshot(maintenanceAllocationYears, year)) {
          showToast('該年度分配表已存在', 'error');
          return;
        }
        var snap = MaintenanceAllocationUtils.buildYearSnapshot(
          year, assignees, customers, stores, serviceLevels, todayString()
        );
        // 先更新選定年度再寫回 store：setMaintenanceAllocationYears 會同步重繪整個畫面，
        // 新的元件實體會依 persistedSelectedYear 決定要顯示哪一年。
        selectedYear = year;
        persistedSelectedYear = year;
        persistedScrollLeft = 0;
        createModal = null;
        setMaintenanceAllocationYears(maintenanceAllocationYears.concat([snap]));
        showToast('已建立 ' + year + ' 年度分配表（' + snap.rows.length + ' 列）');
      }

      function handleResync() {
        if (!snapshot) return;
        syncScrollFromEl();
        var next = MaintenanceAllocationUtils.resyncYear(
          snapshot, assignees, customers, stores, serviceLevels, todayString()
        );
        // 先取摘要再清 modal：setMaintenanceAllocationYears 會同步重繪整個畫面，
        // 這裡讀的是舊實體的閉包變數，順序寫反就會讀到 null。
        var summary = MaintenanceAllocationUtils.formatDiffSummary(resyncModal && resyncModal.diff);
        resyncModal = null;
        setMaintenanceAllocationYears(maintenanceAllocationYears.map(function (y) {
          return Number(y.year) === Number(selectedYear) ? next : y;
        }));
        var orphans = MaintenanceAllocationUtils.countOrphans(maintenanceAllocations, next);
        // 孤兒數是全組別的總數，不是目前這一組的；不講清楚會讓使用者在畫面上數不到那麼多格
        showToast('已重新同步 ' + selectedYear + ' 年度；' + summary
          + (orphans ? '，全部組別共 ' + orphans + ' 格已不在區間內，請確認' : ''));
      }

      function openResyncModal() {
        if (!snapshot || !isCurrentYear) return;
        if (!hasDiff) {
          showToast('本年度骨架與現行主檔一致，無需同步');
          return;
        }
        var preview = MaintenanceAllocationUtils.resyncYear(
          snapshot, assignees, customers, stores, serviceLevels, todayString()
        );
        resyncModal = {
          diff: snapshotDiff,
          summary: MaintenanceAllocationUtils.formatDiffSummary(snapshotDiff),
          orphanCount: MaintenanceAllocationUtils.countOrphans(maintenanceAllocations, preview)
        };
        rerender();
      }

      function renderResyncDialog() {
        if (!resyncModal) return null;
        return h(
          'div',
          { className: 'app-modal-overlay' },
          h(
            'div',
            { className: 'bg-white rounded-lg shadow-xl p-6 w-[28rem] max-w-full m-4' },
            h(
              'div',
              { className: 'flex items-center space-x-3 text-amber-600 mb-4' },
              Icons.AlertCircle({ className: 'h-6 w-6' }),
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '重新同步保養區間')
            ),
            h('p', { className: 'text-gray-600 mb-2' },
              '將以現行的客戶、門市與服務等級重拍 ' + selectedYear + ' 年度的骨架：'),
            h('p', { className: 'text-gray-800 font-medium mb-4' }, resyncModal.summary),
            h('p', { className: 'text-sm text-gray-500 mb-6' },
              resyncModal.orphanCount
                ? ('已填的目標完成數一律保留；同步後全部組別共有 ' + resyncModal.orphanCount
                    + ' 格落在保養區間外，會標記為異常，需自行確認是否刪除。')
                : '已填的目標完成數一律保留。'),
            h(
              'div',
              { className: 'flex justify-end space-x-3' },
              h(
                'button',
                {
                  type: 'button',
                  onClick: function () { resyncModal = null; rerender(); },
                  className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
                },
                '取消'
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: function () { handleResync(); rerender(); },
                  className: 'px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors'
                },
                '確認同步'
              )
            )
          )
        );
      }

      function renderCreateDialog() {
        if (!createModal) return null;
        return h(
          'div',
          { className: 'app-modal-overlay' },
          h(
            'div',
            { className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4' },
            h('h3', { className: 'text-lg font-bold text-gray-800 mb-1' }, '建立年度分配表'),
            h(
              'p',
              { className: 'text-sm text-gray-500 mb-6' },
              '將以目前的客戶、門市與服務等級設定，凍結成該年度的分配表骨架。'
            ),
            h(
              'div',
              null,
              h('label', { className: 'block text-sm text-gray-600 mb-1' }, '年份'),
              h('input', {
                type: 'number',
                value: createModal.year,
                onChange: function (e) {
                  createModal.year = e.target.value;
                  rerender();
                },
                className: 'w-full p-2.5 border rounded-md outline-none'
              })
            ),
            h(
              'div',
              { className: 'flex justify-end gap-3 mt-8 pt-6 border-t' },
              h(
                'button',
                {
                  type: 'button',
                  onClick: function () { createModal = null; rerender(); },
                  className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
                },
                '取消'
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: function () { handleCreateYear(); rerender(); },
                  className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
                },
                '建立'
              )
            )
          )
        );
      }

      function openCreateModal() {
        var suggested = availableYears.indexOf(thisYear) === -1
          ? thisYear
          : (availableYears[0] + 1);
        createModal = { year: suggested };
        rerender();
      }

      return h(
        'div',
        { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
        h(
          'div',
          { className: 'flex flex-col lg:flex-row lg:items-end lg:justify-between mb-6 gap-4' },
          h(
            'div',
            { className: 'flex flex-wrap items-end gap-3' },
            h(
              'div',
              { className: 'w-36' },
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '年度'),
              availableYears.length
                ? h(
                    'select',
                    {
                      value: String(selectedYear),
                      onChange: function (e) {
                        selectedYear = Number(e.target.value);
                        persistedSelectedYear = selectedYear;
                        persistedScrollLeft = 0;
                        editModal = null;
                        deleteModal = null;
                        rerender();
                      },
                      className: TOOLBAR_CONTROL + ' w-full border-gray-300 outline-none bg-white'
                    },
                    availableYears.map(function (y) {
                      return h('option', { key: y, value: String(y) }, y + ' 年');
                    })
                  )
                : h(
                    'div',
                    { className: TOOLBAR_CONTROL + ' w-full border-dashed border-gray-200 text-gray-400 flex items-center' },
                    '尚未建立'
                  )
            ),
            h(
              'div',
              { className: 'w-56' },
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '組別'),
              h(
                'select',
                {
                  value: selectedAssigneeId,
                  onChange: function (e) {
                    var nextId = e.target.value;
                    if (nextId !== selectedAssigneeId) persistedScrollLeft = 0;
                    selectedAssigneeId = nextId;
                    persistedSelectedAssigneeId = nextId;
                    editModal = null;
                    deleteModal = null;
                    rerender();
                  },
                  className: TOOLBAR_CONTROL + ' w-full border-gray-300 outline-none bg-white'
                },
                h('option', { value: '' }, '請選擇組別'),
                sortedAssignees.map(function (item) {
                  return CaseAssigneeFields.renderGroupOption(item.name, item.id);
                })
              )
            ),
            assignee && snapshot
              ? h(
                  'div',
                  { className: TOOLBAR_CONTROL + ' border-transparent bg-gray-50 text-sm text-gray-500 flex items-center whitespace-nowrap' },
                  '共 ',
                  h('span', { className: 'font-semibold text-gray-700 mx-1' }, String(rows.length)),
                  ' 位客戶'
                )
              : null
          ),
          // 兩顆動作鈕維持同一種外框樣式與高度，才不會一顆圓形 icon、一顆方形文字鈕各走各的
          h(
            'div',
            { className: 'flex flex-wrap items-center gap-2' },
            h(
              'button',
              {
                type: 'button',
                title: '建立年度分配表',
                onClick: openCreateModal,
                className: TOOLBAR_BUTTON + ' border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400'
              },
              Icons.Plus({ className: 'h-4 w-4' }),
              '建立年度'
            ),
            (snapshot && isCurrentYear)
              ? h(
                  'button',
                  {
                    type: 'button',
                    onClick: openResyncModal,
                    className: TOOLBAR_BUTTON + (hasDiff
                      ? ' border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : ' border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400')
                  },
                  Icons.RefreshCw({ className: 'h-4 w-4' }),
                  '重新同步保養區間'
                )
              : null
          )
        ),
        renderDiffBanner(),
        renderFrozenNote(),
        !snapshot
          ? renderEmptyYearPrompt()
          : (selectedAssigneeId ? renderGrid() : renderSelectionPrompt()),
        renderEditDialog(),
        renderDeleteDialog(),
        renderCreateDialog(),
        renderResyncDialog()
      );
    });
  }

  window.MaintenanceAllocation = MaintenanceAllocation;
})();
