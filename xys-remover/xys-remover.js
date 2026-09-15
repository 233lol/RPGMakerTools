#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const nodeCrypto = require('crypto');

const KNOWN_AES_KEYS = ['_!=Yxy@F/SC?ngT-'];
const AD_KEYWORDS = ['XYOU', 'xyou', 'zijietiaodong', 'api/v1/config', 'KEYSWITCH', 'INSERTA', '游社'];
const DECRYPTOR_MARKERS = ['CryptoJS', 'XMLHttpRequest', 'loadDataFile', '_0x', 'CommonEvents'];
const GUARD_MARKERS = ['customVariables', 'XYOU', 'SceneManager.exit', 'zijietiaodong'];
const AD_EVENT_NAMES = [/XYOU/i, /游社/];
const AD_EVENT_CONTENT = [/XYOU/i, /xyou/i, /zijietiaodong/i, /游社/];
// Known standalone ad-injector plugin names. These are safe to delete outright
// when no clean template matches.
const AD_CORE_PLUGIN_NAMES = [/^ActorCommand$/i];

const toolDir = __dirname;
const CLEAN_ACTOR_COMMAND = path.join(toolDir, 'ActorCommand.clean.js');

let _pluginsRef = null;
let _backupDir = null;
const _backedUp = new Set();

function log(msg) { process.stdout.write(msg + '\n'); }

// Creates the backup directory lazily and copies a file into it before it is
// modified or deleted. Safe to call multiple times for the same file.
function backupBefore(gameDir, relPath) {
    if (_backedUp.has(relPath)) return;
    const src = path.join(gameDir, relPath);
    if (!fs.existsSync(src)) { _backedUp.add(relPath); return; }
    if (!_backupDir) {
        _backupDir = path.join(gameDir, '_backup_xyou_' + new Date().toISOString().replace(/[:.]/g, '-'));
        fs.mkdirSync(_backupDir, { recursive: true });
    }
    const dst = path.join(_backupDir, relPath);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    _backedUp.add(relPath);
}

function readUtf8(p) { return fs.readFileSync(p, 'utf8'); }
function writeUtf8(p, content) { fs.writeFileSync(p, content, 'utf8'); }

function serializePlugins(plugins) {
    return 'var $plugins = ' + JSON.stringify(plugins, null, 2) + ';\n';
}

// Rewrites js/plugins.js as a clean, plain $plugins assignment built from the
// parsed plugin list. Used when the original plugins.js is obfuscated/dynamic
// (e.g. plugin names are built at runtime), which makes in-place edits impossible.
function rewritePluginsFile(gameDir) {
    if (!_pluginsRef) return false;
    writeUtf8(path.join(gameDir, 'js', 'plugins.js'), serializePlugins(_pluginsRef));
    return true;
}

function walkEvents(root, cb) {
    if (!root || typeof root !== 'object') return;
    if (Array.isArray(root.list)) cb(root.list);
    for (const k of Object.keys(root)) {
        const v = root[k];
        if (Array.isArray(v)) { for (const x of v) walkEvents(x, cb); }
        else if (v && typeof v === 'object') walkEvents(v, cb);
    }
}

function makeStub(name) {
    const handler = {
        get(target, prop) {
            if (prop in target) return target[prop];
            if (prop === Symbol.toPrimitive) return () => 0;
            if (prop === 'toString') return () => 'stub:' + name;
            if (prop === 'length') return 0;
            if (prop === 'name') return name;
            if (prop === 'then') return undefined;
            if (prop === 'constructor') return Function;
            return makeStub(name + '.' + String(prop));
        },
        set(t, p, v) {
            if (typeof p === 'string' && !p.startsWith('__set_')) t[p] = v;
            return true;
        },
        apply() { return makeStub(name); },
        construct() { return makeStub(name); },
    };
    return new Proxy(function () { return makeStub(name); }, handler);
}

