// 本机已安装的命令行智能体：Claude Code（claude -p）和 Codex（codex exec）。
// 两者都以 JSONL 事件流输出，这里统一转换成前端用的事件：
//   {t:'text', d}  {t:'tool', id, name, input, status, output}  {t:'status', d}  {t:'notice', d}  {t:'error', d}
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile, execFileSync } from 'node:child_process';

const HOME = os.homedir();

// 从访达打开的 Mac 客户端拿不到 ~/.zshrc 里的 PATH 和环境变量（nvm、API Key 等），
// 这里跑一次登录 shell 把它们读回来，只补充当前进程没有的变量。
const SHELL_ENV_SKIP = new Set(['PWD', 'OLDPWD', 'SHLVL', '_', 'TERM_SESSION_ID', 'TMPDIR']);
function loadShellEnv() {
  if (process.env.LAWDESK_APP !== '1' || process.platform === 'win32') return Promise.resolve();
  const shell = process.env.SHELL || '/bin/zsh';
  const marker = '__LAWDESK_ENV__';
  return new Promise((resolve) => {
    execFile(shell, ['-ilc', `printf '%s' ${marker}; env -0`], { timeout: 8000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout) => {
        const i = (stdout || '').indexOf(marker);
        if (i >= 0) {
          for (const entry of stdout.slice(i + marker.length).split('\0')) {
            const eq = entry.indexOf('=');
            if (eq <= 0) continue;
            const k = entry.slice(0, eq);
            const v = entry.slice(eq + 1);
            if (SHELL_ENV_SKIP.has(k)) continue;
            if (k === 'PATH') process.env.PATH = [...new Set([...v.split(':'), ...(process.env.PATH || '').split(':')])].filter(Boolean).join(':');
            else if (!(k in process.env)) process.env[k] = v;
          }
        }
        resolve();
      });
  });
}
export const shellEnvReady = loadShellEnv();

const IS_WIN = process.platform === 'win32';
const EXTRA_PATHS = IS_WIN
  ? [
      path.join(HOME, '.local', 'bin'),
      process.env.APPDATA && path.join(process.env.APPDATA, 'npm'),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'pnpm'),
      path.join(HOME, 'scoop', 'shims'),
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'nodejs'),
    ].filter(Boolean)
  : [
      path.dirname(process.execPath),
      path.join(HOME, '.local/bin'),
      path.join(HOME, '.npm-global/bin'),
      path.join(HOME, '.bun/bin'),
      path.join(HOME, '.volta/bin'),
      path.join(HOME, '.claude/local'),
      '/opt/homebrew/bin',
      '/usr/local/bin',
    ];
// Windows 上可执行文件要带扩展名；npm 全局安装的命令是 .cmd 包装脚本
const WIN_EXTS = ['.exe', '.cmd', '.bat', '.com'];

// Windows 的环境变量名不区分大小写，复制出来的对象里通常叫 Path
const pathKey = (env) => Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';

function searchPath() {
  const parts = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const p of EXTRA_PATHS) if (!parts.includes(p)) parts.push(p);
  return parts;
}

function findBin(name) {
  for (const dir of searchPath()) {
    for (const ext of IS_WIN ? WIN_EXTS : ['']) {
      const p = path.join(dir, name + ext);
      try {
        if (IS_WIN) { if (fs.statSync(p).isFile()) return p; } else { fs.accessSync(p, fs.constants.X_OK); return p; }
      } catch {}
    }
  }
  return null;
}

// Electron 客户端里服务是用 ELECTRON_RUN_AS_NODE 跑起来的，process.execPath 是 Electron 本身
const RUNTIME_IS_ELECTRON = !!process.versions.electron;
function nodeRuntime() {
  return findBin('node') || process.execPath;
}

// npm 生成的 .cmd 包装脚本里写着真正要运行的文件：node 脚本（.js，或没有扩展名、
// 靠 #!/usr/bin/env node 运行的文件）或原生 .exe（直接跑，例如新版 Claude Code）。
// 绕开 cmd.exe，是因为长提示词里的换行、引号、& 等字符在 cmd.exe 里没法可靠转义。
// 注意 node 脚本的包装里还会出现 "%dp0%\node.exe"，那是解释器，不是目标。
export function shimTarget(cmdFile, text) {
  if (text === undefined) {
    try { text = fs.readFileSync(cmdFile, 'utf8'); } catch { return null; }
  }
  const targets = [...text.matchAll(/"%~?dp0%?\\([^"%]+)"/gi)]
    .map((m) => m[1])
    .filter((t) => !/(^|\\)node\.exe$/i.test(t) && !/\.(cmd|bat|ps1)$/i.test(t));
  const rel = targets.find((t) => /\.[cm]?js$/i.test(t)) || targets[0];
  if (!rel) return null;
  return path.join(path.dirname(cmdFile), ...rel.split('\\'));
}

