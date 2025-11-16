import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHello(): object {
    return {
      service: "Distributed Notification System - API Gateway",
      version: "1.0.0",
      description:
        "Microservices-based notification system with RabbitMQ, Redis, and PostgreSQL",
      status: "running",
      endpoints: {
        health: "/health",
        users: "/api/v1/users",
        templates: "/api/v1/templates",
        notifications: "/api/v1/notifications",
      },
      documentation: {
        setup: "See SETUP_GUIDE.md for local development",
        testing: "See LIVE_TESTING.md for API testing guide",
        production: "See PRODUCTION_TESTING_GUIDE.md for Railway deployment",
        overview: "See PROJECT_OVERVIEW.md for architecture details",
      },
      features: [
        "User registration & authentication",
        "Template management with caching",
        "Email notifications via RabbitMQ",
        "Push notifications (coming soon)",
        "Circuit breaker & retry patterns",
        "Idempotency with request tracking",
      ],
      timestamp: new Date().toISOString(),
    };
  }
}
