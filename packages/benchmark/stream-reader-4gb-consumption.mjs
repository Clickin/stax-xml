import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { StreamEventType, StreamReaderSync } from 'stax-xml';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageVersion = JSON.parse(
  readFileSync(resolve(__dirname, '../stax-xml/package.json'), 'utf8'),
).version;

const sizeGiB = Number.parseFloat(readOption('--size-gib') ?? '4');
const runs = Number.parseInt(readOption('--runs') ?? '3', 10);
const warmups = Number.parseInt(readOption('--warmups') ?? '0', 10);
const style = readOption('--style') ?? 'index-for';
const jsonOut = readOption('--json-out');
const mdOut = readOption('--md-out');
const targetBytes = Math.floor(sizeGiB * GIB);

const styleIds = ['index-for', 'while-index', 'raw-frame-direct', 'raw-frame-name-id'];
const styleGroups = new Map([
  ['both', ['index-for', 'while-index']],
  ['shapes', ['index-for', 'raw-frame-direct', 'raw-frame-name-id']],
  ['all', styleIds],
]);
const styles = styleGroups.get(style) ?? [style];

for (const candidate of styles) {
  if (!styleIds.includes(candidate)) {
    throw new Error(`Unknown style: ${candidate}`);
  }
}

const row = new TextEncoder().encode(
  '<person id="123"><name>Jane Doe</name><age>42</age></person>',
);
const batchSize = 16;
const expectedBytes = Math.ceil(targetBytes / row.byteLength) * row.byteLength;

const results = [];

console.log('StreamReaderSync large shape consumption checksum');
console.log(`target=${formatBytes(expectedBytes)}, rowBytes=${row.byteLength}, warmups=${warmups}, runs=${runs}, style=${style}`);

