import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AxiosError } from "axios";
import { servicesConfig } from "../../config/services.config";

@Injectable()
export class UserService {
  constructor(private readonly httpService: HttpService) {}

  async register(data: {
    name: string;
    email: string;
    password: string;
    push_token?: string;
  }) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${servicesConfig.userService.url}/register`,
          data
        )
      );
      return response.data;
    } catch (error) {
      if (error instanceof Error && "response" in error) {
        const axiosError = error as AxiosError;
        throw new HttpException(
          axiosError.response?.data || "Registration failed",
          axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      throw new HttpException(
        "User service unavailable",
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async login(data: { email: string; password: string }) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${servicesConfig.userService.url}/login`, data)
      );
      return response.data;
    } catch (error) {
      if (error instanceof Error && "response" in error) {
        const axiosError = error as AxiosError;
        throw new HttpException(
          axiosError.response?.data || "Login failed",
          axiosError.response?.status || HttpStatus.UNAUTHORIZED
        );
      }
      throw new HttpException(
        "User service unavailable",
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async getHealth() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${servicesConfig.userService.url}/health`)
      );
      return response.data;
    } catch {
      throw new HttpException(
        "User service unavailable",
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}
