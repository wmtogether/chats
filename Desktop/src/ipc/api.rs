// API handlers for IPC requests
use serde_json::{json, Value, Map};
use std::collections::HashMap;
use reqwest;

// ERP server configuration
const ERP_BASE_URL: &str = "http://10.10.60.8:1669";

pub async fn handle_api_request(
    method: &str,
    path: &str,
    body: Option<&Value>,
    headers: Option<&Map<String, Value>>,
) -> Value {
    println!("🔄 Handling API request: {} {}", method, path);
    
    // Extract session ID from headers
    let session_id = headers
        .and_then(|h| h.get("X-Session-Id"))
        .and_then(|v| v.as_str())
        .unwrap_or("desktop-session");

    // Route the request based on path and method
    match (method, path) {
        // Authentication endpoints
        ("POST", "/auth/login") => handle_login(body, session_id).await,
        ("POST", "/auth/logout") => handle_logout(session_id).await,
        ("GET", "/auth/status") => handle_auth_status(session_id).await,
        
        // Threads endpoints
        ("GET", path) if path.starts_with("/api/threads") => {
            if path == "/api/threads" || path.contains("?") {
                handle_get_threads(path, headers).await
            } else if path.contains("/messages") {
                // Handle /api/threads/{id}/messages
                handle_get_messages(path, headers).await
            } else {
                // Handle /api/threads/{id}
                handle_get_thread(path, headers).await
            }
        }
        ("POST", path) if path.starts_with("/api/threads") && path.contains("/messages") => {
            handle_send_message(path, body, headers).await
        }
        ("PATCH", path) if path.starts_with("/api/threads") && path.contains("/messages") => {
            handle_edit_message(path, body, headers).await
        }
        ("DELETE", path) if path.starts_with("/api/threads") && path.contains("/messages") => {
            handle_delete_message(path, headers).await
        }
        ("POST", path) if path.starts_with("/api/threads") && path.contains("/reactions") => {
            handle_add_reaction(path, body, headers).await
        }
        ("PATCH", path) if path.starts_with("/api/threads") => {
            handle_update_thread(path, body, headers).await
        }
        ("DELETE", path) if path.starts_with("/api/threads") => {
            handle_delete_thread(path, headers).await
        }
        
        // Queue endpoints
        ("GET", path) if path.starts_with("/api/queue") => {
            handle_get_queue(path, headers).await
        }
        ("POST", "/api/queue") => handle_create_queue(body, headers).await,
        ("PATCH", path) if path.starts_with("/api/queue") => {
            handle_update_queue(path, body, headers).await
        }
        
        // Health check
        ("GET", "/health") => {
            json!({
                "success": true,
                "status": "ok",
                "server": "desktop-backend",
                "timestamp": chrono::Utc::now().timestamp()
            })
        }
        
        _ => {
            json!({
                "success": false,
                "error": format!("Unknown endpoint: {} {}", method, path)
            })
        }
    }
}

async fn handle_login(body: Option<&Value>, session_id: &str) -> Value {
    println!("🔐 Handling login for session: {}", session_id);
    
    let credentials = match body {
        Some(body) => body,
        None => return json!({
            "success": false,
            "error": "Missing login credentials"
        })
    };

    // Forward to ERP server
    let client = reqwest::Client::new();
    let erp_url = "http://10.10.60.8:1669/api/auth/login";
    
    match client.post(erp_url).json(credentials).send().await {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(response_text) => {
                    if status.is_success() {
                        match serde_json::from_str::<Value>(&response_text) {
                            Ok(login_response) => {
                                // Store session if login successful
                                if let (Some(success), Some(token), Some(user)) = (
                                    login_response.get("success").and_then(|v| v.as_bool()),
                                    login_response.get("token").and_then(|v| v.as_str()),
                                    login_response.get("user")
                                ) {
                                    if success {
                                        // TODO: Store session in memory or file
                                        println!("✅ Login successful for session: {}", session_id);
                                    }
                                }
                                login_response
                            }
                            Err(_) => json!({
                                "success": false,
                                "error": "Invalid response format"
                            })
                        }
                    } else {
                        json!({
                            "success": false,
                            "error": format!("Login failed: {}", response_text)
                        })
                    }
                }
                Err(e) => json!({
                    "success": false,
                    "error": format!("Failed to read response: {}", e)
                })
            }
        }
        Err(e) => json!({
            "success": false,
            "error": format!("Request failed: {}", e)
        })
    }
}

