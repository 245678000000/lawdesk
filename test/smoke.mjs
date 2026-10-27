// 冒烟测试：npm test
// 启动本地服务（独立的临时数据目录），检查：CLI 检测、Word 附件上传与转文字、自有 API 流式对话、
// 文件下载、检查更新（模拟 GitHub 接口），以及本机装了 claude / codex 时能否真正把它们拉起来
// （不要求已登录，只要求没有启动错误）。
// 设置 EXPECT_CLIS=claude,codex,codebuddy 时要求这些命令都能检测到（CI 里会先用 npm 全局安装它们）；
// 设置 EXPECT_WORKBUDDY=1 时要求能找到 WorkBuddy 桌面版自带的引擎（CI 里用官方 CodeBuddy 包模拟安装目录）；
// 设置 TEST_CLI_CALLS=1 时才真正调用它们（会消耗你账号的额度，所以本地默认不跑）。
// ChatGPT 套餐用本地模拟的 OpenAI 登录与 Responses 接口走完整流程；本机有 Codex 时也验证经 Codex 的调用。
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdesk-test-'));
const log = (...a) => console.log('·', ...a);

// ---- 模拟的 OpenAI 兼容接口：把收到的内容特征写进回复里；/releases/latest 模拟 GitHub 的发布接口 ----
let releaseHits = 0;
const mock = http.createServer(async (req, res) => {
  if (req.url === '/releases/latest') {
    releaseHits++;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ tag_name: 'v99.0.0', html_url: 'https://example.com/r', body: '## 更新内容\n- 测试', assets: [] }));
  }
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

// ---- 模拟的 OpenAI 登录（OIDC）与 Responses 接口 ----
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const oai = { base: '', pending: null, tokens: [], requests: [], refreshCount: 0, revoked: [] };
const jwtSign = (claims) => {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const data = enc({ alg: 'RS256', kid: 'k1', typ: 'JWT' }) + '.' + enc(claims);
  return data + '.' + crypto.sign('sha256', Buffer.from(data), privateKey).toString('base64url');
};
const FULL_SCOPE = 'chatgpt.tokens.use.direct email offline_access openid profile resource.invoke';
const oaiServer = http.createServer(async (req, res) => {
  let body = '';
  for await (const c of req) body += c;
  const url = new URL(req.url, 'http://x');
  const json = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json', 'x-request-id': 'req_test' }); res.end(JSON.stringify(obj)); };
  if (url.pathname === '/.well-known/openid-configuration') {
    return json(200, { issuer: oai.base, authorization_endpoint: oai.base + '/api/accounts/authorize',
      token_endpoint: oai.base + '/api/accounts/oauth/token', jwks_uri: oai.base + '/jwks', revocation_endpoint: oai.base + '/revoke' });
  }
  if (url.pathname === '/jwks') return json(200, { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' }] });
  if (url.pathname === '/api/accounts/oauth/token') {
    const f = new URLSearchParams(body);
    assert.equal(f.get('resource'), 'https://api.openai.com/v1');
    if (f.get('grant_type') === 'authorization_code') {
      const p = oai.pending;
      if (!p || f.get('code') !== p.code) return json(400, { error: 'invalid_grant' });
      // PKCE：verifier 的 SHA-256 必须等于授权时的 challenge
      assert.equal(crypto.createHash('sha256').update(f.get('code_verifier')).digest('base64url'), p.challenge);
      assert.equal(f.get('redirect_uri'), p.redirectUri);
      assert.equal(f.get('client_id'), 'oaiapp_test');
      const now = Math.floor(Date.now() / 1000);
      const n = oai.tokens.length + 1;
      oai.tokens.push(`at-${n}`);
      return json(200, { access_token: `at-${n}`, refresh_token: `rt-${n}`, token_type: 'Bearer', expires_in: 3600, scope: p.scope ?? FULL_SCOPE,
        id_token: jwtSign({ iss: oai.base, aud: 'oaiapp_test', sub: 'user-1', email: 'lawyer@example.com', iat: now, exp: now + 3600, nonce: p.nonce }) });
    }
    if (f.get('grant_type') === 'refresh_token') {
      oai.refreshCount++;
      if (!oai.tokens.length || f.get('refresh_token') !== `rt-${oai.tokens.length}`) return json(400, { error: 'invalid_grant' });
      const n = oai.tokens.length + 1;
      oai.tokens.push(`at-${n}`);
      return json(200, { access_token: `at-${n}`, refresh_token: `rt-${n}`, token_type: 'Bearer', expires_in: 3600, scope: FULL_SCOPE });
    }
  }
  if (url.pathname === '/revoke') { oai.revoked.push(new URLSearchParams(body).get('token')); res.writeHead(200); return res.end(); }
  const auth = req.headers.authorization || '';
  if (url.pathname === '/v1/models') {
    if (!oai.tokens.includes(auth.replace('Bearer ', ''))) return json(401, { detail: 'bad token' });
    return json(200, { models: [{ slug: 'gpt-test', display_name: 'GPT Test', visibility: 'list' }, { slug: 'internal', display_name: 'Hidden', visibility: 'hide' }] });
  }
  if (url.pathname === '/v1/responses') {
    const j = JSON.parse(body || '{}');
    oai.requests.push({ auth, body: j });
    if (auth !== `Bearer ${oai.tokens.at(-1)}`) return json(401, { detail: 'stale token' });
    const all = JSON.stringify(j.input);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'x-request-id': 'req_test' });
    const send = (ev) => res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
    send({ type: 'response.created', response: { id: 'resp_1', status: 'in_progress' } });
    if (all.includes('超额')) {
      send({ type: 'response.failed', response: { id: 'resp_1', status: 'failed', error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'limit' } } });
      return res.end();
    }
    const text = `模型=${j.model}；store=${j.store}；stream=${j.stream}；有说明=${!!j.instructions}；图片=${all.includes('input_image') ? '是' : '否'}`;
    send({ type: 'response.output_item.added', output_index: 0, item: { type: 'message', id: 'msg_1', role: 'assistant', content: [] } });
    for (const ch of text.match(/[\s\S]{1,6}/g)) send({ type: 'response.output_text.delta', item_id: 'msg_1', output_index: 0, content_index: 0, delta: ch });
    send({ type: 'response.output_item.done', output_index: 0, item: { type: 'message', id: 'msg_1', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] } });
    send({ type: 'response.completed', response: { id: 'resp_1', status: 'completed', output: [],
      usage: { input_tokens: 1, input_tokens_details: { cached_tokens: 0 }, output_tokens: 1, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 2 } } });
    return res.end();
  }
  json(404, { detail: 'not found' });
}).listen(0, '127.0.0.1');
await once(oaiServer, 'listening');
oai.base = `http://127.0.0.1:${oaiServer.address().port}`;

