import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultReleaseDir = resolve(__dirname, 'results', 'release');
const defaultJsonOut = resolve(defaultReleaseDir, 'runtime-proof-coverage-audit.json');
const defaultMdOut = resolve(defaultReleaseDir, 'runtime-proof-coverage-audit.md');

const ignoredArtifacts = new Set([
  'latest-summary.json',
  'access-shape-candidate-cross-process.json',
  'runtime-limit-proof-obligation-gate.json',
  'runtime-proof-gap-handoff.json',
  'same-contract-runtime-comparison.json',
  'runtime-counterexample-scan.json',
  'runtime-proof-coverage-audit.json',
]);

const runtimeOrder = [
  'node-v8',
  'bun-jsc',
  'deno-v8',
  'chrome-v8-browser',
  'firefox-spidermonkey-browser',
  'safari-jsc-browser',
  'woodstox-jvm',
  'quick-xml-rust',
  'unknown',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    releaseDir: defaultReleaseDir,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    minLargeGiB: 0.999,
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
      case '--min-large-gib':
        options.minLargeGiB = parsePositiveNumber(readValue(), name);
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
  const artifactFiles = readdirSync(options.releaseDir)
    .filter(file => file.endsWith('.json'))
    .sort();
  const artifacts = [];
  const ignored = [];
  const parseErrors = [];

  for (const file of artifactFiles) {
    if (ignoredArtifacts.has(file)) {
      ignored.push(file);
      continue;
    }
    try {
      const root = JSON.parse(readFileSync(join(options.releaseDir, file), 'utf8'));
      artifacts.push(createArtifactRecord(file, root, options));
    } catch (error) {
      parseErrors.push({ file, message: error?.message ?? String(error) });
    }
  }

  const coverage = createCoverage(artifacts, options);
  const obligations = createObligationRows(coverage);
  const unknownBoundedMemoryRows = artifacts
    .flatMap(artifact => artifact.measuredRows)
    .filter(row => row.boundedMemory === null)
    .map(summarizeUnknownBoundedMemoryRow);
  const summary = {
    scannedArtifactCount: artifacts.length,
    ignoredArtifactCount: ignored.length,
    parseErrorCount: parseErrors.length,
    measuredRowCount: sum(artifacts.map(artifact => artifact.measuredRows.length)),
    rowClassificationCompleteness: summarizeRowClassificationCompleteness(artifacts.flatMap(artifact => artifact.measuredRows)),
    unknownBoundedMemoryBreakdown: summarizeUnknownBoundedMemoryRows(artifacts.flatMap(artifact => artifact.measuredRows), options),
    benchmarkArtifactCount: artifacts.filter(artifact => artifact.evidenceKinds.includes('BENCH_FACT')).length,
    sourceArtifactCount: artifacts.filter(artifact => artifact.evidenceKinds.includes('SOURCE_FACT')).length,
    traceArtifactCount: artifacts.filter(artifact => artifact.evidenceKinds.includes('TRACE_FACT')).length,
    allocationArtifactCount: artifacts.filter(artifact => artifact.evidenceKinds.includes('ALLOCATION_FACT')).length,
    environmentArtifactCount: artifacts.filter(artifact => artifact.evidenceKinds.includes('ENVIRONMENT_FACT')).length,
    negativeArtifactCount: artifacts.filter(artifact => artifact.evidenceKinds.includes('NEGATIVE_RESULT')).length,
    largeJsFullRowCount: coverage.largeJsFullRowCount,
    largeJsFullSourceInputSafety: coverage.largeJsFullSourceInputSafety,
    runtimeCount: coverage.runtimes.length,
    corpusSeedCount: coverage.corpusSeeds.length,
    openObligationCount: obligations.filter(row => row.status !== 'covered').length,
    conclusionAllowed: false,
  };

  return {
    generatedAt: new Date().toISOString(),
    objective: 'runtime-proof-coverage-audit',
    contract: 'static-release-artifact-proof-coverage',
    note: 'Scans current release artifacts for runtime, browser-engine, corpus, codegen/profile, and allocation coverage. This is a coverage audit over existing artifacts, not a benchmark run or runtime-limit proof.',
    parameters: {
      releaseDir: options.releaseDir,
      minLargeGiB: options.minLargeGiB,
    },
    scannedArtifacts: artifacts.map(artifact => summarizeArtifact(artifact)),
    ignoredArtifacts: ignored,
    parseErrors,
    summary,
    coverage,
    obligations,
    unknownBoundedMemoryRows,
    findings: createFindings(coverage, obligations),
  };
}

function createArtifactRecord(sourceArtifact, root, options) {
  const measuredRows = extractMeasuredRows(sourceArtifact, root);
  const evidenceKinds = classifyEvidenceKinds(sourceArtifact, root, measuredRows);
  const runtimes = Array.from(new Set([
    classifyRuntimeFromArtifact(sourceArtifact, root),
    ...measuredRows.map(row => row.runtimeId),
  ].filter(Boolean))).sort(compareRuntimeIds);
  const fixture = normalizeFixture(root.fixture);
  const corpusSeed = fixture?.source === 'corpus-file' && fixture.sourceFile
    ? normalizeCorpusSeed(fixture.sourceFile)
    : null;

  return {
    sourceArtifact,
    objective: root.objective ?? null,
    contract: root.contract ?? null,
    evidenceKinds,
    runtimes,
    environment: summarizeEnvironment(root.environment),
    parameters: summarizeParameters(root.parameters),
    summary: summarizeArtifactSummary(root.summary),
    availability: summarizeAvailability(root.summary),
    outcome: summarizeOutcome(root.outcome),
    shell: summarizeShell(root.shell),
    fixture,
    corpusSeed,
    measuredRows,
    sourcePins: classifySourcePins(sourceArtifact, root),
  };
}

function summarizeArtifactSummary(summary = {}) {
  if (!summary || typeof summary !== 'object') return null;
  const result = {
    status: summary.status ?? null,
    shellCount: typeof summary.shellCount === 'number' ? summary.shellCount : null,
    availableShellCount: typeof summary.availableShellCount === 'number' ? summary.availableShellCount : null,
    jitStatusShellCount: typeof summary.jitStatusShellCount === 'number' ? summary.jitStatusShellCount : null,
    binaryReadableShellCount: typeof summary.binaryReadableShellCount === 'number' ? summary.binaryReadableShellCount : null,
    unchangedRunnableShellCount: typeof summary.unchangedRunnableShellCount === 'number' ? summary.unchangedRunnableShellCount : null,
    commonMissingGlobals: Array.isArray(summary.commonMissingGlobals) ? summary.commonMissingGlobals : null,
    blockedSurfaceCount: typeof summary.blockedSurfaceCount === 'number' ? summary.blockedSurfaceCount : null,
    canCloseEmittedIrObligation: typeof summary.canCloseEmittedIrObligation === 'boolean'
      ? summary.canCloseEmittedIrObligation
      : null,
    conclusionAllowed: typeof summary.conclusionAllowed === 'boolean' ? summary.conclusionAllowed : null,
  };
  return Object.values(result).some(value => value !== null) ? result : null;
}

function summarizeAvailability(summary = {}) {
  if (!summary || typeof summary !== 'object') return null;
  const availability = {
    hostIsMacOS: typeof summary.hostIsMacOS === 'boolean' ? summary.hostIsMacOS : null,
    safariExecutableFound: typeof summary.safariExecutableFound === 'boolean' ? summary.safariExecutableFound : null,
    safaridriverFound: typeof summary.safaridriverFound === 'boolean' ? summary.safaridriverFound : null,
    currentHarnessSupportsSafari: typeof summary.currentHarnessSupportsSafari === 'boolean' ? summary.currentHarnessSupportsSafari : null,
    canRunSafariBrowserRows: typeof summary.canRunSafariBrowserRows === 'boolean' ? summary.canRunSafariBrowserRows : null,
    safariBenchmarkRowsRecorded: typeof summary.safariBenchmarkRowsRecorded === 'boolean' ? summary.safariBenchmarkRowsRecorded : null,
    exactSafariBuildIdentityRecorded: typeof summary.exactSafariBuildIdentityRecorded === 'boolean' ? summary.exactSafariBuildIdentityRecorded : null,
    safariSourceBoundaryPinned: typeof summary.safariSourceBoundaryPinned === 'boolean' ? summary.safariSourceBoundaryPinned : null,
    openObligationRemains: typeof summary.openObligationRemains === 'boolean' ? summary.openObligationRemains : null,
  };
  return Object.values(availability).some(value => value !== null) ? availability : null;
}

function summarizeParameters(parameters = {}) {
  if (!parameters || typeof parameters !== 'object') return null;
  return {
    searchRoots: Array.isArray(parameters.searchRoots) ? parameters.searchRoots : null,
  };
}

function classifyEvidenceKinds(sourceArtifact, root, measuredRows) {
  const kinds = new Set();
  if (measuredRows.length > 0) kinds.add('BENCH_FACT');
  if (/source-pin-audit|shape-audit|materialization-contract-audit|memory-frontier-audit|target-distance-audit|text-materialization-boundary-audit/.test(sourceArtifact)) kinds.add('SOURCE_FACT');
  if (/availability-audit/.test(sourceArtifact)) kinds.add('ENVIRONMENT_FACT');
  if (/trace|profiler-trace|cpu-profile|hotspot|machine-code/.test(sourceArtifact)) kinds.add('TRACE_FACT');
  if (/allocation|jfr/.test(sourceArtifact)) kinds.add('ALLOCATION_FACT');
  for (const classification of findingClassifications(root)) {
    if (!findingEvidenceKinds.has(classification)) continue;
    kinds.add(classification);
  }
  if (root.objective === 'runtime-matrix' || root.objective === 'external-baseline') kinds.add('BENCH_FACT');
  return Array.from(kinds).sort();
}

const findingEvidenceKinds = new Set([
  'BENCH_FACT',
  'HEADROOM_EVIDENCE_PRESENT',
  'NEGATIVE_RESULT',
  'SCOPE_GUARD',
]);

function findingClassifications(root) {
  const findings = root?.findings;
  if (!Array.isArray(findings)) return [];
  return findings
    .map(finding => finding?.classification)
    .filter(classification => typeof classification === 'string' && classification.length > 0);
}

