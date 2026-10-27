import { renderMarkdown } from './markdown.js';

// ---------------- 图标（lucide 风格线性图标） ----------------
const ICONS = {
  newchat: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
  folderplus: '<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  puzzle: '<path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/>',
  memory: '<path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/><path d="M18 18a4 4 0 0 0 2-7.464"/><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/><path d="M6 18a4 4 0 0 1-2-7.464"/><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/>',
  plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  sidebar: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  doc: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  list: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
  edit: '<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>',
  calendar: '<path d="M16 14v2.2l1.6 1"/><path d="M16 2v4"/><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M3 10h5"/><path d="M8 2v4"/><circle cx="16" cy="16" r="6"/>',
  tree: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
  pen: '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  foldersearch: '<path d="M10.7 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v4.1"/><path d="m21 21-1.9-1.9"/><circle cx="17" cy="17" r="3"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  files: '<path d="M20 7h-3a2 2 0 0 1-2-2V2"/><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z"/><path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8"/>',
  download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  laptop: '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
  paperclip: '<path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/>',
  wand: '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>',
};
const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.doc}</svg>`;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const $ = (sel, root = document) => root.querySelector(sel);

// ---------------- 状态 ----------------
const S = {
  data: null,
  route: { view: 'home' },
  conv: null,
  files: [],
  polled: null,          // 别处发起、仍在运行的对话（轮询获得）
  streams: new Map(),    // 本页发起的流：convId -> { parts, status }
  drafts: {},
  sel: loadSel(),
  search: '',
  showSearch: false,
  projectsOpen: true,
  filesOpen: false,
  exPage: 0,
  update: null,          // 检查更新的结果
  updateChecking: false,
};

function loadSel() {
  try { return JSON.parse(localStorage.getItem('lawdesk.sel')) || {}; } catch { return {}; }
}
function saveSel() {
  try { localStorage.setItem('lawdesk.sel', JSON.stringify(S.sel)); } catch {}
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'x-lawdesk': '1', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`);
  return data;
}

// Mac 客户端（WKWebView）里注入的原生桥，浏览器里不存在
// 桌面客户端注入的原生能力：Mac 版是 WKWebView 的 messageHandler，Windows 版是 Electron preload
const macBridge = window.webkit?.messageHandlers?.lawdesk;
const native = window.lawdeskNative ||
  (macBridge && { pickFolder: () => macBridge.postMessage({ type: 'pickFolder' }) });
if (macBridge) document.documentElement.classList.add('mac-app');
if (window.lawdeskNative) document.documentElement.classList.add('desktop-app');
const fileManager = () => (S.data?.platform === 'win32' ? '资源管理器' : '访达');

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  return ok;
}

function toast(msg, ms = 2400) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ---------------- 模型来源 ----------------
function backendOptions() {
  const { config, clis } = S.data;
  const groups = [];
  if (config.claude.enabled !== false) {
    groups.push({ backend: 'claude', label: 'Claude Code', sub: '本机 CLI', ok: clis.claude?.found,
      models: ['', ...config.claude.models] });
  }
  if (config.codex.enabled !== false) {
    groups.push({ backend: 'codex', label: 'Codex', sub: clis.codex?.source === 'chatgpt' ? 'ChatGPT 内置' : '本机 CLI', ok: clis.codex?.found,
      models: ['', ...config.codex.models] });
  }
  const acct = gptAccount();
  groups.push({ backend: 'chatgpt', label: 'ChatGPT', isPlan: true, ok: !!acct?.planUsage,
    sub: !acct ? '未登录' : gptViaCodex() ? 'ChatGPT 套餐 · 经 Codex' : 'ChatGPT 套餐 · 直接对话',
    models: acct?.models.length ? acct.models.map((m) => m.slug) : [''],
    names: Object.fromEntries((acct?.models || []).map((m) => [m.slug, m.name])) });
  for (const p of config.providers) {
    groups.push({ backend: 'api:' + p.id, label: p.name, sub: p.type === 'anthropic' ? 'Anthropic API' : 'OpenAI 兼容 API',
      ok: !!p.models.length, models: p.models, isApi: true });
  }
  return groups;
}

function ensureSel() {
  const groups = backendOptions();
  let g = groups.find((x) => x.backend === S.sel.backend && x.ok);
  if (!g) {
    g = groups.find((x) => x.ok) || groups[0];
    S.sel.backend = g?.backend || 'claude';
    S.sel.model = g?.isApi ? g.models[0] : '';
  }
  if (g && !g.models.includes(S.sel.model)) S.sel.model = g.isApi || g.isPlan ? g.models[0] : '';
  if (!['readonly', 'edit', 'all'].includes(S.sel.permission)) S.sel.permission = S.data.config.defaultPermission || 'edit';
}

const isApiBackend = (b) => String(b).startsWith('api:');
function backendLabel(backend, model) {
  const g = backendOptions().find((x) => x.backend === backend);
  const name = g ? g.label : { claude: 'Claude Code', codex: 'Codex', chatgpt: 'ChatGPT', codebuddy: 'WorkBuddy' }[backend] || '已删除的 API';
  return model ? `${name} · ${g?.names?.[model] || model}` : name;
}
const PERMS = {
  readonly: { label: '只读', desc: '只能读取材料，不改动任何文件' },
  edit: { label: '工作区可写', desc: '可以在工作区生成报告、文书等文件' },
  all: { label: '全部允许', desc: '可执行命令、联网、改任意文件，不再逐项确认' },
};

// ---------------- 路由 ----------------
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [a, b] = h.split('/');
  if (a === 'c' && b) return { view: 'chat', id: b };
  if (a === 'p' && b) return { view: 'project', id: b };
  if (['skills', 'memory', 'settings'].includes(a)) return { view: a };
  return { view: 'home' };
}
const go = (hash) => { if (location.hash !== hash) location.hash = hash; else route(); };

async function route() {
  S.route = parseHash();
  closeMenus();
  if (S.route.view === 'chat') {
    if (S.conv?.id !== S.route.id) {
      S.conv = null;
      S.filesOpen = false;
      renderMain();
      await loadConversation(S.route.id);
    }
  } else {
    S.conv = null;
    stopPolling();
  }
  renderSidebar();
  renderMain();
}

async function loadConversation(id) {
  try {
    const r = await api('/api/conversations/' + id);
    if (S.route.view !== 'chat' || S.route.id !== id) return;
    S.conv = r.conversation;
    S.files = r.files;
    S.polled = S.streams.has(id) ? null : r.live;
    if (S.polled) startPolling(id); else stopPolling();
  } catch (e) {
    toast(e.message);
    go('#/');
  }
}

let pollTimer = null;
function startPolling(id) {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (S.conv?.id !== id) return stopPolling();
    const r = await api('/api/conversations/' + id).catch(() => null);
    if (!r) return;
    S.polled = r.live;
    if (!r.live) {
      stopPolling();
      S.conv = r.conversation;
      S.files = r.files;
      renderMessages();
      renderFilesPanel();
      refreshState();
    } else {
      updateLive();
    }
    updateSendButton();
  }, 1500);
}
function stopPolling() { clearInterval(pollTimer); pollTimer = null; }

async function refreshState(refreshCli = false) {
  S.data = await api('/api/state' + (refreshCli ? '?refresh=1' : ''));
  ensureSel();
  renderSidebar();
}

// ---------------- 侧边栏 ----------------
function groupByDate(list) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups = { 置顶: [], 今天: [], '近 7 天': [], '近 30 天': [], 更早: [] };
  for (const c of list) {
    if (c.pinned) groups['置顶'].push(c);
    else if (c.updatedAt >= today) groups['今天'].push(c);
    else if (c.updatedAt >= today - 6 * 864e5) groups['近 7 天'].push(c);
    else if (c.updatedAt >= today - 29 * 864e5) groups['近 30 天'].push(c);
    else groups['更早'].push(c);
  }
  return groups;
}

function renderSidebar() {
  if (!S.data) return;
  const { conversations, projects, clis, config } = S.data;
  const q = S.search.trim().toLowerCase();
  const visible = conversations.filter((c) => (c.count > 0 || c.running || S.streams.has(c.id)) && (!q || (c.title || '').toLowerCase().includes(q)));
  const groups = groupByDate(visible);
  const activeConv = S.route.view === 'chat' ? S.route.id : null;
  const nav = (act, ic, label, active) =>
    `<button class="nav-item${active ? ' active' : ''}" data-act="${act}">${icon(ic)}<span>${label}</span></button>`;

  const convItem = (c) => {
    const running = c.running || S.streams.has(c.id);
    return `<div class="conv-item${c.id === activeConv ? ' active' : ''}" data-act="open-conv" data-id="${c.id}" title="${esc(c.title)}">
      ${c.projectId ? icon('folder') : ''}<span class="t">${esc(c.title || '新对话')}</span>
      ${running ? '<span class="dot"></span>' : ''}
      <button class="icon-btn more" data-act="conv-menu" data-id="${c.id}">${icon('more')}</button></div>`;
  };

  let convHTML = '';
  for (const [name, items] of Object.entries(groups)) {
    if (!items.length) continue;
    convHTML += `<div class="sb-section"><div class="sb-label">${name}</div>${items.map(convItem).join('')}</div>`;
  }
  if (!visible.length) convHTML = `<div class="sb-empty">${q ? '没有匹配的对话' : '还没有对话。在右侧描述任务即可开始。'}</div>`;

  const projHTML = projects.length
    ? projects.map((p) => `<div class="conv-item${S.route.view === 'project' && S.route.id === p.id ? ' active' : ''}" data-act="open-project" data-id="${p.id}">
        ${icon('folder')}<span class="t">${esc(p.name)}</span></div>`).join('')
    : '<div class="sb-empty">还没有项目，点击侧栏上方<br>「新建项目」</div>';

  const apiCount = config.providers.length;
  // 侧栏放不下全称，用短名；完整名称放在悬停提示里
  const sources = [gptAccount()?.planUsage && ['ChatGPT', 'ChatGPT 套餐'], clis.claude?.found && ['Claude', 'Claude Code'],
    clis.codex?.found && ['Codex', 'Codex'], apiCount && [apiCount > 1 ? `API ×${apiCount}` : 'API', `自有 API ${apiCount} 个`]].filter(Boolean);
  const connected = sources.map((x) => x[0]);
  const upd = S.update;
  const updHTML = upd?.hasUpdate && upd.dismissed !== upd.latest.version
    ? `<div class="upd-card"><button class="upd-main" data-act="show-update">${icon('download')}<span>新版本 v${esc(upd.latest.version)} 可以更新</span></button>
        <button class="icon-btn" data-act="dismiss-update" title="忽略这个版本">${icon('x')}</button></div>`
    : '';
  $('#sidebar').innerHTML = `
    <div class="sb-top">
      <div class="brand"><span class="brand-mark">律</span>律台</div>
      <button class="icon-btn" data-act="toggle-search" title="搜索对话">${icon('search')}</button>
      <button class="icon-btn" data-act="toggle-sidebar" title="收起侧栏">${icon('sidebar')}</button>
    </div>
    ${S.showSearch ? `<label class="sb-search">${icon('search')}<input id="sb-search" placeholder="搜索对话标题" value="${esc(S.search)}"></label>` : ''}
    ${nav('new-chat', 'newchat', '新建对话', S.route.view === 'home')}
    ${nav('new-project', 'folderplus', '新建项目')}
    ${nav('nav-skills', 'puzzle', '技能', S.route.view === 'skills')}
    ${nav('nav-memory', 'memory', '我的记忆', S.route.view === 'memory')}
    ${nav('nav-settings', 'plug', '模型与连接', S.route.view === 'settings')}
    <div class="sb-scroll">
      <div class="sb-label"><button class="toggle" data-act="toggle-projects">项目 ${icon(S.projectsOpen ? 'down' : 'right')}</button>
        <button class="icon-btn" data-act="new-project" title="新建项目">${icon('plus')}</button></div>
      ${S.projectsOpen ? projHTML : ''}
      <div class="sb-divider"></div>
      ${convHTML}
    </div>
    <div class="sb-bottom">
      ${updHTML}
      <button class="local-card" data-act="nav-settings">
        ${icon('laptop')}
        <div style="flex:1;min-width:0">
          <div>本地模式 · 无需登录</div>
          <div class="st" title="${esc(sources.map((x) => x[1]).join('、'))}"><span class="badge${connected.length ? ' on' : ''}"><span class="t">${connected.length ? connected.join(' · ') : '还没有连接模型'}</span></span></div>
        </div>
        ${icon('right')}
      </button>
    </div>`;
  const input = $('#sb-search');
  if (input) {
    input.addEventListener('input', () => { S.search = input.value; renderSidebar(); const i = $('#sb-search'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); });
  }
}

