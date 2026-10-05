'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDownRight, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { paymentsApi } from '@/lib/api/payments';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

export function RecentTransactions() {
  const { isAuthenticated } = useAuth();
  const transactions = useQuery({
    queryKey: ['payments', 'history', { limit: 5 }],
    queryFn: () => paymentsApi.getHistory({ limit: 5 }),
    enabled: isAuthenticated,
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {!isAuthenticated && <p className="text-sm text-muted-foreground">Sign in to view transactions.</p>}
        {isAuthenticated && transactions.isLoading && <div className="space-y-3">{[1, 2, 3].map((row) => <Skeleton key={row} className="h-16 w-full" />)}</div>}
        {transactions.error && <p role="alert" className="text-sm text-destructive">{transactions.error.message}</p>}
        {transactions.isSuccess && transactions.data.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
        {transactions.data && transactions.data.length > 0 && <div className="space-y-4">
          {transactions.data.slice(0, 5).map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-4 rounded-lg bg-background hover:bg-accent/5 transition-colors duration-200"
            >
              <div className="flex items-center gap-4">
                <div
                  className="rounded-full bg-green-500/10 p-2"
                >
                  <ArrowDownRight className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Payment from {tx.fromAddress.slice(0, 6)}...{tx.fromAddress.slice(-4)}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{(tx.amount / 10_000_000).toFixed(2)} XLM</p>
                  <Badge
                    variant={
                      tx.status === 'completed'
                        ? 'default'
                        : tx.status === 'pending'
                        ? 'secondary'
                        : 'destructive'
                    }
                    className="text-xs"
                  >
                    {tx.status}
                  </Badge>
                </div>
                <button className="p-1 hover:bg-accent/10 rounded transition-colors">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>}
      </CardContent>
    </Card>
  );
}
