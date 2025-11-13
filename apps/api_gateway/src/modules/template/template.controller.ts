import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { TemplateService } from "./template.service";
import { CreateTemplateDto, UpdateTemplateDto } from "./dto";

@Controller("templates")
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Get()
  async getAll(@Query("page") page?: number, @Query("limit") limit?: number) {
    return this.templateService.getAll(page, limit);
  }

  @Get("code/:code")
  async getByCode(@Param("code") code: string) {
    return this.templateService.getByCode(code);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createTemplateDto: CreateTemplateDto) {
    return this.templateService.create(createTemplateDto);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() updateTemplateDto: UpdateTemplateDto
  ) {
    return this.templateService.update(id, updateTemplateDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id") id: string) {
    return this.templateService.delete(id);
  }
}
