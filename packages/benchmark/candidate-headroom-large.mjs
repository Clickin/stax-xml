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
const stringFieldsWithoutElementNames = Object.freeze({
  name: false,
  text: true,
  attrName: true,
  attrValue: true,
});
const stringFieldsWithoutText = Object.freeze({
  name: true,
  text: false,
  attrName: true,
  attrValue: true,
});
const stringFieldsWithoutAttributeNames = Object.freeze({
  name: true,
  text: true,
  attrName: false,
  attrValue: true,
});
const stringFieldsWithoutAttributeValues = Object.freeze({
  name: true,
  text: true,
  attrName: true,
  attrValue: false,
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
  const variants = filterVariants(createVariants(fixture, options.cases), options.cases);
  const results = variants.map((variant) => measureVariant(variant, fixture, options));
  const report = createReport(fixture, options, results);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function createVariants(fixture, requestedCases = null) {
  const requested = new Set(requestedCases ?? []);
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
      id: 'withoutElementNameStrings',
      family: 'near-full-upper-bound',
      implementation: 'StreamBatch index accessors over generated byte batches excluding element name string reads',
      contractScope: 'full-materialization-minus-element-names',
      fullStringParity: false,
      run: () => consumeStreamSelective(fixture, stringFieldsWithoutElementNames),
    },
    {
      id: 'withoutTextStrings',
      family: 'near-full-upper-bound',
      implementation: 'StreamBatch index accessors over generated byte batches excluding text/CDATA string reads',
      contractScope: 'full-materialization-minus-text-cdata',
      fullStringParity: false,
      run: () => consumeStreamSelective(fixture, stringFieldsWithoutText),
    },
    {
      id: 'withoutAttributeNameStrings',
      family: 'near-full-upper-bound',
      implementation: 'StreamBatch index accessors over generated byte batches excluding attribute name string reads',
      contractScope: 'full-materialization-minus-attribute-names',
      fullStringParity: false,
      run: () => consumeStreamSelective(fixture, stringFieldsWithoutAttributeNames),
    },
    {
      id: 'withoutAttributeValueStrings',
      family: 'near-full-upper-bound',
      implementation: 'StreamBatch index accessors over generated byte batches excluding attribute value string reads',
      contractScope: 'full-materialization-minus-attribute-values',
      fullStringParity: false,
      run: () => consumeStreamSelective(fixture, stringFieldsWithoutAttributeValues),
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
    ...(requested.has('rawFrameNameIdNoCounters')
      ? [{
          id: 'rawFrameNameIdNoCounters',
          family: 'full-stax-js',
          implementation: 'nextRawBatch typed arrays with numeric name-id cache and materialization counters disabled',
          contractScope: 'full-string-materialization',
          fullStringParity: true,
          instrumentation: 'materialization-counters-disabled',
          run: () => consumeRawFrameNameIdNoCountersStyle(fixture),
        }]
      : []),
    ...(requested.has('rawFrameNameIdNoCountersFoldTrim')
      ? [{
          id: 'rawFrameNameIdNoCountersFoldTrim',
          family: 'full-stax-js',
          implementation: 'nextRawBatch typed arrays with numeric name-id cache, counters disabled, and direct trimmed text checksum folding',
          contractScope: 'full-string-materialization',
          fullStringParity: true,
          instrumentation: 'materialization-counters-disabled',
          run: () => consumeRawFrameNameIdNoCountersStyle(fixture, { foldTrimmedText: true }),
        }]
      : []),
    ...(requested.has('rawFrameNameIdNoCountersTextCache')
      ? [{
          id: 'rawFrameNameIdNoCountersTextCache',
          family: 'full-stax-js',
          implementation: 'nextRawBatch typed arrays with numeric name-id cache, counters disabled, and bounded text/CDATA span string cache',
          contractScope: 'full-string-materialization',
          fullStringParity: true,
          instrumentation: 'materialization-counters-disabled',
          run: () => consumeRawFrameNameIdNoCountersStyle(fixture, { textCache: new SpanStringCache() }),
        }]
      : []),
    ...(requested.has('rawFrameNameIdNoCountersValueCache')
      ? [{
          id: 'rawFrameNameIdNoCountersValueCache',
          family: 'full-stax-js',
          implementation: 'nextRawBatch typed arrays with numeric name-id cache, counters disabled, and bounded text/attribute-value span string cache',
          contractScope: 'full-string-materialization',
          fullStringParity: true,
          instrumentation: 'materialization-counters-disabled',
          run: () => consumeRawFrameNameIdNoCountersStyle(fixture, { valueCache: new SpanStringCache() }),
        }]
      : []),
    ...(requested.has('rawFrameNameIdNoCountersNameFoldCache')
      ? [{
          id: 'rawFrameNameIdNoCountersNameFoldCache',
          family: 'full-stax-js',
          implementation: 'nextRawBatch typed arrays with numeric name-id cache, counters disabled, and cached checksum transforms for repeated name strings',
          contractScope: 'full-string-materialization',
          fullStringParity: true,
          instrumentation: 'materialization-counters-disabled',
          run: () => consumeRawFrameNameIdNoCountersStyle(fixture, { nameFoldCache: [] }),
        }]
      : []),
    ...(requested.has('rawFrameNameIdNoCountersStringFoldCache')
      ? [{
          id: 'rawFrameNameIdNoCountersStringFoldCache',
          family: 'full-stax-js',
          implementation: 'nextRawBatch typed arrays with numeric name-id cache, counters disabled, and cached checksum transforms for repeated string values',
          contractScope: 'full-string-materialization',
          fullStringParity: true,
          instrumentation: 'materialization-counters-disabled',
          run: () => consumeRawFrameNameIdNoCountersStyle(fixture, { nameFoldCache: [], stringFoldCache: new Map() }),
        }]
      : []),
    ...(requested.has('rawFrameNameIdNoCountersNameFoldCacheFoldTrim')
      ? [{
          id: 'rawFrameNameIdNoCountersNameFoldCacheFoldTrim',
          family: 'full-stax-js',
          implementation: 'nextRawBatch typed arrays with numeric name-id cache, counters disabled, cached checksum transforms for repeated name strings, and direct trimmed text checksum folding',
          contractScope: 'full-string-materialization',
          fullStringParity: true,
          instrumentation: 'materialization-counters-disabled',
          run: () => consumeRawFrameNameIdNoCountersStyle(fixture, { nameFoldCache: [], foldTrimmedText: true }),
        }]
      : []),
    ...(requested.has('rawFrameNameIdNoTrim')
      ? [{
          id: 'rawFrameNameIdNoTrim',
          family: 'near-full-upper-bound',
          implementation: 'nextRawBatch typed arrays with numeric name-id cache and text materialization without trim',
          contractScope: 'full-materialization-minus-text-trim',
          fullStringParity: false,
          run: () => consumeRawFrameStyle(fixture, [], undefined, { trimText: false }),
        }]
      : []),
    ...(requested.has('rawFrameNameIdTextLengthOnly')
      ? [{
          id: 'rawFrameNameIdTextLengthOnly',
          family: 'near-full-upper-bound',
          implementation: 'nextRawBatch typed arrays with numeric name-id cache, full text materialization, and text length checksum only',
          contractScope: 'full-materialization-minus-text-code-unit-fold',
          fullStringParity: false,
          run: () => consumeRawFrameTextUseStyle(fixture, 'length-only'),
        }]
      : []),
    ...(requested.has('rawFrameNameIdTextNoFold')
      ? [{
          id: 'rawFrameNameIdTextNoFold',
          family: 'near-full-upper-bound',
          implementation: 'nextRawBatch typed arrays with numeric name-id cache and full text materialization excluded from checksum',
          contractScope: 'full-materialization-minus-text-checksum',
          fullStringParity: false,
          run: () => consumeRawFrameTextUseStyle(fixture, 'none'),
        }]
      : []),
    {
      id: 'rawFrameNameIdLongAsciiText',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache and manual long ASCII text string materialization',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, [], undefined, { longAsciiText: true }),
    },
    {
      id: 'rawFrameNameIdMediumAsciiText',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache and split short ASCII text materialization for 13-24 byte spans',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, [], undefined, { mediumAsciiText: true }),
    },
    {
      id: 'rawFrameNameIdUnrolledMediumAsciiText',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache and direct unrolled ASCII text materialization for 13-24 byte spans',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, [], undefined, { unrolledMediumAsciiText: true }),
    },
    {
      id: 'rawFrameNameIdUnrolledMediumAsciiTextTrimGuard',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache, direct unrolled ASCII text materialization for 13-24 byte spans, and byte-boundary trim guard',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, [], undefined, { unrolledMediumAsciiText: true, trimGuard: true }),
    },
    {
      id: 'rawFrameNameIdMediumAsciiAttrValue',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache and split short ASCII attribute-value materialization for 13-24 byte spans',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, [], undefined, { mediumAsciiAttrValue: true }),
    },
    {
      id: 'rawFrameNameIdAttrValueCache',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache plus bounded attribute-value span string cache',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, [], undefined, { attrValueCache: new SpanStringCache() }),
    },
    {
      id: 'rawFrameNameIdTextCache',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache plus bounded text/CDATA span string cache',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, [], undefined, { textCache: new SpanStringCache() }),
    },
    {
      id: 'rawFrameNameIdOffsetTextCache',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache plus buffer-identity offset text/CDATA span string cache',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, [], undefined, { textCache: new OffsetSpanStringCache() }),
    },
    {
      id: 'rawFrameNameIdTrimGuard',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache and byte-boundary text trim guard',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, [], undefined, { trimGuard: true }),
    },
    {
      id: 'rawFrameNameIdAsciiPreTrim',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache and ASCII byte-boundary text pre-trim before decode',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, [], undefined, { asciiPreTrimText: true }),
    },
    {
      id: 'rawFrameNameIdAllAsciiSpans',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache and manual ASCII materialization for all string spans',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, [], undefined, { asciiAllSpans: true }),
    },
    {
      id: 'rawFrameNameIdLongTextCache',
      family: 'full-stax-js',
      implementation: 'nextRawBatch typed arrays with numeric name-id cache plus bounded long text/CDATA span string cache',
      contractScope: 'full-string-materialization',
      fullStringParity: true,
      run: () => consumeRawFrameStyle(fixture, [], undefined, { textCache: new SpanStringCache(), textCacheMinLength: 16 }),
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
    instrumentation: variant.instrumentation ?? 'materialization-counters-enabled',
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
      arrayBufferConsumption: corpusBacked
        ? 'The corpus file is read once as a seed buffer and sliced into Uint8Array views; measured rows consume synchronous Iterable<Uint8Array[]> parser pulls, not a pure ReadableStream and not one full 1 GiB ArrayBuffer parser input.'
        : 'The generated row cycle is encoded into Uint8Array fixtures; measured rows consume synchronous Iterable<Uint8Array[]> parser pulls, not a pure ReadableStream and not one full 1 GiB ArrayBuffer parser input.',
      batchBackpressure: 'byteBatches(fixture) yields one grouped Uint8Array[] batch per synchronous parser pull and does not prebuild the repeated 1 GiB+ stream.',
      multiChunkBatchCost: 'The current sync cursor can use a single Uint8Array batch item as a view, but a batch containing multiple Uint8Array chunks is concatenated into one parser buffer before scanning.',
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
  const partialRows = variants.filter((entry) => entry.family === 'partial-upper-bound' || entry.family === 'near-full-upper-bound');
  const nearFullRows = variants.filter((entry) => entry.family === 'near-full-upper-bound');
  const semanticRows = variants.filter((entry) => entry.family === 'semantic-upper-bound');
  const fullRows = variants.filter((entry) => entry.fullStringParity);
  const projectionRows = variants.filter((entry) => entry.eventCountKind === 'projected-records');
  const fastestPartial = maxBy(partialRows, (entry) => entry.mibPerSec);
  const fastestFull = maxBy(fullRows, (entry) => entry.mibPerSec);
  const rawNameId = variants.find((entry) => entry.id === 'rawFrameNameId');
  const rawNameIdNoCounters = variants.find((entry) => entry.id === 'rawFrameNameIdNoCounters');
  const rawNameIdNoCountersFoldTrim = variants.find((entry) => entry.id === 'rawFrameNameIdNoCountersFoldTrim');
  const rawNameIdNoCountersTextCache = variants.find((entry) => entry.id === 'rawFrameNameIdNoCountersTextCache');
  const rawNameIdNoCountersValueCache = variants.find((entry) => entry.id === 'rawFrameNameIdNoCountersValueCache');
  const rawNameIdNoCountersNameFoldCache = variants.find((entry) => entry.id === 'rawFrameNameIdNoCountersNameFoldCache');
  const rawNameIdNoCountersStringFoldCache = variants.find((entry) => entry.id === 'rawFrameNameIdNoCountersStringFoldCache');
  const rawNameIdNoCountersNameFoldCacheFoldTrim = variants.find((entry) => entry.id === 'rawFrameNameIdNoCountersNameFoldCacheFoldTrim');
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
      id: 'multi-chunk-batch-cost',
      summary: fixture.batchSize > 1
        ? 'This run groups multiple Uint8Array chunks per parser pull; the current sync cursor concatenates multi-chunk batches before scanning, so larger batch size is a source-copy hypothesis rather than a free async-overhead reduction.'
        : 'This run uses one Uint8Array chunk per parser pull when possible, which avoids the sync cursor multi-chunk concatenation path except for pending tail repair.',
      evidence: [
        `batchSize=${fixture.batchSize}`,
        'singleChunk=direct Uint8Array view',
        'multiChunk=concat into parser buffer',
      ],
    },
    {
      id: 'contract-separation',
      summary: 'Partial rows deliberately drop one or more string fields and are not StAX parity rows.',
      evidence: partialRows.map((entry) => `${entry.id}: ${entry.contractScope}, strings=${entry.materializationCounters.stringFieldReads}`),
    },
    {
      id: 'near-full-category-drop-scope',
      summary: 'Near-full rows materialize three of the four StAX string categories and omit exactly one category, so they are closer headroom probes but still not full-string counterexamples.',
      evidence: nearFullRows.length
        ? nearFullRows.map((entry) => `${entry.id}: ${entry.contractScope}, strings=${entry.materializationCounters.stringFieldReads}, checksum=${entry.checksum}`)
        : ['near-full rows not selected in this run'],
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
  if (rawNameId && rawNameIdNoCounters) {
    findings.push({
      id: 'materialization-counter-overhead-candidate',
      summary: 'rawFrameNameIdNoCounters keeps the full-string checksum while removing in-loop materialization counter increments, isolating benchmark instrumentation overhead from parser/string cost.',
      evidence: [
        `rawFrameNameId=${formatRate(rawNameId.mibPerSec)}`,
        `rawFrameNameIdNoCounters=${formatRate(rawNameIdNoCounters.mibPerSec)}`,
        `sameChecksum=${rawNameIdNoCounters.checksum === rawNameId.checksum}`,
        `sameEvents=${rawNameIdNoCounters.eventCount === rawNameId.eventCount}`,
        `throughputRatio=${(rawNameIdNoCounters.mibPerSec / rawNameId.mibPerSec).toFixed(2)}x`,
        `instrumentation=${rawNameIdNoCounters.instrumentation}`,
      ],
    });
  }
  if (rawNameIdNoCounters && rawNameIdNoCountersFoldTrim) {
    findings.push({
      id: 'no-counter-fold-trim-candidate',
      summary: 'rawFrameNameIdNoCountersFoldTrim keeps text strings materialized but folds trimmed text checksums without allocating value.trim(), testing whether trim allocation was hidden by counter overhead.',
      evidence: [
        `rawFrameNameIdNoCounters=${formatRate(rawNameIdNoCounters.mibPerSec)}`,
        `rawFrameNameIdNoCountersFoldTrim=${formatRate(rawNameIdNoCountersFoldTrim.mibPerSec)}`,
        `sameChecksum=${rawNameIdNoCountersFoldTrim.checksum === rawNameIdNoCounters.checksum}`,
        `sameEvents=${rawNameIdNoCountersFoldTrim.eventCount === rawNameIdNoCounters.eventCount}`,
        `throughputRatio=${(rawNameIdNoCountersFoldTrim.mibPerSec / rawNameIdNoCounters.mibPerSec).toFixed(2)}x`,
        `instrumentation=${rawNameIdNoCountersFoldTrim.instrumentation}`,
      ],
    });
  }
  if (rawNameIdNoCounters && (rawNameIdNoCountersTextCache || rawNameIdNoCountersValueCache)) {
    findings.push({
      id: 'no-counter-value-cache-candidate',
      summary: 'No-counter cache rows test whether repeated text or attribute value spans become useful once materialization counter increments are removed from the measured loop.',
      evidence: [
        `rawFrameNameIdNoCounters=${formatRate(rawNameIdNoCounters.mibPerSec)}`,
        rawNameIdNoCountersTextCache
          ? `rawFrameNameIdNoCountersTextCache=${formatRate(rawNameIdNoCountersTextCache.mibPerSec)}, sameChecksum=${rawNameIdNoCountersTextCache.checksum === rawNameIdNoCounters.checksum}, sameEvents=${rawNameIdNoCountersTextCache.eventCount === rawNameIdNoCounters.eventCount}`
          : 'rawFrameNameIdNoCountersTextCache=missing',
        rawNameIdNoCountersValueCache
          ? `rawFrameNameIdNoCountersValueCache=${formatRate(rawNameIdNoCountersValueCache.mibPerSec)}, sameChecksum=${rawNameIdNoCountersValueCache.checksum === rawNameIdNoCounters.checksum}, sameEvents=${rawNameIdNoCountersValueCache.eventCount === rawNameIdNoCounters.eventCount}`
          : 'rawFrameNameIdNoCountersValueCache=missing',
      ],
    });
  }
  if (rawNameIdNoCounters && rawNameIdNoCountersNameFoldCache) {
    findings.push({
      id: 'no-counter-name-fold-cache-candidate',
      summary: 'rawFrameNameIdNoCountersNameFoldCache still materializes cached name strings, but reuses checksum transforms for repeated name ids to isolate benchmark consumer folding cost from parser/string creation cost.',
      evidence: [
        `rawFrameNameIdNoCounters=${formatRate(rawNameIdNoCounters.mibPerSec)}`,
        `rawFrameNameIdNoCountersNameFoldCache=${formatRate(rawNameIdNoCountersNameFoldCache.mibPerSec)}`,
        `sameChecksum=${rawNameIdNoCountersNameFoldCache.checksum === rawNameIdNoCounters.checksum}`,
        `sameEvents=${rawNameIdNoCountersNameFoldCache.eventCount === rawNameIdNoCounters.eventCount}`,
        `throughputRatio=${(rawNameIdNoCountersNameFoldCache.mibPerSec / rawNameIdNoCounters.mibPerSec).toFixed(2)}x`,
      ],
    });
  }
  if (rawNameIdNoCounters && rawNameIdNoCountersStringFoldCache) {
    findings.push({
      id: 'no-counter-string-fold-cache-candidate',
      summary: 'rawFrameNameIdNoCountersStringFoldCache keeps string materialization intact while caching checksum transforms for repeated text and attribute value strings after decode.',
      evidence: [
        `rawFrameNameIdNoCounters=${formatRate(rawNameIdNoCounters.mibPerSec)}`,
        `rawFrameNameIdNoCountersStringFoldCache=${formatRate(rawNameIdNoCountersStringFoldCache.mibPerSec)}`,
        `sameChecksum=${rawNameIdNoCountersStringFoldCache.checksum === rawNameIdNoCounters.checksum}`,
        `sameEvents=${rawNameIdNoCountersStringFoldCache.eventCount === rawNameIdNoCounters.eventCount}`,
        `throughputRatio=${(rawNameIdNoCountersStringFoldCache.mibPerSec / rawNameIdNoCounters.mibPerSec).toFixed(2)}x`,
      ],
    });
  }
  if (rawNameIdNoCountersNameFoldCache && rawNameIdNoCountersNameFoldCacheFoldTrim) {
    findings.push({
      id: 'no-counter-name-fold-cache-fold-trim-candidate',
      summary: 'This row combines the positive repeated-name checksum transform with direct trimmed text checksum folding to test whether independent consumer-side changes compose into a larger full-string speedup.',
      evidence: [
        `rawFrameNameIdNoCountersNameFoldCache=${formatRate(rawNameIdNoCountersNameFoldCache.mibPerSec)}`,
        `rawFrameNameIdNoCountersNameFoldCacheFoldTrim=${formatRate(rawNameIdNoCountersNameFoldCacheFoldTrim.mibPerSec)}`,
        `sameChecksum=${rawNameIdNoCountersNameFoldCacheFoldTrim.checksum === rawNameIdNoCountersNameFoldCache.checksum}`,
        `sameEvents=${rawNameIdNoCountersNameFoldCacheFoldTrim.eventCount === rawNameIdNoCountersNameFoldCache.eventCount}`,
        `throughputRatio=${(rawNameIdNoCountersNameFoldCacheFoldTrim.mibPerSec / rawNameIdNoCountersNameFoldCache.mibPerSec).toFixed(2)}x`,
      ],
    });
  }
  const textLengthOnly = variants.find((entry) => entry.id === 'rawFrameNameIdTextLengthOnly');
  const textNoFold = variants.find((entry) => entry.id === 'rawFrameNameIdTextNoFold');
  if (rawNameId && (textLengthOnly || textNoFold)) {
    findings.push({
      id: 'text-checksum-consumer-decomposition',
      summary: 'These rows keep text/CDATA string materialization but reduce or remove text checksum folding, separating string creation from benchmark consumer traversal.',
      evidence: [
        `rawFrameNameId=${formatRate(rawNameId.mibPerSec)}`,
        textLengthOnly
          ? `rawFrameNameIdTextLengthOnly=${formatRate(textLengthOnly.mibPerSec)}, textLengthChecksumReads=${textLengthOnly.materializationCounters.textLengthChecksumReads}, textCodeUnits=${textLengthOnly.materializationCounters.textMaterializedCodeUnits}`
          : 'rawFrameNameIdTextLengthOnly=missing',
        textNoFold
          ? `rawFrameNameIdTextNoFold=${formatRate(textNoFold.mibPerSec)}, textChecksumBypassReads=${textNoFold.materializationCounters.textChecksumBypassReads}, textCodeUnits=${textNoFold.materializationCounters.textMaterializedCodeUnits}`
          : 'rawFrameNameIdTextNoFold=missing',
        `sameStringReads=${(textLengthOnly?.materializationCounters.stringFieldReads ?? textNoFold?.materializationCounters.stringFieldReads) === rawNameId.materializationCounters.stringFieldReads}`,
        `sameRawSpanMaterializations=${(textLengthOnly?.materializationCounters.rawSpanMaterializations ?? textNoFold?.materializationCounters.rawSpanMaterializations) === rawNameId.materializationCounters.rawSpanMaterializations}`,
      ],
    });
  }
  const longAsciiText = variants.find((entry) => entry.id === 'rawFrameNameIdLongAsciiText');
  if (rawNameId && longAsciiText) {
    findings.push({
      id: 'long-ascii-text-materialization-candidate',
      summary: 'rawFrameNameIdLongAsciiText keeps the full-string checksum while replacing TextDecoder on ASCII text/CDATA spans longer than the short-span fast path.',
      evidence: [
        `rawFrameNameId=${formatRate(rawNameId.mibPerSec)}`,
        `rawFrameNameIdLongAsciiText=${formatRate(longAsciiText.mibPerSec)}`,
        `sameChecksum=${longAsciiText.checksum === rawNameId.checksum}`,
        `longAsciiTextHits=${longAsciiText.materializationCounters.longAsciiTextHits}`,
        `longAsciiTextFallbacks=${longAsciiText.materializationCounters.longAsciiTextFallbacks}`,
      ],
    });
  }
  const mediumAsciiText = variants.find((entry) => entry.id === 'rawFrameNameIdMediumAsciiText');
  if (rawNameId && mediumAsciiText) {
    findings.push({
      id: 'medium-ascii-text-materialization-candidate',
      summary: 'rawFrameNameIdMediumAsciiText keeps the full-string checksum while replacing TextDecoder only for 13-24 byte ASCII text/CDATA spans.',
      evidence: [
        `rawFrameNameId=${formatRate(rawNameId.mibPerSec)}`,
        `rawFrameNameIdMediumAsciiText=${formatRate(mediumAsciiText.mibPerSec)}`,
        `sameChecksum=${mediumAsciiText.checksum === rawNameId.checksum}`,
        `mediumAsciiTextHits=${mediumAsciiText.materializationCounters.mediumAsciiTextHits}`,
        `mediumAsciiTextFallbacks=${mediumAsciiText.materializationCounters.mediumAsciiTextFallbacks}`,
      ],
    });
  }
  const mediumAsciiAttrValue = variants.find((entry) => entry.id === 'rawFrameNameIdMediumAsciiAttrValue');
  if (rawNameId && mediumAsciiAttrValue) {
    findings.push({
      id: 'medium-ascii-attr-value-materialization-candidate',
      summary: 'rawFrameNameIdMediumAsciiAttrValue keeps the full-string checksum while replacing TextDecoder only for 13-24 byte ASCII attribute-value spans.',
      evidence: [
        `rawFrameNameId=${formatRate(rawNameId.mibPerSec)}`,
        `rawFrameNameIdMediumAsciiAttrValue=${formatRate(mediumAsciiAttrValue.mibPerSec)}`,
        `sameChecksum=${mediumAsciiAttrValue.checksum === rawNameId.checksum}`,
        `mediumAsciiAttrValueHits=${mediumAsciiAttrValue.materializationCounters.mediumAsciiAttrValueHits}`,
        `mediumAsciiAttrValueFallbacks=${mediumAsciiAttrValue.materializationCounters.mediumAsciiAttrValueFallbacks}`,
      ],
    });
  }
  const textCache = variants.find((entry) => entry.id === 'rawFrameNameIdTextCache');
  if (rawNameId && textCache) {
    findings.push({
      id: 'text-only-cache-candidate',
      summary: 'rawFrameNameIdTextCache keeps the full-string checksum while caching only text/CDATA span strings; attribute values still use direct TextDecoder materialization.',
      evidence: [
        `rawFrameNameId=${formatRate(rawNameId.mibPerSec)}`,
        `rawFrameNameIdTextCache=${formatRate(textCache.mibPerSec)}`,
        `sameChecksum=${textCache.checksum === rawNameId.checksum}`,
        `valueCacheHits=${textCache.materializationCounters.rawValueCacheHits}`,
        `valueCacheMisses=${textCache.materializationCounters.rawValueCacheMisses}`,
        `maxRSS=${formatBytes(textCache.memory.maxRssBytes)}`,
      ],
    });
  }
  const trimGuard = variants.find((entry) => entry.id === 'rawFrameNameIdTrimGuard');
  if (rawNameId && trimGuard) {
    findings.push({
      id: 'text-trim-guard-candidate',
      summary: 'rawFrameNameIdTrimGuard keeps the full-string checksum while skipping value.trim() when byte boundaries prove the text span is unchanged by trim.',
      evidence: [
        `rawFrameNameId=${formatRate(rawNameId.mibPerSec)}`,
        `rawFrameNameIdTrimGuard=${formatRate(trimGuard.mibPerSec)}`,
        `sameChecksum=${trimGuard.checksum === rawNameId.checksum}`,
        `trimGuardSkips=${trimGuard.materializationCounters.textTrimGuardSkips}`,
        `trimGuardFallbacks=${trimGuard.materializationCounters.textTrimGuardFallbacks}`,
      ],
    });
  }
  const asciiPreTrim = variants.find((entry) => entry.id === 'rawFrameNameIdAsciiPreTrim');
  if (rawNameId && asciiPreTrim) {
    findings.push({
      id: 'ascii-pre-trim-text-candidate',
      summary: 'rawFrameNameIdAsciiPreTrim keeps the full-string checksum while trimming ASCII boundary whitespace before decoding text/CDATA spans.',
      evidence: [
        `rawFrameNameId=${formatRate(rawNameId.mibPerSec)}`,
        `rawFrameNameIdAsciiPreTrim=${formatRate(asciiPreTrim.mibPerSec)}`,
        `sameChecksum=${asciiPreTrim.checksum === rawNameId.checksum}`,
        `asciiPreTrimSkips=${asciiPreTrim.materializationCounters.textAsciiPreTrimSkips}`,
        `asciiPreTrimFallbacks=${asciiPreTrim.materializationCounters.textAsciiPreTrimFallbacks}`,
      ],
    });
  }
  const allAsciiSpans = variants.find((entry) => entry.id === 'rawFrameNameIdAllAsciiSpans');
  if (rawNameId && allAsciiSpans) {
    findings.push({
      id: 'all-ascii-span-materialization-candidate',
      summary: 'rawFrameNameIdAllAsciiSpans keeps the full-string checksum while replacing TextDecoder on any ASCII string span longer than the short-span fast path.',
      evidence: [
        `rawFrameNameId=${formatRate(rawNameId.mibPerSec)}`,
        `rawFrameNameIdAllAsciiSpans=${formatRate(allAsciiSpans.mibPerSec)}`,
        `sameChecksum=${allAsciiSpans.checksum === rawNameId.checksum}`,
        `asciiSpanHits=${allAsciiSpans.materializationCounters.asciiSpanMaterializationHits}`,
        `asciiSpanFallbacks=${allAsciiSpans.materializationCounters.asciiSpanMaterializationFallbacks}`,
      ],
    });
  }
  const longTextCache = variants.find((entry) => entry.id === 'rawFrameNameIdLongTextCache');
  if (rawNameId && longTextCache) {
    findings.push({
      id: 'long-text-cache-candidate',
      summary: 'rawFrameNameIdLongTextCache keeps the full-string checksum while caching only text/CDATA spans with length >= 16 bytes.',
      evidence: [
        `rawFrameNameId=${formatRate(rawNameId.mibPerSec)}`,
        `rawFrameNameIdLongTextCache=${formatRate(longTextCache.mibPerSec)}`,
        `sameChecksum=${longTextCache.checksum === rawNameId.checksum}`,
        `valueCacheHits=${longTextCache.materializationCounters.rawValueCacheHits}`,
        `valueCacheMisses=${longTextCache.materializationCounters.rawValueCacheMisses}`,
        `textStringReads=${longTextCache.materializationCounters.textStringReads}`,
        `maxRSS=${formatBytes(longTextCache.memory.maxRssBytes)}`,
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

function consumeRawFrameNameIdNoCountersStyle(fixture, options = {}) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const parser = new StreamReaderSync(byteBatches(fixture));
  const nameCache = [];
  let eventCount = 0;
  let checksum = 0;
  let frame;

  while ((frame = parser.nextRawBatch()) !== null) {
    const result = consumeRawFrameNameIdNoCounters(frame, checksum, eventCount, decoder, nameCache, options);
    checksum = result.checksum;
    eventCount = result.eventCount;
  }

  return {
    eventCount,
    checksum,
    materializationCounters: createMaterializationCounters(),
  };
}

function consumeRawFrameTextUseStyle(fixture, textChecksumMode) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const parser = new StreamReaderSync(byteBatches(fixture));
  const materializationCounters = createMaterializationCounters();
  const nameCache = [];
  let eventCount = 0;
  let checksum = 0;
  let frame;

  while ((frame = parser.nextRawBatch()) !== null) {
    const result = consumeRawFrameTextUse(frame, checksum, eventCount, decoder, nameCache, materializationCounters, textChecksumMode);
    checksum = result.checksum;
    eventCount = result.eventCount;
  }

  globalThis.__staxCandidateTextUseSink = materializationCounters.textMaterializedCodeUnits;
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
        materializeName(
          buffer,
          nameStarts[index],
          nameEnds[index],
          nameIds[index],
          decoder,
          nameCache,
          materializationCounters,
          'name',
          options.asciiAllSpans,
        ),
      );
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      const start = textStarts[index];
      if (start >= 0) {
        countStringField(materializationCounters, 'text');
          const textLength = textEnds[index] - start;
          const minTextCacheLength = options.textCacheMinLength ?? 0;
          const textCache = textLength >= minTextCacheLength ? (options.textCache ?? valueCache) : undefined;
          const value = options.asciiPreTrimText
            ? materializeAsciiPreTrimmedTextValue(buffer, start, textEnds[index], decoder, textCache, materializationCounters)
            : options.longAsciiText
            ? materializeTextValue(buffer, start, textEnds[index], decoder, textCache, materializationCounters)
            : options.unrolledMediumAsciiText
            ? materializeUnrolledMediumAsciiTextValue(buffer, start, textEnds[index], decoder, textCache, materializationCounters)
            : options.mediumAsciiText
            ? materializeMediumAsciiTextValue(buffer, start, textEnds[index], decoder, textCache, materializationCounters)
            : materializeValue(buffer, start, textEnds[index], decoder, textCache, materializationCounters, 'text', options.asciiAllSpans);
          const textForChecksum = prepareTextForChecksum(value, buffer, start, textEnds[index], options, materializationCounters);
          checksum = options.foldTrimmedText ? foldTrimmedString(checksum, value) : foldString(checksum, textForChecksum);
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
            options.asciiAllSpans,
          ),
        );
        countStringField(materializationCounters, 'attrValue');
        const value = isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, attrIndex)
          ? countImplicitAttributeValue(materializationCounters)
          : options.mediumAsciiAttrValue
          ? materializeMediumAsciiAttrValue(
            buffer,
            attrValueStarts[attrIndex],
            attrValueEnds[attrIndex],
            decoder,
            valueCache,
            materializationCounters,
          )
          : options.attrValueCache
          ? materializeValue(
            buffer,
            attrValueStarts[attrIndex],
            attrValueEnds[attrIndex],
            decoder,
            options.attrValueCache,
            materializationCounters,
            'attrValue',
            options.asciiAllSpans,
          )
          : materializeValue(
            buffer,
            attrValueStarts[attrIndex],
            attrValueEnds[attrIndex],
            decoder,
            valueCache,
            materializationCounters,
            'attrValue',
            options.asciiAllSpans,
          );
        checksum = foldString(checksum, value);
      }
    }
  }

  return { eventCount, checksum };
}

