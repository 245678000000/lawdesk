// 冒烟测试：npm test
// 启动本地服务（独立的临时数据目录），检查：CLI 检测、Word 附件上传与转文字、自有 API 流式对话、
// 文件下载，以及本机装了 claude / codex 时能否真正把它们拉起来（不要求已登录，只要求没有启动错误）。
// 设置 EXPECT_CLIS=claude,codex,codebuddy 时要求这些命令都能检测到（CI 里会先用 npm 全局安装它们）；
// 设置 EXPECT_WORKBUDDY=1 时要求能找到 WorkBuddy 桌面版自带的引擎（CI 里用官方 CodeBuddy 包模拟安装目录）；
// 设置 TEST_CLI_CALLS=1 时才真正调用它们（会消耗你账号的额度，所以本地默认不跑）。
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdesk-test-'));
const log = (...a) => console.log('·', ...a);

// ---- 模拟的 OpenAI 兼容接口：把收到的内容特征写进回复里 ----
const mock = http.createServer(async (req, res) => {
  let body = '';
  for await (const c of req) body += c;
  const j = JSON.parse(body || '{}');
  const all = JSON.stringify(j.messages || []);
  const reply = `模型=${j.model}；附件已转文字=${all.includes('120万元') ? '是' : '否'}；技能=${all.includes('【技能：') ? '是' : '否'}`;
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  for (const ch of reply.match(/[\s\S]{1,4}/g)) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: ch } }] })}\n\n`);
  res.end('data: [DONE]\n\n');
}).listen(0, '127.0.0.1');
await once(mock, 'listening');

// ---- 启动服务 ----
const srv = spawn(process.execPath, [path.join(root, 'server.js')], {
  cwd: root,
  env: { ...process.env, PORT: '0', NO_OPEN: '1', LAWDESK_HOME: home },
  stdio: ['ignore', 'pipe', 'inherit'],
});
const port = await new Promise((resolve, reject) => {
  let buf = '';
  srv.stdout.on('data', (d) => {
    buf += d;
    const m = buf.match(/LAWDESK_READY (\d+)/);
    if (m) resolve(Number(m[1]));
  });
  srv.on('exit', (c) => reject(new Error('服务提前退出：' + c)));
  setTimeout(() => reject(new Error('服务启动超时')), 60000);
});
const base = `http://127.0.0.1:${port}`;
const api = async (p, { method = 'GET', body, raw } = {}) => {
  const res = await fetch(base + p, {
    method,
    headers: { 'x-lawdesk': '1', ...(raw ? {} : { 'Content-Type': 'application/json' }) },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${await res.text()}`);
  return res.json();
};
async function chat(body, timeoutMs = 120000) {
  const res = await fetch(base + '/api/chat', {
    method: 'POST', headers: { 'x-lawdesk': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal(res.status, 200, await res.clone().text());
  let text = '';
  const errors = [];
  let convId = null;
  let done = false;
  const timer = setTimeout(() => { if (convId) api(`/api/conversations/${convId}/stop`, { method: 'POST' }).catch(() => {}); }, timeoutMs);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done: end, value } = await reader.read();
    if (end) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const line = buf.slice(0, i).replace(/^data: /, '');
      buf = buf.slice(i + 2);
      const ev = JSON.parse(line);
      if (ev.t === 'start') convId = ev.conversationId;
      if (ev.t === 'text') text += ev.d;
      if (ev.t === 'error') errors.push(ev.d);
      if (ev.t === 'done') done = true;
    }
  }
  clearTimeout(timer);
  return { convId, text, errors, done };
}

let failed = false;
try {
  // 0. Windows .cmd 包装脚本解析（纯字符串解析，各平台都跑）
  const { shimTarget } = await import('../lib/cli.js');
  const shimDir = path.join(os.tmpdir(), 'npm-prefix');
  const head = '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n';
  const shims = {
    'npm → js': [head + 'IF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n) ELSE (\r\n  SET "_prog=node"\r\n)\r\n' +
      'endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n',
      'node_modules/@openai/codex/bin/codex.js'],
    'npm → exe': [head + '"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*\r\n',
      'node_modules/@anthropic-ai/claude-code/bin/claude.exe'],
    'pnpm → js': ['@IF EXIST "%~dp0\\node.exe" (\r\n  "%~dp0\\node.exe"  "%~dp0\\..\\@anthropic-ai\\claude-code\\cli.js" %*\r\n) ELSE (\r\n  node  "%~dp0\\..\\@anthropic-ai\\claude-code\\cli.js" %*\r\n)\r\n',
      '@anthropic-ai/claude-code/cli.js'],
  };
  for (const [kind, [text, want]] of Object.entries(shims)) {
    const got = shimTarget(path.join(shimDir, 'x.cmd'), text).replace(/\\/g, '/');
    assert.ok(got.endsWith(want), `${kind}：解析结果 ${got} 应以 ${want} 结尾`);
  }
  log('.cmd 包装脚本解析：通过');

  // 1. 状态与 CLI 检测
  const state = await api('/api/state');
  assert.equal(state.platform, process.platform);
  log('平台', state.platform);
  for (const name of ['claude', 'codex', 'codebuddy']) log(name, JSON.stringify(state.clis[name]));
  if (process.env.EXPECT_CLIS) {
    for (const name of process.env.EXPECT_CLIS.split(',').map((x) => x.trim()).filter(Boolean)) {
      assert.ok(state.clis[name].found, `${name} 应该被检测到`);
      assert.ok(state.clis[name].version, `${name} --version 应该能执行（Windows 上验证 .cmd 包装脚本解析）`);
    }
  }

  // 1b. WorkBuddy 桌面版自带的引擎：按安装目录找到并能用它的运行时执行
  if (process.env.EXPECT_WORKBUDDY === '1') {
    const { findWorkBuddy } = await import('../lib/cli.js');
    const wb = findWorkBuddy();
    assert.ok(wb, '应该找到 WorkBuddy 安装目录里的引擎');
    const { execFileSync } = await import('node:child_process');
    const out = execFileSync(wb.cmd, [...wb.pre, '--version'], { env: { ...process.env, ...wb.env }, encoding: 'utf8', timeout: 60000, windowsHide: true });
    assert.match(out, /\d+\.\d+\.\d+/, 'WorkBuddy 内置引擎应能输出版本号');
    log('WorkBuddy 内置引擎：', wb.cmd, '→', out.trim().split('\n').pop());
  }

  // 2. 自有 API + Word 附件
  const cfg = await api('/api/config', {
    method: 'POST',
    body: { ...state.config, providers: [{ name: '测试接口', type: 'openai', baseUrl: `http://127.0.0.1:${mock.address().port}/v1`, apiKey: 'k', models: ['mock-model'] }] },
  });
  const provider = cfg.config.providers[0];
  const { conversation } = await api('/api/conversations', { method: 'POST', body: {} });
  const up = await api(`/api/conversations/${conversation.id}/upload?name=${encodeURIComponent('合同材料.docx')}`, {
    method: 'POST', raw: fs.readFileSync(path.join(root, 'test', 'fixtures', '合同材料.docx')),
  });
  assert.equal(up.path, '附件/合同材料.docx');
  const r = await chat({ conversationId: conversation.id, text: '整理时间线', attachments: [up.path], skillId: 'timeline', backend: 'api:' + provider.id });
  assert.deepEqual(r.errors, []);
  assert.equal(r.text, '模型=mock-model；附件已转文字=是；技能=是');
  log('API 对话 + Word 附件：通过');

  const file = await fetch(`${base}/files/${conversation.id}/${encodeURI(up.path)}?download`);
  assert.equal(file.status, 200);
  assert.equal(Buffer.from(await file.arrayBuffer()).length, fs.statSync(path.join(root, 'test', 'fixtures', '合同材料.docx')).size);
  log('文件下载：通过');

  // 3. 真正拉起 CLI（没登录也没关系，只要不是“找不到 / 无法启动”）
  for (const name of ['codex', 'claude', 'codebuddy']) {
    if (process.env.TEST_CLI_CALLS !== '1') { log(name, '调用测试未开启（TEST_CLI_CALLS=1）'); continue; }
    if (!state.clis[name].found) { log(name, '未安装，跳过调用测试'); continue; }
    const c = await chat({ text: '只回复两个字：正常', backend: name, permission: 'readonly' }, 60000);
    const msg = c.errors.join(' | ');
    log(`${name} 调用：`, c.text ? `回复「${c.text.slice(0, 40)}」` : '', msg ? `错误「${msg.slice(0, 160)}」` : '');
    assert.ok(c.done, `${name} 对话应该正常结束`);
    assert.doesNotMatch(msg, /ENOENT|EINVAL|EACCES|spawn|无法解析|没有找到/, `${name} 不应出现启动错误`);
  }
  console.log('\n✓ 冒烟测试通过');
} catch (e) {
  failed = true;
  console.error('\n✗ 冒烟测试失败：', e.message);
} finally {
  srv.kill();
  mock.close();
  await once(srv, 'exit').catch(() => {});
  fs.rmSync(home, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
