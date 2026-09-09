import { defineConfig, defineProject } from "vitest/config";
import { createAssemblyScriptPool } from "vitest-pool-assemblyscript/config";

export default defineConfig({
  test: {
    maxWorkers: 1,
    projects: ["scalar", "simd"].map((variant) =>
      defineProject({
        test: {
          name: `assembly-${variant}`,
          include: ["assembly/__tests__/**/*.as.test.ts"],
          pool: createAssemblyScriptPool({
            extraCompilerFlags: [
              "--runtime", "minimal",
              ...(variant === "simd" ? ["--enable", "simd"] : []),
            ],
          }),
          testTimeout: 30_000,
        },
      }),
    ),
    coverage: {
      provider: "custom",
      customProviderModule: "vitest-pool-assemblyscript/coverage-v8",
      // Pool 0.18 excludes its own "assembly/index.ts" by relative path; the
      // parser is named tokenizer.ts so real source functions are instrumented.
      assemblyScriptInclude: ["assembly/**/*.ts"],
      assemblyScriptExclude: ["assembly/__tests__/**"],
      include: [],
      reporter: ["text", "json-summary", "lcov", "html"],
      reportsDirectory: "coverage/assembly",
    },
  },
});
