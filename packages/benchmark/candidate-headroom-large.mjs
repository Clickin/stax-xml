import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StreamEventType, StreamReaderSync, XmlEventType } from 'stax-xml';
import { attr, attrEquals, childText, compileProjection, many, projectXmlSync } from 'stax-xml/projection';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const __dirname = dirname(fileURLToPath(import.meta.url));
const externalBaselinePath = resolve(__dirname, 'results', 'release', 'external-baseline.json');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'candidate-headroom-large.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'candidate-headroom-large.md');
const defaultCorpusFile = resolve(__dirname, '../stax-xml/performance/samples/treebank_e.xml');
const packageVersion = JSON.parse(readFileSync(resolve(__dirname, '../stax-xml/package.json'), 'utf8')).version;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
const projectionLowSelectivity = compileProjection({
  books: many('/root/book', {
    id: attr('id'),
    title: childText('title'),
  }, {
    where: attrEquals('code', '7'),
  }),
});
const projectionHighSelectivity = compileProjection({
  books: many('/root/book', {
    id: attr('id'),
    title: childText('title'),
  }),
});
const allStringFields = Object.freeze({
  name: true,
  text: true,
  attrName: true,
  attrValue: true,
});

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
    cases: null,
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
      case '--cases':
        options.cases = parseCaseList(readValue());
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

  if (!['repeated-person', 'diverse-cycle', 'corpus-cycle', 'projection-cycle'].includes(options.fixtureShape)) {
    throw new Error('--fixture-shape must be one of repeated-person, diverse-cycle, corpus-cycle, projection-cycle.');
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

function parseCaseList(value) {
  const parsed = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (parsed.length === 0) {
    throw new Error('--cases must contain at least one case id.');
  }
  return parsed;
}

function main() {
  const options = parseArgs();
  const fixture = createFixture(options);
  const variants = filterVariants(createVariants(fixture), options.cases);
  const results = variants.map((variant) => measureVariant(variant, fixture, options));
  const report = createReport(fixture, options, results);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function createVariants(fixture) {
  const variants = [
    {
      id: 'scanAllNoDecode',
      family: 'partial-upper-bound',
      implementation: 'StreamBatch index accessors over generated byte batches',
      contractScope: 'event-types-and-attribute-counts-only',
      fullStringParity: false,
      run: () => consumeStreamSelective(fixture, { name: false, text: false, attrName: false, attrValue: false }),
    },
    {
      id: 'nameStringOnly',
      family: 'partial-upper-bound',
      implementation: 'StreamBatch index accessors over generated byte batches',
      contractScope: 'event-types-attribute-counts-and-element-names',
      fullStringParity: false,
      run: () => consumeStreamSelective(fixture, { name: true, text: false, attrName: false, attrValue: false }),
    },
    {
      id: 'textStringOnly',
      family: 'partial-upper-bound',
      implementation: 'StreamBatch index accessors over generated byte batches',
      contractScope: 'event-types-attribute-counts-and-text-cdata',
      fullStringParity: false,
      run: () => consumeStreamSelective(fixture, { name: false, text: true, attrName: false, attrValue: false }),
    },
    {
      id: 'attrNameStringOnly',
      family: 'partial-upper-bound',
      implementation: 'StreamBatch index accessors over generated byte batches',
      contractScope: 'event-types-attribute-counts-and-attribute-names',
      fullStringParity: false,
      run: () => consumeStreamSelective(fixture, { name: false, text: false, attrName: true, attrValue: false }),
    },
    {
      id: 'attrValueStringOnly',
      family: 'partial-upper-bound',
      implementation: 'StreamBatch index accessors over generated byte batches',
      contractScope: 'event-types-attribute-counts-and-attribute-values',
      fullStringParity: false,
      run: () => consumeStreamSelective(fixture, { name: false, text: false, attrName: false, attrValue: true }),
    },
    {
      id: 'stringFull',
      family: 'full-stax-js',
      implementation: 'StreamBatch index accessors over generated byte batches',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeStreamSelective(fixture, allStringFields),
    },
    {
      id: 'eventObjectFull',
      family: 'full-stax-js',
      implementation: 'public event objects materialized from byte batches',
      contractScope: 'full-event-object-materialization',
      fullStringParity: true,
      run: () => consumeEventObjectFull(fixture),
    },
    {
      id: 'cursorAccessor',
      family: 'full-stax-js',
      implementation: 'single mutable cursor over StreamBatch generated byte batches',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeCursorAccessor(fixture),
    },
    {
      id: 'rawFrameDirect',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with direct span decode',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, undefined),
    },
    {
      id: 'rawFrameNameId',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, []),
    },
    {
      id: 'rawFrameNameIdFoldTrim',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache and direct trimmed text checksum folding',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, [], undefined, { foldTrimmedText: true }),
    },
    {
      id: 'rawFrameSemanticChecksum',
      family: 'semantic-upper-bound',
      implementation: 'nextRawBatch typed arrays with direct UTF-16 checksum folding and no string materialization on ASCII spans',
      contractScope: 'same-fields-checksum-no-string-materialization',
      fullStringParity: false,
      run: () => consumeRawFrameSemanticChecksumStyle(fixture),
    },
    {
      id: 'rawFrameStringCache',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache and bounded span string cache',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, [], new SpanStringCache()),
    },
  ];

  if (fixture.fixtureShape === 'projection-cycle') {
    variants.push(
      {
        id: 'projectionLowSelectivity',
        family: 'projection-js',
        implementation: 'stax-xml/projection over generated byte batches',
        contractScope: 'projected-records-low-selectivity',
        fullStringParity: false,
        eventCountKind: 'projected-records',
        run: () => consumeProjectionSelectivity(fixture, projectionLowSelectivity),
      },
      {
        id: 'projectionHighSelectivity',
        family: 'projection-js',
        implementation: 'stax-xml/projection over generated byte batches',
        contractScope: 'projected-records-high-selectivity',
        fullStringParity: false,
        eventCountKind: 'projected-records',
        run: () => consumeProjectionSelectivity(fixture, projectionHighSelectivity),
      },
    );
  }

  return variants;
}

function filterVariants(variants, caseIds) {
  if (!caseIds) {
    return variants;
  }
  const byId = new Map(variants.map(variant => [variant.id, variant]));
  return caseIds.map((id) => {
    const variant = byId.get(id);
    if (!variant) {
      throw new Error(`Unknown case for this fixture: ${id}`);
    }
    return variant;
  });
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
    rowPreview: createRowPreview(rows[0]),
    rowPreviewTruncated: rows[0].byteLength > 512,
    rowStats,
    targetBytes,
    actualBytes,
    sizeGiB: actualBytes / GIB,
    fixtureShape: options.fixtureShape,
    diverseCycleSize: options.diverseCycleSize,
    batchSize: options.batchSize,
  };
}