function extractMeasuredRows(sourceArtifact, root) {
  const rows = [];
  visit(root, [], createInitialContext(sourceArtifact, root), (node, path, context) => {
    if (isDerivedProjectionPath(path)) return;
    if (typeof node.mibPerSec !== 'number' || !Number.isFinite(node.mibPerSec)) return;
    const fixture = normalizeFixture(node.fixture) ?? context.fixture;
    const memoryKind = classifyMemoryKind(node);
    const sourceMode = classifySourceMode(sourceArtifact, node, context);
    rows.push({
      sourceArtifact,
      jsonPath: path.join('.'),
      id: String(node.id ?? node.tool ?? node.name ?? path.at(-1) ?? 'row'),
      runtimeId: classifyRuntime(sourceArtifact, node, context),
      runtimeLabel: runtimeLabel(classifyRuntime(sourceArtifact, node, context)),
      sizeGiB: fixture?.sizeGiB ?? null,
      fixtureSource: fixture?.source ?? null,
      fixtureShape: fixture?.shape ?? null,
      corpusSeed: fixture?.source === 'corpus-file' && fixture.sourceFile ? normalizeCorpusSeed(fixture.sourceFile) : null,
      mibPerSec: round(node.mibPerSec),
      fullStringParity: classifyFullStringParity(node, context),
      boundedMemory: classifyBoundedMemory(node, memoryKind),
      memoryKind,
      eventCount: normalizeEventCount(node),
      checksum: node.checksum ?? null,
      contractScope: node.contractScope ?? node.workload ?? context.contract ?? null,
      sourceMode,
      demandDrivenSource: classifyDemandDrivenSource(node, sourceMode),
      directReadableStream: classifyDirectReadableStream(node, sourceMode),
      fullArrayBufferParserInput: classifyFullArrayBufferParserInput(node, sourceMode, context),
    });
  });
  return rows;
}

function classifySourceMode(sourceArtifact, node, context) {
  if (typeof node.sourceMode === 'string') return normalizeSourceMode(node.sourceMode);

  const sourceContract = context.sourceContract?.childSourceContract ?? context.sourceContract;
  const parserInput = sourceContract?.parserInput;
  const arrayBufferConsumption = sourceContract?.arrayBufferConsumption;
  const combined = `${parserInput ?? ''} ${arrayBufferConsumption ?? ''}`;
  if (/StreamReaderSync over a synchronous Iterable<Uint8Array\[\]>/.test(combined)
    && /byteBatches\(fixture\)/.test(combined)) {
    return 'generated-sync-iterable-byte-batches';
  }

  if (context.objective === 'candidate-headroom-cross-process'
    && context.options?.fixtureShape === 'corpus-cycle') {
    return 'generated-sync-iterable-byte-batches';
  }

  if (/file-sync-batches/.test(sourceArtifact)) {
    return typeof node.tool === 'string' && !node.tool.startsWith('stax-')
      ? null
      : 'file-backed-sync-iterable-byte-batches';
  }
  return null;
}

function normalizeSourceMode(sourceMode) {
  return sourceMode === 'file-sync-batches'
    ? 'file-backed-sync-iterable-byte-batches'
    : sourceMode;
}

function classifyDemandDrivenSource(node, sourceMode = null) {
  if (typeof node.demandDrivenSource === 'boolean') return node.demandDrivenSource;
  const mode = typeof sourceMode === 'string' ? sourceMode : '';
  if (mode === 'complete-js-string') return false;
  return /(?:^|-)sync-|(?:^|-)async-|readable-stream-pull/.test(mode);
}

function classifyDirectReadableStream(node, sourceMode = null) {
  if (typeof node.directReadableStream === 'boolean') return node.directReadableStream;
  const mode = typeof sourceMode === 'string' ? sourceMode : '';
  if (/readable-stream-pull|fetchReadableStream/i.test(mode) || /readable-stream/i.test(mode)) return true;
  if (/sync.*iterable-byte-batches|async.*iterable-byte-batches|complete-js-string/.test(mode)) return false;
  return null;
}

function classifyFullArrayBufferParserInput(node, sourceMode = null, context = null) {
  if (typeof node.fullArrayBufferParserInput === 'boolean') return node.fullArrayBufferParserInput;
  const mode = typeof sourceMode === 'string' ? sourceMode : '';
  if (/sync-iterable-byte-batches|async-iterable-byte-batches|readable-stream-pull|complete-js-string/.test(mode)) {
    return false;
  }

  const sourceContract = context?.sourceContract?.childSourceContract ?? context?.sourceContract;
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

function isDerivedProjectionPath(path) {
  return path.includes('summary')
    || path.includes('comparisons')
    || path.includes('sameScalePairs')
    || path.includes('negativeRows');
}

function visit(value, path, context, onNode) {
  if (!value || typeof value !== 'object') return;
  const nextContext = extendContext(value, context);
  if (!Array.isArray(value)) {
    onNode(value, path, nextContext);
  }
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === 'object') {
      visit(child, path.concat(key), nextContext, onNode);
    }
  }
}

function createInitialContext(sourceArtifact, root) {
  return extendContext(root, {
    sourceArtifact,
    fixture: null,
    environment: null,
    runtime: null,
    objective: root?.objective ?? null,
    contract: root?.contract ?? null,
    sourceContract: root?.sourceContract ?? null,
    options: root?.options ?? null,
  });
}

function extendContext(node, context) {
  return {
    ...context,
    fixture: normalizeFixture(node.fixture) ?? context.fixture,
    environment: node.environment ?? context.environment,
    runtime: node.runtime ?? context.runtime,
    objective: node.objective ?? context.objective,
    contract: node.contract ?? context.contract,
    sourceContract: node.sourceContract ?? context.sourceContract,
    options: node.options ?? context.options,
  };
}

function createCoverage(artifacts, options) {
  const allRows = artifacts.flatMap(artifact => artifact.measuredRows);
  const largeJsFullRows = allRows.filter(row =>
    isJsRuntime(row.runtimeId)
    && row.fullStringParity === true
    && row.sizeGiB !== null
    && row.sizeGiB >= options.minLargeGiB
  );
  const browserBenchmarkRows = allRows.filter(row => isBrowserRuntime(row.runtimeId));
  const nonV8BrowserRows = browserBenchmarkRows.filter(row => !row.runtimeId.includes('v8'));
  const corpusRows = allRows.filter(row => row.corpusSeed);
  const corpusSeeds = Array.from(new Set(corpusRows.map(row => row.corpusSeed))).sort();

  const evidenceByRuntime = runtimeOrder.map(runtimeId => createRuntimeCoverage(runtimeId, artifacts, allRows))
    .filter(item => item.artifactCount > 0 || item.measuredRowCount > 0 || item.sourcePins.length > 0);

  return {
    runtimes: evidenceByRuntime,
    browser: {
      benchmarkRows: summarizeRows(browserBenchmarkRows),
      nonV8BenchmarkRows: summarizeRows(nonV8BrowserRows),
      firefoxBenchmarkRows: summarizeRows(browserBenchmarkRows.filter(row => row.runtimeId === 'firefox-spidermonkey-browser')),
      safariBenchmarkRows: summarizeRows(browserBenchmarkRows.filter(row => row.runtimeId === 'safari-jsc-browser')),
      chromeBenchmarkRows: summarizeRows(browserBenchmarkRows.filter(row => row.runtimeId === 'chrome-v8-browser')),
    },
    corpusSeeds,
    corpusRows: summarizeRows(corpusRows),
    largeJsFullRowCount: largeJsFullRows.length,
    largeJsFullSourceInputSafety: summarizeSourceInputSafety(largeJsFullRows),
    fastestLargeJsFullRows: summarizeRows(largeJsFullRows
      .slice()
      .sort((left, right) => right.mibPerSec - left.mibPerSec)
      .slice(0, 12)),
    sourcePins: artifacts.flatMap(artifact => artifact.sourcePins.map(pin => ({ ...pin, sourceArtifact: artifact.sourceArtifact }))),
    safariWebKitStatus: summarizeSafariWebKitStatus(artifacts, browserBenchmarkRows),
    spiderMonkeyDiagnostics: summarizeSpiderMonkeyDiagnostics(artifacts),
    codegenArtifacts: artifacts
      .filter(artifact => artifact.evidenceKinds.includes('TRACE_FACT'))
      .map(artifact => summarizeArtifact(artifact)),
    allocationArtifacts: artifacts
      .filter(artifact => artifact.evidenceKinds.includes('ALLOCATION_FACT'))
      .map(artifact => summarizeArtifact(artifact)),
    environmentArtifacts: artifacts
      .filter(artifact => artifact.evidenceKinds.includes('ENVIRONMENT_FACT'))
      .map(artifact => summarizeArtifact(artifact)),
    negativeArtifacts: artifacts
      .filter(artifact => artifact.evidenceKinds.includes('NEGATIVE_RESULT'))
      .map(artifact => summarizeArtifact(artifact)),
  };
}

function summarizeSourceInputSafety(rows) {
  const sourceRows = rows.filter(row => row.sourceMode);
  const breakdown = Array.from(groupBy(sourceRows, row => row.sourceMode).entries())
    .map(([sourceMode, groupRows]) => ({
      sourceMode,
      rows: groupRows.length,
      notFullArrayBufferRows: groupRows.filter(row => row.fullArrayBufferParserInput === false).length,
      fullArrayBufferRows: groupRows.filter(row => row.fullArrayBufferParserInput === true).length,
      unknownArrayBufferRows: groupRows.filter(row => row.fullArrayBufferParserInput === null).length,
      directReadableStreamRows: groupRows.filter(row => row.directReadableStream === true).length,
      demandDrivenRows: groupRows.filter(row => row.demandDrivenSource === true).length,
      fastestRow: summarizeRows(groupRows
        .slice()
        .sort((left, right) => right.mibPerSec - left.mibPerSec)
        .slice(0, 1))[0] ?? null,
    }))
    .sort((left, right) => left.sourceMode.localeCompare(right.sourceMode));
  return {
    rows: rows.length,
    sourceModeRows: sourceRows.length,
    notFullArrayBufferRows: sourceRows.filter(row => row.fullArrayBufferParserInput === false).length,
    fullArrayBufferRows: sourceRows.filter(row => row.fullArrayBufferParserInput === true).length,
    unknownArrayBufferRows: sourceRows.filter(row => row.fullArrayBufferParserInput === null).length,
    directReadableStreamRows: sourceRows.filter(row => row.directReadableStream === true).length,
    demandDrivenRows: sourceRows.filter(row => row.demandDrivenSource === true).length,
    sourceModeBreakdown: breakdown,
  };
}

