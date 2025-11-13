import { IsNotEmpty, IsString, IsOptional, IsEnum } from "class-validator";

export enum NotificationType {
  EMAIL = "email",
  PUSH = "push",
  SMS = "sms",
}

export class CreateTemplateDto {
  @IsNotEmpty({ message: "Template code is required" })
  @IsString({ message: "Template code must be a string" })
  code: string;

  @IsNotEmpty({ message: "Template name is required" })
  @IsString({ message: "Template name must be a string" })
  name: string;

  @IsNotEmpty({ message: "Subject is required" })
  @IsString({ message: "Subject must be a string" })
  subject: string;

  @IsNotEmpty({ message: "Body is required" })
  @IsString({ message: "Body must be a string" })
  body: string;

  @IsNotEmpty({ message: "Notification type is required" })
  @IsEnum(NotificationType, {
    message: "Notification type must be email, push, or sms",
  })
  notification_type: NotificationType;

  @IsOptional()
  @IsString({ message: "Description must be a string" })
  description?: string;
}
