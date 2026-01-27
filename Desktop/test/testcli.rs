use std::io;
use serde_json::{json, Value};
use tokio;
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::{Backend, CrosstermBackend},
    layout::{Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph, Wrap},
    Frame, Terminal,
};

#[derive(Debug, Clone)]
struct ChatMessage {
    sender: String,
    content: String,
    timestamp: String,
}

#[derive(Debug, Clone)]
struct User {
    id: String,
    name: String,
    email: String,
}

#[derive(Debug, PartialEq)]
enum AppState {
    Login,
    Password,
    Chat,
    Quit,
}

#[derive(Debug, PartialEq)]
enum InputMode {
    Normal,
    Editing,
}

struct App {
    state: AppState,
    input_mode: InputMode,
    input: String,
    password: String,
    identifier: String,
    messages: Vec<ChatMessage>,
    user: Option<User>,
    client: reqwest::Client,
    erp_base_url: String,
    auth_token: Option<String>,
    cursor_position: usize,
    scroll_offset: usize,
    login_error: Option<String>,
    should_login: bool,
}

impl App {
    fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            state: AppState::Login,
            input_mode: InputMode::Editing,
            input: String::new(),
            password: String::new(),
            identifier: String::new(),
            messages: Vec::new(),
            user: None,
            client,
            erp_base_url: "http://10.10.60.8:1669".to_string(),
            auth_token: None,
            cursor_position: 0,
            scroll_offset: 0,
            login_error: None,
            should_login: false,
        }
    }

    async fn login(&mut self, identifier: &str, password: Option<&str>) -> Result<bool, Box<dyn std::error::Error>> {
        let login_url = format!("{}/api/auth/login", self.erp_base_url);
        
        let payload = json!({
            "identifier": identifier,
            "password": password,
            "createPassword": password.is_none()
        });

        println!("Attempting login to: {}", login_url);
        println!("Payload: {}", serde_json::to_string_pretty(&payload)?);

        let response = self.client
            .post(&login_url)
            .json(&payload)
            .send()
            .await?;

        let status = response.status();
        let response_text = response.text().await?;

        println!("Response status: {}", status);
        println!("Response body: {}", response_text);

        if !status.is_success() {
            self.login_error = Some(format!("Login failed: {} - {}", status, response_text));
            return Ok(false);
        }

        let login_response: Value = serde_json::from_str(&response_text)?;

        if let (Some(success), Some(token), Some(user_data)) = (
            login_response.get("success").and_then(|v| v.as_bool()),
            login_response.get("token").and_then(|v| v.as_str()),
            login_response.get("user")
        ) {
            if success {
                self.auth_token = Some(token.to_string());
                
                // Extract user information
                let user = User {
                    id: user_data.get("id").and_then(|v| v.as_str()).unwrap_or("unknown").to_string(),
                    name: user_data.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown User").to_string(),
                    email: user_data.get("email").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                };
                
                self.user = Some(user);
                self.login_error = None;
                
                // Add welcome message
                self.messages.push(ChatMessage {
                    sender: "System".to_string(),
                    content: format!("Welcome {}! You are now logged in.", self.user.as_ref().unwrap().name),
                    timestamp: chrono::Utc::now().format("%H:%M:%S").to_string(),
                });
                
                return Ok(true);
            }
        }

        self.login_error = Some("Login failed: Invalid response format".to_string());
        Ok(false)
    }

    async fn perform_login(&mut self) -> Result<bool, Box<dyn std::error::Error>> {
        let identifier = self.identifier.clone();
        let password = self.password.clone();
        let result = self.login(&identifier, Some(&password)).await;
        match result {
            Ok(true) => {
                self.state = AppState::Chat;
                self.password.clear(); // Clear password from memory
                Ok(true)
            }
            Ok(false) => {
                self.state = AppState::Login; // Go back to login
                self.identifier.clear();
                self.password.clear();
                Ok(false)
            }
            Err(e) => {
                self.login_error = Some(format!("Login error: {}", e));
                self.state = AppState::Login; // Go back to login
                self.identifier.clear();
                self.password.clear();
                Err(e)
            }
        }
    }

    async fn send_message(&mut self, content: &str) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(_token) = &self.auth_token {
            // Add user message to chat
            let user_name = self.user.as_ref().map(|u| u.name.clone()).unwrap_or("You".to_string());
            self.messages.push(ChatMessage {
                sender: user_name,
                content: content.to_string(),
                timestamp: chrono::Utc::now().format("%H:%M:%S").to_string(),
            });

            // For demo purposes, add a simple echo response
            // In a real implementation, this would send to the chat API
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            
            self.messages.push(ChatMessage {
                sender: "Echo Bot".to_string(),
                content: format!("Echo: {}", content),
                timestamp: chrono::Utc::now().format("%H:%M:%S").to_string(),
            });
        }
        
        Ok(())
    }

    fn move_cursor_left(&mut self) {
        let cursor_moved_left = self.cursor_position.saturating_sub(1);
        self.cursor_position = self.clamp_cursor(cursor_moved_left);
    }

    fn move_cursor_right(&mut self) {
        let cursor_moved_right = self.cursor_position.saturating_add(1);
        self.cursor_position = self.clamp_cursor(cursor_moved_right);
    }

    fn enter_char(&mut self, new_char: char) {
        self.input.insert(self.cursor_position, new_char);
        self.move_cursor_right();
    }

    fn delete_char(&mut self) {
        let is_not_cursor_leftmost = self.cursor_position != 0;
        if is_not_cursor_leftmost {
            let current_index = self.cursor_position;
            let from_left_to_current_index = current_index - 1;
            let before_char_to_delete = self.input.chars().take(from_left_to_current_index);
            let after_char_to_delete = self.input.chars().skip(current_index);
            self.input = before_char_to_delete.chain(after_char_to_delete).collect();
            self.move_cursor_left();
        }
    }

    fn clamp_cursor(&self, new_cursor_pos: usize) -> usize {
        new_cursor_pos.clamp(0, self.input.len())
    }

    fn reset_cursor(&mut self) {
        self.cursor_position = 0;
    }

    fn submit_message(&mut self) {
        let message = self.input.clone();
        self.input.clear();
        self.reset_cursor();
        
        // Handle the message based on current state
        match self.state {
            AppState::Login => {
                // Store the identifier and move to password
                if !message.is_empty() {
                    self.identifier = message;
                    self.state = AppState::Password;
                    self.login_error = None;
                }
            }
            AppState::Password => {
                // Store password and attempt login
                if !message.is_empty() {
                    self.password = message;
                    self.should_login = true;
                }
            }
            AppState::Chat => {
                if !message.is_empty() {
                    // Add user message to chat immediately
                    let user_name = self.user.as_ref().map(|u| u.name.clone()).unwrap_or("You".to_string());
                    self.messages.push(ChatMessage {
                        sender: user_name,
                        content: message.clone(),
                        timestamp: chrono::Utc::now().format("%H:%M:%S").to_string(),
                    });

                    // Add echo response
                    self.messages.push(ChatMessage {
                        sender: "Echo Bot".to_string(),
                        content: format!("Echo: {}", message),
                        timestamp: chrono::Utc::now().format("%H:%M:%S").to_string(),
                    });
                }
            }
            _ => {}
        }
    }
}

