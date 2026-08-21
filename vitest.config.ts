import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const appDir = fileURLToPath(new URL("./app", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "~": appDir,
    },
  },
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
  },
});