// ---------------- 输入框 ----------------
function draftKey() {
  if (S.route.view === 'chat') return 'c:' + S.route.id;
  if (S.route.view === 'project') return 'p:' + S.route.id;
  return 'home';
}
function draft() {
  const k = draftKey();
  if (!S.drafts[k]) S.drafts[k] = { text: '', skillId: null, attachments: [], convId: S.route.view === 'chat' ? S.route.id : null };
  return S.drafts[k];
}

function composerHTML(placeholder) {
  const d = draft();
  return `<div class="composer" id="composer">
    <div class="cmp-tags" id="cmp-tags">${composerTagsHTML()}</div>
    <textarea id="input" rows="2" placeholder="${esc(placeholder || '描述本次法律任务，或添加需要处理的材料……')}">${esc(d.text)}</textarea>
    <div class="cmp-row">
      <button class="icon-btn" data-act="attach-menu" title="添加文件或文件夹">${icon('plus')}</button>
      ${S.route.view === 'chat' ? `<button class="pick" data-act="skill-menu">${icon('wand')}技能</button>` : ''}
      <span class="plan-note" id="plan-note">${planNoteHTML()}</span>
      <div class="grow"></div>
      <span id="pickers">${pickersHTML()}</span>
      <button class="icon-btn mic${recognizing ? ' on' : ''}${SpeechRec ? '' : ' hidden'}" data-act="mic" title="语音输入">${icon('mic')}</button>
      <button class="send-btn" id="send-btn" data-act="send">${icon('up')}</button>
    </div>
  </div>`;
}

// 用 ChatGPT 套餐时，在输入框下方说明并给出「管理用量」入口
function planNoteHTML() {
  if (S.sel.backend !== 'chatgpt' || !gptAccount()?.planUsage) return '';
  return `${gptLogo()}<span class="t">正在使用 ChatGPT 套餐</span><a href="${esc(S.data.chatgpt.usageUrl)}" target="_blank" rel="noopener">管理用量</a>`;
}

function pickersHTML() {
  const api = isApiBackend(S.sel.backend) || (S.sel.backend === 'chatgpt' && !gptViaCodex());
  return `<button class="pick model-pick" data-act="model-menu"><span class="lbl">${esc(backendLabel(S.sel.backend, S.sel.model || ''))}${S.sel.model ? '' : ' · 默认'}</span>${icon('down')}</button>` +
    (api ? '<span class="pick static" title="自有 API 为纯对话模式，附件会转成文字发送">纯对话</span>'
      : `<button class="pick" data-act="perm-menu">${PERMS[S.sel.permission].label}${icon('down')}</button>`);
}

function composerTagsHTML() {
  const d = draft();
  const skill = S.data.skills.find((s) => s.id === d.skillId);
  const size = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  return (skill ? `<span class="tag skill">${icon(skill.icon)}<span class="n">${esc(skill.name)}</span><button data-act="clear-skill">${icon('x')}</button></span>` : '') +
    d.attachments.map((a, i) => `<span class="tag${a.uploading ? ' uploading' : ''}" title="${esc(a.path || a.name)}">${icon('doc')}<span class="n">${esc(a.name)}</span>
      <span class="sz">${a.uploading ? '上传中' : size(a.size)}</span><button data-act="remove-att" data-i="${i}">${icon('x')}</button></span>`).join('');
}

function refreshComposer() {
  const tags = $('#cmp-tags');
  if (tags) tags.innerHTML = composerTagsHTML();
  const p = $('#pickers');
  if (p) p.innerHTML = pickersHTML();
  const note = $('#plan-note');
  if (note) note.innerHTML = planNoteHTML();
  updateSendButton();
}

function currentRunning() {
  if (S.route.view !== 'chat') return false;
  return S.streams.has(S.route.id) || !!S.polled;
}

function updateSendButton() {
  const btn = $('#send-btn');
  if (!btn) return;
  const d = draft();
  const running = currentRunning();
  btn.className = 'send-btn' + (running ? ' stop' : (d.text.trim() || d.attachments.length) ? ' ready' : '');
  btn.innerHTML = icon(running ? 'stop' : 'up');
  btn.title = running ? '停止' : '发送（Enter）';
}

function bindComposer() {
  const ta = $('#input');
  if (!ta) return;
  const autosize = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 300) + 'px'; };
  autosize();
  ta.addEventListener('input', () => { draft().text = ta.value; autosize(); updateSendButton(); });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      if (!currentRunning()) send();
    }
  });
  ta.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); uploadFiles(files.map((f) => ({ file: f, rel: f.name }))); }
  });
  const box = $('#composer');
  box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('drag'); });
  box.addEventListener('dragleave', () => box.classList.remove('drag'));
  box.addEventListener('drop', async (e) => {
    e.preventDefault();
    box.classList.remove('drag');
    uploadFiles(await filesFromDrop(e.dataTransfer));
  });
  updateSendButton();
}

async function filesFromDrop(dt) {
  const out = [];
  const entries = [...dt.items].map((it) => it.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return [...dt.files].map((f) => ({ file: f, rel: f.name }));
  const walk = async (entry, prefix) => {
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ file, rel: prefix + file.name });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      let batch;
      do {
        batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        for (const e of batch) await walk(e, prefix + entry.name + '/');
      } while (batch.length);
    }
  };
  for (const e of entries) await walk(e, '');
  return out;
}

async function ensureDraftConversation() {
  const d = draft();
  if (d.convId) return d.convId;
  const projectId = S.route.view === 'project' ? S.route.id : null;
  const r = await api('/api/conversations', { method: 'POST', body: { projectId } });
  d.convId = r.conversation.id;
  return d.convId;
}

