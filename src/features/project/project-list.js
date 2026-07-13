/*
 * features/project/project-list.js — 工程立案：立案單列表（未結案）
 * props: { cases, setCases, setEditingCase, setView, showToast }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful, useDragScroll = IESS.useDragScroll;

  function ProjectList(props) {
    var cases = props.cases;
    var setCases = props.setCases;
    var setEditingCase = props.setEditingCase;
    var setView = props.setView;
    var showToast = props.showToast;

    var startDate = todayDate;
    var endDate = todayDate;
    var appliedDateRange = { start: todayDate, end: todayDate };
    var historyModal = { show: false, caseData: null };
    var closeConfirmModal = { show: false, id: null };
    var dragProps = useDragScroll();

    return stateful(function (rerender) {
      function handleSearch() {
        appliedDateRange = { start: startDate, end: endDate };
        rerender();
      }

      var filteredCases = cases.filter(function (c) {
        return !c.isClosed && c.creationDate >= appliedDateRange.start && c.creationDate <= appliedDateRange.end;
      }).sort(function (a, b) { return new Date(b.creationDate) - new Date(a.creationDate); });

      function handleAddComment(caseId, newComment) {
        setCases(cases.map(function (c) {
          if (c.id === caseId) {
            var updatedComments = (c.comments || []).concat([newComment]);
            if (historyModal.caseData && historyModal.caseData.id === caseId) {
              historyModal = Object.assign({}, historyModal, {
                caseData: Object.assign({}, historyModal.caseData, { comments: updatedComments })
              });
            }
            return Object.assign({}, c, { comments: updatedComments });
          }
          return c;
        }));
      }

      function handleCloseProject(id) {
        setCases(cases.map(function (c) {
          return c.id === id ? Object.assign({}, c, { isClosed: true }) : c;
        }));
        closeConfirmModal = { show: false, id: null };
        showToast('工程案件已結案並移至銷案審核列表');
      }

      return h('div', {
        className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100'
      }, h('div', {
        className: 'flex justify-between items-center mb-6 pb-6 border-b'
      }, h('div', {
        className: 'flex items-center gap-3'
      }, Icons.Calendar({
        className: 'h-5 w-5 text-gray-500'
      }), h('span', {
        className: 'font-medium text-gray-700'
      }, '查詢區間：'), h('input', {
        type: 'date',
        value: startDate,
        onChange: function (e) { startDate = e.target.value; rerender(); },
        className: 'p-2 border rounded-md outline-none'
      }), h('span', {
        className: 'text-gray-500'
      }, '至'), h('input', {
        type: 'date',
        value: endDate,
        onChange: function (e) { endDate = e.target.value; rerender(); },
        className: 'p-2 border rounded-md outline-none'
      }), h('button', {
        onClick: handleSearch,
        className: 'bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors hover:bg-blue-700'
      }, Icons.Search({
        className: 'h-4 w-4'
      }), ' 搜尋')), h('button', {
        onClick: function () { setView('project-add'); },
        className: 'flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow-sm transition-colors',
        title: '新增立案單'
      }, Icons.Plus({
        className: 'h-5 w-5'
      }))), h('div', Object.assign({
        className: 'overflow-x-auto border rounded-lg cursor-grab active:cursor-grabbing'
      }, dragProps), h('table', {
        className: 'w-full text-left text-sm text-gray-600 whitespace-nowrap select-none'
      }, h('thead', {
        className: 'bg-gray-50 text-gray-700 border-b'
      }, h('tr', null, h('th', {
        className: 'p-3 w-28 text-center font-semibold bg-gray-100/50'
      }, '操作'), h('th', {
        className: 'p-3 font-semibold bg-gray-100/50'
      }, '案件編號'), h('th', {
        className: 'p-3 font-semibold bg-gray-100/50'
      }, '客戶名稱'), h('th', {
        className: 'p-3 font-semibold bg-gray-100/50 border-r'
      }, '門市名稱'), h('th', {
        className: 'p-3 font-semibold bg-gray-100/50 border-r'
      }, '工項分類'), PROJECT_STAGES.map(function (stage) {
        return h('th', {
          key: stage,
          className: 'p-3 font-semibold text-center border-r'
        }, stage);
      }))), h('tbody', {
        className: 'divide-y divide-gray-100'
      }, filteredCases.length === 0 ? h('tr', null, h('td', {
        colspan: 5 + PROJECT_STAGES.length,
        className: 'text-center p-8 text-gray-400'
      }, '無資料符合目前搜尋區間')) : filteredCases.map(function (c) {
        return h('tr', {
          key: c.id,
          className: 'hover:bg-gray-50 transition-colors'
        }, h('td', {
          className: 'p-3'
        }, h('div', {
          className: 'flex items-center justify-center space-x-2'
        }, h('button', {
          onClick: function () { setEditingCase(c); setView('project-edit'); },
          className: 'p-1.5 text-blue-600 hover:bg-blue-100 rounded',
          title: '查看/編輯案件'
        }, Icons.Edit({
          className: 'h-4 w-4'
        })), h('button', {
          onClick: function () { historyModal = { show: true, caseData: c }; rerender(); },
          className: 'p-1.5 text-indigo-500 hover:bg-indigo-100 rounded',
          title: '案件歷程 (註記說明)'
        }, Icons.Clock({
          className: 'h-4 w-4'
        })), h('button', {
          onClick: function () { closeConfirmModal = { show: true, id: c.id }; rerender(); },
          className: 'p-1.5 text-green-600 hover:bg-green-100 rounded',
          title: '編輯結案狀態'
        }, Icons.CheckCircle({
          className: 'h-4 w-4'
        })))), h('td', {
          className: 'p-3 font-medium text-blue-700'
        }, c.projectNumber), h('td', {
          className: 'p-3'
        }, c.customerName), h('td', {
          className: 'p-3 border-r'
        }, c.storeName), h('td', {
          className: 'p-3 border-r'
        }, h('span', {
          className: 'px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700'
        }, c.workCategory)), PROJECT_STAGES.map(function (stage) {
          var stageData = c.history && c.history.find(function (item) { return item.stage === stage; });
          return h('td', {
            key: stage,
            className: 'p-2 border-r min-w-[120px]'
          }, stageData ? h('div', {
            className: 'flex flex-col items-center justify-center bg-blue-50/50 rounded p-1.5 border border-blue-100'
          }, h('span', {
            className: 'font-medium text-gray-800 text-xs mb-0.5'
          }, stageData.date), h('span', {
            className: 'text-blue-700 text-[11px] bg-blue-100 px-1.5 rounded truncate max-w-full',
            title: stageData.assignee
          }, stageData.assignee)) : h('div', {
            className: 'flex items-center justify-center text-gray-300'
          }, '-'));
        }));
      })))), historyModal.show && historyModal.caseData && h(ProjectHistoryModal, {
        caseData: historyModal.caseData,
        onClose: function () { historyModal = { show: false, caseData: null }; rerender(); },
        onAddComment: handleAddComment
      }), closeConfirmModal.show && h('div', {
        className: 'fixed inset-0 bg-black/40 flex items-center justify-center z-50'
      }, h('div', {
        className: 'bg-white rounded-lg shadow-xl p-6 w-96 max-w-full m-4'
      }, h('div', {
        className: 'flex items-center space-x-3 text-yellow-600 mb-4'
      }, Icons.AlertCircle({
        className: 'h-6 w-6'
      }), h('h3', {
        className: 'text-lg font-bold text-gray-800'
      }, '確認結案')), h('p', {
        className: 'text-gray-600 mb-6'
      }, '確定要將此工程立案單標記為結案嗎？結案後狀態將更新並移至「案件銷案審核」列表。'), h('div', {
        className: 'flex justify-end space-x-3'
      }, h('button', {
        onClick: function () { closeConfirmModal = { show: false, id: null }; rerender(); },
        className: 'px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50 transition-colors'
      }, '取消'), h('button', {
        onClick: function () { handleCloseProject(closeConfirmModal.id); },
        className: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
      }, '確認結案')))));
    });
  }

  window.ProjectList = ProjectList;
})();
