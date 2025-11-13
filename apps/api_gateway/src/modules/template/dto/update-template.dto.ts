import { IsOptional, IsString, IsEnum } from "class-validator";
import { NotificationType } from "./create-template.dto";

export class UpdateTemplateDto {
  @IsOptional()
  @IsString({ message: "Template code must be a string" })
  code?: string;

  @IsOptional()
  @IsString({ message: "Template name must be a string" })
  name?: string;

  @IsOptional()
  @IsString({ message: "Subject must be a string" })
  subject?: string;

  @IsOptional()
  @IsString({ message: "Body must be a string" })
  body?: string;

  @IsOptional()
  @IsEnum(NotificationType, {
    message: "Notification type must be email, push, or sms",
  })
  notification_type?: NotificationType;

  @IsOptional()
  @IsString({ message: "Description must be a string" })
  description?: string;
}
