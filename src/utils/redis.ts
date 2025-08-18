import { config } from "@config/config";
import { Redis } from "ioredis";

export const redis = new Redis(config.REDIS_CONNECTION_STRING);
