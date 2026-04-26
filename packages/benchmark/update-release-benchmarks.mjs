import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { open as openFile } from 'node:fs/promises';
import { cpus, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { bench, barplot, run, summary } from 'mitata';
import { Builder } from 'xml2js';
import xml2js from 'xml2js';
import * as txml from 'txml';
import {
  StaxXmlParserSync,
  StaxXmlWriter,
  StaxXmlWriterSync,
  StaxXmlWriterSyncSink,
} from 'stax-xml';
import { StaxXmlNodeIterableParser, nodeFileByteBatchesSync } from 'stax-xml/iterable/node';
import {
  createStaxParserSurfaceRunners,
  loadNativeAggregateProbe,
  parseXmlToObjectBaseline,
  STAX_PARSER_SURFACE_SCENARIOS,
} from './common/parser-scenarios.mjs';
import { normalizeFxpWriterTree, normalizeOrderedWriterTree, writeWriterTreeAsync, writeWriterTreeSync } from './common/writer-tree.mjs';
import { ASSET_PATHS, loadJsonFile, loadXmlBuffer } from './common/utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, '..', '..');
export const benchmarkDir = resolve(__dirname);
export const resultsDir = join(benchmarkDir, 'results', 'release');
export const rawDir = join(resultsDir, 'raw');
export const summaryPath = join(resultsDir, 'latest-summary.json');
export const benchmarkMarkdownPath = join(repoRoot, 'BENCHMARK.md');
const runtimeMatrixPath = join(resultsDir, 'runtime-matrix.json');
const crossRuntimeComparisonPath = join(resultsDir, 'cross-runtime-comparison.json');
const benchmarkPackageJsonPath = join(benchmarkDir, 'package.json');
const rootPackageJsonPath = join(repoRoot, 'package.json');
const iterableFileChunkSize = 1024 * 1024;
const iterableFileBatchSize = 1;
const iterableFileSizeCases = [
  { id: '1mib', display: '1MiB', targetBytes: 1024 ** 2 },
  { id: '10mib', display: '10MiB', targetBytes: 10 * 1024 ** 2 },
  { id: '100mib', display: '100MiB', targetBytes: 100 * 1024 ** 2 },
  { id: '1gib', display: '1GiB', targetBytes: 1024 ** 3 },
];
const largeAsyncFileCase = { id: '4gib', display: '4GiB', targetBytes: 4 * 1024 ** 3 };
const githubBlobBase = 'https://github.com/Clickin/stax-xml/blob/master/';

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    only: null,
    verbose: true,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;

    if (arg === '--quiet') {
      args.verbose = false;
      continue;
    }

    if (arg === '--only' && argv[index + 1]) {
      args.only = new Set(argv[index + 1].split(',').map((value) => value.trim()).filter(Boolean));
      index++;
      continue;
    }
    if (arg.startsWith('--only=')) {
      args.only = new Set(arg.slice('--only='.length).split(',').map((value) => value.trim()).filter(Boolean));
    }
  }

  return args;
}

function runCommand(command, commandArgs, options = {}) {
  const baseOptions = {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  };

  const result = process.platform === 'win32' && command === 'pnpm'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', `pnpm ${commandArgs.join(' ')}`], baseOptions)
    : spawnSync(command, commandArgs, baseOptions);

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${commandArgs.join(' ')}`);
  }
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function readJsonFileIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  return readJsonFile(filePath);
}

function packageJsonPathFor(packageName) {
  switch (packageName) {
    case 'stax-xml':
      return join(repoRoot, 'packages', 'stax-xml', 'package.json');
    case '@stax-xml/native-aggregate-probe':
      return join(repoRoot, 'packages', 'native-aggregate', 'package.json');
    default: {
      const segments = packageName.startsWith('@') ? packageName.split('/') : [packageName];
      return join(benchmarkDir, 'node_modules', ...segments, 'package.json');
    }
  }
}

function collectBenchmarkPackageVersions() {
  const benchmarkPackage = readJsonFile(benchmarkPackageJsonPath);
  return Object.entries(benchmarkPackage.dependencies ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, declared]) => {
      const packageJsonPath = packageJsonPathFor(name);
      const packageJson = readJsonFileIfExists(packageJsonPath);
      return {
        name,
        declared,
        version: packageJson?.version ?? null,
        source: name === 'stax-xml' || name.startsWith('@stax-xml/') ? 'workspace' : 'npm',
        status: packageJson ? 'ok' : 'missing',
      };
    });
}

function commandCandidates(command) {
  if (process.platform !== 'win32' || /\.[a-z0-9]+$/i.test(command)) {
    return [command];
  }
  return [command, `${command}.exe`, `${command}.cmd`, `${command}.bat`];
}

function quoteCmdArgument(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@=+-]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function spawnVersionCandidate(candidate, args) {
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(candidate)) {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', [candidate, ...args].map(quoteCmdArgument).join(' ')], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
  return spawnSync(candidate, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function spawnCommandVersion(command, args) {
  let missing;
  for (const candidate of commandCandidates(command)) {
    const result = spawnVersionCandidate(candidate, args);
    if (!result.error) {
      return { command: candidate, result };
    }
    missing = result.error;
  }
  return { command, result: { error: missing } };
}

function commandVersion(id, command, args, { stderr = false } = {}) {
  const { command: resolvedCommand, result } = spawnCommandVersion(command, args);
  if (result.error) {
    return { id, command: [command, ...args].join(' '), version: null, status: 'missing', reason: result.error.message };
  }
  if (result.status !== 0) {
    return {
      id,
      command: [resolvedCommand, ...args].join(' '),
      version: null,
      status: 'failed',
      reason: (result.stderr || result.stdout || `exit ${result.status}`).trim(),
    };
  }
  const output = stderr ? `${result.stderr}\n${result.stdout}` : `${result.stdout}\n${result.stderr}`;
  const version = output.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
  return { id, command: [resolvedCommand, ...args].join(' '), version, status: version ? 'ok' : 'unknown' };
}

function collectRuntimeVersions() {
  return [
    { id: 'node', command: process.execPath, version: process.version, status: 'ok' },
    commandVersion('pnpm', 'pnpm', ['--version']),
    commandVersion('bun', 'bun', ['--version']),
    commandVersion('deno', 'deno', ['--version']),
    commandVersion('java', 'java', ['-version'], { stderr: true }),
    commandVersion('rustc', 'rustc', ['--version']),
    commandVersion('cargo', 'cargo', ['--version']),
  ];
}

function collectNodeComponentVersions() {
  const keys = ['node', 'v8', 'uv', 'openssl', 'zlib', 'brotli', 'ares', 'icu', 'unicode', 'modules', 'napi'];
  return keys
    .filter((key) => process.versions[key])
    .map((key) => ({ name: key, version: process.versions[key] }));
}

function collectBenchmarkEnvironment(baseEnvironment) {
  const rootPackage = readJsonFileIfExists(rootPackageJsonPath);
  return {
    ...baseEnvironment,
    packageManager: rootPackage?.packageManager ?? null,
    packages: collectBenchmarkPackageVersions(),
    runtimes: collectRuntimeVersions(),
    nodeComponents: collectNodeComponentVersions(),
  };
}

const benchmarkSourceLinks = {
  environment: [
    ['release aggregation', 'packages/benchmark/update-release-benchmarks.mjs'],
  ],
  'parser-2kb': [
    ['parser-2kb.mjs', 'packages/benchmark/parser-2kb.mjs'],
    ['release aggregation', 'packages/benchmark/update-release-benchmarks.mjs'],
  ],
  'parser-4kb': [
    ['parser-4kb.mjs', 'packages/benchmark/parser-4kb.mjs'],
    ['release aggregation', 'packages/benchmark/update-release-benchmarks.mjs'],
  ],
  'parser-13mb': [
    ['parser-13mb.mjs', 'packages/benchmark/parser-13mb.mjs'],
    ['release aggregation', 'packages/benchmark/update-release-benchmarks.mjs'],
  ],
  'parser-98mb': [
    ['parser-98mb.mjs', 'packages/benchmark/parser-98mb.mjs'],
    ['release aggregation', 'packages/benchmark/update-release-benchmarks.mjs'],
  ],
  'async-size': [
    ['sync/async release aggregation', 'packages/benchmark/update-release-benchmarks.mjs'],
  ],
  'runtime-matrix': [
    ['runtime-matrix.mjs', 'packages/benchmark/runtime-matrix.mjs'],
  ],
  'cross-runtime': [
    ['cross-runtime-comparison.mjs', 'packages/benchmark/cross-runtime-comparison.mjs'],
  ],
  converter: [
    ['converter-plain-output-benchmark.mjs', 'packages/benchmark/converter-plain-output-benchmark.mjs'],
    ['release aggregation', 'packages/benchmark/update-release-benchmarks.mjs'],
  ],
  'writer-small': [
    ['writer release aggregation', 'packages/benchmark/update-release-benchmarks.mjs'],
  ],
  'writer-big': [
    ['writer release aggregation', 'packages/benchmark/update-release-benchmarks.mjs'],
  ],
  'writer-async': [
    ['writer release aggregation', 'packages/benchmark/update-release-benchmarks.mjs'],
  ],
  'writer-1gb': [
    ['writer-1gb.mjs', 'packages/benchmark/writer-1gb.mjs'],
    ['release aggregation', 'packages/benchmark/update-release-benchmarks.mjs'],
  ],
};

function githubSourceLink(label, path) {
  return `[${label}](${githubBlobBase}${path})`;
}

function renderBenchmarkSourceLinks(sectionId) {
  const links = benchmarkSourceLinks[sectionId] ?? benchmarkSourceLinks.environment;
  return `Benchmark source: ${links.map(([label, path]) => githubSourceLink(label, path)).join(', ')}.`;
}

function formatDurationNs(ns) {
  if (ns >= 1e9) return `${(ns / 1e9).toFixed(2)} s`;
  if (ns >= 1e6) return `${(ns / 1e6).toFixed(2)} ms`;
  if (ns >= 1e3) return `${(ns / 1e3).toFixed(2)} µs`;
  return `${ns.toFixed(2)} ns`;
}

function formatDurationNsCompact(ns) {
  if (ns >= 1e9) return `${(ns / 1e9).toFixed(2)} s`;
  if (ns >= 1e6) return `${(ns / 1e6).toFixed(2)} ms`;
  return `${(ns / 1e3).toFixed(2)} µs`;
}

function formatMemory(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} gb`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} mb`;
  return `${(bytes / 1024).toFixed(2)} kb`;
}

function formatOps(avgNs) {
  return `~${(1e9 / avgNs).toLocaleString(undefined, { maximumFractionDigits: avgNs < 1e6 ? 0 : 2 })} ops/sec`;
}

function normalizeSuiteResult(id, title, result) {
  return {
    id,
    title,
    context: {
      arch: result.context.arch,
      runtime: result.context.runtime,
      version: result.context.version,
      cpuName: result.context.cpu.name,
      cpuGHz: Number(result.context.cpu.freq.toFixed(2)),
    },
    cases: result.benchmarks.flatMap((benchmark) =>
      benchmark.runs
        .filter((runEntry) => runEntry.stats)
        .map((runEntry) => ({
          label: runEntry.name,
          avgNs: runEntry.stats.avg,
          minNs: runEntry.stats.min,
          p75Ns: runEntry.stats.p75,
          p99Ns: runEntry.stats.p99,
          maxNs: runEntry.stats.max,
          heapAvgBytes: runEntry.stats.heap?.avg ?? null,
        }))
    ),
  };
}

export function normalizeSuiteResultFromRawFile(id, title, rawFilePath) {
  const raw = JSON.parse(readFileSync(rawFilePath, 'utf8'));
  return normalizeSuiteResult(id, title, raw);
}

function normalizeWriter1gbSuiteResult(id, title, raw) {
  return {
    id,
    title,
    context: raw.context,
    cases: raw.results.map((entry) => {
      const elapsedNs = entry.elapsedMs * 1e6;
      return {
        label: entry.label,
        avgNs: elapsedNs,
        minNs: elapsedNs,
        p75Ns: elapsedNs,
        p99Ns: elapsedNs,
        maxNs: elapsedNs,
        heapAvgBytes: entry.memoryPeak?.heapUsed ?? null,
        rssPeakBytes: entry.memoryPeak?.rss ?? null,
        bytesWritten: entry.bytesWritten,
        records: entry.records,
        throughputMiBs: entry.throughputMiBs,
        targetBytes: raw.targetBytes,
      };
    }),
  };
}

export function normalizeWriter1gbSuiteResultFromRawFile(rawFilePath) {
  const raw = JSON.parse(readFileSync(rawFilePath, 'utf8'));
  return normalizeWriter1gbSuiteResult('writer-1gb', 'Writer 1GiB async vs sync sink', raw);
}

async function runSuite(id, title, registerSuite, verbose) {
  if (verbose) {
    console.log(`\n== ${title} ==`);
  }

  await registerSuite();
  const result = await run({ format: 'quiet', throw: true });
  const normalized = normalizeSuiteResult(id, title, result);
  writeFileSync(join(rawDir, `${id}.json`), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return normalized;
}

async function registerParserSyncSuite(assetPath) {
  const inputBuffer = loadXmlBuffer(assetPath);
  const xmlString = inputBuffer.toString('utf8');
  const nativeAggregate = await loadNativeAggregateProbe();
  const staxSurfaceRunners = createStaxParserSurfaceRunners({
    xmlString,
    inputBuffer,
    native: nativeAggregate,
  });
  const parseObject = () => parseXmlToObjectBaseline(xmlString);
  const parseXml2js = async () => {
    await new Promise((resolve, reject) => {
      xml2js.parseString(xmlString, (err) => (err ? reject(err) : resolve(undefined)));
    });
  };
  const parseFastXml = () => {
    const parser = new XMLParser();
    parser.parse(xmlString);
  };
  const parseTxml = () => {
    txml.parse(xmlString);
  };

  barplot(() => {
    summary(() => {
      bench('stax-xml to object', () => parseObject()).gc('inner');
      for (const scenario of staxSurfaceRunners) {
        bench(scenario.label, scenario.run).gc('inner');
      }
      bench('xml2js', async () => await parseXml2js()).gc('inner');
      bench('fast-xml-parser', () => parseFastXml()).gc('inner');
      bench('txml', () => parseTxml()).gc('inner');
    });
  });
}

function createLargeXmlBookElement(id) {
  return `  <book id="book-${id}" lang="en" code="${id % 97}">` +
    `<title>4GiB Iterable Benchmark ${id}</title>` +
    `<author>Author ${id % 4096}</author>` +
    `<description>Stable text payload for synchronous and asynchronous iterable parsing.</description>` +
    `<chapter number="1">Intro ${id}</chapter>` +
    `<chapter number="2">Body ${id}</chapter>` +
    '</book>\n';
}

function createLargeXmlElementBlock(targetBytes = 1024 * 1024) {
  const parts = [];
  let total = 0;
  let id = 0;
  while (total < targetBytes) {
    const element = createLargeXmlBookElement(id++);
    total += Buffer.byteLength(element);
    parts.push(element);
  }
  return Buffer.from(parts.join(''), 'utf8');
}

function iterableFixturePath(fixtureCase) {
  return join(tmpdir(), `stax-xml-benchmark-${fixtureCase.id}.xml`);
}

function ensureIterableXmlFile(fixtureCase, verbose = true) {
  const filePath = iterableFixturePath(fixtureCase);
  const reusableSlack = Math.min(1024 * 1024, Math.max(4096, Math.floor(fixtureCase.targetBytes / 64)));
  const minimumReusableBytes = fixtureCase.targetBytes - reusableSlack;
  if (existsSync(filePath)) {
    const existing = statSync(filePath);
    if (existing.size >= minimumReusableBytes) {
      if (verbose) {
        console.log(`Reusing ${fixtureCase.display} XML fixture: ${filePath} (${formatMemory(existing.size)})`);
      }
      return { filePath, bytes: existing.size, targetBytes: fixtureCase.targetBytes, label: fixtureCase.display, reused: true };
    }
  }

  if (verbose) {
    console.log(`Creating ${fixtureCase.display} XML fixture: ${filePath}`);
  }

  const fd = openSync(filePath, 'w');
  const header = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<root>\n');
  const footer = Buffer.from('</root>\n');
  const block = createLargeXmlElementBlock();
  let written = 0;
  let tailId = 0;
  const progressBytes = Math.max(512 * 1024 * 1024, Math.floor(fixtureCase.targetBytes / 8));

  try {
    writeSync(fd, header);
    written += header.byteLength;

    while (written + block.byteLength + footer.byteLength <= fixtureCase.targetBytes) {
      writeSync(fd, block);
      written += block.byteLength;
      if (verbose && written % progressBytes < block.byteLength) {
        console.log(`  wrote ${formatMemory(written)}`);
      }
    }

    while (true) {
      const element = Buffer.from(createLargeXmlBookElement(tailId++), 'utf8');
      if (written + element.byteLength + footer.byteLength > fixtureCase.targetBytes) {
        break;
      }
      writeSync(fd, element);
      written += element.byteLength;
    }

    writeSync(fd, footer);
    written += footer.byteLength;
  } finally {
    closeSync(fd);
  }

  if (verbose) {
    console.log(`Created ${formatMemory(written)} XML fixture.`);
  }
  return { filePath, bytes: written, targetBytes: fixtureCase.targetBytes, label: fixtureCase.display, reused: false };
}

function ensureLargeAsyncFile(verbose = true) {
  return ensureIterableXmlFile(largeAsyncFileCase, verbose);
}

function updateMemoryPeak(peak) {
  const current = process.memoryUsage();
  peak.heapUsed = Math.max(peak.heapUsed, current.heapUsed);
  peak.rss = Math.max(peak.rss, current.rss);
}

function mixChecksum(checksum, value) {
  return Math.imul(checksum ^ (value >>> 0), 16777619) >>> 0;
}

function mixSpanChecksum(checksum, buffer, start, end) {
  if (start < 0 || end <= start) {
    return mixChecksum(checksum, 0);
  }
  const length = end - start;
  checksum = mixChecksum(checksum, length);
  checksum = mixChecksum(checksum, buffer[start] ?? 0);
  checksum = mixChecksum(checksum, buffer[start + (length >> 1)] ?? 0);
  checksum = mixChecksum(checksum, buffer[end - 1] ?? 0);
  return checksum;
}

function consumeNodeIterableFrame(parser, state) {
  const buffer = parser.buffer();
  const eventCount = parser.eventCount();
  for (let index = 0; index < eventCount; index++) {
    const type = parser.eventType(index);
    state.events++;
    state.checksum = mixChecksum(state.checksum, type);
    state.checksum = mixSpanChecksum(state.checksum, buffer, parser.nameStart(index), parser.nameEnd(index));
    state.checksum = mixSpanChecksum(state.checksum, buffer, parser.textStart(index), parser.textEnd(index));

    const attrCount = parser.attrCount(index);
    state.checksum = mixChecksum(state.checksum, attrCount);
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      state.checksum = mixSpanChecksum(
        state.checksum,
        buffer,
        parser.attrNameStart(index, attrIndex),
        parser.attrNameEnd(index, attrIndex),
      );
      state.checksum = mixSpanChecksum(
        state.checksum,
        buffer,
        parser.attrValueStart(index, attrIndex),
        parser.attrValueEnd(index, attrIndex),
      );
    }
  }
}

function parseSyncIterableFile(filePath, onProgress) {
  const parser = new StaxXmlNodeIterableParser(
    nodeFileByteBatchesSync(filePath, {
      chunkSize: iterableFileChunkSize,
      batchSize: iterableFileBatchSize,
    }),
  );
  const state = { events: 0, checksum: 2166136261, batches: 0 };
  while (parser.nextBatch()) {
    consumeNodeIterableFrame(parser, state);
    state.batches++;
    if ((state.batches & 255) === 0) {
      onProgress();
    }
  }
  onProgress();
  return state;
}

async function* asyncNodeFileByteBatches(filePath) {
  const handle = await openFile(filePath, 'r');
  let batch = [];
  try {
    while (true) {
      const chunk = Buffer.allocUnsafe(iterableFileChunkSize);
      const { bytesRead } = await handle.read(chunk, 0, iterableFileChunkSize, null);
      if (bytesRead === 0) {
        break;
      }
      batch.push(bytesRead === iterableFileChunkSize ? chunk : chunk.subarray(0, bytesRead));
      if (batch.length >= iterableFileBatchSize) {
        yield batch;
        batch = [];
      }
    }
    if (batch.length > 0) {
      yield batch;
    }
  } finally {
    await handle.close();
  }
}

class SingleBatchIterableSource {
  current = undefined;
  closed = false;

  [Symbol.iterator]() {
    return this;
  }

  push(batch) {
    if (this.current) {
      throw new Error('Async iterable parser source already has a pending batch.');
    }
    this.current = batch;
  }

  close() {
    this.closed = true;
  }

  next() {
    if (this.current) {
      const value = this.current;
      this.current = undefined;
      return { value, done: false };
    }
    if (this.closed) {
      return { value: undefined, done: true };
    }
    throw new Error('Parser requested another async batch before the benchmark awaited one; increase chunk size for this fixture.');
  }
}

async function parseAsyncIterableFile(filePath, onProgress) {
  const source = new SingleBatchIterableSource();
  const parser = new StaxXmlNodeIterableParser(source);
  const state = { events: 0, checksum: 2166136261, batches: 0 };

  for await (const batch of asyncNodeFileByteBatches(filePath)) {
    source.push(batch);
    if (parser.nextBatch()) {
      consumeNodeIterableFrame(parser, state);
    }
    state.batches++;
    if ((state.batches & 255) === 0) {
      onProgress();
    }
  }

  source.close();
  while (parser.nextBatch()) {
    consumeNodeIterableFrame(parser, state);
  }
  onProgress();
  return state;
}

async function measureLargeFileCase(label, fileBytes, runCase) {
  globalThis.gc?.();
  const peak = { heapUsed: 0, rss: 0 };
  updateMemoryPeak(peak);
  const start = performance.now();
  const result = await runCase(() => updateMemoryPeak(peak));
  const elapsedNs = (performance.now() - start) * 1e6;
  updateMemoryPeak(peak);
  globalThis.gc?.();

  return {
    label,
    elapsedNs,
    events: result.events,
    checksum: result.checksum >>> 0,
    batches: result.batches,
    heapPeakBytes: peak.heapUsed,
    rssPeakBytes: peak.rss,
    throughputMiBs: fileBytes / 1024 / 1024 / (elapsedNs / 1e9),
  };
}

function createManualNodeContext() {
  const cpu = cpus()[0];
  return {
    arch: process.arch,
    runtime: 'node',
    version: process.version,
    cpuName: cpu?.model ?? 'manual',
    cpuGHz: cpu?.speed ? Number((cpu.speed / 1000).toFixed(2)) : 0,
  };
}

function normalizeIterableSizeSuiteResult(id, title, raw) {
  return {
    id,
    title,
    context: raw.context,
    fixtures: raw.fixtures,
    cases: raw.cases.map((entry) => ({
      label: entry.label,
      avgNs: entry.elapsedNs,
      minNs: entry.elapsedNs,
      p75Ns: entry.elapsedNs,
      p99Ns: entry.elapsedNs,
      maxNs: entry.elapsedNs,
      heapAvgBytes: entry.heapPeakBytes,
      rssPeakBytes: entry.rssPeakBytes,
      bytesRead: entry.bytes,
      targetBytes: entry.targetBytes,
      fixtureLabel: entry.fixtureLabel,
      eventCount: entry.events,
      checksum: entry.checksum,
      batches: entry.batches,
      throughputMiBs: entry.throughputMiBs,
    })),
  };
}

async function runIterableParserSizeSuite(verbose) {
  const raw = {
    id: 'async-size',
    title: 'Iterable parser sync vs async size comparison',
    generatedAt: new Date().toISOString(),
    context: createManualNodeContext(),
    chunkSize: iterableFileChunkSize,
    batchSize: iterableFileBatchSize,
    fixtures: [],
    cases: [],
  };

  for (const fixtureCase of iterableFileSizeCases) {
    const fixture = ensureIterableXmlFile(fixtureCase, verbose);
    raw.fixtures.push({
      label: fixture.label,
      path: fixture.filePath,
      bytes: fixture.bytes,
      targetBytes: fixture.targetBytes,
      chunkSize: iterableFileChunkSize,
      batchSize: iterableFileBatchSize,
      reused: fixture.reused,
    });

    raw.cases.push({
      ...await measureLargeFileCase(
        `sync Iterable parser (${fixture.label} temp file)`,
        fixture.bytes,
        (onProgress) => parseSyncIterableFile(fixture.filePath, onProgress),
      ),
      fixtureLabel: fixture.label,
      bytes: fixture.bytes,
      targetBytes: fixture.targetBytes,
    });
    raw.cases.push({
      ...await measureLargeFileCase(
        `async Iterable parser (${fixture.label} temp file)`,
        fixture.bytes,
        (onProgress) => parseAsyncIterableFile(fixture.filePath, onProgress),
      ),
      fixtureLabel: fixture.label,
      bytes: fixture.bytes,
      targetBytes: fixture.targetBytes,
    });
  }

  writeFileSync(join(rawDir, 'async-size.json'), `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  return normalizeIterableSizeSuiteResult('async-size', raw.title, raw);
}

function normalizeAsyncFile4gbSuiteResult(id, title, raw) {
  return {
    id,
    title,
    context: raw.context,
    fixture: raw.fixture,
    cases: raw.cases.map((entry) => ({
      label: entry.label,
      avgNs: entry.elapsedNs,
      minNs: entry.elapsedNs,
      p75Ns: entry.elapsedNs,
      p99Ns: entry.elapsedNs,
      maxNs: entry.elapsedNs,
      heapAvgBytes: entry.heapPeakBytes,
      rssPeakBytes: entry.rssPeakBytes,
      bytesRead: raw.fixture.bytes,
      eventCount: entry.events,
      checksum: entry.checksum,
      batches: entry.batches,
      throughputMiBs: entry.throughputMiBs,
    })),
  };
}

async function runAsyncFile4gbSuite(verbose) {
  const fixture = ensureLargeAsyncFile(verbose);
  const context = {
    ...createManualNodeContext(),
  };
  const raw = {
    id: 'async-file-4gb',
    title: '4GiB temp-file Iterable vs AsyncIterable parser',
    generatedAt: new Date().toISOString(),
    context,
    fixture: {
      path: fixture.filePath,
      bytes: fixture.bytes,
      targetBytes: fixture.targetBytes,
      chunkSize: iterableFileChunkSize,
      batchSize: iterableFileBatchSize,
      reused: fixture.reused,
    },
    cases: [],
  };

  raw.cases.push(await measureLargeFileCase(
    'sync Iterable parser (4GiB temp file)',
    fixture.bytes,
    (onProgress) => parseSyncIterableFile(fixture.filePath, onProgress),
  ));
  raw.cases.push(await measureLargeFileCase(
    'async Iterable parser (4GiB temp file)',
    fixture.bytes,
    (onProgress) => parseAsyncIterableFile(fixture.filePath, onProgress),
  ));

  writeFileSync(join(rawDir, 'async-file-4gb.json'), `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  return normalizeAsyncFile4gbSuiteResult('async-file-4gb', raw.title, raw);
}

async function buildXmlAsyncFromJson(data) {
  const stream = new WritableStream();
  const writer = new StaxXmlWriter(stream, { prettyPrint: true, indentString: '  ' });

  async function buildNode(node) {
    if (Array.isArray(node)) {
      for (const item of node) {
        await buildNode(item);
      }
      return;
    }
    if (typeof node !== 'object' || node === null) {
      await writer.writeCharacters(String(node));
      return;
    }

    for (const key of Object.keys(node)) {
      if (key === '_attr' || key === '__text') continue;
      const content = node[key];
      const attributes = content?._attr || {};
      const textContent = content?.__text;
      const attrsForWriter = {};

      for (const attrKey of Object.keys(attributes)) {
        attrsForWriter[attrKey.startsWith('@_') ? attrKey.slice(2) : attrKey] = attributes[attrKey];
      }

      if (Object.keys(content).length === 0 && textContent === undefined) {
        await writer.writeStartElement(key, { attributes: attrsForWriter, selfClosing: true });
      } else {
        await writer.writeStartElement(key, { attributes: attrsForWriter });
        if (textContent !== undefined) {
          await writer.writeCharacters(String(textContent));
        }
        await buildNode(content);
        await writer.writeEndElement();
      }
    }
  }

  await writer.writeStartDocument();
  await buildNode(data);
  await writer.writeEndDocument();
  await writer.flush();
}

function buildXmlSyncFromJson(data) {
  const writer = new StaxXmlWriterSync({ prettyPrint: true, indentString: '  ' });

  function buildNode(node) {
    if (Array.isArray(node)) {
      for (const item of node) {
        buildNode(item);
      }
      return;
    }
    if (typeof node !== 'object' || node === null) {
      writer.writeCharacters(String(node));
      return;
    }

    for (const key of Object.keys(node)) {
      if (key === '_attr' || key === '__text') continue;
      const content = node[key];
      const attributes = content?._attr || {};
      const textContent = content?.__text;
      const attrsForWriter = {};

      for (const attrKey of Object.keys(attributes)) {
        attrsForWriter[attrKey.startsWith('@_') ? attrKey.slice(2) : attrKey] = attributes[attrKey];
      }

      if (Object.keys(content).length === 0 && textContent === undefined) {
        writer.writeStartElement(key, { attributes: attrsForWriter, selfClosing: true });
      } else {
        writer.writeStartElement(key, { attributes: attrsForWriter });
        if (textContent !== undefined) {
          writer.writeCharacters(String(textContent));
        }
        buildNode(content);
        writer.writeEndElement();
      }
    }
  }

  writer.writeStartDocument();
  buildNode(data);
  writer.writeEndDocument();
  return writer.getXmlString();
}

function registerWriterSmallSuite() {
  const jsonOrderedContent = loadJsonFile(ASSET_PATHS.testOrdered);
  const jsonContent = loadJsonFile(ASSET_PATHS.test);
  const orderedWriterTree = normalizeOrderedWriterTree(jsonOrderedContent);

  barplot(() => {
    summary(() => {
      bench('fast-xml-parser builder', () => {
        const builder = new XMLBuilder({ format: true, ignoreAttributes: false });
        builder.build(jsonOrderedContent);
      }).gc('inner');

      bench('stax-xml writer', async () => {
        const stream = new WritableStream();
        const writer = new StaxXmlWriter(stream, {
          prettyPrint: true,
          indentString: '  ',
        });
        await writer.writeStartDocument();
        await writeWriterTreeAsync(writer, orderedWriterTree);
        await writer.writeEndDocument();
      }).gc('inner');

      bench('stax-xml writer sync', () => {
        const writer = new StaxXmlWriterSync({
          prettyPrint: true,
          indentString: '  ',
        });
        writer.writeStartDocument();
        writeWriterTreeSync(writer, orderedWriterTree);
        writer.writeEndDocument();
        writer.getXmlString();
      }).gc('inner');

      bench('stax-xml writer sync sink', () => {
        const { sink, getBytesWritten } = createInMemoryFileSink();
        const writer = new StaxXmlWriterSyncSink(sink, {
          prettyPrint: true,
          indentString: '  ',
        });
        writer.writeStartDocument();
        writeWriterTreeSync(writer, orderedWriterTree);
        writer.writeEndDocument();
        return getBytesWritten();
      }).gc('inner');

      bench('xml2js builder', () => {
        const builder = new Builder({});
        builder.buildObject(jsonContent);
      }).gc('inner');
    });
  });
}

function registerWriterBigSuite() {
  const bigJsonContent = loadJsonFile(ASSET_PATHS.big);
  const bigWriterTree = normalizeFxpWriterTree(bigJsonContent);

  barplot(() => {
    summary(() => {
      bench('fast-xml-parser builder (big.json)', () => {
        const builder = new XMLBuilder({ format: true, ignoreAttributes: false });
        builder.build(bigJsonContent);
      }).gc('inner');

      bench('stax-xml writer (big.json)', async () => {
        const stream = new WritableStream();
        const writer = new StaxXmlWriter(stream);
        await writer.writeStartDocument();
        await writeWriterTreeAsync(writer, bigWriterTree);
        await writer.writeEndDocument();
      }).gc('inner');

      bench('stax-xml writer sync (big.json)', () => {
        const writer = new StaxXmlWriterSync();
        writer.writeStartDocument();
        writeWriterTreeSync(writer, bigWriterTree);
        writer.writeEndDocument();
        writer.getXmlString();
      }).gc('inner');

      bench('stax-xml writer sync sink (big.json)', () => {
        const { sink, getBytesWritten } = createInMemoryFileSink();
        const writer = new StaxXmlWriterSyncSink(sink);
        writer.writeStartDocument();
        writeWriterTreeSync(writer, bigWriterTree);
        writer.writeEndDocument();
        return getBytesWritten();
      }).gc('inner');
    });
  });
}

function nodeStreamToWritableStream(nodeStream) {
  return new WritableStream({
    write(chunk) {
      return new Promise((resolve, reject) => {
        nodeStream.write(chunk, (error) => (error ? reject(error) : resolve()));
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        nodeStream.end((error) => (error ? reject(error) : resolve()));
      });
    },
    abort(reason) {
      nodeStream.destroy(reason);
    },
  });
}

async function writeBooksAsync(outputPath, count) {
  const { createWriteStream } = await import('node:fs');
  const fileStream = createWriteStream(outputPath);
  const writer = new StaxXmlWriter(nodeStreamToWritableStream(fileStream), {
    prettyPrint: true,
    indentString: '  ',
    bufferSize: 64 * 1024,
    enableAutoFlush: true,
  });

  await writer.writeStartDocument();
  await writer.writeStartElement('books');

  for (let index = 0; index < count; index++) {
    const bookId = index + 1;
    await writer.writeStartElement('book', { attributes: { id: `book-${bookId}` } });
    await writer.writeStartElement('title');
    await writer.writeCharacters(`Sample Book Title Number ${bookId} - Lorem ipsum dolor sit amet, consectetur adipiscing elit`);
    await writer.writeEndElement();
    await writer.writeStartElement('author');
    await writer.writeCharacters(`Author Name ${bookId}`);
    await writer.writeEndElement();
    await writer.writeEndElement();

    if (bookId % 1000 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  await writer.writeEndElement();
  await writer.writeEndDocument();
  await writer.flush();
}

function writeBooksSync(count) {
  const writer = new StaxXmlWriterSync({ prettyPrint: true, indentString: '  ' });
  writer.writeStartDocument();
  writer.writeStartElement('books');
  for (let index = 0; index < count; index++) {
    const bookId = index + 1;
    writer.writeStartElement('book', { attributes: { id: `book-${bookId}` } });
    writer.writeStartElement('title');
    writer.writeCharacters(`Sample Book Title Number ${bookId} - Lorem ipsum dolor sit amet, consectetur adipiscing elit`);
    writer.writeEndElement();
    writer.writeStartElement('author');
    writer.writeCharacters(`Author Name ${bookId}`);
    writer.writeEndElement();
    writer.writeEndElement();
  }
  writer.writeEndElement();
  writer.writeEndDocument();
  return writer.getXmlString();
}

function createInMemoryFileSink() {
  let bytesWritten = 0;

  return {
    sink: {
      write(chunk) {
        bytesWritten += Buffer.byteLength(chunk);
      },
      flush() {},
      close() {},
    },
    getBytesWritten: () => bytesWritten,
  };
}

function writeBooksSyncSink(count) {
  const { sink, getBytesWritten } = createInMemoryFileSink();
  const writer = new StaxXmlWriterSyncSink(sink, {
    prettyPrint: true,
    indentString: '  ',
    bufferSize: 64 * 1024,
    enableAutoFlush: true,
    flushThreshold: 0.8,
    flushOnClose: true,
  });

  writer.writeStartDocument();
  writer.writeStartElement('books');
  for (let index = 0; index < count; index++) {
    const bookId = index + 1;
    writer.writeStartElement('book', { attributes: { id: `book-${bookId}` } });
    writer.writeStartElement('title');
    writer.writeCharacters(`Sample Book Title Number ${bookId} - Lorem ipsum dolor sit amet, consectetur adipiscing elit`);
    writer.writeEndElement();
    writer.writeStartElement('author');
    writer.writeCharacters(`Author Name ${bookId}`);
    writer.writeEndElement();
    writer.writeEndElement();
  }
  writer.writeEndElement();
  writer.writeEndDocument();
  writer.close();
  return getBytesWritten();
}

function registerAsyncWriterSuite() {
  const asyncPath1k = join(tmpdir(), 'stax-xml-bench-async-1k.xml');
  const syncPath1k = join(tmpdir(), 'stax-xml-bench-sync-1k.xml');
  const asyncPath5k = join(tmpdir(), 'stax-xml-bench-async-5k.xml');
  const syncPath5k = join(tmpdir(), 'stax-xml-bench-sync-5k.xml');
  const asyncPath10k = join(tmpdir(), 'stax-xml-bench-async-10k.xml');
  const syncPath10k = join(tmpdir(), 'stax-xml-bench-sync-10k.xml');

  barplot(() => {
    summary(() => {
      bench('async writer (1K elements)', async () => {
        await writeBooksAsync(asyncPath1k, 1000);
      }).gc('inner');

      bench('sync writer (1K elements)', () => {
        writeFileSync(syncPath1k, writeBooksSync(1000));
      }).gc('inner');

      bench('sync writer sink in-memory (1K elements)', () => {
        writeBooksSyncSink(1000);
      }).gc('inner');

      bench('async writer (5K elements)', async () => {
        await writeBooksAsync(asyncPath5k, 5000);
      }).gc('inner');

      bench('sync writer (5K elements)', () => {
        writeFileSync(syncPath5k, writeBooksSync(5000));
      }).gc('inner');

      bench('sync writer sink in-memory (5K elements)', () => {
        writeBooksSyncSink(5000);
      }).gc('inner');

      bench('async writer (10K elements)', async () => {
        await writeBooksAsync(asyncPath10k, 10000);
      }).gc('inner');

      bench('sync writer (10K elements)', () => {
        writeFileSync(syncPath10k, writeBooksSync(10000));
      }).gc('inner');

      bench('sync writer sink in-memory (10K elements)', () => {
        writeBooksSyncSink(10000);
      }).gc('inner');
    });
  });
}

export const manifest = [
  {
    id: 'parser-2kb',
    title: 'Parser 2KB (complex.xml)',
    run: () => runSuite('parser-2kb', 'Parser 2KB (complex.xml)', () => registerParserSyncSuite(ASSET_PATHS.complex), true),
  },
  {
    id: 'parser-4kb',
    title: 'Parser 4KB (books.xml)',
    run: () => runSuite('parser-4kb', 'Parser 4KB (books.xml)', () => registerParserSyncSuite(ASSET_PATHS.books), true),
  },
  {
    id: 'parser-13mb',
    title: 'Parser 13MB (midsize.xml)',
    run: () => runSuite('parser-13mb', 'Parser 13MB (midsize.xml)', () => registerParserSyncSuite(ASSET_PATHS.midsize), true),
  },
  {
    id: 'parser-98mb',
    title: 'Parser 98MB (large.xml)',
    run: () => runSuite('parser-98mb', 'Parser 98MB (large.xml)', () => registerParserSyncSuite(ASSET_PATHS.large), true),
  },
  {
    id: 'async-size',
    title: 'Iterable parser sync vs async size comparison',
    run: () => runIterableParserSizeSuite(true),
    normalize: (rawFilePath) => normalizeIterableSizeSuiteResult('async-size', 'Iterable parser sync vs async size comparison', readJsonFile(rawFilePath)),
  },
  {
    id: 'async-file-4gb',
    title: '4GiB temp-file Iterable vs AsyncIterable parser',
    run: () => runAsyncFile4gbSuite(true),
    normalize: (rawFilePath) => normalizeAsyncFile4gbSuiteResult('async-file-4gb', '4GiB temp-file Iterable vs AsyncIterable parser', readJsonFile(rawFilePath)),
  },
  {
    id: 'writer-small',
    title: 'Writer small documents',
    run: () => runSuite('writer-small', 'Writer small documents', registerWriterSmallSuite, true),
  },
  {
    id: 'writer-big',
    title: 'Writer large documents',
    run: () => runSuite('writer-big', 'Writer large documents', registerWriterBigSuite, true),
  },
  {
    id: 'writer-async',
    title: 'Writer async vs sync',
    run: () => runSuite('writer-async', 'Writer async vs sync', registerAsyncWriterSuite, true),
  },
  {
    id: 'writer-1gb',
    title: 'Writer 1GiB async vs sync sink',
    run: () => Promise.resolve(normalizeWriter1gbSuiteResultFromRawFile(join(rawDir, 'writer-1gb.json'))),
  },
  {
    id: 'converter-parity',
    title: 'Converter API vs Plain Parser',
    run: () => {
      const rawFile = join(rawDir, 'converter-parity.json');
      runCommand('pnpm', [
        '--filter=benchmark',
        'run',
        'dev:converter:plain-output',
        '--',
        '--format',
        'json',
        '--out',
        'results/release/raw/converter-parity.json',
      ]);
      return Promise.resolve(normalizeSuiteResultFromRawFile('converter-parity', 'Converter API vs Plain Parser', rawFile));
    },
  },
];

function suiteCase(summary, suiteId, label) {
  const suite = summary.suites[suiteId];
  if (!suite) throw new Error(`Missing suite: ${suiteId}`);
  const found = suite.cases.find((entry) => entry.label === label);
  if (!found) throw new Error(`Missing benchmark case: ${suiteId} / ${label}`);
  return found;
}

function staxParserSurfaceRows() {
  return STAX_PARSER_SURFACE_SCENARIOS.map((scenario) => ({
    display: scenario.display,
    label: scenario.label,
    notes: scenario.notes,
  }));
}

function renderParserTable(summary, suiteId, rows) {
  return [
    '| Library | Average Time | Operations/sec | Memory Usage | Notes |',
    '|---------|--------------|----------------|--------------|-------|',
    ...rows.map((row) => {
      const stats = suiteCase(summary, suiteId, row.label);
      return `| ${row.display} | ${formatDurationNsCompact(stats.avgNs)} | ${formatOps(stats.avgNs)} | ${formatMemory(stats.heapAvgBytes)} | ${row.notes} |`;
    }),
  ].join('\n');
}

function renderAsyncSizeTable(summary) {
  const sizeRows = [
    ['async-size', '1MiB'],
    ['async-size', '10MiB'],
    ['async-size', '100MiB'],
    ['async-size', '1GiB'],
    ['async-file-4gb', '4GiB'],
  ];

  return [
    '| File Size | Parser Type | Processing Time | Memory Usage | Performance Ratio |',
    '|-----------|-------------|-----------------|--------------|-------------------|',
    ...sizeRows.flatMap(([suiteId, size]) => {
      const syncStats = suiteCase(summary, suiteId, `sync Iterable parser (${size} temp file)`);
      const asyncStats = suiteCase(summary, suiteId, `async Iterable parser (${size} temp file)`);
      const asyncRatio = asyncStats.avgNs >= syncStats.avgNs
        ? `${(asyncStats.avgNs / syncStats.avgNs).toFixed(2)}x slower`
        : `${(syncStats.avgNs / asyncStats.avgNs).toFixed(2)}x faster`;
      return [
        `| ${size} temp file | **sync Iterable parser** | ${formatDurationNsCompact(syncStats.avgNs)} | ${formatMemory(syncStats.heapAvgBytes)} | Baseline, ${syncStats.throughputMiBs.toFixed(2)} MiB/s |`,
        `| ${size} temp file | async Iterable parser | ${formatDurationNsCompact(asyncStats.avgNs)} | ${formatMemory(asyncStats.heapAvgBytes)} | ${asyncRatio}, ${asyncStats.throughputMiBs.toFixed(2)} MiB/s |`,
      ];
    }),
  ].join('\n');
}

function renderConverterTable(summary) {
  const rows = [
    ['plain parser', 'Lowest overhead, handwritten state machine'],
    ['converter api', 'Declarative schema with automatic dispatch plan'],
    ['converter api compiled', 'Explicit compile() with cached dispatch plan'],
  ];

  return [
    '| Implementation | Average time | Notes |',
    '| --- | ---: | --- |',
    ...rows.map(([label, notes]) => {
      const stats = suiteCase(summary, 'converter-parity', label);
      return `| ${label} | **${formatDurationNsCompact(stats.avgNs)}** | ${notes} |`;
    }),
  ].join('\n');
}

function renderWriterSmallTable(summary) {
  const rows = [
    ['fast-xml-parser builder', 'fast-xml-parser builder'],
    ['stax-xml writer', 'Writer API'],
    ['stax-xml writer sync', 'Sync writer API'],
    ['stax-xml writer sync sink', 'Sync streaming sink API'],
    ['xml2js builder', 'xml2js builder'],
  ];
  const fastestLabel = rows
    .map(([label]) => [label, suiteCase(summary, 'writer-small', label).avgNs])
    .sort((a, b) => a[1] - b[1])[0][0];

  return [
    '| Library | Average Time | Operations/sec | Memory Usage | Notes |',
    '|---------|--------------|----------------|--------------|-------|',
    ...rows.map(([label, notes]) => {
      const stats = suiteCase(summary, 'writer-small', label);
      const display = label === 'fast-xml-parser builder' ? '**fast-xml-parser builder**'
        : label === 'stax-xml writer sync' ? '**stax-xml writer sync**'
        : label === 'stax-xml writer sync sink' ? '**stax-xml writer sync sink**'
        : label;
      const resolvedNotes = label === fastestLabel && notes !== 'Fastest'
        ? `Fastest, ${notes}`
        : label === fastestLabel
          ? 'Fastest'
          : notes;
      return `| ${display} | ${formatDurationNsCompact(stats.avgNs)} | ${formatOps(stats.avgNs)} | ${formatMemory(stats.heapAvgBytes)} | ${resolvedNotes} |`;
    }),
  ].join('\n');
}

function renderWriterBigTable(summary) {
  const rows = [
    ['fast-xml-parser builder (big.json)', 'fast-xml-parser builder'],
    ['stax-xml writer sync (big.json)', 'Sync writer API'],
    ['stax-xml writer sync sink (big.json)', 'Sync streaming sink API'],
    ['stax-xml writer (big.json)', 'Writer API'],
  ];
  const fastestLabel = rows
    .map(([label]) => [label, suiteCase(summary, 'writer-big', label).avgNs])
    .sort((a, b) => a[1] - b[1])[0][0];

  return [
    '| Library | Average Time | Operations/sec | Memory Usage | Notes |',
    '|---------|--------------|----------------|--------------|-------|',
    ...rows.map(([label, notes]) => {
      const stats = suiteCase(summary, 'writer-big', label);
      const display = label === 'fast-xml-parser builder (big.json)' ? '**fast-xml-parser builder**'
        : label === 'stax-xml writer sync (big.json)' ? '**stax-xml writer sync**'
        : label === 'stax-xml writer sync sink (big.json)' ? '**stax-xml writer sync sink**'
        : 'stax-xml writer';
      const resolvedNotes = label === fastestLabel && notes !== 'Fastest'
        ? `Fastest, ${notes}`
        : label === fastestLabel
          ? 'Fastest'
          : notes;
      return `| ${display} | ${formatDurationNsCompact(stats.avgNs)} | ${formatOps(stats.avgNs)} | ${formatMemory(stats.heapAvgBytes)} | ${resolvedNotes} |`;
    }),
  ].join('\n');
}

function renderAsyncWriterTable(summary) {
  const elementCounts = [
    ['1K elements', 'async writer (1K elements)', 'sync writer (1K elements)', 'sync writer sink in-memory (1K elements)'],
    ['5K elements', 'async writer (5K elements)', 'sync writer (5K elements)', 'sync writer sink in-memory (5K elements)'],
    ['10K elements', 'async writer (10K elements)', 'sync writer (10K elements)', 'sync writer sink in-memory (10K elements)'],
  ];

  return [
    '| Element Count | Async Writer | Sync Writer + File | Sync Writer + Sink | Performance Ratio |',
    '|---------------|--------------|--------------------|--------------------|-------------------|',
    ...elementCounts.map(([label, asyncLabel, syncLabel, sinkLabel]) => {
      const asyncStats = suiteCase(summary, 'writer-async', asyncLabel);
      const syncStats = suiteCase(summary, 'writer-async', syncLabel);
      const sinkStats = suiteCase(summary, 'writer-async', sinkLabel);
      return `| ${label} | ${formatDurationNsCompact(asyncStats.avgNs)} | ${formatDurationNsCompact(syncStats.avgNs)} | ${formatDurationNsCompact(sinkStats.avgNs)} | ${(asyncStats.avgNs / sinkStats.avgNs).toFixed(2)}x faster (sink) |`;
    }),
  ].join('\n');
}

function renderWriter1gbTable(summary) {
  const rows = [
    ['async writer memory WritableStream', 'Async writer + memory WritableStream'],
    ['sync writer sink memory', 'Sync sink writer + memory sink'],
    ['async writer temp file', 'Async writer + temp file'],
    ['sync writer sink temp file', 'Sync sink writer + temp file'],
  ];

  return [
    '| Target | Time | Throughput | Peak Heap | Peak RSS | Written | Records |',
    '|--------|-----:|-----------:|----------:|---------:|--------:|--------:|',
    ...rows.map(([label, display]) => {
      const stats = suiteCase(summary, 'writer-1gb', label);
      const resolvedDisplay = label.startsWith('sync writer sink') ? `**${display}**` : display;
      return `| ${resolvedDisplay} | ${formatDurationNsCompact(stats.avgNs)} | ${stats.throughputMiBs.toFixed(2)} MiB/s | ${formatMemory(stats.heapAvgBytes)} | ${formatMemory(stats.rssPeakBytes)} | ${formatMemory(stats.bytesWritten)} | ${stats.records.toLocaleString()} |`;
    }),
  ].join('\n');
}

function readJsonIfExists(path) {
  if (!existsSync(path)) {
    return undefined;
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function formatRate(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} MiB/s` : 'n/a';
}

function formatMs(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)} ms` : 'n/a';
}

function formatPct(value) {
  return Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%` : 'n/a';
}

function renderRuntimeMatrixTable(runtimeMatrix) {
  return [
    '| Runtime | Version | Scenario | Throughput | Average | Checksum |',
    '| --- | --- | --- | ---: | ---: | ---: |',
    ...runtimeMatrix.results.flatMap((result) => {
      if (result.status !== 'ok') {
        return [`| ${result.runtime.id} | n/a | n/a | n/a | n/a | ${result.status} |`];
      }
      return result.scenarios.map((scenario) =>
        `| ${result.runtime.id} | ${result.runtime.version} | ${scenario.id} | ${formatRate(scenario.mibPerSec)} | ${formatMs(scenario.avgMs)} | ${scenario.checksum} |`
      );
    }),
  ].join('\n');
}

function findScenario(tier, id) {
  return tier.scenarios.find((scenario) => scenario.id === id);
}

function crossTierById(crossRuntime, tierId) {
  return crossRuntime.nodeStringReturn.files[0].tiers.find((tier) => tier.id === tierId);
}

function crossNativeTierById(crossRuntime, tierId) {
  return crossRuntime.nativeAddon?.tiers?.find((tier) => tier.tier === tierId);
}

function crossScenarioById(crossRuntime, tierId, scenarioId) {
  return crossTierById(crossRuntime, tierId)?.scenarios.find((scenario) => scenario.id === scenarioId);
}

function crossComparatorStatus(result) {
  if (!result) return 'missing';
  if (result.status === 'ok') return 'ok';
  return result.reason ?? result.status ?? 'n/a';
}

function crossRelativeToJs(result, jsNode) {
  if (!result?.mibPerSec || !jsNode?.mibPerSec) return 'n/a';
  return `${(result.mibPerSec / jsNode.mibPerSec).toFixed(2)}x`;
}

function renderCrossTierTable(crossRuntime, tierId) {
  const jsNode = crossScenarioById(crossRuntime, tierId, 'node');
  const rows = [
    ['stax-xml JS on Node', jsNode],
    ['stax-xml native addon (JS wrapper)', crossNativeTierById(crossRuntime, tierId)],
    ['Woodstox on Java 8', crossScenarioById(crossRuntime, tierId, 'woodstox')],
    ['quick-xml', crossScenarioById(crossRuntime, tierId, 'quick-xml')],
  ];
  return [
    `### ${tierId}`,
    '',
    '| Implementation | Throughput | Average | Relative to stax-xml JS | Status |',
    '| --- | ---: | ---: | ---: | --- |',
    ...rows.map(([label, result]) =>
      `| ${label} | ${formatRate(result?.mibPerSec)} | ${formatMs(result?.avgMs)} | ${crossRelativeToJs(result, jsNode)} | ${tableCell(crossComparatorStatus(result))} |`
    ),
  ].join('\n');
}

function renderCrossRuntimeTable(crossRuntime) {
  const tiers = crossRuntime.nodeStringReturn.files[0].tiers;
  return tiers.map((tier) => renderCrossTierTable(crossRuntime, tier.id)).join('\n\n');
}

function renderJava25Table(crossRuntime) {
  const rows = crossRuntime.java25Verification.tiers;
  if (rows.length === 0) {
    return `Java 25 verification was skipped: ${crossRuntime.java25Verification.reason}`;
  }
  return [
    '| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Status |',
    '| --- | ---: | ---: | ---: | --- |',
    ...rows.map((entry) =>
      `| ${entry.tier} | ${formatRate(entry.java8MibPerSec)} | ${formatRate(entry.java25?.mibPerSec)} | ${formatPct(entry.deltaVsJava8)} | ${entry.java25?.status ?? 'skipped'} |`
    ),
  ].join('\n');
}

function tableCell(value) {
  if (value === null || value === undefined || value === '') return 'n/a';
  return String(value).replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|');
}

function renderEnvironmentVersionDetails(env) {
  const packages = env.packages ?? [];
  const runtimes = env.runtimes ?? [];
  const nodeComponents = env.nodeComponents ?? [];

  return [
    '<details>',
    '<summary>Resolved package and runtime versions</summary>',
    '',
    '| Benchmark package | Resolved version | Declared range | Source |',
    '| --- | ---: | --- | --- |',
    ...packages.map((entry) =>
      `| ${tableCell(entry.name)} | ${tableCell(entry.version)} | ${tableCell(entry.declared)} | ${tableCell(entry.source)} |`
    ),
    '',
    '| Runtime/tool | Version | Status |',
    '| --- | --- | --- |',
    ...runtimes.map((entry) =>
      `| ${tableCell(entry.id)} | ${tableCell(entry.version)} | ${tableCell(entry.status === 'ok' ? 'ok' : entry.reason ?? entry.status)} |`
    ),
    '',
    '| Node component | Version |',
    '| --- | ---: |',
    ...nodeComponents.map((entry) => `| ${tableCell(entry.name)} | ${tableCell(entry.version)} |`),
    '',
    '</details>',
  ].join('\n');
}

function createParserScenarioDetails() {
  return [
    '<details>',
    '<summary>Scenario contract: Node parser library comparisons</summary>',
    '',
    'Sample XML shape, shortened:',
    '',
    '~~~xml',
    '<catalog>',
    '  <book id="..." category="...">',
    '    <title>...</title>',
    '    <author>...</author>',
    '    <price currency="USD">...</price>',
    '    <tags><tag>...</tag></tags>',
    '  </book>',
    '</catalog>',
    '~~~',
    '',
    'Consumer/output shape, expressed without library-specific syntax:',
    '',
    '~~~text',
    'consume-only:',
    '  for each parser event:',
    '    count or inspect the event',
    '    do not retain a full output tree',
    '',
    'object-output:',
    '  document = {',
    '    catalog: {',
    '      book: [',
    '        { attributes, title, author, price, tags }',
    '      ]',
    '    }',
    '  }',
    '~~~',
    '',
    'Runtime methods:',
    '',
    '- `stax-xml JS fallback event parser`: `StaxXmlParserSync` event loop with a checksum over event type, names, text, and attributes. The XML string is prepared outside the timed region, matching string-only library API-native rows.',
    '- `stax-xml JS fallback event parser (decode+parse)`: byte-source application path that pays `Buffer.toString("utf8")` inside the timed region before running `StaxXmlParserSync`.',
    '- `stax-xml JS Uint8Array iterable`: `StaxXmlIterableParser` byte-frame loop over a reusable `Iterable<Uint8Array[]>` with the same checksum contract.',
    '- `stax-xml native addon event aggregate`: native aggregate probe using the event-object tier inside Rust; it is not a public per-event JavaScript iterator.',
    '- `stax-xml native addon raw aggregate`: native aggregate probe using a coarse Buffer call and direct string materialization inside Rust.',
    '- `stax-xml to object`: `StaxXmlParserSync` plus a local projection into the benchmark object shape.',
    '- `txml`, `fast-xml-parser`, and `xml2js`: each library uses its string API-native object/DOM-style parse API.',
    '- The 13 MiB `xml2js` row is marked as an invalid comparator: `midsize.xml` has repeated top-level elements and xml2js reports only the first top-level element shape instead of the whole document.',
    '- The stax-xml backend/surface rows are embedded directly in each parser table so the fixture and run environment are identical to the third-party rows.',
    '',
    '</details>',
  ].join('\n');
}

function createLargeFileScenarioDetails() {
  return [
    '<details>',
    '<summary>Scenario contract: iterable parser sync and async file traversal</summary>',
    '',
    'Generated XML shape, shortened:',
    '',
    '~~~xml',
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<root>',
    '  <book id="book-N">',
    '    <title>Sample Book Title Number N ...</title>',
    '    <author>Author Name N</author>',
    '    <description>...</description>',
    '    <chapters>',
    '      <chapter number="1">...</chapter>',
    '    </chapters>',
    '  </book>',
    '</root>',
    '~~~',
    '',
    'Consumer/output shape:',
    '',
    '~~~text',
    'parse-result = {',
    '  events: number,',
    '  checksum: structural fold(event type, element/text/attribute span lengths and boundary bytes)',
    '}',
    '~~~',
    '',
    'Parsing methods:',
    '',
    '- Every row in this section uses the same Node iterable event-frame parser over bounded temp-file chunks.',
    '- `sync Iterable parser` uses synchronous file reads and `Iterable<Buffer[]>` batches.',
    '- `async Iterable parser` uses asynchronous file reads as an `AsyncIterable<Buffer[]>`, then hands each awaited batch to the synchronous iterable parser frame loop without retaining one full XML string.',
    '- XML tokenization is CPU-intensive. Async file reads do not make the parse loop non-blocking; if this work would run on a latency-sensitive main event loop thread, offload parsing to a Worker or worker thread.',
    '- These rows intentionally use a structural checksum rather than full string materialization so the table measures iterable backend tokenization/event-frame traversal.',
    '',
    '</details>',
  ].join('\n');
}

function createRuntimeMatrixScenarioDetails(sizeMiB) {
  return [
    '<details>',
    '<summary>Scenario contract: Node, Bun, and Deno runtime matrix</summary>',
    '',
    `The matrix uses one generated single-root ${sizeMiB} MiB XML fixture.`,
    '',
    'Sample XML shape, shortened:',
    '',
    '~~~xml',
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<root>',
    '  <book id="book-N" lang="en" code="...">',
    '    <title>Runtime Benchmark N</title>',
    '    <author>Author ...</author>',
    '    <description>Full string checksum text payload ...</description>',
    '    <chapter number="1">Intro ...</chapter>',
    '    <chapter number="2">Body ...</chapter>',
    '  </book>',
    '</root>',
    '~~~',
    '',
    'Output shape:',
    '',
    '~~~text',
    'runtime-result = {',
    '  scenario: "public-sync-full-string" | "iterable-count-only" | "iterable-full-string",',
    '  eventCount: number,',
    '  checksum: fold(event type, names, text, attr names, attr values),',
    '  peakHeapUsedBytes: number',
    '}',
    '~~~',
    '',
    'Runtime methods:',
    '',
    '- Node reads text with `fs.readFileSync`, then runs the built package through `node --expose-gc`.',
    '- Bun reads text with `Bun.file(path).text()`, then runs the same built JavaScript package.',
    '- Deno reads text with `Deno.readTextFile` under `--allow-read --allow-env`, then runs the same built JavaScript package.',
    '- `public-sync-full-string` uses `StaxXmlParserSync` over one string.',
    '- `iterable-count-only` and `iterable-full-string` use the browser-compatible synchronous iterable byte-batch backend; they are not async parser rows.',
    '- This matrix intentionally excludes native addons.',
    '',
    '</details>',
  ].join('\n');
}

function createCrossRuntimeScenarioDetails(sizeMiB) {
  return [
    '<details>',
    '<summary>Scenario contract: stax-xml JS/native, Woodstox, and quick-xml comparator</summary>',
    '',
    `The comparator uses the same generated ${sizeMiB} MiB XML fixture shape as the runtime matrix.`,
    '',
    'Output shape:',
    '',
    '~~~text',
    'comparator-result = {',
    '  tier: "count-only" | "name-string-only" | "attr-value-string-only" | "text-string-only" | "full-string",',
    '  implementation: "stax-xml-js-node" | "stax-xml-native-addon" | "woodstox-java8" | "quick-xml",',
    '  eventCount: number,',
    '  checksum: fold(selected event data for tier)',
    '}',
    '~~~',
    '',
    'Parsing methods:',
    '',
    '- `stax-xml JS on Node`: built JavaScript iterable backend, run on Node, with tier-specific checksum folding.',
    '- `stax-xml native addon`: JS package wrapper imports the N-API aggregate addon before sampling; each measured sample calls through the wrapper and N-API boundary in the same Node process.',
    '- Woodstox: Java StAX `XMLStreamReader`, namespace-aware parsing disabled, coalescing enabled, DTD/external entities disabled, buffered file input.',
    '- `quick-xml`: Rust `Reader` over buffered file input; declaration, PI, doctype, and comments are skipped; text is trimmed for checksum parity.',
    '- Java 8 is the public Woodstox row because it is Woodstox\'s minimum runtime target; Java 25 is a separate verification row.',
    '',
    '</details>',
  ].join('\n');
}

function createRuntimeAndNativeDirectionBlock() {
  const runtimeMatrix = readJsonIfExists(runtimeMatrixPath);
  const crossRuntime = readJsonIfExists(crossRuntimeComparisonPath);
  if (!runtimeMatrix && !crossRuntime) {
    return '';
  }

  const sections = ['## Runtime Matrix And Native Direction'];

  if (runtimeMatrix) {
    sections.push(`The same built JavaScript implementation was measured on Node, Bun, and Deno with a generated single-root ${runtimeMatrix.fixture.sizeMiB.toFixed(2)} MiB XML fixture. This is a runtime-codegen and compatibility check, not a native-addon benchmark.`);
    sections.push(createRuntimeMatrixScenarioDetails(runtimeMatrix.fixture.sizeMiB.toFixed(2)));
    sections.push(renderBenchmarkSourceLinks('runtime-matrix'));
    sections.push(renderRuntimeMatrixTable(runtimeMatrix));
  }

  if (crossRuntime) {
    sections.push('The non-JS comparator uses the same event-count and checksum contract. It reports stax-xml JS on Node, the stax-xml native addon through its JavaScript package wrapper, Woodstox on Java 8, and quick-xml. Woodstox is reported on Java 8 for the public baseline because Java 8 is its minimum supported runtime target; Java 25 is measured only as a verification check.');
    sections.push(createCrossRuntimeScenarioDetails(crossRuntime.fixture.sizeMiB.toFixed(2)));
    sections.push(renderBenchmarkSourceLinks('cross-runtime'));
    sections.push(renderCrossRuntimeTable(crossRuntime));
    sections.push('### Woodstox Java 25 Verification');
    sections.push(renderJava25Table(crossRuntime));
  }

  sections.push(`### Why Native Addons Are The Acceleration Path

The JavaScript parser remains the compatibility fallback, but it is not the release performance ceiling. Prior pure-JS optimization work improved the iterable event-frame backend, yet full-string workloads still stayed behind native parser baselines, especially \`quick-xml\`. The remaining costs are delimiter scanning, string materialization, and stable object/API shapes around attributes and text.

The Rust native path is intended to move the hot tokenizer and string/span aggregation work into code that can use native and SIMD-oriented scanning strategies, closer in direction to native parsers such as \`quick-xml\` and simdjson-style designs. The package topology therefore keeps \`stax-xml\` as the facade while adding optional native/Wasm acceleration packages; environments that cannot load binaries continue to use the JavaScript fallback.`);

  return `${sections.join('\n\n')}\n`;
}

function createEnglishBenchmarkBlock(summary) {
  const env = summary.environment;

  return `## Benchmark Environment

The refreshed benchmark tables on this page were rerun with:
- **CPU**: ${env.cpuName} (~${env.cpuGHz.toFixed(2)} GHz)
- **Runtime**: ${env.runtime} ${env.version} (${env.arch}) with garbage collection exposed (\`--expose-gc\`)
- **Tool**: [Mitata](https://github.com/evanw/mitata)
- **Canonical Set**: parser 2KB / 4KB / 13MB / 98MB with stax-xml backend/surface rows, iterable sync/async size comparison from 1MiB to 4GiB, writer small / big / async, converter parity

${renderEnvironmentVersionDetails(env)}

## Parser Performance

${createParserScenarioDetails()}

### Parser Fixture Series

The \`parser-*\` series is the comparable parser-library fixture set. Read these tables together, in fixture-size order, before comparing the separate iterable file-traversal and runtime matrices.

#### Small Documents (2KB)

For typical web service responses and configuration files (complex.xml):

${renderBenchmarkSourceLinks('parser-2kb')}

${renderParserTable(summary, 'parser-2kb', [
  { display: '**txml**', label: 'txml', notes: 'Lightweight object parser' },
  { display: '**stax-xml to object**', label: 'stax-xml to object', notes: 'Object conversion' },
  ...staxParserSurfaceRows(),
  { display: 'fast-xml-parser', label: 'fast-xml-parser', notes: 'Object parser' },
  { display: 'xml2js', label: 'xml2js', notes: 'Callback object parser' },
])}

#### Medium Documents (4KB)

For larger API responses and data files (books.xml):

${renderBenchmarkSourceLinks('parser-4kb')}

${renderParserTable(summary, 'parser-4kb', [
  { display: '**txml**', label: 'txml', notes: 'Lightweight object parser' },
  { display: '**stax-xml to object**', label: 'stax-xml to object', notes: 'Object conversion' },
  ...staxParserSurfaceRows(),
  { display: 'fast-xml-parser', label: 'fast-xml-parser', notes: 'Object parser' },
  { display: 'xml2js', label: 'xml2js', notes: 'Callback object parser' },
])}

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

${renderBenchmarkSourceLinks('parser-13mb')}

${renderParserTable(summary, 'parser-13mb', [
  { display: 'xml2js', label: 'xml2js', notes: 'Invalid comparator: first top-level element only*' },
  { display: '**stax-xml to object**', label: 'stax-xml to object', notes: 'Object conversion' },
  ...staxParserSurfaceRows(),
  { display: '**txml**', label: 'txml', notes: 'Lightweight object parser' },
  { display: 'fast-xml-parser', label: 'fast-xml-parser', notes: 'Object parser' },
])}

*xml2js is not a valid whole-document comparator for this fixture. \`midsize.xml\` contains repeated top-level \`<any_name>\` roots, and xml2js returns only the first top-level element shape.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

${renderBenchmarkSourceLinks('parser-98mb')}

${renderParserTable(summary, 'parser-98mb', [
  { display: '**stax-xml to object**', label: 'stax-xml to object', notes: 'Memory efficient' },
  ...staxParserSurfaceRows(),
  { display: '**txml**', label: 'txml', notes: 'Object parser' },
  { display: 'fast-xml-parser', label: 'fast-xml-parser', notes: 'Object parser' },
  { display: 'xml2js', label: 'xml2js', notes: 'Callback object parser' },
])}

### Iterable File Traversal (1MiB to 4GiB)

For processing large XML files (RSS feeds, data exports, etc.):

${createLargeFileScenarioDetails()}

${renderBenchmarkSourceLinks('async-size')}

${renderAsyncSizeTable(summary)}

**Key Insights:**
- This section is the iterable backend throughput view, not a public string parser vs stream parser API comparison.
- The sync and async rows share the same tokenization/event-frame path; the difference is synchronous file reads versus awaited file batches.
- Async iterable parsing can still block the main event loop while each CPU parse batch runs; use a Worker or worker thread when visible latency matters.
- For files above 100MiB, avoid the public full-string sync path when retaining the full XML string is not acceptable; use async streams for non-blocking API ergonomics or the synchronous iterable byte-batch backend for blocking batch jobs.

${createRuntimeAndNativeDirectionBlock()}

## Converter API vs Plain Parser

The benchmark below compares three ways to build the **same object output**:

- A handwritten plain parser built directly on \`StaxXmlParserSync\`
- The declarative converter API with automatic dispatch-plan routing
- The converter API with \`.compile()\` enabled

Current fixture:

- \`catalog\` document
- \`800\` \`<featured>\` elements
- \`800\` \`<book>\` elements
- result includes root object fields, root arrays, direct scalar fields, and transformed derived fields

${renderBenchmarkSourceLinks('converter')}

${renderConverterTable(summary)}

Interpretation:

- The handwritten parser remains the raw-throughput ceiling.
- The normal converter API now auto-routes dispatch-friendly schemas onto the iterable backend and caches the plan on the schema object.
- \`.compile()\` keeps the same output contract while making that dispatch choice explicit and reusable.

## Writer Performance

These builder benchmarks use a builder-friendly intermediate representation on each side.
\`fast-xml-parser\` consumes its ordered object tree directly, while the \`stax-xml\` writer benchmarks normalize the source fixture once into a writer-friendly precompiled tree outside the timed region.
The measured time therefore focuses on XML emission throughput rather than repeated JSON-shape adaptation.
The memory column is Mitata's average heap footprint for the benchmark case, so it includes fixture/tree residency and harness overhead rather than only the incremental output buffer.

### Small Document Building

Building XML documents from small JSON data:

${renderBenchmarkSourceLinks('writer-small')}

${renderWriterSmallTable(summary)}

### Large Document Building (1MB)

Building large XML documents from big JSON data:

${renderBenchmarkSourceLinks('writer-big')}

${renderWriterBigTable(summary)}

### Async vs Sync Writer Comparison

This comparison measures the writer APIs themselves on the same generated document shape. It includes async file output, sync string output followed by file write, and the sync sink path with an in-memory file-like target.
It is intended to show \`stax-xml\` async vs sync overhead and sink overhead, not to imply that all paths have identical durability guarantees.

${renderBenchmarkSourceLinks('writer-async')}

${renderAsyncWriterTable(summary)}

### 1GiB Writer Comparison

This one-shot benchmark writes a 1GiB XML document through both async writer and sync sink writer paths.
It includes in-memory targets and temp-file targets to separate writer overhead from file I/O cost.

${renderBenchmarkSourceLinks('writer-1gb')}

${renderWriter1gbTable(summary)}

Based on this run, \`StaxXmlWriterSyncSink\` is the recommended path for large XML file output. It provides the highest write throughput, and peak RSS stays in the same range as async writing.
`;
}

function createBenchmarkMarkdown(summary) {
  return `# Benchmarks

Generated: ${summary.generatedAt}

Environment:
- CPU: ${summary.environment.cpuName} (~${summary.environment.cpuGHz.toFixed(2)} GHz)
- Runtime: ${summary.environment.runtime} ${summary.environment.version} (${summary.environment.arch})

This report is generated from the canonical release benchmark set. The docs benchmark pages are derived from the same raw JSON results.

${createEnglishBenchmarkBlock(summary)}
`;
}

async function main() {
  const args = parseArgs();
  mkdirSync(rawDir, { recursive: true });

  const suites = {};
  for (const entry of manifest) {
    if (args.only && !args.only.has(entry.id)) {
      continue;
    }
    suites[entry.id] = await entry.run();
  }

  const firstSuite = Object.values(suites)[0];
  if (!firstSuite) {
    throw new Error('No benchmark suites were selected');
  }
  const ranFullCanonicalSet = Object.keys(suites).length === manifest.length;

  if (ranFullCanonicalSet) {
    await aggregateReleaseBenchmarks({ verbose: args.verbose });
  }

  if (args.verbose) {
    if (ranFullCanonicalSet) {
      console.log('\nRaw benchmark execution complete.');
    } else {
      console.log('\nRaw benchmark execution complete. Skipped summary/BENCHMARK generation because only a subset of the canonical set was run.');
    }
  }
}

export async function aggregateReleaseBenchmarks({ verbose = true } = {}) {
  const suites = {};
  for (const entry of manifest) {
    const rawFile = join(rawDir, `${entry.id}.json`);
    suites[entry.id] = entry.normalize
      ? entry.normalize(rawFile)
      : entry.id === 'writer-1gb'
        ? normalizeWriter1gbSuiteResultFromRawFile(rawFile)
        : normalizeSuiteResultFromRawFile(entry.id, entry.title, rawFile);
  }
  const firstSuite = Object.values(suites)[0];
  if (!firstSuite) {
    throw new Error('No canonical benchmark results found');
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    environment: collectBenchmarkEnvironment(firstSuite.context),
    suites,
  };

  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeFileSync(benchmarkMarkdownPath, `${createBenchmarkMarkdown(summary)}\n`, 'utf8');

  if (verbose) {
    console.log(`Wrote summary JSON to ${summaryPath}`);
    console.log(`Updated ${benchmarkMarkdownPath}`);
  }

  return summary;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
