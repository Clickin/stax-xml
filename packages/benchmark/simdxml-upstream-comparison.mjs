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
import { EventReaderSync, initStaxXml, StreamEventType, StreamReaderSync, XmlEventType } from 'stax-xml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const upstreamUrl = 'https://github.com/simdxml/simdxml';
const defaultUpstreamRef = '539577043c27e537c2cf9e5a38e5e10d844e83b0';
const defaultUpstreamDir = resolve(repoRoot, '.omx', 'upstream', 'simdxml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'simdxml-upstream-comparison.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'simdxml-upstream-comparison.md');
const simdXmlBenchDir = join(__dirname, 'external', 'simdxml-bench');

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
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    skipFetch: false,
    skipBuild: false,
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
      case '--native-simd':
        readValue();
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
      `Command failed: ${command} ${args.join(' ')}\n${trimSpawnOutput(result)}`,
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
}

async function ensureNativeReaderRuntime() {
  const runtime = await initStaxXml({ backend: 'native', fallbackOnLoadError: false });
  if (
    runtime.backend.kind !== 'native'
    || !runtime.capabilities.streamingEventBatches
  ) {
    throw new Error('Native stax-xml runtime must expose streamingEventBatches for native reader benchmarks.');
  }
  return runtime;
}

function simdXmlBenchExe() {
  return join(
    simdXmlBenchDir,
    'target',
    'release',
    process.platform === 'win32' ? 'simdxml-bench.exe' : 'simdxml-bench',
  );
}

function measurePublicEventReader(input, options) {
  return measureEventReader(input, options, 'stax-xml-js-event-reader', 'js');
}

function measureNativeEventReader(input, options) {
  return measureStreamReader(input, options, 'stax-xml-native-stream-reader');
}

function measureEventReader(input, options, id, runtimeBackendPreference) {
  const xmlString = input.toString('utf8');
  const invoke = () => consumeEventReader(xmlString, runtimeBackendPreference);
  for (let index = 0; index < options.warmups; index++) {
    invoke();
  }

  const samplesMs = [];
  let stable;
  for (let index = 0; index < options.runs; index++) {
    if (globalThis.gc) globalThis.gc();
    const startedAt = performance.now();
    const result = invoke();
    const elapsedMs = performance.now() - startedAt;
    if (stable && (stable.eventCount !== result.eventCount || stable.checksum !== result.checksum)) {
      throw new Error(`${id} produced unstable event count or checksum.`);
    }
    stable = result;
    samplesMs.push(elapsedMs);
  }

  return measurementResult(id, input.byteLength, samplesMs, stable);
}

function measureStreamReader(input, options, id) {
  const invoke = () => consumeStreamReader(input);
  for (let index = 0; index < options.warmups; index++) {
    invoke();
  }

  const samplesMs = [];
  let stable;
  for (let index = 0; index < options.runs; index++) {
    if (globalThis.gc) globalThis.gc();
    const startedAt = performance.now();
    const result = invoke();
    const elapsedMs = performance.now() - startedAt;
    if (stable && (stable.eventCount !== result.eventCount || stable.checksum !== result.checksum)) {
      throw new Error(`${id} produced unstable event count or checksum.`);
    }
    stable = result;
    samplesMs.push(elapsedMs);
  }

  return measurementResult(id, input.byteLength, samplesMs, stable);
}

function consumeEventReader(xmlString, runtimeBackendPreference) {
  let eventCount = 0;
  let checksum = 2166136261;

  for (const event of new EventReaderSync(
    xmlString,
    { autoDecodeEntities: false },
    runtimeBackendPreference,
  )) {
    const attrs = event.type === XmlEventType.START_ELEMENT ? Object.entries(event.attributes ?? {}) : [];
    eventCount++;
    checksum = mix(checksum, eventTypeId(event.type));
    if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
      checksum = mixString(checksum, event.name);
    }
    if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
      checksum = mixString(checksum, event.value?.trim());
    }
    checksum = mix(checksum, attrs.length);
    for (const [name, value] of attrs) {
      checksum = mixString(checksum, name);
      checksum = mixString(checksum, value);
    }
  }

  return { eventCount, checksum: checksum | 0 };
}

function consumeStreamReader(input) {
  let eventCount = 0;
  let checksum = 2166136261;
  const parser = new StreamReaderSync(input);

  for (const batch of parser) {
    for (const event of batch) {
      const type = event.type;
      const attrCount = type === StreamEventType.START_ELEMENT ? event.getAttributeCount() : 0;
      eventCount++;
      checksum = mix(checksum, streamEventTypeId(type));
      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        checksum = mixString(checksum, event.name());
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        checksum = mixString(checksum, event.text()?.trim());
      }
      checksum = mix(checksum, attrCount);
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        checksum = mixString(checksum, event.getAttributeName(attrIndex));
        checksum = mixString(checksum, event.getAttributeValue(attrIndex));
      }
    }
  }

  return { eventCount, checksum: checksum | 0 };
}

