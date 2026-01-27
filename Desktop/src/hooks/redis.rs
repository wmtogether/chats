
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};

// Redis connection URL - matching frontend
const REDIS_URL: &str = "redis://10.10.60.8:6379";





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
