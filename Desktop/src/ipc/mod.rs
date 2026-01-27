// IPC (Inter-Process Communication) handlers
use crate::core::SharedAppState;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::mpsc::{self, Receiver, Sender};

pub mod dialog;
pub mod api;

// Channel for API responses to avoid mutex contention
lazy_static::lazy_static! {
    static ref API_RESPONSE_SENDER: std::sync::Mutex<Option<Sender<(String, String)>>> = std::sync::Mutex::new(None);
    static ref API_RESPONSE_RECEIVER: std::sync::Mutex<Option<Receiver<(String, String)>>> = std::sync::Mutex::new(None);
}

// Initialize the API response channel
pub fn init_api_channel() {
    let (sender, receiver) = mpsc::channel();
    *API_RESPONSE_SENDER.lock().unwrap() = Some(sender);
    *API_RESPONSE_RECEIVER.lock().unwrap() = Some(receiver);
}

pub fn handle_ipc_message(request: http::Request<String>, state: SharedAppState) {
    let body = request.body();
    
    // Try to parse as JSON for structured commands
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(action) = parsed.get("action").and_then(|v| v.as_str()) {
            match action {
                "api_request" => {
                    // Handle API requests through IPC
                    handle_api_request(parsed, state);
                    return;
                }
                "show_context_menu" => {
                    // Handle context menu (existing code)
                    if let (Some(x), Some(y)) = (
                        parsed.get("x").and_then(|v| v.as_i64()),
                        parsed.get("y").and_then(|v| v.as_i64())
                    ) {
                        println!("Context menu requested at ({}, {})", x, y);
                    }
                    return;
                }
                "logout" => {
                    // Handle logout - clear JWT tokens
                    let session_id = parsed.get("sessionId")
                        .and_then(|v| v.as_str())
                        .unwrap_or("desktop-session");
                    
                    remove_jwt_token(session_id);
                    return;
                }
                _ => {}
            }
        }
    }
    
    // Handle simple string commands (existing functionality)
    match body.as_str() {
        "get_state" => {
            let state = state.lock().unwrap();
            println!("State requested - counter: {}", state.counter);
        }
        "test_ipc" => {
            println!("✅ IPC test successful");
        }
        _ => {}
    }
}

fn handle_api_request(request: Value, state: SharedAppState) {
    let request_id = request.get("requestId").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
    let method = request.get("method").and_then(|v| v.as_str()).unwrap_or("GET").to_string();
    let path = request.get("path").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let body = request.get("body").cloned();
    let headers = request.get("headers").and_then(|v| v.as_object()).cloned();

    println!("🔄 Processing API request: {} {} (ID: {})", method, path, request_id);
    let start_time = std::time::Instant::now();

    // Handle the API request in a separate thread and send result via channel
    std::thread::Builder::new()
        .name(format!("api-{}", request_id))
        .spawn(move || {
            let thread_start = std::time::Instant::now();
            let result = handle_api_request_sync(&method, &path, body.as_ref(), headers.as_ref());
            let api_elapsed = thread_start.elapsed();
            
            let response_json = serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string());
            
            println!("✅ API request completed: {} (ID: {}) in {:?}", path, request_id, api_elapsed);
            
            // Send response via channel instead of shared state
            let channel_start = std::time::Instant::now();
            if let Ok(sender_guard) = API_RESPONSE_SENDER.lock() {
                if let Some(sender) = sender_guard.as_ref() {
                    let _ = sender.send((request_id.clone(), response_json));
                    let channel_elapsed = channel_start.elapsed();
                    println!("📡 Response sent via channel: {} in {:?}", request_id, channel_elapsed);
                }
            }
            
            let total_elapsed = start_time.elapsed();
            println!("🎯 Total request processing time: {} in {:?}", request_id, total_elapsed);
        })
        .expect("Failed to spawn API request thread");
}

