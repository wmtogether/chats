package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"
)

// ProofData represents the proof data structure based on the jobs table schema
type ProofData struct {
	ID            int       `json:"id"`
	RunnerID      string    `json:"runnerId"`
	JobName       string    `json:"jobName"`
	CustomerName  *string   `json:"customerName,omitempty"`
	CustomerID    *string   `json:"customerId,omitempty"`
	SalesName     *string   `json:"salesName,omitempty"`
	ProofStatus   string    `json:"proofStatus"`
	Position      int       `json:"position"`
	CreatedByID   int       `json:"createdById"`
	CreatedByRole string    `json:"createdByRole"`
	CreatedByName string    `json:"createdByName"`
	UpdatedByID   *int      `json:"updatedById,omitempty"`
	UpdatedByRole *string   `json:"updatedByRole,omitempty"`
	UpdatedByName *string   `json:"updatedByName,omitempty"`
	FormData      json.RawMessage `json:"formData"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// CreateProofParams represents the parameters for creating a new proof data entry
type CreateProofParams struct {
	RunnerID     string          `json:"runnerId"`
	JobName      string          `json:"jobName"`
	CustomerName *string         `json:"customerName,omitempty"`
	CustomerID   *string         `json:"customerId,omitempty"`
	SalesName    *string         `json:"salesName,omitempty"`
	ProofStatus  string          `json:"proofStatus"`
	Position     int             `json:"position"`
	FormData     json.RawMessage `json:"formData"`
	ChatUUID     *string         `json:"chatUuid,omitempty"` // Link to chat
}

// CreateProofData creates a new proof data entry in the jobs table
func CreateProofData(params CreateProofParams, user *User) (*ProofData, error) {
	// Set default proof status if not provided
	if params.ProofStatus == "" {
		params.ProofStatus = "PENDING_PROOF"
	}

	// Prepare SQL values
	var customerName, salesName sql.NullString
	if params.CustomerName != nil {
		customerName = sql.NullString{String: *params.CustomerName, Valid: true}
	}
	if params.SalesName != nil {
		salesName = sql.NullString{String: *params.SalesName, Valid: true}
	}

	// Insert the proof data into the jobs table (WITHOUT customer_id - that goes in filestorage table)
	query := `
		INSERT INTO jobs (
			runner_id, job_name, customer_name, sales_name, proof_status, position,
			created_by_id, created_by_role, created_by_name, form_data,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
		) RETURNING id, runner_id, job_name, customer_name, sales_name, proof_status, position,
		created_by_id, created_by_role, created_by_name, updated_by_id, updated_by_role, 
		updated_by_name, form_data, created_at, updated_at
	`

	now := time.Now()
	row := db.QueryRow(query,
		params.RunnerID,     // runner_id
		params.JobName,      // job_name
		customerName,        // customer_name
		salesName,           // sales_name
		params.ProofStatus,  // proof_status
		params.Position,     // position
		user.ID,             // created_by_id
		user.Role,           // created_by_role
		user.Name,           // created_by_name
		params.FormData,     // form_data
		now,                 // created_at
		now,                 // updated_at
	)

	var proof ProofData
	var updatedByID sql.NullInt64
	var updatedByRole, updatedByName sql.NullString
	var customerNameResult, salesNameResult sql.NullString

	err := row.Scan(
		&proof.ID, &proof.RunnerID, &proof.JobName, &customerNameResult, &salesNameResult,
		&proof.ProofStatus, &proof.Position, &proof.CreatedByID, &proof.CreatedByRole,
		&proof.CreatedByName, &updatedByID, &updatedByRole, &updatedByName,
		&proof.FormData, &proof.CreatedAt, &proof.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("error creating proof data: %w", err)
	}

	// Convert nullable fields
	if customerNameResult.Valid {
		proof.CustomerName = &customerNameResult.String
	}
	if salesNameResult.Valid {
		proof.SalesName = &salesNameResult.String
	}
	// Store customer_id in the struct (from params) for use in handlers
	if params.CustomerID != nil {
		proof.CustomerID = params.CustomerID
	}
	if updatedByID.Valid {
		id := int(updatedByID.Int64)
		proof.UpdatedByID = &id
	}
	if updatedByRole.Valid {
		proof.UpdatedByRole = &updatedByRole.String
	}
	if updatedByName.Valid {
		proof.UpdatedByName = &updatedByName.String
	}

	log.Printf("✅ Created proof data entry (ID: %d) for job: %s", proof.ID, proof.JobName)

	return &proof, nil
}

// GetAllProofData fetches all proof data entries from the jobs table
func GetAllProofData() ([]ProofData, error) {
	rows, err := db.Query(`
		SELECT id, runner_id, job_name, customer_name, sales_name, proof_status, position,
		created_by_id, created_by_role, created_by_name, updated_by_id, updated_by_role,
		updated_by_name, form_data, created_at, updated_at
		FROM jobs
		ORDER BY position ASC, created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("error querying proof data: %w", err)
	}
	defer rows.Close()

	var proofs []ProofData
	for rows.Next() {
		var proof ProofData
		var updatedByID sql.NullInt64
		var updatedByRole, updatedByName sql.NullString
		var customerName, salesName sql.NullString

		err := rows.Scan(
			&proof.ID, &proof.RunnerID, &proof.JobName, &customerName, &salesName,
			&proof.ProofStatus, &proof.Position, &proof.CreatedByID, &proof.CreatedByRole,
			&proof.CreatedByName, &updatedByID, &updatedByRole, &updatedByName,
			&proof.FormData, &proof.CreatedAt, &proof.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning proof data row: %w", err)
		}

		// Convert nullable fields
		if customerName.Valid {
			proof.CustomerName = &customerName.String
		}
		if salesName.Valid {
			proof.SalesName = &salesName.String
		}
		if updatedByID.Valid {
			id := int(updatedByID.Int64)
			proof.UpdatedByID = &id
		}
		if updatedByRole.Valid {
			proof.UpdatedByRole = &updatedByRole.String
		}
		if updatedByName.Valid {
			proof.UpdatedByName = &updatedByName.String
		}

		proofs = append(proofs, proof)
	}

	return proofs, nil
}

