import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: uuid().defaultRandom().primaryKey(),

  code: varchar({
    length: 20,
  })
    .notNull()
    .unique(),

  ownerParticipantId: uuid("owner_participant_id"),

  status: varchar({
    length: 20,
  })
    .default("waiting")
    .notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