function measureVariant(variant, fixture, options) {
  for (let index = 0; index < options.warmups; index++) {
    variant.run();
  }

  const samplesMs = [];
  const memorySamples = [];
  let first;
  for (let index = 0; index < options.runs; index++) {
    forceGc();
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

  const avgMs = average(samplesMs);
  return {
    id: variant.id,
    family: variant.family,
    implementation: variant.implementation,
    contractScope: variant.contractScope,
    eventCountKind: variant.eventCountKind ?? 'stream-events',
    fullStringParity: variant.fullStringParity,
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: (fixture.actualBytes / MIB) / (avgMs / 1000),
    eventCount: first.eventCount,
    checksum: first.checksum,
    samplesMs,
    memory: summarizeMemorySamples(memorySamples),
    materializationCounters: first.materializationCounters,
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
  const boundedRssBytes = options.boundedRssMiB * MIB;
  const corpusBacked = fixture.source === 'corpus-file';
  return {
    generatedAt: new Date().toISOString(),
    objective: 'candidate-headroom-large',
    contract: corpusBacked
      ? 'byte-batch-mixed-materialization-headroom-matrix'
      : 'generated-byte-batch-mixed-materialization-headroom-matrix',
    note: corpusBacked
      ? 'This is a 1 GiB+ bounded-memory counterexample search for corpus-backed byte batches. Partial rows are upper-bound probes only; full rows keep the StAX-like checksum contract.'
      : 'This is a 1 GiB+ bounded-memory counterexample search for generated byte batches. Partial rows are upper-bound probes only; full rows keep the StAX-like checksum contract.',
    sourceContract: {
      parserInput: 'Rows use StreamReaderSync over a synchronous Iterable<Uint8Array[]> generated by byteBatches(fixture).',
      batchBackpressure: 'byteBatches(fixture) yields one grouped Uint8Array[] batch per synchronous parser pull and does not prebuild the repeated 1 GiB+ stream.',
      readableStreamScope: 'This Node/Bun large matrix does not consume a pure ReadableStream directly; browser fetch streaming rows are measured in browser-candidate-headroom.',
      corpusScope: corpusBacked
        ? 'corpus-cycle loads one corpus seed with readFileSync, wraps it in Uint8Array, and replays that seed as byte batches to the target size.'
        : 'generated fixtures prepare one row cycle before timing and replay that cycle as byte batches to the target size.',
    },
    packageVersion,
    environment: createRuntimeEnvironment(),
    fixture: {
      generated: fixture.source === 'generated',
      source: fixture.source,
      sourceFile: fixture.sourceFile,
      shape: fixture.fixtureShape,
      rowXml: fixture.rowPreview,
      rowPreviewTruncated: fixture.rowPreviewTruncated,
      rowCycleSize: fixture.rows.length,
      minRowBytes: fixture.rowStats.minRowBytes,
      maxRowBytes: fixture.rowStats.maxRowBytes,
      averageRowBytes: fixture.rowStats.averageRowBytes,
      targetBytes: fixture.targetBytes,
      actualBytes: fixture.actualBytes,
      sizeGiB: fixture.sizeGiB,
      batchSize: fixture.batchSize,
    },
    options: {
      runs: options.runs,
      warmups: options.warmups,
      boundedRssMiB: options.boundedRssMiB,
      cases: options.cases,
    },
    woodstoxTarget,
    omittedRows: createOmittedRows(fixture),
    eventCountParity: computeEventCountParity(variants),
    fullStringParity: computeFullStringParity(variants),
    projectionParity: computeProjectionParity(variants),
    variants: variants.map((entry) => {
      const boundedMemory = entry.memory.maxRssBytes <= boundedRssBytes;
      const counterexampleEligible = entry.fullStringParity && fixture.actualBytes >= GIB && boundedMemory;
      return {
        ...entry,
        boundedMemory,
        runtimeLimitCounterexampleEligible: counterexampleEligible,
        counterexampleStatus: counterexampleEligible && entry.mibPerSec >= 200 ? 'found' : 'not-found',
        relativeToStringFull: stringFull ? entry.mibPerSec / stringFull.mibPerSec : 1,
        woodstoxRatio: woodstoxTarget.woodstoxMiBPerSec
          ? entry.mibPerSec / woodstoxTarget.woodstoxMiBPerSec
          : null,
        targetStatus: entry.fullStringParity && woodstoxTarget.targetThroughputMiB
          ? entry.mibPerSec >= woodstoxTarget.targetThroughputMiB ? 'met' : 'below'
          : 'not-applicable',
      };
    }),
    findings: createFindings(variants, fixture),
  };
}

function createOmittedRows(fixture) {
  if (fixture.fixtureShape === 'projection-cycle') {
    return [];
  }
  return [
    {
      id: 'projectionLowSelectivity',
      reason: 'Projection rows require a separate selector contract and remain future work.',
    },
    {
      id: 'projectionHighSelectivity',
      reason: 'Projection rows require a separate selector contract and remain future work.',
    },
  ];
}

function createRuntimeEnvironment() {
  const isBun = Boolean(process.versions.bun);
  const denoVersion = globalThis.Deno?.version;
  return {
    runtimeName: isBun ? 'bun' : denoVersion ? 'deno' : 'node',
    javascriptEngine: isBun ? 'JavaScriptCore' : 'V8',
    cpuName: sanitizeEnvironmentString(cpus()[0]?.model),
    platform: `${process.platform}-${process.arch}`,
    node: process.version,
    v8: denoVersion?.v8 ?? process.versions.v8,
    bunVersion: process.versions.bun ?? null,
    denoVersion: denoVersion?.deno ?? null,
    webkitCommit: process.versions.webkit ?? null,
    userAgent: globalThis.navigator?.userAgent ?? null,
    gcStrategy: detectGcStrategy(),
  };
}

function sanitizeEnvironmentString(value) {
  const cleaned = String(value ?? '').replace(/\0/g, '').trim();
  return cleaned || 'unknown';
}

function detectGcStrategy() {
  if (typeof globalThis.gc === 'function') {
    return 'globalThis.gc';
  }
  if (typeof globalThis.Bun?.gc === 'function') {
    return 'Bun.gc';
  }
  return 'unavailable';
}

function forceGc() {
  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
    return;
  }
  if (typeof globalThis.Bun?.gc === 'function') {
    globalThis.Bun.gc(true);
  }
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
  const streamRows = variants.filter((entry) => entry.eventCountKind !== 'projected-records');
  const first = streamRows[0];
  if (!first) {
    return {
      status: 'not-applicable',
      eventCount: null,
      rowIds: [],
    };
  }
  const mismatch = streamRows.find((entry) => entry.eventCount !== first.eventCount);
  if (mismatch) {
    throw new Error(`Variant ${mismatch.id} does not match ${first.id} event count.`);
  }
  return {
    status: 'ok',
    eventCount: first.eventCount,
    rowIds: streamRows.map((entry) => entry.id),
  };
}

function computeProjectionParity(variants) {
  const projectionRows = variants.filter((entry) => entry.eventCountKind === 'projected-records');
  for (const row of projectionRows) {
    if (row.eventCount <= 0 || !Number.isFinite(row.checksum)) {
      throw new Error(`Projection variant ${row.id} did not produce projected record evidence.`);
    }
  }
  return {
    status: projectionRows.length > 0 ? 'ok' : 'not-applicable',
    rowIds: projectionRows.map((entry) => entry.id),
  };
}

function computeFullStringParity(variants) {
  const fullRows = variants.filter((entry) => entry.fullStringParity);
  const first = fullRows[0];
  if (!first) {
    return {
      status: 'not-applicable',
      rowIds: [],
      eventCount: null,
      checksum: null,
    };
  }
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

function createFindings(variants, fixture) {
  const partialRows = variants.filter((entry) => entry.family === 'partial-upper-bound');
  const semanticRows = variants.filter((entry) => entry.family === 'semantic-upper-bound');
  const fullRows = variants.filter((entry) => entry.fullStringParity);
  const projectionRows = variants.filter((entry) => entry.eventCountKind === 'projected-records');
  const fastestPartial = maxBy(partialRows, (entry) => entry.mibPerSec);
  const fastestFull = maxBy(fullRows, (entry) => entry.mibPerSec);
  const rawNameId = variants.find((entry) => entry.id === 'rawFrameNameId');
  const foldTrim = variants.find((entry) => entry.id === 'rawFrameNameIdFoldTrim');
  const findings = [
    {
      id: 'source-consumption-contract',
      summary: 'The large Node/Bun matrix isolates parser/materialization cost behind synchronous Iterable<Uint8Array[]> batch pulls, not direct ReadableStream async iteration.',
      evidence: [
        'StreamReaderSync(byteBatches(fixture)) is the measured input boundary.',
        'byteBatches(fixture) yields one grouped batch per parser pull.',
        'Direct browser ReadableStream and async byte-batch fetch rows live in browser-candidate-headroom.',
      ],
    },
    {
      id: 'bounded-memory-contract',
      summary: fixture.source === 'corpus-file'
        ? 'Rows consume corpus-backed Uint8Array batches and do not load a full XML string.'
        : 'Rows consume generated Uint8Array batches and do not load a full XML string.',
      evidence: fullRows.map((entry) => `${entry.id}: maxRSS=${formatBytes(entry.memory.maxRssBytes)}`),
    },
    {
      id: 'contract-separation',
      summary: 'Partial rows deliberately drop one or more string fields and are not StAX parity rows.',
      evidence: partialRows.map((entry) => `${entry.id}: ${entry.contractScope}, strings=${entry.materializationCounters.stringFieldReads}`),
    },
    {
      id: 'semantic-no-string-upper-bound',
      summary: 'Semantic checksum rows fold the same fields and checksum without string materialization on ASCII spans, but they are not StAX full-string materialization rows.',
      evidence: semanticRows.length
        ? semanticRows.map((entry) => `${entry.id}: ${formatRate(entry.mibPerSec)}, checksum=${entry.checksum}, semanticByteFields=${entry.materializationCounters.semanticByteFoldFields}, fallbacks=${entry.materializationCounters.semanticByteFoldFallbacks}`)
        : ['semantic-upper-bound=missing'],
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
  if (rawNameId && foldTrim) {
    findings.push({
      id: 'fold-trim-text-checksum-candidate',
      summary: 'rawFrameNameIdFoldTrim materializes the same text strings but folds trimmed checksum ranges without allocating value.trim().',
      evidence: [
        `rawFrameNameId=${formatRate(rawNameId.mibPerSec)}`,
        `rawFrameNameIdFoldTrim=${formatRate(foldTrim.mibPerSec)}`,
        `sameChecksum=${foldTrim.checksum === rawNameId.checksum}`,
        `sameStringReads=${foldTrim.materializationCounters.stringFieldReads === rawNameId.materializationCounters.stringFieldReads}`,
        `sameRawSpanMaterializations=${foldTrim.materializationCounters.rawSpanMaterializations === rawNameId.materializationCounters.rawSpanMaterializations}`,
      ],
    });
  }
  if (fixture.source === 'corpus-file') {
    findings.push({
      id: 'corpus-cycle-fixture',
      summary: 'The fixture repeats a real XML corpus seed as byte batches rather than synthesized element rows.',
      evidence: [
        `sourceFile=${fixture.sourceFile}`,
        `sourceBytes=${fixture.rows[0].byteLength}`,
        `actualBytes=${fixture.actualBytes}`,
      ],
    });
  }
  if (projectionRows.length > 0) {
    findings.push({
      id: 'projection-contract',
      summary: 'Projection rows report projected record counts and selected-field checksums, not full StAX event parity.',
      evidence: projectionRows.map((entry) => `${entry.id}: records=${entry.eventCount}, checksum=${entry.checksum}, strings=${entry.materializationCounters.stringFieldReads}`),
    });
  }
  return findings;
}

function consumeStreamSelective(fixture, fields) {
  const materializationCounters = createMaterializationCounters();
  let eventCount = 0;
  let checksum = 0;

  for (const batch of new StreamReaderSync(byteBatches(fixture))) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const type = batch.typeAt(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (fields.name && (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT)) {
        countStringField(materializationCounters, 'name');
        checksum = foldString(checksum, batch.nameAt(index));
      }
      if (fields.text && (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA)) {
        countStringField(materializationCounters, 'text');
        checksum = foldString(checksum, batch.textAt(index)?.trim());
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrCount = batch.attributeCountAt(index);
        materializationCounters.attributePairs += attrCount;
        checksum = mixChecksum(checksum, attrCount);
        if (!fields.attrName && !fields.attrValue) {
          continue;
        }
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          if (fields.attrName) {
            countStringField(materializationCounters, 'attrName');
            checksum = foldString(checksum, batch.attributeNameAt(index, attrIndex));
          }
          if (fields.attrValue) {
            countStringField(materializationCounters, 'attrValue');
            checksum = foldString(checksum, batch.attributeValueAt(index, attrIndex));
          }
        }
      }
    }
  }

  return { eventCount, checksum, materializationCounters };
}

function consumeCursorAccessor(fixture) {
  const materializationCounters = createMaterializationCounters();
  const cursor = new BatchCursor();
  let eventCount = 0;
  let checksum = 0;

  for (const batch of new StreamReaderSync(byteBatches(fixture))) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      cursor.set(batch, index);
      const type = cursor.type();
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        countStringField(materializationCounters, 'name');
        checksum = foldString(checksum, cursor.name());
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        countStringField(materializationCounters, 'text');
        checksum = foldString(checksum, cursor.text()?.trim());
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrCount = cursor.getAttributeCount();
        materializationCounters.attributePairs += attrCount;
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          countStringField(materializationCounters, 'attrName');
          checksum = foldString(checksum, cursor.getAttributeName(attrIndex));
          countStringField(materializationCounters, 'attrValue');
          checksum = foldString(checksum, cursor.getAttributeValue(attrIndex));
        }
      }
    }
  }

  return { eventCount, checksum, materializationCounters };
}

