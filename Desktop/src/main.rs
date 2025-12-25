#![windows_subsystem = "windows"]
use wry::WebViewBuilder;
#[cfg(windows)]
use wry::WebViewBuilderExtWindows;
use winit::{
    event::WindowEvent,
    event_loop::{ActiveEventLoop, EventLoop},
    window::{Window, WindowId, Icon},
    application::ApplicationHandler,
    dpi::LogicalSize,
};
use std::sync::Arc;
use std::process::{Command, Child};
use wgpu::{Instance, Adapter, Device, Queue};

mod core;
mod ipc;
mod context_menu;
mod network;
mod auth;
mod menubar;

use core::SharedAppState;
use ipc::handle_ipc_message;
use menubar::{MenuBar, apply_modern_menu_theme, enable_window_animations};

// Include the icon at compile time
const ICON_BYTES: &[u8] = include_bytes!("../../Library/Shared/Icons/icon.ico");

fn load_window_icon() -> Option<Icon> {
    // First try to load from embedded bytes
    println!("Attempting to load window icon from embedded bytes ({} bytes)", ICON_BYTES.len());
    
    match ico::IconDir::read(std::io::Cursor::new(ICON_BYTES)) {
        Ok(icon_dir) => {
            println!("ICO file parsed successfully, {} entries found", icon_dir.entries().len());
            
            // Find the best icon (largest size, highest bit depth)
            if let Some(entry) = icon_dir.entries().iter()
                .max_by_key(|entry| (entry.width() as u32, entry.height() as u32, entry.bits_per_pixel())) {
                
                println!("Selected icon entry: {}x{} @ {} bpp", entry.width(), entry.height(), entry.bits_per_pixel());
                
                match entry.decode() {
                    Ok(image) => {
                        let rgba_data = image.rgba_data().to_vec();
                        let width = image.width();
                        let height = image.height();
                        
                        println!("Icon decoded to RGBA: {}x{}, {} bytes", width, height, rgba_data.len());
                        
                        match Icon::from_rgba(rgba_data, width, height) {
                            Ok(icon) => {
                                println!("✅ Window icon loaded successfully ({}x{})", width, height);
                                return Some(icon);
                            }
                            Err(e) => {
                                println!("⚠️ Failed to create winit icon from RGBA data: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        println!("⚠️ Failed to decode icon entry: {}", e);
                    }
                }
            } else {
                println!("⚠️ No icon entries found in ICO file");
            }
        }
        Err(e) => {
            println!("⚠️ Failed to parse embedded ICO file: {}", e);
        }
    }
    
    // Fallback: try to create a simple colored icon
    println!("Creating fallback icon...");
    let size = 32;
    let mut rgba_data = Vec::with_capacity((size * size * 4) as usize);
    
    for y in 0..size {
        for x in 0..size {
            // Create a simple gradient icon
            let r = ((x as f32 / size as f32) * 255.0) as u8;
            let g = ((y as f32 / size as f32) * 255.0) as u8;
            let b = 128;
            let a = 255;
            
            rgba_data.extend_from_slice(&[r, g, b, a]);
        }
    }
    
    match Icon::from_rgba(rgba_data, size, size) {
        Ok(icon) => {
            println!("✅ Fallback icon created successfully ({}x{})", size, size);
            Some(icon)
        }
        Err(e) => {
            println!("⚠️ Failed to create fallback icon: {}", e);
            None
        }
    }
}

#[cfg(debug_assertions)]
const DEV_SERVER_URL: &str = "http://localhost:5173";

#[cfg(not(debug_assertions))]
const INDEX_HTML_BYTES: &[u8] = include_bytes!("../../Distribution/index.html");

struct WgpuState {
    instance: Instance,
    adapter: Option<Adapter>,
    device: Option<Device>,
    queue: Option<Queue>,
}

impl WgpuState {
    fn new() -> Self {
        println!("Creating WGPU instance...");
        let instance = Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        });
        
        Self {
            instance,
            adapter: None,
            device: None,
            queue: None,
        }
    }
    
    async fn initialize(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        println!("Requesting WGPU adapter...");
        let adapter = self.instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::default(),
                compatible_surface: None,
                force_fallback_adapter: false,
            })
            .await;
        
        let adapter = match adapter {
            Ok(adapter) => adapter,
            Err(e) => return Err(format!("Failed to find an appropriate adapter: {:?}", e).into()),
        };
        
        println!("Requesting WGPU device...");
        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: None,
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::default(),
                    memory_hints: wgpu::MemoryHints::default(),
                    ..Default::default()
                }
            )
            .await?;
        
        self.adapter = Some(adapter);
        self.device = Some(device);
        self.queue = Some(queue);
        
        println!("WGPU initialized successfully!");
        Ok(())
    }
}

