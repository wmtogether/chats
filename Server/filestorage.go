package main

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"
)

// FileStorage represents a file storage entry
type FileStorage struct {
	ID           int       `json:"id"`
	RunnerID     string    `json:"runnerId"`
	JobID        *int      `json:"jobId,omitempty"`
	CustomerID   string    `json:"customerId"`
	CustomerName *string   `json:"customerName,omitempty"`
	StoragePath  string    `json:"storagePath"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// CreateFileStorageParams represents parameters for creating a file storage entry
type CreateFileStorageParams struct {
	RunnerID     string
	JobID        *int
	CustomerID   string
	CustomerName *string
	StoragePath  string
	ChatUUID     *string // Link to chat
}

// CreateFileStorage creates a new file storage entry
func CreateFileStorage(params CreateFileStorageParams) (*FileStorage, error) {
	var customerName sql.NullString
	if params.CustomerName != nil {
		customerName = sql.NullString{String: *params.CustomerName, Valid: true}
	}

	var jobID sql.NullInt64
	if params.JobID != nil {
		jobID = sql.NullInt64{Int64: int64(*params.JobID), Valid: true}
	}

	var chatUUID sql.NullString
	if params.ChatUUID != nil {
		chatUUID = sql.NullString{String: *params.ChatUUID, Valid: true}
	}

	query := `
		INSERT INTO filestorage (
			runner_id, job_id, customer_id, customer_name, storage_path, chat_uuid,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8
		) RETURNING id, runner_id, job_id, customer_id, customer_name, storage_path,
		created_at, updated_at
	`

	now := time.Now()
	row := db.QueryRow(query,
		params.RunnerID,
		jobID,
		params.CustomerID,
		customerName,
		params.StoragePath,
		chatUUID,
		now,
		now,
	)

	var fs FileStorage
	var jobIDResult sql.NullInt64
	var customerNameResult sql.NullString

	err := row.Scan(
		&fs.ID, &fs.RunnerID, &jobIDResult, &fs.CustomerID, &customerNameResult,
		&fs.StoragePath, &fs.CreatedAt, &fs.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("error creating file storage entry: %w", err)
	}

	// Convert nullable fields
	if jobIDResult.Valid {
		id := int(jobIDResult.Int64)
		fs.JobID = &id
	}
	if customerNameResult.Valid {
		fs.CustomerName = &customerNameResult.String
	}

	log.Printf("✅ Created file storage entry (ID: %d) for runner: %s, path: %s", fs.ID, fs.RunnerID, fs.StoragePath)

	return &fs, nil
}

// GetFileStorageByRunnerID fetches file storage entry by runner ID
func GetFileStorageByRunnerID(runnerID string) (*FileStorage, error) {
	row := db.QueryRow(`
		SELECT id, runner_id, job_id, customer_id, customer_name, storage_path,
		created_at, updated_at
		FROM filestorage
		WHERE runner_id = $1
		LIMIT 1
	`, runnerID)

	var fs FileStorage
	var jobID sql.NullInt64
	var customerName sql.NullString

	err := row.Scan(
		&fs.ID, &fs.RunnerID, &jobID, &fs.CustomerID, &customerName,
		&fs.StoragePath, &fs.CreatedAt, &fs.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("file storage not found")
		}
		return nil, fmt.Errorf("error scanning file storage row: %w", err)
	}

	// Convert nullable fields
	if jobID.Valid {
		id := int(jobID.Int64)
		fs.JobID = &id
	}
	if customerName.Valid {
		fs.CustomerName = &customerName.String
	}

	return &fs, nil
}

// GetFileStorageByCustomerID fetches all file storage entries for a customer
func GetFileStorageByCustomerID(customerID string) ([]FileStorage, error) {
	rows, err := db.Query(`
		SELECT id, runner_id, job_id, customer_id, customer_name, storage_path,
		created_at, updated_at
		FROM filestorage
		WHERE customer_id = $1
		ORDER BY created_at DESC
	`, customerID)
	if err != nil {
		return nil, fmt.Errorf("error querying file storage: %w", err)
	}
	defer rows.Close()

	var storages []FileStorage
	for rows.Next() {
		var fs FileStorage
		var jobID sql.NullInt64
		var customerName sql.NullString

		err := rows.Scan(
			&fs.ID, &fs.RunnerID, &jobID, &fs.CustomerID, &customerName,
			&fs.StoragePath, &fs.CreatedAt, &fs.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning file storage row: %w", err)
		}

		// Convert nullable fields
		if jobID.Valid {
			id := int(jobID.Int64)
			fs.JobID = &id
		}
		if customerName.Valid {
			fs.CustomerName = &customerName.String
		}

		storages = append(storages, fs)
	}

	return storages, nil
}

// DeleteFileStorage deletes a file storage entry by ID
func DeleteFileStorage(id int) error {
	result, err := db.Exec(`DELETE FROM filestorage WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("error deleting file storage: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("error checking rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("file storage not found")
	}

	return nil
}


// GetFileStoragePathByChatUniqueID retrieves the storage path for a chat's unique ID
// This looks up the most recent filestorage entry for the chat if is_proof_enabled=1,
// otherwise returns the default CN path
func GetFileStoragePathByChatUniqueID(uniqueID string) (string, error) {
	// Look up chat to get UUID, is_proof_enabled, and customer_id
	var chatUUID string
	var isProofEnabled int
	var customerID sql.NullString
	
	err := db.QueryRow(`
		SELECT uuid, COALESCE(is_proof_enabled, 0), customer_id 
		FROM chats 
		WHERE unique_id = $1 
		LIMIT 1
	`, uniqueID).Scan(&chatUUID, &isProofEnabled, &customerID)
	
	if err != nil {
		if err == sql.ErrNoRows {
			// Chat not found, return empty string
			return "", nil
		}
		return "", fmt.Errorf("error looking up chat: %w", err)
	}
	
	// If proof is enabled, look up the proof's filestorage path
	if isProofEnabled == 1 {
		var storagePath string
		query := `
			SELECT storage_path 
			FROM filestorage 
			WHERE chat_uuid = $1
			ORDER BY created_at DESC
			LIMIT 1
		`
		
		err = db.QueryRow(query, chatUUID).Scan(&storagePath)
		if err == nil {
			return storagePath, nil
		}
		
		// If not found, return empty string (no proof created yet for this chat)
		if err == sql.ErrNoRows {
			return "", nil
		}
		
		return "", fmt.Errorf("error looking up filestorage: %w", err)
	}
	
	// Otherwise, use default CN path: /volumes/filestorage/CN/{CUSTOMER-ID}/{UNIQUE-ID}
	// Extract prefix from unique ID (e.g., "CN-120226-1" -> "CN")
	prefix := "CN"
	if len(uniqueID) >= 2 {
		parts := strings.Split(uniqueID, "-")
		if len(parts) > 0 {
			prefix = parts[0]
		}
	}
	
	// Get customer ID
	custID := "UNKNOWN"
	if customerID.Valid && customerID.String != "" {
		custID = customerID.String
	}
	
	// Build default path
	defaultPath := fmt.Sprintf("/volumes/filestorage/%s/%s/%s", prefix, custID, uniqueID)
	return defaultPath, nil
}

// GetFileStoragePathByCustomerID retrieves the most recent storage path for a customer
func GetFileStoragePathByCustomerID(customerID string) (string, error) {
	var storagePath string
	query := `
		SELECT storage_path 
		FROM filestorage 
		WHERE customer_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`
	
	err := db.QueryRow(query, customerID).Scan(&storagePath)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", err
	}
	
	return storagePath, nil
}
