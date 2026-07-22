/*
 * core/pagination.js — 列表分頁工具
 */
(function (global) {
  'use strict';
  var h = global.IESS && global.IESS.h;

  var DEFAULT_PAGE_SIZE = 20;
  var PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

  function paginate(items, page, pageSize) {
    var list = items || [];
    var total = list.length;
    var size = pageSize || DEFAULT_PAGE_SIZE;
    var totalPages = Math.max(1, Math.ceil(total / size));
    var safePage = Math.min(Math.max(1, page || 1), totalPages);
    var startIndex = (safePage - 1) * size;
    return {
      items: list.slice(startIndex, startIndex + size),
      total: total,
      page: safePage,
      pageSize: size,
      totalPages: totalPages,
      start: total === 0 ? 0 : startIndex + 1,
      end: Math.min(startIndex + size, total)
    };
  }

  function createListPagination(initialPageSize) {
    var state = {
      currentPage: 1,
      pageSize: initialPageSize || DEFAULT_PAGE_SIZE
    };
    return {
      state: state,
      slice: function (items) {
        var result = paginate(items, state.currentPage, state.pageSize);
        state.currentPage = result.page;
        return result;
      },
      resetPage: function () {
        state.currentPage = 1;
      },
      renderBar: function (result, rerender) {
        return PaginationBar({
          result: result,
          onPageChange: function (p) {
            state.currentPage = p;
            rerender();
          },
          onPageSizeChange: function (s) {
            state.pageSize = s;
            state.currentPage = 1;
            rerender();
          }
        });
      }
    };
  }

  function PaginationBar(props) {
    var result = props.result;
    var onPageChange = props.onPageChange;
    var onPageSizeChange = props.onPageSizeChange;
    var pageSizeOptions = props.pageSizeOptions || PAGE_SIZE_OPTIONS;

    if (!result || result.total === 0) return null;

    var page = result.page;
    var totalPages = result.totalPages;

    function pageBtn(label, targetPage, disabled) {
      return h('button', {
        type: 'button',
        disabled: disabled,
        onClick: disabled ? undefined : function () { onPageChange(targetPage); },
        className: 'px-3 py-1.5 rounded-md text-sm border border-gray-300 text-gray-600 transition-colors ' +
          (disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50')
      }, label);
    }

    return h('div', {
      className: 'flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100'
    },
      h('div', { className: 'text-sm text-gray-500' },
        '共 ', String(result.total), ' 筆，顯示第 ', String(result.start), '–', String(result.end), ' 筆'
      ),
      h('div', { className: 'flex flex-wrap items-center gap-2' },
        onPageSizeChange && h('select', {
          value: result.pageSize,
          onChange: function (e) { onPageSizeChange(Number(e.target.value)); },
          className: 'px-2 py-1.5 border rounded-md text-sm text-gray-600 outline-none focus:border-blue-500 bg-white'
        }, pageSizeOptions.map(function (n) {
          return h('option', { key: n, value: n }, '每頁 ' + n + ' 筆');
        })),
        pageBtn('第一頁', 1, page <= 1),
        pageBtn('上一頁', page - 1, page <= 1),
        h('span', { className: 'px-2 text-sm text-gray-600 tabular-nums' },
          String(page), ' / ', String(totalPages)
        ),
        pageBtn('下一頁', page + 1, page >= totalPages),
        pageBtn('最末頁', totalPages, page >= totalPages)
      )
    );
  }

  global.IESS = global.IESS || {};
  global.IESS.paginate = paginate;
  global.IESS.createListPagination = createListPagination;
  global.IESS.PaginationBar = PaginationBar;
  global.IESS.DEFAULT_PAGE_SIZE = DEFAULT_PAGE_SIZE;
})(window);