function consumeRawFrameNameIdNoCounters(frame, checksum, eventCount, decoder, nameCache, options = {}) {
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
      const nameId = nameIds[index];
      const value = materializeNameNoCounters(buffer, nameStarts[index], nameEnds[index], nameId, decoder, nameCache);
      checksum = options.nameFoldCache
        ? foldNameWithTransformCache(checksum, value, nameId, options.nameFoldCache)
        : foldString(checksum, value);
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      const start = textStarts[index];
      if (start >= 0) {
        const value = materializeValueNoCounters(buffer, start, textEnds[index], decoder, options.textCache ?? options.valueCache);
        if (options.foldTrimmedText) {
          checksum = foldTrimmedString(checksum, value);
        } else {
          const textForChecksum = value.trim();
          checksum = options.stringFoldCache
            ? foldStringWithTransformCache(checksum, textForChecksum, options.stringFoldCache)
            : foldString(checksum, textForChecksum);
        }
      }
    }
    if (type === StreamEventType.START_ELEMENT) {
      const attrStart = attrStarts[index];
      const attrCount = attrCounts[index];
      checksum = mixChecksum(checksum, attrCount);
      const attrEnd = attrStart + attrCount;
      for (let attrIndex = attrStart; attrIndex < attrEnd; attrIndex++) {
        const attrNameId = attrNameIds[attrIndex];
        const attrName = materializeNameNoCounters(
          buffer,
          attrNameStarts[attrIndex],
          attrNameEnds[attrIndex],
          attrNameId,
          decoder,
          nameCache,
        );
        checksum = options.nameFoldCache
          ? foldNameWithTransformCache(checksum, attrName, attrNameId, options.nameFoldCache)
          : foldString(checksum, attrName);
        const value = isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, attrIndex)
          ? undefined
          : materializeValueNoCounters(buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex], decoder, options.attrValueCache ?? options.valueCache);
        checksum = options.stringFoldCache
          ? foldStringWithTransformCache(checksum, value, options.stringFoldCache)
          : foldString(checksum, value);
      }
    }
  }

  return { eventCount, checksum };
}

