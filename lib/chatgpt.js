// 用 ChatGPT 套餐：按 OpenAI「Sign in with ChatGPT」开源应用流程登录，请求消耗用户自己 ChatGPT 套餐的用量。
// 文档：https://developers.openai.com/siwc/token-sharing-open-source
// 律台只拿到调用 Responses API 的授权，看不到用户在 ChatGPT 里的对话。
// 凭证保存在数据目录的 chatgpt/ 下（仅本人可读写），不进浏览器存储、不写日志、不放进网址。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as store from './store.js';
import { sseLines } from './api.js';

export const AGENT_NAME = 'LawDesk';
// 测试时可以指向本地的模拟服务
const AUTH = (process.env.LAWDESK_CHATGPT_AUTH || 'https://auth.openai.com').replace(/\/+$/, '');
export const API_BASE = (process.env.LAWDESK_CHATGPT_API || 'https://api.openai.com/v1').replace(/\/+$/, '');
const RESOURCE = 'https://api.openai.com/v1';
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const PLAN_SCOPE = 'chatgpt.tokens.use.direct';
export const USAGE_URL = 'https://chatgpt.com/settings/usage';
const NEW_CLIENT = 'dynamic_agent_client';

const DIR = path.join(store.DATA_DIR, 'chatgpt');
fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });

export class PlanError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}
const needLogin = () => new PlanError('ChatGPT 登录已失效，请在「模型与连接」里重新登录。', 'chatgpt_login');

// ---------------- 本地存储 ----------------

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function writePrivate(p, value) {
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, p);
  try { fs.chmodSync(p, 0o600); } catch {}
}

// index.json：本机的 host ID、当前账号、各账号的基本信息（不含令牌）
function readIndex() {
  const idx = readJSON(path.join(DIR, 'index.json'), {});
  idx.accounts ||= {};
  if (!idx.hostId) {
    // 每台电脑一个，首次登录前生成并一直沿用
    idx.hostId = 'urn:uuid:' + crypto.randomUUID();
    writeIndex(idx);
  }
  return idx;
}
function writeIndex(idx) { writePrivate(path.join(DIR, 'index.json'), idx); }

// 每个账号（OpenAI 分配的 client_id）一份凭证文件
const credPath = (clientId) => path.join(DIR, `cred-${String(clientId).replace(/[^\w.-]/g, '_')}.json`);
const readCred = (clientId) => readJSON(credPath(clientId), null);
const writeCred = (clientId, cred) => writePrivate(credPath(clientId), cred);
function clearCred(clientId) { try { fs.unlinkSync(credPath(clientId)); } catch {} }

function updateAccount(clientId, patch) {
  const idx = readIndex();
  if (!idx.accounts[clientId]) return;
  Object.assign(idx.accounts[clientId], patch);
  if (patch.signedIn === false && idx.active === clientId) {
    idx.active = Object.values(idx.accounts).find((a) => a.signedIn && a.clientId !== clientId)?.clientId || null;
  }
  writeIndex(idx);
}

// ---------------- OpenID 配置与 ID token 校验 ----------------

let discoveryCache = null;
async function discovery() {
  if (discoveryCache && Date.now() - discoveryCache.at < 3600e3) return discoveryCache.doc;
  const fallback = {
    issuer: AUTH,
    authorization_endpoint: AUTH + '/api/accounts/authorize',
    token_endpoint: AUTH + '/api/accounts/oauth/token',
    jwks_uri: AUTH + '/.well-known/jwks.json',
    revocation_endpoint: null,
  };
  try {
    const r = await fetch(AUTH + '/.well-known/openid-configuration', { signal: AbortSignal.timeout(10000) });
    if (r.ok) {
      const doc = { ...fallback, ...(await r.json()) };
      discoveryCache = { at: Date.now(), doc };
      return doc;
    }
  } catch {}
  return fallback;
}