struct App {
    window: Option<Arc<Window>>,
    webview: Option<wry::WebView>,
    state: SharedAppState,
    initialization_complete: bool,
    ready_to_show: bool,
    proxy_process: Option<Child>,
    native_menubar: Option<MenuBar>,
}

impl App {
    fn new() -> Self {
        Self {
            window: None,
            webview: None,
            state: core::create_shared_state(),
            initialization_complete: false,
            ready_to_show: false,
            proxy_process: None,
            native_menubar: None,
        }
    }
    
    fn start_proxy_process(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        println!("🚀 Starting mikoproxy.exe subprocess...");
        
        // Try to find the mikoproxy.exe in the target directory
        let exe_paths = [
            "./target/debug/mikoproxy.exe",
            "./target/release/mikoproxy.exe", 
            "mikoproxy.exe",
            "./mikoproxy.exe"
        ];
        
        let mut proxy_exe_path = None;
        for path in &exe_paths {
            if std::path::Path::new(path).exists() {
                proxy_exe_path = Some(path);
                break;
            }
        }
        
        let exe_path = match proxy_exe_path {
            Some(path) => {
                println!("Found mikoproxy.exe at: {}", path);
                path
            }
            None => {
                println!("⚠️ mikoproxy.exe not found. Trying to build it...");
                
                // Try to build the proxy first
                let build_result = Command::new("cargo")
                    .args(&["build", "--bin", "mikoproxy"])
                    .output();
                
                match build_result {
                    Ok(output) => {
                        if output.status.success() {
                            println!("✅ Successfully built mikoproxy.exe");
                            "./target/debug/mikoproxy.exe"
                        } else {
                            let stderr = String::from_utf8_lossy(&output.stderr);
                            return Err(format!("Failed to build mikoproxy: {}", stderr).into());
                        }
                    }
                    Err(e) => {
                        return Err(format!("Failed to run cargo build: {}", e).into());
                    }
                }
            }
        };
        
        // Start the proxy process with hidden console
        let mut cmd = Command::new(exe_path);
        
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            // Hide the console window on Windows
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        
        match cmd.spawn() {
            Ok(child) => {
                println!("✅ mikoproxy.exe started successfully (PID: {}) - console hidden", child.id());
                self.proxy_process = Some(child);
                
                // Give the proxy a moment to start up
                std::thread::sleep(std::time::Duration::from_millis(500));
                
                Ok(())
            }
            Err(e) => {
                Err(format!("Failed to start mikoproxy.exe: {}", e).into())
            }
        }
    }
    
    fn check_logout_trigger(&mut self) {
        if let Some(webview) = &self.webview {
            let state = self.state.lock().unwrap();
            if state.message == "trigger_logout" {
                println!("Logout trigger detected - executing JavaScript");
                let js_code = r#"
                    console.log('Backend confirmed logout - triggering frontend logout');
                    if (window.triggerLogout) {
                        window.triggerLogout();
                    } else {
                        console.error('triggerLogout function not found');
                    }
                "#;
                if let Err(e) = webview.evaluate_script(js_code) {
                    println!("Failed to execute logout script: {}", e);
                }
                // Clear the trigger flag
                drop(state);
                let mut state = self.state.lock().unwrap();
                state.message = "logout_triggered".to_string();
            }
        }
    }
    
    fn stop_proxy_process(&mut self) {
        if let Some(mut child) = self.proxy_process.take() {
            println!("🛑 Stopping mikoproxy.exe subprocess...");
            match child.kill() {
                Ok(_) => {
                    let _ = child.wait();
                    println!("✅ mikoproxy.exe stopped successfully");
                }
                Err(e) => {
                    println!("⚠️ Failed to stop mikoproxy.exe: {}", e);
                }
            }
        }
    }
    
