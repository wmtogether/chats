package main

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/lib/pq" // PostgreSQL driver
)

var _ pq.NullTime // Dummy reference to satisfy compiler "imported and not used" for pq

var db *sql.DB

// InitDB initializes the database connection.
func InitDB(dataSourceName string) {
	var err error
	db, err = sql.Open("postgres", dataSourceName)
	if err != nil {
		log.Fatalf("Error opening database: %v", err)
	}

	if err = db.Ping(); err != nil {
		log.Fatalf("Error connecting to the database: %v", err)
	}

	fmt.Println("Successfully connected to PostgreSQL!")
}

// GetAllQueues fetches all queue items from the database.
func GetAllQueues() ([]Queue, error) {
	rows, err := db.Query(`SELECT id, queue_no, job_name, request_type, dimension_width, dimension_height, dimension_depth, dimensions, layout, sample_t, sample_i, notes, priority, status, assigned_to_id, assigned_to_name, customer_id, customer_name, chat_uuid, sort_order, created_by_id, created_by_name, updated_by_id, updated_by_name, created_at, updated_at FROM queue ORDER BY sort_order ASC, created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("error querying queues: %w", err)
	}
	defer rows.Close()

	var queues []Queue
	for rows.Next() {
		var q Queue
		err := rows.Scan(
			&q.ID, &q.QueueNo, &q.JobName, &q.RequestType,
			&q.DimensionWidth, &q.DimensionHeight, &q.DimensionDepth, &q.Dimensions,
			&q.Layout, &q.SampleT, &q.SampleI, &q.Notes,
			&q.Priority, &q.Status, &q.AssignedToID, &q.AssignedToName,
			&q.CustomerID, &q.CustomerName, &q.ChatUUID, &q.SortOrder,
			&q.CreatedByID, &q.CreatedByName, &q.UpdatedByID, &q.UpdatedByName,
			&q.CreatedAt, &q.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning queue row: %w", err)
		}
		queues = append(queues, q)
	}

	return queues, nil
}

// InsertQueue inserts a new queue item into the database.
func InsertQueue(q Queue) (Queue, error) {
	// For simplicity, we'll only insert essential fields for now and let the DB handle defaults
	// In a real app, you'd handle all fields and potentially retrieve the generated ID.
	query := `INSERT INTO queue (job_name, request_type, priority, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at, updated_at`
	
	var insertedID int
	var createdAt, updatedAt time.Time

	err := db.QueryRow(query, q.JobName, q.RequestType, q.Priority, q.Status, q.CreatedAt, q.UpdatedAt).Scan(&insertedID, &createdAt, &updatedAt)
	if err != nil {
		return Queue{}, fmt.Errorf("error inserting queue: %w", err)
	}

	q.ID = insertedID
	q.CreatedAt = createdAt
	q.UpdatedAt = updatedAt

	return q, nil
}

// GetUserByUID fetches a single user from the database by their UID.
func GetUserByUID(uid string) (*User, error) {
	row := db.QueryRow(`SELECT id, uid, name, nickname, profile_picture, password, role FROM users WHERE uid = $1 LIMIT 1`, uid)

	var u User
	err := row.Scan(&u.ID, &u.UID, &u.Name, &u.Nickname, &u.ProfilePicture, &u.Password, &u.Role)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("error scanning user row: %w", err)
	}
	return &u, nil
}

// GetUserByID fetches a single user from the database by their primary key ID.
func GetUserByID(id int) (*User, error) {
	row := db.QueryRow(`SELECT id, uid, name, nickname, profile_picture, password, role FROM users WHERE id = $1 LIMIT 1`, id)

	var u User
	err := row.Scan(&u.ID, &u.UID, &u.Name, &u.Nickname, &u.ProfilePicture, &u.Password, &u.Role)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("error scanning user row: %w", err)
	}
	return &u, nil
}

// GetAllUsers fetches all users from the database.
func GetAllUsers() ([]User, error) {
	rows, err := db.Query(`SELECT id, uid, name, nickname, profile_picture, role FROM users ORDER BY name ASC`)
	if err != nil {
		return nil, fmt.Errorf("error querying users: %w", err)
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		// Note: We are not scanning the password here for security reasons.
		err := rows.Scan(&u.ID, &u.UID, &u.Name, &u.Nickname, &u.ProfilePicture, &u.Role)
		if err != nil {
			return nil, fmt.Errorf("error scanning user row: %w", err)
		}
		users = append(users, u)
	}
	return users, nil
}

// GetAllChats fetches all chat channels from the database.
func GetAllChats() ([]Chat, error) {
	rows, err := db.Query(`SELECT id, uuid, channel_id, channel_name, channel_type, chat_category, description, job_id, queue_id, customer_id, customers, metadata, is_archived, created_by_id, created_by_name, created_at, updated_at FROM chats ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("error querying chats: %w", err)
	}
	defer rows.Close()

	var chats []Chat
	for rows.Next() {
		var c Chat
		err := rows.Scan(
			&c.ID, &c.UUID, &c.ChannelID, &c.ChannelName, &c.ChannelType, &c.ChatCategory,
			&c.Description, &c.JobID, &c.QueueID, &c.CustomerID, &c.Customers, &c.Metadata,
			&c.IsArchived, &c.CreatedByID, &c.CreatedByName, &c.CreatedAt, &c.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning chat row: %w", err)
		}
		chats = append(chats, c)
	}
	return chats, nil
}

// GetChatByUUID fetches a single chat channel from the database by its UUID.
func GetChatByUUID(uuid string) (*Chat, error) {
	row := db.QueryRow(`SELECT id, uuid, channel_id, channel_name, channel_type, chat_category, description, job_id, queue_id, customer_id, customers, metadata, is_archived, created_by_id, created_by_name, created_at, updated_at FROM chats WHERE uuid = $1 LIMIT 1`, uuid)

	var c Chat
	err := row.Scan(
		&c.ID, &c.UUID, &c.ChannelID, &c.ChannelName, &c.ChannelType, &c.ChatCategory,
		&c.Description, &c.JobID, &c.QueueID, &c.CustomerID, &c.Customers, &c.Metadata,
		&c.IsArchived, &c.CreatedByID, &c.CreatedByName, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("chat not found")
		}
		return nil, fmt.Errorf("error scanning chat row: %w", err)
	}
	return &c, nil
}