function eventTypeId(type) {
  switch (type) {
    case XmlEventType.START_DOCUMENT:
      return 1;
    case XmlEventType.END_DOCUMENT:
      return 2;
    case XmlEventType.START_ELEMENT:
      return 3;
    case XmlEventType.END_ELEMENT:
      return 4;
    case XmlEventType.CHARACTERS:
      return 5;
    case XmlEventType.CDATA:
      return 6;
    default:
      return 31;
  }
}

function streamEventTypeId(type) {
  switch (type) {
    case StreamEventType.START_DOCUMENT:
      return 1;
    case StreamEventType.END_DOCUMENT:
      return 2;
    case StreamEventType.START_ELEMENT:
      return 3;
    case StreamEventType.END_ELEMENT:
      return 4;
    case StreamEventType.CHARACTERS:
      return 5;
    case StreamEventType.CDATA:
      return 6;
    default:
      return 31;
  }
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
    throw new Error(trimSpawnOutput(result) || `simdxml-bench exited ${result.status}`);
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

function mix(seed, value) {
  return ((seed ^ value) * 16777619) | 0;
}

function mixString(seed, value) {
  if (!value) return mix(seed, 0);
  let next = mix(seed, value.length);
  next = mix(next, value.charCodeAt(0));
  next = mix(next, value.charCodeAt(value.length >> 1));
  next = mix(next, value.charCodeAt(value.length - 1));
  return next;
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
    'This benchmark reuses the upstream simdxml benchmark fixture lists and XML fixture files from `https://github.com/simdxml/simdxml`, then compares `simdxml::parse(&data)` with public stax-xml event-reader rows over the same read-once in-memory bytes.',
    'The stax-xml native row initializes the package with `initStaxXml({ backend: "native" })` and measures only the public `StreamReaderSync` surface. It does not import or call private native diagnostic entry points directly.',
    '',
    '## Environment',
    '',
    `- CPU: ${report.environment.cpuName}`,
    `- Platform: ${report.environment.platform}`,
    `- Node: ${report.environment.node}`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
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
    '- `stax-xml-js-event-reader` uses `EventReaderSync` with the JavaScript backend explicitly, even when a native runtime has been initialized for the native row.',
    '- `stax-xml-native-stream-reader` uses `StreamReaderSync` with a native streaming runtime backend. This is the only stax native row published by this comparator.',
    '- Historical `--native-tiers` and `--native-simd` arguments are accepted and ignored so old command lines keep running, but this published report no longer exposes direct native diagnostic tiers.',
    '',
  ];

  for (const group of report.groups) {
    lines.push(`## ${group.id}`);
    lines.push('');
    lines.push('| Case | Size | simdxml parse | stax EventReaderSync JS | stax StreamReaderSync native |');
    lines.push('| --- | ---: | ---: | ---: | ---: |');
    for (const entry of group.cases) {
      const simd = entry.results.find(result => result.id === 'simdxml-upstream-parse');
      const publicReader = entry.results.find(result => result.id === 'stax-xml-js-event-reader');
      const nativeReader = entry.results.find(result => result.id === 'stax-xml-native-stream-reader');
      lines.push(
        `| ${entry.label} | ${bytesToMiB(entry.sizeBytes).toFixed(2)} MiB | ${formatRate(simd?.mibPerSec)} (${formatMs(simd?.avgMs)}) | ${formatRate(publicReader?.mibPerSec)} (${formatMs(publicReader?.avgMs)}) | ${formatRate(nativeReader?.mibPerSec)} (${ratio(nativeReader, simd)}) |`,
      );
    }
    lines.push('');
  }

  lines.push('## Contract Notes');
  lines.push('');
  lines.push('The comparison intentionally keeps the upstream simdxml parse workload separate from the stax event workload. This avoids claiming XPath or CLI parity while still using upstream data shape, file sizes, and parse-benchmark case selection.');
  lines.push('The stax native row is reported only through `StreamReaderSync`, the public parser surface used by the native-wrapper gate.');
  lines.push('');
  return `${lines.join('\n').replace(/\n+$/g, '')}\n`;
}

async function main() {
  const options = parseArgs();
  ensureUpstream(options);
  buildTools(options);
  await ensureNativeReaderRuntime();
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
    const results = [
      measureSimdXmlUpstreamParse(filePath, sizeBytes, options),
      measurePublicEventReader(input, options),
      measureNativeEventReader(input, options),
    ];
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
      const publicReader = entry.results.find(result => result.id === 'stax-xml-js-event-reader');
      const nativeReader = entry.results.find(result => result.id === 'stax-xml-native-stream-reader');
      console.log(
        `  ${entry.label}: simdxml=${formatRate(simd.mibPerSec)}, ` +
          `public=${formatRate(publicReader?.mibPerSec)}, native-reader=${formatRate(nativeReader?.mibPerSec)}`,
      );
    }
  }
}

function trimSpawnOutput(result) {
  return String(result.stderr ?? '').trim() || String(result.stdout ?? '').trim();
}

void main();
