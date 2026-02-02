use redis::{Client, Connection, Commands};
use std::sync::{Arc, Mutex};
use lazy_static::lazy_static;

lazy_static! {
    static ref REDIS_CLIENT: Arc<Mutex<Option<Client>>> = Arc::new(Mutex::new(None));
    static ref REDIS_CONNECTION: Arc<Mutex<Option<Connection>>> = Arc::new(Mutex::new(None));
}

pub fn init_redis() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::open("redis://127.0.0.1:6379/")?;
    
    let mut redis_client = REDIS_CLIENT.lock().unwrap();
    *redis_client = Some(client);
    
    println!("✅ Redis client initialized");
    Ok(())
}

pub fn connect_redis() -> Result<(), Box<dyn std::error::Error>> {
    let redis_client = REDIS_CLIENT.lock().unwrap();
    
    if let Some(ref client) = *redis_client {
        let conn = client.get_connection()?;
        
        let mut redis_connection = REDIS_CONNECTION.lock().unwrap();
        *redis_connection = Some(conn);
        
        println!("✅ Connected to Redis server");
        Ok(())
    } else {
        Err("Redis client not initialized".into())
    }
}

pub fn redis_set(key: &str, value: &str) -> Result<(), Box<dyn std::error::Error>> {
    let mut redis_connection = REDIS_CONNECTION.lock().unwrap();
    
    if let Some(ref mut conn) = *redis_connection {
        let _: () = conn.set(key, value)?;
        Ok(())
    } else {
        Err("Redis connection not established".into())
    }
}

pub fn redis_get(key: &str) -> Result<String, Box<dyn std::error::Error>> {
    let mut redis_connection = REDIS_CONNECTION.lock().unwrap();
    
    if let Some(ref mut conn) = *redis_connection {
        let value: String = conn.get(key)?;
        Ok(value)
    } else {
        Err("Redis connection not established".into())
    }
}

pub fn redis_publish(channel: &str, message: &str) -> Result<(), Box<dyn std::error::Error>> {
    let mut redis_connection = REDIS_CONNECTION.lock().unwrap();
    
    if let Some(ref mut conn) = *redis_connection {
        let _: i32 = conn.publish(channel, message)?;
        Ok(())
    } else {
        Err("Redis connection not established".into())
    }
}