// Function to get pending API responses and execute JavaScript immediately
pub fn process_pending_responses(webview: &wry::WebView) {
    let check_start = std::time::Instant::now();
    let responses = check_api_responses();
    let check_elapsed = check_start.elapsed();
    
    if !responses.is_empty() {
        println!("📡 Processing {} pending responses (check took {:?})", responses.len(), check_elapsed);
    }
    
    for (request_id, response_json) in responses {
        let js_start = std::time::Instant::now();
        
        // Execute JavaScript immediately without going through the event loop
        let js_code = format!(
            "try{{var c=window.apiCallbacks;if(c&&c['{}']){{c['{}']({});delete c['{}'];}}}}catch(e){{console.error('JS callback error:',e);}}",
            request_id.replace('\'', "\\'"), 
            request_id.replace('\'', "\\'"), 
            response_json,
            request_id.replace('\'', "\\'")
        );
        
        let eval_result = webview.evaluate_script(&js_code);
        let js_elapsed = js_start.elapsed();
        
        match eval_result {
            Ok(_) => println!("✅ JavaScript executed for {}: {:?}", request_id, js_elapsed),
            Err(e) => println!("❌ JavaScript execution failed for {}: {} (took {:?})", request_id, e, js_elapsed),
        }
    }
}

// JWT token storage with persistence
use std::sync::Mutex;
use serde::{Serialize, Deserialize};
use std::fs;
use std::path::PathBuf;

// Global HTTP client for better performance
lazy_static::lazy_static! {
    static ref HTTP_CLIENT: reqwest::blocking::Client = {
        reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(8))
            .connect_timeout(std::time::Duration::from_secs(3))
            .tcp_keepalive(std::time::Duration::from_secs(30))
            .pool_idle_timeout(std::time::Duration::from_secs(30))
            .pool_max_idle_per_host(30)
            .tcp_nodelay(true)
            .build()
            .unwrap_or_else(|_| reqwest::blocking::Client::new())
    };
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct TokenData {
    token: String,
    created_at: chrono::DateTime<chrono::Utc>,
    expires_at: Option<chrono::DateTime<chrono::Utc>>,
}

lazy_static::lazy_static! {
    static ref JWT_TOKENS: Mutex<HashMap<String, TokenData>> = Mutex::new(HashMap::new());
}

// Get the path for storing tokens
fn get_token_storage_path() -> PathBuf {
    let mut path = std::env::current_exe()
        .unwrap_or_else(|_| std::env::current_dir().unwrap().join("mikochat.exe"))
        .parent()
        .unwrap_or(&std::env::current_dir().unwrap())
        .to_path_buf();
    
    path.push(".mikochat_tokens.bin");
    path
}

// Load tokens from binary file
fn load_tokens_from_file() -> HashMap<String, TokenData> {
    let path = get_token_storage_path();
    
    match fs::read(&path) {
        Ok(data) => {
            match bincode::deserialize::<HashMap<String, TokenData>>(&data) {
                Ok(mut tokens) => {
                    // Clean up expired tokens
                    let now = chrono::Utc::now();
                    tokens.retain(|session_id, token_data| {
                        if let Some(expires_at) = token_data.expires_at {
                            if now > expires_at {
                                println!("🔑 Removing expired token for session: {}", session_id);
                                return false;
                            }
                        }
                        
                        // Also remove tokens older than 24 hours as a safety measure
                        let age = now.signed_duration_since(token_data.created_at);
                        if age.num_hours() > 24 {
                            println!("🔑 Removing old token for session: {} (age: {} hours)", session_id, age.num_hours());
                            return false;
                        }
                        
                        true
                    });
                    
                    println!("🔑 Loaded {} valid tokens from storage", tokens.len());
                    tokens
                }
                Err(e) => {
                    println!("⚠️ Failed to deserialize tokens: {}", e);
                    HashMap::new()
                }
            }
        }
        Err(_) => {
            println!("🔑 No existing token storage found, starting fresh");
            HashMap::new()
        }
    }
}

// Save tokens to binary file
fn save_tokens_to_file(tokens: &HashMap<String, TokenData>) {
    let path = get_token_storage_path();
    
    match bincode::serialize(tokens) {
        Ok(data) => {
            match fs::write(&path, data) {
                Ok(_) => {
                    println!("🔑 Saved {} tokens to storage: {}", tokens.len(), path.display());
                }
                Err(e) => {
                    println!("⚠️ Failed to save tokens to file: {}", e);
                }
            }
        }
        Err(e) => {
            println!("⚠️ Failed to serialize tokens: {}", e);
        }
    }
}

