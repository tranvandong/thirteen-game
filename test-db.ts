import { env } from "./app/lib/env.server";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function main() {
  const result = await pool.query("select now()");
  console.log(result.rows);
}

main();
