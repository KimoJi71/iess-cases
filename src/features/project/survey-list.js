/*
 * features/project/survey-list.js — 現勘表收集：現勘表列表
 * props: { cases, setCases, setEditingCase, setView, showToast, deviceCategories }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;
  var iconActionBtn = IESS.iconActionBtn;
  var iconActionBtn = IESS.iconActionBtn;

  function SurveyList(props) {
    var cases = props.cases;
    var setCases = props.setCases;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;
    var deviceCategories = props.deviceCategories || [];

    // 區域狀態
    var startDate = todayDate;
    var endDate = todayDate;
    var keyword = '';
    var appliedFilters = { start: todayDate, end: todayDate, keyword: '' };
    var deleteConfirmModal = { show: false, id: null };
    var listPagination = IESS.createListPagination();

    return stateful(function (rerender) {
      function handleSearch() {
        appliedFilters = { start: startDate, end: endDate, keyword: keyword };
        listPagination.resetPage();
        rerender();
      }
      function handleKeyDown(e) { if (e.key === 'Enter') handleSearch(); }

      var kw = appliedFilters.keyword.trim().toLowerCase();
      var filteredCases = cases.filter(function (c) {
        if (c.fillDate < appliedFilters.start || c.fillDate > appliedFilters.end) return false;
        if (!kw) return true;
        return [c.customerName, c.storeName, c.fileName, c.fillDate].filter(Boolean).some(function (v) {
          return String(v).toLowerCase().includes(kw);
        });
      }).sort(function (a, b) { return new Date(b.fillDate) - new Date(a.fillDate); });
      var pageResult = listPagination.slice(filteredCases);

      function handleDelete(id) {
        setCases(cases.filter(function (c) { return c.id !== id; }));
        deleteConfirmModal = { show: false, id: null };
        showToast('已刪除該筆現勘表資料');
      }

      function handleExportPDF(surveyCase) {
        if (typeof exportSurveyPdf !== 'function') {
          showToast('PDF 匯出功能尚未載入', 'error');
          return;
        }
        showToast('正在產生 PDF…');
        exportSurveyPdf(surveyCase, function (msg) {
          showToast(msg || 'PDF 匯出失敗', 'error');
        }, deviceCategories).then(function () {
          showToast('PDF 已下載：' + surveyCase.fileName);
        }).catch(function () { /* onError 已提示 */ });
      }

      function handleCopy(surveyCase) {
        var copied = JSON.parse(JSON.stringify(surveyCase));
        copied.id = 'S' + Date.now();
        copied.fillDate = todayDate;
        copied.fileName = copied.customerName && copied.storeName
          ? copied.customerName + '_' + copied.storeName
          : '';
        copied._isCopy = true;
        setEditingCase(copied);
        setView('survey-edit');
      }

      return h('div', {
        className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100'
      },
        h('div', {
          className: 'flex flex-col md:flex-row justify-between items-start mb-6 gap-4'
        },
          h('div', {
            className: 'bg-gray-50 p-4 rounded-lg border border-gray-200 flex-1'
          },
            h('div', {
              className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end'
            },
              h('div', { className: 'min-w-0' },
                h('label', { className: 'block text-xs text-gray-500 mb-1' }, '開始日期'),
                h('input', {
                  type: 'date',
                  value: startDate,
                  onChange: function (e) { startDate = e.target.value; rerender(); },
                  className: 'w-full p-2.5 border rounded-md outline-none bg-white'
                })
              ),
              h('div', { className: 'min-w-0' },
                h('label', { className: 'block text-xs text-gray-500 mb-1' }, '結束日期'),
                h('input', {
                  type: 'date',
                  value: endDate,
                  onChange: function (e) { endDate = e.target.value; rerender(); },
                  className: 'w-full p-2.5 border rounded-md outline-none bg-white'
                })
              ),
              h('div', { className: 'min-w-0' },
                h('label', { className: 'block text-xs text-gray-500 mb-1' }, '關鍵字'),
                h('input', {
                  type: 'text',
                  value: keyword,
                  onChange: function (e) { keyword = e.target.value; rerender(); },
                  onKeyDown: handleKeyDown,
                  placeholder: '請輸入關鍵字',
                  className: 'w-full p-2.5 border rounded-md outline-none bg-white'
                })
              ),
              h('div', { className: 'min-w-0 flex items-end' },
                h('button', {
                  type: 'button',
                  onClick: handleSearch,
                  className: 'w-full xl:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[42px] transition-colors'
                }, Icons.Search({ className: 'h-4 w-4 shrink-0' }), '搜尋')
              )
            )
          ),
          iconActionBtn({
            label: '新增現勘表',
            className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors shrink-0',
            onClick: function () { setView('survey-add'); },
            icon: Icons.Plus({ className: 'h-5 w-5' })
          })
        ),
        h('div', {
          className: 'overflow-x-auto border rounded-lg'
        },
          h('table', {
            className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap'
          },
            h('thead', {
              className: 'bg-gray-50 text-gray-700 border-b'
            },
              h('tr', null,
                h('th', {
                  className: 'p-3 w-32 text-center font-semibold bg-gray-100/50'
                }, '操作'),
                h('th', {
                  className: 'p-3 font-semibold bg-gray-100/50'
                }, '客戶名稱'),
                h('th', {
                  className: 'p-3 font-semibold bg-gray-100/50'
                }, '門市名稱'),
                h('th', {
                  className: 'p-3 font-semibold bg-gray-100/50'
                }, '檔案名稱'),
                h('th', {
                  className: 'p-3 font-semibold bg-gray-100/50'
                }, '填單日期')
              )
            ),
            h('tbody', {
              className: 'divide-y divide-gray-100'
            }, filteredCases.length === 0 ? h('tr', null, h('td', {
              colspan: '5',
              className: 'text-center p-8 text-gray-400'
            }, '無資料符合目前搜尋條件')) : pageResult.items.map(function (c) {
              return h('tr', {
                key: c.id,
                className: 'hover:bg-gray-50 transition-colors'
              },
                h('td', {
                  className: 'p-3'
                },
                  h('div', {
                    className: 'flex items-center justify-center space-x-2'
                  },
                    h('button', {
                      onClick: function () {
                        setEditingCase(c);
                        setView('survey-edit');
                      },
                      className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
                      title: '編輯'
                    }, Icons.Edit({ className: 'h-4 w-4' })),
                    iconActionBtn({
                      label: '複製現勘表',
                      onClick: function () { handleCopy(c); },
                      className: 'p-1.5 text-gray-600 hover:bg-gray-100 rounded',
                      icon: Icons.Copy({ className: 'h-4 w-4' })
                    }),
                    h('button', {
                      onClick: function () { handleExportPDF(c); },
                      className: 'p-1.5 text-emerald-600 hover:bg-emerald-100 rounded',
                      title: '下載 PDF'
                    }, Icons.Download({ className: 'h-4 w-4' })),
                    iconActionBtn({ label: '刪除', onClick: function () { deleteConfirmModal = { show: true, id: c.id }; rerender(); },
                      className: 'p-1.5 text-red-500 hover:bg-red-100 rounded', icon: Icons.Trash2({ className: 'h-4 w-4' }) })
                  )
                ),
                h('td', {
                  className: 'p-3'
                }, c.customerName),
                h('td', {
                  className: 'p-3'
                }, c.storeName),
                h('td', {
                  className: 'p-3'
                }, h('button', {
                  type: 'button',
                  onClick: function () { handleExportPDF(c); },
                  className: 'font-medium text-blue-700 hover:text-blue-900 hover:underline text-left',
                  title: '下載 PDF'
                }, c.fileName)),
                h('td', {
                  className: 'p-3'
                }, c.fillDate)
              );
            }))
          )
        ),
        listPagination.renderBar(pageResult, rerender),
        deleteConfirmModal.show && h('div', {
          className: 'app-modal-overlay'
        },
          h('div', {
            className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4'
          },
            h('div', {
              className: 'flex items-center space-x-3 text-red-600 mb-4'
            },
              Icons.AlertCircle({ className: 'h-6 w-6' }),
              h('h3', {
                className: 'text-lg font-bold text-gray-800'
              }, '確認刪除')
            ),
            h('p', {
              className: 'text-gray-600 mb-6'
            }, '確定要刪除這筆現勘表資料嗎？刪除後無法復原。'),
            h('div', {
              className: 'flex justify-end space-x-3'
            },
              h('button', {
                onClick: function () { deleteConfirmModal = { show: false, id: null }; rerender(); },
                className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
              }, '取消'),
              h('button', {
                onClick: function () { handleDelete(deleteConfirmModal.id); },
                className: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors'
              }, '確認刪除')
            )
          )
        )
      );
    });
  }

  window.SurveyList = SurveyList;
})();