    fn handle_menu_action(&self, action: &str) {
        println!("Menu action triggered: {}", action);
        
        match action {
            // File menu actions
            "new_chat" => {
                if let Some(webview) = &self.webview {
                    let _ = webview.evaluate_script("window.dispatchEvent(new CustomEvent('menuAction', { detail: { action: 'new_chat' } }));");
                }
            }
            "new_window" => {
                println!("New window requested - would spawn new instance");
            }
            "settings" => {
                if let Some(webview) = &self.webview {
                    let _ = webview.evaluate_script("window.dispatchEvent(new CustomEvent('menuAction', { detail: { action: 'settings' } }));");
                }
            }
            
            // Edit menu actions
            "undo" | "redo" | "cut" | "copy" | "paste" | "select_all" => {
                if let Some(webview) = &self.webview {
                    let script = format!("document.execCommand('{}');", action);
                    let _ = webview.evaluate_script(&script);
                }
            }
            "find" => {
                if let Some(webview) = &self.webview {
                    let _ = webview.evaluate_script("if (window.find) window.find(); else alert('Find functionality not available');");
                }
            }
            
            // View menu actions
            "toggle_sidebar" => {
                if let Some(webview) = &self.webview {
                    let _ = webview.evaluate_script("window.dispatchEvent(new CustomEvent('menuAction', { detail: { action: 'toggle_sidebar' } }));");
                }
            }
            "toggle_devtools" => {
                println!("DevTools can be accessed via right-click or F12");
            }
            "zoom_in" => {
                if let Some(webview) = &self.webview {
                    let _ = webview.evaluate_script("document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) + 0.1).toString();");
                }
            }
            "zoom_out" => {
                if let Some(webview) = &self.webview {
                    let _ = webview.evaluate_script("document.body.style.zoom = Math.max(0.5, parseFloat(document.body.style.zoom || 1) - 0.1).toString();");
                }
            }
            "reset_zoom" => {
                if let Some(webview) = &self.webview {
                    let _ = webview.evaluate_script("document.body.style.zoom = '1';");
                }
            }
            "fullscreen" => {
                if let Some(_window) = &self.window {
                    // Toggle fullscreen mode
                    println!("Fullscreen toggle requested");
                }
            }
            
            // Tools menu actions
            "clear_history" => {
                if let Some(webview) = &self.webview {
                    let _ = webview.evaluate_script("if (confirm('Clear all chat history? This cannot be undone.')) { window.dispatchEvent(new CustomEvent('menuAction', { detail: { action: 'clear_history' } })); }");
                }
            }
            "network_diagnostics" => {
                println!("Network diagnostics - checking proxy connection...");
                // Could add actual network diagnostics here
            }
            
            // Help menu actions
            "shortcuts" => {
                if let Some(webview) = &self.webview {
                    let shortcuts_info = r#"
                        alert('Keyboard Shortcuts:\n\n' +
                              'Ctrl+N - New Chat\n' +
                              'Ctrl+B - Toggle Sidebar\n' +
                              'Ctrl+F - Find\n' +
                              'Ctrl+, - Settings\n' +
                              'F11 - Fullscreen\n' +
                              'F12 - DevTools\n' +
                              'Alt+F4 - Exit');
                    "#;
                    let _ = webview.evaluate_script(shortcuts_info);
                }
            }
            "about" => {
                if let Some(webview) = &self.webview {
                    let about_info = format!(
                        "alert('Workspace v0.1.0\\n\\nBuilt with Rust + WebView2\\nDark mode: {}\\n\\nA modern desktop chat application with native Win32 menus.');",
                        if menubar::is_system_dark_mode() { "Enabled" } else { "Disabled" }
                    );
                    let _ = webview.evaluate_script(&about_info);
                }
            }
            "documentation" => {
                if let Some(webview) = &self.webview {
                    let _ = webview.evaluate_script("window.open('https://github.com/your-repo/docs', '_blank');");
                }
            }
            "report_issue" => {
                if let Some(webview) = &self.webview {
                    let _ = webview.evaluate_script("window.open('https://github.com/your-repo/issues', '_blank');");
                }
            }
            "exit" => {
                std::process::exit(0);
            }
            _ => {
                println!("Unhandled menu action: {}", action);
                // Forward unknown actions to the webview
                if let Some(webview) = &self.webview {
                    let script = format!("window.dispatchEvent(new CustomEvent('menuAction', {{ detail: {{ action: '{}' }} }}));", action);
                    let _ = webview.evaluate_script(&script);
                }
            }
        }
    }
}

impl ApplicationHandler for App {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.window.is_none() && !self.initialization_complete {
            println!("Starting initialization...");
            
            // Create window but keep it hidden until everything is ready
            let mut window_attributes = Window::default_attributes()
                .with_title("Workspace")
                .with_inner_size(LogicalSize::new(1200, 800))
                .with_visible(false); // Keep hidden during preload
            
            // Set window icon
            if let Some(icon) = load_window_icon() {
                window_attributes = window_attributes.with_window_icon(Some(icon));
            }
            
