import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    converter: "src/converter.ts",
  },
  format: ["esm"],
  dts: true,
  platform: "neutral",
  outDir: "dist",
  logLevel: "error",
  minify: true,
});
