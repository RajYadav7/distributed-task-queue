package db

import (
	"fmt"
	"log"
	"time"

	"task-queue-go/config"
	"task-queue-go/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func InitDB(cfg *config.Config) *gorm.DB {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName,
	)

	var database *gorm.DB
	var err error

	for i := 1; i <= 30; i++ {
		database, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
		if err == nil {
			log.Println("✅ Connected to MySQL")
			break
		}
		log.Printf("⏳ Waiting for MySQL (attempt %d/30): %v", i, err)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		log.Fatalf("❌ Failed to connect to MySQL after 30 attempts: %v", err)
	}

	// Auto-migrate the Task model
	if err := database.AutoMigrate(&models.Task{}); err != nil {
		log.Fatalf("❌ Failed to auto-migrate: %v", err)
	}
	log.Println("✅ Database migrated successfully")

	return database
}
