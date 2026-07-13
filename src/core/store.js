/*
 * core/store.js — 極簡全域狀態容器
 *
 * 保存原本 JinChuanWarRoom 的頂層狀態（目前選單、各資料集、編輯中案件...）。
 * set() 會合併狀態並通知所有訂閱者重繪。跨頁面共享的資料放這裡；
 * 各表單的欄位暫存狀態則由元件自身以區域 model 物件管理（避免整頁重繪）。
 */
(function (global) {
  'use strict';

  function createStore(initialState) {
    var state = Object.assign({}, initialState);
    var listeners = [];

    function get() {
      return state;
    }

    function set(partial) {
      // 支援 set(fn) 以前一狀態計算
      var next = typeof partial === 'function' ? partial(state) : partial;
      state = Object.assign({}, state, next);
      listeners.forEach(function (fn) { fn(state); });
    }

    function subscribe(fn) {
      listeners.push(fn);
      return function () {
        listeners = listeners.filter(function (l) { return l !== fn; });
      };
    }

    return { get: get, set: set, subscribe: subscribe };
  }

  global.IESS = global.IESS || {};
  global.IESS.createStore = createStore;
})(window);
