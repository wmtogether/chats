use tray_icon::{TrayIcon, TrayIconBuilder, menu::{Menu, MenuItem, MenuEvent, PredefinedMenuItem}};
use std::sync::Arc;
use winit::window::Window;
use crate::platform::mac::{ICON_BYTES, TRAY_ICON_CREATED};

pub fn create_tray_icon(window: Option<Arc<Window>>) -> Result<TrayIcon, Box<dyn std::error::Error>> {
    // Check global flag to prevent multiple tray icons system-wide
    {
        let mut created = TRAY_ICON_CREATED.lock().unwrap();
        if *created {
            return Err("Tray icon already exists globally".into());
        }
        *created = true;
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
                            Err(_) => fallback_icon()?
                        }
                    } else {
                        fallback_icon()?
                    }
                }
                Err(_) => fallback_icon()?
            }
        })
        .build()?;
    
    println!("✅ macOS tray icon created with ID-based menu items");
    
    // Handle menu events
    let menu_channel = MenuEvent::receiver();
    let window_ref = window.clone();
    
    std::thread::spawn(move || {
        loop {
            if let Ok(event) = menu_channel.recv() {
                println!("🔔 macOS tray menu event received: {}", event.id.0);
                match event.id.0.as_str() {
                    "show_window" => {
                        if let Some(window) = &window_ref {
                            window.set_visible(true);
                            window.focus_window();
                        }
                    }
                    "hide_window" => {
                        if let Some(window) = &window_ref {
                            window.set_visible(false);
                        }
                    }
                    "open_workspace" => {
                        let _ = std::process::Command::new("open").arg("http://10.10.60.8:1669").spawn();
                    }
                    "open_downloads" => {
                        let downloads_dir = dirs::download_dir().unwrap_or_else(|| std::env::current_dir().unwrap().join("Downloads"));
                        let _ = std::process::Command::new("open").arg(&downloads_dir).spawn();
                    }
                    "about" => {
                        let script = r#"display dialog "Workspace Desktop Application v0.1.0" with title "About Workspace" buttons {"OK"} default button "OK""#;
                        let _ = std::process::Command::new("osascript").arg("-e").arg(script).spawn();
                    }
                    "exit" => {
                        if let Ok(mut created) = TRAY_ICON_CREATED.lock() { *created = false; }
                        std::process::exit(0);
                    }
                    _ => {}
                }
            }
        }
    });
    
    Ok(tray_icon)
}

fn fallback_icon() -> Result<tray_icon::Icon, Box<dyn std::error::Error>> {
    let size = 32;
    let rgba_data = vec![128; (size * size * 4) as usize];
    Ok(tray_icon::Icon::from_rgba(rgba_data, size, size)?)
}
