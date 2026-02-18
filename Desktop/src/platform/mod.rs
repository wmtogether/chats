#[cfg(target_os = "windows")]
pub mod win;

#[cfg(target_os = "macos")]
pub mod mac;

#[cfg(target_os = "linux")]
pub mod linux {
    pub fn main() -> Result<(), Box<dyn std::error::Error>> {
        eprintln!("❌ Linux support not yet implemented.");
        std::process::exit(1);
    }
}
