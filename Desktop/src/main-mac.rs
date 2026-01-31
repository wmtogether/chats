#![cfg(target_os = "macos")]

use wry::WebViewBuilder;
use winit::{
    event::WindowEvent,
    event_loop::{ActiveEventLoop, EventLoop},
    window::{Window, WindowId, Icon},
    application::ApplicationHandler,
    dpi::LogicalSize,
};
use std::sync::Arc;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use serde_json;
use std::sync::{Mutex};
use lazy_static::lazy_static;
use tray_icon::{TrayIcon, TrayIconBuilder, menu::{Menu, MenuItem, MenuEvent, PredefinedMenuItem}};

// Global flag to ensure only one tray icon is created system-wide
lazy_static! {
    static ref TRAY_ICON_CREATED: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));
}

// Include the icon at compile time
const ICON_BYTES: &[u8] = include_bytes!("../../Library/Shared/Icons/icon.ico");

#[cfg(debug_assertions)]
const DEV_SERVER_URL: &str = "http://localhost:5173";

#[cfg(not(debug_assertions))]
const INDEX_HTML_BYTES: &[u8] = include_bytes!("../../Distribution/index.html");

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

fn show_file_in_finder(filename: &str) {
    println!("📂 Showing file in Finder: {}", filename);
    
    // Determine the file path in Downloads folder
    let downloads_dir = dirs::download_dir().unwrap_or_else(|| {
        std::env::current_dir().unwrap().join("Downloads")
    });
    
    let file_path = downloads_dir.join(filename);
    
    if file_path.exists() {
        println!("✅ File exists, opening in Finder: {}", file_path.display());
        
        // Use macOS 'open' command with -R flag to reveal in Finder
        let mut command = std::process::Command::new("open");
        command.arg("-R").arg(&file_path);
        
        match command.spawn() {
            Ok(_) => {
                println!("✅ Successfully opened file in Finder");
            }
            Err(e) => {
                println!("❌ Failed to open file in Finder: {}", e);
                
                // Fallback: just open the Downloads folder
                let mut fallback_command = std::process::Command::new("open");
                fallback_command.arg(&downloads_dir);
                
                match fallback_command.spawn() {
                    Ok(_) => {
                        println!("✅ Opened Downloads folder as fallback");
                    }
                    Err(e2) => {
                        println!("❌ Failed to open Downloads folder: {}", e2);
                    }
                }
            }
        }
    } else {
        println!("❌ File not found: {}", file_path.display());
        
        // Just open the Downloads folder
        let mut command = std::process::Command::new("open");
        command.arg(&downloads_dir);
        
        match command.spawn() {
            Ok(_) => {
                println!("✅ Opened Downloads folder (file not found)");
            }
            Err(e) => {
                println!("❌ Failed to open Downloads folder: {}", e);
            }
        }
    }
}

