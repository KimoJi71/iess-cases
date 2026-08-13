/*
 * features/permissions/maintenance-allocation.js — 保養分配：客戶月份網格、編輯 Modal、刪除確認
 * props: { assignees, customers, stores, maintenanceCases, serviceLevels, maintenanceAllocations, setMaintenanceAllocations, maintenanceAllocationYears, setMaintenanceAllocationYears, showToast }
 */
(function () {
  'use strict';

  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  var SEGMENT_BG = ['bg-sky-50/70', 'bg-amber-50/70'];
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
          storeCount: editModal.storeCount
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
          '請先選擇指派人員'
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

      function renderMonthCell(row, month, segment) {
        var cell = MaintenanceAllocationUtils.findAllocation(
          maintenanceAllocations,
          selectedYear,
          selectedAssigneeId,
          row.customerName,
          month
        );
        var label = MaintenanceAllocationUtils.formatCellLabel(cell);

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
                openEditModal(row, month);
                rerender();
              },
              className: 'min-h-[68px] rounded-md border ' +
                (label
                  ? 'border-blue-200 bg-blue-50/70 hover:bg-blue-100/70'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/40') +
                ' px-2 py-2 cursor-pointer transition-colors'
            },
            h(
              'div',
              { className: 'flex items-start justify-between gap-2' },
              h(
                'div',
                { className: 'flex-1 min-w-0 text-xs leading-5 text-gray-700 break-words' },
                label || h('span', { className: 'text-gray-300' }, '')
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
              rows.length === 0
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
                  })
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
                  className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
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
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
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
          { className: 'flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4' },
          h(
            'div',
            { className: 'flex flex-wrap items-end gap-4' },
            h(
              'div',
              { className: 'w-40' },
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '年度'),
              h(
                'div',
                { className: 'flex items-center gap-2' },
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
                        className: 'flex-1 p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
                      },
                      availableYears.map(function (y) {
                        return h('option', { key: y, value: String(y) }, y + ' 年');
                      })
                    )
                  : null,
                h(
                  'button',
                  {
                    type: 'button',
                    title: '建立年度分配表',
                    onClick: openCreateModal,
                    className: 'shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors'
                  },
                  Icons.Plus({ className: 'h-5 w-5' })
                )
              )
            ),
            h(
              'div',
              { className: 'w-full max-w-xs' },
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '指派人員'),
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
                  className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
                },
                h('option', { value: '' }, '請選擇指派人員'),
                sortedAssignees.map(function (item) {
                  return h('option', { key: item.id, value: item.id }, item.name);
                })
              )
            )
          ),
          assignee && snapshot
            ? h(
                'div',
                { className: 'text-sm text-gray-500' },
                '共 ',
                h('span', { className: 'font-semibold text-gray-700' }, String(rows.length)),
                ' 位客戶'
              )
            : null
        ),
        !snapshot
          ? renderEmptyYearPrompt()
          : (selectedAssigneeId ? renderGrid() : renderSelectionPrompt()),
        renderEditDialog(),
        renderDeleteDialog(),
        renderCreateDialog()
      );
    });
  }

  window.MaintenanceAllocation = MaintenanceAllocation;
})();
