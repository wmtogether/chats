// Core application functionality
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct AppState {
    pub counter: i32,
    pub message: String,
    pub wgpu_initialized: bool,
    pub webview_initialized: bool,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            counter: 0,
            message: "Initializing...".to_string(),
            wgpu_initialized: false,
            webview_initialized: false,
        }
    }
}

pub type SharedAppState = Arc<Mutex<AppState>>;

pub fn create_shared_state() -> SharedAppState {
    Arc::new(Mutex::new(AppState::default()))
}