// Initialize token storage and warm up HTTP connections
pub fn init_token_storage() {
    let loaded_tokens = load_tokens_from_file();
    if let Ok(mut tokens) = JWT_TOKENS.lock() {
        *tokens = loaded_tokens;
    }
    
    // Warm up HTTP connection in background
    std::thread::spawn(|| {
        let _ = HTTP_CLIENT.get("http://10.10.60.8:1669/health")
            .timeout(std::time::Duration::from_secs(2))
            .send();
    });
}

// Check for API responses via channel (non-blocking)
pub fn check_api_responses() -> Vec<(String, String)> {
    let mut responses = Vec::new();
    
    if let Ok(receiver_guard) = API_RESPONSE_RECEIVER.lock() {
        if let Some(receiver) = receiver_guard.as_ref() {
            // Collect all available responses without blocking
            while let Ok((request_id, response_json)) = receiver.try_recv() {
                responses.push((request_id, response_json));
            }
        }
    }
    
    responses
}

// Store a JWT token with persistence
fn store_jwt_token(session_id: &str, token: &str) {
    let token_data = TokenData {
        token: token.to_string(),
        created_at: chrono::Utc::now(),
        expires_at: None, // We'll let the server handle expiration
    };
    
    if let Ok(mut tokens) = JWT_TOKENS.lock() {
        tokens.insert(session_id.to_string(), token_data);
        
        // Save to file
        save_tokens_to_file(&tokens);
    }
}

// Get a JWT token
fn get_jwt_token(session_id: &str) -> Option<String> {
    if let Ok(tokens) = JWT_TOKENS.lock() {
        tokens.get(session_id).map(|token_data| token_data.token.clone())
    } else {
        None
    }
}

// Remove a JWT token with persistence
fn remove_jwt_token(session_id: &str) {
    if let Ok(mut tokens) = JWT_TOKENS.lock() {
        if tokens.remove(session_id).is_some() {
            save_tokens_to_file(&tokens);
        }
    }
}

