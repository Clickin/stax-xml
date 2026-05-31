import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultReleaseDir = resolve(__dirname, 'results', 'release');
const defaultJsonOut = resolve(defaultReleaseDir, 'same-contract-runtime-comparison.json');
const defaultMdOut = resolve(defaultReleaseDir, 'same-contract-runtime-comparison.md');

const candidateCases = ['stringFull', 'eventObjectFull', 'cursorAccessor', 'rawFrameDirect', 'rawFrameNameId'];
const candidateStabilityCases = ['stringFull', 'eventObjectFull', 'rawFrameNameId', 'rawFrameStringCache'];
const textDecoderCases = ['subarraySharedDecoder', 'shortAsciiSubarraySharedDecoder'];

const externalBaselineArtifacts = [
  {
    group: 'external-baseline-16mib',
    file: 'external-baseline.json',
    fixtureSource: 'generated-file',
    fixtureShape: 'runtime-comparison-16mib',
  },
  {
    group: 'external-baseline-1024mib-file-sync-batches',
    file: 'external-baseline-1024mib-file-sync-batches.json',
    fixtureSource: 'generated-file',
    fixtureShape: 'node-string-return-1024mib',
    optional: true,
  },
  {
    group: 'external-baseline-treebank-wrapper-1024mib-file-sync-batches',
    file: 'external-baseline-treebank-wrapper-1024mib-file-sync-batches.json',
    fixtureSource: 'corpus-wrapper-file',
    fixtureShape: 'treebank-wrapper-1024mib',
    optional: true,
  },
  {
    group: 'file-backed-short-attr-value-cache-candidate',
    file: 'file-backed-short-attr-value-cache-candidate.json',
    fixtureSource: 'generated-file',
    fixtureShape: 'node-string-return-1024mib',
    optional: true,
  },
  {
    group: 'file-backed-trim-boundary-check-candidate',
    file: 'file-backed-trim-boundary-check-candidate.json',
    fixtureSource: 'generated-file',
    fixtureShape: 'node-string-return-1024mib',
    optional: true,
  },
  {
    group: 'file-backed-long-ascii-text-candidate',
    file: 'file-backed-long-ascii-text-candidate.json',
    fixtureSource: 'generated-file',
    fixtureShape: 'node-string-return-1024mib',
    optional: true,
  },
];

