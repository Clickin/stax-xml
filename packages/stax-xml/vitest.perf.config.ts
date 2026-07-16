import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@stax-xml': fileURLToPath(new URL('./src', import.meta.url)),
      '@stax-xml/async': fileURLToPath(new URL('./src/async/index.ts', import.meta.url)),
      '@stax-xml/converter': fileURLToPath(new URL('./src/converter/index.ts', import.meta.url)),
      '@stax-xml/core': fileURLToPath(new URL('./src/core/index.ts', import.meta.url)),
      '@stax-xml/sync': fileURLToPath(new URL('./src/sync/index.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    pool: 'threads',
    fileParallelism: false,
    maxWorkers: 1,
    include: [
      'test/performance.test.ts',
      'test/converter/large-file-performance.test.ts',
    ],
    testTimeout: 30000,
  },
});
