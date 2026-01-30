package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

// getCustomersHandler fetches all customers.
func getCustomersHandler(w http.ResponseWriter, r *http.Request) {
	customers, err := GetAllCustomers()
	if err != nil {
		log.Printf("Error fetching customers: %v", err)
		http.Error(w, `{"success": false, "error": "Failed to fetch customers"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    customers,
	})
}

// getCustomerHandler fetches a single customer by ID.
func getCustomerHandler(w http.ResponseWriter, r *http.Request) {
	idParam := chi.URLParam(r, "id")
	if idParam == "" {
		http.Error(w, `{"success": false, "error": "Customer ID is required"}`, http.StatusBadRequest)
		return
	}

	id, err := strconv.Atoi(idParam)
	if err != nil {
		http.Error(w, `{"success": false, "error": "Invalid customer ID"}`, http.StatusBadRequest)
		return
	}

	customer, err := GetCustomerByID(id)
	if err != nil {
		log.Printf("Error fetching customer %d: %v", id, err)
		if err.Error() == "customer not found" {
			http.Error(w, `{"success": false, "error": "Customer not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"success": false, "error": "Failed to fetch customer"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    customer,
	})
}

// getCustomerByCusIdHandler fetches a single customer by customer ID.
func getCustomerByCusIdHandler(w http.ResponseWriter, r *http.Request) {
	cusId := chi.URLParam(r, "cusId")
	if cusId == "" {
		http.Error(w, `{"success": false, "error": "Customer ID is required"}`, http.StatusBadRequest)
		return
	}

	customer, err := GetCustomerByCusID(cusId)
	if err != nil {
		log.Printf("Error fetching customer %s: %v", cusId, err)
		if err.Error() == "customer not found" {
			http.Error(w, `{"success": false, "error": "Customer not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"success": false, "error": "Failed to fetch customer"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    customer,
	})
}

// CreateCustomerRequest represents the request body for creating a new customer
type CreateCustomerRequest struct {
	CusID string `json:"cusId,omitempty"` // Optional - will be auto-generated if not provided
	Name  string `json:"name"`
}

// createCustomerHandler creates a new customer.
func createCustomerHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by authMiddleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req CreateCustomerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"success": false, "error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Name == "" {
		http.Error(w, `{"success": false, "error": "Customer name is required"}`, http.StatusBadRequest)
		return
	}

	// Create the customer
	var customer *Customer
	var err error
	
	if req.CusID != "" {
		// Use provided customer ID
		customer, err = CreateCustomer(req.CusID, req.Name)
	} else {
		// Auto-generate customer ID
		customer, err = CreateCustomerWithAutoID(req.Name)
	}
	if err != nil {
		log.Printf("Error creating customer: %v", err)
		if strings.Contains(err.Error(), "already exists") {
			http.Error(w, `{"success": false, "error": "Customer with this ID already exists"}`, http.StatusConflict)
			return
		}
		if strings.Contains(err.Error(), "limit reached") {
			http.Error(w, `{"success": false, "error": "Customer ID limit reached (Z999)"}`, http.StatusBadRequest)
			return
		}
		http.Error(w, `{"success": false, "error": "Failed to create customer"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("Customer created successfully: %s (ID: %s) by user %s (ID: %d)", customer.Name, customer.CusID, user.Name, user.ID)

	// Broadcast customer creation via WebSocket
	if wsHub != nil {
		wsHub.BroadcastMessage("customer_created", map[string]interface{}{
			"customer":  customer,
			"createdBy": user.Name,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Customer created successfully",
		Data:    customer,
	})
}

// UpdateCustomerRequest represents the request body for updating a customer
type UpdateCustomerRequest struct {
	CusID string `json:"cusId"`
	Name  string `json:"name"`
}

// updateCustomerHandler updates a customer's information.
func updateCustomerHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by authMiddleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	idParam := chi.URLParam(r, "id")
	if idParam == "" {
		http.Error(w, `{"success": false, "error": "Customer ID is required"}`, http.StatusBadRequest)
		return
	}

	id, err := strconv.Atoi(idParam)
	if err != nil {
		http.Error(w, `{"success": false, "error": "Invalid customer ID"}`, http.StatusBadRequest)
		return
	}

	var req UpdateCustomerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"success": false, "error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.CusID == "" {
		http.Error(w, `{"success": false, "error": "Customer ID is required"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, `{"success": false, "error": "Customer name is required"}`, http.StatusBadRequest)
		return
	}

	// Check if user has permission to update customers
	// Allow manager and sales roles to update customers
	if user.Role != "manager" && user.Role != "sales" {
		log.Printf("Permission denied: User %s (ID: %d, role: %s) cannot update customers", user.Name, user.ID, user.Role)
		http.Error(w, `{"success": false, "error": "You don't have permission to update customers. Only managers and sales can update customers."}`, http.StatusForbidden)
		return
	}

	// Update the customer
	customer, err := UpdateCustomer(id, req.CusID, req.Name)
	if err != nil {
		log.Printf("Error updating customer %d: %v", id, err)
		if err.Error() == "customer not found" {
			http.Error(w, `{"success": false, "error": "Customer not found"}`, http.StatusNotFound)
			return
		}
		if err.Error() == "another customer with ID "+req.CusID+" already exists" {
			http.Error(w, `{"success": false, "error": "Another customer with this ID already exists"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"success": false, "error": "Failed to update customer"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("Customer updated successfully: %s (ID: %s) by user %s (ID: %d)", customer.Name, customer.CusID, user.Name, user.ID)

	// Broadcast customer update via WebSocket
	if wsHub != nil {
		wsHub.BroadcastMessage("customer_updated", map[string]interface{}{
			"customer":  customer,
			"updatedBy": user.Name,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Customer updated successfully",
		Data:    customer,
	})
}

// deleteCustomerHandler deletes a customer.
func deleteCustomerHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by authMiddleware)
	user, ok := r.Context().Value(userContextKey).(*User)
	if !ok || user == nil {
		http.Error(w, `{"success": false, "error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	idParam := chi.URLParam(r, "id")
	if idParam == "" {
		http.Error(w, `{"success": false, "error": "Customer ID is required"}`, http.StatusBadRequest)
		return
	}

	id, err := strconv.Atoi(idParam)
	if err != nil {
		http.Error(w, `{"success": false, "error": "Invalid customer ID"}`, http.StatusBadRequest)
		return
	}

	// Check if user has permission to delete customers
	// Only allow manager role to delete customers
	if user.Role != "manager" {
		log.Printf("Permission denied: User %s (ID: %d, role: %s) cannot delete customers", user.Name, user.ID, user.Role)
		http.Error(w, `{"success": false, "error": "You don't have permission to delete customers. Only managers can delete customers."}`, http.StatusForbidden)
		return
	}

	// First, get the customer to get its information for logging and broadcasting
	customer, err := GetCustomerByID(id)
	if err != nil {
		log.Printf("Error fetching customer %d for deletion: %v", id, err)
		if err.Error() == "customer not found" {
			http.Error(w, `{"success": false, "error": "Customer not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"success": false, "error": "Failed to fetch customer"}`, http.StatusInternalServerError)
		return
	}

	// Delete the customer
	err = DeleteCustomer(id)
	if err != nil {
		log.Printf("Error deleting customer %d: %v", id, err)
		http.Error(w, `{"success": false, "error": "Failed to delete customer"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("Customer deleted successfully: %s (ID: %s) by user %s (ID: %d)", customer.Name, customer.CusID, user.Name, user.ID)

	// Broadcast customer deletion via WebSocket
	if wsHub != nil {
		wsHub.BroadcastMessage("customer_deleted", map[string]interface{}{
			"customer":  customer,
			"deletedBy": user.Name,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Message: "Customer deleted successfully",
		Data: map[string]interface{}{
			"id":    customer.ID,
			"cusId": customer.CusID,
			"name":  customer.Name,
		},
	})
}