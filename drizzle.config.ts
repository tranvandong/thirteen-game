import {
  defineConfig,
} from "drizzle-kit";

export default defineConfig({
  schema: "./app/db/schema/index.ts",

  dialect: "postgresql",

  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});