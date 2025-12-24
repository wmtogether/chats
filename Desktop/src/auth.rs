use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use reqwest::header::{HeaderMap, HeaderValue, COOKIE};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthToken {
    pub token: String,
    pub user_id: String,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub identifier: String,
    pub password: Option<String>,
    pub create_password: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    pub success: bool,
    pub token: String,
    pub user: serde_json::Value,
}

#[derive(Debug)]
pub struct AuthManager {
    tokens: Arc<RwLock<HashMap<String, AuthToken>>>,
    client: reqwest::Client,
    erp_base_url: String,
}

impl AuthManager {
    pub fn new(erp_base_url: String) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client for auth");

        Self {
            tokens: Arc::new(RwLock::new(HashMap::new())),
            client,
            erp_base_url,
        }
    }

    pub async fn login(&self, session_id: String, credentials: LoginRequest) -> Result<LoginResponse, Box<dyn std::error::Error + Send + Sync>> {
        println!("Attempting login for session: {}", session_id);
        
        let login_url = format!("{}/api/auth/login", self.erp_base_url);
        
        let response = self.client
            .post(&login_url)
            .json(&credentials)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("Login failed: {}", error_text).into());
        }

        let login_response: LoginResponse = response.json().await?;
        
        if login_response.success {
            // Store the token for this session
            let auth_token = AuthToken {
                token: login_response.token.clone(),
                user_id: session_id.clone(),
                expires_at: None, // Could be extracted from JWT if needed
            };
            
            let mut tokens = self.tokens.write().await;
            tokens.insert(session_id, auth_token);
            
            println!("Login successful, token stored for session");
        }

        Ok(login_response)
    }

    pub async fn logout(&self, session_id: &str) {
        let mut tokens = self.tokens.write().await;
        if tokens.remove(session_id).is_some() {
            println!("Logged out session: {}", session_id);
        }
    }

    pub async fn get_token(&self, session_id: &str) -> Option<String> {
        let tokens = self.tokens.read().await;
        tokens.get(session_id).map(|auth| auth.token.clone())
    }

    pub async fn is_authenticated(&self, session_id: &str) -> bool {
        let tokens = self.tokens.read().await;
        tokens.contains_key(session_id)
    }

    pub async fn add_auth_headers(&self, session_id: &str, headers: &mut HeaderMap) -> bool {
        if let Some(token) = self.get_token(session_id).await {
            // Add the auth token as a cookie header
            let cookie_value = format!("auth-token={}", token);
            if let Ok(header_value) = HeaderValue::from_str(&cookie_value) {
                headers.insert(COOKIE, header_value);
                println!("Added auth cookie for session: {}", session_id);
                return true;
            }
        }
        false
    }

    pub async fn validate_token(&self, session_id: &str) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        if let Some(token) = self.get_token(session_id).await {
            // Test the token by making a simple API call
            let test_url = format!("{}/api/threads?limit=1", self.erp_base_url);
            
            let mut headers = HeaderMap::new();
            let cookie_value = format!("auth-token={}", token);
            if let Ok(header_value) = HeaderValue::from_str(&cookie_value) {
                headers.insert(COOKIE, header_value);
            }

            let response = self.client
                .get(&test_url)
                .headers(headers)
                .send()
                .await?;

            let is_valid = response.status().is_success();
            
            if !is_valid {
                // Token is invalid, remove it
                self.logout(session_id).await;
            }
            
            Ok(is_valid)
        } else {
            Ok(false)
        }
    }

    pub async fn get_session_count(&self) -> usize {
        let tokens = self.tokens.read().await;
        tokens.len()
    }

    pub async fn cleanup_expired_tokens(&self) {
        // For now, we don't have expiration logic, but this could be implemented
        // to periodically clean up old tokens
        let tokens = self.tokens.read().await;
        println!("Active sessions: {}", tokens.len());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_auth_manager_creation() {
        let auth_manager = AuthManager::new("http://localhost:1669".to_string());
        assert_eq!(auth_manager.get_session_count().await, 0);
    }

    #[tokio::test]
    async fn test_session_management() {
        let auth_manager = AuthManager::new("http://localhost:1669".to_string());
        
        // Initially not authenticated
        assert!(!auth_manager.is_authenticated("test-session").await);
        
        // After logout, still not authenticated
        auth_manager.logout("test-session").await;
        assert!(!auth_manager.is_authenticated("test-session").await);
    }
}