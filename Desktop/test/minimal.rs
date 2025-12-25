use wry::WebViewBuilder;
use winit::{
    event::WindowEvent,
    event_loop::{ActiveEventLoop, EventLoop},
    window::{Window, WindowId},
    application::ApplicationHandler,
    dpi::LogicalSize,
};
use std::sync::Arc;

struct MinimalApp {
    window: Option<Arc<Window>>,
    webview: Option<wry::WebView>,
}

impl MinimalApp {
    fn new() -> Self {
        Self {
            window: None,
            webview: None,
        }
    }
}

impl ApplicationHandler for MinimalApp {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.window.is_none() {
            println!("Creating window...");
            
            let window_attributes = Window::default_attributes()
                .with_title("Minimal Wry Test")
                .with_inner_size(LogicalSize::new(800, 600))
                .with_visible(true);
            
            let window = Arc::new(event_loop.create_window(window_attributes).unwrap());
            self.window = Some(window.clone());
            
            println!("Creating WebView...");
            
            let webview = WebViewBuilder::new()
                .with_html("<html><body><h1>Hello from Wry!</h1></body></html>")
                .build(window.as_ref())
                .expect("Failed to create WebView");
            
            self.webview = Some(webview);
            println!("WebView created successfully!");
        }
    }

    fn window_event(&mut self, event_loop: &ActiveEventLoop, _window_id: WindowId, event: WindowEvent) {
        match event {
            WindowEvent::CloseRequested => {
                println!("Close requested");
                event_loop.exit();
            }
            _ => {}
        }
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting minimal wry test...");
    
    let event_loop = EventLoop::new()?;
    let mut app = MinimalApp::new();
    
    event_loop.run_app(&mut app)?;
    
    Ok(())
}
