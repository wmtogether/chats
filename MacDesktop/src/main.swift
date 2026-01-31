import Cocoa
import WebKit
import Foundation
import UserNotifications

// MARK: - Constants
let DEV_SERVER_URL = "http://localhost:5173"
let WORKSPACE_URL = "http://10.10.60.8:1669"

// MARK: - Embedded Resources
// Properly embedded resources using Swift's Bundle system
class EmbeddedResources {
    static let shared = EmbeddedResources()
    
    private init() {}
    
    // Load embedded HTML content from app bundle
    func loadIndexHTML() -> String {
        #if DEBUG
        // In debug mode, return a simple loading page that redirects to dev server
        return getDebugHTML()
        #else
        // In release mode, load from embedded resources in app bundle
        return loadProductionHTML()
        #endif
    }
    
    private func getDebugHTML() -> String {
        return """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Workspace - Development</title>
            <style>
                body {
                    margin: 0;
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: #f5f5f5;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                }
                .loading {
                    text-align: center;
                    color: #666;
                }
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #e0e0e0;
                    border-top: 4px solid #007AFF;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="loading">
                <div class="spinner"></div>
                <h2>Loading Workspace...</h2>
                <p>Development mode - connecting to dev server</p>
            </div>
            
            <script>
                console.log('🔧 Development mode: Redirecting to dev server');
                setTimeout(() => {
                    window.location.href = '\(DEV_SERVER_URL)';
                }, 1000);
            </script>
        </body>
        </html>
        """
    }
    
    private func loadProductionHTML() -> String {
        // Try to load from app bundle resources first
        if let htmlPath = Bundle.main.path(forResource: "index", ofType: "html"),
           let content = try? String(contentsOfFile: htmlPath) {
            print("📦 Loaded HTML from app bundle resources")
            return injectMacOSAPI(into: content)
        }
        
        // Try to load from embedded data (this would be the preferred method)
        if let htmlData = loadEmbeddedHTMLData(),
           let content = String(data: htmlData, encoding: .utf8) {
            print("📦 Loaded HTML from embedded data")
            return injectMacOSAPI(into: content)
        }
        
        // Fallback to error page
        print("⚠️ Using fallback error HTML")
        return getFallbackHTML()
    }
    
    // This would load from embedded binary data (similar to Rust's include_bytes!)
    private func loadEmbeddedHTMLData() -> Data? {
        // In a real implementation, this would load from compiled-in data
        // For now, we'll try to load from the app bundle
        return Bundle.main.url(forResource: "index", withExtension: "html")
            .flatMap { try? Data(contentsOf: $0) }
    }
    
    // Load any embedded asset by path
    func loadEmbeddedAsset(path: String) -> Data? {
        // Remove leading slash if present
        let cleanPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        
        // Try to load from app bundle
        if let url = Bundle.main.url(forResource: cleanPath, withExtension: nil),
           let data = try? Data(contentsOf: url) {
            print("📦 Loaded asset from bundle: \(cleanPath) (\(data.count) bytes)")
            return data
        }
        
        // Try to parse path and extension
        let pathURL = URL(fileURLWithPath: cleanPath)
        let name = pathURL.deletingPathExtension().lastPathComponent
        let ext = pathURL.pathExtension
        
        if let url = Bundle.main.url(forResource: name, withExtension: ext.isEmpty ? nil : ext),
           let data = try? Data(contentsOf: url) {
            print("📦 Loaded asset from bundle (parsed): \(name).\(ext) (\(data.count) bytes)")
            return data
        }
        
        print("❌ Asset not found in bundle: \(cleanPath)")
        return nil
    }
    
