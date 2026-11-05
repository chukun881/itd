import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/db';
import { users, creditTransactions } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { env } from '@/env';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  // Pinned older than the SDK's LatestApiVersion (2025-02-24.acacia); align in the Stripe fix PR.
  apiVersion: '2024-12-18.acacia' as unknown as Stripe.LatestApiVersion,
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: unknown) {
    console.error('Stripe webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  // Handle successful checkout
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const creditsToAdd = Number(session.metadata?.credits || 0);

    if (userId && creditsToAdd > 0) {
      // 1. Atomic Credit Addition
      await db.execute(sql`
        UPDATE ${users}
        SET credits = credits + ${creditsToAdd},
            updated_at = NOW()
        WHERE id = ${userId};
      `);

      // 2. Record Transaction
      await db.insert(creditTransactions).values({
        userId,
        amount: creditsToAdd,
        type: 'purchase',
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
        description: `Purchased ${creditsToAdd} credits pack`,
      });
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