function makeCryptoJS() {
    const Wa = (buf, str) => ({
        _buf: buf,
        _str: str,
        toString(enc) { return enc && enc.Utf8 ? (str !== undefined ? str : buf.toString('utf8')) : (buf ? buf.toString('binary') : String(str)); }
    });
    const aesDecrypt = (ct, keyWa) => {
        let keyBuf = keyWa && keyWa._buf ? keyWa._buf : (keyWa && keyWa._str !== undefined ? Buffer.from(keyWa._str, 'utf8') : Buffer.from(String(keyWa), 'utf8'));
        let ctBuf = typeof ct === 'string' ? Buffer.from(ct, 'base64') : (ct && ct._buf ? ct._buf : Buffer.from(String(ct), 'base64'));
        const alg = keyBuf.length === 16 ? 'aes-128-ecb' : (keyBuf.length === 24 ? 'aes-192-ecb' : 'aes-256-ecb');
        const d = nodeCrypto.createDecipheriv(alg, keyBuf, null);
        const out = Buffer.concat([d.update(ctBuf), d.final()]);
        return Wa(out, out.toString('utf8'));
    };
    return {
        enc: {
            Utf8: {
                parse: s => Wa(Buffer.from(s, 'utf8'), s),
                stringify: wa => wa._str !== undefined ? wa._str : (wa._buf ? wa._buf.toString('utf8') : String(wa))
            },
            Latin1: {
                parse: s => Wa(Buffer.from(s, 'latin1'), s),
                stringify: wa => wa._buf ? wa._buf.toString('latin1') : wa._str
            },
            Base64: {
                parse: s => Wa(Buffer.from(s, 'base64'), null),
                stringify: wa => wa._buf ? wa._buf.toString('base64') : ''
            }
        },
        AES: { decrypt: aesDecrypt },
        mode: { ECB: {} },
        pad: { Pkcs7: {} },
        lib: { WordArray: Wa }
    };
}

