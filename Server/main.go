package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	_ "github.com/joho/godotenv/autoload" // Automatically load .env file
)

// Response struct for API responses
type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func main() {
	// Initialize database connection
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		log.Fatal("DATABASE_URL environment variable not set")
	}
	InitDB(connStr)

	// Initialize auth service
	InitAuth()

	// Initialize WebSocket hub
	InitWebSocket()

	// --- Chi Router Setup ---
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger) // Chi's built-in logger
	r.Use(middleware.Recoverer)

	// Public routes
	r.Post("/api/login", loginHandler)
	
	// Download routes with flexible auth (supports header OR query param)
	r.With(flexibleAuthMiddleware).Get("/api/files/download", downloadFileHandler)
	r.With(flexibleAuthMiddleware).Get("/api/files/d/{token}", downloadByTokenHandler)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)

		// WebSocket status endpoint (requires auth)
		r.Get("/api/ws/status", wsStatusHandler)

		// File upload routes
		setupFileUploadRoutes(r)
		
		// Chunked upload routes (for large files)
		setupChunkedUploadRoutes(r)

		// Queue routes
		r.Get("/api/queue", getQueuesHandler)
		r.Post("/api/queue", createQueueHandler)
		r.Post("/api/queue/{id}/assign", assignQueueHandler) // Assign queue by ID
		
		// Chat-specific queue routes are in the chat routes section

		// User routes
		r.Route("/api/users", func(r chi.Router) {
			r.Get("/", getUsersHandler)
			r.Get("/me/joined-chats", getUserJoinedChatsHandler) // Must be before /{id}
			r.Get("/{id}", getUserHandler)
		})

		// Customer routes
		r.Route("/api/customers", func(r chi.Router) {
			r.Get("/", getCustomersHandler)
			r.Post("/", createCustomerHandler)
			r.Get("/{id}", getCustomerHandler)
			r.Put("/{id}", updateCustomerHandler)
			r.Delete("/{id}", deleteCustomerHandler)
			r.Get("/cusId/{cusId}", getCustomerByCusIdHandler)
		})

		// Proof routes
		r.Route("/api/proof", func(r chi.Router) {
			r.Get("/", getProofDataHandler)
			r.Post("/", createProofDataHandler)
			r.Get("/next-runner-id", getNextRunnerIDHandler)
			r.Get("/{id}", getProofDataByIDHandler)
			r.Put("/{id}", updateProofDataHandler)
			r.Delete("/{id}", deleteProofDataHandler)
		})

		// File management routes (upload, list, delete)
		r.Route("/api/files", func(r chi.Router) {
			r.Get("/list", listFilesHandler)
			r.Post("/upload", uploadFilesHandler)
			r.Delete("/delete", deleteFileHandler)
		})

				// Auth routes

				r.Get("/api/auth/me", meHandler)

		

						// Chat routes

		

						r.Route("/api/chats", func(r chi.Router) {

		

							r.Get("/", getChatsHandler)

							r.Post("/", createChatHandler)

		

							r.Get("/{uuid}", getChatHandler)
							r.Get("/{uuid}/queue", getChatQueueHandler)
							r.Post("/{uuid}/assign-queue", assignQueueByChatHandler) // Assign queue for this chat
							r.Patch("/{uuid}", updateChatHandler)
							r.Patch("/{uuid}/status", updateChatStatusHandler)

		

							r.Get("/{uuid}/messages", getChatMessagesHandler)
							r.Post("/{uuid}/messages", sendMessageHandler)
							r.Get("/{uuid}/messages/search", searchMessagesHandler)

							r.Delete("/{uuid}", deleteChatHandler)

							// Chat member routes (using ID instead of UUID for simplicity)
							r.Post("/{id}/join", joinChatHandler)
							r.Post("/{id}/leave", leaveChatHandler)
							r.Get("/{id}/members", getChatMembersHandler)
							r.Get("/{id}/is-member", checkMembershipHandler)

		

						})

						
						// Message routes
						r.Route("/api/messages", func(r chi.Router) {
							r.Get("/", getMessagesHandler) // Keep existing route for backward compatibility
							r.Put("/{messageId}", editMessageHandler)
							r.Delete("/{messageId}", deleteMessageHandler)
							r.Post("/{messageId}/reactions", addReactionHandler)
						})

		

					})

	// WebSocket endpoint (handles auth internally)
	r.Get("/ws", wsHandler)

	// Static file serving for uploads (public access for images)
	r.Route("/uploads", func(r chi.Router) {
		// Handle CORS preflight requests
		r.Options("/*", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.WriteHeader(http.StatusOK)
		})
		
		// Note: Making this public so <img> tags can load images
		// In production, consider using signed URLs or a CDN
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			// Extract the file path from the URL
			filePath := strings.TrimPrefix(r.URL.Path, "/uploads/")
			fullPath := filepath.Join(".", "uploads", filePath)
			
			// Security: Prevent directory traversal attacks
			if strings.Contains(filePath, "..") {
				http.Error(w, "Invalid file path", http.StatusBadRequest)
				return
			}
			
			// Check if file exists
			if _, err := os.Stat(fullPath); os.IsNotExist(err) {
				http.Error(w, "File not found", http.StatusNotFound)
				return
			}
			
			// Set CORS headers to allow cross-origin requests
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			
			// Get file extension for content type detection
			ext := strings.ToLower(filepath.Ext(filePath))
			
			// Set appropriate content type headers
			switch ext {
			case ".jpg", ".jpeg":
				w.Header().Set("Content-Type", "image/jpeg")
			case ".png":
				w.Header().Set("Content-Type", "image/png")
			case ".gif":
				w.Header().Set("Content-Type", "image/gif")
			case ".webp":
				w.Header().Set("Content-Type", "image/webp")
			case ".pdf":
				w.Header().Set("Content-Type", "application/pdf")
			case ".zip":
				w.Header().Set("Content-Type", "application/zip")
			case ".rar":
				w.Header().Set("Content-Type", "application/x-rar-compressed")
			case ".7z":
				w.Header().Set("Content-Type", "application/x-7z-compressed")
			case ".txt":
				w.Header().Set("Content-Type", "text/plain")
			case ".json":
				w.Header().Set("Content-Type", "application/json")
			case ".xml":
				w.Header().Set("Content-Type", "application/xml")
			case ".mp4":
				w.Header().Set("Content-Type", "video/mp4")
			case ".mp3":
				w.Header().Set("Content-Type", "audio/mpeg")
			case ".wav":
				w.Header().Set("Content-Type", "audio/wav")
			default:
				// For unknown file types, let the browser handle it
				w.Header().Set("Content-Type", "application/octet-stream")
			}
			
			// Set cache headers for better performance
			w.Header().Set("Cache-Control", "public, max-age=3600") // Cache for 1 hour
			
			// For non-image files, suggest download with original filename
			if !strings.HasPrefix(w.Header().Get("Content-Type"), "image/") {
				filename := filepath.Base(filePath)
				w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
			}
			
			// Serve the file
			http.ServeFile(w, r, fullPath)
		})
	})

		

			port := ":5669"
	fmt.Printf("Server starting on port %s\n", port)
	fmt.Printf("WebSocket endpoint: ws://localhost%s/ws\n", port)
	log.Fatal(http.ListenAndServe(port, r))
}