const variantArtifacts = [
  {
    group: 'generated-1gib-candidate',
    file: 'candidate-headroom-large.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: candidateCases,
  },
  {
    group: 'generated-1gib-candidate',
    file: 'bun-candidate-headroom-large.json',
    runtimeId: 'bun-jsc',
    runtimeLabel: 'Bun/JSC',
    jsRuntime: true,
    cases: candidateCases,
  },
  {
    group: 'generated-1gib-candidate',
    file: 'browser-candidate-headroom-large.json',
    runtimeId: 'chrome-v8-browser',
    runtimeLabel: 'Chrome/V8 browser',
    jsRuntime: true,
    cases: candidateCases,
  },
  {
    group: 'generated-1gib-candidate',
    file: 'firefox-bidi-candidate-headroom.json',
    runtimeId: 'firefox-spidermonkey-browser',
    runtimeLabel: 'Firefox/SpiderMonkey browser',
    jsRuntime: true,
    cases: candidateCases,
  },
  {
    group: 'corpus-1gib-candidate',
    file: 'candidate-headroom-corpus.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: candidateCases,
  },
  {
    group: 'corpus-1gib-candidate',
    file: 'bun-candidate-headroom-corpus.json',
    runtimeId: 'bun-jsc',
    runtimeLabel: 'Bun/JSC',
    jsRuntime: true,
    cases: candidateCases,
  },
  {
    group: 'corpus-1gib-candidate',
    file: 'browser-candidate-headroom-corpus.json',
    runtimeId: 'chrome-v8-browser',
    runtimeLabel: 'Chrome/V8 browser',
    jsRuntime: true,
    cases: candidateCases,
  },
  {
    group: 'browser-fetch-readable-stream-books-corpus',
    file: 'browser-fetch-readable-stream-books-corpus.json',
    runtimeId: 'chrome-v8-browser',
    runtimeLabel: 'Chrome/V8 browser',
    jsRuntime: true,
    cases: ['eventObjectFull', 'fetchReadableStreamFull', 'fetchAsyncByteBatchFull'],
  },
  {
    group: 'corpus-1gib-candidate',
    file: 'firefox-bidi-candidate-headroom-corpus.json',
    runtimeId: 'firefox-spidermonkey-browser',
    runtimeLabel: 'Firefox/SpiderMonkey browser',
    jsRuntime: true,
    cases: candidateCases,
  },
  {
    group: 'projection-1gib-full',
    file: 'candidate-headroom-projection-large.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: candidateCases,
  },
  {
    group: 'projection-1gib-full',
    file: 'bun-candidate-headroom-projection-large.json',
    runtimeId: 'bun-jsc',
    runtimeLabel: 'Bun/JSC',
    jsRuntime: true,
    cases: candidateCases,
  },
  {
    group: 'projection-1gib-full',
    file: 'browser-candidate-headroom-projection-large.json',
    runtimeId: 'chrome-v8-browser',
    runtimeLabel: 'Chrome/V8 browser',
    jsRuntime: true,
    cases: candidateCases,
  },
  {
    group: 'projection-1gib-full',
    file: 'firefox-bidi-candidate-headroom-projection.json',
    runtimeId: 'firefox-spidermonkey-browser',
    runtimeLabel: 'Firefox/SpiderMonkey browser',
    jsRuntime: true,
    cases: candidateCases,
  },
  {
    group: 'generated-1gib-textdecoder',
    file: 'textdecoder-span-variants.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: textDecoderCases,
  },
  {
    group: 'generated-1gib-textdecoder',
    file: 'bun-textdecoder-span-variants.json',
    runtimeId: 'bun-jsc',
    runtimeLabel: 'Bun/JSC',
    jsRuntime: true,
    cases: textDecoderCases,
  },
  {
    group: 'generated-1gib-textdecoder',
    file: 'browser-textdecoder-span-variants.json',
    runtimeId: 'chrome-v8-browser',
    runtimeLabel: 'Chrome/V8 browser',
    jsRuntime: true,
    cases: textDecoderCases,
  },
  {
    group: 'books-corpus-stability',
    file: 'candidate-headroom-books-corpus-stability.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: candidateStabilityCases,
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'books-corpus-stability',
    file: 'bun-candidate-headroom-books-corpus-stability.json',
    runtimeId: 'bun-jsc',
    runtimeLabel: 'Bun/JSC',
    jsRuntime: true,
    cases: candidateStabilityCases,
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'text-cache-negative-stability',
    file: 'text-cache-materialization-candidate-stability.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['rawFrameNameId', 'rawFrameNameIdTextCache'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'offset-text-cache-negative',
    file: 'offset-text-cache-materialization-candidate.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['rawFrameNameId', 'rawFrameNameIdTextCache', 'rawFrameNameIdOffsetTextCache', 'withoutTextStrings'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'medium-ascii-text-negative',
    file: 'medium-ascii-text-materialization-candidate.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['rawFrameNameId', 'rawFrameNameIdMediumAsciiText', 'withoutTextStrings'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'unrolled-medium-ascii-text-negative',
    file: 'unrolled-medium-ascii-text-materialization-candidate.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['rawFrameNameId', 'rawFrameNameIdUnrolledMediumAsciiText', 'rawFrameNameIdMediumAsciiText', 'withoutTextStrings'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'text-trim-guard-negative',
    file: 'text-trim-guard-candidate.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['rawFrameNameId', 'rawFrameNameIdTrimGuard'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'unrolled-medium-ascii-text-trim-guard-negative',
    file: 'unrolled-medium-ascii-text-trim-guard-candidate.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['rawFrameNameId', 'rawFrameNameIdUnrolledMediumAsciiText', 'rawFrameNameIdTrimGuard', 'rawFrameNameIdUnrolledMediumAsciiTextTrimGuard', 'withoutTextStrings'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'medium-ascii-attr-value-negative',
    file: 'medium-ascii-attr-value-materialization-candidate.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['rawFrameNameId', 'rawFrameNameIdMediumAsciiAttrValue', 'rawFrameNameIdMediumAsciiText', 'withoutTextStrings'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'attr-value-cache-negative',
    file: 'attr-value-cache-materialization-candidate.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['rawFrameNameId', 'rawFrameNameIdAttrValueCache', 'rawFrameStringCache', 'withoutAttributeValueStrings'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'bun-cache-candidates-books-corpus',
    file: 'bun-cache-candidates-books-corpus.json',
    runtimeId: 'bun-jsc',
    runtimeLabel: 'Bun/JSC',
    jsRuntime: true,
    cases: ['rawFrameNameId', 'rawFrameNameIdAttrValueCache', 'rawFrameNameIdOffsetTextCache', 'rawFrameNameIdUnrolledMediumAsciiText', 'withoutTextStrings'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'long-ascii-text-negative-stability',
    file: 'long-ascii-text-materialization-candidate-stability.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['stringFull', 'rawFrameNameId', 'rawFrameNameIdLongAsciiText'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'fold-trimmed-text-negative-stability',
    file: 'fold-trimmed-text-candidate-stability.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['rawFrameNameId', 'rawFrameNameIdFoldTrim'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'name-collision-safe-interning',
    file: 'name-collision-safe-interning-perf.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['stringFull', 'eventObjectFull', 'rawFrameNameId'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'text-trim-cost-decomposition',
    file: 'text-trim-cost-decomposition.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['rawFrameNameId', 'rawFrameNameIdFoldTrim'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'text-trim-cost-decomposition-2gib',
    file: 'text-trim-cost-decomposition-2gib.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['rawFrameNameId', 'rawFrameNameIdFoldTrim'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'text-trim-cost-decomposition-4gib',
    file: 'text-trim-cost-decomposition-4gib.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['rawFrameNameId'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'text-trim-cost-decomposition-8gib',
    file: 'text-trim-cost-decomposition-8gib.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['rawFrameNameId'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'text-checksum-consumer-decomposition',
    file: 'text-checksum-consumer-decomposition.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['rawFrameNameId', 'rawFrameNameIdTextLengthOnly', 'rawFrameNameIdTextNoFold', 'withoutTextStrings'],
    sourceMode: 'sync-iterable-byte-batches',
  },
  {
    group: 'semantic-checksum-upper-bound',
    file: 'semantic-checksum-upper-bound.json',
    runtimeId: 'node-v8',
    runtimeLabel: 'Node/V8',
    jsRuntime: true,
    cases: ['rawFrameNameId', 'rawFrameSemanticChecksum', 'withoutTextStrings'],
    sourceMode: 'sync-iterable-byte-batches',
  },
];

const crossProcessArtifacts = [
  {
    group: 'access-shape-cross-process-books-corpus',
    file: 'access-shape-candidate-cross-process.json',
    cases: ['cursorAccessor', 'rawFrameDirect', 'rawFrameNameId'],
  },
  {
    group: 'cross-process-books-corpus',
    file: 'candidate-headroom-cross-process-books-corpus.json',
    cases: candidateCases,
  },
  {
    group: 'no-counter-name-fold-cache-cross-process-books-corpus',
    file: 'no-counter-name-fold-cache-cross-process-books-corpus.json',
    cases: ['rawFrameNameId', 'rawFrameNameIdNoCounters', 'rawFrameNameIdNoCountersNameFoldCache'],
  },
  {
    group: 'warmup-full-cross-process-books-corpus',
    file: 'warmup-full-cross-process-books-corpus.json',
    cases: ['rawFrameNameId', 'rawFrameNameIdNoCounters'],
  },
  {
    group: 'medium-ascii-text-cross-process-books-corpus-warmup',
    file: 'medium-ascii-text-cross-process-books-corpus-warmup.json',
    cases: ['rawFrameNameId', 'rawFrameNameIdMediumAsciiText', 'withoutTextStrings'],
  },
  {
    group: 'cross-process-books-corpus-batch16',
    file: 'candidate-headroom-cross-process-books-corpus-batch16.json',
    cases: candidateCases,
  },
  {
    group: 'cross-process-large-asset-corpus',
    file: 'candidate-headroom-cross-process-large-asset-corpus.json',
    cases: candidateCases,
  },
  {
    group: 'cross-process-midsize-corpus',
    file: 'candidate-headroom-cross-process-midsize-corpus.json',
    cases: candidateCases,
  },
];

const fileBackedSweepArtifacts = [
  {
    group: 'file-backed-batch-size-sweep',
    file: 'file-backed-batch-size-sweep.json',
  },
  {
    group: 'file-backed-source-sweep',
    file: 'file-backed-source-sweep.json',
  },
];

const allocationArtifacts = [
  {
    file: 'quick-xml-allocation-count.json',
    id: 'quick-xml-global-allocator',
    runtimeId: 'quick-xml-rust',
    runtimeLabel: 'Rust/quick-xml',
    evidenceKind: 'global-allocator-counters',
  },
  {
    file: 'quick-xml-allocation-count-stability.json',
    id: 'quick-xml-global-allocator-stability',
    runtimeId: 'quick-xml-rust',
    runtimeLabel: 'Rust/quick-xml',
    evidenceKind: 'global-allocator-counters-stability',
  },
  {
    file: 'woodstox-jfr-allocation.json',
    id: 'woodstox-jfr-profile',
    runtimeId: 'woodstox-jvm',
    runtimeLabel: 'Java/Woodstox',
    evidenceKind: 'jfr-sampled-allocation',
  },
  {
    file: 'woodstox-measured-jfr-allocation.json',
    id: 'woodstox-measured-jfr-profile',
    runtimeId: 'woodstox-jvm',
    runtimeLabel: 'Java/Woodstox',
    evidenceKind: 'measured-window-jfr-sampled-allocation',
  },
  {
    file: 'woodstox-measured-jfr-allocation-rerun.json',
    id: 'woodstox-measured-jfr-profile-rerun',
    runtimeId: 'woodstox-jvm',
    runtimeLabel: 'Java/Woodstox',
    evidenceKind: 'measured-window-jfr-sampled-allocation-rerun',
  },
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    releaseDir: defaultReleaseDir,
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
      case '--release-dir':
        options.releaseDir = resolve(process.cwd(), readValue());
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

  if (!existsSync(options.releaseDir)) {
    throw new Error(`--release-dir does not exist: ${options.releaseDir}`);
  }
  return options;
}

function main() {
  const options = parseArgs();
  const report = createReport(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function createReport(options) {
  const readReleaseJson = file => readJson(resolve(options.releaseDir, file));
  const readOptionalReleaseJson = file => {
    const path = resolve(options.releaseDir, file);
    return existsSync(path) ? readJson(path) : null;
  };
  const externalReports = externalBaselineArtifacts
    .map(spec => ({ spec, report: spec.optional ? readOptionalReleaseJson(spec.file) : readReleaseJson(spec.file) }))
    .filter(item => item.report);
  const comparisonRows = [
    ...externalReports.flatMap(item => extractExternalRows(item.report, item.spec)),
    ...variantArtifacts.flatMap(spec => extractVariantRows(readReleaseJson(spec.file), spec)),
    ...crossProcessArtifacts.flatMap(spec => extractCrossProcessRows(readReleaseJson(spec.file), spec)),
    ...fileBackedSweepArtifacts.flatMap(spec => extractFileBackedSweepRows(readReleaseJson(spec.file), spec)),
  ].map(attachSourceShapeDetails);
  const allocationEvidence = allocationArtifacts.map(spec => extractAllocationEvidence(readReleaseJson(spec.file), spec));
  const textMaterializationFrontier = summarizeTextMaterializationFrontier(
    readOptionalReleaseJson('text-materialization-frontier.json'),
  );
  const sourceConsumptionFrontier = summarizeSourceConsumptionFrontier(
    readOptionalReleaseJson('stream-source-consumption-backpressure-counters.json'),
  );
  const summary = summarize(comparisonRows, allocationEvidence, textMaterializationFrontier, sourceConsumptionFrontier);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'same-contract-runtime-comparison',
    contract: 'same-full-string-checksum-contract-not-same-object-shape',
    note: 'Aggregates existing release artifacts under the same semantic checksum contract. It does not run benchmarks, normalize memory counters across runtimes, or prove a JavaScript runtime ceiling.',
    metadata: {
      releaseDir: options.releaseDir,
      sourceArtifacts: [
        ...externalReports.map(item => item.spec.file),
        ...variantArtifacts.map(spec => spec.file),
        ...crossProcessArtifacts.map(spec => spec.file),
        ...fileBackedSweepArtifacts.map(spec => spec.file),
        ...allocationArtifacts.map(spec => spec.file),
        ...(textMaterializationFrontier ? ['text-materialization-frontier.json'] : []),
        ...(sourceConsumptionFrontier ? ['stream-source-consumption-backpressure-counters.json'] : []),
      ],
    },
    summary,
    comparisonRows,
    allocationEvidence,
    findings: createFindings(summary),
  };
}

function extractExternalRows(report, spec = externalBaselineArtifacts[0]) {
  const results = report.results ?? [];
  const byTool = new Map(results.map(row => [row.tool, row]));
  const reference = byTool.get('woodstox') ?? results.find(row => row.status === 'ok');
  return results
    .filter(row => row.status === 'ok')
    .map(row => {
      const sourceMode = classifyExternalSourceMode(row, report);
      return {
        group: spec.group,
        sourceArtifact: spec.file,
        runtimeId: externalRuntimeId(row.tool),
        runtimeLabel: externalRuntimeLabel(row.tool),
        languageFamily: externalLanguageFamily(row.tool),
        jsRuntime: row.tool.startsWith('stax-'),
        caseId: row.tool,
        implementation: row.implementation,
        contractScope: row.workload,
        fixture: {
          source: spec.fixtureSource,
          shape: spec.fixtureShape,
          sizeMiB: round(report.fixture?.sizeMiB),
          sizeGiB: round((report.fixture?.sizeMiB ?? 0) / 1024),
        },
        fullStringParity: sameEventChecksum(row, reference),
        eventCount: row.eventCount,
        checksum: row.checksum,
        mibPerSec: round(row.mibPerSec),
        boundedMemory: typeof row.boundedMemory === 'boolean' ? row.boundedMemory : null,
        sourceMode,
        fullArrayBufferParserInput: classifyFullArrayBufferParserInput(row, sourceMode, report),
        memory: extractExternalMemory(row, report),
        woodstoxRatio: round(row.woodstoxRatio),
        targetStatus: row.targetStatus ?? null,
        runtimeLimitCounterexample: false,
      };
    });
}

function extractVariantRows(report, spec) {
  const variants = report.variants ?? [];
  const selected = variants.filter(row => spec.cases.includes(row.id));
  return selected.map(row => {
    const fixture = extractFixture(report.fixture);
    const memory = extractMemory(row, report);
    const samples = summarizeSamples(row, fixture);
    const isLarge = (fixture.sizeGiB ?? 0) >= 0.999;
    const counterexample = Boolean(
      spec.jsRuntime
      && row.fullStringParity
      && row.boundedMemory
      && isLarge
      && row.mibPerSec >= 200,
    );
    const sourceMode = spec.sourceMode ?? classifyArtifactSourceMode(row, report);
    return {
      group: spec.group,
      sourceArtifact: spec.file,
      runtimeId: spec.runtimeId,
      runtimeLabel: spec.runtimeLabel,
      languageFamily: 'javascript',
      jsRuntime: spec.jsRuntime,
      engine: report.environment?.javascriptEngine ?? inferEngine(report.environment),
      engineVersion: engineVersion(report.environment),
      caseId: row.id,
      implementation: row.implementation,
      contractScope: row.contractScope,
      fixture,
      fullStringParity: row.fullStringParity === true,
      eventCount: row.eventCount,
      checksum: row.checksum,
      mibPerSec: round(row.mibPerSec),
      boundedMemory: row.boundedMemory === true,
      sourceMode,
      demandDrivenSource: row.demandDrivenSource === true ? true : row.demandDrivenSource === false ? false : null,
      directReadableStream: row.directReadableStream === true ? true : row.directReadableStream === false ? false : null,
      respectsBackpressure: row.respectsBackpressure === true ? true : row.respectsBackpressure === false ? false : null,
      fullArrayBufferParserInput: classifyFullArrayBufferParserInput(row, sourceMode, report),
      memory,
      materializationCounters: pickMaterializationCounters(row.materializationCounters),
      sampleCount: samples.sampleCount,
      sampleMinMiBPerSec: samples.sampleMinMiBPerSec,
      sampleMaxMiBPerSec: samples.sampleMaxMiBPerSec,
      sampleSpreadRatio: samples.sampleSpreadRatio,
      woodstoxRatio: round(row.woodstoxRatio),
      targetStatus: row.targetStatus ?? null,
      runtimeLimitCounterexample: counterexample,
    };
  });
}

function summarizeSamples(row, fixture) {
  if (!Array.isArray(row.samplesMs) || row.samplesMs.length === 0 || typeof fixture.sizeMiB !== 'number') {
    return {
      sampleCount: Array.isArray(row.samplesMs) ? row.samplesMs.length : null,
      sampleMinMiBPerSec: null,
      sampleMaxMiBPerSec: null,
      sampleSpreadRatio: null,
    };
  }
  const throughputs = row.samplesMs
    .filter(value => typeof value === 'number' && Number.isFinite(value) && value > 0)
    .map(value => fixture.sizeMiB / (value / 1000));
  if (throughputs.length === 0) {
    return {
      sampleCount: row.samplesMs.length,
      sampleMinMiBPerSec: null,
      sampleMaxMiBPerSec: null,
      sampleSpreadRatio: null,
    };
  }
  const min = Math.min(...throughputs);
  const max = Math.max(...throughputs);
  return {
    sampleCount: row.samplesMs.length,
    sampleMinMiBPerSec: round(min),
    sampleMaxMiBPerSec: round(max),
    sampleSpreadRatio: min > 0 ? round((max - min) / min) : null,
  };
}

function extractCrossProcessRows(report, spec) {
  return (report.runtimes ?? []).flatMap(runtimeReport => {
    const runtime = normalizeCrossProcessRuntime(runtimeReport);
    const fixture = extractFixture(runtimeReport.fixture);
    return (runtimeReport.variants ?? [])
      .filter(row => spec.cases.includes(row.id))
      .map(row => {
        const isLarge = (fixture.sizeGiB ?? 0) >= 0.999;
        const mibPerSec = round(row.avgMiBPerSec);
        const boundedMemory = row.boundedMemoryAll === true;
        const fullStringParity = row.fullStringParity === true && row.stableResult === true;
        const sourceMode = classifyArtifactSourceMode(row, report);
        return {
          group: spec.group,
          sourceArtifact: spec.file,
          runtimeId: runtime.id,
          runtimeLabel: runtime.label,
          languageFamily: 'javascript',
          jsRuntime: true,
          engine: runtimeReport.environment?.javascriptEngine ?? inferEngine(runtimeReport.environment),
          engineVersion: engineVersion(runtimeReport.environment),
          caseId: row.id,
          implementation: `${runtime.label} cross-process ${row.id}`,
          contractScope: row.contractScope,
          fixture,
          fullStringParity,
          eventCount: firstSingleton(row.eventCounts),
          checksum: firstSingleton(row.checksums),
          mibPerSec,
          boundedMemory,
          sourceMode,
          fullArrayBufferParserInput: classifyFullArrayBufferParserInput(row, sourceMode, report),
          memory: extractCrossProcessMemory(row),
          materializationCounters: null,
          sampleCount: row.sampleCount ?? runtimeReport.sampleCount ?? null,
          sampleMinMiBPerSec: round(row.minMiBPerSec),
          sampleMaxMiBPerSec: round(row.maxMiBPerSec),
          sampleSpreadRatio: round(row.spreadRatio),
          woodstoxRatio: null,
          targetStatus: null,
          runtimeLimitCounterexample: Boolean(
            fullStringParity
            && boundedMemory
            && isLarge
            && typeof mibPerSec === 'number'
            && mibPerSec >= 200
          ),
        };
      });
  });
}

function extractFileBackedSweepRows(report, spec) {
  const fixture = {
    source: 'generated-file',
    shape: 'node-string-return-1024mib',
    sourceFile: report.fixture?.path ?? null,
    sizeGiB: round(report.fixture?.sizeGiB),
    sizeMiB: round(report.fixture?.sizeMiB),
    actualBytes: null,
    batchSize: null,
    rowCycleSize: null,
  };
  return (report.rows ?? []).map(row => {
    const isLarge = (fixture.sizeGiB ?? 0) >= 0.999;
    const mibPerSec = round(row.mibPerSec);
    const boundedMemory = row.boundedMemory === true;
    const fullStringParity = row.fullStringParity === true;
    const sourceMode = 'file-backed-sync-iterable-byte-batches';
    return {
      group: spec.group,
      sourceArtifact: spec.file,
      runtimeId: 'node-v8',
      runtimeLabel: 'Node/V8',
      languageFamily: 'javascript',
      jsRuntime: true,
      engine: report.environment?.v8 ? 'V8' : null,
      engineVersion: report.environment?.v8 ?? null,
      caseId: row.id,
      implementation: row.implementation,
      contractScope: row.contractScope,
      fixture,
      fullStringParity,
      eventCount: row.eventCount,
      checksum: row.checksum,
      mibPerSec,
      boundedMemory,
      sourceMode,
      fullArrayBufferParserInput: classifyFullArrayBufferParserInput(row, sourceMode, report),
      memory: extractMemory(row, report),
      materializationCounters: null,
      sampleCount: Array.isArray(row.samplesMs) ? row.samplesMs.length : null,
      sampleMinMiBPerSec: null,
      sampleMaxMiBPerSec: null,
      sampleSpreadRatio: null,
      woodstoxRatio: null,
      targetStatus: null,
      runtimeLimitCounterexample: Boolean(
        fullStringParity
        && boundedMemory
        && isLarge
        && typeof mibPerSec === 'number'
        && mibPerSec >= 200
      ),
    };
  });
}

function classifyExternalSourceMode(row, report) {
  if (typeof row.sourceMode === 'string') return row.sourceMode;
  if (report.options?.staxStreamSource === 'file-sync-batches' && String(row.tool ?? '').startsWith('stax-')) {
    return 'file-backed-sync-iterable-byte-batches';
  }
  return null;
}

function classifyArtifactSourceMode(row, report) {
  if (typeof row.sourceMode === 'string') return row.sourceMode;
  if (typeof report.sourceContract?.sourceMode === 'string') return report.sourceContract.sourceMode;
  const parserInput = report.sourceContract?.childSourceContract?.parserInput;
  if (typeof parserInput === 'string' && /synchronous Iterable<Uint8Array\[]>/.test(parserInput)) {
    return 'sync-iterable-byte-batches';
  }
  if (isPreparedByteBatchCandidateReport(report) && !String(row.id ?? '').startsWith('fetch')) {
    return 'sync-iterable-byte-batches';
  }
  if (report.objective === 'candidate-headroom-cross-process'
    && report.options?.fixtureShape === 'corpus-cycle') {
    return 'sync-iterable-byte-batches';
  }
  return null;
}

function isPreparedByteBatchCandidateReport(report) {
  return [
    'candidate-headroom-large',
    'browser-candidate-headroom',
    'firefox-bidi-candidate-headroom',
    'browser-candidate-headroom-cross-process',
  ].includes(report.objective);
}

function classifyFullArrayBufferParserInput(row, sourceMode = null, report = null) {
  if (typeof row.fullArrayBufferParserInput === 'boolean') return row.fullArrayBufferParserInput;
  const mode = typeof sourceMode === 'string' ? sourceMode : '';
  if (/sync-iterable-byte-batches|async-iterable-byte-batches|readable-stream-pull|complete-js-string/.test(mode)) {
    return false;
  }

  const sourceContract = report?.sourceContract?.childSourceContract ?? report?.sourceContract;
  const parserInput = sourceContract?.parserInput ?? '';
  const arrayBufferConsumption = sourceContract?.arrayBufferConsumption ?? '';
  const combined = `${parserInput} ${arrayBufferConsumption}`;
  if (/does not prebuild|does not use a full XML ArrayBuffer|Neither measured row constructs/i.test(combined)) {
    return false;
  }
  if (/full XML ArrayBuffer parser input|complete XML ArrayBuffer/i.test(combined)) {
    return true;
  }
  return null;
}

function attachSourceShapeDetails(row) {
  const corpusSeedBytes = estimateCorpusSeedBytes(row.fixture);
  if (typeof corpusSeedBytes !== 'number') {
    return row;
  }
  const actualBytes = row.fixture?.actualBytes;
  const corpusSeedToTargetRatio = typeof corpusSeedBytes === 'number'
    && typeof actualBytes === 'number'
    && actualBytes > 0
    ? corpusSeedBytes / actualBytes
    : null;
  return {
    ...row,
    corpusSeedReplay: row.fullArrayBufferParserInput === false && (row.fixture?.sizeGiB ?? 0) >= 0.999,
    corpusSeedBytes,
    corpusSeedToTargetRatio,
  };
}

function estimateCorpusSeedBytes(fixture = {}) {
  if (fixture.source !== 'corpus-file' || fixture.rowCycleSize !== 1) return null;
  return typeof fixture.maxRowBytes === 'number' ? fixture.maxRowBytes : null;
}

function extractExternalMemory(row, report) {
  if (row.memory?.maxRssBytes !== undefined) {
    return extractMemory(row, report);
  }
  return {
    primaryKind: 'not-recorded',
    note: report.options?.staxStreamSource === 'file-sync-batches' && String(row.tool ?? '').startsWith('stax-')
      ? 'external-baseline records throughput and checksum parity; this stax row is demand-driven file-backed byte batches.'
      : 'external-baseline records throughput and checksum parity, not peak memory.',
  };
}

function normalizeCrossProcessRuntime(runtimeReport) {
  switch (runtimeReport.runtime) {
    case 'node':
      return { id: 'node-v8', label: 'Node/V8' };
    case 'bun':
      return { id: 'bun-jsc', label: 'Bun/JSC' };
    default:
      return {
        id: runtimeReport.runtime ?? 'unknown',
        label: runtimeReport.runtime ?? 'unknown',
      };
  }
}

function extractCrossProcessMemory(row) {
  return {
    primaryKind: 'process-rss',
    maxMiB: round(bytesToMiB(row.maxRssBytes)),
    maxHeapUsedMiB: round(bytesToMiB(row.maxHeapUsedBytes)),
    note: 'max across independent child processes',
  };
}

function firstSingleton(values) {
  return Array.isArray(values) && values.length === 1 ? values[0] : null;
}

function extractAllocationEvidence(report, spec) {
  const benchmark = report.benchmark ?? {};
  const allocation = report.allocation ?? {};
  const shapeSummary = allocation.shapeSummary ?? benchmark.shapeSummary ?? null;
  const allocationSummary = allocation.summary ?? benchmark.allocationSummary ?? null;
  const dominantPhase = allocation.dominantPhase ?? findDominantPhase(allocation.phaseSummary ?? benchmark.phaseAllocationSummary ?? []);
  return {
    id: spec.id,
    sourceArtifact: spec.file,
    runtimeId: spec.runtimeId,
    runtimeLabel: spec.runtimeLabel,
    evidenceKind: spec.evidenceKind,
    eventCount: benchmark.eventCount,
    checksum: benchmark.checksum,
    mibPerSec: round(benchmark.mibPerSec),
    memory: allocationSummary ? {
      primaryKind: 'total-allocator-traffic',
      totalAllocatedMiB: round(bytesToMiB(allocationSummary.totalAllocatedBytes)),
      netAllocatedMiB: round(bytesToMiB(allocationSummary.netAllocatedBytes)),
      allocationOperations: allocationSummary.allocationOperations,
    } : {
      primaryKind: spec.evidenceKind,
      sampledBytes: allocation.sampledBytes ?? null,
      sampledMiB: bytesToMiB(allocation.sampledBytes),
      stringBoundaryEventCount: allocation.stringBoundaryEventCount ?? null,
      consumeStackEventCount: allocation.consumeStackEventCount ?? null,
    },
    shapeSummary: shapeSummary ? {
      totalDecodeCount: shapeSummary.totalDecodeCount,
      totalBorrowedCount: shapeSummary.totalBorrowedCount,
      totalOwnedCount: shapeSummary.totalOwnedCount,
    } : null,
    dominantPhase: dominantPhase ? {
      phase: dominantPhase.phase,
      allocationOperations: dominantPhase.allocationOperations,
      totalAllocatedMiB: round(bytesToMiB(dominantPhase.totalAllocatedBytes)),
    } : null,
    limitation: allocationSummary
      ? 'Global allocator traffic is not peak RSS and is not directly comparable to JavaScript heap or browser host process counters.'
      : 'JFR object allocation events are sampled counts/bytes, not a deterministic allocation census or peak RSS.',
  };
}

function findDominantPhase(rows) {
  return rows
    .filter(row => typeof row?.totalAllocatedBytes === 'number')
    .sort((left, right) => right.totalAllocatedBytes - left.totalAllocatedBytes)[0] ?? null;
}

function summarizeSourceShapeSafety(rows) {
  const sourceModeRows = rows.filter(row => row.sourceMode);
  const corpusSeedReplayRows = sourceModeRows.filter(row => row.corpusSeedReplay === true);
  const maxCorpusSeedBytes = maxNullable(corpusSeedReplayRows.map(row => row.corpusSeedBytes));
  const maxCorpusSeedToTargetRatio = maxNullable(corpusSeedReplayRows.map(row => row.corpusSeedToTargetRatio));
  return {
    largeJsFullSourceModeRows: sourceModeRows.length,
    notFullArrayBufferRows: sourceModeRows.filter(row => row.fullArrayBufferParserInput === false).length,
    fullArrayBufferRows: sourceModeRows.filter(row => row.fullArrayBufferParserInput === true).length,
    unknownArrayBufferRows: sourceModeRows.filter(row => row.fullArrayBufferParserInput === null).length,
    corpusSeedReplayRows: corpusSeedReplayRows.length,
    maxCorpusSeedMiB: round(bytesToMiB(maxCorpusSeedBytes)),
    maxCorpusSeedToTargetRatio: round(maxCorpusSeedToTargetRatio),
  };
}

function summarizeWoodstoxTargetDistance(group, groupRows, woodstoxReference) {
  const fastestJs = maxBy(
    groupRows.filter(row => row.jsRuntime && row.fullStringParity),
    row => row.mibPerSec,
  );
  if (!fastestJs || !woodstoxReference) {
    return null;
  }
  const target90MiBPerSec = round(woodstoxReference.mibPerSec * 0.9);
  return {
    group,
    fastestJs: summarizeRow(fastestJs),
    woodstoxReference: summarizeRow(woodstoxReference),
    woodstox90MiBPerSec: target90MiBPerSec,
    jsWoodstoxRatio: round(fastestJs.mibPerSec / woodstoxReference.mibPerSec),
    remainingTo90PercentMiBPerSec: round(target90MiBPerSec - fastestJs.mibPerSec),
    targetMet: fastestJs.mibPerSec >= target90MiBPerSec,
    caveat: fastestJs.sourceArtifact === woodstoxReference.sourceArtifact
      ? 'same artifact Woodstox reference'
      : 'same books 1024 MiB fixture family, but Woodstox reference comes from a separate candidate artifact',
  };
}

function summarizeQuickXmlTargetDistance(group, groupRows, quickXmlReference) {
  const fastestJs = maxBy(
    groupRows.filter(row => row.jsRuntime && row.fullStringParity),
    row => row.mibPerSec,
  );
  if (!fastestJs || !quickXmlReference) {
    return null;
  }
  const target90MiBPerSec = round(quickXmlReference.mibPerSec * 0.9);
  return {
    group,
    fastestJs: summarizeRow(fastestJs),
    quickXmlReference: summarizeRow(quickXmlReference),
    quickXml90MiBPerSec: target90MiBPerSec,
    jsQuickXmlRatio: round(fastestJs.mibPerSec / quickXmlReference.mibPerSec),
    remainingTo90PercentMiBPerSec: round(target90MiBPerSec - fastestJs.mibPerSec),
    targetMet: fastestJs.mibPerSec >= target90MiBPerSec,
    caveat: fastestJs.sourceArtifact === quickXmlReference.sourceArtifact
      ? 'same artifact quick-xml reference'
      : 'same books 1024 MiB fixture family, but quick-xml reference comes from a separate candidate artifact',
  };
}

function summarizeTextMaterializationFrontier(report) {
  if (!report?.summary) return null;
  const summary = report.summary;
  return {
    sourceArtifact: 'text-materialization-frontier.json',
    targetMiBPerSec: round(summary.targetMiBPerSec),
    fastestFull: summary.fastestFull ? {
      id: summary.fastestFull.id,
      sourceArtifact: summary.fastestFull.sourceArtifact,
      mibPerSec: round(summary.fastestFull.mibPerSec),
      boundedMemory: summary.fastestFull.boundedMemory === true,
      fullStringParity: summary.fastestFull.fullStringParity === true,
      textStringReads: summary.fastestFull.textStringReads ?? null,
      stringFieldReads: summary.fastestFull.stringFieldReads ?? null,
    } : null,
    fastestWithoutText: summary.fastestWithoutText ? {
      id: summary.fastestWithoutText.id,
      sourceArtifact: summary.fastestWithoutText.sourceArtifact,
      mibPerSec: round(summary.fastestWithoutText.mibPerSec),
      boundedMemory: summary.fastestWithoutText.boundedMemory === true,
      fullStringParity: summary.fastestWithoutText.fullStringParity === true,
      textStringReads: summary.fastestWithoutText.textStringReads ?? null,
      stringFieldReads: summary.fastestWithoutText.stringFieldReads ?? null,
    } : null,
    fastestNoTrim: summary.fastestNoTrim ? {
      id: summary.fastestNoTrim.id,
      sourceArtifact: summary.fastestNoTrim.sourceArtifact,
      mibPerSec: round(summary.fastestNoTrim.mibPerSec),
      fullStringParity: summary.fastestNoTrim.fullStringParity === true,
    } : null,
    fastestFoldTrim: summary.fastestFoldTrim ? {
      id: summary.fastestFoldTrim.id,
      sourceArtifact: summary.fastestFoldTrim.sourceArtifact,
      mibPerSec: round(summary.fastestFoldTrim.mibPerSec),
      fullStringParity: summary.fastestFoldTrim.fullStringParity === true,
    } : null,
    fastestFullToTargetRatio: round(summary.fastestFullToTargetRatio),
    fastestFullRemainingMiBPerSec: round(summary.fastestFullRemainingMiBPerSec),
    requiredSpeedupToTarget: round(summary.requiredSpeedupToTarget),
    fastestWithoutTextToFullRatio: round(summary.fastestWithoutTextToFullRatio),
    fastestNoTrimToFullRatio: round(summary.fastestNoTrimToFullRatio),
    fastestFoldTrimToFullRatio: round(summary.fastestFoldTrimToFullRatio),
    noTextRowsCrossTarget: summary.noTextRowsCrossTarget ?? null,
    fullRowsCrossTarget: summary.fullRowsCrossTarget ?? null,
    noTrimRowsCrossTarget: summary.noTrimRowsCrossTarget ?? null,
    foldTrimRowsCrossTarget: summary.foldTrimRowsCrossTarget ?? null,
    negativeCandidateCount: summary.negativeCandidateCount ?? null,
    conclusionAllowed: summary.conclusionAllowed === true,
    interpretation: 'Text/CDATA omission crosses the target as headroom evidence, while trim-only, fold-trim, cache, and ASCII candidates remain negative for the current full-string contract.',
  };
}

function summarizeSourceConsumptionFrontier(report) {
  if (!report?.summary) return null;
  const rows = Array.isArray(report.rows) ? report.rows : [];
  const asyncAndReadableRows = rows.filter(row =>
    row.sourceMode === 'async-iterable-byte-batches'
    || row.sourceMode === 'web-readable-stream-pull'
  );
  return {
    sourceArtifact: 'stream-source-consumption-backpressure-counters.json',
    contract: report.contract ?? null,
    fixtureSizeMiB: round(report.fixture?.sizeMiB),
    primaryLargeComparisonInput: report.sourceContract?.primaryLargeComparisonInput ?? null,
    syncIterableInput: report.sourceContract?.syncIterableInput ?? null,
    asyncIterableInput: report.sourceContract?.asyncIterableInput ?? null,
    readableStreamInput: report.sourceContract?.readableStreamInput ?? null,
    readableStreamAsyncBoundary: report.sourceContract?.readableStreamAsyncBoundary ?? null,
    readableStreamBackpressure: report.sourceContract?.readableStreamBackpressure ?? null,
    arrayBufferConsumption: report.sourceContract?.arrayBufferConsumption ?? null,
    fastestSyncIterable: summarizeSourceConsumptionRow(report.summary.fastestSyncIterable, rows),
    fastestAsyncIterable: summarizeSourceConsumptionRow(report.summary.fastestAsyncIterable, rows),
    fastestReadableStream: summarizeSourceConsumptionRow(report.summary.fastestReadableStream, rows),
    fastestAsyncIterableRatioToFastestSyncIterable: round(report.summary.fastestAsyncIterableRatioToFastestSyncIterable),
    fastestReadableStreamRatioToFastestSyncIterable: round(report.summary.fastestReadableStreamRatioToFastestSyncIterable),
    counterexamples200MiB: report.summary.counterexamples200MiB ?? null,
    backpressureRows: asyncAndReadableRows.length,
    backpressureRowsRespected: asyncAndReadableRows
      .filter(row => row.demandDrivenSource === true && row.respectsBackpressure === true).length,
    fullArrayBufferRows: rows.filter(row => row.fullArrayBufferParserInput === true).length,
    readableStreamDirectRows: rows.filter(row => row.directReadableStream === true).length,
    syncIterableRows: rows.filter(row => row.sourceMode === 'sync-iterable-byte-batches').length,
    asyncIterableRows: rows.filter(row => row.sourceMode === 'async-iterable-byte-batches').length,
    interpretation: 'The current large-file comparison uses demand-driven Iterable<Uint8Array[]> batches; direct ReadableStream rows are separate source-shape evidence and remain bounded by pull/read demand.',
  };
}

function summarizeSourceConsumptionRow(summaryRow, rows) {
  if (!summaryRow) return null;
  const row = rows.find(candidate => candidate.id === summaryRow.id) ?? {};
  const counters = row.sourceCounters?.first ?? {};
  return {
    id: summaryRow.id,
    sourceMode: row.sourceMode ?? null,
    parserInput: row.parserInput ?? null,
    mibPerSec: round(summaryRow.mibPerSec),
    maxRssMiB: round(summaryRow.maxRssBytes / (1024 * 1024)),
    batchSize: row.batchSize ?? null,
    directReadableStream: row.directReadableStream === true,
    fullArrayBufferParserInput: row.fullArrayBufferParserInput === true,
    demandDrivenSource: row.demandDrivenSource === true,
    respectsBackpressure: row.respectsBackpressure === null ? null : row.respectsBackpressure === true,
    readCalls: counters.readCalls ?? null,
    batchCount: counters.batchCount ?? null,
    iteratorYields: counters.iteratorYields ?? null,
    pullCalls: counters.pullCalls ?? null,
    enqueueCalls: counters.enqueueCalls ?? null,
    eventCount: summaryRow.eventCount ?? null,
    checksum: summaryRow.checksum ?? null,
  };
}

function summarize(rows, allocationEvidence, textMaterializationFrontier, sourceConsumptionFrontier) {
  const jsLargeFullRows = rows.filter(row =>
    row.jsRuntime
    && row.fullStringParity
    && (row.fixture?.sizeGiB ?? 0) >= 0.999
  );
  const jsCounterexamples = jsLargeFullRows.filter(row => row.runtimeLimitCounterexample);
  const fastestJsLargeFullRow = maxBy(jsLargeFullRows, row => row.mibPerSec);
  const jsLargePublicEventRows = jsLargeFullRows.filter(row => row.caseId === 'eventObjectFull');
  const fastestJsLargePublicEventRow = maxBy(jsLargePublicEventRows, row => row.mibPerSec);
  const fastestBoundedJsLargePublicEventRow = maxBy(
    jsLargePublicEventRows.filter(row => row.boundedMemory),
    row => row.mibPerSec,
  );
  const fastestRowsByGroup = Array.from(groupBy(jsLargeFullRows, row => row.group), ([group, groupRows]) => ({
    group,
    fastest: maxBy(groupRows, row => row.mibPerSec),
  }));
  const externalRows = rows.filter(row => row.group === 'external-baseline-16mib');
  const woodstox = externalRows.find(row => row.runtimeId === 'woodstox-jvm');
  const quickXml = externalRows.find(row => row.runtimeId === 'quick-xml-rust');
  const externalLargeRows = rows.filter(row => row.group === 'external-baseline-1024mib-file-sync-batches');
  const sameFixture1024MiBRows = rows.filter(row =>
    row.group === 'external-baseline-1024mib-file-sync-batches'
    || row.group === 'file-backed-batch-size-sweep'
    || row.group === 'file-backed-source-sweep'
    || row.group === 'file-backed-short-attr-value-cache-candidate'
    || row.group === 'file-backed-trim-boundary-check-candidate'
    || row.group === 'file-backed-long-ascii-text-candidate'
  );
  const largeWoodstox = externalLargeRows.find(row => row.runtimeId === 'woodstox-jvm');
  const largeQuickXml = externalLargeRows.find(row => row.runtimeId === 'quick-xml-rust');
  const largeStaxStream = externalLargeRows.find(row => row.caseId === 'stax-stream');
  const largeRawFrameNameId = externalLargeRows.find(row => row.caseId === 'stax-raw-frame-name-id');
  const sameFixtureWoodstox = maxBy(
    sameFixture1024MiBRows.filter(row => row.runtimeId === 'woodstox-jvm'),
    row => row.mibPerSec,
  );
  const sameFixtureQuickXml = maxBy(
    sameFixture1024MiBRows.filter(row => row.runtimeId === 'quick-xml-rust'),
    row => row.mibPerSec,
  );
  const fastestSameFixtureLargeJsRow = maxBy(
    sameFixture1024MiBRows.filter(row => row.jsRuntime && row.fullStringParity),
    row => row.mibPerSec,
  );
  const sameFixture1024MiBTargetRows = Array.from(
    groupBy(sameFixture1024MiBRows, row => row.group),
    ([group, groupRows]) => {
      const groupWoodstox = maxBy(
        groupRows.filter(row => row.runtimeId === 'woodstox-jvm'),
        row => row.mibPerSec,
      );
      return summarizeWoodstoxTargetDistance(group, groupRows, groupWoodstox ?? sameFixtureWoodstox);
    },
  )
    .filter(Boolean)
    .sort((left, right) => (right.fastestJs?.mibPerSec ?? -Infinity) - (left.fastestJs?.mibPerSec ?? -Infinity));
  const sameFixture1024MiBQuickXmlTargetRows = Array.from(
    groupBy(sameFixture1024MiBRows, row => row.group),
    ([group, groupRows]) => {
      const groupQuickXml = maxBy(
        groupRows.filter(row => row.runtimeId === 'quick-xml-rust'),
        row => row.mibPerSec,
      );
      return summarizeQuickXmlTargetDistance(group, groupRows, groupQuickXml ?? sameFixtureQuickXml);
    },
  )
    .filter(Boolean)
    .sort((left, right) => (right.fastestJs?.mibPerSec ?? -Infinity) - (left.fastestJs?.mibPerSec ?? -Infinity));
  const fastestJsLargeFullRowMibPerSec = fastestJsLargeFullRow?.mibPerSec ?? null;
  const largeWoodstoxMibPerSec = largeWoodstox?.mibPerSec ?? null;
  const sameFixtureWoodstoxMibPerSec = sameFixtureWoodstox?.mibPerSec ?? null;
  const sameFixtureQuickXmlMibPerSec = sameFixtureQuickXml?.mibPerSec ?? null;
  const targetWoodstox90MiBPerSec = typeof largeWoodstoxMibPerSec === 'number'
    ? round(largeWoodstoxMibPerSec * 0.9)
    : null;
  const sameFixtureTargetWoodstox90MiBPerSec = typeof sameFixtureWoodstoxMibPerSec === 'number'
    ? round(sameFixtureWoodstoxMibPerSec * 0.9)
    : null;
  const sameFixtureTargetQuickXml90MiBPerSec = typeof sameFixtureQuickXmlMibPerSec === 'number'
    ? round(sameFixtureQuickXmlMibPerSec * 0.9)
    : null;
  const fastestSameFixtureLargeJsMibPerSec = fastestSameFixtureLargeJsRow?.mibPerSec ?? null;

  return {
    rowCount: rows.length,
    jsLargeFullRowCount: jsLargeFullRows.length,
    jsRuntimeCounterexamples200MiB: jsCounterexamples.length,
    fastestJsLargeFullRow: summarizeRow(fastestJsLargeFullRow),
    fastestJsLargeFullRowTo200MiBPerSec: {
      ratio: typeof fastestJsLargeFullRowMibPerSec === 'number' ? round(fastestJsLargeFullRowMibPerSec / 200) : null,
      remainingMiBPerSec: typeof fastestJsLargeFullRowMibPerSec === 'number' ? round(200 - fastestJsLargeFullRowMibPerSec) : null,
    },
    fastestJsLargeFullRowTo1024MiBWoodstoxReference: {
      ratio: typeof fastestJsLargeFullRowMibPerSec === 'number' && typeof largeWoodstoxMibPerSec === 'number'
        ? round(fastestJsLargeFullRowMibPerSec / largeWoodstoxMibPerSec)
        : null,
      remainingTo90PercentMiBPerSec: typeof fastestJsLargeFullRowMibPerSec === 'number' && typeof targetWoodstox90MiBPerSec === 'number'
        ? round(targetWoodstox90MiBPerSec - fastestJsLargeFullRowMibPerSec)
        : null,
      comparableFixture: false,
      caveat: 'ratio uses the 1024 MiB Woodstox reference throughput, but the fastest aggregated JS row may come from a different corpus fixture.',
    },
    sameFixture1024MiBWoodstoxTarget: {
      group: fastestSameFixtureLargeJsRow?.group ?? null,
      sourceArtifact: fastestSameFixtureLargeJsRow?.sourceArtifact ?? null,
      fastestJsCaseId: fastestSameFixtureLargeJsRow?.caseId ?? null,
      fastestJsMiBPerSec: round(fastestSameFixtureLargeJsMibPerSec),
      woodstoxSourceArtifact: sameFixtureWoodstox?.sourceArtifact ?? null,
      woodstoxMiBPerSec: round(sameFixtureWoodstoxMibPerSec),
      target90MiBPerSec: sameFixtureTargetWoodstox90MiBPerSec,
      fastestJsWoodstoxRatio: typeof fastestSameFixtureLargeJsMibPerSec === 'number' && typeof sameFixtureWoodstoxMibPerSec === 'number'
        ? round(fastestSameFixtureLargeJsMibPerSec / sameFixtureWoodstoxMibPerSec)
        : null,
      remainingTo90PercentMiBPerSec: typeof fastestSameFixtureLargeJsMibPerSec === 'number' && typeof sameFixtureTargetWoodstox90MiBPerSec === 'number'
        ? round(sameFixtureTargetWoodstox90MiBPerSec - fastestSameFixtureLargeJsMibPerSec)
        : null,
      targetMet: typeof fastestSameFixtureLargeJsMibPerSec === 'number' && typeof sameFixtureTargetWoodstox90MiBPerSec === 'number'
        ? fastestSameFixtureLargeJsMibPerSec >= sameFixtureTargetWoodstox90MiBPerSec
        : null,
    },
    sameFixture1024MiBTargetRows,
    sameFixture1024MiBQuickXmlTarget: {
      group: fastestSameFixtureLargeJsRow?.group ?? null,
      sourceArtifact: fastestSameFixtureLargeJsRow?.sourceArtifact ?? null,
      fastestJsCaseId: fastestSameFixtureLargeJsRow?.caseId ?? null,
      fastestJsMiBPerSec: round(fastestSameFixtureLargeJsMibPerSec),
      quickXmlSourceArtifact: sameFixtureQuickXml?.sourceArtifact ?? null,
      quickXmlMiBPerSec: round(sameFixtureQuickXmlMibPerSec),
      target90MiBPerSec: sameFixtureTargetQuickXml90MiBPerSec,
      fastestJsQuickXmlRatio: typeof fastestSameFixtureLargeJsMibPerSec === 'number' && typeof sameFixtureQuickXmlMibPerSec === 'number'
        ? round(fastestSameFixtureLargeJsMibPerSec / sameFixtureQuickXmlMibPerSec)
        : null,
      remainingTo90PercentMiBPerSec: typeof fastestSameFixtureLargeJsMibPerSec === 'number' && typeof sameFixtureTargetQuickXml90MiBPerSec === 'number'
        ? round(sameFixtureTargetQuickXml90MiBPerSec - fastestSameFixtureLargeJsMibPerSec)
        : null,
      targetMet: typeof fastestSameFixtureLargeJsMibPerSec === 'number' && typeof sameFixtureTargetQuickXml90MiBPerSec === 'number'
        ? fastestSameFixtureLargeJsMibPerSec >= sameFixtureTargetQuickXml90MiBPerSec
        : null,
    },
    sameFixture1024MiBQuickXmlTargetRows,
    sameFixture1024MiBProcessRssSnapshot: {
      caveat: 'Process RSS values are same-fixture endpoint evidence, not allocation-model equivalence across Java, Rust, and JavaScript runtimes.',
      fastestJs: summarizeProcessRssRow(fastestSameFixtureLargeJsRow),
      woodstox: summarizeProcessRssRow(sameFixtureWoodstox),
      quickXml: summarizeProcessRssRow(sameFixtureQuickXml),
    },
    fastestJsLargePublicEventRow: summarizeRow(fastestJsLargePublicEventRow),
    fastestBoundedJsLargePublicEventRow: summarizeRow(fastestBoundedJsLargePublicEventRow),
    fastestRowsByGroup: fastestRowsByGroup.map(item => ({
      group: item.group,
      fastest: summarizeRow(item.fastest),
    })),
    externalBaseline16MiB: {
      woodstoxMiBPerSec: round(woodstox?.mibPerSec),
      quickXmlMiBPerSec: round(quickXml?.mibPerSec),
      quickXmlWoodstoxRatio: round(quickXml?.woodstoxRatio),
    },
    externalBaseline1024MiBFileSyncBatches: {
      staxStreamMiBPerSec: round(largeStaxStream?.mibPerSec),
      staxStreamWoodstoxRatio: round(largeStaxStream?.woodstoxRatio),
      rawFrameNameIdMiBPerSec: round(largeRawFrameNameId?.mibPerSec),
      rawFrameNameIdWoodstoxRatio: round(largeRawFrameNameId?.woodstoxRatio),
      woodstoxMiBPerSec: round(largeWoodstox?.mibPerSec),
      quickXmlMiBPerSec: round(largeQuickXml?.mibPerSec),
      quickXmlWoodstoxRatio: round(largeQuickXml?.woodstoxRatio),
      target90MiBPerSec: targetWoodstox90MiBPerSec,
    },
    memoryMetricKinds: Array.from(new Set(rows.map(row => row.memory?.primaryKind).filter(Boolean))).sort(),
    memoryFrontier: summarizeMemoryFrontier(jsLargeFullRows),
    sourceModes: Array.from(new Set(rows.map(row => row.sourceMode).filter(Boolean))).sort(),
    sourceShapeSafety: summarizeSourceShapeSafety(jsLargeFullRows),
    textMaterializationFrontier,
    sourceConsumptionFrontier,
    browserLiveSourceFrontier: summarizeBrowserLiveSourceFrontier(rows),
    allocationEvidenceKinds: allocationEvidence.map(item => item.evidenceKind),
    conclusionAllowed: false,
  };
}

function summarizeBrowserLiveSourceFrontier(rows) {
  const browserRows = rows.filter(row => row.group === 'browser-fetch-readable-stream-books-corpus');
  if (browserRows.length === 0) return null;
  const prepared = browserRows.find(row => row.caseId === 'eventObjectFull') ?? null;
  const readable = browserRows.find(row => row.caseId === 'fetchReadableStreamFull') ?? null;
  const asyncBatch = browserRows.find(row => row.caseId === 'fetchAsyncByteBatchFull') ?? null;
  const liveRows = [readable, asyncBatch].filter(Boolean);
  return {
    sourceArtifact: 'browser-fetch-readable-stream-books-corpus.json',
    runtimeId: 'chrome-v8-browser',
    fixtureSizeGiB: round(browserRows[0]?.fixture?.sizeGiB),
    preparedSeedRow: summarizeBrowserLiveSourceRow(prepared),
    fetchReadableStreamRow: summarizeBrowserLiveSourceRow(readable),
    fetchAsyncByteBatchRow: summarizeBrowserLiveSourceRow(asyncBatch),
    fastestLiveRow: summarizeBrowserLiveSourceRow(maxBy(liveRows, row => row.mibPerSec)),
    liveRows: liveRows.length,
    liveRowsBackpressureRespected: liveRows
      .filter(row => row.demandDrivenSource === true && row.respectsBackpressure === true).length,
    liveRowsFullArrayBufferInput: liveRows.filter(row => row.fullArrayBufferParserInput === true).length,
    readableToPreparedRatio: readable && prepared ? round(readable.mibPerSec / prepared.mibPerSec) : null,
    asyncBatchToPreparedRatio: asyncBatch && prepared ? round(asyncBatch.mibPerSec / prepared.mibPerSec) : null,
    interpretation: 'Browser live fetch rows consume Response.body directly or through grouped AsyncIterable<Uint8Array[]> batches under the same checksum contract; they are intentionally separate from prepared corpus-seed replay rows.',
  };
}

function summarizeMemoryFrontier(rows) {
  const memoryRows = rows.filter(row => row.memory?.primaryKind);
  const boundedRows = memoryRows.filter(row => row.boundedMemory);
  const buckets = Array.from(groupBy(memoryRows, row => row.memory.primaryKind), ([kind, bucketRows]) => {
    const numericMaxRows = bucketRows.filter(row => typeof row.memory.maxMiB === 'number');
    return {
      kind,
      rows: bucketRows.length,
      boundedRows: bucketRows.filter(row => row.boundedMemory).length,
      unboundedRows: bucketRows.filter(row => !row.boundedMemory).length,
      maxMiB: round(maxBy(numericMaxRows, row => row.memory.maxMiB)?.memory?.maxMiB),
      fastestRow: summarizeRow(maxBy(bucketRows, row => row.mibPerSec)),
      fastestBoundedRow: summarizeRow(maxBy(bucketRows.filter(row => row.boundedMemory), row => row.mibPerSec)),
    };
  }).sort((left, right) => left.kind.localeCompare(right.kind));

  return {
    contract: '1gib-plus-js-full-string-memory-frontier',
    rows: memoryRows.length,
    boundedRows: boundedRows.length,
    unboundedRows: memoryRows.length - boundedRows.length,
    memoryKinds: buckets.map(bucket => bucket.kind),
    buckets,
    fastestBoundedRow: summarizeRow(maxBy(boundedRows, row => row.mibPerSec)),
    fastestProcessRssUnder128MiB: summarizeRow(maxBy(
      boundedRows.filter(row => row.memory.primaryKind === 'process-rss' && row.memory.maxMiB <= 128),
      row => row.mibPerSec,
    )),
    fastestBrowserJsHeapRow: summarizeRow(maxBy(
      boundedRows.filter(row => row.memory.primaryKind === 'browser-js-heap'),
      row => row.mibPerSec,
    )),
    interpretation: 'Memory is classified on the same 1 GiB+ JavaScript full-string row set used for counterexample scanning; process RSS, browser JS heap, and browser host-probe-only rows are not normalized into one allocation model.',
  };
}

function summarizeBrowserLiveSourceRow(row) {
  if (!row) return null;
  return {
    id: row.caseId,
    sourceMode: row.sourceMode,
    mibPerSec: row.mibPerSec,
    maxJsHeapMiB: row.memory?.primaryKind === 'browser-js-heap' ? row.memory.maxMiB : null,
    directReadableStream: row.directReadableStream === null ? null : row.directReadableStream === true,
    demandDrivenSource: row.demandDrivenSource === null ? null : row.demandDrivenSource === true,
    respectsBackpressure: row.respectsBackpressure === null ? null : row.respectsBackpressure === true,
    fullArrayBufferParserInput: row.fullArrayBufferParserInput === true,
    fullStringParity: row.fullStringParity === true,
    boundedMemory: row.boundedMemory === true,
    eventCount: row.eventCount,
    checksum: row.checksum,
  };
}

function createFindings(summary) {
  return [
    {
      id: 'same-contract-not-same-memory-counter',
      status: 'SOURCE_AGGREGATION',
      summary: 'Rows are grouped by semantic checksum contract, while memory counters remain runtime-specific.',
      evidence: summary.memoryMetricKinds,
    },
    {
      id: 'large-js-full-memory-frontier-visible',
      status: summary.memoryFrontier
        && summary.memoryFrontier.rows === summary.jsLargeFullRowCount
        && summary.memoryFrontier.fastestBoundedRow?.mibPerSec === summary.fastestJsLargeFullRow?.mibPerSec
        ? 'CLASSIFIED'
        : 'PARTIAL',
      summary: 'The same 1 GiB+ JavaScript full-string row set used for counterexample scanning is classified by memory metric and bounded-memory status.',
      evidence: summary.memoryFrontier ? [
        `rows=${summary.memoryFrontier.rows}`,
        `boundedRows=${summary.memoryFrontier.boundedRows}`,
        `unboundedRows=${summary.memoryFrontier.unboundedRows}`,
        `fastestBounded=${summary.memoryFrontier.fastestBoundedRow?.caseId}@${formatNumber(summary.memoryFrontier.fastestBoundedRow?.mibPerSec)} MiB/s`,
        `fastestBoundedMemory=${formatMemory(summary.memoryFrontier.fastestBoundedRow?.memory)}`,
        `memoryKinds=${summary.memoryFrontier.memoryKinds.join(',')}`,
      ] : [],
    },
    {
      id: 'no-js-200mib-large-full-counterexample-in-aggregated-artifacts',
      status: summary.jsRuntimeCounterexamples200MiB === 0 ? 'NOT_FOUND_IN_AGGREGATED_ARTIFACTS' : 'COUNTEREXAMPLE_FOUND',
      summary: summary.jsRuntimeCounterexamples200MiB === 0
        ? 'The aggregated 1 GiB+ JavaScript full-string rows contain no 200 MiB/s bounded-memory counterexample.'
        : 'At least one aggregated 1 GiB+ JavaScript full-string row reaches 200 MiB/s with bounded memory.',
      evidence: [
        `jsLargeFullRows=${summary.jsLargeFullRowCount}`,
        `counterexamples=${summary.jsRuntimeCounterexamples200MiB}`,
      ],
    },
    {
      id: 'source-shape-not-full-arraybuffer',
      status: summary.sourceShapeSafety.fullArrayBufferRows === 0
        && summary.sourceShapeSafety.unknownArrayBufferRows === 0
        ? 'CLASSIFIED'
        : 'PARTIAL',
      summary: 'Recognized 1 GiB+ JavaScript full-string source-mode rows are classified for full XML ArrayBuffer parser input.',
      evidence: [
        `largeJsFullSourceModeRows=${summary.sourceShapeSafety.largeJsFullSourceModeRows}`,
        `notFullArrayBufferRows=${summary.sourceShapeSafety.notFullArrayBufferRows}`,
        `fullArrayBufferRows=${summary.sourceShapeSafety.fullArrayBufferRows}`,
        `unknownArrayBufferRows=${summary.sourceShapeSafety.unknownArrayBufferRows}`,
      ],
    },
    {
      id: 'external-target-remains-visible',
      status: 'BENCH_FACT',
      summary: 'The external baselines keep Woodstox and quick-xml visible as non-JS comparators under the same checksum contract.',
      evidence: [
        `16MiB woodstox=${formatNumber(summary.externalBaseline16MiB.woodstoxMiBPerSec)} MiB/s`,
        `16MiB quick-xml=${formatNumber(summary.externalBaseline16MiB.quickXmlMiBPerSec)} MiB/s`,
        `16MiB quick-xml/Woodstox=${formatNumber(summary.externalBaseline16MiB.quickXmlWoodstoxRatio)}`,
        `1024MiB stax-stream=${formatNumber(summary.externalBaseline1024MiBFileSyncBatches.staxStreamMiBPerSec)} MiB/s`,
        `1024MiB stax-stream/Woodstox=${formatNumber(summary.externalBaseline1024MiBFileSyncBatches.staxStreamWoodstoxRatio)}`,
        `1024MiB rawFrameNameId=${formatNumber(summary.externalBaseline1024MiBFileSyncBatches.rawFrameNameIdMiBPerSec)} MiB/s`,
        `1024MiB rawFrameNameId/Woodstox=${formatNumber(summary.externalBaseline1024MiBFileSyncBatches.rawFrameNameIdWoodstoxRatio)}`,
        `1024MiB woodstox=${formatNumber(summary.externalBaseline1024MiBFileSyncBatches.woodstoxMiBPerSec)} MiB/s`,
        `1024MiB quick-xml=${formatNumber(summary.externalBaseline1024MiBFileSyncBatches.quickXmlMiBPerSec)} MiB/s`,
        `same-fixture-fastest-js=${summary.sameFixture1024MiBWoodstoxTarget.fastestJsCaseId}`,
        `same-fixture-fastest-js/Woodstox=${formatNumber(summary.sameFixture1024MiBWoodstoxTarget.fastestJsWoodstoxRatio)}`,
        `same-fixture-target-distance-rows=${summary.sameFixture1024MiBTargetRows.length}`,
        `same-fixture-fastest-js/quick-xml=${formatNumber(summary.sameFixture1024MiBQuickXmlTarget.fastestJsQuickXmlRatio)}`,
        `same-fixture-quick-xml-target-distance-rows=${summary.sameFixture1024MiBQuickXmlTargetRows.length}`,
        `same-fixture-0.9x-quick-xml-target-met=${summary.sameFixture1024MiBQuickXmlTarget.targetMet}`,
        `same-fixture-fastest-js-rss=${formatNumber(summary.sameFixture1024MiBProcessRssSnapshot.fastestJs?.maxRssMiB)} MiB`,
        `same-fixture-woodstox-rss=${formatNumber(summary.sameFixture1024MiBProcessRssSnapshot.woodstox?.maxRssMiB)} MiB`,
        `same-fixture-quick-xml-rss=${formatNumber(summary.sameFixture1024MiBProcessRssSnapshot.quickXml?.maxRssMiB)} MiB`,
        `same-fixture-0.9x-target-met=${summary.sameFixture1024MiBWoodstoxTarget.targetMet}`,
      ],
    },
    {
      id: 'text-materialization-frontier-visible',
      status: summary.textMaterializationFrontier ? 'HEADROOM_CLASSIFIED' : 'MISSING',
      summary: summary.textMaterializationFrontier
        ? 'The nearest full-string row, text/CDATA omission headroom, and negative text-materialization candidates remain visible in the aggregate comparison.'
        : 'The text-materialization frontier artifact was not found in the aggregate comparison.',
      evidence: summary.textMaterializationFrontier ? [
        `fastestFull=${summary.textMaterializationFrontier.fastestFull?.id}@${formatNumber(summary.textMaterializationFrontier.fastestFull?.mibPerSec)} MiB/s`,
        `remainingTo200=${formatNumber(summary.textMaterializationFrontier.fastestFullRemainingMiBPerSec)} MiB/s`,
        `requiredSpeedup=${formatNumber(summary.textMaterializationFrontier.requiredSpeedupToTarget)}x`,
        `withoutText=${summary.textMaterializationFrontier.fastestWithoutText?.id}@${formatNumber(summary.textMaterializationFrontier.fastestWithoutText?.mibPerSec)} MiB/s`,
        `withoutTextRowsCrossTarget=${summary.textMaterializationFrontier.noTextRowsCrossTarget}`,
        `negativeCandidates=${summary.textMaterializationFrontier.negativeCandidateCount}`,
      ] : [],
    },
    {
      id: 'source-consumption-frontier-visible',
      status: summary.sourceConsumptionFrontier
        && summary.sourceConsumptionFrontier.fullArrayBufferRows === 0
        && summary.sourceConsumptionFrontier.backpressureRows === summary.sourceConsumptionFrontier.backpressureRowsRespected
        ? 'CLASSIFIED'
        : 'PARTIAL',
      summary: summary.sourceConsumptionFrontier
        ? 'The aggregate comparison links the sync byte-batch baseline, async byte-batch rows, direct ReadableStream rows, and backpressure counters.'
        : 'The stream source-consumption artifact was not found in the aggregate comparison.',
      evidence: summary.sourceConsumptionFrontier ? [
        `sync=${summary.sourceConsumptionFrontier.fastestSyncIterable?.id}@${formatNumber(summary.sourceConsumptionFrontier.fastestSyncIterable?.mibPerSec)} MiB/s`,
        `async=${summary.sourceConsumptionFrontier.fastestAsyncIterable?.id}@${formatNumber(summary.sourceConsumptionFrontier.fastestAsyncIterable?.mibPerSec)} MiB/s`,
        `readable=${summary.sourceConsumptionFrontier.fastestReadableStream?.id}@${formatNumber(summary.sourceConsumptionFrontier.fastestReadableStream?.mibPerSec)} MiB/s`,
        `readable/sync=${formatNumber(summary.sourceConsumptionFrontier.fastestReadableStreamRatioToFastestSyncIterable)}x`,
        `backpressureRows=${summary.sourceConsumptionFrontier.backpressureRowsRespected}/${summary.sourceConsumptionFrontier.backpressureRows}`,
        `fullArrayBufferRows=${summary.sourceConsumptionFrontier.fullArrayBufferRows}`,
      ] : [],
    },
    {
      id: 'browser-live-fetch-source-visible',
      status: summary.browserLiveSourceFrontier
        && summary.browserLiveSourceFrontier.liveRowsFullArrayBufferInput === 0
        && summary.browserLiveSourceFrontier.liveRows === summary.browserLiveSourceFrontier.liveRowsBackpressureRespected
        ? 'CLASSIFIED'
        : 'PARTIAL',
      summary: summary.browserLiveSourceFrontier
        ? 'Chrome live fetch ReadableStream and grouped async byte-batch rows remain visible separately from prepared corpus-seed replay rows.'
        : 'The browser live fetch source artifact was not found in the aggregate comparison.',
      evidence: summary.browserLiveSourceFrontier ? [
        `prepared=${summary.browserLiveSourceFrontier.preparedSeedRow?.id}@${formatNumber(summary.browserLiveSourceFrontier.preparedSeedRow?.mibPerSec)} MiB/s`,
        `fetchReadable=${summary.browserLiveSourceFrontier.fetchReadableStreamRow?.id}@${formatNumber(summary.browserLiveSourceFrontier.fetchReadableStreamRow?.mibPerSec)} MiB/s`,
        `fetchAsyncBatch=${summary.browserLiveSourceFrontier.fetchAsyncByteBatchRow?.id}@${formatNumber(summary.browserLiveSourceFrontier.fetchAsyncByteBatchRow?.mibPerSec)} MiB/s`,
        `liveBackpressureRows=${summary.browserLiveSourceFrontier.liveRowsBackpressureRespected}/${summary.browserLiveSourceFrontier.liveRows}`,
        `liveFullArrayBufferRows=${summary.browserLiveSourceFrontier.liveRowsFullArrayBufferInput}`,
      ] : [],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Same-Contract Runtime Comparison',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report aggregates existing release artifacts. It compares rows only through the same full-string checksum contract; it does not assert identical object shape, identical allocation models, or a JavaScript runtime ceiling.',
    '',
    '## Summary',
    '',
    `- Aggregated rows: ${report.summary.rowCount}`,
    `- 1 GiB+ JavaScript full-string rows: ${report.summary.jsLargeFullRowCount}`,
    `- 200 MiB/s+ bounded-memory JavaScript counterexamples found: ${report.summary.jsRuntimeCounterexamples200MiB}`,
    `- Fastest aggregated 1 GiB+ JS full-string row: ${formatSummaryRow(report.summary.fastestJsLargeFullRow)}`,
    `- Fastest JS full-string row vs 200 MiB/s: ${formatNumber(report.summary.fastestJsLargeFullRowTo200MiBPerSec.ratio)}x, ${formatNumber(report.summary.fastestJsLargeFullRowTo200MiBPerSec.remainingMiBPerSec)} MiB/s remaining`,
    `- Fastest JS full-string row vs 1024 MiB Woodstox reference: ${formatNumber(report.summary.fastestJsLargeFullRowTo1024MiBWoodstoxReference.ratio)}x Woodstox, ${formatNumber(report.summary.fastestJsLargeFullRowTo1024MiBWoodstoxReference.remainingTo90PercentMiBPerSec)} MiB/s below 0.9x reference target`,
    `- Same-fixture 1024 MiB JS row vs Woodstox target: ${report.summary.sameFixture1024MiBWoodstoxTarget.fastestJsCaseId ?? 'n/a'} at ${formatNumber(report.summary.sameFixture1024MiBWoodstoxTarget.fastestJsWoodstoxRatio)}x Woodstox, ${formatNumber(report.summary.sameFixture1024MiBWoodstoxTarget.remainingTo90PercentMiBPerSec)} MiB/s below 0.9x target`,
    `- Same-fixture 1024 MiB JS row vs quick-xml target: ${report.summary.sameFixture1024MiBQuickXmlTarget.fastestJsCaseId ?? 'n/a'} at ${formatNumber(report.summary.sameFixture1024MiBQuickXmlTarget.fastestJsQuickXmlRatio)}x quick-xml, ${formatNumber(report.summary.sameFixture1024MiBQuickXmlTarget.remainingTo90PercentMiBPerSec)} MiB/s below 0.9x target`,
    `- Same-fixture 1024 MiB process RSS snapshot: JS ${formatNumber(report.summary.sameFixture1024MiBProcessRssSnapshot.fastestJs?.maxRssMiB)} MiB, Woodstox ${formatNumber(report.summary.sameFixture1024MiBProcessRssSnapshot.woodstox?.maxRssMiB)} MiB, quick-xml ${formatNumber(report.summary.sameFixture1024MiBProcessRssSnapshot.quickXml?.maxRssMiB)} MiB`,
    `- Fastest 1 GiB+ JS public event-object row: ${formatSummaryRow(report.summary.fastestJsLargePublicEventRow)}`,
    `- Fastest bounded 1 GiB+ JS public event-object row: ${formatSummaryRow(report.summary.fastestBoundedJsLargePublicEventRow)}`,
    `- 1 GiB+ JS full-string memory frontier: ${report.summary.memoryFrontier.boundedRows}/${report.summary.memoryFrontier.rows} bounded rows; fastest bounded row ${formatSummaryRow(report.summary.memoryFrontier.fastestBoundedRow)}`,
    `- 16 MiB Woodstox baseline: ${formatNumber(report.summary.externalBaseline16MiB.woodstoxMiBPerSec)} MiB/s`,
    `- 16 MiB quick-xml baseline: ${formatNumber(report.summary.externalBaseline16MiB.quickXmlMiBPerSec)} MiB/s (${formatNumber(report.summary.externalBaseline16MiB.quickXmlWoodstoxRatio)}x Woodstox)`,
    `- 1024 MiB file-backed stax-stream baseline: ${formatNumber(report.summary.externalBaseline1024MiBFileSyncBatches.staxStreamMiBPerSec)} MiB/s (${formatNumber(report.summary.externalBaseline1024MiBFileSyncBatches.staxStreamWoodstoxRatio)}x Woodstox)`,
    `- 1024 MiB file-backed rawFrameNameId baseline: ${formatNumber(report.summary.externalBaseline1024MiBFileSyncBatches.rawFrameNameIdMiBPerSec)} MiB/s (${formatNumber(report.summary.externalBaseline1024MiBFileSyncBatches.rawFrameNameIdWoodstoxRatio)}x Woodstox)`,
    `- 1024 MiB Woodstox baseline: ${formatNumber(report.summary.externalBaseline1024MiBFileSyncBatches.woodstoxMiBPerSec)} MiB/s`,
    `- 1024 MiB quick-xml baseline: ${formatNumber(report.summary.externalBaseline1024MiBFileSyncBatches.quickXmlMiBPerSec)} MiB/s (${formatNumber(report.summary.externalBaseline1024MiBFileSyncBatches.quickXmlWoodstoxRatio)}x Woodstox)`,
    `- Recognized JS source modes: ${report.summary.sourceModes.length > 0 ? report.summary.sourceModes.join(', ') : 'none recorded'}`,
    `- 1 GiB+ JS full-string source-mode rows not using full ArrayBuffer parser input: ${report.summary.sourceShapeSafety.notFullArrayBufferRows}/${report.summary.sourceShapeSafety.largeJsFullSourceModeRows}`,
    `- 1 GiB+ source-mode rows replaying a corpus seed buffer: ${report.summary.sourceShapeSafety.corpusSeedReplayRows} (max seed ${formatNumber(report.summary.sourceShapeSafety.maxCorpusSeedMiB)} MiB, max seed/target ${formatNumber(report.summary.sourceShapeSafety.maxCorpusSeedToTargetRatio)})`,
    report.summary.textMaterializationFrontier
      ? `- Text materialization frontier: fastest full row ${report.summary.textMaterializationFrontier.fastestFull.id} at ${formatNumber(report.summary.textMaterializationFrontier.fastestFull.mibPerSec)} MiB/s, ${formatNumber(report.summary.textMaterializationFrontier.fastestFullRemainingMiBPerSec)} MiB/s below 200 MiB/s; without-text rows crossing target: ${report.summary.textMaterializationFrontier.noTextRowsCrossTarget}; negative candidates: ${report.summary.textMaterializationFrontier.negativeCandidateCount}`
      : '- Text materialization frontier: not recorded',
    report.summary.sourceConsumptionFrontier
      ? `- Source consumption frontier: sync byte batches ${report.summary.sourceConsumptionFrontier.fastestSyncIterable.id} at ${formatNumber(report.summary.sourceConsumptionFrontier.fastestSyncIterable.mibPerSec)} MiB/s; direct ReadableStream ${report.summary.sourceConsumptionFrontier.fastestReadableStream.id} at ${formatNumber(report.summary.sourceConsumptionFrontier.fastestReadableStream.mibPerSec)} MiB/s (${formatNumber(report.summary.sourceConsumptionFrontier.fastestReadableStreamRatioToFastestSyncIterable)}x sync); backpressure rows ${report.summary.sourceConsumptionFrontier.backpressureRowsRespected}/${report.summary.sourceConsumptionFrontier.backpressureRows}`
      : '- Source consumption frontier: not recorded',
    report.summary.browserLiveSourceFrontier
      ? `- Browser live fetch source frontier: fetch ReadableStream ${report.summary.browserLiveSourceFrontier.fetchReadableStreamRow.id} at ${formatNumber(report.summary.browserLiveSourceFrontier.fetchReadableStreamRow.mibPerSec)} MiB/s; fetch async byte batches ${report.summary.browserLiveSourceFrontier.fetchAsyncByteBatchRow.id} at ${formatNumber(report.summary.browserLiveSourceFrontier.fetchAsyncByteBatchRow.mibPerSec)} MiB/s; live backpressure rows ${report.summary.browserLiveSourceFrontier.liveRowsBackpressureRespected}/${report.summary.browserLiveSourceFrontier.liveRows}`
      : '- Browser live fetch source frontier: not recorded',
    '',
    '## Fastest JS Rows By Group',
    '',
    '| Group | Runtime | Case | MiB/s | Bounded | Memory | Source mode | Full ArrayBuffer input |',
    '| --- | --- | --- | ---: | --- | --- | --- | --- |',
  ];

  for (const item of report.summary.fastestRowsByGroup) {
    const row = item.fastest;
    lines.push(`| \`${item.group}\` | ${row.runtimeLabel} | \`${row.caseId}\` | ${formatNumber(row.mibPerSec)} | ${row.boundedMemory ? 'yes' : 'no'} | ${formatMemory(row.memory)} | ${formatSourceMode(row.sourceMode)} | ${formatFullArrayBufferInput(row.fullArrayBufferParserInput)} |`);
  }

  lines.push(
    '',
    '## 1024 MiB Books Fixture Woodstox 0.9x Target Distances',
    '',
    'These rows compare the fastest JavaScript full-string row in each 1024 MiB books fixture family against the best available Woodstox row for that same fixture family. Rows whose Woodstox reference comes from a separate candidate artifact are still same-fixture target-distance rows, not object-shape or allocation-equivalence proof.',
    '',
    '| Group | JS case | JS MiB/s | JS RSS | Source mode | Woodstox MiB/s | 0.9x target | Remaining to 0.9x | JS/Woodstox | Target met | Woodstox artifact | Reference scope |',
    '| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |',
  );

  for (const item of report.summary.sameFixture1024MiBTargetRows) {
    lines.push(`| \`${item.group}\` | \`${item.fastestJs.caseId}\` | ${formatNumber(item.fastestJs.mibPerSec)} | ${formatMemory(item.fastestJs.memory)} | ${formatSourceMode(item.fastestJs.sourceMode)} | ${formatNumber(item.woodstoxReference.mibPerSec)} | ${formatNumber(item.woodstox90MiBPerSec)} | ${formatNumber(item.remainingTo90PercentMiBPerSec)} | ${formatNumber(item.jsWoodstoxRatio)} | ${item.targetMet ? 'yes' : 'no'} | \`${item.woodstoxReference.sourceArtifact}\` | ${item.caveat} |`);
  }

  lines.push(
    '',
    '## 1024 MiB Books Fixture quick-xml 0.9x Target Distances',
    '',
    'These rows compare the fastest JavaScript full-string row in each 1024 MiB books fixture family against the best available quick-xml row for that same fixture family. Rows whose quick-xml reference comes from a separate candidate artifact are still same-fixture target-distance rows, not object-shape or allocation-equivalence proof.',
    '',
    '| Group | JS case | JS MiB/s | JS RSS | Source mode | quick-xml MiB/s | 0.9x target | Remaining to 0.9x | JS/quick-xml | Target met | quick-xml artifact | Reference scope |',
    '| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |',
  );

  for (const item of report.summary.sameFixture1024MiBQuickXmlTargetRows) {
    lines.push(`| \`${item.group}\` | \`${item.fastestJs.caseId}\` | ${formatNumber(item.fastestJs.mibPerSec)} | ${formatMemory(item.fastestJs.memory)} | ${formatSourceMode(item.fastestJs.sourceMode)} | ${formatNumber(item.quickXmlReference.mibPerSec)} | ${formatNumber(item.quickXml90MiBPerSec)} | ${formatNumber(item.remainingTo90PercentMiBPerSec)} | ${formatNumber(item.jsQuickXmlRatio)} | ${item.targetMet ? 'yes' : 'no'} | \`${item.quickXmlReference.sourceArtifact}\` | ${item.caveat} |`);
  }

  lines.push(
    '',
    '## Text Materialization Frontier',
    '',
  );

  if (report.summary.textMaterializationFrontier) {
    const frontier = report.summary.textMaterializationFrontier;
    lines.push(
      'This summarizes the nearest current full-string headroom evidence. Rows that omit text/CDATA strings are headroom probes, not full-string StAX counterexamples.',
      '',
      '| Scope | Row | MiB/s | Full string parity | Bounded memory | Artifact | Notes |',
      '| --- | --- | ---: | --- | --- | --- | --- |',
      `| Fastest full row | \`${frontier.fastestFull.id}\` | ${formatNumber(frontier.fastestFull.mibPerSec)} | ${frontier.fastestFull.fullStringParity ? 'yes' : 'no'} | ${frontier.fastestFull.boundedMemory ? 'yes' : 'no'} | \`${frontier.fastestFull.sourceArtifact}\` | ${formatNumber(frontier.fastestFullRemainingMiBPerSec)} MiB/s below 200 MiB/s; ${formatNumber(frontier.requiredSpeedupToTarget)}x speedup required |`,
      `| Fastest without text/CDATA strings | \`${frontier.fastestWithoutText.id}\` | ${formatNumber(frontier.fastestWithoutText.mibPerSec)} | ${frontier.fastestWithoutText.fullStringParity ? 'yes' : 'no'} | ${frontier.fastestWithoutText.boundedMemory ? 'yes' : 'no'} | \`${frontier.fastestWithoutText.sourceArtifact}\` | ${formatNumber(frontier.fastestWithoutTextToFullRatio)}x fastest full row; ${frontier.noTextRowsCrossTarget} row(s) cross 200 MiB/s |`,
      `| Fastest no-trim probe | \`${frontier.fastestNoTrim.id}\` | ${formatNumber(frontier.fastestNoTrim.mibPerSec)} | ${frontier.fastestNoTrim.fullStringParity ? 'yes' : 'no'} | n/a | \`${frontier.fastestNoTrim.sourceArtifact}\` | ${formatNumber(frontier.fastestNoTrimToFullRatio)}x fastest full row; ${frontier.noTrimRowsCrossTarget} row(s) cross 200 MiB/s |`,
      `| Fastest fold-trim probe | \`${frontier.fastestFoldTrim.id}\` | ${formatNumber(frontier.fastestFoldTrim.mibPerSec)} | ${frontier.fastestFoldTrim.fullStringParity ? 'yes' : 'no'} | n/a | \`${frontier.fastestFoldTrim.sourceArtifact}\` | ${formatNumber(frontier.fastestFoldTrimToFullRatio)}x fastest full row; ${frontier.foldTrimRowsCrossTarget} row(s) cross 200 MiB/s |`,
      '',
      `Interpretation: ${frontier.interpretation}`,
    );
  } else {
    lines.push('No text-materialization frontier artifact was available.');
  }

  lines.push(
    '',
    '## Source Shape Safety',
    '',
    '| Scope | Rows | Not full ArrayBuffer parser input | Full ArrayBuffer parser input | Unknown parser input | Corpus seed replay rows | Max corpus seed |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    `| 1 GiB+ JS full-string rows with source mode metadata | ${report.summary.sourceShapeSafety.largeJsFullSourceModeRows} | ${report.summary.sourceShapeSafety.notFullArrayBufferRows} | ${report.summary.sourceShapeSafety.fullArrayBufferRows} | ${report.summary.sourceShapeSafety.unknownArrayBufferRows} | ${report.summary.sourceShapeSafety.corpusSeedReplayRows} | ${formatNumber(report.summary.sourceShapeSafety.maxCorpusSeedMiB)} MiB |`,
  );

  if (report.summary.sourceConsumptionFrontier) {
    const frontier = report.summary.sourceConsumptionFrontier;
    lines.push(
      '',
      '## Source Consumption Frontier',
      '',
      'This separates the current large-file Iterable<Uint8Array[]> baseline from direct ReadableStream consumption. ReadableStream rows are bounded source-shape evidence, not the aggregate comparison baseline.',
      '',
      '| Scope | Row | Input | MiB/s | RSS | Batch size | Direct ReadableStream | Full ArrayBuffer input | Backpressure | Counters |',
      '| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |',
      sourceConsumptionMarkdownRow('Fastest sync byte batches', frontier.fastestSyncIterable),
      sourceConsumptionMarkdownRow('Fastest async byte batches', frontier.fastestAsyncIterable),
      sourceConsumptionMarkdownRow('Fastest direct ReadableStream', frontier.fastestReadableStream),
      '',
      `- Direct ReadableStream / sync byte-batch ratio: ${formatNumber(frontier.fastestReadableStreamRatioToFastestSyncIterable)}x`,
      `- Async byte-batch / sync byte-batch ratio: ${formatNumber(frontier.fastestAsyncIterableRatioToFastestSyncIterable)}x`,
      `- Backpressure-respecting async/readable rows: ${frontier.backpressureRowsRespected}/${frontier.backpressureRows}`,
      `- Full ArrayBuffer parser-input rows in source-consumption artifact: ${frontier.fullArrayBufferRows}`,
      `- Primary large comparison input: ${frontier.primaryLargeComparisonInput}`,
      `Interpretation: ${frontier.interpretation}`,
    );
  }

  if (report.summary.browserLiveSourceFrontier) {
    const frontier = report.summary.browserLiveSourceFrontier;
    lines.push(
      '',
      '## Browser Live Fetch Source Frontier',
      '',
      'This keeps Chrome fetch Response.body rows separate from prepared corpus-seed replay rows. Both live rows preserve the full checksum contract and do not use a full ArrayBuffer parser input.',
      '',
      '| Scope | Row | Source mode | MiB/s | JS heap | Direct ReadableStream | Full ArrayBuffer input | Backpressure | Events | Checksum |',
      '| --- | --- | --- | ---: | ---: | --- | --- | --- | ---: | ---: |',
      browserLiveSourceMarkdownRow('Prepared corpus seed replay', frontier.preparedSeedRow),
      browserLiveSourceMarkdownRow('Fetch ReadableStream', frontier.fetchReadableStreamRow),
      browserLiveSourceMarkdownRow('Fetch async byte batches', frontier.fetchAsyncByteBatchRow),
      '',
      `- Live fetch rows respecting backpressure: ${frontier.liveRowsBackpressureRespected}/${frontier.liveRows}`,
      `- Live fetch rows with full ArrayBuffer parser input: ${frontier.liveRowsFullArrayBufferInput}`,
      `- Fetch ReadableStream / prepared replay ratio: ${formatNumber(frontier.readableToPreparedRatio)}x`,
      `- Fetch async byte-batch / prepared replay ratio: ${formatNumber(frontier.asyncBatchToPreparedRatio)}x`,
      `Interpretation: ${frontier.interpretation}`,
    );
  }

  lines.push(
    '',
    '## Memory Frontier',
    '',
    'This classifies memory only within the same 1 GiB+ JavaScript full-string row set used by the counterexample scan. Metric kinds stay separate; process RSS, browser JS heap, and browser host-probe-only rows are not allocation-model equivalents.',
    '',
    `- Rows classified: ${report.summary.memoryFrontier.rows}`,
    `- Bounded rows: ${report.summary.memoryFrontier.boundedRows}`,
    `- Unbounded or unproven rows: ${report.summary.memoryFrontier.unboundedRows}`,
    `- Fastest bounded row: ${formatSummaryRow(report.summary.memoryFrontier.fastestBoundedRow)}`,
    `- Fastest bounded process RSS row under 128 MiB: ${formatSummaryRow(report.summary.memoryFrontier.fastestProcessRssUnder128MiB)}`,
    `- Fastest bounded browser JS heap row: ${formatSummaryRow(report.summary.memoryFrontier.fastestBrowserJsHeapRow)}`,
    '',
    '| Memory kind | Rows | Bounded | Unbounded/unproven | Max recorded | Fastest row | Fastest bounded row |',
    '| --- | ---: | ---: | ---: | ---: | --- | --- |',
  );
  for (const bucket of report.summary.memoryFrontier.buckets) {
    lines.push(`| ${bucket.kind} | ${bucket.rows} | ${bucket.boundedRows} | ${bucket.unboundedRows} | ${formatNumber(bucket.maxMiB)} MiB | ${formatSummaryRow(bucket.fastestRow)} | ${formatSummaryRow(bucket.fastestBoundedRow)} |`);
  }
  lines.push('', `Interpretation: ${report.summary.memoryFrontier.interpretation}`);

  lines.push(
    '',
    '## Selected Comparison Rows',
    '',
    '| Group | Runtime | Case | Events | Checksum | MiB/s | Bounded | Memory | Source mode | Full ArrayBuffer input | Corpus seed replay | Artifact |',
    '| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- |',
  );

  for (const row of report.comparisonRows) {
    lines.push(`| \`${row.group}\` | ${row.runtimeLabel} | \`${row.caseId}\` | ${row.eventCount ?? ''} | ${row.checksum ?? ''} | ${formatNumber(row.mibPerSec)} | ${row.boundedMemory === null ? 'n/a' : row.boundedMemory ? 'yes' : 'no'} | ${formatMemory(row.memory)} | ${formatSourceMode(row.sourceMode)} | ${formatFullArrayBufferInput(row.fullArrayBufferParserInput)} | ${formatCorpusSeedReplay(row)} | \`${row.sourceArtifact}\` |`);
  }

  lines.push(
    '',
    '## Allocation Evidence',
    '',
    'These rows are evidence about allocation shape, not directly comparable peak memory numbers.',
    '',
    '| Runtime | Evidence | Throughput | Events | Checksum | Memory/shape note | Artifact |',
    '| --- | --- | ---: | ---: | ---: | --- | --- |',
  );

  for (const item of report.allocationEvidence) {
    lines.push(`| ${item.runtimeLabel} | ${item.evidenceKind} | ${formatNumber(item.mibPerSec)} | ${item.eventCount ?? ''} | ${item.checksum ?? ''} | ${formatAllocationMemory(item)} | \`${item.sourceArtifact}\` |`);
  }

  lines.push(
    '',
    '## Findings',
    '',
  );
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.status}): ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }

  lines.push(
    '',
    '## Limits',
    '',
    '- Node and Bun rows use process memory counters such as RSS; Chrome browser rows use variant-level `performance.memory` JS heap plus separate Windows process-tree host counters.',
    '- Firefox browser rows currently lack page-exposed JS heap counters; their fresh-browser per-variant Windows host process-tree probes are row-level host evidence, not portable browser RSS or bounded JS heap proof.',
    '- Source-mode values are preserved only when the input artifact records them or an explicit benchmark option identifies the file-backed byte-batch path; older artifacts without source metadata remain `n/a`.',
    '- `Corpus seed replay` means the benchmark prepared a smaller corpus byte seed and replayed it through `Iterable<Uint8Array[]>`; it is distinct from passing one complete 1 GiB XML ArrayBuffer to the parser.',
    '- Woodstox JFR rows are sampled allocation evidence, and quick-xml rows are global allocator traffic evidence. Neither is peak RSS.',
    '- The fastest aggregated JS row and the 1024 MiB Woodstox reference can come from different corpus fixtures; the ratio is a target-distance reference, not an identical-input speed comparison.',
    '- This report aggregates existing artifacts only. It is not a Safari browser row, not a codegen trace, and not proof that JavaScript runtimes have no remaining headroom.',
  );

  return `${lines.join('\n')}\n`;
}