function buildSandbox(gameDir) {
    class XHRStub {
        constructor() {
            this.status = 200;
            this.responseText = '';
            this.response = '';
            this.readyState = 4;
            this._url = '';
        }
        open(m, u) { this._url = u; }
        overrideMimeType() {}
        setRequestHeader() {}
        send() {
            const url = this._url;
            if (url && url.startsWith('data/')) {
                const fp = path.join(gameDir, url);
                try { this.responseText = fs.readFileSync(fp, 'utf8'); this.response = this.responseText; }
                catch (e) { this.status = 404; }
            }
            if (this.onload) setTimeout(() => { try { this.onload(); } catch (e) {} }, 0);
        }
        abort() {}
    }

    const sandbox = {
        console,
        XMLHttpRequest: XHRStub,
        Uint8Array, Int32Array, Uint32Array, Float32Array, ArrayBuffer, Buffer, DataView,
        String, Number, Math, JSON, Date, RegExp, Array, Object, Boolean,
        parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        setInterval: (fn, ms) => setInterval(fn, ms),
        clearTimeout, clearInterval,
        Promise, Symbol, Error, TypeError, RangeError, SyntaxError, EvalError, Proxy, Reflect,
        navigator: { userAgent: 'nwjs', platform: 'Win32', language: 'zh', onLine: true, appVersion: '', cookieEnabled: true, hardwareConcurrency: 4 },
        location: { href: 'file:///game/index.html', protocol: 'file:', host: '', hostname: '', pathname: '/index.html', search: '', hash: '' },
        screen: { width: 1280, height: 720, availWidth: 1280, availHeight: 720 },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {}, key: () => null, get length() { return 0; } },
        sessionStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {}, key: () => null, get length() { return 0; } },
        history: { pushState() {}, replaceState() {}, back() {}, forward() {} },
        Image: function () { return { set src(v) {}, set onload(v) {}, style: {} }; },
        Event: function () {}, CustomEvent: function () { return {}; }, KeyboardEvent: function () { return {}; },
        DOMParser: function () { return { parseFromString: () => ({ querySelectorAll: () => [], body: { appendChild() {} } }) }; },
        MutationObserver: function () { return { observe() {}, disconnect() {} }; },
        requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
        performance: { now: () => Date.now() },
        fetch: () => new Promise(() => {}),
        Blob: function () {}, FileReader: function () { return {}; },
        URL: function () { return {}; }, URLSearchParams: function () { return {}; },
        Audio: function () { return { play: () => Promise.resolve(), pause() {} }; },
        WebSocket: function () { return { send() {}, close() {} }; },
        crypto: { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; } },
        TextEncoder, TextDecoder,
        CryptoJS: makeCryptoJS(),
    };

    for (const g of ['Utils', 'JsonEx', 'PluginManager', 'PluginManagerEx', 'SceneManager', 'Graphics',
        'Scene_Base', 'Scene_Boot', 'Scene_Title', 'Scene_Map', 'Scene_Battle', 'Scene_Menu', 'Scene_Load', 'Scene_Save',
        'Scene_Item', 'Scene_Skill', 'Scene_Equip', 'Scene_Status', 'Scene_Options', 'Scene_Shop', 'Scene_Gameover',
        'Window_Base', 'Window_Message', 'Window_Selectable', 'Window_Command', 'Window_HorzCommand', 'Window_MenuCommand',
        'Sprite', 'Bitmap', 'RPG', 'Game_Interpreter', 'Game_Map', 'Game_Event', 'Game_CharacterBase', 'Game_Player',
        'Game_Actor', 'Game_Enemy', 'Game_Party', 'Game_Troop', 'Game_Action', 'Game_Item', 'Game_Switches',
        'Game_Variables', 'Game_SelfSwitches', 'Game_Screen', 'Game_Picture', 'Game_Timer', 'Game_Message',
        'Game_System', 'Game_Temp', 'Input', 'AudioManager', 'StorageManager', 'ImageManager', 'SoundManager',
        'TextManager', 'BattleManager', 'ConfigManager', 'EffectManager', 'Tilemap', 'Window_Help', 'Window_BattleLog',
        'Window_ActorCommand', 'Window_SkillList', 'Window_ItemList', 'Window_EquipSlot', 'Window_ShopBuy',
        'Window_SavefileList', 'Window_TitleCommand', 'Window_GameEnd', 'Rectangle', 'Point', 'TouchInput', 'MouseInput',
        '$dataCommonEvents', '$dataSystem', '$dataActors', '$dataMap', '$plugins', '$gameSystem', '$gameMap',
        '$gamePlayer', '$gameParty', '$gameActors', '$gameTroop', '$gameTemp', '$gameSwitches', '$gameVariables',
        '$gameSelfSwitches', '$gameScreen', '$gameTimer', '$gameMessage', '$dataMapInfos', 'Imported', 'Yanfly', 'PIXI',
        'nw', 'process', 'require', 'screenX']) {
        if (!(g in sandbox)) sandbox[g] = makeStub(g);
    }

    sandbox.Utils = {
        RPGMAKER_NAME: 'MZ',
        isNwjs: () => true,
        isMobileSafari: () => false,
        isOptionValid: () => false,
        isAndroidChrome: () => false,
    };
    sandbox.window = makeStub('window');
    sandbox.global = makeStub('global');
    sandbox.self = makeStub('self');
    sandbox.document = makeStub('document');
    sandbox.document.currentScript = { src: 'file:///game/js/plugins/plugin.js' };
    sandbox.nw = makeStub('nw');
    sandbox.process = { exit: (c) => { throw new Error('process.exit called: ' + c); }, versions: { 'node-webkit': '0.99' }, mainModule: { filename: 'x' } };

    const stdLoadDataFile = function (name, src) {
        const xhr = new XHRStub();
        xhr.open('GET', 'data/' + src);
        xhr.overrideMimeType('application/json');
        xhr.onload = () => {
            if (xhr.status < 400) {
                try { sandbox[name] = JSON.parse(xhr.responseText); } catch (e) {}
            }
        };
        sandbox[name] = null;
        xhr.send();
    };
    sandbox.DataManager = {
        loadDataFile: stdLoadDataFile,
        onLoad() {},
        _databaseFiles: [],
    };
    sandbox._stdLoadDataFile = stdLoadDataFile;
    return sandbox;
}

function parsePluginsList(gameDir) {
    const pluginsJs = path.join(gameDir, 'js', 'plugins.js');
    if (!fs.existsSync(pluginsJs)) return null;
    const sb = { $plugins: [] };
    vm.createContext(sb);
    try {
        vm.runInContext(readUtf8(pluginsJs), sb, { filename: 'plugins.js' });
        _pluginsRef = sb.$plugins;
        return sb.$plugins;
    } catch (e) {
        log('  ! 无法解析 plugins.js: ' + e.message);
        return null;
    }
}

function pluginFilePath(gameDir, name) {
    return path.join(gameDir, 'js', 'plugins', name + '.js');
}

function findDecryptorCandidates(gameDir, plugins) {
    const candidates = [];
    for (const p of plugins || []) {
        if (!p.status) continue;
        const fp = pluginFilePath(gameDir, p.name);
        if (!fs.existsSync(fp)) continue;
        const code = readUtf8(fp);
        if (DECRYPTOR_MARKERS.some(m => code.includes(m))) {
            candidates.push({ name: p.name, code, fp });
        }
    }
    return candidates;
}

