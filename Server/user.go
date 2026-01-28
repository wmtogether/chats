package main

import "database/sql"

// User represents a row in the 'users' table.
type User struct {
	ID             int            `json:"id"`
	UID            string         `json:"uid"`
	Name           string         `json:"name"`
	Nickname       sql.NullString `json:"nickname"`
	ProfilePicture sql.NullString `json:"profilePicture"`
	Password       sql.NullString `json:"-"` // Omit from JSON responses
	Role           string         `json:"role"`
}
