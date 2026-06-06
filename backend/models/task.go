package models

import "time"

type Task struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	RootEvent string    `json:"root_event" gorm:"size:50;index"`
	GroupID   string    `json:"group_id" gorm:"size:50;index"`
	Type      string    `json:"type" gorm:"size:50"`
	QueueName string    `json:"queue_name" gorm:"size:100"`
	Payload   string    `json:"payload" gorm:"type:text"`
	Status    string    `json:"status" gorm:"size:20;default:pending"`
	Retries   int       `json:"retries" gorm:"default:0"`
	MaxRetry  int       `json:"max_retry" gorm:"default:3"`
	ErrorMsg  string    `json:"error_msg" gorm:"type:text"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Stats struct {
	Total   int64 `json:"total"`
	Pending int64 `json:"pending"`
	Running int64 `json:"running"`
	Done    int64 `json:"done"`
	Failed  int64 `json:"failed"`
}