function consumeEventObjectFull(fixture) {
  const materializationCounters = createMaterializationCounters();
  const objectSink = new Array(1024);
  let objectSinkIndex = 0;
  let eventCount = 0;
  let checksum = 0;

  for (const batch of new StreamReaderSync(byteBatches(fixture))) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const event = materializePublicEventObject(batch, index, materializationCounters);
      objectSink[objectSinkIndex & (objectSink.length - 1)] = event;
      objectSinkIndex++;

      eventCount++;
      checksum = mixChecksum(checksum, publicEventTypeCode(event.type));

      if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
        checksum = foldString(checksum, event.name);
      }
      if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
        checksum = foldString(checksum, event.value?.trim());
      }
      if (event.type === XmlEventType.START_ELEMENT) {
        const entries = Object.entries(event.attributes);
        materializationCounters.attributePairs += entries.length;
        checksum = mixChecksum(checksum, entries.length);
        for (const [name, value] of entries) {
          checksum = foldString(checksum, name);
          checksum = foldString(checksum, value);
        }
      }
    }
  }

  globalThis.__staxCandidateEventObjectSink = objectSink[(objectSinkIndex - 1) & (objectSink.length - 1)];
  return { eventCount, checksum, materializationCounters };
}

function consumeProjectionSelectivity(fixture, projection) {
  const materializationCounters = createMaterializationCounters();
  let records = 0;
  let checksum = 2166136261;

  projectXmlSync(byteBatches(fixture), projection, {
    onRecord(record) {
      records++;
      materializationCounters.projectedRecords++;
      materializationCounters.projectionFieldReads += 2;
      countStringField(materializationCounters, 'attrValue');
      countStringField(materializationCounters, 'text');
      checksum = foldString(foldString(checksum, record.id), record.title);
    },
  });

  return { eventCount: records, checksum, materializationCounters };
}

