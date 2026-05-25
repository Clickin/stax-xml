import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  StreamEventType,
  StreamReaderSync,
} from '../stax-xml/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultFile = join(__dirname, 'test-data', 'runtime-comparison-16mib.xml');
const defaultOutputDir = join(__dirname, 'results', 'v8-codegen', `file-backed-${Date.now()}`);
const defaultJsonOut = join(__dirname, 'results', 'release', 'file-backed-v8-codegen-trace.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'file-backed-v8-codegen-trace.md');
const warmupMarker = '[stax-file-backed-v8-codegen] warmup-complete';
const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

const caseIds = [
  'scan-all-no-decode',
  'stream-full-string',
  'raw-frame-name-id',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    mode: 'driver',
    file: defaultFile,
    cases: [...caseIds],
    caseId: 'stream-full-string',
    outputDir: defaultOutputDir,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    chunkKiB: 64,
    batchSize: 1,
    warmups: 16,
    iterations: 4,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} requires a value.`);
      index++;
      return value;
    };

    switch (name) {
      case '--mode':
        options.mode = parseChoice(readValue(), ['driver', 'run'], name);
        break;
      case '--file':
        options.file = resolve(process.cwd(), readValue());
        break;
      case '--cases':
        options.cases = parseList(readValue(), caseIds, name);
        break;
      case '--case':
        options.caseId = parseChoice(readValue(), caseIds, name);
        break;
      case '--output-dir':
        options.outputDir = resolve(process.cwd(), readValue());
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      case '--chunk-kib':
        options.chunkKiB = parsePositiveInteger(readValue(), name);
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--iterations':
        options.iterations = parsePositiveInteger(readValue(), name);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!existsSync(options.file)) {
    throw new Error(`Benchmark fixture does not exist: ${options.file}`);
  }
  return options;
}

function parseChoice(value, allowed, flag) {
  if (!allowed.includes(value)) throw new Error(`${flag} must be one of: ${allowed.join(', ')}`);
  return value;
}

function parseList(value, allowed, flag) {
  if (value === 'all') return [...allowed];
  const entries = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (entries.length === 0) throw new Error(`${flag} must not be empty.`);
  for (const entry of entries) {
    if (!allowed.includes(entry)) throw new Error(`${flag} contains unknown id ${entry}.`);
  }
  return entries;
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

function main() {
  const options = parseArgs();
  if (options.mode === 'run') {
    runTraceCase(options);
    return;
  }
  runDriver(options);
}

function runDriver(options) {
  mkdirSync(options.outputDir, { recursive: true });
  const fixtureStats = statSync(options.file);
  const manifest = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    v8: process.versions.v8,
    cpuName: cpus()[0]?.model ?? 'unknown',
    platform: `${process.platform}-${process.arch}`,
    file: options.file,
    fixture: createFixtureRecord(options.file, fixtureStats),
    outputDir: options.outputDir,
    cases: options.cases,
    chunkKiB: options.chunkKiB,
    batchSize: options.batchSize,
    warmups: options.warmups,
    iterations: options.iterations,
    artifacts: [],
  };

  for (const caseId of options.cases) {
    manifest.artifacts.push(runTraceProcess(options, caseId));
  }

  const rawManifestPath = join(options.outputDir, 'manifest.json');
  writeFileSync(rawManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const report = buildReport(manifest, rawManifestPath);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`file-backed-v8-codegen-trace: cases=${report.cases.length} optimized=${report.summary.optimizedCaseCount} postWarmupDeopts=${report.summary.postWarmupDeoptCaseCount}`);
}

function runTraceProcess(options, caseId) {
  const logPath = join(options.outputDir, `${caseId}-trace.log`);
  const args = [
    '--allow-natives-syntax',
    '--trace-opt',
    '--trace-deopt',
    '--trace-file-names',
    fileURLToPath(import.meta.url),
    '--mode=run',
    `--case=${caseId}`,
    `--file=${options.file}`,
    `--chunk-kib=${options.chunkKiB}`,
    `--batch-size=${options.batchSize}`,
    `--warmups=${options.warmups}`,
    `--iterations=${options.iterations}`,
  ];
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  const elapsedMs = Date.now() - startedAt;
  writeFileSync(logPath, [
    `$ ${[process.execPath, ...args].join(' ')}`,
    `cwd=${repoRoot}`,
    `exit=${result.status} elapsedMs=${elapsedMs}`,
    '',
    '--- stdout ---',
    result.stdout ?? '',
    '',
    '--- stderr ---',
    result.stderr ?? '',
  ].join('\n'));

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`V8 trace failed for ${caseId}. See ${logPath}`);
  }
  return {
    kind: 'trace',
    caseId,
    logPath,
    elapsedMs,
    exit: result.status,
    bytes: existsSync(logPath) ? readFileSync(logPath, 'utf8').length : 0,
  };
}

function buildReport(manifest, rawManifestPath) {
  const cases = manifest.cases.map(caseId => analyzeCase(manifest, caseId));
  return {
    generatedAt: new Date().toISOString(),
    objective: 'file-backed-v8-codegen-trace',
    contract: 'node-v8-trace-opt-deopt-file-backed-reader-shapes',
    note: 'Node/V8 trace-opt and trace-deopt evidence for file-backed StreamReaderSync reader shapes. This is trace evidence for the source consumption and wrapper functions only; it is not a throughput ceiling proof and does not replace the 1 GiB benchmark rows.',
    environment: {
      node: manifest.node,
      v8: manifest.v8,
      cpuName: manifest.cpuName,
      platform: manifest.platform,
    },
    fixture: manifest.fixture,
    options: {
      cases: manifest.cases,
      chunkKiB: manifest.chunkKiB,
      batchSize: manifest.batchSize,
      warmups: manifest.warmups,
      iterations: manifest.iterations,
    },
    rawArtifacts: {
      manifestPath: rawManifestPath,
      outputDir: manifest.outputDir,
      committed: false,
    },
    cases,
    summary: {
      caseCount: cases.length,
      optimizedCaseCount: cases.filter(row => row.optimizedFunctions.length > 0).length,
      postWarmupDeoptCaseCount: cases.filter(row => row.postWarmupDeoptCount > 0).length,
      sameChecksum: new Set(cases.map(row => row.result?.checksum)).size === 1,
      sameEventCount: new Set(cases.map(row => row.result?.eventCount)).size === 1,
    },
    findings: createFindings(cases),
  };
}

function analyzeCase(manifest, caseId) {
  const artifact = manifest.artifacts.find(entry => entry.caseId === caseId);
  const optimizedFunctions = new Set();
  const deoptLines = [];
  const warmupDeoptLines = [];
  const postWarmupDeoptLines = [];
  const functionMentions = new Map();
  let phase = 'warmup';
  let result = null;

  if (artifact && existsSync(artifact.logPath)) {
    for (const line of readFileSync(artifact.logPath, 'utf8').split('\n')) {
      if (line.includes(warmupMarker)) {
        phase = 'post-warmup';
        continue;
      }
      const optimized = line.match(/completed optimizing .+?<JSFunction ([^ ]+)/);
      if (optimized) optimizedFunctions.add(optimized[1]);
      for (const target of [
        'consumeTraceCase',
        'consumeScanAllNoDecode',
        'consumeStreamFullString',
        'consumeRawFrameNameId',
        'createFileByteBatches',
        'foldString',
      ]) {
        if (line.includes(target)) {
          functionMentions.set(target, (functionMentions.get(target) ?? 0) + 1);
        }
      }
      if (/bailout|deopt/i.test(line)) {
        deoptLines.push(line);
        if (phase === 'post-warmup') {
          postWarmupDeoptLines.push(line);
        } else {
          warmupDeoptLines.push(line);
        }
      }
      const jsonMatch = line.match(/\{"caseId":.+\}$/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    }
  }

  return {
    caseId,
    status: postWarmupDeoptLines.length > 0
      ? 'deopt-after-warmup'
      : optimizedFunctions.size > 0 ? 'optimized-no-post-warmup-deopt' : 'no-optimization-seen',
    result,
    optimizedFunctions: [...optimizedFunctions].sort(),
    functionMentions: Object.fromEntries([...functionMentions.entries()].sort()),
    deoptCount: deoptLines.length,
    warmupDeoptCount: warmupDeoptLines.length,
    postWarmupDeoptCount: postWarmupDeoptLines.length,
    postWarmupDeoptSamples: postWarmupDeoptLines.slice(0, 8).map(line => line.slice(0, 260)),
    traceLogBytes: artifact?.bytes ?? 0,
  };
}

function createFindings(cases) {
  return [
    {
      id: 'file-backed-source-shape-traced',
      classification: 'TRACE_FACT',
      summary: 'All cases use StreamReaderSync over demand-driven file-backed Iterable<Uint8Array[]> batches.',
      evidence: cases.map(row => `${row.caseId}: events=${row.result?.eventCount ?? 'n/a'}, checksum=${row.result?.checksum ?? 'n/a'}`),
    },
    {
      id: 'post-warmup-deopt-gate',
      classification: 'TRACE_FACT',
      summary: 'Records whether each file-backed reader shape deoptimized after the warmup marker in this Node/V8 run.',
      evidence: cases.map(row => `${row.caseId}: status=${row.status}, postWarmupDeopts=${row.postWarmupDeoptCount}`),
    },
    {
      id: 'trace-scope-guard',
      classification: 'SCOPE_GUARD',
      summary: 'This narrows Node/V8 file-backed source-shape evidence but does not prove a JS runtime ceiling or cover SpiderMonkey/Safari JIT IR.',
      evidence: ['No throughput ceiling conclusion is allowed from this trace artifact.'],
    },
  ];
}

function runTraceCase(options) {
  const first = consumeTraceCase(options);
  for (let index = 1; index < options.warmups; index++) {
    const next = consumeTraceCase(options);
    assertSameResult(first, next);
  }
  console.log(warmupMarker);
  for (let index = 0; index < options.iterations; index++) {
    const next = consumeTraceCase(options);
    assertSameResult(first, next);
  }
  console.log(JSON.stringify({
    caseId: options.caseId,
    eventCount: first.eventCount,
    checksum: first.checksum,
  }));
}

function consumeTraceCase(options) {
  const batches = createFileByteBatches(options.file, options.chunkKiB * 1024, options.batchSize);
  switch (options.caseId) {
    case 'scan-all-no-decode':
      return consumeScanAllNoDecode(batches);
    case 'stream-full-string':
      return consumeStreamFullString(batches);
    case 'raw-frame-name-id':
      return consumeRawFrameNameId(batches);
    default:
      throw new Error(`Unknown case: ${options.caseId}`);
  }
}

function consumeScanAllNoDecode(bytes) {
  let eventCount = 0;
  let checksum = 0;
  for (const batch of new StreamReaderSync(bytes)) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const type = batch.typeAt(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);
      if (type === StreamEventType.START_ELEMENT) {
        checksum = mixChecksum(checksum, batch.attributeCountAt(index));
      }
    }
  }
  return { eventCount, checksum };
}

function consumeStreamFullString(bytes) {
  let eventCount = 0;
  let checksum = 0;
  for (const batch of new StreamReaderSync(bytes)) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const type = batch.typeAt(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);
      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        checksum = foldString(checksum, batch.nameAt(index));
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        checksum = foldString(checksum, batch.textAt(index)?.trim());
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrCount = batch.attributeCountAt(index);
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          checksum = foldString(checksum, batch.attributeNameAt(index, attrIndex));
          checksum = foldString(checksum, batch.attributeValueAt(index, attrIndex));
        }
      }
    }
  }
  return { eventCount, checksum };
}

function consumeRawFrameNameId(bytes) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const parser = new StreamReaderSync(bytes);
  const nameCache = [];
  let eventCount = 0;
  let checksum = 0;
  let frame;
  while ((frame = parser.nextRawBatch()) !== null) {
    const result = consumeRawFrameNameIdFrame(frame, checksum, eventCount, decoder, nameCache);
    checksum = result.checksum;
    eventCount = result.eventCount;
  }
  return { eventCount, checksum };
}

function consumeRawFrameNameIdFrame(frame, checksum, eventCount, decoder, nameCache) {
  if (frame.kind !== 'frame') throw new Error(`Unsupported raw batch kind: ${frame.kind}`);
  const buffer = frame.buffer;
  const eventTypes = frame.eventTypes;
  const nameStarts = frame.nameStarts;
  const nameEnds = frame.nameEnds;
  const nameIds = frame.nameIds;
  const textStarts = frame.textStarts;
  const textEnds = frame.textEnds;
  const attrStarts = frame.attrStarts;
  const attrCounts = frame.attrCounts;
  const attrNameStarts = frame.attrNameStarts;
  const attrNameEnds = frame.attrNameEnds;
  const attrNameIds = frame.attrNameIds;
  const attrValueStarts = frame.attrValueStarts;
  const attrValueEnds = frame.attrValueEnds;
  for (let index = 0; index < frame.eventCount; index++) {
    const type = eventTypes[index];
    eventCount++;
    checksum = mixChecksum(checksum, type);
    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      checksum = foldString(checksum, materializeName(buffer, nameStarts[index], nameEnds[index], nameIds[index], decoder, nameCache));
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      const start = textStarts[index];
      checksum = foldString(checksum, start < 0 ? undefined : decodeSpan(buffer, start, textEnds[index], decoder).trim());
    }
    if (type === StreamEventType.START_ELEMENT) {
      const attrStart = attrStarts[index];
      const attrCount = attrCounts[index];
      checksum = mixChecksum(checksum, attrCount);
      const attrEnd = attrStart + attrCount;
      for (let attrIndex = attrStart; attrIndex < attrEnd; attrIndex++) {
        checksum = foldString(checksum, materializeName(buffer, attrNameStarts[attrIndex], attrNameEnds[attrIndex], attrNameIds[attrIndex], decoder, nameCache));
        checksum = foldString(checksum, decodeSpan(buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex], decoder));
      }
    }
  }
  return { checksum, eventCount };
}

function materializeName(buffer, start, end, nameId, decoder, nameCache) {
  if (nameId >= 0) {
    const cached = nameCache[nameId];
    if (cached !== undefined) return cached;
  }
  const value = decodeSpan(buffer, start, end, decoder);
  if (nameId >= 0) nameCache[nameId] = value;
  return value;
}

function decodeSpan(buffer, start, end, decoder) {
  const ascii = decodeShortAsciiSpan(buffer, start, end);
  return ascii ?? decoder.decode(buffer.subarray(start, end));
}

function decodeShortAsciiSpan(buffer, start, end) {
  switch (end - start) {
    case 0:
      return '';
    case 1: {
      const b0 = buffer[start];
      return b0 <= 0x7f ? String.fromCharCode(b0) : undefined;
    }
    case 2: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      return (b0 | b1) <= 0x7f ? String.fromCharCode(b0, b1) : undefined;
    }
    case 3: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      return (b0 | b1 | b2) <= 0x7f ? String.fromCharCode(b0, b1, b2) : undefined;
    }
    case 4: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      return (b0 | b1 | b2 | b3) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3) : undefined;
    }
    case 5: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      return (b0 | b1 | b2 | b3 | b4) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4) : undefined;
    }
    case 6: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      return (b0 | b1 | b2 | b3 | b4 | b5) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5) : undefined;
    }
    case 7: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6) : undefined;
    }
    case 8: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7)
        : undefined;
    }
    default:
      return undefined;
  }
}

function* createFileByteBatches(filePath, chunkBytes, batchSize) {
  const fd = openSync(filePath, 'r');
  try {
    while (true) {
      const batch = [];
      for (let index = 0; index < batchSize; index++) {
        const buffer = new Uint8Array(chunkBytes);
        const bytesRead = readSync(fd, buffer, 0, chunkBytes, null);
        if (bytesRead === 0) break;
        batch.push(bytesRead === chunkBytes ? buffer : buffer.subarray(0, bytesRead));
      }
      if (batch.length === 0) return;
      yield batch;
    }
  } finally {
    closeSync(fd);
  }
}

function assertSameResult(expected, actual) {
  if (expected.eventCount !== actual.eventCount || expected.checksum !== actual.checksum) {
    throw new Error(`Unstable trace result: expected ${expected.eventCount}/${expected.checksum}, got ${actual.eventCount}/${actual.checksum}`);
  }
}

function createFixtureRecord(filePath, stats) {
  return {
    source: 'file-backed',
    path: filePath,
    sizeBytes: stats.size,
    sizeMiB: stats.size / MIB,
    sizeGiB: stats.size / GIB,
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# File-Backed V8 Codegen Trace');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(report.note);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Fixture: ${report.fixture.path}`);
  lines.push(`- Fixture size: ${formatNumber(report.fixture.sizeMiB)} MiB`);
  lines.push(`- Source shape: demand-driven file-backed Iterable<Uint8Array[]>`);
  lines.push(`- Chunk KiB: ${report.options.chunkKiB}`);
  lines.push(`- Batch size: ${report.options.batchSize}`);
  lines.push(`- Optimized cases: ${report.summary.optimizedCaseCount}/${report.summary.caseCount}`);
  lines.push(`- Post-warmup deopt cases: ${report.summary.postWarmupDeoptCaseCount}`);
  lines.push(`- Same event count: ${report.summary.sameEventCount ? 'yes' : 'no'}`);
  lines.push(`- Same checksum: ${report.summary.sameChecksum ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Raw Artifacts');
  lines.push('');
  lines.push(`- Output dir: ${report.rawArtifacts.outputDir}`);
  lines.push(`- Manifest: ${report.rawArtifacts.manifestPath}`);
  lines.push(`- Committed: ${report.rawArtifacts.committed ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Trace Gate');
  lines.push('');
  lines.push('| Case | Status | Events | Checksum | Optimized functions | Deopts warmup/post-warmup | Log bytes |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: |');
  for (const row of report.cases) {
    lines.push(`| ${row.caseId} | ${row.status} | ${row.result?.eventCount ?? 'n/a'} | ${row.result?.checksum ?? 'n/a'} | ${row.optimizedFunctions.length} | ${row.warmupDeoptCount}/${row.postWarmupDeoptCount} | ${row.traceLogBytes} |`);
  }
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  lines.push('## Limits');
  lines.push('');
  lines.push('- This is Node/V8 trace evidence for a file-backed fixture, not a new throughput benchmark.');
  lines.push('- It does not prove a JavaScript runtime ceiling and does not cover SpiderMonkey or Safari/WebKit JIT IR.');
  lines.push('- Raw trace logs are intentionally left under the generated output directory and not committed as release artifacts.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function foldString(seed, value) {
  if (!value) return seed;
  let next = seed;
  for (let index = 0; index < value.length; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

main();
