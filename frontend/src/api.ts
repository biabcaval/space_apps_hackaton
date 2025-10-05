import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_CONFIG } from './config/api';

interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

class Api {
  private primaryApi: AxiosInstance;
  private fallbackApi: AxiosInstance;
  private readonly TIMEOUT = 5000; // 5 segundos

  constructor() {
    // Configuração da API primária (ngrok)
    this.primaryApi = axios.create({
      baseURL: API_CONFIG.primary,
      timeout: this.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // Configuração da API de fallback (localhost)
    this.fallbackApi = axios.create({
      baseURL: API_CONFIG.fallback,
      timeout: this.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // Log das configurações no momento da inicialização
    console.log('API Initialized:', {
      primary: this.primaryApi.defaults.baseURL,
      fallback: this.fallbackApi.defaults.baseURL
    });
  }

  private isAxiosError(error: any): error is AxiosError {
    return error.isAxiosError === true;
  }

  private async tryRequest<T>(
    api: AxiosInstance, 
    method: 'get' | 'post',
    endpoint: string,
    data?: any
  ): Promise<T> {
    try {
      const startTime = Date.now();
      const queryParams = method === 'get' ? this.buildQueryString(data) : '';
      const fullUrl = `${endpoint}${queryParams}`;
      
      const response = method === 'get' 
        ? await api.get<ApiResponse<T>>(fullUrl)
        : await api.post<ApiResponse<T>>(endpoint, data);
      
      const duration = Date.now() - startTime;
      console.log(`Request to ${api.defaults.baseURL}${fullUrl} succeeded in ${duration}ms`);
      
      return response.data.data;
    } catch (error) {
      if (this.isAxiosError(error)) {
        console.error(`Request failed for ${api.defaults.baseURL}${endpoint}:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        });
      } else {
        console.error(`Unknown error for ${api.defaults.baseURL}${endpoint}:`, error);
      }
      throw error;
    }
  }
  
  private buildQueryString(params: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) return '';
    
    const queryParams = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    return `?${queryParams}`;
  }

  async get<T>(endpoint: string, params = {}): Promise<T> {
    console.log('Starting GET request:', {
      endpoint,
      params,
      primaryUrl: this.primaryApi.defaults.baseURL,
      fallbackUrl: this.fallbackApi.defaults.baseURL,
      fullUrl: `${this.primaryApi.defaults.baseURL}${endpoint}${this.buildQueryString(params)}`
    });

    try {
      // Tenta primeiro a API do ngrok
      return await this.tryRequest<T>(this.primaryApi, 'get', endpoint, params);
    } catch (primaryError) {
      console.warn('Primary API failed, trying fallback...');
      
      try {
        // Se falhar, tenta a API local
        return await this.tryRequest<T>(this.fallbackApi, 'get', endpoint, params);
      } catch (fallbackError) {
        console.error('Both APIs failed');
        throw new Error('Todas as tentativas de API falharam');
      }
    }
  }

  async post<T>(endpoint: string, data = {}): Promise<T> {
    console.log('Starting POST request:', {
      endpoint,
      primaryUrl: this.primaryApi.defaults.baseURL,
      fallbackUrl: this.fallbackApi.defaults.baseURL
    });

    try {
      // Tenta primeiro a API do ngrok
      return await this.tryRequest<T>(this.primaryApi, 'post', endpoint, data);
    } catch (primaryError) {
      console.warn('Primary API failed, trying fallback...');
      
      try {
        // Se falhar, tenta a API local
        return await this.tryRequest<T>(this.fallbackApi, 'post', endpoint, data);
      } catch (fallbackError) {
        console.error('Both APIs failed');
        throw new Error('Todas as tentativas de API falharam');
      }
    }
  }
}

// Exporta uma única instância da API
export const api = new Api();