use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::path::{Path, PathBuf};
use std::fs;
use std::env;
use tokio;
use axum::{
    extract::Request,
    response::{Response, Json},
    http::{StatusCode, HeaderMap, Method},
    body::Body,
    routing::{get, post, any, options},
    Router,
};
use serde_json::{json, Value};
use tower_http::cors::{CorsLayer, Any};
use serde::{Serialize, Deserialize};

// Simple session storage with file persistence
type Sessions = Arc<Mutex<HashMap<String, SessionData>>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SessionData {
    token: String,
    user: Value,
    login_time: std::time::SystemTime,
}

#[derive(Debug, Serialize, Deserialize)]
struct SessionStorage {
    sessions: HashMap<String, SessionData>,
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
struct LoginRequest {
    identifier: String,
    password: Option<String>,
    #[serde(rename = "createPassword")]
    create_password: Option<bool>,
}

struct ProxyState {
    sessions: Sessions,
    client: reqwest::Client,
    erp_base_url: String,
    session_file: PathBuf,
}

impl ProxyState {
    fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        // Get the application directory (where the executable is located)
        let app_dir = match env::current_exe() {
            Ok(exe_path) => {
                exe_path.parent().unwrap_or_else(|| Path::new(".")).to_path_buf()
            }
            Err(_) => {
                // Fallback to current directory if we can't get exe path
                env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
            }
        };

        // Create session file path in app directory
        let session_file = app_dir.join("mikoproxy_sessions.json");

        println!("� Apsp directory: {}", app_dir.display());
        println!("💾 Session file: {}", session_file.display());

        let state = Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            client,
            erp_base_url: "http://10.10.60.8:1669".to_string(),
            session_file,
        };

        // Test ERP server connection
        state.test_erp_connection();

        // Load existing sessions from file
        state.load_sessions();
        state
    }

    fn test_erp_connection(&self) {
        let client = self.client.clone();
        let erp_url = self.erp_base_url.clone();
        
        tokio::spawn(async move {
            println!("🔍 Testing ERP server connection...");
            match client.get(&format!("{}/api/health", erp_url))
                .timeout(std::time::Duration::from_secs(5))
                .send()
                .await 
            {
                Ok(response) => {
                    println!("✅ ERP server connection test: {} {}", response.status(), erp_url);
                }
                Err(e) => {
                    println!("⚠️ ERP server connection test failed: {} - {}", erp_url, e);
                    println!("   This may cause API proxying issues");
                }
            }
        });
    }

    fn load_sessions(&self) {
        if self.session_file.exists() {
            match fs::read_to_string(&self.session_file) {
                Ok(content) => {
                    match serde_json::from_str::<SessionStorage>(&content) {
                        Ok(storage) => {
                            let mut sessions = self.sessions.lock().unwrap();
                            *sessions = storage.sessions;
                            println!("📂 Loaded {} sessions from {}", sessions.len(), self.session_file.display());
                        }
                        Err(e) => {
                            println!("⚠️ Failed to parse session file: {}", e);
                        }
                    }
                }
                Err(e) => {
                    println!("⚠️ Failed to read session file: {}", e);
                }
            }
        } else {
            println!("📂 No existing session file found at {}, starting fresh", self.session_file.display());
        }
    }

    fn save_sessions(&self) {
        let sessions = self.sessions.lock().unwrap();
        let storage = SessionStorage {
            sessions: sessions.clone(),
        };
        
        match serde_json::to_string_pretty(&storage) {
            Ok(content) => {
                match fs::write(&self.session_file, content) {
                    Ok(_) => {
                        println!("💾 Saved {} sessions to {}", sessions.len(), self.session_file.display());
                    }
                    Err(e) => {
                        println!("⚠️ Failed to save sessions to {}: {}", self.session_file.display(), e);
                    }
                }
            }
            Err(e) => {
                println!("⚠️ Failed to serialize sessions: {}", e);
            }
        }
    }

    fn get_session_id(&self, headers: &HeaderMap) -> String {
        headers
            .get("x-session-id")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("desktop-session")
            .to_string()
    }

    fn is_authenticated(&self, session_id: &str) -> bool {
        let sessions = self.sessions.lock().unwrap();
        sessions.contains_key(session_id)
    }

    fn get_token(&self, session_id: &str) -> Option<String> {
        let sessions = self.sessions.lock().unwrap();
        sessions.get(session_id).map(|s| s.token.clone())
    }

    fn store_session(&self, session_id: String, token: String, user: Value) {
        let mut sessions = self.sessions.lock().unwrap();
        sessions.insert(session_id.clone(), SessionData {
            token,
            user,
            login_time: std::time::SystemTime::now(),
        });
        drop(sessions); // Release the lock before saving
        
        // Save to file
        self.save_sessions();
        println!("💾 Session stored and saved to file: {}", session_id);
    }

    fn clear_session(&self, session_id: &str) {
        let mut sessions = self.sessions.lock().unwrap();
        sessions.remove(session_id);
        drop(sessions); // Release the lock before saving
        
        // Save to file
        self.save_sessions();
        println!("🗑️ Session cleared and file updated: {}", session_id);
    }

    fn cleanup_expired_sessions(&self) {
        let mut sessions = self.sessions.lock().unwrap();
        let now = std::time::SystemTime::now();
        let mut expired_sessions = Vec::new();
        
        for (session_id, session_data) in sessions.iter() {
            if let Ok(duration) = now.duration_since(session_data.login_time) {
                // Sessions expire after 7 days
                if duration.as_secs() > 7 * 24 * 60 * 60 {
                    expired_sessions.push(session_id.clone());
                }
            }
        }
        
        for session_id in &expired_sessions {
            sessions.remove(session_id);
        }
        
        if !expired_sessions.is_empty() {
            drop(sessions); // Release the lock before saving
            self.save_sessions();
            println!("🧹 Cleaned up {} expired sessions", expired_sessions.len());
        }
    }
}