async fn handle_logout(session_id: &str) -> Value {
    println!("🚪 Handling logout for session: {}", session_id);
    // TODO: Clear session data
    json!({
        "success": true,
        "message": "Logged out successfully"
    })
}

async fn handle_auth_status(session_id: &str) -> Value {
    println!("🔍 Checking auth status for session: {}", session_id);
    // TODO: Check if session is valid
    json!({
        "authenticated": false,
        "sessionId": session_id
    })
}

async fn handle_get_threads(path: &str, headers: Option<&Map<String, Value>>) -> Value {
    println!("📋 Handling get threads request: {}", path);
    
    // Extract query parameters from path
    let query_string = if let Some(pos) = path.find('?') {
        &path[pos+1..]
    } else {
        ""
    };
    
    // Forward to ERP server
    let client = reqwest::Client::new();
    let erp_url = format!("{}/api/threads?{}", ERP_BASE_URL, query_string);
    
    match client.get(&erp_url).send().await {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(response_text) => {
                    if status.is_success() {
                        match serde_json::from_str::<Value>(&response_text) {
                            Ok(mut data) => {
                                // Ensure success field is set
                                if data.get("success").is_none() {
                                    data["success"] = json!(true);
                                }
                                data
                            }
                            Err(_) => json!({
                                "success": false,
                                "error": "Invalid response format"
                            })
                        }
                    } else {
                        json!({
                            "success": false,
                            "error": format!("ERP server error: {}", response_text)
                        })
                    }
                }
                Err(e) => json!({
                    "success": false,
                    "error": format!("Failed to read response: {}", e)
                })
            }
        }
        Err(e) => json!({
            "success": false,
            "error": format!("Request failed: {}", e)
        })
    }
}

async fn handle_get_thread(path: &str, headers: Option<&Map<String, Value>>) -> Value {
    println!("📋 Handling get thread request: {}", path);
    
    // Extract thread ID from path
    let thread_id = path.split('/').nth(3).unwrap_or("unknown");
    
    // Forward to ERP server
    let client = reqwest::Client::new();
    let erp_url = format!("{}/api/threads/{}", ERP_BASE_URL, thread_id);
    
    match client.get(&erp_url).send().await {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(response_text) => {
                    if status.is_success() {
                        match serde_json::from_str::<Value>(&response_text) {
                            Ok(mut data) => {
                                if data.get("success").is_none() {
                                    data["success"] = json!(true);
                                }
                                data
                            }
                            Err(_) => json!({
                                "success": false,
                                "error": "Invalid response format"
                            })
                        }
                    } else {
                        json!({
                            "success": false,
                            "error": format!("Thread not found: {}", thread_id)
                        })
                    }
                }
                Err(e) => json!({
                    "success": false,
                    "error": format!("Failed to read response: {}", e)
                })
            }
        }
        Err(e) => json!({
            "success": false,
            "error": format!("Request failed: {}", e)
        })
    }
}

async fn handle_get_messages(path: &str, headers: Option<&Map<String, Value>>) -> Value {
    println!("💬 Handling get messages request: {}", path);
    
    // Extract thread identifier from path
    let parts: Vec<&str> = path.split('/').collect();
    let identifier = if parts.len() >= 4 { parts[3] } else { "unknown" };
    
    // Extract query parameters
    let query_string = if let Some(pos) = path.find('?') {
        &path[pos+1..]
    } else {
        ""
    };
    
    // Forward to ERP server
    let client = reqwest::Client::new();
    let erp_url = format!("{}/api/threads/{}/messages?{}", ERP_BASE_URL, identifier, query_string);
    
    match client.get(&erp_url).send().await {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(response_text) => {
                    if status.is_success() {
                        match serde_json::from_str::<Value>(&response_text) {
                            Ok(mut data) => {
                                if data.get("success").is_none() {
                                    data["success"] = json!(true);
                                }
                                data
                            }
                            Err(_) => json!({
                                "success": false,
                                "error": "Invalid response format"
                            })
                        }
                    } else {
                        json!({
                            "success": false,
                            "error": format!("Failed to get messages: {}", response_text)
                        })
                    }
                }
                Err(e) => json!({
                    "success": false,
                    "error": format!("Failed to read response: {}", e)
                })
            }
        }
        Err(e) => json!({
            "success": false,
            "error": format!("Request failed: {}", e)
        })
    }
}

