// 律台 Mac 客户端：一个原生窗口（WKWebView），启动时在后台运行随包附带的 Node 和 server.js，
// 退出时一并结束。界面和网页版完全相同，数据保存在 ~/Library/Application Support/LawDesk。
import Cocoa
import WebKit

let appName = "律台"
let fm = FileManager.default
let supportDir = fm.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/LawDesk")
let logDir = fm.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs/LawDesk")
let logURL = logDir.appendingPathComponent("server.log")

// 浅色 / 深色下与网页背景一致的窗口底色，标题栏透明后看起来是一整块
let windowBackground = NSColor(name: nil) { appearance in
  appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
    ? NSColor(red: 0x1b / 255, green: 0x1b / 255, blue: 0x1a / 255, alpha: 1)
    : NSColor(red: 0xf4 / 255, green: 0xf4 / 255, blue: 0xf2 / 255, alpha: 1)
}

func statusPage(_ title: String, _ detail: String, spinner: Bool, retry: Bool = false) -> String {
  """
  <!doctype html><meta charset="utf-8"><style>
  :root{color-scheme:light dark}
  body{margin:0;height:100vh;display:grid;place-items:center;background:#f4f4f2;color:#1f1f1e;
    font:15px -apple-system,"PingFang SC",sans-serif}
  @media (prefers-color-scheme:dark){body{background:#1b1b1a;color:#ecece8}}
  .box{text-align:center;max-width:520px;padding:24px}
  .mark{width:56px;height:56px;border-radius:14px;background:#1f1f1e;color:#fff;display:grid;place-items:center;
    font:600 30px "Songti SC",serif;margin:0 auto 18px}
  h1{font:600 20px "Songti SC",serif;margin:0 0 8px}
  p{color:#8c8c86;margin:0 0 16px;white-space:pre-wrap;line-height:1.6;font-size:13.5px;text-align:left}
  .sp{width:18px;height:18px;border:2px solid #d6d6d2;border-top-color:#55554f;border-radius:50%;
    animation:s .8s linear infinite;margin:0 auto}
  @keyframes s{to{transform:rotate(360deg)}}
  button{font:inherit;padding:7px 18px;border-radius:9px;border:1px solid #d6d6d2;background:#fff;cursor:pointer}
  </style><div class="box"><div class="mark">律</div><h1>\(title)</h1>
  \(detail.isEmpty ? "" : "<p>\(detail)</p>")
  \(spinner ? "<div class=sp></div>" : "")
  \(retry ? "<button onclick=\"webkit.messageHandlers.lawdesk.postMessage({type:'restart'})\">重新启动</button>" : "")
  </div>
  """
}

