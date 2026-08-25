import { integer, pgTable, uuid } from "drizzle-orm/pg-core";

import { sessions } from "./sessions";

export const gameConfigs = pgTable("game_configs", {
  id: uuid().defaultRandom().primaryKey(),

  sessionId: uuid("session_id")
    .references(() => sessions.id, {
      onDelete: "cascade",
    })
    .notNull()
    .unique(),

  firstPlaceScore: integer("first_place_score").notNull(),

  secondPlaceScore: integer("second_place_score").notNull(),

  thirdPlaceScore: integer("third_place_score").notNull(),

  fourthPlaceScore: integer("fourth_place_score").notNull(),

  redPigScore: integer("red_pig_score").notNull().default(20),

  blackPigScore: integer("black_pig_score").notNull().default(10),

  tripleScore: integer("triple_score").notNull().default(20),

  khapScore: integer("khap_score").notNull().default(1),

  khapLimit: integer("khap_limit").notNull().default(3),

  sanhScore: integer("sanh_score").notNull().default(1),

  sanhLimit: integer("sanh_limit").notNull().default(2),

  /**
   * Hệ số nhân điểm tổng (điểm hiển thị = totalScore * scoreMultiplier).
   * Thiết lập khi tạo phòng, mặc định 3.
   */
  scoreMultiplier: integer("score_multiplier").notNull().default(3),

  /**
   * Phạt người ngoài (bystander) khi nhốt 2 victim. Thiết lập khi tạo
   * phòng, mặc định lấy giá trị tuyệt đối của thirdPlaceScore.
   */
  nhotBystanderPenalty: integer("nhot_bystander_penalty")
    .notNull()
    .default(2),
});
