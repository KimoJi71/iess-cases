/*
 * features/customer/customer-form.js — 客戶建檔：新增/編輯客戶表單
 * props: { cases, setCases, setView, showToast, targetCase }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var iconActionBtn = IESS.iconActionBtn;

  function CustomerForm(props) {
    var cases = props.cases;
    var setCases = props.setCases;
    var targetCase = props.targetCase;
    var setView = props.setView;
    var showToast = props.showToast;

    var isEdit = !!targetCase;

    var formData = {
      name: (targetCase && targetCase.name) || '',
      taxId: (targetCase && targetCase.taxId) || '',
      principal: (targetCase && targetCase.principal) || '',
      serviceLevel: (targetCase && targetCase.serviceLevel) || '保修(一年一次)',
      maintenanceInterval: (targetCase && targetCase.maintenanceInterval) || '每半年',
      phone: (targetCase && targetCase.phone) || '',
      fax: (targetCase && targetCase.fax) || '',
      address: (targetCase && targetCase.address) || '',
      remarks: (targetCase && targetCase.remarks) || '',
      enabled: targetCase ? targetCase.enabled !== false : true
    };
    var contacts = (targetCase && targetCase.contacts)
      ? targetCase.contacts.map(function (ct) { return Object.assign({}, ct); })
      : [];
    var contactModal = { show: false };
    var currentContact = { id: null, title: '', name: '', phone: '', email: '' };

    return stateful(function (rerender) {
      function handleChange(e) {
        var name = e.target.name;
        var value = e.target.value;
        formData[name] = value;
        rerender();
      }
      function handleContactChange(e) {
        var name = e.target.name;
        var value = e.target.value;
        currentContact[name] = value;
        rerender();
      }
      function openAddContact() {
        currentContact = { id: null, title: '', name: '', phone: '', email: '' };
        contactModal = { show: true };
        rerender();
      }
      function openEditContact(ct) {
        currentContact = Object.assign({}, ct);
        contactModal = { show: true };
        rerender();
      }
      function handleSaveContact() {
        if (!currentContact.name.trim()) {
          showToast('承辦姓名為必填', 'error');
          return;
        }
        if (currentContact.id) {
          contacts = contacts.map(function (ct) {
            return ct.id === currentContact.id ? Object.assign({}, currentContact) : ct;
          });
        } else {
          contacts = contacts.concat([Object.assign({}, currentContact, { id: Date.now() })]);
        }
        contactModal = { show: false };
        showToast('承辦資料暫存成功');
        rerender();
      }
      function handleDeleteContact(id) {
        contacts = contacts.filter(function (ct) { return ct.id !== id; });
        rerender();
      }
      function handleSubmit(e) {
        e.preventDefault();
        if (!formData.name.trim()) {
          showToast('客戶名稱為必填', 'error');
          return;
        }
        if (isEdit) {
          setCases(cases.map(function (c) {
            return c.id === targetCase.id ? Object.assign({}, c, formData, { contacts: contacts }) : c;
          }));
          showToast('客戶資料更新成功');
        } else {
          var newCustomer = Object.assign({ id: 'CUST' + Date.now() }, formData, {
            contacts: contacts,
            createdDate: todayDate
          });
          setCases([newCustomer].concat(cases));
          showToast('客戶新增成功');
        }
        setView('customer-list');
      }

      return h('div', {
        className: 'max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative'
      },
        PageHeader({
          title: isEdit ? '編輯客戶' : '新增客戶',
          onClose: function () { setView('customer-list'); },
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', { className: 'space-y-6' },
          h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-6' },
            h('div', { className: 'col-span-full font-semibold text-lg text-blue-800 border-b pb-2 mb-2' }, '基本資料'),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '客戶名稱 ', h('span', { className: 'text-red-500' }, '*')),
              h('input', {
                type: 'text',
                name: 'name',
                value: formData.name,
                onChange: handleChange,
                required: true,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '統一編號'),
              h('input', {
                type: 'text',
                name: 'taxId',
                value: formData.taxId,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '負責人'),
              h('input', {
                type: 'text',
                name: 'principal',
                value: formData.principal,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '服務等級'),
              h('select', {
                name: 'serviceLevel',
                value: formData.serviceLevel,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none'
              }, SERVICE_LEVEL_OPTIONS.map(function (opt) {
                return h('option', { key: opt, value: opt }, opt);
              }))
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '保養區間'),
              h('select', {
                name: 'maintenanceInterval',
                value: formData.maintenanceInterval,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none'
              }, MAINTENANCE_INTERVAL_OPTIONS.map(function (opt) {
                return h('option', { key: opt, value: opt }, opt);
              }))
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
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
              },
                h('option', { value: 'true' }, '啟用'),
                h('option', { value: 'false' }, '停用')
              )
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '公司電話'),
              h('input', {
                type: 'text',
                name: 'phone',
                value: formData.phone,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '公司傳真'),
              h('input', {
                type: 'text',
                name: 'fax',
                value: formData.fax,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('div', { className: 'col-span-full md:col-span-2' },
              h('label', { className: 'block text-sm mb-1' }, '公司地址'),
              h('input', {
                type: 'text',
                name: 'address',
                value: formData.address,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            ),
            h('div', { className: 'col-span-full' },
              h('label', { className: 'block text-sm mb-1' }, '備註說明'),
              h('textarea', {
                name: 'remarks',
                value: formData.remarks,
                onChange: handleChange,
                rows: 3,
                className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
              })
            )
          ),
          h('div', null,
            h('div', { className: 'flex items-center justify-between border-b pb-2 mb-4' },
              h('h3', { className: 'font-semibold text-lg text-blue-800' },
                '承辦資料 ', h('span', { className: 'text-sm font-normal text-gray-400' }, '(可多筆)')
              ),
              h('button', {
                type: 'button',
                onClick: openAddContact,
                className: 'flex items-center gap-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors'
              }, Icons.Plus({ className: 'h-4 w-4' }), ' 加入承辦資料')
            ),
            contacts.length === 0
              ? h('div', { className: 'text-center text-gray-400 py-6 border border-dashed rounded-md' }, '尚未加入承辦資料')
              : h('div', { className: 'overflow-x-auto border rounded-lg' },
                  h('table', { className: 'w-full text-left text-sm text-gray-600' },
                    h('thead', { className: 'bg-gray-50 text-gray-700 border-b' },
                      h('tr', null,
                        h('th', { className: 'p-3 font-semibold' }, '承辦職稱'),
                        h('th', { className: 'p-3 font-semibold' }, '承辦姓名'),
                        h('th', { className: 'p-3 font-semibold' }, '承辦電話'),
                        h('th', { className: 'p-3 font-semibold' }, '承辦Mail'),
                        h('th', { className: 'p-3 font-semibold text-center w-24' }, '操作')
                      )
                    ),
                    h('tbody', { className: 'divide-y divide-gray-100' },
                      contacts.map(function (ct) {
                        return h('tr', { key: ct.id, className: 'hover:bg-blue-50/50' },
                          h('td', { className: 'p-3' }, ct.title || '—'),
                          h('td', { className: 'p-3 font-medium text-gray-800' }, ct.name),
                          h('td', { className: 'p-3' }, ct.phone || '—'),
                          h('td', { className: 'p-3' }, ct.email || '—'),
                          h('td', { className: 'p-3' },
                            h('div', { className: 'flex items-center justify-center space-x-2' },
                              h('button', {
                                type: 'button',
                                onClick: function () { openEditContact(ct); },
                                className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                                title: '編輯承辦資料'
                              }, Icons.Edit({ className: 'h-4 w-4' })),
                              iconActionBtn({ label: '刪除承辦資料', type: 'button',
                                onClick: function () { handleDeleteContact(ct.id); },
                                className: 'p-1.5 text-red-600 hover:bg-red-100 rounded', icon: Icons.Trash2({ className: 'h-4 w-4' }) })
                            )
                          )
                        );
                      })
                    )
                  )
                )
          )),
          h('div', { className: 'mt-8 pt-6 border-t flex justify-end gap-3' },
            h('button', {
              type: 'button',
              onClick: function () { setView('customer-list'); },
              className: 'px-6 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
            }, '取消'),
            h('button', {
              type: 'submit',
              className: 'flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-colors'
            }, Icons.Save({ className: 'h-5 w-5' }), ' 儲存')
          )
        ),
        contactModal.show && h('div', {
          className: 'app-modal-overlay p-4'
        },
          h('div', { className: 'bg-white rounded-lg shadow-xl p-6 w-full max-w-md' },
            h('div', { className: 'flex justify-between items-center mb-4 pb-3 border-b' },
              h('h3', { className: 'text-lg font-bold text-gray-800' },
                currentContact.id ? '編輯承辦資料' : '新增承辦資料'),
              h('button', {
                onClick: function () { contactModal = { show: false }; rerender(); },
                title: '關閉',
                className: 'p-1.5 hover:bg-gray-100 rounded-full'
              }, Icons.X({ className: 'h-5 w-5' }))
            ),
            h('div', { className: 'space-y-4' },
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '承辦職稱'),
                h('input', {
                  type: 'text',
                  name: 'title',
                  value: currentContact.title,
                  onChange: handleContactChange,
                  className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
                })
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '承辦姓名 ', h('span', { className: 'text-red-500' }, '*')),
                h('input', {
                  type: 'text',
                  name: 'name',
                  value: currentContact.name,
                  onChange: handleContactChange,
                  className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
                })
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '承辦電話'),
                h('input', {
                  type: 'text',
                  name: 'phone',
                  value: currentContact.phone,
                  onChange: handleContactChange,
                  className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
                })
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '承辦Mail'),
                h('input', {
                  type: 'email',
                  name: 'email',
                  value: currentContact.email,
                  onChange: handleContactChange,
                  className: 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500'
                })
              )
            ),
            h('div', { className: 'flex justify-end gap-3 mt-6' },
              h('button', {
                onClick: function () { contactModal = { show: false }; rerender(); },
                className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
              }, '取消'),
              h('button', {
                onClick: handleSaveContact,
                className: 'flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
              }, Icons.Save({ className: 'h-4 w-4' }), ' 儲存')
            )
          )
        )
      );
    });
  }

  window.CustomerForm = CustomerForm;
})();
