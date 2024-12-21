import { createRateLimiter } from "../libs/createRateLimiter";

export const rateLimiter = createRateLimiter({
  keyPrefix: "ratelimiter-global",
  limit: 500,
  window: 5 * 60,
});
