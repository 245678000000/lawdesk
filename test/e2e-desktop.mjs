// 桌面客户端端到端测试：真正启动打包好的 App（或开发版 Electron），通过 DevTools 协议检查页面，
// 截图，然后关闭窗口，确认后台服务也跟着退出。数据目录用临时目录，不碰真实数据。
// 用法：node test/e2e-desktop.mjs <可执行文件> [参数...] [--shot 截图.png]
//   Windows 打包版：node test/e2e-desktop.mjs dist/win-unpacked/LawDesk.exe --shot dist/windows.png
//   开发版：       node test/e2e-desktop.mjs windows/node_modules/.bin/electron windows
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const argv = process.argv.slice(2);
const shotIdx = argv.indexOf('--shot');
const shotPath = shotIdx >= 0 ? argv.splice(shotIdx, 2)[1] : null;
const [exe, ...exeArgs] = argv;
if (!exe) { console.error('用法：node test/e2e-desktop.mjs <可执行文件> [参数...] [--shot 截图.png]'); process.exit(2); }

const DEBUG_PORT = 9333;
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdesk-e2e-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('·', ...a);
const env = { ...process.env, LAWDESK_HOME: home };
delete env.ELECTRON_RUN_AS_NODE;

const app = spawn(exe, [...exeArgs, `--remote-debugging-port=${DEBUG_PORT}`], {
  env, stdio: 'inherit', shell: process.platform === 'win32' && /\.cmd$/i.test(exe),
});
let appExited = false;
app.on('exit', () => { appExited = true; });

async function waitFor(fn, ms, what) {
  const end = Date.now() + ms;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch {}
    if (Date.now() > end) throw new Error('等待超时：' + what);
    await sleep(500);
  }
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const ready = new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  const call = (method, params = {}) => ready.then(() => new Promise((resolve, reject) => {
    const my = ++id;
    const onMsg = (e) => {
      const m = JSON.parse(e.data);
      if (m.id !== my) return;
      ws.removeEventListener('message', onMsg);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id: my, method, params }));
  }));
  const evaluate = async (expression) =>
    (await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
  return { call, evaluate, close: () => ws.close() };
}

let failed = false;
try {
  // 1. 等到窗口加载出本地服务的页面
  const page = await waitFor(async () => {
    const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
    return list.find((p) => p.type === 'page' && /^http:\/\/127\.0\.0\.1:\d+\/$/.test(p.url));
  }, 90000, '窗口加载本地页面');
  const appPort = Number(new URL(page.url).port);
  log('页面', page.url);
  const c = cdp(page.webSocketDebuggerUrl);

  // 2. 页面内容、原生桥、服务状态
  await waitFor(() => c.evaluate(`!!document.querySelector('#composer')`), 30000, '界面渲染');
  const info = JSON.parse(await c.evaluate(`JSON.stringify({
    heading: document.querySelector('h1')?.innerText,
    native: !!window.lawdeskNative, nativePlatform: window.lawdeskNative?.platform,
    desktopClass: document.documentElement.classList.contains('desktop-app'),
    micHidden: document.querySelector('[data-act=mic]')?.classList.contains('hidden'),
  })`));
  const state = JSON.parse(await c.evaluate(`fetch('/api/state').then(r => r.json()).then(d => JSON.stringify({ platform: d.platform, dataDir: d.dataDir, clis: d.clis }))`));
  log('界面', JSON.stringify(info));
  log('服务', JSON.stringify(state));
  assert.equal(info.heading, '今天要推进哪项法律任务');
  assert.ok(info.native && info.desktopClass, '应注入桌面原生桥');
  assert.equal(info.nativePlatform, process.platform);
  assert.ok(info.micHidden, '桌面版不显示语音按钮');
  assert.equal(state.platform, process.platform);
  assert.equal(path.resolve(state.dataDir), path.resolve(home));

  // 3. 在界面里点开一个技能、切到设置页，确认交互正常
  await c.evaluate(`document.querySelector('.chip[data-id="contract-review"]').click()`);
  assert.match(await c.evaluate(`document.querySelector('#input').value`), /合同/);
  await c.evaluate(`location.hash = '#/settings'`);
  await waitFor(() => c.evaluate(`!!document.querySelector('[data-cli=codex]')`), 10000, '设置页');
  await c.evaluate(`location.hash = '#/'`);
  await sleep(500);

  if (shotPath) {
    const shot = await c.call('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(path.resolve(shotPath)), { recursive: true });
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    log('截图', shotPath);
  }

  // 4. 关闭窗口 → App 退出 → 后台服务一并结束
  await c.evaluate(`setTimeout(() => window.close(), 50); true`).catch(() => {});
  c.close();
  await waitFor(() => appExited, 30000, 'App 退出');
  await waitFor(async () => {
    try { await fetch(`http://127.0.0.1:${appPort}/api/state`); return false; } catch { return true; }
  }, 15000, '后台服务退出');
  log('关闭窗口后 App 和后台服务都已退出');
  console.log('\n✓ 桌面客户端测试通过');
} catch (e) {
  failed = true;
  console.error('\n✗ 桌面客户端测试失败：', e.message);
  if (!appExited) {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(app.pid), '/T', '/F']);
    else app.kill();
  }
} finally {
  await sleep(500);
  fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  process.exit(failed ? 1 : 0);
}
