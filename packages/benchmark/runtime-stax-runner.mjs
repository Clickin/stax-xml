import {
  StreamReaderSync,
  EventReaderSync,
  XmlEventType,
} from '../stax-xml/dist/index.js';

function argv() {
  if (globalThis.Deno?.args) {
    return globalThis.Deno.args;
  }
  return globalThis.process?.argv?.slice(2) ?? [];
}

function parseArgs(args = argv()) {
  const options = {
    file: undefined,
    runs: 3,
    warmups: 1,
    retentionRuns: 0,
    runtimeId: detectRuntimeId(),
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;
    if (arg === '--') continue;
    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error(`${arg} requires a value.`);
      }
      index++;
      return value;
    };

    switch (name) {
      case '--file':
        options.file = readValue();
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), '--runs');
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), '--warmups');
        break;
      case '--retention-runs':
        options.retentionRuns = parseNonNegativeInteger(readValue(), '--retention-runs');
        break;
      case '--runtime-id':
        options.runtimeId = readValue();
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.file) {
    throw new Error('--file is required.');
  }

  return options;
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

function detectRuntimeId() {
  if (globalThis.Deno) return 'deno';
  if (globalThis.Bun) return 'bun';
  return 'node';
}

function runtimeVersion() {
  if (globalThis.Deno?.version) {
    return `${globalThis.Deno.version.deno} (v8 ${globalThis.Deno.version.v8})`;
  }
  if (globalThis.Bun?.version) {
    return globalThis.Bun.version;
  }
  return globalThis.process?.versions?.node ?? 'unknown';
}

async function readTextFile(filePath) {
  if (globalThis.Deno?.readTextFile) {
    return await globalThis.Deno.readTextFile(filePath);
  }
  if (globalThis.Bun?.file) {
    return await globalThis.Bun.file(filePath).text();
  }
  const { readFileSync } = await import('node:fs');
  return readFileSync(filePath, 'utf8');
}

function memoryUsage() {
  if (globalThis.process?.memoryUsage) {
    const usage = globalThis.process.memoryUsage();
    return {
      rssBytes: usage.rss,
      heapUsedBytes: usage.heapUsed,
    };
  }
  if (globalThis.Deno?.memoryUsage) {
    const usage = globalThis.Deno.memoryUsage();
    return {
      rssBytes: usage.rss,
      heapUsedBytes: usage.heapUsed,
    };
  }
  return {
    rssBytes: null,
    heapUsedBytes: null,
  };
}

function gcNow() {
  if (globalThis.gc) {
    globalThis.gc();
  }
  if (globalThis.Bun?.gc) {
    globalThis.Bun.gc(true);
  }
}

function hasExplicitGc() {
  return typeof globalThis.gc === 'function' || typeof globalThis.Bun?.gc === 'function';
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

function consumeEventReaderFull(xml) {
  let eventCount = 0;
  let checksum = 0;

  for (const event of new EventReaderSync(xml)) {
    eventCount++;
    checksum = foldString(checksum, event.type);

    if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
      checksum = foldString(checksum, event.name);
      checksum = foldString(checksum, event.localName);
      checksum = foldString(checksum, event.prefix);
      checksum = foldString(checksum, event.namespaceURI);
    }
    if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA
      || event.type === XmlEventType.COMMENT || event.type === XmlEventType.DTD) {
      checksum = foldString(checksum, event.value?.trim());
    }
    if (event.type === XmlEventType.PROCESSING_INSTRUCTION) {
      checksum = foldString(checksum, event.target);
      checksum = foldString(checksum, event.data);
    }
    if (event.type === XmlEventType.START_ELEMENT) {
      checksum = mixChecksum(checksum, event.attributes.length);
      for (const attribute of event.attributes) {
        checksum = foldString(checksum, attribute.name);
        checksum = foldString(checksum, attribute.localName);
        checksum = foldString(checksum, attribute.prefix);
        checksum = foldString(checksum, attribute.namespaceURI);
        checksum = foldString(checksum, attribute.value);
      }
    }
  }

  return { eventCount, checksum };
}