async function uploadFiles(items) {
  items = items.filter((x) => !x.file.name.startsWith('.'));
  if (!items.length) return;
  const d = draft();
  let convId;
  try { convId = await ensureDraftConversation(); } catch (e) { return toast(e.message); }
  const entries = items.map(({ file, rel }) => ({ name: rel, size: file.size, uploading: true, file }));
  d.attachments.push(...entries);
  refreshComposer();
  for (const a of entries) {
    try {
      const res = await fetch(`/api/conversations/${convId}/upload?name=${encodeURIComponent(a.name)}`, {
        method: 'POST', headers: { 'x-lawdesk': '1' }, body: a.file,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '上传失败');
      a.path = j.path;
      a.uploading = false;
      delete a.file;
    } catch (e) {
      toast(`${a.name}：${e.message}`);
      d.attachments.splice(d.attachments.indexOf(a), 1);
    }
    refreshComposer();
  }
}

// 语音输入（浏览器支持时）
// Electron 里虽然有这个接口但没有可用的识别服务，桌面客户端里不显示语音按钮
const SpeechRec = window.lawdeskNative ? null : window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizing = null;
function toggleMic() {
  if (recognizing) { recognizing.stop(); return; }
  const rec = new SpeechRec();
  rec.lang = 'zh-CN';
  rec.interimResults = true;
  rec.continuous = true;
  const ta = $('#input');
  const base = ta.value;
  rec.onresult = (e) => {
    let text = '';
    for (const r of e.results) text += r[0].transcript;
    ta.value = base + text;
    draft().text = ta.value;
    ta.dispatchEvent(new Event('input'));
  };
  rec.onend = () => { recognizing = null; $('.mic')?.classList.remove('on'); };
  rec.onerror = (e) => toast('语音识别失败：' + e.error);
  rec.start();
  recognizing = rec;
  $('.mic')?.classList.add('on');
}

// ---------------- 发送与流式接收 ----------------
function applyEvent(live, ev) {
  if (ev.t === 'status') { live.status = ev.d; return; }
  const parts = live.parts;
  if (ev.t === 'text') {
    const last = parts[parts.length - 1];
    if (last && last.type === 'text') last.text += ev.d; else parts.push({ type: 'text', text: ev.d });
  } else if (ev.t === 'tool') {
    const ex = parts.find((p) => p.type === 'tool' && p.id === ev.id);
    const { t, ...fields } = ev;
    for (const k of Object.keys(fields)) if (fields[k] === undefined) delete fields[k];
    if (ex) Object.assign(ex, fields); else parts.push({ type: 'tool', ...fields });
  } else if (ev.t === 'notice' || ev.t === 'error') {
    parts.push({ type: ev.t, text: ev.d });
  }
}

async function send() {
  const d = draft();
  const text = d.text.trim();
  if (d.attachments.some((a) => a.uploading)) return toast('附件还在上传，请稍候');
  if (!text && !d.attachments.length) return;
  if (isApiBackend(S.sel.backend) && !S.sel.model) return toast('请先在「模型与连接」里为这个 API 填写模型名称');
  const body = {
    conversationId: S.route.view === 'chat' ? S.route.id : d.convId,
    projectId: S.route.view === 'project' ? S.route.id : null,
    text, attachments: d.attachments.map((a) => a.path), skillId: d.skillId,
    backend: S.sel.backend, model: S.sel.model || '', permission: S.sel.permission,
  };
  const key = draftKey();
  const saved = { ...d, attachments: [...d.attachments] };
  delete S.drafts[key];
  const ta = $('#input');
  if (ta) { ta.value = ''; ta.style.height = 'auto'; }
  refreshComposer();

  let res;
  try {
    res = await fetch('/api/chat', { method: 'POST', headers: { 'x-lawdesk': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '发送失败');
  } catch (e) {
    S.drafts[key] = saved;
    if (ta) { ta.value = saved.text; }
    refreshComposer();
    return toast(e.message);
  }

  let convId = null;
  const live = { parts: [], status: '启动中…', backend: body.backend, model: body.model };
  await readSSE(res, (ev) => {
    if (ev.t === 'start') {
      convId = ev.conversationId;
      S.streams.set(convId, live);
      if (S.route.view === 'chat' && S.route.id === convId && S.conv) {
        S.conv.messages.push(ev.userMsg);
        S.conv.title = ev.title;
        renderMessages(true);
      } else {
        S.conv = { id: convId, title: ev.title, projectId: body.projectId, messages: [ev.userMsg] };
        S.files = [];
        S.polled = null;
        history.pushState(null, '', '#/c/' + convId);
        S.route = { view: 'chat', id: convId };
        renderMain();
      }
      const listed = S.data.conversations.find((c) => c.id === convId);
      if (listed) { listed.title = ev.title; listed.count++; listed.updatedAt = Date.now(); }
      else S.data.conversations.unshift({ id: convId, title: ev.title, count: 1, updatedAt: Date.now(), projectId: body.projectId });
      renderSidebar();
      updateSendButton();
      return;
    }
    if (ev.t === 'done') return;
    applyEvent(live, ev);
    if (S.route.view === 'chat' && S.route.id === convId) scheduleLive();
  });

  if (!convId) return;
  S.streams.delete(convId);
  if (S.route.view === 'chat' && S.route.id === convId) {
    const r = await api('/api/conversations/' + convId).catch(() => null);
    if (r && S.route.id === convId) {
      S.conv = r.conversation;
      S.files = r.files;
      renderMessages();
      renderFilesPanel();
      updateSendButton();
      const head = $('.chat-head .count');
      if (head) head.textContent = S.files.length;
    }
  } else {
    toast('「' + (S.data.conversations.find((c) => c.id === convId)?.title || '对话') + '」已完成');
  }
  refreshState();
}

async function readSSE(res, onEvent) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    let chunk;
    try { chunk = await reader.read(); } catch { break; }
    if (chunk.done) break;
    buf += dec.decode(chunk.value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of block.split('\n')) {
        if (line.startsWith('data:')) { try { onEvent(JSON.parse(line.slice(5))); } catch (e) { console.error(e); } }
      }
    }
  }
}

async function stopCurrent() {
  if (S.route.view !== 'chat') return;
  await api(`/api/conversations/${S.route.id}/stop`, { method: 'POST' }).catch((e) => toast(e.message));
}

// ---------------- 消息渲染 ----------------
function toolHTML(p, live) {
  const st = p.status === 'running' ? '<span class="spinner"></span>' : p.status === 'error' ? icon('alert') : icon('check');
  const detail = (p.input ? `<pre>${esc(p.input)}</pre>` : '') + (p.output ? `<pre>${esc(p.output)}</pre>` : '');
  return `<div class="tool ${p.status || ''}" data-act="toggle-tool">
    <div class="tool-row"><span class="st">${st}</span><span class="nm">${esc(p.name || '工具')}</span><span class="in">${esc((p.input || '').split('\n')[0])}</span></div>
    ${detail ? `<div class="tool-detail">${detail}</div>` : ''}</div>`;
}

function partsHTML(parts, live) {
  let html = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.type === 'text') {
      // 引擎把失败原因当作回复输出、紧接着又报同样的错误时，只在错误框里显示一次
      const next = parts[i + 1];
      if (next?.type === 'error' && p.text.trim() && next.text.startsWith(p.text.trim())) continue;
      html += `<div class="md${live && i === parts.length - 1 ? ' caret' : ''}">${renderMarkdown(p.text)}</div>`;
    } else if (p.type === 'tool') {
      const group = [p];
      while (parts[i + 1]?.type === 'tool') group.push(parts[++i]);
      const running = group.some((g) => g.status === 'running');
      if (live && (running || i === parts.length - 1)) html += group.map((g) => toolHTML(g, live)).join('');
      else {
        const errs = group.filter((g) => g.status === 'error').length;
        html += `<details class="tools-group"><summary>${icon('right')}执行了 ${group.length} 个操作${errs ? `（${errs} 个失败）` : ''}</summary>${group.map((g) => toolHTML(g)).join('')}</details>`;
      }
    } else if (p.type === 'notice') {
      html += `<div class="notice">${esc(p.text)}</div>`;
    } else if (p.type === 'error' && p.code === 'chatgpt_usage_limit') {
      html += `<div class="plan-limit"><div class="pl-brand">${gptLogo()}ChatGPT</div>
        <div class="pl-title">已达到用量上限</div><div class="pl-text">请在 ChatGPT 设置中查看你的套餐或律台的用量上限。</div>
        <a class="btn primary small" href="${esc(S.data.chatgpt.usageUrl)}" target="_blank" rel="noopener">管理用量</a></div>`;
    } else if (p.type === 'error') {
      const linked = esc(p.text).replace(/https?:\/\/[^\s<）)]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
      html += `<div class="error-box">${linked}${p.code === 'chatgpt_login' ? '<div style="margin-top:8px"><button class="btn small" data-act="nav-settings">去「模型与连接」登录</button></div>' : ''}</div>`;
    }
  }
  return html;
}

