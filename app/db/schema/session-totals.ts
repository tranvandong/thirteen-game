import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { sessions } from "./sessions";
import { players } from "./players";

export const sessionTotals = pgTable("session_totals", {
  id: uuid().defaultRandom().primaryKey(),

  sessionId: uuid("session_id")
    .references(() => sessions.id, {
      onDelete: "cascade",
    })
    .notNull(),

  playerId: uuid("player_id")
    .references(() => players.id, {
      onDelete: "cascade",
    })
    .notNull(),

  totalScore: integer("total_score").default(0).notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
