use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use windows::{
    core::*,
    Win32::{
        Foundation::*,
        UI::{
            Shell::*,
            WindowsAndMessaging::*,
        },
        System::{
            Com::*,
            LibraryLoader::*,
        },
    },
};

#[derive(Debug, Clone)]
pub struct NotificationData {
    pub title: String,
    pub message: String,
    pub icon_type: NotificationIcon,
    pub duration: u32, // in milliseconds
}

#[derive(Debug, Clone)]
pub enum NotificationIcon {
    Info,
    Warning,
    Error,
    None,
}

impl NotificationIcon {
    fn to_win32_icon(&self) -> NOTIFY_ICON_INFOTIP_FLAGS {
        match self {
            NotificationIcon::Info => NIIF_INFO,
            NotificationIcon::Warning => NIIF_WARNING,
            NotificationIcon::Error => NIIF_ERROR,
            NotificationIcon::None => NIIF_NONE,
        }
    }
}

pub struct NotificationManager {
    hwnd: HWND,
    notification_id: u32,
}

impl NotificationManager {
    pub fn new(hwnd: HWND) -> Self {
        Self {
            hwnd,
            notification_id: 1,
        }
    }

    /// Show a native Windows notification using the system tray
    pub fn show_notification(&mut self, notification: NotificationData) -> std::result::Result<(), Box<dyn std::error::Error>> {
        unsafe {
            // Initialize COM for shell notifications
            CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok();

            // Create notification data structure
            let mut nid = NOTIFYICONDATAW {
                cbSize: std::mem::size_of::<NOTIFYICONDATAW>() as u32,
                hWnd: self.hwnd,
                uID: self.notification_id,
                uFlags: NIF_MESSAGE | NIF_ICON | NIF_TIP | NIF_INFO,
                uCallbackMessage: WM_USER + 1,
                hIcon: self.load_default_icon()?,
                dwInfoFlags: notification.icon_type.to_win32_icon(),
                Anonymous: NOTIFYICONDATAW_0 {
                    uTimeout: notification.duration,
                },
                ..Default::default()
            };

            // Convert strings to wide strings
            let title_wide = self.to_wide_string(&notification.title);
            let message_wide = self.to_wide_string(&notification.message);
            let tip_wide = self.to_wide_string("Miko Workspace");

            // Copy strings to the structure (truncate if too long)
            self.copy_to_array(&title_wide, &mut nid.szInfoTitle);
            self.copy_to_array(&message_wide, &mut nid.szInfo);
            self.copy_to_array(&tip_wide, &mut nid.szTip);

            // Add the notification icon to system tray
            if Shell_NotifyIconW(NIM_ADD, &nid).as_bool() {
                println!("✅ Notification shown: {}", notification.title);
                
                // Schedule removal after duration (without threading issues)
                self.notification_id += 1;
                Ok(())
            } else {
                Err("Failed to show notification".into())
            }
        }
    }

    /// Show a simple toast notification
    pub fn show_toast(&mut self, title: &str, message: &str) -> std::result::Result<(), Box<dyn std::error::Error>> {
        let notification = NotificationData {
            title: title.to_string(),
            message: message.to_string(),
            icon_type: NotificationIcon::Info,
            duration: 5000, // 5 seconds
        };
        
        self.show_notification(notification)
    }

    /// Show an error notification
    pub fn show_error(&mut self, title: &str, message: &str) -> std::result::Result<(), Box<dyn std::error::Error>> {
        let notification = NotificationData {
            title: title.to_string(),
            message: message.to_string(),
            icon_type: NotificationIcon::Error,
            duration: 8000, // 8 seconds for errors
        };
        
        self.show_notification(notification)
    }

    /// Show a warning notification
    pub fn show_warning(&mut self, title: &str, message: &str) -> std::result::Result<(), Box<dyn std::error::Error>> {
        let notification = NotificationData {
            title: title.to_string(),
            message: message.to_string(),
            icon_type: NotificationIcon::Warning,
            duration: 6000, // 6 seconds for warnings
        };
        
        self.show_notification(notification)
    }

    /// Show a success notification
    pub fn show_success(&mut self, title: &str, message: &str) -> std::result::Result<(), Box<dyn std::error::Error>> {
        let notification = NotificationData {
            title: title.to_string(),
            message: message.to_string(),
            icon_type: NotificationIcon::Info,
            duration: 4000, // 4 seconds for success
        };
        
        self.show_notification(notification)
    }

    /// Load the default application icon
    fn load_default_icon(&self) -> std::result::Result<HICON, Box<dyn std::error::Error>> {
        unsafe {
            // Try to load the application icon first
            let hicon = LoadIconW(GetModuleHandleW(None)?, PCWSTR(1 as *const u16))?;
            
            if hicon.is_invalid() {
                // Fallback to system information icon
                Ok(LoadIconW(None, IDI_INFORMATION)?)
            } else {
                Ok(hicon)
            }
        }
    }

    /// Convert Rust string to wide string
    fn to_wide_string(&self, s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
    }

    /// Copy wide string to fixed-size array
    fn copy_to_array(&self, source: &[u16], dest: &mut [u16]) {
        let len = std::cmp::min(source.len() - 1, dest.len() - 1); // -1 for null terminator
        dest[..len].copy_from_slice(&source[..len]);
        dest[len] = 0; // Ensure null termination
    }

    /// Remove notification manually (simplified - no threading)
    pub fn remove_notification(&self, notification_id: u32) {
        unsafe {
            let nid = NOTIFYICONDATAW {
                cbSize: std::mem::size_of::<NOTIFYICONDATAW>() as u32,
                hWnd: self.hwnd,
                uID: notification_id,
                ..Default::default()
            };
            
            Shell_NotifyIconW(NIM_DELETE, &nid);
        }
    }

