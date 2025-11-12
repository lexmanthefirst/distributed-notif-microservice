import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { TemplatesService } from "./templates.service";
import { CreateTemplateDto, UpdateTemplateDto } from "./dto";
import { Template } from "./entities";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

@Controller("api/v1/templates")
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  /**
   * Get all templates
   * GET /api/v1/templates
   */
  @Get()
  async findAll(): Promise<ApiResponse<Template[]>> {
    const templates = await this.templatesService.findAll();
    return {
      success: true,
      data: templates,
    };
  }

  /**
   * Get template by code
   * GET /api/v1/templates/:code
   */
  @Get(":code")
  async findOne(@Param("code") code: string): Promise<ApiResponse<Template>> {
    const template = await this.templatesService.findByCode(code);
    return {
      success: true,
      data: template,
    };
  }

  /**
   * Create new template
   * POST /api/v1/templates
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createTemplateDto: CreateTemplateDto
  ): Promise<ApiResponse<Template>> {
    const template = await this.templatesService.create(createTemplateDto);
    return {
      success: true,
      data: template,
      message: "Template created successfully",
    };
  }

  /**
   * Update template
   * PUT /api/v1/templates/:code
   */
  @Put(":code")
  async update(
    @Param("code") code: string,
    @Body() updateTemplateDto: UpdateTemplateDto
  ): Promise<ApiResponse<Template>> {
    const template = await this.templatesService.update(
      code,
      updateTemplateDto
    );
    return {
      success: true,
      data: template,
      message: "Template updated successfully",
    };
  }

  /**
   * Delete template
   * DELETE /api/v1/templates/:code
   */
  @Delete(":code")
  @HttpCode(HttpStatus.OK)
  async remove(@Param("code") code: string): Promise<ApiResponse<void>> {
    await this.templatesService.remove(code);
    return {
      success: true,
      message: "Template deleted successfully",
    };
  }
}
