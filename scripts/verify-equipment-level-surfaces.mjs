#!/usr/bin/env node
/**
 * Executed UI verification: 設備等級 shows up on EVERY surface that renders 設備資料.
 * Covers 叫修單（查看/安排）、工程立案單（表單彈窗＋兩處列表）、門市立案單列表、
 * 現勘單設備區塊、現勘單 PDF。
 * Companion to verify-equipment-level-ui.mjs (設備分類管理／客戶設備).
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9334);

if (!existsSync(CHROME)) {
  console.error(`找不到 Chrome：${CHROME}\n可用 CHROME_PATH 環境變數指定路徑。`);
  process.exit(2);
}

let passed = 0, failed = 0;
const pass = (n, d) => { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, d) => { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); };

function assertEq(actual, expected, name) {
  if (actual === expected) pass(name, JSON.stringify(actual));
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/iess-surfaces-check-profile',
  'about:blank'
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [];

function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
  }
  return r.result.value;
}

try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); break; }
    catch { await sleep(200); }
  }
  const page = targets.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(res => { ws.onopen = res; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(m.params.exceptionDetails.exception?.description
        || m.params.exceptionDetails.text);
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    }
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: `file://${ROOT}/index.html` });
  await sleep(4000);

  console.log('page load');
  assertEq(consoleErrors.length, 0, '載入時無 JS 錯誤');

  // 設備分類不再帶等級；等級一律由設備紀錄自己攜帶（設備管理設定）。
  await evaluate(`
    window.__cats = [
      { id:'T1', category:'分離式', brand:'日立', deviceName:'分離式冷氣',
        specification:'3.5匹', model:'DUP-1', refrigerant:'R410A', powerSource:'220V' },
      { id:'T2', category:'分離式', brand:'大金', deviceName:'分離式冷氣',
        specification:'3.5匹', model:'DUP-1', refrigerant:'R32', powerSource:'220V' },
      { id:'T3', category:'箱型', brand:'日立', deviceName:'箱型冷氣',
        specification:'5.0匹', model:'BASE-1', refrigerant:'R410A', powerSource:'220V' },
      { id:'T4', category:'吊隱式', brand:'大金', deviceName:'吊隱式冷氣',
        specification:'2.0匹', model:'ADDON-1', refrigerant:'R32', powerSource:'220V' }
    ];
    // 叫修單直接顯示原始設備，不做正規化；level 傳 null 模擬未存等級的舊資料
    window.__equip = function (level) {
      var eq = { id:'EQ-' + level, category:'分離式', brand:'大金', deviceName:'分離式冷氣',
        specification:'3.5匹', model:'DUP-1', area:'頂樓', status:'運轉' };
      if (level) eq.equipmentLevel = level;
      return eq;
    };
    // 唯一型號：供會經過 resolveProjectEquip 正規化的畫面使用
    window.__uniq = function (which) {
      return which === 'addon'
        ? { id:'EQ-ADDON', category:'吊隱式', brand:'大金', deviceName:'吊隱式冷氣',
            specification:'2.0匹', model:'ADDON-1', equipmentLevel:'增額設備',
            area:'頂樓', status:'運轉' }
        : { id:'EQ-BASE', category:'箱型', brand:'日立', deviceName:'箱型冷氣',
            specification:'5.0匹', model:'BASE-1', equipmentLevel:'一般設備',
            area:'一樓', status:'運轉' };
    }; 'ok'`);

  console.log('\n共用工具 EquipmentUtils.formatLevel');
  const fmt = await evaluate(`(function(){
    var f = EquipmentUtils.formatLevel;
    return {
      addOn: f(window.__equip('增額設備')),
      base: f(window.__equip('一般設備')),
      legacy: f(window.__equip(null)),
      noModel: f({ category:'分離式', brand:'大金', equipmentLevel:'增額設備' }),
      nullEquip: f(null)
    };
  })()`);
  assertEq(fmt.addOn, '增額設備', '設備存增額設備就回增額設備');
  assertEq(fmt.base, '一般設備', '設備存一般設備就回一般設備');
  assertEq(fmt.legacy, '一般設備', '舊資料無等級退回預設');
  assertEq(fmt.noModel, '', '未選型號回空字串（不預設成一般設備）');
  assertEq(fmt.nullEquip, '', '設備為 null 回空字串');

  console.log('\n叫修單 — 設備資料欄位定義');
  const defs = await evaluate(`(function(){
    var labels = RepairCaseEquipment.FIELD_DEFS.map(function(d){ return d.label; });
    function values(level){
      var f = RepairCaseEquipment.getDisplayFields(window.__equip(level), {}, window.__cats);
      var out = {};
      f.forEach(function(x){ out[x.label] = x.value; });
      return out;
    }
    return {
      labels: labels,
      addOn: values('增額設備'),
      base: values('一般設備'),
      legacy: values(null)
    };
  })()`);
  assertTrue(defs.labels.includes('設備等級'), '欄位定義含「設備等級」', defs.labels.join(' | '));
  assertEq(defs.labels.indexOf('設備等級'), defs.labels.indexOf('型號') + 1, '設備等級緊接在型號之後');
  assertEq(defs.addOn['設備等級'], '增額設備', '增額設備顯示增額設備');
  assertEq(defs.base['設備等級'], '一般設備', '一般設備顯示一般設備');
  assertEq(defs.legacy['設備等級'], '一般設備', '舊資料無等級時不炸、退回預設');

  console.log('\n叫修單 — 查看案件明細');
  const view = await evaluate(`(function(){
    var node = ViewCaseForm({
      viewingCase: { id:'R1', caseNumber:'R-001', customerName:'測試客戶',
        storeName:'測試門市', workCategory:'維修', serviceLevel:'A 保修(一年四次)',
        equipment: window.__equip('增額設備'), processRecords: [] },
      setView: function(){}, backView: 'record-list',
      processMethods: [], deviceCategories: window.__cats
    });
    var out = null;
    Array.prototype.forEach.call(node.querySelectorAll('span'), function(s){
      if (s.textContent.trim() === '設備等級' && s.nextElementSibling) {
        out = s.nextElementSibling.textContent.trim();
      }
    });
    return out;
  })()`);
  assertEq(view, '增額設備', '查看案件明細的設備區塊顯示設備等級');

  console.log('\n工程立案單 — 設備列表');
  const proj = await evaluate(`(function(){
    var node = EditProjectForm({
      editingCase: { id:'P1', caseNumber:'P-001', customerName:'測試客戶',
        storeName:'測試門市', workCategory:'新開',
        details: { equipment: [
          Object.assign({ id:'PE1' }, window.__uniq('addon')),
          Object.assign({ id:'PE2' }, window.__uniq('base'))
        ] } },
      cases: [], setCases: function(){}, stores: [], customers: [], accounts: [],
      deviceCategories: window.__cats, repairCases: [],
      setView: function(){}, showToast: function(){}, mode: 'view'
    });
    var tables = node.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
      var ths = Array.prototype.map.call(tables[i].querySelectorAll('thead th'),
        function(t){ return t.textContent.trim(); });
      if (ths.indexOf('型號') === -1) continue;
      var rows = Array.prototype.map.call(tables[i].querySelectorAll('tbody tr'), function(tr){
        return Array.prototype.map.call(tr.querySelectorAll('td'), function(td){ return td.textContent.trim(); });
      });
      return { ths: ths, rows: rows, tdCount: rows[0] ? rows[0].length : 0 };
    }
    return null;
  })()`);
  assertTrue(proj && proj.ths.includes('設備等級'), '工程立案設備列表有「設備等級」欄',
    proj && proj.ths.join(' | '));
  assertEq(proj.ths.indexOf('設備等級'), proj.ths.indexOf('型號') + 1, '設備等級緊接在型號之後');
  assertEq(proj.tdCount, proj.ths.length, '表頭欄數與資料列欄數一致');
  {
    const i = proj.ths.indexOf('設備等級');
    const addon = proj.rows.find(r => r.includes('ADDON-1'));
    const base = proj.rows.find(r => r.includes('BASE-1'));
    assertEq(addon[i], '增額設備', 'ADDON-1 那筆為增額設備');
    assertEq(base[i], '一般設備', 'BASE-1 那筆為一般設備');
  }

  console.log('\n工程立案單 — 加入設備彈窗');
  const modal = await evaluate(`(function(){
    function levelOf(initial){
      var node = ProjectEquipModal({
        initialEquip: initial, editingId: initial ? 'PE1' : null,
        deviceCategories: window.__cats, showToast: function(){},
        onClose: function(){}, onSave: function(){}
      });
      var labels = node.querySelectorAll('label');
      for (var i = 0; i < labels.length; i++) {
        if (labels[i].textContent.trim() === '設備等級') {
          var inp = labels[i].parentNode.querySelector('input');
          return { value: inp.value, disabled: !!inp.disabled, placeholder: inp.placeholder || '' };
        }
      }
      return null;
    }
    return { blank: levelOf(null), addon: levelOf(window.__uniq('addon')) };
  })()`);
  assertTrue(modal.blank !== null, '彈窗有「設備等級」欄位');
  assertEq(modal.blank.disabled, true, '設備等級欄位為唯讀（只在設備管理設定）');
  assertEq(modal.blank.value, '', '未選型號時為空');
  assertEq(modal.blank.placeholder, '請先選擇型號', '未選型號時顯示提示文字');
  assertEq(modal.addon.value, '增額設備', '編輯增額設備時帶出增額設備');

  console.log('\n門市立案單 — 設備列表');
  const storeProj = await evaluate(`(function(){
    var node = StoreProjectForm({
      store: { id:'S1', customerName:'測試客戶', storeName:'測試門市', storeAddress:'某地',
        serviceLevel:'A 保修(一年四次)' },
      cases: [], setCases: function(){}, deviceCategories: window.__cats,
      setView: function(){}, showToast: function(){}
    });
    var ths = Array.prototype.map.call(node.querySelectorAll('thead th'),
      function(t){ return t.textContent.trim(); });
    var emptyCell = node.querySelector('tbody td[colspan]');
    return { ths: ths, colspan: emptyCell ? emptyCell.getAttribute('colspan') : null };
  })()`);
  assertTrue(storeProj.ths.includes('設備等級'), '門市立案單設備列表有「設備等級」欄',
    storeProj.ths.join(' | '));
  assertEq(storeProj.ths.indexOf('設備等級'), storeProj.ths.indexOf('型號') + 1, '設備等級緊接在型號之後');
  assertEq(storeProj.colspan, String(storeProj.ths.length), '空狀態 colspan 與欄數一致');

  console.log('\n現勘單 — 設備區塊');
  const survey = await evaluate(`(function(){
    var target = { id:'S1', caseNumber:'SV-001', customerName:'測試客戶',
      storeName:'測試門市', fillDate:'2026-08-07',
      surveyData: { equipmentList: [window.__uniq('addon')] } };
    var node = SurveyForm({
      cases: [target], setCases: function(){}, stores: [], customers: [],
      deviceCategories: window.__cats, targetCase: target,
      setView: function(){}, showToast: function(){}
    });
    // 設備區塊在「設備與零件」分頁後面，先切過去
    var host = document.createElement('div');
    host.appendChild(node);
    document.body.appendChild(host);
    var tab = Array.prototype.filter.call(host.querySelectorAll('button'), function(b){
      return b.textContent.trim() === '設備與零件';
    })[0];
    if (!tab) { host.remove(); return { error: 'tab-not-found' }; }
    tab.click();
    var labels = host.querySelectorAll('label');
    var out = { error: 'field-not-found' };
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].textContent.trim() === '設備等級') {
        var inp = labels[i].parentNode.querySelector('input');
        out = { value: inp.value, disabled: !!inp.disabled, placeholder: inp.placeholder || '' };
        break;
      }
    }
    host.remove();
    return out;
  })()`);
  assertTrue(survey && !survey.error, '現勘單設備區塊有「設備等級」欄位', survey && survey.error);
  assertEq(survey.disabled, true, '設備等級欄位為唯讀（只在設備管理設定）');
  assertEq(survey.value, '增額設備', '已選型號時帶出正確等級');

  console.log('\n現勘單 — PDF 匯出');
  const pdf = await evaluate(`(function(){
    var html = buildSurveyPdfHtml({
      id:'S1', caseNumber:'SV-001', customerName:'測試客戶', storeName:'測試門市',
      fillDate:'2026-08-07',
      surveyData: { equipmentList: [window.__uniq('addon'), window.__uniq('base')] }
    }, window.__cats);
    return { hasAddOn: html.indexOf('等級:增額設備') >= 0,
             hasBase: html.indexOf('等級:一般設備') >= 0 };
  })()`);
  assertTrue(pdf.hasAddOn, 'PDF 內含增額設備的「等級:增額設備」');
  assertTrue(pdf.hasBase, 'PDF 內含一般設備的「等級:一般設備」');

  assertEq(consoleErrors.length, 0, '全程無 JS 錯誤');
} catch (e) {

  fail('driver', e.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