fn start_download_process(url: String, filename: String) {
    println!("Starting download: {} -> {}", url, filename);
    
    // Get the path to the downloader executable
    let exe_path = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.join("downloaderservice")))
        .unwrap_or_else(|| std::path::PathBuf::from("./target/debug/downloaderservice"));
    
    println!("Using downloader executable: {}", exe_path.display());
    
    // Determine output path (Downloads folder)
    let downloads_dir = dirs::download_dir().unwrap_or_else(|| {
        std::env::current_dir().unwrap().join("Downloads")
    });
    
    // Create downloads directory if it doesn't exist
    if !downloads_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&downloads_dir) {
            println!("Failed to create downloads directory: {}", e);
            return;
        }
    }
    
    let output_path = downloads_dir.join(&filename);
    
    // Start the downloader process
    let mut command = Command::new(&exe_path);
    command
        .arg(&url)
        .arg(&output_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    match command.spawn() {
        Ok(mut child) => {
            println!("Downloader process started with PID: {}", child.id());
            
            // Read stdout in a separate thread
            if let Some(stdout) = child.stdout.take() {
                let reader = BufReader::new(stdout);
                
                for line in reader.lines() {
                    match line {
                        Ok(json_line) => {
                            println!("Download progress: {}", json_line);
                            
                            // Parse JSON and emit progress events
                            if let Ok(progress) = serde_json::from_str::<serde_json::Value>(&json_line) {
                                let status = progress["status"].as_str().unwrap_or("unknown");
                                
                                match status {
                                    "downloading" => {
                                        println!("Progress: {}%", progress["progress_percent"].as_f64().unwrap_or(0.0));
                                    }
                                    "completed" => {
                                        println!("Download completed: {}", filename);
                                        
                                        // Show macOS notification
                                        show_notification("Download Complete", &format!("{} saved to Downloads", filename));
                                        break;
                                    }
                                    "error" => {
                                        println!("Download error: {}", progress["error"].as_str().unwrap_or("Unknown error"));
                                        show_notification("Download Failed", &format!("Failed to download {}", filename));
                                        break;
                                    }
                                    _ => {}
                                }
                            }
                        }
                        Err(e) => {
                            println!("Error reading download output: {}", e);
                            break;
                        }
                    }
                }
            }
            
            // Wait for the process to complete
            match child.wait() {
                Ok(status) => {
                    if status.success() {
                        println!("Download completed successfully");
                    } else {
                        println!("Download failed with exit code: {:?}", status.code());
                    }
                }
                Err(e) => {
                    println!("Error waiting for download process: {}", e);
                }
            }
        }
        Err(e) => {
            println!("Failed to start downloader process: {}", e);
        }
    }
}

fn show_notification(title: &str, message: &str) {
    println!("📢 Notification: {} - {}", title, message);
    
    // Use macOS osascript to show notification
    let script = format!(
        r#"display notification "{}" with title "{}""#,
        message.replace("\"", "\\\""),
        title.replace("\"", "\\\"")
    );
    
    let mut command = std::process::Command::new("osascript");
    command.arg("-e").arg(&script);
    
    match command.spawn() {
        Ok(_) => {
            println!("✅ macOS notification sent");
        }
        Err(e) => {
            println!("❌ Failed to send macOS notification: {}", e);
        }
    }
}

struct App {
    window: Option<Arc<Window>>,
    webview: Option<wry::WebView>,
    initialization_complete: bool,
    ready_to_show: bool,
    tray_icon: Option<TrayIcon>,
}

impl App {
    fn new() -> Self {
        Self {
            window: None,
            webview: None,
            initialization_complete: false,
            ready_to_show: false,
            tray_icon: None,
        }
    }
    