            let window = Arc::new(event_loop.create_window(window_attributes).unwrap());
            self.window = Some(window.clone());
            
            // Create WebView2 immediately (but window stays hidden)
            self.create_webview(&window);
            
            // Start the proxy process
            if let Err(e) = self.start_proxy_process() {
                println!("❌ Failed to start proxy process: {}", e);
                // Continue anyway - user can start proxy manually
            }
            
            // Clone for async initialization
            let state_clone = self.state.clone();
            let window_clone = window.clone();
            
            // Spawn initialization task
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    // Initialize WGPU
                    println!("Initializing WGPU...");
                    let mut wgpu_state = WgpuState::new();
                    match wgpu_state.initialize().await {
                        Ok(_) => {
                            let mut state = state_clone.lock().unwrap();
                            state.wgpu_initialized = true;
                            state.message = "WGPU initialized successfully".to_string();
                            println!("WGPU initialization complete");
                        }
                        Err(e) => {
                            let mut state = state_clone.lock().unwrap();
                            state.message = format!("WGPU initialization failed: {}", e);
                            println!("WGPU initialization failed: {}", e);
                            return;
                        }
                    }

                    // Mark WebView2 as initialized
                    {
                        let mut state = state_clone.lock().unwrap();
                        state.webview_initialized = true;
                        state.message = "All systems ready! mikoproxy.exe running on port 8640".to_string();
                    }
                    
                    println!("All initialization complete");
                    
                    // Small delay to ensure everything is settled
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    
                    // Now show the window
                    println!("Showing window");
                    window_clone.set_visible(true);
                });
            });
            
            self.initialization_complete = true;
        }
        
        // Check if we need to navigate to the main app
        if self.ready_to_show && self.webview.is_some() {
            #[cfg(not(debug_assertions))]
            {
                println!("Loading main application...");
                if let Some(_webview) = &self.webview {
                    let _ = _webview.load_url("miko://app/");
                }
            }
            self.ready_to_show = false;
        }
    }

    fn window_event(&mut self, event_loop: &ActiveEventLoop, _window_id: WindowId, event: WindowEvent) {
        // Check for logout trigger
        self.check_logout_trigger();
        
        match event {
            WindowEvent::CloseRequested => {
                // Stop the proxy process before exiting
                self.stop_proxy_process();
                event_loop.exit();
            }
            WindowEvent::KeyboardInput { event, .. } => {
                // F12 to toggle DevTools
                if event.state == winit::event::ElementState::Pressed {
                    if let winit::keyboard::Key::Named(winit::keyboard::NamedKey::F12) = event.logical_key {
                        if let Some(_webview) = &self.webview {
                            println!("DevTools should be available via right-click or F12 in WebView2");
                            // DevTools are automatically available when with_devtools(true) is set
                        }
                    }
                }
            }
            // Note: Menu commands are handled via Windows message loop, not winit events
            _ => {}
        }
    }
}

