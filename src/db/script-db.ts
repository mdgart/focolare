/**
 * A database connection for one-off maintenance scripts.
 *
 * Local DATABASE_URL by default. A script only touches the deployed database
 * when it is run with --prod, because the difference between the two is a
 * public URL changing under people who already have it.
 */
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export function scriptDb(argv: string[]) {
  const prod = argv.includes("--prod");
  const connectionString = prod
    ? process.env.VERCEL_DATABASE_URL
    : process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(prod ? "VERCEL_DATABASE_URL is not set." : "DATABASE_URL is not set.");
  }
  const pool = new pg.Pool({ connectionString });
  return { db: drizzle(pool, { schema }), pool, prod };
}