function foldNameWithTransformCache(seed, value, nameId, transformCache) {
  if (!value) {
    return seed;
  }
  if (nameId < 0) {
    return foldString(seed, value);
  }
  let transform = transformCache[nameId];
  if (transform === undefined) {
    transform = createFoldTransform(value);
    transformCache[nameId] = transform;
  }
  return (Math.imul(seed, transform.multiplier) + transform.addend) | 0;
}

function foldStringWithTransformCache(seed, value, transformCache) {
  if (!value) {
    return seed;
  }
  let transform = transformCache.get(value);
  if (transform === undefined) {
    transform = createFoldTransform(value);
    transformCache.set(value, transform);
  }
  return (Math.imul(seed, transform.multiplier) + transform.addend) | 0;
}

function createFoldTransform(value) {
  let multiplier = 1;
  let addend = 0;
  for (let index = 0; index < value.length; index++) {
    multiplier = Math.imul(multiplier, 31) | 0;
    addend = (Math.imul(addend, 31) + value.charCodeAt(index)) | 0;
  }
  return { multiplier, addend };
}

function consumeRawFrameTextUse(frame, checksum, eventCount, decoder, nameCache, materializationCounters, textChecksumMode) {
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
        const value = materializeValue(buffer, start, textEnds[index], decoder, undefined, materializationCounters, 'text');
        const trimmedLength = value.trim().length;
        materializationCounters.textMaterializedCodeUnits += value.length;
        if (textChecksumMode === 'length-only') {
          materializationCounters.textLengthChecksumReads++;
          checksum = mixChecksum(checksum, trimmedLength);
        } else {
          materializationCounters.textChecksumBypassReads++;
        }
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
          : materializeValue(buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex], decoder, undefined, materializationCounters, 'attrValue');
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

