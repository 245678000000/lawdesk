// 律台 · 本地法律智能体
// 只监听 127.0.0.1，不需要登录。模型来自本机的 Claude Code / Codex CLI，或你自己配置的 API。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as store from './lib/store.js';
import { BASE_PROMPT, EXAMPLES } from './lib/skills.js';
import { runClaude, runCodex, runCodeBuddy, detectCli, shellEnvReady } from './lib/cli.js';
import { runOpenAI, runAnthropic } from './lib/api.js';
import { extractText } from './lib/extract.js';
import { VERSION, checkUpdate, updateSettings } from './lib/update.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PORT = process.env.PORT ? Number(process.env.PORT) : 3721; // 0 = 随机端口（Mac 客户端使用）

// ---------------- 运行中的任务 ----------------
// convId -> { controller, parts, status, listeners:Set<res>, backend, model }
const running = new Map();

function applyEvent(parts, ev) {
  if (ev.t === 'text') {
    const last = parts[parts.length - 1];
    if (last && last.type === 'text') last.text += ev.d; else parts.push({ type: 'text', text: ev.d });
  } else if (ev.t === 'tool') {
    const existing = parts.find((p) => p.type === 'tool' && p.id === ev.id);
    const { t, ...fields } = ev;
    for (const k of Object.keys(fields)) if (fields[k] === undefined) delete fields[k];
    if (existing) Object.assign(existing, fields); else parts.push({ type: 'tool', ...fields });
  } else if (ev.t === 'notice' || ev.t === 'error') {
    parts.push({ type: ev.t, text: ev.d });
  }
}

const CLIS = { claude: null, codex: null, codebuddy: null };
const CLI_BACKENDS = ['claude', 'codex', 'codebuddy'];
function refreshClis() {
  const cfg = store.getConfig();
  for (const k of CLI_BACKENDS) CLIS[k] = detectCli(k, cfg[k]);
}

// ---------------- 组装提示词 ----------------

function buildSystemPrompt({ skill, project, ws, isCli }) {
  const cfg = store.getConfig();
  const blocks = [BASE_PROMPT];
  if (skill) blocks.push(skill.prompt);
  const memory = cfg.memoryEnabled ? store.getMemory().trim() : '';
  if (memory) blocks.push('【用户长期记忆（用户的身份、偏好和常用信息）】\n' + memory);
  if (project) {
    blocks.push(`【当前项目：${project.name}】` + (project.instructions ? '\n' + project.instructions : '') +
      (project.folder ? `\n项目案卷文件夹：${project.folder}` : ''));
  }
  if (isCli) {
    blocks.push(`【工作区】用户上传的材料在：${path.join(ws, '附件')}
需要交付的文件（报告、文书、表格、HTML 等）请保存到：${path.join(ws, '输出')}，并在回答末尾列出生成的文件名。
不要修改「附件」里的原始材料。`);
  }
  return blocks.join('\n\n');
}

function transcriptOf(messages, maxChars = 24000) {
  const lines = [];
  for (const m of messages) {
    const body = m.role === 'user' ? m.text : (m.parts || []).filter((p) => p.type === 'text').map((p) => p.text).join('\n');
    if (body) lines.push((m.role === 'user' ? '【用户】' : '【助手】') + body);
  }
  let s = lines.join('\n\n');
  if (s.length > maxChars) s = '……（更早的内容已省略）\n' + s.slice(-maxChars);
  return s;
}

function attachmentNote(ws, attachments) {
  if (!attachments?.length) return '';
  return '\n\n本次附件（已保存在工作区）：\n' + attachments.map((a) => '- ' + path.join(ws, a)).join('\n');
}

async function apiMessages(conv, ws) {
  const out = [];
  for (const m of conv.messages) {
    if (m.role === 'user') {
      if (m.attachments?.length && !m.context) {
        const docs = [];
        for (const a of m.attachments) {
          const r = await extractText(path.join(ws, a));
          docs.push(`<文件 name="${path.basename(a)}">\n${r.text}\n</文件>`);
        }
        m.context = docs.join('\n\n');
      }
      out.push({ role: 'user', content: (m.context ? m.context + '\n\n' : '') + (m.text || '（见附件）') });
    } else {
      const text = (m.parts || []).filter((p) => p.type === 'text').map((p) => p.text).join('\n');
      if (text) out.push({ role: 'assistant', content: text });
    }
  }
  // 合并连续同角色消息（例如上一轮报错没有助手回复）
  const merged = [];
  for (const m of out) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + m.content; else merged.push({ ...m });
  }
  // 控制总长度：从最早的消息开始丢
  let total = merged.reduce((n, m) => n + m.content.length, 0);
  while (total > 300000 && merged.length > 1) total -= merged.shift().content.length;
  while (merged.length && merged[0].role !== 'user') merged.shift();
  return merged;
}

