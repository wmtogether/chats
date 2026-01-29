package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync"

	"github.com/go-chi/chi/v5"
)

// ChunkUploadSession represents an active chunked upload session
type ChunkUploadSession struct {
	UploadID     string `json:"uploadId"`
	Filename     string `json:"filename"`
	TotalSize    int64  `json:"totalSize"`
	ChunkSize    int64  `json:"chunkSize"`
	TotalChunks  int    `json:"totalChunks"`
	ReceivedChunks map[int]bool `json:"receivedChunks"`
	TempDir      string `json:"tempDir"`
	UserID       int    `json:"userId"`
	CreatedAt    int64  `json:"createdAt"`
	mutex        sync.RWMutex
}

// ChunkUploadResponse represents the response for chunk upload operations
type ChunkUploadResponse struct {
	Success      bool   `json:"success"`
	UploadID     string `json:"uploadId,omitempty"`
	ChunkIndex   int    `json:"chunkIndex,omitempty"`
	TotalChunks  int    `json:"totalChunks,omitempty"`
	Progress     float64 `json:"progress,omitempty"`
	IsComplete   bool   `json:"isComplete,omitempty"`
	FinalURL     string `json:"finalUrl,omitempty"`
	Error        string `json:"error,omitempty"`
}

// Global map to store active upload sessions
var uploadSessions = make(map[string]*ChunkUploadSession)
var sessionsMutex sync.RWMutex

// Setup chunked upload routes
func setupChunkedUploadRoutes(r chi.Router) {
	// Initialize chunked upload
	r.Post("/api/chunked-upload/init", initChunkedUploadHandler)
	
	// Upload chunk
	r.Post("/api/chunked-upload/chunk", uploadChunkHandler)
	
	// Complete chunked upload
	r.Post("/api/chunked-upload/complete", completeChunkedUploadHandler)
	
	// Get upload status
	r.Get("/api/chunked-upload/status/{uploadId}", getUploadStatusHandler)
	
	// Cancel upload
	r.Delete("/api/chunked-upload/{uploadId}", cancelUploadHandler)
}

func initChunkedUploadHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Parse request
	var req struct {
		Filename  string `json:"filename"`
		TotalSize int64  `json:"totalSize"`
		ChunkSize int64  `json:"chunkSize"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithChunkError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Filename == "" || req.TotalSize <= 0 || req.ChunkSize <= 0 {
		respondWithChunkError(w, "Invalid parameters", http.StatusBadRequest)
		return
	}

	// Validate file size (3GB max)
	if req.TotalSize > 3*1024*1024*1024 {
		respondWithChunkError(w, "File too large. Maximum size is 3GB", http.StatusBadRequest)
		return
	}

	// Generate upload ID
	uploadID := fmt.Sprintf("%d_%s_%d", user.ID, req.Filename, req.TotalSize)

	// Calculate total chunks
	totalChunks := int((req.TotalSize + req.ChunkSize - 1) / req.ChunkSize)

	// Create temp directory for chunks
	tempDir := filepath.Join(".", "temp", uploadID)
	err := os.MkdirAll(tempDir, os.ModePerm)
	if err != nil {
		log.Printf("Error creating temp directory: %v", err)
		respondWithChunkError(w, "Failed to create temp directory", http.StatusInternalServerError)
		return
	}

	// Create upload session
	session := &ChunkUploadSession{
		UploadID:       uploadID,
		Filename:       req.Filename,
		TotalSize:      req.TotalSize,
		ChunkSize:      req.ChunkSize,
		TotalChunks:    totalChunks,
		ReceivedChunks: make(map[int]bool),
		TempDir:        tempDir,
		UserID:         user.ID,
		CreatedAt:      req.TotalSize, // Using as timestamp placeholder
	}

	// Store session
	sessionsMutex.Lock()
	uploadSessions[uploadID] = session
	sessionsMutex.Unlock()

	log.Printf("Initialized chunked upload: %s (user: %s, size: %d bytes, chunks: %d)", 
		uploadID, user.Name, req.TotalSize, totalChunks)

	// Respond with session info
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ChunkUploadResponse{
		Success:     true,
		UploadID:    uploadID,
		TotalChunks: totalChunks,
		Progress:    0,
	})
}

func uploadChunkHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Parse multipart form
	err := r.ParseMultipartForm(32 << 20) // 32MB max memory
	if err != nil {
		respondWithChunkError(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	// Get parameters
	uploadID := r.FormValue("uploadId")
	chunkIndexStr := r.FormValue("chunkIndex")

	if uploadID == "" || chunkIndexStr == "" {
		respondWithChunkError(w, "Missing uploadId or chunkIndex", http.StatusBadRequest)
		return
	}

	chunkIndex, err := strconv.Atoi(chunkIndexStr)
	if err != nil {
		respondWithChunkError(w, "Invalid chunkIndex", http.StatusBadRequest)
		return
	}

	// Get upload session
	sessionsMutex.RLock()
	session, exists := uploadSessions[uploadID]
	sessionsMutex.RUnlock()

	if !exists {
		respondWithChunkError(w, "Upload session not found", http.StatusNotFound)
		return
	}

	// Verify user owns this session
	if session.UserID != user.ID {
		respondWithChunkError(w, "Unauthorized access to upload session", http.StatusForbidden)
		return
	}

	// Get chunk file
	file, _, err := r.FormFile("chunk")
	if err != nil {
		respondWithChunkError(w, "No chunk file provided", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Save chunk to temp file
	chunkPath := filepath.Join(session.TempDir, fmt.Sprintf("chunk_%d", chunkIndex))
	chunkFile, err := os.Create(chunkPath)
	if err != nil {
		log.Printf("Error creating chunk file: %v", err)
		respondWithChunkError(w, "Failed to create chunk file", http.StatusInternalServerError)
		return
	}
	defer chunkFile.Close()

	// Copy chunk data
	_, err = io.Copy(chunkFile, file)
	if err != nil {
		log.Printf("Error saving chunk: %v", err)
		respondWithChunkError(w, "Failed to save chunk", http.StatusInternalServerError)
		return
	}

	// Update session
	session.mutex.Lock()
	session.ReceivedChunks[chunkIndex] = true
	receivedCount := len(session.ReceivedChunks)
	session.mutex.Unlock()

	// Calculate progress
	progress := math.Round(float64(receivedCount)/float64(session.TotalChunks)*100*100) / 100

	log.Printf("Received chunk %d/%d for upload %s (%.1f%%)", 
		chunkIndex+1, session.TotalChunks, uploadID, progress)

	// Broadcast progress via WebSocket
	if wsHub != nil {
		wsHub.BroadcastMessage("upload_progress", UploadProgress{
			UploadID:   uploadID,
			Filename:   session.Filename,
			Progress:   progress,
			BytesRead:  int64(receivedCount) * session.ChunkSize,
			TotalBytes: session.TotalSize,
			Status:     "uploading",
		})
	}

	// Check if upload is complete
	isComplete := receivedCount == session.TotalChunks

	// Respond
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ChunkUploadResponse{
		Success:     true,
		UploadID:    uploadID,
		ChunkIndex:  chunkIndex,
		TotalChunks: session.TotalChunks,
		Progress:    progress,
		IsComplete:  isComplete,
	})
}

func completeChunkedUploadHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Parse request
	var req struct {
		UploadID string `json:"uploadId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithChunkError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get upload session
	sessionsMutex.RLock()
	session, exists := uploadSessions[req.UploadID]
	sessionsMutex.RUnlock()

	if !exists {
		respondWithChunkError(w, "Upload session not found", http.StatusNotFound)
		return
	}

	// Verify user owns this session
	if session.UserID != user.ID {
		respondWithChunkError(w, "Unauthorized access to upload session", http.StatusForbidden)
		return
	}

	// Verify all chunks received
	session.mutex.RLock()
	receivedCount := len(session.ReceivedChunks)
	session.mutex.RUnlock()

	if receivedCount != session.TotalChunks {
		respondWithChunkError(w, fmt.Sprintf("Missing chunks: received %d/%d", receivedCount, session.TotalChunks), http.StatusBadRequest)
		return
	}

	// Create final file
	uploadDir := filepath.Join(".", "uploads")
	err := os.MkdirAll(uploadDir, os.ModePerm)
	if err != nil {
		respondWithChunkError(w, "Failed to create upload directory", http.StatusInternalServerError)
		return
	}

	finalFilename := generateUniqueFilename(session.Filename)
	finalPath := filepath.Join(uploadDir, finalFilename)
	finalFile, err := os.Create(finalPath)
	if err != nil {
		log.Printf("Error creating final file: %v", err)
		respondWithChunkError(w, "Failed to create final file", http.StatusInternalServerError)
		return
	}
	defer finalFile.Close()

	// Combine chunks in order
	for i := 0; i < session.TotalChunks; i++ {
		chunkPath := filepath.Join(session.TempDir, fmt.Sprintf("chunk_%d", i))
		chunkFile, err := os.Open(chunkPath)
		if err != nil {
			log.Printf("Error opening chunk %d: %v", i, err)
			respondWithChunkError(w, fmt.Sprintf("Failed to read chunk %d", i), http.StatusInternalServerError)
			return
		}

		_, err = io.Copy(finalFile, chunkFile)
		chunkFile.Close()
		if err != nil {
			log.Printf("Error copying chunk %d: %v", i, err)
			respondWithChunkError(w, fmt.Sprintf("Failed to combine chunk %d", i), http.StatusInternalServerError)
			return
		}
	}

	// Clean up temp directory
	os.RemoveAll(session.TempDir)

	// Remove session
	sessionsMutex.Lock()
	delete(uploadSessions, req.UploadID)
	sessionsMutex.Unlock()

	// Generate file URL
	fileURL := fmt.Sprintf("/uploads/%s", finalFilename)

	log.Printf("Completed chunked upload: %s -> %s (user: %s, size: %d bytes)", 
		req.UploadID, finalFilename, user.Name, session.TotalSize)

	// Broadcast completion via WebSocket
	if wsHub != nil {
		wsHub.BroadcastMessage("upload_progress", UploadProgress{
			UploadID:   req.UploadID,
			Filename:   session.Filename,
			Progress:   100,
			BytesRead:  session.TotalSize,
			TotalBytes: session.TotalSize,
			Status:     "completed",
		})
	}

	// Respond with success
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ChunkUploadResponse{
		Success:    true,
		UploadID:   req.UploadID,
		IsComplete: true,
		Progress:   100,
		FinalURL:   fileURL,
	})
}

