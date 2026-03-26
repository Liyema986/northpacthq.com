import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Auth only on the Edge — signed-in or redirect to sign-in. Firm role (owner/admin vs
// staff, etc.) lives in Convex and is enforced in RoleBasedRedirect (same pattern as
// trueagrihq: client role gate, not Edge middleware for DB roles).

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/proposals/view(.*)",
  "/sign(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
