# ⚡ Distributed Task Queue Orchestration Engine

A production-grade, event-driven task queue system with **micro-concurrency isolation** — each task type gets its own dedicated Redis queue and goroutine pool, eliminating Head-of-Line (HOL) blocking entirely.

![Go](https://img.shields.io/badge/Go-1.21-00ADD8?style=flat-square&logo=go)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat-square&logo=mysql)
![Redis](https://img.shields.io/badge/Redis-7.0-DC382D?style=flat-square&logo=redis)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)

---

## 🏗 Architecture Overview

```
                           ┌──────────────────────────────┐
                           │      React Dashboard         │
                           │   (Real-time via WebSocket)   │
                           └──────────────┬───────────────┘
                                          │
                           ┌──────────────▼───────────────┐
                           │        Go API Server          │
                           │     (Gin + GORM + WS Hub)     │
                           └──────────────┬───────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
         ┌──────────▼──────────┐ ┌────────▼────────┐ ┌─────────▼────────┐
         │   MySQL 8 (Store)   │ │  Redis 7 (Queues)│ │  Worker Pools    │
         │  Task History &     │ │  10 Isolated     │ │  19 Goroutines   │
         │  Persistent State   │ │  FIFO Streams    │ │  Parallel BRPOP  │
         └─────────────────────┘ └─────────────────┘ └──────────────────┘
```

### Event-Driven Fan-Out Model

When a pipeline event is triggered via the API, the system **atomically fans out** individual sub-tasks into their own isolated Redis queues. Each queue has dedicated worker goroutines consuming exclusively from their matched stream.

```
  POST /api/events { event: "PLACE_ORDER" }
                    │
                    ▼
  ┌─────────────────────────────────────────────┐
  │           Generate GroupID (UUID)            │
  │     Create 4 sub-tasks in MySQL (txn)       │
  │     Push each to its dedicated Redis queue   │
  └─────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┬───────────┐
        ▼           ▼           ▼           ▼
  queue:ecom:sms  queue:ecom:email  queue:ecom:rest  queue:ecom:gps
    (2 workers)    (2 workers)       (2 workers)      (3 workers)
```

---

## 🎯 The Deep Concurrency Matrix

### 🍔 E-Commerce / Food Tech — `PLACE_ORDER`

| Sub-Task | Queue | Workers | Simulated Work | Failure Rate |
|----------|-------|---------|----------------|--------------|
| Send Order SMS | `queue:ecommerce:sms` | 2 goroutines | 1s | 5% |
| Send Order Email | `queue:ecommerce:email` | 2 goroutines | 2s | 5% |
| Notify Restaurant | `queue:ecommerce:restaurant` | 2 goroutines | 2s | 8% |
| Match Delivery GPS | `queue:ecommerce:gps` | 3 goroutines | 3s | 10% |

### 🏦 FinTech / Compliance — `SUBMIT_KYC`

| Sub-Task | Queue | Workers | Simulated Work | Failure Rate |
|----------|-------|---------|----------------|--------------|
| Verify PAN Card | `queue:fintech:pan` | 2 goroutines | 3s | 8% |
| Run AML Check | `queue:fintech:aml` | 2 goroutines | 4s | 10% |
| Compute Risk Score | `queue:fintech:risk` | 1 goroutine | 2s | 5% |

### 📊 SaaS / Enterprise HRMS — `BULK_USER_IMPORT`

| Sub-Task | Queue | Workers | Simulated Work | Failure Rate |
|----------|-------|---------|----------------|--------------|
| Parse CSV File | `queue:saas:csv` | 1 goroutine | 2s | 5% |
| Provision IAM Identity | `queue:saas:iam` | 2 goroutines | 5s | 10% |
| Generate Invite Tokens | `queue:saas:tokens` | 2 goroutines | 3s | 8% |

**Total: 19 goroutines across 10 isolated queues**

---

## 🛡 Why Sub-Task Level Queue Isolation?

### The Head-of-Line (HOL) Blocking Problem

In traditional shared-queue architectures, all task types share a single FIFO queue:

```
Shared Queue: [SMS] [EMAIL] [GPS] [REPORT] [EMAIL] [GPS] [SMS] ...
                │
                ▼
        Workers pop sequentially
```

**Problems with shared queues:**
1. **HOL Blocking**: A slow GPS matching task (3s) blocks fast SMS notifications (1s) behind it
2. **Priority Inversion**: High-priority alerts wait behind low-priority batch jobs
3. **Cascade Failures**: One failing task type causes retry storms that block all other types
4. **No Isolation**: A spike in one task type starves all other task types
5. **Uniform Scaling**: You can't scale workers for one task type without over-provisioning others

### Our Solution: Micro-Concurrency Isolation

```
queue:ecommerce:sms        → [SMS-1] [SMS-2]               → 2 dedicated workers
queue:ecommerce:email      → [EMAIL-1] [EMAIL-2]           → 2 dedicated workers
queue:ecommerce:gps        → [GPS-1] [GPS-2] [GPS-3]       → 3 dedicated workers
queue:fintech:pan          → [PAN-1] [PAN-2]               → 2 dedicated workers
...
```

**Benefits:**
1. **Zero HOL Blocking**: SMS tasks are never blocked by slow GPS tasks — they have their own queue and workers
2. **Independent Scaling**: Scale GPS workers to 10 without touching SMS workers
3. **Fault Isolation**: If AML checks are failing, only `queue:fintech:aml` accumulates retries. SMS and email continue unaffected
4. **Predictable Latency**: Each task type has predictable, bounded queue wait times
5. **Domain Separation**: E-commerce tasks never interfere with FinTech compliance tasks
6. **Backpressure Control**: You can monitor and alert per-queue depths independently
7. **Selective Recovery**: On crash recovery, tasks are re-queued to their exact original queue

---

## 🚀 Getting Started

### 🐳 Run with Docker (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd task-queue-go

# Start all services (MySQL, Redis, Backend, Frontend)
docker-compose up --build

# Access the application
# Frontend Dashboard:  http://localhost:5173
# Backend API:         http://localhost:8080
# MySQL:               localhost:3306
# Redis:               localhost:6379
```

To stop:
```bash
docker-compose down        # Stop services
docker-compose down -v     # Stop + remove data volumes
```

### 💻 Run without Docker

**Prerequisites:**
- Go 1.21+
- Node.js 18+
- MySQL 8.0 (running with database `taskqueue` created)
- Redis 7.0 (running on port 6379)

**1. Start the Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env with your local credentials
go mod tidy
go run main.go
```

**2. Start the Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**3. Open:** [http://localhost:5173](http://localhost:5173)

---

## 📡 API Reference

### Trigger Pipeline Event

```
POST /api/events
```

**Request:**
```json
{
  "event": "PLACE_ORDER",
  "payload": "{\"customer_id\":\"CUST-9281\",\"order_id\":\"ORD-001\"}"
}
```

**Response (200):**
```json
{
  "group_id": "a1b2c3d4-...",
  "event": "PLACE_ORDER",
  "tasks_created": 4,
  "tasks": [
    {
      "id": "...",
      "root_event": "PLACE_ORDER",
      "group_id": "a1b2c3d4-...",
      "type": "send_order_sms",
      "queue_name": "queue:ecommerce:sms",
      "status": "pending"
    },
    ...
  ]
}
```

### List Tasks

```
GET /api/tasks?status=running&root_event=PLACE_ORDER
```

### Get Engine Stats

```
GET /api/stats
```

```json
{
  "total": 150,
  "pending": 12,
  "running": 8,
  "done": 125,
  "failed": 5
}
```

### WebSocket (Live Stats)

```
ws://localhost:8080/ws
```

Broadcasts stats JSON every 2 seconds to all connected clients.

---

## ⚙️ Retry Logic

Failed tasks are retried with **exponential backoff**:

| Attempt | Wait Time | Formula |
|---------|-----------|---------|
| 1st retry | 5 seconds | `5s × 2⁰` |
| 2nd retry | 10 seconds | `5s × 2¹` |
| 3rd retry | 20 seconds | `5s × 2²` |

After exhausting max retries (default: 3), the task is moved to `failed` status with an error message.

---

## 🔄 Crash Recovery

On server startup, the engine:
1. Queries MySQL for all tasks with `status = 'running'`
2. Resets their status to `pending`
3. Re-pushes each task to its stored `queue_name` in Redis

This guarantees **zero task loss** during server crashes or restarts.

---

## 📁 Project Structure

```
task-queue-go/
├── docker-compose.yml              # Service orchestration
├── README.md                       # This file
├── .gitignore
│
├── backend/
│   ├── Dockerfile
│   ├── main.go                     # Entry point: 19 goroutines, 10 queues
│   ├── .env.example
│   ├── go.mod / go.sum
│   ├── config/config.go            # Environment configuration
│   ├── db/mysql.go                 # MySQL connection with retry
│   ├── queue/redis.go              # Redis connection + PushTask helper
│   ├── models/task.go              # Task model with RootEvent, GroupID, QueueName
│   ├── api/handler.go              # Event fan-out + CRUD endpoints
│   ├── workers/worker.go           # Generic worker pool with per-queue config
│   └── websocket/ws.go             # Hub/Client pattern + stats broadcaster
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js / tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx / App.jsx
        ├── index.css                # Glassmorphism + dark theme
        ├── api/tasks.js             # API client
        ├── hooks/useWebSocket.js    # Live stats hook
        └── components/
            ├── Dashboard.jsx        # Main layout + data orchestration
            ├── StatsCards.jsx       # 5 animated stat cards
            ├── TaskTable.jsx        # Domain-colored operations grid
            └── SubmitModal.jsx      # Pipeline event trigger modal
```

---

## 🔐 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL username |
| `DB_PASSWORD` | `root1234` | MySQL password |
| `DB_NAME` | `taskqueue` | MySQL database |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `PORT` | `8080` | Backend server port |

---

## 🌍 Deployment

### GitHub

```bash
git init
git add .
git commit -m "feat: Distributed Task Queue Orchestration Engine with micro-concurrency isolation"
git remote add origin <your-repo-url>
git push -u origin main
```

### Production Recommendations

- **MySQL**: Use managed service (AWS RDS, GCP Cloud SQL, PlanetScale)
- **Redis**: Use managed service (AWS ElastiCache, Redis Cloud)
- **Backend**: Deploy on AWS ECS, Google Cloud Run, or Kubernetes
- **Frontend**: Deploy on Vercel, Netlify, or serve as static from CDN
- **Monitoring**: Add Prometheus metrics per queue depth + Grafana dashboards
- **Security**: Enable Redis AUTH, MySQL SSL, restrict CORS origins

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
