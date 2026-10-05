'use client';

import { FormEvent, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '@/lib/api/payments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

export default function PayRequestPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [fromAddress, setFromAddress] = useState('');
  const request = useQuery({
    queryKey: ['payment-request', id],
    queryFn: () => paymentsApi.getRequestById(id),
    enabled: Boolean(id),
  });
  const pay = useMutation({
    mutationFn: () => paymentsApi.payRequest(id, fromAddress.trim()),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payment-request', id] }),
        queryClient.invalidateQueries({ queryKey: ['payments', 'history'] }),
      ]);
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    pay.mutate();
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-12">
      <section className="w-full space-y-6 rounded-lg border border-border bg-card p-8">
        {request.isLoading && <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-20 w-full" /></div>}
        {request.error && <div role="alert" className="space-y-2"><h1 className="text-xl font-semibold">Payment request unavailable</h1><p className="text-sm text-destructive">{request.error.message}</p></div>}
        {request.data && (
          <>
            <div>
              <h1 className="text-xl font-semibold">Payment request</h1>
              <p className="mt-2 text-3xl font-bold">{(request.data.amount / 10_000_000).toFixed(2)} XLM</p>
              <p className="mt-2 text-sm text-muted-foreground">{request.data.memo || 'No description provided'}</p>
            </div>
            {request.data.status === 'paid' || pay.data?.status === 'completed' ? (
              <p role="status" className="text-sm text-green-600">Payment completed successfully.</p>
            ) : pay.data ? (
              <p role="status" className="text-sm text-muted-foreground">Payment status: {pay.data.status}.</p>
            ) : request.data.status !== 'pending' ? (
              <p role="status" className="text-sm text-muted-foreground">This payment request is {request.data.status}.</p>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="from-address">Your Stellar wallet address</Label>
                  <Input
                    id="from-address"
                    autoComplete="off"
                    required
                    value={fromAddress}
                    onChange={(event) => setFromAddress(event.target.value)}
                    placeholder="G..."
                  />
                </div>
                {pay.error && <p role="alert" className="text-sm text-destructive">{pay.error.message}</p>}
                <Button className="w-full" type="submit" disabled={pay.isPending}>
                  {pay.isPending ? 'Submitting payment...' : 'Pay request'}
                </Button>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}