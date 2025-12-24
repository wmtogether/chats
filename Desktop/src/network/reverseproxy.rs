use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use axum::{
    extract::Request,
    response::{Response, ErrorResponse},
    http::StatusCode,
    body::Body,
};

#[cfg(not(debug_assertions))]
const INDEX_HTML_BYTES: &[u8] = include_bytes!("../../../Distribution/index.html");

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    pub listen_port: u16,
    pub targets: HashMap<String, ProxyTarget>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyTarget {
    pub host: String,
    pub port: u16,
    pub path_prefix: Option<String>,
    pub strip_prefix: bool,
    pub headers: Option<HashMap<String, String>>,
}

#[derive(Debug)]
pub struct ReverseProxy {
    config: Arc<RwLock<ProxyConfig>>,
    client: reqwest::Client,
}

impl Default for ProxyConfig {
    fn default() -> Self {
        let mut targets = HashMap::new();
        
        // Default configuration for ERP API
        targets.insert("/api".to_string(), ProxyTarget {
            host: "10.10.60.8".to_string(),
            port: 1669,
            path_prefix: None,
            strip_prefix: false,
            headers: Some({
                let mut headers = HashMap::new();
                headers.insert("X-Forwarded-For".to_string(), "127.0.0.1".to_string());
                headers.insert("X-Forwarded-Proto".to_string(), "http".to_string());
                headers
            }),
        });

        Self {
            listen_port: 8080,
            targets,
        }
    }
}

