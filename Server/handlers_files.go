package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
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

// FileItem represents a file or directory in the file system
type FileItem struct {
	Name       string `json:"name"`
	Type       string `json:"type"` // "file" or "directory"
	Size       int64  `json:"size,omitempty"`
	ModifiedAt string `json:"modifiedAt,omitempty"`
}

// listFilesHandler handles GET /api/files/list?path={path} OR GET /api/files/list?uniqueId={uniqueId}
func listFilesHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by authMiddleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	path := r.URL.Query().Get("path")
	uniqueID := r.URL.Query().Get("uniqueId")

	// If uniqueId is provided, look up the path from filestorage table
	if uniqueID != "" && path == "" {
		storagePath, err := GetFileStoragePathByChatUniqueID(uniqueID)
		if err != nil {
			log.Printf("Error getting storage path for uniqueId %s: %v", uniqueID, err)
			http.Error(w, `{"success": false, "error": "Failed to get storage path"}`, http.StatusInternalServerError)
			return
		}
		
		// If no storage path found, return empty list (proof not created yet)
		if storagePath == "" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(APIResponse{
				Success: true,
				Data: map[string]interface{}{
					"files": []FileItem{},
				},
			})
			return
		}
		
		path = storagePath
	}

	if path == "" {
		http.Error(w, `{"success": false, "error": "Path or uniqueId parameter is required"}`, http.StatusBadRequest)
		return
	}

	// Security: Ensure path starts with /volumes/filestorage/
	if !strings.HasPrefix(path, "/volumes/filestorage/") {
		http.Error(w, `{"success": false, "error": "Invalid path"}`, http.StatusForbidden)
		return
	}

	// Check if directory exists
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			// Directory doesn't exist yet - return empty list (this is normal before proof creation)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(APIResponse{
				Success: true,
				Data: map[string]interface{}{
					"files": []FileItem{},
				},
			})
			return
		}
		log.Printf("Error checking path %s: %v", path, err)
		http.Error(w, `{"success": false, "error": "Failed to access directory"}`, http.StatusInternalServerError)
		return
	}

	if !info.IsDir() {
		http.Error(w, `{"success": false, "error": "Path is not a directory"}`, http.StatusBadRequest)
		return
	}

	// Read directory contents
	entries, err := os.ReadDir(path)
	if err != nil {
		log.Printf("Error reading directory %s: %v", path, err)
		http.Error(w, `{"success": false, "error": "Failed to read directory"}`, http.StatusInternalServerError)
		return
	}

	// Build file list
	files := make([]FileItem, 0, len(entries))
	for _, entry := range entries {
		fileInfo, err := entry.Info()
		if err != nil {
			log.Printf("Error getting file info for %s: %v", entry.Name(), err)
			continue
		}

		fileType := "file"
		if entry.IsDir() {
			fileType = "directory"
		}

		files = append(files, FileItem{
			Name:       entry.Name(),
			Type:       fileType,
			Size:       fileInfo.Size(),
			ModifiedAt: fileInfo.ModTime().Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"files": files,
			"path":  path, // Include the resolved path
		},
	})
}

// downloadFileHandler handles GET /api/files/download?path={path}&token={token}
func downloadFileHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by flexibleAuthMiddleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, `{"success": false, "error": "Path parameter is required"}`, http.StatusBadRequest)
		return
	}

	// Security: Ensure path starts with /volumes/filestorage/
	if !strings.HasPrefix(path, "/volumes/filestorage/") {
		http.Error(w, `{"success": false, "error": "Invalid path"}`, http.StatusForbidden)
		return
	}

	// Check if file exists
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, `{"success": false, "error": "File not found"}`, http.StatusNotFound)
			return
		}
		log.Printf("Error checking file %s: %v", path, err)
		http.Error(w, `{"success": false, "error": "Failed to access file"}`, http.StatusInternalServerError)
		return
	}

	if info.IsDir() {
		http.Error(w, `{"success": false, "error": "Cannot download a directory"}`, http.StatusBadRequest)
		return
	}

	// Open file
	file, err := os.Open(path)
	if err != nil {
		log.Printf("Error opening file %s: %v", path, err)
		http.Error(w, `{"success": false, "error": "Failed to open file"}`, http.StatusInternalServerError)
		return
	}
	defer file.Close()

	// Set headers for download
	fileName := filepath.Base(path)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileName))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", info.Size()))

	// Stream file to response
	_, err = io.Copy(w, file)
	if err != nil {
		log.Printf("Error streaming file %s: %v", path, err)
	}

	log.Printf("📥 User %s downloaded file: %s", user.Name, path)
}