// GetMessagesByChannelID fetches messages for a given channel ID.
func GetMessagesByChannelID(channelID string) ([]ChatMessage, error) {
	rows, err := db.Query(`SELECT id, message_id, channel_id, content, user_id, user_name, user_role, attachments, tags, status, reactions, customer_id, customers, edited_at, created_at FROM chats_history WHERE channel_id = $1 ORDER BY created_at ASC`, channelID)
	if err != nil {
		return nil, fmt.Errorf("error querying messages: %w", err)
	}
	defer rows.Close()

	var messages []ChatMessage
	for rows.Next() {
		var m ChatMessage
		err := rows.Scan(
			&m.ID, &m.MessageID, &m.ChannelID, &m.Content, &m.UserID, &m.UserName, &m.UserRole,
			&m.Attachments, &m.Tags, &m.Status, &m.Reactions, &m.CustomerID, &m.Customers, &m.EditedAt, &m.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning message row: %w", err)
		}
		messages = append(messages, m)
	}
	return messages, nil
}

// DeleteChatByUUID deletes a chat channel and its associated messages by UUID.
func DeleteChatByUUID(uuid string) error {
	// Start a transaction to ensure both chat and messages are deleted atomically
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("error starting transaction: %w", err)
	}
	defer tx.Rollback() // This will be ignored if tx.Commit() succeeds

	// First, get the channel_id for the chat
	var channelID string
	err = tx.QueryRow(`SELECT channel_id FROM chats WHERE uuid = $1`, uuid).Scan(&channelID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("chat not found")
		}
		return fmt.Errorf("error fetching chat channel_id: %w", err)
	}

	// Delete all messages associated with this chat
	_, err = tx.Exec(`DELETE FROM chats_history WHERE channel_id = $1`, channelID)
	if err != nil {
		return fmt.Errorf("error deleting chat messages: %w", err)
	}

	// Delete the chat itself
	result, err := tx.Exec(`DELETE FROM chats WHERE uuid = $1`, uuid)
	if err != nil {
		return fmt.Errorf("error deleting chat: %w", err)
	}

	// Check if any rows were affected
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("error checking rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("chat not found")
	}

	// Commit the transaction
	err = tx.Commit()
	if err != nil {
		return fmt.Errorf("error committing transaction: %w", err)
	}

	return nil
}

