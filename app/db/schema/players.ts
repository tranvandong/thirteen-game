import { integer, pgTable, uuid, varchar } from "drizzle-orm/pg-core";

import { sessions } from "./sessions";

export const players = pgTable("players", {
  id: uuid().defaultRandom().primaryKey(),

  sessionId: uuid("session_id")
    .references(() => sessions.id, {
      onDelete: "cascade",
    })
    .notNull(),

  name: varchar({
    length: 100,
  }).notNull(),

  orderNo: integer("order_no").notNull(),
  
  initialScore: integer("initial_score").notNull().default(0),
});
