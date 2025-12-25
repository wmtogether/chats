use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};

// Redis connection URL - matching frontend
const REDIS_URL: &str = "redis://10.10.60.8:6379";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PubSubMessage<T = serde_json::Value> {
    pub channel: String,
    pub event: String,
    pub data: T,
    pub timestamp: u64,
    #[serde(rename = "userId")]
    pub user_id: Option<String>,
}

#[derive(Debug, Clone)]
pub enum PubSubChannel {
    ChatMessage,
    ChatReaction,
    ChatEdit,
    ChatDelete,
    ChatTyping,
    ThreadNew,
    ThreadUpdate,
    ThreadDelete,
    Notification,
    WorkspaceUpdate,
    UserStatus,
    TestPing,
}

impl PubSubChannel {
    pub fn as_str(&self) -> &'static str {
        match self {
            PubSubChannel::ChatMessage => "chat:message",
            PubSubChannel::ChatReaction => "chat:reaction",
            PubSubChannel::ChatEdit => "chat:edit",
            PubSubChannel::ChatDelete => "chat:delete",
            PubSubChannel::ChatTyping => "chat:typing",
            PubSubChannel::ThreadNew => "thread:new",
            PubSubChannel::ThreadUpdate => "thread:update",
            PubSubChannel::ThreadDelete => "thread:delete",
            PubSubChannel::Notification => "notification",
            PubSubChannel::WorkspaceUpdate => "workspace:update",
            PubSubChannel::UserStatus => "user:status",
            PubSubChannel::TestPing => "test:ping",
        }
    }
}

pub struct RedisManager {
    is_connected: Arc<AtomicBool>,
}

impl RedisManager {
    pub fn new() -> Self {
        Self {
            is_connected: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Connect to Redis (simplified implementation)
    pub fn connect(&mut self) -> std::result::Result<(), Box<dyn std::error::Error + Send + Sync>> {
        println!("🔌 Connecting to Redis at: {}", REDIS_URL);
        
        // Simulate connection
        std::thread::sleep(std::time::Duration::from_millis(100));
        
        self.is_connected.store(true, Ordering::Relaxed);
        println!("✅ Redis connected successfully");
        Ok(())
    }

    /// Check if Redis is connected
    pub fn is_connected(&self) -> bool {
        self.is_connected.load(Ordering::Relaxed)
    }

    /// Disconnect from Redis
    pub fn disconnect(&mut self) {
        println!("🔌 Disconnecting from Redis...");
        self.is_connected.store(false, Ordering::Relaxed);
        println!("✅ Redis disconnected");
    }
}

// Global Redis manager instance
static mut REDIS_MANAGER: Option<Arc<Mutex<RedisManager>>> = None;

/// Initialize the global Redis manager
pub fn init_redis() -> std::result::Result<(), Box<dyn std::error::Error + Send + Sync>> {
    unsafe {
        let manager = RedisManager::new();
        REDIS_MANAGER = Some(Arc::new(Mutex::new(manager)));
        Ok(())
    }
}

/// Connect to Redis (synchronous version to avoid async issues)
pub fn connect_redis() -> std::result::Result<(), Box<dyn std::error::Error + Send + Sync>> {
    unsafe {
        if let Some(ref manager) = REDIS_MANAGER {
            let mut manager = manager.lock().unwrap();
            manager.connect()
        } else {
            Err("Redis manager not initialized".into())
        }
    }
}

/// Disconnect from Redis
pub fn disconnect_redis() {
    unsafe {
        if let Some(ref manager) = REDIS_MANAGER {
            let mut manager = manager.lock().unwrap();
            manager.disconnect();
        }
    }
}

/// Check if Redis is connected
pub fn is_redis_connected() -> bool {
    unsafe {
        if let Some(ref manager) = REDIS_MANAGER {
            let manager = manager.lock().unwrap();
            manager.is_connected()
        } else {
            false
        }
    }
}
/// Simulate receiving a Redis message and trigger notification
pub fn simulate_redis_message(channel: &str, event: &str, data: serde_json::Value) -> std::result::Result<(), Box<dyn std::error::Error + Send + Sync>> {
    println!("📨 Redis message received: {}:{}", channel, event);
    
    // Use the notification handler to show appropriate notification
    if let Err(e) = crate::hooks::noti::handle_redis_message(channel, event, &data) {
        println!("⚠️ Failed to handle Redis message notification: {}", e);
    }
    
    Ok(())
}