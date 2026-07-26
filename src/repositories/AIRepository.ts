import { apiClient } from '../services/apiClient';
import { AIToken, AIQuota, QuotaResponse } from '../shared/types';

export class AIRepository {
  static async getTokens(platform?: string): Promise<{ tokens: AIToken[] }> {
    const query = platform ? `?platform=${encodeURIComponent(platform)}` : '';
    return apiClient.get<{ tokens: AIToken[] }>(`/api/v1/tokens${query}`);
  }

  static async createToken(tokenData: any): Promise<AIToken> {
    return apiClient.post<AIToken>('/api/v1/tokens', tokenData);
  }

  static async updateToken(id: string, tokenData: any): Promise<AIToken> {
    return apiClient.put<AIToken>(`/api/v1/tokens/${id}`, tokenData);
  }

  static async deleteToken(id: string): Promise<void> {
    return apiClient.delete(`/api/v1/tokens/${id}`);
  }

  static async getQuotas(): Promise<QuotaResponse> {
    return apiClient.get<QuotaResponse>('/api/v1/quotas');
  }

  static async updateQuotaConfig(config: any): Promise<void> {
    return apiClient.put('/api/v1/quotas/config', config);
  }

  static async createQuota(quotaData: any): Promise<AIQuota> {
    return apiClient.post<AIQuota>('/api/v1/quotas', quotaData);
  }

  static async deleteQuota(id: string): Promise<void> {
    return apiClient.delete(`/api/v1/quotas/${id}`);
  }
}