// CreateChatParams represents the parameters for creating a new chat
type CreateChatParams struct {
	Name         string
	RequestType  string
	CustomerId   string
	CustomerName string
	Description  string
	CreatedByID  int
	CreatedByName string
}

// FlexibleStringArray is a custom type that can handle both JSONB arrays and PostgreSQL arrays
type FlexibleStringArray []string

// Scan implements the sql.Scanner interface
func (fsa *FlexibleStringArray) Scan(value interface{}) error {
	if value == nil {
		*fsa = nil
		return nil
	}

	switch v := value.(type) {
	case []byte:
		str := string(v)
		// Check if it's a JSONB array (starts with '[')
		if strings.HasPrefix(str, "[") && strings.HasSuffix(str, "]") {
			// Parse as JSON array
			var jsonArray []string
			if err := json.Unmarshal(v, &jsonArray); err != nil {
				return fmt.Errorf("error parsing JSONB array: %w", err)
			}
			*fsa = FlexibleStringArray(jsonArray)
			return nil
		}
		// Otherwise, try to parse as PostgreSQL array
		var pgArray pq.StringArray
		if err := pgArray.Scan(value); err != nil {
			return fmt.Errorf("error parsing PostgreSQL array: %w", err)
		}
		*fsa = FlexibleStringArray(pgArray)
		return nil
	case string:
		str := v
		// Check if it's a JSONB array (starts with '[')
		if strings.HasPrefix(str, "[") && strings.HasSuffix(str, "]") {
			// Parse as JSON array
			var jsonArray []string
			if err := json.Unmarshal([]byte(str), &jsonArray); err != nil {
				return fmt.Errorf("error parsing JSONB array: %w", err)
			}
			*fsa = FlexibleStringArray(jsonArray)
			return nil
		}
		// Otherwise, try to parse as PostgreSQL array
		var pgArray pq.StringArray
		if err := pgArray.Scan(value); err != nil {
			return fmt.Errorf("error parsing PostgreSQL array: %w", err)
		}
		*fsa = FlexibleStringArray(pgArray)
		return nil
	default:
		// Try to use pq.StringArray as fallback
		var pgArray pq.StringArray
		if err := pgArray.Scan(value); err != nil {
			return fmt.Errorf("error parsing as PostgreSQL array: %w", err)
		}
		*fsa = FlexibleStringArray(pgArray)
		return nil
	}
}

// Value implements the driver.Valuer interface
func (fsa FlexibleStringArray) Value() (driver.Value, error) {
	if fsa == nil {
		return nil, nil
	}
	// Store as JSON for JSONB columns
	jsonData, err := json.Marshal([]string(fsa))
	if err != nil {
		return nil, fmt.Errorf("error marshaling to JSON: %w", err)
	}
	log.Printf("FlexibleStringArray.Value(): Converting %v to JSON: %s", []string(fsa), string(jsonData))
	return string(jsonData), nil
}
type CreateMessageParams struct {
	ChannelID   string
	Content     string
	UserID      int
	UserName    string
	UserRole    string
	Attachments []string
	ReplyTo     *struct {
		MessageID string `json:"messageId"`
		UserName  string `json:"userName"`
		Content   string `json:"content"`
	}
}

