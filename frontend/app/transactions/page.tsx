 'use client';

import { useState } from 'react';
import { TransactionsHeader } from '@/components/transactions/TransactionsHeader';
import { TransactionsFilter } from '@/components/transactions/TransactionsFilter';
import { TransactionsList } from '@/components/transactions/TransactionsList';

export default function TransactionsPage() {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  return (
    <main className="min-h-screen bg-background">
      <TransactionsHeader />
      <div className="container mx-auto px-4 py-8">
        <TransactionsFilter onStatusChange={setStatus} onSearchChange={setSearch} />
        <TransactionsList status={status} search={search} />
      </div>
    </main>
  );
}
