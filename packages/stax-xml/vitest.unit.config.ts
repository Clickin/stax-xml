import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@stax-xml": fileURLToPath(new URL("./src", import.meta.url)),
      "stax-xml": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      "stax-xml-async": fileURLToPath(
        new URL("./src/async/index.ts", import.meta.url),
      ),
      "stax-xml-converter": fileURLToPath(
        new URL("./src/converter/index.ts", import.meta.url),
      ),
      "stax-xml-core": fileURLToPath(
        new URL("./src/core/index.ts", import.meta.url),
      ),
      "stax-xml-sync": fileURLToPath(
        new URL("./src/sync/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: [
      "test/v1-reader-contract.test.ts",
      "test/token-cursor-resume.test.ts",
      "test/token-cursor-options-coverage.test.ts",
      "test/namespace.test.ts",
      "test/parser-async-regression.test.ts",
      "test/root-import-host-api.test.ts",
      "test/selfclosing.test.ts",
      "test/writer-options-contract.test.ts",
      "test/converter/**/*.test.ts",
      "test/writer.test.ts",
      "test/writer-async.test.ts",
      "test/writer-core-regression.test.ts",
      "test/writer-core.test.ts",
      "test/xml-validation-coverage.test.ts",
      "test/io-coverage.test.ts",
      "test/event-writer.test.ts",
      "test/writeoptions.test.ts",
    ],
    globals: true,
    environment: "node",
    pool: "threads",
    fileParallelism: false,
    maxWorkers: 1,
    exclude: [
      "test/performance.test.ts",
      "test/converter/performance-benchmark.test.ts",
      "test/converter/large-file-performance.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
      include: ["src/**/*.ts"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "test/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/build.ts",
        "src/index.ts",
      ],
    },
  },
});
