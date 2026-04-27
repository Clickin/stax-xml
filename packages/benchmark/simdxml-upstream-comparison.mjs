// simdxml notice:
// This comparator reuses simdxml's upstream benchmark fixture grouping and
// parse workload shape from https://github.com/simdxml/simdxml under the
// project's MIT license option (simdxml is licensed MIT OR Apache-2.0).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const upstreamUrl = 'https://github.com/simdxml/simdxml';
const defaultUpstreamRef = '539577043c27e537c2cf9e5a38e5e10d844e83b0';
const defaultUpstreamDir = resolve(repoRoot, '.omx', 'upstream', 'simdxml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'simdxml-upstream-comparison.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'simdxml-upstream-comparison.md');
const simdXmlBenchDir = join(__dirname, 'external', 'simdxml-bench');
const nativeAggregateDir = resolve(__dirname, '..', 'native-aggregate');

const upstreamCaseGroups = {
  'parse-throughput': [
    ['patent_medium', 'patent_medium.xml'],
    ['patent_large', 'patent_large.xml'],
    ['patent_xlarge', 'patent_xlarge.xml'],
    ['attrheavy_large', 'attrheavy_large.xml'],
    ['textheavy_large', 'textheavy_large.xml'],
    ['nested_large', 'nested_large.xml'],
  ],
  shape: [
    ['patent', 'patent_large.xml'],
    ['attrheavy', 'attrheavy_large.xml'],
    ['textheavy', 'textheavy_large.xml'],
    ['nested', 'nested_large.xml'],
  ],
  scaling: [
    ['1KB', 'patent_small.xml'],
    ['100KB', 'patent_medium.xml'],
    ['1MB', 'patent_large.xml'],
    ['10MB', 'patent_xlarge.xml'],
  ],
};

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    upstreamDir: defaultUpstreamDir,
    upstreamRef: defaultUpstreamRef,
    runs: 5,
    warmups: 2,
    groups: ['parse-throughput', 'shape', 'scaling'],
    nativeTiers: [
      'event-count-unsafe-gt',
      'event-count-unchecked',
      'event-count-auto-stage',
      'event-count-only',
      'count-only',
      'count-auto-stage',
      'full-string-direct',
    ],
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    skipFetch: false,
    skipBuild: false,
    nativeSimd: 'auto',
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    if (arg === '--skip-fetch') {
      options.skipFetch = true;
      continue;
    }
    if (arg === '--skip-build') {
      options.skipBuild = true;
      continue;
    }

    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} requires a value.`);
      index++;
      return value;
    };

    switch (name) {
      case '--upstream-dir':
        options.upstreamDir = resolve(process.cwd(), readValue());
        break;
      case '--upstream-ref':
        options.upstreamRef = readValue();
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--groups':
        options.groups = parseList(readValue(), Object.keys(upstreamCaseGroups), name);
        break;
      case '--native-tiers':
        options.nativeTiers = parseList(readValue(), [
          'event-count-unchecked',
          'event-count-unsafe-gt',
          'event-count-byte-loop',
          'event-count-skip-quotes',
          'event-count-no-text',
          'event-count-no-checksum',
          'event-count-no-text-no-checksum',
          'event-count-two-stage',
          'event-count-auto-stage',
          'event-count-only',
          'count-only',
          'count-eq-two-stage',
          'count-auto-stage',
          'name-string-only',
          'text-string-only',
          'attr-value-string-only',
          'full-string-direct',
        ], name);
        break;
      case '--native-simd':
        options.nativeSimd = parseSingleChoice(
          readValue(),
          ['auto', 'auto-safe', 'off', 'scalar', 'avx2', 'sse42', 'sse4.2', 'neon'],
          name,
        );
        if (options.nativeSimd === 'auto-safe') options.nativeSimd = 'auto';
        if (options.nativeSimd === 'scalar') options.nativeSimd = 'off';
        if (options.nativeSimd === 'sse4.2') options.nativeSimd = 'sse42';
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${flag} must be a non-negative integer.`);
  return parsed;
}

