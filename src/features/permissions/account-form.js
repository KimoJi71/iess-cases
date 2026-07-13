/*
 * features/permissions/account-form.js — 帳號管理：新增/編輯帳號表單
 * props: { accounts, setAccounts, setView, showToast, targetCase }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  function AccountForm(props) {
    var accounts = props.accounts;
    var setAccounts = props.setAccounts;
    var targetCase = props.targetCase;
    var setView = props.setView;
    var showToast = props.showToast;
    var isEdit = !!targetCase;

    var formData = {
      name: (targetCase && targetCase.name) || '',
      username: (targetCase && targetCase.username) || '',
      password: '',
      email: (targetCase && targetCase.email) || '',
      assignee: (targetCase && targetCase.assignee) || '',
      enabled: targetCase ? !!targetCase.enabled : true
    };
    var districts = (targetCase && targetCase.districts)
      ? targetCase.districts.slice()
      : [];

    return stateful(function (rerender) {
      function handleChange(e) {
        var name = e.target.name;
        var value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        formData[name] = value;
        rerender();
      }

      function toggleDistrict(district) {
        var idx = districts.indexOf(district);
        if (idx === -1) districts.push(district);
        else districts.splice(idx, 1);
        rerender();
      }

      function handleSubmit(e) {
        e.preventDefault();
        if (!formData.name.trim()) {
          showToast('姓名為必填', 'error');
          return;
        }
        if (!formData.username.trim()) {
          showToast('帳號為必填', 'error');
          return;
        }
        if (!isEdit && !formData.password) {
          showToast('密碼為必填', 'error');
          return;
        }
        if (!districts.length) {
          showToast('請至少選擇一個負責行政區域', 'error');
          return;
        }

        var duplicate = accounts.some(function (a) {
          return a.username === formData.username && (!isEdit || a.id !== targetCase.id);
        });
        if (duplicate) {
          showToast('帳號已存在（帳號區分大小寫）', 'error');
          return;
        }

        if (isEdit) {
          setAccounts(accounts.map(function (a) {
            if (a.id !== targetCase.id) return a;
            var updated = Object.assign({}, a, {
              name: formData.name.trim(),
              username: formData.username.trim(),
              email: formData.email.trim(),
              districts: districts.slice(),
              assignee: formData.assignee,
              enabled: formData.enabled
            });
            if (formData.password) {
              updated.passwordHash = AccountUtils.hashPassword(formData.password);
            }
            return updated;
          }));
          showToast('帳號資料更新成功');
        } else {
          var newAccount = {
            id: 'ACC' + Date.now(),
            name: formData.name.trim(),
            username: formData.username.trim(),
            passwordHash: AccountUtils.hashPassword(formData.password),
            email: formData.email.trim(),
            districts: districts.slice(),
            assignee: '',
            enabled: formData.enabled,
            permissions: AccountUtils.createEmptyPermissions(),
            createdDate: todayDate
          };
          setAccounts([newAccount].concat(accounts));
          showToast('帳號新增成功');
        }
        setView('account-list');
      }

      return h('div', {
        className: 'max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative'
      },
        PageHeader({
          title: isEdit ? '編輯帳號' : '新增帳號',
          badge: isEdit ? targetCase.username : null,
          onClose: function () { setView('account-list'); },
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', { className: 'space-y-6' },
            h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '姓名 ', h('span', { className: 'text-red-500' }, '*')),
                h('input', {
                  type: 'text',
                  name: 'name',
                  value: formData.name,
                  onChange: handleChange,
                  className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
                })
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '帳號 ', h('span', { className: 'text-red-500' }, '*')),
                h('input', {
                  type: 'text',
                  name: 'username',
                  value: formData.username,
                  onChange: handleChange,
                  disabled: isEdit && targetCase.username === 'admin',
                  className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500 disabled:bg-gray-100'
                }),
                h('p', { className: 'text-xs text-gray-400 mt-1' }, '帳號區分大小寫')
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' },
                  '密碼 ', isEdit ? null : h('span', { className: 'text-red-500' }, '*')),
                h('input', {
                  type: 'password',
                  name: 'password',
                  value: formData.password,
                  onChange: handleChange,
                  placeholder: isEdit ? '留空則不變更密碼' : '請輸入密碼',
                  className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
                }),
                h('p', { className: 'text-xs text-gray-400 mt-1' }, '密碼區分大小寫，儲存時將加密')
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, 'Email'),
                h('input', {
                  type: 'email',
                  name: 'email',
                  value: formData.email,
                  onChange: handleChange,
                  className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
                })
              ),
              isEdit && h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '歸屬指派人員'),
                h('select', {
                  name: 'assignee',
                  value: formData.assignee,
                  onChange: handleChange,
                  className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
                },
                  h('option', { value: '' }, '請選擇'),
                  ACCOUNT_ASSIGNEE_OPTIONS.map(function (opt) {
                    return h('option', { key: opt, value: opt }, opt);
                  })
                )
              ),
              h('div', { className: isEdit ? '' : 'md:col-span-2' },
                h('label', { className: 'block text-sm mb-2' }, '負責行政區域 ', h('span', { className: 'text-red-500' }, '*')),
                h('div', { className: 'flex flex-wrap gap-3' },
                  DISTRICT_OPTIONS.map(function (d) {
                    var checked = districts.indexOf(d) !== -1;
                    return h('label', {
                      key: d,
                      className: 'inline-flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer ' +
                        (checked ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200')
                    },
                      h('input', {
                        type: 'checkbox',
                        checked: checked,
                        onChange: function () { toggleDistrict(d); }
                      }),
                      d
                    );
                  })
                )
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '啟用狀態'),
                h('select', {
                  name: 'enabled',
                  value: formData.enabled ? 'true' : 'false',
                  onChange: function (e) {
                    formData.enabled = e.target.value === 'true';
                    rerender();
                  },
                  disabled: isEdit && targetCase.username === 'admin',
                  className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white disabled:bg-gray-100'
                },
                  h('option', { value: 'true' }, '啟用'),
                  h('option', { value: 'false' }, '停用')
                )
              )
            )
          ),
          h('div', { className: 'flex justify-end gap-3 mt-8 pt-6 border-t' },
            h('button', {
              type: 'button',
              onClick: function () { setView('account-list'); },
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

  window.AccountForm = AccountForm;
})();
