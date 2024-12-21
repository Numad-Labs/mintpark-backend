import { NextFunction, Request, Response } from "express";
import { CustomError } from "../exceptions/CustomError";
import logger from "../config/winston";
import { config } from "../config/config";
import { encryptionHelper } from "./encryptionHelper";
import { redis } from "..";

interface RateLimiterOptions {
  keyPrefix: string;
  limit: number;
  window: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { keyPrefix, limit, window } = options;

  return async function rateLimiter(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    if (config.NODE_ENV !== "production") {
      return next();
    }

    try {
      if (!req.ip && !req.socket.remoteAddress) {
        logger.warn("Client ip not found.");
      }
      const ip: string = req.ip || req.socket.remoteAddress || "unknown";

      const key = `${keyPrefix}:${ip}`;
      const now = Date.now();
      const windowStart = now - window * 1000;

      await redis
        .multi()
        .zadd(key, now, now)
        .zremrangebyscore(key, "-inf", windowStart)
        .zcard(key)
        .pexpire(key, window * 1000)
        .exec((err, results: any) => {
          if (err) {
            logger.error("Rate limiting error:", err);
            return next(err);
          }

          const requestCount = results[2][1];

          if (requestCount > limit) {
            return res.status(429).json({
              success: false,
              data: null,
              error:
                "You have exceeded the request limit. Please try again in a few moment.",
            });
          }

          res.setHeader("X-RateLimit-Limit", limit);
          res.setHeader(
            "X-RateLimit-Remaining",
            Math.max(limit - requestCount, 0)
          );
          res.setHeader("X-RateLimit-Reset", Math.ceil(now / 1000) + window);

          next();
        });
    } catch (error) {
      logger.error("Rate limiting error:", error);
      next(error);
    }
  };
}
