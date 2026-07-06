import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

const pool = new pg.Pool({
  connectionString: "postgresql://card_game_08hl_user:yPjctkhzrtzG6OjGtt49TbZ9pMCca68o@dpg-d927lj99rddc738744bg-a.singapore-postgres.render.com/card_game_08hl?uselibpqcompat=true&sslmode=require",
});

export const db = drizzle(pool, { schema });
