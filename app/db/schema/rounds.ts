import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { sessions } from "./sessions";

export const rounds = pgTable("rounds", {
  id: uuid().defaultRandom().primaryKey(),

  sessionId: uuid("session_id")
    .references(() => sessions.id, {
      onDelete: "cascade",
    })
    .notNull(),

  roundNo: integer("round_no").notNull(),

  createdBy: uuid("created_by").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
