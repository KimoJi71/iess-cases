#!/usr/bin/env node
/**
 * 「日曆可切換週／日檢視，時間軸涵蓋 24 小時且預設捲到 08:00」驗證腳本。
 * 以假的 FullCalendar 攔截建構選項，檢查 calendar-bridge 傳進去的設定與
 * gotoRange 的焦點日期行為；同時確認兩個日曆頁面都把 focusDate 接上。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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

const calls = { gotoDate: [], setOption: [] };
let captured = null;

class FakeCalendar {
  constructor(el, opts) { captured = opts; }
  render() {}
  destroy() {}
  removeAllEvents() {}
  addEvent() {}
  getEvents() { return []; }
  gotoDate(d) { calls.gotoDate.push(d); }
  setOption(k, v) { calls.setOption.push([k, v]); }
}

const sandbox = {
  console,
  document: { createElement: () => ({ }) },
  FullCalendar: { Calendar: FakeCalendar }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(ROOT, 'src/features/scheduling/calendar-bridge.js'), 'utf8'),
  sandbox, { filename: 'calendar-bridge.js' });

const Bridge = sandbox.IESS.CalendarBridge;

console.log('\n[1] 建構選項');
const bridge = Bridge.createBridge({}, {
  rangeStart: '2026-08-10',
  rangeEnd: '2026-08-16',
  focusDate: '2026-08-13'
});

assertTrue(
  String(captured.headerToolbar.right).includes('timeGridWeek') &&
  String(captured.headerToolbar.right).includes('timeGridDay'),
  '工具列有週／日切換鈕', captured.headerToolbar.right
);
assertEq(captured.buttonText.week, '週', '週按鈕文字');
assertEq(captured.buttonText.day, '日', '日按鈕文字');
assertEq(captured.slotMinTime, '00:00:00', '時間軸從 00:00 起');
assertEq(captured.slotMaxTime, '24:00:00', '時間軸到 24:00 止');
assertEq(captured.scrollTime, '08:00:00', '預設捲動到 08:00');
assertTrue(captured.height !== 'auto' && !!captured.height,
  '高度為固定值才會有捲軸', String(captured.height));
assertEq(captured.firstDay, 1, '週檢視以週一起算');
assertTrue(typeof captured.dayMaxEvents === 'number' && captured.dayMaxEvents > 0,
  '整天列有筆數上限，不會撐破固定高度', String(captured.dayMaxEvents));
assertEq(captured.moreLinkText(3), '+3 筆', '「更多」連結文字');

console.log('\n[2] 焦點日期');
assertEq(calls.gotoDate[0], '2026-08-13', '初始化停在 focusDate');
calls.gotoDate.length = 0;
bridge.gotoRange('2026-08-17', '2026-08-23', '2026-08-19');
assertEq(calls.gotoDate[0], '2026-08-19', 'gotoRange 帶 focusDate 時停在該天');
calls.gotoDate.length = 0;
bridge.gotoRange('2026-08-17', '2026-08-23');
assertEq(calls.gotoDate[0], '2026-08-17', '沒帶 focusDate 時退回區間起日');

console.log('\n[3] 畫面層接線');
for (const rel of [
  'src/features/scheduling/case-arrangement.js',
  'src/features/scheduling/personnel-movement.js'
]) {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  const name = rel.split('/').pop();
  assertTrue(/focusDate: appliedCal\.date/.test(src), `${name} 建立日曆時帶入 focusDate`);
  assertTrue(/gotoRange\(appliedCal\.start, appliedCal\.end, appliedCal\.date\)/.test(src),
    `${name} 查詢後同步焦點日期`);
  assertTrue(/date: calDate/.test(src), `${name} 查詢時記下所選日期`);
}

console.log(`\n通過 ${passed} 項，失敗 ${failed} 項`);
process.exit(failed ? 1 : 0);
