use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Serialize, Deserialize)]
pub struct DialogRequest {
    pub dialog_type: String,
    pub title: String,
    pub message: String,
    pub buttons: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DialogResponse {
    pub result: String,
    pub button_index: i32,
}

struct ModernDialog {
    title: String,
    message: String,
    ok_text: String,
    cancel_text: String,
    result: Arc<Mutex<Option<bool>>>,
    should_close: bool,
}

impl ModernDialog {
    fn new(title: String, message: String, ok_text: String, cancel_text: String) -> (Self, Arc<Mutex<Option<bool>>>) {
        let result = Arc::new(Mutex::new(None));
        let dialog = Self {
            title,
            message,
            ok_text,
            cancel_text,
            result: result.clone(),
            should_close: false,
        };
        (dialog, result)
    }
}

impl eframe::App for ModernDialog {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        if self.should_close {
            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
            return;
        }

        egui::CentralPanel::default()
            .frame(egui::Frame::none().fill(egui::Color32::from_rgb(248, 249, 250)))
            .show(ctx, |ui| {
                ui.allocate_ui_with_layout(
                    ui.available_size(),
                    egui::Layout::top_down(egui::Align::Center),
                    |ui| {
                        ui.add_space(20.0);

                        // Title
                        ui.label(
                            egui::RichText::new(&self.title)
                                .size(18.0)
                                .color(egui::Color32::from_rgb(33, 37, 41))
                                .strong(),
                        );

                        ui.add_space(20.0);

                        // Icon and message
                        ui.horizontal(|ui| {
                            ui.add_space(20.0);
                            
                            // Question mark icon (blue circle)
                            let icon_size = 32.0;
                            let (rect, _) = ui.allocate_exact_size(
                                egui::vec2(icon_size, icon_size),
                                egui::Sense::hover(),
                            );
                            
                            ui.painter().circle_filled(
                                rect.center(),
                                icon_size / 2.0,
                                egui::Color32::from_rgb(13, 110, 253),
                            );
                            
                            ui.painter().text(
                                rect.center(),
                                egui::Align2::CENTER_CENTER,
                                "?",
                                egui::FontId::proportional(20.0),
                                egui::Color32::WHITE,
                            );

                            ui.add_space(15.0);

                            // Message text
                            ui.label(
                                egui::RichText::new(&self.message)
                                    .size(14.0)
                                    .color(egui::Color32::from_rgb(73, 80, 87)),
                            );
                        });

                        ui.add_space(30.0);

                        // Buttons
                        ui.horizontal(|ui| {
                            ui.add_space(80.0);

                            // Yes button
                            let yes_button = egui::Button::new(&self.ok_text)
                                .min_size(egui::vec2(80.0, 32.0))
                                .fill(egui::Color32::from_rgb(248, 249, 250))
                                .stroke(egui::Stroke::new(1.0, egui::Color32::from_rgb(173, 181, 189)));

                            if ui.add(yes_button).clicked() {
                                *self.result.lock().unwrap() = Some(true);
                                self.should_close = true;
                            }

                            ui.add_space(10.0);

                            // No button
                            let no_button = egui::Button::new(&self.cancel_text)
                                .min_size(egui::vec2(80.0, 32.0))
                                .fill(egui::Color32::from_rgb(248, 249, 250))
                                .stroke(egui::Stroke::new(1.0, egui::Color32::from_rgb(173, 181, 189)));

                            if ui.add(no_button).clicked() {
                                *self.result.lock().unwrap() = Some(false);
                                self.should_close = true;
                            }
                        });
                    },
                );
            });

        // Handle window close
        if ctx.input(|i| i.viewport().close_requested()) {
            *self.result.lock().unwrap() = Some(false);
            self.should_close = true;
        }
    }
}

pub fn show_confirmation_dialog_sync(
    title: &str,
    message: &str,
    ok_text: &str,
    cancel_text: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    // Try modern dialog first
    match show_modern_confirmation_dialog(title, message, ok_text, cancel_text) {
        Ok(result) => Ok(result),
        Err(e) => {
            println!("Modern dialog failed: {}, falling back to system dialog", e);
            // Fallback to system dialog
            #[cfg(windows)]
            {
                show_windows_message_box(title, message, ok_text, cancel_text)
            }
            
            #[cfg(not(windows))]
            {
                println!("Dialog: {} - {}", title, message);
                println!("Options: {} / {}", ok_text, cancel_text);
                Ok(false)
            }
        }
    }
}

fn show_modern_confirmation_dialog(
    title: &str,
    message: &str,
    ok_text: &str,
    cancel_text: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    let (dialog, result) = ModernDialog::new(
        title.to_string(),
        message.to_string(),
        ok_text.to_string(),
        cancel_text.to_string(),
    );

    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([400.0, 200.0])
            .with_resizable(false)
            .with_decorations(true)
            .with_title(title),
        ..Default::default()
    };

    // Run the dialog synchronously
    match eframe::run_native("Dialog", options, Box::new(|_cc| Ok(Box::new(dialog)))) {
        Ok(_) => {
            // Check the result
            if let Ok(guard) = result.lock() {
                if let Some(result) = *guard {
                    return Ok(result);
                }
            }
            Ok(false) // Default to false if no result
        }
        Err(e) => Err(format!("Failed to run modern dialog: {}", e).into())
    }
}

pub fn show_confirmation_dialog(
    title: &str,
    message: &str,
    ok_text: &str,
    cancel_text: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    show_confirmation_dialog_sync(title, message, ok_text, cancel_text)
}

#[cfg(windows)]
fn show_windows_message_box(
    title: &str,
    message: &str,
    _ok_text: &str,
    _cancel_text: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    use windows::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, MB_YESNO, MB_ICONQUESTION, IDYES, MESSAGEBOX_RESULT
    };
    use windows::core::{HSTRING, PCWSTR};
    
    let title_wide = HSTRING::from(title);
    let message_wide = HSTRING::from(message);
    
    unsafe {
        let result: MESSAGEBOX_RESULT = MessageBoxW(
            None,
            PCWSTR(message_wide.as_ptr()),
            PCWSTR(title_wide.as_ptr()),
            MB_YESNO | MB_ICONQUESTION,
        );
        
        Ok(result == IDYES)
    }
}

pub fn show_info_dialog(
    title: &str,
    message: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(windows)]
    {
        show_windows_info_box(title, message)
    }
    
    #[cfg(not(windows))]
    {
        println!("Info: {} - {}", title, message);
        Ok(())
    }
}

#[cfg(windows)]
fn show_windows_info_box(
    title: &str,
    message: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    use windows::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, MB_OK, MB_ICONINFORMATION
    };
    use windows::core::{HSTRING, PCWSTR};
    
    let title_wide = HSTRING::from(title);
    let message_wide = HSTRING::from(message);
    
    unsafe {
        MessageBoxW(
            None,
            PCWSTR(message_wide.as_ptr()),
            PCWSTR(title_wide.as_ptr()),
            MB_OK | MB_ICONINFORMATION,
        );
    }
    
    Ok(())
}