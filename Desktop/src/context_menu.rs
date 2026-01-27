#[cfg(windows)]
use windows::{
    core::*,
    Win32::{
        Foundation::*,
        Graphics::Dwm::*,
    },
};



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