// CreateMessage creates a new message in the database
func CreateMessage(params CreateMessageParams) (*ChatMessage, error) {
	// Generate message ID
	messageID := fmt.Sprintf("msg_%d_%d", params.UserID, time.Now().UnixNano())
	
	// Convert attachments to FlexibleStringArray
	var attachments FlexibleStringArray
	if len(params.Attachments) > 0 {
		attachments = FlexibleStringArray(params.Attachments)
		log.Printf("CreateMessage: Converting attachments %v to FlexibleStringArray", params.Attachments)
	}

	// Note: Reply-to functionality will be added when database schema supports it

	// Insert the message into the database
	query := `
		INSERT INTO chats_history (
			message_id, channel_id, content, user_id, user_name, user_role,
			attachments, status, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9
		) RETURNING id, message_id, channel_id, content, user_id, user_name, user_role,
		attachments, tags, status, reactions, customer_id, customers, edited_at, created_at
	`

	now := time.Now()
	
	// Log the values being inserted
	log.Printf("CreateMessage: Inserting message with attachments: %v", attachments)
	
	row := db.QueryRow(query,
		messageID,           // message_id
		params.ChannelID,    // channel_id
		params.Content,      // content
		params.UserID,       // user_id
		params.UserName,     // user_name
		params.UserRole,     // user_role
		attachments,         // attachments (FlexibleStringArray -> JSON)
		"sent",              // status
		now,                 // created_at
	)

	var message ChatMessage
	err := row.Scan(
		&message.ID, &message.MessageID, &message.ChannelID, &message.Content,
		&message.UserID, &message.UserName, &message.UserRole, &message.Attachments,
		&message.Tags, &message.Status, &message.Reactions, &message.CustomerID,
		&message.Customers, &message.EditedAt, &message.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("error creating message: %w", err)
	}

	return &message, nil
}

// GetMessageByID fetches a single message by its message_id
func GetMessageByID(messageID string) (*ChatMessage, error) {
	row := db.QueryRow(`
		SELECT id, message_id, channel_id, content, user_id, user_name, user_role,
		attachments, tags, status, reactions, customer_id, customers, edited_at, created_at
		FROM chats_history WHERE message_id = $1 LIMIT 1
	`, messageID)

	var message ChatMessage
	err := row.Scan(
		&message.ID, &message.MessageID, &message.ChannelID, &message.Content,
		&message.UserID, &message.UserName, &message.UserRole, &message.Attachments,
		&message.Tags, &message.Status, &message.Reactions, &message.CustomerID,
		&message.Customers, &message.EditedAt, &message.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("message not found")
		}
		return nil, fmt.Errorf("error scanning message row: %w", err)
	}
	return &message, nil
}