async fn handle_send_message(path: &str, body: Option<&Value>, headers: Option<&Map<String, Value>>) -> Value {
    println!("📤 Handling send message request: {}", path);
    
    let message_data = match body {
        Some(body) => body,
        None => return json!({
            "success": false,
            "error": "Missing message data"
        })
    };

    // Extract thread identifier from path
    let parts: Vec<&str> = path.split('/').collect();
    let identifier = if parts.len() >= 4 { parts[3] } else { "unknown" };
    
    // Forward to ERP server
    let client = reqwest::Client::new();
    let erp_url = format!("{}/api/threads/{}/messages", ERP_BASE_URL, identifier);
    
    match client.post(&erp_url).json(message_data).send().await {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(response_text) => {
                    if status.is_success() {
                        match serde_json::from_str::<Value>(&response_text) {
                            Ok(mut data) => {
                                if data.get("success").is_none() {
                                    data["success"] = json!(true);
                                }
                                data
                            }
                            Err(_) => json!({
                                "success": false,
                                "error": "Invalid response format"
                            })
                        }
                    } else {
                        json!({
                            "success": false,
                            "error": format!("Failed to send message: {}", response_text)
                        })
                    }
                }
                Err(e) => json!({
                    "success": false,
                    "error": format!("Failed to read response: {}", e)
                })
            }
        }
        Err(e) => json!({
            "success": false,
            "error": format!("Request failed: {}", e)
        })
    }
}

async fn handle_edit_message(path: &str, body: Option<&Value>, headers: Option<&Map<String, Value>>) -> Value {
    println!("✏️ Handling edit message request: {}", path);
    
    let message_data = match body {
        Some(body) => body,
        None => return json!({
            "success": false,
            "error": "Missing message data"
        })
    };

    // Extract thread identifier and message ID from path
    let parts: Vec<&str> = path.split('/').collect();
    let identifier = if parts.len() >= 4 { parts[3] } else { "unknown" };
    let message_id = if parts.len() >= 6 { parts[5] } else { "unknown" };
    
    // Forward to ERP server
    let client = reqwest::Client::new();
    let erp_url = format!("{}/api/threads/{}/messages/{}", ERP_BASE_URL, identifier, message_id);
    
    match client.patch(&erp_url).json(message_data).send().await {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(response_text) => {
                    if status.is_success() {
                        match serde_json::from_str::<Value>(&response_text) {
                            Ok(mut data) => {
                                if data.get("success").is_none() {
                                    data["success"] = json!(true);
                                }
                                data
                            }
                            Err(_) => json!({
                                "success": false,
                                "error": "Invalid response format"
                            })
                        }
                    } else {
                        json!({
                            "success": false,
                            "error": format!("Failed to edit message: {}", response_text)
                        })
                    }
                }
                Err(e) => json!({
                    "success": false,
                    "error": format!("Failed to read response: {}", e)
                })
            }
        }
        Err(e) => json!({
            "success": false,
            "error": format!("Request failed: {}", e)
        })
    }
}

async fn handle_delete_message(path: &str, headers: Option<&Map<String, Value>>) -> Value {
    println!("🗑️ Handling delete message request: {}", path);
    
    // Extract thread identifier and message ID from path
    let parts: Vec<&str> = path.split('/').collect();
    let identifier = if parts.len() >= 4 { parts[3] } else { "unknown" };
    let message_id = if parts.len() >= 6 { parts[5] } else { "unknown" };
    
    // Forward to ERP server
    let client = reqwest::Client::new();
    let erp_url = format!("{}/api/threads/{}/messages/{}", ERP_BASE_URL, identifier, message_id);
    
    match client.delete(&erp_url).send().await {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(response_text) => {
                    if status.is_success() {
                        json!({
                            "success": true
                        })
                    } else {
                        json!({
                            "success": false,
                            "error": format!("Failed to delete message: {}", response_text)
                        })
                    }
                }
                Err(e) => json!({
                    "success": false,
                    "error": format!("Failed to read response: {}", e)
                })
            }
        }
        Err(e) => json!({
            "success": false,
            "error": format!("Request failed: {}", e)
        })
    }
}

