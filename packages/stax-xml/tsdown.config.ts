import { defineConfig } from 'tsdown';

export default defineConfig([
  // Build main index separately to prevent chunk splitting
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: { eager: true },
    platform: "neutral",
    outDir: 'dist',
    logLevel: 'error',
    minify: true,
  },
  // Build the converter subpath separately to prevent chunk splitting.
  {
    entry: {
      converter: 'src/converter.ts',
    },
    format: ['esm'],
    dts: { eager: true },
    outDir: 'dist',
    clean: false, // Don't clean to preserve index.* files
    platform: "neutral",
    logLevel: 'error',
    minify: true,
  }
]);
