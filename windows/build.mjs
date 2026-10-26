// 打包 Windows 安装包：cd windows && npm install && npm run dist
// 在 Windows 和 macOS 上都可以运行，产物是 dist/LawDesk-Setup-<版本>-x64.exe。
// 先把客户端和服务端文件复制到一个干净的临时目录再打包：electron-builder 会向上查找
// package.json / 锁文件，如果上级目录（比如用户主目录）里恰好有别的项目，会把它误当成工作区。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const arch = process.argv.includes('--arm64') ? 'arm64' : 'x64';

const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdesk-win-'));
try {
  for (const f of ['main.cjs', 'preload.cjs', 'build']) {
    fs.cpSync(path.join(here, f), path.join(stage, f), { recursive: true });
  }
  for (const f of ['server.js', 'package.json', 'lib', 'public']) {
    fs.cpSync(path.join(root, f), path.join(stage, 'server', f), { recursive: true });
  }
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(stage, 'LICENSE'));

  const pkg = readJSON(path.join(here, 'package.json'));
  pkg.version = readJSON(path.join(root, 'package.json')).version;
  pkg.build.electronVersion = readJSON(path.join(here, 'node_modules', 'electron', 'package.json')).version;
  pkg.build.directories.output = path.join(root, 'dist');
  pkg.build.extraResources = [{ from: 'server', to: 'server' }, { from: 'LICENSE', to: 'LICENSE.txt' }];
  pkg.build.nsis.license = 'LICENSE';
  pkg.build.win.target = [{ target: 'nsis', arch: [arch] }];
  delete pkg.devDependencies;
  delete pkg.scripts;
  fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(pkg, null, 2));

  const bin = path.join(here, 'node_modules', '.bin', process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder');
  const r = spawnSync(bin, ['--projectDir', stage, '--win', 'nsis', `--${arch}`], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) process.exitCode = r.status || 1;
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