async fn handle_login(
    axum::extract::State(state): axum::extract::State<Arc<ProxyState>>,
    headers: HeaderMap,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<Value>, StatusCode> {
    let session_id = state.get_session_id(&headers);
    
    println!("Login request for session: {}", session_id);
    println!("Credentials: {}", payload.identifier);

    // Forward login to ERP server
    let login_url = format!("{}/api/auth/login", state.erp_base_url);
    
    let response = match state.client
        .post(&login_url)
        .json(&payload)
        .send()
        .await
    {
        Ok(response) => response,
        Err(e) => {
            println!("Login request failed: {}", e);
            return Ok(Json(json!({
                "success": false,
                "error": format!("Request failed: {}", e)
            })));
        }
    };

    let status = response.status();
    let response_text = match response.text().await {
        Ok(text) => text,
        Err(e) => {
            println!("Failed to read response: {}", e);
            return Ok(Json(json!({
                "success": false,
                "error": "Failed to read response"
            })));
        }
    };

    println!("ERP server response status: {}", status);
    println!("ERP server response: {}", response_text);

    if !status.is_success() {
        return Ok(Json(json!({
            "success": false,
            "error": format!("Login failed with status {}: {}", status, response_text)
        })));
    }

    // Parse response
    let login_response: Value = match serde_json::from_str(&response_text) {
        Ok(data) => data,
        Err(e) => {
            println!("Failed to parse login response: {}", e);
            return Ok(Json(json!({
                "success": false,
                "error": "Invalid response format"
            })));
        }
    };

    // Check if login was successful
    if let (Some(success), Some(token), Some(user)) = (
        login_response.get("success").and_then(|v| v.as_bool()),
        login_response.get("token").and_then(|v| v.as_str()),
        login_response.get("user")
    ) {
        if success {
            // Store session
            state.store_session(session_id.clone(), token.to_string(), user.clone());
            println!("Login successful, session stored: {}", session_id);
            println!("Token: {}...", &token[..20.min(token.len())]);
        }
    }

    Ok(Json(login_response))
}

async fn handle_logout(
    axum::extract::State(state): axum::extract::State<Arc<ProxyState>>,
    headers: HeaderMap,
) -> Json<Value> {
    let session_id = state.get_session_id(&headers);
    state.clear_session(&session_id);
    println!("Logout successful for session: {}", session_id);
    
    Json(json!({
        "success": true,
        "message": "Logged out successfully"
    }))
}

async fn handle_auth_status(
    axum::extract::State(state): axum::extract::State<Arc<ProxyState>>,
    headers: HeaderMap,
) -> Json<Value> {
    let session_id = state.get_session_id(&headers);
    let authenticated = state.is_authenticated(&session_id);
    
    let session_info = if authenticated {
        let sessions = state.sessions.lock().unwrap();
        if let Some(session_data) = sessions.get(&session_id) {
            json!({
                "loginTime": session_data.login_time.duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default().as_secs(),
                "user": session_data.user,
                "hasToken": !session_data.token.is_empty()
            })
        } else {
            json!(null)
        }
    } else {
        json!(null)
    };
    
    println!("Auth status check for session {}: {} (info: {})", 
             session_id, authenticated, session_info != json!(null));
    
    Json(json!({
        "authenticated": authenticated,
        "sessionId": session_id,
        "sessionInfo": session_info
    }))
}

async fn handle_session_info(
    axum::extract::State(state): axum::extract::State<Arc<ProxyState>>,
) -> Json<Value> {
    let sessions = state.sessions.lock().unwrap();
    let session_count = sessions.len();
    let session_ids: Vec<String> = sessions.keys().cloned().collect();
    
    Json(json!({
        "totalSessions": session_count,
        "sessionIds": session_ids,
        "storageFile": state.session_file.display().to_string()
    }))
}

async fn handle_options() -> Result<Response<Body>, StatusCode> {
    println!("Handling OPTIONS preflight request");
    
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
        .header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, X-Session-Id")
        .header("Access-Control-Max-Age", "86400")
        .body(Body::empty())
        .unwrap())
}

