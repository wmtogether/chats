package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

// FileUploadResponse represents the response for file upload
type FileUploadResponse struct {
	Success  bool   `json:"success"`
	URL      string `json:"url,omitempty"`
	Filename string `json:"filename,omitempty"`
	Size     int64  `json:"size,omitempty"`
	Type     string `json:"type,omitempty"`
	Error    string `json:"error,omitempty"`
}

// UploadProgress represents upload progress for WebSocket broadcasting
type UploadProgress struct {
	UploadID   string  `json:"uploadId"`
	Filename   string  `json:"filename"`
	Progress   float64 `json:"progress"`
	BytesRead  int64   `json:"bytesRead"`
	TotalBytes int64   `json:"totalBytes"`
	Status     string  `json:"status"` // "uploading", "completed", "error"
	Error      string  `json:"error,omitempty"`
}

// ProgressReader wraps an io.Reader to track upload progress
type ProgressReader struct {
	reader     io.Reader
	total      int64
	read       int64
	uploadID   string
	filename   string
	onProgress func(progress UploadProgress)
}

func (pr *ProgressReader) Read(p []byte) (int, error) {
	n, err := pr.reader.Read(p)
	pr.read += int64(n)
	
	if pr.onProgress != nil {
		progress := float64(pr.read) / float64(pr.total) * 100
		pr.onProgress(UploadProgress{
			UploadID:   pr.uploadID,
			Filename:   pr.filename,
			Progress:   progress,
			BytesRead:  pr.read,
			TotalBytes: pr.total,
			Status:     "uploading",
		})
	}
	
	return n, err
}

// Setup file upload routes
func setupFileUploadRoutes(r chi.Router) {
	// Regular file upload endpoint
	r.Post("/api/fileupload", fileUploadHandler)
	
	// Image upload endpoint (optimized for images)
	r.Post("/api/imageupload", imageUploadHandler)
	
	// Upload progress endpoint
	r.Get("/api/upload/progress/{uploadId}", uploadProgressHandler)
	
	// File serving endpoint
	r.Get("/uploads/{filename}", serveFileHandler)
}

func fileUploadHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Parse multipart form with larger memory limit for big files
	err := r.ParseMultipartForm(100 << 20) // 100MB max memory, rest goes to temp files
	if err != nil {
		log.Printf("Error parsing multipart form: %v", err)
		respondWithError(w, "Failed to parse upload form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		log.Printf("Error getting file from form: %v", err)
		respondWithError(w, "No file provided", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Generate upload ID for progress tracking
	uploadID := fmt.Sprintf("%d_%s", time.Now().UnixNano(), header.Filename)
	
	// Validate file size (3GB max)
	if header.Size > 3*1024*1024*1024 {
		respondWithError(w, "File too large. Maximum size is 3GB", http.StatusBadRequest)
		return
	}

	// Create uploads directory if it doesn't exist
	uploadDir := filepath.Join(".", "uploads")
	err = os.MkdirAll(uploadDir, os.ModePerm)
	if err != nil {
		log.Printf("Error creating upload directory: %v", err)
		respondWithError(w, "Failed to create upload directory", http.StatusInternalServerError)
		return
	}

	// Generate unique filename
	filename := generateUniqueFilename(header.Filename)
	filePath := filepath.Join(uploadDir, filename)

	// Create destination file
	dst, err := os.Create(filePath)
	if err != nil {
		log.Printf("Error creating destination file: %v", err)
		respondWithError(w, "Failed to create file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Create progress reader for WebSocket updates
	progressReader := &ProgressReader{
		reader:   file,
		total:    header.Size,
		uploadID: uploadID,
		filename: header.Filename,
		onProgress: func(progress UploadProgress) {
			// Broadcast progress via WebSocket
			if wsHub != nil {
				wsHub.BroadcastMessage("upload_progress", progress)
			}
		},
	}

	// Copy file with progress tracking
	_, err = io.Copy(dst, progressReader)
	if err != nil {
		log.Printf("Error copying file: %v", err)
		// Broadcast error
		if wsHub != nil {
			wsHub.BroadcastMessage("upload_progress", UploadProgress{
				UploadID: uploadID,
				Filename: header.Filename,
				Status:   "error",
				Error:    "Failed to save file",
			})
		}
		respondWithError(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	// Broadcast completion
	if wsHub != nil {
		wsHub.BroadcastMessage("upload_progress", UploadProgress{
			UploadID:   uploadID,
			Filename:   header.Filename,
			Progress:   100,
			BytesRead:  header.Size,
			TotalBytes: header.Size,
			Status:     "completed",
		})
	}

	// Generate file URL
	fileURL := fmt.Sprintf("/uploads/%s", filename)

	// Log upload
	log.Printf("File uploaded successfully: %s (size: %d bytes) by user %s", filename, header.Size, user.Name)

	// Respond with success
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(FileUploadResponse{
		Success:  true,
		URL:      fileURL,
		Filename: filename,
		Size:     header.Size,
		Type:     header.Header.Get("Content-Type"),
	})
}

func imageUploadHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Parse multipart form with larger memory limit for big images
	err := r.ParseMultipartForm(100 << 20) // 100MB max memory, rest goes to temp files
	if err != nil {
		respondWithError(w, "Failed to parse upload form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		// Try "file" field as fallback
		file, header, err = r.FormFile("file")
		if err != nil {
			respondWithError(w, "No image file provided", http.StatusBadRequest)
			return
		}
	}
	defer file.Close()

	// Validate that it's an image
	contentType := header.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		respondWithError(w, "File must be an image", http.StatusBadRequest)
		return
	}

	// Validate file size (3GB max for images too)
	if header.Size > 3*1024*1024*1024 {
		respondWithError(w, "Image too large. Maximum size is 3GB", http.StatusBadRequest)
		return
	}

	// Create uploads directory
	uploadDir := filepath.Join(".", "uploads", "images")
	err = os.MkdirAll(uploadDir, os.ModePerm)
	if err != nil {
		respondWithError(w, "Failed to create upload directory", http.StatusInternalServerError)
		return
	}

	// Generate unique filename
	filename := generateUniqueFilename(header.Filename)
	filePath := filepath.Join(uploadDir, filename)

	// Create destination file
	dst, err := os.Create(filePath)
	if err != nil {
		respondWithError(w, "Failed to create file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Copy file
	_, err = io.Copy(dst, file)
	if err != nil {
		respondWithError(w, "Failed to save image", http.StatusInternalServerError)
		return
	}

	// Generate image URL
	imageURL := fmt.Sprintf("/uploads/images/%s", filename)

	// Log upload
	log.Printf("Image uploaded successfully: %s (size: %d bytes) by user %s", filename, header.Size, user.Name)

	// Broadcast image upload notification
	if wsHub != nil {
		wsHub.BroadcastMessage("image_uploaded", map[string]interface{}{
			"url":      imageURL,
			"filename": filename,
			"size":     header.Size,
			"user":     user.Name,
		})
	}

	// Respond with success
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(FileUploadResponse{
		Success:  true,
		URL:      imageURL,
		Filename: filename,
		Size:     header.Size,
		Type:     contentType,
	})
}

func uploadProgressHandler(w http.ResponseWriter, r *http.Request) {
	uploadID := chi.URLParam(r, "uploadId")
	if uploadID == "" {
		respondWithError(w, "Upload ID required", http.StatusBadRequest)
		return
	}

	// For now, return a simple response
	// In a more complex implementation, you'd track progress in memory or database
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"uploadId": uploadID,
		"status":   "completed", // This would be dynamic in a real implementation
	})
}

func serveFileHandler(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")
	if filename == "" {
		http.Error(w, "Filename required", http.StatusBadRequest)
		return
	}

	// Security: prevent directory traversal
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") {
		http.Error(w, "Invalid filename", http.StatusBadRequest)
		return
	}

	// Check if it's an image request
	var filePath string
	if strings.Contains(r.URL.Path, "/uploads/images/") {
		filePath = filepath.Join(".", "uploads", "images", filename)
	} else {
		filePath = filepath.Join(".", "uploads", filename)
	}

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	// Serve the file
	http.ServeFile(w, r, filePath)
}

func generateUniqueFilename(originalFilename string) string {
	ext := filepath.Ext(originalFilename)
	name := strings.TrimSuffix(originalFilename, ext)
	
	// Clean the filename
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.ReplaceAll(name, "(", "")
	name = strings.ReplaceAll(name, ")", "")
	
	// Add timestamp for uniqueness
	timestamp := time.Now().Format("20060102_150405")
	return fmt.Sprintf("%s_%s%s", name, timestamp, ext)
}

func respondWithError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(FileUploadResponse{
		Success: false,
		Error:   message,
	})
}