function summarizeSafariWebKitStatus(artifacts, browserBenchmarkRows) {
  const availabilityArtifact = artifacts.find(artifact =>
    artifact.sourceArtifact === 'safari-webkit-availability-audit.json'
  ) ?? null;
  const availability = availabilityArtifact?.availability ?? {};
  const safariRows = browserBenchmarkRows.filter(row => row.runtimeId === 'safari-jsc-browser');
  const safariFullRows = safariRows.filter(row => row.fullStringParity === true);
  const safariPrimaryRows = safariFullRows.filter(row =>
    row.directReadableStream === false
    && row.fullArrayBufferParserInput === false
    && row.demandDrivenSource === true
    && typeof row.sourceMode === 'string'
    && /sync-iterable-byte-batches$/.test(row.sourceMode)
  );
  const boundedPrimaryRows = safariPrimaryRows.filter(row => row.boundedMemory === true);
  return {
    availabilityArtifact: availabilityArtifact?.sourceArtifact ?? null,
    hostIsMacOS: availability.hostIsMacOS ?? null,
    safariExecutableFound: availability.safariExecutableFound ?? null,
    safaridriverFound: availability.safaridriverFound ?? null,
    harnessSupportsSafari: availability.currentHarnessSupportsSafari ?? null,
    canRunSafariBrowserRows: availability.canRunSafariBrowserRows ?? null,
    benchmarkRowsRecorded: safariRows.length,
    availabilitySaysRowsRecorded: availability.safariBenchmarkRowsRecorded ?? null,
    exactBuildIdentityRecorded: availability.exactSafariBuildIdentityRecorded ?? null,
    sourceBoundaryPinned: availability.safariSourceBoundaryPinned ?? null,
    openObligationRemains: availability.openObligationRemains ?? null,
    fullStringRowsRecorded: safariFullRows.length,
    primarySyncByteBatchRowsRecorded: safariPrimaryRows.length,
    boundedPrimarySyncByteBatchRowsRecorded: boundedPrimaryRows.length,
    evidenceClass: safariRows.length > 0
      ? 'browser-row-evidence'
      : availabilityArtifact
        ? 'environment-availability-only'
        : 'missing-availability-audit',
    closesSafariObligation: safariRows.length > 0
      && availability.exactSafariBuildIdentityRecorded === true
      && availability.safariSourceBoundaryPinned === true
      && boundedPrimaryRows.length > 0,
  };
}

function summarizeSpiderMonkeyDiagnostics(artifacts) {
  const byName = new Map(artifacts.map(artifact => [artifact.sourceArtifact, artifact]));
  const diagnosticDump = byName.get('firefox-spidermonkey-diagnostic-dump-audit.json') ?? null;
  const localJsShell = byName.get('firefox-spidermonkey-js-shell-availability-audit.json') ?? null;
  const releaseJsShell = byName.get('firefox-spidermonkey-release-jsshell-availability-audit.json') ?? null;
  const nightlyJsShell = byName.get('firefox-spidermonkey-nightly-jsshell-availability-audit.json') ?? null;
  const jsShellApiGap = byName.get('firefox-spidermonkey-jsshell-stax-api-gap-audit.json') ?? null;
  const buildconfig = byName.get('firefox-spidermonkey-buildconfig-source-pin-audit.json') ?? null;
  const rows = [
    summarizeSpiderMonkeyDiagnostic('installed-browser-diagnostic-dump', diagnosticDump),
    summarizeSpiderMonkeyDiagnostic('local-js-shell-discovery', localJsShell),
    summarizeSpiderMonkeyDiagnostic('official-release-jsshell', releaseJsShell),
    summarizeSpiderMonkeyDiagnostic('official-nightly-jsshell', nightlyJsShell),
    summarizeSpiderMonkeyDiagnostic('official-jsshell-stax-api-gap', jsShellApiGap),
    summarizeSpiderMonkeyDiagnostic('installed-buildconfig-source-pin', buildconfig),
  ].filter(Boolean);
  return {
    rows,
    emittedIrEvidenceCount: rows.filter(row => row.closesEmittedIrObligation === true).length,
    jitStatusOnlyCount: rows.filter(row => row.evidenceClass === 'jit-status-only').length,
    availabilityOnlyCount: rows.filter(row => row.evidenceClass === 'availability-only').length,
    missingIrSurfaceCount: rows.filter(row => row.irDumpSurface === false || row.nativeDumpComplete === false).length,
  };
}

function summarizeSpiderMonkeyDiagnostic(id, artifact) {
  if (!artifact) return null;
  const outcome = artifact.outcome ?? {};
  const summary = artifact.summary ?? {};
  const hasJitExecutionStatus = typeof outcome.hasJitExecutionStatus === 'boolean'
    ? outcome.hasJitExecutionStatus
    : typeof summary.jitStatusShellCount === 'number' && typeof summary.shellCount === 'number'
      ? summary.jitStatusShellCount === summary.shellCount && summary.shellCount > 0
    : null;
  const closesEmittedIrObligation = typeof outcome.closesEmittedIrObligation === 'boolean'
    ? outcome.closesEmittedIrObligation
    : false;
  const irDumpSurface = typeof outcome.hasIrDumpSurface === 'boolean'
    ? outcome.hasIrDumpSurface
    : null;
  const nativeDumpComplete = typeof outcome.nativeDumpComplete === 'boolean'
    ? outcome.nativeDumpComplete
    : null;
  const bytecodeDumpOutput = typeof outcome.hasBytecodeDumpOutput === 'boolean'
    ? outcome.hasBytecodeDumpOutput
    : null;
  return {
    id,
    sourceArtifact: artifact.sourceArtifact,
    status: outcome.status ?? summary.status ?? 'source-pin',
    packageVerified: typeof outcome.packageVerified === 'boolean' ? outcome.packageVerified : null,
    foundCount: typeof outcome.foundCount === 'number' ? outcome.foundCount : null,
    searchRoots: artifact.parameters?.searchRoots?.length ?? null,
    dumpFileCount: typeof outcome.dumpFileCount === 'number' ? outcome.dumpFileCount : null,
    hasJitExecutionStatus,
    irDumpSurface,
    nativeDisassemblySurface: typeof outcome.hasNativeDisassemblySurface === 'boolean'
      ? outcome.hasNativeDisassemblySurface
      : null,
    nativeDumpComplete,
    bytecodeDumpOutput,
    bytecodeDumpStatus: artifact.shell?.bytecodeDumpProbe?.status ?? null,
    bytecodeDumpMarkers: typeof artifact.shell?.bytecodeDumpProbe?.bytecodeMarkerCount === 'number'
      ? artifact.shell.bytecodeDumpProbe.bytecodeMarkerCount
      : null,
    canReadBinaryInput: typeof outcome.canReadBinaryInput === 'boolean'
      ? outcome.canReadBinaryInput
      : typeof summary.binaryReadableShellCount === 'number' && typeof summary.shellCount === 'number'
        ? summary.binaryReadableShellCount === summary.shellCount && summary.shellCount > 0
        : null,
    canRunCurrentStaxFullStringBenchmark: typeof outcome.canRunCurrentStaxFullStringBenchmark === 'boolean'
      ? outcome.canRunCurrentStaxFullStringBenchmark
      : typeof summary.unchangedRunnableShellCount === 'number'
        ? summary.unchangedRunnableShellCount > 0
        : null,
    commonMissingGlobals: Array.isArray(summary.commonMissingGlobals) ? summary.commonMissingGlobals : null,
    closesEmittedIrObligation,
    evidenceClass: classifySpiderMonkeyDiagnosticEvidence({
      id,
      hasJitExecutionStatus,
      closesEmittedIrObligation,
      irDumpSurface,
      nativeDumpComplete,
      outcome,
      summary,
    }),
  };
}

function classifySpiderMonkeyDiagnosticEvidence({ id, hasJitExecutionStatus, closesEmittedIrObligation, irDumpSurface, nativeDumpComplete, outcome, summary }) {
  if (closesEmittedIrObligation) return 'emitted-ir';
  if (id.includes('stax-api-gap') || summary?.status === 'blocked-by-host-api-surface') return 'host-api-surface-gap';
  if (hasJitExecutionStatus) return 'jit-status-only';
  if (irDumpSurface === false || nativeDumpComplete === false) return 'negative-diagnostic-surface';
  if (outcome?.status === 'no-dump-emitted' || outcome?.status === 'not-found') return 'negative-diagnostic-surface';
  if (id.includes('buildconfig')) return 'source-pin-only';
  return 'availability-only';
}

function summarizeRowClassificationCompleteness(rows) {
  return {
    measuredRows: rows.length,
    unknownFullStringParityRows: rows.filter(row => row.fullStringParity === null).length,
    unknownBoundedMemoryRows: rows.filter(row => row.boundedMemory === null).length,
  };
}

function summarizeUnknownBoundedMemoryRows(rows, options) {
  const unknownRows = rows.filter(row => row.boundedMemory === null);
  const counterexampleRelevantRows = unknownRows.filter(row =>
    isJsRuntime(row.runtimeId)
    && row.fullStringParity === true
    && row.sizeGiB !== null
    && row.sizeGiB >= options.minLargeGiB
  );
  return {
    total: unknownRows.length,
    jsRows: unknownRows.filter(row => isJsRuntime(row.runtimeId)).length,
    fullStringRows: unknownRows.filter(row => row.fullStringParity === true).length,
    jsFullStringRows: unknownRows.filter(row => isJsRuntime(row.runtimeId) && row.fullStringParity === true).length,
    largeJsFullStringRows: counterexampleRelevantRows.length,
    counterexampleRelevantRows: counterexampleRelevantRows.length,
    smallOrDiagnosticJsRows: unknownRows.filter(row =>
      isJsRuntime(row.runtimeId)
      && (row.sizeGiB === null || row.sizeGiB < options.minLargeGiB)
    ).length,
    nonJsAllocatorCounterRows: unknownRows.filter(row =>
      !isJsRuntime(row.runtimeId)
      && row.memoryKind === 'allocator-counters'
    ).length,
    nonJsNoPeakMemoryRows: unknownRows.filter(row =>
      !isJsRuntime(row.runtimeId)
      && row.memoryKind === 'not-recorded'
    ).length,
    rowsWithMemoryCounter: unknownRows.filter(row => row.memoryKind !== 'not-recorded').length,
  };
}

