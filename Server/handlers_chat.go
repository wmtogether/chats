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