// 返回 { cmd, pre, path }：实际执行 cmd，参数前面加上 pre
export function resolveCli(name, override) {
  const bin = override ? (fs.existsSync(override) ? override : null) : findBin(name);
  if (!bin) return null;
  if (/\.[cm]?js$/i.test(bin)) return { cmd: nodeRuntime(), pre: [bin], path: bin };
  if (IS_WIN && /\.(cmd|bat)$/i.test(bin)) {
    const target = shimTarget(bin);
    if (!target || !fs.existsSync(target)) {
      return { cmd: null, pre: [], path: bin, error: `无法解析 ${bin}，请在「模型与连接」里填写 ${name}.exe 或其 .js 入口文件的完整路径。` };
    }
    if (/\.exe$/i.test(target)) return { cmd: target, pre: [], path: bin };
    return { cmd: nodeRuntime(), pre: [target], path: bin };
  }
  // Windows 不能直接执行没有扩展名的 node 脚本（例如手动填写的 npm 包 bin 文件）
  if (IS_WIN && !/\.(exe|com)$/i.test(bin)) return { cmd: nodeRuntime(), pre: [bin], path: bin };
  return { cmd: bin, pre: [], path: bin };
}

// ---------------- 桌面 App 自带的引擎 ----------------
// 没有单独安装 Codex 命令行时，用 ChatGPT 桌面版（macOS）里自带的 Codex CLI，登录状态同样保存在 ~/.codex
function chatGptCodex() {
  if (process.platform !== 'darwin') return null;
  for (const app of ['/Applications/ChatGPT.app', path.join(HOME, 'Applications', 'ChatGPT.app')]) {
    const bin = path.join(app, 'Contents', 'Resources', 'codex-cli', 'CodexCLI.app', 'Contents', 'MacOS', 'codex');
    if (fs.existsSync(bin)) return { cmd: bin, pre: [], path: bin, source: 'chatgpt' };
  }
  return null;
}

// 依次尝试：设置里填的路径 → 单独安装的命令行工具 → 桌面 App 自带的引擎
export function resolveEngine(kind, cfg = {}) {
  if (cfg.bin) return resolveCli(kind, cfg.bin);
  if (kind === 'codex') return resolveCli('codex') || chatGptCodex();
  return resolveCli(kind);
}