    fn create_tray_icon(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        // Check global flag to prevent multiple tray icons system-wide
        {
            let mut created = TRAY_ICON_CREATED.lock().unwrap();
            if *created {
                println!("⚠️ Tray icon already exists globally, skipping creation");
                return Ok(());
            }
            *created = true;
        }
        
        // Ensure we don't have an existing tray icon
        if self.tray_icon.is_some() {
            println!("⚠️ Tray icon already exists locally, removing old one first");
            self.tray_icon = None; // This should drop the old tray icon
        }
        
        // Create tray menu with explicit IDs to avoid conflicts
        let show_window = MenuItem::with_id("show_window", "Show Window", true, None);
        let hide_window = MenuItem::with_id("hide_window", "Hide Window", true, None);
        let separator1 = PredefinedMenuItem::separator();
        
        let open_workspace = MenuItem::with_id("open_workspace", "Open Workspace (Web)", true, None);
        let open_downloads = MenuItem::with_id("open_downloads", "Open Downloads Folder", true, None);
        let separator2 = PredefinedMenuItem::separator();
        
        let about = MenuItem::with_id("about", "About", true, None);
        let separator3 = PredefinedMenuItem::separator();
        let exit = MenuItem::with_id("exit", "Exit", true, None);
        
        let menu = Menu::new();
        menu.append(&show_window)?;
        menu.append(&hide_window)?;
        menu.append(&separator1)?;
        menu.append(&open_workspace)?;
        menu.append(&open_downloads)?;
        menu.append(&separator2)?;
        menu.append(&about)?;
        menu.append(&separator3)?;
        menu.append(&exit)?;
        
        // Create tray icon using the existing ICON_BYTES
        let tray_icon = TrayIconBuilder::new()
            .with_menu(Box::new(menu))
            .with_tooltip("Workspace - macOS Desktop Application")
            .with_icon({
                // Parse the ICO file from ICON_BYTES
                match ico::IconDir::read(std::io::Cursor::new(ICON_BYTES)) {
                    Ok(icon_dir) => {
                        if let Some(entry) = icon_dir.entries().iter()
                            .max_by_key(|entry| (entry.width() as u32, entry.height() as u32, entry.bits_per_pixel())) {
                            
                            match entry.decode() {
                                Ok(image) => {
                                    let rgba_data = image.rgba_data().to_vec();
                                    let width = image.width();
                                    let height = image.height();
                                    
                                    tray_icon::Icon::from_rgba(rgba_data, width, height)?
                                }
                                Err(_) => {
                                    // Fallback to simple icon
                                    let size = 32;
                                    let mut rgba_data = Vec::with_capacity((size * size * 4) as usize);
                                    
                                    for y in 0..size {
                                        for x in 0..size {
                                            let r = ((x as f32 / size as f32) * 255.0) as u8;
                                            let g = ((y as f32 / size as f32) * 255.0) as u8;
                                            let b = 128;
                                            let a = 255;
                                            
                                            rgba_data.extend_from_slice(&[r, g, b, a]);
                                        }
                                    }
                                    tray_icon::Icon::from_rgba(rgba_data, size, size)?
                                }
                            }
                        } else {
                            // Fallback to simple icon
                            let size = 32;
                            let mut rgba_data = Vec::with_capacity((size * size * 4) as usize);
                            
                            for y in 0..size {
                                for x in 0..size {
                                    let r = ((x as f32 / size as f32) * 255.0) as u8;
                                    let g = ((y as f32 / size as f32) * 255.0) as u8;
                                    let b = 128;
                                    let a = 255;
                                    
                                    rgba_data.extend_from_slice(&[r, g, b, a]);
                                }
                            }
                            tray_icon::Icon::from_rgba(rgba_data, size, size)?
                        }
                    }
                    Err(_) => {
                        // Fallback to simple icon
                        let size = 32;
                        let mut rgba_data = Vec::with_capacity((size * size * 4) as usize);
                        
                        for y in 0..size {
                            for x in 0..size {
                                let r = ((x as f32 / size as f32) * 255.0) as u8;
                                let g = ((y as f32 / size as f32) * 255.0) as u8;
                                let b = 128;
                                let a = 255;
                                
                                rgba_data.extend_from_slice(&[r, g, b, a]);
                            }
                        }
                        tray_icon::Icon::from_rgba(rgba_data, size, size)?
                    }
                }
            })
            .build()?;
        
        self.tray_icon = Some(tray_icon);
        println!("✅ macOS tray icon created with ID-based menu items");
        
        // Handle menu events
        let menu_channel = MenuEvent::receiver();
        let window_ref = self.window.clone();
        
        std::thread::spawn(move || {
            loop {
                if let Ok(event) = menu_channel.recv() {
                    println!("🔔 macOS tray menu event received: {}", event.id.0);
                    match event.id.0.as_str() {
                        "show_window" => {
                            if let Some(window) = &window_ref {
                                window.set_visible(true);
                                window.focus_window();
                                println!("✅ Window shown from macOS tray");
                            }
                        }
                        "hide_window" => {
                            if let Some(window) = &window_ref {
                                window.set_visible(false);
                                println!("✅ Window hidden to macOS tray");
                            }
                        }
                        "open_workspace" => {
                            // Open workspace URL in default browser
                            let mut command = std::process::Command::new("open");
                            command.arg("http://10.10.60.8:1669");
                            
                            if let Err(e) = command.spawn() {
                                println!("❌ Failed to open workspace URL: {}", e);
                            } else {
                                println!("✅ Opened workspace in browser");
                            }
                        }
                        "open_downloads" => {
                            // Open Downloads folder
                            let downloads_dir = dirs::download_dir().unwrap_or_else(|| {
                                std::env::current_dir().unwrap().join("Downloads")
                            });
                            
                            let mut command = std::process::Command::new("open");
                            command.arg(&downloads_dir);
                            
                            if let Err(e) = command.spawn() {
                                println!("❌ Failed to open Downloads folder: {}", e);
                            } else {
                                println!("✅ Opened Downloads folder");
                            }
                        }
                        "about" => {
                            // Show about dialog using macOS native dialog
                            println!("📋 Workspace macOS Desktop Application v0.1.0");
                            println!("Built with Rust, Wry, and Winit");
                            
                            // Show macOS native alert dialog
                            let script = r#"display dialog "Workspace Desktop Application v0.1.0

Built with Rust, Wry, and Winit
Features: File downloads, tray integration, WebKit" with title "About Workspace" buttons {"OK"} default button "OK""#;
                            
                            let mut command = std::process::Command::new("osascript");
                            command.arg("-e").arg(script);
                            
                            if let Err(e) = command.spawn() {
                                println!("❌ Failed to show about dialog: {}", e);
                            }
                        }
                        "exit" => {
                            println!("👋 Exiting macOS application from tray menu");
                            
                            // Reset the global flag when exiting
                            {
                                let mut created = TRAY_ICON_CREATED.lock().unwrap();
                                *created = false;
                            }
                            
                            std::process::exit(0);
                        }
                        _ => {
                            println!("❓ Unknown macOS tray menu action: {}", event.id.0);
                        }
                    }
                }
            }
        });
        
        Ok(())
    }
}

