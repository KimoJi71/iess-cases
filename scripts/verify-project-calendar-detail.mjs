#!/usr/bin/env node
/**
 * 「案件安排日曆上的工程立案單排程可被點開詳細」驗證腳本。
 * 重點：事件帶得出 stageKey、依 stageKey 取得該段排程、只更新點到的那一段階段，
 * 以及畫面層（case-arrangement.js）確實把工程案件接到編輯排程 Modal。
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

// 一筆工程案件同時有「目前階段」與一段較早的歷史階段排程。
const PROJECT = {
  id: 'P1',
  projectNumber: '20260810001',
  customerName: '丁客戶',
  storeName: '丁一店',
  workCategory: '新開',
  currentStage: '現勘',
  stageDate: '2026-08-13',
  stageAssignee: '張三',
  planDate: '2026-08-13',
  planTimeStart: '09:00',
  planTimeEnd: '11:00',
  isClosed: false,
  history: [
    { stage: '立案時間', date: '2026-08-11', timeStart: '13:00', timeEnd: '14:00', assignee: '李四' },
    { stage: '現勘', date: '2026-08-13', timeStart: '09:00', timeEnd: '11:00', assignee: '張三' }
  ],
  details: { storeAddress: '台北市中山區X號', serviceLevel: 'C 保養(一年一次)', equipment: [] }
};

console.log('\n[1] 案件安排日曆只出現工程案件的「目前階段」排程');
const events = SU.getScheduledEvents([], [], [PROJECT], RANGE[0], RANGE[1], '全部');
const projEvents = events.filter(e => e.extendedProps.sourceType === 'project');
assertEq(projEvents.length, 1, '一筆工程案件只產出一個日曆事件');
const currentEv = projEvents[0];
assertEq(currentEv.extendedProps.stageKey, 'current', '該事件對應目前階段');
assertEq(currentEv.start, '2026-08-13T09:00:00', '帶的是目前階段（現勘）的時間');
assertTrue(!projEvents.some(e => e.extendedProps.stageKey === '立案時間'),
  '先前階段（立案時間）不再出現在日曆上');
assertEq(currentEv.extendedProps.sourceId, 'P1', '事件帶得出 sourceId（點擊時用來查案件）');

// 案件層級沒填 planDate 時，退回 history 裡目前階段那一筆
const NO_PLAN_DATE = Object.assign({}, PROJECT, { planDate: '', planTimeStart: '', planTimeEnd: '' });
const fallbackEvents = SU.getScheduledEvents([], [], [NO_PLAN_DATE], RANGE[0], RANGE[1], '全部');
assertEq(fallbackEvents.length, 1, '案件層級沒填排程時仍取得目前階段的排程');
assertEq(fallbackEvents[0].start, '2026-08-13T09:00:00', '退回 history 中「現勘」那一筆');

// 目前階段完全沒有排程 → 日曆上不出現
const NO_SCHEDULE = Object.assign({}, PROJECT, {
  planDate: '', planTimeStart: '', planTimeEnd: '', stageDate: '',
  history: [{ stage: '立案時間', date: '2026-08-11', timeStart: '13:00', timeEnd: '14:00', assignee: '李四' }]
});
assertEq(SU.getScheduledEvents([], [], [NO_SCHEDULE], RANGE[0], RANGE[1], '全部').length, 0,
  '目前階段尚未排程 → 不會拿先前階段來頂替');

console.log('\n[2] getProjectStageSchedule 依 stageKey 取出對應階段排程');
const curSched = SU.getProjectStageSchedule(PROJECT, 'current');
assertEq(curSched.planDate, '2026-08-13', 'current → 案件層級 planDate');
assertEq(curSched.assignee, '張三', 'current → stageAssignee');
assertEq(curSched.stage, '現勘', 'current → 目前階段名稱');
const hisSched = SU.getProjectStageSchedule(PROJECT, '立案時間');
assertEq(hisSched.planDate, '2026-08-11', '歷史階段 → history 內的日期');
assertEq(hisSched.planTimeStart, '13:00', '歷史階段 → history 內的開始時間');
assertEq(hisSched.assignee, '李四', '歷史階段 → history 內的負責人員');
assertEq(SU.getProjectStageSchedule(PROJECT, '不存在的階段').stageKey, 'current',
  '找不到階段時退回 current，不會炸掉');

console.log('\n[3] 儲存排程只改點到的那一段階段');
function applyStage(stageKey, payload) {
  let next = null, ps = null;
  SU.applyScheduleUpdate('project', 'P1', Object.assign({ stageKey }, payload),
    { maintenanceCases: [], cases: [], projectCases: [PROJECT], personnelStatus: [] },
    {
      setMaintenanceCases: () => {}, setCases: () => {},
      setProjectCases: (list) => { next = list[0]; },
      setPersonnelStatus: (list) => { ps = list; }
    });
  return { next, ps };
}

const edited = applyStage('立案時間', {
  planDate: '2026-08-12', planTimeStart: '15:00', planTimeEnd: '16:00', assignee: '王五'
}).next;
const editedHistory = edited.history.find(hh => hh.stage === '立案時間');
assertEq(editedHistory.date, '2026-08-12', '歷史階段的日期已更新');
assertEq(editedHistory.assignee, '王五', '歷史階段的負責人員已更新');
assertEq(edited.planDate, '2026-08-13', '非目前階段 → 案件層級 planDate 不動');
assertEq(edited.stageAssignee, '張三', '非目前階段 → stageAssignee 不動');
assertEq(edited.history.find(hh => hh.stage === '現勘').date, '2026-08-13', '其他階段不受影響');

const editedCurrent = applyStage('current', {
  planDate: '2026-08-14', planTimeStart: '08:00', planTimeEnd: '09:00', assignee: '趙六'
}).next;
assertEq(editedCurrent.planDate, '2026-08-14', '目前階段 → 案件層級 planDate 一併更新');
assertEq(editedCurrent.stageDate, '2026-08-14', '目前階段 → stageDate 一併更新');
assertEq(editedCurrent.stageAssignee, '趙六', '目前階段 → stageAssignee 一併更新');
assertEq(editedCurrent.history.find(hh => hh.stage === '現勘').assignee, '趙六',
  '目前階段的 history 也同步');
assertEq(editedCurrent.history.find(hh => hh.stage === '立案時間').date, '2026-08-11',
  '其他階段不受影響');

console.log('\n[4] 人員動向紀錄：不同階段各留一筆');
const first = applyStage('立案時間', {
  planDate: '2026-08-12', planTimeStart: '15:00', planTimeEnd: '16:00', assignee: '王五'
}).ps;
assertEq(first.length, 1, '第一段階段寫入一筆人員動向');
let both = null;
SU.applyScheduleUpdate('project', 'P1',
  { stageKey: 'current', planDate: '2026-08-14', planTimeStart: '08:00', planTimeEnd: '09:00', assignee: '趙六' },
  { maintenanceCases: [], cases: [], projectCases: [PROJECT], personnelStatus: first },
  {
    setMaintenanceCases: () => {}, setCases: () => {},
    setProjectCases: () => {}, setPersonnelStatus: (list) => { both = list; }
  });
assertEq(both.length, 2, '另一段階段不會蓋掉前一段的人員動向');

console.log('\n[5] 人員動向仍看得到工程案件，一樣只有目前階段');
const psEvents = SU.getPersonnelEvents([], [], [PROJECT], RANGE[0], RANGE[1], '全部');
assertEq(psEvents.length, 1, '人員動向也只留目前階段一筆');
assertEq(psEvents[0].extendedProps.timeRange, '09:00 ~ 11:00', '帶的是目前階段的時間區間');

console.log('\n[6] 畫面串接：日曆點擊與工程詳細區塊');
const caSrc = readFileSync(join(ROOT, 'src/features/scheduling/case-arrangement.js'), 'utf8');
assertTrue(/openEditScheduleModalRef\(props\.sourceType, props\.sourceId, props\.stageKey\)/.test(caSrc),
  '日曆點擊把 stageKey 一起傳進編輯排程 Modal');
assertTrue(!/sourceType === 'repair' \|\| props\.sourceType === 'maintenance'/.test(caSrc),
  '不再只允許叫修／保養被點開');
assertTrue(/renderProjectScheduleDetails/.test(caSrc), '有工程立案單的詳細內容區塊');
assertTrue(/ProjectDetailView\.renderSections/.test(caSrc),
  '工程詳細沿用「編輯工程立案」頁的共用排版，不另刻一份');
assertTrue(/getProjectStageSchedule/.test(caSrc), 'Modal 依 stageKey 帶入該段排程');
assertTrue(/stageKey: item\.stageKey/.test(caSrc), '確認排程時把 stageKey 帶進 payload');

console.log('\n[7] 共用排版：兩處畫面都走同一組唯讀組件');
const pfSrc = readFileSync(join(ROOT, 'src/features/project/project-form.js'), 'utf8');
assertTrue(/window\.ProjectDetailView\s*=/.test(pfSrc), 'project-form.js 對外提供 ProjectDetailView');
assertTrue(/renderSections: renderProjectViewSections/.test(pfSrc), '匯出唯讀三段式版面');
['projectCaseFieldsView', 'projectEquipmentTable', 'projectStageList', 'projectStageViewFields']
  .forEach(function (fn) {
    const uses = pfSrc.split(fn + '(').length - 1;
    assertTrue(uses >= 2, `${fn} 同時被「編輯工程立案」頁與共用版面使用`, `出現 ${uses} 次呼叫`);
  });
assertTrue(/'1\. 案件資料'[\s\S]*'2\. 設備資料'[\s\S]*'3\. 工程項目進度'/.test(pfSrc),
  '版面維持案件資料／設備資料／工程項目進度三段');

console.log(`\n通過 ${passed}／失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
