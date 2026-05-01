import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import inspector from 'node:inspector';
import { basename, dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  EventReaderSync,
  initStaxXml,
  StreamEventType,
  StreamReaderSync,
  XmlEventType,
} from 'stax-xml';
import { nodeFileByteBatchesSync } from 'stax-xml/adapters/node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const QUICK_FILE = join(__dirname, 'assets', 'midsize.xml');
const DEFAULT_OUTPUT_DIR = join(
  __dirname,
  'knowledge',
  'reports',
  'iterable',
  `stream-reader-overhead-${new Date().toISOString().replace(/[:.]/g, '-')}`,
);

const CASES = [
  {
    id: 'stream-native-count',
    readerKind: 'stream',
    backend: 'native',
    tier: 'count-only',
    batchSize: 1,
  },
  {
    id: 'stream-native-full',
    readerKind: 'stream',
    backend: 'native',
    tier: 'full-string',
    batchSize: 1,
  },
  {
    id: 'event-native-count',
    readerKind: 'event',
    backend: 'native',
    tier: 'count-only',
    namespaceAware: false,
  },
  {
    id: 'event-native-full',
    readerKind: 'event',
    backend: 'native',
    tier: 'full-string',
    namespaceAware: false,
  },
  {
    id: 'event-native-full-namespace',
    readerKind: 'event',
    backend: 'native',
    tier: 'full-string',
    namespaceAware: true,
  },
  {
    id: 'neutral-full',
    readerKind: 'event',
    backend: 'js',
    tier: 'full-string',
    namespaceAware: false,
  },
];

const FOCUS_GROUPS = [
  {
    id: 'stream_accessor_copy',
    label: 'stream accessor copy and decode',
    match: /^(copyName|copyText|copyAttrName|copyAttrValue|copyAttrValueByName|copySpan|copyNameSpan|toString|decodeSpan)$/i,
  },
  {
    id: 'event_materialization',
    label: 'event materialization',
    match: /^(materializeBatch|materializeEvent|materializeText|materializeLeanStartElement|copyPlainAttributes)$/i,
  },
  {
    id: 'namespace_materialization',
    label: 'namespace and qname materialization',
    match: /^(materializeStartElement|materializeEndElement|copyAttributes|attributeInfo|splitQName|defineData)$/i,
  },
  {
    id: 'table_navigation',
    label: 'table navigation',
    match: /^(eventType|attrCount|nameStart|nameEnd|textStart|textEnd|attrNameStart|attrNameEnd|attrValueStart|attrValueEnd|eventOffset|attrOffset)$/i,
  },
  {
    id: 'native_boundary',
    label: 'native boundary and batch handoff',
    match: /^(nextBatch|pushChunk|pushBatch|CallApiCallback|CEntry)$/i,
  },
  {
    id: 'consumer_checksum',
    label: 'consumer checksum and accessor loop',
    match: /^(foldString|mixChecksum|next|name|text|getAttributeCount|getAttributeName|getAttributeValue|consumeParser|consumeStreamReader)$/i,
  },
];

function parseArgs(argv) {
  const options = {
    file: QUICK_FILE,
    cases: CASES.map((entry) => entry.id),
    warmups: 4,
    iterations: 8,
    sampleIntervalUs: 250,
    outputDir: DEFAULT_OUTPUT_DIR,
    inputMode: 'memory',
    quick: false,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;

    if (arg === '--quick') {
      options.quick = true;
      options.warmups = 2;
      options.iterations = 4;
      continue;
    }
    if (arg === '--self-test') {
      options.selfTest = true;
      continue;
    }

    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error(`${arg} requires a value.`);
      }
      index++;
      return value;
    };

    switch (name) {
      case '--file':
        options.file = resolve(process.cwd(), readValue());
        break;
      case '--cases':
        options.cases = parseCaseIds(readValue());
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--iterations':
        options.iterations = parsePositiveInteger(readValue(), name);
        break;
      case '--sample-interval-us':
        options.sampleIntervalUs = parsePositiveInteger(readValue(), name);
        break;
      case '--output-dir':
        options.outputDir = resolve(process.cwd(), readValue());
        break;
      case '--input-mode':
        options.inputMode = parseInputMode(readValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function parseInputMode(value) {
  if (value !== 'memory' && value !== 'contract') {
    throw new Error('--input-mode must be memory or contract.');
  }
  return value;
}

function parseCaseIds(value) {
  if (value === 'all') {
    return CASES.map((entry) => entry.id);
  }
  const entries = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0) {
    throw new Error('--cases must not be empty.');
  }
  for (const entry of entries) {
    if (!CASES.some((candidate) => candidate.id === entry)) {
      throw new Error(`Unknown case id: ${entry}`);
    }
  }
  return entries;
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

function caseById(id) {
  const found = CASES.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`Unknown case id: ${id}`);
  }
  return found;
}