function extractFixture(fixture = {}) {
  return {
    source: fixture.source ?? null,
    shape: fixture.shape ?? null,
    sourceFile: fixture.sourceFile ?? null,
    sizeGiB: round(fixture.sizeGiB ?? bytesToGiB(fixture.actualBytes)),
    sizeMiB: round(bytesToMiB(fixture.actualBytes)),
    actualBytes: fixture.actualBytes ?? null,
    batchSize: fixture.batchSize ?? null,
    rowCycleSize: fixture.rowCycleSize ?? null,
    minRowBytes: fixture.minRowBytes ?? null,
    maxRowBytes: fixture.maxRowBytes ?? null,
    averageRowBytes: round(fixture.averageRowBytes),
  };
}

function extractMemory(row, report) {
  const memory = row.memory ?? {};
  const host = report.hostProcessMemory ?? null;
  const hostProbe = extractHostProcessMemoryProbe(row.hostProcessMemoryProbe);
  if (memory.scope === 'browser-js-heap' || memory.maxJsHeapUsedBytes !== undefined) {
    if (typeof memory.maxJsHeapUsedBytes !== 'number') {
      return {
        primaryKind: 'browser-js-heap-unavailable',
        note: 'this browser did not expose performance.memory heap counters to page JavaScript',
        hostProcessTreeProbe: hostProbe,
      };
    }
    return {
      primaryKind: 'browser-js-heap',
      maxMiB: round(bytesToMiB(memory.maxJsHeapUsedBytes)),
      deltaMiB: round(bytesToMiB(memory.avgJsHeapUsedDeltaBytes)),
      hostProcessTree: host ? {
        kind: host.scope ?? 'host-process-tree',
        maxWorkingSetMiB: round(bytesToMiB(host.maxWorkingSetBytes)),
        maxPrivateMiB: round(bytesToMiB(host.maxPrivateBytes)),
        note: 'host process-tree counters are report-level, not per-variant memory',
      } : null,
      hostProcessTreeProbe: hostProbe,
    };
  }
  if (memory.maxRssBytes !== undefined) {
    return {
      primaryKind: 'process-rss',
      maxMiB: round(bytesToMiB(memory.maxRssBytes)),
      deltaMiB: round(bytesToMiB(memory.avgRssDeltaBytes)),
      maxHeapUsedMiB: round(bytesToMiB(memory.maxHeapUsedBytes)),
      maxExternalMiB: round(bytesToMiB(memory.samples?.[0]?.after?.externalBytes)),
      maxArrayBuffersMiB: round(bytesToMiB(memory.samples?.[0]?.after?.arrayBuffersBytes)),
    };
  }
  return {
    primaryKind: 'not-recorded',
    note: 'memory was not recorded for this row',
  };
}

