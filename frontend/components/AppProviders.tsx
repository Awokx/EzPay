'use client';

import { useState } from 'react';
import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => console.error('Query failed', { queryKey: query.queryKey, error }),
    }),
    mutationCache: new MutationCache({
      onError: (error) => console.error('Mutation failed', error),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) =>
          !(error instanceof Error && 'status' in error && Number(error.status) >= 400 && Number(error.status) < 500)
          && failureCount < 2,
      },
      mutations: { retry: false },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}