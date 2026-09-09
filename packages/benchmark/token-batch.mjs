#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = {
  "13": resolve(HERE, "assets/midsize.xml"),
  "98": resolve(HERE, "assets/large.xml"),
  catalog: resolve(HERE, "assets/books.xml"),
  generated: resolve(HERE, "assets/complex.xml"),
};
const VARIANTS = ["baseline-js", "new-js-b1", "new-js-b8", "new-js-b32", "new-js-b64", "new-wasm-scalar-b128", "new-wasm-simd-b128"];
const options = parseArgs();
if (options.worker) {
  process.stdout.write(`${JSON.stringify(await runWorker(options))}\n`);
} else {
  const report = runParent(options);
  mkdirSync(dirname(options.out), { recursive: true });
  writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Token batch benchmark: ${options.out}`);
}

function parseArgs(argv = process.argv.slice(2)) {
  const result = {
    baselineRoot: undefined,
    processBlocks: 7,
    warmups: 3,
    runs: 7,
    fixtures: ["13", "98", "catalog", "generated"],
    out: resolve(HERE, `results/token-batch-${Date.now()}.json`),
    worker: false,
    variant: undefined,
    fixture: undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (!arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    const [key, inline] = arg.slice(2).split("=", 2);
    const value = inline ?? (key === "worker" ? undefined : argv[++i]);
    if (key !== "worker" && (value === undefined || String(value).startsWith("--"))) throw new Error(`--${key} requires a value.`);
    if (key === "baseline-root") result.baselineRoot = resolve(String(value));
    else if (key === "process-blocks") result.processBlocks = positive(value, key);
    else if (key === "warmups") result.warmups = nonNegative(value, key);
    else if (key === "runs") result.runs = positive(value, key);
    else if (key === "fixtures") result.fixtures = String(value).split(",").map((x) => x.trim()).filter(Boolean);
    else if (key === "out") result.out = resolve(process.cwd(), String(value));
    else if (key === "worker") result.worker = true;
    else if (key === "variant") result.variant = String(value);
    else if (key === "fixture") result.fixture = String(value);
    else throw new Error(`Unknown argument: --${key}`);
  }
  if (!result.worker && !result.baselineRoot) throw new Error("--baseline-root is required for a baseline comparison.");
  if (result.baselineRoot && !existsSync(result.baselineRoot)) throw new Error(`Baseline root does not exist: ${result.baselineRoot}`);
  if (result.worker && (!VARIANTS.includes(result.variant) || !FIXTURES[result.fixture])) throw new Error("Invalid worker variant or fixture.");
  if (result.fixtures.some((fixture) => !FIXTURES[fixture])) throw new Error(`Unknown fixture; choose ${Object.keys(FIXTURES).join(", ")}.`);
  return result;
}

function runParent(config) {
  const blocks = [];
  for (let block = 0; block < config.processBlocks; block++) {
    for (const fixture of config.fixtures) {
      for (const variant of VARIANTS) {
        const child = spawnSync(process.execPath, [import.meta.filename, "--worker", `--variant=${variant}`, `--fixture=${fixture}`, `--warmups=${config.warmups}`, `--runs=${config.runs}`, `--baseline-root=${config.baselineRoot}`], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
        if (child.status !== 0) throw new Error([child.stderr, child.stdout].filter(Boolean).join("\n"));
        blocks.push({ block, ...JSON.parse(child.stdout.trim()) });
      }
    }
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    command: process.argv.join(" "),
    codeSha: gitSha(),
    baselineRoot: config.baselineRoot,
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    options: { processBlocks: config.processBlocks, warmups: config.warmups, runs: config.runs, fixtures: config.fixtures },
    variants: VARIANTS,
    blocks,
  };
}

async function runWorker(config) {
  const bytes = readFileSync(FIXTURES[config.fixture]);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const packageRoot = config.variant === "baseline-js" ? baselinePackageRoot(config.baselineRoot) : resolve(HERE, "../stax-xml");
  const stax = await import(pathToFileURL(distEntry(packageRoot, "index.js")).href);
  let wasm;
  if (config.variant.startsWith("new-wasm")) {
    wasm = await import(pathToFileURL(resolve(HERE, "../wasm/dist/index.js")).href);
    await wasm.initWasm({ variant: config.variant.includes("simd") ? "simd" : "scalar" });
  }
  const options = wasm
    ? wasm.withWasmBackend({})
    : config.variant === "baseline-js"
      ? {}
      : withBatchSize({}, Number(config.variant.slice("new-js-b".length)));
  const samples = [];
  const run = () => {
    const started = performance.now();
    let checksum = 0;
    const reader = new stax.StreamReaderSync(bytes, options);
    try {
      for (let type = reader.next(); type !== null; type = reader.next()) {
        checksum = (checksum + String(type).length + (reader.name()?.length ?? 0) + (reader.text()?.length ?? 0)) >>> 0;
      }
    } finally {
      reader.close();
    }
    return { ms: performance.now() - started, checksum };
  };
  for (let i = 0; i < config.warmups; i++) run();
  for (let i = 0; i < config.runs; i++) samples.push(run());
  return { variant: config.variant, fixture: config.fixture, bytes: bytes.byteLength, fixtureSha256: digest, samples, medianMs: median(samples.map((x) => x.ms)), checksum: samples.at(-1)?.checksum };
}

function positive(value, key) { const n = Number(value); if (!Number.isInteger(n) || n <= 0) throw new Error(`--${key} must be positive.`); return n; }
function nonNegative(value, key) { const n = Number(value); if (!Number.isInteger(n) || n < 0) throw new Error(`--${key} must be non-negative.`); return n; }
function median(values) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; }
function gitSha() { const result = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }); return result.status === 0 ? result.stdout.trim() : undefined; }
function baselinePackageRoot(root) {
  if (existsSync(resolve(root, "index.js"))) return root;
  if (existsSync(resolve(root, "dist/index.js"))) return root;
  return resolve(root, "packages/stax-xml");
}
function distEntry(root, file) { return existsSync(resolve(root, file)) ? resolve(root, file) : resolve(root, "dist", file); }
function withBatchSize(options, size) { Object.defineProperty(options, Symbol.for("stax-xml.experimental.tokenBatchSize"), { configurable: true, enumerable: false, value: size }); return options; }
