use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct DialogRequest {
    pub dialog_type: String,
    pub title: String,
    pub message: String,
    pub buttons: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DialogResponse {
    pub result: String,
    pub button_index: i32,
}

pub fn show_confirmation_dialog_sync(
    title: &str,
    message: &str,
    _ok_text: &str,
    _cancel_text: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    #[cfg(windows)]
    {
        show_windows_message_box(title, message)
    }
    
    #[cfg(not(windows))]
    {
        println!("Dialog: {} - {}", title, message);
        println!("Options: {} / {}", _ok_text, _cancel_text);
        Ok(false)
    }
}

pub fn show_confirmation_dialog(
    title: &str,
    message: &str,
    ok_text: &str,
    cancel_text: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    show_confirmation_dialog_sync(title, message, ok_text, cancel_text)
}

#[cfg(windows)]
fn show_windows_message_box(
    title: &str,
    message: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    use windows::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, MB_YESNO, MB_ICONQUESTION, IDYES, MESSAGEBOX_RESULT
    };
    use windows::core::{HSTRING, PCWSTR};
    
    let title_wide = HSTRING::from(title);
    let message_wide = HSTRING::from(message);
    
    unsafe {
        let result: MESSAGEBOX_RESULT = MessageBoxW(
            None,
            PCWSTR(message_wide.as_ptr()),
            PCWSTR(title_wide.as_ptr()),
            MB_YESNO | MB_ICONQUESTION,
        );
        
        Ok(result == IDYES)
    }
}

pub fn show_info_dialog(
    title: &str,
    message: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(windows)]
    {
        show_windows_info_box(title, message)
    }
    
    #[cfg(not(windows))]
    {
        println!("Info: {} - {}", title, message);
        Ok(())
    }
}

#[cfg(windows)]
fn show_windows_info_box(
    title: &str,
    message: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    use windows::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, MB_OK, MB_ICONINFORMATION
    };
    use windows::core::{HSTRING, PCWSTR};
    
    let title_wide = HSTRING::from(title);
    let message_wide = HSTRING::from(message);
    
    unsafe {
        MessageBoxW(
            None,
            PCWSTR(message_wide.as_ptr()),
            PCWSTR(title_wide.as_ptr()),
            MB_OK | MB_ICONINFORMATION,
        );
    }
    
    Ok(())
}

pub fn show_error_dialog(
    title: &str,
    message: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(windows)]
    {
        show_windows_error_box(title, message)
    }
    
    #[cfg(not(windows))]
    {
        println!("Error: {} - {}", title, message);
        Ok(())
    }
}

pub fn show_warning_dialog(
    title: &str,
    message: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(windows)]
    {
        show_windows_warning_box(title, message)
    }
    
    #[cfg(not(windows))]
    {
        println!("Warning: {} - {}", title, message);
        Ok(())
    }
}

#[cfg(windows)]
fn show_windows_error_box(
    title: &str,
    message: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    use windows::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, MB_OK, MB_ICONERROR
    };
    use windows::core::{HSTRING, PCWSTR};
    
    let title_wide = HSTRING::from(title);
    let message_wide = HSTRING::from(message);
    
    unsafe {
        MessageBoxW(
            None,
            PCWSTR(message_wide.as_ptr()),
            PCWSTR(title_wide.as_ptr()),
            MB_OK | MB_ICONERROR,
        );
    }
    
    Ok(())
}

#[cfg(windows)]
fn show_windows_warning_box(
    title: &str,
    message: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    use windows::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, MB_OK, MB_ICONWARNING
    };
    use windows::core::{HSTRING, PCWSTR};
    
    let title_wide = HSTRING::from(title);
    let message_wide = HSTRING::from(message);
    
    unsafe {
        MessageBoxW(
            None,
            PCWSTR(message_wide.as_ptr()),
            PCWSTR(title_wide.as_ptr()),
            MB_OK | MB_ICONWARNING,
        );
    }
    
    Ok(())
}

pub fn show_ok_cancel_dialog(
    title: &str,
    message: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    #[cfg(windows)]
    {
        show_windows_ok_cancel_box(title, message)
    }
    
    #[cfg(not(windows))]
    {
        println!("Dialog: {} - {}", title, message);
        println!("Options: OK / Cancel");
        Ok(false)
    }
}

#[cfg(windows)]
fn show_windows_ok_cancel_box(
    title: &str,
    message: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    use windows::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, MB_OKCANCEL, MB_ICONQUESTION, IDOK, MESSAGEBOX_RESULT
    };
    use windows::core::{HSTRING, PCWSTR};
    
    let title_wide = HSTRING::from(title);
    let message_wide = HSTRING::from(message);
    
    unsafe {
        let result: MESSAGEBOX_RESULT = MessageBoxW(
            None,
            PCWSTR(message_wide.as_ptr()),
            PCWSTR(title_wide.as_ptr()),
            MB_OKCANCEL | MB_ICONQUESTION,
        );
        
        Ok(result == IDOK)
    }
}

pub fn show_yes_no_cancel_dialog(
    title: &str,
    message: &str,
) -> Result<i32, Box<dyn std::error::Error>> {
    #[cfg(windows)]
    {
        show_windows_yes_no_cancel_box(title, message)
    }
    
    #[cfg(not(windows))]
    {
        println!("Dialog: {} - {}", title, message);
        println!("Options: Yes / No / Cancel");
        Ok(2) // Cancel
    }
}

#[cfg(windows)]
fn show_windows_yes_no_cancel_box(
    title: &str,
    message: &str,
) -> Result<i32, Box<dyn std::error::Error>> {
    use windows::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, MB_YESNOCANCEL, MB_ICONQUESTION, IDYES, IDNO, IDCANCEL, MESSAGEBOX_RESULT
    };
    use windows::core::{HSTRING, PCWSTR};
    
    let title_wide = HSTRING::from(title);
    let message_wide = HSTRING::from(message);
    
    unsafe {
        let result: MESSAGEBOX_RESULT = MessageBoxW(
            None,
            PCWSTR(message_wide.as_ptr()),
            PCWSTR(title_wide.as_ptr()),
            MB_YESNOCANCEL | MB_ICONQUESTION,
        );
        
        match result {
            IDYES => Ok(0),    // Yes
            IDNO => Ok(1),     // No
            IDCANCEL => Ok(2), // Cancel
            _ => Ok(2),        // Default to Cancel
        }
    }
}