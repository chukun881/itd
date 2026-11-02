import React from 'react';
import { auth } from '@clerk/nextjs/server';
import { CREDIT_PACKS } from '@/lib/constants';
import { Check, Sparkles, Zap, Shield } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const { userId } = await auth();

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Simple, Transparent <span className="text-blue-600">Credit Packs</span>
          </h1>
          <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Pay only for what you generate. 1 credit = 1 Standard model generation. No monthly
            subscription lock-ins.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {CREDIT_PACKS.map((pack, idx) => {
            const isPopular = pack.id === 'pack_50';
            const pricePerCredit = (pack.price / 100 / pack.credits).toFixed(2);

            return (
              <div
                key={pack.id}
                className={`relative flex flex-col justify-between rounded-3xl border bg-white dark:bg-neutral-900 p-8 shadow-sm transition-all ${
                  isPopular
                    ? 'border-blue-600 ring-2 ring-blue-600 shadow-md scale-105 z-10'
                    : 'border-neutral-200 dark:border-neutral-800'
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-bold text-white uppercase tracking-wider shadow">
                    Most Popular
                  </span>
                )}

                <div>
                  <h3 className="text-xl font-bold">{pack.label}</h3>
                  <p className="mt-1 text-xs text-neutral-500">${pricePerCredit} per generation</p>

                  <div className="mt-6 flex items-baseline">
                    <span className="text-4xl font-extrabold tracking-tight">{pack.priceLabel}</span>
                    <span className="ml-1 text-sm text-neutral-500">one-time</span>
                  </div>

                  <ul className="mt-8 space-y-4 text-sm text-neutral-600 dark:text-neutral-400">
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-blue-600" />
                      <span>{pack.credits} Standard 3D Generations</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-blue-600" />
                      <span>Full PBR textured `.glb` downloads</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-blue-600" />
                      <span>Automated mesh decimation</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-blue-600" />
                      <span>Commercial usage rights</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8">
                  {userId ? (
                    <form action="/api/checkout" method="POST">
                      <input type="hidden" name="packId" value={pack.id} />
                      <button
                        type="submit"
                        className={`w-full rounded-xl py-3 text-sm font-semibold transition-colors ${
                          isPopular
                            ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm'
                            : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        Buy {pack.credits} Credits
                      </button>
                    </form>
                  ) : (
                    <Link
                      href="/sign-in"
                      className={`block text-center w-full rounded-xl py-3 text-sm font-semibold transition-colors ${
                        isPopular
                          ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm'
                          : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      Sign In to Buy
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 rounded-2xl border bg-white dark:bg-neutral-900 p-8 text-center max-w-2xl mx-auto shadow-sm">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold mb-2">
            <Shield className="h-4 w-4 text-green-600" />
            <span>100% Satisfaction Guarantee</span>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            If a 3D generation ever fails or encounters an API error, credits are automatically
            refunded back to your account immediately.
          </p>
        </div>
      </div>
    </div>
  );
}
