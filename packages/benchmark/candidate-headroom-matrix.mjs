import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventReaderSync, StreamEventType, StreamReaderSync, XmlEventType } from 'stax-xml';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultFile = join(__dirname, 'test-data', 'runtime-comparison-16mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'candidate-headroom-matrix.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'candidate-headroom-matrix.md');
const externalBaselinePath = join(__dirname, 'results', 'release', 'external-baseline.json');
const textEncoder = new TextEncoder();
const fixtureDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
const allStringFields = Object.freeze({
  name: true,
  text: true,
  attrName: true,
  attrValue: true,
});

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    runs: 3,
    warmups: 1,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    selfTest: false,
    fileExplicit: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    if (arg === '--self-test') {
      options.selfTest = true;
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
      case '--file':
        options.file = resolve(process.cwd(), readValue());
        options.fileExplicit = true;
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), '--runs');
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), '--warmups');
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

function main() {
  const options = parseArgs();
  const fixture = loadFixture(options);
  const variants = createVariants(fixture);
  const results = variants.map((variant) => measureVariant(variant, fixture, options));
  const report = createReport(fixture, options, results);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function createVariants(fixture) {
  return [
    {
      id: 'scanAllNoDecode',
      family: 'partial-upper-bound',
      implementation: 'StreamBatch index accessors',
      contractScope: 'event-types-and-attribute-counts-only',
      fullStringParity: false,
      runtimeLimitCounterexampleEligible: false,
      run: () => consumeStreamSelective(fixture.bytes, { name: false, text: false, attrName: false, attrValue: false }),
      count: () => consumeStreamSelective(fixture.bytes, { name: false, text: false, attrName: false, attrValue: false }, createMaterializationCounters()),
    },
    {
      id: 'nameStringOnly',
      family: 'partial-upper-bound',
      implementation: 'StreamBatch index accessors',
      contractScope: 'event-types-attribute-counts-and-element-names',
      fullStringParity: false,
      runtimeLimitCounterexampleEligible: false,
      run: () => consumeStreamSelective(fixture.bytes, { name: true, text: false, attrName: false, attrValue: false }),
      count: () => consumeStreamSelective(fixture.bytes, { name: true, text: false, attrName: false, attrValue: false }, createMaterializationCounters()),
    },
    {
      id: 'textStringOnly',
      family: 'partial-upper-bound',
      implementation: 'StreamBatch index accessors',
      contractScope: 'event-types-attribute-counts-and-text-cdata',
      fullStringParity: false,
      runtimeLimitCounterexampleEligible: false,
      run: () => consumeStreamSelective(fixture.bytes, { name: false, text: true, attrName: false, attrValue: false }),
      count: () => consumeStreamSelective(fixture.bytes, { name: false, text: true, attrName: false, attrValue: false }, createMaterializationCounters()),
    },
    {
      id: 'attrNameStringOnly',
      family: 'partial-upper-bound',
      implementation: 'StreamBatch index accessors',
      contractScope: 'event-types-attribute-counts-and-attribute-names',
      fullStringParity: false,
      runtimeLimitCounterexampleEligible: false,
      run: () => consumeStreamSelective(fixture.bytes, { name: false, text: false, attrName: true, attrValue: false }),
      count: () => consumeStreamSelective(fixture.bytes, { name: false, text: false, attrName: true, attrValue: false }, createMaterializationCounters()),
    },
    {
      id: 'attrValueStringOnly',
      family: 'partial-upper-bound',
      implementation: 'StreamBatch index accessors',
      contractScope: 'event-types-attribute-counts-and-attribute-values',
      fullStringParity: false,
      runtimeLimitCounterexampleEligible: false,
      run: () => consumeStreamSelective(fixture.bytes, { name: false, text: false, attrName: false, attrValue: true }),
      count: () => consumeStreamSelective(fixture.bytes, { name: false, text: false, attrName: false, attrValue: true }, createMaterializationCounters()),
    },
    {
      id: 'stringFull',
      family: 'full-stax-js',
      implementation: 'StreamBatch index accessors',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      runtimeLimitCounterexampleEligible: false,
      run: () => consumeStreamSelective(fixture.bytes, allStringFields),
      count: () => consumeStreamSelective(fixture.bytes, allStringFields, createMaterializationCounters()),
    },
    {
      id: 'cursorAccessor',
      family: 'full-stax-js',
      implementation: 'single mutable cursor over StreamBatch',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      runtimeLimitCounterexampleEligible: false,
      run: () => consumeCursorAccessor(fixture.bytes),
      count: () => consumeCursorAccessor(fixture.bytes, createMaterializationCounters()),
    },
    {
      id: 'eventObjectFull',
      family: 'full-stax-js',
      implementation: 'EventReaderSync public event objects',
      contractScope: 'full-string-materialization-from-string-input',
      fullStringParity: true,
      runtimeLimitCounterexampleEligible: false,
      run: () => consumeEventReaderObject(fixture.xml),
      count: () => consumeEventReaderObject(fixture.xml, createMaterializationCounters()),
    },
    {
      id: 'rawFrameDirect',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with direct span decode',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      runtimeLimitCounterexampleEligible: false,
      run: () => consumeRawFrameSelective(fixture.bytes, undefined),
      count: () => consumeRawFrameSelective(fixture.bytes, undefined, createMaterializationCounters()),
    },
    {
      id: 'rawFrameNameId',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      runtimeLimitCounterexampleEligible: false,
      run: () => consumeRawFrameSelective(fixture.bytes, []),
      count: () => consumeRawFrameSelective(fixture.bytes, [], createMaterializationCounters()),
    },
  ];
}

function loadFixture(options) {
  if (options.selfTest) {
    const xml = makeXml(32);
    const bytes = textEncoder.encode(xml);
    return {
      source: 'self-test-generated',
      xml,
      bytes,
      byteLength: bytes.byteLength,
      file: null,
    };
  }

  if (!existsSync(options.file) && !options.fileExplicit) {
    generateXmlFile(options.file, 16 * MIB);
  }
  if (!existsSync(options.file)) {
    throw new Error(`Benchmark fixture does not exist: ${options.file}`);
  }
  const bytes = readFileSync(options.file);
  return {
    source: 'file',
    xml: fixtureDecoder.decode(bytes),
    bytes,
    byteLength: statSync(options.file).size,
    file: options.file,
  };
}

function generateXmlFile(filePath, targetBytes) {
  mkdirSync(dirname(filePath), { recursive: true });
  const fd = openSync(filePath, 'w');
  const header = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<root>\n');
  const footer = Buffer.from('</root>\n');
  const pending = [];
  let pendingBytes = 0;
  let written = 0;
  let id = 0;

  try {
    writeSync(fd, header);
    written += header.byteLength;
    while (written + pendingBytes + footer.byteLength < targetBytes) {
      const element = Buffer.from(makeBookElement(id));
      if (written + pendingBytes + element.byteLength + footer.byteLength > targetBytes) {
        break;
      }
      pending.push(element);
      pendingBytes += element.byteLength;
      id++;
      if (pendingBytes >= MIB) {
        writeSync(fd, Buffer.concat(pending, pendingBytes));
        written += pendingBytes;
        pending.length = 0;
        pendingBytes = 0;
      }
    }
    if (pendingBytes > 0) {
      writeSync(fd, Buffer.concat(pending, pendingBytes));
    }
    writeSync(fd, footer);
  } finally {
    closeSync(fd);
  }
}

function makeXml(elements) {
  const parts = ['<?xml version="1.0" encoding="UTF-8"?>\n<root>\n'];
  for (let id = 0; id < elements; id++) {
    parts.push(makeBookElement(id));
  }
  parts.push('</root>\n');
  return parts.join('');
}

function makeBookElement(id) {
  return `  <book id="book-${id}" lang="en" code="${id % 97}">`
    + `<title>Runtime Benchmark ${id}</title>`
    + `<author>Author ${id % 4096}</author>`
    + `<description>Full string checksum text payload ${id} with stable words and numbers.</description>`
    + `<chapter number="1">Intro ${id}</chapter>`
    + `<chapter number="2">Body ${id}</chapter>`
    + '</book>\n';
}

function measureVariant(variant, fixture, options) {
  for (let index = 0; index < options.warmups; index++) {
    variant.run();
  }

  const samplesMs = [];
  const memorySamples = [];
  let first;
  for (let index = 0; index < options.runs; index++) {
    globalThis.gc?.();
    const memoryBefore = takeMemorySnapshot();
    const startedAt = performance.now();
    const result = variant.run();
    const elapsedMs = performance.now() - startedAt;
    const memoryAfter = takeMemorySnapshot();
    if (first && (result.eventCount !== first.eventCount || result.checksum !== first.checksum)) {
      throw new Error(`${variant.id} produced unstable event count or checksum.`);
    }
    first ??= result;
    samplesMs.push(elapsedMs);
    memorySamples.push(createMemorySample(memoryBefore, memoryAfter));
  }

  const counted = variant.count();
  if (counted.eventCount !== first.eventCount || counted.checksum !== first.checksum) {
    throw new Error(`${variant.id} materialization counters do not match measured event count or checksum.`);
  }

  const avgMs = average(samplesMs);
  return {
    id: variant.id,
    family: variant.family,
    implementation: variant.implementation,
    contractScope: variant.contractScope,
    fullStringParity: variant.fullStringParity,
    runtimeLimitCounterexampleEligible: variant.runtimeLimitCounterexampleEligible,
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: (fixture.byteLength / MIB) / (avgMs / 1000),
    eventCount: first.eventCount,
    checksum: first.checksum,
    samplesMs,
    memory: summarizeMemorySamples(memorySamples),
    materializationCounters: counted.materializationCounters,
  };
}

function takeMemorySnapshot() {
  const usage = process.memoryUsage();
  return {
    rssBytes: usage.rss,
    heapTotalBytes: usage.heapTotal,
    heapUsedBytes: usage.heapUsed,
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
      heapTotalBytes: after.heapTotalBytes - before.heapTotalBytes,
      heapUsedBytes: after.heapUsedBytes - before.heapUsedBytes,
      externalBytes: after.externalBytes - before.externalBytes,
      arrayBuffersBytes: after.arrayBuffersBytes - before.arrayBuffersBytes,
    },
  };
}