function materializeName(buffer, start, end, nameId, decoder, nameCache, materializationCounters, kind, asciiAllSpans = false) {
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
    const value = decodeSpan(buffer, start, end, decoder, materializationCounters, kind, asciiAllSpans);
    nameCache[nameId] = value;
    return value;
  }
  return decodeSpan(buffer, start, end, decoder, materializationCounters, kind, asciiAllSpans);
}

function materializeNameNoCounters(buffer, start, end, nameId, decoder, nameCache) {
  if (nameId < 0 || start < 0) {
    return undefined;
  }
  const cached = nameCache[nameId];
  if (cached !== undefined) {
    return cached;
  }
  const value = decodeSpanNoCounters(buffer, start, end, decoder);
  nameCache[nameId] = value;
  return value;
}

function materializeValueNoCounters(buffer, start, end, decoder, valueCache) {
  if (!valueCache) {
    return decodeSpanNoCounters(buffer, start, end, decoder);
  }
  const cached = valueCache.get(buffer, start, end);
  if (cached !== undefined) {
    return cached;
  }
  const value = decodeSpanNoCounters(buffer, start, end, decoder);
  valueCache.set(buffer, start, end, value);
  return value;
}

function materializeValue(buffer, start, end, decoder, valueCache, materializationCounters, kind, asciiAllSpans = false) {
  if (!valueCache) {
    return decodeSpan(buffer, start, end, decoder, materializationCounters, kind, asciiAllSpans);
  }
  const cached = valueCache.get(buffer, start, end);
  if (cached !== undefined) {
    materializationCounters.rawValueCacheHits++;
    return cached;
  }
  materializationCounters.rawValueCacheMisses++;
  const value = decodeSpan(buffer, start, end, decoder, materializationCounters, kind, asciiAllSpans);
  valueCache.set(buffer, start, end, value);
  return value;
}