// DeleteMessageByID deletes a message by its message_id
func DeleteMessageByID(messageID string) error {
	result, err := db.Exec(`DELETE FROM chats_history WHERE message_id = $1`, messageID)
	if err != nil {
		return fmt.Errorf("error deleting message: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("error checking rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("message not found")
	}

	return nil
}

// UpdateMessage updates a message's content and attachments
func UpdateMessage(messageID string, content string, attachments []string) (*ChatMessage, error) {
	// Convert attachments to FlexibleStringArray
	var attachmentsArray FlexibleStringArray
	if len(attachments) > 0 {
		attachmentsArray = FlexibleStringArray(attachments)
	}

	// Update the message
	now := time.Now()
	_, err := db.Exec(`
		UPDATE chats_history 
		SET content = $1, attachments = $2, edited_at = $3
		WHERE message_id = $4
	`, content, attachmentsArray, now, messageID)
	if err != nil {
		return nil, fmt.Errorf("error updating message: %w", err)
	}

	// Return the updated message
	return GetMessageByID(messageID)
}

// CreateChat creates a new chat channel in the database
func CreateChat(params CreateChatParams) (*Chat, error) {
	// Generate UUID for the chat
	chatUUID := fmt.Sprintf("%d_%s_%d", params.CreatedByID, params.Name, time.Now().Unix())
	
	// Generate channel ID (similar format to existing chats)
	channelID := fmt.Sprintf("ch_%d_%d", params.CreatedByID, time.Now().Unix())
	
	// Create metadata JSON
	metadata := map[string]interface{}{
		"queueId":       nil,
		"queueStatus":   "PENDING",
		"requestType":   params.RequestType,
		"createdByName": params.CreatedByName,
	}
	
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("error marshaling metadata: %w", err)
	}

	// Prepare SQL values
	var customerId, customerName, description sql.NullString
	
	if params.CustomerId != "" {
		customerId = sql.NullString{String: params.CustomerId, Valid: true}
	}
	if params.CustomerName != "" {
		customerName = sql.NullString{String: params.CustomerName, Valid: true}
	}
	if params.Description != "" {
		description = sql.NullString{String: params.Description, Valid: true}
	}

	// Insert the chat into the database
	query := `
		INSERT INTO chats (
			uuid, channel_id, channel_name, channel_type, chat_category,
			description, customer_id, customers, metadata, is_archived,
			created_by_id, created_by_name, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
		) RETURNING id, uuid, channel_id, channel_name, channel_type, chat_category,
		description, job_id, queue_id, customer_id, customers, metadata,
		is_archived, created_by_id, created_by_name, created_at, updated_at
	`

	now := time.Now()
	row := db.QueryRow(query,
		chatUUID,                    // uuid
		channelID,                   // channel_id
		params.Name,                 // channel_name
		"job",                       // channel_type (default to job)
		"channel",                   // chat_category
		description,                 // description
		customerId,                  // customer_id
		customerName,                // customers
		metadataJSON,                // metadata
		0,                           // is_archived (0 = not archived)
		params.CreatedByID,          // created_by_id
		params.CreatedByName,        // created_by_name
		now,                         // created_at
		now,                         // updated_at
	)

	var chat Chat
	err = row.Scan(
		&chat.ID, &chat.UUID, &chat.ChannelID, &chat.ChannelName, &chat.ChannelType, &chat.ChatCategory,
		&chat.Description, &chat.JobID, &chat.QueueID, &chat.CustomerID, &chat.Customers, &chat.Metadata,
		&chat.IsArchived, &chat.CreatedByID, &chat.CreatedByName, &chat.CreatedAt, &chat.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("error creating chat: %w", err)
	}

	return &chat, nil
}

// UpdateChatRequestType updates the request type of a chat and its metadata
func UpdateChatRequestType(chatUUID string, requestType string) (*Chat, error) {
	// First, get the current chat to preserve other metadata
	chat, err := GetChatByUUID(chatUUID)
	if err != nil {
		return nil, err
	}

	// Parse existing metadata
	var metadata map[string]interface{}
	if err := json.Unmarshal([]byte(chat.Metadata), &metadata); err != nil {
		// If parsing fails, create new metadata
		metadata = make(map[string]interface{})
	}

	// Update the request type in metadata
	metadata["requestType"] = requestType

	// Marshal updated metadata
	updatedMetadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("error marshaling updated metadata: %w", err)
	}

	// Update the chat in the database
	now := time.Now()
	_, err = db.Exec(`
		UPDATE chats 
		SET metadata = $1, updated_at = $2
		WHERE uuid = $3
	`, updatedMetadataJSON, now, chatUUID)
	if err != nil {
		return nil, fmt.Errorf("error updating chat request type: %w", err)
	}

	// Return the updated chat
	return GetChatByUUID(chatUUID)
}