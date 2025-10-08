import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_CONFIG } from './config/api';

interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  message?: string;
}

class Api {
  private primaryApi: AxiosInstance;
  private fallbackApi: AxiosInstance;
  private readonly TIMEOUT = 5000; // 5 seconds
  private readonly LONG_TIMEOUT = 80000; // 60 seconds for heavy operations (TEMPO, Daymet)

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
    data?: any,
    customTimeout?: number
  ): Promise<T> {
    try {
      const startTime = Date.now();
      const config = customTimeout ? { timeout: customTimeout } : {};
      
      let response;
      if (method === 'get') {
        // Para GET, extrair os parâmetros do objeto params
        const queryParams = data?.params ? this.buildQueryString(data.params) : this.buildQueryString(data);
        const fullUrl = `${endpoint}${queryParams}`;
        response = await api.get<T>(fullUrl, config);
      } else {
        // Para POST, use body data
        response = await api.post<T>(endpoint, data, config);
      }
      
      const duration = Date.now() - startTime;
      console.log(`Request to ${api.defaults.baseURL}${endpoint} succeeded in ${duration}ms`);
      
      return response.data;
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
      .filter(([_, value]) => value !== undefined) // Remove parâmetros undefined
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
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
      data,
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

  async postLongRunning<T>(endpoint: string, data = {}): Promise<T> {
    console.log('Starting LONG-RUNNING POST request:', {
      endpoint,
      data,
      timeout: `${this.LONG_TIMEOUT}ms`,
      primaryUrl: this.primaryApi.defaults.baseURL,
      fallbackUrl: this.fallbackApi.defaults.baseURL
    });

    try {
      // Tenta primeiro a API do ngrok com timeout longo
      return await this.tryRequest<T>(this.primaryApi, 'post', endpoint, data, this.LONG_TIMEOUT);
    } catch (primaryError) {
      console.warn('Primary API failed, trying fallback with long timeout...');

      try {
        // Se falhar, tenta a API local com timeout longo
        return await this.tryRequest<T>(this.fallbackApi, 'post', endpoint, data, this.LONG_TIMEOUT);
      } catch (fallbackError) {
        console.error('Both APIs failed');
        throw new Error('Todas as tentativas de API falharam');
      }
    }
  }

  // Method for heavy operations that need longer timeout (TEMPO, Daymet)
  async getLongRunning<T>(endpoint: string, params = {}): Promise<T> {
    console.log('Starting LONG-RUNNING GET request:', {
      endpoint,
      params,
      timeout: `${this.LONG_TIMEOUT}ms`,
      primaryUrl: this.primaryApi.defaults.baseURL,
      fallbackUrl: this.fallbackApi.defaults.baseURL,
      fullUrl: `${this.primaryApi.defaults.baseURL}${endpoint}${this.buildQueryString(params)}`
    });

    try {
      // Tenta primeiro a API do ngrok com timeout longo
      return await this.tryRequest<T>(this.primaryApi, 'get', endpoint, { params }, this.LONG_TIMEOUT);
    } catch (primaryError) {
      console.warn('Primary API failed, trying fallback with long timeout...');

      try {
        // Se falhar, tenta a API local com timeout longo
        return await this.tryRequest<T>(this.fallbackApi, 'get', endpoint, { params }, this.LONG_TIMEOUT);
      } catch (fallbackError) {
        console.error('Both APIs failed');
        throw new Error('Todas as tentativas de API falharam');
      }
    }
}
}

// Exporta uma única instância da API
export const api = new Api();