for (const candidate of styles) {
  const measured = measure(candidate);
  results.push({ style: candidate, ...measured });
  console.log(`${candidate.padEnd(18)} avg=${measured.avgMs.toFixed(2)} ms throughput=${measured.avgMiBs.toFixed(2)} MiB/s min=${measured.minMs.toFixed(2)} ms max=${measured.maxMs.toFixed(2)} ms events=${measured.events} checksum=${measured.checksum} rssDelta=${formatSignedBytes(measured.memory.avgRssDeltaBytes)} strings=${measured.materialization.stringFieldReads}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  objective: 'stream-reader-large-shape',
  contract: 'generated-byte-batch-full-string',
  packageVersion,
  runtime: {
    id: 'node',
    version: process.versions.node,
    v8: process.versions.v8,
    platform: `${process.platform}-${process.arch}`,
  },
  fixture: {
    generated: true,
    rowXml: new TextDecoder().decode(row),
    rowBytes: row.byteLength,
    targetBytes,
    actualBytes: expectedBytes,
    sizeGiB: expectedBytes / GIB,
  },
  options: {
    warmups,
    runs,
    style,
  },
  parity: computeParity(results),
  results,
};

if (jsonOut) {
  writeOutput(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
}
if (mdOut) {
  writeOutput(mdOut, renderMarkdown(report));
}

function measure(candidate) {
  for (let index = 0; index < warmups; index++) {
    consume(candidate);
  }

  const times = [];
  const memorySamples = [];
  let last;
  for (let index = 0; index < runs; index++) {
    globalThis.gc?.();
    const before = takeMemorySnapshot();
    const start = performance.now();
    last = consume(candidate);
    const elapsed = performance.now() - start;
    const after = takeMemorySnapshot();
    times.push(elapsed);
    memorySamples.push(createMemorySample(before, after));
  }

  const avgMs = average(times);
  return {
    ...last,
    avgMs,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    avgMiBs: (expectedBytes / MIB) / (avgMs / 1000),
    memory: summarizeMemorySamples(memorySamples),
  };
}

function consume(candidate) {
  switch (candidate) {
    case 'index-for':
      return consumeIndexFor();
    case 'while-index':
      return consumeWhileIndex();
    case 'raw-frame-direct':
      return consumeRawFrameDirect();
    case 'raw-frame-name-id':
      return consumeRawFrameNameId();
    default:
      throw new Error(`Unknown style: ${candidate}`);
  }
}

function takeMemorySnapshot() {
  const usage = process.memoryUsage();
  return {
    rssBytes: usage.rss,
    heapUsedBytes: usage.heapUsed,
    heapTotalBytes: usage.heapTotal,
    externalBytes: usage.external,
    arrayBuffersBytes: usage.arrayBuffers,
  };
}

function createMemorySample(before, after) {
  return {
    before,
    after,
    delta: {
      rssBytes: after.rssBytes - before.rssBytes,
      heapUsedBytes: after.heapUsedBytes - before.heapUsedBytes,
      heapTotalBytes: after.heapTotalBytes - before.heapTotalBytes,
      externalBytes: after.externalBytes - before.externalBytes,
      arrayBuffersBytes: after.arrayBuffersBytes - before.arrayBuffersBytes,
    },
  };
}

function summarizeMemorySamples(samples) {
  return {
    avgRssDeltaBytes: average(samples.map((sample) => sample.delta.rssBytes)),
    avgHeapUsedDeltaBytes: average(samples.map((sample) => sample.delta.heapUsedBytes)),
    avgHeapTotalDeltaBytes: average(samples.map((sample) => sample.delta.heapTotalBytes)),
    avgExternalDeltaBytes: average(samples.map((sample) => sample.delta.externalBytes)),
    avgArrayBuffersDeltaBytes: average(samples.map((sample) => sample.delta.arrayBuffersBytes)),
    maxRssBytes: Math.max(...samples.map((sample) => sample.after.rssBytes)),
    maxHeapUsedBytes: Math.max(...samples.map((sample) => sample.after.heapUsedBytes)),
    samples,
  };
}

function consumeIndexFor() {
  const parser = new StreamReaderSync(byteBatches());
  const materialization = createMaterializationStats();
  let events = 0;
  let checksum = 0;

  for (const batch of parser) {
    const eventCount = batch.eventCount;
    for (let index = 0; index < eventCount; index++) {
      const type = batch.typeAt(index);
      events++;
      checksum = mix(checksum, type);
      checksum = foldEvent(batch, index, type, checksum, materialization);
    }
  }

  return { events, checksum, materialization };
}

function consumeWhileIndex() {
  const parser = new StreamReaderSync(byteBatches());
  const materialization = createMaterializationStats();
  let events = 0;
  let checksum = 0;
  let batch;

  while ((batch = parser.nextBatch()) !== null) {
    let index = 0;
    const eventCount = batch.eventCount;
    while (index < eventCount) {
      const type = batch.typeAt(index);
      events++;
      checksum = mix(checksum, type);
      checksum = foldEvent(batch, index, type, checksum, materialization);
      index++;
    }
  }

  return { events, checksum, materialization };
}

function foldEvent(batch, index, type, checksum, materialization) {
  if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
    countStringField(materialization, 'name');
    checksum = foldString(checksum, batch.nameAt(index));
  }
  if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
    countStringField(materialization, 'text');
    checksum = foldString(checksum, batch.textAt(index)?.trim());
  }
  if (type === StreamEventType.START_ELEMENT) {
    const attrCount = batch.attributeCountAt(index);
    checksum = mix(checksum, attrCount);
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      countStringField(materialization, 'attrName');
      checksum = foldString(checksum, batch.attributeNameAt(index, attrIndex));
      countStringField(materialization, 'attrValue');
      checksum = foldString(checksum, batch.attributeValueAt(index, attrIndex));
    }
  }
  return checksum;
}

function consumeRawFrameDirect() {
  return consumeRawFrameStyle(undefined);
}

function consumeRawFrameNameId() {
  return consumeRawFrameStyle([]);
}

function consumeRawFrameStyle(nameCache) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const parser = new StreamReaderSync(byteBatches());
  const materialization = createMaterializationStats();
  let events = 0;
  let checksum = 0;
  let frame;

  while ((frame = parser.nextRawBatch()) !== null) {
    const result = consumeRawFrame(frame, checksum, events, decoder, nameCache, materialization);
    checksum = result.checksum;
    events = result.events;
  }

  return { events, checksum, materialization };
}

function consumeRawFrame(frame, checksum, events, decoder, nameCache, materialization) {
  if (frame.kind !== 'frame') {
    throw new Error(`Unsupported raw batch kind in large shape benchmark: ${frame.kind}`);
  }

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
  const buffer = frame.buffer;
  const count = frame.eventCount;

  for (let index = 0; index < count; index++) {
    const type = eventTypes[index];
    events++;
    checksum = mix(checksum, type);

    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      countStringField(materialization, 'name');
      checksum = foldString(
        checksum,
        materializeName(buffer, nameStarts[index], nameEnds[index], nameIds[index], decoder, nameCache, materialization, 'name'),
      );
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      const start = textStarts[index];
      if (start >= 0) {
        countStringField(materialization, 'text');
        checksum = foldString(checksum, decodeSpan(buffer, start, textEnds[index], decoder, materialization, 'text').trim());
      }
    }
    if (type === StreamEventType.START_ELEMENT) {
      const attrStart = attrStarts[index];
      const attrCount = attrCounts[index];
      checksum = mix(checksum, attrCount);
      const attrEnd = attrStart + attrCount;
      for (let attrIndex = attrStart; attrIndex < attrEnd; attrIndex++) {
        countStringField(materialization, 'attrName');
        checksum = foldString(
          checksum,
          materializeName(
            buffer,
            attrNameStarts[attrIndex],
            attrNameEnds[attrIndex],
            attrNameIds[attrIndex],
            decoder,
            nameCache,
            materialization,
            'attrName',
          ),
        );
        countStringField(materialization, 'attrValue');
        const value = isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, attrIndex)
          ? countImplicitAttributeValue(materialization)
          : decodeSpan(buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex], decoder, materialization, 'attrValue');
        checksum = foldString(checksum, value);
      }
    }
  }

  return { events, checksum };
}

function materializeName(buffer, start, end, nameId, decoder, nameCache, materialization, kind) {
  if (nameId < 0 || start < 0) {
    return undefined;
  }
  if (nameCache) {
    const cached = nameCache[nameId];
    if (cached !== undefined) {
      materialization.rawNameCacheHits++;
      return cached;
    }
    materialization.rawNameCacheMisses++;
    const value = decodeSpan(buffer, start, end, decoder, materialization, kind);
    nameCache[nameId] = value;
    return value;
  }
  return decodeSpan(buffer, start, end, decoder, materialization, kind);
}

function decodeSpan(buffer, start, end, decoder, materialization, kind) {
  countRawSpanMaterialization(materialization, kind);
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

function isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, index) {
  return attrNameStarts[index] === attrValueStarts[index] && attrNameEnds[index] === attrValueEnds[index];
}

function createMaterializationStats() {
  return {
    stringFieldReads: 0,
    nameStringReads: 0,
    textStringReads: 0,
    attrNameStringReads: 0,
    attrValueStringReads: 0,
    rawSpanMaterializations: 0,
    rawNameSpanMaterializations: 0,
    rawTextSpanMaterializations: 0,
    rawAttrNameSpanMaterializations: 0,
    rawAttrValueSpanMaterializations: 0,
    rawNameCacheHits: 0,
    rawNameCacheMisses: 0,
    implicitAttrValueReads: 0,
    eventObjects: 0,
  };
}

function countStringField(stats, kind) {
  stats.stringFieldReads++;
  switch (kind) {
    case 'name':
      stats.nameStringReads++;
      break;
    case 'text':
      stats.textStringReads++;
      break;
    case 'attrName':
      stats.attrNameStringReads++;
      break;
    case 'attrValue':
      stats.attrValueStringReads++;
      break;
    default:
      throw new Error(`Unknown string field kind: ${kind}`);
  }
}

function countRawSpanMaterialization(stats, kind) {
  stats.rawSpanMaterializations++;
  switch (kind) {
    case 'name':
      stats.rawNameSpanMaterializations++;
      break;
    case 'text':
      stats.rawTextSpanMaterializations++;
      break;
    case 'attrName':
      stats.rawAttrNameSpanMaterializations++;
      break;
    case 'attrValue':
      stats.rawAttrValueSpanMaterializations++;
      break;
    default:
      throw new Error(`Unknown raw span kind: ${kind}`);
  }
}

function countImplicitAttributeValue(stats) {
  stats.implicitAttrValueReads++;
  return 'true';
}

function* byteBatches() {
  let emittedBytes = 0;
  while (emittedBytes < targetBytes) {
    const batch = [];
    for (let index = 0; index < batchSize && emittedBytes < targetBytes; index++) {
      batch.push(row);
      emittedBytes += row.byteLength;
    }
    yield batch;
  }
}

function readOption(name) {
  const prefix = `${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function computeParity(entries) {
  const first = entries[0];
  const mismatch = entries.find((entry) => entry.events !== first.events || entry.checksum !== first.checksum);
  if (mismatch) {
    throw new Error(`Style ${mismatch.style} does not match ${first.style}.`);
  }
  return {
    status: 'ok',
    events: first.events,
    checksum: first.checksum,
  };
}

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
  console.log(`Wrote ${resolved}`);
}

function renderMarkdown(report) {
  const lines = [
    '# StreamReaderSync Large Shape Benchmark',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This benchmark uses `StreamReaderSync` over generated `Uint8Array` batches and consumes each row without loading a complete XML document string.',
    'It measures the public pure JavaScript stream reader path and does not use native addons, Wasm modules, or backend selection.',
    'Raw-frame rows keep the same full-string checksum contract while separating index-accessor and numeric name-id cache overhead.',
    '',
    '## Environment',
    '',
    `- Package: stax-xml ${report.packageVersion}`,
    `- Runtime: Node ${report.runtime.version} / V8 ${report.runtime.v8} (${report.runtime.platform})`,
    `- Fixture: generated repeated person rows, ${formatBytes(report.fixture.actualBytes)}`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    '',
    '## Results',
    '',
    '| Style | Throughput | Average | Min | Max | Events | Checksum | String fields | Raw span materializations |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const result of report.results) {
    lines.push(
      `| ${result.style} | ${result.avgMiBs.toFixed(2)} MiB/s | ${result.avgMs.toFixed(2)} ms | ` +
      `${result.minMs.toFixed(2)} ms | ${result.maxMs.toFixed(2)} ms | ${result.events} | ${result.checksum} | ` +
      `${formatCount(result.materialization.stringFieldReads)} | ${formatCount(result.materialization.rawSpanMaterializations)} |`,
    );
  }

  lines.push('');
  lines.push('## Memory');
  lines.push('');
  lines.push('Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.');
  lines.push('');
  lines.push('| Style | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const result of report.results) {
    lines.push(
      `| ${result.style} | ${formatSignedBytes(result.memory.avgHeapUsedDeltaBytes)} | ` +
      `${formatSignedBytes(result.memory.avgRssDeltaBytes)} | ${formatBytes(result.memory.maxHeapUsedBytes)} | ` +
      `${formatBytes(result.memory.maxRssBytes)} |`,
    );
  }

  lines.push('');
  lines.push('## Materialization Counters');
  lines.push('');
  lines.push('String fields are the names, text values, attribute names, and attribute values consumed by the checksum contract. Raw span materializations are string creations performed by the raw-frame benchmark code rather than by public accessors.');
  lines.push('');
  lines.push('| Style | Names | Text | Attr names | Attr values | Raw name spans | Raw text spans | Raw attr-name spans | Raw attr-value spans | Name cache hit/miss | Implicit attr values | Event objects |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const result of report.results) {
    const stats = result.materialization;
    lines.push(
      `| ${result.style} | ${formatCount(stats.nameStringReads)} | ${formatCount(stats.textStringReads)} | ` +
      `${formatCount(stats.attrNameStringReads)} | ${formatCount(stats.attrValueStringReads)} | ` +
      `${formatCount(stats.rawNameSpanMaterializations)} | ${formatCount(stats.rawTextSpanMaterializations)} | ` +
      `${formatCount(stats.rawAttrNameSpanMaterializations)} | ${formatCount(stats.rawAttrValueSpanMaterializations)} | ` +
      `${formatCount(stats.rawNameCacheHits)}/${formatCount(stats.rawNameCacheMisses)} | ` +
      `${formatCount(stats.implicitAttrValueReads)} | ${formatCount(stats.eventObjects)} |`,
    );
  }

  lines.push('');
  lines.push('## Parity');
  lines.push('');
  lines.push(`Status: ${report.parity.status}`);
  lines.push(`Events: ${report.parity.events}`);
  lines.push(`Checksum: ${report.parity.checksum}`);
  lines.push('');
  return lines.join('\n');
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatBytes(bytes) {
  const absBytes = Math.abs(bytes);
  const mib = absBytes / MIB;
  const value = mib >= 1024 ? `${(absBytes / GIB).toFixed(2)} GiB` : `${mib.toFixed(1)} MiB`;
  return bytes < 0 ? `-${value}` : value;
}

function formatSignedBytes(bytes) {
  if (bytes === 0) return formatBytes(bytes);
  return `${bytes > 0 ? '+' : ''}${formatBytes(bytes)}`;
}

function formatCount(value) {
  return String(value);
}

function mix(seed, value) {
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