function parseEnvLines(text) {
  const out = {};
  for (const line of String(text || '').split('\n')) {
    const m = line.match(/^\s*(?:export\s+|set\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

// 用户在设置里填的环境变量优先
function runEnv(spec, extra) {
  const env = cliEnv('');
  if (RUNTIME_IS_ELECTRON && spec.cmd === process.execPath) env.ELECTRON_RUN_AS_NODE = '1';
  return Object.assign(env, parseEnvLines(extra));
}

export function detectCli(kind, cfg = {}) {
  const spec = resolveEngine(kind, cfg);
  if (!spec) return { found: false };
  let version = '';
  if (spec.cmd) {
    try {
      version = execFileSync(spec.cmd, [...spec.pre, '--version'], { env: runEnv(spec, cfg.env), timeout: 20000, encoding: 'utf8', windowsHide: true })
        .trim().split('\n').pop();
    } catch {}
  }
  return { found: true, path: spec.path, version, source: spec.source || 'cli' };
}

// 如果本服务是从另一个 Claude Code 会话里启动的，要去掉那个会话注入的变量，
// 否则子进程会继承宿主会话的认证信息和会话标识。
export function cliEnv(extra) {
  const env = {};
  const nested = process.env.CLAUDECODE === '1';
  for (const [k, v] of Object.entries(process.env)) {
    if (k === 'CLAUDECODE' || k.startsWith('CLAUDE_CODE_') || k.startsWith('CLAUDE_AGENT_SDK') ||
        k === 'CLAUDE_PID' || k === 'CLAUDE_EFFORT' || k === 'ELECTRON_RUN_AS_NODE') continue;
    if (nested && k.startsWith('ANTHROPIC_')) continue;
    env[k] = v;
  }
  env[pathKey(env)] = searchPath().join(path.delimiter);
  return Object.assign(env, parseEnvLines(extra));
}

function killTree(child) {
  if (IS_WIN) {
    // Windows 上 kill 只结束直接子进程，claude / codex 自己再起的进程会残留
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
    setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 3000);
  }
}

function spawnJsonl({ spec, args, cwd, env, stdin }, onEvent, signal) {
  return new Promise((resolve) => {
    const child = spawn(spec.cmd, [...spec.pre, ...args], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let buf = '';
    let stderr = '';
    const onAbort = () => killTree(child);
    signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        try { onEvent(JSON.parse(line)); } catch { /* 非 JSON 行忽略 */ }
      }
    });
    child.stderr.on('data', (c) => { stderr = (stderr + c.toString('utf8')).slice(-20000); });
    child.on('error', (err) => resolve({ code: -1, stderr: err.message }));
    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      if (buf.trim()) { try { onEvent(JSON.parse(buf.trim())); } catch {} }
      resolve({ code, stderr });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(stdin);
  });
}

const clip = (s, n = 4000) => {
  s = typeof s === 'string' ? s : JSON.stringify(s, null, 1);
  return s && s.length > n ? s.slice(0, n) + `\n…（共 ${s.length} 字，已截断）` : s || '';
};

function stderrTail(stderr) {
  return stderr.split('\n').filter((l) => l.trim() && !/^\d{4}-\d\d-\d\dT.*\b(WARN|INFO|DEBUG)\b/.test(l)).slice(-8).join('\n');
}

// ---------------- Claude Code ----------------

const CLAUDE_TOOL_NAMES = {
  Read: '读取文件', Write: '写入文件', Edit: '修改文件', MultiEdit: '修改文件', NotebookEdit: '修改笔记本',
  Bash: '执行命令', Glob: '查找文件', Grep: '搜索内容', LS: '列出目录', WebSearch: '联网搜索',
  WebFetch: '打开网页', TodoWrite: '更新计划', Task: '子任务', Agent: '子任务', Skill: '调用技能',
};

function summarizeClaudeInput(name, input = {}) {
  return input.file_path || input.path || input.command || input.pattern || input.query ||
    input.url || input.description || input.skill || (name === 'TodoWrite'
      ? (input.todos || []).map((t) => (t.status === 'completed' ? '✓ ' : '· ') + (t.content || '')).join('\n')
      : clip(input, 300));
}

function toolResultText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => (c.type === 'text' ? c.text : `[${c.type}]`)).join('\n');
  return '';
}

const READ_TOOLS = 'Read,Glob,Grep,LS,WebSearch,WebFetch,TodoWrite';
const EDIT_TOOLS = READ_TOOLS + ',Write,Edit,MultiEdit';

const CLAUDE_PERMISSION = {
  readonly: ['--permission-mode', 'dontAsk', '--allowedTools', READ_TOOLS],
  edit: ['--permission-mode', 'acceptEdits', '--allowedTools', EDIT_TOOLS],
  all: ['--dangerously-skip-permissions'],
};

