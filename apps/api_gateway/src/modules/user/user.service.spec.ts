import { Test, TestingModule } from "@nestjs/testing";
import { HttpService } from "@nestjs/axios";
import { UserService } from "./user.service";
import { of, throwError } from "rxjs";
import { AxiosResponse, AxiosError } from "axios";
import { HttpException } from "@nestjs/common";

describe("UserService", () => {
  let service: UserService;
  let httpService: HttpService;

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("register", () => {
    it("should register a user successfully", async () => {
      const registerDto = {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
      };

      const mockResponse: AxiosResponse = {
        data: {
          id: 1,
          name: "John Doe",
          email: "john@example.com",
          created_at: new Date().toISOString(),
        },
        status: 201,
        statusText: "Created",
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.register(registerDto);

      expect(result).toEqual(mockResponse.data);
      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining("/register"),
        registerDto
      );
    });

    it("should handle duplicate email error", async () => {
      const registerDto = {
        name: "John Doe",
        email: "existing@example.com",
        password: "password123",
      };

      const axiosError = {
        response: {
          status: 409,
          data: { error: "Email already exists" },
        },
        isAxiosError: true,
      } as AxiosError;

      mockHttpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(service.register(registerDto)).rejects.toThrow(
        HttpException
      );
    });

    it("should handle service unavailable", async () => {
      const registerDto = {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
      };

      const axiosError = {
        code: "ECONNREFUSED",
        isAxiosError: true,
      } as AxiosError;

      mockHttpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(service.register(registerDto)).rejects.toThrow(
        HttpException
      );
    });
  });

  describe("login", () => {
    it("should login successfully", async () => {
      const loginDto = {
        email: "john@example.com",
        password: "password123",
      };

      const mockResponse: AxiosResponse = {
        data: {
          id: 1,
          name: "John Doe",
          email: "john@example.com",
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const result = await service.login(loginDto);

      expect(result).toEqual(mockResponse.data);
      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining("/login"),
        loginDto
      );
    });

    it("should handle invalid credentials", async () => {
      const loginDto = {
        email: "john@example.com",
        password: "wrongpassword",
      };

      const axiosError = {
        response: {
          status: 401,
          data: { error: "Invalid credentials" },
        },
        isAxiosError: true,
      } as AxiosError;

      mockHttpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(service.login(loginDto)).rejects.toThrow(HttpException);
    });
  });
});
