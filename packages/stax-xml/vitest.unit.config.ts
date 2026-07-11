import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'test/v1-reader-contract.test.ts',
      'test/converter/**/*.test.ts',
      'test/writer.test.ts',
      'test/writer-async.test.ts',
      'test/writer-core-regression.test.ts',
      'test/writeoptions.test.ts',
    ],
    globals: true,
    environment: 'node',
    pool: 'threads',
    fileParallelism: false,
    maxWorkers: 1,
    exclude: [
      'test/performance.test.ts',
      'test/converter/performance-benchmark.test.ts',
      'test/converter/large-file-performance.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'test/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/build.ts',
        'src/index.ts',
      ],
    },
  },
})
