import { PaymentLinkGenerator } from '@/components/payment-link/PaymentLinkGenerator';

export default function PaymentLinkPage() {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Payment Link</h1>
      <PaymentLinkGenerator />
    </main>
  );
}