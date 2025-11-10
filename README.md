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

Optional tooling:

---

- pm install -g just (or your preferred task runner) if you want shorthand aliases for the workspace commands

## 🏗️ Architecture

---

### **Microservices**

## Repository Layout

| Service | Framework | Port | Purpose |

|---------|-----------|------|---------|`apps/

| **API Gateway** | NestJS | 4000 | Entry point, orchestration, RabbitMQ publishing | api_gateway/ # NestJS gateway (Dockerfile only)

| **User Service** | Fastify | 4001 | User management, preferences, PostgreSQL | user_service/ # Fastify service (Dockerfile only)

| **Template Service** | NestJS | 4002 | Template CRUD, rendering, PostgreSQL | template_service/ # Fastify service (Dockerfile only)

| **Email Service** | FastAPI | 8000 | Email queue consumer, SMTP integration | email_service/ # FastAPI worker (Dockerfile only)

| **Push Service** | Fastify | 4100 | Push notification worker, FCM/APNS | push_service/ # NestJS worker (Dockerfile only)

packages/

### **Infrastructure** messaging/

    node/            # Shared RabbitMQ helper (TypeScript stub)

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

`powershell

## Quick Start

## Clone the repository

### **Prerequisites**

git clone https://github.com/<your-org>/distributed-notifs.git

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

corepack enablepnpm run lint

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

`````

`powershell

### **Development Mode**docker compose up --build

`

```bash

# Run individual services in dev mode. This command builds each service image, boots RabbitMQ, Redis, and PostgreSQL, and connects everything on the

cd apps/api_gateway && pnpm run start:devotifications network. Health checks in every Dockerfile surface readiness issues early.

cd apps/user_service && pnpm run start:dev

cd apps/email_service && uvicorn app.main:app --reloadKey endpoints once services exist:

```

- API Gateway http://localhost:4000/health

---- User Service http://localhost:4001/health

- Template Service http://localhost:4002/health

## 📁 Project Structure- Email Worker http://localhost:8000/health

- Push Worker http://localhost:4100/health

```- RabbitMQ UI http://localhost:15672 (guest/guest)

distributed-notifs/

├── apps/### Building Individual Images

│   ├── api_gateway/          # NestJS - HTTP entry point

│   │   ├── src/              # (create your implementation)`powershell

│   │   ├── package.jsondocker build -t distributed-notifs/api-gateway apps/api_gateway

│   │   ├── tsconfig.jsondocker build -t distributed-notifs/email-service apps/email_service

│   │   ├── nest-cli.json`

│   │   └── Dockerfile

│   ├── user_service/         # Fastify - User management

│   │   ├── src/---

│   │   ├── package.json

│   │   ├── tsconfig.json## CI/CD Pipeline

│   │   └── Dockerfile

│   │GitHub Actions workflow: .github/workflows/ci-cd.yml

│   ├── template_service/     # NestJS - Template engine

│   │   ├── src/- **quality** job (every PR and push to main)

│   │   ├── package.json

│   │   ├── tsconfig.json  - Sets up Node.js (pnpm) and Python toolchains

│   │   ├── nest-cli.json  - Executes pnpm install --frozen-lockfile

│   │   └── Dockerfile  - Runs pnpm run lint, pnpm run typecheck, and pnpm run test

│   │  - Installs apps/email_service/requirements.txt when present

│   ├── email_service/        # FastAPI - Email worker  - Validates docker-compose.yml

│   │   ├── app/  - Starts ephemeral RabbitMQ, Redis, and PostgreSQL containers for future integration tests

│   │   ├── requirements.txt

│   │   └── Dockerfile- **docker-images** job (only on main)

│   │  - Builds each service image using Docker Buildx

│   └── push_service/         # Fastify - Push worker  - Pushes latest and commit-SHA tags to GHCR under distributed-notifs-\*

│       ├── src/

│       ├── package.jsonPublishing to GHCR uses ${{ secrets.GITHUB_TOKEN }} automatically. If you switch registries, add the required credentials as repository secrets and update the workflow accordingly.

│       ├── tsconfig.json

│       └── Dockerfile---

│

├── packages/## Email Service Dependencies (Example)

│   └── messaging/            # Shared messaging utilities

│       ├── node/             # RabbitMQ, HTTP, gRPC clients (TypeScript)Suggested pps/email_service/requirements.txt:

│       ├── python/           # RabbitMQ, HTTP clients (Python)

│       ├── grpc/             # Protocol Buffer definitions`fastapi

│       └── package.jsonuvicorn[standard]

│aio-pika

├── docker-compose.yml        # Local orchestrationpydantic

├── Dockerfile                # Dev container (Node + Python)python-dotenv`

├── pnpm-workspace.yaml       # pnpm workspace config

├── .github/workflows/        # CI/CD pipelinesAdd testing or observability tooling (for example pytest, httpx, opentelemetry) as you flesh out the worker.

└── docs/                     # Documentation

    ├── FRAMEWORK_GUIDE.md---

    ├── CONFIGURATION_GUIDE.md

    └── GITHUB_SECRETS_GUIDE.md## Next Steps

```

1. Scaffold each service with your chosen framework and add lint, est, uild, and start scripts.

---2. Implement DTOs, controllers, queue consumers, retry logic, and idempotency per the project brief.

3. Expand testing: unit first, then integration leveraging the infra started by the quality job.

## 🔧 Available Commands4. Extend the CI/CD workflow as the platform grows (coverage thresholds, staging deploys, alerts, etc.).

### **Workspace Commands**---

```bash## Troubleshooting

# Install all dependencies

pnpm install- **Docker health checks failing:** confirm each service exposes /health and listens on the port declared in its Dockerfile.

- **pnpm run lint/test finds no scripts:** define the script inside the relevant workspaces package.json once code exists.

# Lint all services- **Image push denied:** ensure the repository is public or grant the GitHub workflow packages: write permissions for private repositories.

pnpm run lint

Happy buildingthe infrastructure is ready for your services.

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

## 🐳 Docker Configuration

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

See [CONFIGURATION_GUIDE.md](./CONFIGURATION_GUIDE.md) for complete setup instructions.

### **GitHub Secrets (CI/CD)**

For production deployments, use GitHub Secrets:

```yaml
# .github/workflows/ci-cd.yml uses:
${{ secrets.POSTGRES_PASSWORD }}
${{ secrets.REDIS_PASSWORD }}
```

See [GITHUB_SECRETS_GUIDE.md](./GITHUB_SECRETS_GUIDE.md) for setup instructions.

---

## 🔄 CI/CD Pipeline

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

## 🛠️ Technology Stack

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

## 🎯 Key Features

### **Production-Ready**

Multi-stage Docker builds for minimal image sizes  
Health checks on all services  
Graceful shutdown handling  
Connection pooling for databases  
Circuit breakers for external calls

### **Scalability**

Horizontal scaling support  
Message queue for async processing  
Redis caching layer  
Stateless service design

### **Security**

No hardcoded credentials  
Secrets management with GitHub Actions  
Non-root Docker users  
Environment-specific configurations

### **Developer Experience**

pnpm workspace for monorepo management  
TypeScript strict mode  
Hot reload in development  
Comprehensive documentation

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

## 🐛 Troubleshooting

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

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request