function fmtDuration(ms) {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} 秒` : `${Math.floor(s / 60)} 分 ${s % 60} 秒`;
}

function messageHTML(m) {
  if (m.role === 'user') {
    const skill = S.data.skills.find((s) => s.id === m.skillId);
    const tags = (skill ? `<span class="tag skill">${icon(skill.icon)}<span class="n">${esc(skill.name)}</span></span>` : '') +
      (m.attachments || []).map((a) => `<a class="tag" href="/files/${S.conv.id}/${encodeURI(a)}" target="_blank">${icon('doc')}<span class="n">${esc(a.replace(/^附件\//, ''))}</span></a>`).join('');
    return `<div class="msg user">${tags ? `<div class="meta">${tags}</div>` : ''}${m.text ? `<div class="bubble">${esc(m.text)}</div>` : ''}</div>`;
  }
  return `<div class="msg assistant" data-mid="${m.id}">
    <div class="who"><span class="av">律</span>${esc(backendLabel(m.backend, m.model))}${m.durationMs ? ' · ' + fmtDuration(m.durationMs) : ''}</div>
    ${partsHTML(m.parts || [])}
    <div class="msg-actions"><button data-act="copy-msg" data-mid="${m.id}">${icon('copy')}复制</button></div>
  </div>`;
}

function liveState() {
  if (S.route.view !== 'chat') return null;
  return S.streams.get(S.route.id) || S.polled;
}

function liveHTML(live) {
  return `<div class="who"><span class="av">律</span>${esc(backendLabel(live.backend, live.model))}</div>
    ${partsHTML(live.parts, true)}
    <div class="status-line"><span class="spinner"></span>${esc(live.status || '处理中…')}</div>`;
}

function renderMessages(scrollToEnd = true) {
  const box = $('#messages');
  if (!box || !S.conv) return;
  const live = liveState();
  box.innerHTML = S.conv.messages.map(messageHTML).join('') +
    (live ? `<div class="msg assistant" id="live-msg">${liveHTML(live)}</div>` : '');
  renderMermaid(box);
  if (scrollToEnd) { const sc = $('.chat-scroll'); if (sc) sc.scrollTop = sc.scrollHeight; }
}

let liveFrame = 0;
function scheduleLive() {
  if (liveFrame) return;
  liveFrame = requestAnimationFrame(() => { liveFrame = 0; updateLive(); });
}
function updateLive() {
  const live = liveState();
  if (!live) return;
  let el = $('#live-msg');
  if (!el) { renderMessages(); return; }
  const sc = $('.chat-scroll');
  const nearBottom = sc && sc.scrollHeight - sc.scrollTop - sc.clientHeight < 120;
  const openTools = new Set([...el.querySelectorAll('.tool.open')].map((n) => [...el.querySelectorAll('.tool')].indexOf(n)));
  el.innerHTML = liveHTML(live);
  [...el.querySelectorAll('.tool')].forEach((n, i) => openTools.has(i) && n.classList.add('open'));
  if (nearBottom) sc.scrollTop = sc.scrollHeight;
}

// mermaid 图（时间线、思维导图）按需从 CDN 加载；离线时保留代码
let mermaidLib = null;
async function renderMermaid(root) {
  const blocks = [...root.querySelectorAll('pre.code[data-lang="mermaid"]')].filter((b) => !b.closest('#live-msg'));
  if (!blocks.length) return;
  try {
    if (!mermaidLib) {
      mermaidLib = (await import('https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs')).default;
      mermaidLib.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict', fontFamily: 'PingFang SC, sans-serif' });
    }
  } catch { return; }
  for (const pre of blocks) {
    const code = pre.textContent;
    try {
      const { svg } = await mermaidLib.render('m' + Math.random().toString(36).slice(2), code);
      const wrap = document.createElement('div');
      wrap.innerHTML = `<div class="mermaid-tabs"><button class="on" data-act="mm-tab" data-v="g">图</button><button data-act="mm-tab" data-v="c">代码</button></div><div class="mermaid-box">${svg}</div>`;
      pre.replaceWith(wrap);
      wrap.appendChild(pre);
      pre.classList.add('hidden');
    } catch { /* 语法错误时保持代码显示 */ }
  }
}

// ---------------- 主区域视图 ----------------
function renderMain() {
  const main = $('#main');
  if (!S.data) { main.innerHTML = ''; return; }
  const collapsed = $('#app').classList.contains('collapsed');
  const toggle = collapsed ? `<button class="icon-btn float-toggle" data-act="toggle-sidebar" title="展开侧栏">${icon('sidebar')}</button>` : '';
  const v = S.route.view;
  if (v === 'home') main.innerHTML = toggle + homeHTML();
  else if (v === 'project') main.innerHTML = toggle + projectHTML();
  else if (v === 'chat') main.innerHTML = toggle + chatHTML();
  else if (v === 'skills') main.innerHTML = toggle + skillsHTML();
  else if (v === 'memory') main.innerHTML = toggle + memoryHTML();
  else if (v === 'settings') main.innerHTML = toggle + settingsHTML();
  if (v === 'home' || v === 'project' || v === 'chat') bindComposer();
  if (v === 'chat') renderMessages();
  if (v === 'memory') bindMemory();
}

function chipsHTML() {
  const d = draft();
  return `<div class="chips-wrap"><div class="chips" id="chips">${S.data.skills.map((s) =>
    `<button class="chip${d.skillId === s.id ? ' on' : ''}" data-act="pick-skill" data-id="${s.id}" title="${esc(s.desc)}">${icon(s.icon)}${esc(s.name)}</button>`).join('')}
    </div><button class="chips-next" data-act="chips-next">${icon('right')}</button></div>`;
}

function examplesHTML() {
  const ex = S.data.examples;
  const pages = Math.ceil(ex.length / 4);
  const start = (S.exPage % pages) * 4;
  return `<div class="examples"><div class="ex-head"><span>从一个法律案例开始</span>
    <button data-act="ex-next">${icon('refresh')}换一批</button></div>
    <div class="ex-grid">${ex.slice(start, start + 4).map((e, i) => `<button class="ex-card" data-act="pick-example" data-i="${start + i}">
      <div class="top">${icon(e.icon)}<span class="lbl">${esc(e.tag)}</span></div>
      <div class="ttl">${esc(e.title)}</div><div class="dsc">${esc(e.desc)}</div></button>`).join('')}</div></div>`;
}

function homeHTML() {
  return `<div class="home"><div class="home-spacer"></div>
    <h1>今天要推进哪项法律任务</h1>
    ${composerHTML()}
    ${chipsHTML()}
    ${planBannerHTML()}
    ${examplesHTML()}
  </div>`;
}

function projectHTML() {
  const p = S.data.projects.find((x) => x.id === S.route.id);
  if (!p) return '<div class="home"><div class="home-spacer"></div><h1>项目不存在</h1></div>';
  const convs = S.data.conversations.filter((c) => c.projectId === p.id && c.count > 0);
  return `<div class="home"><div class="home-spacer" style="max-height:18vh"></div>
    <div class="project-head"><h1>${esc(p.name)}</h1>
      <div class="meta">${p.folder ? `<span class="mono-path">${esc(p.folder)}</span><button data-act="reveal-project" data-id="${p.id}">在${fileManager()}中打开</button>` : '<span>未关联文件夹</span>'}
      <button data-act="edit-project" data-id="${p.id}">编辑项目</button></div>
      ${p.instructions ? `<div class="meta" style="margin-top:6px">项目说明：${esc(p.instructions.slice(0, 120))}</div>` : ''}
    </div>
    ${composerHTML(`在「${p.name}」中开始新任务${p.folder ? '，智能体可以直接读取项目文件夹' : ''}……`)}
    ${chipsHTML()}
    <div class="proj-convs"><h3>项目中的对话（${convs.length}）</h3>
      ${convs.map((c) => `<div class="proj-conv" data-act="open-conv" data-id="${c.id}"><span class="t">${esc(c.title)}</span><span class="d">${new Date(c.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>`).join('') || '<div class="files-empty" style="padding:8px 4px">还没有对话</div>'}
    </div></div>`;
}

function chatHTML() {
  const c = S.conv;
  if (!c) return '<div class="chat"><div class="chat-head"></div><div class="chat-scroll"><div class="messages"><div class="status-line"><span class="spinner"></span>加载中…</div></div></div></div>';
  const project = c.projectId && S.data.projects.find((p) => p.id === c.projectId);
  return `<div class="chat">
    <div class="chat-head">
      ${project ? `<span class="crumb" data-act="open-project" data-id="${project.id}" style="cursor:pointer">${esc(project.name)} /</span>` : ''}
      <div class="title" data-act="rename-inline" title="点击重命名">${esc(c.title)}</div>
      <div class="grow"></div>
      <button class="head-btn" data-act="toggle-files">${icon('files')}工作区文件<span class="count">${S.files.length}</span></button>
      <button class="icon-btn" data-act="conv-menu" data-id="${c.id}">${icon('more')}</button>
    </div>
    <div class="chat-body">
      <div class="chat-scroll"><div class="messages" id="messages"></div></div>
      <div id="files-slot">${S.filesOpen ? filesPanelHTML() : ''}</div>
    </div>
    <div class="chat-foot">${composerHTML('继续追问，或补充材料……')}<div class="hint">本地运行 · 输出仅供专业人员参考，请核实法条与案例</div></div>
  </div>`;
}

function filesPanelHTML() {
  const groups = { 附件: [], 输出: [], 其他: [] };
  for (const f of S.files) {
    const top = f.path.split('/')[0];
    (groups[top] || groups['其他']).push(f);
  }
  const size = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  const row = (f) => `<div class="file-row">${icon('doc')}<a class="n" href="/files/${S.conv.id}/${encodeURI(f.path)}" target="_blank" title="${esc(f.path)}">${esc(f.path.split('/').slice(1).join('/') || f.path)}</a>
    <span class="s">${size(f.size)}</span><a class="icon-btn dl" href="/files/${S.conv.id}/${encodeURI(f.path)}?download" title="下载">${icon('download')}</a></div>`;
  return `<div class="files-panel">
    <div class="btn-row" style="margin-bottom:14px"><button class="btn small" data-act="reveal-ws">${icon('folder')}在${fileManager()}中打开</button>
      <button class="btn small" data-act="refresh-files">${icon('refresh')}刷新</button></div>
    ${Object.entries(groups).map(([name, list]) => (name === '其他' && !list.length) ? '' : `<h4>${name === '输出' ? '智能体生成' : name === '附件' ? '上传的材料' : name}</h4>
      ${list.map(row).join('') || `<div class="files-empty">${name === '输出' ? '使用 Claude Code / Codex 时，生成的报告和文书会出现在这里' : '暂无'}</div>`}`).join('')}
  </div>`;
}
function renderFilesPanel() {
  const slot = $('#files-slot');
  if (slot) slot.innerHTML = S.filesOpen ? filesPanelHTML() : '';
  const count = $('.chat-head .count');
  if (count) count.textContent = S.files.length;
}

// ---------------- 技能页 ----------------
function skillsHTML() {
  return `<div class="page"><div class="page-inner">
    <h1>技能</h1><p class="lead">技能是一段追加给智能体的工作方法。点选后，本轮任务会按对应的结构与要求输出。可以改写内置技能，也可以新建自己的。</p>
    <div class="btn-row" style="margin-bottom:18px"><button class="btn primary" data-act="new-skill">${icon('plus')}新建技能</button>
      <button class="btn" data-act="reset-skills">恢复内置技能</button></div>
    <div class="skills-grid">${S.data.skills.map((s) => `<button class="skill-card" data-act="edit-skill" data-id="${s.id}">
      <div class="h">${icon(s.icon)}${esc(s.name)}</div><div class="d">${esc(s.desc)}</div></button>`).join('')}</div>
  </div></div>`;
}

const SKILL_ICONS = ['doc', 'book', 'list', 'edit', 'calendar', 'tree', 'pen', 'search', 'shield', 'folder', 'wand'];
function openSkillModal(skill) {
  const isNew = !skill;
  skill = skill || { id: 'custom-' + Date.now().toString(36), name: '', icon: 'wand', desc: '', prompt: '【技能：】\n- ', starter: '' };
  const m = modal(`<h3>${isNew ? '新建技能' : '编辑技能'}</h3>
    <div class="grid2"><label class="field"><span>名称</span><input class="input" name="name" value="${esc(skill.name)}" maxlength="12"></label>
    <label class="field"><span>图标</span><select class="select" name="icon">${SKILL_ICONS.map((i) => `<option${i === skill.icon ? ' selected' : ''}>${i}</option>`).join('')}</select></label></div>
    <label class="field"><span>简介</span><input class="input" name="desc" value="${esc(skill.desc)}"></label>
    <label class="field"><span>起手模板（点选技能时填进输入框）</span><input class="input" name="starter" value="${esc(skill.starter)}"></label>
    <label class="field"><span>工作方法（追加到系统提示）</span><textarea class="textarea" name="prompt" rows="9">${esc(skill.prompt)}</textarea></label>
    <div class="btn-row">${isNew ? '' : '<button class="btn danger" data-m="delete">删除</button>'}<span style="flex:1"></span>
      <button class="btn" data-m="cancel">取消</button><button class="btn primary" data-m="save">保存</button></div>`);
  m.onAction = async (act, form) => {
    if (act === 'cancel') return m.close();
    let list = [...S.data.skills];
    if (act === 'delete') {
      if (!confirm(`删除技能「${skill.name}」？`)) return;
      list = list.filter((s) => s.id !== skill.id);
    } else {
      const next = { ...skill, ...form };
      if (!next.name.trim()) return toast('请填写名称');
      const i = list.findIndex((s) => s.id === skill.id);
      if (i >= 0) list[i] = next; else list.push(next);
    }
    const r = await api('/api/skills', { method: 'POST', body: { skills: list } });
    S.data.skills = r.skills;
    m.close();
    renderMain();
  };
}

// ---------------- 记忆页 ----------------
function memoryHTML() {
  return `<div class="page"><div class="page-inner">
    <h1>我的记忆</h1><p class="lead">写在这里的内容会在每次任务时告诉智能体，例如你的执业身份、常用立场、文书格式偏好、所在律所信息。只保存在本机。</p>
    <label class="switch" style="margin-bottom:14px"><input type="checkbox" id="mem-on"${S.data.config.memoryEnabled ? ' checked' : ''}>启用记忆</label>
    <textarea class="textarea" id="mem-text" rows="16" placeholder="例如：
- 我是上海的执业律师，主做商事争议和劳动争议
- 默认站在委托方立场；文书落款使用「XX律师事务所」
- 输出的金额统一保留两位小数，并写明计算公式
- 引用法条时附上条文原文">${esc(S.data.memory)}</textarea>
    <div class="btn-row" style="margin-top:12px"><button class="btn primary" data-act="save-memory">保存</button><span class="saved-flash hidden" id="mem-saved">已保存</span></div>
  </div></div>`;
}
function bindMemory() {
  $('#mem-text')?.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveMemory(); }
  });
}
async function saveMemory() {
  const memory = $('#mem-text').value;
  const enabled = $('#mem-on').checked;
  await api('/api/memory', { method: 'POST', body: { memory, enabled } });
  S.data.memory = memory;
  S.data.config.memoryEnabled = enabled;
  const f = $('#mem-saved');
  f.classList.remove('hidden');
  setTimeout(() => f.classList.add('hidden'), 1600);
}

