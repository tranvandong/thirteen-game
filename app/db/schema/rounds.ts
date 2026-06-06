import { boolean, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

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

  /** Khạp tích lũy đã áp dụng cho ván này */
  accumulatedKhap: integer("accumulated_khap").notNull().default(1),

  /** Sảnh tích lũy đã áp dụng cho ván này */
  accumulatedSanh: integer("accumulated_sanh").notNull().default(1),

  /** Ván này có người thắng khạp */
  hadKhap: boolean("had_khap").notNull().default(false),

  /** Ván này có người thắng sảnh */
  hadSanh: boolean("had_sanh").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
