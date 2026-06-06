package api

import (
	"context"
	"encoding/json"
	"net/http"

	"task-queue-go/models"
	"task-queue-go/queue"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SubTaskDef defines a sub-task type and its target queue
type SubTaskDef struct {
	Type      string
	QueueName string
}

// eventRegistry maps root event names to their sub-task definitions
var eventRegistry = map[string][]SubTaskDef{
	"PLACE_ORDER": {
		{Type: "send_order_sms", QueueName: "queue:ecommerce:sms"},
		{Type: "send_order_email", QueueName: "queue:ecommerce:email"},
		{Type: "notify_restaurant", QueueName: "queue:ecommerce:restaurant"},
		{Type: "match_delivery_partner_gps", QueueName: "queue:ecommerce:gps"},
	},
	"SUBMIT_KYC": {
		{Type: "verify_pan_card", QueueName: "queue:fintech:pan"},
		{Type: "run_aml_check", QueueName: "queue:fintech:aml"},
		{Type: "compute_risk_score", QueueName: "queue:fintech:risk"},
	},
	"BULK_USER_IMPORT": {
		{Type: "parse_csv_file", QueueName: "queue:saas:csv"},
		{Type: "provision_iam_identity", QueueName: "queue:saas:iam"},
		{Type: "generate_invite_tokens", QueueName: "queue:saas:tokens"},
	},
}

type TriggerEventRequest struct {
	Event   string          `json:"event" binding:"required"`
	Payload json.RawMessage `json:"payload"`
}

// TriggerEvent handles POST /api/events
func TriggerEvent(db *gorm.DB, rdb *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req TriggerEventRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
			return
		}

		subTaskDefs, exists := eventRegistry[req.Event]
		if !exists {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown event type: " + req.Event})
			return
		}

		// Convert Payload to clean string representation
		var payloadStr string
		if len(req.Payload) > 0 {
			if req.Payload[0] == '"' && req.Payload[len(req.Payload)-1] == '"' {
				var s string
				if err := json.Unmarshal(req.Payload, &s); err == nil {
					payloadStr = s
				} else {
					payloadStr = string(req.Payload)
				}
			} else {
				payloadStr = string(req.Payload)
			}
		}

		groupID := uuid.New().String()
		var tasks []models.Task

		// Create all sub-tasks in a single DB transaction
		err := db.Transaction(func(tx *gorm.DB) error {
			for _, def := range subTaskDefs {
				task := models.Task{
					ID:        uuid.New().String(),
					RootEvent: req.Event,
					GroupID:   groupID,
					Type:      def.Type,
					QueueName: def.QueueName,
					Payload:   payloadStr,
					Status:    "pending",
					Retries:   0,
					MaxRetry:  3,
				}
				if err := tx.Create(&task).Error; err != nil {
					return err
				}
				tasks = append(tasks, task)
			}
			return nil
		})

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create tasks: " + err.Error()})
			return
		}

		// After DB commit, push each task to its designated Redis queue
		ctx := context.Background()
		for _, task := range tasks {
			if err := queue.PushTask(ctx, rdb, task.QueueName, task.ID); err != nil {
				// Log but don't fail the request - tasks are in DB and can be recovered
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to enqueue task " + task.ID + ": " + err.Error()})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"group_id": groupID,
			"event":    req.Event,
			"tasks":    tasks,
			"count":    len(tasks),
		})
	}
}

// GetTasks handles GET /api/tasks
func GetTasks(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tasks []models.Task
		query := db.Order("created_at DESC")

		if status := c.Query("status"); status != "" {
			query = query.Where("status = ?", status)
		}
		if rootEvent := c.Query("root_event"); rootEvent != "" {
			query = query.Where("root_event = ?", rootEvent)
		}
		if groupID := c.Query("group_id"); groupID != "" {
			query = query.Where("group_id = ?", groupID)
		}

		if err := query.Find(&tasks).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tasks: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, tasks)
	}
}

// GetStats handles GET /api/stats
func GetStats(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var stats models.Stats

		db.Model(&models.Task{}).Count(&stats.Total)
		db.Model(&models.Task{}).Where("status = ?", "pending").Count(&stats.Pending)
		db.Model(&models.Task{}).Where("status = ?", "running").Count(&stats.Running)
		db.Model(&models.Task{}).Where("status = ?", "done").Count(&stats.Done)
		db.Model(&models.Task{}).Where("status = ?", "failed").Count(&stats.Failed)

		c.JSON(http.StatusOK, stats)
	}
}