function summarizeMemorySamples(samples) {
  return {
    avgHeapUsedDeltaBytes: average(samples.map((sample) => sample.delta.heapUsedBytes)),
    avgHeapTotalDeltaBytes: average(samples.map((sample) => sample.delta.heapTotalBytes)),
    avgRssDeltaBytes: average(samples.map((sample) => sample.delta.rssBytes)),
    avgExternalDeltaBytes: average(samples.map((sample) => sample.delta.externalBytes)),
    avgArrayBuffersDeltaBytes: average(samples.map((sample) => sample.delta.arrayBuffersBytes)),
    maxHeapUsedBytes: Math.max(...samples.flatMap((sample) => [sample.before.heapUsedBytes, sample.after.heapUsedBytes])),
    maxHeapTotalBytes: Math.max(...samples.flatMap((sample) => [sample.before.heapTotalBytes, sample.after.heapTotalBytes])),
    maxRssBytes: Math.max(...samples.flatMap((sample) => [sample.before.rssBytes, sample.after.rssBytes])),
    samples,
  };
}

function createReport(fixture, options, variants) {
  const stringFull = variants.find((entry) => entry.id === 'stringFull');
  const woodstoxTarget = readWoodstoxTarget();
  return {
    generatedAt: new Date().toISOString(),
    objective: 'candidate-headroom-matrix',
    contract: 'mixed-materialization-headroom-matrix',
    note: 'Partial rows are upper-bound probes only. Only full-string rows keep the StAX-like checksum contract, and this 16 MiB run is not a 1 GiB runtime-limit counterexample gate.',
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
      v8: process.versions.v8,
    },
    fixture: {
      source: fixture.source,
      file: fixture.file,
      byteLength: fixture.byteLength,
      sizeMiB: fixture.byteLength / MIB,
    },
    options: {
      runs: options.runs,
      warmups: options.warmups,
    },
    woodstoxTarget,
    eventCountParity: computeEventCountParity(variants),
    fullStringParity: computeFullStringParity(variants),
    variants: variants.map((entry) => ({
      ...entry,
      relativeToStringFull: stringFull ? entry.mibPerSec / stringFull.mibPerSec : 1,
      woodstoxRatio: woodstoxTarget.woodstoxMiBPerSec
        ? entry.mibPerSec / woodstoxTarget.woodstoxMiBPerSec
        : null,
      targetStatus: entry.fullStringParity && woodstoxTarget.targetThroughputMiB
        ? entry.mibPerSec >= woodstoxTarget.targetThroughputMiB ? 'met' : 'below'
        : 'not-applicable',
    })),
    findings: createFindings(variants),
  };
}

