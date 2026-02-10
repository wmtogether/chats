package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// getChatsHandler fetches all chat channels.
func getChatsHandler(w http.ResponseWriter, r *http.Request) {
	chats, err := GetAllChats()
	if err != nil {
		log.Printf("Error fetching chats: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to fetch chats"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    chats,
	})
}

// getChatHandler fetches a single chat channel by UUID.
func getChatHandler(w http.ResponseWriter, r *http.Request) {
	chatUUID := chi.URLParam(r, "uuid")
	if chatUUID == "" {
		http.Error(w, `{"success": false, "error": "Chat UUID is required"}`, http.StatusBadRequest)
		return
	}

	chat, err := GetChatByUUID(chatUUID)
	if err != nil {
		log.Printf("Error fetching chat %s: %v", chatUUID, err)
		if err.Error() == "chat not found" {
			http.Error(w, `{"success": false, "error": "Chat not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"success": false, "error": "Failed to fetch chat"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    chat,
	})
}

// getChatQueueHandler fetches the queue entry linked to a chat
func getChatQueueHandler(w http.ResponseWriter, r *http.Request) {
	chatUUID := chi.URLParam(r, "uuid")
	if chatUUID == "" {
		http.Error(w, `{"success": false, "error": "Chat UUID is required"}`, http.StatusBadRequest)
		return
	}

	queue, err := GetQueueByChatUUID(chatUUID)
	if err != nil {
		log.Printf("Error fetching queue for chat %s: %v", chatUUID, err)
		if err.Error() == "queue not found for chat" {
			http.Error(w, `{"success": false, "error": "Queue not found for this chat"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"success": false, "error": "Failed to fetch queue"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    queue,
	})
}

// getChatMessagesHandler fetches messages for a specific chat channel.
func getChatMessagesHandler(w http.ResponseWriter, r *http.Request) {
	chatUUID := chi.URLParam(r, "uuid")
	if chatUUID == "" {
		http.Error(w, `{"success": false, "error": "Chat UUID is required"}`, http.StatusBadRequest)
		return
	}

	// First, get the chat to retrieve its channelID
	chat, err := GetChatByUUID(chatUUID)
	if err != nil {
		log.Printf("Error fetching chat by UUID %s for messages: %v", chatUUID, err)
		if err.Error() == "chat not found" {
			http.Error(w, `{"success": false, "error": "Chat not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"success": false, "error": "Failed to fetch chat for messages"}`, http.StatusInternalServerError)
		return
	}

	messages, err := GetMessagesByChannelID(chat.ChannelID)
	if err != nil {
		log.Printf("Error fetching messages for channel %s (UUID: %s): %v", chat.ChannelID, chatUUID, err)
		http.Error(w, `{"success": false, "error": "Failed to fetch messages"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    messages,
	})
}

// deleteChatHandler deletes a chat channel by UUID.
func deleteChatHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by authMiddleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	chatUUID := chi.URLParam(r, "uuid")
	if chatUUID == "" {
		http.Error(w, `{"success": false, "error": "Chat UUID is required"}`, http.StatusBadRequest)
		return
	}

	// First, get the chat to check if it exists and get permissions
	chat, err := GetChatByUUID(chatUUID)
	if err != nil {
		log.Printf("Error fetching chat %s for deletion: %v", chatUUID, err)
		if err.Error() == "chat not found" {
			http.Error(w, `{"success": false, "error": "Chat not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"success": false, "error": "Failed to fetch chat"}`, http.StatusInternalServerError)
		return
	}

	// Check if user has permission to delete this chat
	// Allow the creator or admin users to delete the chat
	log.Printf("Delete permission check: User ID %d (role: %s) trying to delete chat created by ID %d", user.ID, user.Role, chat.CreatedByID)
	
	canDelete := false
	if chat.CreatedByID == user.ID {
		canDelete = true
		log.Printf("Permission granted: User is the creator of the chat")
	} else if user.Role == "manager" || user.Role == "sales" {
		canDelete = true
		log.Printf("Permission granted: User has admin role")
	}
	
	if !canDelete {
		log.Printf("Permission denied: User %s (ID: %d, role: %s) cannot delete chat '%s' created by ID %d", user.Name, user.ID, user.Role, chat.ChannelName, chat.CreatedByID)
		http.Error(w, `{"success": false, "error": "You don't have permission to delete this chat. Only the creator or administrators can delete chats."}`, http.StatusForbidden)
		return
	}

	// Delete the chat
	err = DeleteChatByUUID(chatUUID)
	if err != nil {
		log.Printf("Error deleting chat %s: %v", chatUUID, err)
		http.Error(w, `{"success": false, "error": "Failed to delete chat"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("Chat %s deleted by user %s (ID: %d)", chatUUID, user.Name, user.ID)

	// Broadcast chat deletion via WebSocket
	if wsHub != nil {
		wsHub.BroadcastMessage("chat_deleted", map[string]interface{}{
			"chatUuid": chatUUID,
			"chatName": chat.ChannelName,
			"deletedBy": user.Name,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Chat deleted successfully",
		Data: map[string]interface{}{
			"chatUuid": chatUUID,
			"chatName": chat.ChannelName,
		},
	})
}

// CreateChatRequest represents the request body for creating a new chat
type CreateChatRequest struct {
	Name         string `json:"name"`
	RequestType  string `json:"requestType"`
	CustomerId   string `json:"customerId,omitempty"`
	CustomerName string `json:"customerName,omitempty"`
	Description  string `json:"description,omitempty"`
}

// UpdateChatRequest represents the request body for updating a chat
type UpdateChatRequest struct {
	RequestType string `json:"requestType"`
	Status      string `json:"status"`
}

// createChatHandler creates a new chat channel.
func createChatHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by authMiddleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req CreateChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"success": false, "error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Name == "" {
		http.Error(w, `{"success": false, "error": "Chat name is required"}`, http.StatusBadRequest)
		return
	}

	if req.RequestType == "" {
		req.RequestType = "general" // Default request type
	}

	// Create the chat
	chat, err := CreateChat(CreateChatParams{
		Name:         req.Name,
		RequestType:  req.RequestType,
		CustomerId:   req.CustomerId,
		CustomerName: req.CustomerName,
		Description:  req.Description,
		CreatedByID:  user.ID,
		CreatedByName: user.Name,
	})
	if err != nil {
		log.Printf("Error creating chat: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to create chat"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("Chat created successfully: %s (UUID: %s) by user %s (ID: %d)", chat.ChannelName, chat.UUID, user.Name, user.ID)

	// Broadcast chat creation via WebSocket
	if wsHub != nil {
		wsHub.BroadcastMessage("chat_created", map[string]interface{}{
			"chat":      chat,
			"createdBy": user.Name,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Chat created successfully",
		Data:    chat,
	})
}

// updateChatHandler updates a chat's request type.
func updateChatHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by authMiddleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	chatUUID := chi.URLParam(r, "uuid")
	if chatUUID == "" {
		http.Error(w, `{"success": false, "error": "Chat UUID is required"}`, http.StatusBadRequest)
		return
	}

	var req UpdateChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"success": false, "error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Validate request - at least one field should be provided
	if req.RequestType == "" && req.Status == "" {
		http.Error(w, `{"success": false, "error": "At least one field (requestType or status) is required"}`, http.StatusBadRequest)
		return
	}

	// First, get the chat to check if it exists and get permissions
	chat, err := GetChatByUUID(chatUUID)
	if err != nil {
		log.Printf("Error fetching chat %s for update: %v", chatUUID, err)
		if err.Error() == "chat not found" {
			http.Error(w, `{"success": false, "error": "Chat not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"success": false, "error": "Failed to fetch chat"}`, http.StatusInternalServerError)
		return
	}

	// Check if user has permission to update this chat
	// Allow the creator or admin users to update the chat
	log.Printf("Update permission check: User ID %d (role: %s) trying to update chat created by ID %d", user.ID, user.Role, chat.CreatedByID)
	
	canUpdate := false
	if chat.CreatedByID == user.ID {
		canUpdate = true
		log.Printf("Permission granted: User is the creator of the chat")
	} else if user.Role == "manager" || user.Role == "sales" {
		canUpdate = true
		log.Printf("Permission granted: User has admin role")
	}
	
	if !canUpdate {
		log.Printf("Permission denied: User %s (ID: %d, role: %s) cannot update chat '%s' created by ID %d", user.Name, user.ID, user.Role, chat.ChannelName, chat.CreatedByID)
		http.Error(w, `{"success": false, "error": "You don't have permission to update this chat. Only the creator or administrators can update chats."}`, http.StatusForbidden)
		return
	}

	// Update the chat based on provided fields
	var updatedChat *Chat
	var updateField, updateValue string
	
	if req.Status != "" {
		// Validate status value
		validStatuses := []string{"PENDING", "ACCEPTED", "WAIT_DIMENSION", "WAIT_FEEDBACK", "WAIT_QA", "HOLD", "COMPLETED", "CANCEL"}
		isValidStatus := false
		for _, status := range validStatuses {
			if req.Status == status {
				isValidStatus = true
				break
			}
		}
		if !isValidStatus {
			http.Error(w, `{"success": false, "error": "Invalid status value"}`, http.StatusBadRequest)
			return
		}
		
		updatedChat, err = UpdateChatStatus(chatUUID, req.Status)
		updateField = "status"
		updateValue = req.Status
		log.Printf("Chat %s status updated to %s by user %s (ID: %d)", chatUUID, req.Status, user.Name, user.ID)
	} else if req.RequestType != "" {
		updatedChat, err = UpdateChatRequestType(chatUUID, req.RequestType)
		updateField = "requestType"
		updateValue = req.RequestType
		log.Printf("Chat %s request type updated to %s by user %s (ID: %d)", chatUUID, req.RequestType, user.Name, user.ID)
	}
	
	if err != nil {
		log.Printf("Error updating chat %s %s: %v", chatUUID, updateField, err)
		http.Error(w, fmt.Sprintf(`{"success": false, "error": "Failed to update chat %s"}`, updateField), http.StatusInternalServerError)
		return
	}

	// Broadcast chat update via WebSocket
	if wsHub != nil {
		wsHub.BroadcastMessage("chat_updated", map[string]interface{}{
			"chat":      updatedChat,
			"updatedBy": user.Name,
			"field":     updateField,
			"newValue":  updateValue,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: fmt.Sprintf("Chat %s updated successfully", updateField),
		Data:    updatedChat,
	})
}

// updateChatStatusHandler updates a chat's status specifically
func updateChatStatusHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by authMiddleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	chatUUID := chi.URLParam(r, "uuid")
	if chatUUID == "" {
		http.Error(w, `{"success": false, "error": "Chat UUID is required"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"success": false, "error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Validate status
	if req.Status == "" {
		http.Error(w, `{"success": false, "error": "Status is required"}`, http.StatusBadRequest)
		return
	}

	// Validate status value
	validStatuses := []string{"PENDING", "ACCEPTED", "WAIT_DIMENSION", "WAIT_FEEDBACK", "WAIT_QA", "HOLD", "COMPLETED", "CANCEL"}
	isValidStatus := false
	for _, status := range validStatuses {
		if req.Status == status {
			isValidStatus = true
			break
		}
	}
	if !isValidStatus {
		http.Error(w, `{"success": false, "error": "Invalid status value"}`, http.StatusBadRequest)
		return
	}

	// First, get the chat to check if it exists and get permissions
	chat, err := GetChatByUUID(chatUUID)
	if err != nil {
		log.Printf("Error fetching chat %s for status update: %v", chatUUID, err)
		if err.Error() == "chat not found" {
			http.Error(w, `{"success": false, "error": "Chat not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"success": false, "error": "Failed to fetch chat"}`, http.StatusInternalServerError)
		return
	}

	// Check if user has permission to update this chat
	// Allow the creator or admin users to update the chat
	log.Printf("Status update permission check: User ID %d (role: %s) trying to update chat created by ID %d", user.ID, user.Role, chat.CreatedByID)
	
	canUpdate := false
	if chat.CreatedByID == user.ID {
		canUpdate = true
		log.Printf("Permission granted: User is the creator of the chat")
	} else if user.Role == "manager" || user.Role == "sales" {
		canUpdate = true
		log.Printf("Permission granted: User has admin role")
	}
	
	if !canUpdate {
		log.Printf("Permission denied: User %s (ID: %d, role: %s) cannot update chat '%s' created by ID %d", user.Name, user.ID, user.Role, chat.ChannelName, chat.CreatedByID)
		http.Error(w, `{"success": false, "error": "You don't have permission to update this chat status. Only the creator or administrators can update chats."}`, http.StatusForbidden)
		return
	}

	// Update the chat's status
	updatedChat, err := UpdateChatStatus(chatUUID, req.Status)
	if err != nil {
		log.Printf("Error updating chat %s status: %v", chatUUID, err)
		http.Error(w, `{"success": false, "error": "Failed to update chat status"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("Chat %s status updated to %s by user %s (ID: %d)", chatUUID, req.Status, user.Name, user.ID)

	// Broadcast chat status update via WebSocket
	if wsHub != nil {
		wsHub.BroadcastMessage("chat_status_updated", map[string]interface{}{
			"chat":      updatedChat,
			"updatedBy": user.Name,
			"oldStatus": chat.Status,
			"newStatus": req.Status,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Chat status updated successfully",
		Data:    updatedChat,
	})
}