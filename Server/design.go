package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// DesignStatus represents the status of a design
type DesignStatus string

const (
	DesignStatusPending    DesignStatus = "PENDING"
	DesignStatusInProgress DesignStatus = "IN_PROGRESS"
	DesignStatusReview     DesignStatus = "REVIEW"
	DesignStatusApproved   DesignStatus = "APPROVED"
	DesignStatusRejected   DesignStatus = "REJECTED"
	DesignStatusCompleted  DesignStatus = "COMPLETED"
	DesignStatusCancelled  DesignStatus = "CANCELLED"
	DesignStatusOnHold     DesignStatus = "ON_HOLD"
)

// DesignComment represents a comment on a design
type DesignComment struct {
	ID            string           `json:"id"`
	Message       string           `json:"message"`
	CreatedBy     string           `json:"createdBy"`
	CreatedByRole string           `json:"createdByRole"`
	CreatedAt     string           `json:"createdAt"`
	EditedAt      *string          `json:"editedAt,omitempty"`
	Image         *string          `json:"image,omitempty"`
	ReplyTo       *string          `json:"replyTo,omitempty"`
	Replies       []DesignComment  `json:"replies,omitempty"`
}

// DesignData represents the JSONB data for a design
type DesignData struct {
	JobName                  string          `json:"jobName"`
	DimensionsWidth          *string         `json:"dimensionsWidth,omitempty"`
	DimensionsHeight         *string         `json:"dimensionsHeight,omitempty"`
	DimensionsDepth          *string         `json:"dimensionsDepth,omitempty"`
	DimensionUnit            *string         `json:"dimensionUnit,omitempty"`
	EditCount                int             `json:"editCount"`
	CustomerName             *string         `json:"customerName,omitempty"`
	CustomerID               *string         `json:"customerId,omitempty"`
	Note                     *string         `json:"note,omitempty"`
	Comments                 []DesignComment `json:"comments"`
	Image                    *string         `json:"image,omitempty"`
	DesignFile               *string         `json:"designFile,omitempty"`
	DesignFilePath           *string         `json:"designFilePath,omitempty"`
	DesignFileOriginalName   *string         `json:"designFileOriginalName,omitempty"`
	ShowWatermark            *bool           `json:"showWatermark,omitempty"`
	ShowLogo                 *bool           `json:"showLogo,omitempty"`
	IsClosed                 *bool           `json:"isClosed,omitempty"`
	ClosedAt                 *string         `json:"closedAt,omitempty"`
	ClosedBy                 *string         `json:"closedBy,omitempty"`
}

// DesignVersion represents a version in the design history
type DesignVersion struct {
	Version       int          `json:"version"`
	CommitMessage string       `json:"commitMessage"`
	CommitHash    string       `json:"commitHash"`
	Data          DesignData   `json:"data"`
	CreatedBy     string       `json:"createdBy"`
	CreatedByRole string       `json:"createdByRole"`
	CreatedAt     string       `json:"createdAt"`
}

// CommentPost represents comments organized by commit hash
type CommentPost map[string][]DesignComment

// Design represents a design record
type Design struct {
	ID             int                `json:"id"`
	DesignID       string             `json:"designId"`
	ParentDesignID sql.NullString     `json:"parentDesignId,omitempty"`
	ChildNumber    sql.NullInt64      `json:"childNumber,omitempty"`
	JobName        string             `json:"jobName"`
	CustomerName   sql.NullString     `json:"-"` // Don't serialize directly
	CustomerID     sql.NullString     `json:"-"` // Don't serialize directly
	DesignStatus   DesignStatus       `json:"designStatus"`
	CurrentVersion int                `json:"currentVersion"`
	DesignData     json.RawMessage    `json:"designData"`
	VersionHistory json.RawMessage    `json:"versionHistory"`
	CommentPost    json.RawMessage    `json:"commentPost"`
	CreatedByID    int                `json:"createdById"`
	CreatedByRole  string             `json:"createdByRole"`
	CreatedByName  string             `json:"createdByName"`
	UpdatedByID    sql.NullInt64      `json:"updatedById,omitempty"`
	UpdatedByRole  sql.NullString     `json:"updatedByRole,omitempty"`
	UpdatedByName  sql.NullString     `json:"updatedByName,omitempty"`
	CreatedAt      time.Time          `json:"createdAt"`
	UpdatedAt      time.Time          `json:"updatedAt"`
}

// MarshalJSON implements custom JSON marshaling for Design
func (d Design) MarshalJSON() ([]byte, error) {
	type Alias Design
	return json.Marshal(&struct {
		*Alias
		CustomerName *string `json:"customerName,omitempty"`
		CustomerID   *string `json:"customerId,omitempty"`
	}{
		Alias:        (*Alias)(&d),
		CustomerName: nullStringToPtr(d.CustomerName),
		CustomerID:   nullStringToPtr(d.CustomerID),
	})
}

// nullStringToPtr converts sql.NullString to *string
func nullStringToPtr(ns sql.NullString) *string {
	if ns.Valid {
		return &ns.String
	}
	return nil
}

