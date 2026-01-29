package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow connections from any origin (adjust for production)
		return true
	},
}

// Client represents a WebSocket client
type Client struct {
	conn   *websocket.Conn
	send   chan []byte
	hub    *Hub
	userID int
	user   *User
}

// Hub maintains the set of active clients and broadcasts messages to the clients
type Hub struct {
	// Registered clients
	clients map[*Client]bool

	// Inbound messages from the clients
	broadcast chan []byte

	// Register requests from the clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Mutex for thread-safe operations
	mutex sync.RWMutex
}

// WebSocket message types
type WSMessage struct {
	Type    string      `json:"type"`
	Data    interface{} `json:"data,omitempty"`
	UserID  int         `json:"userId,omitempty"`
	Channel string      `json:"channel,omitempty"`
}

// Message types
const (
	MessageTypeChat         = "chat_message"
	MessageTypeUserJoined   = "user_joined"
	MessageTypeUserLeft     = "user_left"
	MessageTypeStatusUpdate = "status_update"
	MessageTypeQueueUpdate  = "queue_update"
	MessageTypePing         = "ping"
	MessageTypePong         = "pong"
)

// Global hub instance
var wsHub *Hub

// InitWebSocket initializes the WebSocket hub
func InitWebSocket() {
	wsHub = &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
	go wsHub.run()
}

// Run starts the hub
func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client] = true
			h.mutex.Unlock()
			
			log.Printf("Client connected: User ID %d", client.userID)
			
			// Send welcome message
			welcomeMsg := WSMessage{
				Type: MessageTypeUserJoined,
				Data: map[string]interface{}{
					"message": "Connected to real-time server",
					"userId":  client.userID,
				},
			}
			if data, err := json.Marshal(welcomeMsg); err == nil {
				select {
				case client.send <- data:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Printf("Client disconnected: User ID %d", client.userID)
			}
			h.mutex.Unlock()

		case message := <-h.broadcast:
			h.mutex.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mutex.RUnlock()
		}
	}
}

// BroadcastMessage sends a message to all connected clients
func (h *Hub) BroadcastMessage(msgType string, data interface{}) {
	message := WSMessage{
		Type: msgType,
		Data: data,
	}
	
	if jsonData, err := json.Marshal(message); err == nil {
		select {
		case h.broadcast <- jsonData:
		default:
			log.Printf("Failed to broadcast message: channel full")
		}
	}
}

// BroadcastToChannel sends a message to clients in a specific channel
func (h *Hub) BroadcastToChannel(channel string, msgType string, data interface{}) {
	message := WSMessage{
		Type:    msgType,
		Channel: channel,
		Data:    data,
	}
	
	if jsonData, err := json.Marshal(message); err == nil {
		h.mutex.RLock()
		for client := range h.clients {
			select {
			case client.send <- jsonData:
			default:
				close(client.send)
				delete(h.clients, client)
			}
		}
		h.mutex.RUnlock()
	}
}

// WebSocket handler
func wsHandler(w http.ResponseWriter, r *http.Request) {
	// Try to get user from context first (if auth middleware was applied)
	user, ok := r.Context().Value(userContextKey).(*User)
	
	// If no user from context, try to get token from query parameter
	if !ok || user == nil {
		token := r.URL.Query().Get("token")
		if token == "" {
			http.Error(w, "Unauthorized: No token provided", http.StatusUnauthorized)
			return
		}
		
		// Validate the token
		var err error
		user, err = ValidateToken(token)
		if err != nil {
			log.Printf("WebSocket auth error: %v", err)
			http.Error(w, "Unauthorized: Invalid token", http.StatusUnauthorized)
			return
		}
	}

	log.Printf("WebSocket connection attempt from user: %s (ID: %d)", user.Name, user.ID)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &Client{
		conn:   conn,
		send:   make(chan []byte, 256),
		hub:    wsHub,
		userID: user.ID,
		user:   user,
	}

	client.hub.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

// readPump pumps messages from the websocket connection to the hub
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	for {
		_, messageBytes, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Parse incoming message
		var msg WSMessage
		if err := json.Unmarshal(messageBytes, &msg); err != nil {
			log.Printf("Failed to parse WebSocket message: %v", err)
			continue
		}

		// Handle different message types
		switch msg.Type {
		case MessageTypePing:
			// Respond with pong
			pongMsg := WSMessage{
				Type: MessageTypePong,
				Data: map[string]interface{}{
					"timestamp": msg.Data,
				},
			}
			if data, err := json.Marshal(pongMsg); err == nil {
				select {
				case c.send <- data:
				default:
					return
				}
			}

		case MessageTypeChat:
			// Handle chat messages
			log.Printf("Chat message from user %d: %v", c.userID, msg.Data)
			// You can process and broadcast chat messages here
			c.hub.BroadcastMessage(MessageTypeChat, map[string]interface{}{
				"userId":  c.userID,
				"user":    c.user.Name,
				"message": msg.Data,
			})

		default:
			log.Printf("Unknown message type: %s", msg.Type)
		}
	}
}

// writePump pumps messages from the hub to the websocket connection
func (c *Client) writePump() {
	defer c.conn.Close()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("WebSocket write error: %v", err)
				return
			}
		}
	}
}

// GetConnectedClients returns the number of connected clients
func GetConnectedClients() int {
	if wsHub == nil {
		return 0
	}
	wsHub.mutex.RLock()
	defer wsHub.mutex.RUnlock()
	return len(wsHub.clients)
}

// BroadcastQueueUpdate broadcasts queue updates to all clients
func BroadcastQueueUpdate(queueItem interface{}) {
	if wsHub != nil {
		wsHub.BroadcastMessage(MessageTypeQueueUpdate, queueItem)
	}
}

// BroadcastChatMessage broadcasts chat messages to all clients
func BroadcastChatMessage(message interface{}) {
	if wsHub != nil {
		wsHub.BroadcastMessage(MessageTypeChat, message)
	}
}