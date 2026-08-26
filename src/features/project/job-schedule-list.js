/*
 * features/project/job-schedule-list.js — 工程服務：工作安排列表
 * props: { jobSchedules, setJobSchedules, setEditingCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var iconActionBtn = IESS.iconActionBtn;

  function displayCell(value) {
    return (value == null || value === '') ? '—' : String(value);
  }

  function JobScheduleList(props) {
    var jobSchedules = props.jobSchedules;
    var setJobSchedules = props.setJobSchedules;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    var keyword = '';
    var appliedKeyword = '';
    var deleteModal = { show: false, id: null, name: '' };
    var listPagination = IESS.createListPagination();

    return stateful(function (rerender) {
      var filtered = (function () {
        var list = jobSchedules || [];
        if (appliedKeyword.trim()) {
          list = list.filter(function (row) {
            return JobScheduleUtils.matchesKeyword(row, appliedKeyword);
          });
        }
        return JobScheduleUtils.sortRecords(list);
      })();
      var pageResult = listPagination.slice(filtered);

      function handleSearch() { appliedKeyword = keyword; listPagination.resetPage(); rerender(); }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }

      function handleDelete(id) {
        var target = (jobSchedules || []).find(function (row) { return row.id === id; });
        if (!target) {
          deleteModal = { show: false, id: null, name: '' };
          rerender();
          return;
        }
        setJobSchedules(jobSchedules.filter(function (row) { return row.id !== id; }));
        deleteModal = { show: false, id: null, name: '' };
        showToast('工作安排已刪除');
      }

      return h('div', {
        className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100'
      },
        h('div', {
          className: 'flex flex-col md:flex-row justify-between items-start mb-6 gap-4'
        },
          h('div', { className: 'bg-gray-50 p-4 rounded-lg border border-gray-200 flex-1' },
          h('div', { className: 'flex flex-wrap items-end gap-3' },
            h('div', { className: 'min-w-0' },
              h('label', { className: 'block text-xs text-gray-500 mb-1' }, '關鍵字'),
              h('input', {
                type: 'text',
                value: keyword,
                onChange: function (e) { keyword = e.target.value; rerender(); },
                onKeyDown: handleKeyDown,
                placeholder: '請輸入關鍵字',
                className: 'w-64 max-w-full p-2.5 border rounded-md outline-none bg-white'
              })
            ),
            h('button', {
              onClick: handleSearch,
              className: 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md shadow-sm transition-colors min-h-[42px]'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
          )),
          iconActionBtn({
            label: '新增工作安排',
            className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors shrink-0',
            onClick: function () { setEditingCase(null); setView('job-schedule-add'); },
            icon: Icons.Plus({ className: 'h-5 w-5' })
          })
        ),
        h('div', { className: 'overflow-x-auto border rounded-lg' },
          h('table', {
            className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap'
          },
            h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
              h('tr', null,
                h('th', { className: 'p-3 font-semibold text-center w-24' }, '操作'),
                h('th', { className: 'p-3 font-semibold' }, '工作名稱'),
                h('th', { className: 'p-3 font-semibold' }, '預計日期'),
                h('th', { className: 'p-3 font-semibold' }, '預計時間'),
                h('th', { className: 'p-3 font-semibold' }, '指派人員')
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-100' },
              filtered.length === 0
                ? h('tr', null,
                    h('td', { colspan: 5, className: 'p-10 text-center text-gray-400 text-base' }, '無資料'))
                : pageResult.items.map(function (row) {
                    return h('tr', { key: row.id, className: 'hover:bg-blue-50/50 transition-colors' },
                      h('td', { className: 'p-3' },
                        h('div', { className: 'flex items-center justify-center space-x-2' },
                          h('button', {
                            onClick: function () { setEditingCase(row); setView('job-schedule-edit'); },
                            className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                            title: '編輯'
                          }, Icons.Edit({ className: 'h-4 w-4' })),
                          iconActionBtn({
                            label: '刪除',
                            onClick: function () {
                              deleteModal = { show: true, id: row.id, name: row.name };
                              rerender();
                            },
                            className: 'p-1.5 text-red-600 hover:bg-red-100 rounded',
                            icon: Icons.Trash2({ className: 'h-4 w-4' })
                          })
                        )
                      ),
                      h('td', { className: 'p-3' }, displayCell(row.name)),
                      h('td', { className: 'p-3' }, displayCell(row.estimatedDate)),
                      h('td', { className: 'p-3' }, displayCell(row.estimatedTime)),
                      h('td', { className: 'p-3' }, displayCell(row.assigneeName))
                    );
                  })
            )
          )
        ),
        listPagination.renderBar(pageResult, rerender),
        deleteModal.show && h('div', { className: 'app-modal-overlay' },
          h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4' },
            h('div', { className: 'flex items-center space-x-3 text-red-600 mb-4' },
              Icons.AlertCircle({ className: 'h-6 w-6' }),
              h('h3', { className: 'text-lg font-bold text-gray-800' }, '確認刪除')
            ),
            h('p', { className: 'text-gray-600 mb-6' },
              '確定要刪除工作安排「' + deleteModal.name + '」嗎？'),
            h('div', { className: 'flex justify-end space-x-3' },
              h('button', {
                onClick: function () { deleteModal = { show: false, id: null, name: '' }; rerender(); },
                className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
              }, '取消'),
              h('button', {
                onClick: function () { handleDelete(deleteModal.id); },
                className: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors'
              }, '確認刪除')
            )
          )
        )
      );
    });
  }

  window.JobScheduleList = JobScheduleList;
})();
