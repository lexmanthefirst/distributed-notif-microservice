import { Test, TestingModule } from "@nestjs/testing";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";
import { HttpException, HttpStatus } from "@nestjs/common";

describe("NotificationController", () => {
  let controller: NotificationController;
  let service: NotificationService;

  const mockNotificationService = {
    sendEmail: jest.fn(),
    sendPush: jest.fn(),
    getStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
    service = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("sendEmail", () => {
    it("should queue email notification successfully", async () => {
      const emailDto = {
        user_email: "test@example.com",
        template_code: "welcome",
        template_data: {
          user_name: "John Doe",
          app_name: "TestApp",
        },
        priority: 5,
      };

      const mockResponse = {
        success: true,
        message: "Email notification queued successfully",
        notification_id: "email_1699999999999",
      };

      mockNotificationService.sendEmail.mockResolvedValue(mockResponse);

      const result = await controller.sendEmail(emailDto);

      expect(result).toEqual(mockResponse);
      expect(service.sendEmail).toHaveBeenCalledWith(emailDto);
      expect(service.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("should handle RabbitMQ connection failure", async () => {
      const emailDto = {
        user_email: "test@example.com",
        template_code: "welcome",
        template_data: {
          user_name: "John Doe",
        },
      };

      mockNotificationService.sendEmail.mockRejectedValue(
        new HttpException(
          "Notification service unavailable",
          HttpStatus.SERVICE_UNAVAILABLE
        )
      );

      await expect(controller.sendEmail(emailDto)).rejects.toThrow(
        HttpException
      );
    });
  });

  describe("sendPush", () => {
    it("should queue push notification successfully", async () => {
      const pushDto = {
        push_token: "fcm_token_123",
        template_code: "new_message",
        template_data: {
          sender_name: "Jane Doe",
          message_preview: "Hello!",
        },
        priority: 8,
      };

      const mockResponse = {
        success: true,
        message: "Push notification queued successfully",
        notification_id: "push_1699999999999",
      };

      mockNotificationService.sendPush.mockResolvedValue(mockResponse);

      const result = await controller.sendPush(pushDto);

      expect(result).toEqual(mockResponse);
      expect(service.sendPush).toHaveBeenCalledWith(pushDto);
      expect(service.sendPush).toHaveBeenCalledTimes(1);
    });

    it("should handle invalid push token", async () => {
      const pushDto = {
        push_token: "",
        template_code: "new_message",
        template_data: {},
      };

      mockNotificationService.sendPush.mockRejectedValue(
        new HttpException("Invalid push token", HttpStatus.BAD_REQUEST)
      );

      await expect(controller.sendPush(pushDto)).rejects.toThrow(HttpException);
    });
  });

  describe("getStatus", () => {
    it("should return notification status", async () => {
      const notificationId = "email_1699999999999";
      const mockStatus = {
        notification_id: notificationId,
        status: "pending",
        message: "Status tracking not yet implemented",
      };

      mockNotificationService.getStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus(notificationId);

      expect(result).toEqual(mockStatus);
      expect(service.getStatus).toHaveBeenCalledWith(notificationId);
    });

    it("should handle non-existent notification", async () => {
      const notificationId = "invalid_id";

      mockNotificationService.getStatus.mockRejectedValue(
        new HttpException("Notification not found", HttpStatus.NOT_FOUND)
      );

      await expect(controller.getStatus(notificationId)).rejects.toThrow(
        HttpException
      );
    });
  });
});
