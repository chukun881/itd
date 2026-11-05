import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, readSessionToken } from '@/lib/auth/session';

/**
 * Invite-only app: every route needs a valid session cookie except sign-in itself
 * and the fal webhook (which is verified by its ED25519 signature instead).
 * This only checks the cookie signature and expiry; getViewer() also checks the
 * user still exists and the session has not been revoked.
 */
const PUBLIC_PATHS = ['/sign-in', '/api/webhook/fal'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const session = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET ?? '');
  if (session) return NextResponse.next();

  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.redirect(new URL('/sign-in', req.url));
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
