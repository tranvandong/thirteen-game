import { pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { sessions } from "./sessions";
import { participants } from "./participants";

export const joinRequestStatusEnum = pgEnum("join_request_status", [
  "pending",
  "approved",
  "rejected",
]);

export const joinRequests = pgTable("join_requests", {
  id: uuid().defaultRandom().primaryKey(),

  sessionId: uuid("session_id")
    .references(() => sessions.id, {
      onDelete: "cascade",
    })
    .notNull(),

  displayName: varchar("display_name", {
    length: 100,
  }).notNull(),

  status: joinRequestStatusEnum().default("pending").notNull(),

  requestToken: varchar("request_token", { length: 255 }).notNull(),

  approvedBy: uuid("approved_by").references(() => participants.id),

  approvedAt: timestamp("approved_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