impl App {
    fn create_webview(&mut self, window: &Arc<Window>) {
        let state_clone = self.state.clone();
        
        #[cfg(debug_assertions)]
        {
            println!("Running in DEBUG mode");
            println!("Frontend dev server: {}", DEV_SERVER_URL);
            println!("Make sure to run 'bun run dev' or 'npm run dev' in the www directory!");
        }

        #[cfg(not(debug_assertions))]
        println!("Running in RELEASE mode with embedded assets");

        let mut webview_builder = WebViewBuilder::new();

        // Add WebView2 arguments to disable CORS and web security
        #[cfg(windows)]
        {
            webview_builder = webview_builder
                .with_additional_browser_args("--disable-web-security --disable-features=VizDisplayCompositor --allow-running-insecure-content --disable-site-isolation-trials");
        }

        // In debug mode, use dev server. In release, use custom protocol with embedded HTML
        #[cfg(debug_assertions)]
        {
            webview_builder = webview_builder.with_url(DEV_SERVER_URL);
        }

        #[cfg(not(debug_assertions))]
        {
            // Use custom protocol to serve embedded HTML and proxy API requests
            use std::borrow::Cow;
            
            webview_builder = webview_builder.with_custom_protocol("miko".into(), move |_webview, request| {
                let uri = request.uri();
                
                // Serve the main HTML file
                if uri == "miko://app/" || uri == "miko://app/index.html" {
                    return http::Response::builder()
                        .header("Content-Type", "text/html")
                        .body(Cow::Borrowed(INDEX_HTML_BYTES))
                        .unwrap();
                }
                
                // Return 404 for other requests
                http::Response::builder()
                    .status(404)
                    .body(Cow::Borrowed(&[] as &[u8]))
                    .unwrap()
            });
            
            // Navigate to the app immediately - window will stay hidden until WGPU is ready
            webview_builder = webview_builder.with_url("miko://app/");
        }

        // Add initialization script to handle API requests and enable DevTools access
        webview_builder = webview_builder
            .with_initialization_script(
                r#"
                console.log('WebView initialized from:', window.location.href);
                
                // Store session ID for authentication
                window.sessionId = 'desktop-session';
                console.log('Fixed session ID set to:', window.sessionId);
                
                // Override fetch to use local auth proxy instead of direct ERP calls
                const originalFetch = window.fetch;
                window.fetch = function(url, options = {}) {
                    console.log('Fetch intercepted:', url, options);
                    
                    let newUrl = url;
                    
                    // Handle different URL formats for API calls
                    if (typeof url === 'string') {
                        // Case 1: Starts with /api - redirect to local auth proxy
                        if (url.startsWith('/api')) {
                            newUrl = 'http://localhost:8640' + url;
                        }
                        // Case 2: Relative API calls (api/...)
                        else if (url.startsWith('api/')) {
                            newUrl = 'http://localhost:8640/' + url;
                        }
                        // Case 3: Full ERP server URLs - redirect to local proxy
                        else if (url.includes('10.10.60.8:1669/api/')) {
                            const apiPath = url.substring(url.indexOf('/api/'));
                            newUrl = 'http://localhost:8640' + apiPath;
                        }
                        
                        // If URL was changed, log the redirect and add session header
                        if (newUrl !== url) {
                            console.log('Redirecting API call from', url, 'to', newUrl);
                            
                            // Add session ID header for authentication
                            const newOptions = { ...options };
                            newOptions.headers = {
                                ...newOptions.headers,
                                'X-Session-Id': window.sessionId
                            };
                            
                            // Ensure CORS mode is set
                            newOptions.mode = 'cors';
                            
                            return originalFetch(newUrl, newOptions);
                        }
                    }
                    
                    return originalFetch(url, options);
                };

                // Add authentication helper functions
                window.authManager = {
                    login: async function(credentials) {
                        console.log('Logging in via Rust backend...');
                        try {
                            const response = await fetch('http://localhost:8640/auth/login', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-Session-Id': window.sessionId
                                },
                                body: JSON.stringify(credentials)
                            });
                            const result = await response.json();
                            console.log('Login result:', result);
                            return result;
                        } catch (error) {
                            console.error('Login error:', error);
                            throw error;
                        }
                    },
                    
                    logout: async function() {
                        console.log('Logging out via Rust backend...');
                        try {
                            const response = await fetch('http://localhost:8640/auth/logout', {
                                method: 'POST',
                                headers: {
                                    'X-Session-Id': window.sessionId
                                }
                            });
                            const result = await response.json();
                            console.log('Logout result:', result);
                            return result;
                        } catch (error) {
                            console.error('Logout error:', error);
                            throw error;
                        }
                    },
                    
                    checkStatus: async function() {
                        try {
                            const response = await fetch('http://localhost:8640/auth/status', {
                                headers: {
                                    'X-Session-Id': window.sessionId
                                }
                            });
                            const result = await response.json();
                            console.log('Auth status:', result);
                            return result;
                        } catch (error) {
                            console.error('Auth status error:', error);
                            return { authenticated: false };
                        }
                    }
                };

                // Add native dialog helper
                window.nativeDialog = {
                    confirmLogout: function() {
                        // Send IPC message to show logout confirmation
                        try {
                            window.ipc.postMessage(JSON.stringify({
                                action: 'confirm_logout'
                            }));
                            // The native dialog is synchronous and blocks, so we return false here
                            // The actual logout will be handled by the backend if user confirms
                            return false; // Don't proceed with logout in frontend
                        } catch (error) {
                            console.error('IPC error, using browser confirm:', error);
                            return confirm('Are you sure you want to sign out?');
                        }
                    }
                };

                console.log('Authentication system initialized');
                console.log('Session ID:', window.sessionId);
                console.log('All API calls will be authenticated via Rust backend proxy');
                console.log('DevTools: Right-click and select "Inspect" or press F12');
                