// CreateDesignParams represents parameters for creating a design
type CreateDesignParams struct {
	JobName        string
	CustomerName   *string
	CustomerID     *string
	DesignData     DesignData
	CreatedByID    int
	CreatedByRole  string
	CreatedByName  string
}

// CreateDesign creates a new design record
func CreateDesign(params CreateDesignParams) (*Design, error) {
	// Generate design ID (format: DES-YYYYMMDD-NNNN)
	designID, err := GenerateDesignID()
	if err != nil {
		return nil, err
	}

	// Marshal design data to JSON
	designDataJSON, err := json.Marshal(params.DesignData)
	if err != nil {
		return nil, err
	}

	// Initialize empty version history and comment post
	versionHistory := []DesignVersion{}
	commentPost := CommentPost{}

	versionHistoryJSON, _ := json.Marshal(versionHistory)
	commentPostJSON, _ := json.Marshal(commentPost)

	now := time.Now()

	query := `
		INSERT INTO designs (
			design_id, job_name, customer_name, customer_id, design_status,
			current_version, design_data, version_history, comment_post,
			created_by_id, created_by_role, created_by_name, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, design_id, parent_design_id, child_number, job_name, customer_name, customer_id,
		          design_status, current_version, design_data, version_history, comment_post,
		          created_by_id, created_by_role, created_by_name, updated_by_id, updated_by_role, updated_by_name,
		          created_at, updated_at
	`

	var design Design
	err = db.QueryRow(query,
		designID,
		params.JobName,
		params.CustomerName,
		params.CustomerID,
		DesignStatusInProgress,
		1, // Initial version
		designDataJSON,
		versionHistoryJSON,
		commentPostJSON,
		params.CreatedByID,
		params.CreatedByRole,
		params.CreatedByName,
		now,
		now,
	).Scan(
		&design.ID,
		&design.DesignID,
		&design.ParentDesignID,
		&design.ChildNumber,
		&design.JobName,
		&design.CustomerName,
		&design.CustomerID,
		&design.DesignStatus,
		&design.CurrentVersion,
		&design.DesignData,
		&design.VersionHistory,
		&design.CommentPost,
		&design.CreatedByID,
		&design.CreatedByRole,
		&design.CreatedByName,
		&design.UpdatedByID,
		&design.UpdatedByRole,
		&design.UpdatedByName,
		&design.CreatedAt,
		&design.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &design, nil
}

// GenerateDesignID generates a unique design ID in format WMT-DN-00001
func GenerateDesignID() (string, error) {
	// Find the highest existing design number
	query := `
		SELECT design_id FROM designs 
		WHERE design_id LIKE 'WMT-DN-%' 
		ORDER BY CAST(SUBSTRING(design_id FROM 8) AS INTEGER) DESC 
		LIMIT 1
	`

	var lastID string
	err := db.QueryRow(query).Scan(&lastID)

	nextNum := 1
	if err == nil && lastID != "" {
		// Extract number from last ID (format: WMT-DN-00001)
		var num int
		_, scanErr := fmt.Sscanf(lastID, "WMT-DN-%d", &num)
		if scanErr == nil && num > 0 {
			nextNum = num + 1
		}
	} else if err != nil && err != sql.ErrNoRows {
		// Return error only if it's not "no rows" error
		return "", fmt.Errorf("failed to query last design ID: %w", err)
	}

	// Generate new ID with zero-padding (5 digits)
	newID := fmt.Sprintf("WMT-DN-%05d", nextNum)
	
	// Double-check that this ID doesn't exist (race condition protection)
	var exists bool
	checkQuery := `SELECT EXISTS(SELECT 1 FROM designs WHERE design_id = $1)`
	err = db.QueryRow(checkQuery, newID).Scan(&exists)
	if err != nil {
		return "", fmt.Errorf("failed to check design ID existence: %w", err)
	}
	
	if exists {
		// If ID exists, try next number
		return fmt.Sprintf("WMT-DN-%05d", nextNum+1), nil
	}

	return newID, nil
}

// GetDesignByID retrieves a design by its ID
func GetDesignByID(designID string) (*Design, error) {
	query := `
		SELECT id, design_id, parent_design_id, child_number, job_name, customer_name, customer_id,
		       design_status, current_version, design_data, version_history, comment_post,
		       created_by_id, created_by_role, created_by_name, updated_by_id, updated_by_role, updated_by_name,
		       created_at, updated_at
		FROM designs
		WHERE design_id = $1
	`

	var design Design
	err := db.QueryRow(query, designID).Scan(
		&design.ID,
		&design.DesignID,
		&design.ParentDesignID,
		&design.ChildNumber,
		&design.JobName,
		&design.CustomerName,
		&design.CustomerID,
		&design.DesignStatus,
		&design.CurrentVersion,
		&design.DesignData,
		&design.VersionHistory,
		&design.CommentPost,
		&design.CreatedByID,
		&design.CreatedByRole,
		&design.CreatedByName,
		&design.UpdatedByID,
		&design.UpdatedByRole,
		&design.UpdatedByName,
		&design.CreatedAt,
		&design.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &design, nil
}