function summarizeUnknownBoundedMemoryRow(row) {
  return {
    sourceArtifact: row.sourceArtifact,
    jsonPath: row.jsonPath,
    id: row.id,
    runtimeId: row.runtimeId,
    runtimeLabel: row.runtimeLabel,
    sizeGiB: row.sizeGiB,
    fixtureSource: row.fixtureSource,
    fixtureShape: row.fixtureShape,
    corpusSeed: row.corpusSeed,
    mibPerSec: row.mibPerSec,
    fullStringParity: row.fullStringParity,
    memoryKind: row.memoryKind,
    eventCount: row.eventCount,
    checksum: row.checksum,
    contractScope: row.contractScope,
  };
}

function createRuntimeCoverage(runtimeId, artifacts, allRows) {
  const runtimeArtifacts = artifacts.filter(artifact => artifact.runtimes.includes(runtimeId));
  const runtimeRows = allRows.filter(row => row.runtimeId === runtimeId);
  const runtimeSourcePins = artifacts
    .flatMap(artifact => artifact.sourcePins.map(pin => ({ ...pin, sourceArtifact: artifact.sourceArtifact })))
    .filter(pin => pin.runtimeId === runtimeId);
  const runtimeTraceArtifacts = runtimeArtifacts.filter(artifact => artifact.evidenceKinds.includes('TRACE_FACT'));
  const runtimeAllocationArtifacts = runtimeArtifacts.filter(artifact => artifact.evidenceKinds.includes('ALLOCATION_FACT'));
  return {
    runtimeId,
    runtimeLabel: runtimeLabel(runtimeId),
    artifactCount: runtimeArtifacts.length,
    measuredRowCount: runtimeRows.length,
    largeFullStringRowCount: runtimeRows.filter(row => row.fullStringParity === true && (row.sizeGiB ?? 0) >= 0.999).length,
    fastestLargeFullStringRow: summarizeRow(maxBy(
      runtimeRows.filter(row => row.fullStringParity === true && (row.sizeGiB ?? 0) >= 0.999),
      row => row.mibPerSec,
    )),
    sourcePins: runtimeSourcePins,
    traceArtifacts: runtimeTraceArtifacts.map(artifact => artifact.sourceArtifact),
    allocationArtifacts: runtimeAllocationArtifacts.map(artifact => artifact.sourceArtifact),
  };
}

function createObligationRows(coverage) {
  const hasFirefoxRows = coverage.browser.firefoxBenchmarkRows.length > 0;
  const hasSafariRows = coverage.browser.safariBenchmarkRows.length > 0;
  const closesSafariObligation = coverage.safariWebKitStatus.closesSafariObligation === true;
  const hasNonV8BrowserRows = coverage.browser.nonV8BenchmarkRows.length > 0;
  const corpusSeedCount = coverage.corpusSeeds.length;
  const runtimeById = new Map(coverage.runtimes.map(row => [row.runtimeId, row]));
  const hasNodeCodegen = (runtimeById.get('node-v8')?.traceArtifacts.length ?? 0) > 0;
  const hasBunCodegen = (runtimeById.get('bun-jsc')?.traceArtifacts ?? []).some(file => /codegen|trace|ir|asm/i.test(file));
  const hasChromeCodegen = (runtimeById.get('chrome-v8-browser')?.traceArtifacts ?? []).some(file => /codegen|trace|ir|asm/i.test(file));
  const denoTraceArtifacts = runtimeById.get('deno-v8')?.traceArtifacts ?? [];
  const hasDenoCodegen = denoTraceArtifacts.some(file => /codegen|trace|ir|asm/i.test(file));
  const spiderMonkeyTraceArtifacts = runtimeById.get('firefox-spidermonkey-browser')?.traceArtifacts ?? [];
  const hasSpiderMonkeyProfilerTrace = spiderMonkeyTraceArtifacts.some(file => /profiler-trace/i.test(file));
  const hasSpiderMonkeyEmittedIrEvidence = coverage.spiderMonkeyDiagnostics.emittedIrEvidenceCount > 0;
  const spiderMonkeyDiagnosticDumpAudit = coverage.negativeArtifacts.find(artifact =>
    artifact.sourceArtifact === 'firefox-spidermonkey-diagnostic-dump-audit.json'
  );
  const hasSpiderMonkeyDiagnosticNoDump = spiderMonkeyDiagnosticDumpAudit?.outcome?.status === 'no-dump-emitted';
  const spiderMonkeyJsShellAvailabilityAudit = coverage.negativeArtifacts.find(artifact =>
    artifact.sourceArtifact === 'firefox-spidermonkey-js-shell-availability-audit.json'
  ) ?? coverage.environmentArtifacts.find(artifact =>
    artifact.sourceArtifact === 'firefox-spidermonkey-js-shell-availability-audit.json'
  );
  const hasSpiderMonkeyJsShellAvailabilityAudit = Boolean(spiderMonkeyJsShellAvailabilityAudit);
  const spiderMonkeyReleaseJsShellAvailabilityAudit = coverage.negativeArtifacts.find(artifact =>
    artifact.sourceArtifact === 'firefox-spidermonkey-release-jsshell-availability-audit.json'
  ) ?? coverage.environmentArtifacts.find(artifact =>
    artifact.sourceArtifact === 'firefox-spidermonkey-release-jsshell-availability-audit.json'
  );
  const hasSpiderMonkeyReleaseJsShellAvailabilityAudit = Boolean(spiderMonkeyReleaseJsShellAvailabilityAudit);
  const spiderMonkeyNightlyJsShellAvailabilityAudit = coverage.negativeArtifacts.find(artifact =>
    artifact.sourceArtifact === 'firefox-spidermonkey-nightly-jsshell-availability-audit.json'
  ) ?? coverage.environmentArtifacts.find(artifact =>
    artifact.sourceArtifact === 'firefox-spidermonkey-nightly-jsshell-availability-audit.json'
  );
  const hasSpiderMonkeyNightlyJsShellAvailabilityAudit = Boolean(spiderMonkeyNightlyJsShellAvailabilityAudit);
  const spiderMonkeyJsShellApiGapAudit = coverage.negativeArtifacts.find(artifact =>
    artifact.sourceArtifact === 'firefox-spidermonkey-jsshell-stax-api-gap-audit.json'
  );
  const hasSpiderMonkeyJsShellApiGapAudit = Boolean(spiderMonkeyJsShellApiGapAudit);
  const hasSpiderMonkeyJitSpewSourcePin = coverage.sourcePins.some(pin =>
    pin.sourceArtifact === 'firefox-spidermonkey-jitspew-source-pin-audit.json'
  );
  const spiderMonkeyBuildconfigSourcePin = coverage.sourcePins.find(pin =>
    pin.sourceArtifact === 'firefox-spidermonkey-buildconfig-source-pin-audit.json'
  );
  const hasSpiderMonkeyBuildconfigSourcePin = Boolean(spiderMonkeyBuildconfigSourcePin);
  const hasBunAllocation = (runtimeById.get('bun-jsc')?.allocationArtifacts.length ?? 0) > 0;
  const hasNonV8BrowserAllocation = coverage.allocationArtifacts.some(artifact =>
    artifact.runtimes.some(runtimeId => isBrowserRuntime(runtimeId) && !runtimeId.includes('v8'))
  );
  const hasSafariAvailabilityAudit = coverage.environmentArtifacts.some(artifact =>
    artifact.sourceArtifact === 'safari-webkit-availability-audit.json'
  );
  const remainingCorpusSeeds = Math.max(0, 3 - corpusSeedCount);

  return [
    {
      id: 'firefox-browser-rows-open',
      status: hasFirefoxRows ? 'covered' : 'open',
      evidence: hasFirefoxRows
        ? `${coverage.browser.firefoxBenchmarkRows.length} Firefox/SpiderMonkey browser benchmark rows found.`
        : 'Firefox/SpiderMonkey source pins exist only as source facts; no Firefox browser benchmark rows were found.',
      nextExperiment: hasFirefoxRows
        ? 'Broaden Firefox coverage with corpus/projection rows plus SpiderMonkey codegen and allocation evidence.'
        : 'Wire a Firefox-capable browser harness row under the same full-string byte-batch contract.',
    },
    {
      id: 'safari-jsc-source-and-browser-rows-open',
      status: closesSafariObligation ? 'covered' : hasSafariRows ? 'partial' : 'open',
      evidence: closesSafariObligation
        ? `${coverage.browser.safariBenchmarkRows.length} Safari/WebKit browser benchmark rows found with exact build identity, source-boundary evidence, and bounded primary sync byte-batch full-string rows.`
        : hasSafariRows
          ? [
            `${coverage.browser.safariBenchmarkRows.length} Safari/WebKit browser benchmark rows found, but the obligation is not closed.`,
            `exactBuildIdentityRecorded=${coverage.safariWebKitStatus.exactBuildIdentityRecorded}; sourceBoundaryPinned=${coverage.safariWebKitStatus.sourceBoundaryPinned}; primarySyncByteBatchRows=${coverage.safariWebKitStatus.primarySyncByteBatchRowsRecorded}; boundedPrimarySyncByteBatchRows=${coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsRecorded}; closesSafariObligation=${coverage.safariWebKitStatus.closesSafariObligation}.`,
          ].join(' ')
        : [
          'Bun/JSC and Bun-patched WebKit evidence is present, but no Safari/WebKit browser benchmark row was found.',
          hasSafariAvailabilityAudit ? 'Local Safari/WebKit availability audit is present and records that the current host cannot run Safari rows even though the repository has a safaridriver harness when safaridriver is available.' : 'No local Safari/WebKit availability audit was found.',
        ].join(' '),
      nextExperiment: hasSafariRows && !closesSafariObligation
        ? 'Record exact Safari/WebKit build identity and source-boundary pins for the measured Safari rows, then rerun the coverage audit and counterexample scan.'
        : hasSafariAvailabilityAudit
        ? 'Run same-contract Safari/WebKit rows on a macOS host through the safaridriver wrapper and cross-process stability runner.'
        : 'Pin the exact Safari/WebKit browser build and run same-contract browser rows separately from Bun/JSC.',
    },
    {
      id: 'codegen-traces-open',
      status: hasNodeCodegen && hasBunCodegen && hasChromeCodegen && hasSpiderMonkeyEmittedIrEvidence ? 'covered' : 'partial',
      evidence: [
        hasNodeCodegen ? 'Node/V8 trace evidence present.' : 'Node/V8 trace evidence missing.',
        hasBunCodegen ? 'Bun/JSC codegen/IR evidence present.' : 'Bun/JSC has profiler/source evidence but no codegen/IR artifact.',
        hasChromeCodegen ? 'Chrome/V8 browser codegen trace evidence present.' : 'Chrome/V8 browser codegen trace evidence missing.',
        hasDenoCodegen ? `Deno/V8 codegen trace evidence present (${denoTraceArtifacts.length} artifact${denoTraceArtifacts.length === 1 ? '' : 's'}).` : 'Deno/V8 codegen trace evidence missing.',
        hasSpiderMonkeyProfilerTrace ? 'Firefox/SpiderMonkey Gecko Profiler trace evidence present.' : 'Firefox/SpiderMonkey profiler trace evidence missing.',
        hasSpiderMonkeyJitSpewSourcePin ? 'Firefox/SpiderMonkey JitSpew/IONFLAGS source gate evidence present, but it is not emitted JIT IR.' : 'Firefox/SpiderMonkey JitSpew/IONFLAGS source gate evidence missing.',
        hasSpiderMonkeyBuildconfigSourcePin ? `Firefox/SpiderMonkey installed buildconfig source pin present (${spiderMonkeyBuildconfigSourcePin.limitation}).` : 'Firefox/SpiderMonkey installed buildconfig source pin missing.',
        hasSpiderMonkeyDiagnosticNoDump ? `Firefox/SpiderMonkey diagnostic dump audit was attempted and emitted no JIT diagnostic dump from this installed browser build (status=${spiderMonkeyDiagnosticDumpAudit.outcome.status}, dumpFiles=${spiderMonkeyDiagnosticDumpAudit.outcome.dumpFileCount ?? 'unknown'}).` : 'Firefox/SpiderMonkey diagnostic dump availability audit missing or did not complete as a no-dump result.',
        hasSpiderMonkeyJsShellAvailabilityAudit ? `Firefox/SpiderMonkey local js-shell availability audit present (status=${spiderMonkeyJsShellAvailabilityAudit.outcome?.status ?? 'unknown'}, found=${spiderMonkeyJsShellAvailabilityAudit.outcome?.foundCount ?? 'unknown'}, searchRoots=${spiderMonkeyJsShellAvailabilityAudit.parameters?.searchRoots?.length ?? 0}); no emitted JIT IR is recorded by that audit.` : 'Firefox/SpiderMonkey local js-shell availability audit missing.',
        hasSpiderMonkeyReleaseJsShellAvailabilityAudit ? `Firefox/SpiderMonkey official release js-shell audit present (status=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.status ?? 'unknown'}, packageVerified=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.packageVerified ?? 'unknown'}, jitStatus=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.hasJitExecutionStatus ?? 'unknown'}, irDumpSurface=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.hasIrDumpSurface ?? 'unknown'}, bytecodeDumpOutput=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.hasBytecodeDumpOutput ?? 'unknown'}, bytecodeDumpStatus=${spiderMonkeyReleaseJsShellAvailabilityAudit.shell?.bytecodeDumpProbe?.status ?? 'unknown'}, nativeDisassemblySurface=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.hasNativeDisassemblySurface ?? 'unknown'}, nativeDumpComplete=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.nativeDumpComplete ?? 'unknown'}, canReadBinaryInput=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.canReadBinaryInput ?? 'unknown'}, canRunCurrentStaxFullStringBenchmark=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.canRunCurrentStaxFullStringBenchmark ?? 'unknown'}); it is JIT-status evidence only, not emitted JIT IR.` : 'Firefox/SpiderMonkey official release js-shell audit missing.',
        hasSpiderMonkeyNightlyJsShellAvailabilityAudit ? `Firefox/SpiderMonkey official nightly js-shell audit present (status=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.status ?? 'unknown'}, packageVerified=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.packageVerified ?? 'unknown'}, jitStatus=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.hasJitExecutionStatus ?? 'unknown'}, irDumpSurface=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.hasIrDumpSurface ?? 'unknown'}, bytecodeDumpOutput=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.hasBytecodeDumpOutput ?? 'unknown'}, bytecodeDumpStatus=${spiderMonkeyNightlyJsShellAvailabilityAudit.shell?.bytecodeDumpProbe?.status ?? 'unknown'}, nativeDisassemblySurface=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.hasNativeDisassemblySurface ?? 'unknown'}, nativeDumpComplete=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.nativeDumpComplete ?? 'unknown'}, canReadBinaryInput=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.canReadBinaryInput ?? 'unknown'}, canRunCurrentStaxFullStringBenchmark=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.canRunCurrentStaxFullStringBenchmark ?? 'unknown'}); it is JIT-status evidence only, not emitted JIT IR.` : 'Firefox/SpiderMonkey official nightly js-shell audit missing.',
        hasSpiderMonkeyJsShellApiGapAudit ? `Firefox/SpiderMonkey js-shell StAX API gap audit present (status=${spiderMonkeyJsShellApiGapAudit.summary?.status ?? 'unknown'}, unchangedRunnableShells=${spiderMonkeyJsShellApiGapAudit.summary?.unchangedRunnableShellCount ?? 'unknown'}/${spiderMonkeyJsShellApiGapAudit.summary?.shellCount ?? 'unknown'}, blockedSurfaces=${spiderMonkeyJsShellApiGapAudit.summary?.blockedSurfaceCount ?? 'unknown'}, commonMissingGlobals=${(spiderMonkeyJsShellApiGapAudit.summary?.commonMissingGlobals ?? []).join(', ') || 'none'}); it is host API surface evidence only, not emitted JIT IR.` : 'Firefox/SpiderMonkey js-shell StAX API gap audit missing.',
        hasSpiderMonkeyEmittedIrEvidence ? 'Firefox/SpiderMonkey emitted JIT IR or optimized-code dump evidence present.' : 'Firefox/SpiderMonkey emitted JIT IR or optimized-code dump evidence missing.',
      ].join(' '),
      nextExperiment: 'Capture runtime-specific optimized-code or IR evidence for the fastest full-string rows, especially Firefox/SpiderMonkey and any future Safari/WebKit rows.',
    },
    {
      id: 'allocation-profiles-open',
      status: hasBunAllocation && hasNonV8BrowserAllocation ? 'covered' : 'partial',
      evidence: [
        `${coverage.allocationArtifacts.length} allocation/profile artifacts found.`,
        hasBunAllocation ? 'Bun/JSC allocation evidence present.' : 'Bun/JSC allocation evidence missing.',
        hasNonV8BrowserAllocation ? 'Non-V8 browser allocation evidence present.' : 'Non-V8 browser allocation evidence missing.',
      ].join(' '),
      nextExperiment: 'Add Bun/JSC and non-V8 browser allocation or heap-profile artifacts for the same full-string rows.',
    },
    {
      id: 'non-v8-browser-coverage-open',
      status: hasNonV8BrowserRows ? 'covered' : 'open',
      evidence: hasNonV8BrowserRows
        ? `${coverage.browser.nonV8BenchmarkRows.length} non-V8 browser benchmark rows found.`
        : 'Current browser benchmark rows are Chrome/V8 only; Firefox/SpiderMonkey and Safari/WebKit rows are absent.',
      nextExperiment: hasNonV8BrowserRows
        ? 'Broaden non-V8 browser coverage with Safari/WebKit plus corpus/projection rows and allocation evidence.'
        : 'Run same-contract 1 GiB+ browser rows on at least one non-V8 browser engine.',
    },
    {
      id: 'independent-corpus-suite-open',
      status: corpusSeedCount >= 3 ? 'covered' : 'partial',
      evidence: `${corpusSeedCount} release corpus seed(s) found: ${coverage.corpusSeeds.join(', ') || 'none'}.`,
      nextExperiment: corpusSeedCount >= 3
        ? 'Keep new corpus rows flowing through the counterexample scanner before broadening claims.'
        : `Add at least ${remainingCorpusSeeds} more independent real XML corpus seed(s) before treating corpus coverage as broad.`,
    },
    {
      id: 'counterexample-rule-present',
      status: 'covered',
      evidence: 'runtime-counterexample-scan.md is a required gate artifact and preserves the bounded full-string 200 MiB/s counterexample rule.',
      nextExperiment: 'Keep new rows flowing through the counterexample scanner before broadening claims.',
    },
  ];
}