function extractHostProcessMemoryProbe(probe) {
  if (!probe) {
    return null;
  }
  return {
    kind: probe.scope ?? 'host-process-tree-probe',
    maxWorkingSetMiB: round(bytesToMiB(probe.maxWorkingSetBytes)),
    maxPrivateMiB: round(bytesToMiB(probe.maxPrivateBytes)),
    maxProcessCount: probe.maxProcessCount ?? null,
    probeMibPerSec: round(probe.probeMibPerSec),
    note: 'fresh-browser per-variant host process-tree probe; not portable browser RSS or JS heap proof',
  };
}

function pickMaterializationCounters(counters = {}) {
  return {
    stringFieldReads: counters.stringFieldReads,
    eventObjects: counters.eventObjects,
    rawSpanMaterializations: counters.rawSpanMaterializations,
    textDecoderCalls: counters.textDecoderCalls,
    shortAsciiHits: counters.shortAsciiHits,
    attributePairs: counters.attributePairs,
  };
}

function externalRuntimeId(tool) {
  switch (tool) {
    case 'woodstox':
      return 'woodstox-jvm';
    case 'quick-xml':
      return 'quick-xml-rust';
    case 'stax-stream':
      return 'node-v8-stax-stream';
    case 'stax-raw-frame-name-id':
      return 'node-v8-stax-raw-frame-name-id';
    case 'stax-event':
      return 'node-v8-stax-event';
    default:
      return tool;
  }
}

