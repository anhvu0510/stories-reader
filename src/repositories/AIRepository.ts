import { apiClient } from '../services/apiClient';
import { AIToken, AIQuota, QuotaResponse } from '../shared/types';

export class AIRepository {
  static async getTokens(platform?: string): Promise<{ tokens: AIToken[] }> {
    const query = platform ? `?platform=${encodeURIComponent(platform)}` : '';
    return apiClient.get<{ tokens: AIToken[] }>(`/api/ai-token${query}`);
  }

  static async createToken(tokenData: any): Promise<AIToken> {
    return apiClient.post<AIToken>('/api/ai-token', tokenData);
  }

  static async updateToken(id: string, tokenData: any): Promise<AIToken> {
    return apiClient.put<AIToken>(`/api/ai-token/${id}`, tokenData);
  }

  static async deleteToken(id: string): Promise<void> {
    return apiClient.delete(`/api/ai-token/${id}`);
  }

  static async getQuotas(): Promise<QuotaResponse> {
    return apiClient.get<QuotaResponse>('/api/quota');
  }

  static async updateQuotaConfig(config: any): Promise<void> {
    return apiClient.put('/api/quota/config', config);
  }

  static async createQuota(quotaData: any): Promise<AIQuota> {
    return apiClient.post<AIQuota>('/api/quota', quotaData);
  }

  static async deleteQuota(id: string): Promise<void> {
    return apiClient.delete(`/api/quota/${id}`);
  }

  static async detectProperNouns(params: { bookId: string; model?: string; maxChars?: number }): Promise<any> {
    return apiClient.post('/stories/detect-proper-nouns', params);
  }

  static async translateChineseTitles(params: { bookId?: string; batchSize?: number; limitChapter?: number; model?: string; platform?: string }): Promise<any> {
    return apiClient.post('/stories/translate-chinese-titles', params);
  }
}

