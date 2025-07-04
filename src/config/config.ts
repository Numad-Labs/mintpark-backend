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
  PGPOOL_MAX: z.string(),
  JWT_ACCESS_SECRET: z.string(),
  JWT_ACCESS_EXPIRATION_TIME: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_REFRESH_EXPIRATION_TIME: z.string(),
  AWS_S3_ACCESS_KEY: z.string(),
  AWS_S3_SECRET_KEY: z.string(),
  AWS_S3_BUCKET_NAME: z.string(),
  AWS_SQS_NAME: z.string(),
  AWS_SQS_ACCESS_KEY: z.string(),
  AWS_SQS_SECRET_KEY: z.string(),
  ENCRYPTION_ALGORITHM: z.string(),
  ENCRYPTION_SECRET: z.string(),
  ENCRYPTION_IV: z.string(),
  REDIS_CONNECTION_STRING: z.string(),
  THIRDWEB_SECRET_KEY: z.string(),
  PINATA_JWT: z.string(),
  PINATA_GATEWAY_URL: z.string(),
  VAULT_ADDRESS: z.string(),
  VAULT_PRIVATE_KEY: z.string(),
  PLATFORM_FEE_RECIPIENT: z.string(),
  QUEUE_PROCESSOR_URL: z.string(),
  QUEUE_PROCESSOR_API_KEY: z.string(),
  MARKETPLACE_SYNC_SECRET: z.string()
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