function parseList(value, allowed, flag) {
  if (value === 'all') return [...allowed];
  const entries = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (entries.length === 0) throw new Error(`${flag} must not be empty.`);
  for (const entry of entries) {
    if (!allowed.includes(entry)) {
      throw new Error(`${flag} contains unknown entry ${entry}. Expected: ${allowed.join(', ')}`);
    }
  }
  return entries;
}

function parseSingleChoice(value, allowed, flag) {
  const entries = parseList(value, allowed, flag);
  if (entries.length !== 1) {
    throw new Error(`${flag} expects exactly one of ${allowed.join(', ')}.`);
  }
  return entries[0];
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(' ')}\n${result.stderr.trim() || result.stdout.trim()}`,
    );
  }
  return result;
}

function ensureUpstream(options) {
  if (options.skipFetch) {
    if (!existsSync(options.upstreamDir)) {
      throw new Error(`--skip-fetch was provided, but upstream dir does not exist: ${options.upstreamDir}`);
    }
    return;
  }

  mkdirSync(dirname(options.upstreamDir), { recursive: true });
  if (!existsSync(join(options.upstreamDir, '.git'))) {
    run('git', ['clone', '--depth=1', upstreamUrl, options.upstreamDir]);
  }

  run('git', ['-C', options.upstreamDir, 'fetch', '--depth=1', 'origin', options.upstreamRef]);
  run('git', ['-C', options.upstreamDir, 'checkout', '--detach', 'FETCH_HEAD']);
}

function upstreamHead(upstreamDir) {
  return run('git', ['-C', upstreamDir, 'rev-parse', 'HEAD']).stdout.trim();
}

function buildTools(options) {
  if (options.skipBuild) return;
  run('cargo', [
    'build',
    '--manifest-path',
    join(simdXmlBenchDir, 'Cargo.toml'),
    '--release',
    '--locked',
  ]);
  runPnpm(['--filter', '@stax-xml/native-aggregate-probe', 'build:native']);
}

function simdXmlBenchExe() {
  return join(
    simdXmlBenchDir,
    'target',
    'release',
    process.platform === 'win32' ? 'simdxml-bench.exe' : 'simdxml-bench',
  );
}

function runPnpm(args) {
  if (process.platform !== 'win32') {
    run('pnpm', args);
    return;
  }
  run('cmd.exe', ['/d', '/s', '/c', ['pnpm', ...args].map(quoteWindowsShellArg).join(' ')]);
}

function quoteWindowsShellArg(value) {
  if (!/[ \t"&|<>^]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function measureNative(input, tier, options, native) {
  const invoke = () => invokeNativeAggregate(native, input, tier, options.nativeSimd);
  for (let index = 0; index < options.warmups; index++) {
    invoke();
  }

  const samplesMs = [];
  let stable;
  for (let index = 0; index < options.runs; index++) {
    if (globalThis.gc) globalThis.gc();
    const startedAt = performance.now();
    const result = normalizeNativeResult(invoke());
    const elapsedMs = performance.now() - startedAt;
    if (stable && (stable.eventCount !== result.eventCount || stable.checksum !== result.checksum)) {
      throw new Error(`native ${tier} produced unstable event count or checksum.`);
    }
    stable = result;
    samplesMs.push(elapsedMs);
  }

  return {
    ...measurementResult(`stax-native-${tier}`, input.byteLength, samplesMs, stable),
    nativeSimd: options.nativeSimd,
  };
}

function invokeNativeAggregate(native, input, tier, nativeSimd) {
  if (typeof native.parse_aggregate_buffer_with_simd === 'function') {
    return native.parse_aggregate_buffer_with_simd(input, tier, nativeSimd);
  }
  if (nativeSimd !== 'auto') {
    throw new Error('Native addon does not expose parse_aggregate_buffer_with_simd; rebuild packages/native-aggregate.');
  }
  return native.parse_aggregate_buffer(input, tier);
}

function normalizeNativeResult(result) {
  return {
    eventCount: result.eventCount ?? result.event_count,
    checksum: result.checksum,
  };
}

function measureSimdXmlUpstreamParse(filePath, sizeBytes, options) {
  const result = spawnSync(simdXmlBenchExe(), [], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      STAX_XML_BENCH_FILE: filePath,
      STAX_XML_BENCH_TIER: 'count-only',
      STAX_XML_BENCH_RUNS: String(options.runs),
      STAX_XML_BENCH_WARMUPS: String(options.warmups),
      STAX_XML_BENCH_INPUT_MODE: 'memory',
      STAX_XML_BENCH_WORKLOAD: 'upstream-parse',
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `simdxml-bench exited ${result.status}`);
  }
  const parsed = JSON.parse(result.stdout);
  return {
    id: 'simdxml-upstream-parse',
    status: 'ok',
    avgMs: parsed.avgMs,
    minMs: parsed.minMs,
    maxMs: parsed.maxMs,
    mibPerSec: parsed.mibPerSec,
    eventCount: parsed.eventCount,
    checksum: parsed.checksum,
    samplesMs: parsed.samplesMs,
    inputMode: parsed.inputMode,
    workload: parsed.workload,
    sizeBytes,
  };
}

function measurementResult(id, sizeBytes, samplesMs, stable) {
  const avgMs = average(samplesMs);
  return {
    id,
    status: 'ok',
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: bytesToMiB(sizeBytes) / (avgMs / 1000),
    eventCount: stable.eventCount,
    checksum: stable.checksum,
    samplesMs,
    sizeBytes,
  };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bytesToMiB(bytes) {
  return bytes / 1024 / 1024;
}

function formatRate(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} MiB/s` : 'n/a';
}