function materializeTextValue(buffer, start, end, decoder, valueCache, materializationCounters) {
  if (!valueCache) {
    return decodeLongAsciiTextSpan(buffer, start, end, decoder, materializationCounters);
  }
  const cached = valueCache.get(buffer, start, end);
  if (cached !== undefined) {
    materializationCounters.rawValueCacheHits++;
    return cached;
  }
  materializationCounters.rawValueCacheMisses++;
  const value = decodeLongAsciiTextSpan(buffer, start, end, decoder, materializationCounters);
  valueCache.set(buffer, start, end, value);
  return value;
}

function materializeMediumAsciiTextValue(buffer, start, end, decoder, valueCache, materializationCounters) {
  if (!valueCache) {
    return decodeMediumAsciiTextSpan(buffer, start, end, decoder, materializationCounters);
  }
  const cached = valueCache.get(buffer, start, end);
  if (cached !== undefined) {
    materializationCounters.rawValueCacheHits++;
    return cached;
  }
  materializationCounters.rawValueCacheMisses++;
  const value = decodeMediumAsciiTextSpan(buffer, start, end, decoder, materializationCounters);
  valueCache.set(buffer, start, end, value);
  return value;
}

function materializeUnrolledMediumAsciiTextValue(buffer, start, end, decoder, valueCache, materializationCounters) {
  if (!valueCache) {
    return decodeUnrolledMediumAsciiTextSpan(buffer, start, end, decoder, materializationCounters);
  }
  const cached = valueCache.get(buffer, start, end);
  if (cached !== undefined) {
    materializationCounters.rawValueCacheHits++;
    return cached;
  }
  materializationCounters.rawValueCacheMisses++;
  const value = decodeUnrolledMediumAsciiTextSpan(buffer, start, end, decoder, materializationCounters);
  valueCache.set(buffer, start, end, value);
  return value;
}

