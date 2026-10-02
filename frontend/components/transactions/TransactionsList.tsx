'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowDownRight, ExternalLink, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { paymentsApi } from '@/lib/api/payments';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

export function TransactionsList({ status, search }: { status: string; search: string }) {
  const { isAuthenticated } = useAuth();
  const transactions = useQuery({
    queryKey: ['payments', 'history'],
    queryFn: () => paymentsApi.getHistory(),
    enabled: isAuthenticated,
  });
  const rows = (transactions.data ?? []).filter((transaction) => {
    const matchesStatus = status === 'all' || transaction.status === status;
    const text = `${transaction.id} ${transaction.fromAddress} ${transaction.memo ?? ''}`.toLowerCase();
    return matchesStatus && text.includes(search.trim().toLowerCase());
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">All Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {!isAuthenticated && <p className="text-sm text-muted-foreground">Sign in to view transactions.</p>}
        {isAuthenticated && transactions.isLoading && <div className="space-y-3">{[1, 2, 3, 4].map((row) => <Skeleton key={row} className="h-20 w-full" />)}</div>}
        {transactions.error && <p role="alert" className="text-sm text-destructive">{transactions.error.message}</p>}
        {transactions.isSuccess && rows.length === 0 && <p className="text-sm text-muted-foreground">No transactions match these filters.</p>}
        {rows.length > 0 && <div className="space-y-3">
          {rows.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-4 rounded-lg bg-background hover:bg-accent/5 transition-colors duration-200 border border-border hover:border-accent/30"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-green-500/10 p-2">
                  <ArrowDownRight className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{tx.id}</p>
                  <p className="text-xs text-muted-foreground">
                    From: {tx.fromAddress}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{(tx.amount / 10_000_000).toFixed(2)} XLM</p>
                  <p className="text-xs text-muted-foreground">Fee: {(tx.fee / 10_000_000).toFixed(7)} XLM</p>
                  <Badge
                    variant={
                      tx.status === 'completed'
                        ? 'default'
                        : tx.status === 'pending'
                        ? 'secondary'
                        : 'destructive'
                    }
                    className="text-xs mt-1"
                  >
                    {tx.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1 hover:bg-accent/10 rounded transition-colors" aria-label="View transaction">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <Button variant="ghost" size="icon">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>}
      </CardContent>
    </Card>
  );
}