function materializePublicEventObject(batch, index, materializationCounters) {
  const type = batch.typeAt(index);
  materializationCounters.eventObjects++;
  switch (type) {
    case StreamEventType.START_DOCUMENT:
      return { type: XmlEventType.START_DOCUMENT };
    case StreamEventType.END_DOCUMENT:
      return { type: XmlEventType.END_DOCUMENT };
    case StreamEventType.START_ELEMENT: {
      countStringField(materializationCounters, 'name');
      const name = batch.nameAt(index);
      const attrCount = batch.attributeCountAt(index);
      const attributes = {};
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        countStringField(materializationCounters, 'attrName');
        const attrName = batch.attributeNameAt(index, attrIndex);
        countStringField(materializationCounters, 'attrValue');
        attributes[attrName] = batch.attributeValueAt(index, attrIndex);
      }
      return {
        type: XmlEventType.START_ELEMENT,
        name,
        attributes,
      };
    }
    case StreamEventType.END_ELEMENT:
      countStringField(materializationCounters, 'name');
      return {
        type: XmlEventType.END_ELEMENT,
        name: batch.nameAt(index),
      };
    case StreamEventType.CHARACTERS:
      countStringField(materializationCounters, 'text');
      return {
        type: XmlEventType.CHARACTERS,
        value: batch.textAt(index),
      };
    case StreamEventType.CDATA:
      countStringField(materializationCounters, 'text');
      return {
        type: XmlEventType.CDATA,
        value: batch.textAt(index),
      };
    default:
      throw new Error(`Unsupported stream event type: ${type}`);
  }
}