fn ui(f: &mut Frame, app: &App) {
    match app.state {
        AppState::Login => draw_login_screen(f, app),
        AppState::Password => draw_password_screen(f, app),
        AppState::Chat => draw_chat_screen(f, app),
        AppState::Quit => {}
    }
}

fn draw_login_screen(f: &mut Frame, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .margin(2)
        .constraints([
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Min(1),
        ])
        .split(f.area());

    let title = Paragraph::new("Miko Workspace - CLI Login")
        .style(Style::default().fg(Color::Cyan))
        .block(Block::default().borders(Borders::ALL));
    f.render_widget(title, chunks[0]);

    let input_title = match app.input_mode {
        InputMode::Normal => "Enter your identifier (email/username) - Press Enter to edit",
        InputMode::Editing => "Enter your identifier (email/username) - [EDITING]",
    };

    let input = Paragraph::new(app.input.as_str())
        .style(match app.input_mode {
            InputMode::Normal => Style::default(),
            InputMode::Editing => Style::default().fg(Color::Yellow),
        })
        .block(Block::default().borders(Borders::ALL).title(input_title));
    f.render_widget(input, chunks[1]);

    if app.input_mode == InputMode::Editing {
        f.set_cursor_position((
            chunks[1].x + app.cursor_position as u16 + 1,
            chunks[1].y + 1,
        ));
    }

    let instructions = Paragraph::new("Press Enter to login, Esc to switch modes, 'q' or Ctrl+C to quit")
        .style(Style::default().fg(Color::Gray))
        .block(Block::default().borders(Borders::ALL).title("Instructions"));
    f.render_widget(instructions, chunks[2]);

    if let Some(error) = &app.login_error {
        let error_msg = Paragraph::new(error.as_str())
            .style(Style::default().fg(Color::Red))
            .block(Block::default().borders(Borders::ALL).title("Error"))
            .wrap(Wrap { trim: true });
        f.render_widget(error_msg, chunks[3]);
    }
}

