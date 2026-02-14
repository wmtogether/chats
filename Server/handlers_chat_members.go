package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// joinChatHandler handles POST /api/chats/{id}/join
func joinChatHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Get chat ID from URL
	chatIDStr := chi.URLParam(r, "id")
	chatID, err := strconv.Atoi(chatIDStr)
	if err != nil {
		http.Error(w, `{"success": false, "error": "Invalid chat ID"}`, http.StatusBadRequest)
		return
	}

	// Check if chat exists
	chat, err := GetChatByID(chatID)
	if err != nil {
		log.Printf("Error getting chat: %v", err)
		http.Error(w, `{"success": false, "error": "Chat not found"}`, http.StatusNotFound)
		return
	}

	// Check if user is already the creator (creators can't "join" their own chats)
	if chat.CreatedByID == user.ID {
		http.Error(w, `{"success": false, "error": "You are the creator of this chat"}`, http.StatusBadRequest)
		return
	}

	// Join the chat
	err = JoinChat(chatID, user.ID)
	if err != nil {
		log.Printf("Error joining chat: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to join chat"}`, http.StatusInternalServerError)
		return
	}

	// Broadcast join event via WebSocket
	if wsHub != nil {
		wsHub.BroadcastMessage("user_joined_chat", map[string]interface{}{
			"chatId":   chatID,
			"userId":   user.ID,
			"userName": user.Name,
			"userRole": user.Role,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Successfully joined chat",
		Data: map[string]interface{}{
			"chatId": chatID,
			"userId": user.ID,
		},
	})
}

// leaveChatHandler handles POST /api/chats/{id}/leave
func leaveChatHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Get chat ID from URL
	chatIDStr := chi.URLParam(r, "id")
	chatID, err := strconv.Atoi(chatIDStr)
	if err != nil {
		http.Error(w, `{"success": false, "error": "Invalid chat ID"}`, http.StatusBadRequest)
		return
	}

	// Check if chat exists
	chat, err := GetChatByID(chatID)
	if err != nil {
		log.Printf("Error getting chat: %v", err)
		http.Error(w, `{"success": false, "error": "Chat not found"}`, http.StatusNotFound)
		return
	}

	// Check if user is the creator (creators can't leave their own chats)
	if chat.CreatedByID == user.ID {
		http.Error(w, `{"success": false, "error": "You cannot leave a chat you created"}`, http.StatusBadRequest)
		return
	}

	// Leave the chat
	err = LeaveChat(chatID, user.ID)
	if err != nil {
		log.Printf("Error leaving chat: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to leave chat"}`, http.StatusInternalServerError)
		return
	}

	// Broadcast leave event via WebSocket
	if wsHub != nil {
		wsHub.BroadcastMessage("user_left_chat", map[string]interface{}{
			"chatId":   chatID,
			"userId":   user.ID,
			"userName": user.Name,
			"userRole": user.Role,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Successfully left chat",
		Data: map[string]interface{}{
			"chatId": chatID,
			"userId": user.ID,
		},
	})
}

// getChatMembersHandler handles GET /api/chats/{id}/members
func getChatMembersHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Get chat ID from URL
	chatIDStr := chi.URLParam(r, "id")
	chatID, err := strconv.Atoi(chatIDStr)
	if err != nil {
		http.Error(w, `{"success": false, "error": "Invalid chat ID"}`, http.StatusBadRequest)
		return
	}

	// Get chat members
	members, err := GetChatMembers(chatID)
	if err != nil {
		log.Printf("Error getting chat members: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to get chat members"}`, http.StatusInternalServerError)
		return
	}

	// Get chat to include creator info
	chat, err := GetChatByID(chatID)
	if err != nil {
		log.Printf("Error getting chat: %v", err)
		http.Error(w, `{"success": false, "error": "Chat not found"}`, http.StatusNotFound)
		return
	}

	// Get member count
	memberCount, err := GetChatMemberCount(chatID)
	if err != nil {
		log.Printf("Error getting member count: %v", err)
		memberCount = len(members) + 1 // Fallback: members + creator
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"members":     members,
			"memberCount": memberCount,
			"creator": map[string]interface{}{
				"id":   chat.CreatedByID,
				"name": chat.CreatedByName,
			},
		},
	})
}

// checkMembershipHandler handles GET /api/chats/{id}/is-member
func checkMembershipHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Get chat ID from URL
	chatIDStr := chi.URLParam(r, "id")
	chatID, err := strconv.Atoi(chatIDStr)
	if err != nil {
		http.Error(w, `{"success": false, "error": "Invalid chat ID"}`, http.StatusBadRequest)
		return
	}

	// Check membership
	isMember, err := IsChatMember(chatID, user.ID)
	if err != nil {
		log.Printf("Error checking membership: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to check membership"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"isMember": isMember,
			"chatId":   chatID,
			"userId":   user.ID,
		},
	})
}

// getUserJoinedChatsHandler handles GET /api/users/me/joined-chats
func getUserJoinedChatsHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Get joined chat IDs
	chatIDs, err := GetUserJoinedChats(user.ID)
	if err != nil {
		log.Printf("Error getting user joined chats: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to get joined chats"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"chatIds": chatIDs,
			"count":   len(chatIDs),
		},
	})
}