function publicEventTypeCode(type) {
  switch (type) {
    case XmlEventType.START_DOCUMENT:
      return StreamEventType.START_DOCUMENT;
    case XmlEventType.END_DOCUMENT:
      return StreamEventType.END_DOCUMENT;
    case XmlEventType.START_ELEMENT:
      return StreamEventType.START_ELEMENT;
    case XmlEventType.END_ELEMENT:
      return StreamEventType.END_ELEMENT;
    case XmlEventType.CHARACTERS:
      return StreamEventType.CHARACTERS;
    case XmlEventType.CDATA:
      return StreamEventType.CDATA;
    default:
      throw new Error(`Unsupported public event type: ${type}`);
  }
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

function consumeRawFrameStyle(fixture, nameCache, valueCache, options = {}) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const parser = new StreamReaderSync(byteBatches(fixture));
  const materializationCounters = createMaterializationCounters();
  let eventCount = 0;
  let checksum = 0;
  let frame;

  while ((frame = parser.nextRawBatch()) !== null) {
    const result = consumeRawFrame(frame, checksum, eventCount, decoder, nameCache, valueCache, materializationCounters, options);
    checksum = result.checksum;
    eventCount = result.eventCount;
  }

  return { eventCount, checksum, materializationCounters };
}

function consumeRawFrameSemanticChecksumStyle(fixture) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const parser = new StreamReaderSync(byteBatches(fixture));
  const materializationCounters = createMaterializationCounters();
  let checksum = 0;
  let eventCount = 0;
  let frame;

  while ((frame = parser.nextRawBatch()) !== null) {
    const result = consumeRawFrameSemanticChecksum(frame, checksum, eventCount, decoder, materializationCounters);
    checksum = result.checksum;
    eventCount = result.eventCount;
  }

  return { eventCount, checksum, materializationCounters };
}

function consumeRawFrame(frame, checksum, eventCount, decoder, nameCache, valueCache, materializationCounters, options = {}) {
  if (frame.kind !== 'frame') {
    throw new Error(`Unsupported raw batch kind in large candidate matrix: ${frame.kind}`);
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
      countStringField(materializationCounters, 'name');
      checksum = foldString(
        checksum,
        materializeName(buffer, nameStarts[index], nameEnds[index], nameIds[index], decoder, nameCache, materializationCounters, 'name'),
      );
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      const start = textStarts[index];
      if (start >= 0) {
        countStringField(materializationCounters, 'text');
        const value = materializeValue(buffer, start, textEnds[index], decoder, valueCache, materializationCounters, 'text');
        checksum = options.foldTrimmedText ? foldTrimmedString(checksum, value) : foldString(checksum, value.trim());
      }
    }
    if (type === StreamEventType.START_ELEMENT) {
      const attrStart = attrStarts[index];
      const attrCount = attrCounts[index];
      materializationCounters.attributePairs += attrCount;
      checksum = mixChecksum(checksum, attrCount);
      const attrEnd = attrStart + attrCount;
      for (let attrIndex = attrStart; attrIndex < attrEnd; attrIndex++) {
        countStringField(materializationCounters, 'attrName');
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
        countStringField(materializationCounters, 'attrValue');
        const value = isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, attrIndex)
          ? countImplicitAttributeValue(materializationCounters)
          : materializeValue(
            buffer,
            attrValueStarts[attrIndex],
            attrValueEnds[attrIndex],
            decoder,
            valueCache,
            materializationCounters,
            'attrValue',
          );
        checksum = foldString(checksum, value);
      }
    }
  }

  return { eventCount, checksum };
}

