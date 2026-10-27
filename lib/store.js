// 本地数据存储：全部是 data/ 目录下的 JSON / Markdown 文件，没有数据库、没有账号。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SKILLS } from './skills.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.resolve(process.env.LAWDESK_HOME || path.join(ROOT, 'data'));
const CONV_DIR = path.join(DATA_DIR, 'conversations');
export const WS_DIR = path.join(DATA_DIR, 'workspaces');

for (const d of [DATA_DIR, CONV_DIR, WS_DIR]) fs.mkdirSync(d, { recursive: true });

const file = (name) => path.join(DATA_DIR, name);

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function writeJSON(p, value) {
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, p);
}

export const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);

// ---------- 配置 ----------
const DEFAULT_CONFIG = {
  defaultBackend: 'claude',
  defaultModel: '',
  defaultPermission: 'edit',
  claude: { enabled: true, bin: '', models: ['sonnet', 'opus', 'haiku'], env: '' },
  codex: { enabled: true, bin: '', models: [], env: '' },
  // WorkBuddy：用 WorkBuddy 桌面版自带的 CodeBuddy 引擎，或单独安装的 codebuddy 命令行；
  // region 为 cn（中国版）/ intl（国际版），apiKey 是在 CodeBuddy 官网创建的 API Key
  codebuddy: { enabled: true, bin: '', models: ['glm-5.1', 'kimi-k2.5', 'deepseek-v3-2-volc'], env: '', apiKey: '', region: 'cn' },
  // ChatGPT 套餐（登录信息在 chatgpt/ 目录）：useCodex 为有 Codex 时交给 Codex 执行；bannerDismissed 为首页邀请横幅已关闭
  chatgpt: { useCodex: true, bannerDismissed: false },
  // 自有 API：可以添加多个，type 为 openai（OpenAI 兼容）或 anthropic
  providers: [],
  memoryEnabled: true,
  autoUpdateCheck: true,
};

export function getConfig() {
  const saved = readJSON(file('config.json'), {});
  return {
    ...DEFAULT_CONFIG,
    ...saved,
    claude: { ...DEFAULT_CONFIG.claude, ...(saved.claude || {}) },
    codex: { ...DEFAULT_CONFIG.codex, ...(saved.codex || {}) },
    codebuddy: { ...DEFAULT_CONFIG.codebuddy, ...(saved.codebuddy || {}) },
    chatgpt: { ...DEFAULT_CONFIG.chatgpt, ...(saved.chatgpt || {}) },
    providers: saved.providers || [],
  };
}

export function saveConfig(next) {
  const prev = getConfig();
  // 前端拿到的是打码后的 key；没改动时保留原 key
  const providers = (next.providers || []).map((p) => {
    const old = prev.providers.find((o) => o.id === p.id);
    const apiKey = p.apiKey && !p.apiKey.includes('••') ? p.apiKey : old?.apiKey || '';
    return {
      id: p.id || newId(),
      name: String(p.name || '自定义 API').slice(0, 40),
      type: p.type === 'anthropic' ? 'anthropic' : 'openai',
      baseUrl: String(p.baseUrl || '').trim().replace(/\/+$/, ''),
      apiKey: apiKey.trim(),
      models: (p.models || []).map((m) => String(m).trim()).filter(Boolean),
      maxTokens: Number(p.maxTokens) || 8192,
    };
  });
  const codebuddy = { ...prev.codebuddy, ...(next.codebuddy || {}) };
  codebuddy.apiKey = String(codebuddy.apiKey || '').includes('••') ? prev.codebuddy.apiKey : String(codebuddy.apiKey || '').trim();
  const merged = { ...prev, ...next, providers, codebuddy };
  writeJSON(file('config.json'), merged);
  return merged;
}

export function publicConfig(cfg = getConfig()) {
  const mask = (k) => (k ? '••••' + k.slice(-4) : '');
  return {
    ...cfg,
    codebuddy: { ...cfg.codebuddy, apiKey: mask(cfg.codebuddy.apiKey) },
    providers: cfg.providers.map((p) => ({
      ...p,
      apiKey: p.apiKey ? '••••' + p.apiKey.slice(-4) : '',
    })),
  };
}

