import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

import { sessions } from "./sessions";

export const participants = pgTable("participants", {
  id: uuid().defaultRandom().primaryKey(),

  sessionId: uuid("session_id")
    .references(() => sessions.id, {
      onDelete: "cascade",
    })
    .notNull(),

  displayName: varchar("display_name", {
    length: 100,
  }).notNull(),

  role: varchar({
    length: 20,
  })
    .default("member")
    .notNull(),

  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});