function createFindings(coverage, obligations) {
  const open = obligations.filter(row => row.status !== 'covered');
  return [
    {
      id: 'coverage-audit-is-not-runtime-limit-proof',
      status: 'SCOPE_GUARD',
      summary: 'Coverage auditing can prove which evidence families are absent or partial, but it cannot prove a JavaScript runtime ceiling.',
    },
    {
      id: 'non-v8-browser-gap-remains',
      status: coverage.browser.nonV8BenchmarkRows.length === 0 ? 'OPEN' : 'COVERED',
      summary: coverage.browser.nonV8BenchmarkRows.length === 0
        ? 'No Firefox/SpiderMonkey or Safari/WebKit browser benchmark rows are present in current release artifacts.'
        : 'At least one non-V8 browser benchmark row is present.',
    },
    {
      id: 'corpus-suite-gap-remains',
      status: coverage.corpusSeeds.length >= 3 ? 'COVERED' : 'PARTIAL',
      summary: `Current release artifacts cover ${coverage.corpusSeeds.length} corpus seed(s), so broad corpus coverage remains unproven.`,
    },
    {
      id: 'open-obligations-ranked',
      status: open.length === 0 ? 'COVERED' : 'OPEN',
      summary: `${open.length} proof obligation(s) remain open or partial after scanning current release artifacts.`,
      evidence: open.map(row => row.id),
    },
  ];
}