// uploadFilesHandler handles POST /api/files/upload
func uploadFilesHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by authMiddleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Parse multipart form (max 100MB)
	err := r.ParseMultipartForm(100 << 20)
	if err != nil {
		log.Printf("Error parsing multipart form: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to parse form"}`, http.StatusBadRequest)
		return
	}

	path := r.FormValue("path")
	uniqueID := r.FormValue("uniqueId")
	
	log.Printf("📤 Upload request - path: %s, uniqueId: %s", path, uniqueID)

	// If uniqueId is provided, look up the path from filestorage table
	if uniqueID != "" && path == "" {
		storagePath, err := GetFileStoragePathByChatUniqueID(uniqueID)
		if err != nil {
			log.Printf("Error getting storage path for uniqueId %s: %v", uniqueID, err)
			http.Error(w, `{"success": false, "error": "Failed to get storage path"}`, http.StatusInternalServerError)
			return
		}
		
		// If no storage path found, cannot upload (proof not created yet)
		if storagePath == "" {
			http.Error(w, `{"success": false, "error": "Storage path not found. Please create proof data first."}`, http.StatusNotFound)
			return
		}
		
		path = storagePath
	}

	if path == "" {
		http.Error(w, `{"success": false, "error": "Path or uniqueId parameter is required"}`, http.StatusBadRequest)
		return
	}

	// Security: Ensure path starts with /volumes/filestorage/
	if !strings.HasPrefix(path, "/volumes/filestorage/") {
		http.Error(w, `{"success": false, "error": "Invalid path"}`, http.StatusForbidden)
		return
	}

	// Create directory if it doesn't exist
	err = os.MkdirAll(path, 0755)
	if err != nil {
		log.Printf("Error creating directory %s: %v", path, err)
		http.Error(w, `{"success": false, "error": "Failed to create directory"}`, http.StatusInternalServerError)
		return
	}

	// Get uploaded files
	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		http.Error(w, `{"success": false, "error": "No files uploaded"}`, http.StatusBadRequest)
		return
	}

	uploadedFiles := []map[string]string{}

	// Save each file and generate download token
	for _, fileHeader := range files {
		// Open uploaded file
		file, err := fileHeader.Open()
		if err != nil {
			log.Printf("Error opening uploaded file %s: %v", fileHeader.Filename, err)
			continue
		}
		defer file.Close()

		// Create destination file
		destPath := filepath.Join(path, fileHeader.Filename)
		destFile, err := os.Create(destPath)
		if err != nil {
			log.Printf("Error creating file %s: %v", destPath, err)
			continue
		}
		defer destFile.Close()

		// Copy file contents
		_, err = io.Copy(destFile, file)
		if err != nil {
			log.Printf("Error saving file %s: %v", destPath, err)
			continue
		}

		// Generate download token
		token, err := GenerateDownloadToken()
		if err != nil {
			log.Printf("Error generating download token: %v", err)
			continue
		}

		// Store token in database
		_, err = db.Exec(`
			INSERT INTO file_downloads (token, file_path, filename, created_at)
			VALUES ($1, $2, $3, $4)
		`, token, destPath, fileHeader.Filename, time.Now())
		
		if err != nil {
			log.Printf("Error storing download token: %v", err)
			// Continue anyway, file is uploaded
		}
		
		uploadedFiles = append(uploadedFiles, map[string]string{
			"filename": fileHeader.Filename,
			"token":    token,
		})
		
		log.Printf("📤 User %s uploaded file: %s (token: %s)", user.Name, destPath, token)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: fmt.Sprintf("Uploaded %d file(s)", len(uploadedFiles)),
		Data: map[string]interface{}{
			"files": uploadedFiles,
		},
	})
}

// GenerateDownloadToken generates a secure random token for file downloads
func GenerateDownloadToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// deleteFileHandler handles DELETE /api/files/delete?path={path}
func deleteFileHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by authMiddleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, `{"success": false, "error": "Path parameter is required"}`, http.StatusBadRequest)
		return
	}

	// Security: Ensure path starts with /volumes/filestorage/
	if !strings.HasPrefix(path, "/volumes/filestorage/") {
		http.Error(w, `{"success": false, "error": "Invalid path"}`, http.StatusForbidden)
		return
	}

	// Check if file/directory exists
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, `{"success": false, "error": "File not found"}`, http.StatusNotFound)
			return
		}
		log.Printf("Error checking file %s: %v", path, err)
		http.Error(w, `{"success": false, "error": "Failed to access file"}`, http.StatusInternalServerError)
		return
	}

	// Delete file or directory
	if info.IsDir() {
		err = os.RemoveAll(path)
	} else {
		err = os.Remove(path)
	}

	if err != nil {
		log.Printf("Error deleting %s: %v", path, err)
		http.Error(w, `{"success": false, "error": "Failed to delete file"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("🗑️ User %s deleted: %s", user.Name, path)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "File deleted successfully",
	})
}

// downloadByTokenHandler handles GET /api/files/d/{token}
// Downloads a file using a secure token instead of exposing the full path
// Requires Authorization header for authentication
// Automatically uses the original filename from the database
func downloadByTokenHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by authMiddleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Get token from URL parameter
	token := chi.URLParam(r, "token")
	if token == "" {
		http.Error(w, `{"success": false, "error": "Token parameter is required"}`, http.StatusBadRequest)
		return
	}

	// Look up file by token in file_downloads table
	var filePath, filename string
	err := db.QueryRow(`
		SELECT file_path, filename 
		FROM file_downloads 
		WHERE token = $1
		LIMIT 1
	`, token).Scan(&filePath, &filename)
	
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, `{"success": false, "error": "Invalid or expired token"}`, http.StatusNotFound)
			return
		}
		log.Printf("Error looking up file token: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to lookup file"}`, http.StatusInternalServerError)
		return
	}

	// Check if file exists
	info, err := os.Stat(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, `{"success": false, "error": "File not found"}`, http.StatusNotFound)
			return
		}
		log.Printf("Error checking file %s: %v", filePath, err)
		http.Error(w, `{"success": false, "error": "Failed to access file"}`, http.StatusInternalServerError)
		return
	}

	if info.IsDir() {
		http.Error(w, `{"success": false, "error": "Cannot download a directory"}`, http.StatusBadRequest)
		return
	}

	// Open file
	file, err := os.Open(filePath)
	if err != nil {
		log.Printf("Error opening file %s: %v", filePath, err)
		http.Error(w, `{"success": false, "error": "Failed to open file"}`, http.StatusInternalServerError)
		return
	}
	defer file.Close()

	// Set headers for download with original filename
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", info.Size()))

	// Stream file to response
	_, err = io.Copy(w, file)
	if err != nil {
		log.Printf("Error streaming file %s: %v", filePath, err)
	}

	log.Printf("📥 User %s downloaded file via token: %s", user.Name, filename)
}