// ---------------- 对话执行 ----------------

async function startChat(body) {
  const cfg = store.getConfig();
  let conv = body.conversationId ? store.getConversation(body.conversationId) : null;
  if (!conv) conv = store.createConversation({ projectId: body.projectId || null });
  if (running.has(conv.id)) throw Object.assign(new Error('这个对话还在运行中'), { status: 409 });

  const backend = body.backend || cfg.defaultBackend;
  const model = body.model || '';
  const permission = ['readonly', 'edit', 'all'].includes(body.permission) ? body.permission : 'edit';
  const skill = store.getSkills().find((s) => s.id === body.skillId) || null;
  const project = conv.projectId ? store.getProjects().find((p) => p.id === conv.projectId) : null;
  const ws = store.workspaceFor(conv.id);
  const attachments = (body.attachments || []).filter((a) => fs.existsSync(path.join(ws, a)));
  const text = String(body.text || '').trim();
  if (!text && !attachments.length) throw Object.assign(new Error('内容为空'), { status: 400 });

  const userMsg = {
    id: store.newId(), role: 'user', text, attachments, skillId: skill?.id || null, createdAt: Date.now(),
  };
  const prior = conv.messages.slice();
  conv.messages.push(userMsg);
  if (!prior.length) {
    const t = text.replace(/\s+/g, ' ').slice(0, 28) || (skill ? skill.name : '附件分析');
    conv.title = (skill && !text.startsWith(skill.name) ? skill.name + '：' : '') + t;
  }
  conv.updatedAt = Date.now();
  store.saveConversation(conv);

  const job = {
    controller: new AbortController(), parts: [], status: '启动中…', listeners: new Set(),
    backend, model, startedAt: Date.now(),
  };
  running.set(conv.id, job);
  const emit = (ev) => {
    if (ev.t === 'status') job.status = ev.d; else applyEvent(job.parts, ev);
    const line = `data: ${JSON.stringify(ev)}\n\n`;
    for (const res of job.listeners) res.write(line);
  };

  (async () => {
    // 等调用方把 SSE 连接挂上再开始，否则同步抛出的错误会在没有监听者时就结束
    await new Promise((r) => setImmediate(r));
    let result = {};
    let error = null;
    try {
      if (CLI_BACKENDS.includes(backend)) {
        const cwd = project?.folder || ws;
        const addDirs = project?.folder ? [ws] : [];
        const sess = conv.sessions?.[backend];
        const resume = sess && conv.lastBackend === backend && sess.cwd === cwd ? sess.id : null;
        const systemPrompt = buildSystemPrompt({ skill, project, ws, isCli: true });
        let prompt = (text || '请处理附件材料。') + attachmentNote(ws, attachments);
        if (!resume && prior.length) {
          prompt = `以下是本对话此前的记录，供你了解上下文：\n\n${transcriptOf(prior)}\n\n——以上为历史记录——\n\n现在用户的新消息：\n${prompt}`;
        }
        if (backend === 'claude' || backend === 'codebuddy') {
          const run = backend === 'claude' ? runClaude : runCodeBuddy;
          result = await run({ prompt, systemPrompt, cwd, addDirs, sessionId: resume, model, permission, cfg: cfg[backend] },
            emit, job.controller.signal);
        } else {
          // Codex 没有追加系统提示的参数：新会话时把说明放在消息最前面，续聊时只带上本轮技能
          if (!resume) prompt = `<instructions>\n${systemPrompt}\n</instructions>\n\n${prompt}`;
          else if (skill) prompt = `${skill.prompt}\n\n${prompt}`;
          const images = attachments.filter((a) => /\.(png|jpe?g|gif|webp)$/i.test(a)).map((a) => path.join(ws, a));
          result = await runCodex({ prompt, cwd, addDirs: [ws], sessionId: resume, model, permission, images, cfg: cfg.codex },
            emit, job.controller.signal);
        }
        if (result.sessionId) conv.sessions = { ...conv.sessions, [backend]: { id: result.sessionId, cwd } };
      } else if (backend.startsWith('api:')) {
        const provider = cfg.providers.find((p) => 'api:' + p.id === backend);
        if (!provider) throw new Error('找不到这个 API 配置，可能已被删除。');
        const useModel = model || provider.models[0];
        if (!useModel) throw new Error(`「${provider.name}」还没有填写模型名称。`);
        job.model = useModel;
        emit({ t: 'status', d: attachments.length ? '正在读取附件…' : '连接中…' });
        const messages = await apiMessages(conv, ws);
        const systemPrompt = buildSystemPrompt({ skill, project, ws, isCli: false });
        const run = provider.type === 'anthropic' ? runAnthropic : runOpenAI;
        result = await run({ provider, model: useModel, systemPrompt, messages }, emit, job.controller.signal);
      } else {
        throw new Error('未知的模型来源：' + backend);
      }
    } catch (err) {
      if (!job.controller.signal.aborted) error = err.name === 'AbortError' ? null : err.message || String(err);
    }

    if (job.controller.signal.aborted) emit({ t: 'notice', d: '已停止' });
    if (error) emit({ t: 'error', d: error });

    // 重新读取，避免覆盖运行期间的重命名等操作
    const fresh = store.getConversation(conv.id) || conv;
    const userInFresh = fresh.messages.find((m) => m.id === userMsg.id);
    if (userInFresh && userMsg.context) userInFresh.context = userMsg.context;
    fresh.messages.push({
      id: store.newId(), role: 'assistant', parts: job.parts, backend, model: job.model,
      createdAt: Date.now(), durationMs: Date.now() - job.startedAt, error: !!error,
    });
    fresh.sessions = conv.sessions;
    fresh.lastBackend = error ? fresh.lastBackend : backend;
    fresh.updatedAt = Date.now();
    store.saveConversation(fresh);
    running.delete(conv.id);
    const doneLine = `data: ${JSON.stringify({ t: 'done' })}\n\n`;
    for (const res of job.listeners) { res.write(doneLine); res.end(); }
  })();

  return { conv, job, userMsg };
}

