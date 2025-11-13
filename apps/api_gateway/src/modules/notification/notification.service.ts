import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import * as amqp from "amqplib";
import { servicesConfig } from "../../config/services.config";

interface RabbitConnection {
  createChannel(): Promise<RabbitChannel>;
  close(): Promise<void>;
}

interface RabbitChannel {
  assertExchange(
    exchange: string,
    type: string,
    options: { durable: boolean }
  ): Promise<void>;
  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options: {
      persistent: boolean;
      contentType: string;
      timestamp: number;
    }
  ): boolean;
  close(): Promise<void>;
}

@Injectable()
export class NotificationService {
  private connection: RabbitConnection | null = null;
  private channel: RabbitChannel | null = null;

  async onModuleInit() {
    await this.connectRabbitMQ();
  }

  async onModuleDestroy() {
    await this.closeRabbitMQ();
  }

  private async connectRabbitMQ() {
    try {
      const conn = (await amqp.connect(
        servicesConfig.rabbitmq.url
      )) as unknown as RabbitConnection;
      this.connection = conn;
      const ch = (await conn.createChannel()) as unknown as RabbitChannel;
      this.channel = ch;

      // Declare exchange
      await ch.assertExchange("notifications.direct", "direct", {
        durable: true,
      });

      console.log("✅ API Gateway connected to RabbitMQ");
    } catch (error) {
      console.error("❌ Failed to connect to RabbitMQ:", error);
    }
  }

  private async closeRabbitMQ() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch (error) {
      console.error("Error closing RabbitMQ:", error);
    }
  }

  async sendEmail(data: {
    notification_id?: string;
    user_id?: string;
    user_email: string;
    template_code: string;
    template_data: Record<string, unknown>;
    priority?: number;
  }) {
    if (!this.channel) {
      throw new HttpException(
        "Notification service unavailable",
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    try {
      const notificationId = data.notification_id || `email_${Date.now()}`;
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const message = {
        notification_id: notificationId,
        user_id: data.user_id || "anonymous",
        user_email: data.user_email,
        template_code: data.template_code,
        variables: data.template_data,
        priority: data.priority || 5,
        request_id: requestId,
        retry_count: 0,
        created_at: new Date().toISOString(),
      };

      const success = this.channel.publish(
        "notifications.direct",
        "email",
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          contentType: "application/json",
          timestamp: Date.now(),
        }
      );

      if (success) {
        return {
          success: true,
          message: "Email notification queued successfully",
          notification_id: notificationId,
          request_id: requestId,
        };
      } else {
        throw new HttpException(
          "Failed to queue email notification",
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    } catch (error) {
      console.error("Error sending email notification:", error);
      throw new HttpException(
        "Failed to send email notification",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async sendPush(data: {
    notification_id?: string;
    user_id?: string;
    push_token: string;
    template_code: string;
    template_data: Record<string, unknown>;
    priority?: number;
  }) {
    if (!this.channel) {
      throw new HttpException(
        "Notification service unavailable",
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    try {
      const message = {
        notification_id: data.notification_id || `push_${Date.now()}`,
        user_id: data.user_id,
        push_token: data.push_token,
        template_code: data.template_code,
        template_data: data.template_data,
        retry_count: 0,
        priority: data.priority || 5,
      };

      const success = this.channel.publish(
        "notifications.direct",
        "push",
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          contentType: "application/json",
          timestamp: Date.now(),
        }
      );

      if (success) {
        return {
          success: true,
          message: "Push notification queued successfully",
          notification_id: message.notification_id,
        };
      } else {
        throw new HttpException(
          "Failed to queue push notification",
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    } catch (error) {
      console.error("Error sending push notification:", error);
      throw new HttpException(
        "Failed to send push notification",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getStatus(notificationId: string) {
    // This would query Redis or a status service
    // For now, return a placeholder
    return {
      notification_id: notificationId,
      status: "pending",
      message: "Status tracking not yet implemented",
    };
  }
}