// ---------------- 模型与连接 ----------------
const PRESETS = [
  { name: 'DeepSeek', type: 'openai', baseUrl: 'https://api.deepseek.com/v1', models: 'deepseek-chat, deepseek-reasoner' },
  { name: 'Kimi（Moonshot）', type: 'openai', baseUrl: 'https://api.moonshot.cn/v1', models: '' },
  { name: '通义千问', type: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: 'qwen-max, qwen-plus' },
  { name: '智谱 GLM', type: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: '' },
  { name: 'OpenAI', type: 'openai', baseUrl: 'https://api.openai.com/v1', models: '' },
  { name: 'Anthropic', type: 'anthropic', baseUrl: 'https://api.anthropic.com', models: '' },
  { name: 'OpenRouter', type: 'openai', baseUrl: 'https://openrouter.ai/api/v1', models: '' },
  { name: 'Ollama（本地模型）', type: 'openai', baseUrl: 'http://127.0.0.1:11434/v1', models: 'qwen3:14b' },
  { name: '自定义', type: 'openai', baseUrl: '', models: '' },
];

const SOURCE_NAMES = { chatgpt: 'ChatGPT 内置 ' };

function cliCardHTML(key, title, desc, envHint) {
  const cfg = S.data.config[key];
  const st = S.data.clis[key] || {};
  return `<div class="card" data-cli="${key}">
    <div class="card-head"><span class="ttl">${title}</span>
      <span class="pill ${st.found ? 'ok' : 'bad'}">${st.found ? '已检测到 ' + esc((SOURCE_NAMES[st.source] || '') + (st.version || '')) : '未检测到'}</span>
      <span class="grow"></span>
      <label class="switch"><input type="checkbox" name="enabled"${cfg.enabled !== false ? ' checked' : ''}>显示在模型列表</label></div>
    <p class="lead" style="margin:0 0 12px;font-size:13.5px">${desc}${st.path ? `<br><span class="mono-path">${esc(st.path)}</span>` : ''}</p>
    <details class="adv"${cfg.bin || cfg.env ? ' open' : ''}><summary>${icon('right')}高级设置<span>命令路径、可选模型、环境变量</span></summary>
    <div class="grid2">
      <label class="field"><span>命令路径（可选）</span><input class="input mono" name="bin" value="${esc(cfg.bin)}" placeholder="留空自动查找"></label>
      <label class="field"><span>可选模型（逗号分隔）</span><input class="input" name="models" value="${esc(cfg.models.join(', '))}" placeholder="留空则只用 CLI 默认模型"></label>
    </div>
    <label class="field"><span>额外环境变量（每行一个 KEY=VALUE，可让 CLI 使用你自己的 API）</span>
      <textarea class="textarea mono" name="env" rows="3" placeholder="${esc(envHint)}">${esc(cfg.env)}</textarea></label>
    </details>
    <div class="btn-row"><button class="btn primary small" data-act="save-cli" data-key="${key}">保存</button>
      <button class="btn small" data-act="test-backend" data-backend="${key}">测试连接</button>
      <span class="test-out" data-out="${key}"></span></div>
  </div>`;
}

function providerCardHTML(p) {
  return `<div class="card" data-provider="${p.id}">
    <div class="card-head"><span class="ttl">${esc(p.name)}</span><span class="pill">${p.type === 'anthropic' ? 'Anthropic' : 'OpenAI 兼容'}</span><span class="grow"></span>
      <button class="btn small danger" data-act="del-provider" data-id="${p.id}">${icon('trash')}删除</button></div>
    <div class="grid2">
      <label class="field"><span>名称</span><input class="input" name="name" value="${esc(p.name)}"></label>
      <label class="field"><span>接口类型</span><select class="select" name="type">
        <option value="openai"${p.type !== 'anthropic' ? ' selected' : ''}>OpenAI 兼容（/chat/completions）</option>
        <option value="anthropic"${p.type === 'anthropic' ? ' selected' : ''}>Anthropic（/v1/messages）</option></select></label>
    </div>
    <label class="field"><span>Base URL</span><input class="input mono" name="baseUrl" value="${esc(p.baseUrl)}" placeholder="https://api.example.com/v1"></label>
    <div class="grid2">
      <label class="field"><span>API Key</span><input class="input mono" name="apiKey" value="${esc(p.apiKey)}" placeholder="sk-…" autocomplete="off"></label>
      <label class="field"><span>模型（逗号分隔，第一个为默认）</span><input class="input" name="models" value="${esc(p.models.join(', '))}"></label>
    </div>
    <div class="btn-row"><button class="btn primary small" data-act="save-provider" data-id="${p.id}">保存</button>
      <button class="btn small" data-act="test-backend" data-backend="api:${p.id}">测试连接</button>
      <span class="test-out" data-out="api:${p.id}"></span></div>
  </div>`;
}

function settingsHTML() {
  const { config, dataDir } = S.data;
  return `<div class="page"><div class="page-inner">
    <h1>模型与连接</h1>
    <p class="lead">不需要注册律台账号。用 ChatGPT 套餐、本机的 Claude Code / Codex，或自己的 API Key，选一种即可。</p>
    <h2>ChatGPT 套餐</h2>
    ${chatgptCardHTML()}
    <h2>本机命令行智能体</h2>
    ${cliCardHTML('claude', 'Claude Code', '调用 <code>claude -p</code>。沿用你在终端里的登录状态和 ~/.claude 配置。',
      'ANTHROPIC_BASE_URL=https://your-proxy.example.com\nANTHROPIC_AUTH_TOKEN=sk-…\nANTHROPIC_MODEL=…')}
    ${cliCardHTML('codex', 'Codex', '调用 <code>codex exec</code>。沿用 ~/.codex 的登录状态和 config.toml；没单独安装时，会自动使用 ChatGPT 桌面版（macOS）里自带的 Codex。', 'OPENAI_API_KEY=sk-…\nOPENAI_BASE_URL=https://…')}
    <h2>自有 API</h2>
    ${config.providers.map(providerCardHTML).join('') || '<p class="lead" style="margin-bottom:12px">还没有添加。</p>'}
    <div class="btn-row"><select class="select" id="preset" style="width:auto">${PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join('')}</select>
      <button class="btn" data-act="add-provider">${icon('plus')}添加 API</button></div>
    <h2>版本与更新</h2>
    ${updateCardHTML()}
    <h2>本地数据</h2>
    <div class="card"><div class="field"><span>对话、附件、配置都保存在：</span><span class="mono-path">${esc(dataDir)}</span></div>
      <small style="color:var(--muted)">API Key 以明文保存在该目录的 config.json 中，ChatGPT 登录令牌保存在 chatgpt/ 子目录，请勿把这个文件夹分享给他人。</small></div>
  </div></div>`;
}

// ---------------- ChatGPT 套餐 ----------------
// 按 OpenAI「Sign in with ChatGPT」的界面规范：官方按钮、首次使用说明、输入框旁的用量入口、用量上限提示
const gptAccount = () => {
  const g = S.data?.chatgpt;
  return g?.accounts.find((a) => a.id === g.active && a.signedIn) || null;
};
const gptViaCodex = () => S.data.config.chatgpt?.useCodex !== false && !!S.data.clis.codex?.found;
const gptLogo = () => '<span class="gpt-logo"><img class="lb" src="/brand/chatgpt-logo-black.svg" alt=""><img class="lw" src="/brand/chatgpt-logo-white.svg" alt=""></span>';

// 每次渲染生成新的 ui 标识，点击后用它轮询这次登录的结果
function loginHref({ account, consent } = {}) {
  const ui = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return `/auth/chatgpt/start?ui=${ui}${account ? '&account=' + encodeURIComponent(account) : ''}${consent ? '&consent=1' : ''}`;
}
// light：浅色背景上用白色款（深色模式下用黑色款），用于不需要突出的位置
const siwcButton = (href, { light } = {}) => `<a class="siwc-btn${light ? ' light' : ''}" href="${esc(href)}" target="_blank" rel="noopener" data-login>
  <img class="lw" src="/brand/chatgpt-logo-white.svg" alt=""><img class="lb" src="/brand/chatgpt-logo-black.svg" alt=""><span>Continue with ChatGPT</span></a>`;