let jwksCache = null;
async function signingKey(uri, kid) {
  for (const force of [false, true]) {
    if (force || !jwksCache || jwksCache.uri !== uri || Date.now() - jwksCache.at > 3600e3) {
      const r = await fetch(uri, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error(`无法获取 OpenAI 的签名公钥（HTTP ${r.status}）`);
      jwksCache = { at: Date.now(), uri, keys: (await r.json()).keys || [] };
    }
    const key = jwksCache.keys.find((k) => k.kid === kid);
    if (key) return key;
  }
  return null;
}

const decodePart = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

async function verifyIdToken(idToken, { clientId, nonce }) {
  const parts = String(idToken).split('.');
  if (parts.length !== 3) throw new Error('ID token 格式不对');
  const header = decodePart(parts[0]);
  const claims = decodePart(parts[1]);
  const doc = await discovery();
  const jwk = await signingKey(doc.jwks_uri, header.kid);
  if (!jwk) throw new Error('ID token 的签名公钥未知');
  const opts = { RS256: {}, ES256: { dsaEncoding: 'ieee-p1363' } }[header.alg];
  if (!opts) throw new Error('不支持的签名算法：' + header.alg);
  const ok = crypto.verify('sha256', Buffer.from(parts[0] + '.' + parts[1]),
    { key: crypto.createPublicKey({ key: jwk, format: 'jwk' }), ...opts }, Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new Error('ID token 签名无效');
  const now = Date.now() / 1000;
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== doc.issuer) throw new Error('ID token 的签发方不对');
  if (!aud.includes(clientId)) throw new Error('ID token 不是签发给这个应用的');
  if (typeof claims.exp !== 'number' || claims.exp < now - 5) throw new Error('ID token 已过期');
  if (typeof claims.iat !== 'number') throw new Error('ID token 缺少签发时间');
  if (claims.nonce !== nonce) throw new Error('ID token 的 nonce 不匹配');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('ID token 缺少账号标识');
  return claims;
}

const planOf = (claims) => claims['https://api.openai.com/auth']?.chatgpt_plan_type || '';

// ---------------- 登录 ----------------

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const random = (n = 32) => b64url(crypto.randomBytes(n));
const attempts = new Map(); // state -> 登录中的请求
const loginStatus = new Map(); // 前端轮询用的 id -> { status, error, welcome }

// 返回要在系统浏览器里打开的授权地址。account：重新登录某个已注册的账号；consent：重新请求套餐权限
export async function startLogin({ port, ui, account, consent }) {
  const idx = readIndex();
  const acct = account ? idx.accounts[account] : null;
  const doc = await discovery();
  for (const [k, a] of attempts) if (a.expiresAt < Date.now()) attempts.delete(k);

  const state = random();
  const nonce = random();
  const verifier = random(48);
  const redirectUri = `http://127.0.0.1:${port}/auth/callback`;
  const clientId = acct?.clientId || NEW_CLIENT;
  attempts.set(state, { state, nonce, verifier, redirectUri, clientId, ui, expiresAt: Date.now() + 600e3 });
  if (ui) loginStatus.set(ui, { status: 'pending' });

  const q = {
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SCOPES,
    resource: RESOURCE,
    state,
    nonce,
    code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
    ext_agent_host_id: idx.hostId,
  };
  if (!acct) q.agent_name_hint = AGENT_NAME;
  else {
    const cred = readCred(acct.clientId);
    if (cred?.id_token) q.id_token_hint = cred.id_token;
    if (acct.email) q.login_hint = acct.email;
  }
  if (consent) q.prompt = 'consent';
  return doc.authorization_endpoint + '?' + Object.entries(q).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

export const loginState = (ui) => loginStatus.get(ui) || { status: 'unknown' };

// 处理浏览器回到 /auth/callback 的请求，返回给用户看的结果
export async function finishLogin(params) {
  const a = attempts.get(params.get('state') || '');
  attempts.delete(params.get('state') || '');
  if (!a || a.expiresAt < Date.now()) {
    return { ok: false, message: '这次登录请求已失效（超过 10 分钟或已经用过）。请回到律台重新点击「Continue with ChatGPT」。' };
  }
  const fail = (message) => {
    if (a.ui) loginStatus.set(a.ui, { status: 'error', error: message });
    return { ok: false, message };
  };
  try {
    const error = params.get('error');
    if (error) {
      return fail(error === 'access_denied'
        ? '你没有同意授权，律台不会使用你的 ChatGPT 套餐。之后可以随时在「模型与连接」里重新登录。'
        : `登录没有完成：${params.get('error_description') || error}`);
    }
    const code = params.get('code');
    if (!code) return fail('回调里没有授权码，请重新登录。');

    let clientId = a.clientId;
    const returned = params.get('client_id');
    if (clientId === NEW_CLIENT) {
      if (!returned || returned === NEW_CLIENT) return fail('注册没有完成（OpenAI 没有返回应用 ID），请重新登录。');
      clientId = returned;
    } else if (returned && returned !== clientId) {
      return fail('OpenAI 返回的应用 ID 和这个账号对不上，已拒绝这次登录。');
    }

    const doc = await discovery();
    const res = await fetch(doc.token_endpoint, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', client_id: clientId, code,
        code_verifier: a.verifier, redirect_uri: a.redirectUri, resource: RESOURCE,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const tokens = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = tokens.error?.code || tokens.error;
      return fail(err === 'invalid_grant' ? '授权码已失效，请重新登录。'
        : `换取令牌失败（HTTP ${res.status}${requestIdOf(res)}）：${tokens.error_description || tokens.error?.message || err || ''}`);
    }
    if (typeof tokens.id_token !== 'string' || !tokens.access_token) return fail('OpenAI 没有返回完整的令牌，请重新登录。');
    const claims = await verifyIdToken(tokens.id_token, { clientId, nonce: a.nonce });

    const idx = readIndex();
    const existing = idx.accounts[clientId];
    if (existing?.subject && existing.subject !== claims.sub) {
      return fail('登录的不是原来那个 ChatGPT 账号。要用另一个账号，请在律台里选「添加其他账号」。');
    }
    const scopes = String(tokens.scope || params.get('scope') || '').split(/\s+/).filter(Boolean);
    const planUsage = scopes.includes(PLAN_SCOPE);
    const now = Date.now();
    writeCred(clientId, {
      email: claims.email || null,
      issuer: claims.iss,
      subject: claims.sub,
      client_id: clientId,
      ext_agent_host_id: idx.hostId,
      id_token: tokens.id_token,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_type: tokens.token_type || 'Bearer',
      expires_in: Number(tokens.expires_in) || 3600,
      earliest_refresh_at: tokens.earliest_refresh_at ?? null,
      scopes,
      saved_at: new Date(now).toISOString(),
    });
    idx.accounts[clientId] = {
      ...existing,
      clientId,
      subject: claims.sub,
      email: claims.email || existing?.email || '',
      name: claims.name || existing?.name || '',
      plan: planOf(claims) || existing?.plan || '',
      planUsage,
      signedIn: true,
      needsLogin: false,
      addedAt: existing?.addedAt || now,
      lastLoginAt: now,
    };
    idx.active = clientId;
    // 「你正在使用 ChatGPT 套餐」的说明只在第一次开启套餐用量时显示；律台页面下次打开时弹出，看过后清除
    const welcome = planUsage && !idx.welcomed;
    if (welcome) Object.assign(idx, { welcomed: true, welcomePending: true });
    writeIndex(idx);
    if (planUsage) await refreshModels(clientId).catch(() => {});
    if (a.ui) loginStatus.set(a.ui, { status: 'ok', welcome, planUsage, email: claims.email || '' });
    return { ok: true, planUsage, email: claims.email || '' };
  } catch (e) {
    return fail('登录失败：' + (e.name === 'TimeoutError' ? '连接 OpenAI 超时' : e.message));
  }
}

export function acknowledgeWelcome() {
  const idx = readIndex();
  idx.welcomePending = false;
  writeIndex(idx);
}

export function setActive(clientId) {
  const idx = readIndex();
  if (!idx.accounts[clientId]?.signedIn) throw new Error('这个账号还没有登录');
  idx.active = clientId;
  writeIndex(idx);
}

// 退出登录：向 OpenAI 撤销刷新令牌，清掉本地令牌；保留账号和应用 ID 的对应关系，下次登录沿用
export async function logout(clientId) {
  const cred = readCred(clientId);
  let revoked = !cred?.refresh_token;
  if (cred?.refresh_token) {
    const doc = await discovery();
    for (let i = 0; i < 3 && doc.revocation_endpoint && !revoked; i++) {
      try {
        const r = await fetch(doc.revocation_endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: cred.refresh_token, token_type_hint: 'refresh_token', client_id: clientId }),
          signal: AbortSignal.timeout(10000),
        });
        if (r.ok) revoked = true;
        else if (r.status < 500) break;
      } catch {}
      if (!revoked && i < 2) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  clearCred(clientId);
  updateAccount(clientId, { signedIn: false, needsLogin: false });
  return { revoked };
}

// ---------------- 令牌刷新 ----------------

const toMs = (v) => (v == null ? 0 : typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : Date.parse(v) || 0);
const TERMINAL_REFRESH = ['invalid_grant', 'invalid_refresh_token', 'token_expired', 'refresh_token_expired',
  'refresh_token_invalidated', 'refresh_token_reused'];
const refreshing = new Map();

// 取一个至少还能用 minValidMs 的访问令牌；同一账号的刷新串行进行（刷新令牌每次都会轮换）
export async function accessToken(clientId, { minValidMs = 120e3, force = false } = {}) {
  const cred = readCred(clientId);
  if (!cred?.access_token) throw needLogin();
  const expiresAt = toMs(cred.saved_at) + (cred.expires_in || 3600) * 1000;
  const left = expiresAt - Date.now();
  if (!force && left > minValidMs) return cred.access_token;
  // 还没到允许刷新的时间、令牌也没过期，就先用着
  if (!force && Date.now() < toMs(cred.earliest_refresh_at) && left > 60e3) return cred.access_token;
  if (!refreshing.has(clientId)) refreshing.set(clientId, refresh(clientId).finally(() => refreshing.delete(clientId)));
  return refreshing.get(clientId);
}

async function refresh(clientId) {
  const cred = readCred(clientId);
  if (!cred?.refresh_token) { updateAccount(clientId, { needsLogin: true }); throw needLogin(); }
  const doc = await discovery();
  let res;
  try {
    res = await fetch(doc.token_endpoint, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, refresh_token: cred.refresh_token, resource: RESOURCE }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    // 网络问题不清除凭证
    throw new Error('刷新 ChatGPT 登录失败：' + (e.name === 'TimeoutError' ? '连接 OpenAI 超时' : e.message));
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = body.error?.code || body.error || body.code;
    if (TERMINAL_REFRESH.includes(code)) {
      clearCred(clientId);
      updateAccount(clientId, { needsLogin: true });
      throw needLogin();
    }
    if (code === 'invalid_client') throw new Error('OpenAI 不认可这个应用注册（invalid_client），请退出后重新登录。');
    throw new Error(`刷新 ChatGPT 登录失败（HTTP ${res.status}${requestIdOf(res)}）`);
  }
  // 访问令牌、有效期、权限范围和新的刷新令牌一起替换
  const scopes = body.scope ? String(body.scope).split(/\s+/).filter(Boolean) : cred.scopes;
  writeCred(clientId, {
    ...cred,
    access_token: body.access_token,
    refresh_token: body.refresh_token || cred.refresh_token,
    id_token: body.id_token || cred.id_token,
    expires_in: Number(body.expires_in) || 3600,
    earliest_refresh_at: body.earliest_refresh_at ?? null,
    scopes,
    saved_at: new Date().toISOString(),
  });
  updateAccount(clientId, { planUsage: scopes.includes(PLAN_SCOPE), needsLogin: false });
  return body.access_token;
}

// ---------------- 账号、模型 ----------------

export function activeAccount() {
  const idx = readIndex();
  const acct = idx.active && idx.accounts[idx.active];
  if (!acct?.signedIn) throw new PlanError('还没有登录 ChatGPT。请在「模型与连接」里点「Continue with ChatGPT」。', 'chatgpt_login');
  if (acct.needsLogin) throw needLogin();
  if (!acct.planUsage) throw new PlanError('这个 ChatGPT 账号还没有开启「使用 ChatGPT 套餐」权限，请在「模型与连接」里开启。', 'chatgpt_login');
  return acct;
}

export function publicState() {
  const idx = readIndex();
  const accounts = Object.values(idx.accounts).map((a) => ({
    id: a.clientId, email: a.email, name: a.name, plan: a.plan,
    planUsage: !!a.planUsage, signedIn: !!a.signedIn && fs.existsSync(credPath(a.clientId)),
    needsLogin: !!a.needsLogin, models: a.models || [], modelsAt: a.modelsAt || null,
  }));
  const active = accounts.find((a) => a.id === idx.active && a.signedIn) ? idx.active : null;
  return { active, accounts, usageUrl: USAGE_URL, welcomePending: !!idx.welcomePending };
}

export async function refreshModels(clientId) {
  const token = await accessToken(clientId);
  const r = await fetch(API_BASE + '/models', { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw await planHttpError(r);
  const j = await r.json();
  const models = (j.models || j.data || [])
    .filter((m) => !m.visibility || m.visibility === 'list')
    .map((m) => ({ slug: m.slug || m.id, name: m.display_name || m.slug || m.id }))
    .filter((m) => m.slug);
  updateAccount(clientId, { models, modelsAt: Date.now() });
  return models;
}

export async function defaultModel(acct) {
  if (acct.models?.length) return acct.models[0].slug;
  const models = await refreshModels(acct.clientId);
  if (!models.length) throw new Error('这个 ChatGPT 账号没有可用的模型。');
  return models[0].slug;
}

// 交给 Codex 使用的模型提供方配置（官方 Codex app-server 文档里的同一组设置）
export function codexProviderArgs() {
  const p = 'model_providers.lawdesk_chatgpt_plan';
  return [
    '-c', 'model_provider="lawdesk_chatgpt_plan"',
    '-c', `${p}.name="ChatGPT plan"`,
    '-c', `${p}.base_url=${JSON.stringify(API_BASE)}`,
    '-c', `${p}.env_key="LAWDESK_CHATGPT_TOKEN"`,
    '-c', `${p}.wire_api="responses"`,
    '-c', `${p}.requires_openai_auth=false`,
    '-c', `${p}.supports_websockets=false`,
  ];
}

// ---------------- 错误 ----------------

function requestIdOf(res) {
  const id = res.headers.get('x-request-id') || res.headers.get('openai-request-id');
  return id ? `，请求 ID ${id}` : '';
}

const USAGE_LIMIT_TEXT = '已达到用量上限。请在 ChatGPT 设置中查看你的套餐或律台的用量上限。';
function planErrorFrom(err, status, reqId = '') {
  const code = err?.code || '';
  const param = err?.param ? `（${err.param}）` : '';
  const known = {
    subscription_sharing_usage_limit_exceeded: [USAGE_LIMIT_TEXT, 'chatgpt_usage_limit'],
    subscription_sharing_usage_unavailable: ['暂时无法确认 ChatGPT 套餐的用量，请稍后再试。'],
    subscription_sharing_user_not_eligible: ['这个 ChatGPT 账号或工作区目前不能在其他应用里使用套餐用量（可能受套餐类型、工作区设置或所在地区限制）。'],
    subscription_sharing_unsupported_capability: [`请求里有 ChatGPT 套餐暂不支持的内容${param}，请换一个模型或去掉相应附件。`],
    subscription_sharing_route_not_supported: ['ChatGPT 套餐暂不支持这个接口。'],
    subscription_sharing_invalid_user: ['无法验证这个 ChatGPT 账号，请退出后重新登录。', 'chatgpt_login'],
    chatpass_v2_scope_not_authorized: ['这次授权不包含使用 ChatGPT 套餐的权限，请在「模型与连接」里重新开启。', 'chatgpt_login'],
    chatpass_v2_invalid_authorization_context: ['这次授权不包含使用 ChatGPT 套餐的权限，请在「模型与连接」里重新开启。', 'chatgpt_login'],
    subscription_sharing_user_unavailable: ['ChatGPT 账号信息暂时不可用，请稍后再试。'],
  }[code];
  if (known) return new PlanError(known[0] + (code ? `\n（${code}${status ? '，HTTP ' + status : ''}${reqId}）` : ''), known[1]);
  const msg = err?.message || err?.detail || (typeof err === 'string' ? err : '') || '请求失败';
  return new PlanError(`ChatGPT 返回错误${status ? '（HTTP ' + status + reqId + '）' : ''}：${String(msg).slice(0, 500)}`);
}

async function planHttpError(res) {
  let body = {};
  try { body = await res.json(); } catch {}
  const reqId = requestIdOf(res);
  if (body.error && typeof body.error === 'object') return planErrorFrom(body.error, res.status, reqId);
  // 进入 Responses 之前的拒绝不一定是标准错误格式，例如 {"detail": "..."}
  const detail = body.detail || body.message || '';
  const hint = {
    401: '没有通过身份或权限校验，请检查所选的 ChatGPT 账号是否开启了套餐用量。',
    403: '被策略或权限检查拦截（例如所在地区不在服务范围内）。',
    503: 'ChatGPT 套餐通道暂时不可用，请稍后再试。',
  }[res.status] || '请求失败。';
  return new PlanError(`${hint}${detail ? '\n' + String(detail).slice(0, 300) : ''}\n（HTTP ${res.status}${reqId}）`,
    res.status === 401 ? 'chatgpt_login' : undefined);
}

// Codex 的报错里带着同样的错误码时，转成同样的提示
export function explainCodexPlanError(message) {
  if (/subscription_sharing_usage_limit_exceeded|usage limit/i.test(message)) return new PlanError(USAGE_LIMIT_TEXT, 'chatgpt_usage_limit');
  const m = message.match(/\b(subscription_sharing_\w+|chatpass_v2_\w+)\b/);
  if (m) return planErrorFrom({ code: m[1] }, 0);
  return null;
}

// ---------------- 直接对话（Responses API） ----------------

const sleep = (ms, signal) => new Promise((resolve) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
});

// messages：[{ role, content, images? }]，images 是 data: 网址
export async function runChatGPT({ clientId, model, systemPrompt, messages }, emit, signal) {
  const input = messages.map((m) => (m.role === 'user' && m.images?.length
    ? { role: 'user', content: [{ type: 'input_text', text: m.content }, ...m.images.map((url) => ({ type: 'input_image', image_url: url }))] }
    : { role: m.role, content: m.content }));
  const body = JSON.stringify({ model, instructions: systemPrompt, input, store: false, stream: true });

  let token = await accessToken(clientId);
  let res;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(API_BASE + '/responses', {
      method: 'POST', signal, body,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    });
    // 令牌可能刚好失效：刷新一次再试；临时不可用：有限次退避重试
    if (res.status === 401 && attempt === 0) { await res.body?.cancel(); token = await accessToken(clientId, { force: true }); continue; }
    if (res.status === 503 && attempt < 2) { await res.body?.cancel(); await sleep(1500 * (attempt + 1), signal); if (signal?.aborted) return {}; continue; }
    break;
  }
  if (!res.ok) throw await planHttpError(res);
  emit({ t: 'status', d: '已连接 ChatGPT' });

  const reqId = requestIdOf(res);
  let finished = false;
  for await (const line of sseLines(res)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    let ev;
    try { ev = JSON.parse(data); } catch { continue; }
    switch (ev.type) {
      case 'response.output_text.delta':
        emit({ t: 'text', d: ev.delta || '' });
        break;
      case 'response.reasoning_summary_text.delta':
      case 'response.reasoning_text.delta':
        emit({ t: 'status', d: '思考中…' });
        break;
      case 'response.output_item.added':
        if (ev.item?.type === 'reasoning') emit({ t: 'status', d: '思考中…' });
        break;
      case 'response.completed':
        finished = true;
        break;
      case 'response.incomplete': {
        finished = true;
        const reason = ev.response?.incomplete_details?.reason;
        emit({ t: 'notice', d: `回答没有完整生成${reason ? '（' + reason + '）' : ''}，可以回复「继续」。` });
        break;
      }
      case 'response.failed':
        throw planErrorFrom(ev.response?.error, 0, reqId);
      case 'error':
        throw planErrorFrom(ev.error || ev, 0, reqId);
    }
  }
  if (!finished && !signal?.aborted) throw new PlanError('连接中断，回答可能不完整，可以回复「继续」。');
  return {};
}