function consumeRawFrameSemanticChecksum(frame, checksum, eventCount, decoder, materializationCounters) {
  if (frame.kind !== 'frame') {
    throw new Error(`Unsupported raw batch kind in large candidate matrix: ${frame.kind}`);
  }

  const {
    buffer,
    eventTypes,
    nameStarts,
    nameEnds,
    textStarts,
    textEnds,
    attrStarts,
    attrCounts,
    attrNameStarts,
    attrNameEnds,
    attrValueStarts,
    attrValueEnds,
  } = frame;
  const count = frame.eventCount;

  for (let index = 0; index < count; index++) {
    const type = eventTypes[index];
    eventCount++;
    checksum = mixChecksum(checksum, type);

    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      checksum = foldSemanticSpan(checksum, buffer, nameStarts[index], nameEnds[index], decoder, materializationCounters, 'name');
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      const start = textStarts[index];
      if (start >= 0) {
        checksum = foldSemanticSpan(checksum, buffer, start, textEnds[index], decoder, materializationCounters, 'text', true);
      }
    }
    if (type === StreamEventType.START_ELEMENT) {
      const attrStart = attrStarts[index];
      const attrCount = attrCounts[index];
      materializationCounters.attributePairs += attrCount;
      checksum = mixChecksum(checksum, attrCount);
      const attrEnd = attrStart + attrCount;
      for (let attrIndex = attrStart; attrIndex < attrEnd; attrIndex++) {
        checksum = foldSemanticSpan(
          checksum,
          buffer,
          attrNameStarts[attrIndex],
          attrNameEnds[attrIndex],
          decoder,
          materializationCounters,
          'attrName',
        );
        if (isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, attrIndex)) {
          materializationCounters.implicitAttrValueReads++;
        } else {
          checksum = foldSemanticSpan(
            checksum,
            buffer,
            attrValueStarts[attrIndex],
            attrValueEnds[attrIndex],
            decoder,
            materializationCounters,
            'attrValue',
          );
        }
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
      materializationCounters.rawNameCacheHits++;
      return cached;
    }
    materializationCounters.rawNameCacheMisses++;
    const value = decodeSpan(buffer, start, end, decoder, materializationCounters, kind);
    nameCache[nameId] = value;
    return value;
  }
  return decodeSpan(buffer, start, end, decoder, materializationCounters, kind);
}

function materializeValue(buffer, start, end, decoder, valueCache, materializationCounters, kind) {
  if (!valueCache) {
    return decodeSpan(buffer, start, end, decoder, materializationCounters, kind);
  }
  const cached = valueCache.get(buffer, start, end);
  if (cached !== undefined) {
    materializationCounters.rawValueCacheHits++;
    return cached;
  }
  materializationCounters.rawValueCacheMisses++;
  const value = decodeSpan(buffer, start, end, decoder, materializationCounters, kind);
  valueCache.set(buffer, start, end, value);
  return value;
}

class SpanStringCache {
  constructor(maxStoredBytes = 4 * 1024 * 1024) {
    this.maxStoredBytes = maxStoredBytes;
  }

  buckets = new Map();
  maxStoredBytes;
  storedBytes = 0;

  get(buffer, start, end) {
    const length = end - start;
    const hash = hashSpan(buffer, start, end);
    const bucket = this.buckets.get(`${length}:${hash}`);
    if (bucket === undefined) {
      return undefined;
    }
    for (const entry of bucket) {
      if (spanEquals(buffer, start, end, entry.bytes)) {
        return entry.value;
      }
    }
    return undefined;
  }

  set(buffer, start, end, value) {
    const length = end - start;
    if (this.storedBytes + length > this.maxStoredBytes) {
      return;
    }
    const hash = hashSpan(buffer, start, end);
    const key = `${length}:${hash}`;
    const bucket = this.buckets.get(key);
    const bytes = buffer.slice(start, end);
    this.storedBytes += bytes.byteLength;
    if (bucket === undefined) {
      this.buckets.set(key, [{ bytes, value }]);
      return;
    }
    bucket.push({ bytes, value });
  }
}

function hashSpan(buffer, start, end) {
  let hash = 2166136261;
  for (let index = start; index < end; index++) {
    hash = Math.imul((hash ^ buffer[index]) >>> 0, 16777619) >>> 0;
  }
  return hash;
}

function spanEquals(buffer, start, end, bytes) {
  const length = end - start;
  if (bytes.byteLength !== length) {
    return false;
  }
  for (let index = 0; index < length; index++) {
    if (buffer[start + index] !== bytes[index]) {
      return false;
    }
  }
  return true;
}

function foldSemanticSpan(seed, buffer, start, end, decoder, materializationCounters, kind, trim = false) {
  incrementSemanticByteFoldField(materializationCounters, kind);
  const [trimmedStart, trimmedEnd] = trim ? trimAsciiWhitespace(buffer, start, end) : [start, end];
  if (canFoldAsciiSpan(buffer, trimmedStart, trimmedEnd)) {
    return foldAsciiSpan(seed, buffer, trimmedStart, trimmedEnd);
  }
  materializationCounters.semanticByteFoldFallbacks++;
  const value = decodeSpan(buffer, start, end, decoder, materializationCounters, kind);
  return foldString(seed, trim ? value.trim() : value);
}

function canFoldAsciiSpan(buffer, start, end) {
  for (let index = start; index < end; index++) {
    if (buffer[index] > 0x7f) {
      return false;
    }
  }
  return true;
}

function foldAsciiSpan(seed, buffer, start, end) {
  let next = seed;
  for (let index = start; index < end; index++) {
    next = ((next << 5) - next + buffer[index]) | 0;
  }
  return next;
}

function trimAsciiWhitespace(buffer, start, end) {
  let trimmedStart = start;
  let trimmedEnd = end;
  while (trimmedStart < trimmedEnd && isAsciiXmlWhitespace(buffer[trimmedStart])) {
    trimmedStart++;
  }
  while (trimmedEnd > trimmedStart && isAsciiXmlWhitespace(buffer[trimmedEnd - 1])) {
    trimmedEnd--;
  }
  return [trimmedStart, trimmedEnd];
}

