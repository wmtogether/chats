#![cfg(target_os = "macos")]

use wry::WebViewBuilder;
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

pub mod utils;
pub mod download;
pub mod tray;

use crate::hooks as app_hooks;
use app_hooks::{init_notifications, show_notification};

// Global flag to ensure only one tray icon is created system-wide
lazy_static! {
    pub static ref TRAY_ICON_CREATED: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));
}

// Include the icon at compile time
pub const ICON_BYTES: &[u8] = include_bytes!("../../../../Library/Shared/Icons/icon.icns");

#[cfg(debug_assertions)]
const DEV_SERVER_URL: &str = "http://localhost:5173";

#[cfg(not(debug_assertions))]
const INDEX_HTML_BYTES: &[u8] = include_bytes!("../../../../Distribution/index.html");

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
}

impl ApplicationHandler for App {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            if self.window.is_none() && !self.initialization_complete {
                println!("Starting macOS initialization...");
                
                let mut window_attributes = Window::default_attributes()
                    .with_title("Workspace")
                    .with_inner_size(LogicalSize::new(1200, 800))
                    .with_visible(false);
                
                if let Some(icon) = utils::load_window_icon() {
                    window_attributes = window_attributes.with_window_icon(Some(icon));
                }
                
                match event_loop.create_window(window_attributes) {
                    Ok(window) => {
                        let window = Arc::new(window);
                        self.window = Some(window.clone());
                        self.create_webview(&window);
                        
                        // Initialize notifications
                        if let Err(e) = init_notifications() {
                            println!("⚠️ Failed to initialize notifications: {}", e);
                        }
                        
                        window.set_visible(true);
                        
                        if self.tray_icon.is_none() {
                            if let Ok(tray) = tray::create_tray_icon(self.window.clone()) {
                                self.tray_icon = Some(tray);
                            }
                        }
                        self.initialization_complete = true;
                    }
                    Err(e) => println!("❌ Failed to create macOS window: {}", e),
                }
            }
        }));
        
        if let Err(panic_info) = result {
            println!("🚨 macOS initialization panic caught: {:?}", panic_info);
        }
    }

    fn window_event(&mut self, _event_loop: &ActiveEventLoop, _window_id: WindowId, event: WindowEvent) {
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            match event {
                WindowEvent::CloseRequested => {
                    if let Some(window) = &self.window {
                        window.set_visible(false);
                    }
                }
                WindowEvent::Destroyed => {
                    self.webview = None;
                    self.window = None;
                }
                _ => {}
            }
        }));
    }
}

impl App {
    fn create_webview(&mut self, window: &Arc<Window>) {
        let mut webview_builder = WebViewBuilder::new();

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

        webview_builder = webview_builder.with_initialization_script("console.log('🍎 macOS WebKit WebView initialized');");

        let webview = webview_builder
            .with_devtools(true)
            .with_ipc_handler(|request| {
                let body = request.body();
                if let Ok(message) = serde_json::from_str::<serde_json::Value>(body) {
                    if let Some(msg_type) = message["type"].as_str() {
                        match msg_type {
                            "start_download" => {
                                if let (Some(url), Some(filename)) = (message["url"].as_str(), message["filename"].as_str()) {
                                    let (u, f) = (url.to_string(), filename.to_string());
                                    std::thread::spawn(move || { download::start_download_process(u, f); });
                                }
                            }
                            "show_in_folder" => {
                                if let Some(filename) = message["filename"].as_str() {
                                    let f = filename.to_string();
                                    std::thread::spawn(move || { download::show_file_in_finder(&f); });
                                }
                            }
                            "show_notification" => {
                                if let Ok(noti_data) = serde_json::from_value::<crate::hooks::noti::NotificationData>(message.clone()) {
                                    std::thread::spawn(move || { let _ = show_notification(noti_data); });
                                }
                            }
                            _ => {}
                        }
                    }
                }
            })
            .build(&**window);

        if let Ok(wv) = webview {
            self.webview = Some(wv);
        }
    }
}

impl Drop for App {
    fn drop(&mut self) {
        if let Ok(mut created) = TRAY_ICON_CREATED.lock() { *created = false; }
    }
}

pub fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Starting Workspace macOS Desktop Application");
    
    std::panic::set_hook(Box::new(|panic_info| {
        println!("🚨 macOS app panic caught: {:?}", panic_info);
    }));
    
    let event_loop = EventLoop::new()?;
    let mut app = App::new();
    let _ = event_loop.run_app(&mut app);
    Ok(())
}
