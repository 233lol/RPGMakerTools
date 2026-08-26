#!/usr/bin/env node
/**
 * fix-greenworks.js — 通用工具：屏蔽 RPG Maker MV/MZ 游戏中的 Greenworks / Steamworks
 *
 * 功能：
 *   1. 确保 js/plugins.js 中名字含 "greenworks" 的插件保持启用
 *      （事件脚本会直接调用 OrangeGreenworks，禁用插件反而会导致 ReferenceError）
 *   2. 将 greenworks.js 替换为无害的空实现：插件加载它后初始化失败但不会崩溃，
 *      自动走插件自带的无操作降级路径（成就、统计等调用全部安全返回）
 *   3. 修复 OrangeGreenworks.js 中 "store is not defined" 的二次崩溃 bug
 *
 * 用法：
 *   node fix-greenworks.js            应用补丁（自动定位当前/上级目录中的游戏）
 *   node fix-greenworks.js --restore  还原所有修改
 *   node fix-greenworks.js <游戏目录> [ --restore ]
 *
 * 说明：首次打补丁时会自动备份为 *.bak，重复运行不会覆盖备份。
 *       处理其他游戏时，把本脚本(或整个文件夹)复制过去运行即可。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const MARKER = '/* [blocked by fix-greenworks] */';
const RESTORE = process.argv.includes('--restore');

/** 判断某目录是否为游戏根目录（含 MV/MZ 的典型文件） */
function looksLikeGameDir(dir) {
  return ['www/js/plugins.js', 'js/plugins.js', 'www/greenworks.js', 'greenworks.js']
    .some(rel => fs.existsSync(path.join(dir, ...rel.split('/'))));
}

