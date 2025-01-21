import { Expression, sql } from "kysely";

export function to_tsvector(expr: Expression<string> | string) {
  return sql`to_tsvector(${sql.lit("english")}, ${expr})`;
}

export function to_tsquery(expr: Expression<string> | string) {
  return sql`to_tsquery(${sql.lit("english")}, ${expr} || ':*')`;
}
