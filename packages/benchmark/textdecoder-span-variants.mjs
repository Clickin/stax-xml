import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StreamEventType, StreamReaderSync } from 'stax-xml';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultCorpusFile = resolve(__dirname, '../stax-xml/performance/samples/treebank_e.xml');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'textdecoder-span-variants.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'textdecoder-span-variants.md');
const packageVersion = JSON.parse(readFileSync(resolve(__dirname, '../stax-xml/package.json'), 'utf8')).version;
const textEncoder = new TextEncoder();
const previewDecoder = new TextDecoder('utf-8', { ignoreBOM: true });

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizeGiB: 1,
    runs: 1,
    warmups: 0,
    fixtureShape: 'diverse-cycle',
    diverseCycleSize: 4096,
    corpusFile: defaultCorpusFile,
    batchSize: 16,
    batchSizeExplicit: false,
    boundedRssMiB: 512,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
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
      case '--size-gib':
        options.sizeGiB = parsePositiveNumber(readValue(), '--size-gib');
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), '--runs');
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), '--warmups');
        break;
      case '--fixture-shape':
        options.fixtureShape = readValue();
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), '--diverse-cycle-size');
        break;
      case '--corpus-file':
        options.corpusFile = resolve(process.cwd(), readValue());
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), '--batch-size');
        options.batchSizeExplicit = true;
        break;
      case '--bounded-rss-mib':
        options.boundedRssMiB = parsePositiveNumber(readValue(), '--bounded-rss-mib');
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

  if (!['repeated-person', 'diverse-cycle', 'corpus-cycle'].includes(options.fixtureShape)) {
    throw new Error('--fixture-shape must be one of repeated-person, diverse-cycle, corpus-cycle.');
  }
  if (options.fixtureShape === 'corpus-cycle' && !existsSync(options.corpusFile)) {
    throw new Error(`--corpus-file does not exist: ${options.corpusFile}`);
  }
  if (options.fixtureShape === 'corpus-cycle' && !options.batchSizeExplicit) {
    options.batchSize = 1;
  }

  return options;
}

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive number.`);
  return parsed;
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
  const fixture = createFixture(options);
  const variants = createVariants();
  const results = variants.map(variant => measureVariant(variant, fixture, options));
  const report = createReport(fixture, options, results);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function createVariants() {
  return [
    {
      id: 'subarraySharedDecoder',
      implementation: 'shared TextDecoder over buffer.subarray(start, end)',
      decodeStrategy: {
        spanView: 'Uint8Array.subarray',
        decoderLifetime: 'per-run-shared',
        copiesSpanBytes: false,
        manualShortAscii: false,
      },
      createState: () => ({ decoder: new TextDecoder('utf-8', { ignoreBOM: true }) }),
      decode: (buffer, start, end, state, counters) => {
        counters.textDecoderCalls++;
        return state.decoder.decode(buffer.subarray(start, end));
      },
    },
    {
      id: 'viewSharedDecoder',
      implementation: 'shared TextDecoder over new Uint8Array(buffer, offset, length)',
      decodeStrategy: {
        spanView: 'Uint8Array constructor view',
        decoderLifetime: 'per-run-shared',
        copiesSpanBytes: false,
        manualShortAscii: false,
      },
      createState: () => ({ decoder: new TextDecoder('utf-8', { ignoreBOM: true }) }),
      decode: (buffer, start, end, state, counters) => {
        counters.textDecoderCalls++;
        const view = new Uint8Array(buffer.buffer, buffer.byteOffset + start, end - start);
        return state.decoder.decode(view);
      },
    },
    {
      id: 'sliceCopySharedDecoder',
      implementation: 'shared TextDecoder over copied Uint8Array span',
      decodeStrategy: {
        spanView: 'Uint8Array copy',
        decoderLifetime: 'per-run-shared',
        copiesSpanBytes: true,
        manualShortAscii: false,
      },
      createState: () => ({ decoder: new TextDecoder('utf-8', { ignoreBOM: true }) }),
      decode: (buffer, start, end, state, counters) => {
        counters.textDecoderCalls++;
        counters.copiedSpans++;
        counters.copiedSpanBytes += end - start;
        return state.decoder.decode(new Uint8Array(buffer.subarray(start, end)));
      },
    },
    {
      id: 'subarrayNewDecoder',
      implementation: 'new TextDecoder for each buffer.subarray(start, end)',
      decodeStrategy: {
        spanView: 'Uint8Array.subarray',
        decoderLifetime: 'per-span-new',
        copiesSpanBytes: false,
        manualShortAscii: false,
      },
      createState: () => ({}),
      decode: (buffer, start, end, _state, counters) => {
        counters.textDecoderCalls++;
        counters.textDecoderInstances++;
        return new TextDecoder('utf-8', { ignoreBOM: true }).decode(buffer.subarray(start, end));
      },
    },
    {
      id: 'shortAsciiSubarraySharedDecoder',
      implementation: 'short ASCII fast path, then shared TextDecoder over buffer.subarray(start, end)',
      decodeStrategy: {
        spanView: 'Uint8Array.subarray',
        decoderLifetime: 'per-run-shared',
        copiesSpanBytes: false,
        manualShortAscii: true,
      },
      createState: () => ({ decoder: new TextDecoder('utf-8', { ignoreBOM: true }) }),
      decode: (buffer, start, end, state, counters) => {
        const ascii = decodeShortAsciiSpan(buffer, start, end);
        if (ascii !== undefined) {
          counters.shortAsciiHits++;
          return ascii;
        }
        counters.textDecoderCalls++;
        return state.decoder.decode(buffer.subarray(start, end));
      },
    },
  ].map(variant => ({
    ...variant,
    family: 'full-stax-js',
    contractScope: 'full-string-materialization',
    fullStringParity: true,
    decodeStrategy: {
      ...variant.decodeStrategy,
      usesTextDecoder: true,
      nodeBufferSpecific: false,
      nativeAddon: false,
      lazyGetter: false,
    },
  }));
}

function measureVariant(variant, fixture, options) {
  for (let index = 0; index < options.warmups; index++) {
    variant.run?.() ?? consumeVariant(variant, fixture);
  }

  const samplesMs = [];
  const memorySamples = [];
  let first;
  for (let index = 0; index < options.runs; index++) {
    forceGc();
    const memoryBefore = takeMemorySnapshot();
    const startedAt = performance.now();
    const result = consumeVariant(variant, fixture);
    const elapsedMs = performance.now() - startedAt;
    const memoryAfter = takeMemorySnapshot();

    if (first && (result.eventCount !== first.eventCount || result.checksum !== first.checksum)) {
      throw new Error(`${variant.id} produced unstable event count or checksum.`);
    }
    first ??= result;
    samplesMs.push(elapsedMs);
    memorySamples.push(createMemorySample(memoryBefore, memoryAfter));
  }

  const avgMs = average(samplesMs);
  const mibPerSec = fixture.actualBytes / MIB / (avgMs / 1000);
  const memory = summarizeMemory(memorySamples);
  const boundedMemory = memory.maxRssBytes <= options.boundedRssMiB * MIB;
  const runtimeLimitCounterexampleEligible = fixture.actualBytes >= GIB && mibPerSec >= 200 && boundedMemory;
  return {
    id: variant.id,
    family: variant.family,
    implementation: variant.implementation,
    contractScope: variant.contractScope,
    fullStringParity: variant.fullStringParity,
    eventCountKind: 'stream-events',
    decodeStrategy: variant.decodeStrategy,
    eventCount: first.eventCount,
    checksum: first.checksum,
    materializationCounters: first.materializationCounters,
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    samplesMs,
    mibPerSec,
    memory,
    boundedMemory,
    runtimeLimitCounterexampleEligible,
    counterexampleStatus: runtimeLimitCounterexampleEligible ? 'found' : 'not-found',
  };
}

function consumeVariant(variant, fixture) {
  const state = variant.createState();
  const parser = new StreamReaderSync(byteBatches(fixture));
  const materializationCounters = createMaterializationCounters();
  let eventCount = 0;
  let checksum = 0;
  let frame;

  while ((frame = parser.nextRawBatch()) !== null) {
    const result = consumeRawFrame(frame, checksum, eventCount, variant, state, materializationCounters);
    checksum = result.checksum;
    eventCount = result.eventCount;
  }

  return { eventCount, checksum, materializationCounters };
}

function consumeRawFrame(frame, checksum, eventCount, variant, state, counters) {
  if (frame.kind !== 'frame') {
    throw new Error(`Unsupported raw batch kind in TextDecoder span matrix: ${frame.kind}`);
  }

  const eventTypes = frame.eventTypes;
  const nameStarts = frame.nameStarts;
  const nameEnds = frame.nameEnds;
  const textStarts = frame.textStarts;
  const textEnds = frame.textEnds;
  const attrStarts = frame.attrStarts;
  const attrCounts = frame.attrCounts;
  const attrNameStarts = frame.attrNameStarts;
  const attrNameEnds = frame.attrNameEnds;
  const attrValueStarts = frame.attrValueStarts;
  const attrValueEnds = frame.attrValueEnds;
  const buffer = frame.buffer;

  for (let index = 0; index < frame.eventCount; index++) {
    const type = eventTypes[index];
    eventCount++;
    checksum = mixChecksum(checksum, type);

    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      countStringField(counters, 'name');
      checksum = foldString(checksum, decodeSpan(buffer, nameStarts[index], nameEnds[index], variant, state, counters, 'name'));
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      const start = textStarts[index];
      if (start >= 0) {
        countStringField(counters, 'text');
        checksum = foldString(checksum, decodeSpan(buffer, start, textEnds[index], variant, state, counters, 'text').trim());
      }
    }
    if (type === StreamEventType.START_ELEMENT) {
      const attrStart = attrStarts[index];
      const attrCount = attrCounts[index];
      counters.attributePairs += attrCount;
      checksum = mixChecksum(checksum, attrCount);
      const attrEnd = attrStart + attrCount;
      for (let attrIndex = attrStart; attrIndex < attrEnd; attrIndex++) {
        countStringField(counters, 'attrName');
        checksum = foldString(
          checksum,
          decodeSpan(buffer, attrNameStarts[attrIndex], attrNameEnds[attrIndex], variant, state, counters, 'attrName'),
        );
        countStringField(counters, 'attrValue');
        const value = isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, attrIndex)
          ? countImplicitAttributeValue(counters)
          : decodeSpan(buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex], variant, state, counters, 'attrValue');
        checksum = foldString(checksum, value);
      }
    }
  }

  return { eventCount, checksum };
}

function decodeSpan(buffer, start, end, variant, state, counters, kind) {
  counters.decodeSpanCalls++;
  countRawSpanMaterialization(counters, kind);
  return variant.decode(buffer, start, end, state, counters);
}

function isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, index) {
  return attrNameStarts[index] === attrValueStarts[index] && attrNameEnds[index] === attrValueEnds[index];
}

function countImplicitAttributeValue(counters) {
  counters.implicitAttrValueReads++;
  return 'true';
}

function decodeShortAsciiSpan(buffer, start, end) {
  const length = end - start;
  if (length === 0) return '';
  if (length > 12) return undefined;
  let bits = 0;
  for (let index = start; index < end; index++) {
    bits |= buffer[index];
  }
  if (bits > 0x7f) return undefined;

  switch (length) {
    case 1:
      return String.fromCharCode(buffer[start]);
    case 2:
      return String.fromCharCode(buffer[start], buffer[start + 1]);
    case 3:
      return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2]);
    case 4:
      return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3]);
    case 5:
      return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3], buffer[start + 4]);
    case 6:
      return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3], buffer[start + 4], buffer[start + 5]);
    case 7:
      return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3], buffer[start + 4], buffer[start + 5], buffer[start + 6]);
    case 8:
      return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3], buffer[start + 4], buffer[start + 5], buffer[start + 6], buffer[start + 7]);
    case 9:
      return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3], buffer[start + 4], buffer[start + 5], buffer[start + 6], buffer[start + 7], buffer[start + 8]);
    case 10:
      return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3], buffer[start + 4], buffer[start + 5], buffer[start + 6], buffer[start + 7], buffer[start + 8], buffer[start + 9]);
    case 11:
      return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3], buffer[start + 4], buffer[start + 5], buffer[start + 6], buffer[start + 7], buffer[start + 8], buffer[start + 9], buffer[start + 10]);
    case 12:
      return String.fromCharCode(buffer[start], buffer[start + 1], buffer[start + 2], buffer[start + 3], buffer[start + 4], buffer[start + 5], buffer[start + 6], buffer[start + 7], buffer[start + 8], buffer[start + 9], buffer[start + 10], buffer[start + 11]);
    default:
      return undefined;
  }
}

function createReport(fixture, options, variants) {
  const fullStringParity = createFullStringParity(variants);
  const eventCountParity = createEventCountParity(variants);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'textdecoder-span-variants',
    contract: 'full-string-textdecoder-span-variant-headroom',
    note: 'Compares browser-compatible TextDecoder span materialization variants under the same full-string checksum contract.',
    packageVersion,
    environment: createEnvironment(),
    options: {
      sizeGiB: options.sizeGiB,
      runs: options.runs,
      warmups: options.warmups,
      fixtureShape: options.fixtureShape,
      diverseCycleSize: options.diverseCycleSize,
      batchSize: options.batchSize,
      boundedRssMiB: options.boundedRssMiB,
    },
    fixture: {
      source: fixture.source,
      sourceFile: fixture.sourceFile,
      generated: fixture.source === 'generated',
      shape: fixture.fixtureShape,
      rowCycleSize: fixture.rows.length,
      batchSize: fixture.batchSize,
      targetBytes: fixture.targetBytes,
      actualBytes: fixture.actualBytes,
      sizeGiB: fixture.sizeGiB,
      minRowBytes: fixture.rowStats.minRowBytes,
      maxRowBytes: fixture.rowStats.maxRowBytes,
      averageRowBytes: fixture.rowStats.averageRowBytes,
      rowPreview: fixture.rowPreview,
      rowPreviewTruncated: fixture.rowPreviewTruncated,
    },
    fullStringParity,
    eventCountParity,
    variants,
    findings: createFindings(fixture, variants, fullStringParity),
  };
}

function createFullStringParity(variants) {
  const first = variants[0];
  const stable = variants.every(entry => entry.eventCount === first.eventCount && entry.checksum === first.checksum);
  return {
    status: stable ? 'ok' : 'mismatch',
    rowIds: variants.map(entry => entry.id),
    eventCount: first.eventCount,
    checksum: first.checksum,
  };
}

function createEventCountParity(variants) {
  const first = variants[0];
  const stable = variants.every(entry => entry.eventCount === first.eventCount);
  return {
    status: stable ? 'ok' : 'mismatch',
    rowIds: variants.map(entry => entry.id),
    eventCount: first.eventCount,
  };
}

function createFindings(fixture, variants, fullStringParity) {
  const fastest = maxBy(variants, entry => entry.mibPerSec);
  const counterexamples = variants.filter(entry => entry.runtimeLimitCounterexampleEligible);
  const findings = [
    {
      id: 'same-full-string-contract',
      status: fullStringParity.status === 'ok' ? 'BENCH_FACT' : 'COUNTEREXAMPLE',
      summary: 'All TextDecoder variants fold event type, names, text/CDATA, attribute names, and attribute values into the same checksum.',
    },
    {
      id: 'textdecoder-variants-are-headroom-search',
      status: 'BENCH_FACT',
      summary: `Fastest row in this run was ${fastest.id} at ${formatRate(fastest.mibPerSec)}; this is a decode-span headroom search, not an impossibility proof.`,
    },
    {
      id: 'runtime-limit-still-unproven',
      status: counterexamples.length > 0 ? 'COUNTEREXAMPLE' : 'HYPOTHESIS',
      summary: counterexamples.length > 0
        ? `Found 200 MiB/s+ bounded-memory 1 GiB+ full-string row(s): ${counterexamples.map(entry => entry.id).join(', ')}.`
        : 'No 200 MiB/s+ bounded-memory 1 GiB+ full-string row was found in this TextDecoder span matrix, but absence in this matrix is not a proof that JavaScript runtimes have no further headroom.',
    },
    {
      id: 'no-buffer-native-or-lazy-getter-path',
      status: 'SOURCE_FACT',
      summary: 'Rows use Uint8Array plus TextDecoder only; they do not use Node Buffer.toString(), native addons, or lazy getters.',
    },
    {
      id: 'fixture-scope',
      status: 'BENCH_FACT',
      summary: `Fixture is ${fixture.source === 'generated' ? 'generated' : 'corpus-backed'} ${formatBytes(fixture.actualBytes)} ${fixture.fixtureShape}; broaden corpus/runtime coverage before drawing global conclusions.`,
    },
  ];
  if (fixture.source === 'corpus-file') {
    findings.push({
      id: 'corpus-cycle-fixture',
      status: 'BENCH_FACT',
      summary: 'The fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.',
    });
  }
  return findings;
}

function createEnvironment() {
  const runtimeName = typeof Bun !== 'undefined' ? 'bun' : globalThis.Deno ? 'deno' : 'node';
  const denoVersion = globalThis.Deno?.version;
  return {
    runtimeName,
    cpuName: sanitizeEnvironmentString(cpus()[0]?.model),
    platform: `${process.platform}-${process.arch}`,
    node: process.version,
    v8: denoVersion?.v8 ?? process.versions.v8,
    denoVersion: denoVersion?.deno ?? null,
    bunVersion: typeof Bun !== 'undefined' ? Bun.version : null,
    webkitCommit: process.versions.webkit ?? null,
    gcStrategy: typeof globalThis.gc === 'function' ? 'globalThis.gc' : 'unavailable',
  };
}

function sanitizeEnvironmentString(value) {
  return String(value ?? 'unknown').replace(/\0/g, '').trim() || 'unknown';
}

function createFixture(options) {
  const targetBytes = Math.floor(options.sizeGiB * GIB);
  const rows = createFixtureRows(options.fixtureShape, options.diverseCycleSize, options.corpusFile);
  const rowStats = summarizeRows(rows);
  const actualBytes = computeExpectedBytes(targetBytes, rows);
  const source = options.fixtureShape === 'corpus-cycle' ? 'corpus-file' : 'generated';
  return {
    source,
    sourceFile: source === 'corpus-file' ? options.corpusFile : null,
    rows,
    rowStats,
    targetBytes,
    actualBytes,
    sizeGiB: actualBytes / GIB,
    fixtureShape: options.fixtureShape,
    batchSize: options.batchSize,
    rowPreview: previewDecoder.decode(rows[0].subarray(0, Math.min(rows[0].byteLength, 512))),
    rowPreviewTruncated: rows[0].byteLength > 512,
  };
}

function createFixtureRows(shape, cycleSize, corpusFile) {
  if (shape === 'repeated-person') {
    return [textEncoder.encode(makeRepeatedPersonRow())];
  }
  if (shape === 'corpus-cycle') {
    const bytes = readFileSync(corpusFile);
    if (bytes.byteLength === 0) {
      throw new Error(`Corpus fixture is empty: ${corpusFile}`);
    }
    return [new Uint8Array(bytes)];
  }
  return Array.from({ length: cycleSize }, (_, id) => textEncoder.encode(makeDiverseRow(id)));
}

function makeRepeatedPersonRow() {
  return '<person id="123"><name>Jane Doe</name><age>42</age></person>';
}

function makeDiverseRow(id) {
  const rootNames = ['person', 'record', 'entry', 'invoice', 'profile', 'asset', 'sample'];
  const childNames = ['name', 'title', 'summary', 'note', 'group', 'bucket', 'payload'];
  const rootName = `${rootNames[id % rootNames.length]}${id % 257}`;
  const childA = `${childNames[id % childNames.length]}${(id * 3) % 193}`;
  const childB = `${childNames[(id + 2) % childNames.length]}${(id * 5) % 197}`;
  const childC = `${childNames[(id + 4) % childNames.length]}${(id * 7) % 199}`;
  const attrA = `data${id % 997}`;
  const attrB = `code${(id * 11) % 991}`;
  const attrC = `flag${(id * 17) % 983}`;
  const utf8Text = id % 11 === 0
    ? ` ${String.fromCodePoint(0x2603)}-${id}-${String.fromCodePoint(0x1f642)}`
    : '';

  return `<${rootName} id="item-${id}" ${attrA}="value-${(id * 31) % 65521}" ${attrB}="group-${id % 4093}" ${attrC}="${id % 2 === 0 ? 'true' : 'false'}">`
    + `<${childA}>Runtime Benchmark ${id}${utf8Text}</${childA}>`
    + `<${childB} rank="${id % 29}">Full string checksum payload ${(id * 8191) % 104729}</${childB}>`
    + `<${childC} shard="${id % 37}" bucket="${(id * 19) % 389}">Text ${id} ${(id * id) % 99991}</${childC}>`
    + `</${rootName}>`;
}

function summarizeRows(rowList) {
  const rowBytes = rowList.map(entry => entry.byteLength);
  return {
    minRowBytes: Math.min(...rowBytes),
    maxRowBytes: Math.max(...rowBytes),
    averageRowBytes: average(rowBytes),
  };
}

function computeExpectedBytes(targetBytes, rowList) {
  const cycleBytes = rowList.reduce((sum, entry) => sum + entry.byteLength, 0);
  let emittedBytes = Math.floor(targetBytes / cycleBytes) * cycleBytes;
  let rowIndex = 0;
  while (emittedBytes < targetBytes) {
    emittedBytes += rowList[rowIndex % rowList.length].byteLength;
    rowIndex++;
  }
  return emittedBytes;
}

function* byteBatches(fixture) {
  let emittedBytes = 0;
  let rowIndex = 0;
  while (emittedBytes < fixture.targetBytes) {
    const batch = [];
    for (let index = 0; index < fixture.batchSize && emittedBytes < fixture.targetBytes; index++) {
      const nextRow = fixture.rows[rowIndex % fixture.rows.length];
      batch.push(nextRow);
      emittedBytes += nextRow.byteLength;
      rowIndex++;
    }
    yield batch;
  }
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
    decodeSpanCalls: 0,
    textDecoderCalls: 0,
    textDecoderInstances: 0,
    shortAsciiHits: 0,
    copiedSpans: 0,
    copiedSpanBytes: 0,
    implicitAttrValueReads: 0,
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

function takeMemorySnapshot() {
  if (typeof process.memoryUsage !== 'function') {
    return { heapUsed: 0, rss: 0 };
  }
  const memory = process.memoryUsage();
  return { heapUsed: memory.heapUsed, rss: memory.rss };
}

function createMemorySample(before, after) {
  return {
    heapUsedBeforeBytes: before.heapUsed,
    heapUsedAfterBytes: after.heapUsed,
    heapUsedDeltaBytes: after.heapUsed - before.heapUsed,
    rssBeforeBytes: before.rss,
    rssAfterBytes: after.rss,
    rssDeltaBytes: after.rss - before.rss,
  };
}

function summarizeMemory(samples) {
  return {
    avgHeapUsedDeltaBytes: average(samples.map(entry => entry.heapUsedDeltaBytes)),
    avgRssDeltaBytes: average(samples.map(entry => entry.rssDeltaBytes)),
    maxHeapUsedBytes: Math.max(...samples.map(entry => Math.max(entry.heapUsedBeforeBytes, entry.heapUsedAfterBytes))),
    maxRssBytes: Math.max(...samples.map(entry => Math.max(entry.rssBeforeBytes, entry.rssAfterBytes))),
    samples,
  };
}

function forceGc() {
  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
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

function renderMarkdown(report) {
  const fastest = maxBy(report.variants, entry => entry.mibPerSec);
  const corpusBacked = report.fixture.source === 'corpus-file';
  const lines = [
    '# TextDecoder Span Variant Matrix',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    corpusBacked
      ? 'This experiment compares browser-compatible `Uint8Array` + `TextDecoder` span materialization variants over corpus-backed `Uint8Array` batches under the same full-string checksum contract.'
      : 'This experiment compares browser-compatible `Uint8Array` + `TextDecoder` span materialization variants under the same full-string checksum contract.',
    'Every row folds event type, element names, text/CDATA, attribute names, and attribute values.',
    'It does not use Node `Buffer.toString()`, does not use native addons, and does not use lazy getters.',
    'It is a counterexample search, not a proof that JavaScript runtimes have no further headroom.',
    'Any 200 MiB/s+ bounded-memory full-string row remains a counterexample to the broad runtime-limit claim.',
    '',
    '## Fixture',
    '',
    `- Package: stax-xml ${report.packageVersion}`,
    `- Runtime: ${formatRuntime(report.environment)}`,
    `- Fixture source: ${report.fixture.source}`,
    ...(report.fixture.sourceFile ? [`- Source file: ${report.fixture.sourceFile}`] : []),
    `- Generated size: ${formatBytes(report.fixture.actualBytes)} (${report.fixture.actualBytes} bytes)`,
    `- Fixture shape: ${report.fixture.shape}`,
    `- Row cycle size: ${report.fixture.rowCycleSize}`,
    `- Batch size: ${report.fixture.batchSize}`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    `- Bounded RSS reporting gate: ${report.options.boundedRssMiB.toFixed(1)} MiB`,
    '',
    '## Results',
    '',
    '| Variant | Span view | Decoder lifetime | Copy span bytes | Manual short ASCII | Throughput | Bounded memory | Counterexample | Events | Checksum |',
    '| --- | --- | --- | --- | --- | ---: | --- | --- | ---: | ---: |',
  ];

  for (const entry of report.variants) {
    lines.push(
      `| ${entry.id} | ${entry.decodeStrategy.spanView} | ${entry.decodeStrategy.decoderLifetime} | `
      + `${entry.decodeStrategy.copiesSpanBytes ? 'yes' : 'no'} | ${entry.decodeStrategy.manualShortAscii ? 'yes' : 'no'} | `
      + `${formatRate(entry.mibPerSec)} | ${entry.boundedMemory ? 'yes' : 'no'} | ${entry.counterexampleStatus} | `
      + `${entry.eventCount} | ${entry.checksum} |`,
    );
  }

  lines.push('');
  lines.push('## Parity');
  lines.push('');
  lines.push(`- Full-string parity rows: ${report.fullStringParity.status}`);
  lines.push(`- Event count parity rows: ${report.eventCountParity.status}`);
  lines.push(`- Shared events: ${report.fullStringParity.eventCount}`);
  lines.push(`- Shared checksum: ${report.fullStringParity.checksum}`);
  lines.push('');
  lines.push('## Memory');
  lines.push('');
  lines.push('| Variant | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const entry of report.variants) {
    lines.push(
      `| ${entry.id} | ${formatSignedBytes(entry.memory.avgHeapUsedDeltaBytes)} | `
      + `${formatSignedBytes(entry.memory.avgRssDeltaBytes)} | ${formatBytes(entry.memory.maxHeapUsedBytes)} | `
      + `${formatBytes(entry.memory.maxRssBytes)} |`,
    );
  }

  lines.push('');
  lines.push('## Materialization Counters');
  lines.push('');
  lines.push('| Variant | String fields | Raw spans | TextDecoder calls | New TextDecoder instances | Short ASCII hits | Copied spans | Copied bytes | Attribute pairs |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const entry of report.variants) {
    const counters = entry.materializationCounters;
    lines.push(
      `| ${entry.id} | ${formatCount(counters.stringFieldReads)} | ${formatCount(counters.rawSpanMaterializations)} | `
      + `${formatCount(counters.textDecoderCalls)} | ${formatCount(counters.textDecoderInstances)} | `
      + `${formatCount(counters.shortAsciiHits)} | ${formatCount(counters.copiedSpans)} | `
      + `${formatBytes(counters.copiedSpanBytes)} | ${formatCount(counters.attributePairs)} |`,
    );
  }

  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.status}): ${finding.summary}`);
  }
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  lines.push(`- Fastest row: ${fastest.id} at ${formatRate(fastest.mibPerSec)}.`);
  lines.push('- A slow row only rejects that decode strategy under this fixture/runtime; it does not reject all JS runtime headroom.');
  lines.push('- A fast partial or selected-field row from another matrix is still narrower headroom evidence, not a full StAX materialization result.');

  return `${lines.join('\n')}\n`;
}