// GetProofDataByID fetches a single proof data entry by ID
func GetProofDataByID(id int) (*ProofData, error) {
	row := db.QueryRow(`
		SELECT id, runner_id, job_name, customer_name, sales_name, proof_status, position,
		created_by_id, created_by_role, created_by_name, updated_by_id, updated_by_role,
		updated_by_name, form_data, created_at, updated_at
		FROM jobs
		WHERE id = $1
		LIMIT 1
	`, id)

	var proof ProofData
	var updatedByID sql.NullInt64
	var updatedByRole, updatedByName sql.NullString
	var customerName, salesName sql.NullString

	err := row.Scan(
		&proof.ID, &proof.RunnerID, &proof.JobName, &customerName, &salesName,
		&proof.ProofStatus, &proof.Position, &proof.CreatedByID, &proof.CreatedByRole,
		&proof.CreatedByName, &updatedByID, &updatedByRole, &updatedByName,
		&proof.FormData, &proof.CreatedAt, &proof.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("proof data not found")
		}
		return nil, fmt.Errorf("error scanning proof data row: %w", err)
	}

	// Convert nullable fields
	if customerName.Valid {
		proof.CustomerName = &customerName.String
	}
	if salesName.Valid {
		proof.SalesName = &salesName.String
	}
	if updatedByID.Valid {
		id := int(updatedByID.Int64)
		proof.UpdatedByID = &id
	}
	if updatedByRole.Valid {
		proof.UpdatedByRole = &updatedByRole.String
	}
	if updatedByName.Valid {
		proof.UpdatedByName = &updatedByName.String
	}

	return &proof, nil
}

// UpdateProofData updates an existing proof data entry
func UpdateProofData(id int, params CreateProofParams, user *User) (*ProofData, error) {
	// Prepare SQL values
	var customerName, salesName sql.NullString
	if params.CustomerName != nil {
		customerName = sql.NullString{String: *params.CustomerName, Valid: true}
	}
	if params.SalesName != nil {
		salesName = sql.NullString{String: *params.SalesName, Valid: true}
	}

	// Update the proof data
	query := `
		UPDATE jobs
		SET runner_id = $1, job_name = $2, customer_name = $3, sales_name = $4,
		    proof_status = $5, position = $6, form_data = $7,
		    updated_by_id = $8, updated_by_role = $9, updated_by_name = $10, updated_at = $11
		WHERE id = $12
	`

	now := time.Now()
	_, err := db.Exec(query,
		params.RunnerID,     // runner_id
		params.JobName,      // job_name
		customerName,        // customer_name
		salesName,           // sales_name
		params.ProofStatus,  // proof_status
		params.Position,     // position
		params.FormData,     // form_data
		user.ID,             // updated_by_id
		user.Role,           // updated_by_role
		user.Name,           // updated_by_name
		now,                 // updated_at
		id,                  // id
	)
	if err != nil {
		return nil, fmt.Errorf("error updating proof data: %w", err)
	}

	// Return the updated proof data
	return GetProofDataByID(id)
}

// GenerateNextRunnerID generates the next available runner ID for a given prefix
// Format: {prefix}-{DDMMYY}-J{0001-9999}
func GenerateNextRunnerID(prefix string) (string, error) {
	// Get current date in DDMMYY format
	now := time.Now()
	day := fmt.Sprintf("%02d", now.Day())
	month := fmt.Sprintf("%02d", int(now.Month()))
	year := fmt.Sprintf("%02d", now.Year()%100)
	dateStr := fmt.Sprintf("%s%s%s", day, month, year)
	
	// Pattern to match: {prefix}-{DDMMYY}-J%
	pattern := fmt.Sprintf("%s-%s-J%%", prefix, dateStr)
	
	// Get the highest number for today's date with this prefix
	var maxNum int
	err := db.QueryRow(`
		SELECT COALESCE(MAX(CAST(SUBSTRING(runner_id FROM 'J([0-9]+)$') AS INTEGER)), 0)
		FROM jobs
		WHERE runner_id LIKE $1
	`, pattern).Scan(&maxNum)
	if err != nil {
		return "", fmt.Errorf("error querying max runner number: %w", err)
	}
	
	// Generate next number (increment by 1)
	nextNum := maxNum + 1
	if nextNum > 9999 {
		return "", fmt.Errorf("runner ID limit reached for today (max 9999)")
	}
	
	// Format: {prefix}-{DDMMYY}-J{0001}
	runnerID := fmt.Sprintf("%s-%s-J%04d", prefix, dateStr, nextNum)
	
	return runnerID, nil
}

// DeleteProofData deletes a proof data entry by ID
func DeleteProofData(id int) error {
	result, err := db.Exec(`DELETE FROM jobs WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("error deleting proof data: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("error checking rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("proof data not found")
	}

	return nil
}