async fn handle_health() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "server": "mikoproxy",
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        "version": "1.0.0"
    }))
}

async fn handle_api_proxy(
    axum::extract::State(state): axum::extract::State<Arc<ProxyState>>,
    method: Method,
    uri: axum::http::Uri,
    headers: HeaderMap,
    request: Request,
) -> Result<Response<Body>, StatusCode> {
    let session_id = state.get_session_id(&headers);
    let path = uri.path();
    let query = uri.query().unwrap_or("");
    
    println!("API request: {} {} for session: {}", method, path, session_id);
    println!("Full URI: {}", uri);
    println!("Query params: {}", query);

    // Check authentication
    if !state.is_authenticated(&session_id) {
        println!("Request rejected: Not authenticated");
        return Ok(Response::builder()
            .status(StatusCode::UNAUTHORIZED)
            .header("Content-Type", "application/json")
            .header("Access-Control-Allow-Origin", "*")
            .body(Body::from(r#"{"error":"Unauthorized"}"#))
            .unwrap());
    }

    // Get auth token
    let token = match state.get_token(&session_id) {
        Some(token) => token,
        None => {
            println!("No token found for session: {}", session_id);
            return Ok(Response::builder()
                .status(StatusCode::UNAUTHORIZED)
                .header("Content-Type", "application/json")
                .header("Access-Control-Allow-Origin", "*")
                .body(Body::from(r#"{"error":"No token"}"#))
                .unwrap());
        }
    };

    // Build target URL - ensure we're using the correct path
    let target_url = if query.is_empty() {
        format!("{}{}", state.erp_base_url, path)
    } else {
        format!("{}{}?{}", state.erp_base_url, path, query)
    };

    println!("Proxying to: {}", target_url);

    // Extract request body
    let body = match axum::body::to_bytes(request.into_body(), usize::MAX).await {
        Ok(bytes) => bytes,
        Err(e) => {
            println!("Failed to read request body: {}", e);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    // Prepare headers for ERP request
    let mut req_headers = reqwest::header::HeaderMap::new();
    
    // Copy relevant headers, but filter out problematic ones
    for (name, value) in headers.iter() {
        let name_str = name.as_str().to_lowercase();
        // Skip headers that might cause issues with proxying
        if !["host", "origin", "referer", "x-session-id", "connection", "upgrade", "proxy-connection"].contains(&name_str.as_str()) {
            if let Ok(value) = reqwest::header::HeaderValue::from_bytes(value.as_bytes()) {
                req_headers.insert(name.clone(), value);
            }
        }
    }

    // Add authentication cookie
    let cookie_value = format!("auth-token={}", token);
    if let Ok(cookie_header) = reqwest::header::HeaderValue::from_str(&cookie_value) {
        req_headers.insert(reqwest::header::COOKIE, cookie_header);
        println!("Added auth cookie: {}...", &token[..20.min(token.len())]);
    }

    // Ensure we have proper content-type for JSON requests
    if !req_headers.contains_key(reqwest::header::CONTENT_TYPE) && !body.is_empty() {
        if let Ok(content_type) = reqwest::header::HeaderValue::from_str("application/json") {
            req_headers.insert(reqwest::header::CONTENT_TYPE, content_type);
        }
    }

    // Convert method
    let req_method = match reqwest::Method::from_bytes(method.as_str().as_bytes()) {
        Ok(method) => method,
        Err(e) => {
            println!("Invalid method: {}", e);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    println!("Request details:");
    println!("  Method: {}", req_method);
    println!("  URL: {}", target_url);
    println!("  Headers: {:?}", req_headers.keys().collect::<Vec<_>>());
    println!("  Body size: {} bytes", body.len());

    // Make request to ERP server
    let response = match state.client
        .request(req_method, &target_url)
        .headers(req_headers)
        .body(body)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
    {
        Ok(response) => response,
        Err(e) => {
            println!("Proxy request failed: {}", e);
            return Ok(Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .header("Content-Type", "application/json")
                .header("Access-Control-Allow-Origin", "*")
                .body(Body::from(format!(r#"{{"error":"Proxy request failed: {}"}}"#, e)))
                .unwrap());
        }
    };

    let status = response.status();
    let response_headers = response.headers().clone();
    let response_body = match response.bytes().await {
        Ok(bytes) => bytes,
        Err(e) => {
            println!("Failed to read response body: {}", e);
            return Err(StatusCode::BAD_GATEWAY);
        }
    };

    println!("ERP response status: {}", status);
    println!("ERP response size: {} bytes", response_body.len());

    // If unauthorized, clear session
    if status == 401 {
        println!("Token appears invalid, clearing session");
        state.clear_session(&session_id);
    }

    // Build response
    let mut response_builder = Response::builder().status(status);

    // Copy response headers, but filter out problematic ones
    for (name, value) in response_headers.iter() {
        let name_str = name.as_str().to_lowercase();
        // Skip headers that might cause issues
        if !["connection", "transfer-encoding", "content-encoding"].contains(&name_str.as_str()) {
            response_builder = response_builder.header(name, value);
        }
    }

    // Add CORS headers
    response_builder = response_builder
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
        .header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, X-Session-Id");

    Ok(response_builder
        .body(Body::from(response_body))
        .unwrap())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Starting Test Authentication Proxy Server...");
    
    let state = Arc::new(ProxyState::new());

    // Clean up expired sessions on startup
    state.cleanup_expired_sessions();

    let app = Router::new()
        // Auth endpoints
        .route("/auth/login", post(handle_login))
        .route("/auth/logout", post(handle_logout))
        .route("/auth/status", get(handle_auth_status))
        .route("/sessions", get(handle_session_info))
        .route("/health", get(handle_health))
        // OPTIONS handler for CORS preflight
        .route("/api/*path", options(handle_options))
        .route("/auth/*path", options(handle_options))
        // File upload proxy
        .route("/api/fileupload/*path", any(handle_api_proxy))
        // API proxy - catch all /api/* routes
        .route("/api/*path", any(handle_api_proxy))
        .with_state(state.clone())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
        );

    // Start cleanup task for expired sessions
    let cleanup_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3600)); // Every hour
        loop {
            interval.tick().await;
            cleanup_state.cleanup_expired_sessions();
        }
    });

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8640").await?;
    
    println!("📡 Authentication proxy listening on http://127.0.0.1:8640");
    println!("🔗 Proxying API calls to: http://10.10.60.8:1669");
    println!("🔐 Ready to handle authentication");
    println!("💾 Sessions will be persisted to: {}", state.session_file.display());
    println!("💡 Test endpoints:");
    println!("   - GET  http://127.0.0.1:8640/health");
    println!("   - POST http://127.0.0.1:8640/auth/login");
    println!("   - GET  http://127.0.0.1:8640/auth/status");
    println!("   - GET  http://127.0.0.1:8640/sessions");
    println!("   - Any  http://127.0.0.1:8640/api/*");
    
    axum::serve(listener, app).await?;
    
    Ok(())
}