function materializeMediumAsciiAttrValue(buffer, start, end, decoder, valueCache, materializationCounters) {
  if (!valueCache) {
    return decodeMediumAsciiAttrValueSpan(buffer, start, end, decoder, materializationCounters);
  }
  const cached = valueCache.get(buffer, start, end);
  if (cached !== undefined) {
    materializationCounters.rawValueCacheHits++;
    return cached;
  }
  materializationCounters.rawValueCacheMisses++;
  const value = decodeMediumAsciiAttrValueSpan(buffer, start, end, decoder, materializationCounters);
  valueCache.set(buffer, start, end, value);
  return value;
}

function materializeAsciiPreTrimmedTextValue(buffer, start, end, decoder, valueCache, materializationCounters) {
  const [trimmedStart, trimmedEnd] = trimAsciiWhitespace(buffer, start, end);
  if (textTrimWouldKeepSpan(buffer, trimmedStart, trimmedEnd)) {
    materializationCounters.textAsciiPreTrimSkips++;
    return materializeValue(buffer, trimmedStart, trimmedEnd, decoder, valueCache, materializationCounters, 'text');
  }
  materializationCounters.textAsciiPreTrimFallbacks++;
  return materializeValue(buffer, start, end, decoder, valueCache, materializationCounters, 'text');
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

class OffsetSpanStringCache {
  buckets = new WeakMap();

  get(buffer, start, end) {
    return this.buckets.get(buffer)?.get(`${start}:${end}`);
  }

  set(buffer, start, end, value) {
    let bucket = this.buckets.get(buffer);
    if (bucket === undefined) {
      bucket = new Map();
      this.buckets.set(buffer, bucket);
    }
    bucket.set(`${start}:${end}`, value);
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

function decodeSpan(buffer, start, end, decoder, materializationCounters, kind, asciiAllSpans = false) {
  countRawSpanMaterialization(materializationCounters, kind);
  const ascii = decodeShortAsciiSpan(buffer, start, end);
  if (ascii !== undefined) {
    return ascii;
  }
  if (asciiAllSpans && isAsciiSpan(buffer, start, end)) {
    materializationCounters.asciiSpanMaterializationHits++;
    return asciiSpanToString(buffer, start, end);
  }
  if (asciiAllSpans) {
    materializationCounters.asciiSpanMaterializationFallbacks++;
  }
  return decoder.decode(buffer.subarray(start, end));
}

function decodeSpanNoCounters(buffer, start, end, decoder) {
  const ascii = decodeShortAsciiSpan(buffer, start, end);
  return ascii === undefined ? decoder.decode(buffer.subarray(start, end)) : ascii;
}

function decodeLongAsciiTextSpan(buffer, start, end, decoder, materializationCounters) {
  countRawSpanMaterialization(materializationCounters, 'text');
  const ascii = decodeShortAsciiSpan(buffer, start, end);
  if (ascii !== undefined) {
    return ascii;
  }
  if (!isAsciiSpan(buffer, start, end)) {
    materializationCounters.longAsciiTextFallbacks++;
    return decoder.decode(buffer.subarray(start, end));
  }
  materializationCounters.longAsciiTextHits++;
  return asciiSpanToString(buffer, start, end);
}

function decodeMediumAsciiTextSpan(buffer, start, end, decoder, materializationCounters) {
  countRawSpanMaterialization(materializationCounters, 'text');
  return decodeMediumAsciiSpan(buffer, start, end, decoder, materializationCounters, 'mediumAsciiText');
}

function decodeUnrolledMediumAsciiTextSpan(buffer, start, end, decoder, materializationCounters) {
  countRawSpanMaterialization(materializationCounters, 'text');
  const ascii = decodeUnrolledAsciiSpanUpTo24(buffer, start, end);
  if (ascii !== undefined) {
    const length = end - start;
    if (length > 12) {
      materializationCounters.unrolledMediumAsciiTextHits++;
    }
    return ascii;
  }
  materializationCounters.unrolledMediumAsciiTextFallbacks++;
  return decoder.decode(buffer.subarray(start, end));
}

function decodeMediumAsciiAttrValueSpan(buffer, start, end, decoder, materializationCounters) {
  countRawSpanMaterialization(materializationCounters, 'attrValue');
  return decodeMediumAsciiSpan(buffer, start, end, decoder, materializationCounters, 'mediumAsciiAttrValue');
}

function decodeMediumAsciiSpan(buffer, start, end, decoder, materializationCounters, counterPrefix) {
  const short = decodeShortAsciiSpan(buffer, start, end);
  if (short !== undefined) {
    return short;
  }
  const length = end - start;
  if (length > 12 && length <= 24) {
    const head = decodeShortAsciiSpan(buffer, start, start + 12);
    const tail = decodeShortAsciiSpan(buffer, start + 12, end);
    if (head !== undefined && tail !== undefined) {
      materializationCounters[`${counterPrefix}Hits`]++;
      return head + tail;
    }
  }
  materializationCounters[`${counterPrefix}Fallbacks`]++;
  return decoder.decode(buffer.subarray(start, end));
}

function decodeUnrolledAsciiSpanUpTo24(buffer, start, end) {
  const short = decodeShortAsciiSpan(buffer, start, end);
  if (short !== undefined) {
    return short;
  }
  switch (end - start) {
    case 13: {
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
      const b12 = buffer[start + 12];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11 | b12) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12)
        : undefined;
    }
    case 14: {
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
      const b12 = buffer[start + 12];
      const b13 = buffer[start + 13];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11 | b12 | b13) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13)
        : undefined;
    }
    case 15: {
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
      const b12 = buffer[start + 12];
      const b13 = buffer[start + 13];
      const b14 = buffer[start + 14];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11 | b12 | b13 | b14) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14)
        : undefined;
    }
    case 16: {
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
      const b12 = buffer[start + 12];
      const b13 = buffer[start + 13];
      const b14 = buffer[start + 14];
      const b15 = buffer[start + 15];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11 | b12 | b13 | b14 | b15) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15)
        : undefined;
    }
    case 17: {
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
      const b12 = buffer[start + 12];
      const b13 = buffer[start + 13];
      const b14 = buffer[start + 14];
      const b15 = buffer[start + 15];
      const b16 = buffer[start + 16];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11 | b12 | b13 | b14 | b15 | b16) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16)
        : undefined;
    }
    case 18: {
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
      const b12 = buffer[start + 12];
      const b13 = buffer[start + 13];
      const b14 = buffer[start + 14];
      const b15 = buffer[start + 15];
      const b16 = buffer[start + 16];
      const b17 = buffer[start + 17];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11 | b12 | b13 | b14 | b15 | b16 | b17) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17)
        : undefined;
    }
    case 19: {
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
      const b12 = buffer[start + 12];
      const b13 = buffer[start + 13];
      const b14 = buffer[start + 14];
      const b15 = buffer[start + 15];
      const b16 = buffer[start + 16];
      const b17 = buffer[start + 17];
      const b18 = buffer[start + 18];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11 | b12 | b13 | b14 | b15 | b16 | b17 | b18) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17, b18)
        : undefined;
    }
    case 20: {
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
      const b12 = buffer[start + 12];
      const b13 = buffer[start + 13];
      const b14 = buffer[start + 14];
      const b15 = buffer[start + 15];
      const b16 = buffer[start + 16];
      const b17 = buffer[start + 17];
      const b18 = buffer[start + 18];
      const b19 = buffer[start + 19];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11 | b12 | b13 | b14 | b15 | b16 | b17 | b18 | b19) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17, b18, b19)
        : undefined;
    }
    case 21: {
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
      const b12 = buffer[start + 12];
      const b13 = buffer[start + 13];
      const b14 = buffer[start + 14];
      const b15 = buffer[start + 15];
      const b16 = buffer[start + 16];
      const b17 = buffer[start + 17];
      const b18 = buffer[start + 18];
      const b19 = buffer[start + 19];
      const b20 = buffer[start + 20];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11 | b12 | b13 | b14 | b15 | b16 | b17 | b18 | b19 | b20) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17, b18, b19, b20)
        : undefined;
    }
    case 22: {
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
      const b12 = buffer[start + 12];
      const b13 = buffer[start + 13];
      const b14 = buffer[start + 14];
      const b15 = buffer[start + 15];
      const b16 = buffer[start + 16];
      const b17 = buffer[start + 17];
      const b18 = buffer[start + 18];
      const b19 = buffer[start + 19];
      const b20 = buffer[start + 20];
      const b21 = buffer[start + 21];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11 | b12 | b13 | b14 | b15 | b16 | b17 | b18 | b19 | b20 | b21) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17, b18, b19, b20, b21)
        : undefined;
    }
    case 23: {
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
      const b12 = buffer[start + 12];
      const b13 = buffer[start + 13];
      const b14 = buffer[start + 14];
      const b15 = buffer[start + 15];
      const b16 = buffer[start + 16];
      const b17 = buffer[start + 17];
      const b18 = buffer[start + 18];
      const b19 = buffer[start + 19];
      const b20 = buffer[start + 20];
      const b21 = buffer[start + 21];
      const b22 = buffer[start + 22];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11 | b12 | b13 | b14 | b15 | b16 | b17 | b18 | b19 | b20 | b21 | b22) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17, b18, b19, b20, b21, b22)
        : undefined;
    }
    case 24: {
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
      const b12 = buffer[start + 12];
      const b13 = buffer[start + 13];
      const b14 = buffer[start + 14];
      const b15 = buffer[start + 15];
      const b16 = buffer[start + 16];
      const b17 = buffer[start + 17];
      const b18 = buffer[start + 18];
      const b19 = buffer[start + 19];
      const b20 = buffer[start + 20];
      const b21 = buffer[start + 21];
      const b22 = buffer[start + 22];
      const b23 = buffer[start + 23];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11 | b12 | b13 | b14 | b15 | b16 | b17 | b18 | b19 | b20 | b21 | b22 | b23) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17, b18, b19, b20, b21, b22, b23)
        : undefined;
    }
    default:
      return undefined;
  }
}

