// IPC (Inter-Process Communication) handlers
use crate::core::SharedAppState;
use serde_json;

pub mod dialog;

pub fn handle_ipc_message(request: http::Request<String>, state: SharedAppState) {
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
                "confirm_logout" => {
                    // Handle logout confirmation dialog
                    println!("Showing logout confirmation dialog...");
                    
                    match dialog::show_confirmation_dialog_sync(
                        "Sign out", 
                        "Are you sure you want to sign out?", 
                        "Sign out", 
                        "Cancel"
                    ) {
                        Ok(result) => {
                            println!("Logout confirmation result: {}", result);
                            if result {
                                println!("User confirmed logout - setting logout flag");
                                // Set a flag in the app state to trigger logout
                                {
                                    let mut state = state.lock().unwrap();
                                    state.message = "trigger_logout".to_string();
                                }
                            } else {
                                println!("User cancelled logout");
                            }
                        }
                        Err(e) => {
                            println!("Dialog error: {}", e);
                        }
                    }
                    return;
                }
                "show_dialog" => {
                    // Handle generic dialog requests
                    if let Some(dialog_type) = parsed.get("type").and_then(|v| v.as_str()) {
                        let title = parsed.get("title").and_then(|v| v.as_str()).unwrap_or("Dialog");
                        let message = parsed.get("message").and_then(|v| v.as_str()).unwrap_or("");
                        let request_id = parsed.get("requestId").and_then(|v| v.as_str()).unwrap_or("unknown");
                        
                        println!("🔔 Showing dialog: type={}, title={}, requestId={}", dialog_type, title, request_id);
                        println!("🔔 Full IPC payload: {}", body);
                        
                        match dialog_type {
                            "confirm" => {
                                let ok_text = parsed.get("okText").and_then(|v| v.as_str()).unwrap_or("OK");
                                let cancel_text = parsed.get("cancelText").and_then(|v| v.as_str()).unwrap_or("Cancel");
                                
                                match dialog::show_confirmation_dialog_sync(title, message, ok_text, cancel_text) {
                                    Ok(result) => {
                                        println!("✅ Confirmation dialog result: {}", result);
                                        // Store result in app state with request ID
                                        {
                                            let mut state = state.lock().unwrap();
                                            state.message = format!("dialog_result:{}:{}", request_id, result);
                                        }
                                    }
                                    Err(e) => {
                                        println!("❌ Dialog error: {}", e);
                                        {
                                            let mut state = state.lock().unwrap();
                                            state.message = format!("dialog_result:{}:false", request_id);
                                        }
                                    }
                                }
                            }
                            "info" => {
                                match dialog::show_info_dialog(title, message) {
                                    Ok(_) => {
                                        println!("✅ Info dialog shown");
                                        {
                                            let mut state = state.lock().unwrap();
                                            state.message = format!("dialog_result:{}:ok", request_id);
                                        }
                                    }
                                    Err(e) => {
                                        println!("❌ Dialog error: {}", e);
                                    }
                                }
                            }
                            "error" => {
                                match dialog::show_error_dialog(title, message) {
                                    Ok(_) => {
                                        println!("✅ Error dialog shown");
                                        {
                                            let mut state = state.lock().unwrap();
                                            state.message = format!("dialog_result:{}:ok", request_id);
                                        }
                                    }
                                    Err(e) => {
                                        println!("❌ Dialog error: {}", e);
                                    }
                                }
                            }
                            "warning" => {
                                match dialog::show_warning_dialog(title, message) {
                                    Ok(_) => {
                                        println!("✅ Warning dialog shown");
                                        {
                                            let mut state = state.lock().unwrap();
                                            state.message = format!("dialog_result:{}:ok", request_id);
                                        }
                                    }
                                    Err(e) => {
                                        println!("❌ Dialog error: {}", e);
                                    }
                                }
                            }
                            "ok_cancel" => {
                                match dialog::show_ok_cancel_dialog(title, message) {
                                    Ok(result) => {
                                        println!("✅ OK/Cancel dialog result: {}", result);
                                        {
                                            let mut state = state.lock().unwrap();
                                            state.message = format!("dialog_result:{}:{}", request_id, result);
                                        }
                                    }
                                    Err(e) => {
                                        println!("❌ Dialog error: {}", e);
                                        {
                                            let mut state = state.lock().unwrap();
                                            state.message = format!("dialog_result:{}:false", request_id);
                                        }
                                    }
                                }
                            }
                            "yes_no_cancel" => {
                                match dialog::show_yes_no_cancel_dialog(title, message) {
                                    Ok(result) => {
                                        println!("✅ Yes/No/Cancel dialog result: {}", result);
                                        {
                                            let mut state = state.lock().unwrap();
                                            state.message = format!("dialog_result:{}:{}", request_id, result);
                                        }
                                    }
                                    Err(e) => {
                                        println!("❌ Dialog error: {}", e);
                                        {
                                            let mut state = state.lock().unwrap();
                                            state.message = format!("dialog_result:{}:2", request_id); // Cancel
                                        }
                                    }
                                }
                            }
                            _ => {
                                println!("❌ Unknown dialog type: {}", dialog_type);
                            }
                        }
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