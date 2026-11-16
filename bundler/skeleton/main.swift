import AppKit
import WebKit
import Darwin

enum Paths {
	static var resources: URL {
		return Bundle.main.resourceURL!
	}

	static var logs: URL {
		return FileManager.default.homeDirectoryForCurrentUser
			.appendingPathComponent("Library/Logs/ThinkTank")
	}

	static var logFile: URL {
		return logs.appendingPathComponent("\(AppConfig.name).log")
	}

	static var launchAgent: URL {
		return FileManager.default.homeDirectoryForCurrentUser
			.appendingPathComponent("Library/LaunchAgents/\(AppConfig.label).plist")
	}

	static var cliDirectory: URL {
		return FileManager.default.homeDirectoryForCurrentUser
			.appendingPathComponent(".local/bin")
	}

	static var cliWrapper: URL {
		return cliDirectory.appendingPathComponent(AppConfig.cliName)
	}

	static var cliSupport: URL {
		return FileManager.default.homeDirectoryForCurrentUser
			.appendingPathComponent("Library/Application Support/ThinkTank/\(AppConfig.name)")
	}
}

enum NodeRuntime {
	static let searchPath = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

	private static let searchPaths = [
		"/opt/homebrew/bin/node",
		"/usr/local/bin/node",
		"/usr/bin/node"
	]

	static func find() -> String? {
		for path in searchPaths {
			if FileManager.default.isExecutableFile(atPath: path) {
				return path
			}
		}
		return nil
	}

	static func environment() -> [String: String] {
		var environment = ProcessInfo.processInfo.environment
		environment["PATH"] = searchPath
		return environment
	}
}

enum AppError: LocalizedError {
	case message(String)

	var errorDescription: String? {
		switch self {
			case .message(let text):
				return text
		}
	}
}

func isReadOnlyVolume() -> Bool {
	let values = try? Bundle.main.bundleURL.resourceValues(forKeys: [ .volumeIsReadOnlyKey ])
	return values?.volumeIsReadOnly ?? false
}

func prepareLogs() throws {
	let manager = FileManager.default
	try manager.createDirectory(at: Paths.logs, withIntermediateDirectories: true)
	if !manager.fileExists(atPath: Paths.logFile.path) {
		_ = manager.createFile(atPath: Paths.logFile.path, contents: nil)
	}
}

func showAlert(_ title: String, _ message: String) {
	let alert = NSAlert()
	alert.messageText = title
	alert.informativeText = message
	alert.addButton(withTitle: "OK")
	alert.runModal()
}

final class ServerController {
	let interfaceURL: URL
	private var process: Process?
	private var ownsServer = false

	init() {
		interfaceURL = URL(string: "http://127.0.0.1:\(AppConfig.port)\(AppConfig.uiPath)")!
	}

	func startIfNeeded(_ completion: @escaping (Bool) -> Void) {
		isResponding { ready in
			if ready {
				self.ownsServer = false
				completion(true)
				return
			}
			if BackgroundService.isLoaded() {
				self.waitUntilReady(completion)
				return
			}
			self.start(completion)
		}
	}

	func waitUntilReady(_ completion: @escaping (Bool) -> Void, deadline: Date = Date().addingTimeInterval(20)) {
		isResponding { ready in
			if ready {
				completion(true)
				return
			}
			if Date() > deadline {
				completion(false)
				return
			}
			DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
				self.waitUntilReady(completion, deadline: deadline)
			}
		}
	}

	func stopOwnedServer() {
		guard ownsServer else {
			return
		}
		guard let process = process else {
			return
		}
		if process.isRunning {
			process.terminate()
			process.waitUntilExit()
		}
		self.process = nil
		ownsServer = false
	}

	private func isResponding(_ completion: @escaping (Bool) -> Void) {
		var request = URLRequest(url: interfaceURL)
		request.timeoutInterval = 1
		request.cachePolicy = .reloadIgnoringLocalCacheData
		let task = URLSession.shared.dataTask(with: request) { _, response, _ in
			let ready = response != nil
			DispatchQueue.main.async {
				completion(ready)
			}
		}
		task.resume()
	}

	private func start(_ completion: @escaping (Bool) -> Void) {
		guard let node = NodeRuntime.find() else {
			showAlert("Node.js Not Found", "\(AppConfig.name) needs Node.js installed. Install it from nodejs.org or Homebrew, then reopen the app.")
			completion(false)
			return
		}
		do {
			try prepareLogs()
		} catch {
			showAlert("Cannot Write Logs", error.localizedDescription)
		}
		let process = Process()
		process.executableURL = URL(fileURLWithPath: node)
		process.arguments = [Paths.resources.appendingPathComponent(AppConfig.serverScript).path, "--port", "\(AppConfig.port)"]
		process.currentDirectoryURL = Paths.resources
		process.environment = NodeRuntime.environment()
		if let handle = try? FileHandle(forWritingTo: Paths.logFile) {
			handle.seekToEndOfFile()
			process.standardOutput = handle
			process.standardError = handle
		}
		do {
			try process.run()
		} catch {
			showAlert("Could Not Start \(AppConfig.name)", error.localizedDescription)
			completion(false)
			return
		}
		self.process = process
		ownsServer = true
		waitUntilReady(completion)
	}
}