function externalRuntimeLabel(tool) {
  switch (tool) {
    case 'woodstox':
      return 'Java/Woodstox';
    case 'quick-xml':
      return 'Rust/quick-xml';
    case 'stax-stream':
      return 'Node/V8 stax-stream';
    case 'stax-raw-frame-name-id':
      return 'Node/V8 stax-raw-frame-name-id';
    case 'stax-event':
      return 'Node/V8 stax-event';
    default:
      return tool;
  }
}

function externalLanguageFamily(tool) {
  if (tool === 'woodstox') return 'java';
  if (tool === 'quick-xml') return 'rust';
  return 'javascript';
}

function sameEventChecksum(row, reference) {
  return Boolean(reference)
    && row.eventCount === reference.eventCount
    && row.checksum === reference.checksum;
}

function summarizeRow(row) {
  if (!row) return null;
  return {
    group: row.group,
    runtimeId: row.runtimeId,
    runtimeLabel: row.runtimeLabel,
    caseId: row.caseId,
    mibPerSec: row.mibPerSec,
    boundedMemory: row.boundedMemory,
    memory: row.memory,
    sourceMode: row.sourceMode,
    fullArrayBufferParserInput: row.fullArrayBufferParserInput,
    sourceArtifact: row.sourceArtifact,
    sampleCount: row.sampleCount ?? null,
    sampleMinMiBPerSec: row.sampleMinMiBPerSec ?? null,
    sampleMaxMiBPerSec: row.sampleMaxMiBPerSec ?? null,
    sampleSpreadRatio: row.sampleSpreadRatio ?? null,
  };
}

