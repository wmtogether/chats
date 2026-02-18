use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use serde_json;
use crate::platform::win::PROGRESS_SENDER;

pub fn show_file_in_explorer(filename: &str) {
    println!("📂 Showing file in Windows Explorer: {}", filename);
    
    // Determine the file path in Downloads folder
    let downloads_dir = dirs::download_dir().unwrap_or_else(|| {
        std::env::current_dir().unwrap().join("Downloads")
    });
    
    let file_path = downloads_dir.join(filename);
    
    if file_path.exists() {
        println!("✅ File exists, opening in Explorer: {}", file_path.display());
        
        // Use Windows Explorer with /select parameter to highlight the file
        let mut command = std::process::Command::new("explorer");
        command.arg("/select,").arg(&file_path);
        
        // Hide the console window on Windows
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            command.creation_flags(CREATE_NO_WINDOW);
        }
        
        match command.spawn() {
            Ok(_) => {
                println!("✅ Successfully opened file in Explorer");
            }
            Err(e) => {
                println!("❌ Failed to open file in Explorer: {}", e);
                
                // Fallback: just open the Downloads folder
                let mut fallback_command = std::process::Command::new("explorer");
                fallback_command.arg(&downloads_dir);
                
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    const CREATE_NO_WINDOW: u32 = 0x08000000;
                    fallback_command.creation_flags(CREATE_NO_WINDOW);
                }
                
                match fallback_command.spawn() {
                    Ok(_) => {
                        println!("✅ Opened Downloads folder as fallback");
                    }
                    Err(e2) => {
                        println!("❌ Failed to open Downloads folder: {}", e2);
                    }
                }
            }
        }
    } else {
        println!("❌ File not found: {}", file_path.display());
        
        // Just open the Downloads folder
        let mut command = std::process::Command::new("explorer");
        command.arg(&downloads_dir);
        
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            command.creation_flags(CREATE_NO_WINDOW);
        }
        
        match command.spawn() {
            Ok(_) => {
                println!("✅ Opened Downloads folder (file not found)");
            }
            Err(e) => {
                println!("❌ Failed to open Downloads folder: {}", e);
            }
        }
    }
}

pub fn start_download_process(url: String, filename: String, headers: Vec<(String, String)>) {
    println!("Starting download: {} -> {}", url, filename);
    println!("📊 Real-time progress will be sent to frontend via callback");
    
    // Get the path to the downloader executable
    let exe_path = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.join("downloaderservice.exe")))
        .unwrap_or_else(|| std::path::PathBuf::from("./target/debug/downloaderservice.exe"));
    
    println!("Using downloader executable: {}", exe_path.display());
    
    // Determine output path (Downloads folder)
    let downloads_dir = dirs::download_dir().unwrap_or_else(|| {
        std::env::current_dir().unwrap().join("Downloads")
    });
    
    // Create downloads directory if it doesn't exist
    if !downloads_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&downloads_dir) {
            println!("Failed to create downloads directory: {}", e);
            return;
        }
    }
    
    let output_path = downloads_dir.join(&filename);
    
    // Start the downloader process with hidden window
    let mut command = Command::new(&exe_path);
    command
        .arg(&url)
        .arg(&output_path);
    
    // Add headers if provided
    for (key, value) in headers {
        command.arg("-H").arg(format!("{}: {}", key, value));
    }
    
    command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    // Hide the console window on Windows
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    
    match command.spawn() {
        Ok(mut child) => {
            println!("Downloader process started with PID: {} (hidden window)", child.id());
            
            // Read stdout in a separate thread
            if let Some(stdout) = child.stdout.take() {
                let reader = BufReader::new(stdout);
                
                for line in reader.lines() {
                    match line {
                        Ok(json_line) => {
                            // Real progress from subprocess - output to console
                            println!("📥 DOWNLOAD_PROGRESS: {}", json_line);
                            
                            // Send progress to frontend via global channel
                            if let Ok(sender_lock) = PROGRESS_SENDER.lock() {
                                if let Some(sender) = sender_lock.as_ref() {
                                    if let Err(e) = sender.send(json_line.clone()) {
                                        println!("⚠️ Failed to send progress to frontend: {}", e);
                                    }
                                }
                            }
                            
                            // Parse JSON to check status
                            if let Ok(progress) = serde_json::from_str::<serde_json::Value>(&json_line) {
                                let status = progress["status"].as_str().unwrap_or("unknown");
                                let percent = progress["progress_percent"].as_f64().unwrap_or(0.0);
                                let speed = progress["download_speed_human"].as_str().unwrap_or("N/A");
                                
                                match status {
                                    "downloading" => {
                                        println!("  ├─ Progress: {:.1}% @ {}", percent, speed);
                                    }
                                    "completed" => {
                                        println!("  └─ ✅ Download completed: {}", filename);
                                        break;
                                    }
                                    "error" => {
                                        let error_msg = progress["error"].as_str().unwrap_or("Unknown error");
                                        println!("  └─ ❌ Download error: {}", error_msg);
                                        break;
                                    }
                                    _ => {}
                                }
                            }
                        }
                        Err(e) => {
                            println!("Error reading download output: {}", e);
                            break;
                        }
                    }
                }
            }
            
            // Wait for the process to complete
            match child.wait() {
                Ok(status) => {
                    if status.success() {
                        println!("Download process completed successfully");
                    } else {
                        println!("Download process failed with exit code: {:?}", status.code());
                    }
                }
                Err(e) => {
                    println!("Error waiting for download process: {}", e);
                }
            }
        }
        Err(e) => {
            println!("Failed to start downloader process: {}", e);
        }
    }
}
