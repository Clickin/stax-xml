import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultReleaseDir = resolve(__dirname, 'results', 'release');
const defaultJsonOut = resolve(defaultReleaseDir, 'same-contract-runtime-comparison.json');
const defaultMdOut = resolve(defaultReleaseDir, 'same-contract-runtime-comparison.md');

const candidateCases = ['stringFull', 'eventObjectFull', 'rawFrameNameId'];
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
    group: 'cross-process-books-corpus-batch16',
    file: 'candidate-headroom-cross-process-books-corpus-batch16.json',
    cases: candidateCases,
  },
  {
    group: 'cross-process-large-asset-corpus',
    file: 'candidate-headroom-cross-process-large-asset-corpus.json',
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
  ];
  const allocationEvidence = allocationArtifacts.map(spec => extractAllocationEvidence(readReleaseJson(spec.file), spec));
  const summary = summarize(comparisonRows, allocationEvidence);
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
    .map(row => ({
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
      sourceMode: classifyExternalSourceMode(row, report),
      memory: extractExternalMemory(row, report),
      woodstoxRatio: round(row.woodstoxRatio),
      targetStatus: row.targetStatus ?? null,
      runtimeLimitCounterexample: false,
    }));
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
      sourceMode: spec.sourceMode ?? classifyArtifactSourceMode(row, report),
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
          sourceMode: classifyArtifactSourceMode(row, report),
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
      sourceMode: 'file-backed-sync-iterable-byte-batches',
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
  if (report.objective === 'candidate-headroom-cross-process'
    && report.options?.fixtureShape === 'corpus-cycle') {
    return 'sync-iterable-byte-batches';
  }
  return null;
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

function summarize(rows, allocationEvidence) {
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
  );
  const largeWoodstox = externalLargeRows.find(row => row.runtimeId === 'woodstox-jvm');
  const largeQuickXml = externalLargeRows.find(row => row.runtimeId === 'quick-xml-rust');
  const largeStaxStream = externalLargeRows.find(row => row.caseId === 'stax-stream');
  const largeRawFrameNameId = externalLargeRows.find(row => row.caseId === 'stax-raw-frame-name-id');
  const sameFixtureWoodstox = maxBy(
    sameFixture1024MiBRows.filter(row => row.runtimeId === 'woodstox-jvm'),
    row => row.mibPerSec,
  );
  const fastestSameFixtureLargeJsRow = maxBy(
    sameFixture1024MiBRows.filter(row => row.jsRuntime && row.fullStringParity),
    row => row.mibPerSec,
  );
  const fastestJsLargeFullRowMibPerSec = fastestJsLargeFullRow?.mibPerSec ?? null;
  const largeWoodstoxMibPerSec = largeWoodstox?.mibPerSec ?? null;
  const sameFixtureWoodstoxMibPerSec = sameFixtureWoodstox?.mibPerSec ?? null;
  const targetWoodstox90MiBPerSec = typeof largeWoodstoxMibPerSec === 'number'
    ? round(largeWoodstoxMibPerSec * 0.9)
    : null;
  const sameFixtureTargetWoodstox90MiBPerSec = typeof sameFixtureWoodstoxMibPerSec === 'number'
    ? round(sameFixtureWoodstoxMibPerSec * 0.9)
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
    sourceModes: Array.from(new Set(rows.map(row => row.sourceMode).filter(Boolean))).sort(),
    allocationEvidenceKinds: allocationEvidence.map(item => item.evidenceKind),
    conclusionAllowed: false,
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
        `same-fixture-0.9x-target-met=${summary.sameFixture1024MiBWoodstoxTarget.targetMet}`,
      ],
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
    `- Fastest 1 GiB+ JS public event-object row: ${formatSummaryRow(report.summary.fastestJsLargePublicEventRow)}`,
    `- Fastest bounded 1 GiB+ JS public event-object row: ${formatSummaryRow(report.summary.fastestBoundedJsLargePublicEventRow)}`,
    `- 16 MiB Woodstox baseline: ${formatNumber(report.summary.externalBaseline16MiB.woodstoxMiBPerSec)} MiB/s`,
    `- 16 MiB quick-xml baseline: ${formatNumber(report.summary.externalBaseline16MiB.quickXmlMiBPerSec)} MiB/s (${formatNumber(report.summary.externalBaseline16MiB.quickXmlWoodstoxRatio)}x Woodstox)`,
    `- 1024 MiB file-backed stax-stream baseline: ${formatNumber(report.summary.externalBaseline1024MiBFileSyncBatches.staxStreamMiBPerSec)} MiB/s (${formatNumber(report.summary.externalBaseline1024MiBFileSyncBatches.staxStreamWoodstoxRatio)}x Woodstox)`,
    `- 1024 MiB file-backed rawFrameNameId baseline: ${formatNumber(report.summary.externalBaseline1024MiBFileSyncBatches.rawFrameNameIdMiBPerSec)} MiB/s (${formatNumber(report.summary.externalBaseline1024MiBFileSyncBatches.rawFrameNameIdWoodstoxRatio)}x Woodstox)`,
    `- 1024 MiB Woodstox baseline: ${formatNumber(report.summary.externalBaseline1024MiBFileSyncBatches.woodstoxMiBPerSec)} MiB/s`,
    `- 1024 MiB quick-xml baseline: ${formatNumber(report.summary.externalBaseline1024MiBFileSyncBatches.quickXmlMiBPerSec)} MiB/s (${formatNumber(report.summary.externalBaseline1024MiBFileSyncBatches.quickXmlWoodstoxRatio)}x Woodstox)`,
    `- Recognized JS source modes: ${report.summary.sourceModes.length > 0 ? report.summary.sourceModes.join(', ') : 'none recorded'}`,
    '',
    '## Fastest JS Rows By Group',
    '',
    '| Group | Runtime | Case | MiB/s | Bounded | Memory | Source mode |',
    '| --- | --- | --- | ---: | --- | --- | --- |',
  ];

  for (const item of report.summary.fastestRowsByGroup) {
    const row = item.fastest;
    lines.push(`| \`${item.group}\` | ${row.runtimeLabel} | \`${row.caseId}\` | ${formatNumber(row.mibPerSec)} | ${row.boundedMemory ? 'yes' : 'no'} | ${formatMemory(row.memory)} | ${formatSourceMode(row.sourceMode)} |`);
  }

  lines.push(
    '',
    '## Selected Comparison Rows',
    '',
    '| Group | Runtime | Case | Events | Checksum | MiB/s | Bounded | Memory | Source mode | Artifact |',
    '| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |',
  );

  for (const row of report.comparisonRows) {
    lines.push(`| \`${row.group}\` | ${row.runtimeLabel} | \`${row.caseId}\` | ${row.eventCount ?? ''} | ${row.checksum ?? ''} | ${formatNumber(row.mibPerSec)} | ${row.boundedMemory === null ? 'n/a' : row.boundedMemory ? 'yes' : 'no'} | ${formatMemory(row.memory)} | ${formatSourceMode(row.sourceMode)} | \`${row.sourceArtifact}\` |`);
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
    sourceArtifact: row.sourceArtifact,
    sampleCount: row.sampleCount ?? null,
    sampleMinMiBPerSec: row.sampleMinMiBPerSec ?? null,
    sampleMaxMiBPerSec: row.sampleMaxMiBPerSec ?? null,
    sampleSpreadRatio: row.sampleSpreadRatio ?? null,
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
