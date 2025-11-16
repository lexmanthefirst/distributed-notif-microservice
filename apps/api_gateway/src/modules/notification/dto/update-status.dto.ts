import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsISO8601,
} from "class-validator";

/**
 * Notification Status Enum
 */
export enum NotificationStatus {
  DELIVERED = "delivered",
  PENDING = "pending",
  FAILED = "failed",
}

/**
 * Update Notification Status DTO
 */
export class UpdateNotificationStatusDto {
  @IsNotEmpty({ message: "Notification ID is required" })
  @IsString({ message: "Notification ID must be a string" })
  notification_id: string;

  @IsNotEmpty({ message: "Status is required" })
  @IsEnum(NotificationStatus, {
    message: "Status must be 'delivered', 'pending', or 'failed'",
  })
  status: NotificationStatus;

  @IsOptional()
  @IsISO8601({}, { message: "Timestamp must be a valid ISO 8601 date" })
  timestamp?: string;

  @IsOptional()
  @IsString({ message: "Error must be a string" })
  error?: string;
}