function readWoodstoxTarget() {
  if (!existsSync(externalBaselinePath)) {
    return {
      status: 'missing',
      path: externalBaselinePath,
      baselineTool: 'woodstox',
      goalRatio: 0.9,
      targetThroughputMiB: null,
      woodstoxMiBPerSec: null,
    };
  }
  const report = JSON.parse(readFileSync(externalBaselinePath, 'utf8'));
  const woodstox = report.results?.find((entry) => entry.tool === 'woodstox');
  return {
    status: 'ok',
    path: externalBaselinePath,
    baselineTool: report.target?.baselineTool ?? 'woodstox',
    goalRatio: report.target?.goalRatio ?? 0.9,
    targetThroughputMiB: report.target?.targetThroughputMiB ?? null,
    woodstoxMiBPerSec: woodstox?.mibPerSec ?? null,
  };
}

function computeEventCountParity(variants) {
  const first = variants[0];
  const mismatch = variants.find((entry) => entry.eventCount !== first.eventCount);
  if (mismatch) {
    throw new Error(`Variant ${mismatch.id} does not match ${first.id} event count.`);
  }
  return {
    status: 'ok',
    eventCount: first.eventCount,
  };
}

function computeFullStringParity(variants) {
  const fullRows = variants.filter((entry) => entry.fullStringParity);
  const first = fullRows[0];
  const mismatch = fullRows.find((entry) => entry.eventCount !== first.eventCount || entry.checksum !== first.checksum);
  if (mismatch) {
    throw new Error(`Full-string variant ${mismatch.id} does not match ${first.id}.`);
  }
  return {
    status: 'ok',
    rowIds: fullRows.map((entry) => entry.id),
    eventCount: first.eventCount,
    checksum: first.checksum,
  };
}

