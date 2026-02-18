use std::env;
use std::fs::File;
use std::io::{self, Write, BufWriter};
use std::path::Path;
use std::time::{Instant, Duration};
use serde_json::json;
use reqwest;
use tokio;
use futures_util::StreamExt;

#[derive(Debug, Clone)]
struct DownloadProgress {
    url: String,
    filename: String,
    total_size: u64,
    downloaded: u64,
    chunk_size: u64,
    download_speed_bps: f64, // bytes per second
    eta_seconds: Option<u64>, // estimated time remaining
    connections: usize,
    status: String,
    error: Option<String>,
}

impl DownloadProgress {
    fn to_json(&self) -> serde_json::Value {
        json!({
            "url": self.url,
            "filename": self.filename,
            "total_size": self.total_size,
            "downloaded": self.downloaded,
            "chunk_size": self.chunk_size,
            "progress_percent": if self.total_size > 0 { 
                (self.downloaded as f64 / self.total_size as f64 * 100.0).round() 
            } else { 
                0.0 
            },
            "download_speed_bps": self.download_speed_bps,
            "download_speed_mbps": self.download_speed_bps / (1024.0 * 1024.0),
            "download_speed_human": format_speed(self.download_speed_bps),
            "connections": self.connections,
            "eta_seconds": self.eta_seconds,
            "eta_human": self.eta_seconds.map(|s| format_duration(s)),
            "status": self.status,
            "error": self.error
        })
    }

    fn print_json(&self) {
        println!("{}", self.to_json());
        io::stdout().flush().unwrap();
    }
    
    fn broadcast(&self) {
        self.print_json();
    }
}

// Helper function to format speed in human readable format
fn format_speed(bps: f64) -> String {
    if bps >= 1024.0 * 1024.0 * 1024.0 {
        format!("{:.2} GB/s", bps / (1024.0 * 1024.0 * 1024.0))
    } else if bps >= 1024.0 * 1024.0 {
        format!("{:.2} MB/s", bps / (1024.0 * 1024.0))
    } else if bps >= 1024.0 {
        format!("{:.2} KB/s", bps / 1024.0)
    } else {
        format!("{:.0} B/s", bps)
    }
}

// Helper function to format duration in human readable format
fn format_duration(seconds: u64) -> String {
    if seconds >= 3600 {
        format!("{}h {}m {}s", seconds / 3600, (seconds % 3600) / 60, seconds % 60)
    } else if seconds >= 60 {
        format!("{}m {}s", seconds / 60, seconds % 60)
    } else {
        format!("{}s", seconds)
    }
}

async fn download_file_multiconnection(url: &str, output_path: &str, headers: Vec<(String, String)>) -> Result<(), Box<dyn std::error::Error>> {
    // Determine the actual output file path
    let final_output_path = if output_path.ends_with('/') || output_path.ends_with('\\') || output_path == "." || output_path == "./" {
        let url_filename = url.split('/').last().unwrap_or("downloaded_file");
        if output_path == "." || output_path == "./" {
            url_filename.to_string()
        } else {
            format!("{}{}", output_path, url_filename)
        }
    } else {
        output_path.to_string()
    };

    let filename = Path::new(&final_output_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // Skip HEAD request to avoid 405 errors with some servers
    // Use GET request directly and check headers from the response
    let client = reqwest::Client::new();
    
    // Make a GET request to get file info with custom headers
    let mut request = client.get(url);
    for (key, value) in &headers {
        request = request.header(key, value);
    }
    let response = request.send().await?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()).into());
    }

    let total_size = response.content_length().unwrap_or(0);

    // For simplicity, always use single connection to avoid range request issues
    let connections = 1;

    let progress = DownloadProgress {
        url: url.to_string(),
        filename: filename.clone(),
        total_size,
        downloaded: 0,
        chunk_size: 0,
        download_speed_bps: 0.0,
        eta_seconds: None,
        connections,
        status: "starting".to_string(),
        error: None,
    };

    progress.broadcast();

    // Always use single connection to avoid range request complications
    download_file_single_with_response(url, &final_output_path, progress, response, headers).await
}

