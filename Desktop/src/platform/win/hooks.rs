#[cfg(windows)]
pub fn start_menu_command_handler(_hwnd: windows::Win32::Foundation::HWND) {
    use windows::Win32::{
        Foundation::HINSTANCE,
        UI::WindowsAndMessaging::*,
        System::Threading::GetCurrentThreadId,
    };
    
    println!("🎯 Installing Windows message hook for menu commands");
    
    unsafe {
        // Install a WH_CALLWNDPROC hook to intercept messages
        let hook_result = SetWindowsHookExW(
            WH_CALLWNDPROC,
            Some(menu_hook_proc),
            HINSTANCE::default(),
            GetCurrentThreadId(),
        );
        
        match hook_result {
            Ok(hook) => {
                println!("✅ Windows message hook installed successfully: {:?}", hook);
            }
            Err(e) => {
                println!("❌ Failed to install Windows hook: {:?}", e);
            }
        }
    }
}

#[cfg(windows)]
unsafe extern "system" fn menu_hook_proc(
    code: i32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::{
        UI::WindowsAndMessaging::*,
    };
    use crate::menubar;
    
    if code >= 0 {
        let msg = *(lparam.0 as *const CWPSTRUCT);
        
        if msg.message == WM_COMMAND {
            let command_id = (msg.wParam.0 & 0xFFFF) as u16;
            println!("🎯 WM_COMMAND intercepted! Command ID: {}", command_id);
            
            // Store the command for processing in the main event loop
            menubar::set_pending_menu_command(command_id);
        }
    }
    
    CallNextHookEx(HHOOK::default(), code, wparam, lparam)
}
