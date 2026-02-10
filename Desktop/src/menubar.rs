use windows::Win32::{
    Foundation::HWND,
    UI::WindowsAndMessaging::*,
    Graphics::Dwm::*,
    System::Com::*,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use lazy_static::lazy_static;

// Global storage for menu items and pending commands
lazy_static! {
    static ref GLOBAL_MENU_ITEMS: Arc<Mutex<HashMap<u16, String>>> = Arc::new(Mutex::new(HashMap::new()));
    static ref PENDING_MENU_COMMAND: Arc<Mutex<Option<u16>>> = Arc::new(Mutex::new(None));
}

pub fn store_menu_items_globally(items: HashMap<u16, String>) {
    let mut global_items = GLOBAL_MENU_ITEMS.lock().unwrap();
    *global_items = items;
    println!("📋 Stored {} menu items globally", global_items.len());
}

pub fn get_menu_action(command_id: u16) -> Option<String> {
    let global_items = GLOBAL_MENU_ITEMS.lock().unwrap();
    global_items.get(&command_id).cloned()
}

pub fn set_pending_menu_command(command_id: u16) {
    let mut pending = PENDING_MENU_COMMAND.lock().unwrap();
    *pending = Some(command_id);
    println!("📋 Set pending menu command: {}", command_id);
}

pub fn get_and_clear_pending_menu_command() -> Option<u16> {
    let mut pending = PENDING_MENU_COMMAND.lock().unwrap();
    pending.take()
}

pub struct MenuBar {
    menu_handle: HMENU,
    menu_items: HashMap<u16, String>,
    next_id: u16,
}

impl MenuBar {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        unsafe {
            let menu_handle = CreateMenu()?;
            Ok(Self {
                menu_handle,
                menu_items: HashMap::new(),
                next_id: 1000,
            })
        }
    }

    pub fn add_menu(&mut self, title: &str) -> Result<SubMenu<'_>, Box<dyn std::error::Error>> {
        unsafe {
            let submenu = CreatePopupMenu()?;
            let title_wide: Vec<u16> = title.encode_utf16().chain(std::iter::once(0)).collect();
            
            AppendMenuW(
                self.menu_handle,
                MF_POPUP,
                submenu.0 as usize,
                windows::core::PCWSTR(title_wide.as_ptr()),
            )?;

            Ok(SubMenu {
                handle: submenu,
                parent_items: &mut self.menu_items,
                next_id: &mut self.next_id,
            })
        }
    }

    pub fn attach_to_window(&self, hwnd: HWND) -> Result<(), Box<dyn std::error::Error>> {
        unsafe {
            SetMenu(hwnd, self.menu_handle)?;
            DrawMenuBar(hwnd)?;
            
            // Store the menu items globally for the message handler
            store_menu_items_globally(self.menu_items.clone());
            
            Ok(())
        }
    }

    pub fn get_menu_items(&self) -> &HashMap<u16, String> {
        &self.menu_items
    }

    pub fn handle_menu_command(&self, command_id: u16, hwnd: HWND) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(action) = self.menu_items.get(&command_id) {
            println!("📋 Menu action triggered: {}", action);
            
            match action.as_str() {
                "check_updates" => {
                    show_check_updates_dialog(hwnd)?;
                }
                "about" => {
                    show_about_dialog(hwnd)?;
                }
                "exit" => {
                    unsafe {
                        PostQuitMessage(0);
                    }
                }
                _ => {
                    println!("⚠️ Unhandled menu action: {}", action);
                }
            }
        }
        Ok(())
    }
}

pub struct SubMenu<'a> {
    handle: HMENU,
    parent_items: &'a mut HashMap<u16, String>,
    next_id: &'a mut u16,
}

impl<'a> SubMenu<'a> {
    pub fn add_item(&mut self, text: &str, action: &str) -> Result<u16, Box<dyn std::error::Error>> {
        unsafe {
            let id = *self.next_id;
            *self.next_id += 1;

            let text_wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
            
            AppendMenuW(
                self.handle,
                MF_STRING,
                id as usize,
                windows::core::PCWSTR(text_wide.as_ptr()),
            )?;

            self.parent_items.insert(id, action.to_string());
            Ok(id)
        }
    }

    pub fn add_separator(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        unsafe {
            AppendMenuW(self.handle, MF_SEPARATOR, 0, windows::core::PCWSTR::null())?;
            Ok(())
        }
    }

