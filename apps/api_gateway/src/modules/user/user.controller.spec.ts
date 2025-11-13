import { Test, TestingModule } from "@nestjs/testing";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { HttpException, HttpStatus } from "@nestjs/common";

describe("UserController", () => {
  let controller: UserController;
  let service: UserService;

  const mockUserService = {
    register: jest.fn(),
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const registerDto = {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
      };

      const mockResponse = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        created_at: new Date().toISOString(),
      };

      mockUserService.register.mockResolvedValue(mockResponse);

      const result = await controller.register(registerDto);

      expect(result).toEqual(mockResponse);
      expect(service.register).toHaveBeenCalledWith(registerDto);
      expect(service.register).toHaveBeenCalledTimes(1);
    });

    it("should throw error when registration fails", async () => {
      const registerDto = {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
      };

      mockUserService.register.mockRejectedValue(
        new HttpException("Email already exists", HttpStatus.CONFLICT)
      );

      await expect(controller.register(registerDto)).rejects.toThrow(
        HttpException
      );
      expect(service.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe("login", () => {
    it("should login user successfully", async () => {
      const loginDto = {
        email: "john@example.com",
        password: "password123",
      };

      const mockResponse = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
      };

      mockUserService.login.mockResolvedValue(mockResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(mockResponse);
      expect(service.login).toHaveBeenCalledWith(loginDto);
      expect(service.login).toHaveBeenCalledTimes(1);
    });

    it("should throw error for invalid credentials", async () => {
      const loginDto = {
        email: "john@example.com",
        password: "wrongpassword",
      };

      mockUserService.login.mockRejectedValue(
        new HttpException("Invalid credentials", HttpStatus.UNAUTHORIZED)
      );

      await expect(controller.login(loginDto)).rejects.toThrow(HttpException);
      expect(service.login).toHaveBeenCalledWith(loginDto);
    });
  });
});