/** 定位游戏根目录：优先使用命令行参数；否则从当前目录逐级向上查找 */
function findGameDir() {
  const argDir = process.argv.slice(2).find(a => !a.startsWith('--'));
  if (argDir) {
    const resolved = path.resolve(argDir);
    if (!looksLikeGameDir(resolved)) {
      console.error('错误：指定的目录不像 RPG Maker 游戏目录：' + resolved);
      process.exit(1);
    }
    return resolved;
  }
  let dir = process.cwd();
  for (;;) {
    if (looksLikeGameDir(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  console.error('错误：未能在当前目录及上级目录中找到 RPG Maker 游戏（缺少 js/plugins.js 或 greenworks.js）。');
  console.error('请切换到游戏目录后运行，或指定目录：node fix-greenworks.js <游戏目录>');
  process.exit(1);
}

const gameDir = findGameDir();

function firstExisting(paths) {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** 在 <dir>/ 和 <dir>/www/ 两级目录中查找文件 */
function findIn(dir, rels) {
  return firstExisting([path.join(dir, 'www', ...rels), path.join(dir, ...rels)]);
}

/** 备份：只在备份不存在时创建，保留最初原始版本 */
function backup(file) {
  const bak = file + '.bak';
  if (!fs.existsSync(bak)) fs.copyFileSync(file, bak);
}

/* ---------- 1. 确保 plugins.js 中 greenworks 系插件保持启用 ---------- */

function patchPluginsJs() {
  const pluginsJs = findIn(gameDir, ['js', 'plugins.js']);
  if (!pluginsJs) {
    console.log('  [跳过] 未找到 js/plugins.js');
    return;
  }

  if (RESTORE) {
    const bak = pluginsJs + '.bak';
    if (fs.existsSync(bak)) {
      fs.copyFileSync(bak, pluginsJs);
      console.log('  [还原] plugins.js');
    } else {
      console.log('  [跳过] plugins.js 无备份可还原');
    }
    return;
  }

  backup(pluginsJs);
  let text = fs.readFileSync(pluginsJs, 'utf8');

  // 把被误禁用的 greenworks 系插件恢复为 true，保证事件脚本可以调用全局对象
  const re = /("name"\s*:\s*"([^"]*greenworks[^"]*)"\s*,\s*"status"\s*:\s*)false/gi;
  let count = 0;
  text = text.replace(re, (m, pre, name) => {
    count++;
    console.log('  [启用] 插件 ' + name + '（配合空实现安全降级）');
    return pre + 'true';
  });

  fs.writeFileSync(pluginsJs, text, 'utf8');
  if (!count) console.log('  [信息] plugins.js 无需改动');
}

/* ---------- 2. 用空实现替换 greenworks.js ---------- */

const STUB =
  MARKER + '\n' +
  '// Greenworks 已被屏蔽。此文件是空实现，防止缺少 Steam 时报错。\n' +
  '(function () {\n' +
  '  function fail() {\n' +
  "    var cb = arguments[arguments.length - 1];\n" +
  "    if (typeof cb === 'function') cb(new Error('[fix-greenworks] Steam 已屏蔽'));\n" +
  '    return false;\n' +
  '  }\n' +
  '  module.exports = {\n' +
  "    _version: 'stub', _steam_events: {}, Utils: {},\n" +
  '    initAPI: function () { return false; },\n' +
  '    init: function () { return false; },\n' +
  '    isSteamRunning: function () { return false; },\n' +
  '    isSubscribedApp: function () { return false; },\n' +
  '    getAppId: function () { return 0; },\n' +
  "    getSteamId: function () { return { screenName: 'Player', accountId: '0', staticAccountId: '0', isValid: false }; },\n" +
  "    getCurrentUILanguage: function () { return 'english'; },\n" +
  "    getCurrentGameLanguage: function () { return 'english'; },\n" +
  '    getAchievementNames: function () { return []; },\n' +
  '    getAchievedCount: function () { return 0; },\n' +
  '    getAchievementCount: function () { return 0; },\n' +
  '    isAchieved: function () { return false; },\n' +
  '    getStatInt: function () { return 0; },\n' +
  '    getStatFloat: function () { return 0; },\n' +
  "    readTextFromFile: function () { return ''; },\n" +
  '    fileExists: function () { return false; },\n' +
  '    activateAchievement: fail, clearAchievement: fail, setStat: fail,\n' +
  '    storeStats: fail, saveTextToFile: fail, deleteFile: fail,\n' +
  '    saveFilesToCloud: fail, fileShare: fail\n' +
  '  };\n' +
  '})();\n';

function patchGreenworksJs() {
  const gwJs = findIn(gameDir, ['greenworks.js']);
  if (!gwJs) {
    console.log('  [跳过] 未找到 greenworks.js');
    return;
  }
  if (!RESTORE) {
    const cur = fs.readFileSync(gwJs, 'utf8');
    if (cur.startsWith(MARKER)) {
      console.log('  [信息] greenworks.js 已是空实现');
      return;
    }
    backup(gwJs);
    fs.writeFileSync(gwJs, STUB, 'utf8');
    console.log('  [屏蔽] ' + gwJs + ' （原版已备份为 .bak）');
  } else {
    const bak = gwJs + '.bak';
    if (fs.existsSync(bak)) {
      fs.copyFileSync(bak, gwJs);
      console.log('  [还原] greenworks.js');
    } else {
      console.log('  [跳过] greenworks.js 无备份可还原');
    }
  }
}

/* ---------- 3. 修复 OrangeGreenworks.js 的 store(e) 崩溃 bug ---------- */

function patchOrangePlugin() {
  const ogJs = findIn(gameDir, ['js', 'plugins', 'OrangeGreenworks.js']);
  if (!ogJs) {
    console.log('  [跳过] 未找到 OrangeGreenworks.js');
    return;
  }
  let text = fs.readFileSync(ogJs, 'utf8');

  if (RESTORE) {
    const fixed = text.replace(/^(\s*)\/\/ store\((\w+)\); \[blocked by fix-greenworks\]\s*$/gm, '$1store($2);');
    if (fixed !== text) {
      fs.writeFileSync(ogJs, fixed, 'utf8');
      console.log('  [还原] OrangeGreenworks.js');
    } else {
      console.log('  [信息] OrangeGreenworks.js 未被修改过');
    }
    return;
  }

  const re = /^(\s*)store\((\w+)\);\s*$/gm;
  if (!re.test(text)) {
    console.log('  [信息] OrangeGreenworks.js 无 store(e) bug 或已修复');
    return;
  }
  backup(ogJs);
  text = text.replace(re, '$1// store($2); [blocked by fix-greenworks]');
  fs.writeFileSync(ogJs, text, 'utf8');
  console.log('  [修复] OrangeGreenworks.js 的 store(e) 二次崩溃 bug');
}

/* ---------- 主流程 ---------- */

console.log((RESTORE ? '还原' : '屏蔽') + ' Greenworks -> ' + gameDir);
patchPluginsJs();
patchGreenworksJs();
patchOrangePlugin();
console.log(RESTORE ? '完成，所有修改已还原。' : '完成。Greenworks 已彻底屏蔽，可正常进入游戏。');