fn handle_api_request_sync(
    method: &str,
    path: &str,
    body: Option<&Value>,
    headers: Option<&serde_json::Map<String, Value>>,
) -> Value {
    // Extract session ID for JWT token lookup
    let session_id = headers
        .and_then(|h| h.get("X-Session-Id"))
        .and_then(|v| v.as_str())
        .unwrap_or("desktop-session");
    
    // Handle auth status locally with immediate response
    if method == "GET" && path == "/api/auth/status" {
        let has_token = get_jwt_token(session_id).is_some();
        
        return json!({
            "success": true,
            "authenticated": has_token,
            "sessionId": session_id,
            "timestamp": chrono::Utc::now().timestamp()
        });
    }
    
    // Handle logout locally with immediate response
    if method == "POST" && path == "/api/auth/logout" {
        remove_jwt_token(session_id);
        
        return json!({
            "success": true,
            "message": "Logged out successfully",
            "timestamp": chrono::Utc::now().timestamp()
        });
    }
    
    // Handle profile picture requests
    if method == "GET" && path.starts_with("/api/fileupload/profiles/") {
        // Use the global HTTP client for images too
        let image_client = &*HTTP_CLIENT;
        
        // Forward profile picture requests to the ERP server
        let profile_url = format!("http://10.10.60.8:1669{}", path);
        
        // Add JWT token if available
        let mut request_builder = image_client.get(&profile_url);
        if let Some(token) = get_jwt_token(session_id) {
            request_builder = request_builder.header("Authorization", format!("Bearer {}", token));
        }
        
        match request_builder.send() {
            Ok(response) => {
                let status: reqwest::StatusCode = response.status();
                if status.is_success() {
                    // Get content type before consuming response
                    let content_type = response.headers()
                        .get("content-type")
                        .and_then(|ct: &reqwest::header::HeaderValue| ct.to_str().ok())
                        .unwrap_or("image/jpeg")
                        .to_string();
                    
                    match response.bytes() {
                        Ok(image_bytes) => {
                            // Convert image bytes to base64 for frontend
                            use base64::{Engine as _, engine::general_purpose};
                            let base64_image = general_purpose::STANDARD.encode(&image_bytes);
                            
                            return json!({
                                "success": true,
                                "imageData": format!("data:{};base64,{}", content_type, base64_image),
                                "contentType": content_type
                            });
                        }
                        Err(e) => {
                            return json!({
                                "success": false,
                                "error": format!("Failed to read image: {}", e)
                            });
                        }
                    }
                } else {
                    return json!({
                        "success": false,
                        "error": format!("Profile picture not found: HTTP {}", status)
                    });
                }
            }
            Err(e) => {
                return json!({
                    "success": false,
                    "error": format!("Failed to fetch profile picture: {}", e)
                });
            }
        }
    }
    
    // Use the global pre-initialized HTTP client for better performance
    let client = &*HTTP_CLIENT;
        
    let erp_url = format!("http://10.10.60.8:1669{}", path);
    
    let mut request_builder = match method {
        "GET" => client.get(&erp_url),
        "POST" => client.post(&erp_url),
        "PATCH" => client.patch(&erp_url),
        "DELETE" => client.delete(&erp_url),
        "PUT" => client.put(&erp_url),
        _ => {
            return json!({
                "success": false,
                "error": format!("Unsupported HTTP method: {}", method)
            });
        }
    };
    
    // Add headers
    request_builder = request_builder.header("Content-Type", "application/json");
    
    // Add JWT token if available
    if let Some(token) = get_jwt_token(session_id) {
        request_builder = request_builder.header("Authorization", format!("Bearer {}", token));
    }
    
    // Add other headers
    if let Some(headers) = headers {
        for (key, value) in headers {
            if let Some(value_str) = value.as_str() {
                // Skip Authorization header if we already set JWT
                if key != "Authorization" {
                    request_builder = request_builder.header(key, value_str);
                }
            }
        }
    }
    
    // Add body for POST/PATCH/PUT requests
    if let Some(body) = body {
        if method == "POST" || method == "PATCH" || method == "PUT" {
            request_builder = request_builder.json(body);
        }
    }
    
    // Send the request
    match request_builder.send() {
        Ok(response) => {
            let status = response.status();
            match response.text() {
                Ok(response_text) => {
                    if status.is_success() {
                        match serde_json::from_str::<Value>(&response_text) {
                            Ok(mut data) => {
                                // Store JWT token if this is a login response
                                if path.contains("/auth/login") && data.get("token").is_some() {
                                    if let Some(token) = data.get("token").and_then(|t| t.as_str()) {
                                        store_jwt_token(session_id, token);
                                    }
                                }
                                
                                // Transform threads response to match frontend expectations
                                if path.contains("/api/threads") && method == "GET" {
                                    if let Some(chats) = data.get("chats") {
                                        // Transform the response to match frontend expectations
                                        let mut transformed = json!({
                                            "success": true,
                                            "threads": chats,
                                            "total": data.get("total").unwrap_or(&json!(0)),
                                            "page": data.get("page").unwrap_or(&json!(1)),
                                            "limit": data.get("limit").unwrap_or(&json!(50))
                                        });
                                        
                                        println!("✅ Transformed threads response: {} threads found", 
                                            chats.as_array().map(|arr| arr.len()).unwrap_or(0));
                                        return transformed;
                                    }
                                }
                                
                                // Transform messages response to match frontend expectations
                                if path.contains("/messages") && method == "GET" {
                                    if let Some(messages) = data.get("messages") {
                                        let transformed = json!({
                                            "success": true,
                                            "messages": messages
                                        });
                                        
                                        println!("✅ Transformed messages response: {} messages found", 
                                            messages.as_array().map(|arr| arr.len()).unwrap_or(0));
                                        return transformed;
                                    }
                                }
                                
                                // Ensure success field is set for other responses
                                if data.get("success").is_none() {
                                    data["success"] = json!(true);
                                }
                                println!("✅ API request successful");
                                data
                            }
                            Err(_) => {
                                json!({
                                    "success": false,
                                    "error": "Invalid response format"
                                })
                            }
                        }
                    } else {
                        println!("❌ API request failed with status: {}", status);
                        
                        // Clear JWT token on 401 Unauthorized
                        if status == 401 {
                            remove_jwt_token(session_id);
                        }
                        
                        json!({
                            "success": false,
                            "error": format!("HTTP {}: {}", status, response_text)
                        })
                    }
                }
                Err(e) => {
                    json!({
                        "success": false,
                        "error": format!("Failed to read response: {}", e)
                    })
                }
            }
        }
        Err(e) => {
            json!({
                "success": false,
                "error": format!("Request failed: {}", e)
            })
        }
    }
}