function consumeStreamReader(bytes, tier) {
  let eventCount = 0;
  let checksum = 0;
  const reader = new StreamReaderSync(bytes);

  while (reader.next() !== null) {
    const type = reader.eventType();
    eventCount++;
    checksum = foldString(checksum, type);

    if (tier === 'type-only') {
      continue;
    }

    if (type === XmlEventType.START_ELEMENT || type === XmlEventType.END_ELEMENT) {
      checksum = foldString(checksum, reader.name());
    }
    if (type === XmlEventType.CHARACTERS || type === XmlEventType.CDATA
      || type === XmlEventType.COMMENT || type === XmlEventType.DTD) {
      checksum = foldString(checksum, reader.text()?.trim());
    }
    if (type === XmlEventType.PROCESSING_INSTRUCTION) {
      checksum = foldString(checksum, reader.name());
      checksum = foldString(checksum, reader.text());
    }
    if (tier === 'full' && (type === XmlEventType.START_ELEMENT || type === XmlEventType.END_ELEMENT)) {
      checksum = foldString(checksum, reader.localName());
      checksum = foldString(checksum, reader.prefix());
      checksum = foldString(checksum, reader.namespaceURI());
    }
    if (tier === 'full' && type === XmlEventType.START_ELEMENT) {
      const attrCount = reader.attributeCount();
      checksum = mixChecksum(checksum, attrCount);
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        checksum = foldString(checksum, reader.attributeName(attrIndex));
        checksum = foldString(checksum, reader.attributeLocalName(attrIndex));
        checksum = foldString(checksum, reader.attributePrefix(attrIndex));
        checksum = foldString(checksum, reader.attributeNamespaceURI(attrIndex));
        checksum = foldString(checksum, reader.attributeValue(attrIndex));
      }
    }
  }

  return { eventCount, checksum };
}

function measure(id, run, fileSizeMiB, options) {
  for (let index = 0; index < options.warmups; index++) {
    run();
  }

  const samplesMs = [];
  let eventCount = 0;
  let checksum = 0;
  let peakRssBytes = 0;
  let peakHeapUsedBytes = 0;

  for (let index = 0; index < options.runs; index++) {
    gcNow();
    const startedAt = performance.now();
    const result = run();
    const elapsedMs = performance.now() - startedAt;
    const memory = memoryUsage();

    if (index > 0 && (eventCount !== result.eventCount || checksum !== result.checksum)) {
      throw new Error(`${id} produced unstable event count or checksum.`);
    }

    eventCount = result.eventCount;
    checksum = result.checksum;
    peakRssBytes = Math.max(peakRssBytes, memory.rssBytes ?? 0);
    peakHeapUsedBytes = Math.max(peakHeapUsedBytes, memory.heapUsedBytes ?? 0);
    samplesMs.push(elapsedMs);
  }

  const avgMs = samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length;
  return {
    id,
    status: 'ok',
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: fileSizeMiB / (avgMs / 1000),
    eventCount,
    checksum,
    peakRssBytes: peakRssBytes || null,
    peakHeapUsedBytes: peakHeapUsedBytes || null,
    samplesMs,
  };
}

function measureRetention(id, run, runs) {
  const heapValues = new Array(runs).fill(0);
  run();
  gcNow();
  const baselineHeapUsedBytes = memoryUsage().heapUsedBytes;
  if (baselineHeapUsedBytes === null) {
    throw new Error(`${id} cannot sample retained heap on this runtime.`);
  }

  let eventCount = 0;
  let checksum = 0;
  for (let index = 0; index < runs; index++) {
    const result = run();
    if (index > 0 && (result.eventCount !== eventCount || result.checksum !== checksum)) {
      throw new Error(`${id} retention run produced unstable event count or checksum.`);
    }
    eventCount = result.eventCount;
    checksum = result.checksum;
    gcNow();
    const heapUsedBytes = memoryUsage().heapUsedBytes;
    if (heapUsedBytes === null) {
      throw new Error(`${id} lost retained-heap sampling support.`);
    }
    heapValues[index] = heapUsedBytes;
  }

  return {
    id,
    eventCount,
    checksum,
    baselineHeapUsedBytes,
    minHeapUsedBytes: Math.min(...heapValues),
    maxHeapUsedBytes: Math.max(...heapValues),
    heapUsedRangeBytes: Math.max(...heapValues) - Math.min(...heapValues),
    leastSquaresSlopeBytesPerRun: leastSquaresSlope(heapValues),
    samples: heapValues.map((heapUsedBytes, index) => ({
      run: index + 1,
      heapUsedBytes,
      retainedDeltaBytes: heapUsedBytes - baselineHeapUsedBytes,
    })),
  };
}

