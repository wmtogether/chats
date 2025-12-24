use std::sync::Arc;
use axum::{
    extract::Request,
    response::{Response, Json},
    http::{StatusCode, HeaderMap},
    body::Body,
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};
use crate::auth::{AuthManager, LoginRequest};

pub struct AuthenticatedProxy {
    auth_manager: Arc<AuthManager>,
    erp_base_url: String,
    client: reqwest::Client,
}

impl AuthenticatedProxy {
    pub fn new(auth_manager: Arc<AuthManager>, erp_base_url: String) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            auth_manager,
            erp_base_url,
            client,
        }
    }

    pub fn create_router(&self) -> Router {
        let proxy = Arc::new(self.clone());
        
        Router::new()
            // Authentication endpoints
            .route("/auth/login", post({
                let proxy = proxy.clone();
                move |body: String| {
                    let proxy = proxy.clone();
                    async move { proxy.handle_login(body).await }
                }
            }))
            .route("/auth/logout", post({
                let proxy = proxy.clone();
                move |headers: HeaderMap| {
                    let proxy = proxy.clone();
                    async move { proxy.handle_logout(headers).await }
                }
            }))
            .route("/auth/status", get({
                let proxy = proxy.clone();
                move |headers: HeaderMap| {
                    let proxy = proxy.clone();
                    async move { proxy.handle_auth_status(headers).await }
                }
            }))
            // Proxy all other API requests with a catch-all
            .fallback({
                let proxy = proxy.clone();
                move |request: Request| {
                    let proxy = proxy.clone();
                    async move { proxy.handle_fallback_request(request).await }
                }
            })
    }

    async fn handle_login(&self, body: String) -> Result<Json<Value>, StatusCode> {
        println!("Handling login request");
        
        let login_request: LoginRequest = match serde_json::from_str(&body) {
            Ok(req) => req,
            Err(e) => {
                println!("Failed to parse login request: {}", e);
                return Err(StatusCode::BAD_REQUEST);
            }
        };

        // Generate a session ID (in a real app, this might come from a cookie or header)
        let session_id = format!("session-{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis());

        match self.auth_manager.login(session_id.clone(), login_request).await {
            Ok(response) => {
                println!("Login successful for session: {}", session_id);
                
                // Return the response with session info
                Ok(Json(json!({
                    "success": response.success,
                    "token": response.token,
                    "user": response.user,
                    "sessionId": session_id
                })))
            }
            Err(e) => {
                println!("Login failed: {}", e);
                Ok(Json(json!({
                    "success": false,
                    "error": e.to_string()
                })))
            }
        }
    }

    async fn handle_logout(&self, headers: HeaderMap) -> Json<Value> {
        let session_id = self.extract_session_id(&headers).unwrap_or("default-session".to_string());
        
        self.auth_manager.logout(&session_id).await;
        
        Json(json!({
            "success": true,
            "message": "Logged out successfully"
        }))
    }

    async fn handle_auth_status(&self, headers: HeaderMap) -> Json<Value> {
        let session_id = self.extract_session_id(&headers).unwrap_or("default-session".to_string());
        
        let is_authenticated = self.auth_manager.is_authenticated(&session_id).await;
        
        Json(json!({
            "authenticated": is_authenticated,
            "sessionId": session_id
        }))
    }

    async fn handle_fallback_request(&self, request: Request) -> Result<Response<Body>, StatusCode> {
        let uri = request.uri().clone();
        let path = uri.path();
        let method = request.method().as_str().to_string();
        let headers = request.headers().clone();
        
        println!("Fallback handler: {} {}", method, path);
        
        // Handle API requests
        if path.starts_with("/api/") {
            let api_path = path.strip_prefix("/api/").unwrap_or("");
            
            return self.proxy_api_request(&method, api_path, headers, request).await;
        }
        
        // Handle CORS preflight
        if method == "OPTIONS" {
            return Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Access-Control-Allow-Origin", "*")
                .header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
                .header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, X-Session-Id")
                .header("Access-Control-Allow-Credentials", "false")
                .header("Access-Control-Max-Age", "86400")
                .body(Body::empty())
                .unwrap());
        }
        
        // Return 404 for other requests
        Ok(Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header("Content-Type", "application/json")
            .body(Body::from(r#"{"error":"Not found"}"#))
            .unwrap())
    }

    async fn proxy_api_request(
        &self,
        method: &str,
        api_path: &str,
        headers: HeaderMap,
        request: Request,
    ) -> Result<Response<Body>, StatusCode> {
        let session_id = self.extract_session_id(&headers).unwrap_or("desktop-session".to_string());
        
        println!("Proxying {} /api/{} for session: {}", method, api_path, session_id);

        // Check if user is authenticated
        if !self.auth_manager.is_authenticated(&session_id).await {
            println!("Request rejected: Not authenticated");
            return Ok(Response::builder()
                .status(StatusCode::UNAUTHORIZED)
                .header("Content-Type", "application/json")
                .header("Access-Control-Allow-Origin", "*")
                .body(Body::from(r#"{"error":"Unauthorized"}"#))
                .unwrap());
        }

        // Build the target URL
        let target_url = format!("{}/api/{}", self.erp_base_url, api_path);
        
        // Extract the request body
        let body = match axum::body::to_bytes(request.into_body(), usize::MAX).await {
            Ok(bytes) => bytes,
            Err(e) => {
                println!("Failed to read request body: {}", e);
                return Err(StatusCode::BAD_REQUEST);
            }
        };

        // Convert headers for reqwest
        let mut req_headers = reqwest::header::HeaderMap::new();
        for (name, value) in headers.iter() {
            if let Ok(value) = reqwest::header::HeaderValue::from_bytes(value.as_bytes()) {
                req_headers.insert(name.clone(), value);
            }
        }

        // Add authentication headers
        if !self.auth_manager.add_auth_headers(&session_id, &mut req_headers).await {
            println!("Failed to add auth headers");
            return Err(StatusCode::UNAUTHORIZED);
        }

        // Convert method for reqwest
        let req_method = match reqwest::Method::from_bytes(method.as_bytes()) {
            Ok(method) => method,
            Err(e) => {
                println!("Invalid HTTP method: {}", e);
                return Err(StatusCode::BAD_REQUEST);
            }
        };

        // Make the request to ERP server
        let response = match self.client
            .request(req_method, &target_url)
            .headers(req_headers)
            .body(body)
            .send()
            .await
        {
            Ok(response) => response,
            Err(e) => {
                println!("Proxy request failed: {}", e);
                return Err(StatusCode::BAD_GATEWAY);
            }
        };

        // Convert response
        let status = response.status();
        let headers = response.headers().clone();
        let response_body = match response.bytes().await {
            Ok(bytes) => bytes,
            Err(e) => {
                println!("Failed to read response body: {}", e);
                return Err(StatusCode::BAD_GATEWAY);
            }
        };

        let mut response_builder = Response::builder().status(status);

        // Copy response headers
        for (name, value) in headers.iter() {
            response_builder = response_builder.header(name, value);
        }

        // Add CORS headers
        response_builder = response_builder
            .header("Access-Control-Allow-Origin", "*")
            .header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
            .header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, X-Session-Id")
            .header("Access-Control-Allow-Credentials", "false");

        Ok(response_builder
            .body(Body::from(response_body))
            .unwrap())
    }

    fn extract_session_id(&self, headers: &HeaderMap) -> Option<String> {
        // Try to get session ID from X-Session-Id header
        if let Some(session_header) = headers.get("X-Session-Id") {
            if let Ok(session_id) = session_header.to_str() {
                return Some(session_id.to_string());
            }
        }

        // Fallback to a default session (for single-user desktop app)
        Some("desktop-session".to_string())
    }
}

impl Clone for AuthenticatedProxy {
    fn clone(&self) -> Self {
        Self {
            auth_manager: self.auth_manager.clone(),
            erp_base_url: self.erp_base_url.clone(),
            client: self.client.clone(),
        }
    }
}