    private func injectMacOSAPI(into html: String) -> String {
        // Inject macOS-specific JavaScript API before closing </head> tag
        let macOSAPI = """
        <script>
            console.log('🍎 macOS Desktop API initialized');
            window.sessionId = 'macos-desktop-session';
            
            // macOS-specific download API
            window.downloadAPI = {
                startDownload: function(url, filename) {
                    return new Promise((resolve, reject) => {
                        try {
                            console.log('🍎 Starting macOS download:', url, '->', filename);
                            
                            // Send message to Swift backend
                            window.webkit.messageHandlers.downloadHandler.postMessage({
                                type: 'start_download',
                                url: url,
                                filename: filename,
                                timestamp: Date.now()
                            });
                            
                            resolve({ 
                                success: true, 
                                message: 'Download request sent to macOS backend' 
                            });
                            
                        } catch (error) {
                            console.error('🍎 macOS download error:', error);
                            reject(error);
                        }
                    });
                },
                
                showInFolder: function(filename) {
                    return new Promise((resolve, reject) => {
                        try {
                            console.log('🍎 Showing file in Finder:', filename);
                            
                            window.webkit.messageHandlers.downloadHandler.postMessage({
                                type: 'show_in_finder',
                                filename: filename,
                                timestamp: Date.now()
                            });
                            
                            resolve({ 
                                success: true, 
                                message: 'Show in Finder request sent' 
                            });
                            
                        } catch (error) {
                            console.error('🍎 macOS show in Finder error:', error);
                            reject(error);
                        }
                    });
                }
            };
            
            // Enhanced clipboard support for macOS
            if (navigator.clipboard) {
                console.log('✅ Native Clipboard API available on macOS');
                
                // Wrap existing clipboard methods to add macOS-specific handling
                const originalWriteText = navigator.clipboard.writeText;
                const originalReadText = navigator.clipboard.readText;
                
                if (originalWriteText) {
                    navigator.clipboard.writeText = function(text) {
                        console.log('📋 macOS clipboard write:', text.substring(0, 50) + '...');
                        return originalWriteText.call(this, text).catch(error => {
                            console.warn('📋 Clipboard write failed, using fallback:', error);
                            window.webkit.messageHandlers.clipboardHandler.postMessage({
                                type: 'write_text',
                                text: text
                            });
                            return Promise.resolve();
                        });
                    };
                }
                
                if (originalReadText) {
                    navigator.clipboard.readText = function() {
                        console.log('📋 macOS clipboard read requested');
                        return originalReadText.call(this).catch(error => {
                            console.warn('📋 Clipboard read failed, using fallback:', error);
                            window.webkit.messageHandlers.clipboardHandler.postMessage({
                                type: 'read_text'
                            });
                            return Promise.resolve('');
                        });
                    };
                }
            } else {
                console.warn('⚠️ Clipboard API not available, creating macOS fallback');
                Object.defineProperty(navigator, 'clipboard', {
                    value: {
                        readText: function() {
                            return new Promise((resolve) => {
                                window.webkit.messageHandlers.clipboardHandler.postMessage({
                                    type: 'read_text'
                                });
                                resolve(''); // Fallback
                            });
                        },
                        writeText: function(text) {
                            return new Promise((resolve) => {
                                window.webkit.messageHandlers.clipboardHandler.postMessage({
                                    type: 'write_text',
                                    text: text
                                });
                                resolve();
                            });
                        }
                    }
                });
            }
            
            console.log('✅ macOS Desktop API ready');
        </script>
        </head>
        """
        
        return html.replacingOccurrences(of: "</head>", with: macOSAPI)
    }
    
    private func getFallbackHTML() -> String {
        return """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Workspace</title>
            <style>
                body {
                    margin: 0;
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: #f5f5f5;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                }
                .error {
                    text-align: center;
                    color: #d32f2f;
                    max-width: 500px;
                }
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #e0e0e0;
                    border-top: 4px solid #d32f2f;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .retry-btn {
                    background: #007AFF;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-top: 20px;
                }
                .retry-btn:hover {
                    background: #0056b3;
                }
            </style>
        </head>
        <body>
            <div class="error">
                <div class="spinner"></div>
                <h2>Unable to Load Application</h2>
                <p>The embedded resources could not be loaded. This may be due to a build configuration issue.</p>
                <p>Please ensure the resources are properly embedded in the app bundle.</p>
                <button class="retry-btn" onclick="window.location.reload()">Retry</button>
            </div>
            
            <script>
                console.error('❌ Failed to load embedded resources');
                console.log('🔍 Checking for alternative loading methods...');
                
                // Try to load from external URL as last resort
                setTimeout(() => {
                    console.log('🌐 Attempting to load from workspace URL...');
                    window.location.href = '\(WORKSPACE_URL)';
                }, 5000);
            </script>
        </body>
        </html>
        """
    }
}

// MARK: - Download Manager
class DownloadManager: NSObject {
    static let shared = DownloadManager()
    private var downloadTasks: [String: URLSessionDownloadTask] = [:]
    
    private lazy var urlSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 300
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()
    