    /// Remove all notifications
    pub fn clear_all_notifications(&self) {
        unsafe {
            for id in 1..=self.notification_id {
                let mut nid = NOTIFYICONDATAW {
                    cbSize: std::mem::size_of::<NOTIFYICONDATAW>() as u32,
                    hWnd: self.hwnd,
                    uID: id,
                    ..Default::default()
                };
                
                Shell_NotifyIconW(NIM_DELETE, &nid);
            }
        }
    }
}

impl Drop for NotificationManager {
    fn drop(&mut self) {
        self.clear_all_notifications();
        unsafe {
            CoUninitialize();
        }
    }
}

/// Global notification functions for easy access
static mut NOTIFICATION_MANAGER: Option<NotificationManager> = None;

pub fn init_notifications(hwnd: HWND) {
    unsafe {
        NOTIFICATION_MANAGER = Some(NotificationManager::new(hwnd));
    }
}

pub fn show_notification(title: &str, message: &str) -> std::result::Result<(), Box<dyn std::error::Error>> {
    unsafe {
        if let Some(ref mut manager) = NOTIFICATION_MANAGER {
            manager.show_toast(title, message)
        } else {
            Err(std::io::Error::new(std::io::ErrorKind::NotFound, "Notification manager not initialized").into())
        }
    }
}

pub fn show_error_notification(title: &str, message: &str) -> std::result::Result<(), Box<dyn std::error::Error>> {
    unsafe {
        if let Some(ref mut manager) = NOTIFICATION_MANAGER {
            manager.show_error(title, message)
        } else {
            Err(std::io::Error::new(std::io::ErrorKind::NotFound, "Notification manager not initialized").into())
        }
    }
}

pub fn show_warning_notification(title: &str, message: &str) -> std::result::Result<(), Box<dyn std::error::Error>> {
    unsafe {
        if let Some(ref mut manager) = NOTIFICATION_MANAGER {
            manager.show_warning(title, message)
        } else {
            Err(std::io::Error::new(std::io::ErrorKind::NotFound, "Notification manager not initialized").into())
        }
    }
}

pub fn show_success_notification(title: &str, message: &str) -> std::result::Result<(), Box<dyn std::error::Error>> {
    unsafe {
        if let Some(ref mut manager) = NOTIFICATION_MANAGER {
            manager.show_success(title, message)
        } else {
            Err(std::io::Error::new(std::io::ErrorKind::NotFound, "Notification manager not initialized").into())
        }
    }
}

/// Notification event handler for processing notification clicks
pub fn handle_notification_message(_wparam: WPARAM, lparam: LPARAM) {
    match lparam.0 as u32 {
        WM_LBUTTONUP => {
            println!("Notification clicked - bringing window to front");
            // Handle notification click - could bring window to front, etc.
        }
        WM_RBUTTONUP => {
            println!("Notification right-clicked");
            // Handle right-click on notification
        }
        _ => {}
    }
}
/// Handle new message notification
pub fn show_new_message_notification(sender: &str, message: &str, channel: Option<&str>) -> std::result::Result<(), Box<dyn std::error::Error>> {
    let title = if let Some(ch) = channel {
        format!("New message in #{}", ch)
    } else {
        format!("New message from {}", sender)
    };
    
    // Truncate long messages for notification
    let display_message = if message.len() > 100 {
        format!("{}...", &message[..97])
    } else {
        message.to_string()
    };
    
    unsafe {
        if let Some(ref mut manager) = NOTIFICATION_MANAGER {
            let notification = NotificationData {
                title,
                message: display_message,
                icon_type: NotificationIcon::Info,
                duration: 6000, // 6 seconds for new messages
            };
            manager.show_notification(notification)
        } else {
            Err(std::io::Error::new(std::io::ErrorKind::NotFound, "Notification manager not initialized").into())
        }
    }
}

/// Handle Redis message and show appropriate notification
pub fn handle_redis_message(channel: &str, event: &str, data: &serde_json::Value) -> std::result::Result<(), Box<dyn std::error::Error>> {
    match channel {
        "chat:message" => {
            if event == "new" {
                // Extract message data
                let sender = data.get("sender")
                    .and_then(|s| s.as_str())
                    .unwrap_or("Unknown");
                let content = data.get("content")
                    .and_then(|c| c.as_str())
                    .unwrap_or("New message");
                let channel_name = data.get("channelName")
                    .and_then(|c| c.as_str());
                
                show_new_message_notification(sender, content, channel_name)?;
            }
        }
        "notification" => {
            if event == "send" {
                let title = data.get("title")
                    .and_then(|t| t.as_str())
                    .unwrap_or("Notification");
                let message = data.get("message")
                    .and_then(|m| m.as_str())
                    .unwrap_or("You have a new notification");
                
                show_notification(title, message)?;
            }
        }
        "user:status" => {
            if event == "changed" {
                let user = data.get("userId")
                    .and_then(|u| u.as_str())
                    .unwrap_or("User");
                let status = data.get("status")
                    .and_then(|s| s.as_str())
                    .unwrap_or("unknown");
                
                let message = format!("{} is now {}", user, status);
                show_notification("User Status", &message)?;
            }
        }
        _ => {
            // Generic notification for other channels
            let title = format!("Update from {}", channel);
            let message = format!("Event: {}", event);
            show_notification(&title, &message)?;
        }
    }
    
    Ok(())
}