function isAsciiSpan(buffer, start, end) {
  for (let index = start; index < end; index++) {
    if (buffer[index] > 0x7f) {
      return false;
    }
  }
  return true;
}

function asciiSpanToString(buffer, start, end) {
  const chunkSize = 8192;
  let value = '';
  for (let offset = start; offset < end; offset += chunkSize) {
    const chunkEnd = Math.min(offset + chunkSize, end);
    value += String.fromCharCode(...buffer.subarray(offset, chunkEnd));
  }
  return value;
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
    longAsciiTextHits: 0,
    longAsciiTextFallbacks: 0,
    mediumAsciiTextHits: 0,
    mediumAsciiTextFallbacks: 0,
    unrolledMediumAsciiTextHits: 0,
    unrolledMediumAsciiTextFallbacks: 0,
    mediumAsciiAttrValueHits: 0,
    mediumAsciiAttrValueFallbacks: 0,
    textTrimGuardSkips: 0,
    textTrimGuardFallbacks: 0,
    textAsciiPreTrimSkips: 0,
    textAsciiPreTrimFallbacks: 0,
    textChecksumBypassReads: 0,
    textLengthChecksumReads: 0,
    textMaterializedCodeUnits: 0,
    asciiSpanMaterializationHits: 0,
    asciiSpanMaterializationFallbacks: 0,
    implicitAttrValueReads: 0,
    eventObjects: 0,
    projectedRecords: 0,
    projectionFieldReads: 0,
    attributePairs: 0,
  };
}

