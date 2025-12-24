#[cfg(windows)]
use windows::{
    core::*,
    Win32::{
        Foundation::*,
        UI::WindowsAndMessaging::*,
        UI::Input::KeyboardAndMouse::*,
        Graphics::Dwm::*,
    },
};

#[cfg(windows)]
const ID_COPY: u32 = 1001;
#[cfg(windows)]
const ID_CUT: u32 = 1002;
#[cfg(windows)]
const ID_PASTE: u32 = 1003;

#[cfg(windows)]
pub fn init_window_theme(hwnd: HWND) -> Result<()> {
    setup_window_theme(hwnd)?;
    Ok(())
}

#[cfg(windows)]
fn setup_window_theme(hwnd: HWND) -> Result<()> {
    unsafe {
        // Use system default rendering for modern appearance
        let ncrp = DWMNCRENDERINGPOLICY(0); // DWMNCRP_USEWINDOWSTYLE - let Windows decide
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_NCRENDERING_POLICY,
            &ncrp as *const DWMNCRENDERINGPOLICY as *const std::ffi::c_void,
            std::mem::size_of::<DWMNCRENDERINGPOLICY>() as u32,
        ).ok(); // Ignore errors for optional features
        
        // Enable immersive dark mode for Windows 10/11 style
        let dark_mode: BOOL = BOOL(1);
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_USE_IMMERSIVE_DARK_MODE,
            &dark_mode as *const BOOL as *const std::ffi::c_void,
            std::mem::size_of::<BOOL>() as u32,
        ).ok(); // Ignore errors for optional features
        
        Ok(())
    }
}

#[cfg(windows)]
pub fn show_context_menu(hwnd: HWND, x: i32, y: i32) -> Result<()> {
    unsafe {
        // Create popup menu - Windows will handle ALL theming automatically
        let hmenu = CreatePopupMenu()?;
        
        // Add menu items with standard flags - Windows handles everything
        AppendMenuW(hmenu, MF_STRING, ID_COPY as usize, w!("Copy"))?;
        AppendMenuW(hmenu, MF_STRING, ID_CUT as usize, w!("Cut"))?;
        AppendMenuW(hmenu, MF_STRING, ID_PASTE as usize, w!("Paste"))?;
        
        // Show context menu - Windows handles all theming based on system settings
        let cmd = TrackPopupMenuEx(
            hmenu,
            (TPM_RETURNCMD | TPM_RIGHTBUTTON | TPM_LEFTALIGN | TPM_TOPALIGN).0,
            x,
            y,
            hwnd,
            None,
        );
        
        // Handle menu selection
        if cmd.as_bool() {
            let cmd_id = cmd.0 as u32;
            match cmd_id {
                ID_COPY => {
                    println!("Copy selected");
                    handle_copy()?;
                }
                ID_CUT => {
                    println!("Cut selected");
                    handle_cut()?;
                }
                ID_PASTE => {
                    println!("Paste selected");
                    handle_paste()?;
                }
                _ => {}
            }
        }
        
        // Clean up
        DestroyMenu(hmenu)?;
    }
    
    Ok(())
}

#[cfg(windows)]
fn handle_copy() -> Result<()> {
    unsafe {
        // Send Ctrl+C to the active window
        let inputs = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_CONTROL,
                        wScan: 0,
                        dwFlags: KEYBD_EVENT_FLAGS(0), // Key down
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VIRTUAL_KEY('C' as u16),
                        wScan: 0,
                        dwFlags: KEYBD_EVENT_FLAGS(0), // Key down
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VIRTUAL_KEY('C' as u16),
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_CONTROL,
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        ];
        
        SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
    }
    
    Ok(())
}

#[cfg(windows)]
fn handle_cut() -> Result<()> {
    unsafe {
        // Send Ctrl+X to the active window
        let inputs = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_CONTROL,
                        wScan: 0,
                        dwFlags: KEYBD_EVENT_FLAGS(0), // Key down
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VIRTUAL_KEY('X' as u16),
                        wScan: 0,
                        dwFlags: KEYBD_EVENT_FLAGS(0), // Key down
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VIRTUAL_KEY('X' as u16),
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_CONTROL,
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        ];
        
        SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
    }
    
    Ok(())
}

#[cfg(windows)]
fn handle_paste() -> Result<()> {
    unsafe {
        // Send Ctrl+V to the active window
        let inputs = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_CONTROL,
                        wScan: 0,
                        dwFlags: KEYBD_EVENT_FLAGS(0), // Key down
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VIRTUAL_KEY('V' as u16),
                        wScan: 0,
                        dwFlags: KEYBD_EVENT_FLAGS(0), // Key down
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VIRTUAL_KEY('V' as u16),
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_CONTROL,
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        ];
        
        SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
    }
    
    Ok(())
}

// Linux implementation (placeholder)
#[cfg(target_os = "linux")]
pub fn show_context_menu(_x: i32, _y: i32) -> Result<(), Box<dyn std::error::Error>> {
    println!("Linux context menu not implemented yet");
    Ok(())
}

// macOS implementation (placeholder)
#[cfg(target_os = "macos")]
pub fn show_context_menu(_x: i32, _y: i32) -> Result<(), Box<dyn std::error::Error>> {
    println!("macOS context menu not implemented yet");
    Ok(())
}