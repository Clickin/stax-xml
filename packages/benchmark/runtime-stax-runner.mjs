import {
  StaxXmlParserSync,
  XmlEventType,
} from '../stax-xml/dist/index.js';
import {
  IterableEventType,
  StaxXmlIterableParser,
  toByteBatches,
} from '../stax-xml/dist/iterable.js';

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

function publicEventTypeCode(type) {
  switch (type) {
    case XmlEventType.START_DOCUMENT:
      return 0;
    case XmlEventType.END_DOCUMENT:
      return 1;
    case XmlEventType.START_ELEMENT:
      return 2;
    case XmlEventType.END_ELEMENT:
      return 3;
    case XmlEventType.CHARACTERS:
      return 4;
    case XmlEventType.CDATA:
      return 5;
    default:
      return 6;
  }
}

function consumePublicSync(xml) {
  let eventCount = 0;
  let checksum = 0;

  for (const event of new StaxXmlParserSync(xml)) {
    const typeCode = publicEventTypeCode(event.type);
    eventCount++;
    checksum = mixChecksum(checksum, typeCode);

    if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
      checksum = foldString(checksum, event.name);
    }
    if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
      checksum = foldString(checksum, event.value?.trim());
    }
    if (event.type === XmlEventType.START_ELEMENT) {
      const entries = Object.entries(event.attributes);
      checksum = mixChecksum(checksum, entries.length);
      for (const [name, value] of entries) {
        checksum = foldString(checksum, name);
        checksum = foldString(checksum, value);
      }
    }
  }

  return { eventCount, checksum };
}

function consumeIterable(bytes, tier) {
  const parser = new StaxXmlIterableParser(toByteBatches([bytes], { batchSize: 1 }));
  let eventCount = 0;
  let checksum = 0;

  while (parser.nextBatch()) {
    for (let index = 0; index < parser.eventCount(); index++) {
      const type = parser.eventType(index);
      const attrCount = parser.attrCount(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (tier === 'count-only') {
        checksum = mixChecksum(checksum, attrCount);
        continue;
      }

      if (type === IterableEventType.START_ELEMENT || type === IterableEventType.END_ELEMENT) {
        checksum = foldString(checksum, parser.copyName(index));
      }
      if (type === IterableEventType.CHARACTERS || type === IterableEventType.CDATA) {
        checksum = foldString(checksum, parser.copyText(index)?.trim());
      }
      checksum = mixChecksum(checksum, attrCount);
      for (let attr = 0; attr < attrCount; attr++) {
        checksum = foldString(checksum, parser.copyAttrName(index, attr));
        checksum = foldString(checksum, parser.copyAttrValue(index, attr));
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

async function main() {
  const options = parseArgs();
  const xml = await readTextFile(options.file);
  const bytes = new TextEncoder().encode(xml);
  const fileSizeMiB = bytes.byteLength / 1024 / 1024;

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
    },
    scenarios: [
      measure('public-sync-full-string', () => consumePublicSync(xml), fileSizeMiB, options),
      measure('iterable-count-only', () => consumeIterable(bytes, 'count-only'), fileSizeMiB, options),
      measure('iterable-full-string', () => consumeIterable(bytes, 'full-string'), fileSizeMiB, options),
    ],
  };

  console.log(JSON.stringify(report));
}

void main();
