import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // The shared backend contract is source-based and imports this stable
      // internal module. Keep this alias narrow so package imports still use
      // the built WASM and stax-xml artifacts.
      "@stax-xml/core": fileURLToPath(
        new URL("../stax-xml/src/core/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    globals: true,
    pool: "threads",
    fileParallelism: false,
    maxWorkers: 1,
    isolate: true,
  },
});
