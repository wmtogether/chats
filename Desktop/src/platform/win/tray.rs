use tray_icon::{TrayIcon, TrayIconBuilder, menu::{Menu, MenuItem, MenuEvent, PredefinedMenuItem}};
use std::sync::Arc;
use winit::window::Window;
use crate::platform::win::{ICON_BYTES, TRAY_ICON_CREATED};

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
    
    println!("✅ Single tray icon created with ID-based menu items (globally unique)");
    
    // Handle menu events
    let menu_channel = MenuEvent::receiver();
    let window_ref = window.clone();
    
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
                        // Show about dialog
                        println!("📋 Workspace Desktop Application v0.1.0");
                        
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
                            
                            let message: Vec<u16> = OsStr::new("Workspace Desktop Application v0.1.0

Built with Rust, Wry, and Winit
Features: File downloads, tray integration, WebView2")
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
                            if let Ok(mut created) = TRAY_ICON_CREATED.lock() {
                                *created = false;
                            }
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
    
    Ok(tray_icon)
}

fn fallback_icon() -> Result<tray_icon::Icon, Box<dyn std::error::Error>> {
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
    Ok(tray_icon::Icon::from_rgba(rgba_data, size, size)?)
}
