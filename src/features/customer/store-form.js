/*
 * features/customer/store-form.js — 客戶建檔（門市管理）：門市新增/編輯表單
 * props: { stores, setStores, customers, targetCase, storeCustomer, setView, showToast, backView, clearCustomerBackView }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var iconActionBtn = IESS.iconActionBtn;

  function StoreForm(props) {
    var stores = props.stores;
    var setStores = props.setStores;
    var customers = props.customers;
    var targetCase = props.targetCase;
    var storeCustomer = props.storeCustomer;
    var setView = props.setView;
    var showToast = props.showToast;
    var backView = props.backView === undefined ? 'store-list' : props.backView;
    var clearCustomerBackView = props.clearCustomerBackView;

    function navigateBack() {
      if (clearCustomerBackView) clearCustomerBackView();
      setView(backView);
    }

    var isEdit = !!targetCase;
    var photoInputEl = null; // useRef
    var customerName = isEdit ? targetCase.customerName : storeCustomer;
    var autoServiceLevel = (function () {
      var c = customers.find(function (c) { return c.name === customerName; });
      return (c && c.serviceLevel) || (targetCase && targetCase.serviceLevel) || '';
    })();

    var formData = {
      storeCode: (targetCase && targetCase.storeCode) || '',
      storeName: (targetCase && targetCase.storeName) || '',
      companyCity: (targetCase && targetCase.companyCity) || TAIWAN_CITY_OPTIONS[0],
      companyDistrict: (targetCase && targetCase.companyDistrict) || StoreUtils.getDistrictsForCity(TAIWAN_CITY_OPTIONS[0])[0] || '',
      companyPhone: (targetCase && targetCase.companyPhone) || '',
      companyFax: (targetCase && targetCase.companyFax) || '',
      companyAddress: (targetCase && targetCase.companyAddress) || '',
      openDate: (targetCase && targetCase.openDate) || '',
      closeDate: (targetCase && targetCase.closeDate) || '',
      storeStatus: (targetCase && targetCase.storeStatus) || STORE_STATUS_OPTIONS[0],
      workOrderApply: (targetCase && targetCase.workOrderApply) || WORK_ORDER_APPLY_OPTIONS[1],
      lastRepairDate: (targetCase && targetCase.lastRepairDate) || '',
      lastMaintenanceDate: (targetCase && targetCase.lastMaintenanceDate) || '',
      remarks: (targetCase && targetCase.remarks) || '',
      indoorHeight: (targetCase && targetCase.indoorHeight) || '',
      outdoorHeight: (targetCase && targetCase.outdoorHeight) || ''
    };
    var contacts = (targetCase && targetCase.contacts) ? targetCase.contacts.map(function (ct) { return Object.assign({}, ct); }) : [];
    var photos = (targetCase && targetCase.photos) ? targetCase.photos.map(function (p) { return Object.assign({}, p); }) : [];
    var contactModal = { show: false };
    var currentContact = { id: null, title: '', name: '', phone: '', email: '' };

    var MAX_FILES = 5;
    var inputCls = 'w-full p-2.5 border rounded-md outline-none focus:border-blue-500';

    function isPdfFile(file) {
      return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    }
    function isImageFile(file) {
      return file.type === 'image/png' || file.type === 'image/jpeg';
    }
    function getFileType(item) {
      if (item.type) return item.type;
      if (item.url && item.url.indexOf('data:application/pdf') === 0) return 'pdf';
      if (/\.pdf$/i.test(item.name || '')) return 'pdf';
      return 'image';
    }

    return stateful(function (rerender) {
      function handleChange(e) {
        var name = e.target.name;
        var value = e.target.value;
        formData[name] = value;
        if (name === 'companyCity') {
          var districts = StoreUtils.getDistrictsForCity(value);
          formData.companyDistrict = districts[0] || '';
        }
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
          contacts = contacts.map(function (ct) { return ct.id === currentContact.id ? Object.assign({}, currentContact) : ct; });
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
      function handleFileSelect(e) {
        var files = Array.prototype.slice.call(e.target.files || []);
        var valid = files.filter(function (f) { return isImageFile(f) || isPdfFile(f); });
        if (valid.length !== files.length) {
          showToast('僅接受 png / jpg / jpeg 圖片或 PDF 檔案', 'error');
        }
        var remaining = MAX_FILES - photos.length;
        if (valid.length > remaining) {
          valid = valid.slice(0, Math.max(0, remaining));
          showToast('檔案最多只可上傳 ' + MAX_FILES + ' 個', 'error');
        }
        valid.forEach(function (f, i) {
          var reader = new FileReader();
          reader.onload = function (ev) {
            photos = photos.concat([{
              id: Date.now() + i,
              name: f.name,
              url: ev.target.result,
              type: isPdfFile(f) ? 'pdf' : 'image'
            }]);
            rerender();
          };
          reader.readAsDataURL(f);
        });
        if (photoInputEl) photoInputEl.value = '';
      }
      function handleDeletePhoto(id) {
        photos = photos.filter(function (p) { return p.id !== id; });
        rerender();
      }
      function handleSubmit(e) {
        e.preventDefault();
        if (!formData.storeName.trim()) {
          showToast('門市名稱為必填', 'error');
          return;
        }
        var payload = Object.assign({}, formData, {
          customerName: customerName,
          serviceLevel: autoServiceLevel,
          contacts: contacts,
          photos: photos
        });
        if (isEdit) {
          setStores(stores.map(function (s) { return s.id === targetCase.id ? Object.assign({}, s, payload) : s; }));
          showToast('門市資料更新成功');
        } else {
          var newStore = Object.assign({ id: 'STORE' + Date.now() }, payload, {
            history: [],
            createdDate: todayDate
          });
          setStores([newStore].concat(stores));
          showToast('門市新增成功');
        }
        navigateBack();
      }

      function field(label, name, opts) {
        opts = opts || {};
        return h('div', { className: opts.wrap || null },
          h('label', { className: 'block text-sm mb-1' }, label,
            opts.required && h('span', { className: 'text-red-500' }, ' *')),
          h('input', {
            type: opts.type || 'text',
            name: name,
            value: formData[name],
            onChange: handleChange,
            required: opts.required,
            className: inputCls
          })
        );
      }

      return h('div', { className: 'max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative' },
        isEdit
          ? h('div', { className: 'flex flex-wrap justify-between items-center gap-3 p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg' },
              h('div', { className: 'flex items-center gap-3 min-w-0' },
                h('h2', { className: 'text-2xl font-bold text-gray-800 whitespace-nowrap' }, '編輯門市'),
                h('span', {
                  className: 'text-base font-medium text-blue-700 bg-blue-50 px-3 py-1 rounded-full whitespace-nowrap'
                }, (customerName || '') + ' / ' + (formData.storeName || targetCase.storeName || ''))
              ),
              h('div', { className: 'flex items-center gap-2 shrink-0' },
                h('button', {
                  type: 'button',
                  onClick: function () { setView('store-repair-add'); },
                  className: 'flex items-center gap-1.5 text-sm bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 px-3 py-2 rounded-md transition-colors'
                }, Icons.Wrench({ className: 'h-4 w-4' }), ' 新增叫修單'),
                h('button', {
                  type: 'button',
                  onClick: function () { setView('store-project-add'); },
                  className: 'flex items-center gap-1.5 text-sm bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 px-3 py-2 rounded-md transition-colors'
                }, Icons.FileText({ className: 'h-4 w-4' }), ' 新增立案單'),
                h('button', {
                  type: 'button',
                  onClick: navigateBack,
                  title: '關閉並返回列表',
                  className: 'ml-1 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors'
                }, Icons.X({ className: 'h-6 w-6' }))
              )
            )
          : PageHeader({
              title: '新增門市',
              onClose: navigateBack,
              wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
            }),
        h('form', { onSubmit: handleSubmit, className: 'p-6' },
          h('div', { className: 'space-y-6' },
          h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-6' },
            h('div', { className: 'col-span-full font-semibold text-lg text-blue-800 border-b pb-2 mb-2' }, '基本資料'),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '客戶名稱'),
              h('input', {
                type: 'text',
                value: customerName || '',
                disabled: true,
                className: 'w-full p-2.5 border rounded-md bg-gray-100 text-gray-600'
              })
            ),
            field('門市店編', 'storeCode'),
            field('門市名稱', 'storeName', { required: true }),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '公司縣市'),
              h('select', {
                name: 'companyCity',
                value: formData.companyCity,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none bg-white'
              }, TAIWAN_CITY_OPTIONS.map(function (opt) { return h('option', { key: opt, value: opt }, opt); }))
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '公司行政區'),
              h('select', {
                name: 'companyDistrict',
                value: formData.companyDistrict,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none bg-white'
              }, StoreUtils.getDistrictsForCity(formData.companyCity).map(function (opt) {
                return h('option', { key: opt, value: opt }, opt);
              }))
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '服務等級 '),
              h('input', {
                type: 'text',
                value: autoServiceLevel || '—',
                disabled: true,
                className: 'w-full p-2.5 border rounded-md bg-gray-100 text-gray-600'
              })
            ),
            field('公司電話', 'companyPhone'),
            field('公司傳真', 'companyFax'),
            field('公司地址', 'companyAddress', { wrap: 'col-span-full md:col-span-2' }),
            field('開幕日期', 'openDate', { type: 'date' }),
            field('撤店日期', 'closeDate', { type: 'date' }),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '門市狀態'),
              h('select', {
                name: 'storeStatus',
                value: formData.storeStatus,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none bg-white'
              }, STORE_STATUS_OPTIONS.map(function (opt) { return h('option', { key: opt, value: opt }, opt); }))
            ),
            h('div', null,
              h('label', { className: 'block text-sm mb-1' }, '工單申請'),
              h('select', {
                name: 'workOrderApply',
                value: formData.workOrderApply,
                onChange: handleChange,
                className: 'w-full p-2.5 border rounded-md outline-none bg-white'
              }, WORK_ORDER_APPLY_OPTIONS.map(function (opt) { return h('option', { key: opt, value: opt }, opt); }))
            ),
            field('上次維修日期', 'lastRepairDate', { type: 'date' }),
            field('上次保養日期', 'lastMaintenanceDate', { type: 'date' }),
            field('室內高度', 'indoorHeight'),
            field('室外高度', 'outdoorHeight'),
            h('div', { className: 'col-span-full' },
              h('label', { className: 'block text-sm mb-1' }, '備註說明'),
              h('textarea', {
                name: 'remarks',
                value: formData.remarks,
                onChange: handleChange,
                rows: 3,
                className: inputCls
              })
            )
          ),
          h('div', null,
            h('div', { className: 'flex items-center justify-between border-b pb-2 mb-4' },
              h('h3', { className: 'font-semibold text-lg text-blue-800' }, '承辦資料 ',
                h('span', { className: 'text-sm font-normal text-gray-400' }, '(可多筆)')),
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
          ),
          h('div', null,
            h('div', { className: 'flex items-center justify-between border-b pb-2 mb-4' },
              h('h3', { className: 'font-semibold text-lg text-blue-800' }, '檔案資料 ',
                h('span', { className: 'text-sm font-normal text-gray-400' },
                  '(png / jpg / jpeg / PDF，最多 ' + MAX_FILES + ' 個 ' + photos.length + '/' + MAX_FILES + ')')),
              h('label', {
                className: 'flex items-center gap-1.5 text-sm border px-3 py-1.5 rounded-md transition-colors ' +
                  (photos.length >= MAX_FILES
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer')
              }, Icons.Paperclip({ className: 'h-4 w-4' }), ' 上傳檔案',
                h('input', {
                  ref: function (el) { photoInputEl = el; },
                  type: 'file',
                  accept: 'image/png,image/jpeg,.png,.jpg,.jpeg,application/pdf,.pdf',
                  multiple: true,
                  disabled: photos.length >= MAX_FILES,
                  onChange: handleFileSelect,
                  className: 'hidden'
                })
              )
            ),
            photos.length === 0
              ? h('div', { className: 'text-center text-gray-400 py-6 border border-dashed rounded-md' }, '尚未上傳檔案')
              : h('div', { className: 'flex flex-wrap gap-3' },
                  photos.map(function (p) {
                    var fileType = getFileType(p);
                    return h('div', { key: p.id, className: 'relative w-32 group' },
                      fileType === 'pdf'
                        ? h('a', {
                            href: p.url,
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            title: '開啟 PDF：' + p.name,
                            className: 'w-32 h-24 flex flex-col items-center justify-center rounded-md border border-gray-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors'
                          }, Icons.FileText({ className: 'h-7 w-7' }),
                            h('span', { className: 'text-xs mt-1 font-medium' }, 'PDF'))
                        : p.url
                          ? h('img', {
                              src: p.url,
                              alt: p.name,
                              className: 'w-32 h-24 object-cover rounded-md border border-gray-200 bg-gray-50'
                            })
                          : h('div', {
                              className: 'w-32 h-24 flex items-center justify-center rounded-md border border-gray-200 bg-gray-100 text-gray-400'
                            }, Icons.FileText({ className: 'h-7 w-7' })),
                      h('div', { className: 'mt-1 text-xs text-gray-600 truncate', title: p.name }, p.name),
                      iconActionBtn({
                        label: '刪除檔案',
                        onClick: function () { handleDeletePhoto(p.id); },
                        className: 'absolute -top-2 -right-2 p-1 bg-white border border-gray-200 rounded-full text-red-500 hover:bg-red-50 shadow-sm',
                        icon: Icons.X({ className: 'h-3.5 w-3.5' })
                      })
                    );
                  })
                )
          )),
          h('div', { className: 'mt-8 pt-6 border-t flex justify-end gap-3' },
            h('button', {
              type: 'button',
              onClick: navigateBack,
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
              h('h3', { className: 'text-lg font-bold text-gray-800' }, currentContact.id ? '編輯承辦資料' : '新增承辦資料'),
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
                  className: inputCls
                })
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '承辦姓名 ',
                  h('span', { className: 'text-red-500' }, '*')),
                h('input', {
                  type: 'text',
                  name: 'name',
                  value: currentContact.name,
                  onChange: handleContactChange,
                  className: inputCls
                })
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '承辦電話'),
                h('input', {
                  type: 'text',
                  name: 'phone',
                  value: currentContact.phone,
                  onChange: handleContactChange,
                  className: inputCls
                })
              ),
              h('div', null,
                h('label', { className: 'block text-sm mb-1' }, '承辦Mail'),
                h('input', {
                  type: 'email',
                  name: 'email',
                  value: currentContact.email,
                  onChange: handleContactChange,
                  className: inputCls
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
              }, Icons.Save({ className: 'h-4 w-4' }), ' 儲存承辦')
            )
          )
        )
      );
    });
  }

  window.StoreForm = StoreForm;
})();
