// Simple IPC performance test
use std::time::Instant;

fn main() {
    println!("🧪 IPC Performance Diagnostic Tool");
    println!("===================================");
    
    // Test channel performance
    let (sender, receiver) = std::sync::mpsc::channel();
    
    // Test 1: Channel latency
    println!("\n📊 Testing channel latency...");
    let start = Instant::now();
    for i in 0..1000 {
        sender.send((format!("req_{}", i), format!("response_{}", i))).unwrap();
    }
    let send_time = start.elapsed();
    
    let start = Instant::now();
    let mut count = 0;
    while let Ok(_) = receiver.try_recv() {
        count += 1;
    }
    let recv_time = start.elapsed();
    
    println!("✅ Sent 1000 messages in: {:?}", send_time);
    println!("✅ Received {} messages in: {:?}", count, recv_time);
    println!("📈 Average latency: {:?} per message", (send_time + recv_time) / 1000);
    
    // Test 2: JSON serialization performance
    println!("\n📊 Testing JSON serialization...");
    let test_data = serde_json::json!({
        "success": true,
        "data": {
            "threads": [
                {"id": 1, "name": "Test Thread 1"},
                {"id": 2, "name": "Test Thread 2"},
                {"id": 3, "name": "Test Thread 3"}
            ]
        }
    });
    
    let start = Instant::now();
    for _ in 0..1000 {
        let _json_str = serde_json::to_string(&test_data).unwrap();
    }
    let json_time = start.elapsed();
    
    println!("✅ Serialized 1000 JSON objects in: {:?}", json_time);
    println!("📈 Average JSON serialization: {:?} per object", json_time / 1000);
    
    // Test 3: HTTP client creation
    println!("\n📊 Testing HTTP client performance...");
    let start = Instant::now();
    let _client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .connect_timeout(std::time::Duration::from_secs(3))
        .build()
        .unwrap();
    let client_time = start.elapsed();
    
    println!("✅ Created HTTP client in: {:?}", client_time);
    
    println!("\n🎯 Performance Summary:");
    println!("  - Channel communication: Very fast ({:?} per message)", (send_time + recv_time) / 1000);
    println!("  - JSON serialization: {:?} per object", json_time / 1000);
    println!("  - HTTP client creation: {:?}", client_time);
    
    if client_time.as_millis() > 100 {
        println!("⚠️  HTTP client creation is slow - consider using global client");
    }
    
    if (json_time / 1000).as_micros() > 100 {
        println!("⚠️  JSON serialization is slow - consider optimizing data structures");
    }
    
    println!("\n✅ Diagnostic complete!");
}