function prepareTextForChecksum(value, buffer, start, end, options, materializationCounters) {
  if (options.trimText === false || options.foldTrimmedText) {
    return value;
  }
  if (!options.trimGuard) {
    return value.trim();
  }
  if (textTrimWouldKeepSpan(buffer, start, end)) {
    materializationCounters.textTrimGuardSkips++;
    return value;
  }
  materializationCounters.textTrimGuardFallbacks++;
  return value.trim();
}

function textTrimWouldKeepSpan(buffer, start, end) {
  if (start >= end) {
    return true;
  }
  const first = buffer[start];
  const last = buffer[end - 1];
  return isAsciiNonTrimCodeUnit(first) && isAsciiNonTrimCodeUnit(last);
}

function isAsciiNonTrimCodeUnit(value) {
  return value !== undefined
    && value > 0x20
    && value < 0x7f
    && value !== 0xa0;
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
    `- ArrayBuffer consumption: ${report.sourceContract.arrayBufferConsumption}`,
    `- Batch/backpressure: ${report.sourceContract.batchBackpressure}`,
    `- Multi-chunk batch cost: ${report.sourceContract.multiChunkBatchCost}`,
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
    '| Variant | Family | Contract scope | Count kind | Instrumentation | Throughput | Relative to stringFull | Woodstox ratio | 0.9x target | Bounded memory | Counterexample | Events | Checksum | Full parity |',
    '| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: | ---: | --- |',
  ];
  for (const entry of report.variants) {
    lines.push(
      `| ${entry.id} | ${entry.family} | ${entry.contractScope} | ${entry.eventCountKind} | ${entry.instrumentation} | ${formatRate(entry.mibPerSec)} | `
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
  lines.push('| Variant | String fields | Name | Text | Attr name | Attr value | Raw spans | Name cache hit/miss | Value cache hit/miss | Semantic byte fields/fallbacks | Long ASCII text hit/fallback | Medium ASCII text hit/fallback | Unrolled medium ASCII text hit/fallback | Medium ASCII attr value hit/fallback | Event objects | Projected records | Projection fields | Attribute pairs |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const entry of report.variants) {
    const counters = entry.materializationCounters;
    lines.push(
      `| ${entry.id} | ${formatCount(counters.stringFieldReads)} | ${formatCount(counters.nameStringReads)} | `
      + `${formatCount(counters.textStringReads)} | ${formatCount(counters.attrNameStringReads)} | `
      + `${formatCount(counters.attrValueStringReads)} | ${formatCount(counters.rawSpanMaterializations)} | `
      + `${formatCount(counters.rawNameCacheHits)}/${formatCount(counters.rawNameCacheMisses)} | `
      + `${formatCount(counters.rawValueCacheHits)}/${formatCount(counters.rawValueCacheMisses)} | `
      + `${formatCount(counters.semanticByteFoldFields)}/${formatCount(counters.semanticByteFoldFallbacks)} | `
      + `${formatCount(counters.longAsciiTextHits)}/${formatCount(counters.longAsciiTextFallbacks)} | `
      + `${formatCount(counters.mediumAsciiTextHits)}/${formatCount(counters.mediumAsciiTextFallbacks)} | `
      + `${formatCount(counters.unrolledMediumAsciiTextHits)}/${formatCount(counters.unrolledMediumAsciiTextFallbacks)} | `
      + `${formatCount(counters.mediumAsciiAttrValueHits)}/${formatCount(counters.mediumAsciiAttrValueFallbacks)} | `
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
