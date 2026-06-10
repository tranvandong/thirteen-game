import { pgTable, uuid, timestamp, unique } from "drizzle-orm/pg-core";

import { sessions } from "./sessions";
import { participants } from "./participants";
import { players } from "./players";

/**
 * Lưu việc participant chọn player trong một session.
 * Mỗi participant chỉ được chọn 1 player (unique participantId per session).
 * Mỗi player chỉ được 1 participant chọn (unique playerId per session).
 */
export const participantPlayers = pgTable(
  "participant_players",
  {
    id: uuid().defaultRandom().primaryKey(),

    sessionId: uuid("session_id")
      .references(() => sessions.id, { onDelete: "cascade" })
      .notNull(),

    participantId: uuid("participant_id")
      .references(() => participants.id, { onDelete: "cascade" })
      .notNull(),

    playerId: uuid("player_id")
      .references(() => players.id, { onDelete: "cascade" })
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    // 1 participant chỉ chọn 1 player trong session
    unique("uq_participant_players_participant").on(
      t.sessionId,
      t.participantId,
    ),
    // 1 player chỉ bị chọn bởi 1 participant trong session
    unique("uq_participant_players_player").on(t.sessionId, t.playerId),
  ],
);
