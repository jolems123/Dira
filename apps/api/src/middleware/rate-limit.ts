import type { NextFunction, Request, Response } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Small in-process fixed-window limiter. Sufficient for a single API node; swap for a
 * shared store when the API is horizontally scaled.
 */
export function rateLimit({ windowMs, max, keyPrefix }: { windowMs: number; max: number; keyPrefix: string }) {
  const buckets = new Map<string, Bucket>();

  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const key = `${keyPrefix}:${req.ip ?? 'unknown'}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      if (buckets.size > 10_000) {
        for (const [entryKey, entry] of buckets) {
          if (entry.resetAt <= now) buckets.delete(entryKey);
        }
      }
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }
    return next();
  };
}