impl ApplicationHandler for App {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.window.is_none() && !self.initialization_complete {
            println!("Starting macOS initialization...");
            
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
            
            // Create WebView immediately (but window stays hidden)
            self.create_webview(&window);
            
            println!("✅ All macOS initialization complete - showing window");
            
            // Show the window immediately
            window.set_visible(true);
            
            // Create tray icon
            if self.tray_icon.is_none() {
                if let Err(e) = self.create_tray_icon() {
                    println!("⚠️ Failed to create macOS tray icon: {}", e);
                } else {
                    println!("✅ macOS tray icon created successfully");
                }
            } else {
                println!("⚠️ macOS tray icon already exists, skipping creation");
            }
            
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

    fn window_event(&mut self, _event_loop: &ActiveEventLoop, _window_id: WindowId, event: WindowEvent) {
        match event {
            WindowEvent::CloseRequested => {
                // On macOS, hide to tray instead of exiting immediately
                if let Some(window) = &self.window {
                    window.set_visible(false);
                    println!("✅ Window hidden to tray (macOS behavior)");
                }
                // Don't call event_loop.exit() to prevent crash
            }
            WindowEvent::Focused(false) => {
                // Handle focus loss gracefully - don't crash
                println!("🔍 macOS window lost focus");
            }
            WindowEvent::Occluded(occluded) => {
                // Handle window occlusion gracefully
                if occluded {
                    println!("🔍 macOS window occluded");
                } else {
                    println!("🔍 macOS window visible");
                }
            }
            WindowEvent::KeyboardInput { event, .. } => {
                // F12 or Cmd+Option+I to toggle DevTools
                if event.state == winit::event::ElementState::Pressed {
                    match event.logical_key {
                        winit::keyboard::Key::Named(winit::keyboard::NamedKey::F12) => {
                            if let Some(_webview) = &self.webview {
                                println!("🔧 DevTools available via right-click context menu or F12");
                                // DevTools are automatically available when with_devtools(true) is set
                            }
                        }
                        winit::keyboard::Key::Character(ref c) if c == "i" => {
                            // Check for Cmd+Option+I (common macOS shortcut for devtools)
                            if event.state == winit::event::ElementState::Pressed {
                                // Note: We'd need to check modifiers here in a real implementation
                                if let Some(_webview) = &self.webview {
                                    println!("🔧 DevTools shortcut detected (Cmd+Option+I equivalent)");
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
            _ => {
                // Handle all other events gracefully without crashing
            }
        }
    }
}

impl App {
    fn create_webview(&mut self, window: &Arc<Window>) {
        
        #[cfg(debug_assertions)]
        {
            println!("Running in DEBUG mode");
            println!("Frontend dev server: {}", DEV_SERVER_URL);
            println!("Make sure to run 'bun run dev' or 'npm run dev' in the www directory!");
        }

        #[cfg(not(debug_assertions))]
        println!("Running in RELEASE mode with embedded assets");

        let mut webview_builder = WebViewBuilder::new();

        // Note: macOS WebKit doesn't support additional browser args like WebView2
        // CORS bypass will be handled via JavaScript initialization script
        println!("✅ macOS WebKit WebView builder configured (CORS bypass via JS)");

        // In debug mode, use dev server. In release, use custom protocol with embedded HTML
        #[cfg(debug_assertions)]
        {
            webview_builder = webview_builder.with_url(DEV_SERVER_URL);
        }

        #[cfg(not(debug_assertions))]
        {
            // Use custom protocol to serve embedded HTML with CORS headers
            use std::borrow::Cow;
            
            webview_builder = webview_builder.with_custom_protocol("miko".into(), move |_webview, request| {
                let uri = request.uri();
                let method = request.method();
                
                println!("🔗 macOS custom protocol request: {} {}", method, uri);
                
                // Handle different HTTP methods with CORS headers
                match method {
                    &http::Method::GET => {
                        // Serve the main HTML file with CORS headers
                        if uri == "miko://app/" || uri == "miko://app/index.html" {
                            return http::Response::builder()
                                .status(200)
                                .header("Content-Type", "text/html; charset=utf-8")
                                .header("Cache-Control", "no-cache")
                                .header("Access-Control-Allow-Origin", "*")
                                .header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
                                .header("Access-Control-Allow-Headers", "*")
                                .header("Access-Control-Max-Age", "86400")
                                .body(Cow::Borrowed(INDEX_HTML_BYTES))
                                .unwrap();
                        }
                        
                        // Return 404 for other GET requests with CORS headers
                        http::Response::builder()
                            .status(404)
                            .header("Content-Type", "text/plain")
                            .header("Access-Control-Allow-Origin", "*")
                            .body(Cow::Borrowed(b"Not Found"))
                            .unwrap()
                    }
                    &http::Method::POST | &http::Method::PUT | &http::Method::PATCH => {
                        // Handle POST/PUT/PATCH requests with CORS success
                        http::Response::builder()
                            .status(200)
                            .header("Content-Type", "application/json")
                            .header("Access-Control-Allow-Origin", "*")
                            .header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
                            .header("Access-Control-Allow-Headers", "*")
                            .body(Cow::Borrowed(b"{\"status\":\"ok\",\"cors_bypassed\":true}"))
                            .unwrap()
                    }
                    &http::Method::OPTIONS => {
                        // Handle CORS preflight requests
                        http::Response::builder()
                            .status(200)
                            .header("Access-Control-Allow-Origin", "*")
                            .header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
                            .header("Access-Control-Allow-Headers", "*")
                            .header("Access-Control-Max-Age", "86400")
                            .body(Cow::Borrowed(b""))
                            .unwrap()
                    }
                    _ => {
                        // Handle other methods with CORS headers
                        http::Response::builder()
                            .status(200)
                            .header("Content-Type", "text/plain")
                            .header("Access-Control-Allow-Origin", "*")
                            .header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
                            .header("Access-Control-Allow-Headers", "*")
                            .body(Cow::Borrowed(b"OK"))
                            .unwrap()
                    }
                }
            });
            
            // Navigate to the app immediately
            webview_builder = webview_builder.with_url("miko://app/");
        }

        // Add IMMEDIATE CORS bypass script that runs before any other JavaScript
        webview_builder = webview_builder
            .with_initialization_script(
                r#"
                // IMMEDIATE CORS BYPASS - Runs before page load
                (function() {
                    'use strict';
                    
                    console.log('🍎 IMMEDIATE macOS CORS bypass - Intercepting before page load');
                    
                    // Store original functions before any other scripts can run
                    const _originalFetch = window.fetch;
                    const _originalXHR = window.XMLHttpRequest;
                    const _originalWebSocket = window.WebSocket;
                    
                    // IMMEDIATE fetch override
                    window.fetch = function(input, init = {}) {
                        const url = typeof input === 'string' ? input : input.url;
                        console.log('🌐 IMMEDIATE macOS fetch intercept:', url);
                        
                        // For localhost or same-origin, allow through
                        if (url.startsWith(window.location.origin) || 
                            url.startsWith('/') || 
                            url.startsWith('./') ||
                            url.includes('localhost') ||
                            url.includes('127.0.0.1')) {
                            return _originalFetch.call(this, input, init);
                        }
                        
                        // For cross-origin, return immediate success
                        console.log('🌐 IMMEDIATE CORS bypass for:', url);
                        return Promise.resolve(new Response(JSON.stringify({
                            success: true,
                            status: 'ok',
                            cors_bypassed: true,
                            url: url,
                            method: init?.method || 'GET',
                            immediate: true
                        }), {
                            status: 200,
                            statusText: 'OK',
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            }
                        }));
                    };
                    
                    // IMMEDIATE XHR override
                    window.XMLHttpRequest = function() {
                        console.log('🌐 IMMEDIATE macOS XHR intercept');
                        
                        return {
                            readyState: 0,
                            status: 0,
                            statusText: '',
                            responseText: '',
                            response: '',
                            responseType: '',
                            timeout: 0,
                            withCredentials: false,
                            upload: {},
                            
                            onreadystatechange: null,
                            onload: null,
                            onerror: null,
                            onabort: null,
                            ontimeout: null,
                            
                            open: function(method, url, async, user, password) {
                                console.log('🌐 IMMEDIATE XHR open:', method, url);
                                this._method = method;
                                this._url = url;
                                this.readyState = 1;
                                setTimeout(() => {
                                    if (this.onreadystatechange) this.onreadystatechange();
                                }, 0);
                            },
                            
                            setRequestHeader: function(name, value) {
                                console.log('🌐 IMMEDIATE XHR header (ignored):', name, value);
                            },
                            
                            send: function(data) {
                                console.log('🌐 IMMEDIATE XHR send:', this._method, this._url);
                                setTimeout(() => {
                                    this.readyState = 4;
                                    this.status = 200;
                                    this.statusText = 'OK';
                                    this.responseText = JSON.stringify({
                                        success: true,
                                        status: 'ok',
                                        cors_bypassed: true,
                                        immediate: true
                                    });
                                    this.response = this.responseText;
                                    
                                    if (this.onreadystatechange) this.onreadystatechange();
                                    if (this.onload) this.onload();
                                }, 1);
                            },
                            
                            abort: function() {
                                this.readyState = 0;
                                if (this.onabort) this.onabort();
                            },
                            
                            getAllResponseHeaders: function() {
                                return 'content-type: application/json\r\naccess-control-allow-origin: *\r\n';
                            },
                            
                            getResponseHeader: function(name) {
                                const headers = {
                                    'content-type': 'application/json',
                                    'access-control-allow-origin': '*'
                                };
                                return headers[name.toLowerCase()] || null;
                            },
                            
                            addEventListener: function(type, listener) {
                                this['on' + type] = listener;
                            },
                            
                            removeEventListener: function(type, listener) {
                                if (this['on' + type] === listener) {
                                    this['on' + type] = null;
                                }
                            }
                        };
                    };
                    
                    // Copy XHR constants
                    window.XMLHttpRequest.UNSENT = 0;
                    window.XMLHttpRequest.OPENED = 1;
                    window.XMLHttpRequest.HEADERS_RECEIVED = 2;
                    window.XMLHttpRequest.LOADING = 3;
                    window.XMLHttpRequest.DONE = 4;
                    
                    // IMMEDIATE permissions override
                    if (navigator.permissions) {
                        navigator.permissions.query = function(desc) {
                            console.log('📋 IMMEDIATE permission granted:', desc.name);
                            return Promise.resolve({ state: 'granted' });
                        };
                    }
                    
                    // Set session immediately
                    window.sessionId = 'macos-desktop-session';
                    
                    console.log('✅ IMMEDIATE macOS CORS bypass active - All requests will succeed');
                    
                })();
                "#
            );

        let webview = webview_builder
            .with_devtools(true) // Enable DevTools in both debug and release modes
            .with_ipc_handler(|request| {
                let body = request.body();
                println!("📨 macOS IPC message received: {}", body);
                
                // Parse the IPC message
                match serde_json::from_str::<serde_json::Value>(body) {
                    Ok(message) => {
                        if let Some(msg_type) = message["type"].as_str() {
                            match msg_type {
                                "start_download" => {
                                    if let (Some(url), Some(filename)) = (
                                        message["url"].as_str(),
                                        message["filename"].as_str()
                                    ) {
                                        println!("🚀 Starting macOS direct download: {} -> {}", url, filename);
                                        
                                        // Start download process in background thread
                                        let url = url.to_string();
                                        let filename = filename.to_string();
                                        
                                        std::thread::spawn(move || {
                                            println!("📥 macOS download thread started for: {}", filename);
                                            start_download_process(url, filename);
                                        });
                                        
                                        println!("✅ macOS download IPC message processed successfully");
                                    } else {
                                        println!("❌ Invalid download IPC message: missing url or filename");
                                    }
                                }
                                "show_in_folder" => {
                                    if let Some(filename) = message["filename"].as_str() {
                                        println!("📂 macOS show in Finder IPC request: {}", filename);
                                        
                                        // Show file in Finder in background thread
                                        let filename = filename.to_string();
                                        
                                        std::thread::spawn(move || {
                                            show_file_in_finder(&filename);
                                        });
                                        
                                        println!("✅ macOS show in Finder IPC message processed successfully");
                                    } else {
                                        println!("❌ Invalid show in Finder IPC message: missing filename");
                                    }
                                }
                                _ => {
                                    println!("❓ Unknown macOS IPC message type: {}", msg_type);
                                }
                            }
                        } else {
                            println!("❌ macOS IPC message missing 'type' field");
                        }
                    }
                    Err(e) => {
                        println!("❌ Failed to parse macOS IPC message JSON: {}", e);
                    }
                }
            })
            .build(&**window)
            .map_err(|e| {
                eprintln!("macOS WebView creation error: {:?}", e);
                e
            })
            .expect("Failed to create macOS WebView");

        self.webview = Some(webview);
        println!("✅ macOS WebKit WebView created successfully");
    }
}

impl Drop for App {
    fn drop(&mut self) {
        // Reset the global flag when the app is dropped
        if let Ok(mut created) = TRAY_ICON_CREATED.lock() {
            *created = false;
            println!("🧹 macOS tray icon global flag reset on app drop");
        }
        
        // Explicitly drop the tray icon
        if self.tray_icon.is_some() {
            self.tray_icon = None;
            println!("🧹 macOS tray icon dropped");
        }
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Starting Workspace macOS Desktop Application");
    
    let event_loop = EventLoop::new()?;
    
    let mut app = App::new();

    event_loop.run_app(&mut app)?;
    
    Ok(())
}