import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { rounds } from "./rounds";
import { players } from "./players";
export const roundResults = pgTable("round_results", {
  id: uuid().defaultRandom().primaryKey(),

  roundId: uuid("round_id")
    .references(() => rounds.id, { onDelete: "cascade" })
    .notNull(),

  playerId: uuid("player_id")
    .references(() => players.id, { onDelete: "cascade" })
    .notNull(),

  rank: integer().notNull(),

  score: integer().notNull(),

  khapno: integer("khap_no").notNull().default(0),

  sanhno: integer("sanh_no").notNull().default(0),

  blackPigNo: integer("black_pig_no").notNull().default(0),

  redPigNo: integer("red_pig_no").notNull().default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