enum BackgroundService {
	static func isLoaded() -> Bool {
		return runLaunchctl(["print", "gui/\(getuid())/\(AppConfig.label)"]) == 0
	}

	static func install() throws {
		if isReadOnlyVolume() {
			throw AppError.message("Move \(AppConfig.name) to Applications before installing the background service.")
		}
		guard let node = NodeRuntime.find() else {
			throw AppError.message("Node.js was not found. Install Node.js first.")
		}
		try prepareLogs()
		let serverPath = Paths.resources.appendingPathComponent(AppConfig.serverScript).path
		let plist: [String: Any] = [
			"Label": AppConfig.label,
			"ProgramArguments": [node, serverPath, "--port", "\(AppConfig.port)"],
			"WorkingDirectory": Paths.resources.path,
			"EnvironmentVariables": [ "PATH": NodeRuntime.searchPath ],
			"RunAtLoad": true,
			"KeepAlive": true,
			"StandardOutPath": Paths.logFile.path,
			"StandardErrorPath": Paths.logFile.path
		]
		let data = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
		let manager = FileManager.default
		try manager.createDirectory(at: Paths.launchAgent.deletingLastPathComponent(), withIntermediateDirectories: true)
		try data.write(to: Paths.launchAgent)
		_ = runLaunchctl(["bootout", "gui/\(getuid())", Paths.launchAgent.path])
		let status = runLaunchctl(["bootstrap", "gui/\(getuid())", Paths.launchAgent.path])
		if status != 0 {
			throw AppError.message("launchctl could not load \(AppConfig.label).")
		}
	}

	static func uninstall() throws {
		_ = runLaunchctl(["bootout", "gui/\(getuid())", Paths.launchAgent.path])
		if FileManager.default.fileExists(atPath: Paths.launchAgent.path) {
			try FileManager.default.removeItem(at: Paths.launchAgent)
		}
	}

	private static func runLaunchctl(_ arguments: [String]) -> Int32 {
		let process = Process()
		process.executableURL = URL(fileURLWithPath: "/bin/launchctl")
		process.arguments = arguments
		process.standardOutput = FileHandle.nullDevice
		process.standardError = FileHandle.nullDevice
		do {
			try process.run()
			process.waitUntilExit()
			return process.terminationStatus
		} catch {
			return -1
		}
	}
}

enum CommandLineTool {
	static func install() throws {
		if AppConfig.cliName.isEmpty || AppConfig.cliScript.isEmpty {
			throw AppError.message("\(AppConfig.name) has no command line tool.")
		}
		let manager = FileManager.default
		let source = Paths.resources.appendingPathComponent(AppConfig.cliScript)
		let target = Paths.cliSupport.appendingPathComponent(URL(fileURLWithPath: AppConfig.cliScript).lastPathComponent)
		try manager.createDirectory(at: Paths.cliSupport, withIntermediateDirectories: true)
		if manager.fileExists(atPath: target.path) {
			try manager.removeItem(at: target)
		}
		try manager.copyItem(at: source, to: target)
		try manager.createDirectory(at: Paths.cliDirectory, withIntermediateDirectories: true)
		let wrapper = """
		#!/bin/sh
		PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
		exec node "\(target.path)" "$@"
		"""
		if manager.fileExists(atPath: Paths.cliWrapper.path) {
			try manager.removeItem(at: Paths.cliWrapper)
		}
		try wrapper.write(to: Paths.cliWrapper, atomically: true, encoding: .utf8)
		try manager.setAttributes([.posixPermissions: 0o755], ofItemAtPath: Paths.cliWrapper.path)
	}