async fn download_file_single_with_response(
    _url: &str, 
    output_path: &str, 
    mut progress: DownloadProgress,
    response: reqwest::Response,
    _headers: Vec<(String, String)>
) -> Result<(), Box<dyn std::error::Error>> {
    progress.status = "connecting".to_string();
    progress.broadcast();

    progress.total_size = response.content_length().unwrap_or(0);
    progress.status = "downloading".to_string();
    progress.broadcast();

    let file = File::create(output_path)?;
    let mut writer = BufWriter::new(file);
    
    let mut stream = response.bytes_stream();
    let mut last_speed_update = Instant::now();
    let mut bytes_since_last_update = 0u64;
    let mut current_speed = 0.0f64;
    
    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(chunk) => {
                let chunk_size = chunk.len() as u64;
                
                writer.write_all(&chunk)?;
                
                progress.downloaded += chunk_size;
                progress.chunk_size = chunk_size;
                bytes_since_last_update += chunk_size;
                
                let now = Instant::now();
                let time_since_last_update = now.duration_since(last_speed_update);
                
                if time_since_last_update >= Duration::from_millis(100) {
                    current_speed = bytes_since_last_update as f64 / time_since_last_update.as_secs_f64();
                    bytes_since_last_update = 0;
                    last_speed_update = now;
                }
                
                progress.download_speed_bps = current_speed;
                
                if progress.total_size > 0 && current_speed > 0.0 {
                    let remaining_bytes = progress.total_size - progress.downloaded;
                    progress.eta_seconds = Some((remaining_bytes as f64 / current_speed) as u64);
                }
                
                progress.broadcast();
            }
            Err(e) => {
                return Err(format!("Stream error: {}", e).into());
            }
        }
    }

    writer.flush()?;
    progress.status = "completed".to_string();
    progress.broadcast();

    Ok(())
}

// Update main function to use multi-connection download
#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().collect();

    // Parse arguments: URL OUTPUT_PATH [-H "Header: Value"]...
    if args.len() < 3 {
        print_usage();
        std::process::exit(1);
    }

    let mut url: Option<String> = None;
    let mut output_path: Option<String> = None;
    let mut headers: Vec<(String, String)> = Vec::new();
    
    let mut i = 1;
    while i < args.len() {
        if args[i] == "-H" || args[i] == "--header" {
            if i + 1 < args.len() {
                let header_str = &args[i + 1];
                if let Some(colon_pos) = header_str.find(':') {
                    let key = header_str[..colon_pos].trim().to_string();
                    let value = header_str[colon_pos + 1..].trim().to_string();
                    headers.push((key, value));
                }
                i += 2;
            } else {
                print_error("Missing header value after -H flag");
                std::process::exit(1);
            }
        } else if url.is_none() {
            url = Some(args[i].clone());
            i += 1;
        } else if output_path.is_none() {
            output_path = Some(args[i].clone());
            i += 1;
        } else {
            i += 1;
        }
    }
    
    let url = match url {
        Some(u) => u,
        None => {
            print_usage();
            std::process::exit(1);
        }
    };
    
    let output_path = match output_path {
        Some(p) => p,
        None => {
            print_usage();
            std::process::exit(1);
        }
    };

    if !url.starts_with("http://") && !url.starts_with("https://") {
        print_error("URL must start with http:// or https://");
        std::process::exit(1);
    }

    let final_output_path = if output_path.ends_with('/') || output_path.ends_with('\\') || output_path == "." || output_path == "./" {
        let url_filename = url.split('/').last().unwrap_or("downloaded_file");
        if output_path == "." || output_path == "./" {
            url_filename.to_string()
        } else {
            format!("{}{}", output_path, url_filename)
        }
    } else {
        output_path.to_string()
    };

    if let Some(parent) = Path::new(&final_output_path).parent() {
        if !parent.exists() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                print_error(&format!("Failed to create output directory: {}", e));
                std::process::exit(1);
            }
        }
    }

    match download_file_multiconnection(&url, &output_path, headers).await {
        Ok(()) => {
            let success = json!({
                "status": "success",
                "message": "Download completed successfully",
                "output_path": final_output_path
            });
            println!("{}", success);
            std::process::exit(0);
        }
        Err(e) => {
            print_error(&format!("Download failed: {}", e));
            std::process::exit(1);
        }
    }
}

fn print_usage() {
    let usage = json!({
        "status": "error",
        "error": "Usage: downloaderservice.exe <URL> <OUTPUT_PATH> [-H \"Header: Value\"]",
        "example": "downloaderservice.exe https://example.com/file.zip ./downloads/file.zip -H \"Authorization: Bearer token123\""
    });
    println!("{}", usage);
}

fn print_error(message: &str) {
    let error = json!({
        "status": "error",
        "error": message
    });
    println!("{}", error);
}
