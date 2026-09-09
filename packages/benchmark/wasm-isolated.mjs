#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpus, arch, platform, release } from 'node:os';
import { performance } from 'node:perf_hooks';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createStaxParserSurfaceRunners } from './common/parser-scenarios.mjs';
import { ASSET_PATHS } from './common/utils.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = fileURLToPath(import.meta.url);
const MIB = 1024 * 1024;
const VARIANTS = ['js', 'scalar', 'simd'];
const SURFACES = [
  ['stream-reader-sync-bytes', 'stax-xml StreamReaderSync (JS object)'],
  ['converter-bytes', 'stax-xml Converter API (JS object)'],
];
const FIXTURES = {
  '13': { assetPath: ASSET_PATHS.midsize },
  '98': { assetPath: ASSET_PATHS.large },
};

try {
  const options = parseArgs();
  if (options.worker) {
    const result = await runWorker(options);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    const report = runParent(options);
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Isolated Wasm benchmark: ${options.out}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    out: resolve(HERE, 'results/wasm-isolated.json'),
    wasmEntry: pathToFileURL(resolve(HERE, '../wasm/dist/index.js')).href,
    fixtures: ['13', '98'],
    runs: 5,
    warmups: 2,
    worker: false,
    backend: undefined,
    fixture: undefined,
  };

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (!argument.startsWith('--')) throw new Error(`Unknown argument: ${argument}`);
    const equal = argument.indexOf('=');
    const key = equal === -1 ? argument.slice(2) : argument.slice(2, equal);
    let value = equal === -1 ? undefined : argument.slice(equal + 1);
    if (equal === -1 && key !== 'worker') {
      value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`--${key} requires a value.`);
      }
      index++;
    }

    switch (key) {
      case 'out':
        options.out = resolve(process.cwd(), String(value));
        break;
      case 'wasm-entry':
        options.wasmEntry = normalizeWasmEntry(value);
        break;
      case 'fixtures':
        options.fixtures = parseFixtures(value);
        break;
      case 'runs':
        options.runs = parsePositiveInteger(value, '--runs');
        break;
      case 'warmups':
        options.warmups = parseNonNegativeInteger(value, '--warmups');
        break;
      case 'worker':
        options.worker = true;
        break;
      case 'backend':
        options.backend = String(value);
        break;
      case 'fixture':
        options.fixture = String(value);
        break;
      default:
        throw new Error(`Unknown argument: --${key}`);
    }
  }

  if (options.worker) {
    if (!VARIANTS.includes(options.backend)) {
      throw new Error(`Worker backend must be one of: ${VARIANTS.join(', ')}.`);
    }
    if (!Object.hasOwn(FIXTURES, options.fixture)) {
      throw new Error('Worker fixture must be 13 or 98.');
    }
  } else if (options.fixtures.length === 0) {
    throw new Error('--fixtures must include 13 and/or 98.');
  }
  return options;
}

function parseFixtures(value) {
  if (value === undefined || value === true) {
    throw new Error('--fixtures requires a comma-separated value of 13 and/or 98.');
  }
  const fixtures = [...new Set(String(value).split(',').map((part) => part.trim()))];
  if (fixtures.some((fixture) => !Object.hasOwn(FIXTURES, fixture))) {
    throw new Error('--fixtures must contain only 13 and/or 98.');
  }
  return fixtures;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }
  return parsed;
}

function normalizeWasmEntry(value) {
  if (value === undefined || value === true || value === '') {
    throw new Error('--wasm-entry requires a file URL or path.');
  }
  const text = String(value);
  try {
    const url = new URL(text);
    if (url.protocol !== 'file:') {
      throw new Error('--wasm-entry must be a file URL or path.');
    }
    return url.href;
  } catch (error) {
    if (error.message.startsWith('--wasm-entry')) throw error;
    return pathToFileURL(resolve(process.cwd(), text)).href;
  }
}

function runParent(options) {
  const results = {};
  const references = new Map();

  for (const fixture of options.fixtures) {
    results[fixture] = {};
    for (const backend of VARIANTS) {
      const worker = runWorkerProcess(options, backend, fixture);
      for (const [surfaceId, surface] of Object.entries(worker.surfaces)) {
        const key = `${fixture}/${surfaceId}`;
        const reference = references.get(key);
        const parity = reference
          ? {
              digestMatchesReference: surface.resultDigest === reference.digest,
              countMatchesReference: surface.resultCount === reference.count,
            }
          : {
              digestMatchesReference: true,
              countMatchesReference: true,
            };
        parity.completeResultMatchesReference =
          parity.digestMatchesReference && parity.countMatchesReference;
        if (!parity.completeResultMatchesReference) {
          throw new Error(
            `${key}/${backend} complete result mismatch: ` +
            `expected ${reference.digest}/${reference.count}, ` +
            `got ${surface.resultDigest}/${surface.resultCount}`,
          );
        }
        if (!reference) {
          references.set(key, {
            digest: surface.resultDigest,
            count: surface.resultCount,
          });
        }

        results[fixture][surfaceId] ??= {
          bytes: worker.bytes,
          bytesMiB: worker.bytes / MIB,
          variants: {},
        };
        results[fixture][surfaceId].variants[backend] = {
          ...surface,
          backend,
          initVariant: worker.initVariant,
          invocation: worker.invocation,
          runtime: worker.runtime,
          cpu: worker.cpu,
          parity,
        };
      }
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    invocation: process.argv.join(' '),
    command: 'node --expose-gc packages/benchmark/wasm-isolated.mjs',
    options: {
      fixtures: options.fixtures,
      runs: options.runs,
      warmups: options.warmups,
      out: options.out,
      wasmEntry: options.wasmEntry,
    },
    metadata: runtimeMetadata(),
    backendPolicy: {
      js: 'stax-xml JavaScript byte backend',
      scalar: 'wasmTokenBackendFactory after initWasm({ variant: "scalar" })',
      simd: 'wasmTokenBackendFactory after initWasm({ variant: "simd" })',
    },
    measurementNotes: [
      'StreamReaderSync and Converter rows consume the fixture Uint8Array directly.',
      'Only byte-input surfaces are measured; no string fallback is labeled Wasm acceleration.',
      'RSS values are process.memoryUsage() before/after endpoints, not peak RSS.',
    ],
    parity: {
      completeResultDigestsAndCounts: true,
      surfaces: Object.fromEntries(
        [...references].map(([key, value]) => [key, value]),
      ),
    },
    fixtures: results,
  };
}

function runWorkerProcess(options, backend, fixture) {
  const child = spawnSync(process.execPath, [
    '--expose-gc',
    SCRIPT,
    '--worker',
    `--backend=${backend}`,
    `--fixture=${fixture}`,
    `--runs=${options.runs}`,
    `--warmups=${options.warmups}`,
    `--wasm-entry=${options.wasmEntry}`,
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  if (child.error) throw child.error;
  if (child.status !== 0) {
    const detail = [child.stderr?.trim(), child.stdout?.trim()].filter(Boolean).join('\n');
    throw new Error(
      `Worker ${backend}/${fixture} failed with status ${child.status}` +
      (child.signal ? ` (${child.signal})` : '') +
      (detail ? `:\n${detail}` : '.'),
    );
  }
  try {
    return JSON.parse(child.stdout);
  } catch (error) {
    throw new Error(
      `Worker ${backend}/${fixture} returned invalid JSON: ${error.message}\n${child.stdout}`,
    );
  }
}

async function runWorker(options) {
  const fixture = FIXTURES[options.fixture];
  const inputBuffer = readFileSync(fixture.assetPath);
  const wasm = options.backend === 'js'
    ? null
    : await import(options.wasmEntry);
  if (wasm) await wasm.initWasm({ variant: options.backend });

  const runners = createStaxParserSurfaceRunners({
    assetPath: fixture.assetPath,
    // The measured runners use bytes; avoid decoding the fixture for a string surface.
    xmlString: undefined,
    inputBuffer,
    backend: wasm?.wasmTokenBackendFactory,
  });
  const runnerByLabel = new Map(runners.map((runner) => [runner.label, runner]));
  const surfaces = {};

  for (const [surfaceId, label] of SURFACES) {
    const runner = runnerByLabel.get(label);
    if (!runner) throw new Error(`Missing parser scenario: ${label}`);
    surfaces[surfaceId] = await measureSurface(
      runner.run,
      inputBuffer.byteLength,
      options,
    );
  }

  const usage = process.resourceUsage();
  return {
    fixture: options.fixture,
    bytes: inputBuffer.byteLength,
    backend: options.backend,
    initVariant: options.backend === 'js' ? 'js-default' : options.backend,
    invocation: process.argv.join(' '),
    runtime: runtimeMetadata(),
    cpu: {
      model: cpus()[0]?.model ?? null,
      logicalCores: cpus().length,
      userCPUTimeMicros: usage.userCPUTime,
      systemCPUTimeMicros: usage.systemCPUTime,
    },
    surfaces,
  };
}

async function measureSurface(run, bytes, options) {
  let warmupSignature;
  for (let index = 0; index < options.warmups; index++) {
    const value = run();
    if (index === options.warmups - 1) warmupSignature = resultSignature(value);
  }

  const samplesMs = [];
  const memorySamples = [];
  let measuredSignature;
  for (let index = 0; index < options.runs; index++) {
    globalThis.gc?.();
    const before = memoryEndpoint();
    const start = performance.now();
    const value = run();
    const elapsed = performance.now() - start;
    const after = memoryEndpoint();
    samplesMs.push(elapsed);
    memorySamples.push({ before, after });
    if (index === options.runs - 1) measuredSignature = resultSignature(value);
  }
  if (warmupSignature && !sameSignature(warmupSignature, measuredSignature)) {
    throw new Error(
      `Result changed between warmup and measured run: ` +
      `${warmupSignature.digest}/${warmupSignature.count} != ` +
      `${measuredSignature.digest}/${measuredSignature.count}`,
    );
  }

  const medianMs = median(samplesMs);
  return {
    samplesMs,
    medianMs,
    throughputMiBPerSec: bytes / MIB / (medianMs / 1000),
    resultDigest: measuredSignature.digest,
    resultCount: measuredSignature.count,
    memory: summarizeMemory(memorySamples),
  };
}

function resultSignature(value) {
  // This runs after the timer stops so result serialization is not benchmarked.
  const serialized = JSON.stringify(value);
  return {
    digest: createHash('sha256').update(serialized).digest('hex'),
    count: Array.isArray(value) ? value.length : null,
  };
}

function sameSignature(left, right) {
  return left.digest === right.digest && left.count === right.count;
}

function memoryEndpoint() {
  const usage = process.memoryUsage();
  return { heapUsed: usage.heapUsed, rss: usage.rss };
}

function summarizeMemory(samples) {
  return {
    samples: samples.map(({ before, after }) => ({ before, after })),
    heapUsedBeforeMedian: median(samples.map(({ before }) => before.heapUsed)),
    heapUsedAfterMedian: median(samples.map(({ after }) => after.heapUsed)),
    rssBeforeMedian: median(samples.map(({ before }) => before.rss)),
    rssAfterMedian: median(samples.map(({ after }) => after.rss)),
  };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function runtimeMetadata() {
  return {
    node: process.version,
    v8: process.versions.v8,
    platform: `${platform()} ${release()}`,
    arch: arch(),
    execPath: process.execPath,
    gcExposed: typeof globalThis.gc === 'function',
  };
}
