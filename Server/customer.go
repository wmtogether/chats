package main

import (
	"time"
)

// Customer represents a row in the 'customers' table.
type Customer struct {
	ID        int       `json:"id"`
	CusID     string    `json:"cusId"`     // Customer ID from jobs
	Name      string    `json:"name"`      // Customer name
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}