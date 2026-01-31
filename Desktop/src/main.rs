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
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use serde_json;
use tray_icon::{TrayIcon, TrayIconBuilder, menu::{Menu, MenuItem, MenuEvent, PredefinedMenuItem}};
use std::sync::{Mutex};
use lazy_static::lazy_static;

#[cfg(windows)]
use winreg::enums::*;
#[cfg(windows)]
use winreg::RegKey;

// Global flag to ensure only one tray icon is created system-wide
lazy_static! {
    static ref TRAY_ICON_CREATED: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));
}

mod context_menu;
mod menubar;
mod hooks;

use menubar::{MenuBar, apply_modern_menu_theme, enable_window_animations};
use hooks::{init_notifications, init_redis, connect_redis, show_notification};

// Include the icon at compile time
const ICON_BYTES: &[u8] = include_bytes!("../../Library/Shared/Icons/icon.ico");

#[cfg(windows)]
fn configure_webview2_permissions() -> Result<(), Box<dyn std::error::Error>> {
    use winreg::enums::*;
    use winreg::RegKey;
    
    println!("🔧 Configuring WebView2 permissions in registry...");
    
    // Try to set permissions for the current user
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    
    // Create/open the WebView2 permissions key
    let webview2_key_path = r"SOFTWARE\Microsoft\Edge\WebView2\Settings";
    
    match hkcu.create_subkey(webview2_key_path) {
        Ok((webview2_key, _)) => {
            // Set clipboard permissions to always allow
            if let Err(e) = webview2_key.set_value("ClipboardReadWritePermission", &1u32) {
                println!("⚠️ Failed to set clipboard permission: {}", e);
            } else {
                println!("✅ Clipboard permission set to always allow");
            }
            
            // Disable permission prompts
            if let Err(e) = webview2_key.set_value("DisablePermissionPrompts", &1u32) {
                println!("⚠️ Failed to disable permission prompts: {}", e);
            } else {
                println!("✅ Permission prompts disabled");
            }
            
            // Set default permissions to granted
            if let Err(e) = webview2_key.set_value("DefaultPermissionState", &"granted") {
                println!("⚠️ Failed to set default permission state: {}", e);
            } else {
                println!("✅ Default permission state set to granted");
            }
            
            // Disable security warnings
            if let Err(e) = webview2_key.set_value("DisableSecurityWarnings", &1u32) {
                println!("⚠️ Failed to disable security warnings: {}", e);
            } else {
                println!("✅ Security warnings disabled");
            }
            
            println!("✅ WebView2 permissions configured successfully");
        }
        Err(e) => {
            println!("⚠️ Failed to create WebView2 registry key: {}", e);
            println!("   This is normal if running without admin privileges");
        }
    }
    
    // Also try to set permissions for the specific application
    let app_key_path = r"SOFTWARE\Microsoft\Edge\WebView2\Applications\MikoWorkspace";
    
    match hkcu.create_subkey(app_key_path) {
        Ok((app_key, _)) => {
            // Set clipboard permissions for this specific app
            if let Err(e) = app_key.set_value("clipboard", &"allow") {
                println!("⚠️ Failed to set app-specific clipboard permission: {}", e);
            } else {
                println!("✅ App-specific clipboard permission set");
            }
            
            // Set all permissions to allow for this app
            let permissions = ["clipboard-read", "clipboard-write", "clipboard"];
            for permission in &permissions {
                if let Err(e) = app_key.set_value(permission, &"allow") {
                    println!("⚠️ Failed to set {} permission: {}", permission, e);
                } else {
                    println!("✅ {} permission set to allow", permission);
                }
            }
        }
        Err(e) => {
            println!("⚠️ Failed to create app-specific registry key: {}", e);
        }
    }
    
    Ok(())
}

#[cfg(not(windows))]
fn configure_webview2_permissions() -> Result<(), Box<dyn std::error::Error>> {
    println!("⚠️ WebView2 permission configuration only available on Windows");
    Ok(())
}

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