impl ReverseProxy {
    pub fn new(config: ProxyConfig) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            config: Arc::new(RwLock::new(config)),
            client,
        }
    }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let config = self.config.read().await;
        let port = config.listen_port;
        drop(config);

        println!("Starting reverse proxy on port {}", port);

        let app = self.create_router().await;
        let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
        
        println!("Reverse proxy listening on http://0.0.0.0:{}", port);
        
        axum::serve(listener, app).await?;
        
        Ok(())
    }

    async fn create_router(&self) -> axum::Router {
        let proxy = self.clone();
        
        axum::Router::new()
            .fallback(move |req| {
                let proxy = proxy.clone();
                async move { proxy.handle_request(req).await }
            })
    }

    async fn handle_request(
        &self,
        req: Request,
    ) -> Result<Response, ErrorResponse> {
        let path = req.uri().path().to_string();
        let query = req.uri().query().unwrap_or("").to_string();
        let method = req.method().clone();
        
        println!("Handling request: {} {}", method, path);

        // Handle CORS preflight requests
        if method == axum::http::Method::OPTIONS {
            return Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Access-Control-Allow-Origin", "*")
                .header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
                .header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma")
                .header("Access-Control-Allow-Credentials", "false") // Set to false for * origin
                .header("Access-Control-Max-Age", "86400")
                .body(Body::empty())
                .map_err(|e| ErrorResponse::from((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to build CORS response: {}", e)
                )))?);
        }

        // In production, serve static files for non-API requests
        #[cfg(not(debug_assertions))]
        {
            if !path.starts_with("/api") {
                return self.serve_static_file(&path).await;
            }
        }

        // Handle API proxy requests
        let config = self.config.read().await;
        
        // Find matching target
        let target = config.targets.iter()
            .find(|(prefix, _)| path.starts_with(prefix.as_str()))
            .map(|(_, target)| target.clone());

        drop(config);

        let target = match target {
            Some(target) => target,
            None => {
                println!("No proxy target found for path: {}", path);
                return Err(ErrorResponse::from((
                    StatusCode::NOT_FOUND,
                    "No proxy target configured for this path"
                )));
            }
        };

        self.proxy_request(req, target, &path, &query).await
    }

    #[cfg(not(debug_assertions))]
    async fn serve_static_file(&self, path: &str) -> Result<Response, ErrorResponse> {
        // Serve index.html for root path or any non-API path (SPA routing)
        if path == "/" || path == "/index.html" || !path.starts_with("/api") {
            let response = Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "text/html; charset=utf-8")
                .header("Cache-Control", "no-cache")
                .body(Body::from(INDEX_HTML_BYTES))
                .map_err(|e| ErrorResponse::from((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to build response: {}", e)
                )))?;

            return Ok(response);
        }

        // Return 404 for other static files (they should be embedded in the HTML)
        Err(ErrorResponse::from((
            StatusCode::NOT_FOUND,
            "Static file not found"
        )))
    }

    async fn proxy_request(
        &self,
        req: Request,
        target: ProxyTarget,
        path: &str,
        query: &str,
    ) -> Result<Response, ErrorResponse> {
        // Extract method and headers before consuming the request
        let method = req.method().clone();
        let headers = req.headers().clone();

        // Build target URL
        let target_path = if target.strip_prefix {
            // Find the matching prefix and strip it
            let config = self.config.read().await;
            let prefix = config.targets.iter()
                .find(|(_, t)| t.host == target.host && t.port == target.port)
                .map(|(prefix, _)| prefix.as_str())
                .unwrap_or("");
            let stripped_path = path.strip_prefix(prefix).unwrap_or(path);
            drop(config);
            stripped_path
        } else {
            path
        };

        let final_path = if let Some(prefix) = &target.path_prefix {
            format!("{}{}", prefix, target_path)
        } else {
            target_path.to_string()
        };

        let target_url = if query.is_empty() {
            format!("http://{}:{}{}", target.host, target.port, final_path)
        } else {
            format!("http://{}:{}{}?{}", target.host, target.port, final_path, query)
        };

        println!("Forwarding to: {}", target_url);

        // Convert headers for reqwest
        let mut req_headers = reqwest::header::HeaderMap::new();
        for (name, value) in headers.iter() {
            if let Ok(value) = reqwest::header::HeaderValue::from_bytes(value.as_bytes()) {
                req_headers.insert(name.clone(), value);
            }
        }

        // Add configured headers
        if let Some(extra_headers) = &target.headers {
            for (name, value) in extra_headers {
                if let (Ok(name), Ok(value)) = (
                    reqwest::header::HeaderName::from_bytes(name.as_bytes()),
                    reqwest::header::HeaderValue::from_str(value)
                ) {
                    req_headers.insert(name, value);
                }
            }
        }

        // Extract body
        let body = axum::body::to_bytes(req.into_body(), usize::MAX).await
            .map_err(|e| ErrorResponse::from((
                StatusCode::BAD_REQUEST,
                format!("Failed to read request body: {}", e)
            )))?;

        // Convert method for reqwest
        let req_method = reqwest::Method::from_bytes(method.as_str().as_bytes())
            .map_err(|e| ErrorResponse::from((
                StatusCode::BAD_REQUEST,
                format!("Invalid HTTP method: {}", e)
            )))?;

        let response = self.client
            .request(req_method, &target_url)
            .headers(req_headers)
            .body(body)
            .send()
            .await
            .map_err(|e| {
                println!("Proxy request failed: {}", e);
                ErrorResponse::from((
                    StatusCode::BAD_GATEWAY,
                    format!("Proxy request failed: {}", e)
                ))
            })?;

        // Convert response
        let status = response.status();
        let headers = response.headers().clone();
        let body = response.bytes().await
            .map_err(|e| ErrorResponse::from((
                StatusCode::BAD_GATEWAY,
                format!("Failed to read response body: {}", e)
            )))?;

        let mut response_builder = Response::builder()
            .status(status);

        // Copy response headers and add CORS headers
        for (name, value) in headers.iter() {
            response_builder = response_builder.header(name, value);
        }

        // Add CORS headers to allow cross-origin requests
        response_builder = response_builder
            .header("Access-Control-Allow-Origin", "*")
            .header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
            .header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma")
            .header("Access-Control-Allow-Credentials", "false") // Set to false for * origin
            .header("Access-Control-Max-Age", "86400");

        response_builder
            .body(Body::from(body))
            .map_err(|e| ErrorResponse::from((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to build response: {}", e)
            )))
    }

    pub async fn update_config(&self, new_config: ProxyConfig) {
        let mut config = self.config.write().await;
        *config = new_config;
        println!("Proxy configuration updated");
    }

    pub async fn add_target(&self, path: String, target: ProxyTarget) {
        let mut config = self.config.write().await;
        config.targets.insert(path.clone(), target);
        println!("Added proxy target for path: {}", path);
    }

    pub async fn remove_target(&self, path: &str) {
        let mut config = self.config.write().await;
        if config.targets.remove(path).is_some() {
            println!("Removed proxy target for path: {}", path);
        }
    }

    pub async fn get_config(&self) -> ProxyConfig {
        self.config.read().await.clone()
    }
}

impl Clone for ReverseProxy {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            client: self.client.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_proxy_config_default() {
        let config = ProxyConfig::default();
        assert_eq!(config.listen_port, 8080);
        assert!(config.targets.contains_key("/api"));
    }

    #[tokio::test]
    async fn test_proxy_creation() {
        let config = ProxyConfig::default();
        let proxy = ReverseProxy::new(config);
        
        let retrieved_config = proxy.get_config().await;
        assert_eq!(retrieved_config.listen_port, 8080);
    }
}