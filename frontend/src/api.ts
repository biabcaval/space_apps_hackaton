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
    // Tentar a API primária (ngrok) primeiro
    try {
      console.log('Tentando API primária:', API_CONFIG.primary);
      const response = await this.primaryApi.get<ApiResponse<T>>(endpoint, { params });
      console.log('Sucesso com API primária');
      return response.data;
    } catch (primaryError) {
      console.error('Erro na API primária:', primaryError);
      
      // Tentar a API de fallback (localhost) em caso de erro
      try {
        console.log('Tentando API de fallback:', API_CONFIG.fallback);
        const fallbackResponse = await this.fallbackApi.get<ApiResponse<T>>(endpoint, { params });
        console.log('Sucesso com API de fallback');
        return fallbackResponse.data;
      } catch (fallbackError) {
        console.error('Erro na API de fallback:', fallbackError);
        throw new Error('Ambas as APIs falharam');
      }
    }
  }

  async post<T>(endpoint: string, data = {}): Promise<T> {
    // Tentar a API primária (ngrok) primeiro
    try {
      console.log('Tentando API primária:', API_CONFIG.primary);
      const response = await this.primaryApi.post<ApiResponse<T>>(endpoint, data);
      console.log('Sucesso com API primária');
      return response.data;
    } catch (primaryError) {
      console.error('Erro na API primária:', primaryError);
      
      // Tentar a API de fallback (localhost) em caso de erro
      try {
        console.log('Tentando API de fallback:', API_CONFIG.fallback);
        const fallbackResponse = await this.fallbackApi.post<ApiResponse<T>>(endpoint, data);
        console.log('Sucesso com API de fallback');
        return fallbackResponse.data;
      } catch (fallbackError) {
        console.error('Erro na API de fallback:', fallbackError);
        throw new Error('Ambas as APIs falharam');
      }
    }
  }
}

export const api = new Api();