import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Invite-only app: every route needs a signed-in user except sign-in itself
 * and the fal webhook (which is verified by its ED25519 signature instead).
 */
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/api/webhook/fal']);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