export async function runClaude(opts, emit, signal) {
  const { prompt, systemPrompt, cwd, addDirs = [], sessionId, model, permission, cfg } = opts;
  const spec = resolveEngine('claude', cfg);
  if (!spec) throw new Error('没有找到 claude 命令。请先安装 Claude Code，或在「模型与连接」里填写 claude 的完整路径。');
  if (spec.error) throw new Error(spec.error);

  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages'];
  args.push(...(CLAUDE_PERMISSION[permission] || CLAUDE_PERMISSION.edit));
  for (const d of addDirs) args.push('--add-dir', d);
  if (systemPrompt) args.push('--append-system-prompt', systemPrompt);
  if (model) args.push('--model', model);
  if (sessionId) args.push('--resume', sessionId);

  let newSession = sessionId;
  let streamedText = false;
  let assistantText = '';
  let resultError = null;

  const { code, stderr } = await spawnJsonl({ spec, args, cwd, env: runEnv(spec, cfg.env), stdin: prompt }, (ev) => {
    if (ev.session_id) newSession = ev.session_id;
    switch (ev.type) {
      case 'system':
        if (ev.subtype === 'init') emit({ t: 'status', d: '已启动 Claude Code · ' + (ev.model || '默认模型') });
        else if (ev.subtype === 'status' && ev.status === 'requesting') emit({ t: 'status', d: '等待模型响应…' });
        else if (ev.subtype === 'api_retry') {
          emit({ t: 'status', d: `连接模型服务失败（${ev.error_status || ev.error || '网络错误'}），正在重试 ${ev.attempt}/${ev.max_retries}…` });
        }
        break;
      case 'stream_event': {
        const e = ev.event || {};
        if (e.type === 'content_block_delta') {
          if (e.delta?.type === 'text_delta') { streamedText = true; emit({ t: 'text', d: e.delta.text }); }
          else if (e.delta?.type === 'thinking_delta') emit({ t: 'status', d: '思考中…' });
        } else if (e.type === 'content_block_start' && e.content_block?.type === 'tool_use') {
          emit({ t: 'status', d: '准备' + (CLAUDE_TOOL_NAMES[e.content_block.name] || e.content_block.name) + '…' });
        }
        break;
      }
      case 'assistant': {
        const msg = ev.message || {};
        if (msg.model === '<synthetic>') break; // 认证失败等本地合成消息，交给 result 报错
        for (const block of msg.content || []) {
          if (block.type === 'text' && block.text) assistantText = block.text;
          if (block.type === 'text' && !streamedText && block.text) emit({ t: 'text', d: block.text });
          if (block.type === 'tool_use') {
            emit({ t: 'tool', id: block.id, name: CLAUDE_TOOL_NAMES[block.name] || block.name,
              input: summarizeClaudeInput(block.name, block.input), status: 'running' });
          }
        }
        break;
      }
      case 'user':
        for (const block of ev.message?.content || []) {
          if (block.type === 'tool_result') {
            emit({ t: 'tool', id: block.tool_use_id, status: block.is_error ? 'error' : 'done',
              output: clip(toolResultText(block.content)) });
          }
        }
        break;
      case 'result':
        if (ev.is_error || (ev.subtype && ev.subtype !== 'success')) {
          // 有时 result 为空，原因只写在上一条助手消息里
          resultError = ev.result || (ev.errors || []).join('\n') || assistantText || ev.subtype;
        }
        break;
    }
  }, signal);

  if (signal?.aborted) return { sessionId: newSession };
  if (resultError) throw new Error(explainClaudeError(resultError));
  if (code !== 0) throw new Error(explainClaudeError(stderrTail(stderr) || `claude 退出码 ${code}`));
  return { sessionId: newSession };
}

function explainClaudeError(msg) {
  if (/authenticat|401|login|API key/i.test(msg)) {
    return msg + '\n\nClaude Code 未登录或 API 配置无效：请在终端运行 `claude` 完成登录，或在「模型与连接」里为 Claude Code 填写 ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN 等环境变量。';
  }
  if (/ECONNREFUSED|fetch failed|Unable to connect/i.test(msg)) {
    return msg + '\n\n无法连接模型服务。如果你的 Claude Code 配置了本地代理（ANTHROPIC_BASE_URL），请确认代理已启动。';
  }
  return msg;
}

// ---------------- Codex ----------------

const CODEX_PERMISSION_NEW = {
  readonly: ['-s', 'read-only'],
  edit: ['-s', 'workspace-write'],
  all: ['--dangerously-bypass-approvals-and-sandbox'],
};

// 这几类是 Codex 对本机配置的提醒，不影响回答，不展示给用户
const CODEX_NOISE = /unrecognized configuration|skills context budget|failed to load skill/i;

