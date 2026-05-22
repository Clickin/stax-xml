#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MiB = 1024 * 1024;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultOut = resolve(
  scriptDir,
  "..",
  "results",
  "tmp",
  "substring-retention.json",
);

const methodAliases = new Map([
  ["direct", "direct"],
  ["suffix", "suffix-detach"],
  ["suffix-detach", "suffix-detach"],
  ["json", "json-copy"],
  ["json-copy", "json-copy"],
]);

const help = `Usage:
  node packages/benchmark/substring-retention/run-retention.mjs [options]

Presets:
  --quick       chromium, direct/suffix-detach/json-copy, 3 batches, 4 chunks
  --stress      chromium/firefox/webkit, 8 batches, 20 chunks

Options:
  --browsers=chromium,firefox,webkit
  --methods=direct,suffix-detach,json-copy
  --repeats=1
  --batches=8
  --chunks-per-batch=20
  --chunk-mib=2
  --token-len=108
  --min-detach-len=0
  --pressure-mib=128
  --settle-ms=150
  --hold-ms=500
  --seed=0
  --out=packages/benchmark/results/tmp/substring-retention.json
  --chromium-channel=chrome
  --dry-run
  --serve-only
  --help
`;

function parseArgs(argv) {
  const config = {
    browsers: ["chromium"],
    methods: ["direct", "suffix-detach", "json-copy"],
    repeats: 1,
    batches: 8,
    chunksPerBatch: 20,
    chunkMiB: 2,
    tokenLen: 108,
    minDetachLen: 0,
    pressureMiB: 128,
    settleMs: 150,
    holdMs: 500,
    seed: 0,
    out: defaultOut,
    chromiumChannel: undefined,
    dryRun: false,
    serveOnly: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      config.help = true;
      continue;
    }
    if (arg === "--quick") {
      config.browsers = ["chromium"];
      config.methods = ["direct", "suffix-detach", "json-copy"];
      config.repeats = 1;
      config.batches = 3;
      config.chunksPerBatch = 4;
      config.chunkMiB = 1;
      config.pressureMiB = 32;
      config.holdMs = 100;
      config.settleMs = 50;
      continue;
    }
    if (arg === "--stress") {
      config.browsers = ["chromium", "firefox", "webkit"];
      config.methods = ["direct", "suffix-detach", "json-copy"];
      config.repeats = 1;
      config.batches = 8;
      config.chunksPerBatch = 20;
      config.chunkMiB = 2;
      config.pressureMiB = 128;
      config.holdMs = 500;
      config.settleMs = 150;
      continue;
    }
    if (arg === "--dry-run") {
      config.dryRun = true;
      continue;
    }
    if (arg === "--serve-only") {
      config.serveOnly = true;
      continue;
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }

    const eq = arg.indexOf("=");
    if (eq === -1) {
      throw new Error(`Expected --name=value option, got: ${arg}`);
    }

    const key = arg.slice(2, eq);
    const value = arg.slice(eq + 1);
    switch (key) {
      case "browsers":
        config.browsers = splitList(value);
        break;
      case "methods":
        config.methods = splitList(value).map(normalizeMethod);
        break;
      case "repeats":
        config.repeats = toPositiveInteger(key, value);
        break;
      case "batches":
        config.batches = toPositiveInteger(key, value);
        break;
      case "chunks-per-batch":
        config.chunksPerBatch = toPositiveInteger(key, value);
        break;
      case "chunk-mib":
        config.chunkMiB = toPositiveNumber(key, value);
        break;
      case "token-len":
        config.tokenLen = toPositiveInteger(key, value);
        break;
      case "min-detach-len":
        config.minDetachLen = toNonNegativeInteger(key, value);
        break;
      case "pressure-mib":
        config.pressureMiB = toNonNegativeInteger(key, value);
        break;
      case "settle-ms":
        config.settleMs = toNonNegativeInteger(key, value);
        break;
      case "hold-ms":
        config.holdMs = toNonNegativeInteger(key, value);
        break;
      case "seed":
        config.seed = toNonNegativeInteger(key, value);
        break;
      case "out":
        config.out = resolve(value);
        break;
      case "chromium-channel":
        config.chromiumChannel = value || undefined;
        break;
      default:
        throw new Error(`Unknown option: --${key}`);
    }
  }

  validateConfig(config);
  return config;
}

function splitList(value) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeMethod(method) {
  const normalized = methodAliases.get(method);
  if (!normalized) {
    throw new Error(`Unknown method: ${method}`);
  }
  return normalized;
}

