use std::env;
use std::path::Path;

fn main() {
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap();
    
    if target_os == "windows" {
        // Compile Windows resources
        let mut res = winres::WindowsResource::new();
        
        // Set icon directly
        let icon_path = "../Library/Shared/Icons/icon.ico";
        if Path::new(icon_path).exists() {
            res.set_icon(icon_path);
            println!("cargo:warning=Using icon: {}", icon_path);
        } else {
            println!("cargo:warning=Icon not found at: {}", icon_path);
        }
        
        // Set manifest
        if Path::new("app.manifest").exists() {
            res.set_manifest_file("app.manifest");
            println!("cargo:warning=Using manifest: app.manifest");
        }
        
        // Set version info (numeric values)
        res.set_version_info(winres::VersionInfo::PRODUCTVERSION, 0x0001000000000000);
        res.set_version_info(winres::VersionInfo::FILEVERSION, 0x0001000000000000);
        
        // Compile resources
        match res.compile() {
            Ok(_) => println!("cargo:warning=Successfully compiled Windows resources"),
            Err(e) => {
                eprintln!("cargo:warning=Failed to compile Windows resources: {}", e);
                eprintln!("cargo:warning=The application will still build but without embedded icon/manifest");
            }
        }
    }
    
    // Tell Cargo to rerun this build script if these files change
    println!("cargo:rerun-if-changed=app.manifest");
    println!("cargo:rerun-if-changed=../Library/Shared/Icons/icon.ico");
}