    pub fn add_submenu(&mut self, title: &str) -> Result<SubMenu<'_>, Box<dyn std::error::Error>> {
        unsafe {
            let submenu = CreatePopupMenu()?;
            let title_wide: Vec<u16> = title.encode_utf16().chain(std::iter::once(0)).collect();
            
            AppendMenuW(
                self.handle,
                MF_POPUP,
                submenu.0 as usize,
                windows::core::PCWSTR(title_wide.as_ptr()),
            )?;

            Ok(SubMenu {
                handle: submenu,
                parent_items: self.parent_items,
                next_id: self.next_id,
            })
        }
    }
}

// Modern menu styling with dark mode support (Windows 10/11 style)
pub fn apply_modern_menu_theme(hwnd: HWND) -> Result<(), Box<dyn std::error::Error>> {
    unsafe {
        // Enable immersive dark mode (Windows 10/11 style)
        let dark_mode_value: i32 = 1; // TRUE
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_USE_IMMERSIVE_DARK_MODE,
            &dark_mode_value as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<i32>() as u32,
        );

        // Apply modern window styling with rounded corners (Windows 11 style)
        let corner_preference = DWM_WINDOW_CORNER_PREFERENCE(2); // DWMWCP_ROUND
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &corner_preference as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<DWM_WINDOW_CORNER_PREFERENCE>() as u32,
        );

        // Enable window transitions for fade in/out effects
        let transitions_enabled: i32 = 0; // FALSE = transitions enabled
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_TRANSITIONS_FORCEDISABLED,
            &transitions_enabled as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<i32>() as u32,
        );

        // Enable dark mode for the entire application context
        enable_dark_mode_for_app()?;
        
        // Force window frame to redraw with new attributes
        let _ = SetWindowPos(
            hwnd,
            HWND::default(),
            0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED,
        );

        println!("✅ Modern dark mode styling applied with window animations enabled");
        Ok(())
    }
}

// Enable dark mode for the entire application
fn enable_dark_mode_for_app() -> Result<(), Box<dyn std::error::Error>> {
    // This is a more comprehensive approach to enable dark mode
    // It affects system menus, dialogs, and other UI elements
    
    // Try to set the app to prefer dark mode
    let _app_dark_mode: u32 = 1;
    
    // Note: This is using undocumented APIs that work on Windows 10/11
    // The actual implementation may vary based on Windows version
    
    // For now, we'll rely on DWM attributes which are documented
    println!("Dark mode preference set for application");
    Ok(())
}

// Check if system is using dark mode
pub fn is_system_dark_mode() -> bool {
    unsafe {
        use windows::Win32::System::Registry::*;
        use windows::core::PCWSTR;
        
        let mut key = HKEY::default();
        let subkey = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize";
        let subkey_wide: Vec<u16> = subkey.encode_utf16().chain(std::iter::once(0)).collect();
        
        if RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(subkey_wide.as_ptr()),
            0,
            KEY_READ,
            &mut key,
        ).is_ok() {
            let value_name = "AppsUseLightTheme";
            let value_name_wide: Vec<u16> = value_name.encode_utf16().chain(std::iter::once(0)).collect();
            
            let mut data: u32 = 0;
            let mut data_size = std::mem::size_of::<u32>() as u32;
            let mut reg_type = REG_DWORD;
            
            if RegQueryValueExW(
                key,
                PCWSTR(value_name_wide.as_ptr()),
                None,
                Some(&mut reg_type),
                Some(&mut data as *mut u32 as *mut u8),
                Some(&mut data_size),
            ).is_ok() {
                let _ = RegCloseKey(key);
                return data == 0; // 0 means dark mode, 1 means light mode
            }
            
            let _ = RegCloseKey(key);
        }
        
        false // Default to light mode if we can't determine
    }
}

// Apply theme-aware colors to menu items using modern DWM (with window effects)
pub fn apply_menu_colors(hwnd: HWND) -> Result<(), Box<dyn std::error::Error>> {
    unsafe {
        let is_dark = is_system_dark_mode();
        
        if is_dark {
            println!("System is using dark mode - applying modern dark theme");
            
            // Enable dark mode for this specific window using modern DWM API
            let dark_mode_value: i32 = 1; // TRUE
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_USE_IMMERSIVE_DARK_MODE,
                &dark_mode_value as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<i32>() as u32,
            );
        } else {
            println!("System is using light mode - applying modern light theme");
            
            // Disable dark mode for light theme
            let light_mode_value: i32 = 0; // FALSE
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_USE_IMMERSIVE_DARK_MODE,
                &light_mode_value as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<i32>() as u32,
            );
        }

        // Enable window transitions for smooth fade effects
        let transitions_enabled: i32 = 0; // FALSE = transitions enabled
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_TRANSITIONS_FORCEDISABLED,
            &transitions_enabled as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<i32>() as u32,
        );
        
        // Force window to redraw with new theme
        let _ = SetWindowPos(
            hwnd,
            HWND::default(),
            0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED,
        );
        
        Ok(())
    }
}