func htmlEscape(_ s: String) -> String {
  s.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKUIDelegate, WKNavigationDelegate,
  WKScriptMessageHandlerWithReply, WKDownloadDelegate {
  var window: NSWindow!
  var webView: WKWebView!
  var server: Process?
  var serverPort: Int?
  var quitting = false
  var logHandle: FileHandle?
  var outputBuffer = ""

  // MARK: 启动

  func applicationDidFinishLaunching(_ notification: Notification) {
    try? fm.createDirectory(at: supportDir, withIntermediateDirectories: true)
    try? fm.createDirectory(at: logDir, withIntermediateDirectories: true)
    buildMenu()
    buildWindow()
    startServer()
  }

  func buildWindow() {
    let config = WKWebViewConfiguration()
    config.preferences.setValue(true, forKey: "developerExtrasEnabled")
    config.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "lawdesk")
    config.websiteDataStore = .default()

    webView = WKWebView(frame: .zero, configuration: config)
    webView.uiDelegate = self
    webView.navigationDelegate = self
    webView.allowsMagnification = true
    webView.setValue(false, forKey: "drawsBackground")
    if #available(macOS 13.3, *) { webView.isInspectable = true }

    window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1320, height: 860),
                      styleMask: [.titled, .closable, .miniaturizable, .resizable],
                      backing: .buffered, defer: false)
    window.title = appName
    window.titleVisibility = .hidden
    window.titlebarAppearsTransparent = true
    window.backgroundColor = windowBackground
    window.minSize = NSSize(width: 860, height: 560)
    window.isReleasedWhenClosed = false
    window.delegate = self
    window.contentView = webView
    window.center()
    window.setFrameAutosaveName("LawDeskMainWindow")
    window.makeKeyAndOrderFront(nil)
    webView.loadHTMLString(statusPage("正在启动", "", spinner: true), baseURL: nil)
  }

  func startServer() {
    guard let res = Bundle.main.resourceURL else { return }
    let node = res.appendingPathComponent("node")
    let appDir = res.appendingPathComponent("app")
    serverPort = nil
    outputBuffer = ""

    fm.createFile(atPath: logURL.path, contents: nil)
    logHandle = try? FileHandle(forWritingTo: logURL)

    let p = Process()
    p.executableURL = node
    p.arguments = [appDir.appendingPathComponent("server.js").path]
    p.currentDirectoryURL = appDir
    var env = ProcessInfo.processInfo.environment
    env["PORT"] = "0"
    env["NO_OPEN"] = "1"
    env["LAWDESK_APP"] = "1"
    env["LAWDESK_HOME"] = supportDir.path
    env["LAWDESK_PARENT_PID"] = String(getpid())
    p.environment = env

    let out = Pipe()
    let err = Pipe()
    p.standardOutput = out
    p.standardError = err
    let handleChunk: @Sendable (FileHandle) -> Void = { [weak self] h in
      let data = h.availableData
      guard !data.isEmpty else { return }
      Task { @MainActor in self?.received(data) }
    }
    out.fileHandleForReading.readabilityHandler = handleChunk
    err.fileHandleForReading.readabilityHandler = handleChunk
    p.terminationHandler = { [weak self] proc in
      let code = proc.terminationStatus
      Task { @MainActor in self?.serverExited(code) }
    }
    do {
      try p.run()
      server = p
    } catch {
      showError("无法启动本地服务：\(error.localizedDescription)")
    }
  }

  func received(_ data: Data) {
    logHandle?.write(data)
    guard serverPort == nil, let text = String(data: data, encoding: .utf8) else { return }
    outputBuffer += text
    if let range = outputBuffer.range(of: #"LAWDESK_READY (\d+)"#, options: .regularExpression) {
      let port = Int(outputBuffer[range].split(separator: " ").last ?? "") ?? 0
      serverPort = port
      outputBuffer = ""
      if let url = URL(string: "http://127.0.0.1:\(port)/") { webView.load(URLRequest(url: url)) }
    }
  }

  func serverExited(_ code: Int32) {
    server = nil
    if quitting { return }
    let tail = (try? String(contentsOf: logURL, encoding: .utf8))?.split(separator: "\n").suffix(12).joined(separator: "\n") ?? ""
    showError("本地服务意外退出（代码 \(code)）。\n\n\(htmlEscape(tail))\n\n完整日志：\(logURL.path)")
  }

  func showError(_ detail: String) {
    webView.loadHTMLString(statusPage("出了点问题", detail, spinner: false, retry: true), baseURL: nil)
  }

  func restartServer() {
    if let s = server, s.isRunning { s.terminate() }
    webView.loadHTMLString(statusPage("正在启动", "", spinner: true), baseURL: nil)
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.startServer() }
  }

  // MARK: 退出

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

  func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
    if !flag { window.makeKeyAndOrderFront(nil) }
    return true
  }

  func applicationWillTerminate(_ notification: Notification) {
    quitting = true
    guard let s = server, s.isRunning else { return }
    s.terminate()
    let deadline = Date().addingTimeInterval(2)
    while s.isRunning && Date() < deadline { usleep(50_000) }
    if s.isRunning { kill(s.processIdentifier, SIGKILL) }
  }

  // MARK: 菜单

  func buildMenu() {
    let main = NSMenu()

    let appItem = NSMenuItem()
    let appMenu = NSMenu()
    appMenu.addItem(withTitle: "关于\(appName)", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
    appMenu.addItem(withTitle: "检查更新…", action: #selector(checkUpdate), keyEquivalent: "")
    appMenu.addItem(.separator())
    appMenu.addItem(withTitle: "模型与连接…", action: #selector(openSettings), keyEquivalent: ",")
    appMenu.addItem(.separator())
    appMenu.addItem(withTitle: "隐藏\(appName)", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
    let hideOthers = appMenu.addItem(withTitle: "隐藏其他", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
    hideOthers.keyEquivalentModifierMask = [.command, .option]
    appMenu.addItem(withTitle: "全部显示", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
    appMenu.addItem(.separator())
    appMenu.addItem(withTitle: "退出\(appName)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    appItem.submenu = appMenu
    main.addItem(appItem)

    let fileItem = NSMenuItem()
    let fileMenu = NSMenu(title: "文件")
    fileMenu.addItem(withTitle: "新建对话", action: #selector(newChat), keyEquivalent: "n")
    fileMenu.addItem(.separator())
    fileMenu.addItem(withTitle: "打开数据文件夹", action: #selector(openDataFolder), keyEquivalent: "")
    fileMenu.addItem(withTitle: "查看运行日志", action: #selector(openLog), keyEquivalent: "")
    fileMenu.addItem(.separator())
    fileMenu.addItem(withTitle: "关闭窗口", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
    fileItem.submenu = fileMenu
    main.addItem(fileItem)

    let editItem = NSMenuItem()
    let editMenu = NSMenu(title: "编辑")
    editMenu.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
    let redo = editMenu.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "z")
    redo.keyEquivalentModifierMask = [.command, .shift]
    editMenu.addItem(.separator())
    editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
    editMenu.addItem(withTitle: "拷贝", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
    editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
    editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
    editItem.submenu = editMenu
    main.addItem(editItem)

    let viewItem = NSMenuItem()
    let viewMenu = NSMenu(title: "显示")
    viewMenu.addItem(withTitle: "重新载入", action: #selector(reloadPage), keyEquivalent: "r")
    viewMenu.addItem(.separator())
    viewMenu.addItem(withTitle: "放大", action: #selector(zoomIn), keyEquivalent: "=")
    viewMenu.addItem(withTitle: "缩小", action: #selector(zoomOut), keyEquivalent: "-")
    viewMenu.addItem(withTitle: "实际大小", action: #selector(zoomReset), keyEquivalent: "0")
    viewMenu.addItem(.separator())
    let full = viewMenu.addItem(withTitle: "进入全屏幕", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
    full.keyEquivalentModifierMask = [.command, .control]
    viewItem.submenu = viewMenu
    main.addItem(viewItem)

    let winItem = NSMenuItem()
    let winMenu = NSMenu(title: "窗口")
    winMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
    winMenu.addItem(withTitle: "缩放", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
    winMenu.addItem(.separator())
    winMenu.addItem(withTitle: "\(appName)主窗口", action: #selector(showMainWindow), keyEquivalent: "0")
    winItem.submenu = winMenu
    main.addItem(winItem)
    NSApp.windowsMenu = winMenu

    NSApp.mainMenu = main
  }

  @objc func showMainWindow() { window.makeKeyAndOrderFront(nil) }
  @objc func newChat() { showMainWindow(); webView.evaluateJavaScript("location.hash = '#/'") }
  @objc func openSettings() { showMainWindow(); webView.evaluateJavaScript("location.hash = '#/settings'") }
  @objc func checkUpdate() { showMainWindow(); webView.evaluateJavaScript("window.lawdeskCheckUpdate && window.lawdeskCheckUpdate()") }
  @objc func openDataFolder() { NSWorkspace.shared.open(supportDir) }
  @objc func openLog() { NSWorkspace.shared.open(logURL) }
  @objc func reloadPage() {
    if serverPort == nil { restartServer() } else { webView.reload() }
  }
  @objc func zoomIn() { webView.pageZoom = min(webView.pageZoom + 0.1, 2) }
  @objc func zoomOut() { webView.pageZoom = max(webView.pageZoom - 0.1, 0.6) }
  @objc func zoomReset() { webView.pageZoom = 1 }

  // MARK: 网页里的原生能力

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                             replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void) {
    let body = message.body as? [String: Any] ?? [:]
    switch body["type"] as? String {
    case "pickFolder":
      let panel = NSOpenPanel()
      panel.canChooseDirectories = true
      panel.canChooseFiles = false
      panel.allowsMultipleSelection = false
      panel.prompt = "选择"
      panel.message = "选择案卷文件夹"
      panel.beginSheetModal(for: window) { resp in
        replyHandler(resp == .OK ? panel.url?.path : nil, nil)
      }
    case "restart":
      restartServer()
      replyHandler(nil, nil)
    default:
      replyHandler(nil, "unknown message")
    }
  }

  // MARK: 链接与下载

  func isAppPage(_ url: URL) -> Bool {
    guard let port = serverPort else { return false }
    return url.host == "127.0.0.1" && url.port == port && (url.path == "/" || url.path == "/index.html" || url.path.isEmpty)
  }

  func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
               decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
    guard let url = navigationAction.request.url else { return decisionHandler(.cancel) }
    if url.scheme == "about" || url.scheme == "data" || isAppPage(url) { return decisionHandler(.allow) }
    if url.host == "127.0.0.1", url.query?.contains("download") == true { return decisionHandler(.download) }
    // 其他链接（工作区里的文件、外部网页）交给默认浏览器打开
    NSWorkspace.shared.open(url)
    decisionHandler(.cancel)
  }

  func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
               decisionHandler: @escaping @MainActor @Sendable (WKNavigationResponsePolicy) -> Void) {
    decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
  }

  func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
    download.delegate = self
  }

  func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
    download.delegate = self
  }

  func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String,
                completionHandler: @escaping @MainActor @Sendable (URL?) -> Void) {
    let downloads = fm.urls(for: .downloadsDirectory, in: .userDomainMask).first ?? fm.homeDirectoryForCurrentUser
    let base = (suggestedFilename as NSString).deletingPathExtension
    let ext = (suggestedFilename as NSString).pathExtension
    var target = downloads.appendingPathComponent(suggestedFilename)
    var i = 2
    while fm.fileExists(atPath: target.path) {
      target = downloads.appendingPathComponent(ext.isEmpty ? "\(base) (\(i))" : "\(base) (\(i)).\(ext)")
      i += 1
    }
    completionHandler(target)
    DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
      if fm.fileExists(atPath: target.path) { NSWorkspace.shared.activateFileViewerSelecting([target]) }
    }
  }

  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

  // MARK: 网页对话框

  func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
               for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
    if let url = navigationAction.request.url { NSWorkspace.shared.open(url) }
    return nil
  }

  func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
               initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable () -> Void) {
    let alert = NSAlert()
    alert.messageText = message
    alert.addButton(withTitle: "好")
    alert.beginSheetModal(for: window) { _ in completionHandler() }
  }

  func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
               initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable (Bool) -> Void) {
    let alert = NSAlert()
    alert.messageText = message
    alert.addButton(withTitle: "确定")
    alert.addButton(withTitle: "取消")
    alert.beginSheetModal(for: window) { resp in completionHandler(resp == .alertFirstButtonReturn) }
  }

  func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
               initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable (String?) -> Void) {
    let alert = NSAlert()
    alert.messageText = prompt
    let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 300, height: 24))
    field.stringValue = defaultText ?? ""
    alert.accessoryView = field
    alert.addButton(withTitle: "确定")
    alert.addButton(withTitle: "取消")
    alert.window.initialFirstResponder = field
    alert.beginSheetModal(for: window) { resp in completionHandler(resp == .alertFirstButtonReturn ? field.stringValue : nil) }
  }

  func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
               initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable ([URL]?) -> Void) {
    let panel = NSOpenPanel()
    panel.canChooseDirectories = parameters.allowsDirectories
    panel.canChooseFiles = !parameters.allowsDirectories
    panel.allowsMultipleSelection = parameters.allowsMultipleSelection
    panel.prompt = "上传"
    panel.beginSheetModal(for: window) { resp in completionHandler(resp == .OK ? panel.urls : nil) }
  }
}

MainActor.assumeIsolated {
  let app = NSApplication.shared
  let delegate = AppDelegate()
  app.delegate = delegate
  app.setActivationPolicy(.regular)
  app.activate(ignoringOtherApps: true)
  app.run()
}
