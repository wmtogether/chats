package main

import (
	"encoding/json"
	"log" // Added log import
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

func getUsersHandler(w http.ResponseWriter, r *http.Request) {
	users, err := GetAllUsers()
	if err != nil {
		log.Printf("Error fetching users: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to fetch users"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    users,
	})
}

func getUserHandler(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, `{"success": false, "error": "Invalid user ID"}`, http.StatusBadRequest)
		return
	}

	user, err := GetUserByID(id)
	if err != nil {
		log.Printf("Error fetching user %d: %v", id, err)
		http.Error(w, `{"success": false, "error": "User not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    user,
	})
}
