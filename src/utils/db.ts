import { Kysely } from "kysely";

import { PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DB } from "../types/db/types";
import { config } from "../config/config";

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      database: config.PGDATABASE,
      host: config.PGHOST,
      user: config.PGUSER,
      password: config.PGPASSWORD,
      // Use SSL only in production environments
      ssl: true,
      // Allow the pool size to be configurable via an environment variable; default to 20
      max: parseInt(config.PGPOOL_MAX || "20", 10),
      // Optional: Close idle connections after 30 seconds to free up resources
      idleTimeoutMillis: 30000,
      // Optional: Fail fast if a connection isn’t established within 2 seconds
      connectionTimeoutMillis: 2000
    })
  })
});
