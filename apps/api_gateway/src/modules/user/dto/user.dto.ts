import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * User Preferences for notification channels
 */
export class UserPreferencesDto {
  @IsBoolean({ message: "Email preference must be a boolean" })
  email: boolean;

  @IsBoolean({ message: "Push preference must be a boolean" })
  push: boolean;
}

/**
 * Create User DTO
 */
export class CreateUserDto {
  @IsNotEmpty({ message: "Name is required" })
  @IsString({ message: "Name must be a string" })
  name: string;

  @IsNotEmpty({ message: "Email is required" })
  @IsEmail({}, { message: "Email must be a valid email address" })
  email: string;

  @IsNotEmpty({ message: "Password is required" })
  @MinLength(8, { message: "Password must be at least 8 characters" })
  password: string;

  @IsOptional()
  @IsString({ message: "Push token must be a string" })
  push_token?: string;

  @IsNotEmpty({ message: "Preferences are required" })
  @ValidateNested()
  @Type(() => UserPreferencesDto)
  preferences: UserPreferencesDto;
}

/**
 * Update User Preferences DTO
 */
export class UpdatePreferencesDto {
  @ValidateNested()
  @Type(() => UserPreferencesDto)
  preferences: UserPreferencesDto;
}

/**
 * Update Push Token DTO
 */
export class UpdatePushTokenDto {
  @IsNotEmpty({ message: "Push token is required" })
  @IsString({ message: "Push token must be a string" })
  push_token: string;
}