function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function foldString(seed, value) {
  if (!value) {
    return seed;
  }
  let next = seed;
  for (let index = 0; index < value.length; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
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
      throw new Error(`Unsupported parser event type: ${type}`);
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
      throw new Error(`Unsupported stream event type: ${type}`);
  }
}

function chunkBuffer(buffer, chunkSize, batchSize) {
  const chunks = [];
  for (let offset = 0; offset < buffer.byteLength; offset += chunkSize) {
    chunks.push(buffer.subarray(offset, Math.min(offset + chunkSize, buffer.byteLength)));
  }

  const batches = [];
  for (let offset = 0; offset < chunks.length; offset += batchSize) {
    batches.push(chunks.slice(offset, offset + batchSize));
  }
  return batches;
}

function prepareInput(filePath, caseConfig, options) {
  if (options.inputMode === 'contract') {
    return { filePath };
  }

  const fileBuffer = readFileSync(filePath);
  if (caseConfig.readerKind === 'stream') {
    return {
      byteBatches: chunkBuffer(fileBuffer, 1024 * 1024, caseConfig.batchSize ?? 1),
    };
  }

  return {
    xml: fileBuffer.toString('utf8'),
  };
}

function createParser(caseConfig, preparedInput) {
  if (caseConfig.readerKind === 'stream') {
    if (preparedInput.byteBatches) {
      return new StreamReaderSync(preparedInput.byteBatches, { backend: 'native' });
    }
    return new StreamReaderSync(
      nodeFileByteBatchesSync(preparedInput.filePath, {
        chunkSize: 1024 * 1024,
        batchSize: caseConfig.batchSize ?? 1,
      }),
      { backend: 'native' },
    );
  }

  return new EventReaderSync(
    preparedInput.xml ?? readFileSync(preparedInput.filePath, 'utf8'),
    {
      autoDecodeEntities: false,
      namespaceAware: caseConfig.namespaceAware ?? false,
    },
    caseConfig.backend,
  );
}

function consumeEventReader(parser, tier) {
  let eventCount = 0;
  let checksum = 0;

  for (const event of parser) {
    const type = eventTypeId(event.type);
    const attrs = event.type === XmlEventType.START_ELEMENT ? Object.entries(event.attributes ?? {}) : [];
    eventCount++;
    checksum = mixChecksum(checksum, type);

    if (tier === 'count-only') {
      checksum = mixChecksum(checksum, attrs.length);
    } else if (tier === 'name-string-only') {
      if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
        checksum = foldString(checksum, event.name);
      }
    } else if (tier === 'text-string-only') {
      if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
        checksum = foldString(checksum, event.value?.trim());
      }
    } else if (tier === 'attr-value-string-only') {
      checksum = mixChecksum(checksum, attrs.length);
      for (const [, value] of attrs) {
        checksum = foldString(checksum, value);
      }
    } else {
      if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
        checksum = foldString(checksum, event.name);
      }
      if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
        checksum = foldString(checksum, event.value?.trim());
      }
      checksum = mixChecksum(checksum, attrs.length);
      for (const [name, value] of attrs) {
        checksum = foldString(checksum, name);
        checksum = foldString(checksum, value);
      }
    }
  }

  return { eventCount, checksum };
}

