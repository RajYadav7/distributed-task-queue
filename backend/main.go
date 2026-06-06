package main

import (
	"context"
	"fmt"
	"log"

	"task-queue-go/api"
	"task-queue-go/config"
	"task-queue-go/db"
	"task-queue-go/models"
	"task-queue-go/queue"
	ws "task-queue-go/websocket"
	"task-queue-go/workers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Load config
	cfg := config.LoadConfig()

	// 2. Init MySQL
	database := db.InitDB(cfg)

	// 3. Init Redis
	rdb := queue.InitRedis(cfg)

	// 4. Recovery: find tasks with status "running", reset to "pending", re-push to their stored QueueName
	var stuckTasks []models.Task
	database.Where("status = ?", "running").Find(&stuckTasks)
	if len(stuckTasks) > 0 {
		log.Printf("🔄 Recovering %d stuck tasks...", len(stuckTasks))
		ctx := context.Background()
		for _, task := range stuckTasks {
			database.Model(&task).Update("status", "pending")
			if err := queue.PushTask(ctx, rdb, task.QueueName, task.ID); err != nil {
				log.Printf("❌ Failed to re-push recovered task %s: %v", task.ID, err)
			} else {
				log.Printf("🔄 Recovered task %s -> %s", task.ID, task.QueueName)
			}
		}
	}

	// 5. Create WebSocket hub and start hub.Run()
	hub := ws.NewHub()
	go hub.Run()

	// 6. Start BroadcastStats goroutine
	go ws.BroadcastStats(hub, database)

	// 7. Start ALL worker pools
	ctx := context.Background()
	allConfigs := workers.GetAllWorkerConfigs()

	// Print startup banner
	fmt.Println("")
	fmt.Println("🚀 Starting Distributed Task Queue Orchestration Engine...")
	fmt.Println("📊 Worker Matrix:")

	totalGoroutines := 0
	for _, wc := range allConfigs {
		unit := "goroutines"
		if wc.WorkerCount == 1 {
			unit = "goroutine"
		}
		fmt.Printf("   %s %-30s -> %d %s\n", wc.Label, wc.QueueName, wc.WorkerCount, unit)
		totalGoroutines += wc.WorkerCount
	}

	fmt.Println("   ═══════════════════════════════════════════════════")
	fmt.Printf("   Total: %d goroutines across %d isolated queues\n", totalGoroutines, len(allConfigs))
	fmt.Println("")

	for _, wc := range allConfigs {
		workers.StartWorkerPool(ctx, database, rdb, wc)
	}

	// 8. Setup Gin with CORS
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			return true
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// 9. Register routes
	r.POST("/api/orchestrate", api.TriggerEvent(database, rdb))
	r.GET("/api/orchestrations", api.GetTasks(database))
	r.GET("/api/metrics", api.GetStats(database))
	r.GET("/ws", ws.HandleWebSocket(hub))

	// 10. Start server
	addr := ":" + cfg.Port
	log.Printf("🌐 Server starting on port %s", cfg.Port)
	if err := r.Run(addr); err != nil {
		log.Fatalf("❌ Failed to start server: %v", err)
	}
}
