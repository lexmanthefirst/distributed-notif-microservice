import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsObject,
  IsOptional,
  IsInt,
  Min,
  Max,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * Notification Type Enum
 * Defines available notification channels
 */
export enum NotificationType {
  EMAIL = "email",
  PUSH = "push",
}

/**
 * User Data for template variables
 * Contains dynamic data to be inserted into templates
 */
export class UserDataDto {
  @IsNotEmpty({ message: "User name is required" })
  @IsString({ message: "Name must be a string" })
  name: string;

  @IsNotEmpty({ message: "Link is required" })
  @IsString({ message: "Link must be a string" })
  link: string;

  @IsOptional()
  @IsObject({ message: "Meta must be an object" })
  meta?: Record<string, unknown>;
}

/**
 * Main DTO for creating notifications
 * This is the unified notification endpoint
 */
export class CreateNotificationDto {
  @IsNotEmpty({ message: "Notification type is required" })
  @IsEnum(NotificationType, {
    message: "Notification type must be either 'email' or 'push'",
  })
  notification_type: NotificationType;

  @IsNotEmpty({ message: "User ID is required" })
  @IsUUID("4", { message: "User ID must be a valid UUID" })
  user_id: string;

  @IsNotEmpty({ message: "Template code is required" })
  @IsString({ message: "Template code must be a string" })
  template_code: string;

  @IsNotEmpty({ message: "Variables are required" })
  @ValidateNested()
  @Type(() => UserDataDto)
  variables: UserDataDto;

  @IsNotEmpty({ message: "Request ID is required for idempotency" })
  @IsString({ message: "Request ID must be a string" })
  request_id: string;

  @IsOptional()
  @IsInt({ message: "Priority must be an integer" })
  @Min(1, { message: "Priority must be at least 1" })
  @Max(10, { message: "Priority must be at most 10" })
  priority?: number;

  @IsOptional()
  @IsObject({ message: "Metadata must be an object" })
  metadata?: Record<string, unknown>;
}