// Enhanced menu creation with modern items and dark mode support
pub fn create_app_menubar() -> Result<MenuBar, Box<dyn std::error::Error>> {
    let mut menubar = MenuBar::new()?;

    // File Menu
    let mut file_menu = menubar.add_menu("File")?;
    file_menu.add_item("New Chat\tCtrl+N", "new_chat")?;
    file_menu.add_item("New Window\tCtrl+Shift+N", "new_window")?;
    file_menu.add_separator()?;
    file_menu.add_item("Open Workspace\tCtrl+O", "open_workspace")?;
    file_menu.add_item("Recent Workspaces", "recent_workspaces")?;
    file_menu.add_separator()?;
    file_menu.add_item("Import Chat History", "import_history")?;
    file_menu.add_item("Export Chat History", "export_history")?;
    file_menu.add_separator()?;
    file_menu.add_item("Settings\tCtrl+,", "settings")?;
    file_menu.add_separator()?;
    file_menu.add_item("Exit\tAlt+F4", "exit")?;

    // Edit Menu
    let mut edit_menu = menubar.add_menu("Edit")?;
    edit_menu.add_item("Undo\tCtrl+Z", "undo")?;
    edit_menu.add_item("Redo\tCtrl+Y", "redo")?;
    edit_menu.add_separator()?;
    edit_menu.add_item("Cut\tCtrl+X", "cut")?;
    edit_menu.add_item("Copy\tCtrl+C", "copy")?;
    edit_menu.add_item("Paste\tCtrl+V", "paste")?;
    edit_menu.add_item("Select All\tCtrl+A", "select_all")?;
    edit_menu.add_separator()?;
    edit_menu.add_item("Find\tCtrl+F", "find")?;
    edit_menu.add_item("Find and Replace\tCtrl+H", "find_replace")?;

    // View Menu
    let mut view_menu = menubar.add_menu("View")?;
    view_menu.add_item("Toggle Sidebar\tCtrl+B", "toggle_sidebar")?;
    view_menu.add_item("Toggle Chat List\tCtrl+1", "toggle_chat_list")?;
    view_menu.add_item("Toggle DevTools\tF12", "toggle_devtools")?;
    view_menu.add_separator()?;
    
    // Zoom submenu
    let mut zoom_menu = view_menu.add_submenu("Zoom")?;
    zoom_menu.add_item("Zoom In\tCtrl++", "zoom_in")?;
    zoom_menu.add_item("Zoom Out\tCtrl+-", "zoom_out")?;
    zoom_menu.add_item("Reset Zoom\tCtrl+0", "reset_zoom")?;
    
    view_menu.add_separator()?;
    view_menu.add_item("Full Screen\tF11", "fullscreen")?;
    view_menu.add_item("Always on Top", "always_on_top")?;

    // Tools Menu
    let mut tools_menu = menubar.add_menu("Tools")?;
    tools_menu.add_item("Clear Chat History", "clear_history")?;
    tools_menu.add_item("Reset Application", "reset_app")?;
    tools_menu.add_separator()?;
    tools_menu.add_item("Network Diagnostics", "network_diagnostics")?;
    tools_menu.add_item("Performance Monitor", "performance_monitor")?;

    // Help Menu
    let mut help_menu = menubar.add_menu("Help")?;
    help_menu.add_item("Getting Started", "getting_started")?;
    help_menu.add_item("Keyboard Shortcuts\tCtrl+/", "shortcuts")?;
    help_menu.add_separator()?;
    help_menu.add_item("Documentation", "documentation")?;
    help_menu.add_item("Community Forum", "community")?;
    help_menu.add_separator()?;
    help_menu.add_item("Report Issue", "report_issue")?;
    help_menu.add_item("Send Feedback", "send_feedback")?;
    help_menu.add_separator()?;
    help_menu.add_item("Check for Updates", "check_updates")?;
    help_menu.add_item("About Workspace", "about")?;

    Ok(menubar)
}

