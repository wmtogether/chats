use winit::window::Icon;
use crate::platform::win::ICON_BYTES;

#[cfg(windows)]
pub fn configure_webview2_permissions() -> Result<(), Box<dyn std::error::Error>> {
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
pub fn configure_webview2_permissions() -> Result<(), Box<dyn std::error::Error>> {
    println!("⚠️ WebView2 permission configuration only available on Windows");
    Ok(())
}

pub fn load_window_icon() -> Option<Icon> {
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
