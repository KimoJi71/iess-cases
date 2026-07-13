/*
 * features/project/survey-list.js — 現勘表收集：現勘表列表
 * props: { cases, setCases, setEditingCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll;

  function SurveyList(props) {
    var cases = props.cases;
    var setCases = props.setCases;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    // 區域狀態
    var startDate = todayDate;
    var endDate = todayDate;
    var appliedDateRange = { start: todayDate, end: todayDate };
    var deleteConfirmModal = { show: false, id: null };
    var dragProps = useDragScroll();

    return stateful(function (rerender) {
      function handleSearch() {
        appliedDateRange = { start: startDate, end: endDate };
        rerender();
      }

      var filteredCases = cases.filter(function (c) {
        return c.fillDate >= appliedDateRange.start && c.fillDate <= appliedDateRange.end;
      }).sort(function (a, b) { return new Date(b.fillDate) - new Date(a.fillDate); });

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
        }).then(function () {
          showToast('PDF 已下載：' + surveyCase.fileName);
        }).catch(function () { /* onError 已提示 */ });
      }

      return h('div', {
        className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100'
      },
        h('div', {
          className: 'flex justify-between items-center mb-6 pb-6 border-b'
        },
          h('div', {
            className: 'flex items-center gap-3'
          },
            Icons.Calendar({ className: 'h-5 w-5 text-gray-500' }),
            h('span', {
              className: 'font-medium text-gray-700'
            }, '查詢區間：'),
            h('input', {
              type: 'date',
              value: startDate,
              onChange: function (e) { startDate = e.target.value; rerender(); },
              className: 'p-2 border rounded-md outline-none'
            }),
            h('span', {
              className: 'text-gray-500'
            }, '至'),
            h('input', {
              type: 'date',
              value: endDate,
              onChange: function (e) { endDate = e.target.value; rerender(); },
              className: 'p-2 border rounded-md outline-none'
            }),
            h('button', {
              onClick: handleSearch,
              className: 'bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors hover:bg-blue-700'
            }, Icons.Search({ className: 'h-4 w-4' }), ' 搜尋')
          ),
          h('button', {
            onClick: function () { setView('survey-add'); },
            className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors',
            title: '新增現勘表'
          }, Icons.Plus({ className: 'h-5 w-5' }))
        ),
        h('div', Object.assign({
          className: 'overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing'
        }, dragProps),
          h('table', {
            className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap select-none'
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
            }, '無資料符合目前搜尋區間')) : filteredCases.map(function (c) {
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
                    h('button', {
                      onClick: function () { handleExportPDF(c); },
                      className: 'p-1.5 text-emerald-600 hover:bg-emerald-100 rounded',
                      title: '下載 PDF'
                    }, Icons.Download({ className: 'h-4 w-4' })),
                    h('button', {
                      onClick: function () { deleteConfirmModal = { show: true, id: c.id }; rerender(); },
                      className: 'p-1.5 text-red-500 hover:bg-red-100 rounded',
                      title: '刪除'
                    }, Icons.Trash2({ className: 'h-4 w-4' }))
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
        deleteConfirmModal.show && h('div', {
          className: 'fixed inset-0 bg-black/40 flex items-center justify-center z-50'
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
