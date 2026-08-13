#!/usr/bin/env node
/**
 * 「只填預約日期、未填預約時間 → 案件以整天事件排在當天最上方」驗證腳本。
 * 以 node:vm 載入 IIFE 模組做純函式驗證，另加日曆設定的原始碼檢查。
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

const sandbox = { console, SERVICE_LEVEL_OPTIONS: [] };
sandbox.window = sandbox;
vm.createContext(sandbox);
function load(relPath) {
  vm.runInContext(readFileSync(join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath.split('/').pop()
  });
}
load('src/features/customer/customer-utils.js');
load('src/features/customer/store-utils.js');
load('src/features/permissions/service-level-utils.js');
load('src/features/scheduling/schedule-utils.js');
const SU = sandbox.ScheduleUtils;

const RANGE = ['2026-08-10', '2026-08-16'];

// 同一天三筆：保養有時間、保養只有日期、維修只有日期。
const MAINTENANCE = [
  { id: 'M1', customerName: '甲客戶', storeName: '甲一店', assignee: '張三',
    planDate: '2026-08-12', planTimeStart: '14:00', planTimeEnd: '16:00' },
  { id: 'M2', customerName: '乙客戶', storeName: '乙一店', assignee: '張三',
    planDate: '2026-08-12', planTimeStart: '', planTimeEnd: '' }
];
const REPAIRS = [
  { id: 'R1', customerName: '丙客戶', storeName: '丙一店', assignee: '張三',
    workCategory: '維修', expectedDate: '2026-08-12', expectedTimeStart: '' }
];
const PROJECTS = [
  { id: 'P1', customerName: '丁客戶', storeName: '丁一店', workCategory: '工程',
    stageAssignee: '張三', planDate: '2026-08-13', planTimeStart: '', planTimeEnd: '' }
];

console.log('\n[1] 排程蒐集：只填日期的案件不再被濾掉');
const rows = SU.getPersonnelRows(MAINTENANCE, REPAIRS, PROJECTS, RANGE[0], RANGE[1], '全部');
assertEq(rows.length, 4, '四筆案件全部進入排程清單');
assertTrue(rows.some(r => r.sourceId === 'M2'), '只填日期的保養案件有進清單');
assertTrue(rows.some(r => r.sourceId === 'R1'), '只填日期的維修案件有進清單');
assertTrue(rows.some(r => r.sourceId === 'P1'), '只填日期的工程案件有進清單');

console.log('\n[2] 沒有時間的案件，時間欄位一律留空');
const m2 = rows.find(r => r.sourceId === 'M2');
assertEq(m2.timeStart, '', 'timeStart 為空字串');
assertEq(m2.timeEnd, '', 'timeEnd 不回填成 start');

console.log('\n[3] 排序：同一天的整天案件排在有時間的案件之前');
const day12 = rows.filter(r => r.date === '2026-08-12').map(r => r.sourceId);
assertEq(JSON.stringify(day12.slice(0, 2).sort()), JSON.stringify(['M2', 'R1']),
  '當天前兩筆是兩筆整天案件');
assertEq(day12[day12.length - 1], 'M1', '有時間的案件排在最後');

console.log('\n[4] 日曆事件：沒有時間 → allDay 事件');
const events = SU.getScheduledEvents(MAINTENANCE, REPAIRS, PROJECTS, RANGE[0], RANGE[1], '全部');
assertEq(events.length, 4, '四筆案件都產出日曆事件');
const evM2 = events.find(e => e.extendedProps.sourceId === 'M2');
assertEq(evM2.allDay, true, '整天案件 allDay 為 true');
assertEq(evM2.start, '2026-08-12', 'start 是純日期字串（FullCalendar 據此排進整天列）');
assertEq(evM2.end, undefined, '整天案件不帶 end');
const evM1 = events.find(e => e.extendedProps.sourceId === 'M1');
assertEq(evM1.allDay, false, '有時間的案件 allDay 為 false');
assertEq(evM1.start, '2026-08-12T14:00:00', '有時間的案件 start 帶時間');
assertEq(evM1.end, '2026-08-12T16:00:00', '有時間的案件 end 帶時間');

console.log('\n[5] 人員動向事件與清單時間欄');
const psEvents = SU.getPersonnelEvents(MAINTENANCE, REPAIRS, PROJECTS, RANGE[0], RANGE[1], '全部');
const psM2 = psEvents.find(e => e.id === 'ps-maintenance-M2');
assertEq(psM2.allDay, true, '人員動向的整天事件 allDay 為 true');
assertEq(psM2.extendedProps.timeRange, '整天', '整天事件的 timeRange 顯示「整天」');
const psM1 = psEvents.find(e => e.id === 'ps-maintenance-M1');
assertEq(psM1.extendedProps.timeRange, '14:00 ~ 16:00', '有時間的事件仍顯示時間區間');
assertEq(SU.formatScheduleTimeRange('', ''), '整天', 'formatScheduleTimeRange 空時間 → 整天');
assertEq(SU.formatScheduleTimeRange('09:00', '09:00'), '09:00', '起訖相同只顯示一個時間');
assertEq(SU.formatTimeRange('', ''), '', 'formatTimeRange 維持原本語意（空字串）');

console.log('\n[6] 案件列表派工狀態：整天案件視為已派工');
load('src/features/repair/case-assignee-utils.js');
load('src/features/repair/case-status.js');
const CS = sandbox.IESS.caseStatus;
const dispatchOf = (c) => CS.getCaseListDispatchStatus(c);
assertEq(dispatchOf({ assignee: '張三', expectedDate: '2026-08-12', expectedTimeStart: '14:00' }),
  '已派工', '有人員＋日期＋時間 → 已派工');
assertEq(dispatchOf({ assignee: '張三', expectedDate: '2026-08-12', expectedTimeStart: '' }),
  '已派工', '有人員＋只有日期（整天）→ 已派工');
assertEq(dispatchOf({ assignee: '張三', expectedDate: '', expectedTimeStart: '' }),
  '未派工', '有人員但沒日期 → 未派工');
assertEq(dispatchOf({ assignee: '案件待辦', expectedDate: '2026-08-12', expectedTimeStart: '' }),
  '未派工', '沒有正式組別 → 未派工');
assertEq(dispatchOf({ assignee: '張三', expectedDate: '2026-08-12', processStatus: '案件完成' }),
  '已完成', '已完成的案件優先顯示已完成');

console.log('\n[7] 日曆設定與畫面串接');
const bridgeSrc = readFileSync(join(ROOT, 'src/features/scheduling/calendar-bridge.js'), 'utf8');
assertTrue(/allDaySlot:\s*true/.test(bridgeSrc), '日曆已開啟整天列 allDaySlot');
assertTrue(/allDayText:\s*'整天'/.test(bridgeSrc), '整天列標籤為「整天」');
assertTrue(/info\.allDay/.test(bridgeSrc), '外部拖曳有依 info.allDay 分流');
const pmSrc = readFileSync(join(ROOT, 'src/features/scheduling/personnel-movement.js'), 'utf8');
assertTrue(/formatScheduleTimeRange\(row\.timeStart, row\.timeEnd\)/.test(pmSrc),
  '人員動向清單時間欄改用 formatScheduleTimeRange');

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
