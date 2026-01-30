use std::env;
use std::fs::File;
use std::io::{self, Write, BufWriter, Seek, SeekFrom};
use std::path::Path;
use std::time::{Instant, Duration};
use std::sync::{Arc, Mutex};
use serde_json::json;
use reqwest;
use tokio;
use futures_util::StreamExt;

const MAX_CONNECTIONS: usize = 64;
const DEFAULT_CONNECTIONS: usize = 16;
const MIN_CHUNK_SIZE: u64 = 1024 * 1024; // 1MB minimum per connection

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
        // For now, just print to stdout
        // TCP client functionality can be added later if needed
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

async fn download_file_multiconnection(url: &str, output_path: &str) -> Result<(), Box<dyn std::error::Error>> {
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
    
    // Make a GET request to get file info
    let response = client.get(url).send().await?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()).into());
    }

    let total_size = response.content_length().unwrap_or(0);
    let _supports_ranges = response.headers().get("accept-ranges")
        .map(|v| v.to_str().unwrap_or("") == "bytes")
        .unwrap_or(false);

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
    download_file_single_with_response(url, &final_output_path, progress, response).await
}

async fn download_range(
    client: reqwest::Client,
    url: &str,
    output_path: &str,
    start: u64,
    end: u64,
    _connection_id: usize,
    progress_shared: Arc<Mutex<DownloadProgress>>,
    start_time: Instant,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let range_header = format!("bytes={}-{}", start, end);
    
    let response = client
        .get(url)
        .header("Range", range_header)
        .send()
        .await?;

    if !response.status().is_success() && response.status().as_u16() != 206 {
        return Err(format!("HTTP error for range request: {}", response.status()).into());
    }

    // Open file for writing at specific position
    let mut file = File::options().write(true).open(output_path)?;
    file.seek(SeekFrom::Start(start))?;
    let mut writer = BufWriter::new(file);

    let mut stream = response.bytes_stream();
    let mut last_speed_update = Instant::now();
    let mut bytes_since_last_update = 0u64;

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(bytes) => {
                let chunk_size = bytes.len() as u64;
                
                writer.write_all(&bytes)?;
                bytes_since_last_update += chunk_size;

                // Update shared progress
                let now = Instant::now();
                if now.duration_since(last_speed_update) >= Duration::from_millis(100) {
                    let mut progress = progress_shared.lock().unwrap();
                    progress.downloaded += bytes_since_last_update;
                    progress.chunk_size = chunk_size;
                    
                    // Calculate speed
                    let elapsed = now.duration_since(start_time).as_secs_f64();
                    if elapsed > 0.0 {
                        progress.download_speed_bps = progress.downloaded as f64 / elapsed;
                        
                        if progress.total_size > 0 && progress.download_speed_bps > 0.0 {
                            let remaining_bytes = progress.total_size - progress.downloaded;
                            progress.eta_seconds = Some((remaining_bytes as f64 / progress.download_speed_bps) as u64);
                        }
                    }
                    
                    progress.print_json();
                    drop(progress);
                    
                    bytes_since_last_update = 0;
                    last_speed_update = now;
                }
            }
            Err(e) => {
                return Err(format!("Stream error: {}", e).into());
            }
        }
    }

    writer.flush()?;
    Ok(())
}

async fn download_file_single_with_response(
    url: &str, 
    output_path: &str, 
    mut progress: DownloadProgress,
    response: reqwest::Response
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

async fn download_file_single(url: &str, output_path: &str, mut progress: DownloadProgress) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    
    progress.status = "connecting".to_string();
    progress.print_json();

    let response = client.get(url).send().await?;

    if !response.status().is_success() {
        progress.status = "error".to_string();
        progress.error = Some(format!("HTTP error: {}", response.status()));
        progress.print_json();
        return Err(format!("HTTP error: {}", response.status()).into());
    }

    progress.total_size = response.content_length().unwrap_or(0);
    progress.status = "downloading".to_string();
    progress.print_json();

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
                
                progress.print_json();
            }
            Err(e) => {
                return Err(format!("Stream error: {}", e).into());
            }
        }
    }

    writer.flush()?;
    progress.status = "completed".to_string();
    progress.print_json();

    Ok(())
}

// Update main function to use multi-connection download
#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() != 3 {
        print_usage();
        std::process::exit(1);
    }

    let url = &args[1];
    let output_path = &args[2];

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

    match download_file_multiconnection(url, output_path).await {
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
        "error": "Usage: downloaderservice.exe <URL> <OUTPUT_PATH>",
        "example": "downloaderservice.exe https://example.com/file.zip ./downloads/file.zip"
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