function createFindings(variants) {
  const partialRows = variants.filter((entry) => !entry.fullStringParity);
  const fullRows = variants.filter((entry) => entry.fullStringParity);
  const fastestPartial = maxBy(partialRows, (entry) => entry.mibPerSec);
  const fastestFull = maxBy(fullRows, (entry) => entry.mibPerSec);
  return [
    {
      id: 'contract-separation',
      summary: 'Partial rows deliberately drop one or more string fields and are not StAX parity rows.',
      evidence: partialRows.map((entry) => `${entry.id}: ${entry.contractScope}, strings=${entry.materializationCounters.stringFieldReads}`),
    },
    {
      id: 'full-string-parity',
      summary: 'Full rows fold element names, text/CDATA, attribute names, and attribute values into the same checksum.',
      evidence: fullRows.map((entry) => `${entry.id}: events=${entry.eventCount}, checksum=${entry.checksum}`),
    },
    {
      id: 'headroom-search',
      summary: 'The fastest row in each family is a headroom signal, not a runtime-limit conclusion.',
      evidence: [
        fastestPartial ? `partial=${fastestPartial.id} ${formatRate(fastestPartial.mibPerSec)}` : 'partial=missing',
        fastestFull ? `full=${fastestFull.id} ${formatRate(fastestFull.mibPerSec)}` : 'full=missing',
      ],
    },
  ];
}

function consumeStreamSelective(bytes, fields, materializationCounters) {
  let eventCount = 0;
  let checksum = 0;

  for (const batch of new StreamReaderSync(bytes)) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const type = batch.typeAt(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (fields.name && (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT)) {
        materializationCounters && countStringField(materializationCounters, 'name');
        checksum = foldString(checksum, batch.nameAt(index));
      }
      if (fields.text && (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA)) {
        materializationCounters && countStringField(materializationCounters, 'text');
        checksum = foldString(checksum, batch.textAt(index)?.trim());
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrCount = batch.attributeCountAt(index);
        materializationCounters && (materializationCounters.attributePairs += attrCount);
        checksum = mixChecksum(checksum, attrCount);
        if (!fields.attrName && !fields.attrValue) {
          continue;
        }
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          if (fields.attrName) {
            materializationCounters && countStringField(materializationCounters, 'attrName');
            checksum = foldString(checksum, batch.attributeNameAt(index, attrIndex));
          }
          if (fields.attrValue) {
            materializationCounters && countStringField(materializationCounters, 'attrValue');
            checksum = foldString(checksum, batch.attributeValueAt(index, attrIndex));
          }
        }
      }
    }
  }

  return { eventCount, checksum, materializationCounters };
}

