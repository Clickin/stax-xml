import { defineConfig } from 'tsdown';

export default defineConfig([
  // Build main index separately to prevent chunk splitting
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    platform: "neutral",
    outDir: 'dist',
    logLevel: 'error',
    minify: true
  },
  // Build cursor entry separately for direct cursor-only imports
  {
    entry: {
      cursor: 'src/cursor/index.ts',
      iterable: 'src/iterable/index.ts',
      'iterable/node': 'src/iterable/node.ts',
    },
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    clean: false,
    platform: "neutral",
    logLevel: 'error',
    minify: true
  },
  // Build converter separately to prevent chunk splitting
  {
    entry: {
      converter: 'src/converter/index.ts',
    },
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    clean: false, // Don't clean to preserve index.* files
    platform: "neutral",
    logLevel: 'error',
    minify: true
  },
  // Build optional runtime-specific adapters separately so they can be imported via subpaths
  {
    entry: {
      node: 'src/adapters/node.ts',
      bun: 'src/adapters/bun.ts',
      deno: 'src/adapters/deno.ts'
    },
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    clean: false,
    platform: "neutral",
    logLevel: 'error',
    minify: true
  }
]);
