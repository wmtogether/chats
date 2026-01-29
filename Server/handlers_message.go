package main

import (
	"encoding/json"
	"log"
	"net/http"
	"github.com/go-chi/chi/v5"
)

// getMessagesHandler fetches messages based on query parameters.
// Currently supports fetching by 'channel_id'.
func getMessagesHandler(w http.ResponseWriter, r *http.Request) {
	// Get channel_id from query parameters
	channelID := r.URL.Query().Get("channel_id")

	if channelID == "" {
		http.Error(w, `{"success": false, "error": "Query parameter 'channel_id' is required"}`, http.StatusBadRequest)
		return
	}

	messages, err := GetMessagesByChannelID(channelID)
	if err != nil {
		log.Printf("Error fetching messages for channel %s: %v", channelID, err)
		http.Error(w, `{"success": false, "error": "Failed to fetch messages"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    messages,
	})
}

// SendMessageRequest represents the request body for sending a message
type SendMessageRequest struct {
	Content     string   `json:"content"`
	Attachments []string `json:"attachments,omitempty"`
	ReplyTo     *struct {
		MessageID string `json:"messageId"`
		UserName  string `json:"userName"`
		Content   string `json:"content"`
	} `json:"replyTo,omitempty"`
}

// sendMessageHandler handles sending a new message to a chat
func sendMessageHandler(w http.ResponseWriter, r *http.Request) {
	// Extract chat UUID from URL path
	chatUUID := chi.URLParam(r, "uuid")
	
	log.Printf("SendMessage: Chat UUID = %s", chatUUID)
	
	if chatUUID == "" {
		log.Printf("SendMessage: Chat UUID is empty")
		http.Error(w, `{"success": false, "error": "Chat UUID is required"}`, http.StatusBadRequest)
		return
	}

	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok {
		log.Printf("SendMessage: User not found in context")
		http.Error(w, `{"success": false, "error": "User not found in context"}`, http.StatusInternalServerError)
		return
	}
	
	log.Printf("SendMessage: User ID = %d, Name = %s", user.ID, user.Name)

	// Parse request body
	var req SendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("SendMessage: JSON decode error: %v", err)
		http.Error(w, `{"success": false, "error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}
	
	log.Printf("SendMessage: Content = '%s', Attachments = %v", req.Content, req.Attachments)

	// Validate message content
	if req.Content == "" && len(req.Attachments) == 0 {
		log.Printf("SendMessage: Both content and attachments are empty")
		http.Error(w, `{"success": false, "error": "Message content or attachments are required"}`, http.StatusBadRequest)
		return
	}

	// Get chat to verify it exists and get channel_id
	chat, err := GetChatByUUID(chatUUID)
	if err != nil {
		log.Printf("Error fetching chat %s: %v", chatUUID, err)
		http.Error(w, `{"success": false, "error": "Chat not found"}`, http.StatusNotFound)
		return
	}

	// Create the message
	message, err := CreateMessage(CreateMessageParams{
		ChannelID:   chat.ChannelID,
		Content:     req.Content,
		UserID:      user.ID,
		UserName:    user.Name,
		UserRole:    user.Role,
		Attachments: req.Attachments,
		ReplyTo:     req.ReplyTo,
	})
	if err != nil {
		log.Printf("Error creating message: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to create message"}`, http.StatusInternalServerError)
		return
	}

	// Broadcast the message via WebSocket
	if wsHub != nil {
		broadcastData := map[string]interface{}{
			"type": "chat_message",
			"data": map[string]interface{}{
				"chatUuid": chatUUID,
				"message":  message,
			},
		}
		if jsonData, err := json.Marshal(broadcastData); err == nil {
			wsHub.broadcast <- jsonData
		}
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Message sent successfully",
		Data:    message,
	})
}

// deleteMessageHandler handles deleting a message
func deleteMessageHandler(w http.ResponseWriter, r *http.Request) {
	// Extract message ID from URL path
	messageID := chi.URLParam(r, "messageId")
	
	if messageID == "" {
		http.Error(w, `{"success": false, "error": "Message ID is required"}`, http.StatusBadRequest)
		return
	}

	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok {
		http.Error(w, `{"success": false, "error": "User not found in context"}`, http.StatusInternalServerError)
		return
	}

	// Get the message to check permissions
	message, err := GetMessageByID(messageID)
	if err != nil {
		log.Printf("Error fetching message %s: %v", messageID, err)
		http.Error(w, `{"success": false, "error": "Message not found"}`, http.StatusNotFound)
		return
	}

	// Check if user can delete this message (owner or admin)
	if message.UserID != user.ID && user.Role != "admin" {
		http.Error(w, `{"success": false, "error": "You don't have permission to delete this message"}`, http.StatusForbidden)
		return
	}

	// Delete the message
	err = DeleteMessageByID(messageID)
	if err != nil {
		log.Printf("Error deleting message %s: %v", messageID, err)
		http.Error(w, `{"success": false, "error": "Failed to delete message"}`, http.StatusInternalServerError)
		return
	}

	// Broadcast the message deletion via WebSocket
	if wsHub != nil {
		broadcastData := map[string]interface{}{
			"type": "message_deleted",
			"data": map[string]interface{}{
				"messageId": messageID,
				"channelId": message.ChannelID,
			},
		}
		if jsonData, err := json.Marshal(broadcastData); err == nil {
			wsHub.broadcast <- jsonData
		}
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Message deleted successfully",
	})
}

// editMessageHandler handles editing a message
func editMessageHandler(w http.ResponseWriter, r *http.Request) {
	// Extract message ID from URL path
	messageID := chi.URLParam(r, "messageId")
	
	if messageID == "" {
		http.Error(w, `{"success": false, "error": "Message ID is required"}`, http.StatusBadRequest)
		return
	}

	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok {
		http.Error(w, `{"success": false, "error": "User not found in context"}`, http.StatusInternalServerError)
		return
	}

	// Parse request body
	var req struct {
		Content     string   `json:"content"`
		Attachments []string `json:"attachments,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"success": false, "error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Validate message content
	if req.Content == "" && len(req.Attachments) == 0 {
		http.Error(w, `{"success": false, "error": "Message content or attachments are required"}`, http.StatusBadRequest)
		return
	}

	// Get the message to check permissions
	message, err := GetMessageByID(messageID)
	if err != nil {
		log.Printf("Error fetching message %s: %v", messageID, err)
		http.Error(w, `{"success": false, "error": "Message not found"}`, http.StatusNotFound)
		return
	}

	// Check if user can edit this message (only owner can edit)
	if message.UserID != user.ID {
		http.Error(w, `{"success": false, "error": "You can only edit your own messages"}`, http.StatusForbidden)
		return
	}

	// Update the message
	updatedMessage, err := UpdateMessage(messageID, req.Content, req.Attachments)
	if err != nil {
		log.Printf("Error updating message %s: %v", messageID, err)
		http.Error(w, `{"success": false, "error": "Failed to update message"}`, http.StatusInternalServerError)
		return
	}

	// Broadcast the message update via WebSocket
	if wsHub != nil {
		broadcastData := map[string]interface{}{
			"type": "message_updated",
			"data": map[string]interface{}{
				"message": updatedMessage,
			},
		}
		if jsonData, err := json.Marshal(broadcastData); err == nil {
			wsHub.broadcast <- jsonData
		}
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Message updated successfully",
		Data:    updatedMessage,
	})
}

// addReactionHandler handles adding reactions to messages
func addReactionHandler(w http.ResponseWriter, r *http.Request) {
	// Extract message ID from URL path
	messageID := chi.URLParam(r, "messageId")
	
	if messageID == "" {
		http.Error(w, `{"success": false, "error": "Message ID is required"}`, http.StatusBadRequest)
		return
	}

	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok {
		http.Error(w, `{"success": false, "error": "User not found in context"}`, http.StatusInternalServerError)
		return
	}

	// Parse request body
	var req struct {
		Emoji string `json:"emoji"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"success": false, "error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Validate emoji
	if req.Emoji == "" {
		http.Error(w, `{"success": false, "error": "Emoji is required"}`, http.StatusBadRequest)
		return
	}

	// For now, just return success - full reaction implementation would require database schema changes
	log.Printf("User %d added reaction %s to message %s", user.ID, req.Emoji, messageID)

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Reaction feature coming soon!",
	})
}
