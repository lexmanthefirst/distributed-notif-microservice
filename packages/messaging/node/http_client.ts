import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import CircuitBreaker from "opossum";

interface ServiceConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
}

interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
}

/**
 * HTTP Client with Circuit Breaker, Retry Logic, and Idempotency
 * Use for: Synchronous request-response patterns (user queries, template fetching)
 */
export class ServiceClient {
  private client: AxiosInstance;
  private breaker: CircuitBreaker;
  private serviceName: string;

  constructor(
    serviceName: string,
    config: ServiceConfig,
    breakerOptions?: CircuitBreakerOptions
  ) {
    this.serviceName = serviceName;

    // Create axios instance with defaults
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 5000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `notif-service/${serviceName}`,
      },
    });

    // Add request interceptor for idempotency
    this.client.interceptors.request.use((config) => {
      if (!config.headers["X-Request-ID"]) {
        config.headers["X-Request-ID"] = this.generateRequestId();
      }
      config.headers["X-Service-Name"] = this.serviceName;
      return config;
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        console.error(`[${this.serviceName}] Request failed:`, {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.message,
        });
        throw error;
      }
    );

    // Create circuit breaker
    this.breaker = new CircuitBreaker(this.makeRequest.bind(this), {
      timeout: breakerOptions?.timeout || 5000,
      errorThresholdPercentage: breakerOptions?.errorThresholdPercentage || 50,
      resetTimeout: breakerOptions?.resetTimeout || 30000,
    });

    // Circuit breaker events
    this.breaker.on("open", () =>
      console.warn(`[${this.serviceName}] Circuit breaker opened`)
    );
    this.breaker.on("halfOpen", () =>
      console.log(`[${this.serviceName}] Circuit breaker half-open`)
    );
    this.breaker.on("close", () =>
      console.log(`[${this.serviceName}] Circuit breaker closed`)
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async makeRequest(config: AxiosRequestConfig) {
    return this.client.request(config);
  }

  /**
   * Make HTTP request with circuit breaker and retry logic
   */
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.breaker.fire(config);
      return response.data;
    } catch (error) {
      if (error.message === "Breaker is open") {
        throw new Error(
          `Service ${this.serviceName} is unavailable (circuit breaker open)`
        );
      }
      throw error;
    }
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "GET", url });
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>({ ...config, method: "POST", url, data });
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>({ ...config, method: "PUT", url, data });
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>({ ...config, method: "PATCH", url, data });
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "DELETE", url });
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.get("/health", { timeout: 3000 });
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Pre-configured service clients for the notification system
 */
export const createServiceClients = () => {
  return {
    userService: new ServiceClient("user_service", {
      baseURL: process.env.USER_SERVICE_URL || "http://localhost:4001",
      timeout: 5000,
    }),

    templateService: new ServiceClient("template_service", {
      baseURL: process.env.TEMPLATE_SERVICE_URL || "http://localhost:4002",
      timeout: 3000,
    }),

    pushService: new ServiceClient("push_service", {
      baseURL: process.env.PUSH_SERVICE_URL || "http://localhost:4100",
      timeout: 5000,
    }),
  };
};

export default ServiceClient;
