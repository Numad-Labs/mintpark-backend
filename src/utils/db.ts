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
      ssl: true,
    }),
  }),
});
