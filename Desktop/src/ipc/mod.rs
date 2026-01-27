// IPC (Inter-Process Communication) handlers
use crate::core::SharedAppState;









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
                                _ => {}
                            }
                        }
                    }
                    
                    // Handle simple string commands (existing functionality)
                    match body.as_str() {
                        "get_state" => {
                            let state = state.lock().unwrap();
                            println!("State requested - counter: {}", state.counter);
                        }
                        "test_ipc" => {
                            println!("✅ IPC test successful");
                        }
                        _ => {}
                    }
                }
                

                

                

                