function printSummary(report) {
  console.log('TextDecoder span variant matrix');
  console.log(`fixture=${report.fixture.shape} size=${formatBytes(report.fixture.actualBytes)} runs=${report.options.runs}`);
  for (const entry of report.variants) {
    console.log(
      `${entry.id.padEnd(34)} ${formatRate(entry.mibPerSec).padStart(14)} `
      + `bounded=${entry.boundedMemory ? 'yes' : 'no'} counterexample=${entry.counterexampleStatus} `
      + `decoderCalls=${entry.materializationCounters.textDecoderCalls} maxRSS=${formatBytes(entry.memory.maxRssBytes)} `
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

function formatRuntime(environment) {
  if (environment.runtimeName === 'bun') {
    return `Bun ${environment.bunVersion}, JavaScriptCore WebKit ${environment.webkitCommit}`;
  }
  if (environment.runtimeName === 'deno') {
    return `Deno ${environment.denoVersion}, V8 ${environment.v8}`;
  }
  return `Node ${environment.node}, V8 ${environment.v8}`;
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

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatRate(value) {
  return `${value.toFixed(2)} MiB/s`;
}

function formatCount(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatBytes(value) {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= GIB) return `${sign}${(abs / GIB).toFixed(2)} GiB`;
  if (abs >= MIB) return `${sign}${(abs / MIB).toFixed(1)} MiB`;
  if (abs >= 1024) return `${sign}${(abs / 1024).toFixed(1)} KiB`;
  return `${sign}${abs.toFixed(0)} B`;
}

function formatSignedBytes(value) {
  if (value === 0) return '0 B';
  return `${value > 0 ? '+' : ''}${formatBytes(value)}`;
}

main();