                // Add logout trigger function that can be called from backend
                window.triggerLogout = function() {
                    console.log('triggerLogout called from backend');
                    // Find and trigger the logout function
                    if (window.appLogout) {
                        window.appLogout();
                    } else {
                        console.log('appLogout not found, dispatching custom event');
                        window.dispatchEvent(new CustomEvent('nativeLogout'));
                    }
                };
                
                console.log('Native logout trigger initialized');
                "#
            );

        #[cfg(windows)]
        let window_handle = {
            use windows::Win32::Foundation::HWND;
            use winit::raw_window_handle::{HasWindowHandle, RawWindowHandle};
            
            match window.window_handle().unwrap().as_raw() {
                RawWindowHandle::Win32(handle) => HWND(handle.hwnd.get() as *mut std::ffi::c_void),
                _ => panic!("Expected Win32 window handle"),
            }
        };

        // Initialize DWM theme for the main window
        #[cfg(windows)]
        {
            if let Err(e) = context_menu::init_window_theme(window_handle) {
                println!("Warning: Failed to initialize window theme: {:?}", e);
            }
            
            // Apply modern menu theme with dark mode
            if let Err(e) = apply_modern_menu_theme(window_handle) {
                println!("Warning: Failed to apply modern menu theme: {:?}", e);
            }

            // Enable window animations and effects
            if let Err(e) = enable_window_animations(window_handle) {
                println!("Warning: Failed to enable window animations: {:?}", e);
            }
        }

        // Initialize native Win32 menubar
        match menubar::create_app_menubar() {
            Ok(menu) => {
                if let Err(e) = menu.attach_to_window(window_handle) {
                    println!("Warning: Failed to attach native menubar: {:?}", e);
                } else {
                    println!("✅ Native Win32 menubar attached");
                    
                    // Apply menu colors based on system theme
                    #[cfg(windows)]
                    {
                        if let Err(e) = menubar::apply_menu_colors(window_handle) {
                            println!("Warning: Failed to apply menu colors: {:?}", e);
                        } else {
                            println!("✅ Menu colors applied based on system theme");
                        }
                    }
                    
                    self.native_menubar = Some(menu);
                }
            }
            Err(e) => {
                println!("Warning: Failed to create native menubar: {:?}", e);
            }
        }

        let webview = webview_builder
            .with_devtools(true) // Enable DevTools for debugging
            .with_ipc_handler(move |request: http::Request<String>| {
                let body = request.body();
                
                // Try to parse as JSON for context menu coordinates and menu actions
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(body) {
                    if let Some(action) = parsed.get("action").and_then(|v| v.as_str()) {
                        match action {
                            "show_context_menu" => {
                                if let (Some(x), Some(y)) = (
                                    parsed.get("x").and_then(|v| v.as_i64()),
                                    parsed.get("y").and_then(|v| v.as_i64())
                                ) {
                                    #[cfg(windows)]
                                    {
                                        if let Err(e) = context_menu::show_context_menu(window_handle, x as i32, y as i32) {
                                            println!("Failed to show context menu: {:?}", e);
                                        }
                                    }
                                    
                                    #[cfg(not(windows))]
                                    {
                                        println!("Context menu requested at ({}, {})", x, y);
                                        if let Err(e) = context_menu::show_context_menu(x as i32, y as i32) {
                                            println!("Failed to show context menu: {:?}", e);
                                        }
                                    }
                                    return;
                                }
                            }
                            "menu_action" => {
                                if let Some(menu_id) = parsed.get("menu_id").and_then(|v| v.as_str()) {
                                    // Handle webview menu actions
                                    println!("WebView menu action: {}", menu_id);
                                    // Note: We can't call self.handle_menu_action here due to closure constraints
                                    // The webview menubar handles most actions directly via JavaScript
                                    return;
                                }
                            }
                            _ => {}
                        }
                    }
                }
                
                // Handle other IPC messages
                let state = state_clone.clone();
                handle_ipc_message(request, state);
            })
            .build(&**window)
            .map_err(|e| {
                eprintln!("WebView creation error: {:?}", e);
                #[cfg(windows)]
                {
                    use std::env;
                    eprintln!("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER: {:?}", env::var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER"));
                    eprintln!("WEBVIEW2_USER_DATA_FOLDER: {:?}", env::var("WEBVIEW2_USER_DATA_FOLDER"));
                }
                e
            })
            .expect("Failed to create WebView");

        self.webview = Some(webview);
        println!("WebView2 created with Win32 context menu support");
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let event_loop = EventLoop::new()?;
    
    let mut app = App::new();

    event_loop.run_app(&mut app)?;
    
    Ok(())
}
