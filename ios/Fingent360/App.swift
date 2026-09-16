import UIKit
import WebKit
import UniformTypeIdentifiers
import Network

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = ShellController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
    func application(_ app:UIApplication,open url:URL,options:[UIApplication.OpenURLOptionsKey:Any]=[:])->Bool { (window?.rootViewController as? ShellController)?.brokerReturn(url) ?? false }
}

struct ShellConfig: Decodable {
    let mode: String
    let webUrl: String
    static func load() throws -> ShellConfig {
        guard let path = Bundle.main.url(forResource: "runtime-config", withExtension: "json") else { throw ShellError.invalidConfig }
        let value = try JSONDecoder().decode(ShellConfig.self, from: Data(contentsOf: path))
        guard value.mode == "offline" || value.mode == "connected" else { throw ShellError.invalidConfig }
        if value.mode == "offline" { guard value.webUrl.isEmpty else { throw ShellError.invalidConfig } }
        else { guard let url = URL(string: value.webUrl), url.scheme == "https", url.host != nil, url.user == nil, url.password == nil, url.query == nil, url.fragment == nil, url.path.isEmpty || url.path == "/" else { throw ShellError.invalidConfig } }
        return value
    }
}
enum ShellError: Error { case invalidConfig, invalidAsset }

/// A loopback-only public asset server preserves a trustworthy, stable web origin.
/// No account data, native commands, callbacks or arbitrary file endpoints exist.
final class BundledAssets {
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "com.fingent360.assets")
    func start(ready: @escaping () -> Void, failed: @escaping () -> Void) throws {
        let params = NWParameters.tcp
        params.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: 18763)
        let listener = try NWListener(using: params)
        self.listener = listener
        listener.stateUpdateHandler = { state in
            if case .ready = state { DispatchQueue.main.async(execute: ready) }
            if case .failed = state { DispatchQueue.main.async(execute: failed) }
        }
        listener.newConnectionHandler = { [weak self] connection in
            guard let self = self else { connection.cancel(); return }
            connection.start(queue: self.queue)
            self.receive(connection, buffer: Data())
        }
        listener.start(queue: queue)
    }
    private func receive(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, done, error in
            guard let self = self, error == nil else { connection.cancel(); return }
            var received = buffer
            if let data = data { received.append(data) }
            guard received.count <= 8192 else { connection.cancel(); return }
            guard let text = String(data: received, encoding: .utf8) else { connection.cancel(); return }
            if !text.contains("\r\n\r\n") { if !done { self.receive(connection, buffer: received) } else { connection.cancel() }; return }
            let first = text.components(separatedBy: "\r\n")[0].split(separator: " ")
            guard first.count == 3, first[0] == "GET", first[2] == "HTTP/1.1",
                  text.components(separatedBy: "\r\n").contains(where: { $0.lowercased() == "host: 127.0.0.1:18763" }),
                  let path = String(first[1]).removingPercentEncoding, path.hasPrefix("/"), !path.contains("?"), !path.contains("\\"), !path.split(separator: "/").contains(".."),
                  let root = Bundle.main.resourceURL?.appendingPathComponent("web", isDirectory: true) else { connection.cancel(); return }
            let relative = path == "/" ? "index.html" : String(path.dropFirst())
            let asset = root.appendingPathComponent(relative).standardizedFileURL.resolvingSymlinksInPath()
            guard asset.path.hasPrefix(root.standardizedFileURL.resolvingSymlinksInPath().path + "/"), let body = try? Data(contentsOf: asset) else { connection.cancel(); return }
            let mime = ["js":"text/javascript", "mjs":"text/javascript", "css":"text/css", "html":"text/html", "json":"application/json", "svg":"image/svg+xml"][asset.pathExtension] ?? UTType(filenameExtension: asset.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
            let header = "HTTP/1.1 200 OK\r\nContent-Type: \(mime)\r\nContent-Length: \(body.count)\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n"
            var response = Data(header.utf8); response.append(body)
            connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
        }
    }
    deinit { listener?.cancel() }
}