// ---- 启动服务 ----
const srv = spawn(process.execPath, [path.join(root, 'server.js')], {
  cwd: root,
  env: { ...process.env, PORT: '0', NO_OPEN: '1', LAWDESK_HOME: home, LAWDESK_APP: '',
    LAWDESK_CHATGPT_AUTH: oai.base, LAWDESK_CHATGPT_API: oai.base + '/v1',
    LAWDESK_UPDATE_API: `http://127.0.0.1:${mock.address().port}/releases/latest` },
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
  const codes = [];
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
      if (ev.t === 'error') { errors.push(ev.d); codes.push(ev.code); }
      if (ev.t === 'done') done = true;
    }
  }
  clearTimeout(timer);
  return { convId, text, errors, codes, done };
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
    'npm → 无扩展名 node 脚本': [head + 'IF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n) ELSE (\r\n  SET "_prog=node"\r\n  SET PATHEXT=%PATHEXT:;.JS;=;%\r\n)\r\n' +
      'endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@tencent-ai\\codebuddy-code\\bin\\codebuddy" %*\r\n',
      'node_modules/@tencent-ai/codebuddy-code/bin/codebuddy'],
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

  // 2b. 检查更新：自动检查 24 小时内只联网一次；可以忽略某个版本、关闭自动检查
  const pkgVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  assert.equal(state.version, pkgVersion);
  const u0 = await api('/api/update');
  assert.equal(u0.current, pkgVersion);
  assert.equal(u0.latest?.version, '99.0.0', JSON.stringify(u0));
  assert.ok(u0.hasUpdate);
  assert.equal(u0.install, 'source');
  await api('/api/update');
  assert.equal(releaseHits, 1, '24 小时内的自动检查应该用缓存');
  await api('/api/update?force=1');
  assert.equal(releaseHits, 2, '手动检查应该重新查询');
  assert.equal((await api('/api/update', { method: 'POST', body: { dismiss: '99.0.0' } })).dismissed, '99.0.0');
  assert.equal((await api('/api/update', { method: 'POST', body: { auto: false } })).auto, false);
  assert.equal((await api('/api/state')).config.autoUpdateCheck, false);
  log('检查更新：通过');

  // 官方预览期限制：只能流式、不存储，不能带这些字段，也不能有 system 角色的消息
  const UNSUPPORTED = ['background', 'conversation', 'max_output_tokens', 'max_tool_calls', 'metadata', 'moderation', 'multi_agent',
    'prompt', 'prompt_cache_retention', 'safety_identifier', 'temperature', 'top_logprobs', 'top_p', 'truncation', 'user', 'previous_response_id'];
  const assertPlanRequest = (b) => {
    assert.equal(b.store, false);
    assert.equal(b.stream, true);
    assert.ok(Array.isArray(b.input));
    for (const k of UNSUPPORTED) assert.ok(!(k in b), `请求里不能有 ${k}`);
    assert.ok(!b.input.some((i) => i.role === 'system'), '不能有 system 角色的消息');
    assert.ok(!(b.tools || []).some((t) => ['tool_search', 'file_search', 'code_interpreter', 'image_generation', 'computer_use_preview', 'mcp'].includes(t.type)),
      '不能带托管工具：' + (b.tools || []).map((t) => t.type).join(','));
  };

  // 2c. ChatGPT 套餐：登录 → 校验 → 对话 → 用量上限 → 刷新令牌 → 退出 → 重新登录 → 经 Codex 调用
  const gptLogin = async (query, { scope } = {}) => {
    const start = await fetch(`${base}/auth/chatgpt/start?${query}`, { redirect: 'manual' });
    assert.equal(start.status, 302);
    const auth = new URL(start.headers.get('location'));
    assert.equal(auth.origin + auth.pathname, oai.base + '/api/accounts/authorize');
    const q = auth.searchParams;
    for (const s of ['openid', 'offline_access', 'resource.invoke', 'chatgpt.tokens.use.direct']) assert.ok(q.get('scope').split(' ').includes(s), s);
    assert.equal(q.get('resource'), 'https://api.openai.com/v1');
    assert.equal(q.get('response_type'), 'code');
    assert.equal(q.get('code_challenge_method'), 'S256');
    assert.match(q.get('ext_agent_host_id'), /^urn:uuid:[0-9a-f-]{36}$/);
    assert.equal(q.get('redirect_uri'), `http://127.0.0.1:${port}/auth/callback`);
    oai.pending = { code: 'code-' + Math.random(), challenge: q.get('code_challenge'), nonce: q.get('nonce'), redirectUri: q.get('redirect_uri'), scope };
    const cb = new URLSearchParams({ code: oai.pending.code, state: q.get('state'), scope: scope ?? FULL_SCOPE });
    if (q.get('client_id') === 'dynamic_agent_client') cb.set('client_id', 'oaiapp_test');
    const page = await (await fetch(`${base}/auth/callback?${cb}`)).text();
    return { q, page, replay: () => fetch(`${base}/auth/callback?${cb}`).then((r) => r.text()) };
  };

  const blocked = await fetch(`${base}/auth/chatgpt/start?ui=crosssite01`, { redirect: 'manual', headers: { 'sec-fetch-site': 'cross-site' } });
  assert.equal(blocked.status, 403, '别的网站不能发起登录');

  const first = await gptLogin('ui=firstlogin01');
  assert.equal(first.q.get('client_id'), 'dynamic_agent_client');
  assert.equal(first.q.get('agent_name_hint'), 'LawDesk');
  assert.match(first.page, /已登录 ChatGPT/);
  assert.match(await first.replay(), /已失效/, '同一个回调不能用两次');
  const st1 = await api('/api/chatgpt/login/firstlogin01');
  assert.deepEqual([st1.status, st1.welcome, st1.planUsage], ['ok', true, true]);
  let gpt = await api('/api/chatgpt');
  assert.equal(gpt.active, 'oaiapp_test');
  assert.equal(gpt.welcomePending, true);
  assert.equal((await api('/api/chatgpt/welcome', { method: 'POST', body: {} })).welcomePending, false);
  assert.deepEqual(gpt.accounts[0].models, [{ slug: 'gpt-test', name: 'GPT Test' }]);
  const credFile = path.join(home, 'chatgpt', 'cred-oaiapp_test.json');
  if (process.platform !== 'win32') assert.equal(fs.statSync(credFile).mode & 0o777, 0o600, '凭证文件只能本人读写');
  assert.ok(!JSON.stringify(await api('/api/state')).includes('rt-1'), '前端拿不到令牌');

  await api('/api/chatgpt/settings', { method: 'POST', body: { useCodex: false } });
  const g1 = await chat({ text: '你好', backend: 'chatgpt' });
  assert.deepEqual(g1.errors, []);
  assert.equal(g1.text, '模型=gpt-test；store=false；stream=true；有说明=true；图片=否');
  const sent = oai.requests.at(-1).body;
  assert.ok(Array.isArray(sent.input) && !JSON.stringify(sent.input).includes('"system"'), '不发送 system 角色的消息');
  assertPlanRequest(sent);

  const g2 = await chat({ text: '超额测试', backend: 'chatgpt' });
  assert.equal(g2.codes[0], 'chatgpt_usage_limit');
  assert.match(g2.errors[0], /已达到用量上限/);

  // 访问令牌过期 → 自动刷新（刷新令牌轮换）后继续
  const cred = JSON.parse(fs.readFileSync(credFile, 'utf8'));
  fs.writeFileSync(credFile, JSON.stringify({ ...cred, saved_at: new Date(Date.now() - 2 * 3600e3).toISOString() }));
  const g3 = await chat({ text: '刷新后再问', backend: 'chatgpt' });
  assert.deepEqual(g3.errors, []);
  assert.equal(oai.refreshCount, 1);
  assert.equal(oai.requests.at(-1).auth, 'Bearer at-2');
  assert.equal(JSON.parse(fs.readFileSync(credFile, 'utf8')).refresh_token, 'rt-2');

  // 退出：撤销刷新令牌、清除本地令牌，保留账号与应用 ID 的对应关系
  const out = await api('/api/chatgpt/logout', { method: 'POST', body: { account: 'oaiapp_test' } });
  assert.equal(out.revoked, true);
  assert.deepEqual(oai.revoked, ['rt-2']);
  assert.ok(!fs.existsSync(credFile));
  assert.equal(out.active, null);
  const g4 = await chat({ text: '退出后', backend: 'chatgpt' });
  assert.equal(g4.codes[0], 'chatgpt_login');

  // 重新登录同一账号：沿用应用 ID，不再带名称提示
  const again = await gptLogin('ui=relogin0001&account=oaiapp_test');
  assert.equal(again.q.get('client_id'), 'oaiapp_test');
  assert.equal(again.q.get('login_hint'), 'lawyer@example.com');
  assert.equal(again.q.get('agent_name_hint'), null);
  assert.match(again.page, /已登录 ChatGPT/);
  assert.equal((await api('/api/chatgpt/login/relogin0001')).welcome, false, '使用说明只显示一次');
  assert.equal((await api('/api/chatgpt')).welcomePending, false);
  log('ChatGPT 套餐（登录、直接对话、用量上限、刷新、退出、重新登录）：通过');

  // 经 Codex：用登录得到的令牌和官方文档里的提供方配置，验证请求真的发到了 Responses 接口
  if (state.clis.codex.found) {
    await api('/api/chatgpt/settings', { method: 'POST', body: { useCodex: true } });
    const before = oai.requests.length;
    const g5 = await chat({ text: '经 Codex 回复', backend: 'chatgpt', permission: 'readonly' }, 90000);
    const viaCodex = oai.requests.slice(before);
    log('ChatGPT 套餐经 Codex：', g5.text ? `回复「${g5.text.slice(0, 60)}」` : '', g5.errors.length ? `错误「${g5.errors.join(' | ').slice(0, 200)}」` : '');
    assert.ok(viaCodex.length, 'Codex 应该把请求发到 Responses 接口');
    assert.equal(viaCodex[0].auth, `Bearer ${oai.tokens.at(-1)}`);
    for (const r of viaCodex) assertPlanRequest(r.body);
    assert.equal(viaCodex[0].body.model, 'gpt-test');
    log('Codex 请求字段：', Object.keys(viaCodex[0].body).join(','), '｜工具：', [...new Set((viaCodex[0].body.tools || []).map((t) => t.type))].join(','));
    assert.match(g5.text, /store=false；stream=true/);
    log('ChatGPT 套餐经 Codex：通过');
  } else {
    log('没有 Codex，跳过经 Codex 的 ChatGPT 套餐测试');
  }

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
  oaiServer.close();
  await once(srv, 'exit').catch(() => {});
  fs.rmSync(home, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