// ---------------- HTTP ----------------

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('文件太大'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
const readJSON = async (req) => JSON.parse((await readBody(req)).toString('utf8') || '{}');

function safeRel(rel) {
  const parts = String(rel).split(/[\\/]+/).filter((p) => p && p !== '.' && p !== '..')
    .map((p) => p.replace(/[\x00-\x1f]/g, '').slice(0, 120));
  return parts.join('/');
}

function serveFile(res, abs, download) {
  fs.stat(abs, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    const headers = {
      'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size, 'Cache-Control': 'no-store',
    };
    if (download) headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(abs))}`;
    res.writeHead(200, headers);
    fs.createReadStream(abs).pipe(res);
  });
}

function revealInFinder(target) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  spawn(cmd, [target], { detached: true, stdio: 'ignore' }).unref();
}

async function handleApi(req, res, url) {
  const m = (re) => url.pathname.match(re);
  const method = req.method;
  let r;

  if (url.pathname === '/api/state' && method === 'GET') {
    if (url.searchParams.get('refresh')) refreshClis();
    const projects = store.getProjects();
    return send(res, 200, {
      config: store.publicConfig(), clis: CLIS, skills: store.getSkills(), examples: EXAMPLES,
      projects, memory: store.getMemory(), dataDir: store.DATA_DIR, platform: process.platform, version: VERSION,
      conversations: store.listConversations().map((c) => ({ ...c, running: running.has(c.id) })),
    });
  }
  if (url.pathname === '/api/config' && method === 'POST') {
    store.saveConfig(await readJSON(req));
    refreshClis();
    return send(res, 200, { config: store.publicConfig(), clis: CLIS });
  }
  if (url.pathname === '/api/memory' && method === 'POST') {
    const { memory, enabled } = await readJSON(req);
    store.saveMemory(memory);
    if (typeof enabled === 'boolean') store.saveConfig({ ...store.getConfig(), memoryEnabled: enabled });
    return send(res, 200, { ok: true });
  }
  if (url.pathname === '/api/skills' && method === 'POST') {
    const { skills, reset } = await readJSON(req);
    if (reset) store.resetSkills(); else store.saveSkills(skills);
    return send(res, 200, { skills: store.getSkills() });
  }
  if (url.pathname === '/api/projects' && method === 'POST') {
    try { return send(res, 200, { project: store.saveProject(await readJSON(req)) }); }
    catch (e) { return send(res, 400, { error: e.message }); }
  }
  if ((r = m(/^\/api\/projects\/([a-z0-9]+)$/)) && method === 'DELETE') {
    store.deleteProject(r[1]);
    return send(res, 200, { ok: true });
  }
  if ((r = m(/^\/api\/projects\/([a-z0-9]+)\/reveal$/)) && method === 'POST') {
    const p = store.getProjects().find((x) => x.id === r[1]);
    if (p?.folder) revealInFinder(p.folder);
    return send(res, 200, { ok: true });
  }
  if (url.pathname === '/api/conversations' && method === 'POST') {
    const body = await readJSON(req);
    return send(res, 200, { conversation: store.createConversation({ projectId: body.projectId || null }) });
  }
  if ((r = m(/^\/api\/conversations\/([a-z0-9]{16})$/))) {
    const id = r[1];
    if (method === 'GET') {
      const conv = store.getConversation(id);
      if (!conv) return send(res, 404, { error: '对话不存在' });
      const job = running.get(id);
      for (const msg of conv.messages) delete msg.context;
      return send(res, 200, {
        conversation: conv, files: store.listWorkspaceFiles(id),
        live: job ? { parts: job.parts, status: job.status, backend: job.backend, model: job.model } : null,
      });
    }
    if (method === 'PATCH') {
      const body = await readJSON(req);
      const conv = store.getConversation(id);
      if (!conv) return send(res, 404, { error: '对话不存在' });
      if (typeof body.title === 'string') conv.title = body.title.slice(0, 80) || conv.title;
      if (typeof body.pinned === 'boolean') conv.pinned = body.pinned;
      if ('projectId' in body) conv.projectId = body.projectId || null;
      store.saveConversation(conv);
      return send(res, 200, { ok: true });
    }
    if (method === 'DELETE') {
      running.get(id)?.controller.abort();
      store.deleteConversation(id);
      return send(res, 200, { ok: true });
    }
  }
  if ((r = m(/^\/api\/conversations\/([a-z0-9]{16})\/stop$/)) && method === 'POST') {
    running.get(r[1])?.controller.abort();
    return send(res, 200, { ok: true });
  }
  if ((r = m(/^\/api\/conversations\/([a-z0-9]{16})\/reveal$/)) && method === 'POST') {
    revealInFinder(store.workspaceFor(r[1]));
    return send(res, 200, { ok: true });
  }
  if ((r = m(/^\/api\/conversations\/([a-z0-9]{16})\/upload$/)) && method === 'POST') {
    if (!store.getConversation(r[1])) return send(res, 404, { error: '对话不存在' });
    const ws = store.workspaceFor(r[1]);
    let rel = safeRel(url.searchParams.get('name') || 'file');
    if (!rel) rel = 'file';
    const data = await readBody(req, 300 * 1024 * 1024);
    let target = path.join(ws, '附件', rel);
    const { dir, name, ext } = path.parse(target);
    for (let i = 2; fs.existsSync(target); i++) target = path.join(dir, `${name} (${i})${ext}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
    return send(res, 200, { path: path.relative(ws, target).split(path.sep).join('/'), size: data.length });
  }
  if (url.pathname === '/api/chat' && method === 'POST') {
    const body = await readJSON(req);
    let started;
    try { started = await startChat(body); }
    catch (e) { return send(res, e.status || 500, { error: e.message }); }
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ t: 'start', conversationId: started.conv.id, title: started.conv.title, userMsg: started.userMsg })}\n\n`);
    started.job.listeners.add(res);
    req.on('close', () => started.job.listeners.delete(res));
    return;
  }
  if (url.pathname === '/api/update' && method === 'GET') {
    return send(res, 200, await checkUpdate({ force: !!url.searchParams.get('force') }));
  }
  if (url.pathname === '/api/update' && method === 'POST') {
    return send(res, 200, updateSettings(await readJSON(req)));
  }
  if (url.pathname === '/api/test' && method === 'POST') {
    const { backend, model } = await readJSON(req);
    return send(res, 200, await testBackend(backend, model));
  }
  if (url.pathname === '/api/pick-folder' && method === 'POST') {
    if (process.platform !== 'darwin') return send(res, 200, { path: null, unsupported: true });
    execFile('osascript', ['-e', 'activate', '-e', 'POSIX path of (choose folder with prompt "选择案卷文件夹")'],
      (err, out) => send(res, 200, { path: err ? null : out.trim().replace(/\/$/, '') }));
    return;
  }
  send(res, 404, { error: 'not found' });
}

// 「模型与连接」页面的测试按钮：发一句话看能不能拿到回复
async function testBackend(backend, model) {
  const cfg = store.getConfig();
  const t0 = Date.now();
  let text = '';
  const emit = (ev) => { if (ev.t === 'text') text += ev.d; };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  const prompt = '这是连通性测试，只回复两个字：正常';
  try {
    const dir = path.join(store.DATA_DIR, 'test');
    fs.mkdirSync(dir, { recursive: true });
    if (backend === 'claude' || backend === 'codebuddy') {
      const run = backend === 'claude' ? runClaude : runCodeBuddy;
      await run({ prompt, systemPrompt: '', cwd: dir, model, permission: 'readonly', cfg: cfg[backend] }, emit, controller.signal);
    } else if (backend === 'codex') {
      await runCodex({ prompt, cwd: dir, model, permission: 'readonly', ephemeral: true, cfg: cfg.codex }, emit, controller.signal);
    } else {
      const provider = cfg.providers.find((p) => 'api:' + p.id === backend);
      if (!provider) throw new Error('请先保存这个 API 配置');
      const useModel = model || provider.models[0];
      if (!useModel) throw new Error('请填写至少一个模型名称');
      const run = provider.type === 'anthropic' ? runAnthropic : runOpenAI;
      await run({ provider, model: useModel, systemPrompt: '你是一个简洁的助手。', messages: [{ role: 'user', content: prompt }] },
        emit, controller.signal);
    }
    if (controller.signal.aborted) throw new Error('等待超过 120 秒，已放弃');
    if (!text.trim()) throw new Error('连接成功但没有收到文字回复');
    return { ok: true, text: text.trim().slice(0, 200), ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: controller.signal.aborted ? '等待超过 120 秒，已放弃' : e.message, ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

const server = http.createServer(async (req, res) => {
  // 只接受本机访问，防止 DNS 重绑定和其他网页伪造请求
  const host = (req.headers.host || '').replace(/:\d+$/, '');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) { res.writeHead(403); res.end('Forbidden'); return; }
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.headers['x-lawdesk'] !== '1') { res.writeHead(403); res.end('Forbidden'); return; }
      return await handleApi(req, res, url);
    }
    let r;
    if ((r = url.pathname.match(/^\/files\/([a-z0-9]{16})\/(.+)$/))) {
      const ws = path.join(store.WS_DIR, r[1]);
      const abs = path.join(ws, safeRel(decodeURIComponent(r[2])));
      if (!abs.startsWith(ws + path.sep)) { res.writeHead(403); res.end(); return; }
      return serveFile(res, abs, url.searchParams.has('download'));
    }
    const rel = url.pathname === '/' ? 'index.html' : safeRel(decodeURIComponent(url.pathname));
    return serveFile(res, path.join(PUBLIC, rel));
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.message });
  }
});

// 启动时清理超过一天的空对话（打开首页上传附件但没发送时会产生）
for (const c of store.listConversations()) {
  const full = store.getConversation(c.id);
  if (full && !full.messages.length && Date.now() - full.createdAt > 86400000) store.deleteConversation(c.id);
}
function shutdown() {
  for (const job of running.values()) job.controller.abort();
  server.close();
  // 给正在运行的 claude / codex 子进程一点时间收到终止信号
  setTimeout(() => process.exit(0), running.size ? 800 : 0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
// 作为 Mac 客户端的子进程运行时，客户端异常退出也要跟着退出
const parentPid = Number(process.env.LAWDESK_PARENT_PID);
if (parentPid) {
  setInterval(() => { try { process.kill(parentPid, 0); } catch { shutdown(); } }, 2000).unref();
}

await shellEnvReady;
refreshClis();

server.listen(PORT, '127.0.0.1', () => {
  const port = server.address().port;
  const link = `http://127.0.0.1:${port}`;
  console.log(`\n  律台 v${VERSION} · 本地法律智能体已启动：${link}`);
  console.log(`  Claude Code：${CLIS.claude.found ? CLIS.claude.version + '（' + CLIS.claude.path + '）' : '未找到'}`);
  console.log(`  Codex：${CLIS.codex.found ? CLIS.codex.version + '（' + CLIS.codex.path + '）' : '未找到'}`);
  console.log(`  WorkBuddy：${CLIS.codebuddy.found ? CLIS.codebuddy.version + '（' + CLIS.codebuddy.path + '）' : '未找到'}`);
  console.log(`  数据目录：${store.DATA_DIR}\n  按 Ctrl+C 退出\n`);
  console.log(`LAWDESK_READY ${port}`);
  if (!process.env.NO_OPEN && process.stdout.isTTY) revealInFinder(link);
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`端口 ${PORT} 已被占用，可以用 PORT=其他端口 npm start 启动。`);
  else console.error(e);
  process.exit(1);
});
