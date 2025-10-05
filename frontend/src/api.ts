import axios, { AxiosInstance } from 'axios';
import { API_CONFIG } from './config/api';

interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

class Api {
  private primaryApi: AxiosInstance;
  private fallbackApi: AxiosInstance;

  constructor() {
    this.primaryApi = this.createApi(API_CONFIG.primary);
    this.fallbackApi = this.createApi(API_CONFIG.fallback);
  }

  private createApi(baseURL: string): AxiosInstance {
    return axios.create({
      baseURL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }

  async get<T>(endpoint: string, params = {}): Promise<T> {
    try {
      const response = await this.primaryApi.get<ApiResponse<T>>(endpoint, { params });
      return response.data;
    } catch (error) {
      console.log('Tentando API de fallback...', error);
      const fallbackResponse = await this.fallbackApi.get<ApiResponse<T>>(endpoint, { params });
      return fallbackResponse.data;
    }
  }

  async post<T>(endpoint: string, data = {}): Promise<T> {
    try {
      const response = await this.primaryApi.post<ApiResponse<T>>(endpoint, data);
      return response.data;
    } catch (error) {
      console.log('Tentando API de fallback...', error);
      const fallbackResponse = await this.fallbackApi.post<ApiResponse<T>>(endpoint, data);
      return fallbackResponse.data;
    }
  }
}

export const api = new Api();