function consumeCursorAccessor(bytes, materializationCounters) {
  const cursor = new BatchCursor();
  let eventCount = 0;
  let checksum = 0;

  for (const batch of new StreamReaderSync(bytes)) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      cursor.set(batch, index);
      const type = cursor.type();
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        materializationCounters && countStringField(materializationCounters, 'name');
        checksum = foldString(checksum, cursor.name());
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        materializationCounters && countStringField(materializationCounters, 'text');
        checksum = foldString(checksum, cursor.text()?.trim());
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrCount = cursor.getAttributeCount();
        materializationCounters && (materializationCounters.attributePairs += attrCount);
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          materializationCounters && countStringField(materializationCounters, 'attrName');
          checksum = foldString(checksum, cursor.getAttributeName(attrIndex));
          materializationCounters && countStringField(materializationCounters, 'attrValue');
          checksum = foldString(checksum, cursor.getAttributeValue(attrIndex));
        }
      }
    }
  }

  return { eventCount, checksum, materializationCounters };
}

class BatchCursor {
  batch;
  index = 0;

  set(batch, index) {
    this.batch = batch;
    this.index = index;
  }

  type() {
    return this.batch.typeAt(this.index);
  }

  name() {
    return this.batch.nameAt(this.index);
  }

  text() {
    return this.batch.textAt(this.index);
  }

  getAttributeCount() {
    return this.batch.attributeCountAt(this.index);
  }

  getAttributeName(attrIndex) {
    return this.batch.attributeNameAt(this.index, attrIndex);
  }

  getAttributeValue(attrIndex) {
    return this.batch.attributeValueAt(this.index, attrIndex);
  }
}

function consumeEventReaderObject(xml, materializationCounters) {
  let eventCount = 0;
  let checksum = 0;

  for (const event of new EventReaderSync(xml)) {
    const typeCode = publicEventTypeCode(event.type);
    materializationCounters && materializationCounters.eventObjects++;
    eventCount++;
    checksum = mixChecksum(checksum, typeCode);

    if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
      materializationCounters && countStringField(materializationCounters, 'name');
      checksum = foldString(checksum, event.name);
    }
    if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
      materializationCounters && countStringField(materializationCounters, 'text');
      checksum = foldString(checksum, event.value?.trim());
    }
    if (event.type === XmlEventType.START_ELEMENT) {
      const entries = Object.entries(event.attributes);
      materializationCounters && (materializationCounters.attributePairs += entries.length);
      checksum = mixChecksum(checksum, entries.length);
      for (const [name, value] of entries) {
        materializationCounters && countStringField(materializationCounters, 'attrName');
        checksum = foldString(checksum, name);
        materializationCounters && countStringField(materializationCounters, 'attrValue');
        checksum = foldString(checksum, value);
      }
    }
  }

  return { eventCount, checksum, materializationCounters };
}

function consumeRawFrameSelective(bytes, nameCache, materializationCounters) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const reader = new StreamReaderSync(bytes);
  let eventCount = 0;
  let checksum = 0;
  let frame;

  while ((frame = reader.nextRawBatch()) !== null) {
    const result = consumeRawFrame(frame, checksum, eventCount, decoder, nameCache, materializationCounters);
    checksum = result.checksum;
    eventCount = result.eventCount;
  }

  return { eventCount, checksum, materializationCounters };
}

function consumeRawFrame(frame, checksum, eventCount, decoder, nameCache, materializationCounters) {
  if (frame.kind !== 'frame') {
    throw new Error(`Unsupported raw batch kind in candidate matrix: ${frame.kind}`);
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
    eventCount++;
    checksum = mixChecksum(checksum, type);

    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      materializationCounters && countStringField(materializationCounters, 'name');
      checksum = foldString(
        checksum,
        materializeName(buffer, nameStarts[index], nameEnds[index], nameIds[index], decoder, nameCache, materializationCounters, 'name'),
      );
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      const start = textStarts[index];
      materializationCounters && countStringField(materializationCounters, 'text');
      checksum = foldString(
        checksum,
        start < 0 ? undefined : decodeSpan(buffer, start, textEnds[index], decoder, materializationCounters, 'text').trim(),
      );
    }
    if (type === StreamEventType.START_ELEMENT) {
      const attrStart = attrStarts[index];
      const attrCount = attrCounts[index];
      materializationCounters && (materializationCounters.attributePairs += attrCount);
      checksum = mixChecksum(checksum, attrCount);
      const attrEnd = attrStart + attrCount;
      for (let attrIndex = attrStart; attrIndex < attrEnd; attrIndex++) {
        materializationCounters && countStringField(materializationCounters, 'attrName');
        checksum = foldString(
          checksum,
          materializeName(
            buffer,
            attrNameStarts[attrIndex],
            attrNameEnds[attrIndex],
            attrNameIds[attrIndex],
            decoder,
            nameCache,
            materializationCounters,
            'attrName',
          ),
        );
        materializationCounters && countStringField(materializationCounters, 'attrValue');
        const value = isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, attrIndex)
          ? countImplicitAttributeValue(materializationCounters)
          : decodeSpan(buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex], decoder, materializationCounters, 'attrValue');
        checksum = foldString(checksum, value);
      }
    }
  }

  return { eventCount, checksum };
}