function tryDecryptWithPlugin(gameDir, cand) {
    return new Promise((resolve) => {
        const sandbox = buildSandbox(gameDir);
        const ctx = vm.createContext(sandbox);
        try {
            vm.runInContext(cand.code, ctx, { filename: cand.name + '.js', timeout: 30000 });
        } catch (e) {
            resolve(null);
            return;
        }
        if (sandbox.DataManager.loadDataFile === sandbox._stdLoadDataFile) {
            resolve(null);
            return;
        }
        sandbox.DataManager.loadDataFile('$dataCommonEvents', 'CommonEvents.json');
        const deadline = Date.now() + 20000;
        const poll = () => {
            let val = sandbox['$dataCommonEvents'];
            const winVal = sandbox.window['$dataCommonEvents'];
            if (winVal !== null && winVal !== undefined && winVal !== val) val = winVal;
            if (Array.isArray(val) && val.length > 0 && val[1] && typeof val[1].id === 'number') {
                resolve(val);
                return;
            }
            if (Date.now() > deadline) { resolve(null); return; }
            setTimeout(poll, 300);
        };
        setTimeout(poll, 300);
    });
}

function tryAesKeys(b64) {
    for (const key of KNOWN_AES_KEYS) {
        try {
            const d = nodeCrypto.createDecipheriv('aes-128-ecb', Buffer.from(key, 'utf8'), null);
            const out = Buffer.concat([d.update(Buffer.from(b64, 'base64')), d.final()]);
            const parsed = JSON.parse(out.toString('utf8'));
            if (Array.isArray(parsed) && parsed[1] && typeof parsed[1].id === 'number') {
                return parsed;
            }
        } catch (e) {}
    }
    return null;
}

function isEncryptedText(text) {
    const t = text.trim();
    if (t.startsWith('[') || t.startsWith('{')) return false;
    return /^[A-Za-z0-9+/=\r\n]+$/.test(t) && t.length > 100;
}

function collectAdEvents(events) {
    const hits = [];
    for (let i = 1; i < events.length; i++) {
        const e = events[i];
        if (!e) continue;
        if (AD_EVENT_NAMES.some(r => r.test(e.name || ''))) { hits.push(i); continue; }
        for (const c of e.list || []) {
            const s = JSON.stringify(c.parameters);
            if (AD_EVENT_CONTENT.some(r => r.test(s))) { hits.push(i); break; }
        }
    }
    return hits;
}

function scanMaps(gameDir, report, dryRun) {
    const dataDir = path.join(gameDir, 'data');
    if (!fs.existsSync(dataDir)) return [];
    const maps = fs.readdirSync(dataDir).filter(f => /^Map\d+\.json$/.test(f));
    const changed = [];
    for (const m of maps) {
        const fp = path.join(dataDir, m);
        let map;
        try { map = JSON.parse(readUtf8(fp)); } catch (e) { continue; }
        let modified = false;
        for (const ev of map.events || []) {
            if (!ev) continue;
            for (const page of ev.pages || []) {
                for (const c of page.list || []) {
                    const s = String(c.parameters && c.parameters[0] !== undefined ? c.parameters[0] : '');
                    if ((c.code === 355 || c.code === 655) && s.includes('_0x') && GUARD_MARKERS.some(k => s.includes(k))) {
                        c.parameters = ['0;'];
                        modified = true;
                        report.push('  地图 ' + m + ' 事件 ' + ev.id + ' [' + ev.name + ']: 防篡改脚本已清除');
                    }
                }
            }
        }
        if (modified) {
            if (!dryRun) {
                backupBefore(gameDir, 'data/' + m);
                writeUtf8(fp, JSON.stringify(map));
            }
            changed.push('data/' + m);
        }
    }
    return changed;
}

