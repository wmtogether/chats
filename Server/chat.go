package main

import (
	"database/sql"
	"time"

	"github.com/lib/pq" // For pq.StringArray
)

// ChatType represents the enum for chat channel types.
type ChatType string
const (
	ChatTypeGlobal ChatType = "global"
	ChatTypeJob    ChatType = "job"
	ChatTypeDesign ChatType = "design"
)

// ChatCategory represents the enum for chat channel categories.
type ChatCategory string
const (
	ChatCategoryChannel      ChatCategory = "channel"
	ChatCategoryDirectMessage ChatCategory = "direct_message"
)

// Chat represents a row in the 'chats' table.
type Chat struct {
	ID            int               `json:"id"`
	UUID          string            `json:"uuid"`
	UniqueID      string            `json:"uniqueId"`      // Format: CN-DDMMYY-{NUM}
	ChannelID     string            `json:"channelId"`
	ChannelName   string            `json:"channelName"`
	ChannelType   ChatType          `json:"channelType"`
	ChatCategory  ChatCategory      `json:"chatCategory"`
	Description   sql.NullString    `json:"description"`
	JobID         sql.NullString    `json:"jobId"`
	QueueID       sql.NullInt64     `json:"queueId"`
	CustomerID    sql.NullString    `json:"customerId"`
	Customers     sql.NullString    `json:"customers"`
	Status        string            `json:"status"` // Queue status enum: PENDING, ACCEPTED, WAIT_DIMENSION, etc.
	Metadata      []byte            `json:"metadata"` // jsonb type
	IsArchived    int               `json:"isArchived"`
	CreatedByID   int               `json:"createdById"`
	CreatedByName string            `json:"createdByName"`
	CreatedAt     time.Time         `json:"createdAt"`
	UpdatedAt     time.Time         `json:"updatedAt"`
}

// ChatMessage represents a row in the 'chats_history' table.
type ChatMessage struct {
	ID          int                 `json:"id"`
	MessageID   string              `json:"messageId"`
	ChannelID   string              `json:"channelId"`
	Content     string              `json:"content"`
	UserID      int                 `json:"userId"`
	UserName    string              `json:"userName"`
	UserRole    string              `json:"userRole"` // Based on userRoleEnum
	Attachments FlexibleStringArray `json:"attachments"` // Can handle both JSONB and PostgreSQL arrays
	Tags        pq.StringArray      `json:"tags"`        // jsonb type, represent as []string
	Status      sql.NullString      `json:"status"`
	Reactions   []byte              `json:"reactions"` // jsonb type
	CustomerID  sql.NullString      `json:"customerId"`
	Customers   sql.NullString      `json:"customers"`
	IsEdited    int                 `json:"isEdited"`    // 0 = not edited, 1 = edited
	EditedAt    sql.NullTime        `json:"editedAt"`
	CreatedAt   time.Time           `json:"createdAt"`
}

// GetChatByID retrieves a chat by its ID
func GetChatByID(chatID int) (*Chat, error) {
	query := `
		SELECT 
			id, uuid, unique_id, channel_id, channel_name, channel_type, 
			chat_category, description, job_id, queue_id, customer_id, 
			customers, status, metadata, is_archived, created_by_id, 
			created_by_name, created_at, updated_at
		FROM chats
		WHERE id = $1
	`

	var chat Chat
	err := db.QueryRow(query, chatID).Scan(
		&chat.ID,
		&chat.UUID,
		&chat.UniqueID,
		&chat.ChannelID,
		&chat.ChannelName,
		&chat.ChannelType,
		&chat.ChatCategory,
		&chat.Description,
		&chat.JobID,
		&chat.QueueID,
		&chat.CustomerID,
		&chat.Customers,
		&chat.Status,
		&chat.Metadata,
		&chat.IsArchived,
		&chat.CreatedByID,
		&chat.CreatedByName,
		&chat.CreatedAt,
		&chat.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, err
		}
		return nil, err
	}

	return &chat, nil
}