    func startDownload(url: String, filename: String) {
        guard let downloadURL = URL(string: url) else {
            print("❌ Invalid download URL: \(url)")
            return
        }
        
        print("🚀 Starting download: \(url) -> \(filename)")
        
        let task = urlSession.downloadTask(with: downloadURL)
        downloadTasks[filename] = task
        task.resume()
        
        // Show notification
        showNotification(title: "Download Started", body: "Downloading \(filename)")
    }
    
    func showInFinder(filename: String) {
        let downloadsURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first!
        let fileURL = downloadsURL.appendingPathComponent(filename)
        
        if FileManager.default.fileExists(atPath: fileURL.path) {
            NSWorkspace.shared.selectFile(fileURL.path, inFileViewerRootedAtPath: downloadsURL.path)
            print("✅ Showed file in Finder: \(filename)")
        } else {
            // Just open Downloads folder
            NSWorkspace.shared.open(downloadsURL)
            print("⚠️ File not found, opened Downloads folder: \(filename)")
        }
    }
    
    private func showNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}

// MARK: - URLSessionDownloadDelegate
extension DownloadManager: URLSessionDownloadDelegate {
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        guard let filename = downloadTasks.first(where: { $0.value == downloadTask })?.key else {
            print("❌ Could not determine filename for completed download")
            return
        }
        
        let downloadsURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first!
        let destinationURL = downloadsURL.appendingPathComponent(filename)
        
        do {
            // Remove existing file if it exists
            if FileManager.default.fileExists(atPath: destinationURL.path) {
                try FileManager.default.removeItem(at: destinationURL)
            }
            
            // Move downloaded file to Downloads folder
            try FileManager.default.moveItem(at: location, to: destinationURL)
            
            print("✅ Download completed: \(filename)")
            showNotification(title: "Download Complete", body: "\(filename) saved to Downloads")
            
            // Clean up
            downloadTasks.removeValue(forKey: filename)
            
        } catch {
            print("❌ Failed to move downloaded file: \(error)")
            showNotification(title: "Download Error", body: "Failed to save \(filename)")
        }
    }
    
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        let progress = Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)
        let percentage = Int(progress * 100)
        
        if let filename = downloadTasks.first(where: { $0.value == downloadTask })?.key {
            print("📥 Download progress for \(filename): \(percentage)%")
        }
    }
    
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error {
            print("❌ Download failed: \(error.localizedDescription)")
            
            if let filename = downloadTasks.first(where: { $0.value == task })?.key {
                showNotification(title: "Download Failed", body: "Failed to download \(filename)")
                downloadTasks.removeValue(forKey: filename)
            }
        }
    }
}

// MARK: - Message Handlers
class DownloadMessageHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let messageBody = message.body as? [String: Any],
              let type = messageBody["type"] as? String else {
            print("❌ Invalid message format")
            return
        }
        
        switch type {
        case "start_download":
            guard let url = messageBody["url"] as? String,
                  let filename = messageBody["filename"] as? String else {
                print("❌ Missing url or filename in download message")
                return
            }
            DownloadManager.shared.startDownload(url: url, filename: filename)
            
        case "show_in_finder":
            guard let filename = messageBody["filename"] as? String else {
                print("❌ Missing filename in show_in_finder message")
                return
            }
            DownloadManager.shared.showInFinder(filename: filename)
            
        default:
            print("❓ Unknown message type: \(type)")
        }
    }
}

class ClipboardMessageHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let messageBody = message.body as? [String: Any],
              let type = messageBody["type"] as? String else {
            print("❌ Invalid clipboard message format")
            return
        }
        
        switch type {
        case "read_text":
            let pasteboard = NSPasteboard.general
            let text = pasteboard.string(forType: .string) ?? ""
            print("📋 Clipboard read: \(text.prefix(50))...")
            
        case "write_text":
            guard let text = messageBody["text"] as? String else {
                print("❌ Missing text in clipboard write message")
                return
            }
            let pasteboard = NSPasteboard.general
            pasteboard.clearContents()
            pasteboard.setString(text, forType: .string)
            print("📋 Clipboard written: \(text.prefix(50))...")
            
        default:
            print("❓ Unknown clipboard message type: \(type)")
        }
    }
}