function isAsciiXmlWhitespace(value) {
  return value === 0x20 || value === 0x09 || value === 0x0a || value === 0x0d;
}

function decodeSpan(buffer, start, end, decoder, materializationCounters, kind) {
  countRawSpanMaterialization(materializationCounters, kind);
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
    rawValueCacheHits: 0,
    rawValueCacheMisses: 0,
    semanticByteFoldFields: 0,
    semanticNameByteFoldFields: 0,
    semanticTextByteFoldFields: 0,
    semanticAttrNameByteFoldFields: 0,
    semanticAttrValueByteFoldFields: 0,
    semanticByteFoldFallbacks: 0,
    implicitAttrValueReads: 0,
    eventObjects: 0,
    projectedRecords: 0,
    projectionFieldReads: 0,
    attributePairs: 0,
  };
}

function incrementSemanticByteFoldField(counters, kind) {
  counters.semanticByteFoldFields++;
  switch (kind) {
    case 'name':
      counters.semanticNameByteFoldFields++;
      break;
    case 'text':
      counters.semanticTextByteFoldFields++;
      break;
    case 'attrName':
      counters.semanticAttrNameByteFoldFields++;
      break;
    case 'attrValue':
      counters.semanticAttrValueByteFoldFields++;
      break;
  }
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
  counters.implicitAttrValueReads++;
  return 'true';
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

function createFixtureRows(shape, cycleSize, corpusFile) {
  if (shape === 'repeated-person') {
    return [textEncoder.encode(makeRepeatedPersonRow())];
  }
  if (shape === 'corpus-cycle') {
    return [readCorpusSeed(corpusFile)];
  }
  if (shape === 'projection-cycle') {
    return Array.from({ length: cycleSize }, (_, id) => textEncoder.encode(makeProjectionRow(id)));
  }
  return Array.from({ length: cycleSize }, (_, id) => textEncoder.encode(makeDiverseRow(id)));
}

function readCorpusSeed(corpusFile) {
  const bytes = readFileSync(corpusFile);
  if (bytes.byteLength === 0) {
    throw new Error(`Corpus fixture is empty: ${corpusFile}`);
  }
  return new Uint8Array(bytes);
}

function createRowPreview(row) {
  return textDecoder.decode(row.subarray(0, Math.min(row.byteLength, 512)));
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

function makeProjectionRow(id) {
  const code = id % 97;
  return `<root><book id="book-${id}" lang="en" code="${code}">`
    + `<title>Projection Benchmark ${id}</title>`
    + `<author>Author ${id % 113}</author>`
    + `<description>Repeated projection benchmark payload ${id} with stable ASCII text. The projection row ignores this field.</description>`
    + `<chapter number="1">Intro ${id}</chapter>`
    + `<chapter number="2">Body ${(id * 17) % 104729}</chapter>`
    + '</book></root>';
}

function summarizeRows(rowList) {
  const rowBytes = rowList.map((entry) => entry.byteLength);
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

function foldTrimmedString(seed, value) {
  if (!value) {
    return seed;
  }
  let start = 0;
  let end = value.length;
  while (start < end && isXmlWhitespaceCodeUnit(value.charCodeAt(start))) {
    start++;
  }
  while (end > start && isXmlWhitespaceCodeUnit(value.charCodeAt(end - 1))) {
    end--;
  }
  let next = seed;
  for (let index = start; index < end; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}

function isXmlWhitespaceCodeUnit(value) {
  return value === 0x20 || value === 0x09 || value === 0x0a || value === 0x0d;
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

function formatRuntime(environment) {
  if (environment.runtimeName === 'bun') {
    return `Bun ${environment.bunVersion}, JavaScriptCore WebKit ${environment.webkitCommit}`;
  }
  return `Node ${environment.node}, V8 ${environment.v8}`;
}

function renderMarkdown(report) {
  const corpusBacked = report.fixture.source === 'corpus-file';
  const hasProjectionRows = report.projectionParity.status === 'ok';
  const lines = [
    '# Large Candidate Headroom Matrix',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    corpusBacked
      ? 'This experiment is a 1 GiB+ bounded-memory counterexample search over corpus-backed `Uint8Array` batches.'
      : 'This experiment is a 1 GiB+ bounded-memory counterexample search over generated `Uint8Array` batches.',
    'Partial rows intentionally skip one or more string fields and therefore cannot be used as StAX full-materialization counterexamples.',
    'Full rows preserve the event, name, text/CDATA, attribute name, attribute value, and UTF-16 checksum contract.',
    ...(hasProjectionRows
      ? ['Projection rows report projected record counts and selected-field checksums; they are workload headroom rows, not full StAX parity rows.']
      : []),
    'The neutral path uses `Uint8Array` plus `TextDecoder`; it does not use native addons, Node `Buffer.toString()`, or lazy getters.',
    '',
    '## Source Consumption',
    '',
    `- Parser input: ${report.sourceContract.parserInput}`,
    `- Batch/backpressure: ${report.sourceContract.batchBackpressure}`,
    `- ReadableStream scope: ${report.sourceContract.readableStreamScope}`,
    `- Corpus scope: ${report.sourceContract.corpusScope}`,
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
    `- Row bytes: min=${report.fixture.minRowBytes}, max=${report.fixture.maxRowBytes}, avg=${report.fixture.averageRowBytes.toFixed(1)}`,
    `- Batch size: ${report.fixture.batchSize}`,
    `- Cases: ${report.options.cases?.join(', ') ?? 'all'}`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    `- Bounded RSS reporting gate: ${report.options.boundedRssMiB.toFixed(1)} MiB`,
    '',
    '## Woodstox Target',
    '',
    ...renderWoodstoxTarget(report.woodstoxTarget),
    '',
    '## Results',
    '',
    '| Variant | Family | Contract scope | Count kind | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Bounded memory | Counterexample | Events | Checksum | Full parity |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: | ---: | --- |',
  ];
  for (const entry of report.variants) {
    lines.push(
      `| ${entry.id} | ${entry.family} | ${entry.contractScope} | ${entry.eventCountKind} | ${formatRate(entry.mibPerSec)} | `
      + `${entry.relativeToStringFull.toFixed(2)}x | ${formatOptionalRatio(entry.woodstoxRatio)} | ${entry.targetStatus} | `
      + `${entry.boundedMemory ? 'yes' : 'no'} | ${entry.counterexampleStatus} | ${entry.eventCount} | ${entry.checksum} | `
      + `${entry.fullStringParity ? 'yes' : 'no'} |`,
    );
  }

  if (report.options.runs > 1) {
    lines.push('');
    lines.push('## Timing Stability');
    lines.push('');
    lines.push('Rows with `runs > 1` report same-process timing spread; this is variance evidence for the recorded machine, not a cross-process statistical proof.');
    lines.push('');
    lines.push('| Variant | Runs | Avg ms | Min ms | Max ms | Spread | Samples ms |');
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: | --- |');
    for (const entry of report.variants) {
      lines.push(
        `| ${entry.id} | ${entry.samplesMs.length} | ${formatMs(entry.avgMs)} | ${formatMs(entry.minMs)} | `
        + `${formatMs(entry.maxMs)} | ${formatPercent(timingSpreadRatio(entry))} | ${formatSamplesMs(entry.samplesMs)} |`,
      );
    }
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
  lines.push('Counters are collected inside the measured large-input loop to avoid a second 1 GiB+ pass.');
  lines.push('');
  lines.push('| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Value cache hit/miss | Semantic byte fields/fallbacks | Event objects | Projected records | Projection fields | Attribute pairs |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const entry of report.variants) {
    const counters = entry.materializationCounters;
    lines.push(
      `| ${entry.id} | ${formatCount(counters.stringFieldReads)} | ${formatCount(counters.nameStringReads)} | `
      + `${formatCount(counters.textStringReads)} | ${formatCount(counters.attrNameStringReads)} | `
      + `${formatCount(counters.attrValueStringReads)} | ${formatCount(counters.rawSpanMaterializations)} | `
      + `${formatCount(counters.rawNameCacheHits)}/${formatCount(counters.rawNameCacheMisses)} | `
      + `${formatCount(counters.rawValueCacheHits)}/${formatCount(counters.rawValueCacheMisses)} | `
      + `${formatCount(counters.semanticByteFoldFields)}/${formatCount(counters.semanticByteFoldFallbacks)} | `
      + `${formatCount(counters.eventObjects)} | ${formatCount(counters.projectedRecords)} | `
      + `${formatCount(counters.projectionFieldReads)} | ${formatCount(counters.attributePairs)} |`,
    );
  }

  lines.push('');
  lines.push('## Omitted Rows');
  lines.push('');
  if (report.omittedRows.length === 0) {
    lines.push('- none');
  } else {
    for (const row of report.omittedRows) {
      lines.push(`- ${row.id}: ${row.reason}`);
    }
  }

  lines.push('');
  lines.push('## Parity');
  lines.push('');
  lines.push(
    hasProjectionRows
      ? `Stream-event rows event-count parity: ${report.eventCountParity.status}, events=${report.eventCountParity.eventCount}.`
      : `All rows event-count parity: ${report.eventCountParity.status}, events=${report.eventCountParity.eventCount}.`,
  );
  lines.push(
    `Full-string parity rows: ${report.fullStringParity.status}, events=${report.fullStringParity.eventCount}, `
    + `checksum=${report.fullStringParity.checksum}, rows=${report.fullStringParity.rowIds.join(', ')}.`,
  );
  if (hasProjectionRows) {
    lines.push(
      `Projection rows report projected record counts: ${report.projectionParity.status}, rows=${report.projectionParity.rowIds.join(', ')}.`,
    );
    lines.push('Projection low selectivity selects `/root/book[@code="7"]` and captures `@id` plus direct `title` text.');
    lines.push('Projection high selectivity selects every `/root/book` and captures `@id` plus direct `title` text.');
  }
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
  console.log('Large candidate headroom matrix');
  console.log(`fixture=${report.fixture.shape} size=${formatBytes(report.fixture.actualBytes)} runs=${report.options.runs}`);
  for (const entry of report.variants) {
    console.log(
      `${entry.id.padEnd(22)} ${formatRate(entry.mibPerSec).padStart(14)} `
      + `family=${entry.family} bounded=${entry.boundedMemory ? 'yes' : 'no'} counterexample=${entry.counterexampleStatus} `
      + `strings=${entry.materializationCounters.stringFieldReads} maxRSS=${formatBytes(entry.memory.maxRssBytes)} `
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
  return `${value.toFixed(2)} MiB/s`;
}

function formatOptionalRate(value) {
  return value == null ? 'n/a' : formatRate(value);
}

function formatOptionalRatio(value) {
  return value == null ? 'n/a' : `${value.toFixed(2)}x`;
}

function timingSpreadRatio(entry) {
  return entry.avgMs > 0 ? (entry.maxMs - entry.minMs) / entry.avgMs : 0;
}

function formatMs(value) {
  return value.toFixed(2);
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSamplesMs(values) {
  return values.map(formatMs).join(', ');
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
