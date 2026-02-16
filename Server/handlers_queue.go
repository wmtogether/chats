package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

// assignQueueHandler handles POST /api/queue/{id}/assign
// Assigns a queue to the current user (graphic role only)
func assignQueueHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Check if user has graphic role
	if user.Role != "graphic" {
		http.Error(w, `{"success": false, "error": "Only graphic role can assign queues"}`, http.StatusForbidden)
		return
	}

	// Get queue ID from URL
	queueIDStr := chi.URLParam(r, "id")
	if queueIDStr == "" {
		http.Error(w, `{"success": false, "error": "Queue ID is required"}`, http.StatusBadRequest)
		return
	}

	log.Printf("Assigning queue %s to user %s (ID: %d)", queueIDStr, user.Name, user.ID)

	// Update the queue with assigned_to_id and assigned_to_name
	now := time.Now()
	query := `
		UPDATE queue 
		SET assigned_to_id = $1, 
		    assigned_to_name = $2, 
		    status = $3,
		    updated_at = $4,
		    updated_by_id = $5,
		    updated_by_name = $6
		WHERE id = $7
		RETURNING id, queue_no, job_name, request_type, dimension_width, dimension_height, 
		          dimension_depth, dimensions, layout, sample_t, sample_i, notes, priority, status, 
		          assigned_to_id, assigned_to_name, customer_id, customer_name, chat_uuid, sort_order, 
		          created_by_id, created_by_name, updated_by_id, updated_by_name, created_at, updated_at
	`

	row := db.QueryRow(query, 
		user.ID,      // assigned_to_id
		user.Name,    // assigned_to_name
		"ACCEPTED",   // status
		now,          // updated_at
		user.ID,      // updated_by_id
		user.Name,    // updated_by_name
		queueIDStr,   // queue id
	)

	var queue Queue
	err := row.Scan(
		&queue.ID, &queue.QueueNo, &queue.JobName, &queue.RequestType,
		&queue.DimensionWidth, &queue.DimensionHeight, &queue.DimensionDepth, &queue.Dimensions,
		&queue.Layout, &queue.SampleT, &queue.SampleI, &queue.Notes,
		&queue.Priority, &queue.Status, &queue.AssignedToID, &queue.AssignedToName,
		&queue.CustomerID, &queue.CustomerName, &queue.ChatUUID, &queue.SortOrder,
		&queue.CreatedByID, &queue.CreatedByName, &queue.UpdatedByID, &queue.UpdatedByName,
		&queue.CreatedAt, &queue.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("Queue not found: id=%s", queueIDStr)
			http.Error(w, `{"success": false, "error": "Queue not found"}`, http.StatusNotFound)
			return
		}
		log.Printf("Error assigning queue: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to assign queue"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("Queue %d assigned to %s successfully", queue.ID, user.Name)

	// Broadcast queue update via WebSocket
	if wsHub != nil {
		wsHub.BroadcastMessage("queue_assigned", map[string]interface{}{
			"queue": queue,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Queue assigned successfully",
		Data:    queue,
	})
}

// assignQueueByChatHandler handles POST /api/chats/{uuid}/assign-queue
// Assigns the queue linked to a chat to the current user
func assignQueueByChatHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Check if user has graphic role
	if user.Role != "graphic" {
		http.Error(w, `{"success": false, "error": "Only graphic role can assign queues"}`, http.StatusForbidden)
		return
	}

	// Get chat UUID from URL
	chatUUID := chi.URLParam(r, "uuid")
	if chatUUID == "" {
		http.Error(w, `{"success": false, "error": "Chat UUID is required"}`, http.StatusBadRequest)
		return
	}

	log.Printf("Assigning queue for chat %s to user %s (ID: %d)", chatUUID, user.Name, user.ID)

	// Get the queue linked to this chat
	queue, err := GetQueueByChatUUID(chatUUID)
	if err != nil {
		log.Printf("Error getting queue for chat %s: %v", chatUUID, err)
		http.Error(w, `{"success": false, "error": "Queue not found for this chat"}`, http.StatusNotFound)
		return
	}

	// Update the queue with assigned_to_id and assigned_to_name
	now := time.Now()
	query := `
		UPDATE queue 
		SET assigned_to_id = $1, 
		    assigned_to_name = $2, 
		    status = $3,
		    updated_at = $4,
		    updated_by_id = $5,
		    updated_by_name = $6
		WHERE id = $7
		RETURNING id, queue_no, job_name, request_type, dimension_width, dimension_height, 
		          dimension_depth, dimensions, layout, sample_t, sample_i, notes, priority, status, 
		          assigned_to_id, assigned_to_name, customer_id, customer_name, chat_uuid, sort_order, 
		          created_by_id, created_by_name, updated_by_id, updated_by_name, created_at, updated_at
	`

	row := db.QueryRow(query, 
		user.ID,      // assigned_to_id
		user.Name,    // assigned_to_name
		"ACCEPTED",   // status
		now,          // updated_at
		user.ID,      // updated_by_id
		user.Name,    // updated_by_name
		queue.ID,     // queue id
	)

	var updatedQueue Queue
	err = row.Scan(
		&updatedQueue.ID, &updatedQueue.QueueNo, &updatedQueue.JobName, &updatedQueue.RequestType,
		&updatedQueue.DimensionWidth, &updatedQueue.DimensionHeight, &updatedQueue.DimensionDepth, &updatedQueue.Dimensions,
		&updatedQueue.Layout, &updatedQueue.SampleT, &updatedQueue.SampleI, &updatedQueue.Notes,
		&updatedQueue.Priority, &updatedQueue.Status, &updatedQueue.AssignedToID, &updatedQueue.AssignedToName,
		&updatedQueue.CustomerID, &updatedQueue.CustomerName, &updatedQueue.ChatUUID, &updatedQueue.SortOrder,
		&updatedQueue.CreatedByID, &updatedQueue.CreatedByName, &updatedQueue.UpdatedByID, &updatedQueue.UpdatedByName,
		&updatedQueue.CreatedAt, &updatedQueue.UpdatedAt,
	)
	if err != nil {
		log.Printf("Error assigning queue: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to assign queue"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("Queue %d for chat %s assigned to %s successfully", updatedQueue.ID, chatUUID, user.Name)

	// Also update the chat status to ACCEPTED
	_, err = db.Exec(`UPDATE chats SET status = $1, updated_at = $2 WHERE uuid = $3`, "ACCEPTED", now, chatUUID)
	if err != nil {
		log.Printf("Warning: Failed to update chat status: %v", err)
		// Don't fail the request if chat status update fails
	}

	// Fetch the updated chat to broadcast
	updatedChat, err := GetChatByUUID(chatUUID)
	if err != nil {
		log.Printf("Warning: Failed to fetch updated chat: %v", err)
	}

	// Create a MetaCard message for the queue acceptance
	// Format: [QUEUE_ACCEPTED|queueId|userName|profilePicture|customerName]JobName
	customerName := ""
	if updatedQueue.CustomerName.Valid {
		customerName = updatedQueue.CustomerName.String
	}
	
	// Get user profile picture (if available)
	profilePicture := ""
	if user.ProfilePicture.Valid {
		profilePicture = user.ProfilePicture.String
	}
	
	metaCardContent := fmt.Sprintf("[QUEUE_ACCEPTED|%d|%s|%s|%s]%s", 
		updatedQueue.ID, user.Name, profilePicture, customerName, updatedQueue.JobName)
	
	// Post the MetaCard message to the chat
	if updatedChat != nil {
		message, err := CreateMessage(CreateMessageParams{
			ChannelID:   updatedChat.ChannelID,
			Content:     metaCardContent,
			UserID:      user.ID,
			UserName:    user.Name,
			UserRole:    user.Role,
			Attachments: []string{},
		})
		if err != nil {
			log.Printf("Warning: Failed to create MetaCard message: %v", err)
		} else {
			// Broadcast the MetaCard message via WebSocket
			if wsHub != nil {
				wsHub.BroadcastMessage("chat_message", map[string]interface{}{
					"chatUuid": chatUUID,
					"message":  message,
				})
			}
		}
	}

	// Broadcast queue update via WebSocket
	if wsHub != nil {
		wsHub.BroadcastMessage("queue_assigned", map[string]interface{}{
			"queue":    updatedQueue,
			"chatUuid": chatUUID,
		})
		
		// Also broadcast chat status update with full chat object
		if updatedChat != nil {
			wsHub.BroadcastMessage("chat_status_updated", map[string]interface{}{
				"chat":     updatedChat,
				"chatUuid": chatUUID,
				"status":   "ACCEPTED",
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Queue assigned successfully",
		Data:    updatedQueue,
	})
}