// configArgs / extraEnv：用 ChatGPT 套餐时，换成律台登录得到的令牌和对应的模型提供方（见 lib/chatgpt.js）
export async function runCodex(opts, emit, signal) {
  const { prompt, cwd, addDirs = [], sessionId, model, permission, images = [], ephemeral, cfg, configArgs = [], extraEnv } = opts;
  const spec = resolveEngine('codex', cfg);
  if (!spec) throw new Error('没有找到 codex 命令。请先安装 Codex CLI（npm i -g @openai/codex），或在「模型与连接」里填写 codex 的完整路径。');
  if (spec.error) throw new Error(spec.error);

  const args = ['exec'];
  if (sessionId) {
    args.push('resume', '--json', '--skip-git-repo-check');
    if (permission === 'all') args.push('--dangerously-bypass-approvals-and-sandbox');
    else {
      args.push('-c', `sandbox_mode="${permission === 'readonly' ? 'read-only' : 'workspace-write'}"`);
      if (permission !== 'readonly' && addDirs.length) {
        args.push('-c', `sandbox_workspace_write.writable_roots=${JSON.stringify(addDirs)}`);
      }
    }
  } else {
    args.push('--json', '--skip-git-repo-check', '-C', cwd);
    args.push(...(CODEX_PERMISSION_NEW[permission] || CODEX_PERMISSION_NEW.edit));
    if (permission !== 'readonly') for (const d of addDirs) args.push('--add-dir', d);
  }
  args.push(...configArgs);
  for (const img of images) args.push('-i', img);
  if (ephemeral) args.push('--ephemeral');
  if (model) args.push('-m', model);
  if (sessionId) args.push(sessionId);
  args.push('-');

  let newSession = sessionId;
  let failed = null;
  let lastWasText = false;

  const env = Object.assign(runEnv(spec, extraEnv ? '' : cfg.env), extraEnv || {});
  const { code, stderr } = await spawnJsonl({ spec, args, cwd, env, stdin: prompt }, (ev) => {
    const item = ev.item || {};
    switch (ev.type) {
      case 'thread.started':
        newSession = ev.thread_id;
        emit({ t: 'status', d: '已连接 Codex' });
        break;
      case 'turn.started':
        emit({ t: 'status', d: '思考中…' });
        break;
      case 'item.started':
      case 'item.updated':
      case 'item.completed': {
        const done = ev.type === 'item.completed';
        if (item.type === 'agent_message' && done) {
          emit({ t: 'text', d: (lastWasText ? '\n\n' : '') + (item.text || '') });
          lastWasText = true;
          return;
        }
        if (item.type === 'reasoning') { emit({ t: 'status', d: '思考中…' }); return; }
        if (item.type === 'error') {
          if (!CODEX_NOISE.test(item.message || '')) emit({ t: 'notice', d: item.message });
          return;
        }
        const tool = codexTool(item, done);
        if (tool) { emit({ t: 'tool', ...tool }); lastWasText = false; }
        break;
      }
      case 'turn.failed':
        failed = ev.error?.message || '运行失败';
        break;
      case 'error':
        failed = ev.message || '运行失败';
        break;
    }
  }, signal);

  if (signal?.aborted) return { sessionId: newSession };
  if (failed) throw new Error(failed);
  if (code !== 0) throw new Error(stderrTail(stderr) || `codex 退出码 ${code}`);
  return { sessionId: newSession };
}

function codexTool(item, done) {
  const base = { id: item.id };
  switch (item.type) {
    case 'command_execution': {
      const cmd = String(item.command || '')
        .replace(/^\/bin\/(?:ba|z)?sh -l?c (['"])(.*)\1$/s, '$2')
        .replace(/^"?[^"]*?powershell(?:\.exe)?"?\s+(?:-NoProfile\s+)?-Command\s+(['"])(.*)\1$/is, '$2');
      return { ...base, name: '执行命令', input: cmd,
        status: !done ? 'running' : item.exit_code === 0 ? 'done' : 'error',
        output: done ? clip(item.aggregated_output || '') : undefined };
    }
    case 'file_change':
      return { ...base, name: '修改文件',
        input: (item.changes || []).map((c) => `${c.kind === 'add' ? '新建' : c.kind === 'delete' ? '删除' : '修改'} ${c.path}`).join('\n'),
        status: !done ? 'running' : item.status === 'failed' ? 'error' : 'done' };
    case 'web_search':
      return { ...base, name: '联网搜索', input: item.query || '', status: done ? 'done' : 'running' };
    case 'mcp_tool_call':
      return { ...base, name: `${item.server || 'MCP'} · ${item.tool || ''}`, input: clip(item.arguments || '', 300),
        status: !done ? 'running' : item.status === 'failed' ? 'error' : 'done',
        output: done ? clip(item.result?.content ? toolResultText(item.result.content) : item.error?.message || '') : undefined };
    case 'todo_list':
      return { ...base, name: '更新计划',
        input: (item.items || []).map((t) => (t.completed ? '✓ ' : '· ') + t.text).join('\n'), status: 'done' };
    default:
      return null;
  }
}
