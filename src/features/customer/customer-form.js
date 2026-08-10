/*
 * features/customer/customer-form.js — 客戶建檔：新增/編輯客戶表單
 * props: { cases, setCases, serviceLevels, setView, showToast, targetCase }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var iconActionBtn = IESS.iconActionBtn;

  var MONTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // 依服務等級的「每年保養次數」增減區間列：增加補空白列，減少砍尾端，已填的前段保留
  function resizePeriods(periods, count) {
    var next = periods.slice(0, count);
    for (var i = next.length; i < count; i++) {
      next.push({ visitIndex: i + 1, startMonth: '', endMonth: '' });
    }
    return next.map(function (p, i) {
      return { visitIndex: i + 1, startMonth: p.startMonth, endMonth: p.endMonth };
    });
  }

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
      serviceLevel: (targetCase && targetCase.serviceLevel) || SERVICE_LEVEL_OPTIONS[0] || '',
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

    var serviceLevels = props.serviceLevels || [];

    function expectedPeriodCount(levelName) {
      return ServiceLevelUtils.getMaintenanceCount(serviceLevels, levelName);
    }

    var periods = resizePeriods(
      ((targetCase && targetCase.periods) || []).map(function (p) {
        return { visitIndex: p.visitIndex, startMonth: p.startMonth, endMonth: p.endMonth };
      }),
      expectedPeriodCount(formData.serviceLevel)
    );

    return stateful(function (rerender) {
      function handleChange(e) {
        var name = e.target.name;
        var value = e.target.value;
        formData[name] = value;
        rerender();
      }
      function handleServiceLevelChange(e) {
        formData.serviceLevel = e.target.value;
        periods = resizePeriods(periods, expectedPeriodCount(formData.serviceLevel));
        rerender();
      }
      function handleMonthChange(index, key, value) {
        periods[index][key] = value === '' ? '' : Number(value);
        rerender();
      }
      function renderPeriodRows() {
        if (!periods.length) {
          return h('p', { className: 'text-sm text-gray-500 bg-gray-50 border rounded-md p-4' },
            '此服務等級不納入保養分配');
        }
        return h('div', { className: 'space-y-3' },
          periods.map(function (p, index) {
            var n = index + 1;
            return h('div', { key: n, className: 'flex flex-wrap items-center gap-3' },
              h('span', { className: 'w-16 text-sm text-gray-700' }, '第 ' + n + ' 次'),
              h('select', {
                name: 'startMonth-' + n,
                value: p.startMonth === '' ? '' : String(p.startMonth),
                onChange: function (e) { handleMonthChange(index, 'startMonth', e.target.value); },
                className: 'w-28 p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
              },
                h('option', { value: '' }, '起始月'),
                MONTH_OPTIONS.map(function (m) {
                  return h('option', { key: m, value: String(m) }, m + '月');
                })
              ),
              h('span', { className: 'text-gray-400' }, '～'),
              h('select', {
                name: 'endMonth-' + n,
                value: p.endMonth === '' ? '' : String(p.endMonth),
                onChange: function (e) { handleMonthChange(index, 'endMonth', e.target.value); },
                className: 'w-28 p-2.5 border rounded-md outline-none focus:border-blue-500 bg-white'
              },
                h('option', { value: '' }, '結束月'),
                MONTH_OPTIONS.map(function (m) {
                  return h('option', { key: m, value: String(m) }, m + '月');
                })
              )
            );
          })
        );
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
        var periodErrors = CustomerUtils.validatePeriods(
          periods, expectedPeriodCount(formData.serviceLevel));
        if (isEdit) {
          setCases(cases.map(function (c) {
            return c.id === targetCase.id
              ? Object.assign({}, c, formData, { contacts: contacts, periods: periods })
              : c;
          }));
          showToast('客戶資料更新成功');
        } else {
          var newCustomer = Object.assign({ id: 'CUST' + Date.now() }, formData, {
            contacts: contacts,
            periods: periods,
            createdDate: todayDate
          });
          setCases([newCustomer].concat(cases));
          showToast('客戶新增成功');
        }
        if (periodErrors.length) {
          showToast(periodErrors[0], 'error');
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
                onChange: handleServiceLevelChange,
                className: 'w-full p-2.5 border rounded-md outline-none'
              }, SERVICE_LEVEL_OPTIONS.map(function (opt) {
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
            h('h3', { className: 'font-semibold text-lg text-blue-800 border-b pb-2 mb-4' }, '保養區間'),
            renderPeriodRows()
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