fn show_file_in_explorer(filename: &str) {
    println!("📂 Showing file in Windows Explorer: {}", filename);
    
    // Determine the file path in Downloads folder
    let downloads_dir = dirs::download_dir().unwrap_or_else(|| {
        std::env::current_dir().unwrap().join("Downloads")
    });
    
    let file_path = downloads_dir.join(filename);
    
    if file_path.exists() {
        println!("✅ File exists, opening in Explorer: {}", file_path.display());
        
        // Use Windows Explorer with /select parameter to highlight the file
        let mut command = std::process::Command::new("explorer");
        command.arg("/select,").arg(&file_path);
        
        // Hide the console window on Windows
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            command.creation_flags(CREATE_NO_WINDOW);
        }
        
        match command.spawn() {
            Ok(_) => {
                println!("✅ Successfully opened file in Explorer");
            }
            Err(e) => {
                println!("❌ Failed to open file in Explorer: {}", e);
                
                // Fallback: just open the Downloads folder
                let mut fallback_command = std::process::Command::new("explorer");
                fallback_command.arg(&downloads_dir);
                
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    const CREATE_NO_WINDOW: u32 = 0x08000000;
                    fallback_command.creation_flags(CREATE_NO_WINDOW);
                }
                
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
        let mut command = std::process::Command::new("explorer");
        command.arg(&downloads_dir);
        
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            command.creation_flags(CREATE_NO_WINDOW);
        }
        
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
        .and_then(|exe| exe.parent().map(|p| p.join("downloaderservice.exe")))
        .unwrap_or_else(|| std::path::PathBuf::from("./target/debug/downloaderservice.exe"));
    
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
    
    // Start the downloader process with hidden window
    let mut command = Command::new(&exe_path);
    command
        .arg(&url)
        .arg(&output_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    // Hide the console window on Windows
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    
    match command.spawn() {
        Ok(mut child) => {
            println!("Downloader process started with PID: {} (hidden window)", child.id());
            
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
                                        // Emit progress event to webview
                                        // Note: In a real implementation, you'd need to store the webview reference
                                        // and emit events to it. For now, we just log.
                                        println!("Progress: {}%", progress["progress_percent"].as_f64().unwrap_or(0.0));
                                    }
                                    "completed" => {
                                        println!("Download completed: {}", filename);
                                        break;
                                    }
                                    "error" => {
                                        println!("Download error: {}", progress["error"].as_str().unwrap_or("Unknown error"));
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

struct App {
    window: Option<Arc<Window>>,
    webview: Option<wry::WebView>,
    initialization_complete: bool,
    ready_to_show: bool,
    native_menubar: Option<MenuBar>,
    tray_icon: Option<TrayIcon>,
}

impl App {
    fn new() -> Self {
        Self {
            window: None,
            webview: None,
            initialization_complete: false,
            ready_to_show: false,
            native_menubar: None,
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
            .with_tooltip("Workspace - Desktop Application")
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
        println!("✅ Single tray icon created with ID-based menu items (globally unique)");
        
        // Handle menu events
        let menu_channel = MenuEvent::receiver();
        let window_ref = self.window.clone();
        
        std::thread::spawn(move || {
            loop {
                if let Ok(event) = menu_channel.recv() {
                    println!("🔔 Tray menu event received: {}", event.id.0);
                    match event.id.0.as_str() {
                        "show_window" => {
                            if let Some(window) = &window_ref {
                                window.set_visible(true);
                                window.focus_window();
                                println!("✅ Window shown from tray");
                            }
                        }
                        "hide_window" => {
                            if let Some(window) = &window_ref {
                                window.set_visible(false);
                                println!("✅ Window hidden to tray");
                            }
                        }
                        "open_workspace" => {
                            // Open workspace URL in default browser with hidden window
                            let mut command = std::process::Command::new("cmd");
                            command.args(&["/c", "start", "http://10.10.60.8:1669"]);
                            
                            #[cfg(windows)]
                            {
                                use std::os::windows::process::CommandExt;
                                const CREATE_NO_WINDOW: u32 = 0x08000000;
                                command.creation_flags(CREATE_NO_WINDOW);
                            }
                            
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
                            
                            let mut command = std::process::Command::new("explorer");
                            command.arg(&downloads_dir);
                            
                            #[cfg(windows)]
                            {
                                use std::os::windows::process::CommandExt;
                                const CREATE_NO_WINDOW: u32 = 0x08000000;
                                command.creation_flags(CREATE_NO_WINDOW);
                            }
                            
                            if let Err(e) = command.spawn() {
                                println!("❌ Failed to open Downloads folder: {}", e);
                            } else {
                                println!("✅ Opened Downloads folder");
                            }
                        }
                        "about" => {
                            // Show about dialog (you could implement a proper dialog here)
                            println!("📋 Workspace Desktop Application v0.1.0");
                            println!("Built with Rust, Wry, and Winit");
                            
                            // For now, just show a Windows message box
                            #[cfg(windows)]
                            {
                                use windows::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_OK, MB_ICONINFORMATION};
                                use windows::Win32::Foundation::HWND;
                                use std::ffi::OsStr;
                                use std::os::windows::ffi::OsStrExt;
                                
                                let title: Vec<u16> = OsStr::new("About Workspace")
                                    .encode_wide()
                                    .chain(std::iter::once(0))
                                    .collect();
                                
                                let message: Vec<u16> = OsStr::new("Workspace Desktop Application v0.1.0\n\nBuilt with Rust, Wry, and Winit\nFeatures: File downloads, tray integration, WebView2")
                                    .encode_wide()
                                    .chain(std::iter::once(0))
                                    .collect();
                                
                                unsafe {
                                    MessageBoxW(
                                        HWND::default(),
                                        windows::core::PCWSTR(message.as_ptr()),
                                        windows::core::PCWSTR(title.as_ptr()),
                                        MB_OK | MB_ICONINFORMATION
                                    );
                                }
                            }
                        }
                        "exit" => {
                            println!("👋 Exiting application from tray menu");
                            
                            // Reset the global flag when exiting
                            {
                                let mut created = TRAY_ICON_CREATED.lock().unwrap();
                                *created = false;
                            }
                            
                            std::process::exit(0);
                        }
                        _ => {
                            println!("❓ Unknown tray menu action: {}", event.id.0);
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
            
            // Initialize notifications
            #[cfg(windows)]
            {
                use windows::Win32::Foundation::HWND;
                use winit::raw_window_handle::{HasWindowHandle, RawWindowHandle};
                
                match window.window_handle().unwrap().as_raw() {
                    RawWindowHandle::Win32(handle) => {
                        let hwnd = HWND(handle.hwnd.get() as *mut std::ffi::c_void);
                        init_notifications(hwnd);
                        println!("✅ Notifications initialized");
                    }
                    _ => println!("⚠️ Non-Win32 window handle, notifications not initialized"),
                }
            }
            

            
            // Initialize Redis
            match init_redis() {
                Ok(_) => {
                    println!("✅ Redis manager initialized");
                    
                    // Connect to Redis synchronously
                    match connect_redis() {
                        Ok(_) => {
                            println!("✅ Redis connected successfully");
                            
                            // Show connection notification
                            if let Err(e) = show_notification("Miko Workspace", "Connected to real-time messaging") {
                                println!("⚠️ Failed to show notification: {}", e);
                            }
                        }
                        Err(e) => {
                            println!("❌ Failed to connect to Redis: {}", e);
                        }
                    }
                }
                Err(e) => {
                    println!("❌ Failed to initialize Redis: {}", e);
                }
            }
            
            
            println!("✅ All initialization complete - showing window");
            
            // Show the window immediately
            window.set_visible(true);
            
            // Create tray icon
            if self.tray_icon.is_none() {
                if let Err(e) = self.create_tray_icon() {
                    println!("⚠️ Failed to create tray icon: {}", e);
                } else {
                    println!("✅ Tray icon created successfully");
                }
            } else {
                println!("⚠️ Tray icon already exists, skipping creation");
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

    fn window_event(&mut self, event_loop: &ActiveEventLoop, _window_id: WindowId, event: WindowEvent) {
        
        match event {
            WindowEvent::CloseRequested => {
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
        
        #[cfg(debug_assertions)]
        {
            println!("Running in DEBUG mode");
            println!("Frontend dev server: {}", DEV_SERVER_URL);
            println!("Make sure to run 'bun run dev' or 'npm run dev' in the www directory!");
        }

        #[cfg(not(debug_assertions))]
        println!("Running in RELEASE mode with embedded assets");

        let mut webview_builder = WebViewBuilder::new();

        // Configure WebView2 runtime path using environment variables
        #[cfg(windows)]
        {
            // In release builds, use the bundled WebView2 runtime
            #[cfg(not(debug_assertions))]
            {
                let app_dir = std::env::current_exe()
                    .ok()
                    .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
                    .unwrap_or_else(|| std::env::current_dir().unwrap());
                
                // Check if msedgewebview2.exe exists in the app directory (bundled runtime)
                let webview2_exe = app_dir.join("msedgewebview2.exe");
                
                if webview2_exe.exists() {
                    println!("Using bundled WebView2 runtime at: {}", app_dir.display());
                    // Set environment variable to use the bundled WebView2 runtime
                    std::env::set_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", &app_dir);
                } else {
                    println!("Bundled WebView2 runtime not found, falling back to system WebView2");
                }
            }
            
            // In debug builds, use global WebView2 for development
            #[cfg(debug_assertions)]
            {
                println!("Development mode: Using global WebView2 runtime");
                // Remove any custom WebView2 path for development
                std::env::remove_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER");
            }
            
            // Set WebView2 user data folder to ensure consistent permissions
            let user_data_dir = std::env::temp_dir().join("MikoWorkspace_WebView2");
            std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", &user_data_dir);
            println!("WebView2 user data folder: {}", user_data_dir.display());
            
            // Configure WebView2 permissions in registry
            if let Err(e) = configure_webview2_permissions() {
                println!("⚠️ Failed to configure WebView2 permissions: {}", e);
            }
            
            // Set environment variables to disable permission prompts
            std::env::set_var("WEBVIEW2_DISABLE_PERMISSION_PROMPTS", "1");
            std::env::set_var("WEBVIEW2_AUTO_GRANT_PERMISSIONS", "1");
            std::env::set_var("WEBVIEW2_CLIPBOARD_PERMISSION", "granted");
            std::env::set_var("WEBVIEW2_DEFAULT_PERMISSION_STATE", "granted");
            
            // Add WebView2 arguments to disable CORS and web security, and enable clipboard access
            webview_builder = webview_builder
                .with_additional_browser_args("--disable-web-security --disable-features=VizDisplayCompositor --allow-running-insecure-content --disable-site-isolation-trials --enable-clipboard-api --disable-permissions-api --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-features=msWebOOUI,msPdfOOUI --enable-features=msEdgeEnableClipboardAPI --disable-permission-request-handling --disable-prompt-on-repost --disable-default-apps --disable-extensions --disable-plugins --disable-popup-blocking --disable-translate --disable-background-networking --disable-sync --disable-speech-api --disable-file-system --disable-presentation-api --disable-permissions-api --disable-notifications --disable-desktop-notifications --disable-geolocation --disable-media-stream --disable-camera --disable-microphone --disable-usb --disable-bluetooth --disable-sensors --disable-midi --disable-payment-request --disable-background-sync --disable-push-messaging --disable-wake-lock --disable-screen-wake-lock --disable-idle-detection --disable-web-bluetooth --disable-web-usb --disable-web-serial --disable-web-hid --disable-web-nfc --disable-ambient-light-sensor --disable-accelerometer --disable-gyroscope --disable-magnetometer --disable-device-motion --disable-device-orientation --disable-gamepad --disable-vr --disable-xr --disable-webgl --disable-webgl2 --disable-webgpu --disable-webrtc --disable-media-devices --disable-clipboard-read-write-permissions --disable-clipboard-sanitized-write --enable-unsafe-webgpu --allow-clipboard-read-write --disable-features=PermissionsAPI,PermissionsPolicyAPI --enable-features=ClipboardAPI,AsyncClipboardAPI --disable-blink-features=PermissionsAPI --enable-blink-features=ClipboardAPI,AsyncClipboardAPI");
        }

        // In debug mode, use dev server. In release, use custom protocol with embedded HTML
        #[cfg(debug_assertions)]
        {
            webview_builder = webview_builder.with_url(DEV_SERVER_URL);
        }

        #[cfg(not(debug_assertions))]
        {
            // Use custom protocol to serve embedded HTML
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

        // Add comprehensive initialization script with clipboard permissions override
        webview_builder = webview_builder
            .with_initialization_script(
                r#"
                console.log('WebView initialized - Direct download mode (no CORS/fetch)');
                window.sessionId = 'desktop-session';
                
                // Completely override permissions API to always grant clipboard access
                if (navigator.permissions) {
                    // Override the entire permissions object
                    Object.defineProperty(navigator, 'permissions', {
                        value: {
                            query: function(permissionDesc) {
                                console.log('📋 Permission query intercepted:', permissionDesc.name);
                                if (permissionDesc.name === 'clipboard-read' || 
                                    permissionDesc.name === 'clipboard-write' ||
                                    permissionDesc.name === 'clipboard') {
                                    console.log('📋 Auto-granting clipboard permission');
                                    return Promise.resolve({ 
                                        state: 'granted',
                                        onchange: null,
                                        addEventListener: function() {},
                                        removeEventListener: function() {},
                                        dispatchEvent: function() { return true; }
                                    });
                                }
                                // For other permissions, return granted to avoid dialogs
                                return Promise.resolve({ 
                                    state: 'granted',
                                    onchange: null,
                                    addEventListener: function() {},
                                    removeEventListener: function() {},
                                    dispatchEvent: function() { return true; }
                                });
                            }
                        },
                        writable: false,
                        configurable: false
                    });
                }
                
                // Override Permissions API constructor if it exists
                if (window.Permissions) {
                    window.Permissions.prototype.query = function(permissionDesc) {
                        console.log('📋 Permissions.prototype.query intercepted:', permissionDesc.name);
                        return Promise.resolve({ state: 'granted' });
                    };
                }
                
                // Ensure clipboard API is available and functional
                if (!navigator.clipboard) {
                    console.warn('Clipboard API not available, creating enhanced fallback');
                    Object.defineProperty(navigator, 'clipboard', {
                        value: {
                            read: function() {
                                console.log('📋 Clipboard read (fallback)');
                                return Promise.resolve([]);
                            },
                            readText: function() {
                                console.log('📋 Clipboard readText (fallback)');
                                return Promise.resolve('');
                            },
                            write: function(data) {
                                console.log('📋 Clipboard write (fallback)');
                                return Promise.resolve();
                            },
                            writeText: function(text) {
                                console.log('📋 Clipboard writeText (fallback)');
                                return Promise.resolve();
                            }
                        },
                        writable: false,
                        configurable: false
                    });
                } else {
                    console.log('✅ Native Clipboard API is available');
                    
                    // Wrap existing clipboard methods to prevent permission prompts
                    const originalRead = navigator.clipboard.read;
                    const originalReadText = navigator.clipboard.readText;
                    const originalWrite = navigator.clipboard.write;
                    const originalWriteText = navigator.clipboard.writeText;
                    
                    if (originalRead) {
                        navigator.clipboard.read = function() {
                            console.log('📋 Clipboard read requested (auto-granted)');
                            return originalRead.call(this).catch(err => {
                                console.warn('Clipboard read failed, returning empty:', err);
                                return [];
                            });
                        };
                    }
                    
                    if (originalReadText) {
                        navigator.clipboard.readText = function() {
                            console.log('📋 Clipboard readText requested (auto-granted)');
                            return originalReadText.call(this).catch(err => {
                                console.warn('Clipboard readText failed, returning empty:', err);
                                return '';
                            });
                        };
                    }
                    
                    if (originalWrite) {
                        navigator.clipboard.write = function(data) {
                            console.log('📋 Clipboard write requested (auto-granted)');
                            return originalWrite.call(this, data).catch(err => {
                                console.warn('Clipboard write failed:', err);
                                return Promise.resolve();
                            });
                        };
                    }
                    
                    if (originalWriteText) {
                        navigator.clipboard.writeText = function(text) {
                            console.log('📋 Clipboard writeText requested (auto-granted)');
                            return originalWriteText.call(this, text).catch(err => {
                                console.warn('Clipboard writeText failed:', err);
                                return Promise.resolve();
                            });
                        };
                    }
                }
                
                // Override any permission request dialogs
                if (window.Notification && window.Notification.requestPermission) {
                    window.Notification.requestPermission = function() {
                        console.log('📋 Notification permission auto-granted');
                        return Promise.resolve('granted');
                    };
                }
                
                // Prevent any permission-related dialogs from showing
                const originalAlert = window.alert;
                const originalConfirm = window.confirm;
                const originalPrompt = window.prompt;
                
                window.alert = function(message) {
                    if (message && message.toLowerCase().includes('clipboard')) {
                        console.log('📋 Clipboard alert blocked:', message);
                        return;
                    }
                    return originalAlert.call(this, message);
                };
                
                window.confirm = function(message) {
                    if (message && message.toLowerCase().includes('clipboard')) {
                        console.log('📋 Clipboard confirm auto-accepted:', message);
                        return true;
                    }
                    return originalConfirm.call(this, message);
                };
                
                window.prompt = function(message, defaultText) {
                    if (message && message.toLowerCase().includes('clipboard')) {
                        console.log('📋 Clipboard prompt auto-accepted:', message);
                        return defaultText || '';
                    }
                    return originalPrompt.call(this, message, defaultText);
                };
                
                // Direct IPC download API - bypasses all web requests
                window.downloadAPI = {
                    startDownload: function(url, filename) {
                        return new Promise((resolve, reject) => {
                            try {
                                console.log('Sending direct IPC download request:', url, '->', filename);
                                
                                // Create IPC message for Rust backend
                                const message = JSON.stringify({
                                    type: 'start_download',
                                    url: url,
                                    filename: filename,
                                    timestamp: Date.now()
                                });
                                
                                // Send IPC message directly to Rust (no web requests)
                                window.ipc.postMessage(message);
                                
                                // Return success immediately since IPC is fire-and-forget
                                resolve({ 
                                    success: true, 
                                    message: 'Download request sent to native backend' 
                                });
                                
                            } catch (error) {
                                console.error('IPC download error:', error);
                                reject(error);
                            }
                        });
                    },
                    
                    showInFolder: function(filename) {
                        return new Promise((resolve, reject) => {
                            try {
                                console.log('Sending show in folder IPC request:', filename);
                                
                                // Create IPC message for Rust backend
                                const message = JSON.stringify({
                                    type: 'show_in_folder',
                                    filename: filename,
                                    timestamp: Date.now()
                                });
                                
                                // Send IPC message directly to Rust
                                window.ipc.postMessage(message);
                                
                                resolve({ 
                                    success: true, 
                                    message: 'Show in folder request sent' 
                                });
                                
                            } catch (error) {
                                console.error('IPC show in folder error:', error);
                                reject(error);
                            }
                        });
                    }
                };
                
                console.log('Session ID set:', window.sessionId);
                console.log('Direct download API initialized (no web requests)');
                console.log('📋 Clipboard permissions completely overridden (no dialogs)');
                console.log('✅ All permission dialogs disabled and auto-granted');
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
            .with_ipc_handler(|request| {
                let body = request.body();
                println!("📨 IPC message received: {}", body);
                
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
                                        println!("🚀 Starting direct download (no web requests): {} -> {}", url, filename);
                                        
                                        // Start download process in background thread
                                        let url = url.to_string();
                                        let filename = filename.to_string();
                                        
                                        std::thread::spawn(move || {
                                            println!("📥 Download thread started for: {}", filename);
                                            start_download_process(url, filename);
                                        });
                                        
                                        println!("✅ Download IPC message processed successfully");
                                    } else {
                                        println!("❌ Invalid download IPC message: missing url or filename");
                                    }
                                }
                                "show_in_folder" => {
                                    if let Some(filename) = message["filename"].as_str() {
                                        println!("📂 Show in folder IPC request: {}", filename);
                                        
                                        // Show file in Windows Explorer in background thread
                                        let filename = filename.to_string();
                                        
                                        std::thread::spawn(move || {
                                            show_file_in_explorer(&filename);
                                        });
                                        
                                        println!("✅ Show in folder IPC message processed successfully");
                                    } else {
                                        println!("❌ Invalid show in folder IPC message: missing filename");
                                    }
                                }
                                _ => {
                                    println!("❓ Unknown IPC message type: {}", msg_type);
                                }
                            }
                        } else {
                            println!("❌ IPC message missing 'type' field");
                        }
                    }
                    Err(e) => {
                        println!("❌ Failed to parse IPC message JSON: {}", e);
                    }
                }
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

impl Drop for App {
    fn drop(&mut self) {
        // Reset the global flag when the app is dropped
        if let Ok(mut created) = TRAY_ICON_CREATED.lock() {
            *created = false;
            println!("🧹 Tray icon global flag reset on app drop");
        }
        
        // Explicitly drop the tray icon
        if self.tray_icon.is_some() {
            self.tray_icon = None;
            println!("🧹 Tray icon dropped");
        }
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Starting Workspace Desktop Application");
    
    let event_loop = EventLoop::new()?;
    
    let mut app = App::new();

    event_loop.run_app(&mut app)?;
    
    Ok(())
}
