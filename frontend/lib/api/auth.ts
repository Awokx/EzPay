import { apiClient } from '@/lib/api-client';
import { merchantsApi, type CreateMerchantRequest, type Merchant, normalizeMerchant } from './merchants';

interface LoginResponse {
  token?: string;
  access_token?: string;
  merchant?: Parameters<typeof normalizeMerchant>[0];
}

export const authApi = {
  register(data: CreateMerchantRequest): Promise<Merchant> {
    return merchantsApi.create(data);
  },

  async login(email: string, password: string): Promise<{ token: string; merchant?: Merchant }> {
    const response = await apiClient.post<LoginResponse>('/api/auth/login', { email, password });
    const token = response.token ?? response.access_token;
    if (!token) throw new Error('The server did not return an access token.');
    apiClient.setAuthToken(token);
    return {
      token,
      merchant: response.merchant ? normalizeMerchant(response.merchant) : undefined,
    };
  },

  getCurrentMerchant(): Promise<Merchant> {
    return merchantsApi.getCurrent();
  },

  logout(): void {
    apiClient.removeAuthToken();
  },
};