async fn handle_add_reaction(path: &str, body: Option<&Value>, headers: Option<&Map<String, Value>>) -> Value {
    println!("😀 Handling add reaction request: {}", path);
    
    let reaction_data = match body {
        Some(body) => body,
        None => return json!({
            "success": false,
            "error": "Missing reaction data"
        })
    };

    // Extract thread identifier and message ID from path
    let parts: Vec<&str> = path.split('/').collect();
    let identifier = if parts.len() >= 4 { parts[3] } else { "unknown" };
    let message_id = if parts.len() >= 6 { parts[5] } else { "unknown" };
    
    // Forward to ERP server
    let client = reqwest::Client::new();
    let erp_url = format!("{}/api/threads/{}/messages/{}/reactions", ERP_BASE_URL, identifier, message_id);
    
    match client.post(&erp_url).json(reaction_data).send().await {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(response_text) => {
                    if status.is_success() {
                        match serde_json::from_str::<Value>(&response_text) {
                            Ok(mut data) => {
                                if data.get("success").is_none() {
                                    data["success"] = json!(true);
                                }
                                data
                            }
                            Err(_) => json!({
                                "success": false,
                                "error": "Invalid response format"
                            })
                        }
                    } else {
                        json!({
                            "success": false,
                            "error": format!("Failed to add reaction: {}", response_text)
                        })
                    }
                }
                Err(e) => json!({
                    "success": false,
                    "error": format!("Failed to read response: {}", e)
                })
            }
        }
        Err(e) => json!({
            "success": false,
            "error": format!("Request failed: {}", e)
        })
    }
}

async fn handle_update_thread(path: &str, body: Option<&Value>, headers: Option<&Map<String, Value>>) -> Value {
    println!("🔄 Handling update thread request: {}", path);
    
    let update_data = match body {
        Some(body) => body,
        None => return json!({
            "success": false,
            "error": "Missing update data"
        })
    };

    // Extract thread ID from path
    let thread_id = path.split('/').nth(3).unwrap_or("unknown");
    
    // Forward to ERP server
    let client = reqwest::Client::new();
    let erp_url = format!("{}/api/threads/{}", ERP_BASE_URL, thread_id);
    
    match client.patch(&erp_url).json(update_data).send().await {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(response_text) => {
                    if status.is_success() {
                        match serde_json::from_str::<Value>(&response_text) {
                            Ok(mut data) => {
                                if data.get("success").is_none() {
                                    data["success"] = json!(true);
                                }
                                data
                            }
                            Err(_) => json!({
                                "success": false,
                                "error": "Invalid response format"
                            })
                        }
                    } else {
                        json!({
                            "success": false,
                            "error": format!("Failed to update thread: {}", response_text)
                        })
                    }
                }
                Err(e) => json!({
                    "success": false,
                    "error": format!("Failed to read response: {}", e)
                })
            }
        }
        Err(e) => json!({
            "success": false,
            "error": format!("Request failed: {}", e)
        })
    }
}

async fn handle_delete_thread(path: &str, headers: Option<&Map<String, Value>>) -> Value {
    println!("🗑️ Handling delete thread request: {}", path);
    
    // Extract thread ID from path
    let thread_id = path.split('/').nth(3).unwrap_or("unknown");
    
    // Forward to ERP server
    let client = reqwest::Client::new();
    let erp_url = format!("{}/api/threads/{}", ERP_BASE_URL, thread_id);
    
    match client.delete(&erp_url).send().await {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(response_text) => {
                    if status.is_success() {
                        json!({
                            "success": true
                        })
                    } else {
                        json!({
                            "success": false,
                            "error": format!("Failed to delete thread: {}", response_text)
                        })
                    }
                }
                Err(e) => json!({
                    "success": false,
                    "error": format!("Failed to read response: {}", e)
                })
            }
        }
        Err(e) => json!({
            "success": false,
            "error": format!("Request failed: {}", e)
        })
    }
}

