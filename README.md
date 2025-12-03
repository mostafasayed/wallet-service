# Event-Driven Wallet Microservice

> A production-ready event-driven wallet system with strong consistency guarantees, real-time analytics, and fraud detection.

## Features

- **Deposits, Withdrawals & Transfers** with ACID guarantees
- **Idempotency** via request IDs for all operations
- **Immutable Event Log** for complete audit trail
- **Background Worker** for analytics and fraud detection
- **RabbitMQ** for asynchronous event processing
- **Dead Letter Queue (DLQ)** for fault tolerance
- **Pessimistic Locking** for concurrency control
- **Real-time Analytics** and fraud detection

---

## Table of Contents

- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Background Worker](#background-worker)
- [Testing](#testing)
- [Monitoring & Logging](#monitoring--logging)
- [Development](#development)

---

## Project Structure

```
.
├── services/
│   ├── api/           # NestJS HTTP API service
│   └── worker/        # NestJS event worker service
├── libs/
│   ├── common/        # Shared enums, types, and event contracts
│   └── db-orm/        # TypeORM entities shared across services
├── tools/
│   └── monkey-test.js # Load testing utility
├── docker-compose.yml
├── DESIGN.md          # Detailed architecture documentation
└── README.md
```

---

## Technology Stack

| Category | Technologies |
|----------|-------------|
| **Runtime** | Node.js, TypeScript |
| **Framework** | NestJS |
| **Database** | PostgreSQL 16 |
| **ORM** | TypeORM |
| **Message Broker** | RabbitMQ |
| **Testing** | Jest |
| **DevOps** | Docker, Docker Compose |
| **Package Manager** | NPM Workspaces |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm 9+

### Installation

```bash
# Install dependencies
npm install
```

### Run with Docker Compose

Create a `.env` at the repo root (see [Environment Variables](#environment-variables) or copy `.env.example`) so the API and worker containers get DB/RabbitMQ settings:

```bash
# Start all services
docker-compose up --build
```

This starts:

| Service | URL/Port | Credentials |
|---------|----------|-------------|
| **API** | http://localhost:3000 | - |
| **Swagger UI** | http://localhost:3000/api | - |
| **PostgreSQL** | localhost:5432 | `wallet` / `wallet` |
| **RabbitMQ UI** | http://localhost:15672 | `guest` / `guest` |
| **RabbitMQ AMQP** | localhost:5672 | `guest` / `guest` |

---

## API Documentation

### Interactive API Documentation

The API is fully documented using **Swagger/OpenAPI**. Once the services are running, visit:

```
http://localhost:3000/docs
```

This provides:
- Complete endpoint documentation
- Interactive API testing
- Request/response schemas
- Validation rules

### Generate Swagger JSON

To generate a static `swagger.json` file:

```bash
cd services/api
npm run generate:swagger
```

### Quick API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/wallet/:id/deposit` | POST | Deposit funds into a wallet |
| `/wallet/:id/withdraw` | POST | Withdraw funds from a wallet |
| `/wallet/:id/transfer` | POST | Transfer funds between wallets |
| `/wallet/:id` | GET | Get wallet balance and details |
| `/wallet/:id/history` | GET | Get transaction history |
| `/wallet/:id/stats` | GET | Get wallet statistics |

> 💡 **Tip:** All write operations support idempotency via the `requestId` field.

---

## Background Worker

The worker service processes events asynchronously and provides:

### Analytics
- Tracks total deposited/withdrawn amounts
- Monitors transfer activity (in/out)
- Records last activity timestamp
- Maintains per-wallet statistics

### Fraud Detection

**Rule 1: Rapid Withdrawals**
- Flags wallets with ≥3 withdrawals within 60 seconds

**Rule 2: Large Transactions**
- Flags single withdrawals ≥ configurable threshold (default: 10,000)

### Fault Tolerance

```
wallet.events.worker (main queue)
        ↓
    [Processing]
        ↓
   Success → ACK
        ↓
   Failure → NACK → wallet.events.worker.dlq (DLQ)
```

**Dead Letter Queue (DLQ):**
- Failed messages are routed to `wallet.events.worker.dlq`
- Messages can be inspected and replayed manually
- Prevents poison messages from blocking the queue

---

## Testing

### Unit Tests

**API Service:**
```bash
cd services/api
npm test
```

**Coverage:**
- ✅ Deposit/Withdraw/Transfer operations
- ✅ Idempotency guarantees
- ✅ Saga pattern & compensation
- ✅ Event emission

**Worker Service:**
```bash
cd services/worker
npm test
```

**Coverage:**
- ✅ Analytics aggregation
- ✅ Fraud detection rules
- ✅ Worker idempotency

### Stress Testing

Validate the system under high concurrency:

```bash
# Default: 1000 requests, 100 concurrent
npm run monkey
```

**Validates:**
- Pessimistic row-level locking
- Saga correctness for transfers
- Idempotency under retry load
- No race conditions
- Worker throughput

**Script:** `tools/monkey-test.js`

---

## Monitoring & Logging

### Application Logs

Logs are written to:

```
logs/api.log      # API service logs
logs/worker.log   # Worker service logs
```

**Features:**
- JSON format for structured logging
- Automatic log rotation
- Configurable log levels
- Winston logger integration

### API Audit Trail

All POST requests are recorded in the `api_audit` table:

| Field | Description |
|-------|-------------|
| `method` | HTTP method |
| `url` | Request URL |
| `body` | Request body |
| `headers` | Request headers |
| `client_ip` | Client IP address |
| `timestamp` | Request timestamp |
| `api_audit_id` | Unique audit ID (linked to events) |

---

## Development

### Environment Variables

Create a `.env` file in the root directory:

**Docker Compose (default):**
```env
DB_HOST=postgres
DB_PORT=5432
DB_USER=wallet
DB_PASS=wallet
DB_NAME=wallet

RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
RABBITMQ_EXCHANGE=wallet.events
RABBITMQ_DLX=wallet.events.dlx

ENABLE_SWAGGER=true
```

### Running Locally (without Docker Compose)

**1. Start PostgreSQL:**
```bash
docker run --name wallet-pg \
  -p 5432:5432 \
  -e POSTGRES_USER=wallet \
  -e POSTGRES_PASSWORD=wallet \
  -e POSTGRES_DB=wallet \
  -d postgres:16
```

**2. Start RabbitMQ:**
```bash
docker run --name wallet-rmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -d rabbitmq:3-management
```

**3. Start API Service:**
```bash
cd services/api
npm run start:dev
```

**4. Start Worker Service:**
```bash
cd services/worker
npm run start:dev
```

### Code Quality

**Pre-commit Hooks (Husky + lint-staged):**
- ✅ TypeScript type checking
- ✅ ESLint validation
- ✅ Automatic formatting

**CI/CD (GitHub Actions):**
- Runs on every PR and commit
- Executes: lint → type-check → tests
---

## Architecture Highlights

### Strong Consistency
- **Pessimistic locking** ensures wallet balance integrity
- **ACID transactions** for all write operations
- **No negative balances** enforced at database level

### Event-Driven Design
- **Immutable event log** for complete audit trail
- **Event sourcing** enables time-travel debugging
- **Asynchronous processing** for analytics and notifications

### Saga Pattern
Transfer operations use the Saga pattern:

```
Initiated → Debited → Completed
                ↓
           Compensated → Failed
```

### Idempotency
- **API operations:** `(requestId, walletId)` uniqueness
- **Transfers:** `requestId` on `TransferEntity`
- **Worker:** `ProcessedEventEntity` prevents duplicate processing

### Scalability
- **Horizontal scaling** of API and worker services
- **Database connection pooling** for high throughput
- **Per-wallet locking** allows parallel operations on different wallets

---

## Documentation

- **[DESIGN.md](./DESIGN.md)** - Detailed architecture and design decisions
- **[Swagger UI](http://localhost:3000/docs)** - Interactive API documentation
- **[RabbitMQ Management](http://localhost:15672)** - Message broker monitoring

---

## Summary

This project demonstrates a **production-ready event-driven wallet microservice** with:

- ✅ **Strong consistency** for balance updates
- ✅ **Event-driven architecture** with RabbitMQ
- ✅ **Saga pattern** for distributed transactions
- ✅ **Idempotency** at every layer
- ✅ **Fault-tolerant** background processing with DLQ
- ✅ **Real-time fraud detection** and analytics
- ✅ **Comprehensive test suite** with stress testing
- ✅ **Production-ready** logging and monitoring