function materializeName(buffer, start, end, nameId, decoder, nameCache, materializationCounters, kind) {
  if (nameId < 0 || start < 0) {
    return undefined;
  }
  if (nameCache) {
    const cached = nameCache[nameId];
    if (cached !== undefined) {
      materializationCounters && materializationCounters.rawNameCacheHits++;
      return cached;
    }
    materializationCounters && materializationCounters.rawNameCacheMisses++;
    const value = decodeSpan(buffer, start, end, decoder, materializationCounters, kind);
    nameCache[nameId] = value;
    return value;
  }
  return decodeSpan(buffer, start, end, decoder, materializationCounters, kind);
}

function decodeSpan(buffer, start, end, decoder, materializationCounters, kind) {
  materializationCounters && countRawSpanMaterialization(materializationCounters, kind);
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
    case 9: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8)
        : undefined;
    }
    case 10: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      const b9 = buffer[start + 9];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9)
        : undefined;
    }
    case 11: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      const b9 = buffer[start + 9];
      const b10 = buffer[start + 10];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10)
        : undefined;
    }
    case 12: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      const b9 = buffer[start + 9];
      const b10 = buffer[start + 10];
      const b11 = buffer[start + 11];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11)
        : undefined;
    }
    default:
      return undefined;
  }
}

function isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, index) {
  return attrNameStarts[index] === attrValueStarts[index] && attrNameEnds[index] === attrValueEnds[index];
}

function createMaterializationCounters() {
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
    attributePairs: 0,
  };
}

function countStringField(counters, kind) {
  counters.stringFieldReads++;
  switch (kind) {
    case 'name':
      counters.nameStringReads++;
      break;
    case 'text':
      counters.textStringReads++;
      break;
    case 'attrName':
      counters.attrNameStringReads++;
      break;
    case 'attrValue':
      counters.attrValueStringReads++;
      break;
    default:
      throw new Error(`Unknown string field kind: ${kind}`);
  }
}

function countRawSpanMaterialization(counters, kind) {
  counters.rawSpanMaterializations++;
  switch (kind) {
    case 'name':
      counters.rawNameSpanMaterializations++;
      break;
    case 'text':
      counters.rawTextSpanMaterializations++;
      break;
    case 'attrName':
      counters.rawAttrNameSpanMaterializations++;
      break;
    case 'attrValue':
      counters.rawAttrValueSpanMaterializations++;
      break;
    default:
      throw new Error(`Unknown raw span kind: ${kind}`);
  }
}

