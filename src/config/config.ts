import { z } from "zod";
require("dotenv").config();

const envSchema = z.object({
  NODE_ENV: z.string(),
  PORT: z.string(),
  DATABASE_URL: z.string(),
  PGHOST: z.string(),
  PGDATABASE: z.string(),
  PGUSER: z.string(),
  PGPASSWORD: z.string(),
  JWT_ACCESS_SECRET: z.string(),
  JWT_ACCESS_EXPIRATION_TIME: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_REFRESH_EXPIRATION_TIME: z.string(),
  AWS_S3_ACCESS_KEY: z.string(),
  AWS_S3_SECRET_KEY: z.string(),
  AWS_S3_BUCKET_NAME: z.string(),
  ENCRYPTION_ALGORITHM: z.string(),
  ENCRYPTION_SECRET: z.string(),
  ENCRYPTION_IV: z.string(),
  REDIS_CONNECTION_STRING: z.string(),
  COORDINATE_URL: z.string(),
  COORDINATE_USER: z.string(),
  COORDINATE_PASSWORD: z.string(),
  FRACTAL_TESTNET_URL: z.string(),
  FRACTAL_MAINNET_URL: z.string(),
  FRACTAL_TESTNET_USER: z.string(),
  FRACTAL_TESTNET_PASSWORD: z.string(),
  UNISAT_BITCOIN_TESTNET_API_KEY: z.string(),
  UNISAT_FRACTAL_TESTNET_API_KEY: z.string(),
  THIRDWEB_SECRET_KEY: z.string(),
});

let env = envSchema.safeParse(process.env);
if (!env.success) {
  console.warn(
    `Invalid environment variables: ${env.error.flatten().fieldErrors}`
  );
  console.warn(`Invalid environment variables: ${env.error}`);
  process.exit(1);
}

export const config = env.data;
