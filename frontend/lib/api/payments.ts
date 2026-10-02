/**
 * Payments API Service
 * Handles all payment-related API calls
 */

import { apiClient } from './client';

interface PaymentResponse {
  id: string;
  merchant_id: string;
  from_address: string;
  amount: number;
  fee: number;
  status: 'pending' | 'completed' | 'failed' | 'Pending' | 'Completed' | 'Failed';
  memo?: string | null;
  transaction_hash?: string | null;
  created_at: string;
  updated_at: string;
}

interface PaymentRequestResponse {
  id: string;
  merchant_id: string;
  token: string;
  amount: number;
  memo: string;
  status: 'pending' | 'paid' | 'cancelled' | 'Pending' | 'Paid' | 'Cancelled';
  expires_at?: string | null;
  created_at: string;
}

function normalizePayment(payment: PaymentResponse): Payment {
  return {
    id: payment.id,
    merchantId: payment.merchant_id,
    fromAddress: payment.from_address,
    amount: payment.amount,
    fee: payment.fee,
    status: payment.status.toLowerCase() as Payment['status'],
    memo: payment.memo ?? undefined,
    transactionHash: payment.transaction_hash ?? undefined,
    createdAt: payment.created_at,
    updatedAt: payment.updated_at,
  };
}

function normalizePaymentRequest(request: PaymentRequestResponse): PaymentRequest {
  return {
    id: request.id,
    merchantId: request.merchant_id,
    token: request.token,
    amount: request.amount,
    memo: request.memo,
    status: request.status.toLowerCase() as PaymentRequest['status'],
    expiresAt: request.expires_at ?? undefined,
    createdAt: request.created_at,
  };
}

export interface Payment {
  id: string;
  merchantId: string;
  fromAddress: string;
  amount: number;
  fee: number;
  status: 'pending' | 'completed' | 'failed';
  memo?: string;
  transactionHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentRequest {
  merchantId: string;
  fromAddress: string;
  amount: number;
  memo?: string;
}

export interface PaymentRequest {
  id: string;
  merchantId: string;
  token: string;
  amount: number;
  memo: string;
  status: 'pending' | 'paid' | 'cancelled';
  expiresAt?: string;
  createdAt: string;
}

export interface CreatePaymentRequestData {
  merchantId: string;
  amount: number;
  memo: string;
  expiresAt?: string;
}

export const paymentsApi = {
  /**
   * Create a new payment
   */
  async create(data: CreatePaymentRequest): Promise<Payment> {
    return normalizePayment(await apiClient.post<PaymentResponse>('/api/payments', {
      merchant_id: data.merchantId,
      from_address: data.fromAddress,
      amount: data.amount,
      memo: data.memo ?? null,
    }));
  },

  /**
   * Get payment by ID
   */
  async getById(id: string): Promise<Payment> {
    return normalizePayment(await apiClient.get<PaymentResponse>(`/api/payments/${id}`));
  },

  /**
   * Get all payments for a merchant
   */
  async getByMerchant(merchantId: string, params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Payment[]> {
    return this.getHistory({ ...params, merchantId });
  },

  /**
   * Get payment history for current merchant
   */
  async getHistory(params?: {
    status?: string;
    limit?: number;
    offset?: number;
    merchantId?: string;
  }): Promise<Payment[]> {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined) searchParams.set(key === 'merchantId' ? 'merchant_id' : key, String(value));
    }
    const query = searchParams.toString();
    const response = await apiClient.get<PaymentResponse[]>(`/api/payments/history${query ? `?${query}` : ''}`);
    return response.map(normalizePayment);
  },

  /**
   * Create a payment request (invoice)
   */
  async createRequest(data: CreatePaymentRequestData): Promise<PaymentRequest> {
    const response = await apiClient.post<PaymentRequestResponse>('/api/payment-requests', {
      merchant_id: data.merchantId,
      amount: data.amount,
      memo: data.memo,
      expires_at: data.expiresAt ?? null,
    });
    return normalizePaymentRequest(response);
  },

  /**
   * Get payment request by ID
   */
  async getRequestById(id: string): Promise<PaymentRequest> {
    return normalizePaymentRequest(await apiClient.get<PaymentRequestResponse>(`/api/payment-requests/${id}`));
  },

  /**
   * Cancel a payment request
   */
  async cancelRequest(id: string): Promise<PaymentRequest> {
    return normalizePaymentRequest(await apiClient.post<PaymentRequestResponse>(`/api/payment-requests/${id}/cancel`));
  },

  /**
   * Process a payment (pay a payment request)
   */
  async payRequest(requestId: string, fromAddress: string): Promise<Payment> {
    return normalizePayment(await apiClient.post<PaymentResponse>(`/api/payment-requests/${requestId}/pay`, {
      from_address: fromAddress,
    }));
  },
};
