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
use serde_json;
use tray_icon::TrayIcon;
use std::sync::Mutex;
use lazy_static::lazy_static;
use std::sync::mpsc::{channel, Receiver, Sender};

pub mod utils;
pub mod download;
pub mod tray;
pub mod hooks;

// Global flag to ensure only one tray icon is created system-wide
lazy_static! {
    pub static ref TRAY_ICON_CREATED: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));
    pub static ref PROGRESS_SENDER: Arc<Mutex<Option<Sender<String>>>> = Arc::new(Mutex::new(None));
}

use crate::{context_menu, menubar, hooks as app_hooks};
use menubar::{MenuBar, apply_modern_menu_theme, enable_window_animations};
use app_hooks::{init_notifications, show_notification};

// Include the icon at compile time
pub const ICON_BYTES: &[u8] = include_bytes!("../../../../Library/Shared/Icons/icon.ico");

#[cfg(debug_assertions)]
const DEV_SERVER_URL: &str = "http://localhost:5173";

#[cfg(not(debug_assertions))]
const INDEX_HTML_BYTES: &[u8] = include_bytes!("../../../../Distribution/index.html");

struct App {
    window: Option<Arc<Window>>,
    webview: Option<wry::WebView>,
    initialization_complete: bool,
    ready_to_show: bool,
    native_menubar: Option<MenuBar>,
    tray_icon: Option<TrayIcon>,
    progress_receiver: Option<Receiver<String>>,
}

impl App {
    fn new() -> Self {
        // Create channel for download progress
        let (sender, receiver) = channel();
        
        // Store sender globally
        {
            let mut global_sender = PROGRESS_SENDER.lock().unwrap();
            *global_sender = Some(sender);
        }
        
        Self {
            window: None,
            webview: None,
            initialization_complete: false,
            ready_to_show: false,
            native_menubar: None,
            tray_icon: None,
            progress_receiver: Some(receiver),
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
            if let Some(icon) = utils::load_window_icon() {
                window_attributes = window_attributes.with_window_icon(Some(icon));
            }
            
            let window = Arc::new(event_loop.create_window(window_attributes).unwrap());
            self.window = Some(window.clone());
            
            // Create WebView2 immediately (but window stays hidden)
            self.create_webview(&window);
            
            // Initialize notifications
            if let Err(e) = init_notifications() {
                println!("⚠️ Failed to initialize notifications: {}", e);
            }
            
            println!("✅ All initialization complete - showing window");
            
            // Show the window immediately
            window.set_visible(true);
            
            // Create tray icon
            if self.tray_icon.is_none() {
                match tray::create_tray_icon(self.window.clone()) {
                    Ok(tray) => {
                        self.tray_icon = Some(tray);
                        println!("✅ Tray icon created successfully");
                    }
                    Err(e) => println!("⚠️ Failed to create tray icon: {}", e),
                }
            }
            
            self.initialization_complete = true;
        }
    }

