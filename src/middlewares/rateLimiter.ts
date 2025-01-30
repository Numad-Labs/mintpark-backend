import { createRateLimiter } from "../libs/createRateLimiter";

export const launchRatelimiter = createRateLimiter({
  keyPrefix: "ratelimiter-global",
  limit: 5,
  window: 3 * 60
});
