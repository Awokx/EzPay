'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { paymentsApi } from '@/lib/api/payments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Check, Link as LinkIcon, Calendar } from 'lucide-react';

export function PaymentLinkGenerator() {
  const { merchant, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const createRequest = useMutation({
    mutationFn: () => {
      if (!merchant) throw new Error('Sign in to create a payment link.');
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than zero.');
      return paymentsApi.createRequest({
        merchantId: merchant.id,
        amount: Math.round(amount * 10_000_000),
        memo: description.trim(),
        expiresAt: expiryDate ? new Date(`${expiryDate}T23:59:59`).toISOString() : undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payment-requests'] });
    },
  });

  const generateLink = async () => {
    const request = await createRequest.mutateAsync();
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ezpay.io';
    const link = `${baseUrl}/pay/${request.id}`;
    setGeneratedLink(link);
  };

  const copyToClipboard = async () => {
    if (!generatedLink) return;
    
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          Generate Payment Link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="amount">Amount (Optional)</Label>
          <Input
            id="amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            placeholder="Payment for goods/services"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="expiry">Expiry Date (Optional)</Label>
          <Input
            id="expiry"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="mt-1"
          />
        </div>

        {!isAuthenticated && <p role="alert" className="text-sm text-destructive">Sign in before creating a payment link.</p>}
        {createRequest.error && <p role="alert" className="text-sm text-destructive">{createRequest.error.message}</p>}

        <Button onClick={() => void generateLink().catch(() => undefined)} className="w-full" disabled={!isAuthenticated || createRequest.isPending}>
          <LinkIcon className="h-4 w-4 mr-2" />
          {createRequest.isPending ? 'Creating link...' : 'Generate Link'}
        </Button>

        {generatedLink && (
          <div className="space-y-3 pt-4 border-t border-border">
            <Label>Generated Payment Link</Label>
            <div className="flex gap-2">
              <Input
                value={generatedLink}
                readOnly
                className="bg-background"
              />
              <Button
                onClick={copyToClipboard}
                variant="outline"
                size="icon"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this link with customers to receive payments
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
