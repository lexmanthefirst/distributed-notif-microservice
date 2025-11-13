import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
} from "class-validator";

export class SendEmailDto {
  @IsOptional()
  @IsString({ message: "Notification ID must be a string" })
  notification_id?: string;

  @IsOptional()
  @IsString({ message: "User ID must be a string" })
  user_id?: string;

  @IsNotEmpty({ message: "User email is required" })
  @IsEmail({}, { message: "User email must be a valid email address" })
  user_email: string;

  @IsNotEmpty({ message: "Template code is required" })
  @IsString({ message: "Template code must be a string" })
  template_code: string;

  @IsNotEmpty({ message: "Template data is required" })
  @IsObject({ message: "Template data must be an object" })
  template_data: Record<string, unknown>;

  @IsOptional()
  @IsInt({ message: "Priority must be an integer" })
  @Min(1, { message: "Priority must be at least 1" })
  @Max(10, { message: "Priority must be at most 10" })
  priority?: number;
}
