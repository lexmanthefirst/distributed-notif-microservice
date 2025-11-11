# Distributed Notification System

A scalable microservices-based notification platform supporting email and push notifications. Built with NestJS, Fastify, and FastAPI, leveraging RabbitMQ for async messaging, PostgreSQL for persistence, and Redis for caching.

## Quick Setup

```bash
# Clone the repository
git clone https://github.com/lexmanthefirst/distributed-notif-microservice.git
cd distributed-notif-microservice

# Enable pnpm (one-time setup)
corepack enable

# Install all dependencies
pnpm install

# Start infrastructure and services
docker compose up --build
```

**Services will be available at:**

- API Gateway: http://localhost:4000
- User Service: http://localhost:4001
- Template Service: http://localhost:4002
- Email Service: http://localhost:8000
- Push Service: http://localhost:4100
- RabbitMQ UI: http://localhost:15672 (guest/guest)

## Contributing

```bash
# Fork and clone your fork
git clone https://github.com/YOUR_USERNAME/distributed-notif-microservice.git
cd distributed-notif-microservice

# Enable pnpm
corepack enable

# Install dependencies
pnpm install

# Build all services
pnpm run build

# Run tests
pnpm run test

# Create a feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git commit -m "Add your feature"

# Push and create PR
git push origin feature/your-feature-name
```

## License

ISC
