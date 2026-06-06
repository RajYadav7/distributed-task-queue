package workers

import (
	"context"
	"fmt"
	"log"
	"math"
	"math/rand"
	"time"

	"task-queue-go/models"
	"task-queue-go/queue"

	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"
)

// WorkerConfig defines the configuration for a worker pool
type WorkerConfig struct {
	QueueName   string
	WorkerCount int
	ProcessTime time.Duration
	FailureRate float64
	Label       string
}

// StartWorkerPool launches a pool of workers for a given queue
func StartWorkerPool(ctx context.Context, db *gorm.DB, rdb *redis.Client, cfg WorkerConfig) {
	for i := 1; i <= cfg.WorkerCount; i++ {
		go runWorker(ctx, db, rdb, cfg, i)
	}
}

func runWorker(ctx context.Context, db *gorm.DB, rdb *redis.Client, cfg WorkerConfig, workerNum int) {
	label := fmt.Sprintf("%s Worker-%d", cfg.Label, workerNum)
	log.Printf("[%s] Started on queue: %s", label, cfg.QueueName)

	for {
		select {
		case <-ctx.Done():
			log.Printf("[%s] Shutting down", label)
			return
		default:
		}

		// BRPOP blocks until a task is available (timeout 0 = block forever)
		result, err := rdb.BRPop(ctx, 0, cfg.QueueName).Result()
		if err != nil {
			if ctx.Err() != nil {
				log.Printf("[%s] Context cancelled, shutting down", label)
				return
			}
			log.Printf("[%s] BRPOP error: %v", label, err)
			time.Sleep(1 * time.Second)
			continue
		}

		// result[0] is the queue name, result[1] is the task ID
		taskID := result[1]
		log.Printf("[%s] Picked up task: %s", label, taskID)

		// Find task in MySQL
		var task models.Task
		if err := db.First(&task, "id = ?", taskID).Error; err != nil {
			log.Printf("[%s] Task not found: %s - %v", label, taskID, err)
			continue
		}

		// Update status to "running"
		db.Model(&task).Update("status", "running")
		log.Printf("[%s] Processing task: %s (type: %s)", label, taskID, task.Type)

		// Simulate work
		time.Sleep(cfg.ProcessTime)

		// Random failure based on failure rate
		if rand.Float64() < cfg.FailureRate {
			// Task failed
			task.Retries++
			if task.Retries < task.MaxRetry {
				// Exponential backoff: 5s * 2^(retries-1)
				backoff := time.Duration(5*math.Pow(2, float64(task.Retries-1))) * time.Second
				log.Printf("[%s] ❌ Task %s FAILED (attempt %d/%d), retrying in %v",
					label, taskID, task.Retries, task.MaxRetry, backoff)

				db.Model(&task).Updates(map[string]interface{}{
					"status":  "pending",
					"retries": task.Retries,
				})

				// Re-push to queue after backoff in a goroutine
				go func(queueName, id string, delay time.Duration) {
					time.Sleep(delay)
					if err := queue.PushTask(context.Background(), rdb, queueName, id); err != nil {
						log.Printf("[%s] Failed to re-push task %s: %v", label, id, err)
					}
				}(task.QueueName, taskID, backoff)
			} else {
				// Max retries exceeded
				log.Printf("[%s] ❌ Task %s PERMANENTLY FAILED after %d retries",
					label, taskID, task.Retries)
				db.Model(&task).Updates(map[string]interface{}{
					"status":    "failed",
					"retries":   task.Retries,
					"error_msg": fmt.Sprintf("Max retries (%d) exceeded", task.MaxRetry),
				})
			}
		} else {
			// Task succeeded
			log.Printf("[%s] ✅ Task %s DONE", label, taskID)
			db.Model(&task).Update("status", "done")
		}
	}
}

// GetAllWorkerConfigs returns the configuration for all worker pools
func GetAllWorkerConfigs() []WorkerConfig {
	return []WorkerConfig{
		// E-Commerce / Food Tech
		{QueueName: "queue:ecommerce:sms", WorkerCount: 2, ProcessTime: 1 * time.Second, FailureRate: 0.05, Label: "📱 SMS"},
		{QueueName: "queue:ecommerce:email", WorkerCount: 2, ProcessTime: 2 * time.Second, FailureRate: 0.05, Label: "📧 Email"},
		{QueueName: "queue:ecommerce:restaurant", WorkerCount: 2, ProcessTime: 2 * time.Second, FailureRate: 0.08, Label: "🍔 Restaurant"},
		{QueueName: "queue:ecommerce:gps", WorkerCount: 3, ProcessTime: 3 * time.Second, FailureRate: 0.10, Label: "📍 GPS Match"},
		// FinTech / Compliance
		{QueueName: "queue:fintech:pan", WorkerCount: 2, ProcessTime: 3 * time.Second, FailureRate: 0.08, Label: "🪪 PAN Verify"},
		{QueueName: "queue:fintech:aml", WorkerCount: 2, ProcessTime: 4 * time.Second, FailureRate: 0.10, Label: "🔍 AML Check"},
		{QueueName: "queue:fintech:risk", WorkerCount: 1, ProcessTime: 2 * time.Second, FailureRate: 0.05, Label: "⚠️ Risk Score"},
		// SaaS / Enterprise HRMS
		{QueueName: "queue:saas:csv", WorkerCount: 1, ProcessTime: 2 * time.Second, FailureRate: 0.05, Label: "📄 CSV Parse"},
		{QueueName: "queue:saas:iam", WorkerCount: 2, ProcessTime: 5 * time.Second, FailureRate: 0.10, Label: "🔐 IAM Provision"},
		{QueueName: "queue:saas:tokens", WorkerCount: 2, ProcessTime: 3 * time.Second, FailureRate: 0.08, Label: "🎟️ Token Gen"},
	}
}
