use serde::{Deserialize, Serialize};

#[cfg(target_os = "windows")]
use windows::UI::Notifications::{
    ToastNotification, ToastNotificationManager,
};
#[cfg(target_os = "windows")]
use windows::Data::Xml::Dom::XmlDocument;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotificationData {
    pub title: String,
    pub message: String,
    pub icon: Option<String>,
    pub chat_uuid: Option<String>,
}

/// Initialize notification system
pub fn init_notifications() -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "windows")]
    {
        println!("✅ Windows notification system initialized");
    }
    
    #[cfg(target_os = "macos")]
    {
        println!("✅ macOS notification system initialized (osascript)");
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        println!("⚠️ Notifications not yet implemented for this platform");
    }
    
    Ok(())
}

/// Show a notification (cross-platform)
pub fn show_notification(data: NotificationData) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "windows")]
    {
        return show_windows_notification(data);
    }
    
    #[cfg(target_os = "macos")]
    {
        return show_macos_notification(data);
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        println!("📢 Notification (Fallback): {} - {}", data.title, data.message);
        Ok(())
    }
}

/// Show a Windows toast notification
#[cfg(target_os = "windows")]
fn show_windows_notification(data: NotificationData) -> Result<(), Box<dyn std::error::Error>> {
    use windows::core::HSTRING;
    
    println!("📢 Showing Windows notification: {} - {}", data.title, data.message);
    
    // Create XML template for toast notification
    let xml_template = format!(
        r#"<toast>
            <visual>
                <binding template="ToastGeneric">
                    <text>{}</text>
                    <text>{}</text>
                </binding>
            </visual>
            <audio src="ms-winsoundevent:Notification.Default"/>
        </toast>"#,
        escape_xml(&data.title),
        escape_xml(&data.message)
    );
    
    // Create XML document
    let xml_doc = XmlDocument::new()?;
    xml_doc.LoadXml(&HSTRING::from(&xml_template))?;
    
    // Create toast notification
    let toast = ToastNotification::CreateToastNotification(&xml_doc)?;
    
    // Get toast notifier
    let app_id = HSTRING::from("MikoWorkspace");
    let notifier = ToastNotificationManager::CreateToastNotifierWithId(&app_id)?;
    
    // Show the notification
    notifier.Show(&toast)?;
    
    println!("✅ Windows notification shown successfully");
    Ok(())
}

/// Show a macOS notification using osascript
#[cfg(target_os = "macos")]
fn show_macos_notification(data: NotificationData) -> Result<(), Box<dyn std::error::Error>> {
    println!("📢 Showing macOS notification: {} - {}", data.title, data.message);
    
    // Use macOS osascript to show notification
    let script = format!(
        r#"display notification "{}" with title "{}""#,
        data.message.replace("\"", "\\\""),
        data.title.replace("\"", "\\\"")
    );
    
    let mut command = std::process::Command::new("osascript");
    command.arg("-e").arg(&script);
    
    match command.spawn() {
        Ok(_) => {
            println!("✅ macOS notification sent");
            Ok(())
        }
        Err(e) => {
            println!("❌ Failed to send macOS notification: {}", e);
            Err(e.into())
        }
    }
}

/// Escape XML special characters
#[cfg(target_os = "windows")]
fn escape_xml(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// Handle notification from WebView IPC
pub fn handle_notification_ipc(payload: &str) -> Result<(), Box<dyn std::error::Error>> {
    let data: NotificationData = serde_json::from_str(payload)?;
    show_notification(data)?;
    Ok(())
}

/// Simple convenience function for text-based notifications
pub fn show_simple_notification(title: &str, message: &str) -> Result<(), Box<dyn std::error::Error>> {
    show_notification(NotificationData {
        title: title.to_string(),
        message: message.to_string(),
        icon: None,
        chat_uuid: None,
    })
}
