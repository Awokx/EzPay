'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Users, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { paymentsApi } from '@/lib/api/payments';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardStats() {
  const { isAuthenticated } = useAuth();
  const payments = useQuery({
    queryKey: ['payments', 'history'],
    queryFn: () => paymentsApi.getHistory(),
    enabled: isAuthenticated,
  });
  const rows = payments.data ?? [];
  const completed = rows.filter((payment) => payment.status === 'completed');
  const total = completed.reduce((sum, payment) => sum + payment.amount, 0);
  const stats = [
    {
      title: 'Total Revenue',
      value: `${(total / 10_000_000).toFixed(2)} XLM`,
      change: `${completed.length} completed`,
      icon: DollarSign,
      color: 'text-green-500',
    },
    {
      title: 'Total Transactions',
      value: String(rows.length),
      change: 'all payments',
      icon: TrendingUp,
      color: 'text-blue-500',
    },
    {
      title: 'Active Customers',
      value: String(new Set(rows.map((payment) => payment.fromAddress)).size),
      change: 'unique senders',
      icon: Users,
      color: 'text-purple-500',
    },
    {
      title: 'Pending Payouts',
      value: `${(rows.filter((payment) => payment.status === 'pending').reduce((sum, payment) => sum + payment.amount, 0) / 10_000_000).toFixed(2)} XLM`,
      change: `${rows.filter((payment) => payment.status === 'pending').length} pending`,
      icon: Clock,
      color: 'text-yellow-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <Card key={index} className="bg-card border-border hover:shadow-lg hover:shadow-accent/10 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-5 w-5 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            {payments.isLoading && isAuthenticated
              ? <Skeleton className="h-8 w-28" />
              : <div className="text-2xl font-bold text-foreground">{isAuthenticated ? stat.value : '--'}</div>}
            <p className="text-xs text-muted-foreground mt-1">
              {payments.error ? 'Could not load payment data' : isAuthenticated ? stat.change : 'Sign in to view'}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
