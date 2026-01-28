package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
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

	// --- Chi Router Setup ---
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger) // Chi's built-in logger
	r.Use(middleware.Recoverer)

	// Public routes
	r.Post("/api/login", loginHandler)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)

		// Queue routes
		r.Get("/api/queue", getQueuesHandler)
		r.Post("/api/queue", createQueueHandler)

		// User routes
		r.Route("/api/users", func(r chi.Router) {
			r.Get("/", getUsersHandler)
			r.Get("/{id}", getUserHandler)
		})

				// Auth routes

				r.Get("/api/auth/me", meHandler)

		

						// Chat routes

		

						r.Route("/api/chats", func(r chi.Router) {

		

							r.Get("/", getChatsHandler)

		

							r.Get("/{uuid}", getChatHandler)

		

							r.Get("/{uuid}/messages", getChatMessagesHandler)

		

						})

		

				

		

						// Message history route

		

						r.Get("/api/messages", getMessagesHandler)

		

					})

		

			port := ":5669"
	fmt.Printf("Server starting on port %s\n", port)
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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Queue item created successfully",
		Data:    insertedQueue,
	})
}