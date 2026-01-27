// API Test CLI - Direct testing of authentication and data loading
use std::time::Instant;
use reqwest;
use serde_json::{json, Value};
use tokio;

#[derive(Debug)]
struct ApiTester {
    client: reqwest::Client,
    base_url: String,
    token: Option<String>,
}

impl ApiTester {
    fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .connect_timeout(std::time::Duration::from_secs(10))
            .tcp_keepalive(std::time::Duration::from_secs(60))
            .pool_idle_timeout(std::time::Duration::from_secs(90))
            .pool_max_idle_per_host(10)
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url: "http://10.10.60.8:1669".to_string(),
            token: None,
        }
    }

    async fn test_connection(&self) -> Result<(), Box<dyn std::error::Error>> {
        println!("🔗 Testing basic connection to ERP server...");
        let start = Instant::now();
        
        let response = self.client
            .get(&format!("{}/health", self.base_url))
            .send()
            .await?;
        
        let duration = start.elapsed();
        println!("⏱️  Connection test took: {:?}", duration);
        println!("📊 Status: {}", response.status());
        
        if response.status().is_success() {
            println!("✅ Connection successful!");
        } else {
            println!("❌ Connection failed!");
        }
        
        Ok(())
    }

    async fn test_login(&mut self, username: &str, password: &str) -> Result<(), Box<dyn std::error::Error>> {
        println!("🔐 Testing login with credentials: {}", username);
        let start = Instant::now();
        
        let login_data = json!({
            "identifier": username,
            "password": password
        });

        let response = self.client
            .post(&format!("{}/api/auth/login", self.base_url))
            .header("Content-Type", "application/json")
            .json(&login_data)
            .send()
            .await?;
        
        let duration = start.elapsed();
        println!("⏱️  Login took: {:?}", duration);
        let status = response.status();
        println!("📊 Status: {}", status);
        
        let response_text = response.text().await?;
        println!("📄 Response: {}", response_text);
        
            if let Ok(json_response) = serde_json::from_str::<Value>(&response_text) {
            if let Some(token) = json_response.get("token").and_then(|t| t.as_str()) {
                self.token = Some(token.to_string());
                println!("✅ Login successful! Token: {}...", &token[..std::cmp::min(20, token.len())]);
                
                if let Some(user) = json_response.get("user") {
                    println!("👤 User info: {}", serde_json::to_string_pretty(user)?);
                }
            } else {
                println!("❌ Login failed - no token received");
            }
        } else {
            println!("❌ Login failed - invalid JSON response");
        }
        
        Ok(())
    }

    async fn test_threads(&self) -> Result<(), Box<dyn std::error::Error>> {
        println!("📋 Testing threads API...");
        let start = Instant::now();
        
        let mut request = self.client
            .get(&format!("{}/api/threads?limit=10", self.base_url))
            .header("Content-Type", "application/json");
        
        if let Some(token) = &self.token {
            request = request.header("Authorization", format!("Bearer {}", token));
            println!("🔑 Using JWT token for authentication");
        } else {
            println!("⚠️  No token available - request may fail");
        }
        
        let response = request.send().await?;
        let duration = start.elapsed();
        
        println!("⏱️  Threads request took: {:?}", duration);
        let status = response.status();
        println!("📊 Status: {}", status);
        
        let response_text = response.text().await?;
        
        if status.is_success() {
            if let Ok(json_response) = serde_json::from_str::<Value>(&response_text) {
                if let Some(chats) = json_response.get("chats").and_then(|c| c.as_array()) {
                    println!("✅ Threads loaded successfully!");
                    println!("📊 Found {} threads", chats.len());
                    
                    // Show first few threads
                    for (i, chat) in chats.iter().take(3).enumerate() {
                        if let (Some(id), Some(name)) = (
                            chat.get("id"),
                            chat.get("channelName").and_then(|n| n.as_str())
                        ) {
                            println!("  {}. ID: {}, Name: {}", i + 1, id, name);
                        }
                    }
                } else {
                    println!("⚠️  No 'chats' array found in response");
                    println!("📄 Response structure: {}", serde_json::to_string_pretty(&json_response)?);
                }
            } else {
                println!("❌ Invalid JSON response");
                println!("📄 Raw response: {}", &response_text[..std::cmp::min(500, response_text.len())]);
            }
        } else {
            println!("❌ Threads request failed");
            println!("📄 Error response: {}", response_text);
        }
        
        Ok(())
    }

    async fn test_messages(&self, thread_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        println!("💬 Testing messages API for thread: {}", thread_id);
        let start = Instant::now();
        
        let mut request = self.client
            .get(&format!("{}/api/threads/{}/messages?limit=5", self.base_url, thread_id))
            .header("Content-Type", "application/json");
        
        if let Some(token) = &self.token {
            request = request.header("Authorization", format!("Bearer {}", token));
        }
        
        let response = request.send().await?;
        let duration = start.elapsed();
        
        println!("⏱️  Messages request took: {:?}", duration);
        let status = response.status();
        println!("📊 Status: {}", status);
        
        let response_text = response.text().await?;
        
        if status.is_success() {
            if let Ok(json_response) = serde_json::from_str::<Value>(&response_text) {
                if let Some(messages) = json_response.get("messages").and_then(|m| m.as_array()) {
                    println!("✅ Messages loaded successfully!");
                    println!("📊 Found {} messages", messages.len());
                    
                    // Show first few messages
                    for (i, message) in messages.iter().take(2).enumerate() {
                        if let (Some(content), Some(user)) = (
                            message.get("content").and_then(|c| c.as_str()),
                            message.get("userName").and_then(|u| u.as_str())
                        ) {
                            let preview = if content.len() > 50 {
                                format!("{}...", &content[..50])
                            } else {
                                content.to_string()
                            };
                            println!("  {}. {}: {}", i + 1, user, preview);
                        }
                    }
                } else {
                    println!("⚠️  No 'messages' array found in response");
                }
            } else {
                println!("❌ Invalid JSON response");
            }
        } else {
            println!("❌ Messages request failed");
            println!("📄 Error response: {}", response_text);
        }
        
        Ok(())
    }

    async fn performance_test(&self) -> Result<(), Box<dyn std::error::Error>> {
        println!("\n🚀 Running performance tests...");
        
        if self.token.is_none() {
            println!("❌ No authentication token - skipping performance tests");
            return Ok(());
        }

        // Test multiple concurrent requests
        println!("📊 Testing 5 concurrent thread requests...");
        let start = Instant::now();
        
        let mut handles = vec![];
        for i in 0..5 {
            let client = self.client.clone();
            let base_url = self.base_url.clone();
            let token = self.token.clone();
            
            let handle = tokio::spawn(async move {
                let mut request = client
                    .get(&format!("{}/api/threads?limit=5&page={}", base_url, i + 1))
                    .header("Content-Type", "application/json");
                
                if let Some(token) = token {
                    request = request.header("Authorization", format!("Bearer {}", token));
                }
                
                let start = Instant::now();
                let result = request.send().await;
                let duration = start.elapsed();
                
                (i + 1, result.is_ok(), duration)
            });
            
            handles.push(handle);
        }
        
        let mut successful = 0;
        let mut total_time = std::time::Duration::new(0, 0);
        
        for handle in handles {
            if let Ok((request_num, success, duration)) = handle.await {
                println!("  Request {}: {} in {:?}", request_num, if success { "✅" } else { "❌" }, duration);
                if success {
                    successful += 1;
                }
                total_time += duration;
            }
        }
        
        let concurrent_duration = start.elapsed();
        println!("📊 Concurrent test results:");
        println!("  - Total time: {:?}", concurrent_duration);
        println!("  - Successful requests: {}/5", successful);
        println!("  - Average request time: {:?}", total_time / 5);
        
        Ok(())
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🧪 API Performance Test Tool");
    println!("============================\n");
    
    let mut tester = ApiTester::new();
    
    // Test basic connection
    if let Err(e) = tester.test_connection().await {
        println!("❌ Connection test failed: {}", e);
        return Ok(());
    }
    
    println!();
    
    // Test login
    if let Err(e) = tester.test_login("MR004", "15122544").await {
        println!("❌ Login test failed: {}", e);
        return Ok(());
    }
    
    println!();
    
    // Test threads
    if let Err(e) = tester.test_threads().await {
        println!("❌ Threads test failed: {}", e);
    }
    
    println!();
    
    // Test messages (use first thread if available)
    if let Err(e) = tester.test_messages("1").await {
        println!("❌ Messages test failed: {}", e);
    }
    
    // Performance tests
    if let Err(e) = tester.performance_test().await {
        println!("❌ Performance test failed: {}", e);
    }
    
    println!("\n🎉 API testing completed!");
    
    Ok(())
}