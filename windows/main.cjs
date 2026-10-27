// 律台 Windows 客户端（Electron）：启动时用 Electron 自带的 Node 在后台运行 server.js，
// 窗口加载本地页面；退出时连同 claude / codex 子进程一起结束。界面和网页版完全相同。
const { app, BrowserWindow, Menu, shell, dialog, ipcMain, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');

const APP_NAME = '律台';
const HOMEPAGE = 'https://github.com/245678000000/lawdesk';
// 数据放在 %APPDATA%\LawDesk，Electron 自己的缓存放在它下面的 app 子目录（测试时可用 LAWDESK_HOME 指定）
const dataDir = process.env.LAWDESK_HOME || path.join(app.getPath('appData'), 'LawDesk');
app.setPath('userData', path.join(dataDir, 'app'));
const logFile = path.join(dataDir, 'logs', 'server.log');
const serverDir = app.isPackaged ? path.join(process.resourcesPath, 'server') : path.join(__dirname, '..');

let win = null;
let server = null;
let port = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showWindow());

function statusPage(title, detail, { spinner = false, retry = false } = {}) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<!doctype html><meta charset="utf-8"><title>${APP_NAME}</title><style>
  :root{color-scheme:light dark}
  body{margin:0;height:100vh;display:grid;place-items:center;background:#f4f4f2;color:#1f1f1e;
    font:15px "Segoe UI","Microsoft YaHei UI","Microsoft YaHei",-apple-system,sans-serif}
  @media (prefers-color-scheme:dark){body{background:#1b1b1a;color:#ecece8}}
  .box{text-align:center;max-width:560px;padding:24px}
  .mark{width:56px;height:56px;border-radius:14px;background:#1f1f1e;color:#fff;display:grid;place-items:center;
    font:600 30px "SimSun","Songti SC",serif;margin:0 auto 18px}
  h1{font-size:20px;margin:0 0 8px}
  p{color:#8c8c86;margin:0 0 16px;white-space:pre-wrap;line-height:1.6;font-size:13px;text-align:left}
  .sp{width:18px;height:18px;border:2px solid #d6d6d2;border-top-color:#55554f;border-radius:50%;
    animation:s .8s linear infinite;margin:0 auto}
  @keyframes s{to{transform:rotate(360deg)}}
  button{font:inherit;padding:7px 18px;border-radius:9px;border:1px solid #d6d6d2;background:#fff;cursor:pointer}
  </style><div class="box"><div class="mark">律</div><h1>${esc(title)}</h1>
  ${detail ? `<p>${esc(detail)}</p>` : ''}${spinner ? '<div class="sp"></div>' : ''}
  ${retry ? '<button onclick="lawdeskNative.restart()">重新启动</button>' : ''}</div>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

// ---------------- 后台服务 ----------------

function startServer() {
  port = null;
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const log = fs.createWriteStream(logFile);
  server = spawn(process.execPath, [path.join(serverDir, 'server.js')], {
    cwd: serverDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: '0',
      NO_OPEN: '1',
      LAWDESK_APP: '1',
      LAWDESK_HOME: dataDir,
      LAWDESK_PARENT_PID: String(process.pid),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let buf = '';
  server.stdout.on('data', (d) => {
    log.write(d);
    if (port) return;
    buf += d.toString('utf8');
    const m = buf.match(/LAWDESK_READY (\d+)/);
    if (m) {
      port = Number(m[1]);
      win?.loadURL(`http://127.0.0.1:${port}/`);
    }
  });
  server.stderr.on('data', (d) => log.write(d));
  server.on('error', (err) => {
    log.end();
    if (!quitting) win?.loadURL(statusPage('出了点问题', `无法启动本地服务：${err.message}`, { retry: true }));
  });
  server.on('exit', (code) => {
    server = null;
    log.end();
    if (quitting) return;
    let tail = '';
    try { tail = fs.readFileSync(logFile, 'utf8').split('\n').slice(-12).join('\n'); } catch {}
    win?.loadURL(statusPage('出了点问题', `本地服务意外退出（代码 ${code}）。\n\n${tail}\n\n完整日志：${logFile}`, { retry: true }));
  });
}

function stopServer() {
  if (!server) return;
  const pid = server.pid;
  server.removeAllListeners('exit');
  if (process.platform === 'win32') {
    // 连同 claude / codex 等子进程一起结束
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
  } else {
    server.kill('SIGTERM');
  }
  server = null;
}

function restartServer() {
  stopServer();
  win?.loadURL(statusPage('正在启动', '', { spinner: true }));
  setTimeout(startServer, 300);
}

// ---------------- 窗口 ----------------

const isAppUrl = (u) => port && u.hostname === '127.0.0.1' && Number(u.port) === port;

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 860,
    minHeight: 560,
    title: APP_NAME,
    backgroundColor: '#f4f4f2',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.on('page-title-updated', (e) => e.preventDefault());
  win.on('closed', () => { win = null; });

  // 新窗口链接、外部网页、工作区文件预览都交给系统默认浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    let u;
    try { u = new URL(url); } catch { return; }
    if (u.protocol === 'data:') return;
    if (isAppUrl(u) && (u.pathname === '/' || u.pathname === '/index.html')) return;
    if (isAppUrl(u) && u.searchParams.has('download')) return; // 交给下面的下载处理
    e.preventDefault();
    if (/^https?:$/.test(u.protocol)) shell.openExternal(url);
  });
  win.webContents.on('render-process-gone', () => win?.reload());

  win.loadURL(statusPage('正在启动', '', { spinner: true }));
}

function showWindow() {
  if (!win) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function go(hash) {
  showWindow();
  if (port) win.webContents.executeJavaScript(`location.hash = ${JSON.stringify(hash)}`).catch(() => {});
}

// 由网页去查询并展示结果（和设置页里的「检查更新」按钮是同一套逻辑）
function checkUpdate() {
  showWindow();
  if (port) win.webContents.executeJavaScript('window.lawdeskCheckUpdate && window.lawdeskCheckUpdate()').catch(() => {});
}

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: '文件',
      submenu: [
        { label: '新建对话', accelerator: 'CmdOrCtrl+N', click: () => go('#/') },
        { label: '模型与连接', accelerator: 'CmdOrCtrl+,', click: () => go('#/settings') },
        { type: 'separator' },
        { label: '打开数据文件夹', click: () => shell.openPath(dataDir) },
        { label: '查看运行日志', click: () => shell.openPath(logFile) },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' }, { type: 'separator' },
        { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' }, { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新载入', accelerator: 'CmdOrCtrl+R', click: () => (port ? win?.reload() : restartServer()) },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' }, { role: 'zoomIn', label: '放大' }, { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: '检查更新…', click: checkUpdate },
        { label: '项目主页', click: () => shell.openExternal(HOMEPAGE) },
        { label: `关于${APP_NAME}`, click: () => dialog.showMessageBox(win, {
          type: 'info', title: `关于${APP_NAME}`, message: `${APP_NAME} ${app.getVersion()}`,
          detail: `本地法律智能体，无需登录。\n数据目录：${dataDir}\n${HOMEPAGE}`,
        }) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------- 网页里的原生能力 ----------------

ipcMain.handle('pick-folder', async () => {
  const r = await dialog.showOpenDialog(win, { title: '选择案卷文件夹', properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('restart', () => restartServer());

app.whenReady().then(() => {
  app.setAppUserModelId('local.lawdesk.app');
  buildMenu();
  // 工作区文件的下载：直接存到「下载」文件夹并在资源管理器里选中
  session.defaultSession.on('will-download', (_e, item) => {
    const dir = app.getPath('downloads');
    const { name, ext } = path.parse(item.getFilename());
    let target = path.join(dir, name + ext);
    for (let i = 2; fs.existsSync(target); i++) target = path.join(dir, `${name} (${i})${ext}`);
    item.setSavePath(target);
    item.once('done', (_ev, state) => { if (state === 'completed') shell.showItemInFolder(target); });
  });
  createWindow();
  startServer();
});

app.on('activate', () => showWindow());
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { quitting = true; stopServer(); });