function classifySourcePins(sourceArtifact, root) {
  if (sourceArtifact === 'firefox-spidermonkey-textdecoder-source-pin-audit.json') {
    return [{
      runtimeId: 'firefox-spidermonkey-browser',
      kind: 'TextDecoder source boundary',
      revision: root.source?.revision ?? null,
      limitation: 'source pin only; benchmark, codegen, and allocation evidence remain separate',
    }];
  }
  if (sourceArtifact === 'firefox-spidermonkey-string-source-pin-audit.json') {
    return [{
      runtimeId: 'firefox-spidermonkey-browser',
      kind: 'SpiderMonkey JS string source boundary',
      revision: root.source?.revision ?? null,
      limitation: 'source pin only; benchmark, codegen, and allocation evidence remain separate',
    }];
  }
  if (sourceArtifact === 'firefox-spidermonkey-memory-api-source-pin-audit.json') {
    return [{
      runtimeId: 'firefox-spidermonkey-browser',
      kind: 'Firefox page memory API boundary',
      revision: root.runtime?.application?.sourceStamp ?? null,
      limitation: 'negative page API capability evidence; not an allocation profile',
    }];
  }
  if (sourceArtifact === 'firefox-spidermonkey-jitspew-source-pin-audit.json') {
    return [{
      runtimeId: 'firefox-spidermonkey-browser',
      kind: 'SpiderMonkey JitSpew source boundary',
      revision: root.source?.revision ?? null,
      limitation: 'source pin only; not emitted JIT IR or optimized-code proof',
    }];
  }
  if (sourceArtifact === 'firefox-spidermonkey-buildconfig-source-pin-audit.json') {
    return [{
      runtimeId: 'firefox-spidermonkey-browser',
      kind: 'Firefox installed buildconfig JitSpew boundary',
      revision: root.summary?.sourceStamp ?? null,
      limitation: `buildconfig source pin only; enableJitSpew=${Boolean(root.summary?.configureMentionsEnableJitSpew)}, enableJsShell=${Boolean(root.summary?.configureMentionsEnableJsShell)}, mozPackageJsShell=${Boolean(root.summary?.configureMentionsMozPackageJsShell)}`,
    }];
  }
  if (sourceArtifact === 'bun-webkit-textdecoder-source-pin-audit.json' || sourceArtifact === 'bun-jsc-source-pin-audit.json') {
    return [{
      runtimeId: 'bun-jsc',
      kind: 'Bun-patched WebKit source boundary',
      revision: root.source?.revision ?? root.runtime?.webkitCommit ?? null,
      limitation: 'Bun/JSC source evidence; not Safari browser coverage',
    }];
  }
  if (sourceArtifact === 'bun-textdecoder-dispatch-source-pin-audit.json') {
    return [{
      runtimeId: 'bun-jsc',
      kind: 'Bun TextDecoder dispatch source boundary',
      revision: root.source?.revision ?? root.runtime?.bunRevision ?? null,
      limitation: 'Bun dispatch evidence; not WebKit TextDecoder default UTF-8 proof for Safari',
    }];
  }
  if (sourceArtifact === 'deno-textdecoder-source-pin-audit.json') {
    return [{
      runtimeId: 'deno-v8',
      kind: 'Deno TextDecoder source boundary',
      revision: root.source?.revision ?? root.runtime?.denoVersion ?? null,
      limitation: 'Deno/V8 source evidence only; not optimized-code or allocation evidence',
    }];
  }
  if (sourceArtifact === 'chrome-blink-textdecoder-source-pin-audit.json' || sourceArtifact === 'chrome-v8-source-pin-audit.json') {
    return [{
      runtimeId: 'chrome-v8-browser',
      kind: 'Chrome/Blink/V8 source boundary',
      revision: root.source?.revision ?? root.runtime?.v8Version ?? null,
      limitation: 'Chrome/V8 source evidence; not non-V8 browser coverage',
    }];
  }
  if (sourceArtifact === 'node-textdecoder-source-pin-audit.json' || sourceArtifact === 'v8-string-limit-audit.json') {
    return [{
      runtimeId: 'node-v8',
      kind: 'Node/V8 source boundary',
      revision: root.source?.revision ?? root.runtime?.v8Version ?? null,
      limitation: 'Node/V8 source evidence only',
    }];
  }
  return [];
}

function classifyRuntimeFromArtifact(sourceArtifact, root) {
  if (sourceArtifact.startsWith('node-')) return 'node-v8';
  if (sourceArtifact.startsWith('bun-')) return 'bun-jsc';
  if (sourceArtifact.startsWith('deno-')) return 'deno-v8';
  if (sourceArtifact.startsWith('browser-') || sourceArtifact.startsWith('chrome-')) return 'chrome-v8-browser';
  if (sourceArtifact.startsWith('firefox-')) return 'firefox-spidermonkey-browser';
  if (sourceArtifact.startsWith('woodstox-')) return 'woodstox-jvm';
  if (sourceArtifact.startsWith('quick-xml-')) return 'quick-xml-rust';
  if (root.environment) return classifyRuntime(sourceArtifact, root, { environment: root.environment });
  if (/v8|node|candidate-headroom|textdecoder-span|stream-reader|event-reader|monomorphic/.test(sourceArtifact)) return 'node-v8';
  return null;
}

function normalizeEventCount(node) {
  return node.eventCount ?? node.events ?? null;
}

function classifyRuntime(sourceArtifact, node, context) {
  if (node.tool === 'woodstox') return 'woodstox-jvm';
  if (node.tool === 'quick-xml') return 'quick-xml-rust';
  if (typeof node.tool === 'string' && node.tool.startsWith('stax-')) return 'node-v8';
  if (node.id === 'woodstox') return 'woodstox-jvm';
  if (node.id === 'quick-xml') return 'quick-xml-rust';
  if (typeof node.id === 'string' && node.id.startsWith('stax-')) return 'node-v8';
  if (sourceArtifact.startsWith('woodstox-')) return 'woodstox-jvm';
  if (sourceArtifact.startsWith('quick-xml-')) return 'quick-xml-rust';

  const environment = node.environment ?? context.environment ?? {};
  const runtimeName = environment.runtimeName ?? environment.runtime;
  const runtime = node.runtime ?? context.runtime ?? {};
  const browserName = String(environment.browserName ?? '').toLowerCase();
  const engine = String(environment.javascriptEngine ?? '').toLowerCase();

  if (runtimeName === 'bun' || sourceArtifact.startsWith('bun-')) return 'bun-jsc';
  if (runtimeName === 'deno') return 'deno-v8';
  if (runtimeName === 'browser') {
    if (browserName.includes('firefox') || engine.includes('spidermonkey')) return 'firefox-spidermonkey-browser';
    if (browserName.includes('safari') || browserName.includes('webkit') || engine.includes('jsc') || engine.includes('javascriptcore')) return 'safari-jsc-browser';
    return 'chrome-v8-browser';
  }
  if (runtimeName === 'node' || environment.v8) return 'node-v8';
  if (environment.node || environment.nodeVersion) return 'node-v8';
  if (runtime.id === 'node' || runtime.v8) return 'node-v8';
  if (runtime.id === 'bun') return 'bun-jsc';
  if (runtime.id === 'deno') return 'deno-v8';
  if (runtime === 'node') return 'node-v8';
  if (runtime === 'bun') return 'bun-jsc';
  if (runtime === 'deno') return 'deno-v8';
  if (sourceArtifact.startsWith('browser-') || sourceArtifact.startsWith('chrome-')) return 'chrome-v8-browser';
  if (sourceArtifact.startsWith('firefox-')) return 'firefox-spidermonkey-browser';
  return 'unknown';
}

function classifyFullStringParity(node, context) {
  if (node.fullStringParity === true) return true;
  if (node.fullStringParity === false) return false;
  if (node.workload === 'full-string-checksum') return true;
  if (/^(woodstox-|quick-xml-)|^materialization-contract-audit\.json$/.test(context.sourceArtifact ?? '')) return true;
  const id = typeof node.id === 'string' ? node.id : '';
  if (/projection|event-count-only|scan-all-no-decode|scanAllNoDecode|semantic-checksum|SemanticChecksum/i.test(id)) return false;
  if (/full-string|event-full-string|raw-frame|rawFrame|cursor|public-accessor|event-reader-object|stream-(batch|event)/i.test(id)) return true;
  if (typeof node.contractScope === 'string') {
    if (/full-(string|event-object|stax)/i.test(node.contractScope)) return true;
    if (/partial|projection|scan/i.test(node.contractScope)) return false;
  }
  if (typeof node.family === 'string') {
    if (/partial|projection|scan/i.test(node.family)) return false;
    if (/full-stax-js/i.test(node.family)) return true;
  }
  if (typeof context.contract === 'string') {
    if (/full-string|full-object|full-event|full-materialization|complete-js-string/i.test(context.contract)) return true;
    if (/projection/i.test(context.contract)) return false;
  }
  return null;
}

function classifyMemoryKind(node) {
  const memory = node.memory;
  if (
    typeof node.maxRssBytes === 'number'
    || typeof node.peakRssBytes === 'number'
    || typeof node.maxRssMiB === 'number'
    || typeof node.peakRssMiB === 'number'
  ) return 'process-rss';
  if (
    typeof node.maxJsHeapUsedBytes === 'number'
    || typeof node.maxJsHeapUsedMiB === 'number'
    || typeof node.peakJsHeapUsedMiB === 'number'
  ) return 'browser-js-heap';
  if (hasAllocatorCounterMemory(node)) return 'allocator-counters';
  if (!memory || typeof memory !== 'object') return 'not-recorded';
  if (
    memory.scope === 'browser-js-heap'
    || memory.maxJsHeapUsedBytes !== undefined
    || memory.maxJsHeapUsedMiB !== undefined
    || memory.peakJsHeapUsedMiB !== undefined
  ) return 'browser-js-heap';
  if (
    memory.maxRssBytes !== undefined
    || memory.peakRssBytes !== undefined
    || memory.maxRssMiB !== undefined
    || memory.peakRssMiB !== undefined
  ) return 'process-rss';
  return 'recorded-unknown-kind';
}

function hasAllocatorCounterMemory(node) {
  return hasAllocationSummary(node.allocationSummary)
    || hasAllocationSummary(node.phaseAllocationSummary)
    || hasAllocationSummary(node.allocation?.summary)
    || hasAllocationSummary(node.memory?.allocationSummary)
    || hasAllocationSamples(node.allocationSamples)
    || hasAllocationSamples(node.phaseAllocationSamples)
    || hasAllocationSamples(node.allocation?.samples);
}

function hasAllocationSummary(value) {
  if (!value || typeof value !== 'object') return false;
  return typeof value.totalAllocatedBytes === 'number'
    || typeof value.netAllocatedBytes === 'number'
    || typeof value.allocationOperations === 'number'
    || typeof value.allocBytes === 'number'
    || typeof value.allocCount === 'number';
}

function hasAllocationSamples(value) {
  return Array.isArray(value) && value.length > 0;
}

function classifyBoundedMemory(node, memoryKind) {
  if (typeof node.boundedMemory === 'boolean') return node.boundedMemory;
  const peakBytes = extractPeakMemoryBytes(node, memoryKind);
  if (typeof peakBytes !== 'number') return null;
  return peakBytes <= 512 * MIB;
}

