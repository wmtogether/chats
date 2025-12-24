use std::{process::Command, env, path::PathBuf, fs};

fn main() {
    if env::var("PROFILE").unwrap_or_default() != "release" {
        return;
    }

    // Desktop/ path
    let desktop_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());

    // Workspace root
    let workspace_root = desktop_dir
        .parent()
        .expect("Desktop must be inside workspace root");

    println!("cargo:rerun-if-changed={}", workspace_root.join("Source").display());
    println!("cargo:rerun-if-changed={}", workspace_root.join("index.html").display());
    println!("cargo:rerun-if-changed={}", workspace_root.join("package.json").display());
    println!("cargo:rerun-if-changed={}", workspace_root.join("vite.config.ts").display());

    let status = Command::new("bun")
        .args(["x", "vite", "build"])
        .current_dir(workspace_root)
        .status()
        .expect("bun not found. Install bun.");

    if !status.success() {
        panic!("Frontend build failed (bun x vite build)");
    }

    println!("Frontend built successfully");

    // Copy WebView2 Runtime to output directory
    let target_dir = desktop_dir.join("target").join("release");
    let runtime_source = workspace_root.join("Distribution").join("Runtime");
    let runtime_dest = target_dir.join("Runtime");

    if runtime_source.exists() {
        println!("Copying WebView2 Runtime from {} to {}", runtime_source.display(), runtime_dest.display());
        
        // Remove existing runtime if present
        if runtime_dest.exists() {
            let _ = fs::remove_dir_all(&runtime_dest);
        }

        // Copy runtime directory
        if let Err(e) = copy_dir_all(&runtime_source, &runtime_dest) {
            println!("cargo:warning=Failed to copy WebView2 Runtime: {}", e);
        } else {
            println!("WebView2 Runtime copied successfully");
        }
    } else {
        println!("cargo:warning=WebView2 Runtime not found at {}", runtime_source.display());
        println!("cargo:warning=Download WebView2 Fixed Version Runtime and place it in Distribution/Runtime/");
    }
}

fn copy_dir_all(src: &PathBuf, dst: &PathBuf) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        
        if ty.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}
