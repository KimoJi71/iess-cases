/*
 * features/scheduling/gps.js — GPS（佔位入口，細節待規劃）
 */
(function () {
  'use strict';
  var h = IESS.h;

  function GpsTracking() {
    return h('div', { className: 'bg-white p-6 rounded-lg shadow-sm border border-gray-100' },
      h('h2', { className: 'text-2xl font-bold text-gray-800 mb-2' }, 'GPS'),
      h('p', { className: 'text-gray-500' }, '此功能尚在規劃中，細節確定後再實作。')
    );
  }

  window.GpsTracking = GpsTracking;
})();
