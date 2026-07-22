import { redis } from "./db";

/**
 * Fixed-window rate limiter backed by Upstash.
 *
 * INCR + EXPIRE-on-first-hit. Fixed windows allow a burst at a window boundary,
 * which is fine here — the goal is stopping enumeration and brute force, not
 * precise traffic shaping.
 */
export async function rateLimit({ bucket, key, limit, windowSeconds }) {
  const redisKey = `rl:${bucket}:${key}`;
  try {
    const count = await redis().incr(redisKey);
    if (count === 1) await redis().expire(redisKey, windowSeconds);
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfter: windowSeconds,
    };
  } catch {
    // Fail open. A Redis blip must not take checkout down — the endpoints
    // behind this are also validated server-side, so an unlimited window is
    // degraded, not dangerous. The one exception is admin login, which is
    // additionally protected by a strong password.
    return { ok: true, remaining: limit, retryAfter: 0 };
  }
}

/**
 * Best-effort client IP. Vercel and most proxies set x-forwarded-for; the
 * left-most entry is the client. Falls back to a constant so a missing header
 * degrades to a shared global bucket rather than no limiting at all.
 */
export function clientIp(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export function tooMany(retryAfter = 60) {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please slow down." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}
