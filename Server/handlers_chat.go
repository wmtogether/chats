package main

import (
	"encoding/json"
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

	// Validate request type
	if req.RequestType == "" {
		http.Error(w, `{"success": false, "error": "Request type is required"}`, http.StatusBadRequest)
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

	// Update the chat's request type
	updatedChat, err := UpdateChatRequestType(chatUUID, req.RequestType)
	if err != nil {
		log.Printf("Error updating chat %s request type: %v", chatUUID, err)
		http.Error(w, `{"success": false, "error": "Failed to update chat request type"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("Chat %s request type updated to %s by user %s (ID: %d)", chatUUID, req.RequestType, user.Name, user.ID)

	// Broadcast chat update via WebSocket
	if wsHub != nil {
		wsHub.BroadcastMessage("chat_updated", map[string]interface{}{
			"chat":      updatedChat,
			"updatedBy": user.Name,
			"field":     "requestType",
			"newValue":  req.RequestType,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Chat request type updated successfully",
		Data:    updatedChat,
	})
}