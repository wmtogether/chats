package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// createDesignHandler handles POST /api/designs
func createDesignHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Parse request body
	var req struct {
		JobName      string      `json:"jobName"`
		CustomerName *string     `json:"customerName"`
		CustomerID   *string     `json:"customerId"`
		Quantity     *int        `json:"quantity"`
		DesignData   DesignData  `json:"designData"`
		ChatUUID     *string     `json:"chatUuid"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding request: %v", err)
		http.Error(w, `{"success": false, "error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.JobName == "" {
		http.Error(w, `{"success": false, "error": "Job name is required"}`, http.StatusBadRequest)
		return
	}

	// Set job name in design data if not set
	if req.DesignData.JobName == "" {
		req.DesignData.JobName = req.JobName
	}

	// Initialize edit count and comments if not set
	if req.DesignData.EditCount == 0 {
		req.DesignData.EditCount = 0
	}
	if req.DesignData.Comments == nil {
		req.DesignData.Comments = []DesignComment{}
	}

	// Create design
	design, err := CreateDesign(CreateDesignParams{
		JobName:       req.JobName,
		CustomerName:  req.CustomerName,
		CustomerID:    req.CustomerID,
		Quantity:      req.Quantity,
		DesignData:    req.DesignData,
		CreatedByID:   user.ID,
		CreatedByRole: user.Role,
		CreatedByName: user.Name,
	})

	if err != nil {
		log.Printf("Error creating design: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to create design"}`, http.StatusInternalServerError)
		return
	}

	// Note: Design files will be stored in the proof's /Design subfolder
	// Path structure: /volumes/filestorage/{PREFIX}/{CUSTOMER-ID}/{RUNNER-ID}/Design
	// The RUNNER-ID comes from the associated proof job
	// Design files are stored alongside proof files in the same runner directory

	log.Printf("Design created successfully: %s by %s", design.DesignID, user.Name)

	// Broadcast design creation via WebSocket
	if wsHub != nil {
		wsHub.BroadcastMessage("design_created", map[string]interface{}{
			"design": design,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Design created successfully",
		Data:    design,
	})
}

// getDesignHandler handles GET /api/designs/{designId}
func getDesignHandler(w http.ResponseWriter, r *http.Request) {
	designID := chi.URLParam(r, "designId")
	if designID == "" {
		http.Error(w, `{"success": false, "error": "Design ID is required"}`, http.StatusBadRequest)
		return
	}

	design, err := GetDesignByID(designID)
	if err != nil {
		log.Printf("Error getting design: %v", err)
		http.Error(w, `{"success": false, "error": "Design not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    design,
	})
}

// listDesignsHandler handles GET /api/designs
func listDesignsHandler(w http.ResponseWriter, r *http.Request) {
	query := `
		SELECT id, design_id, parent_design_id, child_number, job_name, customer_name, customer_id,
		       design_status, current_version, design_data, version_history, comment_post,
		       created_by_id, created_by_role, created_by_name, updated_by_id, updated_by_role, updated_by_name,
		       created_at, updated_at
		FROM designs
		ORDER BY created_at DESC
	`

	rows, err := db.Query(query)
	if err != nil {
		log.Printf("Error querying designs: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to fetch designs"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	designs := []Design{}
	for rows.Next() {
		var design Design
		err := rows.Scan(
			&design.ID,
			&design.DesignID,
			&design.ParentDesignID,
			&design.ChildNumber,
			&design.JobName,
			&design.CustomerName,
			&design.CustomerID,
			&design.DesignStatus,
			&design.CurrentVersion,
			&design.DesignData,
			&design.VersionHistory,
			&design.CommentPost,
			&design.CreatedByID,
			&design.CreatedByRole,
			&design.CreatedByName,
			&design.UpdatedByID,
			&design.UpdatedByRole,
			&design.UpdatedByName,
			&design.CreatedAt,
			&design.UpdatedAt,
		)
		if err != nil {
			log.Printf("Error scanning design: %v", err)
			continue
		}
		designs = append(designs, design)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"designs": designs,
		},
	})
}