function toPositiveInteger(name, value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

function toNonNegativeInteger(name, value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
  return parsed;
}

function toPositiveNumber(name, value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive number`);
  }
  return parsed;
}

function validateConfig(config) {
  const browserSet = new Set(["chromium", "firefox", "webkit"]);
  for (const browser of config.browsers) {
    if (!browserSet.has(browser)) {
      throw new Error(`Unknown browser: ${browser}`);
    }
  }
  if (config.tokenLen >= config.chunkMiB * MiB) {
    throw new Error("--token-len must be smaller than chunk byte length");
  }
}

function linearSlope(points) {
  const filtered = points.filter((point) => Number.isFinite(point.y));
  const n = filtered.length;
  if (n < 2) {
    return null;
  }

  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (const { x, y } of filtered) {
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumXY += x * y;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) {
    return null;
  }
  return (n * sumXY - sumX * sumY) / denom;
}

function pageMemoryMiB(pageSample) {
  if (pageSample?.measureUserAgentSpecificMemory?.bytes) {
    return pageSample.measureUserAgentSpecificMemory.bytes / MiB;
  }
  if (pageSample?.performanceMemory?.usedJSHeapSize) {
    return pageSample.performanceMemory.usedJSHeapSize / MiB;
  }
  return null;
}

function summarizeRun(config, samples) {
  const retainedSamples = samples.filter((sample) => sample.batchNumber > 0);
  const baseline = samples.find((sample) => sample.label === "prepared");
  const final = retainedSamples.at(-1);
  const expectedParentMiBPerBatch = config.chunkMiB * config.chunksPerBatch;
  const rssSlopeMiBPerBatch = linearSlope(
    retainedSamples.map((sample) => ({
      x: sample.batchNumber,
      y: sample.processTreeRssMiB,
    })),
  );
  const pageSlopeMiBPerBatch = linearSlope(
    retainedSamples.map((sample) => ({
      x: sample.batchNumber,
      y: pageMemoryMiB(sample.pageSample),
    })),
  );

  return {
    expectedParentMiBPerBatch,
    rssSlopeMiBPerBatch,
    pageSlopeMiBPerBatch,
    slopeRatioToExpectedParent:
      rssSlopeMiBPerBatch == null
        ? null
        : rssSlopeMiBPerBatch / expectedParentMiBPerBatch,
    finalMinusBaselineRssMiB:
      baseline && final
        ? final.processTreeRssMiB - baseline.processTreeRssMiB
        : null,
    baselineRssMiB: baseline?.processTreeRssMiB ?? null,
    finalRssMiB: final?.processTreeRssMiB ?? null,
  };
}

async function startServer() {
  const page = await readFile(resolve(scriptDir, "retention-page.html"));
  const server = createServer((request, response) => {
    if (request.url !== "/" && request.url !== "/retention-page.html") {
      response.writeHead(404);
      response.end("not found");
      return;
    }

    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-embedder-policy": "require-corp",
      "cache-control": "no-store",
    });
    response.end(page);
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });

  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/retention-page.html`;
  return {
    url,
    close: () =>
      new Promise((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()));
      }),
  };
}

async function sampleProcessTreeRssMiB(rootPid) {
  if (!rootPid) {
    return null;
  }

  const processes =
    process.platform === "win32"
      ? await listWindowsProcesses()
      : await listPosixProcesses();
  const byParent = new Map();

  for (const proc of processes) {
    if (!byParent.has(proc.ppid)) {
      byParent.set(proc.ppid, []);
    }
    byParent.get(proc.ppid).push(proc);
  }

  let rssKiB = 0;
  const stack = [Number(rootPid)];
  const seen = new Set();
  while (stack.length > 0) {
    const pid = stack.pop();
    if (seen.has(pid)) {
      continue;
    }
    seen.add(pid);

    const proc = processes.find((entry) => entry.pid === pid);
    if (proc) {
      rssKiB += proc.rssKiB;
    }
    for (const child of byParent.get(pid) || []) {
      stack.push(child.pid);
    }
  }

  return rssKiB / 1024;
}

async function listPosixProcesses() {
  const { stdout } = await execFileAsync("ps", ["-axo", "pid=,ppid=,rss="], {
    maxBuffer: 16 * MiB,
  });
  return stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const [pid, ppid, rssKiB] = line.trim().split(/\s+/).map(Number);
      return { pid, ppid, rssKiB };
    })
    .filter((proc) => Number.isFinite(proc.pid));
}

async function listWindowsProcesses() {
  const command =
    "Get-CimInstance Win32_Process | " +
    "Select-Object ProcessId,ParentProcessId,WorkingSetSize | " +
    "ConvertTo-Json -Compress";
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-Command", command],
    { maxBuffer: 64 * MiB },
  );
  const parsed = JSON.parse(stdout);
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows.map((row) => ({
    pid: Number(row.ProcessId),
    ppid: Number(row.ParentProcessId),
    rssKiB: Number(row.WorkingSetSize || 0) / 1024,
  }));
}

async function delay(ms) {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(
      [
        "Playwright is required for browser retention runs.",
        "The harness keeps Playwright optional so this repo does not add a new dependency by default.",
        "Install it in the benchmark environment, then rerun this script.",
        `Original import error: ${(error && error.message) || error}`,
      ].join("\n"),
    );
  }
}

async function launchBrowserServer(playwright, browserName, config) {
  const browserType = playwright[browserName];
  const launchOptions = {
    headless: true,
  };

  if (browserName === "chromium") {
    launchOptions.args = ["--js-flags=--expose-gc"];
    if (config.chromiumChannel) {
      launchOptions.channel = config.chromiumChannel;
    }
  }

  const server = await browserType.launchServer(launchOptions);
  const browser = await browserType.connect(server.wsEndpoint());
  return { server, browser };
}

async function runOne(playwright, serverUrl, browserName, method, repeat, config) {
  const { server, browser } = await launchBrowserServer(
    playwright,
    browserName,
    config,
  );
  const rootPid = server.process()?.pid ?? null;
  const context = await browser.newContext();
  const page = await context.newPage();
  const samples = [];

  try {
    await page.goto(serverUrl);
    await page.waitForFunction(() => Boolean(globalThis.__retention));

    const pageConfig = {
      method,
      chunkMiB: config.chunkMiB,
      chunksPerBatch: config.chunksPerBatch,
      tokenLen: config.tokenLen,
      minDetachLen: config.minDetachLen,
      pressureMiB: config.pressureMiB,
      settleMs: config.settleMs,
      seed: config.seed + repeat * 100000,
      store: "object",
      keepScratch: true,
    };

    const prepared = await page.evaluate(
      (cfg) => globalThis.__retention.prepare(cfg),
      pageConfig,
    );
    await delay(config.holdMs);
    samples.push({
      label: "prepared",
      batchNumber: 0,
      processTreeRssMiB: await sampleProcessTreeRssMiB(rootPid),
      pageSample: prepared,
    });

    for (let batchIndex = 0; batchIndex < config.batches; batchIndex++) {
      const batch = await page.evaluate(
        ({ cfg, index }) => globalThis.__retention.retainBatch(cfg, index),
        { cfg: pageConfig, index: batchIndex },
      );
      await delay(config.holdMs);
      samples.push({
        label: `batch-${batchIndex + 1}`,
        batchNumber: batchIndex + 1,
        processTreeRssMiB: await sampleProcessTreeRssMiB(rootPid),
        pageSample: batch.sample,
        stats: batch.stats,
      });
    }

    const sanity = await page.evaluate(() =>
      globalThis.__retention.getRetainedSanity(),
    );

    return {
      browserName,
      method,
      repeat,
      rootPid,
      config: pageConfig,
      summary: summarizeRun(config, samples),
      sanity,
      samples,
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  if (config.help) {
    process.stdout.write(help);
    return;
  }

  if (config.dryRun) {
    process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
    return;
  }

  const localServer = await startServer();
  try {
    if (config.serveOnly) {
      process.stdout.write(`Serving ${localServer.url}\n`);
      await new Promise(() => {});
    }

    const playwright = await loadPlaywright();
    const results = [];
    const startedAt = new Date().toISOString();

    for (const browserName of config.browsers) {
      for (const method of config.methods) {
        for (let repeat = 0; repeat < config.repeats; repeat++) {
          process.stderr.write(
            `running browser=${browserName} method=${method} repeat=${
              repeat + 1
            }/${config.repeats}\n`,
          );
          results.push(
            await runOne(
              playwright,
              localServer.url,
              browserName,
              method,
              repeat,
              config,
            ),
          );
        }
      }
    }

    const output = {
      startedAt,
      completedAt: new Date().toISOString(),
      serverUrl: localServer.url,
      config,
      results,
    };
    await writeJson(config.out, output);
    process.stdout.write(`Wrote ${config.out}\n`);
  } finally {
    await localServer.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
