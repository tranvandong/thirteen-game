import { pgTable, uuid, varchar, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";

export const sessionStatusEnum = pgEnum("session_status", [
  "active",    // Phiên đang diễn ra
  "finished",  // Phiên đã kết thúc
]);

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
    .default("active")
    .notNull(),

  /**
   * Phiên tạm dừng (chỉ chủ phòng mới được toggle). Khi paused = true,
   * không người chơi nào được phép lưu / xoá ván đấu.
   */
  paused: boolean("paused").default(false).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
