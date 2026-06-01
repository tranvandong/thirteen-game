ALTER TABLE "game_configs" ADD COLUMN "red_pig_score" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_configs" ADD COLUMN "black_pig_score" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_configs" ADD COLUMN "triple_score" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_configs" ADD COLUMN "khap_score" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_configs" ADD COLUMN "khap_limit" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_configs" ADD COLUMN "sanh_score" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_configs" ADD COLUMN "sanh_limit" integer DEFAULT 2 NOT NULL;