import {
  defineConfig,
} from "drizzle-kit";
import { env } from "./app/lib/env.server";

export default defineConfig({
  schema: "./app/db/schema/index.ts",

  dialect: "postgresql",

  dbCredentials: {
    url: env.DATABASE_URL,
  },
});