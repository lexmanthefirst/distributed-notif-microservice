import { Test, TestingModule } from "@nestjs/testing";
import { TemplateController } from "./template.controller";
import { TemplateService } from "./template.service";
import { HttpException, HttpStatus } from "@nestjs/common";
import { NotificationType, CreateTemplateDto } from "./dto";

describe("TemplateController", () => {
  let controller: TemplateController;
  let service: TemplateService;

  const mockTemplateService = {
    getAll: jest.fn(),
    getByCode: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TemplateController],
      providers: [
        {
          provide: TemplateService,
          useValue: mockTemplateService,
        },
      ],
    }).compile();

    controller = module.get<TemplateController>(TemplateController);
    service = module.get<TemplateService>(TemplateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getAll", () => {
    it("should return paginated templates", async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            code: "welcome",
            name: "Welcome Email",
            subject: "Welcome!",
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockTemplateService.getAll.mockResolvedValue(mockResponse);

      const result = await controller.getAll(1, 10);

      expect(result).toEqual(mockResponse);
      expect(service.getAll).toHaveBeenCalledWith(1, 10);
    });

    it("should use default pagination values", async () => {
      const mockResponse = {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      };

      mockTemplateService.getAll.mockResolvedValue(mockResponse);

      await controller.getAll();

      expect(service.getAll).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe("getByCode", () => {
    it("should return template by code", async () => {
      const mockTemplate = {
        id: 1,
        code: "welcome",
        name: "Welcome Email",
        subject: "Welcome to {{app_name}}",
      };

      mockTemplateService.getByCode.mockResolvedValue(mockTemplate);

      const result = await controller.getByCode("welcome");

      expect(result).toEqual(mockTemplate);
      expect(service.getByCode).toHaveBeenCalledWith("welcome");
    });

    it("should handle template not found", async () => {
      mockTemplateService.getByCode.mockRejectedValue(
        new HttpException("Template not found", HttpStatus.NOT_FOUND)
      );

      await expect(controller.getByCode("nonexistent")).rejects.toThrow(
        HttpException
      );
    });
  });

  describe("create", () => {
    it("should create a new template", async () => {
      const createDto: CreateTemplateDto = {
        code: "welcome",
        name: "Welcome Email",
        subject: "Welcome!",
        body: "<h1>Welcome</h1>",
        notification_type: NotificationType.EMAIL,
      };

      const mockResponse = {
        id: 1,
        ...createDto,
        created_at: new Date().toISOString(),
      };

      mockTemplateService.create.mockResolvedValue(mockResponse);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockResponse);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    it("should handle duplicate template code", async () => {
      const createDto: CreateTemplateDto = {
        code: "existing",
        name: "Existing Template",
        subject: "Test",
        body: "<p>Test</p>",
        notification_type: NotificationType.EMAIL,
      };

      mockTemplateService.create.mockRejectedValue(
        new HttpException("Template code already exists", HttpStatus.CONFLICT)
      );

      await expect(controller.create(createDto)).rejects.toThrow(HttpException);
    });
  });

  describe("update", () => {
    it("should update a template", async () => {
      const updateDto = {
        subject: "Updated Subject",
        body: "<h1>Updated</h1>",
      };

      const mockResponse = {
        id: 1,
        code: "welcome",
        name: "Welcome Email",
        ...updateDto,
        updated_at: new Date().toISOString(),
      };

      mockTemplateService.update.mockResolvedValue(mockResponse);

      const result = await controller.update("1", updateDto);

      expect(result).toEqual(mockResponse);
      expect(service.update).toHaveBeenCalledWith("1", updateDto);
    });

    it("should handle template not found on update", async () => {
      const updateDto = {
        subject: "Updated Subject",
      };

      mockTemplateService.update.mockRejectedValue(
        new HttpException("Template not found", HttpStatus.NOT_FOUND)
      );

      await expect(controller.update("999", updateDto)).rejects.toThrow(
        HttpException
      );
    });
  });

  describe("delete", () => {
    it("should delete a template", async () => {
      const mockResponse = {
        message: "Template deleted successfully",
      };

      mockTemplateService.delete.mockResolvedValue(mockResponse);

      const result = await controller.delete("1");

      expect(result).toEqual(mockResponse);
      expect(service.delete).toHaveBeenCalledWith("1");
    });

    it("should handle template not found on delete", async () => {
      mockTemplateService.delete.mockRejectedValue(
        new HttpException("Template not found", HttpStatus.NOT_FOUND)
      );

      await expect(controller.delete("999")).rejects.toThrow(HttpException);
    });
  });
});