function extractPeakMemoryBytes(node, memoryKind) {
  if (memoryKind === 'process-rss') {
    if (typeof node.maxRssBytes === 'number') return node.maxRssBytes;
    if (typeof node.peakRssBytes === 'number') return node.peakRssBytes;
    if (typeof node.maxRssMiB === 'number') return node.maxRssMiB * MIB;
    if (typeof node.peakRssMiB === 'number') return node.peakRssMiB * MIB;
    if (typeof node.memory?.maxRssBytes === 'number') return node.memory.maxRssBytes;
    if (typeof node.memory?.peakRssBytes === 'number') return node.memory.peakRssBytes;
    if (typeof node.memory?.maxRssMiB === 'number') return node.memory.maxRssMiB * MIB;
    if (typeof node.memory?.peakRssMiB === 'number') return node.memory.peakRssMiB * MIB;
  }
  if (memoryKind === 'browser-js-heap') {
    if (typeof node.maxJsHeapUsedBytes === 'number') return node.maxJsHeapUsedBytes;
    if (typeof node.maxJsHeapUsedMiB === 'number') return node.maxJsHeapUsedMiB * MIB;
    if (typeof node.peakJsHeapUsedMiB === 'number') return node.peakJsHeapUsedMiB * MIB;
    if (typeof node.memory?.maxJsHeapUsedBytes === 'number') return node.memory.maxJsHeapUsedBytes;
    if (typeof node.memory?.maxJsHeapUsedMiB === 'number') return node.memory.maxJsHeapUsedMiB * MIB;
    if (typeof node.memory?.peakJsHeapUsedMiB === 'number') return node.memory.peakJsHeapUsedMiB * MIB;
  }
  return null;
}

function normalizeFixture(fixture) {
  if (!fixture || typeof fixture !== 'object') return null;
  const actualBytes = numberOrNull(fixture.actualBytes ?? fixture.sizeBytes ?? fixture.byteLength);
  const sizeGiB = numberOrNull(fixture.sizeGiB) ?? (actualBytes !== null ? actualBytes / GIB : null);
  const sizeMiB = numberOrNull(fixture.sizeMiB) ?? (actualBytes !== null ? actualBytes / MIB : null);
  return {
    source: fixture.source ?? null,
    shape: fixture.shape ?? null,
    sourceFile: fixture.sourceFile ?? fixture.file ?? null,
    sizeGiB: round(sizeGiB),
    sizeMiB: round(sizeMiB),
    actualBytes,
  };
}

function summarizeEnvironment(environment = {}) {
  return {
    runtimeName: environment.runtimeName ?? null,
    browserName: environment.browserName ?? null,
    browserVersion: environment.browserVersion ?? null,
    javascriptEngine: environment.javascriptEngine ?? null,
    v8: environment.v8 ?? null,
    webkitCommit: environment.webkitCommit ?? null,
  };
}

function summarizeOutcome(outcome = {}) {
  if (!outcome || typeof outcome !== 'object') return null;
  const summary = {
    status: outcome.status ?? null,
    completed: typeof outcome.completed === 'boolean' ? outcome.completed : null,
    emittedDump: typeof outcome.emittedDump === 'boolean' ? outcome.emittedDump : null,
    dumpFileCount: typeof outcome.dumpFileCount === 'number' ? outcome.dumpFileCount : null,
    foundCount: typeof outcome.foundCount === 'number' ? outcome.foundCount : null,
    foundCandidates: Array.isArray(outcome.foundCandidates) ? outcome.foundCandidates : null,
    packageVerified: typeof outcome.packageVerified === 'boolean' ? outcome.packageVerified : null,
    hasJitExecutionStatus: typeof outcome.hasJitExecutionStatus === 'boolean' ? outcome.hasJitExecutionStatus : null,
    hasIrDumpSurface: typeof outcome.hasIrDumpSurface === 'boolean' ? outcome.hasIrDumpSurface : null,
    hasBytecodeDumpOutput: typeof outcome.hasBytecodeDumpOutput === 'boolean' ? outcome.hasBytecodeDumpOutput : null,
    hasNativeDisassemblySurface: typeof outcome.hasNativeDisassemblySurface === 'boolean' ? outcome.hasNativeDisassemblySurface : null,
    nativeDumpComplete: typeof outcome.nativeDumpComplete === 'boolean' ? outcome.nativeDumpComplete : null,
    canReadBinaryInput: typeof outcome.canReadBinaryInput === 'boolean' ? outcome.canReadBinaryInput : null,
    canRunCurrentStaxFullStringBenchmark: typeof outcome.canRunCurrentStaxFullStringBenchmark === 'boolean' ? outcome.canRunCurrentStaxFullStringBenchmark : null,
    closesEmittedIrObligation: typeof outcome.closesEmittedIrObligation === 'boolean' ? outcome.closesEmittedIrObligation : null,
  };
  return Object.values(summary).some(value => value !== null) ? summary : null;
}

function summarizeShell(shell = {}) {
  if (!shell || typeof shell !== 'object') return null;
  const bytecodeDumpProbe = shell.bytecodeDumpProbe && typeof shell.bytecodeDumpProbe === 'object'
    ? {
        status: shell.bytecodeDumpProbe.status ?? null,
        bytecodeMarkerCount: typeof shell.bytecodeDumpProbe.bytecodeMarkerCount === 'number'
          ? shell.bytecodeDumpProbe.bytecodeMarkerCount
          : null,
      }
    : null;
  if (!bytecodeDumpProbe) return null;
  return { bytecodeDumpProbe };
}

function summarizeArtifact(artifact) {
  return {
    sourceArtifact: artifact.sourceArtifact,
    objective: artifact.objective,
    contract: artifact.contract,
    evidenceKinds: artifact.evidenceKinds,
    runtimes: artifact.runtimes,
    parameters: artifact.parameters,
    availability: artifact.availability,
    outcome: artifact.outcome,
    ...(artifact.summary ? { summary: artifact.summary } : {}),
    shell: artifact.shell,
    fixture: artifact.fixture,
    corpusSeed: artifact.corpusSeed,
    measuredRowCount: artifact.measuredRows.length,
  };
}

function summarizeRows(rows) {
  return rows.map(summarizeRow).filter(Boolean);
}

