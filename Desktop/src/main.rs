//! Cross-platform Desktop Application Entry Point
//! 
//! This file serves as the main entry point for the desktop application,
//! conditionally compiling platform-specific implementations based on the target OS.
#![windows_subsystem = "windows"]
// Shared modules
#[cfg(target_os = "windows")]
mod context_menu;
#[cfg(target_os = "windows")]
mod menubar;
mod hooks;

// Platform-specific conditional compilation
mod platform;

// Main function that calls the platform-specific implementation
fn main() -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "windows")]
    {
        platform::win::main()
    }
    #[cfg(target_os = "macos")]
    {
        platform::mac::main()
    }
    #[cfg(target_os = "linux")]
    {
        platform::linux::main()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        eprintln!("❌ Unsupported platform. This application supports Windows, macOS, and Linux only.");
        std::process::exit(1);
    }
}