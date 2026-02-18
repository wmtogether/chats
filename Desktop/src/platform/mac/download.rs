use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use serde_json;
use crate::platform::mac::utils::show_notification;

pub fn show_file_in_finder(filename: &str) {
    println!("📂 Showing file in Finder: {}", filename);
    
    // Determine the file path in Downloads folder
    let downloads_dir = dirs::download_dir().unwrap_or_else(|| {
        std::env::current_dir().unwrap().join("Downloads")
    });
    
    let file_path = downloads_dir.join(filename);
    
    if file_path.exists() {
        println!("✅ File exists, opening in Finder: {}", file_path.display());
        
        // Use macOS 'open' command with -R flag to reveal in Finder
        let mut command = std::process::Command::new("open");
        command.arg("-R").arg(&file_path);
        
        match command.spawn() {
            Ok(_) => {
                println!("✅ Successfully opened file in Finder");
            }
            Err(e) => {
                println!("❌ Failed to open file in Finder: {}", e);
                
                // Fallback: just open the Downloads folder
                let mut fallback_command = std::process::Command::new("open");
                fallback_command.arg(&downloads_dir);
                
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
        let mut command = std::process::Command::new("open");
        command.arg(&downloads_dir);
        
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

pub fn start_download_process(url: String, filename: String) {
    println!("Starting download: {} -> {}", url, filename);
    
    // Get the path to the downloader executable
    let exe_path = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.join("downloaderservice")))
        .unwrap_or_else(|| std::path::PathBuf::from("./target/debug/downloaderservice"));
    
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
    
    // Start the downloader process
    let mut command = Command::new(&exe_path);
    command
        .arg(&url)
        .arg(&output_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    match command.spawn() {
        Ok(mut child) => {
            println!("Downloader process started with PID: {}", child.id());
            
            // Read stdout in a separate thread
            if let Some(stdout) = child.stdout.take() {
                let reader = BufReader::new(stdout);
                
                for line in reader.lines() {
                    match line {
                        Ok(json_line) => {
                            println!("Download progress: {}", json_line);
                            
                            // Parse JSON and emit progress events
                            if let Ok(progress) = serde_json::from_str::<serde_json::Value>(&json_line) {
                                let status = progress["status"].as_str().unwrap_or("unknown");
                                
                                match status {
                                    "downloading" => {
                                        println!("Progress: {}%", progress["progress_percent"].as_f64().unwrap_or(0.0));
                                    }
                                    "completed" => {
                                        println!("Download completed: {}", filename);
                                        
                                        // Show macOS notification
                                        show_notification("Download Complete", &format!("{} saved to Downloads", filename));
                                        break;
                                    }
                                    "error" => {
                                        println!("Download error: {}", progress["error"].as_str().unwrap_or("Unknown error"));
                                        show_notification("Download Failed", &format!("Failed to download {}", filename));
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
                        println!("Download completed successfully");
                    } else {
                        println!("Download failed with exit code: {:?}", status.code());
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
