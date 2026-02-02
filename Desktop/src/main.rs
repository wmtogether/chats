//! Cross-platform Desktop Application Entry Point
//! 
//! This file serves as the main entry point for the desktop application,
//! conditionally compiling platform-specific implementations based on the target OS.

// Shared modules
#[cfg(target_os = "windows")]
mod context_menu;
#[cfg(target_os = "windows")]
mod menubar;
#[cfg(target_os = "windows")]
mod hooks;

// Platform-specific conditional compilation
#[cfg(target_os = "windows")]
#[path = "main_win.rs"]
mod platform_main;

#[cfg(target_os = "macos")]
#[path = "main_mac.rs"]
mod platform_main;

#[cfg(target_os = "linux")]
mod platform_main {
    pub fn main() -> Result<(), Box<dyn std::error::Error>> {
        eprintln!("❌ Linux support not yet implemented.");
        std::process::exit(1);
    }
}

// Main function that calls the platform-specific implementation
fn main() -> Result<(), Box<dyn std::error::Error>> {
    platform_main::main()
}

// Fallback for unsupported platforms
#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn unsupported_platform_main() -> Result<(), Box<dyn std::error::Error>> {
    eprintln!("❌ Unsupported platform. This application supports Windows, macOS, and Linux only.");
    std::process::exit(1);
}