import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { CREDIT_PACKS } from '@/lib/constants';
import { env } from '@/env';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  // Pinned older than the SDK's LatestApiVersion (2025-02-24.acacia); align in the Stripe fix PR.
  apiVersion: '2024-12-18.acacia' as unknown as Stripe.LatestApiVersion,
});

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }

    // Parse form-data or JSON
    let packId: string | null = null;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      packId = formData.get('packId') as string;
    } else {
      const body = await req.json();
      packId = body.packId;
    }

    const selectedPack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!selectedPack) {
      return NextResponse.json({ error: 'Invalid credit pack selected' }, { status: 400 });
    }

    const [dbUser] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!dbUser) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: selectedPack.price,
            product_data: {
              name: `Image-to-3D: ${selectedPack.label}`,
              description: `${selectedPack.credits} 3D model generation credits. No expiration.`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: dbUser.id,
        clerkId,
        packId: selectedPack.id,
        credits: String(selectedPack.credits),
      },
      success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/pricing?payment=cancelled`,
    });

    if (session.url) {
      return NextResponse.redirect(session.url, 303);
    }

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err: unknown) {
    console.error('Error in /api/checkout:', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
