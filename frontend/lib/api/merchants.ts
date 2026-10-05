/**
 * Merchant API Service
 * Handles all merchant-related API calls
 */

import { apiClient } from './client';

interface MerchantResponse {
  id: string;
  name: string;
  email: string;
  wallet_address: string;
  payout_method: 'wallet' | 'bank' | 'Wallet' | 'Bank';
  bank_account?: string | null;
  bank_routing_number?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Merchant {
  id: string;
  name: string;
  email: string;
  walletAddress: string;
  payoutMethod: 'wallet' | 'bank';
  bankAccount?: string;
  bankRoutingNumber?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function normalizeMerchant(merchant: MerchantResponse): Merchant {
  return {
    id: merchant.id,
    name: merchant.name,
    email: merchant.email,
    walletAddress: merchant.wallet_address,
    payoutMethod: merchant.payout_method.toLowerCase() as Merchant['payoutMethod'],
    bankAccount: merchant.bank_account ?? undefined,
    bankRoutingNumber: merchant.bank_routing_number ?? undefined,
    isActive: merchant.is_active,
    createdAt: merchant.created_at,
    updatedAt: merchant.updated_at,
  };
}

export interface CreateMerchantRequest {
  name: string;
  email: string;
  password: string;
  walletAddress: string;
  payoutMethod: 'wallet' | 'bank';
  bankAccount?: string;
  bankRoutingNumber?: string;
}

export interface UpdateMerchantRequest {
  name?: string;
  payoutMethod?: 'wallet' | 'bank';
  bankAccount?: string;
  bankRoutingNumber?: string;
}

export const merchantsApi = {
  /**
   * Register a new merchant
   */
  async create(data: CreateMerchantRequest): Promise<Merchant> {
    const response = await apiClient.post<MerchantResponse>('/api/merchants', {
      name: data.name,
      email: data.email,
      password: data.password,
      wallet_address: data.walletAddress,
      payout_method: data.payoutMethod === 'wallet' ? 'Wallet' : 'Bank',
      bank_account: data.bankAccount ?? null,
      bank_routing_number: data.bankRoutingNumber ?? null,
    });
    return normalizeMerchant(response);
  },

  /**
   * Get merchant by ID
   */
  async getById(id: string): Promise<Merchant> {
    return normalizeMerchant(await apiClient.get<MerchantResponse>(`/api/merchants/${id}`));
  },

  /**
   * Get current merchant (authenticated)
   */
  async getCurrent(): Promise<Merchant> {
    return normalizeMerchant(await apiClient.get<MerchantResponse>('/api/merchants/me'));
  },

  /**
   * Update merchant information
   */
  async update(id: string, data: UpdateMerchantRequest): Promise<Merchant> {
    const response = await apiClient.put<MerchantResponse>(`/api/merchants/${id}`, {
      name: data.name,
      payout_method: data.payoutMethod === undefined
        ? undefined
        : data.payoutMethod === 'wallet' ? 'Wallet' : 'Bank',
      bank_account: data.bankAccount,
      bank_routing_number: data.bankRoutingNumber,
    });
    return normalizeMerchant(response);
  },

  /**
   * Deactivate merchant account
   */
  async deactivate(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/merchants/${id}`);
  },

  /**
   * Get merchant dashboard statistics
   */
  async getStats(id: string): Promise<{
    totalRevenue: number;
    totalTransactions: number;
    activeCustomers: number;
    pendingPayouts: number;
  }> {
    return apiClient.get(`/api/merchants/${id}/stats`);
  },
};
