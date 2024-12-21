import { createRateLimiter } from "../libs/createRateLimiter";

export const rateLimiter = createRateLimiter({
  keyPrefix: "ratelimiter-global",
  limit: 100,
  window: 3 * 60,
});