function countImplicitAttributeValue(counters) {
  counters && counters.implicitAttrValueReads++;
  return 'true';
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

function maxBy(values, selector) {
  let selected;
  for (const value of values) {
    if (!selected || selector(value) > selector(selected)) {
      selected = value;
    }
  }
  return selected;
}

function renderMarkdown(report) {
  const lines = [
    '# Candidate Headroom Matrix',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This experiment is a counterexample search scaffold, not a runtime-limit conclusion.',
    'Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.',
    'Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.',
    'The neutral path uses `Uint8Array` plus `TextDecoder`; it does not use native addons, Node `Buffer.toString()`, or lazy getters.',
    '',
    '## Fixture',
    '',
    `- Source: ${report.fixture.source}`,
    `- Size: ${formatBytes(report.fixture.byteLength)} (${report.fixture.byteLength} bytes)`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    `- Runtime: ${report.environment.node}, V8 ${report.environment.v8}`,
    '',
    '## Woodstox Target',
    '',
    ...renderWoodstoxTarget(report.woodstoxTarget),
    '',
    '## Results',
    '',
    '| Variant | Family | Contract scope | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Events | Checksum | Full parity |',
    '| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | --- |',
  ];
  for (const entry of report.variants) {
    lines.push(
      `| ${entry.id} | ${entry.family} | ${entry.contractScope} | ${formatRate(entry.mibPerSec)} | `
      + `${entry.relativeToStringFull.toFixed(2)}x | ${formatOptionalRatio(entry.woodstoxRatio)} | ${entry.targetStatus} | `
      + `${entry.eventCount} | ${entry.checksum} | ${entry.fullStringParity ? 'yes' : 'no'} |`,
    );
  }

  lines.push('');
  lines.push('## Memory');
  lines.push('');
  lines.push('Memory uses `process.memoryUsage()` before and after each measured run; max values are the maximum observed run endpoints.');
  lines.push('');
  lines.push('| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const entry of report.variants) {
    lines.push(
      `| ${entry.id} | ${formatSignedBytes(entry.memory.avgHeapUsedDeltaBytes)} | `
      + `${formatSignedBytes(entry.memory.avgRssDeltaBytes)} | `
      + `${formatBytes(entry.memory.maxHeapUsedBytes)} | ${formatBytes(entry.memory.maxRssBytes)} |`,
    );
  }

  lines.push('');
  lines.push('## Materialization Counters');
  lines.push('');
  lines.push('Counters are collected in a separate parity-checked pass after timed samples.');
  lines.push('');
  lines.push('| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Event objects | Attribute pairs |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const entry of report.variants) {
    const counters = entry.materializationCounters;
    lines.push(
      `| ${entry.id} | ${counters.stringFieldReads} | ${counters.nameStringReads} | ${counters.textStringReads} | `
      + `${counters.attrNameStringReads} | ${counters.attrValueStringReads} | ${counters.rawSpanMaterializations} | `
      + `${counters.rawNameCacheHits}/${counters.rawNameCacheMisses} | ${counters.eventObjects} | ${counters.attributePairs} |`,
    );
  }

  lines.push('');
  lines.push('## Parity');
  lines.push('');
  lines.push(`All rows event-count parity: ${report.eventCountParity.status}, events=${report.eventCountParity.eventCount}.`);
  lines.push(
    `Full-string parity rows: ${report.fullStringParity.status}, events=${report.fullStringParity.eventCount}, `
    + `checksum=${report.fullStringParity.checksum}, rows=${report.fullStringParity.rowIds.join(', ')}.`,
  );
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id}: ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function renderWoodstoxTarget(target) {
  if (target.status !== 'ok') {
    return [
      `- Status: ${target.status}`,
      `- External baseline path: ${target.path}`,
      '- Woodstox throughput: unavailable',
      '- 0.9x target: unavailable',
    ];
  }
  return [
    `- Baseline tool: ${target.baselineTool}`,
    `- Woodstox throughput: ${formatOptionalRate(target.woodstoxMiBPerSec)}`,
    `- Goal ratio: ${target.goalRatio.toFixed(2)}x`,
    `- 0.9x target throughput: ${formatOptionalRate(target.targetThroughputMiB)}`,
  ];
}

function printSummary(report) {
  console.log('Candidate headroom matrix');
  for (const entry of report.variants) {
    console.log(
      `${entry.id.padEnd(22)} ${formatRate(entry.mibPerSec).padStart(14)} `
      + `family=${entry.family} strings=${entry.materializationCounters.stringFieldReads} `
      + `heapDelta=${formatSignedBytes(entry.memory.avgHeapUsedDeltaBytes)} `
      + `rssDelta=${formatSignedBytes(entry.memory.avgRssDeltaBytes)} `
      + `events=${entry.eventCount} checksum=${entry.checksum}`,
    );
  }
}

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
  console.log(`Wrote ${resolved}`);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatRate(value) {
  return `${value.toFixed(1)} MiB/s`;
}

function formatOptionalRate(value) {
  return value == null ? 'n/a' : formatRate(value);
}

function formatOptionalRatio(value) {
  return value == null ? 'n/a' : `${value.toFixed(2)}x`;
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`;
}

function formatBytes(value) {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= MIB) return `${sign}${(abs / MIB).toFixed(1)} MiB`;
  if (abs >= 1024) return `${sign}${(abs / 1024).toFixed(1)} KiB`;
  return `${sign}${abs.toFixed(0)} B`;
}

function formatSignedBytes(value) {
  if (value === 0) return '0 B';
  return `${value > 0 ? '+' : ''}${formatBytes(value)}`;
}

main();
