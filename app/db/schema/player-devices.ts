import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  unique,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { sessions } from "./sessions";
import { participants } from "./participants";

/** Trạng thái tham gia session của thiết bị */
export const playerDeviceStatusEnum = pgEnum("player_device_status", [
  "active", // Đang tham gia session
  "left", // Đã thoát khỏi session
]);

/**
 * Lưu thông tin thiết bị của participant trong một session.
 * - fingerprint: nhận diện thiết bị (không đổi giữa các lần vào)
 * - pushToken:   FCM/APNs token để gửi push notification (có thể null nếu user từ chối)
 * - platform:    'ios' | 'android' | 'web'
 * - status:      'active' | 'left' — trạng thái tham gia session hiện tại
 *
 * Mỗi thiết bị (fingerprint) chỉ có 1 bản ghi per session, và tại một thời điểm
 * chỉ được ở trạng thái 'active' trong DUY NHẤT 1 session (đảm bảo bởi
 * partial unique index bên dưới).
 */
export const playerDevices = pgTable(
  "player_devices",
  {
    id: uuid().defaultRandom().primaryKey(),

    sessionId: uuid("session_id")
      .references(() => sessions.id, { onDelete: "cascade" })
      .notNull(),

    participantId: uuid("participant_id")
      .references(() => participants.id, { onDelete: "cascade" })
      .notNull(),

    /** Fingerprint thiết bị để nhận diện lại (FingerprintJS hoặc tự sinh) */
    fingerprint: varchar("fingerprint", { length: 255 }).notNull(),

    /** FCM token hoặc APNs token — nullable vì user có thể từ chối notification */
    pushToken: varchar("push_token", { length: 512 }),

    /** 'ios' | 'android' | 'web' */
    platform: varchar("platform", { length: 20 }).notNull(),

    /** Trạng thái tham gia session: 'active' (đang tham gia) | 'left' (đã thoát) */
    status: playerDeviceStatusEnum("status").default("active").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    // Mỗi thiết bị chỉ có 1 bản ghi per session
    unique("uq_player_devices_fingerprint").on(t.sessionId, t.fingerprint),
  ],
);