function scanPluginsForAdCore(gameDir, plugins, report, dryRun) {
    const cleanTemplate = fs.existsSync(CLEAN_ACTOR_COMMAND) ? readUtf8(CLEAN_ACTOR_COMMAND) : null;
    const changed = [];
    let pluginsJsChanged = false;
    for (const p of plugins || []) {
        if (!p.status) continue;
        const fp = pluginFilePath(gameDir, p.name);
        if (!fs.existsSync(fp)) continue;
        const code = readUtf8(fp);
        if (!AD_KEYWORDS.some(k => code.includes(k))) continue;
        report.push('  发现广告插件: ' + p.name + '.js');
        const hasCleanMatch = cleanTemplate
            && code.includes('showNewGameMessage')
            && code.includes('customButtons')
            && code.includes('buttonScale');
        if (hasCleanMatch) {
            if (!dryRun) {
                backupBefore(gameDir, 'js/plugins/' + p.name + '.js');
                writeUtf8(fp, cleanTemplate);
            }
            report.push('    已替换为干净版本 (ActorCommand 模板)');
            changed.push('js/plugins/' + p.name + '.js');
            continue;
        }
        // No clean template match. Decide whether this file is a standalone ad
        // injector that is safe to remove entirely. A genuine RPG Maker plugin
        // always carries a "/*:" header; ad injectors are headerless blobs that
        // hook the engine globally. Known ad-core plugin names are also flagged.
        const hasHeader = /\/\*:/.test(code);
        const isAdCore = AD_CORE_PLUGIN_NAMES.some(r => r.test(p.name)) || !hasHeader;
        if (isAdCore) {
            report.push('    识别为独立广告注入插件 (无插件头/已知广告核心), 将禁用并删除');
            if (!dryRun) {
                backupBefore(gameDir, 'js/plugins/' + p.name + '.js');
                backupBefore(gameDir, 'js/plugins.js');
                p.status = false;
                if (rewritePluginsFile(gameDir)) pluginsJsChanged = true;
                try { fs.unlinkSync(fp); } catch (e) {}
                changed.push('js/plugins/' + p.name + '.js');
            }
        } else {
            report.push('    警告: 无匹配的干净模板, 未自动处理, 请手动处理该插件');
        }
    }
    if (pluginsJsChanged) changed.push('js/plugins.js');
    return changed;
}

function setPluginStatus(gameDir, name, status, report) {
    const fp = path.join(gameDir, 'js', 'plugins.js');
    const text = readUtf8(fp);
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(\\{"name":"' + escaped + '","status"):true');
    if (re.test(text)) {
        backupBefore(gameDir, 'js/plugins.js');
        writeUtf8(fp, text.replace(re, '$1:' + status));
        report.push('  插件 ' + name + '.js 已在 plugins.js 中禁用');
        return true;
    }
    // In-place edit failed (obfuscated/dynamic plugins.js). Fall back to rewriting
    // the whole file from the parsed $plugins list.
    if (_pluginsRef) {
        const entry = _pluginsRef.find(p => p && p.name === name);
        if (entry) {
            backupBefore(gameDir, 'js/plugins.js');
            entry.status = status;
            if (rewritePluginsFile(gameDir)) {
                report.push('  插件 ' + name + '.js 已在 plugins.js 中禁用 (已重建 plugins.js)');
                return true;
            }
        }
    }
    return false;
}

function backupFiles(gameDir, files) {
    const dir = path.join(gameDir, '_backup_xyou_' + new Date().toISOString().replace(/[:.]/g, '-'));
    fs.mkdirSync(dir, { recursive: true });
    for (const f of files) {
        const src = path.join(gameDir, f);
        if (!fs.existsSync(src)) continue;
        fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
        fs.copyFileSync(src, path.join(dir, f));
    }
    return dir;
}

function residualScan(gameDir) {
    const selfDir = path.dirname(path.resolve(__filename));
    const excludes = [/[\\/]_backup_xyou[^\\/]*[\\/]/, /[\\/]tool[\\/]/, /[\\/]xys-remover[\\/]/];
    const found = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fp = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (excludes.some(r => r.test(fp)) || path.resolve(fp) === selfDir) continue;
                walk(fp);
            } else if (entry.isFile() && /\.(js|json|html|css)$/i.test(entry.name)) {
                try {
                    if (path.resolve(fp) === path.resolve(__filename)) continue;
                    const st = fs.statSync(fp);
                    if (st.size >= 20 * 1024 * 1024) continue;
                    const content = readUtf8(fp);
                    if (AD_KEYWORDS.some(k => content.includes(k))) found.push(fp);
                } catch (e) {}
            }
        }
    };
    walk(gameDir);
    return found;
}

