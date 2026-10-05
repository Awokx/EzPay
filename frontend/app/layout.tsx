import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { Navigation } from '@/components/Navigation'
import { AppProviders } from '@/components/AppProviders'

export const metadata: Metadata = {
  title: 'EzPay - Stellar Payment Infrastructure',
  description: 'Lightweight payment infrastructure on the Stellar blockchain. Connect your wallet and streamline payments.',
  generator: 'EzPay',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-background text-foreground">
        <AppProviders>
          <Navigation />
          <main className="min-h-screen">
            {children}
          </main>
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </AppProviders>
      </body>
    </html>
  )
}
