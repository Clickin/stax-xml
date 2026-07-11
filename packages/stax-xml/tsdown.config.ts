import { defineConfig } from 'tsdown';

// Bundle private workspace packages into the public dist so the packed
// output contains zero runtime imports from stax-xml-core/sync/async/converter.
const bundleWorkspace = {
  deps: {
    alwaysBundle: [
      'stax-xml-core',
      'stax-xml-sync',
      'stax-xml-async',
      'stax-xml-converter',
    ],
  },
};

export default defineConfig([
  // Build main index separately to prevent chunk splitting
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    platform: "neutral",
    outDir: 'dist',
    logLevel: 'error',
    minify: true,
    ...bundleWorkspace,
  },
  // Build the converter subpath separately to prevent chunk splitting.
  {
    entry: {
      converter: 'src/converter.ts',
    },
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    clean: false, // Don't clean to preserve index.* files
    platform: "neutral",
    logLevel: 'error',
    minify: true,
    ...bundleWorkspace,
  }
]);