function summarizeRow(row) {
  if (!row) return null;
  return {
    sourceArtifact: row.sourceArtifact,
    id: row.id,
    runtimeId: row.runtimeId,
    runtimeLabel: row.runtimeLabel,
    sizeGiB: row.sizeGiB,
    fixtureSource: row.fixtureSource,
    fixtureShape: row.fixtureShape,
    corpusSeed: row.corpusSeed,
    mibPerSec: row.mibPerSec,
    fullStringParity: row.fullStringParity,
    boundedMemory: row.boundedMemory,
    memoryKind: row.memoryKind,
    eventCount: row.eventCount,
    checksum: row.checksum,
    contractScope: row.contractScope,
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Runtime Proof Coverage Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This audit scans current release artifacts to show which proof obligations are covered, partial, or still open. It is not a new benchmark run and not an impossibility proof.',
    '',
    '## Summary',
    '',
    `- Scanned primary artifacts: ${report.summary.scannedArtifactCount}`,
    `- Ignored derived artifacts: ${report.summary.ignoredArtifactCount}`,
    `- Measured rows recognized: ${report.summary.measuredRowCount}`,
    `- Rows with unknown full-string parity: ${report.summary.rowClassificationCompleteness.unknownFullStringParityRows}`,
    `- Rows with unknown bounded-memory flag: ${report.summary.rowClassificationCompleteness.unknownBoundedMemoryRows}`,
    `  - Unknown bounded-memory JS rows: ${report.summary.unknownBoundedMemoryBreakdown.jsRows}`,
    `  - Unknown bounded-memory full-string rows: ${report.summary.unknownBoundedMemoryBreakdown.fullStringRows}`,
    `  - Unknown bounded-memory 1 GiB+ JS full-string rows: ${report.summary.unknownBoundedMemoryBreakdown.largeJsFullStringRows}`,
    `  - Unknown bounded-memory counterexample-relevant rows: ${report.summary.unknownBoundedMemoryBreakdown.counterexampleRelevantRows}`,
    `  - Unknown bounded-memory small/diagnostic JS rows: ${report.summary.unknownBoundedMemoryBreakdown.smallOrDiagnosticJsRows}`,
    `  - Unknown bounded-memory non-JS allocator-counter rows: ${report.summary.unknownBoundedMemoryBreakdown.nonJsAllocatorCounterRows}`,
    `  - Unknown bounded-memory non-JS rows without peak-memory counters: ${report.summary.unknownBoundedMemoryBreakdown.nonJsNoPeakMemoryRows}`,
    `  - Unknown bounded-memory rows with memory counters: ${report.summary.unknownBoundedMemoryBreakdown.rowsWithMemoryCounter}`,
    `- Benchmark artifacts: ${report.summary.benchmarkArtifactCount}`,
    `- Source artifacts: ${report.summary.sourceArtifactCount}`,
    `- Trace/profile artifacts: ${report.summary.traceArtifactCount}`,
    `- Allocation artifacts: ${report.summary.allocationArtifactCount}`,
    `- Environment artifacts: ${report.summary.environmentArtifactCount}`,
    `- Negative-result artifacts: ${report.summary.negativeArtifactCount}`,
    `- 1 GiB+ JS full-string rows: ${report.summary.largeJsFullRowCount}`,
    `- 1 GiB+ JS full-string source-mode rows not using full ArrayBuffer parser input: ${report.summary.largeJsFullSourceInputSafety.notFullArrayBufferRows}/${report.summary.largeJsFullSourceInputSafety.sourceModeRows}`,
    `- 1 GiB+ JS full-string separate direct ReadableStream source-overhead rows: ${report.summary.largeJsFullSourceInputSafety.directReadableStreamRows}`,
    `- Corpus seeds: ${report.summary.corpusSeedCount}`,
    `- Open or partial obligations: ${report.summary.openObligationCount}`,
    '',
  ];

  if (report.parseErrors.length > 0) {
    lines.push('## Parse Errors', '');
    for (const error of report.parseErrors) {
      lines.push(`- ${error.file}: ${error.message}`);
    }
    lines.push('');
  }

  lines.push(
    '## Unknown Bounded-Memory Rows',
    '',
    'These rows have enough throughput/parity metadata to be recognized, but no row-level memory counter or bounded-memory flag. They are listed so remaining unknowns are auditable rather than only counted. The counterexample-relevant subset is 1 GiB+ JavaScript full-string rows, and is summarized separately above.',
    '',
    '| Artifact | Runtime | Row | Size GiB | Memory | Full string | MiB/s |',
    '| --- | --- | --- | ---: | --- | --- | ---: |',
  );
  if (report.unknownBoundedMemoryRows.length === 0) {
    lines.push('| none | | | | | | |');
  } else {
    for (const row of report.unknownBoundedMemoryRows) {
      lines.push(`| \`${row.sourceArtifact}\` | ${row.runtimeLabel} | \`${row.id}\` | ${formatNumber(row.sizeGiB)} | ${row.memoryKind} | ${formatBoolean(row.fullStringParity)} | ${formatNumber(row.mibPerSec)} |`);
    }
  }
  lines.push('');

  lines.push(
    '## Source Input Safety',
    '',
    'This classifies the parser input shape for 1 GiB+ JavaScript full-string rows that expose source-mode metadata. Direct ReadableStream rows remain source-overhead evidence, separate from the primary synchronous byte-batch baseline.',
    '',
    '| Source mode | Rows | Not full ArrayBuffer | Full ArrayBuffer | Unknown | Direct ReadableStream | Demand-driven | Fastest row |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  );
  if (report.summary.largeJsFullSourceInputSafety.sourceModeBreakdown.length === 0) {
    lines.push('| none | 0 | 0 | 0 | 0 | 0 | 0 | n/a |');
  } else {
    for (const row of report.summary.largeJsFullSourceInputSafety.sourceModeBreakdown) {
      lines.push(sourceInputSafetyMarkdownRow(row));
    }
  }
  lines.push('');

  lines.push(
    '## Runtime Coverage',
    '',
    '| Runtime | Artifacts | Measured Rows | 1 GiB+ Full Rows | Fastest 1 GiB+ Full Row | Source Pins | Trace/Profile | Allocation |',
    '| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |',
  );
  for (const row of report.coverage.runtimes) {
    lines.push(`| ${row.runtimeLabel} | ${row.artifactCount} | ${row.measuredRowCount} | ${row.largeFullStringRowCount} | ${formatFastest(row.fastestLargeFullStringRow)} | ${row.sourcePins.length} | ${row.traceArtifacts.length} | ${row.allocationArtifacts.length} |`);
  }

  lines.push(
    '',
    '## Safari/WebKit Browser Row Status',
    '',
    `Safari/WebKit evidence class: ${report.coverage.safariWebKitStatus.evidenceClass}`,
    `Safari/WebKit obligation closed: ${formatBoolean(report.coverage.safariWebKitStatus.closesSafariObligation)}`,
    '',
    '| Availability artifact | macOS host | Safari executable | safaridriver | Harness support | Runnable here | Browser rows | Full rows | Primary sync rows | Bounded primary rows | Exact build identity | Source boundary pinned |',
    '| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |',
    `| ${formatOptionalArtifact(report.coverage.safariWebKitStatus.availabilityArtifact)} | ${formatBoolean(report.coverage.safariWebKitStatus.hostIsMacOS)} | ${formatBoolean(report.coverage.safariWebKitStatus.safariExecutableFound)} | ${formatBoolean(report.coverage.safariWebKitStatus.safaridriverFound)} | ${formatBoolean(report.coverage.safariWebKitStatus.harnessSupportsSafari)} | ${formatBoolean(report.coverage.safariWebKitStatus.canRunSafariBrowserRows)} | ${report.coverage.safariWebKitStatus.benchmarkRowsRecorded} | ${report.coverage.safariWebKitStatus.fullStringRowsRecorded} | ${report.coverage.safariWebKitStatus.primarySyncByteBatchRowsRecorded} | ${report.coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsRecorded} | ${formatBoolean(report.coverage.safariWebKitStatus.exactBuildIdentityRecorded)} | ${formatBoolean(report.coverage.safariWebKitStatus.sourceBoundaryPinned)} |`,
  );

  lines.push(
    '',
    '## SpiderMonkey Diagnostic Surface',
    '',
    `Emitted SpiderMonkey IR/codegen evidence artifacts: ${report.coverage.spiderMonkeyDiagnostics.emittedIrEvidenceCount}`,
    `JIT-status-only SpiderMonkey shell artifacts: ${report.coverage.spiderMonkeyDiagnostics.jitStatusOnlyCount}`,
    '',
    '| Diagnostic | Artifact | Status | Evidence class | JIT status | IR surface | Bytecode dump | Native dump complete | Current stax benchmark | Closes emitted IR obligation |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const row of report.coverage.spiderMonkeyDiagnostics.rows) {
    lines.push(`| \`${row.id}\` | \`${row.sourceArtifact}\` | ${row.status} | ${row.evidenceClass} | ${formatBoolean(row.hasJitExecutionStatus)} | ${formatBoolean(row.irDumpSurface)} | ${formatBytecodeDump(row)} | ${formatBoolean(row.nativeDumpComplete)} | ${formatBoolean(row.canRunCurrentStaxFullStringBenchmark)} | ${formatBoolean(row.closesEmittedIrObligation)} |`);
  }

  lines.push(
    '',
    '## Open Obligations',
    '',
    '| Obligation | Status | Evidence | Next experiment |',
    '| --- | --- | --- | --- |',
  );
  for (const row of report.obligations) {
    lines.push(`| \`${row.id}\` | ${row.status} | ${escapePipe(row.evidence)} | ${escapePipe(row.nextExperiment)} |`);
  }

  lines.push(
    '',
    '## Corpus Coverage',
    '',
    `Current release corpus seeds: ${report.coverage.corpusSeeds.length === 0 ? 'none' : report.coverage.corpusSeeds.map(seed => `\`${seed}\``).join(', ')}.`,
    '',
    '## Browser Coverage',
    '',
    `- Chrome/V8 browser benchmark rows: ${report.coverage.browser.chromeBenchmarkRows.length}`,
    `- Firefox/SpiderMonkey browser benchmark rows: ${report.coverage.browser.firefoxBenchmarkRows.length}`,
    `- Safari/WebKit browser benchmark rows: ${report.coverage.browser.safariBenchmarkRows.length}`,
    `- Non-V8 browser benchmark rows: ${report.coverage.browser.nonV8BenchmarkRows.length}`,
    '',
    report.coverage.browser.firefoxBenchmarkRows.length > 0
      ? 'Firefox benchmark rows and exact tested-build JS string, TextDecoder, and page memory API source pins are now present, but Firefox codegen/allocation evidence remains a separate gap. Safari/browser JSC is still not covered by Bun/JSC.'
      : 'Firefox source pin without benchmark rows and Safari/browser JSC not covered by Bun/JSC remain explicit gaps.',
    '',
    '## Findings',
    '',
  );
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.status}): ${finding.summary}`);
    for (const evidence of finding.evidence ?? []) {
      lines.push(`  - ${evidence}`);
    }
  }

  lines.push(
    '',
    '## Limits',
    '',
    '- This audit only checks evidence coverage in current release artifacts. It does not measure new throughput or memory.',
    '- Source pins without same-runtime benchmark rows are treated as source-only evidence.',
    '- Bun/JSC evidence is not Safari/browser JSC evidence unless the tested browser build and rows are recorded separately.',
    '- Missing evidence is not evidence that optimization is impossible; it is a queue for counterexample search.',
  );

  return `${lines.join('\n')}\n`;
}

function runtimeLabel(runtimeId) {
  switch (runtimeId) {
    case 'node-v8':
      return 'Node/V8';
    case 'bun-jsc':
      return 'Bun/JSC';
    case 'deno-v8':
      return 'Deno/V8';
    case 'chrome-v8-browser':
      return 'Chrome/V8 browser';
    case 'firefox-spidermonkey-browser':
      return 'Firefox/SpiderMonkey browser';
    case 'safari-jsc-browser':
      return 'Safari/WebKit browser';
    case 'woodstox-jvm':
      return 'Java/Woodstox';
    case 'quick-xml-rust':
      return 'Rust/quick-xml';
    default:
      return runtimeId ?? 'unknown';
  }
}

function isJsRuntime(runtimeId) {
  return ['node-v8', 'bun-jsc', 'deno-v8', 'chrome-v8-browser', 'firefox-spidermonkey-browser', 'safari-jsc-browser'].includes(runtimeId);
}

function isBrowserRuntime(runtimeId) {
  return ['chrome-v8-browser', 'firefox-spidermonkey-browser', 'safari-jsc-browser'].includes(runtimeId);
}

function normalizeCorpusSeed(sourceFile) {
  return basename(String(sourceFile).replaceAll('\\', '/'));
}

function compareRuntimeIds(left, right) {
  const leftIndex = runtimeOrder.indexOf(left);
  const rightIndex = runtimeOrder.indexOf(right);
  return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex)
    || left.localeCompare(right);
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

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function groupBy(values, keyOf) {
  const groups = new Map();
  for (const value of values) {
    const key = keyOf(value);
    const group = groups.get(key);
    if (group) {
      group.push(value);
    } else {
      groups.set(key, [value]);
    }
  }
  return groups;
}

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive number.`);
  return parsed;
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function round(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function formatFastest(row) {
  if (!row) return 'none';
  return `${row.id} ${formatNumber(row.mibPerSec)} MiB/s from ${row.sourceArtifact}`;
}

function sourceInputSafetyMarkdownRow(entry) {
  return `| \`${entry.sourceMode}\` | ${entry.rows} | ${entry.notFullArrayBufferRows} | ${entry.fullArrayBufferRows} | ${entry.unknownArrayBufferRows} | ${entry.directReadableStreamRows} | ${entry.demandDrivenRows} | ${formatFastest(entry.fastestRow)} |`;
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function formatOptionalArtifact(sourceArtifact) {
  return sourceArtifact ? `\`${sourceArtifact}\`` : 'none';
}

function formatBoolean(value) {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return 'unknown';
}

function formatBytecodeDump(row) {
  if (row.bytecodeDumpOutput === true) return `yes (${row.bytecodeDumpStatus ?? 'unknown'}, markers=${row.bytecodeDumpMarkers ?? 'unknown'})`;
  if (row.bytecodeDumpOutput === false) return `no (${row.bytecodeDumpStatus ?? 'unknown'}, markers=${row.bytecodeDumpMarkers ?? 'unknown'})`;
  return 'unknown';
}

function escapePipe(value) {
  return String(value).replaceAll('|', '\\|');
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(`runtime-proof-coverage-audit: artifacts=${report.summary.scannedArtifactCount} open=${report.summary.openObligationCount}`);
}

main();
