import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AxiosError } from "axios";
import { servicesConfig } from "../../config/services.config";
import { CreateTemplateDto, UpdateTemplateDto } from "./dto";

@Injectable()
export class TemplateService {
  constructor(private readonly httpService: HttpService) {}

  async getAll(page = 1, limit = 10) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${servicesConfig.templateService.url}/api/v1/templates?page=${page}&limit=${limit}`
        )
      );
      return response.data;
    } catch (error: unknown) {
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as AxiosError;
        throw new HttpException(
          axiosError.response?.data || "Template service error",
          axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      throw new HttpException(
        "Template service unavailable",
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async getByCode(code: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${servicesConfig.templateService.url}/api/v1/templates/code/${code}`
        )
      );
      return response.data;
    } catch (error: unknown) {
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as AxiosError;
        throw new HttpException(
          axiosError.response?.data || "Template not found",
          axiosError.response?.status || HttpStatus.NOT_FOUND
        );
      }
      throw new HttpException(
        "Template service unavailable",
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async create(data: CreateTemplateDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${servicesConfig.templateService.url}/api/v1/templates`,
          data
        )
      );
      return response.data;
    } catch (error: unknown) {
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as AxiosError;
        throw new HttpException(
          axiosError.response?.data || "Failed to create template",
          axiosError.response?.status || HttpStatus.BAD_REQUEST
        );
      }
      throw new HttpException(
        "Template service unavailable",
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async update(id: string, data: UpdateTemplateDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.patch(
          `${servicesConfig.templateService.url}/api/v1/templates/${id}`,
          data
        )
      );
      return response.data;
    } catch (error: unknown) {
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as AxiosError;
        throw new HttpException(
          axiosError.response?.data || "Failed to update template",
          axiosError.response?.status || HttpStatus.BAD_REQUEST
        );
      }
      throw new HttpException(
        "Template service unavailable",
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async delete(id: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.delete(
          `${servicesConfig.templateService.url}/api/v1/templates/${id}`
        )
      );
      return response.data;
    } catch (error: unknown) {
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as AxiosError;
        throw new HttpException(
          axiosError.response?.data || "Failed to delete template",
          axiosError.response?.status || HttpStatus.BAD_REQUEST
        );
      }
      throw new HttpException(
        "Template service unavailable",
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}