function chatgptCardHTML() {
  const g = S.data.chatgpt;
  const acct = gptAccount();
  const codex = !!S.data.clis.codex?.found;
  const useCodex = S.data.config.chatgpt?.useCodex !== false;
  const engine = useCodex && codex ? '本机有 Codex：会通过 Codex 执行，可以读取案卷、在工作区生成文件。'
    : codex ? '已设置为直接对话：附件会转成文字或图片发送，不能直接读写本机文件。'
      : '本机没有 Codex：直接对话，附件会转成文字或图片发送，不能直接读写本机文件。';
  const codexSwitch = `<label class="switch"${codex ? '' : ' title="没有检测到 Codex"'}><input type="checkbox" id="gpt-codex"${useCodex ? ' checked' : ''}${codex ? '' : ' disabled'}>有 Codex 时通过 Codex 执行</label>`;
  if (!acct) {
    const previous = g.accounts.filter((a) => !a.signedIn && a.email);
    return `<div class="card" id="chatgpt-card">
      <div class="card-head"><span class="ttl">使用你的 ChatGPT 套餐</span><span class="grow"></span>${codexSwitch}</div>
      <p class="lead" style="margin:0 0 14px;font-size:13.5px">用 ChatGPT 账号登录后，律台中符合条件的 AI 请求会使用你 ChatGPT 套餐包含的用量（或 credits 余额）完成，不需要 API Key。律台看不到你在 ChatGPT 里的对话；律台本身免费，不另外收费。</p>
      ${previous.map((a) => `<div class="gpt-prev"><span>${esc(a.email)}</span><span class="pill${a.needsLogin ? ' bad' : ''}">${a.needsLogin ? '登录已失效' : '已退出'}</span>
        <a class="btn small" href="${esc(loginHref({ account: a.id }))}" target="_blank" rel="noopener" data-login>重新登录</a></div>`).join('')}
      <div class="btn-row">${siwcButton(loginHref())}</div>
      <small class="gpt-foot">${engine}</small>
    </div>`;
  }
  const others = g.accounts.filter((a) => a.signedIn);
  const models = acct.models || [];
  return `<div class="card" id="chatgpt-card">
    <div class="card-head"><span class="ttl">${esc(acct.email || acct.name || 'ChatGPT 账号')}</span>
      <span class="pill ${acct.planUsage ? 'ok' : 'bad'}">${acct.planUsage ? '已登录' + (acct.plan ? ' · ' + esc(acct.plan) : '') : '未开启套餐用量'}</span><span class="grow"></span>${codexSwitch}</div>
    <p class="lead" style="margin:0 0 12px;font-size:13.5px">
      ${acct.planUsage ? '律台中符合条件的用量会使用这个账号的 ChatGPT 套餐。' + engine
        : '这次授权没有包含「使用 ChatGPT 套餐」的权限，律台暂时不能用它完成请求。'}</p>
    ${acct.planUsage ? '' : `<div class="btn-row" style="margin-bottom:12px">${siwcButton(loginHref({ account: acct.id, consent: true })).replace('Continue with ChatGPT', 'Continue with ChatGPT · 开启套餐用量')}</div>`}
    ${others.length > 1 ? `<label class="field"><span>当前账号</span><select class="select" id="gpt-account">${others.map((a) => `<option value="${esc(a.id)}"${a.id === acct.id ? ' selected' : ''}>${esc(a.email || a.id)}</option>`).join('')}</select></label>` : ''}
    ${acct.planUsage ? `<div class="field"><span class="with-act">可用模型（${models.length}）<button class="icon-btn mini" data-act="gpt-models" title="刷新模型列表">${icon('refresh')}</button></span>
      <div class="gpt-models">${models.map((m) => `<span class="pill">${esc(m.name)}</span>`).join('') || '<span class="pill">还没有获取到，点右上角刷新</span>'}</div></div>` : ''}
    <div class="btn-row">
      ${acct.planUsage ? '<button class="btn primary small" data-act="test-backend" data-backend="chatgpt">测试连接</button>' : ''}
      <a class="btn small" href="${esc(g.usageUrl)}" target="_blank" rel="noopener">管理用量</a>
      <span class="test-out" data-out="chatgpt"></span><span class="grow"></span>
      <a class="text-act" href="${esc(loginHref())}" target="_blank" rel="noopener" data-login>添加账号</a>
      <button class="text-act" data-act="gpt-logout" data-id="${esc(acct.id)}">退出登录</button></div>
  </div>`;
}

function planBannerHTML() {
  if (gptAccount() || S.data.config.chatgpt?.bannerDismissed) return '';
  return `<div class="plan-banner">${gptLogo()}<div class="t"><b>可以使用你的 ChatGPT 套餐</b><span>登录后，律台里的任务会使用你 ChatGPT 套餐包含的用量，不需要 API Key。</span></div>
    ${siwcButton(loginHref(), { light: true })}<button class="icon-btn" data-act="gpt-banner-x" title="不再显示">${icon('x')}</button></div>`;
}

// 浏览器里完成登录后，律台这边轮询结果
let loginPoll = null;
function watchLogin(ui) {
  clearInterval(loginPoll);
  const until = Date.now() + 10 * 60e3;
  toast('已在浏览器中打开 ChatGPT 登录页，完成后回到律台即可', 3500);
  loginPoll = setInterval(async () => {
    if (Date.now() > until) { clearInterval(loginPoll); return; }
    const r = await api('/api/chatgpt/login/' + ui).catch(() => null);
    if (!r || r.status === 'pending' || r.status === 'unknown') return;
    clearInterval(loginPoll);
    await refreshState();
    if (r.status === 'ok' && r.planUsage) {
      S.sel.backend = 'chatgpt';
      S.sel.model = '';
      ensureSel();
      saveSel();
    }
    renderMain();
    if (r.status === 'error') {
      const m = modal(`<h3>ChatGPT 登录没有完成</h3><p class="lead" style="margin:0">${esc(r.error)}</p>
        <div class="btn-row"><button class="btn primary" data-m="ok">知道了</button></div>`);
      m.onAction = () => m.close();
    } else if (S.data.chatgpt.welcomePending) showPlanWelcome();
    else toast(r.planUsage ? `已登录 ChatGPT${r.email ? '（' + r.email + '）' : ''}` : '已登录，但这次授权没有开启 ChatGPT 套餐用量', 3500);
  }, 1500);
}

// 第一次开启套餐用量时说明一次
function showPlanWelcome() {
  api('/api/chatgpt/welcome', { method: 'POST', body: {} }).then((st) => { S.data.chatgpt = st; }).catch(() => {});
  // 刚开启套餐用量，默认切到 ChatGPT
  if (S.sel.backend !== 'chatgpt') {
    S.sel.backend = 'chatgpt';
    S.sel.model = '';
    ensureSel();
    saveSel();
    refreshComposer();
  }
  const m = modal(`<div class="plan-welcome">${gptLogo()}<h3>你正在使用 ChatGPT 套餐</h3>
    <p>律台中符合条件的用量将使用你的 ChatGPT 套餐。可以在 ChatGPT 设置中管理用量。</p></div>
    <div class="btn-row"><a class="btn" href="${esc(S.data.chatgpt.usageUrl)}" target="_blank" rel="noopener">管理用量</a>
      <button class="btn primary" data-m="ok">知道了</button></div>`);
  m.onAction = () => m.close();
}

async function gptLogout(id) {
  const r = await api('/api/chatgpt/logout', { method: 'POST', body: { account: id } }).catch((e) => ({ error: e.message }));
  if (r.error) return toast('退出失败：' + r.error, 4000);
  await refreshState();
  ensureSel();
  renderMain();
  toast(r.revoked ? '已退出 ChatGPT 登录' : '已清除本机的登录信息，但没能确认 OpenAI 已撤销授权。可以在 ChatGPT 设置里断开律台。', r.revoked ? 2400 : 6000);
}

// ---------------- 检查更新 ----------------
const INSTALL_HOWTO = {
  'mac-app': '下载后打开 dmg，把「律台」拖进「应用程序」文件夹替换旧版。对话和设置保存在数据目录里，不受影响。',
  'windows-app': '下载后运行安装包，会直接覆盖旧版（如果律台还开着，安装程序会提示先关闭）。对话和设置不受影响。',
  source: '在律台所在目录运行 <code>git pull</code>，然后重新执行 <code>npm start</code>。',
};
const pad2 = (n) => String(n).padStart(2, '0');
const fmtTime = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const fmtSize = (n) => (n >= 1048576 ? Math.round(n / 1048576) + ' MB' : Math.ceil(n / 1024) + ' KB');

function updateCardHTML() {
  const u = S.update;
  const auto = S.data.config.autoUpdateCheck !== false;
  let pill = '';
  if (S.updateChecking) pill = '<span class="pill">正在检查…</span>';
  else if (u?.error) pill = '<span class="pill bad">检查失败</span>';
  else if (u?.hasUpdate) pill = `<span class="pill new">有新版本 v${esc(u.latest.version)}</span>`;
  else if (u?.latest) pill = '<span class="pill ok">已是最新版本</span>';
  const page = u?.releasesPage || 'https://github.com/245678000000/lawdesk/releases/latest';
  const line = u?.error ? `${esc(u.error)}。可以稍后重试，或直接打开<a href="${esc(page)}" target="_blank" rel="noopener">发布页</a>查看。`
    : u?.checkedAt ? `上次检查：${fmtTime(u.checkedAt)}` : '还没有检查过。';
  return `<div class="card" id="update-card">
    <div class="card-head"><span class="ttl">律台 v${esc(S.data.version)}</span>${pill}<span class="grow"></span>
      <label class="switch"><input type="checkbox" id="upd-auto"${auto ? ' checked' : ''}>自动检查更新</label></div>
    <p class="lead" style="margin:0 0 12px;font-size:13.5px">${line}</p>
    <div class="btn-row"><button class="btn small" data-act="check-update"${S.updateChecking ? ' disabled' : ''}>${icon('refresh')}检查更新</button>
      ${u?.hasUpdate ? `<button class="btn primary small" data-act="show-update">${icon('download')}查看新版本</button>` : ''}
      <a class="btn small" href="${esc(page)}" target="_blank" rel="noopener">所有版本</a></div>
    <small style="color:var(--muted);display:block;margin-top:10px">只向 GitHub 查询最新版本号，不会上传任何对话、文件或配置。自动检查每天最多一次。</small>
  </div>`;
}
function refreshUpdateCard() {
  const card = $('#update-card');
  if (card) card.outerHTML = updateCardHTML();
}

async function checkUpdate(force = false) {
  S.update = await api('/api/update' + (force ? '?force=1' : '')).catch((e) => ({ ...(S.update || {}), error: e.message }));
  renderSidebar();
  refreshUpdateCard();
  return S.update;
}

// 设置页的「检查更新」按钮，以及客户端菜单里的「检查更新…」
async function manualCheckUpdate() {
  const onPage = !!$('#update-card');
  S.updateChecking = true;
  refreshUpdateCard();
  if (!onPage) toast('正在检查更新…', 1500);
  const u = await checkUpdate(true);
  S.updateChecking = false;
  refreshUpdateCard();
  if (u.error) { if (!onPage) toast('检查更新失败：' + u.error, 4000); }
  else if (u.hasUpdate) showUpdateModal();
  else toast(`已是最新版本（v${u.current}）`);
}
window.lawdeskCheckUpdate = manualCheckUpdate;