func getUploadStatusHandler(w http.ResponseWriter, r *http.Request) {
	uploadID := chi.URLParam(r, "uploadId")
	if uploadID == "" {
		respondWithChunkError(w, "Upload ID required", http.StatusBadRequest)
		return
	}

	sessionsMutex.RLock()
	session, exists := uploadSessions[uploadID]
	sessionsMutex.RUnlock()

	if !exists {
		respondWithChunkError(w, "Upload session not found", http.StatusNotFound)
		return
	}

	session.mutex.RLock()
	receivedCount := len(session.ReceivedChunks)
	session.mutex.RUnlock()

	progress := math.Round(float64(receivedCount)/float64(session.TotalChunks)*100*100) / 100

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ChunkUploadResponse{
		Success:     true,
		UploadID:    uploadID,
		TotalChunks: session.TotalChunks,
		Progress:    progress,
		IsComplete:  receivedCount == session.TotalChunks,
	})
}

func cancelUploadHandler(w http.ResponseWriter, r *http.Request) {
	uploadID := chi.URLParam(r, "uploadId")
	if uploadID == "" {
		respondWithChunkError(w, "Upload ID required", http.StatusBadRequest)
		return
	}

	sessionsMutex.Lock()
	session, exists := uploadSessions[uploadID]
	if exists {
		// Clean up temp directory
		os.RemoveAll(session.TempDir)
		delete(uploadSessions, uploadID)
	}
	sessionsMutex.Unlock()

	if !exists {
		respondWithChunkError(w, "Upload session not found", http.StatusNotFound)
		return
	}

	log.Printf("Cancelled chunked upload: %s", uploadID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ChunkUploadResponse{
		Success: true,
	})
}

func respondWithChunkError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(ChunkUploadResponse{
		Success: false,
		Error:   message,
	})
}