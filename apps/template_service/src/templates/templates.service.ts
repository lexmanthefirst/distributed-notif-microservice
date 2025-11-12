import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as Handlebars from "handlebars";
import { Template } from "./entities";
import { CreateTemplateDto, UpdateTemplateDto } from "./dto";

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>
  ) {}

  /**
   * Find all templates
   */
  async findAll(): Promise<Template[]> {
    return this.templateRepository.find({
      order: { created_at: "DESC" },
    });
  }

  /**
   * Find template by code
   */
  async findByCode(code: string): Promise<Template> {
    const template = await this.templateRepository.findOne({
      where: { code },
    });

    if (!template) {
      throw new NotFoundException(`Template with code '${code}' not found`);
    }

    return template;
  }

  /**
   * Find template by ID
   */
  async findOne(id: string): Promise<Template> {
    const template = await this.templateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID '${id}' not found`);
    }

    return template;
  }

  /**
   * Create new template
   */
  async create(createTemplateDto: CreateTemplateDto): Promise<Template> {
    // Check if code already exists
    const existing = await this.templateRepository.findOne({
      where: { code: createTemplateDto.code },
    });

    if (existing) {
      throw new ConflictException(
        `Template with code '${createTemplateDto.code}' already exists`
      );
    }

    // Validate Handlebars syntax
    this.validateHandlebarsTemplate(createTemplateDto.subject, "subject");
    this.validateHandlebarsTemplate(createTemplateDto.html_body, "html_body");
    this.validateHandlebarsTemplate(createTemplateDto.text_body, "text_body");

    // Create and save template
    const template = this.templateRepository.create(createTemplateDto);
    return this.templateRepository.save(template);
  }

  /**
   * Update existing template
   */
  async update(
    code: string,
    updateTemplateDto: UpdateTemplateDto
  ): Promise<Template> {
    const template = await this.findByCode(code);

    // Validate Handlebars syntax if fields are being updated
    if (updateTemplateDto.subject) {
      this.validateHandlebarsTemplate(updateTemplateDto.subject, "subject");
    }
    if (updateTemplateDto.html_body) {
      this.validateHandlebarsTemplate(updateTemplateDto.html_body, "html_body");
    }
    if (updateTemplateDto.text_body) {
      this.validateHandlebarsTemplate(updateTemplateDto.text_body, "text_body");
    }

    // Update template
    Object.assign(template, updateTemplateDto);
    return this.templateRepository.save(template);
  }

  /**
   * Delete template
   */
  async remove(code: string): Promise<void> {
    const template = await this.findByCode(code);
    await this.templateRepository.remove(template);
  }

  /**
   * Validate Handlebars template syntax
   */
  private validateHandlebarsTemplate(
    template: string,
    fieldName: string
  ): void {
    try {
      Handlebars.compile(template);
    } catch (error) {
      throw new BadRequestException(
        `Invalid Handlebars syntax in ${fieldName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Extract variables from Handlebars template
   * (Helper method for future use - simple regex approach)
   */
  private extractVariables(template: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = regex.exec(template)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }
}
