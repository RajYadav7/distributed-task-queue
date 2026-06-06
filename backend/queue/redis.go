package queue

import (
	"context"
	"log"
	"time"

	"task-queue-go/config"

	"github.com/go-redis/redis/v8"
)

func InitRedis(cfg *config.Config) *redis.Client {
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("❌ Invalid Redis URL: %v", err)
	}

	client := redis.NewClient(opt)
	ctx := context.Background()

	for i := 1; i <= 30; i++ {
		_, err = client.Ping(ctx).Result()
		if err == nil {
			log.Println("✅ Connected to Redis")
			return client
		}
		log.Printf("⏳ Waiting for Redis (attempt %d/30): %v", i, err)
		time.Sleep(2 * time.Second)
	}

	log.Fatalf("❌ Failed to connect to Redis after 30 attempts: %v", err)
	return nil
}

func PushTask(ctx context.Context, client *redis.Client, queueName string, taskID string) error {
	return client.LPush(ctx, queueName, taskID).Err()
}
