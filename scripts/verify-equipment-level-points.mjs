#!/usr/bin/env node
/**
 * Verification for equipment level (設備等級) lookup and bonus eligibility.
 * Loads the browser IIFE modules in Node with minimal stubs.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let passed = 0;
let failed = 0;

function pass(name, detail) {
  passed += 1;
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail) {
  failed += 1;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function assertEq(actual, expected, name) {
  if (actual !== expected) {
    fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    return false;
  }
  pass(name, JSON.stringify(actual));
  return true;
}

const sandbox = {
  console,
  // 必須與 src/data/options.js 的 EQUIPMENT_LEVEL_OPTIONS 一致
  EQUIPMENT_LEVEL_OPTIONS: ['基礎設備', '增額設備'],
  EQUIP_MODEL_CATALOG: {},
  EQUIP_MODEL_OPTIONS: [],
  EQUIP_CATEGORY_OPTIONS: [],
  EQUIP_BRAND_OPTIONS: [],
  EQUIP_NAME_OPTIONS: [],
  EQUIP_STATUS_OPTIONS: ['運轉', '轉汰換', '已汰換']
};
sandbox.window = sandbox;
vm.createContext(sandbox);

function load(relPath) {
  vm.runInContext(readFileSync(join(ROOT, relPath), 'utf8'), sandbox, {
    filename: relPath.split('/').pop()
  });
}

load('src/features/permissions/device-category-utils.js');

const DCU = sandbox.window.DeviceCategoryUtils;

const cats = [
  { id: 'DCAT1', category: '分離式', brand: '日立', deviceName: '分離式冷氣',
    specification: '3.5匹', model: 'RAS-100', refrigerant: 'R410A',
    powerSource: '220V', equipmentLevel: '基礎設備' },
  { id: 'DCAT2', category: '分離式', brand: '大金', deviceName: '吊隱式冷氣',
    specification: '4.0匹', model: 'FXYP100', refrigerant: 'R32',
    powerSource: '220V', equipmentLevel: '增額設備' },
  // 舊資料：完全沒有 equipmentLevel 鍵
  { id: 'DCAT3', category: '冰水', brand: '三菱重工', deviceName: '冰水主機',
    specification: '5.0匹', model: 'PA-063', refrigerant: 'R134a',
    powerSource: '380V' }
];

console.log('getEquipmentLevel');
assertEq(DCU.getEquipmentLevel(cats[0]), '基礎設備', '明確為基礎設備');
assertEq(DCU.getEquipmentLevel(cats[1]), '增額設備', '明確為增額設備');
assertEq(DCU.getEquipmentLevel(cats[2]), '基礎設備', '舊資料無欄位視為基礎設備');
assertEq(DCU.getEquipmentLevel({ equipmentLevel: '' }), '基礎設備', '空字串視為基礎設備');
assertEq(DCU.getEquipmentLevel({ equipmentLevel: '  ' }), '基礎設備', '空白字串視為基礎設備');
assertEq(DCU.getEquipmentLevel(null), '基礎設備', 'null 視為基礎設備');

console.log('\ngetEquipmentLevelByModel');
assertEq(DCU.getEquipmentLevelByModel(cats, 'FXYP100'), '增額設備', '依型號查到增額設備');
assertEq(DCU.getEquipmentLevelByModel(cats, 'RAS-100'), '基礎設備', '依型號查到基礎設備');
assertEq(DCU.getEquipmentLevelByModel(cats, 'PA-063'), '基礎設備', '舊資料型號視為基礎設備');
assertEq(DCU.getEquipmentLevelByModel(cats, '不存在的型號'), '基礎設備', '查無型號視為基礎設備');
assertEq(DCU.getEquipmentLevelByModel(cats, ''), '基礎設備', '型號為空視為基礎設備');
assertEq(DCU.getEquipmentLevelByModel([], 'FXYP100'), '基礎設備', '分類清單為空視為基礎設備');

console.log('\nnormalizeRecord / recordKey');
const normalized = DCU.normalizeRecord(cats[1]);
assertEq(normalized.equipmentLevel, '增額設備', 'normalizeRecord 保留 equipmentLevel');
assertEq(normalized.model, 'FXYP100', 'normalizeRecord 保留七欄');
assertEq(DCU.normalizeRecord(cats[2]).equipmentLevel, '', 'normalizeRecord 對缺欄位輸出空字串');

const baseRec = Object.assign({}, cats[0]);
const sameButAddOn = Object.assign({}, cats[0], { equipmentLevel: '增額設備' });
assertEq(
  DCU.findDuplicate([baseRec], sameButAddOn, null), true,
  '七欄相同、等級不同仍判定為重複'
);
const diffModel = Object.assign({}, cats[0], { model: 'OTHER-1' });
assertEq(
  DCU.findDuplicate([baseRec], diffModel, null), false,
  '型號不同不算重複'
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
