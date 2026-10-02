'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SuccessPage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl mx-auto w-full">
        {/* Success Card */}
        <div
          className={`bg-card border-2 border-accent rounded-xl shadow-2xl shadow-accent/20 p-12 text-center transform transition-all duration-1000 ${
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        >
          {/* Checkmark Animation */}
          <div
            className={`w-24 h-24 mx-auto mb-6 flex items-center justify-center transform transition-all duration-1000 delay-200 ${
              isVisible ? 'scale-100' : 'scale-0'
            }`}
          >
            <div className="relative w-full h-full">
              <div className="absolute inset-0 bg-accent/10 rounded-full animate-ping"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-16 h-16 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Content */}
          <h1
            className={`text-4xl font-bold text-foreground mb-4 transform transition-all duration-1000 delay-300 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            Registration Complete!
          </h1>

          <p
            className={`text-lg text-muted-foreground mb-8 transform transition-all duration-1000 delay-400 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            Your EzPay merchant account has been created successfully. Your wallet is now ready to receive payments on the Stellar network.
          </p>

          {/* Stats Grid */}
          <div
            className={`grid grid-cols-2 gap-4 mb-8 transform transition-all duration-1000 delay-600 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="p-4 bg-card border border-accent/50 rounded-lg">
              <div className="text-2xl font-bold text-accent">∞</div>
              <div className="text-xs text-muted-foreground mt-1">Scalable Network</div>
            </div>
            <div className="p-4 bg-card border border-accent/50 rounded-lg">
              <div className="text-2xl font-bold text-accent">&lt;2s</div>
              <div className="text-xs text-muted-foreground mt-1">Settlement Time</div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div
            className={`flex flex-col sm:flex-row gap-4 transform transition-all duration-1000 delay-700 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <a
              href="/dashboard"
              className="flex-1 px-6 py-4 bg-accent text-accent-foreground font-semibold rounded-lg hover:shadow-lg hover:shadow-accent/50 hover:scale-105 transition-all duration-300 active:scale-95"
            >
              Go to Dashboard
            </a>
            <Link
              href="/"
              className="flex-1 px-6 py-4 border-2 border-foreground text-foreground font-semibold rounded-lg hover:bg-foreground hover:text-background transition-all duration-300 active:scale-95"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {/* Floating accent orbs */}
        <div className="absolute top-20 right-10 w-32 h-32 bg-accent/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-10 w-40 h-40 bg-accent/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
    </main>
  );
}
