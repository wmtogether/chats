#![windows_subsystem = "windows"]
use wry::WebViewBuilder;
#[cfg(windows)]
use wry::WebViewBuilderExtWindows;
use winit::{
    event::WindowEvent,
    event_loop::{ActiveEventLoop, EventLoop},
    window::{Window, WindowId},
    application::ApplicationHandler,
    dpi::LogicalSize,
};
use std::sync::Arc;
use wgpu::{Instance, Adapter, Device, Queue};

mod core;
mod ipc;
mod context_menu;
mod network;

use core::SharedAppState;
use ipc::handle_ipc_message;
use network::{ReverseProxy, ProxyConfig};

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
    wgpu_state: Option<WgpuState>,
    initialization_complete: bool,
    ready_to_show: bool,
    #[cfg(not(debug_assertions))]
    reverse_proxy: Option<ReverseProxy>,
}

impl App {
    fn new() -> Self {
        Self {
            window: None,
            webview: None,
            state: core::create_shared_state(),
            wgpu_state: None,
            initialization_complete: false,
            ready_to_show: false,
            #[cfg(not(debug_assertions))]
            reverse_proxy: None,
        }
    }
    
    async fn preload_wgpu(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let mut wgpu_state = WgpuState::new();
        wgpu_state.initialize().await?;
        
        // Update state
        {
            let mut state = self.state.lock().unwrap();
            state.wgpu_initialized = true;
            state.message = "WGPU initialized, loading WebView2...".to_string();
        }
        
        self.wgpu_state = Some(wgpu_state);
        Ok(())
    }
}

impl ApplicationHandler for App {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.window.is_none() && !self.initialization_complete {
            println!("Starting initialization...");
            
            // Create window but keep it hidden until everything is ready
            let window_attributes = Window::default_attributes()
                .with_title("Workspace")
                .with_inner_size(LogicalSize::new(1000, 700))
                .with_visible(false); // Keep hidden during preload
            
            let window = Arc::new(event_loop.create_window(window_attributes).unwrap());
            self.window = Some(window.clone());
            
            // Create WebView2 immediately (but window stays hidden)
            self.create_webview(&window);
            
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
                        state.message = "All systems ready! API calls will go directly to ERP server.".to_string();
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
        match event {
            WindowEvent::CloseRequested => {
                event_loop.exit();
            }
            WindowEvent::KeyboardInput { event, .. } => {
                // F12 to toggle DevTools
                if event.state == winit::event::ElementState::Pressed {
                    if let winit::keyboard::Key::Named(winit::keyboard::NamedKey::F12) = event.logical_key {
                        if let Some(webview) = &self.webview {
                            println!("DevTools should be available via right-click or F12 in WebView2");
                            // DevTools are automatically available when with_devtools(true) is set
                        }
                    }
                }
            }
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
                
                // Override fetch to redirect ALL API calls directly to ERP server
                const originalFetch = window.fetch;
                window.fetch = function(url, options = {}) {
                    console.log('Fetch intercepted:', url, options);
                    
                    let newUrl = url;
                    
                    // Handle different URL formats for API calls
                    if (typeof url === 'string') {
                        // Case 1: Starts with /api
                        if (url.startsWith('/api')) {
                            newUrl = 'http://10.10.60.8:1669' + url;
                        }
                        // Case 2: Relative API calls (api/...)
                        else if (url.startsWith('api/')) {
                            newUrl = 'http://10.10.60.8:1669/' + url;
                        }
                        // Case 3: Full miko.app API URLs
                        else if (url.includes('miko.app/api/')) {
                            const apiPath = url.substring(url.indexOf('/api/'));
                            newUrl = 'http://10.10.60.8:1669' + apiPath;
                        }
                        
                        // If URL was changed, log the redirect
                        if (newUrl !== url) {
                            console.log('Redirecting API call from', url, 'to', newUrl);
                            
                            // Remove credentials for cross-origin requests to avoid CORS issues
                            const newOptions = { ...options };
                            if (newOptions.credentials === 'include') {
                                newOptions.credentials = 'omit';
                            }
                            
                            return originalFetch(newUrl, newOptions);
                        }
                    }
                    
                    return originalFetch(url, options);
                };

                console.log('Fetch override installed - ALL API calls will go directly to 10.10.60.8:1669');
                console.log('DevTools: Right-click and select "Inspect" or press F12');
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
        }

        let webview = webview_builder
            .with_devtools(true) // Enable DevTools for debugging
            .with_ipc_handler(move |request: http::Request<String>| {
                let body = request.body();
                
                // Try to parse as JSON for context menu coordinates
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(body) {
                    if let Some(action) = parsed.get("action").and_then(|v| v.as_str()) {
                        if action == "show_context_menu" {
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
                    }
                }
                
                // Handle other IPC messages
                handle_ipc_message(request, state_clone.clone());
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
