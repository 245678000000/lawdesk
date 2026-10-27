// 检查更新：向 GitHub 查询最新发布的版本。请求里只有版本号，不带任何对话、配置或个人信息。
// 自动检查每天最多一次（结果缓存在数据目录的 update.json），手动检查随时可以。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from './store.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const REPO = '245678000000/lawdesk';
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;
// 测试时可以指向本地的模拟接口
const API = process.env.LAWDESK_UPDATE_API || `https://api.github.com/repos/${REPO}/releases/latest`;
const AUTO_INTERVAL = 24 * 3600 * 1000;

// 安装方式决定怎么升级：桌面客户端下载新安装包，源码运行用 git pull
const INSTALL = process.env.LAWDESK_APP !== '1' ? 'source'
  : process.platform === 'darwin' ? 'mac-app' : process.platform === 'win32' ? 'windows-app' : 'source';

export function compareVersions(a, b) {
  const parse = (v) => String(v).trim().replace(/^v/i, '').split(/[-+]/)[0].split('.').map((n) => parseInt(n, 10) || 0);
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

// 挑出适合本机的安装包：Mac 用 .dmg（同架构优先，其次通用版），Windows 用 Setup .exe
function pickAsset(assets) {
  if (INSTALL === 'source') return null;
  const list = assets.filter((a) => (INSTALL === 'mac-app' ? /\.dmg$/i : /setup.*\.exe$/i).test(a.name));
  return list.find((a) => a.name.includes(process.arch)) || list.find((a) => /universal/i.test(a.name)) || null;
}

async function fetchLatest() {
  const res = await fetch(API, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `LawDesk/${VERSION}` },
    signal: AbortSignal.timeout(12000),
  });
  if (res.status === 404) throw new Error('还没有发布过正式版本');
  if (res.status === 403 || res.status === 429) throw new Error('GitHub 暂时限制了查询次数，请过一会儿再试');
  if (!res.ok) throw new Error(`GitHub 返回 ${res.status}`);
  const rel = await res.json();
  const asset = pickAsset(rel.assets || []);
  return {
    version: String(rel.tag_name || '').replace(/^v/i, ''),
    name: rel.name || '',
    notes: String(rel.body || '').slice(0, 6000),
    url: rel.html_url || RELEASES_PAGE,
    publishedAt: rel.published_at || null,
    download: asset ? { name: asset.name, url: asset.browser_download_url, size: asset.size } : null,
  };
}

function view(saved, extra = {}) {
  const cfg = store.getConfig();
  const latest = saved.latest || null;
  return {
    current: VERSION,
    install: INSTALL,
    platform: process.platform,
    auto: cfg.autoUpdateCheck !== false,
    releasesPage: RELEASES_PAGE,
    checkedAt: saved.checkedAt || null,
    latest,
    hasUpdate: !!latest?.version && compareVersions(latest.version, VERSION) > 0,
    dismissed: saved.dismissed || null,
    ...extra,
  };
}

let inflight = null;

// force=false：自动检查，关闭了自动检查或 24 小时内查过就直接返回上次的结果
export async function checkUpdate({ force = false } = {}) {
  const saved = store.getUpdateState();
  const cfg = store.getConfig();
  if (!force && (cfg.autoUpdateCheck === false || (saved.checkedAt && Date.now() - saved.checkedAt < AUTO_INTERVAL))) {
    return view(saved);
  }
  inflight ||= fetchLatest().finally(() => { inflight = null; });
  try {
    const latest = await inflight;
    const next = { ...saved, checkedAt: Date.now(), latest };
    store.saveUpdateState(next);
    return view(next);
  } catch (e) {
    const msg = e.name === 'TimeoutError' || e.name === 'AbortError' ? '连接 GitHub 超时'
      : e.cause?.code ? `无法连接 GitHub（${e.cause.code}）` : e.message;
    return view(saved, { error: msg });
  }
}

export function updateSettings({ auto, dismiss } = {}) {
  if (typeof auto === 'boolean') store.saveConfig({ ...store.getConfig(), autoUpdateCheck: auto });
  if (dismiss !== undefined) store.saveUpdateState({ ...store.getUpdateState(), dismissed: dismiss ? String(dismiss) : null });
  return view(store.getUpdateState());
}
