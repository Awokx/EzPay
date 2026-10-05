'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';
import { authApi } from '@/lib/api/auth';
import type { CreateMerchantRequest, Merchant } from '@/lib/api/merchants';

interface AuthContextValue {
  merchant: Merchant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  register: (data: CreateMerchantRequest) => Promise<Merchant>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!window.localStorage.getItem('ezpay.accessToken')) {
      setIsLoading(false);
      return;
    }

    setHasToken(true);
    authApi.getCurrentMerchant()
      .then(setMerchant)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          authApi.logout();
          setHasToken(false);
        }
        console.error('Unable to restore merchant session', error);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    merchant,
    isAuthenticated: hasToken,
    isLoading,
    register: async (data) => {
      const registeredMerchant = await authApi.register(data);
      setMerchant(registeredMerchant);
      await queryClient.invalidateQueries({ queryKey: ['merchant'] });
      return registeredMerchant;
    },
    login: async (email, password) => {
      const session = await authApi.login(email, password);
      setMerchant(session.merchant ?? null);
      setHasToken(true);
      if (!session.merchant) {
        const currentMerchant = await authApi.getCurrentMerchant();
        setMerchant(currentMerchant);
      }
      await queryClient.invalidateQueries();
    },
    logout: () => {
      authApi.logout();
      setMerchant(null);
      setHasToken(false);
      queryClient.clear();
    },
  }), [hasToken, isLoading, merchant, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}