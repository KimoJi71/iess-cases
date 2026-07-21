/*
 * features/repair/case-datetime.js — 案件時間紀錄格式工具
 * 格式：YYYY-MM-DD HH:mm:ss
 */
(function (global) {
  'use strict';

  function parseCaseDateTime(raw) {
    if (!raw) return null;
    var str = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) str += ' 00:00:00';
    str = str.replace(' ', 'T');
    var d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatFromDate(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ':' +
      String(d.getSeconds()).padStart(2, '0');
  }

  function formatCaseDateTime(raw) {
    if (!raw) return '—';
    var d = parseCaseDateTime(raw);
    if (!d) return raw;
    return formatFromDate(d);
  }

  function nowCaseDateTime() {
    return formatFromDate(new Date());
  }

  function toDatetimeLocalValue(raw) {
    var d = parseCaseDateTime(raw);
    if (!d) return '';
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + 'T' +
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0');
  }

  function fromDatetimeLocalValue(val) {
    if (!val) return '';
    var parts = val.split('T');
    if (parts.length !== 2) return val;
    var time = parts[1];
    if (time.length === 5) time += ':00';
    return parts[0] + ' ' + time;
  }

  global.IESS = global.IESS || {};
  global.IESS.caseDateTime = {
    format: formatCaseDateTime,
    now: nowCaseDateTime,
    toInput: toDatetimeLocalValue,
    fromInput: fromDatetimeLocalValue,
    parse: parseCaseDateTime
  };
})(window);