async function main() {
    const args = process.argv.slice(2);
    let gameDir = process.cwd();
    let dryRun = false;
    for (const a of args) {
        if (a === '--dry-run') dryRun = true;
        else if (!a.startsWith('--')) gameDir = path.resolve(a);
    }
    if (!fs.existsSync(path.join(gameDir, 'js')) && !fs.existsSync(path.join(gameDir, 'index.html'))) {
        log('错误: 找不到游戏目录 ' + gameDir);
        log('用法: node xys-remover.js <游戏目录> [--dry-run]');
        process.exit(1);
    }
    log('== X游社 广告移除工具 ==');
    log('目标目录: ' + gameDir);
    log('模式: ' + (dryRun ? '预览 (不写入)' : '执行'));
    log('');

    const report = [];
    const changedFiles = [];

    const plugins = parsePluginsList(gameDir);
    if (plugins) {
        const enabled = plugins.filter(p => p.status).map(p => p.name);
        log('已启用插件 ' + enabled.length + ' 个');

        log('步骤 1/4: 检测并处理数据解密插件 (UTA_Commone 类)...');
        const candidates = findDecryptorCandidates(gameDir, plugins);
        let decryptor = null;
        let decrypted = null;
        const ceFile = path.join(gameDir, 'data', 'CommonEvents.json');
        const ceRaw = fs.existsSync(ceFile) ? readUtf8(ceFile) : null;

        for (const cand of candidates) {
            log('  尝试插件: ' + cand.name + '.js ...');
            decrypted = await tryDecryptWithPlugin(gameDir, cand);
            if (decrypted) { decryptor = cand; break; }
        }

        let events = null;
        if (decrypted) {
            log('  解密成功 (通过 ' + decryptor.name + '.js)');
            events = decrypted;
        } else if (ceRaw && isEncryptedText(ceRaw)) {
            log('  插件解密失败, 尝试内置密钥...');
            events = tryAesKeys(ceRaw);
        } else if (ceRaw) {
            try { events = JSON.parse(ceRaw); } catch (e) { events = null; }
        }

        if (events && Array.isArray(events)) {
            const adEvents = collectAdEvents(events);
            if (adEvents.length) {
                log('  发现广告/作弊事件: ' + adEvents.map(i => 'CE#' + i).join(', '));
                for (const i of adEvents) {
                    report.push('  公共事件 CE#' + i + ' [' + (events[i].name || '') + '] 已移除');
                    events[i] = null;
                }
                if (!dryRun) {
                    backupBefore(gameDir, 'data/CommonEvents.json');
                    writeUtf8(ceFile, JSON.stringify(events));
                    changedFiles.push('data/CommonEvents.json');
                }
                log(dryRun ? '  (预览) 将写入明文 CommonEvents.json' : '  已写入明文 CommonEvents.json');
            } else {
                log('  未发现广告事件');
            }
        } else {
            log('  跳过: 无法读取/解密 CommonEvents.json');
        }

        if (decryptor) {
            if (!dryRun) {
                backupBefore(gameDir, 'js/plugins/' + decryptor.name + '.js');
                fs.unlinkSync(decryptor.fp);
                changedFiles.push('js/plugins/' + decryptor.name + '.js');
                if (setPluginStatus(gameDir, decryptor.name, false, report)) {
                    changedFiles.push('js/plugins.js');
                }
            }
            log(dryRun ? '  (预览) 将删除解密插件 ' + decryptor.name + '.js 并禁用' : '  已删除解密插件 ' + decryptor.name + '.js 并禁用');
        } else {
            log('  未检测到解密插件');
        }
        log('');

        log('步骤 2/4: 检测广告核心插件 (ActorCommand 类)...');
        const adChanged = scanPluginsForAdCore(gameDir, plugins, report, dryRun);
        changedFiles.push(...adChanged);
        log('');
    } else {
        log('跳过插件步骤 (无法解析 js/plugins.js)');
    }

    log('步骤 3/4: 清除地图中的防篡改脚本...');
    const mapChanged = scanMaps(gameDir, report, dryRun);
    changedFiles.push(...mapChanged);
    log('  处理地图 ' + mapChanged.length + ' 个');
    log('');

    log('步骤 4/4: 残留扫描...');
    const residual = residualScan(gameDir);
    if (residual.length) {
        log('  发现残留关键词:');
        for (const r of residual) log('    ' + r);
    } else {
        log('  未发现残留');
    }
    log('');

    log('== 结果 ==');
    if (!report.length) {
        log('未检测到 X游社 组件');
    }
    for (const r of report) log(r);

    if (!dryRun && changedFiles.length) {
        log('');
        if (_backupDir) {
            log('已修改 ' + changedFiles.length + ' 个文件, 备份于: ' + _backupDir);
        } else {
            log('已修改 ' + changedFiles.length + ' 个文件 (无文件需要备份)');
        }
    }
    log('');
    log('完成。');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });