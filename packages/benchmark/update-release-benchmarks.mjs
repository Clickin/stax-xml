import { spawnSync } from 'node:child_process';
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { open as openFile } from 'node:fs/promises';
import { cpus, tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { Parser as HtmlParser } from 'htmlparser2';
import { bench, barplot, run, summary } from 'mitata';
import sax from 'sax';
import { SaxesParser } from 'saxes';
import { Builder } from 'xml2js';
import xml2js from 'xml2js';
import * as txml from 'txml';
import {
  EventReader,
  EventReaderSync,
  initStaxXml,
  XmlEventType,
  Writer,
  WriterSync,
  WriterSyncSink,
} from 'stax-xml';
import { resetStaxXmlRuntimeForTests } from 'stax-xml/runtime';
import { parseXmlNodesSync } from 'stax-xml/projection';
import {
  createStaxParserSurfaceRunners,
  ensureNativeReaderRuntime,
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
const runtimeMatrixMarkdownPath = join(resultsDir, 'runtime-matrix.md');
const crossRuntimeComparisonPath = join(resultsDir, 'cross-runtime-comparison.json');
const crossRuntimeComparisonMarkdownPath = join(resultsDir, 'cross-runtime-comparison.md');
const simdxmlUpstreamComparisonPath = join(resultsDir, 'simdxml-upstream-comparison.json');
const simdxmlUpstreamComparisonMarkdownPath = join(resultsDir, 'simdxml-upstream-comparison.md');
const historyDir = join(resultsDir, 'history');
const historyIndexJsonPath = join(historyDir, 'index.json');
const historyIndexMarkdownPath = join(historyDir, 'README.md');
const writer1gbRawPath = join(rawDir, 'writer-1gb.json');
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
const parser98MbMitataOptions = {
  min_samples: 3,
  min_cpu_time: 128 * 1e6,
};

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    aggregateOnly: false,
    includeStress: false,
    only: null,
    runId: null,
    skipAuxiliary: false,
    skipFixtures: false,
    skipHistory: false,
    skipSimdxml: false,
    verbose: true,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;

    if (arg === '--quiet') {
      args.verbose = false;
      continue;
    }

    if (arg === '--aggregate-only') {
      args.aggregateOnly = true;
      continue;
    }

    if (arg === '--include-stress') {
      args.includeStress = true;
      continue;
    }

    if (arg === '--skip-stress') {
      args.includeStress = false;
      continue;
    }

    if (arg === '--skip-auxiliary') {
      args.skipAuxiliary = true;
      continue;
    }

    if (arg === '--skip-fixtures') {
      args.skipFixtures = true;
      continue;
    }

    if (arg === '--skip-history') {
      args.skipHistory = true;
      continue;
    }

    if (arg === '--skip-simdxml') {
      args.skipSimdxml = true;
      continue;
    }

    if (arg === '--run-id' && argv[index + 1]) {
      args.runId = argv[++index];
      continue;
    }
    if (arg.startsWith('--run-id=')) {
      args.runId = arg.slice('--run-id='.length);
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

export function createReleaseRunId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function assertReleaseRunId(runId) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(runId)) {
    throw new Error(`Invalid release benchmark run id: ${runId}`);
  }
}

function releaseRunIdToIso(runId) {
  assertReleaseRunId(runId);
  const match = /^(\d{4}-\d{2}-\d{2}T)(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/.exec(runId);
  return `${match[1]}${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
}

function releaseSnapshotArtifactDefinitions(runDir) {
  return [
    { id: 'benchmark-markdown', source: benchmarkMarkdownPath, target: join(runDir, 'BENCHMARK.md') },
    { id: 'latest-summary-json', source: summaryPath, target: join(runDir, 'latest-summary.json') },
    { id: 'runtime-matrix-json', source: runtimeMatrixPath, target: join(runDir, 'runtime-matrix.json') },
    { id: 'runtime-matrix-markdown', source: runtimeMatrixMarkdownPath, target: join(runDir, 'runtime-matrix.md') },
    { id: 'cross-runtime-json', source: crossRuntimeComparisonPath, target: join(runDir, 'cross-runtime-comparison.json') },
    { id: 'cross-runtime-markdown', source: crossRuntimeComparisonMarkdownPath, target: join(runDir, 'cross-runtime-comparison.md') },
    { id: 'simdxml-upstream-json', source: simdxmlUpstreamComparisonPath, target: join(runDir, 'simdxml-upstream-comparison.json') },
    { id: 'simdxml-upstream-markdown', source: simdxmlUpstreamComparisonMarkdownPath, target: join(runDir, 'simdxml-upstream-comparison.md') },
    { id: 'writer-1gb-raw-json', source: writer1gbRawPath, target: join(runDir, 'raw', 'writer-1gb.json') },
  ];
}

export function createReleaseSnapshotPlan(runId) {
  assertReleaseRunId(runId);
  const runDir = join(historyDir, runId);
  return {
    runId,
    runDir,
    artifacts: releaseSnapshotArtifactDefinitions(runDir),
  };
}

function readReleaseHistoryEntries() {
  if (!existsSync(historyIndexJsonPath)) return [];
  const parsed = readJsonFile(historyIndexJsonPath);
  return Array.isArray(parsed.runs) ? parsed.runs : [];
}

function sortReleaseHistoryEntries(entries) {
  return [...entries].sort((left, right) => {
    const byGeneratedAt = String(right.generatedAt ?? '').localeCompare(String(left.generatedAt ?? ''));
    return byGeneratedAt || String(right.runId ?? '').localeCompare(String(left.runId ?? ''));
  });
}

function historyRelativePath(filePath) {
  return relative(historyDir, filePath).replace(/\\/g, '/');
}

export function renderReleaseHistoryMarkdown(entries) {
  const ordered = sortReleaseHistoryEntries(entries);
  const lines = [
    '# Release Benchmark History',
    '',
    'Generated by `packages/benchmark/update-release-benchmarks.mjs`.',
    '',
    '| Run | Generated | Runtime | Main report | Summary | Related reports |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const entry of ordered) {
    const runtime = entry.environment
      ? `${entry.environment.runtime} ${entry.environment.version} (${entry.environment.arch})`
      : 'unknown';
    lines.push(
      `| \`${entry.runId}\` | ${entry.generatedAt} | ${runtime} | ` +
      `[BENCHMARK.md](./${entry.runId}/BENCHMARK.md) | ` +
      `[summary JSON](./${entry.runId}/latest-summary.json) | ` +
      `[runtime](./${entry.runId}/runtime-matrix.md), ` +
      `[cross-runtime](./${entry.runId}/cross-runtime-comparison.md), ` +
      `[simdxml](./${entry.runId}/simdxml-upstream-comparison.md) |`,
    );
  }

  return `${lines.join('\n')}\n`;
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

function runNodeBenchmarkScript(scriptName, scriptArgs = []) {
  runCommand(process.execPath, ['--expose-gc', join('packages', 'benchmark', scriptName), ...scriptArgs]);
}

function createRuntimeComparisonElement(id) {
  return `  <book id="book-${id}" lang="en" code="${id % 97}">` +
    `<title>Runtime Benchmark ${id}</title>` +
    `<author>Author ${id % 4096}</author>` +
    `<description>Full string checksum text payload ${id} with stable words and numbers.</description>` +
    `<chapter number="1">Intro ${id}</chapter>` +
    `<chapter number="2">Body ${id}</chapter>` +
    '</book>\n';
}

function generateRuntimeComparisonFixture(filePath, targetBytes, verbose = true) {
  mkdirSync(dirname(filePath), { recursive: true });
  const fd = openSync(filePath, 'w');
  const header = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<root>\n');
  const footer = Buffer.from('</root>\n');
  let written = 0;
  let id = 0;

  try {
    writeSync(fd, header);
    written += header.byteLength;
    while (true) {
      const element = Buffer.from(createRuntimeComparisonElement(id++), 'utf8');
      if (written + element.byteLength + footer.byteLength > targetBytes) {
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
    console.log(`Generated runtime comparison fixture at ${filePath} (${formatMemory(written)})`);
  }
}

function ensureReleaseFixtureInventory(verbose = true) {
  const runtimeFixturePath = join(benchmarkDir, 'test-data', 'runtime-comparison-16mib.xml');
  if (!existsSync(runtimeFixturePath)) {
    generateRuntimeComparisonFixture(runtimeFixturePath, 16 * 1024 * 1024, verbose);
  }

  const fixtures = [
    ['parser complex.xml', ASSET_PATHS.complex],
    ['parser books.xml', ASSET_PATHS.books],
    ['parser midsize.xml', ASSET_PATHS.midsize],
    ['parser large.xml', ASSET_PATHS.large],
    ['runtime comparison 16MiB XML', runtimeFixturePath],
  ];

  for (const [label, filePath] of fixtures) {
    if (!existsSync(filePath)) {
      throw new Error(`Missing release benchmark fixture: ${label} (${filePath})`);
    }
  }

  if (verbose) {
    console.log('Release benchmark fixtures are present.');
  }
}

function runAuxiliaryReleaseOutputs(args) {
  runNodeBenchmarkScript('runtime-matrix.mjs');
  runNodeBenchmarkScript('cross-runtime-comparison.mjs');

  if (args.skipSimdxml) {
    if (args.verbose) {
      console.log('Skipped simdxml upstream comparison.');
    }
    return;
  }

  const simdxmlUpstreamDir = join(repoRoot, '.omx', 'upstream', 'simdxml');
  const simdxmlArgs = existsSync(simdxmlUpstreamDir) ? ['--skip-fetch', '--skip-build'] : ['--skip-build'];
  runNodeBenchmarkScript('simdxml-upstream-comparison.mjs', simdxmlArgs);
}

function copyReleaseSnapshot(plan) {
  for (const artifact of plan.artifacts) {
    if (!existsSync(artifact.source)) {
      throw new Error(`Cannot snapshot missing benchmark artifact: ${artifact.source}`);
    }
    mkdirSync(dirname(artifact.target), { recursive: true });
    copyFileSync(artifact.source, artifact.target);
  }
}

function writeReleaseHistory(summary, { runId, verbose = true } = {}) {
  const plan = createReleaseSnapshotPlan(runId);
  copyReleaseSnapshot(plan);

  const entry = {
    runId,
    generatedAt: summary.generatedAt,
    environment: {
      runtime: summary.environment.runtime,
      version: summary.environment.version,
      arch: summary.environment.arch,
    },
    artifacts: plan.artifacts.map((artifact) => ({
      id: artifact.id,
      path: historyRelativePath(artifact.target),
    })),
  };

  writeFileSync(join(plan.runDir, 'metadata.json'), `${JSON.stringify(entry, null, 2)}\n`, 'utf8');

  const entries = readReleaseHistoryEntries().filter((candidate) => candidate.runId !== runId);
  entries.push(entry);
  const ordered = sortReleaseHistoryEntries(entries);
  mkdirSync(historyDir, { recursive: true });
  writeFileSync(historyIndexJsonPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), runs: ordered }, null, 2)}\n`, 'utf8');
  writeFileSync(historyIndexMarkdownPath, renderReleaseHistoryMarkdown(ordered), 'utf8');

  if (verbose) {
    console.log(`Snapshotted release benchmark outputs to ${plan.runDir}`);
    console.log(`Updated release benchmark history index at ${historyIndexMarkdownPath}`);
  }

  return { plan, entry };
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function singleTrailingNewline(text) {
  return `${text.replace(/\n+$/g, '')}\n`;
}

function readJsonFileIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  return readJsonFile(filePath);
}

function packageJsonPathFor(packageName) {
  switch (packageName) {
    case 'stax-xml':
      return join(repoRoot, 'packages', 'stax-xml', 'package.json');
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
  'npm-xml-parsers': [
    ['release aggregation', 'packages/benchmark/update-release-benchmarks.mjs'],
    ['books fixture', 'packages/benchmark/test-data/books.xml'],
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

async function runSuite(id, title, registerSuite, verbose, runOptions = {}) {
  if (verbose) {
    console.log(`\n== ${title} ==`);
  }

  await registerSuite();
  const result = await run({ format: 'quiet', throw: true, ...runOptions });
  const normalized = normalizeSuiteResult(id, title, result);
  writeFileSync(join(rawDir, `${id}.json`), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return normalized;
}

async function registerParserSyncSuite(assetPath) {
  const inputBuffer = loadXmlBuffer(assetPath);
  const xmlString = inputBuffer.toString('utf8');
  await ensureNativeReaderRuntime();
  const staxSurfaceRunners = createStaxParserSurfaceRunners({ xmlString, inputBuffer });
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

async function registerNpmXmlParserSuite() {
  const inputBuffer = loadXmlBuffer(ASSET_PATHS.books);
  const xmlString = inputBuffer.toString('utf8');
  await ensureNativeReaderRuntime();

  barplot(() => {
    summary(() => {
      bench('stax-xml EventReaderSync (JS)', () => consumeStaxEventReader(xmlString, 'js')).gc('inner');
      bench('stax-xml EventReaderSync (native)', () => consumeStaxEventReader(xmlString, 'native')).gc('inner');
      bench('stax-xml ProjectionReader parseXmlNodes (native)', () => {
        parseXmlNodesSync(inputBuffer, { backend: 'native' });
      }).gc('inner');
      bench('fast-xml-parser XMLParser', () => {
        new XMLParser().parse(xmlString);
      }).gc('inner');
      bench('txml parse', () => {
        txml.parse(xmlString, {
          keepWhitespace: false,
          noChildNodes: [],
        });
      }).gc('inner');
      bench('xml2js parseString', async () => {
        await new Promise((resolve, reject) => {
          xml2js.parseString(xmlString, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          });
        });
      }).gc('inner');
      bench('sax strict event parser', () => consumeSax(xmlString)).gc('inner');
      bench('saxes event parser', () => consumeSaxes(xmlString)).gc('inner');
      bench('htmlparser2 xmlMode parser', () => consumeHtmlparser2(xmlString)).gc('inner');
    });
  });
}

function consumeStaxEventReader(xmlString, runtimeBackendPreference) {
  let eventCount = 0;
  let checksum = 0;
  for (const event of new EventReaderSync(xmlString, {}, runtimeBackendPreference)) {
    eventCount++;
    checksum = mixBenchmarkChecksum(checksum, staxEventTypeId(event.type));
    if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
      checksum = foldBenchmarkString(checksum, event.name);
    }
    if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
      checksum = foldBenchmarkString(checksum, event.value?.trim());
    }
    if (event.type === XmlEventType.START_ELEMENT) {
      const attrs = Object.entries(event.attributes ?? {});
      checksum = mixBenchmarkChecksum(checksum, attrs.length);
      for (const [name, value] of attrs) {
        checksum = foldBenchmarkString(checksum, name);
        checksum = foldBenchmarkString(checksum, value);
      }
    }
  }
  return { eventCount, checksum };
}

const BENCH_XML_EVENT_TYPE = {
  START_DOCUMENT: 1,
  END_DOCUMENT: 2,
  START_ELEMENT: 3,
  END_ELEMENT: 4,
  CHARACTERS: 5,
  CDATA: 6,
};

function consumeSax(xmlString) {
  const parser = sax.parser(true, {
    lowercase: false,
    normalize: false,
    trim: false,
    xmlns: false,
  });
  let eventCount = 0;
  let checksum = 0;
  parser.onopentag = (node) => {
    eventCount++;
    checksum = mixBenchmarkChecksum(checksum, BENCH_XML_EVENT_TYPE.START_ELEMENT);
    checksum = foldBenchmarkString(checksum, node.name);
    const attrs = Object.entries(node.attributes ?? {});
    checksum = mixBenchmarkChecksum(checksum, attrs.length);
    for (const [name, value] of attrs) {
      checksum = foldBenchmarkString(checksum, name);
      checksum = foldBenchmarkString(checksum, String(value));
    }
  };
  parser.ontext = (value) => {
    if (isBenchmarkWhitespace(value)) return;
    eventCount++;
    checksum = mixBenchmarkChecksum(checksum, BENCH_XML_EVENT_TYPE.CHARACTERS);
    checksum = foldBenchmarkString(checksum, value.trim());
  };
  parser.oncdata = (value) => {
    eventCount++;
    checksum = mixBenchmarkChecksum(checksum, BENCH_XML_EVENT_TYPE.CDATA);
    checksum = foldBenchmarkString(checksum, value.trim());
  };
  parser.onclosetag = (name) => {
    eventCount++;
    checksum = mixBenchmarkChecksum(checksum, BENCH_XML_EVENT_TYPE.END_ELEMENT);
    checksum = foldBenchmarkString(checksum, name);
  };
  parser.onerror = (error) => {
    throw error;
  };
  parser.write(xmlString).close();
  return { eventCount, checksum };
}

function consumeSaxes(xmlString) {
  const parser = new SaxesParser({
    xmlns: false,
    position: false,
  });
  let eventCount = 0;
  let checksum = 0;
  parser.on('opentag', (node) => {
    eventCount++;
    checksum = mixBenchmarkChecksum(checksum, BENCH_XML_EVENT_TYPE.START_ELEMENT);
    checksum = foldBenchmarkString(checksum, node.name);
    const attrs = Object.entries(node.attributes ?? {});
    checksum = mixBenchmarkChecksum(checksum, attrs.length);
    for (const [name, value] of attrs) {
      checksum = foldBenchmarkString(checksum, name);
      checksum = foldBenchmarkString(checksum, String(value));
    }
  });
  parser.on('text', (value) => {
    if (isBenchmarkWhitespace(value)) return;
    eventCount++;
    checksum = mixBenchmarkChecksum(checksum, BENCH_XML_EVENT_TYPE.CHARACTERS);
    checksum = foldBenchmarkString(checksum, value.trim());
  });
  parser.on('cdata', (value) => {
    eventCount++;
    checksum = mixBenchmarkChecksum(checksum, BENCH_XML_EVENT_TYPE.CDATA);
    checksum = foldBenchmarkString(checksum, value.trim());
  });
  parser.on('closetag', (name) => {
    eventCount++;
    checksum = mixBenchmarkChecksum(checksum, BENCH_XML_EVENT_TYPE.END_ELEMENT);
    checksum = foldBenchmarkString(checksum, name);
  });
  parser.on('error', (error) => {
    throw error;
  });
  parser.write(xmlString).close();
  return { eventCount, checksum };
}

function consumeHtmlparser2(xmlString) {
  let eventCount = 0;
  let checksum = 0;
  const parser = new HtmlParser({
    onopentag(name, attributes) {
      eventCount++;
      checksum = mixBenchmarkChecksum(checksum, BENCH_XML_EVENT_TYPE.START_ELEMENT);
      checksum = foldBenchmarkString(checksum, name);
      const attrs = Object.entries(attributes ?? {});
      checksum = mixBenchmarkChecksum(checksum, attrs.length);
      for (const [attrName, attrValue] of attrs) {
        checksum = foldBenchmarkString(checksum, attrName);
        checksum = foldBenchmarkString(checksum, String(attrValue));
      }
    },
    ontext(value) {
      if (isBenchmarkWhitespace(value)) return;
      eventCount++;
      checksum = mixBenchmarkChecksum(checksum, BENCH_XML_EVENT_TYPE.CHARACTERS);
      checksum = foldBenchmarkString(checksum, value.trim());
    },
    oncdata(value) {
      eventCount++;
      checksum = mixBenchmarkChecksum(checksum, BENCH_XML_EVENT_TYPE.CDATA);
      checksum = foldBenchmarkString(checksum, value.trim());
    },
    onclosetag(name) {
      eventCount++;
      checksum = mixBenchmarkChecksum(checksum, BENCH_XML_EVENT_TYPE.END_ELEMENT);
      checksum = foldBenchmarkString(checksum, name);
    },
    onerror(error) {
      throw error;
    },
  }, {
    xmlMode: true,
    decodeEntities: true,
    lowerCaseTags: false,
    lowerCaseAttributeNames: false,
    recognizeSelfClosing: true,
    recognizeCDATA: true,
  });
  parser.write(xmlString);
  parser.end();
  return { eventCount, checksum };
}

function staxEventTypeId(type) {
  switch (type) {
    case XmlEventType.START_DOCUMENT:
      return BENCH_XML_EVENT_TYPE.START_DOCUMENT;
    case XmlEventType.END_DOCUMENT:
      return BENCH_XML_EVENT_TYPE.END_DOCUMENT;
    case XmlEventType.START_ELEMENT:
      return BENCH_XML_EVENT_TYPE.START_ELEMENT;
    case XmlEventType.END_ELEMENT:
      return BENCH_XML_EVENT_TYPE.END_ELEMENT;
    case XmlEventType.CHARACTERS:
      return BENCH_XML_EVENT_TYPE.CHARACTERS;
    case XmlEventType.CDATA:
      return BENCH_XML_EVENT_TYPE.CDATA;
    default:
      return 31;
  }
}

function mixBenchmarkChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function foldBenchmarkString(seed, value) {
  if (!value) return seed;
  let next = seed;
  for (let index = 0; index < value.length; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}

function isBenchmarkWhitespace(value) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code !== 32 && code !== 9 && code !== 10 && code !== 13) {
      return false;
    }
  }
  return true;
}

function createLargeXmlBookElement(id) {
  return `  <book id="book-${id}" lang="en" code="${id % 97}">` +
    `<title>EventReader Stream Benchmark ${id}</title>` +
    `<author>Author ${id % 4096}</author>` +
      `<description>Stable text payload for EventReader stream parsing.</description>` +
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

function consumeMaterializedEvent(event, state) {
  const attrs = event.type === XmlEventType.START_ELEMENT ? Object.entries(event.attributes ?? {}) : [];
  state.events++;
  state.checksum = mixChecksum(state.checksum, staxEventTypeId(event.type));

  if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
    state.checksum = foldBenchmarkString(state.checksum, event.name);
  }
  if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
    state.checksum = foldBenchmarkString(state.checksum, event.value?.trim());
  }

  state.checksum = mixChecksum(state.checksum, attrs.length);
  for (const [name, value] of attrs) {
    state.checksum = foldBenchmarkString(state.checksum, name);
    state.checksum = foldBenchmarkString(state.checksum, value);
  }
}

async function parseEventReaderFile(filePath, backend, onProgress) {
  if (backend === 'js') {
    resetStaxXmlRuntimeForTests();
  } else {
    await initStaxXml({ backend, fallbackOnLoadError: false });
  }
  const reader = new EventReader(fileReadableStream(filePath), {
    autoDecodeEntities: false,
    documentMode: 'document',
  });
  const state = { events: 0, checksum: 2166136261, batches: 0 };
  for await (const batch of reader.batchedIterator()) {
    for (const event of batch) {
      consumeMaterializedEvent(event, state);
    }
    state.batches++;
    if ((state.batches & 255) === 0) {
      onProgress();
    }
  }
  onProgress();
  return state;
}

async function* readFileChunks(filePath) {
  const handle = await openFile(filePath, 'r');
  try {
    while (true) {
      const chunk = Buffer.allocUnsafe(iterableFileChunkSize);
      const { bytesRead } = await handle.read(chunk, 0, iterableFileChunkSize, null);
      if (bytesRead === 0) {
        break;
      }
      yield bytesRead === iterableFileChunkSize ? chunk : chunk.subarray(0, bytesRead);
    }
  } finally {
    await handle.close();
  }
}

function fileReadableStream(filePath) {
  const iterator = readFileChunks(filePath)[Symbol.asyncIterator]();
  return new ReadableStream({
    async pull(controller) {
      const next = await iterator.next();
      if (next.done) {
        controller.close();
        return;
      }
      controller.enqueue(next.value);
    },
    async cancel() {
      await iterator.return?.();
    },
  });
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
    title: 'EventReader stream JS vs native size comparison',
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
        `EventReader stream JS fallback (${fixture.label} temp file)`,
        fixture.bytes,
        (onProgress) => parseEventReaderFile(fixture.filePath, 'js', onProgress),
      ),
      fixtureLabel: fixture.label,
      bytes: fixture.bytes,
      targetBytes: fixture.targetBytes,
    });
    raw.cases.push({
      ...await measureLargeFileCase(
        `EventReader stream native (${fixture.label} temp file)`,
        fixture.bytes,
        (onProgress) => parseEventReaderFile(fixture.filePath, 'native', onProgress),
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
    title: '4GiB temp-file EventReader stream parser',
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
    'EventReader stream JS fallback (4GiB temp file)',
    fixture.bytes,
    (onProgress) => parseEventReaderFile(fixture.filePath, 'js', onProgress),
  ));
  raw.cases.push(await measureLargeFileCase(
    'EventReader stream native (4GiB temp file)',
    fixture.bytes,
    (onProgress) => parseEventReaderFile(fixture.filePath, 'native', onProgress),
  ));

  writeFileSync(join(rawDir, 'async-file-4gb.json'), `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  return normalizeAsyncFile4gbSuiteResult('async-file-4gb', raw.title, raw);
}

async function buildXmlAsyncFromJson(data) {
  const stream = new WritableStream();
  const writer = new Writer(stream, { prettyPrint: true, indentString: '  ' });

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
  const writer = new WriterSync({ prettyPrint: true, indentString: '  ' });

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
        const writer = new Writer(stream, {
          prettyPrint: true,
          indentString: '  ',
        });
        await writer.writeStartDocument();
        await writeWriterTreeAsync(writer, orderedWriterTree);
        await writer.writeEndDocument();
      }).gc('inner');

      bench('stax-xml writer sync', () => {
        const writer = new WriterSync({
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
        const writer = new WriterSyncSink(sink, {
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
        const writer = new Writer(stream);
        await writer.writeStartDocument();
        await writeWriterTreeAsync(writer, bigWriterTree);
        await writer.writeEndDocument();
      }).gc('inner');

      bench('stax-xml writer sync (big.json)', () => {
        const writer = new WriterSync();
        writer.writeStartDocument();
        writeWriterTreeSync(writer, bigWriterTree);
        writer.writeEndDocument();
        writer.getXmlString();
      }).gc('inner');

      bench('stax-xml writer sync sink (big.json)', () => {
        const { sink, getBytesWritten } = createInMemoryFileSink();
        const writer = new WriterSyncSink(sink);
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
  const writer = new Writer(nodeStreamToWritableStream(fileStream), {
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
  const writer = new WriterSync({ prettyPrint: true, indentString: '  ' });
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
  const writer = new WriterSyncSink(sink, {
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
    id: 'npm-xml-parsers',
    title: 'Node npm XML parser comparison (books.xml)',
    run: () => runSuite('npm-xml-parsers', 'Node npm XML parser comparison (books.xml)', registerNpmXmlParserSuite, true),
  },
  {
    id: 'parser-13mb',
    title: 'Parser 13MB (midsize.xml)',
    run: () => runSuite('parser-13mb', 'Parser 13MB (midsize.xml)', () => registerParserSyncSuite(ASSET_PATHS.midsize), true),
  },
  {
    id: 'parser-98mb',
    title: 'Parser 98MB (large.xml)',
    run: () => runSuite(
      'parser-98mb',
      'Parser 98MB (large.xml)',
      () => registerParserSyncSuite(ASSET_PATHS.large),
      true,
      parser98MbMitataOptions,
    ),
  },
  {
    id: 'async-size',
    title: 'EventReader stream JS vs native size comparison',
    run: () => runIterableParserSizeSuite(true),
    normalize: (rawFilePath) => normalizeIterableSizeSuiteResult('async-size', 'EventReader stream JS vs native size comparison', readJsonFile(rawFilePath)),
  },
  {
    id: 'async-file-4gb',
    title: '4GiB temp-file EventReader stream parser',
    stress: true,
    run: () => runAsyncFile4gbSuite(true),
    normalize: (rawFilePath) => normalizeAsyncFile4gbSuiteResult('async-file-4gb', '4GiB temp-file EventReader stream parser', readJsonFile(rawFilePath)),
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
    run: () => {
      runNodeBenchmarkScript('writer-1gb.mjs', [
        '--size-gb',
        '1',
        '--json-out',
        join('packages', 'benchmark', 'results', 'release', 'raw', 'writer-1gb.json'),
      ]);
      return Promise.resolve(normalizeWriter1gbSuiteResultFromRawFile(writer1gbRawPath));
    },
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

export function releaseManifestForOptions({ includeStress = false, only = null } = {}) {
  return manifest.filter((entry) => {
    if (only) return only.has(entry.id);
    return includeStress || !entry.stress;
  });
}

function suiteCase(summary, suiteId, label) {
  const suite = summary.suites[suiteId];
  if (!suite) throw new Error(`Missing suite: ${suiteId}`);
  const found = suite.cases.find((entry) => entry.label === label);
  if (!found) throw new Error(`Missing benchmark case: ${suiteId} / ${label}`);
  return found;
}

function findSuiteCase(summary, suiteId, label) {
  return summary.suites[suiteId]?.cases.find((entry) => entry.label === label);
}

function hasSuite(summary, suiteId) {
  return Boolean(summary.suites[suiteId]);
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
  ].filter(([suiteId]) => hasSuite(summary, suiteId));

  return [
    '| File Size | Parser Type | Processing Time | Memory Usage | Performance Ratio |',
    '|-----------|-------------|-----------------|--------------|-------------------|',
    ...sizeRows.flatMap(([suiteId, size]) => {
      const syncStats = suiteCase(summary, suiteId, `EventReader stream JS fallback (${size} temp file)`);
      const asyncStats = suiteCase(summary, suiteId, `EventReader stream native (${size} temp file)`);
      const asyncRatio = asyncStats.avgNs >= syncStats.avgNs
        ? `${(asyncStats.avgNs / syncStats.avgNs).toFixed(2)}x slower`
        : `${(syncStats.avgNs / asyncStats.avgNs).toFixed(2)}x faster`;
      return [
        `| ${size} temp file | **EventReader stream JS fallback** | ${formatDurationNsCompact(syncStats.avgNs)} | ${formatMemory(syncStats.heapAvgBytes)} | Baseline, ${syncStats.throughputMiBs.toFixed(2)} MiB/s |`,
        `| ${size} temp file | EventReader stream native | ${formatDurationNsCompact(asyncStats.avgNs)} | ${formatMemory(asyncStats.heapAvgBytes)} | ${asyncRatio}, ${asyncStats.throughputMiBs.toFixed(2)} MiB/s |`,
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
  if (findSuiteCase(summary, 'converter-parity', 'converter api compiled js byte projection')) {
    rows.push([
      'converter api compiled js byte projection',
      'Projection-lowerable byte input through the JavaScript converter path',
    ]);
  }
  if (findSuiteCase(summary, 'converter-parity', 'converter api compiled native byte projection')) {
    rows.push([
      'converter api compiled native byte projection',
      'Projection-lowerable byte input through public native projection',
    ]);
  }
  if (findSuiteCase(summary, 'converter-parity', 'ProjectionReader native object rows')) {
    rows.push([
      'ProjectionReader native object rows',
      'Public stax-xml/projection fast surface returning native columnar rows',
    ]);
  }

  return [
    '| Implementation | Average time | Notes |',
    '| --- | ---: | --- |',
    ...rows.map(([label, notes]) => {
      const stats = suiteCase(summary, 'converter-parity', label);
      return `| ${label} | **${formatDurationNsCompact(stats.avgNs)}** | ${notes} |`;
    }),
  ].join('\n');
}

function asyncSizeMaxLabel(summary) {
  return hasSuite(summary, 'async-file-4gb') ? '4GiB' : '1GiB';
}

function renderNpmXmlParserTable(summary) {
  const rows = [
    ['stax-xml EventReaderSync (JS)', 'stax-xml EventReaderSync (JS)', 'Public lean string event reader, JS backend'],
    ['stax-xml EventReaderSync (native)', '**stax-xml EventReaderSync (native)**', 'Public lean string event reader, native runtime backend'],
    ['stax-xml ProjectionReader parseXmlNodes (native)', '**stax-xml ProjectionReader parseXmlNodes (native)**', 'Public unknown-schema object projection through stax-xml/projection'],
    ['fast-xml-parser XMLParser', 'fast-xml-parser XMLParser', 'Object parser'],
    ['txml parse', 'txml parse', 'Lightweight object parser'],
    ['xml2js parseString', 'xml2js parseString', 'Callback object parser'],
    ['sax strict event parser', 'sax strict event parser', 'Strict SAX event parser'],
    ['saxes event parser', 'saxes event parser', 'Maintained SAX-style non-validating parser'],
    ['htmlparser2 xmlMode parser', 'htmlparser2 xmlMode parser', 'Fast HTML/XML event parser in xmlMode'],
  ];

  return [
    '| Library | Average Time | Operations/sec | Memory Usage | Notes |',
    '|---------|--------------|----------------|--------------|-------|',
    ...rows.map(([label, display, notes]) => {
      const stats = suiteCase(summary, 'npm-xml-parsers', label);
      return `| ${display} | ${formatDurationNsCompact(stats.avgNs)} | ${formatOps(stats.avgNs)} | ${formatMemory(stats.heapAvgBytes)} | ${notes} |`;
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

function crossNativeReaderTierById(crossRuntime, tierId) {
  return (crossRuntime.nativeReader ?? crossRuntime.nativeIterable)?.tiers?.find((tier) => tier.tier === tierId);
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
  const jsNode = crossScenarioById(crossRuntime, tierId, 'neutral') ?? crossScenarioById(crossRuntime, tierId, 'node');
  const rows = [
    ['stax-xml JS on Node', jsNode],
    ['stax-xml native EventReaderSync', crossNativeReaderTierById(crossRuntime, tierId)],
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
    'API selection guidance:',
    '',
    '- Prefer the converter API when the target XML-to-object shape is known.',
    '- For whole-XML traversal with light per-event work, start with `EventReader` or `EventReaderSync`.',
    '- For heavier unknown-schema projection or object materialization, use `ProjectionReader` and the `stax-xml/projection` helpers.',
    '',
    '- `stax-xml JS fallback event parser`: lean `EventReaderSync` event loop with a checksum over event type, names, text, and attributes. The XML string is prepared outside the timed region, matching string-only library API-native rows.',
    '- `stax-xml JS fallback event parser (decode+parse)`: byte-source application path that pays `Buffer.toString("utf8")` inside the timed region before running lean `EventReaderSync`.',
    '- `stax-xml EventReaderSync (native)`: public lean string event reader backed by `initStaxXml({ backend: "native" })`; no private native diagnostic entry point is imported or called directly.',
    '- `stax-xml ProjectionReader parseXmlNodes (native)`: public unknown-schema object projection returning txml-style nodes through `stax-xml/projection`.',
    '- `stax-xml to object`: `parseXmlNodesSync` through the JavaScript fallback, kept as the stax object-shape reference row.',
    '- `txml`, `fast-xml-parser`, and `xml2js`: each library uses its string API-native object/DOM-style parse API.',
    '- The 13 MiB `xml2js` row is marked as an invalid comparator: `midsize.xml` has repeated top-level elements and xml2js reports only the first top-level element shape instead of the whole document.',
    '- The stax-xml backend/surface rows are embedded directly in each parser table so the fixture and run environment are identical to the third-party rows.',
    '',
    '</details>',
  ].join('\n');
}

function createNpmXmlParserScenarioDetails() {
  return [
    '<details>',
    '<summary>Scenario contract: maintained Node npm XML parser comparison</summary>',
    '',
    'This section uses one representative XML fixture, `books.xml`, so npm parser packages can be compared in one place without mixing the result into the broader parser fixture series.',
    '',
    'Candidate policy:',
    '',
    '- Included packages must be public npm packages with a current Node XML parsing surface already present in the benchmark workspace.',
    '- Excluded packages include internal probes, old package names superseded by a scoped package, packages with very old last publish dates, and packages whose own documentation presents the parser as non-compliant or intentionally minimal.',
    '- The section therefore includes `fast-xml-parser`, `txml`, `xml2js`, `sax`, `saxes`, and `htmlparser2` with `xmlMode` enabled.',
    '- `@xmldom/xmldom` was evaluated as a DOM candidate, but its current npm install path reports a deprecation warning, so it is not included in the maintained-comparator set.',
    '',
    'Measurement policy:',
    '',
    '- Object/DOM-style libraries use their natural string-to-object parse API.',
    '- SAX/event-style libraries consume events and fold names, text, and attributes into a checksum so the parser work is retained.',
    '- stax-xml rows are included only as local reference rows and use public `EventReaderSync` or `ProjectionReader` surfaces. Native rows initialize `stax-xml` with the native backend, then measure only those public package surfaces.',
    '',
    '</details>',
  ].join('\n');
}

function createLargeFileScenarioDetails(summary) {
  const maxLabel = asyncSizeMaxLabel(summary);
  return [
    '<details>',
    '<summary>Scenario contract: EventReader stream JS and native file traversal</summary>',
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
    '- Every row in this section uses the public `EventReader` stream API over bounded temp-file chunks.',
    '- `EventReader stream JS fallback` initializes the package with the JavaScript backend before measuring the stream reader.',
    '- `EventReader stream native` initializes the package with the native backend before measuring the same stream reader API.',
    '- XML tokenization is CPU-intensive. Async file reads do not make the parse loop non-blocking; if this work would run on a latency-sensitive main event loop thread, offload parsing to a Worker or worker thread.',
    '- These rows intentionally use a structural checksum rather than building a full object tree so the table measures stream tokenization and event materialization.',
    '',
    '</details>',
    '',
    maxLabel === '4GiB'
      ? 'This run includes the opt-in 4GiB stress traversal.'
      : 'The default release set stops at 1GiB; the 4GiB traversal is available with `release:update -- --include-stress`.',
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
    '  scenario: "public-sync-full-string" | "event-count-only" | "event-full-string",',
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
    '- `public-sync-full-string` uses `EventReaderSync` over one string.',
    '- `event-count-only` and `event-full-string` use public event reader checksums without constructing a full object tree; they are not async parser rows.',
    '- This matrix intentionally excludes native runtime rows.',
    '',
    '</details>',
  ].join('\n');
}

function createCrossRuntimeScenarioDetails(sizeMiB) {
  return [
    '<details>',
    '<summary>Scenario contract: stax-xml JS/native EventReaderSync, Woodstox, and quick-xml comparator</summary>',
    '',
    `The comparator uses the same generated ${sizeMiB} MiB XML fixture shape as the runtime matrix.`,
    '',
    'Output shape:',
    '',
    '~~~text',
    'comparator-result = {',
    '  tier: "count-only" | "name-string-only" | "attr-value-string-only" | "text-string-only" | "full-string",',
    '  implementation: "stax-xml-js-event-reader" | "stax-xml-native-event-reader" | "woodstox-java8" | "quick-xml",',
    '  eventCount: number,',
    '  checksum: fold(selected event data for tier)',
    '}',
    '~~~',
    '',
    'Parsing methods:',
    '',
    '- `stax-xml JS on Node`: public `EventReaderSync` with the JavaScript backend, run on Node, with tier-specific checksum folding.',
    '- `stax-xml native EventReaderSync`: initializes `stax-xml` with `initStaxXml({ backend: "native" })`, then measures the public string event reader surface.',
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
    sections.push(`The same built JavaScript implementation was measured on Node, Bun, and Deno with a generated single-root ${runtimeMatrix.fixture.sizeMiB.toFixed(2)} MiB XML fixture. This is a runtime-codegen and compatibility check; native runtime comparison is reported separately through public EventReader rows.`);
    sections.push(createRuntimeMatrixScenarioDetails(runtimeMatrix.fixture.sizeMiB.toFixed(2)));
    sections.push(renderBenchmarkSourceLinks('runtime-matrix'));
    sections.push(renderRuntimeMatrixTable(runtimeMatrix));
  }

  if (crossRuntime) {
    sections.push('The non-JS comparator uses the same event-count and checksum contract. It reports stax-xml JS on Node, stax-xml native runtime through public `EventReaderSync`, Woodstox on Java 8, and quick-xml. Woodstox is reported on Java 8 for the public baseline because Java 8 is its minimum supported runtime target; Java 25 is measured only as a verification check.');
    sections.push(createCrossRuntimeScenarioDetails(crossRuntime.fixture.sizeMiB.toFixed(2)));
    sections.push(renderBenchmarkSourceLinks('cross-runtime'));
    sections.push(renderCrossRuntimeTable(crossRuntime));
    sections.push('### Woodstox Java 25 Verification');
    sections.push(renderJava25Table(crossRuntime));
  }

  sections.push(`### Why Native Runtime Acceleration Is The Performance Path

The JavaScript parser remains the compatibility fallback, but it is not the release performance ceiling. Prior pure-JS optimization work improved the internal event-frame backend, yet full-string workloads still stayed behind native parser baselines, especially \`quick-xml\`. The remaining costs are delimiter scanning, string materialization, and stable object/API shapes around attributes and text.

The Rust native path is intended to move the hot tokenizer and string/span aggregation work into code that can use native and SIMD-oriented scanning strategies, closer in direction to native parsers such as \`quick-xml\` and simdjson-style designs. Published benchmark rows now measure that path through public reader surfaces rather than direct native diagnostic entry points. The package topology keeps \`stax-xml\` as the facade while adding optional native/Wasm acceleration packages; environments that cannot load binaries continue to use the JavaScript fallback.`);

  return `${sections.join('\n\n')}\n`;
}

function createEnglishBenchmarkBlock(summary) {
  const env = summary.environment;

  return `## Benchmark Environment

The refreshed benchmark tables on this page were rerun with:
- **CPU**: ${env.cpuName} (~${env.cpuGHz.toFixed(2)} GHz)
- **Runtime**: ${env.runtime} ${env.version} (${env.arch}) with garbage collection exposed (\`--expose-gc\`)
- **Tool**: [Mitata](https://github.com/evanw/mitata)
- **Canonical Set**: parser 2KB / 4KB / 13MB / 98MB with stax-xml backend/surface rows, a separate maintained Node npm XML parser comparison, EventReader stream size comparison from 1MiB to 4GiB, writer small / big / async, converter parity

${renderEnvironmentVersionDetails(env)}

## Parser Performance

${createParserScenarioDetails()}

### Parser Fixture Series

The \`parser-*\` series is the comparable parser-library fixture set. Read these tables together, in fixture-size order, before comparing the separate EventReader stream traversal and runtime matrices.

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

### Node npm XML Parsers

This separate section compares maintained public npm XML parser packages on one representative Node fixture. It is intentionally placed after the parser fixture series because event parsers, object parsers, and the stax public reader surfaces have different output shapes.

${createNpmXmlParserScenarioDetails()}

${renderBenchmarkSourceLinks('npm-xml-parsers')}

${renderNpmXmlParserTable(summary)}

### EventReader File Traversal (1MiB to ${asyncSizeMaxLabel(summary)})

For processing large XML files (RSS feeds, data exports, etc.):

${createLargeFileScenarioDetails(summary)}

${renderBenchmarkSourceLinks('async-size')}

${renderAsyncSizeTable(summary)}

**Key Insights:**
- This section is the public stream reader throughput view, not a full-object materialization benchmark.
- The JS and native rows share the same \`EventReader\` stream API; the difference is the initialized runtime backend.
- Async stream parsing can still block the main event loop while each CPU parse batch runs; use a Worker or worker thread when visible latency matters.
- For files above 100MiB, avoid the public full-string sync path when retaining the full XML string is not acceptable; use async streams for bounded input buffering.

${createRuntimeAndNativeDirectionBlock()}

## Converter API vs Plain Parser

The benchmark below compares three ways to build the **same object output**:

- A handwritten plain parser built directly on \`EventReaderSync\`
- The declarative converter API with automatic dispatch-plan routing
- The converter API with \`.compile()\` enabled

Recommendation: when this kind of target object shape is known, prefer the converter API over ad-hoc event parsing. Keep \`EventReaderSync\` for light whole-XML traversal and use \`ProjectionReader\` for heavier unknown-schema materialization.

Current fixture:

- \`catalog\` document
- \`800\` \`<featured>\` elements
- \`800\` \`<book>\` elements
- result includes root object fields, root arrays, direct scalar fields, and transformed derived fields

${renderBenchmarkSourceLinks('converter')}

${renderConverterTable(summary)}

Interpretation:

- The handwritten parser remains the raw-throughput ceiling.
- The normal converter API now auto-routes dispatch-friendly schemas onto the projection backend and caches the plan on the schema object.
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

Based on this run, \`WriterSyncSink\` is the recommended path for large XML file output. It provides the highest write throughput, and peak RSS stays in the same range as async writing.
`;
}

function createBenchmarkMarkdown(summary) {
  return `# Benchmarks

Generated: ${summary.generatedAt}
Run ID: ${summary.runId}

Environment:
- CPU: ${summary.environment.cpuName} (~${summary.environment.cpuGHz.toFixed(2)} GHz)
- Runtime: ${summary.environment.runtime} ${summary.environment.version} (${summary.environment.arch})

This report is generated from the canonical release benchmark set. The docs benchmark pages are derived from the same raw JSON results.
Historical runs are indexed at [packages/benchmark/results/release/history/README.md](packages/benchmark/results/release/history/README.md).

${createEnglishBenchmarkBlock(summary)}
`;
}

async function main() {
  const args = parseArgs();
  mkdirSync(rawDir, { recursive: true });

  if (args.aggregateOnly) {
    await aggregateReleaseBenchmarks({
      includeStress: args.includeStress,
      history: !args.skipHistory,
      runId: args.runId,
      verbose: args.verbose,
    });
    return;
  }

  if (!args.skipFixtures) {
    ensureReleaseFixtureInventory(args.verbose);
  }

  const suites = {};
  const suiteElapsedMs = {};
  const selectedManifest = releaseManifestForOptions(args);
  for (const entry of selectedManifest) {
    const startedAt = performance.now();
    suites[entry.id] = await entry.run();
    suiteElapsedMs[entry.id] = performance.now() - startedAt;
    suites[entry.id].elapsedMs = suiteElapsedMs[entry.id];
  }

  const firstSuite = Object.values(suites)[0];
  if (!firstSuite) {
    throw new Error('No benchmark suites were selected');
  }
  const ranFullCanonicalSet = !args.only && Object.keys(suites).length === selectedManifest.length;

  if (ranFullCanonicalSet) {
    if (!args.skipAuxiliary) {
      runAuxiliaryReleaseOutputs(args);
    }
    await aggregateReleaseBenchmarks({
      includeStress: args.includeStress,
      history: !args.skipHistory,
      runId: args.runId,
      suiteElapsedMs,
      verbose: args.verbose,
    });
  }

  if (args.verbose) {
    if (ranFullCanonicalSet) {
      console.log('\nRaw benchmark execution complete.');
    } else {
      console.log('\nRaw benchmark execution complete. Skipped summary/BENCHMARK generation because only a subset of the selected release set was run.');
    }
  }
}

export async function aggregateReleaseBenchmarks({
  history = true,
  includeStress = false,
  runId = null,
  suiteElapsedMs = {},
  verbose = true,
} = {}) {
  const suites = {};
  const selectedManifest = releaseManifestForOptions({ includeStress });
  for (const entry of selectedManifest) {
    const rawFile = join(rawDir, `${entry.id}.json`);
    suites[entry.id] = entry.normalize
      ? entry.normalize(rawFile)
      : entry.id === 'writer-1gb'
        ? normalizeWriter1gbSuiteResultFromRawFile(rawFile)
        : normalizeSuiteResultFromRawFile(entry.id, entry.title, rawFile);
    if (suiteElapsedMs[entry.id] !== undefined) {
      suites[entry.id].elapsedMs = suiteElapsedMs[entry.id];
    }
  }
  const firstSuite = Object.values(suites)[0];
  if (!firstSuite) {
    throw new Error('No canonical benchmark results found');
  }

  const generatedAt = runId ? releaseRunIdToIso(runId) : new Date().toISOString();
  const summary = {
    generatedAt,
    runId: runId ?? createReleaseRunId(new Date(generatedAt)),
    environment: collectBenchmarkEnvironment(firstSuite.context),
    benchmarkSet: {
      includeStress,
      omittedSuites: manifest
        .filter((entry) => entry.stress && !includeStress)
        .map((entry) => entry.id),
    },
    suites,
  };

  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeFileSync(benchmarkMarkdownPath, singleTrailingNewline(createBenchmarkMarkdown(summary)), 'utf8');

  if (history) {
    writeReleaseHistory(summary, { runId: summary.runId, verbose });
  }

  if (verbose) {
    console.log(`Wrote summary JSON to ${summaryPath}`);
    console.log(`Updated ${benchmarkMarkdownPath}`);
  }

  return summary;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