async fn handle_create_queue(body: Option<&Value>, headers: Option<&Map<String, Value>>) -> Value {
    println!("🆕 Handling create queue request");
    
    let queue_data = match body {
        Some(body) => body,
        None => return json!({
            "success": false,
            "error": "Missing queue data"
        })
    };
    
    // Forward to ERP server
    let client = reqwest::Client::new();
    let erp_url = format!("{}/api/queue", ERP_BASE_URL);
    
    match client.post(&erp_url).json(queue_data).send().await {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(response_text) => {
                    if status.is_success() {
                        match serde_json::from_str::<Value>(&response_text) {
                            Ok(mut data) => {
                                if data.get("success").is_none() {
                                    data["success"] = json!(true);
                                }
                                data
                            }
                            Err(_) => json!({
                                "success": false,
                                "error": "Invalid response format"
                            })
                        }
                    } else {
                        json!({
                            "success": false,
                            "error": format!("Failed to create queue: {}", response_text)
                        })
                    }
                }
                Err(e) => json!({
                    "success": false,
                    "error": format!("Failed to read response: {}", e)
                })
            }
        }
        Err(e) => json!({
            "success": false,
            "error": format!("Request failed: {}", e)
        })
    }
}

async fn handle_get_queue(path: &str, headers: Option<&Map<String, Value>>) -> Value {
    println!("📋 Handling get queue request: {}", path);
    
    // Extract queue ID from path
    let queue_id = path.split('/').nth(3).unwrap_or("unknown");
    
    // Forward to ERP server
    let client = reqwest::Client::new();
    let erp_url = format!("{}/api/queue/{}", ERP_BASE_URL, queue_id);
    
    match client.get(&erp_url).send().await {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(response_text) => {
                    if status.is_success() {
                        match serde_json::from_str::<Value>(&response_text) {
                            Ok(mut data) => {
                                if data.get("success").is_none() {
                                    data["success"] = json!(true);
                                }
                                data
                            }
                            Err(_) => json!({
                                "success": false,
                                "error": "Invalid response format"
                            })
                        }
                    } else {
                        json!({
                            "success": false,
                            "error": format!("Queue not found: {}", queue_id)
                        })
                    }
                }
                Err(e) => json!({
                    "success": false,
                    "error": format!("Failed to read response: {}", e)
                })
            }
        }
        Err(e) => json!({
            "success": false,
            "error": format!("Request failed: {}", e)
        })
    }
}

async fn handle_update_queue(path: &str, body: Option<&Value>, headers: Option<&Map<String, Value>>) -> Value {
    println!("🔄 Handling update queue request: {}", path);
    
    let update_data = match body {
        Some(body) => body,
        None => return json!({
            "success": false,
            "error": "Missing update data"
        })
    };

    // Extract queue ID from path
    let queue_id = path.split('/').nth(3).unwrap_or("unknown");
    
    // Forward to ERP server
    let client = reqwest::Client::new();
    let erp_url = format!("{}/api/queue/{}", ERP_BASE_URL, queue_id);
    
    match client.patch(&erp_url).json(update_data).send().await {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(response_text) => {
                    if status.is_success() {
                        match serde_json::from_str::<Value>(&response_text) {
                            Ok(mut data) => {
                                if data.get("success").is_none() {
                                    data["success"] = json!(true);
                                }
                                data
                            }
                            Err(_) => json!({
                                "success": false,
                                "error": "Invalid response format"
                            })
                        }
                    } else {
                        json!({
                            "success": false,
                            "error": format!("Failed to update queue: {}", response_text)
                        })
                    }
                }
                Err(e) => json!({
                    "success": false,
                    "error": format!("Failed to read response: {}", e)
                })
            }
        }
        Err(e) => json!({
            "success": false,
            "error": format!("Request failed: {}", e)
        })
    }
}