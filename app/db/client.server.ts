import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

const pool = new pg.Pool({
  connectionString: "",
});

export const db = drizzle(pool, { schema });