function formatMs(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)} ms` : 'n/a';
}

function ratio(a, b) {
  if (!a?.mibPerSec || !b?.mibPerSec) return 'n/a';
  return `${(a.mibPerSec / b.mibPerSec).toFixed(2)}x`;
}

function uniqueCases(groups) {
  const seen = new Set();
  const cases = [];
  for (const group of groups) {
    for (const [label, filename] of upstreamCaseGroups[group]) {
      const key = `${group}:${label}:${filename}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cases.push({ group, label, filename });
    }
  }
  return cases;
}

function createMarkdown(report) {
  const lines = [
    '# simdxml Upstream Fixture Comparator',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This benchmark reuses the upstream simdxml benchmark fixture lists and XML fixture files from `https://github.com/simdxml/simdxml`, then compares `simdxml::parse(&data)` with the stax-xml native aggregate addon over the same read-once in-memory bytes.',
    'The stax-xml native rows are measured only through Node.js importing the napi-rs N-API addon (`@stax-xml/native-aggregate-probe`); this report does not call a standalone Rust binary or direct Rust library entry point for stax-xml.',
    '',
    '## Environment',
    '',
    `- CPU: ${report.environment.cpuName}`,
    `- Platform: ${report.environment.platform}`,
    `- Node: ${report.environment.node}`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    `- Native SIMD policy: ${report.options.nativeSimd}`,
    `- Upstream: ${report.upstream.url}`,
    `- Upstream ref: ${report.upstream.ref}`,
    `- Upstream HEAD: ${report.upstream.head}`,
    `- Upstream parse bench: ${report.upstream.parseBench}`,
    '',
    '## Scope',
    '',
    '- Included upstream Criterion sections: `bench_parse_throughput`, `bench_parse_shapes`, and `bench_parse_scaling`.',
    `- Fixture disclaimer: XML fixture names, grouping, and file contents are pulled from the simdxml repository at \`${report.upstream.ref}\`; they are used as benchmark input data, not as stax-xml-authored fixtures.`,
    '- Excluded: libxml2, Woodstox, roxmltree, xml-rs, CLI XPath scripts, persistent index, lazy parse, bloom, batch, and parallel parser sections.',
    '- `simdxml-upstream-parse` is the upstream parse workload shape: parse the in-memory XML bytes and retain tag/text counts to prevent dead-code elimination.',
    '- `stax-native-*` rows are Node+N-API measurements: the benchmark imports the JS wrapper, passes a Node Buffer across the N-API boundary once per measured sample, and reports the native aggregate result returned to Node.',
    '- `stax-native-event-count-unsafe-gt` uses a raw `>` search for start-tag end detection; it is a quote-masking diagnostic lower bound and is unsafe for XML with `>` inside attribute values.',
    '- `stax-native-event-count-byte-loop` and `stax-native-event-count-skip-quotes` are safe tag-end scanner diagnostics for comparing quote masking loop shapes.',
    '- `stax-native-event-count-no-text` skips character/CDATA event handling and is a diagnostic upper bound for whitespace/text handling cost.',
    '- `stax-native-event-count-no-checksum` keeps event detection but skips checksum folding to isolate benchmark-consumer overhead.',
    '- `stax-native-event-count-no-text-no-checksum` combines those two diagnostic skips to expose the loop/markup lower bound.',
    '- `stax-native-event-count-two-stage` uses a simdxml-style quote-masked structural bitmask walk for event counting.',
    '- `stax-native-event-count-auto-stage` selects the two-stage event walk only when the first 4 KiB has a high quote-to-tag ratio.',
    '- `stax-native-event-count-unchecked` skips attribute scanning and closing-tag stack/name validation; it is a diagnostic lower bound, not a conforming XML parser mode.',
    '- `stax-native-event-count-only` skips attribute scanning but keeps closing-tag stack/name validation.',
    '- `stax-native-count-only` is not a raw structural classifier; it emits the native aggregate event stream and folds event type plus attribute counts.',
    '- `stax-native-count-eq-two-stage` counts quote-masked `=` positions as a well-formed XML attribute-count lower bound.',
    '- `stax-native-count-auto-stage` applies the same quote-ratio dispatch to choose between count-only and the two-stage `=` count lower bound.',
    '- `stax-native-full-string-direct` additionally folds element names, text, attribute names, and attribute values.',
    '- `--native-simd=off|sse42|avx2|neon|auto` controls only the stax-xml native structural classifier behind two-stage and auto-stage tiers. It does not change the simdxml comparator row.',
    '- Explicit SIMD policies fail instead of silently falling back when unavailable. On x86_64, `auto` tries AVX2 first, then SSE4.2, then scalar; on aarch64, `auto` uses NEON.',
    '- Compare SIMD policies by rerunning this script with identical fixtures, tiers, warmups, and runs while changing only `--native-simd`. Keep `event-count-two-stage` / `count-eq-two-stage` as classifier diagnostics and `event-count-auto-stage` / `count-auto-stage` as representative heuristic tiers.',
    '',
  ];

  for (const group of report.groups) {
    lines.push(`## ${group.id}`);
    lines.push('');
    lines.push(`| Case | Size | simdxml parse | ${report.options.nativeTiers.map(formatNativeTierHeader).join(' | ')} |`);
    lines.push(`| --- | ---: | ---: | ${report.options.nativeTiers.map(() => '---:').join(' | ')} |`);
    for (const entry of group.cases) {
      const simd = entry.results.find(result => result.id === 'simdxml-upstream-parse');
      const nativeCells = report.options.nativeTiers.map((tier) => {
        const result = entry.results.find(candidate => candidate.id === `stax-native-${tier}`);
        return `${formatRate(result?.mibPerSec)} (${ratio(result, simd)})`;
      });
      lines.push(
        `| ${entry.label} | ${bytesToMiB(entry.sizeBytes).toFixed(2)} MiB | ${formatRate(simd?.mibPerSec)} (${formatMs(simd?.avgMs)}) | ${nativeCells.join(' | ')} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Contract Notes');
  lines.push('');
  lines.push('The comparison intentionally keeps the upstream simdxml parse workload separate from the stax event workload. This avoids claiming XPath or CLI parity while still using upstream data shape, file sizes, and parse-benchmark case selection.');
  lines.push('');
  return `${lines.join('\n').replace(/\n+$/g, '')}\n`;
}

function formatNativeTierHeader(tier) {
  if (tier === 'event-count-unchecked') return 'stax event unchecked';
  if (tier === 'event-count-unsafe-gt') return 'stax raw >';
  if (tier === 'event-count-byte-loop') return 'stax byte loop';
  if (tier === 'event-count-skip-quotes') return 'stax skip quotes';
  if (tier === 'event-count-no-text') return 'stax no text';
  if (tier === 'event-count-no-checksum') return 'stax no checksum';
  if (tier === 'event-count-no-text-no-checksum') return 'stax loop lower';
  if (tier === 'event-count-two-stage') return 'stax two-stage event';
  if (tier === 'event-count-auto-stage') return 'stax auto event';
  if (tier === 'event-count-only') return 'stax event checked';
  if (tier === 'count-only') return 'stax attr count';
  if (tier === 'count-eq-two-stage') return 'stax two-stage eq count';
  if (tier === 'count-auto-stage') return 'stax auto count';
  if (tier === 'full-string-direct') return 'stax full string';
  return `stax ${tier}`;
}

async function main() {
  const options = parseArgs();
  ensureUpstream(options);
  buildTools(options);
  const native = await import('@stax-xml/native-aggregate-probe');
  const benchDir = join(options.upstreamDir, 'testdata', 'bench');
  const cases = uniqueCases(options.groups);
  const head = upstreamHead(options.upstreamDir);

  const groups = options.groups.map(group => ({ id: group, cases: [] }));
  const groupsById = new Map(groups.map(group => [group.id, group]));
  for (const testCase of cases) {
    const filePath = join(benchDir, testCase.filename);
    if (!existsSync(filePath)) {
      throw new Error(`Upstream fixture not found: ${filePath}`);
    }
    const input = readFileSync(filePath);
    const sizeBytes = statSync(filePath).size;
    const results = [measureSimdXmlUpstreamParse(filePath, sizeBytes, options)];
    for (const tier of options.nativeTiers) {
      results.push(measureNative(input, tier, options, native));
    }
    groupsById.get(testCase.group).cases.push({
      label: testCase.label,
      filename: testCase.filename,
      path: filePath,
      sizeBytes,
      results,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
    },
    upstream: {
      url: upstreamUrl,
      ref: options.upstreamRef,
      head,
      dir: options.upstreamDir,
      parseBench: join(options.upstreamDir, 'crates', 'simdxml', 'benches', 'parse_bench.rs'),
      benchRunScript: join(options.upstreamDir, 'bench', 'run.sh'),
      benchRunX86Script: join(options.upstreamDir, 'bench', 'run-x86.sh'),
    },
    options: {
      runs: options.runs,
      warmups: options.warmups,
      groups: options.groups,
      nativeTiers: options.nativeTiers,
      nativeSimd: options.nativeSimd,
    },
    groups,
  };

  mkdirSync(dirname(options.jsonOut), { recursive: true });
  writeFileSync(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(options.mdOut, createMarkdown(report), 'utf8');

  console.log(`simdxml upstream comparator wrote ${options.jsonOut}`);
  console.log(`simdxml upstream comparator wrote ${options.mdOut}`);
  for (const group of report.groups) {
    console.log('');
    console.log(group.id);
    for (const entry of group.cases) {
      const simd = entry.results.find(result => result.id === 'simdxml-upstream-parse');
      const nativeSummary = options.nativeTiers.map((tier) => {
        const result = entry.results.find(candidate => candidate.id === `stax-native-${tier}`);
        return `${tier}=${formatRate(result?.mibPerSec)} (${ratio(result, simd)})`;
      });
      console.log(`  ${entry.label}: simdxml=${formatRate(simd.mibPerSec)}, ${nativeSummary.join(', ')}`);
    }
  }
}

void main();
