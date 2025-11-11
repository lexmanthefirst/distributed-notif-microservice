# Distributed Notification System# Distributed Notification System Monorepo

> A production-ready monorepo for a distributed notification platform with microservices architecture, built with NestJS, Fastify, FastAPI, and comprehensive messaging infrastructure.

---

## Overview

## Prerequisites

A scalable notification system designed to handle **1000+ notifications per minute** with:

- Node.js 20.11.x (with Corepack enabled for pnpm)

- **5 Microservices** - API Gateway, User, Template, Email, and Push services- pnpm 8.x (corepack enable pnpm)

- **Multi-Framework Stack** - NestJS, Fastify, and FastAPI- Python 3.11.x

- **Message Queue** - RabbitMQ with dead letter queues and retry logic- Docker Engine 24+ with Docker Compose V2

- **Caching Layer** - Redis for high-performance data access- Git CLI

- **Database** - PostgreSQL with connection pooling- Access to a container registry (for example, GitHub Container Registry) if you plan to publish production images

- **Production-Ready** - Docker, CI/CD, health checks, and monitoring hooks

## 🏗️ Architecture

---

- **RabbitMQ 3.13** - Message broker with management UI (port 15672) python/ # Shared RabbitMQ helper (Python stub)

- **Redis 7.2** - Caching and session storagedocker-compose.yml # Local orchestration of infrastructure + services

- **PostgreSQL 16** - Relational database with separate schemas per serviceDockerfile # Dev container with Node + Python toolchains

- **Docker Network** - Isolated `notifications` network for inter-service communicationpnpm-workspace.yaml # Workspace manifest for pnpm`

### **Communication Patterns**Each service will eventually own its own package.json or

requirements.txt, build/test scripts, and runtime code. The provided Dockerfiles assume those scripts exist once you add them.

**Async Messaging (RabbitMQ)** - Notification delivery, background jobs

**HTTP/REST** - Synchronous queries (user lookup, template fetching) ---

**gRPC (Optional)** - High-performance internal RPC (ports 50051-50053)

## Getting Started

---

``````powershell

## Quick Start

## Clone the repository

### **Prerequisites**

git clone https://github.com/lexmanthefirst/distributed-notif-microservice.git

- **Node.js** 20.11+ with Corepack enabledcd distributed-notifs

- **pnpm** 8.15.4 (installed via Corepack)

- **Python** 3.11+# Ensure pnpm is available (only needed once per machine)

- **Docker** 24+ with Compose V2

- **Git** CLIcorepack enable pnpm

### **Installation**# Install workspace dependencies

`````bashpnpm install

# Clone the repository`

git clone https://github.com/your-org/distributed-notifs.git

cd distributed-notifsThe root scripts below fan out to every workspace that defines the referenced command. Services without code are automatically skipped until you add the relevant scripts.



# Enable pnpm (one-time setup)`powershell

corepack enable

pnpm run lint

pnpm run test

# Install dependenciespnpm run typecheck

pnpm installpnpm run build

pnpm run bootstrap   # Re-runs installs without duplicating root dev dependencies

# Install Python dependencies for email service`

cd apps/email_service

pip install -r requirements.txtNeed to focus on a single workspace? Use filters:

cd ../..

````powershell

pnpm --filter apps/api_gateway run build

### **Run Locally**`



```bash---

# Start all services with Docker Compose

docker compose up --build## Environment Variables



# Services will be available at:Create .env at the repository root (or copy from an .env.example when you add one) and populate credentials for PostgreSQL, Redis, SMTP, FCM, etc. docker-compose.yml loads values from .env automatically.

# - API Gateway: http://localhost:4000

# - User Service: http://localhost:4001---

# - Template Service: http://localhost:4002

# - Email Service: http://localhost:8000## Docker Workflow

# - Push Service: http://localhost:4100

# - RabbitMQ UI: http://localhost:15672 (guest/guest)### Local Development Stack

``````

`powershell

### **Development Mode**docker compose up --build

`

```bash

# Run individual services in dev mode. This command builds each service image, boots RabbitMQ, Redis, and PostgreSQL, and connects everything on the

cd apps/api_gateway && pnpm run start

cd apps/user_service && pnpm run start:dev

cd apps/email_service && uvicorn app.main:app --reloadKey endpoints once services exist:

```

1. Scaffold each service with your chosen framework and add lint, esbuild, and start scripts.

2. Implement DTOs, controllers, queue consumers, retry logic, and idempotency per the project brief.

3. Expand testing: unit first, then integration leveraging the infra started by the quality job.

4. Extend the CI/CD workflow as the platform grows (coverage thresholds, staging deploys, alerts, etc.).

### **Workspace Commands**---

```bash

# Install all dependencies

pnpm install

# Type check all TypeScript services
pnpm run typecheck

# Run tests
pnpm run test

# Build all services
pnpm run build
```

### **Service-Specific Commands**

```bash
# Work on a specific service
pnpm --filter @distributed-notifs/api-gateway run build
pnpm --filter @distributed-notifs/user-service run test

# Or navigate to service directory
cd apps/api_gateway
pnpm run start:dev
```

---

## Docker Configuration

### **Build Individual Images**

```bash
docker build -t distributed-notifs/api-gateway ./apps/api_gateway
docker build -t distributed-notifs/email-service ./apps/email_service
```

### **Multi-Stage Builds**

All Dockerfiles use optimized multi-stage builds:

- **deps** - Install dependencies with frozen lockfiles
- **build** - Compile TypeScript/Python
- **runner** - Production runtime (minimal, non-root user for Python)

### **Health Checks**

Every service includes health checks:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1
```

---

## 🔐 Configuration & Secrets

### **Environment Variables**

Services manage their own configuration. **No credentials are hardcoded in docker-compose.yml.**

Create `.env` files per service:

```bash
# apps/user_service/.env
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_NAME=user_service

REDIS_HOST=redis
REDIS_PORT=6379
```

### CI/CD Pipeline

### **Quality Job** (Every PR and Push)

- Node.js 20 + pnpm setup with caching
- Python 3.13 setup with pip caching
- Linting, type checking, and tests
- Docker Compose validation
- Ephemeral RabbitMQ, Redis, PostgreSQL for integration tests

### **Docker Build Job** (Main Branch Only)

- Multi-platform builds (linux/amd64)
- Push to GitHub Container Registry (GHCR)
- Tags: `latest` and `sha-<commit>`
- Layer caching for faster builds

**Workflow:** `.github/workflows/ci-cd.yml` |

---

## Technology Stack

### **Frameworks**

- **NestJS** - Enterprise-grade TypeScript framework (API Gateway, Template Service)
- **Fastify** - High-performance Node.js framework (User, Push Services)
- **FastAPI** - Modern Python async framework (Email Service)

### **Infrastructure**

- **pnpm** - Fast, disk-efficient package manager
- **Docker** - Containerization with multi-stage builds
- **RabbitMQ** - Message broker with DLQ and retry logic
- **PostgreSQL** - Relational database with TypeORM/Prisma
- **Redis** - In-memory cache and session store

### **Messaging**

- **RabbitMQ** - Async event-driven communication
- **HTTP/REST** - Synchronous request-response
- **gRPC** - High-performance RPC (optional, pre-configured)

---

## Implementation Roadmap

### **Phase 1: Core Services**

- [x] Repository structure
- [x] Docker configuration
- [x] CI/CD pipeline
- [x] Messaging infrastructure

### **Phase 2: Service Implementation**

- [ ] API Gateway endpoints
- [ ] User service CRUD
- [ ] Template service with rendering
- [ ] Email worker with SMTP
- [ ] Push worker with FCM/APNS

### **Phase 3: Advanced Features**

- [ ] Rate limiting
- [ ] Circuit breakers
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Monitoring (Prometheus/Grafana)
- [ ] API documentation (Swagger)

---

## Troubleshooting

### **Docker health checks failing**

```bash
# Check service logs
docker compose logs api_gateway

# Ensure /health endpoint is implemented
curl http://localhost:4000/health
```

### **pnpm install fails**

```bash
# Clear pnpm cache
pnpm store prune

# Re-enable corepack
corepack enable pnpm
corepack prepare pnpm@8.15.4 --activate
```

### **RabbitMQ connection refused**

```bash
# Check RabbitMQ is running
docker compose ps rabbitmq

# Access management UI
open http://localhost:15672
```

### **Database connection errors**

- Ensure PostgreSQL is healthy: `docker compose ps postgres`
- Check connection strings in service config files
- Verify database names exist (auto-created on first connect)

---

---

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request
