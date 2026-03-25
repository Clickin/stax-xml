import { defineConfig } from 'tsdown';

export default defineConfig([
  // Build main index separately to prevent chunk splitting
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: false,
    outDir: 'dist',
    logLevel: 'error',
  },
  // Build converter separately to prevent chunk splitting
  {
    entry: {
      converter: 'src/converter/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: false,
    outDir: 'dist',
    clean: false, // Don't clean to preserve index.* files
    logLevel: 'error',
  },
]);
