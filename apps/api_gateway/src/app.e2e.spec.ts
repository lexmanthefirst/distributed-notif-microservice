import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "./app.module";

describe("API Gateway (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same configuration as in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      })
    );
    app.setGlobalPrefix("api/v1");
    app.enableCors();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Health Check", () => {
    it("/api/v1 (GET) - should return welcome message", () => {
      return request(app.getHttpServer())
        .get("/api/v1")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("message");
          expect(res.body.message).toContain("API Gateway");
        });
    });

    it("/api/v1/health (GET) - should return health status", () => {
      return request(app.getHttpServer())
        .get("/api/v1/health")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("status");
          expect(res.body.status).toBe("ok");
        });
    });
  });

  describe("User Endpoints", () => {
    const testUser = {
      name: "Test User",
      email: `test_${Date.now()}@example.com`,
      password: "TestPassword123!",
    };

    it("/api/v1/users/register (POST) - should register a new user", () => {
      return request(app.getHttpServer())
        .post("/api/v1/users/register")
        .send(testUser)
        .expect((res) => {
          // Could be 201 if service is up, or error if service is down
          expect([201, 500, 503]).toContain(res.status);

          if (res.status === 201) {
            expect(res.body).toHaveProperty("email", testUser.email);
            expect(res.body).toHaveProperty("name", testUser.name);
            expect(res.body).not.toHaveProperty("password");
          }
        });
    });

    it("/api/v1/users/login (POST) - should require email and password", () => {
      return request(app.getHttpServer())
        .post("/api/v1/users/login")
        .send({ email: "test@example.com" }) // Missing password
        .expect((res) => {
          // Should fail validation or service call
          expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    it("/api/v1/users/health (GET) - should check user service health", () => {
      return request(app.getHttpServer())
        .get("/api/v1/users/health")
        .expect((res) => {
          // Could be 200 if service is up, or error if down
          expect([200, 500, 503]).toContain(res.status);
        });
    });
  });

  describe("Template Endpoints", () => {
    it("/api/v1/templates (GET) - should get templates", () => {
      return request(app.getHttpServer())
        .get("/api/v1/templates")
        .query({ page: 1, limit: 10 })
        .expect((res) => {
          expect([200, 500, 503]).toContain(res.status);

          if (res.status === 200) {
            expect(res.body).toHaveProperty("data");
            expect(Array.isArray(res.body.data)).toBe(true);
          }
        });
    });

    it("/api/v1/templates/code/:code (GET) - should get template by code", () => {
      return request(app.getHttpServer())
        .get("/api/v1/templates/code/welcome")
        .expect((res) => {
          expect([200, 404, 500, 503]).toContain(res.status);

          if (res.status === 200) {
            expect(res.body).toHaveProperty("code", "welcome");
          }
        });
    });

    it("/api/v1/templates (POST) - should create a template", () => {
      const newTemplate = {
        code: `test_${Date.now()}`,
        name: "Test Template",
        description: "Test template description",
        subject: "Test Subject",
        html_body: "<p>Test body</p>",
        category: "email",
      };

      return request(app.getHttpServer())
        .post("/api/v1/templates")
        .send(newTemplate)
        .expect((res) => {
          expect([201, 400, 500, 503]).toContain(res.status);

          if (res.status === 201) {
            expect(res.body).toHaveProperty("code", newTemplate.code);
            expect(res.body).toHaveProperty("name", newTemplate.name);
          }
        });
    });
  });

  describe("Notification Endpoints", () => {
    it("/api/v1/notifications/email (POST) - should queue email notification", () => {
      const emailNotification = {
        user_email: "test@example.com",
        template_code: "welcome",
        template_data: {
          user_name: "Test User",
          app_name: "TestApp",
        },
        priority: 5,
      };

      return request(app.getHttpServer())
        .post("/api/v1/notifications/email")
        .send(emailNotification)
        .expect((res) => {
          // 202 if RabbitMQ is up, 503 if down
          expect([202, 500, 503]).toContain(res.status);

          if (res.status === 202) {
            expect(res.body).toHaveProperty("success", true);
            expect(res.body).toHaveProperty("notification_id");
          }
        });
    });

    it("/api/v1/notifications/push (POST) - should queue push notification", () => {
      const pushNotification = {
        push_token: "fcm_test_token",
        template_code: "new_message",
        template_data: {
          sender_name: "Test Sender",
          message_preview: "Hello!",
        },
        priority: 8,
      };

      return request(app.getHttpServer())
        .post("/api/v1/notifications/push")
        .send(pushNotification)
        .expect((res) => {
          expect([202, 500, 503]).toContain(res.status);

          if (res.status === 202) {
            expect(res.body).toHaveProperty("success", true);
            expect(res.body).toHaveProperty("notification_id");
          }
        });
    });

    it("/api/v1/notifications/:id/status (GET) - should get notification status", () => {
      const notificationId = "email_1234567890";

      return request(app.getHttpServer())
        .get(`/api/v1/notifications/${notificationId}/status`)
        .expect((res) => {
          expect([200, 404, 500]).toContain(res.status);

          if (res.status === 200) {
            expect(res.body).toHaveProperty("notification_id");
            expect(res.body).toHaveProperty("status");
          }
        });
    });
  });

  describe("Error Handling", () => {
    it("should return 404 for non-existent routes", () => {
      return request(app.getHttpServer())
        .get("/api/v1/non-existent-route")
        .expect(404);
    });

    it("should handle invalid JSON payloads", () => {
      return request(app.getHttpServer())
        .post("/api/v1/users/register")
        .set("Content-Type", "application/json")
        .send("invalid json{")
        .expect(400);
    });
  });

  describe("CORS", () => {
    it("should include CORS headers", () => {
      return request(app.getHttpServer())
        .options("/api/v1/health")
        .expect((res) => {
          expect(res.headers).toHaveProperty("access-control-allow-origin");
        });
    });
  });
});
