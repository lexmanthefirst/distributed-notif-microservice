import {
  IsString,
  IsArray,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(500)
  subject!: string;

  @IsString()
  html_body!: string;

  @IsString()
  text_body!: string;

  @IsArray()
  @IsString({ each: true })
  variables!: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