function consumeStreamReader(parser, tier) {
  let eventCount = 0;
  let checksum = 0;

  for (;;) {
    const type = parser.next();
    if (type === null) {
      break;
    }
    eventCount++;
    checksum = mixChecksum(checksum, streamEventTypeId(type));
    const attrCount = type === StreamEventType.START_ELEMENT ? parser.getAttributeCount() : 0;

    if (tier === 'count-only') {
      checksum = mixChecksum(checksum, attrCount);
    } else if (tier === 'name-string-only') {
      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        checksum = foldString(checksum, parser.name());
      }
    } else if (tier === 'text-string-only') {
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        checksum = foldString(checksum, parser.text()?.trim());
      }
    } else if (tier === 'attr-value-string-only') {
      checksum = mixChecksum(checksum, attrCount);
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        checksum = foldString(checksum, parser.getAttributeValue(attrIndex));
      }
    } else {
      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        checksum = foldString(checksum, parser.name());
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        checksum = foldString(checksum, parser.text()?.trim());
      }
      checksum = mixChecksum(checksum, attrCount);
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        checksum = foldString(checksum, parser.getAttributeName(attrIndex));
        checksum = foldString(checksum, parser.getAttributeValue(attrIndex));
      }
    }
  }

  return { eventCount, checksum };
}

function runCaseOnce(caseConfig, preparedInput) {
  const parser = createParser(caseConfig, preparedInput);
  return caseConfig.readerKind === 'stream'
    ? consumeStreamReader(parser, caseConfig.tier)
    : consumeEventReader(parser, caseConfig.tier);
}