final class ShellController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let assets = BundledAssets()
    private var webView: WKWebView?
    private var configuration: ShellConfig?
    private let status = UILabel()
    private var feedback:IOSFeedbackBridge?
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        do {
            let config = try ShellConfig.load()
            configuration = config
            let options = WKWebViewConfiguration()
            options.websiteDataStore = .default()
            options.preferences.javaScriptCanOpenWindowsAutomatically = false
            let appOrigin=config.mode=="offline" ? "http://127.0.0.1:18763" : config.webUrl.trimmingCharacters(in:CharacterSet(charactersIn:"/"))
            let bridge=IOSFeedbackBridge(origin:appOrigin,allowed:{[weak self] url in self?.permitted(url) ?? false})
            options.userContentController.addScriptMessageHandler(bridge,contentWorld:.page,name:"fingentFeedback")
            guard let bridgeURL=Bundle.main.url(forResource:"feedback-bridge",withExtension:"js") else {throw ShellError.invalidAsset}
            options.userContentController.addUserScript(WKUserScript(source:try String(contentsOf:bridgeURL),injectionTime:.atDocumentStart,forMainFrameOnly:true))
            let web = WKWebView(frame: .zero, configuration: options)
            bridge.web=web;bridge.presenter=self;feedback=bridge
            NotificationCenter.default.addObserver(self,selector:#selector(background),name:UIApplication.didEnterBackgroundNotification,object:nil)
            NotificationCenter.default.addObserver(self,selector:#selector(foreground),name:UIApplication.didBecomeActiveNotification,object:nil)
            web.navigationDelegate = self
            web.uiDelegate = self
            web.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(web)
            NSLayoutConstraint.activate([web.leadingAnchor.constraint(equalTo: view.leadingAnchor), web.trailingAnchor.constraint(equalTo: view.trailingAnchor), web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor), web.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)])
            webView = web
            navigationItem.rightBarButtonItem = UIBarButtonItem(title: "Reload", style: .plain, target: self, action: #selector(retry))
            if config.mode == "offline" { try assets.start(ready: { [weak self] in self?.loadStart() }, failed: { [weak self] in self?.showError("Local asset port is unavailable. Close other Fingent360 instances and reopen; saved data was not moved or deleted.") }) } else { loadStart() }
        } catch { showError("App configuration is invalid. Repackage with a valid offline or HTTPS connected configuration.") }
    }
    func brokerReturn(_ url:URL)->Bool {feedback?.brokerReturn(url) ?? false}
    @objc private func background(){feedback?.pause()}
    @objc private func foreground(){feedback?.resume()}
    func webView(_ webView:WKWebView,didStartProvisionalNavigation navigation:WKNavigation!){feedback?.invalidate()}
    deinit {NotificationCenter.default.removeObserver(self);feedback?.invalidate()}
    private func loadStart() {
        guard let config = configuration, let url = URL(string: config.mode == "offline" ? "http://127.0.0.1:18763/index.html" : config.webUrl) else { return }
        webView?.load(URLRequest(url: url))
    }
    @objc private func retry() { status.removeFromSuperview(); loadStart() }
    private func showError(_ text: String) {
        status.text = text
        status.numberOfLines = 0
        status.textAlignment = .center
        status.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(status)
        NSLayoutConstraint.activate([status.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24), status.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24), status.centerYAnchor.constraint(equalTo: view.centerYAnchor)])
        let alert = UIAlertController(title: "Fingent360 could not load", message: text, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Retry", style: .default) { [weak self] _ in self?.retry() })
        present(alert, animated: true)
    }
    private func permitted(_ url: URL) -> Bool {
        guard let config = configuration, url.user == nil, url.password == nil else { return false }
        if config.mode == "offline" { return url.scheme == "http" && url.host == "127.0.0.1" && url.port == 18763 && (url.path == "/index.html" || url.path == "/") && url.query == nil }
        guard let expected = URL(string: config.webUrl) else { return false }
        return url.scheme == "https" && url.host == expected.host && (url.port ?? 443) == (expected.port ?? 443)
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.targetFrame?.isMainFrame == true && permitted(url) { decisionHandler(.allow); return }
        decisionHandler(.cancel)
        if navigationAction.navigationType == .linkActivated && url.scheme == "https" && url.host != nil && url.user == nil && url.password == nil {
            let alert = UIAlertController(title: "Open source in browser?", message: url.host, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
            alert.addAction(UIAlertAction(title: "Open", style: .default) { _ in UIApplication.shared.open(url) })
            present(alert, animated: true)
        }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { showError("The page is unavailable. Check your connection or packaged assets, then retry. Local data has not been deleted.") }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { showError("The page could not finish loading. Retry without clearing your saved data.") }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { showError("The app view was interrupted. Reload to restore saved data.") }
}