function showUpdateModal() {
  const u = S.update;
  const l = u.latest;
  const dl = l.download;
  const label = dl ? `下载新版（${fmtSize(dl.size)}）` : u.install === 'source' ? '查看发布说明' : '打开下载页';
  const m = modal(`<h3>律台 v${esc(l.version)} 可以更新</h3>
    <div class="upd-meta">当前版本 v${esc(u.current)}${l.publishedAt ? ' · 发布于 ' + fmtTime(l.publishedAt).slice(0, 10) : ''}</div>
    ${l.notes ? `<div class="upd-notes md">${renderMarkdown(l.notes)}</div>` : ''}
    <p class="upd-how">${INSTALL_HOWTO[u.install] || INSTALL_HOWTO.source}</p>
    <div class="btn-row"><button class="btn" data-m="skip">忽略这个版本</button><span style="flex:1"></span>
      <button class="btn" data-m="cancel">稍后</button>
      <a class="btn primary" href="${esc(dl?.url || l.url)}" target="_blank" rel="noopener">${icon('download')}${label}</a></div>`);
  m.onAction = (act) => { m.close(); if (act === 'skip') dismissUpdate(l.version); };
}

async function dismissUpdate(version) {
  const r = await api('/api/update', { method: 'POST', body: { dismiss: version } }).catch(() => null);
  S.update = r ? { ...r, error: S.update?.error } : { ...S.update, dismissed: version };
  renderSidebar();
}

function readCard(card) {
  const out = {};
  for (const el of card.querySelectorAll('[name]')) out[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  return out;
}
const splitList = (s) => String(s || '').split(/[,，\n]/).map((x) => x.trim()).filter(Boolean);

async function saveConfig(cfg) {
  const r = await api('/api/config', { method: 'POST', body: cfg });
  S.data.config = r.config;
  S.data.clis = r.clis;
  ensureSel();
  renderSidebar();
}

// ---------------- 项目 ----------------
function openProjectModal(p) {
  const isNew = !p;
  p = p || { name: '', folder: '', instructions: '' };
  const m = modal(`<h3>${isNew ? '新建项目' : '编辑项目'}</h3>
    <label class="field"><span>项目名称</span><input class="input" name="name" value="${esc(p.name)}" placeholder="例如：张三诉李四买卖合同纠纷"></label>
    <label class="field"><span>案卷文件夹（可选）</span>
      <div style="display:flex;gap:8px"><input class="input mono" name="folder" value="${esc(p.folder)}" placeholder="~/Documents/案件/张三诉李四"><button class="btn" data-m="pick">选择…</button></div>
      <small>关联后，Claude Code / Codex 会把这个文件夹作为工作目录，直接读取里面的全部材料。</small></label>
    <label class="field"><span>项目说明（可选，每次对话都会告诉智能体）</span><textarea class="textarea" name="instructions" rows="4" placeholder="例如：我方为原告；管辖法院为上海市浦东新区人民法院；对方律师擅长程序抗辩">${esc(p.instructions)}</textarea></label>
    <div class="btn-row">${isNew ? '' : '<button class="btn danger" data-m="delete">删除项目</button>'}<span style="flex:1"></span>
      <button class="btn" data-m="cancel">取消</button><button class="btn primary" data-m="save">${isNew ? '创建' : '保存'}</button></div>`);
  m.onAction = async (act, form, root) => {
    if (act === 'cancel') return m.close();
    if (act === 'pick') {
      const r = native
        ? { path: await native.pickFolder().catch(() => null) }
        : await api('/api/pick-folder', { method: 'POST' });
      if (r.unsupported) return toast('当前系统不支持弹窗选择，请直接填写路径');
      if (r.path) root.querySelector('[name=folder]').value = r.path;
      return;
    }
    if (act === 'delete') {
      if (!confirm(`删除项目「${p.name}」？项目中的对话会保留，案卷文件夹不受影响。`)) return;
      await api('/api/projects/' + p.id, { method: 'DELETE' });
      m.close();
      await refreshState();
      return go('#/');
    }
    if (!form.name.trim()) return toast('请填写项目名称');
    try {
      const r = await api('/api/projects', { method: 'POST', body: { ...p, ...form } });
      m.close();
      await refreshState();
      go('#/p/' + r.project.id);
      renderMain();
    } catch (e) { toast(e.message); }
  };
}

// ---------------- 菜单与弹窗 ----------------
function closeMenus() { $('#overlay').innerHTML = ''; document.querySelectorAll('.more.open').forEach((n) => n.classList.remove('open')); }

function openMenu(anchor, html, onPick) {
  closeMenus();
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.innerHTML = html;
  $('#overlay').appendChild(menu);
  const r = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  let left = Math.min(r.left, window.innerWidth - mw - 8);
  let top = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  menu.style.left = Math.max(8, left) + 'px';
  menu.style.top = top + 'px';
  menu.addEventListener('click', (e) => {
    const mi = e.target.closest('.mi');
    if (!mi || mi.disabled) return;
    e.stopPropagation();
    closeMenus();
    onPick(mi.dataset.v, mi);
  });
  return menu;
}

function modal(html) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(bg);
  const ctl = { close: () => bg.remove(), onAction: null };
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) ctl.close(); });
  bg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !e.isComposing && e.keyCode !== 229) {
      const save = bg.querySelector('[data-m=save]');
      if (save) { e.preventDefault(); save.click(); }
    }
  });
  bg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    e.preventDefault();
    const form = {};
    for (const el of bg.querySelectorAll('[name]')) form[el.name] = el.value;
    ctl.onAction?.(b.dataset.m, form, bg);
  });
  setTimeout(() => bg.querySelector('input,textarea')?.focus(), 30);
  return ctl;
}

const mi = (v, label, { desc, checked, disabled, danger, ic } = {}) =>
  `<button class="mi${danger ? ' danger' : ''}" data-v="${esc(v)}"${disabled ? ' disabled' : ''}>
    <span class="ck">${checked ? icon('check') : ic ? icon(ic) : ''}</span><span class="tx">${esc(label)}${desc ? `<span class="ds">${esc(desc)}</span>` : ''}</span></button>`;

function convMenu(anchor, id) {
  const c = S.data.conversations.find((x) => x.id === id) || S.conv;
  if (!c) return;
  anchor.classList.add('open');
  const projects = S.data.projects;
  openMenu(anchor,
    mi('pin', c.pinned ? '取消置顶' : '置顶', { ic: 'pin' }) +
    mi('rename', '重命名', { ic: 'pen' }) +
    (projects.length ? '<div class="grp">移到项目</div>' + projects.map((p) => mi('move:' + p.id, p.name, { checked: c.projectId === p.id, ic: 'folder' })).join('') +
      (c.projectId ? mi('move:', '移出项目', { ic: 'x' }) : '') : '') +
    '<hr>' + mi('delete', '删除对话', { danger: true, ic: 'trash' }),
    async (v) => {
      if (v === 'pin') await api('/api/conversations/' + id, { method: 'PATCH', body: { pinned: !c.pinned } });
      else if (v === 'rename') {
        const m = modal(`<h3>重命名对话</h3><label class="field"><input class="input" name="title" value="${esc(c.title)}" maxlength="80"></label>
          <div class="btn-row"><button class="btn" data-m="cancel">取消</button><button class="btn primary" data-m="save">保存</button></div>`);
        m.onAction = async (act, form) => {
          m.close();
          const t = form.title.trim();
          if (act !== 'save' || !t) return;
          await api('/api/conversations/' + id, { method: 'PATCH', body: { title: t } });
          if (S.conv?.id === id) { S.conv.title = t; const el = $('.chat-head .title'); if (el) el.textContent = t; }
          refreshState();
        };
        return;
      } else if (v.startsWith('move:')) {
        const projectId = v.slice(5) || null;
        await api('/api/conversations/' + id, { method: 'PATCH', body: { projectId } });
        if (S.conv?.id === id) { S.conv.projectId = projectId; renderMain(); }
      } else if (v === 'delete') {
        if (!confirm(`删除「${c.title}」？对话记录和它的工作区文件都会被删除。`)) return;
        await api('/api/conversations/' + id, { method: 'DELETE' });
        if (S.route.view === 'chat' && S.route.id === id) go('#/');
      }
      refreshState();
    });
}

function modelMenu(anchor) {
  let html = '';
  for (const g of backendOptions()) {
    html += `<div class="grp"><span>${esc(g.label)}</span><span>${g.isApi || g.isPlan ? g.sub : g.ok ? g.sub : '未检测到'}</span></div>`;
    if (g.isPlan && !g.ok) { html += mi('settings', gptAccount() ? '开启 ChatGPT 套餐用量…' : '用 ChatGPT 账号登录…', { ic: 'plug' }); continue; }
    html += g.models.map((m) => mi(g.backend + '|' + m, g.names?.[m] || m || '默认模型', {
      checked: S.sel.backend === g.backend && (S.sel.model || '') === m, disabled: !g.ok,
      desc: m ? '' : { claude: '使用 Claude Code 当前设置的模型', codex: '使用 ~/.codex/config.toml 的模型', chatgpt: '使用账号的第一个可用模型' }[g.backend] || '',
    })).join('');
    if (g.isApi && !g.models.length) html += mi('settings', '未填写模型，去设置', { ic: 'plug' });
  }
  html += '<hr>' + mi('settings', '管理模型与 API…', { ic: 'plug' });
  openMenu(anchor, html, (v) => {
    if (v === 'settings') return go('#/settings');
    const [backend, model] = v.split('|');
    S.sel.backend = backend;
    S.sel.model = model;
    saveSel();
    refreshComposer();
  });
}

function permMenu(anchor) {
  openMenu(anchor, Object.entries(PERMS).map(([k, p]) => mi(k, p.label, { desc: p.desc, checked: S.sel.permission === k })).join(''), (v) => {
    S.sel.permission = v;
    saveSel();
    refreshComposer();
  });
}

function pickSkill(id) {
  const d = draft();
  const skill = S.data.skills.find((s) => s.id === id);
  d.skillId = d.skillId === id ? null : id;
  const ta = $('#input');
  if (d.skillId && skill?.starter && !d.text.trim()) {
    d.text = skill.starter;
    if (ta) ta.value = d.text;
  }
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.id === d.skillId));
  refreshComposer();
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); ta.dispatchEvent(new Event('input')); }
}

