// IPC (Inter-Process Communication) handlers
use crate::core::SharedAppState;
use serde_json;

pub async fn handle_ipc_message(request: http::Request<String>, state: SharedAppState) {
    let body = request.body();
    
    // Try to parse as JSON for structured commands
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(action) = parsed.get("action").and_then(|v| v.as_str()) {
            match action {
                "show_context_menu" => {
                    // Handle context menu (existing code)
                    if let (Some(x), Some(y)) = (
                        parsed.get("x").and_then(|v| v.as_i64()),
                        parsed.get("y").and_then(|v| v.as_i64())
                    ) {
                        println!("Context menu requested at ({}, {})", x, y);
                    }
                    return;
                }
                _ => {
                    println!("Unknown structured IPC action: {}", action);
                }
            }
        }
    }
    
    // Handle simple string commands (existing functionality)
    match body.as_str() {
        "get_state" => {
            let state = state.lock().unwrap();
            let json = serde_json::to_string(&*state).unwrap();
            println!("Sending state: {}", json);
        }
        "increment" => {
            let mut state = state.lock().unwrap();
            state.counter += 1;
            state.message = format!("Counter incremented to {}", state.counter);
            println!("Counter incremented: {}", state.counter);
        }
        "reset" => {
            let mut state = state.lock().unwrap();
            state.counter = 0;
            state.message = "Counter reset!".to_string();
            println!("Counter reset");
        }
        "copy" => {
            handle_clipboard_copy();
        }
        "cut" => {
            handle_clipboard_cut();
        }
        "paste" => {
            handle_clipboard_paste();
        }
        _ => {
            println!("Unknown IPC request: {}", body);
        }
    }
}

fn handle_clipboard_copy() {
    println!("Copy action triggered");
    // Platform-specific clipboard copy implementation would go here
    #[cfg(target_os = "windows")]
    {
        // Windows clipboard implementation
        println!("Windows: Copy to clipboard");
    }
    
    #[cfg(target_os = "linux")]
    {
        // Linux clipboard implementation
        println!("Linux: Copy to clipboard");
    }
}

fn handle_clipboard_cut() {
    println!("Cut action triggered");
    // Platform-specific clipboard cut implementation would go here
    #[cfg(target_os = "windows")]
    {
        // Windows clipboard implementation
        println!("Windows: Cut to clipboard");
    }
    
    #[cfg(target_os = "linux")]
    {
        // Linux clipboard implementation
        println!("Linux: Cut to clipboard");
    }
}

fn handle_clipboard_paste() {
    println!("Paste action triggered");
    // Platform-specific clipboard paste implementation would go here
    #[cfg(target_os = "windows")]
    {
        // Windows clipboard implementation
        println!("Windows: Paste from clipboard");
    }
    
    #[cfg(target_os = "linux")]
    {
        // Linux clipboard implementation
        println!("Linux: Paste from clipboard");
    }
}