	static func uninstall() throws {
		let manager = FileManager.default
		if manager.fileExists(atPath: Paths.cliWrapper.path) {
			try manager.removeItem(at: Paths.cliWrapper)
		}
		if manager.fileExists(atPath: Paths.cliSupport.path) {
			try manager.removeItem(at: Paths.cliSupport)
		}
	}
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
	private var window: NSWindow?
	private var webView: WKWebView?
	private let server = ServerController()

	func applicationDidFinishLaunching(_ notification: Notification) {
		try? prepareLogs()
		buildMenu()
		openWindow()
		offerSetup()
		server.startIfNeeded { ready in
			if ready {
				self.loadInterface()
			} else {
				showAlert("Could Not Start \(AppConfig.name)", "The server did not become ready. See ~/Library/Logs/ThinkTank/\(AppConfig.name).log.")
			}
		}
	}

	func applicationWillTerminate(_ notification: Notification) {
		server.stopOwnedServer()
	}

	func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
		return true
	}

	func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
		let host = navigationAction.request.url?.host
		if host != "127.0.0.1" && host != "localhost" {
			if let url = navigationAction.request.url {
				NSWorkspace.shared.open(url)
			}
			decisionHandler(.cancel)
			return
		}
		decisionHandler(.allow)
	}

	func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
		let alert = NSAlert()
		alert.messageText = message
		alert.addButton(withTitle: "OK")
		alert.runModal()
		completionHandler()
	}

	func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
		let alert = NSAlert()
		alert.messageText = message
		alert.addButton(withTitle: "OK")
		alert.addButton(withTitle: "Cancel")
		completionHandler(alert.runModal() == .alertFirstButtonReturn)
	}

	func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
		let alert = NSAlert()
		alert.messageText = prompt
		alert.addButton(withTitle: "OK")
		alert.addButton(withTitle: "Cancel")
		let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 300, height: 24))
		input.stringValue = defaultText ?? ""
		alert.accessoryView = input
		completionHandler(alert.runModal() == .alertFirstButtonReturn ? input.stringValue : nil)
	}

	private func openWindow() {
		let webView = WKWebView(frame: .zero)
		webView.navigationDelegate = self
		webView.uiDelegate = self
		let window = NSWindow(
			contentRect: NSRect(x: 0, y: 0, width: 1200, height: 800),
			styleMask: [.titled, .closable, .miniaturizable, .resizable],
			backing: .buffered,
			defer: false
		)
		window.title = AppConfig.name
		window.contentView = webView
		window.center()
		window.makeKeyAndOrderFront(nil)
		webView.loadHTMLString(loadingHTML(), baseURL: nil)
		self.window = window
		self.webView = webView
	}

	private func loadInterface() {
		webView?.load(URLRequest(url: server.interfaceURL))
	}

	private func loadingHTML() -> String {
		return """
		<!doctype html>
		<html>
		<head>
		<meta charset="utf-8">
		<style>
		body {
			font-family: -apple-system, sans-serif;
			display: flex;
			align-items: center;
			justify-content: center;
			height: 100vh;
			margin: 0;
			color: #888;
			background: #fff;
		}
		@media (prefers-color-scheme: dark) {
			body {
				color: #888;
				background: #1e1e1e;
			}
		}
		</style>
		</head>
		<body>
		<p>Starting \(AppConfig.name)…</p>
		</body>
		</html>
		"""
	}

	private func offerSetup() {
		if !isReadOnlyVolume() {
			offerService()
		}
		offerCLI()
	}

	private func offerService() {
		if BackgroundService.isLoaded() {
			return
		}
		let defaults = UserDefaults.standard
		if defaults.bool(forKey: "offeredService") {
			return
		}
		defaults.set(true, forKey: "offeredService")
		let alert = NSAlert()
		alert.messageText = "Run \(AppConfig.name) in the background?"
		alert.informativeText = "\(AppConfig.name) can start its server automatically at login. You can change this later from the \(AppConfig.name) menu."
		alert.addButton(withTitle: "Install Service")
		alert.addButton(withTitle: "Not Now")
		if alert.runModal() == .alertFirstButtonReturn {
			do {
				try BackgroundService.install()
			} catch {
				showAlert("Service Not Installed", error.localizedDescription)
			}
		}
	}

	private func offerCLI() {
		if AppConfig.cliName.isEmpty {
			return
		}
		if FileManager.default.fileExists(atPath: Paths.cliWrapper.path) {
			return
		}
		let defaults = UserDefaults.standard
		if defaults.bool(forKey: "offeredCLI") {
			return
		}
		defaults.set(true, forKey: "offeredCLI")
		let alert = NSAlert()
		alert.messageText = "Install the \(AppConfig.cliName) command?"
		alert.informativeText = "This installs a wrapper in ~/.local/bin. Add ~/.local/bin to PATH if it is not already."
		alert.addButton(withTitle: "Install Command")
		alert.addButton(withTitle: "Not Now")
		if alert.runModal() == .alertFirstButtonReturn {
			do {
				try CommandLineTool.install()
				showAlert("Command Installed", "\(AppConfig.cliName) is available in ~/.local/bin.")
			} catch {
				showAlert("Command Not Installed", error.localizedDescription)
			}
		}
	}

	private func buildMenu() {
		let mainMenu = NSMenu()
		let appItem = NSMenuItem()
		mainMenu.addItem(appItem)
		let appMenu = NSMenu()
		addMenuItem(appMenu, "About \(AppConfig.name)", #selector(showAbout))
		appMenu.addItem(NSMenuItem.separator())
		addMenuItem(appMenu, "Install Background Service", #selector(installService))
		addMenuItem(appMenu, "Remove Background Service", #selector(removeService))
		if !AppConfig.cliName.isEmpty {
			addMenuItem(appMenu, "Install Command Line Tool", #selector(installCLI))
		}
		appMenu.addItem(NSMenuItem.separator())
		appMenu.addItem(withTitle: "Quit \(AppConfig.name)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
		appItem.submenu = appMenu

		let editItem = NSMenuItem()
		mainMenu.addItem(editItem)
		let editMenu = NSMenu(title: "Edit")
		editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
		let redoItem = editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "z")
		redoItem.keyEquivalentModifierMask = [.command, .shift]
		editMenu.addItem(NSMenuItem.separator())
		editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
		editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
		editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
		editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
		editItem.submenu = editMenu

		NSApplication.shared.mainMenu = mainMenu
	}

	private func addMenuItem(_ menu: NSMenu, _ title: String, _ action: Selector) {
		let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
		item.target = self
		menu.addItem(item)
	}

	@objc private func showAbout() {
		showAlert(AppConfig.name, "\(AppConfig.name) \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")")
	}

	@objc private func installService() {
		do {
			try BackgroundService.install()
			server.stopOwnedServer()
			server.waitUntilReady { ready in
				if ready {
					self.loadInterface()
				}
			}
			showAlert("Service Installed", "\(AppConfig.name) will start its server at login.")
		} catch {
			showAlert("Service Not Installed", error.localizedDescription)
		}
	}

	@objc private func removeService() {
		do {
			try BackgroundService.uninstall()
			showAlert("Service Removed", "\(AppConfig.name) will no longer start its server at login.")
		} catch {
			showAlert("Service Not Removed", error.localizedDescription)
		}
	}

	@objc private func installCLI() {
		do {
			try CommandLineTool.install()
			showAlert("Command Installed", "\(AppConfig.cliName) is available in ~/.local/bin.")
		} catch {
			showAlert("Command Not Installed", error.localizedDescription)
		}
	}
}

let arguments = CommandLine.arguments
if arguments.contains("--install-service") {
	do {
		try BackgroundService.install()
		print("Background service installed.")
		exit(0)
	} catch {
		FileHandle.standardError.write("\(error.localizedDescription)\n".data(using: .utf8)!)
		exit(1)
	}
}
if arguments.contains("--remove-service") {
	do {
		try BackgroundService.uninstall()
		print("Background service removed.")
		exit(0)
	} catch {
		FileHandle.standardError.write("\(error.localizedDescription)\n".data(using: .utf8)!)
		exit(1)
	}
}
if arguments.contains("--service-status") {
	let loaded = BackgroundService.isLoaded()
	print(loaded ? "loaded" : "not loaded")
	exit(loaded ? 0 : 1)
}
if arguments.contains("--install-cli") {
	do {
		try CommandLineTool.install()
		print("Command installed at \(Paths.cliWrapper.path).")
		exit(0)
	} catch {
		FileHandle.standardError.write("\(error.localizedDescription)\n".data(using: .utf8)!)
		exit(1)
	}
}
if arguments.contains("--remove-cli") {
	do {
		try CommandLineTool.uninstall()
		print("Command removed.")
		exit(0)
	} catch {
		FileHandle.standardError.write("\(error.localizedDescription)\n".data(using: .utf8)!)
		exit(1)
	}
}

let application = NSApplication.shared
let delegate = AppDelegate()
application.delegate = delegate
application.setActivationPolicy(.regular)
application.run()
