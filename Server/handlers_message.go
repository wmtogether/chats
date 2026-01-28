package main

import (
	"encoding/json"
	"log"
	"net/http"
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