// ---------------- 全局事件 ----------------
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) { if (!e.target.closest('.menu')) closeMenus(); return; }
  if (el.closest('.menu')) return;
  const act = el.dataset.act;
  if (!['toggle-tool'].includes(act)) e.preventDefault();
  if (act !== 'conv-menu' && act !== 'model-menu' && act !== 'perm-menu' && act !== 'attach-menu' && act !== 'skill-menu') closeMenus();

  switch (act) {
    case 'new-chat': delete S.drafts.home; go('#/'); break;
    case 'new-project': openProjectModal(); break;
    case 'nav-skills': go('#/skills'); break;
    case 'nav-memory': go('#/memory'); break;
    case 'nav-settings': go('#/settings'); break;
    case 'show-update': showUpdateModal(); break;
    case 'dismiss-update': dismissUpdate(S.update.latest.version); break;
    case 'check-update': manualCheckUpdate(); break;
    case 'gpt-logout': gptLogout(el.dataset.id); break;
    case 'gpt-models': {
      el.disabled = true;
      const r = await api('/api/chatgpt/models', { method: 'POST', body: {} }).catch((err) => ({ error: err.message }));
      if (r.error) { el.disabled = false; toast('获取模型列表失败：' + r.error, 4000); break; }
      S.data.chatgpt = r;
      ensureSel();
      renderMain();
      toast(`已获取 ${gptAccount()?.models.length || 0} 个模型`);
      break;
    }
    case 'gpt-banner-x':
      S.data.config = (await api('/api/chatgpt/settings', { method: 'POST', body: { bannerDismissed: true } })).config;
      renderMain();
      break;
    case 'toggle-search': S.showSearch = !S.showSearch; if (!S.showSearch) S.search = ''; renderSidebar(); $('#sb-search')?.focus(); break;
    case 'toggle-sidebar': $('#app').classList.toggle('collapsed'); renderMain(); break;
    case 'toggle-projects': S.projectsOpen = !S.projectsOpen; renderSidebar(); break;
    case 'open-conv': if (!e.target.closest('.more')) go('#/c/' + el.dataset.id); break;
    case 'open-project': go('#/p/' + el.dataset.id); break;
    case 'conv-menu': e.stopPropagation(); convMenu(el, el.dataset.id); break;
    case 'edit-project': openProjectModal(S.data.projects.find((p) => p.id === el.dataset.id)); break;
    case 'reveal-project': api(`/api/projects/${el.dataset.id}/reveal`, { method: 'POST' }); break;
    case 'reveal-ws': api(`/api/conversations/${S.conv.id}/reveal`, { method: 'POST' }); break;
    case 'refresh-files': {
      const r = await api('/api/conversations/' + S.conv.id);
      S.files = r.files;
      renderFilesPanel();
      break;
    }
    case 'toggle-files': S.filesOpen = !S.filesOpen; renderFilesPanel(); break;
    case 'toggle-tool': if (!e.target.closest('.tool-detail')) el.classList.toggle('open'); break;
    case 'copy-msg': {
      const m = S.conv.messages.find((x) => x.id === el.dataset.mid);
      const text = (m?.parts || []).filter((p) => p.type === 'text').map((p) => p.text).join('\n\n');
      toast(await copyText(text) ? '已复制 Markdown' : '复制失败');
      break;
    }
    case 'rename-inline': {
      const t = el;
      const input = document.createElement('input');
      input.className = 'title-input';
      input.value = S.conv.title;
      t.replaceWith(input);
      input.focus();
      input.select();
      const done = async (save) => {
        const v = input.value.trim();
        if (save && v && v !== S.conv.title) {
          await api('/api/conversations/' + S.conv.id, { method: 'PATCH', body: { title: v } });
          S.conv.title = v;
          refreshState();
        }
        t.textContent = S.conv.title;
        input.replaceWith(t);
      };
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) done(true); if (ev.key === 'Escape') done(false); });
      input.addEventListener('blur', () => input.isConnected && done(true));
      break;
    }
    case 'attach-menu':
      openMenu(el, mi('files', '上传文件', { ic: 'paperclip', desc: 'PDF、Word、图片、表格等' }) + mi('folder', '上传文件夹', { ic: 'folder', desc: '整个案卷材料包' }), (v) => {
        $(v === 'folder' ? '#folder-input' : '#file-input').click();
      });
      break;
    case 'skill-menu':
      openMenu(el, S.data.skills.map((s) => mi(s.id, s.name, { desc: s.desc, checked: draft().skillId === s.id })).join(''), (v) => pickSkill(v));
      break;
    case 'model-menu': modelMenu(el); break;
    case 'perm-menu': permMenu(el); break;
    case 'mic': toggleMic(); break;
    case 'send': currentRunning() ? stopCurrent() : send(); break;
    case 'clear-skill': draft().skillId = null; document.querySelectorAll('.chip').forEach((c) => c.classList.remove('on')); refreshComposer(); break;
    case 'remove-att': draft().attachments.splice(Number(el.dataset.i), 1); refreshComposer(); break;
    case 'pick-skill': pickSkill(el.dataset.id); break;
    case 'chips-next': $('#chips')?.scrollBy({ left: 320, behavior: 'smooth' }); break;
    case 'ex-next': S.exPage++; { const ex = $('.examples'); if (ex) ex.outerHTML = examplesHTML(); } break;
    case 'pick-example': {
      const ex = S.data.examples[Number(el.dataset.i)];
      const d = draft();
      d.skillId = ex.skill;
      d.text = ex.prompt;
      const ta = $('#input');
      ta.value = d.text;
      document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.id === d.skillId));
      refreshComposer();
      ta.focus();
      ta.dispatchEvent(new Event('input'));
      break;
    }
    case 'mm-tab': {
      const wrap = el.closest('div').parentElement;
      wrap.querySelectorAll('.mermaid-tabs button').forEach((b) => b.classList.toggle('on', b === el));
      wrap.querySelector('.mermaid-box').classList.toggle('hidden', el.dataset.v !== 'g');
      wrap.querySelector('pre').classList.toggle('hidden', el.dataset.v === 'g');
      break;
    }
    // 技能 / 记忆 / 设置
    case 'new-skill': openSkillModal(); break;
    case 'edit-skill': openSkillModal(S.data.skills.find((s) => s.id === el.dataset.id)); break;
    case 'reset-skills':
      if (!confirm('恢复为内置技能？你新建或改写的技能会被清除。')) break;
      S.data.skills = (await api('/api/skills', { method: 'POST', body: { reset: true } })).skills;
      renderMain();
      break;
    case 'save-memory': saveMemory(); break;
    case 'save-cli': {
      const key = el.dataset.key;
      const f = readCard(el.closest('.card'));
      await saveConfig({ ...S.data.config, [key]: { ...S.data.config[key], enabled: f.enabled, bin: f.bin.trim(), models: splitList(f.models), env: f.env } });
      renderMain();
      toast('已保存');
      break;
    }
    case 'add-provider': {
      const p = PRESETS[Number($('#preset').value)];
      const cfg = S.data.config;
      await saveConfig({ ...cfg, providers: [...cfg.providers, { name: p.name.replace(/（.*）/, ''), type: p.type, baseUrl: p.baseUrl, apiKey: '', models: splitList(p.models) }] });
      renderMain();
      $('.page').scrollTop = $('.page').scrollHeight;
      break;
    }
    case 'save-provider': {
      const f = readCard(el.closest('.card'));
      const cfg = S.data.config;
      const providers = cfg.providers.map((p) => (p.id === el.dataset.id ? { ...p, ...f, models: splitList(f.models) } : p));
      await saveConfig({ ...cfg, providers });
      renderMain();
      toast('已保存');
      break;
    }
    case 'del-provider': {
      if (!confirm('删除这个 API 配置？')) break;
      const cfg = S.data.config;
      await saveConfig({ ...cfg, providers: cfg.providers.filter((p) => p.id !== el.dataset.id) });
      renderMain();
      break;
    }
    case 'test-backend': {
      const backend = el.dataset.backend;
      const out = document.querySelector(`[data-out="${CSS.escape(backend)}"]`);
      out.className = 'test-out';
      out.innerHTML = '<span class="spinner" style="display:inline-block;vertical-align:-2px"></span> 正在发送测试消息…';
      el.disabled = true;
      const r = await api('/api/test', { method: 'POST', body: { backend } }).catch((err) => ({ ok: false, error: err.message }));
      el.disabled = false;
      out.className = 'test-out ' + (r.ok ? 'ok' : 'bad');
      out.textContent = r.ok ? `✓ 正常（${(r.ms / 1000).toFixed(1)} 秒）：${r.text}` : `✗ ${r.error}`;
      break;
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeMenus(); document.querySelector('.modal-bg')?.remove(); }
});

for (const id of ['#file-input', '#folder-input']) {
  $(id).addEventListener('change', (e) => {
    const files = [...e.target.files].map((f) => ({ file: f, rel: f.webkitRelativePath || f.name }));
    e.target.value = '';
    uploadFiles(files);
  });
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-login]');
  if (!a) return;
  const ui = new URL(a.href, location.href).searchParams.get('ui');
  if (ui) watchLogin(ui);
  setTimeout(() => { if (S.route.view === 'settings') renderMain(); }, 300); // 换一个新的 ui 标识，方便再次点击
});

document.addEventListener('change', async (e) => {
  if (e.target.id === 'gpt-codex') {
    S.data.config = (await api('/api/chatgpt/settings', { method: 'POST', body: { useCodex: e.target.checked } })).config;
    renderMain();
    return;
  }
  if (e.target.id === 'gpt-account') {
    S.data.chatgpt = await api('/api/chatgpt/active', { method: 'POST', body: { account: e.target.value } });
    ensureSel();
    renderMain();
    return;
  }
  if (e.target.id !== 'upd-auto') return;
  const auto = e.target.checked;
  await api('/api/update', { method: 'POST', body: { auto } }).catch(() => {});
  S.data.config.autoUpdateCheck = auto;
  toast(auto ? '已开启自动检查更新' : '已关闭自动检查更新');
  if (auto) checkUpdate();
});

window.addEventListener('hashchange', route);

// ---------------- 启动 ----------------
(async () => {
  try {
    await refreshState();
  } catch (e) {
    $('#main').innerHTML = `<div class="home"><div class="home-spacer"></div><h1>无法连接本地服务</h1><p>${esc(e.message)}</p></div>`;
    return;
  }
  if (window.innerWidth < 760) $('#app').classList.add('collapsed');
  await route();
  if (S.data.chatgpt?.welcomePending) showPlanWelcome();
  // 是否真的联网由服务端决定：关闭了自动检查或 24 小时内查过，就直接返回上次的结果
  setTimeout(() => checkUpdate(), 1500);
})();
