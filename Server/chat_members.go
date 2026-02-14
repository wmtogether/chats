package main

import (
	"database/sql"
	"fmt"
	"log"
	"time"
)

// ChatMember represents a user's membership in a chat
type ChatMember struct {
	ID       int       `json:"id"`
	ChatID   int       `json:"chatId"`
	UserID   int       `json:"userId"`
	JoinedAt time.Time `json:"joinedAt"`
}

// ChatMemberWithUser includes user details
type ChatMemberWithUser struct {
	ID       int       `json:"id"`
	ChatID   int       `json:"chatId"`
	UserID   int       `json:"userId"`
	UserName string    `json:"userName"`
	UserRole string    `json:"userRole"`
	JoinedAt time.Time `json:"joinedAt"`
}

// JoinChat adds a user to a chat
func JoinChat(chatID int, userID int) error {
	query := `
		INSERT INTO chat_members (chat_id, user_id, joined_at)
		VALUES ($1, $2, CURRENT_TIMESTAMP)
		ON CONFLICT (chat_id, user_id) DO NOTHING
	`

	_, err := db.Exec(query, chatID, userID)
	if err != nil {
		log.Printf("Error joining chat: %v", err)
		return fmt.Errorf("failed to join chat: %w", err)
	}

	log.Printf("✅ User %d joined chat %d", userID, chatID)
	return nil
}

// LeaveChat removes a user from a chat
func LeaveChat(chatID int, userID int) error {
	query := `
		DELETE FROM chat_members
		WHERE chat_id = $1 AND user_id = $2
	`

	result, err := db.Exec(query, chatID, userID)
	if err != nil {
		log.Printf("Error leaving chat: %v", err)
		return fmt.Errorf("failed to leave chat: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("user is not a member of this chat")
	}

	log.Printf("👋 User %d left chat %d", userID, chatID)
	return nil
}

// IsChatMember checks if a user is a member of a chat
func IsChatMember(chatID int, userID int) (bool, error) {
	// First check if user is the creator (creators are always members)
	var creatorID int
	err := db.QueryRow(`SELECT created_by_id FROM chats WHERE id = $1`, chatID).Scan(&creatorID)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, fmt.Errorf("chat not found")
		}
		return false, err
	}

	if creatorID == userID {
		return true, nil
	}

	// Check if user has explicitly joined
	var exists bool
	query := `
		SELECT EXISTS(
			SELECT 1 FROM chat_members
			WHERE chat_id = $1 AND user_id = $2
		)
	`

	err = db.QueryRow(query, chatID, userID).Scan(&exists)
	if err != nil {
		log.Printf("Error checking chat membership: %v", err)
		return false, err
	}

	return exists, nil
}

// GetChatMembers retrieves all members of a chat with user details
func GetChatMembers(chatID int) ([]ChatMemberWithUser, error) {
	query := `
		SELECT 
			cm.id,
			cm.chat_id,
			cm.user_id,
			u.name as user_name,
			u.role as user_role,
			cm.joined_at
		FROM chat_members cm
		JOIN users u ON cm.user_id = u.id
		WHERE cm.chat_id = $1
		ORDER BY cm.joined_at DESC
	`

	rows, err := db.Query(query, chatID)
	if err != nil {
		log.Printf("Error getting chat members: %v", err)
		return nil, err
	}
	defer rows.Close()

	var members []ChatMemberWithUser
	for rows.Next() {
		var member ChatMemberWithUser
		err := rows.Scan(
			&member.ID,
			&member.ChatID,
			&member.UserID,
			&member.UserName,
			&member.UserRole,
			&member.JoinedAt,
		)
		if err != nil {
			log.Printf("Error scanning chat member: %v", err)
			continue
		}
		members = append(members, member)
	}

	return members, nil
}

// GetUserJoinedChats retrieves all chats a user has joined (not created)
func GetUserJoinedChats(userID int) ([]int, error) {
	query := `
		SELECT chat_id
		FROM chat_members
		WHERE user_id = $1
		ORDER BY joined_at DESC
	`

	rows, err := db.Query(query, userID)
	if err != nil {
		log.Printf("Error getting user joined chats: %v", err)
		return nil, err
	}
	defer rows.Close()

	var chatIDs []int
	for rows.Next() {
		var chatID int
		if err := rows.Scan(&chatID); err != nil {
			log.Printf("Error scanning chat ID: %v", err)
			continue
		}
		chatIDs = append(chatIDs, chatID)
	}

	return chatIDs, nil
}

// GetChatMemberCount returns the number of members in a chat
func GetChatMemberCount(chatID int) (int, error) {
	var count int
	query := `
		SELECT COUNT(*) FROM chat_members
		WHERE chat_id = $1
	`

	err := db.QueryRow(query, chatID).Scan(&count)
	if err != nil {
		log.Printf("Error getting chat member count: %v", err)
		return 0, err
	}

	// Add 1 for the creator (who is always a member)
	return count + 1, nil
}

// RemoveAllChatMembers removes all members from a chat (used when deleting a chat)
func RemoveAllChatMembers(chatID int) error {
	query := `DELETE FROM chat_members WHERE chat_id = $1`

	_, err := db.Exec(query, chatID)
	if err != nil {
		log.Printf("Error removing all chat members: %v", err)
		return err
	}

	log.Printf("🗑️ Removed all members from chat %d", chatID)
	return nil
}