func getQueuesHandler(w http.ResponseWriter, r *http.Request) {
	queues, err := GetAllQueues()
	if err != nil {
		log.Printf("Error fetching queues: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to fetch queues"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    queues,
	})
}

func createQueueHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by authMiddleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Could not identify user from token"}`, http.StatusUnauthorized)
		return
	}

	var newQueue Queue
	if err := json.NewDecoder(r.Body).Decode(&newQueue); err != nil {
		http.Error(w, `{"success": false, "error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if newQueue.JobName == "" {
		http.Error(w, `{"success": false, "error": "Job name is required"}`, http.StatusBadRequest)
		return
	}

	// Set defaults
	if newQueue.RequestType == "" {
		newQueue.RequestType = "dimension"
	}
	if newQueue.Priority == "" {
		newQueue.Priority = "normal"
	}
	if newQueue.Status == "" {
		newQueue.Status = "PENDING"
	}

	// Assign user from token
	newQueue.CreatedByID.Int64 = int64(user.ID)
	newQueue.CreatedByID.Valid = true
	newQueue.CreatedByName.String = user.Name
	newQueue.CreatedByName.Valid = true
	newQueue.UpdatedByID = newQueue.CreatedByID
	newQueue.UpdatedByName = newQueue.CreatedByName

	newQueue.CreatedAt = time.Now()
	newQueue.UpdatedAt = time.Now()

	insertedQueue, err := InsertQueue(newQueue)
	if err != nil {
		log.Printf("Error inserting queue: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to create queue item"}`, http.StatusInternalServerError)
		return
	}

	// Broadcast queue update via WebSocket
	BroadcastQueueUpdate(map[string]interface{}{
		"action": "created",
		"queue":  insertedQueue,
		"user":   user.Name,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Queue item created successfully",
		Data:    insertedQueue,
	})
}
func wsStatusHandler(w http.ResponseWriter, r *http.Request) {
	connectedClients := GetConnectedClients()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"connectedClients": connectedClients,
			"status":          "running",
		},
	})
}