async function post(session, method, params = undefined) {
  return await new Promise((resolve, reject) => {
    session.post(method, params ?? {}, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

async function captureCpuProfile(caseConfig, preparedInput, options) {
  let reference;
  for (let index = 0; index < options.warmups; index++) {
    const result = runCaseOnce(caseConfig, preparedInput);
    reference ??= result;
  }

  if (globalThis.gc) {
    globalThis.gc();
  }

  const session = new inspector.Session();
  session.connect();
  await post(session, 'Profiler.enable');
  try {
    await post(session, 'Profiler.setSamplingInterval', { interval: options.sampleIntervalUs });
  } catch {
    // Older profiler targets may reject custom sampling intervals.
  }
  await post(session, 'Profiler.start');

  const startedAt = performance.now();
  for (let index = 0; index < options.iterations; index++) {
    const result = runCaseOnce(caseConfig, preparedInput);
    if (reference.eventCount !== result.eventCount || reference.checksum !== result.checksum) {
      throw new Error(`${caseConfig.id} changed event count/checksum during profiling.`);
    }
  }
  const durationMs = performance.now() - startedAt;

  const { profile } = await post(session, 'Profiler.stop');
  session.disconnect();

  return {
    reference,
    durationMs,
    averageMs: durationMs / options.iterations,
    profile,
  };
}

function summarizeProfile(profile) {
  const entries = [];

  for (const node of profile.nodes ?? []) {
    const hits = node.hitCount ?? 0;
    if (hits <= 0) {
      continue;
    }
    const frame = node.callFrame ?? {};
    entries.push({
      functionName: frame.functionName || '(anonymous)',
      url: frame.url || '',
      lineNumber: typeof frame.lineNumber === 'number' ? frame.lineNumber + 1 : undefined,
      columnNumber: typeof frame.columnNumber === 'number' ? frame.columnNumber + 1 : undefined,
      hits,
    });
  }

  const grouped = new Map();
  for (const entry of entries) {
    const key = `${entry.functionName}|${entry.url}|${entry.lineNumber ?? ''}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.hits += entry.hits;
    } else {
      grouped.set(key, { ...entry });
    }
  }

  const functions = Array.from(grouped.values()).sort((left, right) => right.hits - left.hits);
  const totalHits = functions.reduce((sum, entry) => sum + entry.hits, 0);
  const topFunctions = functions.slice(0, 25).map((entry) => ({
    ...entry,
    share: totalHits === 0 ? 0 : entry.hits / totalHits,
    file: entry.url ? basename(entry.url) : '',
  }));

  const focusGroups = FOCUS_GROUPS.map((group) => {
    const hits = functions
      .filter((entry) => group.match.test(entry.functionName))
      .reduce((sum, entry) => sum + entry.hits, 0);
    return {
      id: group.id,
      label: group.label,
      hits,
      share: totalHits === 0 ? 0 : hits / totalHits,
    };
  }).sort((left, right) => right.hits - left.hits);

  const projectFunctions = functions
    .filter((entry) => entry.url.includes('packages/stax-xml') || entry.url.includes('packages/benchmark'))
    .slice(0, 15)
    .map((entry) => ({
      ...entry,
      share: totalHits === 0 ? 0 : entry.hits / totalHits,
      file: entry.url ? basename(entry.url) : '',
    }));

  return {
    totalHits,
    topFunctions,
    focusGroups,
    projectFunctions,
  };
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDuration(value) {
  return `${value.toFixed(2)} ms`;
}

function writeCaseProfile(outputDir, caseId, profile) {
  const filePath = join(outputDir, `${caseId}.cpuprofile`);
  writeFileSync(filePath, JSON.stringify(profile, null, 2));
  return filePath;
}

function buildFindings(results) {
  const findings = [];
  const eventFull = results.find((entry) => entry.caseId === 'event-native-full');
  const eventFullNamespace = results.find((entry) => entry.caseId === 'event-native-full-namespace');
  const streamFull = results.find((entry) => entry.caseId === 'stream-native-full');

  if (eventFull && eventFullNamespace) {
    const baseNamespace = eventFull.summary.focusGroups.find((entry) => entry.id === 'namespace_materialization');
    const expandedNamespace = eventFullNamespace.summary.focusGroups.find((entry) => entry.id === 'namespace_materialization');
    if ((baseNamespace?.hits ?? 0) === 0 && (expandedNamespace?.hits ?? 0) > 0) {
      findings.push(
        'The current `EventReaderSync` benchmark path (`namespaceAware: false`) does not spend measurable CPU in `localName`/`prefix`/namespace expansion. That cost only appears when `namespaceAware: true` is enabled.',
      );
    }
  }

  if (streamFull) {
    const stringCopy = streamFull.summary.focusGroups.find((entry) => entry.id === 'stream_accessor_copy');
    const nativeBoundary = streamFull.summary.focusGroups.find((entry) => entry.id === 'native_boundary');
    if ((stringCopy?.hits ?? 0) > (nativeBoundary?.hits ?? 0)) {
      findings.push(
        '`StreamReaderSync` spends more sampled CPU in accessor-driven string/span materialization than in native batch handoff, which matches the weak gain from `pushBatch()`.',
      );
    }

    const gcEntry = streamFull.summary.topFunctions.find((entry) => entry.functionName === 'custom_gc' || entry.functionName === '(garbage collector)');
    if ((gcEntry?.share ?? 0) >= 0.10) {
      findings.push(
        '`StreamReaderSync` full-string is also GC-heavy in the profiled loop, which points to transient string churn from repeated accessor materialization rather than a remaining native boundary bottleneck.',
      );
    }
  }

  if (eventFull) {
    const leanMaterialization = eventFull.summary.focusGroups.find((entry) => entry.id === 'event_materialization');
    if ((leanMaterialization?.hits ?? 0) > 0) {
      findings.push(
        '`EventReaderSync` still pays explicit JS event materialization cost even with `namespaceAware: false`, especially start-element object construction and plain attribute object creation.',
      );
    }

    const readEventEntry = eventFull.summary.topFunctions.find((entry) => entry.functionName === 'readEvent');
    if (readEventEntry) {
      findings.push(
        'The current native `EventReaderSync` row is primarily spending time in the direct structural-index iterator (`readEvent`/`readAttributes`), not in the older `IterableEventMaterializer` path.',
      );
    }
  }

  return findings;
}

function generateReport(results, options) {
  const lines = [];
  lines.push('# StreamReader Overhead Profile');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Node: ${process.version}`);
  lines.push(`V8: ${process.versions.v8}`);
  lines.push(`File: ${options.file}`);
  lines.push(`Warmups: ${options.warmups}`);
  lines.push(`Iterations: ${options.iterations}`);
  lines.push(`Sampling interval (requested): ${options.sampleIntervalUs} us`);
  lines.push(`Input mode: ${options.inputMode}`);
  lines.push('');
  lines.push('## Case Summary');
  lines.push('');
  lines.push('| Case | Tier | Avg time | Event count | Checksum | CPU profile |');
  lines.push('| --- | --- | ---: | ---: | ---: | --- |');
  for (const result of results) {
    lines.push(
      `| ${result.caseId} | ${result.caseConfig.tier} | ${formatDuration(result.averageMs)} | ${result.reference.eventCount} | ${result.reference.checksum} | ${basename(result.profilePath)} |`,
    );
  }
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of buildFindings(results)) {
    lines.push(`- ${finding}`);
  }
  lines.push('');

  for (const result of results) {
    lines.push(`## ${result.caseId}`);
    lines.push('');
    lines.push(`- Reader kind: ${result.caseConfig.readerKind}`);
    lines.push(`- Backend: ${result.caseConfig.backend}`);
    lines.push(`- Tier: ${result.caseConfig.tier}`);
    if (result.caseConfig.readerKind === 'stream') {
      lines.push(`- Batch size: ${result.caseConfig.batchSize ?? 1}`);
    }
    if (result.caseConfig.readerKind === 'event') {
      lines.push(`- namespaceAware: ${result.caseConfig.namespaceAware === true}`);
    }
    lines.push(`- Avg time: ${formatDuration(result.averageMs)}`);
    lines.push(`- Samples: ${result.summary.totalHits}`);
    lines.push('');
    lines.push('Top focus groups:');
    for (const group of result.summary.focusGroups.slice(0, 4)) {
      lines.push(`- ${group.label}: ${group.hits} samples (${formatPercent(group.share)})`);
    }
    lines.push('');
    lines.push('Top project-local frames:');
    for (const frame of result.summary.projectFunctions.slice(0, 8)) {
      const location = frame.file ? `${frame.file}:${frame.lineNumber ?? '?'}` : '(builtin)';
      lines.push(`- ${frame.functionName} @ ${location}: ${frame.hits} samples (${formatPercent(frame.share)})`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function runSelfTest() {
  const sampleProfile = {
    nodes: [
      { id: 1, hitCount: 4, callFrame: { functionName: 'copySpan', url: 'file:///x/event-table.js', lineNumber: 12, columnNumber: 0 } },
      { id: 2, hitCount: 2, callFrame: { functionName: 'copyPlainAttributes', url: 'file:///x/IterableEventBackend.js', lineNumber: 80, columnNumber: 0 } },
      { id: 3, hitCount: 1, callFrame: { functionName: 'splitQName', url: 'file:///x/IterableEventBackend.js', lineNumber: 120, columnNumber: 0 } },
    ],
  };
  const summary = summarizeProfile(sampleProfile);
  if (summary.totalHits !== 7) {
    throw new Error(`self-test totalHits mismatch: ${summary.totalHits}`);
  }
  if (summary.topFunctions[0]?.functionName !== 'copySpan') {
    throw new Error(`self-test top function mismatch: ${summary.topFunctions[0]?.functionName}`);
  }
  const namespaceGroup = summary.focusGroups.find((entry) => entry.id === 'namespace_materialization');
  if (!namespaceGroup || namespaceGroup.hits !== 1) {
    throw new Error(`self-test namespace group mismatch: ${namespaceGroup?.hits}`);
  }
  console.log('profile-stream-reader-overhead self-test passed');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  mkdirSync(options.outputDir, { recursive: true });
  await initStaxXml({ backend: 'native' });

  const selectedCases = options.cases.map(caseById);
  const results = [];

  for (const caseConfig of selectedCases) {
    const preparedInput = prepareInput(options.file, caseConfig, options);
    const profileRun = await captureCpuProfile(caseConfig, preparedInput, options);
    const profilePath = writeCaseProfile(options.outputDir, caseConfig.id, profileRun.profile);
    results.push({
      caseId: caseConfig.id,
      caseConfig,
      ...profileRun,
      profilePath,
      summary: summarizeProfile(profileRun.profile),
    });
  }

  const summaryPath = join(options.outputDir, 'summary.json');
  writeFileSync(summaryPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    node: process.version,
    v8: process.versions.v8,
    options: {
      file: options.file,
      warmups: options.warmups,
      iterations: options.iterations,
      sampleIntervalUs: options.sampleIntervalUs,
      inputMode: options.inputMode,
      cases: options.cases,
    },
    results: results.map((result) => ({
      caseId: result.caseId,
      profilePath: result.profilePath,
      reference: result.reference,
      durationMs: result.durationMs,
      averageMs: result.averageMs,
      summary: result.summary,
    })),
  }, null, 2));

  const reportPath = join(options.outputDir, 'REPORT.md');
  writeFileSync(reportPath, generateReport(results, options));

  console.log(`Profile summary saved to ${summaryPath}`);
  console.log(`Profile report saved to ${reportPath}`);
  for (const result of results) {
    console.log(`${result.caseId}: ${formatDuration(result.averageMs)} avg, profile=${result.profilePath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
