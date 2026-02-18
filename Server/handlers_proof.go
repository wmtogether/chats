package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// getProofDataHandler handles GET /api/proof - fetches all proof data entries
func getProofDataHandler(w http.ResponseWriter, r *http.Request) {
	proofs, err := GetAllProofData()
	if err != nil {
		log.Printf("Error fetching proof data: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to fetch proof data"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    proofs,
	})
}

// getProofDataByIDHandler handles GET /api/proof/{id} - fetches a single proof data entry
func getProofDataByIDHandler(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, `{"success": false, "error": "Invalid proof data ID"}`, http.StatusBadRequest)
		return
	}

	proof, err := GetProofDataByID(id)
	if err != nil {
		log.Printf("Error fetching proof data: %v", err)
		http.Error(w, `{"success": false, "error": "Proof data not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    proof,
	})
}

// createProofDataHandler handles POST /api/proof - creates a new proof data entry
func createProofDataHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by authMiddleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Could not identify user from token"}`, http.StatusUnauthorized)
		return
	}

	var params CreateProofParams
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		http.Error(w, `{"success": false, "error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Validate required fields
	if params.RunnerID == "" {
		http.Error(w, `{"success": false, "error": "Runner ID is required"}`, http.StatusBadRequest)
		return
	}
	if params.JobName == "" {
		http.Error(w, `{"success": false, "error": "Job name is required"}`, http.StatusBadRequest)
		return
	}
	if len(params.FormData) == 0 {
		http.Error(w, `{"success": false, "error": "Form data is required"}`, http.StatusBadRequest)
		return
	}

	proof, err := CreateProofData(params, user)
	if err != nil {
		log.Printf("Error creating proof data: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to create proof data"}`, http.StatusInternalServerError)
		return
	}

	// Extract customer ID from params
	customerID := "UNKNOWN"
	if params.CustomerID != nil && *params.CustomerID != "" {
		customerID = *params.CustomerID
	}

	// Create directory structure: /volumes/filestorage/{PREFIX}/{CUSTOMER-ID}/{RUNNER-ID}
	// Extract prefix from runner ID (e.g., "WMT-120226-J0001" -> "WMT")
	prefix := ""
	if len(proof.RunnerID) >= 3 {
		prefix = proof.RunnerID[:3] // Get first 3 characters (WMT, DR, NRM)
	}
	
	// Create directory path
	dirPath := fmt.Sprintf("/volumes/filestorage/%s/%s/%s", prefix, customerID, proof.RunnerID)
	
	// Create the directory using os.MkdirAll (creates all parent directories)
	err = os.MkdirAll(dirPath, 0755)
	if err != nil {
		log.Printf("⚠️ Warning: Failed to create directory %s: %v", dirPath, err)
		// Don't fail the request, just log the warning
	} else {
		log.Printf("📁 Created directory: %s", dirPath)
		
		// Create subfolders: Printing, Proof, Design, Customer
		subfolders := []string{"Printing", "Proof", "Design", "Customer"}
		for _, subfolder := range subfolders {
			subfolderPath := fmt.Sprintf("%s/%s", dirPath, subfolder)
			err = os.MkdirAll(subfolderPath, 0755)
			if err != nil {
				log.Printf("⚠️ Warning: Failed to create subfolder %s: %v", subfolderPath, err)
			} else {
				log.Printf("📁 Created subfolder: %s", subfolderPath)
			}
		}
		
		// Create filestorage entry in database
		_, err = CreateFileStorage(CreateFileStorageParams{
			RunnerID:     proof.RunnerID,
			JobID:        &proof.ID,
			CustomerID:   customerID,
			CustomerName: params.CustomerName,
			StoragePath:  dirPath,
			ChatUUID:     params.ChatUUID, // Link to chat
		})
		if err != nil {
			log.Printf("⚠️ Warning: Failed to create filestorage entry: %v", err)
			// Don't fail the request, just log the warning
		} else {
			// If we have a chat UUID, enable proof mode for that chat
			if params.ChatUUID != nil && *params.ChatUUID != "" {
				_, err = db.Exec(`UPDATE chats SET is_proof_enabled = 1 WHERE uuid = $1`, *params.ChatUUID)
				if err != nil {
					log.Printf("⚠️ Warning: Failed to enable proof mode for chat: %v", err)
				} else {
					log.Printf("✅ Enabled proof mode for chat %s", *params.ChatUUID)
				}
			}
		}
	}

	// Broadcast proof data update via WebSocket (optional)
	if wsHub != nil {
		wsHub.BroadcastMessage("proof_created", map[string]interface{}{
			"action": "created",
			"proof":  proof,
			"user":   user.Name,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Proof data created successfully",
		Data:    proof,
	})
}

// updateProofDataHandler handles PUT /api/proof/{id} - updates an existing proof data entry
func updateProofDataHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by authMiddleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Could not identify user from token"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, `{"success": false, "error": "Invalid proof data ID"}`, http.StatusBadRequest)
		return
	}

	var params CreateProofParams
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		http.Error(w, `{"success": false, "error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Validate required fields
	if params.RunnerID == "" {
		http.Error(w, `{"success": false, "error": "Runner ID is required"}`, http.StatusBadRequest)
		return
	}
	if params.JobName == "" {
		http.Error(w, `{"success": false, "error": "Job name is required"}`, http.StatusBadRequest)
		return
	}
	if len(params.FormData) == 0 {
		http.Error(w, `{"success": false, "error": "Form data is required"}`, http.StatusBadRequest)
		return
	}

	proof, err := UpdateProofData(id, params, user)
	if err != nil {
		log.Printf("Error updating proof data: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to update proof data"}`, http.StatusInternalServerError)
		return
	}

	// Broadcast proof data update via WebSocket (optional)
	if wsHub != nil {
		wsHub.BroadcastMessage("proof_updated", map[string]interface{}{
			"action": "updated",
			"proof":  proof,
			"user":   user.Name,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Proof data updated successfully",
		Data:    proof,
	})
}

// getNextRunnerIDHandler handles GET /api/proof/next-runner-id?prefix={prefix}
func getNextRunnerIDHandler(w http.ResponseWriter, r *http.Request) {
	prefix := r.URL.Query().Get("prefix")
	if prefix == "" {
		http.Error(w, `{"success": false, "error": "Prefix parameter is required"}`, http.StatusBadRequest)
		return
	}

	// Validate prefix
	validPrefixes := map[string]bool{"WMT": true, "DR": true, "NRM": true}
	if !validPrefixes[prefix] {
		http.Error(w, `{"success": false, "error": "Invalid prefix. Must be WMT, DR, or NRM"}`, http.StatusBadRequest)
		return
	}

	runnerID, err := GenerateNextRunnerID(prefix)
	if err != nil {
		log.Printf("Error generating next runner ID: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to generate runner ID"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data: map[string]string{
			"runnerId": runnerID,
			"prefix":   prefix,
		},
	})
}

// deleteProofDataHandler handles DELETE /api/proof/{id} - deletes a proof data entry
func deleteProofDataHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by authMiddleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Could not identify user from token"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, `{"success": false, "error": "Invalid proof data ID"}`, http.StatusBadRequest)
		return
	}

	err = DeleteProofData(id)
	if err != nil {
		log.Printf("Error deleting proof data: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to delete proof data"}`, http.StatusNotFound)
		return
	}

	// Broadcast proof data deletion via WebSocket (optional)
	if wsHub != nil {
		wsHub.BroadcastMessage("proof_deleted", map[string]interface{}{
			"action": "deleted",
			"proofId": id,
			"user":   user.Name,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Proof data deleted successfully",
	})
}
