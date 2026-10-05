'use client';

import { useRegistrationStore } from '@/lib/registrationStore';
import { EmbeddedWalletSetup } from '@/components/register/EmbeddedWalletSetup';
import { StepTwo } from '@/components/register/StepTwo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentStep, nextStep, prevStep, formData, setErrors, errors } = useRegistrationStore();

  const validateStep = () => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
      // Step 1: Wallet validation
      if (!formData.walletAddress) {
        newErrors.wallet = 'Please connect or create a wallet to continue';
      }
    }

    if (currentStep === 2) {
      // Step 2: Business details validation
      if (!formData.businessName.trim()) {
        newErrors.businessName = 'Business name is required';
      }
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email';
      }
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    if (validateStep()) {
      nextStep();
    }
  };

  const handleRegistration = async () => {
    setSubmitError(null);
    if (!validateStep()) return;

    setIsSubmitting(true);
    try {
      await register({
        name: formData.businessName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        walletAddress: formData.walletAddress,
        payoutMethod: 'wallet',
      });
      router.push('/success');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Link
            href="/"
            className="inline-block text-2xl font-bold text-foreground hover:text-accent transition-colors duration-300 mb-8"
          >
            EzPay
          </Link>
          <h1 className="text-4xl font-bold text-foreground mb-2">Create Your Account</h1>
          <p className="text-muted-foreground">Join EzPay and start accepting Stellar payments</p>
        </div>

        {/* Progress indicator */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div
              className={`flex-1 h-1 rounded-full transition-all duration-500 ${
                currentStep >= 1 ? 'bg-accent' : 'bg-border'
              }`}
            ></div>
            <div className="mx-2">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${
                  currentStep >= 1
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-border text-muted-foreground'
                }`}
              >
                1
              </div>
            </div>
            <div
              className={`flex-1 h-1 rounded-full transition-all duration-500 ${
                currentStep >= 2 ? 'bg-accent' : 'bg-border'
              }`}
            ></div>
            <div className="mx-2">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${
                  currentStep >= 2
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-border text-muted-foreground'
                }`}
              >
                2
              </div>
            </div>
            <div
              className={`flex-1 h-1 rounded-full transition-all duration-500 ${
                currentStep >= 2 ? 'bg-accent' : 'bg-border'
              }`}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Wallet Setup</span>
            <span>Business Details</span>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-card border border-border rounded-xl shadow-lg p-8 mb-8 animate-fadeIn">
          {currentStep === 1 && (
            <div className="animate-fadeIn">
              <h2 className="text-2xl font-bold text-foreground mb-6">Step 1: Connect Your Wallet</h2>
              <p className="text-muted-foreground mb-6">
                Connect an existing Stellar wallet or create a new embedded wallet to get started.
              </p>
              <EmbeddedWalletSetup onComplete={handleNextStep} />
            </div>
          )}

          {currentStep === 2 && (
            <div className="animate-fadeIn">
              <h2 className="text-2xl font-bold text-foreground mb-6">Step 2: Business Information</h2>
              <p className="text-muted-foreground mb-6">
                Tell us about your business so we can set up your account.
              </p>
              <StepTwo />
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        {currentStep === 2 && (
          <div className="flex gap-4">
            <button
              onClick={prevStep}
              className="flex-1 px-6 py-3 border-2 border-foreground text-foreground font-semibold rounded-lg hover:bg-foreground hover:text-background transition-all duration-300 active:scale-95"
            >
              Back
            </button>
            <button
              onClick={handleRegistration}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-accent text-accent-foreground font-semibold rounded-lg hover:shadow-lg hover:shadow-accent/50 transition-all duration-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Creating account...' : 'Complete Registration'}
            </button>
          </div>
        )}

        {submitError && (
          <p role="alert" className="mt-4 text-center text-sm text-destructive">{submitError}</p>
        )}

        {/* Login Link */}
        <div className="text-center mt-8 text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-accent hover:underline font-semibold">
            Sign in
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </main>
  );
}
