package main

import (
	"database/sql"
	"fmt"
	"log"
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