function summarizeProcessRssRow(row) {
  if (!row) return null;
  return {
    group: row.group,
    sourceArtifact: row.sourceArtifact,
    runtimeId: row.runtimeId,
    runtimeLabel: row.runtimeLabel,
    caseId: row.caseId,
    mibPerSec: row.mibPerSec,
    memoryKind: row.memory?.primaryKind ?? null,
    maxRssMiB: row.memory?.primaryKind === 'process-rss' ? row.memory.maxMiB : null,
  };
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function maxBy(items, valueFn) {
  let best = null;
  let bestValue = -Infinity;
  for (const item of items) {
    const value = valueFn(item);
    if (typeof value === 'number' && Number.isFinite(value) && value > bestValue) {
      best = item;
      bestValue = value;
    }
  }
  return best;
}

function maxNullable(values) {
  const finiteValues = values.filter(value => typeof value === 'number' && Number.isFinite(value));
  return finiteValues.length > 0 ? Math.max(...finiteValues) : null;
}

function inferEngine(environment = {}) {
  if (environment.v8) return 'V8';
  if (environment.webkitCommit) return 'JavaScriptCore';
  return null;
}

function engineVersion(environment = {}) {
  if (environment.browserVersion) return environment.browserVersion;
  if (environment.v8 && environment.runtimeName !== 'bun') return environment.v8;
  if (environment.webkitCommit) return environment.webkitCommit;
  return environment.v8 ?? null;
}

function readJson(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Required release artifact is missing: ${filePath}`);
  }
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(`same-contract-runtime-comparison: rows=${report.summary.rowCount} jsCounterexamples=${report.summary.jsRuntimeCounterexamples200MiB}`);
}

function formatSummaryRow(row) {
  if (!row) return 'none';
  return `${row.runtimeLabel} ${row.caseId} at ${formatNumber(row.mibPerSec)} MiB/s (${formatMemory(row.memory)})`;
}

function formatMemory(memory) {
  if (!memory) return 'n/a';
  if (memory.primaryKind === 'process-rss') {
    return `process RSS max ${formatNumber(memory.maxMiB)} MiB`;
  }
  if (memory.primaryKind === 'browser-js-heap') {
    const host = memory.hostProcessTree
      ? `; host working set ${formatNumber(memory.hostProcessTree.maxWorkingSetMiB)} MiB`
      : '';
    const probe = memory.hostProcessTreeProbe
      ? `; fresh host probe ${formatNumber(memory.hostProcessTreeProbe.maxWorkingSetMiB)} MiB`
      : '';
    return `JS heap max ${formatNumber(memory.maxMiB)} MiB${host}${probe}`;
  }
  if (memory.primaryKind === 'browser-js-heap-unavailable' && memory.hostProcessTreeProbe) {
    return `browser-js-heap-unavailable; fresh host probe ${formatNumber(memory.hostProcessTreeProbe.maxWorkingSetMiB)} MiB`;
  }
  return memory.primaryKind ?? 'n/a';
}

function formatSourceMode(sourceMode) {
  return sourceMode ? `\`${sourceMode}\`` : 'n/a';
}

function formatFullArrayBufferInput(value) {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return 'unknown';
}

function formatCorpusSeedReplay(row) {
  if (!row?.corpusSeedReplay) return 'no';
  return `yes (${formatNumber(bytesToMiB(row.corpusSeedBytes))} MiB)`;
}

function sourceConsumptionMarkdownRow(scope, row) {
  if (!row) {
    return `| ${scope} | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |`;
  }
  const counters = `reads=${row.readCalls}, batches=${row.batchCount}, pulls=${row.pullCalls}, enqueues=${row.enqueueCalls}`;
  return `| ${scope} | \`${row.id}\` | ${row.parserInput ?? 'n/a'} | ${formatNumber(row.mibPerSec)} | ${formatNumber(row.maxRssMiB)} MiB | ${row.batchSize ?? 'n/a'} | ${row.directReadableStream ? 'yes' : 'no'} | ${formatFullArrayBufferInput(row.fullArrayBufferParserInput)} | ${row.respectsBackpressure === null ? 'n/a' : row.respectsBackpressure ? 'yes' : 'no'} | ${counters} |`;
}

function browserLiveSourceMarkdownRow(scope, row) {
  if (!row) {
    return `| ${scope} | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |`;
  }
  return `| ${scope} | \`${row.id}\` | ${formatSourceMode(row.sourceMode)} | ${formatNumber(row.mibPerSec)} | ${formatNumber(row.maxJsHeapMiB)} MiB | ${formatNullableBoolean(row.directReadableStream)} | ${formatFullArrayBufferInput(row.fullArrayBufferParserInput)} | ${formatNullableBoolean(row.respectsBackpressure)} | ${row.eventCount} | ${row.checksum} |`;
}

function formatNullableBoolean(value) {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return 'n/a';
}

function formatAllocationMemory(item) {
  const memory = item.memory ?? {};
  if (memory.primaryKind === 'total-allocator-traffic') {
    const shape = item.shapeSummary
      ? `; borrowed=${item.shapeSummary.totalBorrowedCount}, owned=${item.shapeSummary.totalOwnedCount}`
      : '';
    const phase = item.dominantPhase
      ? `; dominantPhase=${item.dominantPhase.phase} ${formatNumber(item.dominantPhase.totalAllocatedMiB)} MiB`
      : '';
    return `allocated ${formatNumber(memory.totalAllocatedMiB)} MiB, net ${formatNumber(memory.netAllocatedMiB)} MiB${shape}${phase}`;
  }
  return `sampled ${formatBytesForSmallMemory(memory.sampledMiB)}; string-boundary samples=${memory.stringBoundaryEventCount ?? 'n/a'}`;
}

function bytesToMiB(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value / MIB : null;
}

function bytesToGiB(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value / (1024 * MIB) : null;
}

function round(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function formatBytesForSmallMemory(mib) {
  if (typeof mib !== 'number' || !Number.isFinite(mib)) return 'n/a';
  if (mib < 0.01) return `${(mib * 1024).toFixed(1)} KiB`;
  return `${mib.toFixed(2)} MiB`;
}

main();