// MARK: - Custom URL Scheme Handler
class CustomSchemeHandler: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(NSError(domain: "CustomSchemeHandler", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"]))
            return
        }
        
        print("🔗 Custom scheme request: \(url.absoluteString)")
        
        let path = url.path
        
        // Handle main HTML file
        if path == "/index.html" || path == "/" {
            handleHTMLRequest(urlSchemeTask)
            return
        }
        
        // Handle static assets (CSS, JS, images, etc.)
        if let response = handleStaticAsset(path: path) {
            let urlResponse = URLResponse(url: url, mimeType: response.mimeType, expectedContentLength: response.data.count, textEncodingName: nil)
            urlSchemeTask.didReceive(urlResponse)
            urlSchemeTask.didReceive(response.data)
            urlSchemeTask.didFinish()
            return
        }
        
        // Return 404 for unknown paths
        print("❌ Resource not found: \(path)")
        let notFoundData = "404 - Resource not found".data(using: .utf8) ?? Data()
        let urlResponse = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "text/plain"])!
        urlSchemeTask.didReceive(urlResponse)
        urlSchemeTask.didReceive(notFoundData)
        urlSchemeTask.didFinish()
    }
    
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        print("🛑 Custom scheme request stopped: \(urlSchemeTask.request.url?.absoluteString ?? "unknown")")
    }
    
    private func handleHTMLRequest(_ urlSchemeTask: WKURLSchemeTask) {
        let htmlContent = EmbeddedResources.shared.loadIndexHTML()
        let data = htmlContent.data(using: .utf8) ?? Data()
        
        let urlResponse = URLResponse(
            url: urlSchemeTask.request.url!,
            mimeType: "text/html",
            expectedContentLength: data.count,
            textEncodingName: "utf-8"
        )
        
        urlSchemeTask.didReceive(urlResponse)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
        
        print("✅ Served HTML content via custom scheme (\(data.count) bytes)")
    }
    
    private func handleStaticAsset(path: String) -> (data: Data, mimeType: String)? {
        // Use the embedded resources system
        if let data = EmbeddedResources.shared.loadEmbeddedAsset(path: path) {
            let mimeType = getMimeType(for: path)
            return (data, mimeType)
        }
        
        return nil
    }
    
    private func getMimeType(for path: String) -> String {
        let pathExtension = URL(fileURLWithPath: path).pathExtension.lowercased()
        
        switch pathExtension {
        case "html", "htm":
            return "text/html"
        case "css":
            return "text/css"
        case "js", "mjs":
            return "application/javascript"
        case "json":
            return "application/json"
        case "png":
            return "image/png"
        case "jpg", "jpeg":
            return "image/jpeg"
        case "gif":
            return "image/gif"
        case "svg":
            return "image/svg+xml"
        case "ico":
            return "image/x-icon"
        case "woff":
            return "font/woff"
        case "woff2":
            return "font/woff2"
        case "ttf":
            return "font/ttf"
        case "eot":
            return "application/vnd.ms-fontobject"
        case "xml":
            return "application/xml"
        case "txt":
            return "text/plain"
        default:
            return "application/octet-stream"
        }
    }
}

// MARK: - Main Window Controller
class MainWindowController: NSWindowController {
    private var webView: WKWebView!
    private var downloadHandler = DownloadMessageHandler()
    private var clipboardHandler = ClipboardMessageHandler()
    
    override func windowDidLoad() {
        super.windowDidLoad()
        setupWindow()
        setupWebView()
        setupMenuBar()
        requestNotificationPermission()
    }
    
    private func setupWindow() {
        guard let window = window else { return }
        
        // Configure window
        window.title = "Workspace"
        window.setContentSize(NSSize(width: 1200, height: 800))
        window.center()
        window.minSize = NSSize(width: 800, height: 600)
        
        // Set window style
        window.styleMask = [.titled, .closable, .miniaturizable, .resizable]
        window.titlebarAppearsTransparent = false
        window.titleVisibility = .visible
        
        // Enable full-size content view
        window.contentView?.wantsLayer = true
        window.contentView?.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        
        print("✅ Window configured")
    }
    
