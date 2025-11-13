import { Test, TestingModule } from "@nestjs/testing";
import { NotificationService } from "./notification.service";
import { HttpException, HttpStatus } from "@nestjs/common";

// Mock amqplib
jest.mock("amqplib", () => ({
  connect: jest.fn(),
}));

describe("NotificationService", () => {
  let service: NotificationService;
  let mockChannel: any;
  let mockConnection: any;

  beforeEach(async () => {
    // Setup mocks
    mockChannel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockReturnValue(true),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const amqplib = require("amqplib");
    amqplib.connect.mockResolvedValue(mockConnection);

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationService],
    }).compile();

    service = module.get<NotificationService>(NotificationService);

    // Initialize the service
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("onModuleInit", () => {
    it("should connect to RabbitMQ and create channel", async () => {
      const amqplib = require("amqplib");

      expect(amqplib.connect).toHaveBeenCalled();
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        "notifications.direct",
        "direct",
        { durable: true }
      );
    });
  });

  describe("sendEmail", () => {
    it("should publish email notification to RabbitMQ", async () => {
      const emailData = {
        user_email: "test@example.com",
        template_code: "welcome",
        template_data: {
          user_name: "John Doe",
          app_name: "TestApp",
        },
        priority: 5,
      };

      const result = await service.sendEmail(emailData);

      expect(result).toEqual({
        success: true,
        message: "Email notification queued successfully",
        notification_id: expect.stringContaining("email_"),
      });

      expect(mockChannel.publish).toHaveBeenCalledWith(
        "notifications.direct",
        "email",
        expect.any(Buffer),
        {
          persistent: true,
          contentType: "application/json",
          timestamp: expect.any(Number),
        }
      );

      // Verify the message content
      const publishCall = mockChannel.publish.mock.calls[0];
      const messageBuffer = publishCall[2];
      const message = JSON.parse(messageBuffer.toString());

      expect(message).toMatchObject({
        user_email: emailData.user_email,
        template_code: emailData.template_code,
        template_data: emailData.template_data,
        retry_count: 0,
        priority: emailData.priority,
      });
      expect(message.notification_id).toMatch(/^email_\d+$/);
    });

    it("should use custom notification_id if provided", async () => {
      const emailData = {
        notification_id: "custom_email_123",
        user_email: "test@example.com",
        template_code: "welcome",
        template_data: {},
      };

      const result = await service.sendEmail(emailData);

      expect(result.notification_id).toBe("custom_email_123");

      const publishCall = mockChannel.publish.mock.calls[0];
      const messageBuffer = publishCall[2];
      const message = JSON.parse(messageBuffer.toString());
      expect(message.notification_id).toBe("custom_email_123");
    });

    it("should use default priority if not provided", async () => {
      const emailData = {
        user_email: "test@example.com",
        template_code: "welcome",
        template_data: {},
      };

      await service.sendEmail(emailData);

      const publishCall = mockChannel.publish.mock.calls[0];
      const messageBuffer = publishCall[2];
      const message = JSON.parse(messageBuffer.toString());
      expect(message.priority).toBe(5);
    });

    it("should throw error when channel is not available", async () => {
      // Create a new service instance without calling onModuleInit
      const module: TestingModule = await Test.createTestingModule({
        providers: [NotificationService],
      }).compile();

      const newService = module.get<NotificationService>(NotificationService);
      // Don't call onModuleInit, so channel remains null

      const emailData = {
        user_email: "test@example.com",
        template_code: "welcome",
        template_data: {},
      };

      await expect(newService.sendEmail(emailData)).rejects.toThrow(
        new HttpException(
          "Notification service unavailable",
          HttpStatus.SERVICE_UNAVAILABLE
        )
      );
    });

    it("should throw error when publish fails", async () => {
      mockChannel.publish.mockReturnValueOnce(false);

      const emailData = {
        user_email: "test@example.com",
        template_code: "welcome",
        template_data: {},
      };

      await expect(service.sendEmail(emailData)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining("Failed to"),
        })
      );
    });
  });

  describe("sendPush", () => {
    it("should publish push notification to RabbitMQ", async () => {
      const pushData = {
        push_token: "fcm_token_123",
        template_code: "new_message",
        template_data: {
          sender_name: "Jane Doe",
        },
        priority: 8,
      };

      const result = await service.sendPush(pushData);

      expect(result).toEqual({
        success: true,
        message: "Push notification queued successfully",
        notification_id: expect.stringContaining("push_"),
      });

      expect(mockChannel.publish).toHaveBeenCalledWith(
        "notifications.direct",
        "push",
        expect.any(Buffer),
        {
          persistent: true,
          contentType: "application/json",
          timestamp: expect.any(Number),
        }
      );

      const publishCall = mockChannel.publish.mock.calls[0];
      const messageBuffer = publishCall[2];
      const message = JSON.parse(messageBuffer.toString());

      expect(message).toMatchObject({
        push_token: pushData.push_token,
        template_code: pushData.template_code,
        template_data: pushData.template_data,
        retry_count: 0,
        priority: pushData.priority,
      });
    });

    it("should include user_id if provided", async () => {
      const pushData = {
        user_id: "user_123",
        push_token: "fcm_token_123",
        template_code: "new_message",
        template_data: {},
      };

      await service.sendPush(pushData);

      const publishCall = mockChannel.publish.mock.calls[0];
      const messageBuffer = publishCall[2];
      const message = JSON.parse(messageBuffer.toString());
      expect(message.user_id).toBe("user_123");
    });

    it("should throw error when channel is not available", async () => {
      // Create a new service instance without calling onModuleInit
      const module: TestingModule = await Test.createTestingModule({
        providers: [NotificationService],
      }).compile();

      const newService = module.get<NotificationService>(NotificationService);
      // Don't call onModuleInit, so channel remains null

      const pushData = {
        push_token: "fcm_token_123",
        template_code: "new_message",
        template_data: {},
      };

      await expect(newService.sendPush(pushData)).rejects.toThrow(
        new HttpException(
          "Notification service unavailable",
          HttpStatus.SERVICE_UNAVAILABLE
        )
      );
    });
  });

  describe("getStatus", () => {
    it("should return pending status", async () => {
      const notificationId = "email_1699999999999";
      const result = await service.getStatus(notificationId);

      expect(result).toEqual({
        notification_id: notificationId,
        status: "pending",
        message: "Status tracking not yet implemented",
      });
    });
  });

  describe("onModuleDestroy", () => {
    it("should close channel and connection", async () => {
      await service.onModuleDestroy();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });

    it("should handle errors when closing connections", async () => {
      mockChannel.close.mockRejectedValue(new Error("Close failed"));
      mockConnection.close.mockRejectedValue(new Error("Close failed"));

      // Should not throw
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