function leastSquaresSlope(values) {
  const count = values.length;
  const meanX = (count + 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / count;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < count; index++) {
    const xDelta = index + 1 - meanX;
    numerator += xDelta * (values[index] - meanY);
    denominator += xDelta * xDelta;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

function collectRetentionEvidence(xml, bytes, runs) {
  if (runs === 0) {
    return { status: 'disabled', requestedRuns: 0, evidenceOnly: true, scenarios: [] };
  }
  if (!hasExplicitGc()) {
    return {
      status: 'unavailable',
      requestedRuns: runs,
      evidenceOnly: true,
      reason: 'Explicit GC is unavailable; run Node with --expose-gc or use a runtime GC hook.',
      scenarios: [],
    };
  }
  if (memoryUsage().heapUsedBytes === null) {
    return {
      status: 'unavailable',
      requestedRuns: runs,
      evidenceOnly: true,
      reason: 'Heap usage sampling is unavailable on this runtime.',
      scenarios: [],
    };
  }

  const scenarios = [
    measureRetention('stream-sync-full', () => consumeStreamReader(bytes, 'full'), runs),
    measureRetention('event-sync-full', () => consumeEventReaderFull(xml), runs),
  ];
  const [streamFull, eventFull] = scenarios;
  if (streamFull.eventCount !== eventFull.eventCount || streamFull.checksum !== eventFull.checksum) {
    throw new Error('Retention scenarios must preserve full StreamReaderSync/EventReaderSync parity.');
  }
  return { status: 'ok', requestedRuns: runs, evidenceOnly: true, scenarios };
}

async function main() {
  const options = parseArgs();
  const xml = await readTextFile(options.file);
  const bytes = new TextEncoder().encode(xml);
  const fileSizeMiB = bytes.byteLength / 1024 / 1024;

  const scenarios = [
    measure('stream-sync-type-only', () => consumeStreamReader(bytes, 'type-only'), fileSizeMiB, options),
    measure('stream-sync-name-text', () => consumeStreamReader(bytes, 'name-text'), fileSizeMiB, options),
    measure('stream-sync-full', () => consumeStreamReader(bytes, 'full'), fileSizeMiB, options),
    measure('event-sync-full', () => consumeEventReaderFull(xml), fileSizeMiB, options),
  ];
  const [typeOnly, , streamFull, eventFull] = scenarios;
  if (scenarios.some((scenario) => scenario.eventCount !== typeOnly.eventCount)) {
    throw new Error('All runtime accessor tiers must produce identical event counts.');
  }
  if (streamFull.checksum !== eventFull.checksum) {
    throw new Error('Full StreamReaderSync and EventReaderSync scenarios must produce identical checksums.');
  }
  const retention = collectRetentionEvidence(xml, bytes, options.retentionRuns);

  const report = {
    runtime: {
      id: options.runtimeId,
      version: runtimeVersion(),
    },
    file: {
      path: options.file,
      sizeBytes: bytes.byteLength,
      sizeMiB: fileSizeMiB,
    },
    options: {
      runs: options.runs,
      warmups: options.warmups,
      retentionRuns: options.retentionRuns,
    },
    scenarios,
    retention,
  };

  console.log(JSON.stringify(report));
}

void main();
