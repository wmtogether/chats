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
	EditedAt    sql.NullTime        `json:"editedAt"`
	CreatedAt   time.Time           `json:"createdAt"`
}
