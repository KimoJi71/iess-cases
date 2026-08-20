/*
 * features/project/job-schedule-form.js — 工程服務：新增／編輯工作安排
 * props: { jobSchedules, setJobSchedules, targetCase, setView, showToast, currentOperatorName }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, TimeInput24 = IESS.TimeInput24;

  function JobScheduleForm(props) {
    var jobSchedules = props.jobSchedules;
    var setJobSchedules = props.setJobSchedules;
    var targetCase = props.targetCase;
    var setView = props.setView;
    var showToast = props.showToast;
    var currentOperatorName = props.currentOperatorName || '';
    var isEdit = !!targetCase;

    var formData = {
      name: (targetCase && targetCase.name) || '',
      description: (targetCase && targetCase.description) || '',
      remarks: (targetCase && targetCase.remarks) || '',
      estimatedDate: (targetCase && targetCase.estimatedDate) || '',
      estimatedTime: (targetCase && targetCase.estimatedTime) || ''
    };
    var assigneeName = isEdit
      ? ((targetCase && targetCase.assigneeName) || '')
      : currentOperatorName;

    return stateful(function (rerender) {
      function handleChange(e) {
        formData[e.target.name] = e.target.value;
        rerender();
      }

      function goList() { setView('job-schedule-list'); }

      function handleSubmit(e) {
        e.preventDefault();
        var name = String(formData.name || '').trim();
        if (!name) {
          showToast('工作名稱為必填', 'error');
          return;
        }
        var payload = {
          name: name,
          description: String(formData.description || '').trim(),
          remarks: String(formData.remarks || '').trim(),
          estimatedDate: formData.estimatedDate || '',
          estimatedTime: formData.estimatedTime || ''
        };
        if (isEdit) {
          setJobSchedules(jobSchedules.map(function (row) {
            if (row.id !== targetCase.id) return row;
            return Object.assign({}, row, payload);
          }));
          showToast('工作安排更新成功');
        } else {
          var newRecord = Object.assign({
            id: 'JS' + Date.now(),
            assigneeName: currentOperatorName,
            createdDate: todayDate
          }, payload);
          setJobSchedules([newRecord].concat(jobSchedules));
          showToast('工作安排新增成功');
        }
        goList();
      }

      return h('div', {
        className: 'max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative'
      },
        PageHeader({
          title: isEdit ? '編輯工作安排' : '新增工作安排',
          badge: isEdit ? targetCase.name : null,
          onClose: goList,
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', { className: 'space-y-6' },
            h('div', null,
              h('label', { className: 'block text-sm mb-1' },
                '工作名稱 ', h('span', { className: 'text-red-500' }, '*')),
              h('input', {
                type: 'text',
                name: 'name',
                value: formData.name,
                onChange: handleChange,
                className: IESS.inputCls
              })
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '工作描述'),
              h('textarea', {
                name: 'description',
                value: formData.description,
                onChange: handleChange,
                rows: 3,
                className: IESS.inputCls + ' resize-none'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '備註'),
              h('textarea', {
                name: 'remarks',
                value: formData.remarks,
                onChange: handleChange,
                rows: 3,
                className: IESS.inputCls + ' resize-none'
              })
            ),
            h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '預計日期'),
                h('input', {
                  type: 'date',
                  name: 'estimatedDate',
                  value: formData.estimatedDate,
                  onChange: handleChange,
                  className: IESS.inputClsDate
                })
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '預計時間'),
                h(TimeInput24, {
                  name: 'estimatedTime',
                  value: formData.estimatedTime,
                  onChange: handleChange
                })
              )
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '指派人員'),
              h('input', {
                type: 'text',
                value: assigneeName,
                readOnly: true,
                className: IESS.inputCls + ' bg-gray-50 text-gray-600 cursor-not-allowed'
              })
            )
          ),
          h('div', { className: 'flex justify-end gap-3 mt-8 pt-6 border-t' },
            h('button', {
              type: 'button',
              onClick: goList,
              className: 'px-5 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
            }, '取消'),
            h('button', {
              type: 'submit',
              className: 'flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
            }, Icons.Save({ className: 'h-4 w-4' }), ' 儲存')
          )
        )
      );
    });
  }

  window.JobScheduleForm = JobScheduleForm;
})();