fn draw_password_screen(f: &mut Frame, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .margin(2)
        .constraints([
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Min(1),
        ])
        .split(f.area());

    let title = Paragraph::new("Miko Workspace - Enter Password")
        .style(Style::default().fg(Color::Cyan))
        .block(Block::default().borders(Borders::ALL));
    f.render_widget(title, chunks[0]);

    let identifier_display = Paragraph::new(format!("Logging in as: {}", app.identifier))
        .style(Style::default().fg(Color::Green))
        .block(Block::default().borders(Borders::ALL).title("Identifier"));
    f.render_widget(identifier_display, chunks[1]);

    let input_title = match app.input_mode {
        InputMode::Normal => "Enter your password - Press Enter to edit",
        InputMode::Editing => "Enter your password - [EDITING]",
    };

    // Display password as asterisks
    let password_display = "*".repeat(app.input.len());
    let input = Paragraph::new(password_display.as_str())
        .style(match app.input_mode {
            InputMode::Normal => Style::default(),
            InputMode::Editing => Style::default().fg(Color::Yellow),
        })
        .block(Block::default().borders(Borders::ALL).title(input_title));
    f.render_widget(input, chunks[2]);

    if app.input_mode == InputMode::Editing {
        f.set_cursor_position((
            chunks[2].x + app.cursor_position as u16 + 1,
            chunks[2].y + 1,
        ));
    }

    let instructions = Paragraph::new("Press Enter to login, Esc to switch modes, 'q' or Ctrl+C to quit")
        .style(Style::default().fg(Color::Gray))
        .block(Block::default().borders(Borders::ALL).title("Instructions"));
    f.render_widget(instructions, chunks[3]);

    if let Some(error) = &app.login_error {
        let error_msg = Paragraph::new(error.as_str())
            .style(Style::default().fg(Color::Red))
            .block(Block::default().borders(Borders::ALL).title("Error"))
            .wrap(Wrap { trim: true });
        f.render_widget(error_msg, chunks[4]);
    }
}