    fn window_event(&mut self, event_loop: &ActiveEventLoop, _window_id: WindowId, event: WindowEvent) {
        // Poll for download progress updates
        if let Some(receiver) = &self.progress_receiver {
            while let Ok(progress_json) = receiver.try_recv() {
                if let Some(webview) = &self.webview {
                    let escaped_json = progress_json.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n");
                    let script = format!(
                        r#"
                        (function() {{
                            try {{
                                const progressData = JSON.parse("{}");
                                if (typeof window.downloadProgressCallback === 'function') {{
                                    window.downloadProgressCallback(progressData);
                                }} else {{
                                    window.dispatchEvent(new CustomEvent('download-progress', {{ detail: progressData }}));
                                }}
                            }} catch (e) {{
                                console.error('❌ Error processing download progress:', e);
                            }}
                        }})();
                        "#,
                        escaped_json
                    );
                    let _ = webview.evaluate_script(&script);
                }
            }
        }
        
        // Check for pending menu commands
        if let Some(command_id) = menubar::get_and_clear_pending_menu_command() {
            if let Some(action) = menubar::get_menu_action(command_id) {
                #[cfg(windows)]
                {
                    use windows::Win32::Foundation::HWND;
                    use winit::raw_window_handle::{HasWindowHandle, RawWindowHandle};
                    
                    if let Some(window) = &self.window {
                        match window.window_handle().unwrap().as_raw() {
                            RawWindowHandle::Win32(handle) => {
                                let hwnd = HWND(handle.hwnd.get() as *mut std::ffi::c_void);
                                match action.as_str() {
                                    "check_updates" => { let _ = menubar::show_check_updates_dialog(hwnd); }
                                    "about" => { let _ = menubar::show_about_dialog(hwnd); }
                                    "exit" => { event_loop.exit(); }
                                    _ => {}
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
        
        match event {
            WindowEvent::CloseRequested => { event_loop.exit(); }
            WindowEvent::KeyboardInput { event, .. } => {
                if event.state == winit::event::ElementState::Pressed {
                    if let winit::keyboard::Key::Named(winit::keyboard::NamedKey::F12) = event.logical_key {
                        // DevTools handled by wry
                    }
                }
            }
            _ => {}
        }
    }
}

impl App {
    fn create_webview(&mut self, window: &Arc<Window>) {
        let mut webview_builder = WebViewBuilder::new();

        #[cfg(windows)]
        {
            #[cfg(not(debug_assertions))]
            {
                let app_dir = std::env::current_exe().ok().and_then(|exe| exe.parent().map(|p| p.to_path_buf())).unwrap();
                if app_dir.join("msedgewebview2.exe").exists() {
                    std::env::set_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", &app_dir);
                }
            }
            
            let user_data_dir = std::env::temp_dir().join("MikoWorkspace_WebView2");
            std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", &user_data_dir);
            
            let _ = utils::configure_webview2_permissions();
            
            std::env::set_var("WEBVIEW2_DISABLE_PERMISSION_PROMPTS", "1");
            std::env::set_var("WEBVIEW2_AUTO_GRANT_PERMISSIONS", "1");
            
            webview_builder = webview_builder.with_additional_browser_args("--disable-web-security --enable-clipboard-api");
        }

        #[cfg(debug_assertions)]
        { webview_builder = webview_builder.with_url(DEV_SERVER_URL); }

        #[cfg(not(debug_assertions))]
        {
            use std::borrow::Cow;
            webview_builder = webview_builder.with_custom_protocol("miko".into(), move |_webview, request| {
                if request.uri() == "miko://app/" || request.uri() == "miko://app/index.html" {
                    return http::Response::builder().header("Content-Type", "text/html").body(Cow::Borrowed(INDEX_HTML_BYTES)).unwrap();
                }
                http::Response::builder().status(404).body(Cow::Borrowed(&[] as &[u8])).unwrap()
            });
            webview_builder = webview_builder.with_url("miko://app/");
        }

        webview_builder = webview_builder.with_initialization_script("console.log('WebView initialized');");

        #[cfg(windows)]
        let window_handle = {
            use windows::Win32::Foundation::HWND;
            use winit::raw_window_handle::{HasWindowHandle, RawWindowHandle};
            match window.window_handle().unwrap().as_raw() {
                RawWindowHandle::Win32(handle) => HWND(handle.hwnd.get() as *mut std::ffi::c_void),
                _ => panic!("Expected Win32 window handle"),
            }
        };

        #[cfg(windows)]
        {
            let _ = context_menu::init_window_theme(window_handle);
            let _ = apply_modern_menu_theme(window_handle);
            let _ = enable_window_animations(window_handle);
        }

        match menubar::create_app_menubar() {
            Ok(menu) => {
                if let Ok(_) = menu.attach_to_window(window_handle) {
                    #[cfg(windows)]
                    let _ = menubar::apply_menu_colors(window_handle);
                    self.native_menubar = Some(menu);
                    hooks::start_menu_command_handler(window_handle);
                }
            }
            _ => {}
        }

        let webview = webview_builder
            .with_devtools(true)
            .with_ipc_handler(|request| {
                let body = request.body();
                if let Ok(message) = serde_json::from_str::<serde_json::Value>(body) {
                    if let Some(msg_type) = message["type"].as_str() {
                        match msg_type {
                            "start_download" => {
                                if let (Some(url), Some(filename)) = (message["url"].as_str(), message["filename"].as_str()) {
                                    let mut headers = Vec::new();
                                    if let Some(h) = message["headers"].as_object() {
                                        for (k, v) in h { if let Some(vs) = v.as_str() { headers.push((k.clone(), vs.to_string())); } }
                                    }
                                    let (u, f) = (url.to_string(), filename.to_string());
                                    std::thread::spawn(move || { download::start_download_process(u, f, headers); });
                                }
                            }
                            "show_in_folder" => {
                                if let Some(filename) = message["filename"].as_str() {
                                    let f = filename.to_string();
                                    std::thread::spawn(move || { download::show_file_in_explorer(&f); });
                                }
                            }
                            "show_notification" => {
                                if let Ok(noti_data) = serde_json::from_value::<crate::hooks::noti::NotificationData>(message.clone()) {
                                    std::thread::spawn(move || { let _ = crate::hooks::show_notification(noti_data); });
                                }
                            }
                            _ => {}
                        }
                    }
                }
            })
            .build(&**window)
            .expect("Failed to create WebView");

        self.webview = Some(webview);
    }
}

impl Drop for App {
    fn drop(&mut self) {
        if let Ok(mut created) = TRAY_ICON_CREATED.lock() { *created = false; }
    }
}

pub fn main() -> Result<(), Box<dyn std::error::Error>> {
    let event_loop = EventLoop::new()?;
    let mut app = App::new();
    event_loop.run_app(&mut app)?;
    Ok(())
}
