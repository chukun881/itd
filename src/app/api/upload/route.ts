import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';
import { db } from '@/db';
import { users, jobs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getPresignedPutUrl, R2_PREFIXES } from '@/lib/r2';
import { uploadRateLimit } from '@/lib/redis';
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE } from '@/lib/utils';
import { GENERATION_COSTS, PROVIDER_CONFIG, FREE_CREDITS_ON_SIGNUP } from '@/lib/constants';

const uploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_IMAGE_SIZE, 'File size exceeds 10MB limit'),
  contentType: z.enum(ACCEPTED_IMAGE_TYPES, {
    errorMap: () => ({ message: 'Invalid image type. Accepted: JPG, PNG, WebP' }),
  }),
  tier: z.enum(['standard', 'premium']).default('standard'),
});

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Rate limiting check (10 requests per minute)
    const { success, reset } = await uploadRateLimit.limit(clerkId);
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)) } }
      );
    }

    // 2. Validate request payload
    const body = await req.json();
    const parsed = uploadRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { filename, fileSize, contentType, tier } = parsed.data;

    // 3. Ensure user exists in our database (sync from Clerk on-demand if needed)
    let [dbUser] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);

    if (!dbUser) {
      const clerkUser = await currentUser();
      const primaryEmail = clerkUser?.emailAddresses[0]?.emailAddress ?? '';
      const fullName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ');

      [dbUser] = await db
        .insert(users)
        .values({
          clerkId,
          email: primaryEmail,
          name: fullName || null,
          imageUrl: clerkUser?.imageUrl || null,
          credits: FREE_CREDITS_ON_SIGNUP,
        })
        .returning();
    }

    // 4. Pre-check credit balance
    const requiredCredits = GENERATION_COSTS[tier];
    if (dbUser.credits < requiredCredits) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          credits: dbUser.credits,
          required: requiredCredits,
        },
        { status: 402 }
      );
    }

    // 5. Generate unique R2 key and Presigned Upload URL
    const fileExt = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const jobId = crypto.randomUUID();
    const objectKey = `${R2_PREFIXES.RAW_UPLOADS}/${jobId}.${fileExt}`;

    const presignedPutUrl = await getPresignedPutUrl(objectKey, contentType, 300); // 5 min expiry

    // 6. Create initial job record in database
    const provider = PROVIDER_CONFIG[tier].provider;

    const [job] = await db
      .insert(jobs)
      .values({
        id: jobId,
        userId: dbUser.id,
        status: 'pending',
        tier,
        provider,
        inputImageKey: objectKey,
        rawFileSize: fileSize,
      })
      .returning();

    return NextResponse.json({
      jobId: job.id,
      uploadUrl: presignedPutUrl,
      objectKey,
      expiresIn: 300,
    });
  } catch (error) {
    console.error('Error in /api/upload:', error);
    return NextResponse.json(
      { error: 'Internal server error while preparing upload' },
      { status: 500 }
    );
  }
}
