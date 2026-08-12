#!/usr/bin/env node
/**
 * 「工程項目進度加上完成狀態」驗證腳本。
 * 重點：階段資料讀得出 done（舊資料視為未完成）、存檔會寫回 done、
 * 只勾完成而未填日期的階段也要留在 history，以及唯讀／列表兩處的顏色區分。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0, failed = 0;
const pass = (n, d) => { passed++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, d) => { failed++; console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`); };
function assertTrue(cond, name, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

const formSrc = readFileSync(join(ROOT, 'src/features/project/project-form.js'), 'utf8');
const listSrc = readFileSync(join(ROOT, 'src/features/project/project-list.js'), 'utf8');
const seedSrc = readFileSync(join(ROOT, 'src/data/seed.js'), 'utf8');

console.log('\n[1] 階段資料層');
assertTrue(
  /done: !!\(existing && existing\.done\)/.test(formSrc),
  'projectStagesData 讀出 done',
  '舊資料沒有 done 欄位時回 false'
);
assertTrue(
  /stagesData\[stage\]\.date \|\| stagesData\[stage\]\.assignee \|\| stagesData\[stage\]\.done/.test(formSrc),
  '只勾完成、未填日期的階段仍會存進 history'
);
assertTrue(
  /done: !!stagesData\[stage\]\.done/.test(formSrc),
  '存檔時寫回 done'
);

console.log('\n[2] 編輯與唯讀版面');
assertTrue(
  /handleStageChange\(stage, 'done', e\.target\.checked\)/.test(formSrc),
  '編輯畫面用核取方塊切換完成狀態'
);
assertTrue(
  /function projectStageDoneBadge/.test(formSrc) &&
  /projectStageDoneBadge\(stagesData\[stage\]\.done\)/.test(formSrc),
  '唯讀畫面（查看案件／日曆詳細）顯示完成狀態徽章'
);
assertTrue(
  /lg:grid-cols-5/.test(formSrc) && !/lg:grid-cols-4 gap-4/.test(formSrc),
  '階段欄位由四欄擴為五欄'
);
assertTrue(
  /done\s*\n?\s*\? 'bg-green-50 border-green-200'/.test(formSrc),
  '已完成的階段列改為綠底'
);
assertTrue(
  /highlighted \? 'bg-indigo-50 border-indigo-300' : 'bg-gray-50 border-gray-200'/.test(formSrc),
  '未完成時仍保留原本灰底與「本次排程階段」的 indigo 底'
);

console.log('\n[3] 列表呈現');
assertTrue(
  /done \? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'/.test(listSrc),
  '列表階段格子：已完成綠底、未完成琥珀底'
);
assertTrue(
  /done \? Icons\.CheckCircle/.test(listSrc),
  '已完成另加勾勾圖示，不只靠顏色辨識'
);
assertTrue(
  /'flex items-center justify-center text-gray-300'/.test(listSrc),
  '無資料的階段維持灰色「-」'
);

console.log('\n[4] 種子資料');
const segStart = seedSrc.indexOf('const INITIAL_PROJECT_CASES');
const segEnd = seedSrc.indexOf('const INITIAL_PERSONNEL_STATUS');
const projectSeg = seedSrc.slice(segStart, segEnd);
const doneCount = (projectSeg.match(/done: true/g) || []).length;
assertTrue(doneCount > 0, '工程案件種子資料已標記已完成階段', `${doneCount} 筆`);

// 未結案案件的「目前階段」本身不應被標成已完成。
const firstCase = projectSeg.slice(projectSeg.indexOf('currentStage:'));
const currentStageBlock = firstCase.slice(
  firstCase.indexOf("stage: '現勘'"),
  firstCase.indexOf('comments:')
);
assertTrue(
  !/done: true/.test(currentStageBlock),
  '未結案案件的目前階段仍為未完成'
);

console.log(`\n${failed === 0 ? '✅ 全部通過' : '❌ 有失敗項目'}：${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
