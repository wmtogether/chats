package main

import (
	"database/sql"
	"time"
)

// Queue represents a row in the 'queue' table.
type Queue struct {
	ID             int            `json:"id"`
	QueueNo        sql.NullString `json:"queueNo"`
	JobName        string         `json:"jobName"`
	RequestType    string         `json:"requestType"`
	DimensionWidth sql.NullString `json:"dimensionWidth"`
	DimensionHeight sql.NullString `json:"dimensionHeight"`
	DimensionDepth sql.NullString `json:"dimensionDepth"`
	Dimensions     sql.NullString `json:"dimensions"`
	Layout         sql.NullString `json:"layout"`
	SampleT        sql.NullString `json:"sampleT"`
	SampleI        sql.NullString `json:"sampleI"`
	Notes          sql.NullString `json:"notes"`
	Priority       string         `json:"priority"`
	Status         string         `json:"status"`
	AssignedToID   sql.NullInt64  `json:"assignedToId"`
	AssignedToName sql.NullString `json:"assignedToName"`
	CustomerID     sql.NullString `json:"customerId"`
	CustomerName   sql.NullString `json:"customerName"`
	ChatUUID       sql.NullString `json:"chatUuid"`
	SortOrder      sql.NullInt64  `json:"sortOrder"`
	CreatedByID    sql.NullInt64  `json:"createdById"`
	CreatedByName  sql.NullString `json:"createdByName"`
	UpdatedByID    sql.NullInt64  `json:"updatedById"`
	UpdatedByName  sql.NullString `json:"updatedByName"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
}