// 检查更新的结果（上次检查时间、最新版本、用户忽略的版本）
export const getUpdateState = () => readJSON(file('update.json'), {});
export const saveUpdateState = (s) => writeJSON(file('update.json'), s);

// ---------- 记忆 ----------
export const getMemory = () => {
  try { return fs.readFileSync(file('memory.md'), 'utf8'); } catch { return ''; }
};
export const saveMemory = (text) => fs.writeFileSync(file('memory.md'), String(text || ''));

// ---------- 技能 ----------
export function getSkills() {
  const custom = readJSON(file('skills.json'), null);
  return custom || DEFAULT_SKILLS;
}
export function saveSkills(list) {
  writeJSON(file('skills.json'), list);
}
export function resetSkills() {
  try { fs.unlinkSync(file('skills.json')); } catch {}
}

// ---------- 项目 ----------
export const getProjects = () => readJSON(file('projects.json'), []);
export function saveProject(p) {
  const list = getProjects();
  const folder = String(p.folder || '').trim().replace(/^~(?=\/|$)/, process.env.HOME || '~');
  if (folder && !fs.existsSync(folder)) throw new Error('文件夹不存在：' + folder);
  const item = {
    id: p.id || newId(),
    name: String(p.name || '未命名项目').slice(0, 60),
    folder,
    instructions: String(p.instructions || ''),
    createdAt: p.createdAt || Date.now(),
  };
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = { ...list[i], ...item }; else list.unshift(item);
  writeJSON(file('projects.json'), list);
  return item;
}
export function deleteProject(id) {
  writeJSON(file('projects.json'), getProjects().filter((p) => p.id !== id));
  for (const c of listConversations()) {
    if (c.projectId === id) { const full = getConversation(c.id); full.projectId = null; saveConversation(full); }
  }
}

// ---------- 对话 ----------
const convPath = (id) => {
  if (!/^[a-z0-9]{16}$/.test(id)) throw new Error('bad id');
  return path.join(CONV_DIR, id + '.json');
};

export function listConversations() {
  return fs.readdirSync(CONV_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJSON(path.join(CONV_DIR, f), null))
    .filter(Boolean)
    .map(({ id, title, createdAt, updatedAt, pinned, projectId, lastBackend, messages }) =>
      ({ id, title, createdAt, updatedAt, pinned, projectId, lastBackend, count: messages?.length || 0 }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createConversation({ projectId = null, title = '新对话' } = {}) {
  const c = {
    id: newId(), title, projectId, pinned: false,
    createdAt: Date.now(), updatedAt: Date.now(),
    sessions: {}, lastBackend: null, messages: [],
  };
  saveConversation(c);
  return c;
}

export const getConversation = (id) => readJSON(convPath(id), null);
export function saveConversation(c) {
  writeJSON(convPath(c.id), c);
  return c;
}
export function deleteConversation(id) {
  fs.rmSync(convPath(id), { force: true });
  fs.rmSync(path.join(WS_DIR, id), { recursive: true, force: true });
}

// 每个对话都有自己的工作区：附件/ 放上传的材料，输出/ 放智能体生成的文件
export function workspaceFor(id) {
  const ws = path.join(WS_DIR, id);
  fs.mkdirSync(path.join(ws, '附件'), { recursive: true });
  fs.mkdirSync(path.join(ws, '输出'), { recursive: true });
  return ws;
}

export function listWorkspaceFiles(id) {
  const ws = path.join(WS_DIR, id);
  const out = [];
  const walk = (dir, rel) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const r = rel ? rel + '/' + e.name : e.name;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { if (out.length < 500) walk(abs, r); }
      else {
        const st = fs.statSync(abs);
        out.push({ path: r, size: st.size, mtime: st.mtimeMs });
      }
    }
  };
  walk(ws, '');
  return out.sort((a, b) => b.mtime - a.mtime);
}
