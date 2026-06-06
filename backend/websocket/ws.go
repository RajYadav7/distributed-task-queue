package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"task-queue-go/models"

	"github.com/gin-gonic/gin"
	gorillaws "github.com/gorilla/websocket"
	"gorm.io/gorm"
)

var upgrader = gorillaws.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins
	},
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	Clients    map[*Client]bool
	Broadcast  chan []byte
	Register   chan *Client
	Unregister chan *Client
}

// Client represents a single WebSocket connection
type Client struct {
	Hub  *Hub
	Conn *gorillaws.Conn
	Send chan []byte
}

// NewHub creates a new Hub instance
func NewHub() *Hub {
	return &Hub{
		Clients:    make(map[*Client]bool),
		Broadcast:  make(chan []byte),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
	}
}

// Run starts the hub's main loop handling register/unregister/broadcast
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.Clients[client] = true
			log.Printf("🔌 WebSocket client connected (total: %d)", len(h.Clients))

		case client := <-h.Unregister:
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				close(client.Send)
				log.Printf("🔌 WebSocket client disconnected (total: %d)", len(h.Clients))
			}

		case message := <-h.Broadcast:
			for client := range h.Clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.Clients, client)
				}
			}
		}
	}
}

// HandleWebSocket upgrades HTTP connection to WebSocket
func HandleWebSocket(hub *Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("❌ WebSocket upgrade error: %v", err)
			return
		}

		client := &Client{
			Hub:  hub,
			Conn: conn,
			Send: make(chan []byte, 256),
		}

		hub.Register <- client

		// Start write pump in a goroutine
		go client.writePump()

		// Run read pump (blocks until disconnect)
		client.readPump()
	}
}

// readPump reads messages from the WebSocket connection (discards them, detects disconnect)
func (c *Client) readPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			if gorillaws.IsUnexpectedCloseError(err, gorillaws.CloseGoingAway, gorillaws.CloseAbnormalClosure) {
				log.Printf("❌ WebSocket read error: %v", err)
			}
			break
		}
		// Discard incoming messages
	}
}

// writePump pumps messages from the hub to the WebSocket connection
func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				// Hub closed the channel
				c.Conn.WriteMessage(gorillaws.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(gorillaws.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(gorillaws.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// BroadcastStats periodically queries stats and broadcasts to all WebSocket clients
func BroadcastStats(hub *Hub, db *gorm.DB) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		var stats models.Stats

		db.Model(&models.Task{}).Count(&stats.Total)
		db.Model(&models.Task{}).Where("status = ?", "pending").Count(&stats.Pending)
		db.Model(&models.Task{}).Where("status = ?", "running").Count(&stats.Running)
		db.Model(&models.Task{}).Where("status = ?", "done").Count(&stats.Done)
		db.Model(&models.Task{}).Where("status = ?", "failed").Count(&stats.Failed)

		data, err := json.Marshal(stats)
		if err != nil {
			log.Printf("❌ Failed to marshal stats: %v", err)
			continue
		}

		hub.Broadcast <- data
	}
}
