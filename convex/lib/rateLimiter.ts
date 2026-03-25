// convex/lib/rateLimiter.ts
import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 1000, // 1000 requests per hour
};

/**
 * Check rate limit for a user
 * Returns true if the request is allowed, false if rate limited
 */
export async function checkRateLimit(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  action: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Count recent requests for this user and action
  const recentActivities = await ctx.db
    .query("activities")
    .filter((q) =>
      q.and(
        q.eq(q.field("userId"), userId),
        q.gte(q.field("timestamp"), windowStart)
      )
    )
    .collect();

  const requestCount = recentActivities.length;
  const allowed = requestCount < config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - requestCount - 1);
  const resetAt = windowStart + config.windowMs;

  return { allowed, remaining, resetAt };
}

/**
 * Rate limit configurations for different actions
 */
export const RATE_LIMITS = {
  // Standard API calls
  standard: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 1000,
  },
  // Email sending
  email: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 100,
  },
  // Authentication attempts
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
  },
  // Report generation
  report: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
  },
} as const;