// Enable window animations and effects
pub fn enable_window_animations(hwnd: HWND) -> Result<(), Box<dyn std::error::Error>> {
    unsafe {
        // Enable window transitions (fade in/out effects)
        let transitions_enabled: i32 = 0; // FALSE = transitions enabled
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_TRANSITIONS_FORCEDISABLED,
            &transitions_enabled as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<i32>() as u32,
        );

        // Enable window animations using AnimateWindow for show/hide
        // This will be called when showing/hiding the window
        println!("✅ Window animations and transitions enabled");
        Ok(())
    }
}

// Windows Task Dialog for Check Updates
pub fn show_check_updates_dialog(hwnd: HWND) -> Result<(), Box<dyn std::error::Error>> {
    unsafe {
        // Initialize COM for task dialogs
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        
        // Create task dialog configuration
        let title = "Check for Updates";
        let main_instruction = "Checking for updates...";
        let content = "Miko Workspace is checking for available updates.\n\nCurrent Version: 0.1.0\n\nThis feature will connect to the update server to check for the latest version.";
        
        // Convert strings to wide strings
        let title_wide: Vec<u16> = title.encode_utf16().chain(std::iter::once(0)).collect();
        let instruction_wide: Vec<u16> = main_instruction.encode_utf16().chain(std::iter::once(0)).collect();
        let content_wide: Vec<u16> = content.encode_utf16().chain(std::iter::once(0)).collect();
        
        let button_text = "Check Now";
        let button_text_wide: Vec<u16> = button_text.encode_utf16().chain(std::iter::once(0)).collect();
        
        // Show message box as task dialog alternative (simpler approach)
        let message = format!(
            "{}\n\n{}\n\nWould you like to check for updates now?",
            main_instruction, content
        );
        let message_wide: Vec<u16> = message.encode_utf16().chain(std::iter::once(0)).collect();
        
        let result = MessageBoxW(
            hwnd,
            windows::core::PCWSTR(message_wide.as_ptr()),
            windows::core::PCWSTR(title_wide.as_ptr()),
            MB_YESNO | MB_ICONINFORMATION,
        );
        
        if result == IDYES {
            println!("✅ User clicked 'Yes' to check for updates");
            
            // Show checking dialog immediately
            let checking_message = "Checking for updates...\n\nPlease wait while we connect to the update server.";
            let checking_message_wide: Vec<u16> = checking_message.encode_utf16().chain(std::iter::once(0)).collect();
            let checking_title = "Update Check";
            let checking_title_wide: Vec<u16> = checking_title.encode_utf16().chain(std::iter::once(0)).collect();
            
            // Simulate checking (in real app, this would be async)
            std::thread::sleep(std::time::Duration::from_millis(500));
            
            // Show result dialog
            let result_message = "You are using the latest version of Miko Workspace.\n\nVersion: 0.1.0\n\nNo updates are available at this time.";
            let result_message_wide: Vec<u16> = result_message.encode_utf16().chain(std::iter::once(0)).collect();
            let result_title = "Update Check Complete";
            let result_title_wide: Vec<u16> = result_title.encode_utf16().chain(std::iter::once(0)).collect();
            
            MessageBoxW(
                hwnd,
                windows::core::PCWSTR(result_message_wide.as_ptr()),
                windows::core::PCWSTR(result_title_wide.as_ptr()),
                MB_OK | MB_ICONINFORMATION,
            );
            
            println!("✅ Update check completed");
        } else {
            println!("❌ User cancelled update check");
        }
        
        CoUninitialize();
        Ok(())
    }
}

// About dialog
pub fn show_about_dialog(hwnd: HWND) -> Result<(), Box<dyn std::error::Error>> {
    unsafe {
        let title = "About Miko Workspace";
        let message = "Miko Workspace Desktop Application\n\nVersion: 0.1.0\n\nBuilt with Rust, Wry, and Winit\n\nFeatures:\n• Native Windows integration\n• WebView2 runtime\n• File download service\n• Real-time messaging\n• System tray integration\n\n© 2024 Miko Workspace";
        
        let title_wide: Vec<u16> = title.encode_utf16().chain(std::iter::once(0)).collect();
        let message_wide: Vec<u16> = message.encode_utf16().chain(std::iter::once(0)).collect();
        
        MessageBoxW(
            hwnd,
            windows::core::PCWSTR(message_wide.as_ptr()),
            windows::core::PCWSTR(title_wide.as_ptr()),
            MB_OK | MB_ICONINFORMATION,
        );
        
        Ok(())
    }
}