    private func setupWebView() {
        let config = WKWebViewConfiguration()
        
        // Enable developer tools in debug builds
        #if DEBUG
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        #endif
        
        // Configure user content controller for message handling
        let userContentController = WKUserContentController()
        userContentController.add(downloadHandler, name: "downloadHandler")
        userContentController.add(clipboardHandler, name: "clipboardHandler")
        config.userContentController = userContentController
        
        // Add custom URL scheme handler for miko:// protocol
        let schemeHandler = CustomSchemeHandler()
        config.setURLSchemeHandler(schemeHandler, forURLScheme: "miko")
        
        // Create WebView
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        
        // Configure WebView settings
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsMagnification = true
        
        // Add WebView to window
        guard let contentView = window?.contentView else { return }
        contentView.addSubview(webView)
        
        // Setup constraints
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: contentView.topAnchor),
            webView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor)
        ])
        
        // Load content
        loadInitialContent()
        
        print("✅ WebView configured with custom miko:// scheme handler")
    }
    
    private func loadInitialContent() {
        #if DEBUG
        // In debug mode, load from dev server
        if let url = URL(string: DEV_SERVER_URL) {
            print("🔧 Debug mode: Loading from dev server: \(DEV_SERVER_URL)")
            webView.load(URLRequest(url: url))
        } else {
            loadEmbeddedHTML()
        }
        #else
        // In release mode, load via custom scheme
        if let url = URL(string: "miko://app/index.html") {
            print("📦 Release mode: Loading via custom scheme: miko://app/index.html")
            webView.load(URLRequest(url: url))
        } else {
            loadEmbeddedHTML()
        }
        #endif
    }
    
    private func loadEmbeddedHTML() {
        print("📦 Loading embedded HTML content directly")
        let htmlContent = EmbeddedResources.shared.loadIndexHTML()
        webView.loadHTMLString(htmlContent, baseURL: nil)
    }
    
    private func setupMenuBar() {
        let mainMenu = NSMenu()
        
        // App Menu
        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        
        appMenu.addItem(withTitle: "About Workspace", action: #selector(showAbout), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Preferences...", action: #selector(showPreferences), keyEquivalent: ",")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Hide Workspace", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h").keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit Workspace", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)
        
        // File Menu
        let fileMenuItem = NSMenuItem(title: "File", action: nil, keyEquivalent: "")
        let fileMenu = NSMenu(title: "File")
        
        fileMenu.addItem(withTitle: "New Window", action: #selector(newWindow), keyEquivalent: "n")
        fileMenu.addItem(NSMenuItem.separator())
        fileMenu.addItem(withTitle: "Open Workspace (Web)", action: #selector(openWorkspaceWeb), keyEquivalent: "w")
        fileMenu.addItem(withTitle: "Open Downloads", action: #selector(openDownloads), keyEquivalent: "d")
        fileMenu.addItem(NSMenuItem.separator())
        fileMenu.addItem(withTitle: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w").keyEquivalentModifierMask = .command
        
        fileMenuItem.submenu = fileMenu
        mainMenu.addItem(fileMenuItem)
        
        // Edit Menu
        let editMenuItem = NSMenuItem(title: "Edit", action: nil, keyEquivalent: "")
        let editMenu = NSMenu(title: "Edit")
        
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: Selector(("cut:")), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: Selector(("copy:")), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: Selector(("paste:")), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: Selector(("selectAll:")), keyEquivalent: "a")
        
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)
        
        // View Menu
        let viewMenuItem = NSMenuItem(title: "View", action: nil, keyEquivalent: "")
        let viewMenu = NSMenu(title: "View")
        
        viewMenu.addItem(withTitle: "Reload", action: #selector(reloadWebView), keyEquivalent: "r")
        viewMenu.addItem(withTitle: "Force Reload", action: #selector(forceReloadWebView), keyEquivalent: "R")
        viewMenu.addItem(NSMenuItem.separator())
        
        #if DEBUG
        viewMenu.addItem(withTitle: "Developer Tools", action: #selector(showDeveloperTools), keyEquivalent: "i").keyEquivalentModifierMask = [.command, .option]
        viewMenu.addItem(NSMenuItem.separator())
        #endif
        
        viewMenu.addItem(withTitle: "Actual Size", action: #selector(actualSize), keyEquivalent: "0")
        viewMenu.addItem(withTitle: "Zoom In", action: #selector(zoomIn), keyEquivalent: "+")
        viewMenu.addItem(withTitle: "Zoom Out", action: #selector(zoomOut), keyEquivalent: "-")
        
        viewMenuItem.submenu = viewMenu
        mainMenu.addItem(viewMenuItem)
        
        // Window Menu
        let windowMenuItem = NSMenuItem(title: "Window", action: nil, keyEquivalent: "")
        let windowMenu = NSMenu(title: "Window")
        
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowMenu.addItem(NSMenuItem.separator())
        windowMenu.addItem(withTitle: "Bring All to Front", action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: "")
        
        windowMenuItem.submenu = windowMenu
        mainMenu.addItem(windowMenuItem)
        
        NSApplication.shared.mainMenu = mainMenu
        print("✅ Menu bar configured")
    }
    
    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if granted {
                print("✅ Notification permission granted")
            } else if let error = error {
                print("❌ Notification permission error: \(error)")
            } else {
                print("⚠️ Notification permission denied")
            }
        }
    }
    
    // MARK: - Menu Actions
    @objc private func showAbout() {
        let alert = NSAlert()
        alert.messageText = "About Workspace"
        alert.informativeText = "Workspace Desktop Application v1.0.0\n\nBuilt with Swift, WebKit, and Cocoa\nFeatures: File downloads, notifications, WebView integration"
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }
    
    @objc private func showPreferences() {
        print("📋 Preferences (not implemented yet)")
        // TODO: Implement preferences window
    }
    
    @objc private func newWindow() {
        let storyboard = NSStoryboard(name: "Main", bundle: nil)
        if let windowController = storyboard.instantiateController(withIdentifier: "MainWindowController") as? MainWindowController {
            windowController.showWindow(nil)
        }
    }
    
    @objc private func openWorkspaceWeb() {
        if let url = URL(string: WORKSPACE_URL) {
            NSWorkspace.shared.open(url)
            print("✅ Opened workspace in browser: \(WORKSPACE_URL)")
        }
    }
    
    @objc private func openDownloads() {
        let downloadsURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first!
        NSWorkspace.shared.open(downloadsURL)
        print("✅ Opened Downloads folder")
    }
    
    @objc private func reloadWebView() {
        webView.reload()
        print("🔄 WebView reloaded")
    }
    
    @objc private func forceReloadWebView() {
        webView.reloadFromOrigin()
        print("🔄 WebView force reloaded")
    }
    
    #if DEBUG
    @objc private func showDeveloperTools() {
        // Developer tools are automatically available via right-click in debug builds
        print("🔧 Developer tools available via right-click context menu")
    }
    #endif
    
    @objc private func actualSize() {
        webView.magnification = 1.0
        print("🔍 WebView zoom reset to actual size")
    }
    
    @objc private func zoomIn() {
        webView.magnification += 0.1
        print("🔍 WebView zoomed in: \(webView.magnification)")
    }
    
    @objc private func zoomOut() {
        webView.magnification -= 0.1
        print("🔍 WebView zoomed out: \(webView.magnification)")
    }
}

// MARK: - WKNavigationDelegate
extension MainWindowController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        print("🌐 Navigation started: \(webView.url?.absoluteString ?? "unknown")")
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("✅ Navigation finished: \(webView.url?.absoluteString ?? "unknown")")
        
        // Update window title with page title
        webView.evaluateJavaScript("document.title") { result, error in
            if let title = result as? String, !title.isEmpty {
                DispatchQueue.main.async {
                    self.window?.title = "Workspace - \(title)"
                }
            }
        }
    }
    
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("❌ Navigation failed: \(error.localizedDescription)")
        
        // Show error page or fallback to embedded HTML
        loadEmbeddedHTML()
    }
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        
        // Handle external links
        if url.scheme == "http" || url.scheme == "https" {
            if url.host != "localhost" && url.host != "10.10.60.8" {
                // Open external links in default browser
                NSWorkspace.shared.open(url)
                decisionHandler(.cancel)
                return
            }
        }
        
        decisionHandler(.allow)
    }
}

// MARK: - WKUIDelegate
extension MainWindowController: WKUIDelegate {
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        // Handle popup windows by opening in default browser
        if let url = navigationAction.request.url {
            NSWorkspace.shared.open(url)
        }
        return nil
    }
    
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = "Workspace"
        alert.informativeText = message
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        alert.runModal()
        completionHandler()
    }
    
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = "Workspace"
        alert.informativeText = message
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        let response = alert.runModal()
        completionHandler(response == .alertFirstButtonReturn)
    }
}

// MARK: - App Delegate
class AppDelegate: NSObject, NSApplicationDelegate {
    var mainWindowController: MainWindowController?
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        print("🚀 Workspace macOS Desktop Application Started")
        
        // Create main window
        let storyboard = NSStoryboard(name: "Main", bundle: nil)
        mainWindowController = storyboard.instantiateController(withIdentifier: "MainWindowController") as? MainWindowController
        mainWindowController?.showWindow(nil)
        
        // Configure app
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)
        
        print("✅ Application initialized successfully")
    }
    
    func applicationWillTerminate(_ notification: Notification) {
        print("👋 Application terminating")
    }
    
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
    
    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        return true
    }
}

// MARK: - Main Entry Point
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()