fn draw_chat_screen(f: &mut Frame, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .margin(1)
        .constraints([
            Constraint::Length(3),
            Constraint::Min(1),
            Constraint::Length(3),
        ])
        .split(f.area());

    // Header
    let user_info = if let Some(user) = &app.user {
        format!("Logged in as: {} ({})", user.name, user.email)
    } else {
        "Not logged in".to_string()
    };
    
    let header = Paragraph::new(user_info)
        .style(Style::default().fg(Color::Green))
        .block(Block::default().borders(Borders::ALL).title("Miko Workspace - Chat"));
    f.render_widget(header, chunks[0]);

    // Messages
    let messages: Vec<ListItem> = app
        .messages
        .iter()
        .skip(app.scroll_offset)
        .map(|m| {
            let content = Line::from(vec![
                Span::styled(
                    format!("[{}] ", m.timestamp),
                    Style::default().fg(Color::Gray),
                ),
                Span::styled(
                    format!("{}: ", m.sender),
                    Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD),
                ),
                Span::raw(&m.content),
            ]);
            ListItem::new(content)
        })
        .collect();

    let messages_list = List::new(messages)
        .block(Block::default().borders(Borders::ALL).title("Messages"));
    f.render_widget(messages_list, chunks[1]);

    // Input
    let input_title = match app.input_mode {
        InputMode::Normal => "Type your message - Press Enter to edit (Esc for normal mode, 'q' or Ctrl+C to quit)",
        InputMode::Editing => "Type your message - [EDITING] (Esc for normal mode, 'q' or Ctrl+C to quit)",
    };

    let input = Paragraph::new(app.input.as_str())
        .style(match app.input_mode {
            InputMode::Normal => Style::default(),
            InputMode::Editing => Style::default().fg(Color::Yellow),
        })
        .block(Block::default().borders(Borders::ALL).title(input_title));
    f.render_widget(input, chunks[2]);

    if app.input_mode == InputMode::Editing {
        f.set_cursor_position((
            chunks[2].x + app.cursor_position as u16 + 1,
            chunks[2].y + 1,
        ));
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Create app and run it
    let mut app = App::new();
    let res = {
        let rt = tokio::runtime::Runtime::new()?;
        rt.block_on(run_app(&mut terminal, &mut app))
    };

    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    if let Err(err) = res {
        println!("{:?}", err)
    }

    Ok(())
}

async fn run_app<B: Backend>(
    terminal: &mut Terminal<B>,
    app: &mut App,
) -> io::Result<()> {
    loop {
        terminal.draw(|f| ui(f, app))?;

        if let Event::Key(key) = event::read()? {
            if key.kind == KeyEventKind::Press {
                match app.input_mode {
                    InputMode::Normal => match key.code {
                        KeyCode::Enter | KeyCode::Char('e') => {
                            app.input_mode = InputMode::Editing;
                        }
                        KeyCode::Char('q') => {
                            return Ok(());
                        }
                        KeyCode::Char('c') if key.modifiers.contains(event::KeyModifiers::CONTROL) => {
                            return Ok(());
                        }
                        _ => {}
                    },
                    InputMode::Editing => match key.code {
                        KeyCode::Enter => {
                            app.submit_message();
                        }
                        KeyCode::Char('c') if key.modifiers.contains(event::KeyModifiers::CONTROL) => {
                            return Ok(());
                        }
                        KeyCode::Char(c) => {
                            app.enter_char(c);
                        }
                        KeyCode::Backspace => {
                            app.delete_char();
                        }
                        KeyCode::Left => {
                            app.move_cursor_left();
                        }
                        KeyCode::Right => {
                            app.move_cursor_right();
                        }
                        KeyCode::Esc => {
                            app.input_mode = InputMode::Normal;
                        }
                        _ => {}
                    },
                }
            }
        }

        // Handle login attempt
        if app.should_login {
            app.should_login = false;
            match app.perform_login().await {
                Ok(true) => {
                    // Login successful, already handled in perform_login
                }
                Ok(false) => {
                    // Login failed, error already set
                }
                Err(_) => {
                    // Error already set in perform_login
                }
            }
        }

        if matches!(app.state, AppState::Quit) {
            return Ok(());
        }
    }
}