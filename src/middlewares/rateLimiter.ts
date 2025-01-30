import { createRateLimiter } from "../libs/createRateLimiter";

export const launchRatelimiter = createRateLimiter({
  keyPrefix: "ratelimiter-launch",
  limit: 5,
  window: 3 * 60
});

export const collectibleslimiter = createRateLimiter({
  keyPrefix: "ratelimiter-collectibles",
  limit: 10,
  window: 5 * 60
});
