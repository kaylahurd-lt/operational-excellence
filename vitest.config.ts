// STATIC TEMPLATE — copy verbatim. (operational-excellence)
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
