import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'threads',
    fileParallelism: false,
    maxWorkers: 1,
    include: [
      'test/performance.test.ts',
      'test/converter/performance-benchmark.test.ts',
      'test/converter/large-file-performance.test.ts',
    ],
    testTimeout: 30000,
  },
});
