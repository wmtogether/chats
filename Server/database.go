package main

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
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

// GenerateNextChatUniqueID generates the next available unique ID in format CN-DDMMYY-{NUM}
func GenerateNextChatUniqueID() (string, error) {
	// Get current date in DDMMYY format
	now := time.Now()
	dateStr := now.Format("020106") // DDMMYY format
	
	// Get the count of chats created today with this date prefix
	prefix := fmt.Sprintf("CN-%s-", dateStr)
	
	var count int
	err := db.QueryRow(`
		SELECT COUNT(*) FROM chats 
		WHERE unique_id LIKE $1
	`, prefix+"%").Scan(&count)
	if err != nil {
		return "", fmt.Errorf("error counting chats for today: %w", err)
	}
	
	// Generate next number (count + 1)
	nextNum := count + 1
	uniqueID := fmt.Sprintf("%s%d", prefix, nextNum)
	
	return uniqueID, nil
}

// GetAllChats fetches all chat channels from the database.
func GetAllChats() ([]Chat, error) {
	rows, err := db.Query(`SELECT id, uuid, unique_id, channel_id, channel_name, channel_type, chat_category, description, job_id, queue_id, customer_id, customers, status, metadata, is_archived, created_by_id, created_by_name, created_at, updated_at FROM chats ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("error querying chats: %w", err)
	}
	defer rows.Close()

	var chats []Chat
	for rows.Next() {
		var c Chat
		var uniqueID sql.NullString
		err := rows.Scan(
			&c.ID, &c.UUID, &uniqueID, &c.ChannelID, &c.ChannelName, &c.ChannelType, &c.ChatCategory,
			&c.Description, &c.JobID, &c.QueueID, &c.CustomerID, &c.Customers, &c.Status, &c.Metadata,
			&c.IsArchived, &c.CreatedByID, &c.CreatedByName, &c.CreatedAt, &c.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning chat row: %w", err)
		}
		if uniqueID.Valid {
			c.UniqueID = uniqueID.String
		}
		chats = append(chats, c)
	}
	return chats, nil
}

// GetChatByUUID fetches a single chat channel from the database by its UUID.
func GetChatByUUID(uuid string) (*Chat, error) {
	row := db.QueryRow(`SELECT id, uuid, unique_id, channel_id, channel_name, channel_type, chat_category, description, job_id, queue_id, customer_id, customers, status, metadata, is_archived, created_by_id, created_by_name, created_at, updated_at FROM chats WHERE uuid = $1 LIMIT 1`, uuid)

	var c Chat
	var uniqueID sql.NullString
	err := row.Scan(
		&c.ID, &c.UUID, &uniqueID, &c.ChannelID, &c.ChannelName, &c.ChannelType, &c.ChatCategory,
		&c.Description, &c.JobID, &c.QueueID, &c.CustomerID, &c.Customers, &c.Status, &c.Metadata,
		&c.IsArchived, &c.CreatedByID, &c.CreatedByName, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("chat not found")
		}
		return nil, fmt.Errorf("error scanning chat row: %w", err)
	}
	if uniqueID.Valid {
		c.UniqueID = uniqueID.String
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

// CreateChat creates a new chat channel in the database and optionally creates a linked queue entry
func CreateChat(params CreateChatParams) (*Chat, error) {
	// Start a transaction to ensure both chat and queue are created atomically
	tx, err := db.Begin()
	if err != nil {
		return nil, fmt.Errorf("error starting transaction: %w", err)
	}
	defer tx.Rollback() // This will be ignored if tx.Commit() succeeds

	// Generate UUID for the chat using proper UUID v4
	chatUUID := uuid.New().String()
	
	// Generate channel ID (similar format to existing chats)
	channelID := fmt.Sprintf("ch_%d_%d", params.CreatedByID, time.Now().Unix())
	
	// Generate unique ID in format CN-DDMMYY-{NUM}
	uniqueID, err := GenerateNextChatUniqueID()
	if err != nil {
		return nil, fmt.Errorf("error generating unique ID: %w", err)
	}
	
	// Create metadata JSON (will be updated with queueId after queue creation)
	metadata := map[string]interface{}{
		"queueId":       nil, // Will be updated after queue creation
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
	chatQuery := `
		INSERT INTO chats (
			uuid, unique_id, channel_id, channel_name, channel_type, chat_category,
			description, customer_id, customers, status, metadata, is_archived,
			created_by_id, created_by_name, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
		) RETURNING id, uuid, unique_id, channel_id, channel_name, channel_type, chat_category,
		description, job_id, queue_id, customer_id, customers, status, metadata,
		is_archived, created_by_id, created_by_name, created_at, updated_at
	`

	now := time.Now()
	row := tx.QueryRow(chatQuery,
		chatUUID,                    // uuid
		uniqueID,                    // unique_id
		channelID,                   // channel_id
		params.Name,                 // channel_name
		"job",                       // channel_type (default to job)
		"channel",                   // chat_category
		description,                 // description
		customerId,                  // customer_id
		customerName,                // customers
		"PENDING",                   // status (default to PENDING)
		metadataJSON,                // metadata
		0,                           // is_archived (0 = not archived)
		params.CreatedByID,          // created_by_id
		params.CreatedByName,        // created_by_name
		now,                         // created_at
		now,                         // updated_at
	)

	var chat Chat
	var uniqueIDResult sql.NullString
	err = row.Scan(
		&chat.ID, &chat.UUID, &uniqueIDResult, &chat.ChannelID, &chat.ChannelName, &chat.ChannelType, &chat.ChatCategory,
		&chat.Description, &chat.JobID, &chat.QueueID, &chat.CustomerID, &chat.Customers, &chat.Status, &chat.Metadata,
		&chat.IsArchived, &chat.CreatedByID, &chat.CreatedByName, &chat.CreatedAt, &chat.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("error creating chat: %w", err)
	}
	
	if uniqueIDResult.Valid {
		chat.UniqueID = uniqueIDResult.String
	}

	// Create a corresponding queue entry
	queueQuery := `
		INSERT INTO queue (
			job_name, request_type, priority, status, customer_id, customer_name,
			chat_uuid, created_by_id, created_by_name, updated_by_id, updated_by_name,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
		) RETURNING id
	`

	var queueID int
	err = tx.QueryRow(queueQuery,
		params.Name,                                                    // job_name
		params.RequestType,                                             // request_type
		"normal",                                                       // priority (default)
		"PENDING",                                                      // status
		customerId,                                                     // customer_id
		customerName,                                                   // customer_name
		sql.NullString{String: chatUUID, Valid: true},                // chat_uuid
		sql.NullInt64{Int64: int64(params.CreatedByID), Valid: true}, // created_by_id
		sql.NullString{String: params.CreatedByName, Valid: true},    // created_by_name
		sql.NullInt64{Int64: int64(params.CreatedByID), Valid: true}, // updated_by_id
		sql.NullString{String: params.CreatedByName, Valid: true},    // updated_by_name
		now,                                                            // created_at
		now,                                                            // updated_at
	).Scan(&queueID)
	if err != nil {
		return nil, fmt.Errorf("error creating queue entry: %w", err)
	}

	// Update the chat's queue_id and metadata with the new queue ID
	metadata["queueId"] = queueID
	updatedMetadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("error marshaling updated metadata: %w", err)
	}

	_, err = tx.Exec(`
		UPDATE chats 
		SET queue_id = $1, metadata = $2 
		WHERE uuid = $3
	`, queueID, updatedMetadataJSON, chatUUID)
	if err != nil {
		return nil, fmt.Errorf("error updating chat with queue_id: %w", err)
	}

	// Update the chat object with the queue_id
	chat.QueueID = sql.NullInt64{Int64: int64(queueID), Valid: true}
	chat.Metadata = updatedMetadataJSON

	// Commit the transaction
	err = tx.Commit()
	if err != nil {
		return nil, fmt.Errorf("error committing transaction: %w", err)
	}

	log.Printf("✅ Created chat %s (ID: %d) with linked queue entry (ID: %d)", chat.UniqueID, chat.ID, queueID)

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

// UpdateChatStatus updates the status of a chat and its linked queue entry
func UpdateChatStatus(chatUUID string, status string) (*Chat, error) {
	// Start a transaction to ensure both chat and queue are updated atomically
	tx, err := db.Begin()
	if err != nil {
		return nil, fmt.Errorf("error starting transaction: %w", err)
	}
	defer tx.Rollback()

	// Update the chat's status
	now := time.Now()
	_, err = tx.Exec(`UPDATE chats SET status = $1, updated_at = $2 WHERE uuid = $3`, status, now, chatUUID)
	if err != nil {
		return nil, fmt.Errorf("error updating chat status: %w", err)
	}

	// Also update the linked queue entry if it exists
	_, err = tx.Exec(`
		UPDATE queue 
		SET status = $1, updated_at = $2 
		WHERE chat_uuid = $3
	`, status, now, chatUUID)
	if err != nil {
		// Log the error but don't fail the transaction if queue update fails
		log.Printf("⚠️ Warning: Failed to update queue status for chat %s: %v", chatUUID, err)
	}

	// Commit the transaction
	err = tx.Commit()
	if err != nil {
		return nil, fmt.Errorf("error committing transaction: %w", err)
	}

	// Return the updated chat
	return GetChatByUUID(chatUUID)
}

// GetQueueByChatUUID fetches the queue entry linked to a chat
func GetQueueByChatUUID(chatUUID string) (*Queue, error) {
	row := db.QueryRow(`
		SELECT id, queue_no, job_name, request_type, dimension_width, dimension_height, 
		dimension_depth, dimensions, layout, sample_t, sample_i, notes, priority, status, 
		assigned_to_id, assigned_to_name, customer_id, customer_name, chat_uuid, sort_order, 
		created_by_id, created_by_name, updated_by_id, updated_by_name, created_at, updated_at 
		FROM queue 
		WHERE chat_uuid = $1 
		LIMIT 1
	`, chatUUID)

	var q Queue
	err := row.Scan(
		&q.ID, &q.QueueNo, &q.JobName, &q.RequestType,
		&q.DimensionWidth, &q.DimensionHeight, &q.DimensionDepth, &q.Dimensions,
		&q.Layout, &q.SampleT, &q.SampleI, &q.Notes,
		&q.Priority, &q.Status, &q.AssignedToID, &q.AssignedToName,
		&q.CustomerID, &q.CustomerName, &q.ChatUUID, &q.SortOrder,
		&q.CreatedByID, &q.CreatedByName, &q.UpdatedByID, &q.UpdatedByName,
		&q.CreatedAt, &q.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("queue not found for chat")
		}
		return nil, fmt.Errorf("error scanning queue row: %w", err)
	}
	return &q, nil
}

// DeleteQueueByChatUUID deletes all queue entries linked to a chat UUID
func DeleteQueueByChatUUID(chatUUID string) error {
	result, err := db.Exec(`DELETE FROM queue WHERE chat_uuid = $1`, chatUUID)
	if err != nil {
		return fmt.Errorf("error deleting queue for chat: %w", err)
	}
	
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("error getting rows affected: %w", err)
	}
	
	log.Printf("Deleted %d queue entries for chat UUID: %s", rowsAffected, chatUUID)
	return nil
}

// Customer database functions

// GetAllCustomers fetches all customers from the database.
func GetAllCustomers() ([]Customer, error) {
	rows, err := db.Query(`SELECT id, cus_id, name, created_at, updated_at FROM customers ORDER BY name ASC`)
	if err != nil {
		return nil, fmt.Errorf("error querying customers: %w", err)
	}
	defer rows.Close()

	var customers []Customer
	for rows.Next() {
		var c Customer
		err := rows.Scan(&c.ID, &c.CusID, &c.Name, &c.CreatedAt, &c.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("error scanning customer row: %w", err)
		}
		customers = append(customers, c)
	}
	return customers, nil
}

// GetCustomerByID fetches a single customer from the database by their primary key ID.
func GetCustomerByID(id int) (*Customer, error) {
	row := db.QueryRow(`SELECT id, cus_id, name, created_at, updated_at FROM customers WHERE id = $1 LIMIT 1`, id)

	var c Customer
	err := row.Scan(&c.ID, &c.CusID, &c.Name, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("customer not found")
		}
		return nil, fmt.Errorf("error scanning customer row: %w", err)
	}
	return &c, nil
}

// GetCustomerByCusID fetches a single customer from the database by their customer ID.
func GetCustomerByCusID(cusId string) (*Customer, error) {
	row := db.QueryRow(`SELECT id, cus_id, name, created_at, updated_at FROM customers WHERE cus_id = $1 LIMIT 1`, cusId)

	var c Customer
	err := row.Scan(&c.ID, &c.CusID, &c.Name, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("customer not found")
		}
		return nil, fmt.Errorf("error scanning customer row: %w", err)
	}
	return &c, nil
}

// CreateCustomer creates a new customer in the database.
func CreateCustomer(cusId string, name string) (*Customer, error) {
	// Check if customer with this cusId already exists
	existingCustomer, err := GetCustomerByCusID(cusId)
	if err == nil && existingCustomer != nil {
		return nil, fmt.Errorf("customer with ID %s already exists", cusId)
	}

	// Insert the customer into the database
	query := `
		INSERT INTO customers (cus_id, name, created_at, updated_at) 
		VALUES ($1, $2, $3, $4) 
		RETURNING id, cus_id, name, created_at, updated_at
	`

	now := time.Now()
	row := db.QueryRow(query, cusId, name, now, now)

	var customer Customer
	err = row.Scan(&customer.ID, &customer.CusID, &customer.Name, &customer.CreatedAt, &customer.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("error creating customer: %w", err)
	}

	return &customer, nil
}

// GenerateNextCustomerID generates the next available customer ID in format A001-Z999
func GenerateNextCustomerID() (string, error) {
	// Get all existing customer IDs that match the pattern
	rows, err := db.Query(`
		SELECT cus_id FROM customers 
		WHERE cus_id ~ '^[A-Z][0-9]{3}$' 
		ORDER BY cus_id DESC 
		LIMIT 1
	`)
	if err != nil {
		return "", fmt.Errorf("error querying customer IDs: %w", err)
	}
	defer rows.Close()

	// Default starting ID
	nextID := "A001"

	if rows.Next() {
		var lastID string
		err := rows.Scan(&lastID)
		if err != nil {
			return "", fmt.Errorf("error scanning last customer ID: %w", err)
		}

		// Parse the last ID
		if len(lastID) == 4 {
			letter := lastID[0]
			numberStr := lastID[1:4]
			number, err := strconv.Atoi(numberStr)
			if err != nil {
				return "", fmt.Errorf("error parsing customer ID number: %w", err)
			}

			if number < 999 {
				// Increment number
				nextID = string(letter) + fmt.Sprintf("%03d", number+1)
			} else {
				// Move to next letter
				if letter < 'Z' {
					nextLetter := letter + 1
					nextID = string(nextLetter) + "001"
				} else {
					return "", fmt.Errorf("customer ID limit reached (Z999)")
				}
			}
		}
	}

	return nextID, nil
}

// CreateCustomerWithAutoID creates a new customer with auto-generated ID
func CreateCustomerWithAutoID(name string) (*Customer, error) {
	// Generate next available customer ID
	cusId, err := GenerateNextCustomerID()
	if err != nil {
		return nil, fmt.Errorf("error generating customer ID: %w", err)
	}

	// Create the customer with the generated ID
	return CreateCustomer(cusId, name)
}

// UpdateCustomer updates a customer's information.
func UpdateCustomer(id int, cusId string, name string) (*Customer, error) {
	// Check if customer exists
	existingCustomer, err := GetCustomerByID(id)
	if err != nil {
		return nil, err
	}

	// Check if another customer already has this cusId (if it's being changed)
	if existingCustomer.CusID != cusId {
		otherCustomer, err := GetCustomerByCusID(cusId)
		if err == nil && otherCustomer != nil && otherCustomer.ID != id {
			return nil, fmt.Errorf("another customer with ID %s already exists", cusId)
		}
	}

	// Update the customer in the database
	query := `
		UPDATE customers 
		SET cus_id = $1, name = $2, updated_at = $3 
		WHERE id = $4
		RETURNING id, cus_id, name, created_at, updated_at
	`

	now := time.Now()
	row := db.QueryRow(query, cusId, name, now, id)

	var customer Customer
	err = row.Scan(&customer.ID, &customer.CusID, &customer.Name, &customer.CreatedAt, &customer.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("error updating customer: %w", err)
	}

	return &customer, nil
}

// DeleteCustomer deletes a customer from the database.
func DeleteCustomer(id int) error {
	// Check if customer exists
	_, err := GetCustomerByID(id)
	if err != nil {
		return err
	}

	// Delete the customer
	result, err := db.Exec(`DELETE FROM customers WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("error deleting customer: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("error checking rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("customer not found")
	}

	return nil
}