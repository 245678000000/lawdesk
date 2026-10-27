# 律台 · 本地法律智能体

[![测试与打包](https://github.com/245678000000/lawdesk/actions/workflows/ci.yml/badge.svg)](https://github.com/245678000000/lawdesk/actions/workflows/ci.yml)

一个跑在自己电脑上的法律 Agent 工作台：合同审查、案例研究、事实分析、案件时间线、文书起草……

- **不需要登录**：没有账号体系，只监听 `127.0.0.1`
- **模型用你自己的**：用 ChatGPT 账号登录、使用你的 ChatGPT 套餐；本机的 Claude Code、Codex；或者你自己的 API Key（DeepSeek、Kimi、通义、OpenAI、Anthropic、Ollama 等）
- **数据全在本地**：对话、上传的材料、生成的文件都在你自己的电脑上
- **零依赖**：Node.js 原生实现，没有 npm 包；另有 Mac 和 Windows 客户端

![律台界面](docs/screenshot.jpg)

## 下载客户端

到 [Releases](../../releases) 下载：

| 系统 | 文件 | 安装 |
|---|---|---|
| macOS（Apple 芯片） | `LawDesk-<版本>-arm64.dmg` | 打开后把「律台」拖进「应用程序」。App 没有经过 Apple 公证，第一次打开请在访达里右键 →「打开」 |
| Windows 10 / 11（x64） | `LawDesk-Setup-<版本>-x64.exe` | 双击安装。安装包没有代码签名，如果出现「Windows 已保护你的电脑」，点「更多信息 → 仍要运行」 |

最简单的用法：在「模型与连接」里点 **Continue with ChatGPT**，用你的 ChatGPT 账号登录（见下面的「用 ChatGPT 套餐」）。使用 Claude Code / Codex 之前，先在终端（Windows 上是 PowerShell）里确认 `claude`、`codex` 能正常对话。

## 从源码运行

需要 Node.js 18 以上，没有任何 npm 依赖。

```bash
git clone https://github.com/245678000000/lawdesk.git
cd lawdesk
npm start
```

或者在访达里双击 `启动律台.command`。浏览器会自动打开 http://127.0.0.1:3721 。

换端口：`PORT=4000 npm start`；换数据目录：`LAWDESK_HOME=~/律台数据 npm start`。

## Mac 客户端说明

`mac/build.sh` 打包出 `dist/律台.app` 和 `dist/LawDesk-<版本>-<架构>.dmg`。

- 客户端是原生窗口（Swift + WebKit），内置 Node，不需要另外装 Node.js；后台服务随 App 启动、随 App 退出。
- 数据保存在 `~/Library/Application Support/LawDesk`（菜单「文件 → 打开数据文件夹」），日志在 `~/Library/Logs/LawDesk/server.log`。
- 会自动读取你在终端里的 PATH 和环境变量（`~/.zshrc` 等），所以能找到 `claude`、`codex`。
- 重新打包：`mac/build.sh`（只打本机芯片）或 `ARCH=universal mac/build.sh`（同时支持 Apple 芯片和 Intel，体积约翻倍）。需要 Xcode 命令行工具。
- App 是自签名的，没有经过 Apple 公证。
- 安装包内置 Node.js 运行时，其许可证见 `mac/NODE_LICENSE`（也会复制到 App 内）。

## Windows 客户端说明

`windows/` 是 Electron 外壳：用 Electron 自带的 Node 在后台运行同一套 `server.js`，窗口加载本地页面。

```bash
cd windows
npm install
npm start        # 开发运行（macOS / Windows 都可以）
npm run dist     # 打包出 dist/LawDesk-Setup-<版本>-x64.exe（在 macOS 上也能打 Windows 包）
```

- 数据保存在 `%APPDATA%\LawDesk`（菜单「文件 → 打开数据文件夹」），日志在 `%APPDATA%\LawDesk\logs\server.log`。
- 会自动找到 npm 全局安装的 `claude.cmd`、`codex.cmd` 和原生安装的 `claude.exe`；`.cmd` 包装脚本会解析成 `node <脚本>` 直接运行，避免长提示词经过 cmd.exe 转义出错。
- 关闭窗口时，后台服务和正在运行的 claude / codex 进程会一并结束。
- 每次推送都会在 GitHub Actions 的 Windows、macOS、Linux 上跑冒烟测试，并在 Windows 上打包、静默安装、启动安装后的 App 做端到端测试（`test/`）。

## 模型来源

| 来源 | 能力 | 用到的命令 / 接口 |
|---|---|---|
| ChatGPT 套餐 | 本机有 Codex 时同 Codex（读写文件、多步任务）；否则纯对话，图片原样发送 | 「Sign in with ChatGPT」登录后经 Codex，或直接调用 Responses API |
| Claude Code（本机） | 读写本地文件、执行多步任务、联网检索、生成 HTML/Word 等交付物 | `claude -p --output-format stream-json` |
| Codex（本机） | 同上 | `codex exec --json`；没单独安装时自动用 ChatGPT 桌面版（macOS）自带的 Codex |
| 自有 API | 纯对话；附件（PDF/Word/TXT）先转成文字再发送 | OpenAI 兼容 `/chat/completions` 或 Anthropic `/v1/messages` |

找 Codex 时按「设置里填的路径 → 单独安装的命令行 → ChatGPT 桌面版自带的 Codex」的顺序，装了 ChatGPT 桌面版的 Mac 不需要另装。

- 两个 CLI 沿用你在终端里的登录状态和配置（`~/.claude`、`~/.codex`），先在终端里确认 `claude`、`codex` 能正常对话。
- 想让 CLI 走你自己的 API：在「模型与连接」里给 Claude Code 填环境变量，例如 `ANTHROPIC_BASE_URL=…`、`ANTHROPIC_AUTH_TOKEN=…`；Codex 同理。
- 自有 API 内置了 DeepSeek、Kimi、通义千问、智谱、OpenAI、Anthropic、OpenRouter、Ollama 预设，填 Key 和模型名即可，每个都可以点「测试连接」。

## 用 ChatGPT 套餐

律台按 OpenAI 官方的 [Sign in with ChatGPT（开源与本地应用使用 ChatGPT 套餐）](https://developers.openai.com/siwc/token-sharing-open-source) 流程接入：在「模型与连接」或首页点 **Continue with ChatGPT**，在浏览器里登录 ChatGPT 并同意授权，回到律台就能用。不需要 API Key，也不需要另装任何东西。

- **用量**：律台中符合条件的请求会使用你 ChatGPT 套餐包含的用量（或 credits 余额），可以在 [ChatGPT 设置 → 用量](https://chatgpt.com/settings/usage) 查看，并给律台单独设上限。律台本身免费，不另外收费。
- **怎么执行**：本机装了 Codex（命令行或 ChatGPT 桌面版自带的）时，律台把登录得到的令牌交给 Codex，按官方文档的提供方配置运行，能读取案卷、在工作区生成文件，权限和 Codex 一样分三档；没有 Codex 时直接调用 Responses API，是纯对话（附件转成文字，图片原样发送）。可以在设置里关掉「有 Codex 时通过 Codex 执行」。
- **隐私**：律台只拿到调用模型的授权，看不到你在 ChatGPT 里的对话。令牌保存在数据目录的 `chatgpt/` 下（仅本人可读写），不进浏览器存储、不写日志；访问令牌一小时有效，过期前自动刷新。
- **退出**：设置里点「退出登录」会向 OpenAI 撤销授权并清除本机令牌；也可以在 ChatGPT 设置里断开律台。支持多个账号或工作区，可以随时切换。
- **限制**：这项能力目前是 OpenAI 的预览版，可用的模型以登录后获取到的列表为准；部分账号、工作区或地区可能不支持。达到用量上限时律台会提示并给出「管理用量」入口，不会自动改用别的付费方式。

## 权限（输入框右下角）

| 选项 | Claude Code | Codex |
|---|---|---|
| 只读 | `--permission-mode dontAsk`，只放行读取、搜索、联网 | `-s read-only` |
| 工作区可写（默认） | `acceptEdits`，可写文件，不能执行命令 | `-s workspace-write` |
| 全部允许 | `--dangerously-skip-permissions` | `--dangerously-bypass-approvals-and-sandbox` |

「全部允许」不会再逐项确认，智能体可以执行任意命令，只在你信任的材料上使用。

## 功能

- **技能**：合同审查、案例研究、事实分析、案件大事记、案件时间线、案件思维导图、文书起草、法规检索、风险评估。每个技能是一段追加到系统提示里的工作方法，可在「技能」页改写或新建。
- **项目**：可以关联一个本机案卷文件夹（可点「选择…」弹出系统的文件夹选择框），项目里的对话会把它当作工作目录，智能体直接读取全部材料；还可以写项目说明（立场、管辖法院等）。
- **我的记忆**：执业身份、文书偏好等长期信息，每次任务都会带上。
- **工作区文件**：每个对话有自己的工作区，`附件/` 是上传的材料，`输出/` 是智能体生成的报告、文书、时间线 HTML，点右上角「工作区文件」查看或下载。
- 上传支持点选文件、整个文件夹、拖拽、粘贴；时间线和思维导图里的 mermaid 图会自动渲染（需要能访问 jsdelivr，离线时显示代码）。
- 切换模型来源后会把之前的对话记录带给新的模型；同一来源连续对话会续接 CLI 会话（`--resume` / `codex exec resume`）。
- **检查更新**：启动时自动查询 GitHub 上的最新版本（每天最多一次，可在「模型与连接 → 版本与更新」里关闭），有新版本时侧栏底部会提示，点开可看更新说明并下载对应系统的安装包；客户端菜单里也有「检查更新…」。只查询版本号，不上传任何对话、文件或配置。源码运行的话用 `git pull` 更新。

## 目录

```
server.js          本地 HTTP 服务、任务调度、SSE 流
lib/cli.js         Claude Code / Codex 的调用与事件解析
lib/api.js         OpenAI 兼容 / Anthropic 接口
lib/skills.js      内置技能、首页示例
lib/store.js       data/ 下的 JSON 存储
lib/extract.js     API 模式下的附件转文字（textutil、pdftotext）
lib/update.js      检查更新（查询 GitHub 最新发布版本）
lib/chatgpt.js     ChatGPT 套餐：Sign in with ChatGPT 登录、令牌刷新、Responses API、交给 Codex 的配置
public/            前端（原生 JS，无构建步骤）；public/brand/ 是 OpenAI 提供的 ChatGPT 标志
mac/               Mac 客户端：main.swift（窗口外壳）、make-icon.swift（图标）、build.sh（打包 dmg）
windows/           Windows 客户端：main.cjs / preload.cjs（Electron 外壳）、build.mjs（打包安装包）
test/              smoke.mjs（服务冒烟测试，npm test）、e2e-desktop.mjs（桌面客户端端到端测试）
dist/              打包产物：律台.app、*.dmg、*.exe
data/              运行后生成：config.json、conversations/、workspaces/、memory.md、update.json、chatgpt/
```

## 注意

- API Key 以明文保存在 `data/config.json`，ChatGPT 登录令牌在 `data/chatgpt/`，不要把 `data/` 分享给别人。
- 扫描版 PDF 在 API 模式下读不出文字，用 CLI 模式或先 OCR。
- 输出仅供专业人员参考，法条与案例请自行核实。

## 许可证

[MIT](LICENSE)。`public/brand/` 里的 ChatGPT 标志是 OpenAI 的商标，按 OpenAI 的 Sign in with ChatGPT 品牌规范使用，不在 MIT 许可范围内。
