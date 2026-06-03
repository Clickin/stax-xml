import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultReleaseDir = resolve(__dirname, 'results', 'release');
const defaultJsonOut = resolve(defaultReleaseDir, 'runtime-proof-coverage-audit.json');
const defaultMdOut = resolve(defaultReleaseDir, 'runtime-proof-coverage-audit.md');
const safariAcceptedClosureCaseIds = new Set(['stringFull', 'eventObjectFull', 'rawFrameNameId']);

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
  'spidermonkey-jsshell',
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
    thresholdMiBPerSec: 200,
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
      case '--threshold-mib-per-sec':
        options.thresholdMiBPerSec = parsePositiveNumber(readValue(), name);
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
  let sameContractComparisonRows = [];

  for (const file of artifactFiles) {
    if (ignoredArtifacts.has(file)) {
      ignored.push(file);
      if (file === 'same-contract-runtime-comparison.json') {
        try {
          const root = JSON.parse(readFileSync(join(options.releaseDir, file), 'utf8'));
          sameContractComparisonRows = extractSameContractComparisonRows(root);
        } catch (error) {
          parseErrors.push({ file, message: error?.message ?? String(error) });
        }
      }
      continue;
    }
    try {
      const root = JSON.parse(readFileSync(join(options.releaseDir, file), 'utf8'));
      artifacts.push(createArtifactRecord(file, root, options));
    } catch (error) {
      parseErrors.push({ file, message: error?.message ?? String(error) });
    }
  }

  const coverage = createCoverage(artifacts, options, sameContractComparisonRows);
  const obligations = createObligationRows(coverage);
  const unknownBoundedMemoryRows = artifacts
    .flatMap(artifact => artifact.measuredRows)
    .filter(row => row.boundedMemory === null)
    .map(row => summarizeUnknownBoundedMemoryRow(row, options));
  const unknownFullStringParityRows = artifacts
    .flatMap(artifact => artifact.measuredRows)
    .filter(row => row.fullStringParity === null)
    .map(row => summarizeUnknownFullStringParityRow(row, options));
  const summary = {
    scannedArtifactCount: artifacts.length,
    ignoredArtifactCount: ignored.length,
    parseErrorCount: parseErrors.length,
    measuredRowCount: sum(artifacts.map(artifact => artifact.measuredRows.length)),
    rowClassificationCompleteness: summarizeRowClassificationCompleteness(artifacts.flatMap(artifact => artifact.measuredRows)),
    unknownFullStringParityBreakdown: summarizeUnknownFullStringParityRows(artifacts.flatMap(artifact => artifact.measuredRows), options),
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
      thresholdMiBPerSec: options.thresholdMiBPerSec,
    },
    scannedArtifacts: artifacts.map(artifact => summarizeArtifact(artifact)),
    ignoredArtifacts: ignored,
    parseErrors,
    summary,
    coverage,
    obligations,
    unknownFullStringParityRows,
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
    summary: summarizeArtifactSummary(root.summary, root.inputs, root.closestBlockedCandidates),
    availability: summarizeAvailability(root.summary, root.closureMatrix),
    outcome: summarizeOutcome(root.outcome),
    shell: summarizeShell(root.shell),
    hostApiSurface: summarizeHostApiSurface(root.hostApiSurface),
    asciiScopeDistance: summarizeAsciiScopeDistance(root.asciiScopeDistance),
    fixture,
    corpusSeed,
    measuredRows,
    sourcePins: classifySourcePins(sourceArtifact, root),
  };
}

function summarizeArtifactSummary(summary, inputs = {}, closestBlockedCandidates = []) {
  if (!summary || typeof summary !== 'object') return null;
  const closestBlockedCandidateSourceArtifacts = Array.isArray(closestBlockedCandidates)
    ? closestBlockedCandidates
        .map(candidate => candidate?.sourceArtifact)
        .filter(value => typeof value === 'string')
    : [];
  const closestBlockedCandidateRequirementSets = Array.isArray(closestBlockedCandidates)
    ? closestBlockedCandidates
        .map(candidate => ({
          sourceArtifact: typeof candidate?.sourceArtifact === 'string' ? candidate.sourceArtifact : null,
          unmetRequirements: Array.isArray(candidate?.unmetRequirements)
            ? uniqueStrings(candidate.unmetRequirements)
            : [],
        }))
        .filter(candidate => candidate.sourceArtifact && candidate.unmetRequirements.length > 0)
    : [];
  const result = {
    status: summary.status ?? null,
    shellCount: typeof summary.shellCount === 'number' ? summary.shellCount : null,
    availableShellCount: typeof summary.availableShellCount === 'number' ? summary.availableShellCount : null,
    jitStatusShellCount: typeof summary.jitStatusShellCount === 'number' ? summary.jitStatusShellCount : null,
    binaryReadableShellCount: typeof summary.binaryReadableShellCount === 'number' ? summary.binaryReadableShellCount : null,
    unchangedRunnableShellCount: typeof summary.unchangedRunnableShellCount === 'number' ? summary.unchangedRunnableShellCount : null,
    commonMissingGlobals: Array.isArray(summary.commonMissingGlobals) ? summary.commonMissingGlobals : null,
    primarySyncByteBatchMissingGlobals: Array.isArray(summary.primarySyncByteBatchMissingGlobals)
      ? summary.primarySyncByteBatchMissingGlobals
      : null,
    nonPrimaryHarnessMissingGlobals: Array.isArray(summary.nonPrimaryHarnessMissingGlobals)
      ? summary.nonPrimaryHarnessMissingGlobals
      : null,
    blockedSurfaceCount: typeof summary.blockedSurfaceCount === 'number' ? summary.blockedSurfaceCount : null,
    directUnchangedHarnessAttemptCount: typeof summary.directUnchangedHarnessAttemptCount === 'number'
      ? summary.directUnchangedHarnessAttemptCount
      : null,
    blockedDirectUnchangedHarnessAttemptCount: typeof summary.blockedDirectUnchangedHarnessAttemptCount === 'number'
      ? summary.blockedDirectUnchangedHarnessAttemptCount
      : null,
    runnableDirectUnchangedHarnessAttemptCount: typeof summary.runnableDirectUnchangedHarnessAttemptCount === 'number'
      ? summary.runnableDirectUnchangedHarnessAttemptCount
      : null,
    canCloseEmittedIrObligation: typeof summary.canCloseEmittedIrObligation === 'boolean'
      ? summary.canCloseEmittedIrObligation
      : null,
    semanticEquivalentForAsciiFields: typeof summary.semanticEquivalentForAsciiFields === 'boolean'
      ? summary.semanticEquivalentForAsciiFields
      : null,
    allCorpusFilesAscii: typeof summary.allCorpusFilesAscii === 'boolean'
      ? summary.allCorpusFilesAscii
      : null,
    corpusFileCount: typeof summary.corpusFileCount === 'number'
      ? summary.corpusFileCount
      : null,
    asciiByteToStringEquivalentToUtf8: typeof summary.asciiByteToStringEquivalentToUtf8 === 'boolean'
      ? summary.asciiByteToStringEquivalentToUtf8
      : null,
    semanticMaterializedWorkload: typeof summary.semanticMaterializedWorkload === 'boolean'
      ? summary.semanticMaterializedWorkload
      : null,
    reducesScopeDistance: typeof summary.reducesScopeDistance === 'boolean'
      ? summary.reducesScopeDistance
      : null,
    closesCodegenObligation: typeof summary.closesCodegenObligation === 'boolean'
      ? summary.closesCodegenObligation
      : null,
    closureRequirementsMet: typeof summary.closureRequirementsMet === 'number'
      ? summary.closureRequirementsMet
      : null,
    closureRequirementsBlocked: typeof summary.closureRequirementsBlocked === 'number'
      ? summary.closureRequirementsBlocked
      : null,
    pairCount: typeof summary.pairCount === 'number'
      ? summary.pairCount
      : null,
    reproduciblePairs: typeof summary.reproduciblePairs === 'number'
      ? summary.reproduciblePairs
      : null,
    sameTaskclusterBuildPairs: typeof summary.sameTaskclusterBuildPairs === 'number'
      ? summary.sameTaskclusterBuildPairs
      : null,
    sameCodegenMarkerPairs: typeof summary.sameCodegenMarkerPairs === 'number'
      ? summary.sameCodegenMarkerPairs
      : null,
    candidateCount: typeof summary.candidateCount === 'number'
      ? summary.candidateCount
      : null,
    acceptedClosureCaseRows: typeof summary.acceptedClosureCaseRows === 'number'
      ? summary.acceptedClosureCaseRows
      : null,
    candidateSourceArtifacts: Array.isArray(summary.candidateSourceArtifacts)
      ? uniqueStrings(summary.candidateSourceArtifacts)
      : null,
    qualifiedClosureCount: typeof summary.qualifiedClosureCount === 'number'
      ? summary.qualifiedClosureCount
      : null,
    profiledFullStringParityCount: typeof summary.profiledFullStringParityCount === 'number'
      ? summary.profiledFullStringParityCount
      : null,
    rowLevelSourceBoundaryPinnedRows: typeof summary.rowLevelSourceBoundaryPinnedRows === 'number'
      ? summary.rowLevelSourceBoundaryPinnedRows
      : null,
    selectedRowComparisonMatchCount: typeof summary.selectedRowComparisonMatchCount === 'number'
      ? summary.selectedRowComparisonMatchCount
      : null,
    selectedRowComparisonMismatchCount: typeof summary.selectedRowComparisonMismatchCount === 'number'
      ? summary.selectedRowComparisonMismatchCount
      : null,
    selectedRowComparisonMissingCount: typeof summary.selectedRowComparisonMissingCount === 'number'
      ? summary.selectedRowComparisonMissingCount
      : null,
    comparisonGeneratedAt: typeof inputs?.comparisonGeneratedAt === 'string'
      ? inputs.comparisonGeneratedAt
      : null,
    comparisonRowCount: typeof inputs?.comparisonRowCount === 'number'
      ? inputs.comparisonRowCount
      : null,
    minimumBlockedRequirementCount: typeof summary.minimumBlockedRequirementCount === 'number'
      ? summary.minimumBlockedRequirementCount
      : null,
    closestBlockedCandidateCount: typeof summary.closestBlockedCandidateCount === 'number'
      ? summary.closestBlockedCandidateCount
      : null,
    diagnosticThroughputMiBPerSec: typeof summary.diagnosticThroughputMiBPerSec === 'number'
      ? summary.diagnosticThroughputMiBPerSec
      : null,
    diagnosticThroughputClass: typeof summary.diagnosticThroughputClass === 'string'
      ? summary.diagnosticThroughputClass
      : null,
    throughputCountsAsTargetEvidence: typeof summary.throughputCountsAsTargetEvidence === 'boolean'
      ? summary.throughputCountsAsTargetEvidence
      : null,
    primarySyncByteBatchRequiresTextDecoder: typeof summary.primarySyncByteBatchRequiresTextDecoder === 'boolean'
      ? summary.primarySyncByteBatchRequiresTextDecoder
      : null,
    asciiPrimarySyncByteBatchRequiresTextDecoder: typeof summary.asciiPrimarySyncByteBatchRequiresTextDecoder === 'boolean'
      ? summary.asciiPrimarySyncByteBatchRequiresTextDecoder
      : null,
    utf8FallbackDecoder: typeof summary.utf8FallbackDecoder === 'boolean'
      ? summary.utf8FallbackDecoder
      : null,
    nonUtf8RequiresTextDecoder: typeof summary.nonUtf8RequiresTextDecoder === 'boolean'
      ? summary.nonUtf8RequiresTextDecoder
      : null,
    nativeTextDecoderPreferredWhenAvailable: typeof summary.nativeTextDecoderPreferredWhenAvailable === 'boolean'
      ? summary.nativeTextDecoderPreferredWhenAvailable
      : null,
    directReadableStreamRequiresReadableStream: typeof summary.directReadableStreamRequiresReadableStream === 'boolean'
      ? summary.directReadableStreamRequiresReadableStream
      : null,
    stringInputRequiresTextEncoder: typeof summary.stringInputRequiresTextEncoder === 'boolean'
      ? summary.stringInputRequiresTextEncoder
      : null,
    eventReaderSyncDocumentStringInputRequiresTextEncoder: typeof summary.eventReaderSyncDocumentStringInputRequiresTextEncoder === 'boolean'
      ? summary.eventReaderSyncDocumentStringInputRequiresTextEncoder
      : null,
    xmlObjectStringInputRequiresTextEncoder: typeof summary.xmlObjectStringInputRequiresTextEncoder === 'boolean'
      ? summary.xmlObjectStringInputRequiresTextEncoder
      : null,
    projectionCompileAndStringInputRequiresTextEncoder: typeof summary.projectionCompileAndStringInputRequiresTextEncoder === 'boolean'
      ? summary.projectionCompileAndStringInputRequiresTextEncoder
      : null,
    compiledConverterStringInputRequiresTextEncoder: typeof summary.compiledConverterStringInputRequiresTextEncoder === 'boolean'
      ? summary.compiledConverterStringInputRequiresTextEncoder
      : null,
    rootImportRequiresTextEncoder: typeof summary.rootImportRequiresTextEncoder === 'boolean'
      ? summary.rootImportRequiresTextEncoder
      : null,
    asyncWriterOutputRequiresTextEncoder: typeof summary.asyncWriterOutputRequiresTextEncoder === 'boolean'
      ? summary.asyncWriterOutputRequiresTextEncoder
      : null,
    syncWriterOutputRequiresTextEncoder: typeof summary.syncWriterOutputRequiresTextEncoder === 'boolean'
      ? summary.syncWriterOutputRequiresTextEncoder
      : null,
    alternateDecoderWouldBeUnchangedClosure: typeof summary.alternateDecoderWouldBeUnchangedClosure === 'boolean'
      ? summary.alternateDecoderWouldBeUnchangedClosure
      : null,
    conclusionAllowed: typeof summary.conclusionAllowed === 'boolean' ? summary.conclusionAllowed : null,
  };
  if (closestBlockedCandidateSourceArtifacts.length > 0) {
    result.closestBlockedCandidateSourceArtifacts = closestBlockedCandidateSourceArtifacts;
  }
  if (closestBlockedCandidateRequirementSets.length > 0) {
    result.closestBlockedCandidateRequirementSets = closestBlockedCandidateRequirementSets;
  }
  return Object.values(result).some(value => value !== null) ? result : null;
}

function summarizeAvailability(summary = {}, closureMatrix = []) {
  if (!summary || typeof summary !== 'object') return null;
  const closureRows = Array.isArray(closureMatrix) ? closureMatrix : [];
  const availability = {
    hostIsMacOS: typeof summary.hostIsMacOS === 'boolean' ? summary.hostIsMacOS : null,
    safariExecutableFound: typeof summary.safariExecutableFound === 'boolean' ? summary.safariExecutableFound : null,
    safaridriverFound: typeof summary.safaridriverFound === 'boolean' ? summary.safaridriverFound : null,
    currentHarnessSupportsSafari: typeof summary.currentHarnessSupportsSafari === 'boolean' ? summary.currentHarnessSupportsSafari : null,
    canRunSafariBrowserRows: typeof summary.canRunSafariBrowserRows === 'boolean' ? summary.canRunSafariBrowserRows : null,
    safariBenchmarkRowsRecorded: typeof summary.safariBenchmarkRowsRecorded === 'boolean' ? summary.safariBenchmarkRowsRecorded : null,
    exactSafariBuildIdentityRecorded: typeof summary.exactSafariBuildIdentityRecorded === 'boolean' ? summary.exactSafariBuildIdentityRecorded : null,
    safariSourceBoundaryPinned: typeof summary.safariSourceBoundaryPinned === 'boolean' ? summary.safariSourceBoundaryPinned : null,
    primarySyncByteBatchRowsRecorded: typeof summary.primarySyncByteBatchRowsRecorded === 'boolean' ? summary.primarySyncByteBatchRowsRecorded : null,
    boundedPrimarySyncByteBatchRowsRecorded: typeof summary.boundedPrimarySyncByteBatchRowsRecorded === 'boolean' ? summary.boundedPrimarySyncByteBatchRowsRecorded : null,
    directReadableStreamRowsAreSeparateEvidence: typeof summary.directReadableStreamRowsAreSeparateEvidence === 'boolean' ? summary.directReadableStreamRowsAreSeparateEvidence : null,
    closureRequirementsMet: typeof summary.closureRequirementsMet === 'number' ? summary.closureRequirementsMet : null,
    closureRequirementsBlocked: typeof summary.closureRequirementsBlocked === 'number' ? summary.closureRequirementsBlocked : null,
    closesSafariObligation: typeof summary.closesSafariObligation === 'boolean' ? summary.closesSafariObligation : null,
    openObligationRemains: typeof summary.openObligationRemains === 'boolean' ? summary.openObligationRemains : null,
    routeFresh: typeof summary.routeFresh === 'boolean' ? summary.routeFresh : null,
    expectedIdentityMatchesRoute: typeof summary.expectedIdentityMatchesRoute === 'boolean' ? summary.expectedIdentityMatchesRoute : null,
    artifactIdentityMatchesRoute: typeof summary.artifactIdentityMatchesRoute === 'boolean' ? summary.artifactIdentityMatchesRoute : null,
    checkedArtifactCount: typeof summary.checkedArtifactCount === 'number' ? summary.checkedArtifactCount : null,
    mismatchedArtifacts: Array.isArray(summary.mismatchedArtifacts) ? summary.mismatchedArtifacts : null,
    expectedIdentitySource: typeof summary.expectedIdentitySource === 'string' ? summary.expectedIdentitySource : null,
  };
  const metClosureRequirementIds = closureRows
    .filter(row => row?.status === 'met' && typeof row.id === 'string')
    .map(row => row.id);
  const blockedClosureRequirementIds = closureRows
    .filter(row => row?.status === 'blocked' && typeof row.id === 'string')
    .map(row => row.id);
  if (metClosureRequirementIds.length > 0) {
    availability.metClosureRequirementIds = metClosureRequirementIds;
  }
  if (blockedClosureRequirementIds.length > 0) {
    availability.blockedClosureRequirementIds = blockedClosureRequirementIds;
  }
  return Object.values(availability).some(value => value !== null) ? availability : null;
}

function summarizeParameters(parameters = {}) {
  if (!parameters || typeof parameters !== 'object') return null;
  return {
    searchRoots: Array.isArray(parameters.searchRoots) ? parameters.searchRoots : null,
    browserExecutable: typeof parameters.browserExecutable === 'string' ? parameters.browserExecutable : null,
  };
}

function classifyEvidenceKinds(sourceArtifact, root, measuredRows) {
  const kinds = new Set();
  if (measuredRows.length > 0) kinds.add('BENCH_FACT');
  if (/source-pin-audit|shape-audit|materialization-contract-audit|scope-distance-audit|host-api-boundary-audit|memory-frontier-audit|target-distance-audit|text-materialization-boundary-audit|text-materialization-frontier-coverage-audit/.test(sourceArtifact)) kinds.add('SOURCE_FACT');
  if (/availability-audit|route-freshness-audit/.test(sourceArtifact)) kinds.add('ENVIRONMENT_FACT');
  if (/trace|profiler-trace|cpu-profile|hotspot|machine-code|codegen/.test(sourceArtifact)) kinds.add('TRACE_FACT');
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
    const peakMemoryBytes = extractPeakMemoryBytes(node, memoryKind);
    const sourceMode = classifySourceMode(sourceArtifact, node, context);
    rows.push({
      sourceArtifact,
      jsonPath: path.join('.'),
      id: String(node.id ?? node.tool ?? node.name ?? path.at(-1) ?? 'row'),
      caseId: String(node.caseId ?? node.id ?? node.tool ?? node.name ?? path.at(-1) ?? 'row'),
      runtimeId: classifyRuntime(sourceArtifact, node, context),
      runtimeLabel: runtimeLabel(classifyRuntime(sourceArtifact, node, context)),
      sizeGiB: fixture?.sizeGiB ?? null,
      fixtureSource: fixture?.source ?? null,
      fixtureShape: fixture?.shape ?? null,
      corpusSeed: fixture?.source === 'corpus-file' && fixture.sourceFile ? normalizeCorpusSeed(fixture.sourceFile) : null,
      environment: summarizeEnvironment(context.environment),
      sourceBoundary: summarizeSafariSourceBoundary(node.sourceBoundary ?? context.sourceBoundary),
      mibPerSec: round(node.mibPerSec),
      fullStringParity: classifyFullStringParity(node, context),
      boundedMemory: classifyBoundedMemory(node, memoryKind),
      memoryKind,
      peakMemoryBytes,
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
  const sourceContract = context?.sourceContract?.childSourceContract ?? context?.sourceContract;
  const parserInput = sourceContract?.parserInput ?? '';
  const arrayBufferConsumption = sourceContract?.arrayBufferConsumption ?? '';
  const combined = `${parserInput} ${arrayBufferConsumption}`;
  if (/full XML ArrayBuffer parser input|complete XML ArrayBuffer/i.test(combined)) {
    return true;
  }
  if (typeof node.fullArrayBufferParserInput === 'boolean') return node.fullArrayBufferParserInput;
  const mode = typeof sourceMode === 'string' ? sourceMode : '';
  if (/sync-iterable-byte-batches|async-iterable-byte-batches|readable-stream-pull|complete-js-string/.test(mode)) {
    return false;
  }

  if (/does not prebuild|does not use a full XML ArrayBuffer|Neither measured row constructs/i.test(combined)) {
    return false;
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
    sourceBoundary: root?.sourceBoundary ?? null,
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
    sourceBoundary: node.sourceBoundary ?? context.sourceBoundary,
    options: node.options ?? context.options,
  };
}

function createCoverage(artifacts, options, sameContractComparisonRows = []) {
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
    safariWebKitStatus: summarizeSafariWebKitStatus(artifacts, browserBenchmarkRows, sameContractComparisonRows, options.minLargeGiB),
    spiderMonkeyDiagnostics: summarizeSpiderMonkeyDiagnostics(artifacts, sameContractComparisonRows),
    codegenArtifacts: artifacts
      .filter(artifact => artifact.evidenceKinds.includes('TRACE_FACT'))
      .map(artifact => summarizeArtifact(artifact)),
    allocationArtifacts: artifacts
      .filter(artifact => artifact.evidenceKinds.includes('ALLOCATION_FACT'))
      .map(artifact => summarizeArtifact(artifact)),
    sourceArtifacts: artifacts
      .filter(artifact => artifact.evidenceKinds.includes('SOURCE_FACT'))
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

function summarizeSafariWebKitStatus(artifacts, browserBenchmarkRows, sameContractComparisonRows = [], minLargeGiB = 1) {
  const availabilityArtifact = artifacts.find(artifact =>
    artifact.sourceArtifact === 'safari-webkit-availability-audit.json'
  ) ?? null;
  const availability = availabilityArtifact?.availability ?? {};
  const safariRows = browserBenchmarkRows.filter(row => row.runtimeId === 'safari-jsc-browser');
  const safariFullRows = safariRows.filter(row => row.fullStringParity === true);
  const safariDirectReadableFullRows = safariFullRows.filter(row => row.directReadableStream === true);
  const safariPrimaryRows = safariFullRows.filter(row =>
    row.directReadableStream === false
    && row.fullArrayBufferParserInput === false
    && row.demandDrivenSource === true
    && typeof row.sourceMode === 'string'
    && /sync-iterable-byte-batches$/.test(row.sourceMode)
  );
  const boundedPrimaryRows = safariPrimaryRows.filter(hasAcceptedBoundedMemoryProof);
  const largeBoundedPrimaryRows = boundedPrimaryRows.filter(row =>
    typeof row.sizeGiB === 'number' && row.sizeGiB >= minLargeGiB
  );
  const acceptedClosureCaseRows = safariRows.filter(row => safariAcceptedClosureCaseIds.has(row.caseId));
  const acceptedLargeBoundedPrimaryRows = largeBoundedPrimaryRows.filter(row =>
    safariAcceptedClosureCaseIds.has(row.caseId)
  );
  const acceptedClosureCaseIdsRecorded = acceptedClosureCaseIdsFor(acceptedClosureCaseRows);
  const acceptedLargeBoundedPrimaryClosureCaseIdsRecorded = acceptedClosureCaseIdsFor(acceptedLargeBoundedPrimaryRows);
  const boundedPrimaryRowsInSameContractComparison = boundedPrimaryRows.filter(row =>
    matchSameContractComparisonRow({
      selectedRowId: row.id,
      selectedCaseId: row.caseId,
      selectedEventCount: row.eventCount,
      selectedChecksum: row.checksum,
      comparisonRows: sameContractComparisonRows,
      expectedRuntimeIds: ['safari-jsc-browser'],
    })
  );
  const largeBoundedPrimaryRowsInSameContractComparison = largeBoundedPrimaryRows.filter(row =>
    matchSameContractComparisonRow({
      selectedRowId: row.id,
      selectedCaseId: row.caseId,
      selectedEventCount: row.eventCount,
      selectedChecksum: row.checksum,
      comparisonRows: sameContractComparisonRows,
      expectedRuntimeIds: ['safari-jsc-browser'],
    })
  );
  const safariRowsWithMeasuredExactBuildIdentity = safariRows.filter(hasMeasuredSafariBuildIdentity);
  const largeBoundedPrimaryRowsWithMeasuredExactBuildIdentity = largeBoundedPrimaryRows.filter(hasMeasuredSafariBuildIdentity);
  const safariRowsWithRowLevelSourceBoundaryPin = safariRows.filter(hasSafariWebKitSourceBoundaryPin);
  const largeBoundedPrimaryRowsWithRowLevelSourceBoundaryPin = largeBoundedPrimaryRows.filter(hasSafariWebKitSourceBoundaryPin);
  const acceptedLargeBoundedPrimaryRowsWithMeasuredExactBuildIdentity = acceptedLargeBoundedPrimaryRows.filter(hasMeasuredSafariBuildIdentity);
  const acceptedLargeBoundedPrimaryRowsWithRowLevelSourceBoundaryPin = acceptedLargeBoundedPrimaryRows.filter(hasSafariWebKitSourceBoundaryPin);
  const acceptedLargeBoundedPrimaryClosureCaseIdsWithMeasuredExactBuildIdentity = acceptedClosureCaseIdsFor(acceptedLargeBoundedPrimaryRowsWithMeasuredExactBuildIdentity);
  const acceptedLargeBoundedPrimaryClosureCaseIdsWithRowLevelSourceBoundaryPin = acceptedClosureCaseIdsFor(acceptedLargeBoundedPrimaryRowsWithRowLevelSourceBoundaryPin);
  const allAcceptedClosureCasesRecorded = hasAllAcceptedClosureCases(acceptedClosureCaseIdsRecorded);
  const allAcceptedLargeBoundedPrimaryClosureCasesRecorded = hasAllAcceptedClosureCases(acceptedLargeBoundedPrimaryClosureCaseIdsRecorded);
  const allAcceptedLargeBoundedPrimaryClosureCasesWithMeasuredExactBuildIdentity = hasAllAcceptedClosureCases(acceptedLargeBoundedPrimaryClosureCaseIdsWithMeasuredExactBuildIdentity);
  const allAcceptedLargeBoundedPrimaryClosureCasesWithRowLevelSourceBoundaryPin = hasAllAcceptedClosureCases(acceptedLargeBoundedPrimaryClosureCaseIdsWithRowLevelSourceBoundaryPin);
  const primaryRowsInSameContractComparison = boundedPrimaryRows.length > 0
    && boundedPrimaryRowsInSameContractComparison.length === boundedPrimaryRows.length;
  const largePrimaryRowsInSameContractComparison = largeBoundedPrimaryRows.length > 0
    && largeBoundedPrimaryRowsInSameContractComparison.length === largeBoundedPrimaryRows.length;
  const measuredExactBuildIdentityRecorded = safariRowsWithMeasuredExactBuildIdentity.length > 0;
  const exactBuildIdentityRecorded = availability.exactSafariBuildIdentityRecorded === true
    && measuredExactBuildIdentityRecorded;
  return {
    availabilityArtifact: availabilityArtifact?.sourceArtifact ?? null,
    hostIsMacOS: availability.hostIsMacOS ?? null,
    safariExecutableFound: availability.safariExecutableFound ?? null,
    safaridriverFound: availability.safaridriverFound ?? null,
    harnessSupportsSafari: availability.currentHarnessSupportsSafari ?? null,
    canRunSafariBrowserRows: availability.canRunSafariBrowserRows ?? null,
    benchmarkRowsRecorded: safariRows.length,
    availabilitySaysRowsRecorded: availability.safariBenchmarkRowsRecorded ?? null,
    availabilityExactBuildIdentityRecorded: availability.exactSafariBuildIdentityRecorded ?? null,
    measuredExactBuildIdentityRowsRecorded: safariRowsWithMeasuredExactBuildIdentity.length,
    largeBoundedPrimarySyncByteBatchRowsWithMeasuredExactBuildIdentity: largeBoundedPrimaryRowsWithMeasuredExactBuildIdentity.length,
    rowLevelSourceBoundaryPinnedRowsRecorded: safariRowsWithRowLevelSourceBoundaryPin.length,
    largeBoundedPrimarySyncByteBatchRowsWithRowLevelSourceBoundaryPin: largeBoundedPrimaryRowsWithRowLevelSourceBoundaryPin.length,
    exactBuildIdentityRecorded,
    sourceBoundaryPinned: availability.safariSourceBoundaryPinned === true
      && largeBoundedPrimaryRowsWithRowLevelSourceBoundaryPin.length > 0,
    availabilitySourceBoundaryPinned: availability.safariSourceBoundaryPinned ?? null,
    availabilityPrimarySyncByteBatchRowsRecorded: availability.primarySyncByteBatchRowsRecorded ?? null,
    availabilityBoundedPrimarySyncByteBatchRowsRecorded: availability.boundedPrimarySyncByteBatchRowsRecorded ?? null,
    directReadableStreamRowsAreSeparateEvidence: availability.directReadableStreamRowsAreSeparateEvidence ?? null,
    availabilityClosureRequirementsMet: availability.closureRequirementsMet ?? null,
    availabilityClosureRequirementsBlocked: availability.closureRequirementsBlocked ?? null,
    availabilityMetClosureRequirementIds: Array.isArray(availability.metClosureRequirementIds)
      ? availability.metClosureRequirementIds
      : [],
    availabilityBlockedClosureRequirementIds: Array.isArray(availability.blockedClosureRequirementIds)
      ? availability.blockedClosureRequirementIds
      : [],
    availabilityClosesSafariObligation: availability.closesSafariObligation ?? null,
    openObligationRemains: availability.openObligationRemains ?? null,
    fullStringRowsRecorded: safariFullRows.length,
    directReadableStreamFullStringRowsRecorded: safariDirectReadableFullRows.length,
    primarySyncByteBatchRowsRecorded: safariPrimaryRows.length,
    boundedPrimarySyncByteBatchRowsRecorded: boundedPrimaryRows.length,
    largeBoundedPrimarySyncByteBatchRowsRecorded: largeBoundedPrimaryRows.length,
    acceptedClosureCaseRowsRecorded: acceptedClosureCaseRows.length,
    acceptedClosureCaseIdsRecorded,
    allAcceptedClosureCasesRecorded,
    acceptedLargeBoundedPrimarySyncByteBatchRowsRecorded: acceptedLargeBoundedPrimaryRows.length,
    acceptedLargeBoundedPrimaryClosureCaseIdsRecorded,
    allAcceptedLargeBoundedPrimaryClosureCasesRecorded,
    boundedPrimarySyncByteBatchRowsInSameContractComparison: boundedPrimaryRowsInSameContractComparison.length,
    largeBoundedPrimarySyncByteBatchRowsInSameContractComparison: largeBoundedPrimaryRowsInSameContractComparison.length,
    primaryRowsInSameContractComparison,
    largePrimaryRowsInSameContractComparison,
    evidenceClass: safariRows.length > 0
      ? 'browser-row-evidence'
      : availabilityArtifact
        ? 'environment-availability-only'
        : 'missing-availability-audit',
    closesSafariObligation: safariRows.length > 0
      && exactBuildIdentityRecorded
      && availability.safariSourceBoundaryPinned === true
      && availability.directReadableStreamRowsAreSeparateEvidence === true
      && allAcceptedLargeBoundedPrimaryClosureCasesRecorded
      && allAcceptedLargeBoundedPrimaryClosureCasesWithMeasuredExactBuildIdentity
      && allAcceptedLargeBoundedPrimaryClosureCasesWithRowLevelSourceBoundaryPin
      && largePrimaryRowsInSameContractComparison,
  };
}

function acceptedClosureCaseIdsFor(rows) {
  return Array.from(new Set(rows
    .map(row => row.caseId)
    .filter(caseId => safariAcceptedClosureCaseIds.has(caseId))))
    .sort();
}

function hasAllAcceptedClosureCases(caseIds) {
  if (!Array.isArray(caseIds)) return false;
  const actual = new Set(caseIds);
  return Array.from(safariAcceptedClosureCaseIds).every(caseId => actual.has(caseId));
}

function hasAcceptedBoundedMemoryProof(row) {
  return row?.boundedMemory === true
    && (row.memoryKind === 'process-rss' || row.memoryKind === 'browser-js-heap')
    && typeof row.peakMemoryBytes === 'number'
    && Number.isFinite(row.peakMemoryBytes)
    && row.peakMemoryBytes <= 512 * MIB;
}

function hasMeasuredSafariBuildIdentity(row) {
  const environment = row?.environment ?? {};
  return typeof environment.browserVersion === 'string'
    && environment.browserVersion.length > 0
    && environment.browserVersion !== 'unknown'
    && (typeof environment.webKitBuildVersion === 'string'
      || /AppleWebKit\/\d/i.test(environment.userAgent ?? ''))
    && typeof environment.userAgent === 'string'
    && environment.userAgent.length > 0
    && /Safari\//.test(environment.userAgent);
}

function hasSafariWebKitSourceBoundaryPin(row) {
  const boundary = row?.sourceBoundary ?? {};
  return hasSafariSourceRevision(boundary.sourceRevision)
    && boundary.stringBoundaryPinned === true
    && boundary.textDecoderBoundaryPinned === true
    && boundary.sourcePinArtifacts.some(artifact => /safari|webkit/i.test(artifact) && !/bun/i.test(artifact));
}

function hasSafariSourceRevision(value) {
  return typeof value === 'string'
    && value.length > 0
    && value !== 'unknown'
    && (/[0-9a-f]{7,40}/i.test(value) || /^r?\d{5,}$/i.test(value));
}

function summarizeSafariSourceBoundary(sourceBoundary = {}) {
  if (!sourceBoundary || typeof sourceBoundary !== 'object') return {};
  return {
    sourceRevision: firstString(
      sourceBoundary.sourceRevision,
      sourceBoundary.webkitSourceRevision,
      sourceBoundary.webKitSourceRevision,
      sourceBoundary.revision,
    ),
    stringBoundaryPinned: sourceBoundary.stringBoundaryPinned === true,
    textDecoderBoundaryPinned: sourceBoundary.textDecoderBoundaryPinned === true,
    sourcePinArtifacts: uniqueStrings([
      ...(Array.isArray(sourceBoundary.sourcePinArtifacts) ? sourceBoundary.sourcePinArtifacts : []),
      ...(Array.isArray(sourceBoundary.artifacts) ? sourceBoundary.artifacts : []),
      sourceBoundary.sourcePinArtifact,
    ]),
  };
}

function summarizeSpiderMonkeyDiagnostics(artifacts, sameContractComparisonRows = []) {
  const byName = new Map(artifacts.map(artifact => [artifact.sourceArtifact, artifact]));
  const diagnosticDump = byName.get('firefox-spidermonkey-diagnostic-dump-audit.json') ?? null;
  const taskclusterDebugBrowserPreflight = byName.get('firefox-spidermonkey-taskcluster-debug-browser-launch-preflight-audit.json') ?? null;
  const localJsShell = byName.get('firefox-spidermonkey-js-shell-availability-audit.json') ?? null;
  const releaseJsShell = byName.get('firefox-spidermonkey-release-jsshell-availability-audit.json') ?? null;
  const nightlyJsShell = byName.get('firefox-spidermonkey-nightly-jsshell-availability-audit.json') ?? null;
  const jsShellApiGap = byName.get('firefox-spidermonkey-jsshell-stax-api-gap-audit.json') ?? null;
  const jsShellDiagnosticFlagSweep = byName.get('spidermonkey-jsshell-diagnostic-flag-sweep.json') ?? null;
  const taskclusterDebugJsShell = byName.get('spidermonkey-taskcluster-debug-jsshell-codegen-audit.json') ?? null;
  const taskclusterDebugJsShellXml = byName.get('spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.json') ?? null;
  const taskclusterDebugJsShellAsciiStax = byName.get('spidermonkey-taskcluster-debug-jsshell-ascii-stax-codegen-audit.json') ?? null;
  const taskclusterDebugJsShellMaterialized = byName.get('spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json') ?? null;
  const archivalDebugJsShell = byName.get('spidermonkey-archival-debug-jsshell-codegen-audit.json') ?? null;
  const buildconfig = byName.get('firefox-spidermonkey-buildconfig-source-pin-audit.json') ?? null;
  const closureAudit = byName.get('spidermonkey-codegen-closure-audit.json') ?? null;
  const rows = [
    summarizeSpiderMonkeyDiagnostic('installed-browser-diagnostic-dump', diagnosticDump, sameContractComparisonRows),
    summarizeSpiderMonkeyDiagnostic('local-js-shell-discovery', localJsShell, sameContractComparisonRows),
    summarizeSpiderMonkeyDiagnostic('official-release-jsshell', releaseJsShell, sameContractComparisonRows),
    summarizeSpiderMonkeyDiagnostic('official-nightly-jsshell', nightlyJsShell, sameContractComparisonRows),
    summarizeSpiderMonkeyDiagnostic('official-jsshell-stax-api-gap', jsShellApiGap, sameContractComparisonRows),
    summarizeSpiderMonkeyDiagnostic('official-jsshell-diagnostic-flag-sweep', jsShellDiagnosticFlagSweep, sameContractComparisonRows),
    summarizeSpiderMonkeyDiagnostic('taskcluster-debug-jsshell-codegen', taskclusterDebugJsShell, sameContractComparisonRows),
    summarizeSpiderMonkeyDiagnostic('taskcluster-debug-jsshell-xml-codegen', taskclusterDebugJsShellXml, sameContractComparisonRows),
    summarizeSpiderMonkeyDiagnostic('taskcluster-debug-jsshell-ascii-stax-codegen', taskclusterDebugJsShellAsciiStax, sameContractComparisonRows),
    summarizeSpiderMonkeyDiagnostic('taskcluster-debug-jsshell-materialized-codegen', taskclusterDebugJsShellMaterialized, sameContractComparisonRows),
    summarizeSpiderMonkeyDiagnostic('archival-debug-jsshell-codegen', archivalDebugJsShell, sameContractComparisonRows),
    summarizeSpiderMonkeyDiagnostic('installed-buildconfig-source-pin', buildconfig, sameContractComparisonRows),
  ].filter(Boolean);
  const closureAuditCandidateCount = closureAudit?.summary?.candidateCount ?? null;
  const diagnosticRowSourceArtifacts = uniqueStrings(rows.map(row => row.sourceArtifact));
  const closureAuditCandidateSourceArtifacts = uniqueStrings(closureAudit?.summary?.candidateSourceArtifacts ?? []);
  const diagnosticRowSourceArtifactSet = new Set(diagnosticRowSourceArtifacts);
  const closureAuditCandidateSourceArtifactSet = new Set(closureAuditCandidateSourceArtifacts);
  const closureAuditCandidateSourcesOutsideDiagnostics = closureAuditCandidateSourceArtifacts
    .filter(sourceArtifact => !diagnosticRowSourceArtifactSet.has(sourceArtifact));
  const diagnosticSourcesOutsideClosureAudit = diagnosticRowSourceArtifacts
    .filter(sourceArtifact => !closureAuditCandidateSourceArtifactSet.has(sourceArtifact));
  const closureAuditQualifiedClosureCount = closureAudit?.summary?.qualifiedClosureCount ?? null;
  const closureAuditConclusionAllowed = closureAudit?.summary?.conclusionAllowed ?? null;
  return {
    rows,
    browserPreflight: summarizeSpiderMonkeyDiagnostic('taskcluster-debug-browser-launch-preflight', taskclusterDebugBrowserPreflight, sameContractComparisonRows),
    diagnosticRowCount: rows.length,
    diagnosticRowSourceArtifacts,
    closureAuditCandidateCount,
    closureAuditCandidateSourceArtifacts,
    closureAuditDiagnosticRowGap: typeof closureAuditCandidateCount === 'number'
      ? closureAuditCandidateCount - rows.length
      : null,
    closureAuditCandidateSourcesOutsideDiagnostics,
    diagnosticSourcesOutsideClosureAudit,
    closureAuditQualifiedClosureCount,
    closureAuditConclusionAllowed,
    emittedIrEvidenceCount: rows.filter(row => row.emittedIrClosureQualified === true).length,
    emittedIrClaimCount: rows.filter(row => row.closesEmittedIrObligation === true).length,
    jitStatusOnlyCount: rows.filter(row => row.evidenceClass === 'jit-status-only').length,
    availabilityOnlyCount: rows.filter(row => row.evidenceClass === 'availability-only').length,
    missingIrSurfaceCount: rows.filter(row => row.irDumpSurface === false || row.nativeDumpComplete === false).length,
    selectedRowIdentityStatusCounts: countStringValues(rows.map(row => row.selectedRowIdentityStatus)),
  };
}

function summarizeSpiderMonkeyDiagnostic(id, artifact, sameContractComparisonRows = []) {
  if (!artifact) return null;
  const outcome = artifact.outcome ?? {};
  const summary = artifact.summary ?? {};
  const declaredEvidenceClass = typeof outcome.evidenceClass === 'string'
    ? outcome.evidenceClass
    : typeof summary.evidenceClass === 'string'
      ? summary.evidenceClass
      : null;
  const evidenceClassAllowed = declaredEvidenceClass === null
    ? null
    : declaredEvidenceClass === 'same-contract-spidermonkey-codegen';
  const hasJitExecutionStatus = typeof outcome.hasJitExecutionStatus === 'boolean'
    ? outcome.hasJitExecutionStatus
    : typeof summary.jitStatusShellCount === 'number' && typeof summary.shellCount === 'number'
      ? summary.jitStatusShellCount === summary.shellCount && summary.shellCount > 0
    : null;
  const closesEmittedIrObligation = typeof outcome.closesEmittedIrObligation === 'boolean'
    ? outcome.closesEmittedIrObligation
    : false;
  const sameContractStaxRow = typeof outcome.sameContractStaxRow === 'boolean' ? outcome.sameContractStaxRow : null;
  const canRunCurrentStaxFullStringBenchmark = typeof outcome.canRunCurrentStaxFullStringBenchmark === 'boolean'
    ? outcome.canRunCurrentStaxFullStringBenchmark
    : typeof summary.unchangedRunnableShellCount === 'number'
      ? summary.unchangedRunnableShellCount > 0
      : null;
  const selectedRowId = outcome.selectedRowId ?? outcome.selectedCaseId ?? outcome.rowId ?? null;
  const selectedEventCount = typeof outcome.selectedEventCount === 'number'
    ? outcome.selectedEventCount
    : typeof outcome.eventCount === 'number'
      ? outcome.eventCount
      : null;
  const selectedChecksum = outcome.selectedChecksum ?? outcome.checksum ?? null;
  const selectedRowMatchesCurrentComparison = closesEmittedIrObligation === true
    ? matchSameContractComparisonRow({
        selectedRowId,
        selectedEventCount,
        selectedChecksum,
        comparisonRows: sameContractComparisonRows,
        expectedRuntimeIds: ['firefox-spidermonkey-browser', 'spidermonkey-jsshell'],
      })
    : null;
  const runtimeBuildIdentityRecorded = hasSpiderMonkeyRuntimeBuildIdentity(artifact);
  const diagnosticFlagsRecorded = hasSpiderMonkeyDiagnosticFlags(artifact);
  const emittedDumpMetadataRecorded = hasSpiderMonkeyEmittedDumpMetadata(artifact, outcome);
  const closingMetadataComplete = runtimeBuildIdentityRecorded
    && diagnosticFlagsRecorded
    && typeof selectedRowId === 'string'
    && selectedRowId.length > 0
    && typeof selectedEventCount === 'number'
    && selectedChecksum !== null
    && selectedChecksum !== undefined
    && emittedDumpMetadataRecorded;
  const selectedRowMetadataComplete = typeof selectedRowId === 'string'
    && selectedRowId.length > 0
    && typeof selectedEventCount === 'number'
    && selectedChecksum !== null
    && selectedChecksum !== undefined;
  const selectedRowIdentityStatus = classifySpiderMonkeySelectedRowIdentity({
    closesEmittedIrObligation,
    sameContractStaxRow,
    canRunCurrentStaxFullStringBenchmark,
    currentStaxAsciiPrimaryByteBatchRow: typeof outcome.currentStaxAsciiPrimaryByteBatchRow === 'boolean'
      ? outcome.currentStaxAsciiPrimaryByteBatchRow
      : null,
    currentStaxUtf8PrimaryByteBatchRow: typeof outcome.currentStaxUtf8PrimaryByteBatchRow === 'boolean'
      ? outcome.currentStaxUtf8PrimaryByteBatchRow
      : null,
    canRunAsciiPrimaryByteBatchBenchmark: typeof outcome.canRunAsciiPrimaryByteBatchBenchmark === 'boolean'
      ? outcome.canRunAsciiPrimaryByteBatchBenchmark
      : null,
    canRunUtf8PrimaryByteBatchBenchmark: typeof outcome.canRunUtf8PrimaryByteBatchBenchmark === 'boolean'
      ? outcome.canRunUtf8PrimaryByteBatchBenchmark
      : null,
    selectedRowMetadataComplete,
    selectedRowMatchesCurrentComparison,
  });
  const emittedIrClosureQualified = closesEmittedIrObligation === true
    && sameContractStaxRow === true
    && canRunCurrentStaxFullStringBenchmark === true
    && selectedRowMetadataComplete === true
    && selectedRowMatchesCurrentComparison === true
    && closingMetadataComplete
    && evidenceClassAllowed;
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
    bytecodeProbeCount: typeof outcome.bytecodeProbeCount === 'number' ? outcome.bytecodeProbeCount : null,
    bytecodeOutputProbeCount: typeof outcome.bytecodeOutputProbeCount === 'number' ? outcome.bytecodeOutputProbeCount : null,
    hasDiagnosticPrefSurface: typeof outcome.hasDiagnosticPrefSurface === 'boolean' ? outcome.hasDiagnosticPrefSurface : null,
    canReadBinaryInput: typeof outcome.canReadBinaryInput === 'boolean'
      ? outcome.canReadBinaryInput
      : typeof summary.binaryReadableShellCount === 'number' && typeof summary.shellCount === 'number'
        ? summary.binaryReadableShellCount === summary.shellCount && summary.shellCount > 0
        : null,
    canRunCurrentStaxFullStringBenchmark,
    currentStaxAsciiPrimaryByteBatchRow: typeof outcome.currentStaxAsciiPrimaryByteBatchRow === 'boolean'
      ? outcome.currentStaxAsciiPrimaryByteBatchRow
      : null,
    currentStaxUtf8PrimaryByteBatchRow: typeof outcome.currentStaxUtf8PrimaryByteBatchRow === 'boolean'
      ? outcome.currentStaxUtf8PrimaryByteBatchRow
      : null,
    canRunAsciiPrimaryByteBatchBenchmark: typeof outcome.canRunAsciiPrimaryByteBatchBenchmark === 'boolean'
      ? outcome.canRunAsciiPrimaryByteBatchBenchmark
      : null,
    canRunUtf8PrimaryByteBatchBenchmark: typeof outcome.canRunUtf8PrimaryByteBatchBenchmark === 'boolean'
      ? outcome.canRunUtf8PrimaryByteBatchBenchmark
      : null,
    selectedRowId,
    selectedEventCount,
    selectedChecksum,
    selectedRowMetadataComplete,
    selectedRowIdentityStatus,
    selectedRowMatchesCurrentComparison,
    commonMissingGlobals: Array.isArray(summary.commonMissingGlobals) ? summary.commonMissingGlobals : null,
    primarySyncByteBatchMissingGlobals: Array.isArray(summary.primarySyncByteBatchMissingGlobals)
      ? summary.primarySyncByteBatchMissingGlobals
      : null,
    nonPrimaryHarnessMissingGlobals: Array.isArray(summary.nonPrimaryHarnessMissingGlobals)
      ? summary.nonPrimaryHarnessMissingGlobals
      : null,
    taskId: artifact.shell?.provenance?.taskId ?? null,
    route: artifact.shell?.provenance?.route ?? null,
    buildId: artifact.shell?.provenance?.buildId ?? null,
    sourceRevision: artifact.shell?.provenance?.sourceRevision ?? null,
    hasCodegenDumpOutput: typeof outcome.hasCodegenDumpOutput === 'boolean' ? outcome.hasCodegenDumpOutput : null,
    runtimeBuildIdentityRecorded,
    diagnosticFlagsRecorded,
    emittedDumpMetadataRecorded,
    closingMetadataComplete,
    sameContractStaxRow,
    closesEmittedIrObligation,
    emittedIrClosureQualified,
    declaredEvidenceClass,
    evidenceClassAllowed,
    evidenceClass: classifySpiderMonkeyDiagnosticEvidence({
      id,
      hasJitExecutionStatus,
      closesEmittedIrObligation,
      emittedIrClosureQualified,
      irDumpSurface,
      nativeDumpComplete,
      bytecodeDumpOutput,
      selectedRowMatchesCurrentComparison,
      evidenceClassAllowed,
      outcome,
      summary,
    }),
  };
}

function classifySpiderMonkeySelectedRowIdentity({
  closesEmittedIrObligation,
  sameContractStaxRow,
  canRunCurrentStaxFullStringBenchmark,
  selectedRowMetadataComplete,
  selectedRowMatchesCurrentComparison,
}) {
  if (closesEmittedIrObligation !== true) {
    if (sameContractStaxRow === false || canRunCurrentStaxFullStringBenchmark === false) {
      return 'not-claimed-non-stax-diagnostic';
    }
    return 'not-claimed';
  }
  if (!selectedRowMetadataComplete) return 'closing-row-metadata-missing';
  if (selectedRowMatchesCurrentComparison === true) return 'closing-row-identity-verified';
  return 'closing-row-identity-missing-or-mismatched';
}

function hasSpiderMonkeyRuntimeBuildIdentity(artifact) {
  const provenance = artifact.shell?.provenance ?? {};
  const buildId = provenance.buildId ?? provenance.targetTxt?.buildId ?? provenance.buildhub?.buildId ?? null;
  const sourceRevision = provenance.sourceRevision ?? provenance.targetTxt?.sourceRevision ?? provenance.buildhub?.sourceRevision ?? null;
  return typeof buildId === 'string'
    && buildId.length > 0
    && typeof sourceRevision === 'string'
    && sourceRevision.length > 0;
}

function hasSpiderMonkeyDiagnosticFlags(artifact) {
  const flags = getSpiderMonkeyCodegenProbes(artifact).find(probe => probe.flags)?.flags
    ?? artifact.outcome?.diagnosticFlags
    ?? null;
  if (typeof flags === 'string') return flags.length > 0;
  return Array.isArray(flags) && flags.length > 0;
}

function hasSpiderMonkeyEmittedDumpMetadata(artifact, outcome) {
  return outcome?.hasCodegenDumpOutput === true
    && getSpiderMonkeyCodegenProbes(artifact).some(hasPositiveSpiderMonkeyCodegenProbe);
}

function getSpiderMonkeyCodegenProbes(artifact) {
  const shell = artifact.shell ?? {};
  return [
    shell.codegenProbe,
    shell.xmlCodegenProbe,
    shell.materializedCodegenProbe,
  ].filter(Boolean);
}

function hasPositiveSpiderMonkeyCodegenProbe(probe) {
  const status = typeof probe.status === 'string' ? probe.status : '';
  const emittedStatus = /codegen-output-emitted$/.test(status);
  const positiveOutputBytes = typeof probe.outputBytes === 'number'
    && probe.outputBytes > 0;
  const positiveCodegenMarkers = typeof probe.codegenMarkerCount === 'number'
    && probe.codegenMarkerCount > 0;
  const positiveIonMarkers = typeof probe.ionScriptMarkerCount === 'number'
    && probe.ionScriptMarkerCount > 0;
  const positiveAssemblyMnemonics = typeof probe.assemblyMnemonicCount === 'number'
    && probe.assemblyMnemonicCount > 0;
  return emittedStatus
    && (
      positiveCodegenMarkers
      || positiveIonMarkers
      || positiveAssemblyMnemonics
      || positiveOutputBytes
    );
}

function matchSameContractComparisonRow({
  selectedRowId,
  selectedCaseId = null,
  selectedEventCount,
  selectedChecksum,
  comparisonRows,
  expectedRuntimeIds = null,
}) {
  if (!Array.isArray(comparisonRows) || comparisonRows.length === 0) return false;
  if (typeof selectedRowId !== 'string' || selectedRowId.length === 0) return false;
  return comparisonRows.some(row => {
    if (row.id !== selectedRowId) return false;
    if (selectedCaseId !== null && selectedCaseId !== undefined && row.caseId !== selectedCaseId) return false;
    if (
      Array.isArray(expectedRuntimeIds)
      && expectedRuntimeIds.length > 0
      && !expectedRuntimeIds.includes(row.runtimeId)
    ) return false;
    if (typeof selectedEventCount !== 'number' || row.eventCount !== selectedEventCount) return false;
    if (selectedChecksum === null || selectedChecksum === undefined || row.checksum !== selectedChecksum) return false;
    return true;
  });
}

function extractSameContractComparisonRows(root) {
  const rows = Array.isArray(root?.comparisonRows)
    ? root.comparisonRows
    : Array.isArray(root?.rows)
      ? root.rows
      : [];
  return rows
    .map(row => ({
      id: row.id ?? row.caseId ?? null,
      caseId: row.caseId ?? row.id ?? null,
      runtimeId: row.runtimeId ?? row.runtime?.id ?? null,
      jsRuntime: row.jsRuntime === true || isJsRuntime(row.runtimeId ?? row.runtime?.id),
      fullStringParity: row.fullStringParity === true,
      eventCount: normalizeEventCount(row),
      checksum: row.checksum ?? null,
    }))
    .filter(row =>
      typeof row.id === 'string'
      && row.jsRuntime
      && row.fullStringParity
    );
}

function classifySpiderMonkeyDiagnosticEvidence({ id, hasJitExecutionStatus, closesEmittedIrObligation, emittedIrClosureQualified, irDumpSurface, nativeDumpComplete, bytecodeDumpOutput, selectedRowMatchesCurrentComparison, evidenceClassAllowed, outcome, summary }) {
  if (emittedIrClosureQualified) return 'emitted-ir';
  if (outcome?.hasAsciiCurrentStaxCodegenOutput === true && outcome?.currentStaxAsciiPrimaryByteBatchRow === true && outcome?.sameContractStaxRow === false) return 'current-debug-ascii-stax-codegen-scope-guard';
  if (closesEmittedIrObligation || selectedRowMatchesCurrentComparison === false || evidenceClassAllowed === false) return 'emitted-ir-scope-guard';
  if (outcome?.hasMaterializedStringObjectCodegenOutput === true && outcome?.scopeComparableToCurrentFirefox === true && outcome?.sameContractStaxRow === false) return 'current-debug-materialized-codegen-scope-guard';
  if (outcome?.hasXmlWorkloadCodegenOutput === true && outcome?.scopeComparableToCurrentFirefox === true && outcome?.sameContractStaxRow === false) return 'current-debug-xml-codegen-scope-guard';
  if (outcome?.hasCodegenDumpOutput === true && outcome?.scopeComparableToCurrentFirefox === true && outcome?.sameContractStaxRow === false) return 'current-debug-codegen-scope-guard';
  if (outcome?.hasCodegenDumpOutput === true && outcome?.scopeComparableToCurrentFirefox === false) return 'archival-codegen-scope-guard';
  if (outcome?.bytecodeProbeCount > 0 && outcome?.bytecodeOutputProbeCount === 0) return 'diagnostic-flag-sweep-negative';
  if (bytecodeDumpOutput === true) return 'bytecode-diagnostic-only';
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

function summarizeUnknownFullStringParityRows(rows, options) {
  const unknownRows = rows.filter(row => row.fullStringParity === null);
  const counterexampleRelevantRows = unknownRows.filter(row =>
    isUnknownFullStringParityCounterexampleRelevant(row, options)
  );
  return {
    total: unknownRows.length,
    jsRows: unknownRows.filter(row => isJsRuntime(row.runtimeId)).length,
    boundedRows: unknownRows.filter(row => row.boundedMemory === true).length,
    largeJsRows: unknownRows.filter(row =>
      isJsRuntime(row.runtimeId)
      && row.sizeGiB !== null
      && row.sizeGiB >= options.minLargeGiB
    ).length,
    atOrAboveThresholdRows: unknownRows.filter(row => row.mibPerSec >= options.thresholdMiBPerSec).length,
    counterexampleRelevantRows: counterexampleRelevantRows.length,
  };
}

function summarizeUnknownFullStringParityRow(row, options) {
  const counterexampleRelevant = isUnknownFullStringParityCounterexampleRelevant(row, options);
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
    boundedMemory: row.boundedMemory,
    memoryKind: row.memoryKind,
    eventCount: row.eventCount,
    checksum: row.checksum,
    contractScope: row.contractScope,
    counterexampleRelevant,
    counterexampleExclusionReason: counterexampleRelevant
      ? 'counterexample-relevant-unclassified-full-string-parity'
      : unknownFullStringParityExclusionReason(row, options),
  };
}

function isUnknownFullStringParityCounterexampleRelevant(row, options) {
  return isJsRuntime(row.runtimeId)
    && row.boundedMemory === true
    && row.sizeGiB !== null
    && row.sizeGiB >= options.minLargeGiB
    && row.mibPerSec >= options.thresholdMiBPerSec;
}

function unknownFullStringParityExclusionReason(row, options) {
  if (!isJsRuntime(row.runtimeId)) {
    return 'non-js-row-not-runtime-limit-target';
  }
  if (row.boundedMemory !== true) {
    return 'js-row-without-bounded-memory-proof';
  }
  if (row.sizeGiB === null) {
    return 'js-row-without-large-size-proof';
  }
  if (row.sizeGiB < options.minLargeGiB) {
    return 'js-row-below-large-size-threshold';
  }
  if (row.mibPerSec < options.thresholdMiBPerSec) {
    return 'js-row-below-counterexample-throughput-threshold';
  }
  return 'counterexample-relevant-unclassified-full-string-parity';
}

function summarizeUnknownBoundedMemoryRow(row, options) {
  const counterexampleRelevant = isUnknownBoundedMemoryCounterexampleRelevant(row, options);
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
    counterexampleRelevant,
    counterexampleExclusionReason: counterexampleRelevant
      ? 'counterexample-relevant-unclassified-memory'
      : unknownBoundedMemoryExclusionReason(row, options),
  };
}

function isUnknownBoundedMemoryCounterexampleRelevant(row, options) {
  return isJsRuntime(row.runtimeId)
    && row.fullStringParity === true
    && row.sizeGiB !== null
    && row.sizeGiB >= options.minLargeGiB;
}

function unknownBoundedMemoryExclusionReason(row, options) {
  if (!isJsRuntime(row.runtimeId) && row.memoryKind === 'allocator-counters') {
    return 'non-js-allocator-counter-not-runtime-limit-target';
  }
  if (!isJsRuntime(row.runtimeId) && row.memoryKind === 'not-recorded') {
    return 'non-js-no-peak-memory-not-runtime-limit-target';
  }
  if (!isJsRuntime(row.runtimeId)) {
    return 'non-js-row-not-runtime-limit-target';
  }
  if (row.fullStringParity !== true) {
    return 'js-row-not-full-string-contract';
  }
  if (row.sizeGiB === null) {
    return 'js-row-without-large-size-proof';
  }
  if (row.sizeGiB < options.minLargeGiB) {
    return 'js-row-below-large-size-threshold';
  }
  return 'counterexample-relevant-unclassified-memory';
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
  const hasSpiderMonkeyEmittedIrEvidence =
    coverage.spiderMonkeyDiagnostics.emittedIrEvidenceCount > 0
    || coverage.spiderMonkeyDiagnostics.closureAuditQualifiedClosureCount > 0;
  const spiderMonkeyDiagnosticDumpAudit = coverage.negativeArtifacts.find(artifact =>
    artifact.sourceArtifact === 'firefox-spidermonkey-diagnostic-dump-audit.json'
  );
  const hasSpiderMonkeyDiagnosticNoDump = spiderMonkeyDiagnosticDumpAudit?.outcome?.status === 'no-dump-emitted';
  const spiderMonkeyTaskclusterDebugBrowserDiagnosticDumpAudit = coverage.negativeArtifacts.find(artifact =>
    artifact.sourceArtifact === 'firefox-spidermonkey-taskcluster-debug-browser-diagnostic-dump-audit.json'
  );
  const hasSpiderMonkeyTaskclusterDebugBrowserDiagnosticFailure =
    spiderMonkeyTaskclusterDebugBrowserDiagnosticDumpAudit?.outcome?.status === 'failed'
    && spiderMonkeyTaskclusterDebugBrowserDiagnosticDumpAudit?.outcome?.completed === false
    && spiderMonkeyTaskclusterDebugBrowserDiagnosticDumpAudit?.outcome?.emittedDump === false;
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
  const spiderMonkeyJsShellDiagnosticFlagSweep = coverage.negativeArtifacts.find(artifact =>
    artifact.sourceArtifact === 'spidermonkey-jsshell-diagnostic-flag-sweep.json'
  );
  const hasSpiderMonkeyJsShellDiagnosticFlagSweep = Boolean(spiderMonkeyJsShellDiagnosticFlagSweep);
  const spiderMonkeyTaskclusterDebugCodegen = coverage.spiderMonkeyDiagnostics.rows.find(row =>
    row.id === 'taskcluster-debug-jsshell-codegen'
  );
  const hasSpiderMonkeyTaskclusterDebugCodegen = Boolean(spiderMonkeyTaskclusterDebugCodegen);
  const spiderMonkeyTaskclusterDebugXmlCodegen = coverage.spiderMonkeyDiagnostics.rows.find(row =>
    row.id === 'taskcluster-debug-jsshell-xml-codegen'
  );
  const hasSpiderMonkeyTaskclusterDebugXmlCodegen = Boolean(spiderMonkeyTaskclusterDebugXmlCodegen);
  const spiderMonkeyTaskclusterDebugMaterializedCodegen = coverage.spiderMonkeyDiagnostics.rows.find(row =>
    row.id === 'taskcluster-debug-jsshell-materialized-codegen'
  );
  const hasSpiderMonkeyTaskclusterDebugMaterializedCodegen = Boolean(spiderMonkeyTaskclusterDebugMaterializedCodegen);
  const spiderMonkeyCodegenRerunStability = coverage.negativeArtifacts.find(artifact =>
    artifact.sourceArtifact === 'spidermonkey-codegen-rerun-stability-audit.json'
  );
  const hasSpiderMonkeyCodegenRerunStability = Boolean(spiderMonkeyCodegenRerunStability);
  const spiderMonkeyMaterializedScopeDistance = coverage.sourceArtifacts.find(artifact =>
    artifact.sourceArtifact === 'spidermonkey-materialized-scope-distance-audit.json'
  );
  const hasSpiderMonkeyMaterializedScopeDistance = Boolean(spiderMonkeyMaterializedScopeDistance);
  const spiderMonkeyAsciiScopeDistance = coverage.sourceArtifacts.find(artifact =>
    artifact.sourceArtifact === 'spidermonkey-ascii-scope-distance-audit.json'
  );
  const hasSpiderMonkeyAsciiScopeDistance = Boolean(spiderMonkeyAsciiScopeDistance);
  const staxPublicReaderHostApiBoundary = coverage.sourceArtifacts.find(artifact =>
    artifact.sourceArtifact === 'stax-public-reader-host-api-boundary-audit.json'
  );
  const hasStaxPublicReaderHostApiBoundary = Boolean(staxPublicReaderHostApiBoundary);
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
  const spiderMonkeyPrimaryPathRunnableWithoutHostEncoding =
    typeof spiderMonkeyJsShellApiGapAudit?.summary?.primaryPathRunnableWithoutHostEncoding === 'boolean'
      ? spiderMonkeyJsShellApiGapAudit.summary.primaryPathRunnableWithoutHostEncoding
      : Array.isArray(spiderMonkeyJsShellApiGapAudit?.summary?.primarySyncByteBatchMissingGlobals)
        && spiderMonkeyJsShellApiGapAudit.summary.primarySyncByteBatchMissingGlobals.length === 0
        && spiderMonkeyJsShellApiGapAudit.summary.binaryReadableShellCount === spiderMonkeyJsShellApiGapAudit.summary.shellCount;

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
        ? `${coverage.browser.safariBenchmarkRows.length} Safari/WebKit browser benchmark rows found with exact build identity, source-boundary evidence, and all accepted 1 GiB+ bounded primary sync byte-batch full-string cases.`
        : hasSafariRows
          ? [
            `${coverage.browser.safariBenchmarkRows.length} Safari/WebKit browser benchmark rows found, but the obligation is not closed.`,
            `exactBuildIdentityRecorded=${coverage.safariWebKitStatus.exactBuildIdentityRecorded}; sourceBoundaryPinned=${coverage.safariWebKitStatus.sourceBoundaryPinned}; directReadableStreamRowsAreSeparateEvidence=${coverage.safariWebKitStatus.directReadableStreamRowsAreSeparateEvidence}; directReadableStreamFullStringRows=${coverage.safariWebKitStatus.directReadableStreamFullStringRowsRecorded}; primarySyncByteBatchRows=${coverage.safariWebKitStatus.primarySyncByteBatchRowsRecorded}; boundedPrimarySyncByteBatchRows=${coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsRecorded}; largeBoundedPrimarySyncByteBatchRows=${coverage.safariWebKitStatus.largeBoundedPrimarySyncByteBatchRowsRecorded}; acceptedClosureCaseRows=${coverage.safariWebKitStatus.acceptedClosureCaseRowsRecorded}; acceptedClosureCaseIds=${(coverage.safariWebKitStatus.acceptedClosureCaseIdsRecorded ?? []).join(',') || 'none'}; allAcceptedClosureCasesRecorded=${coverage.safariWebKitStatus.allAcceptedClosureCasesRecorded}; acceptedLargeBoundedPrimarySyncByteBatchRows=${coverage.safariWebKitStatus.acceptedLargeBoundedPrimarySyncByteBatchRowsRecorded}; acceptedLargeBoundedPrimaryClosureCaseIds=${(coverage.safariWebKitStatus.acceptedLargeBoundedPrimaryClosureCaseIdsRecorded ?? []).join(',') || 'none'}; allAcceptedLargeBoundedPrimaryClosureCasesRecorded=${coverage.safariWebKitStatus.allAcceptedLargeBoundedPrimaryClosureCasesRecorded}; primaryRowsInSameContractComparison=${coverage.safariWebKitStatus.primaryRowsInSameContractComparison}; largePrimaryRowsInSameContractComparison=${coverage.safariWebKitStatus.largePrimaryRowsInSameContractComparison}; closesSafariObligation=${coverage.safariWebKitStatus.closesSafariObligation}.`,
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
      status: hasNodeCodegen && hasBunCodegen && hasChromeCodegen && hasDenoCodegen && hasSpiderMonkeyEmittedIrEvidence ? 'covered' : 'partial',
      evidence: [
        hasNodeCodegen ? 'Node/V8 trace evidence present.' : 'Node/V8 trace evidence missing.',
        hasBunCodegen ? 'Bun/JSC codegen/IR evidence present.' : 'Bun/JSC has profiler/source evidence but no codegen/IR artifact.',
        hasChromeCodegen ? 'Chrome/V8 browser codegen trace evidence present.' : 'Chrome/V8 browser codegen trace evidence missing.',
        hasDenoCodegen ? `Deno/V8 codegen trace evidence present (${denoTraceArtifacts.length} artifact${denoTraceArtifacts.length === 1 ? '' : 's'}).` : 'Deno/V8 codegen trace evidence missing.',
        hasSpiderMonkeyProfilerTrace ? 'Firefox/SpiderMonkey Gecko Profiler trace evidence present.' : 'Firefox/SpiderMonkey profiler trace evidence missing.',
        hasSpiderMonkeyJitSpewSourcePin ? 'Firefox/SpiderMonkey JitSpew/IONFLAGS source gate evidence present, but it is not emitted JIT IR.' : 'Firefox/SpiderMonkey JitSpew/IONFLAGS source gate evidence missing.',
        hasSpiderMonkeyBuildconfigSourcePin ? `Firefox/SpiderMonkey installed buildconfig source pin present (${spiderMonkeyBuildconfigSourcePin.limitation}).` : 'Firefox/SpiderMonkey installed buildconfig source pin missing.',
        hasSpiderMonkeyDiagnosticNoDump ? `Firefox/SpiderMonkey diagnostic dump audit was attempted and emitted no JIT diagnostic dump from this installed browser build (status=${spiderMonkeyDiagnosticDumpAudit.outcome.status}, dumpFiles=${spiderMonkeyDiagnosticDumpAudit.outcome.dumpFileCount ?? 'unknown'}).` : 'Firefox/SpiderMonkey diagnostic dump availability audit missing or did not complete as a no-dump result.',
        hasSpiderMonkeyTaskclusterDebugBrowserDiagnosticFailure ? `Firefox/SpiderMonkey Taskcluster debug browser diagnostic dump audit was attempted with FIREFOX_PATH=${spiderMonkeyTaskclusterDebugBrowserDiagnosticDumpAudit.parameters?.browserExecutable ?? 'unknown'} and failed before same-contract BiDi execution (status=${spiderMonkeyTaskclusterDebugBrowserDiagnosticDumpAudit.outcome.status}, exitCode=${spiderMonkeyTaskclusterDebugBrowserDiagnosticDumpAudit.outcome.exitCode ?? 'unknown'}, emittedDump=${spiderMonkeyTaskclusterDebugBrowserDiagnosticDumpAudit.outcome.emittedDump ?? 'unknown'}).` : 'Firefox/SpiderMonkey Taskcluster debug browser diagnostic dump audit missing or did not record a launch failure.',
        hasSpiderMonkeyJsShellAvailabilityAudit ? `Firefox/SpiderMonkey local js-shell availability audit present (status=${spiderMonkeyJsShellAvailabilityAudit.outcome?.status ?? 'unknown'}, found=${spiderMonkeyJsShellAvailabilityAudit.outcome?.foundCount ?? 'unknown'}, searchRoots=${spiderMonkeyJsShellAvailabilityAudit.parameters?.searchRoots?.length ?? 0}); no emitted JIT IR is recorded by that audit.` : 'Firefox/SpiderMonkey local js-shell availability audit missing.',
        hasSpiderMonkeyReleaseJsShellAvailabilityAudit ? `Firefox/SpiderMonkey official release js-shell audit present (status=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.status ?? 'unknown'}, packageVerified=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.packageVerified ?? 'unknown'}, jitStatus=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.hasJitExecutionStatus ?? 'unknown'}, irDumpSurface=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.hasIrDumpSurface ?? 'unknown'}, bytecodeDumpOutput=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.hasBytecodeDumpOutput ?? 'unknown'}, bytecodeDumpStatus=${spiderMonkeyReleaseJsShellAvailabilityAudit.shell?.bytecodeDumpProbe?.status ?? 'unknown'}, nativeDisassemblySurface=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.hasNativeDisassemblySurface ?? 'unknown'}, nativeDumpComplete=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.nativeDumpComplete ?? 'unknown'}, canReadBinaryInput=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.canReadBinaryInput ?? 'unknown'}, canRunCurrentStaxFullStringBenchmark=${spiderMonkeyReleaseJsShellAvailabilityAudit.outcome?.canRunCurrentStaxFullStringBenchmark ?? 'unknown'}); it is bytecode/JIT-status diagnostic evidence only, not emitted JIT IR.` : 'Firefox/SpiderMonkey official release js-shell audit missing.',
        hasSpiderMonkeyNightlyJsShellAvailabilityAudit ? `Firefox/SpiderMonkey official nightly js-shell audit present (status=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.status ?? 'unknown'}, packageVerified=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.packageVerified ?? 'unknown'}, jitStatus=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.hasJitExecutionStatus ?? 'unknown'}, irDumpSurface=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.hasIrDumpSurface ?? 'unknown'}, bytecodeDumpOutput=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.hasBytecodeDumpOutput ?? 'unknown'}, bytecodeDumpStatus=${spiderMonkeyNightlyJsShellAvailabilityAudit.shell?.bytecodeDumpProbe?.status ?? 'unknown'}, nativeDisassemblySurface=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.hasNativeDisassemblySurface ?? 'unknown'}, nativeDumpComplete=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.nativeDumpComplete ?? 'unknown'}, canReadBinaryInput=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.canReadBinaryInput ?? 'unknown'}, canRunCurrentStaxFullStringBenchmark=${spiderMonkeyNightlyJsShellAvailabilityAudit.outcome?.canRunCurrentStaxFullStringBenchmark ?? 'unknown'}); it is bytecode/JIT-status diagnostic evidence only, not emitted JIT IR.` : 'Firefox/SpiderMonkey official nightly js-shell audit missing.',
        hasStaxPublicReaderHostApiBoundary ? `Current StAX public reader host API boundary audit present (primarySyncByteBatchRequiresTextDecoder=${staxPublicReaderHostApiBoundary.summary?.primarySyncByteBatchRequiresTextDecoder ?? 'unknown'}, asciiPrimarySyncByteBatchRequiresTextDecoder=${staxPublicReaderHostApiBoundary.summary?.asciiPrimarySyncByteBatchRequiresTextDecoder ?? 'unknown'}, utf8FallbackDecoder=${staxPublicReaderHostApiBoundary.summary?.utf8FallbackDecoder ?? 'unknown'}, nonUtf8RequiresTextDecoder=${staxPublicReaderHostApiBoundary.summary?.nonUtf8RequiresTextDecoder ?? 'unknown'}, directReadableStreamRequiresReadableStream=${staxPublicReaderHostApiBoundary.summary?.directReadableStreamRequiresReadableStream ?? 'unknown'}, stringInputRequiresTextEncoder=${staxPublicReaderHostApiBoundary.summary?.stringInputRequiresTextEncoder ?? 'unknown'}, eventReaderSyncDocumentStringInputRequiresTextEncoder=${staxPublicReaderHostApiBoundary.summary?.eventReaderSyncDocumentStringInputRequiresTextEncoder ?? 'unknown'}, xmlObjectStringInputRequiresTextEncoder=${staxPublicReaderHostApiBoundary.summary?.xmlObjectStringInputRequiresTextEncoder ?? 'unknown'}, projectionCompileAndStringInputRequiresTextEncoder=${staxPublicReaderHostApiBoundary.summary?.projectionCompileAndStringInputRequiresTextEncoder ?? 'unknown'}, compiledConverterStringInputRequiresTextEncoder=${staxPublicReaderHostApiBoundary.summary?.compiledConverterStringInputRequiresTextEncoder ?? 'unknown'}, rootImportRequiresTextEncoder=${staxPublicReaderHostApiBoundary.summary?.rootImportRequiresTextEncoder ?? 'unknown'}, asyncWriterOutputRequiresTextEncoder=${staxPublicReaderHostApiBoundary.summary?.asyncWriterOutputRequiresTextEncoder ?? 'unknown'}, syncWriterOutputRequiresTextEncoder=${staxPublicReaderHostApiBoundary.summary?.syncWriterOutputRequiresTextEncoder ?? 'unknown'}, alternateDecoderWouldBeUnchangedClosure=${staxPublicReaderHostApiBoundary.summary?.alternateDecoderWouldBeUnchangedClosure ?? 'unknown'}); it pins why UTF-8 primary byte-batch materialization can run without host TextDecoder while string-input adapters, projection compile keys, compiled converter string input, non-UTF-8 decoding, writer output, and non-primary harness globals remain separate.` : 'Current StAX public reader host API boundary audit missing.',
        hasSpiderMonkeyJsShellApiGapAudit ? `Firefox/SpiderMonkey js-shell StAX API gap audit present (status=${spiderMonkeyJsShellApiGapAudit.summary?.status ?? 'unknown'}, unchangedRunnableShells=${spiderMonkeyJsShellApiGapAudit.summary?.unchangedRunnableShellCount ?? 'unknown'}/${spiderMonkeyJsShellApiGapAudit.summary?.shellCount ?? 'unknown'}, blockedSurfaces=${spiderMonkeyJsShellApiGapAudit.summary?.blockedSurfaceCount ?? 'unknown'}, directUnchangedHarnessAttemptsBlocked=${spiderMonkeyJsShellApiGapAudit.summary?.blockedDirectUnchangedHarnessAttemptCount ?? 'unknown'}/${spiderMonkeyJsShellApiGapAudit.summary?.directUnchangedHarnessAttemptCount ?? 'unknown'}, unchangedHarnessMissingGlobals=${(spiderMonkeyJsShellApiGapAudit.summary?.unchangedHarnessMissingGlobals ?? spiderMonkeyJsShellApiGapAudit.summary?.commonMissingGlobals ?? []).join(', ') || 'none'}, primarySyncByteBatchMissingGlobals=${(spiderMonkeyJsShellApiGapAudit.summary?.primarySyncByteBatchMissingGlobals ?? []).join(', ') || 'none'}, primaryPathRunnableWithoutHostEncoding=${spiderMonkeyPrimaryPathRunnableWithoutHostEncoding}, nonPrimaryHarnessMissingGlobals=${(spiderMonkeyJsShellApiGapAudit.summary?.nonPrimaryHarnessMissingGlobals ?? []).join(', ') || 'none'}); it is host API surface evidence only, not emitted JIT IR.` : 'Firefox/SpiderMonkey js-shell StAX API gap audit missing.',
        hasSpiderMonkeyJsShellDiagnosticFlagSweep ? `Firefox/SpiderMonkey public js-shell diagnostic flag sweep present (bytecodeProbes=${spiderMonkeyJsShellDiagnosticFlagSweep.outcome?.bytecodeProbeCount ?? 'unknown'}, bytecodeOutputProbes=${spiderMonkeyJsShellDiagnosticFlagSweep.outcome?.bytecodeOutputProbeCount ?? 'unknown'}, diagnosticPrefSurface=${spiderMonkeyJsShellDiagnosticFlagSweep.outcome?.hasDiagnosticPrefSurface ?? 'unknown'}); it rules out easy public-shell bytecode/dump flag paths but is not emitted JIT IR.` : 'Firefox/SpiderMonkey public js-shell diagnostic flag sweep missing.',
        hasSpiderMonkeyTaskclusterDebugCodegen ? `Firefox/SpiderMonkey current Taskcluster debug js-shell codegen audit present (taskId=${spiderMonkeyTaskclusterDebugCodegen.taskId ?? 'unknown'}, buildId=${spiderMonkeyTaskclusterDebugCodegen.buildId ?? 'unknown'}, sourceRevision=${spiderMonkeyTaskclusterDebugCodegen.sourceRevision ?? 'unknown'}, codegenDump=${spiderMonkeyTaskclusterDebugCodegen.hasCodegenDumpOutput ?? 'unknown'}, sameContractStaxRow=${spiderMonkeyTaskclusterDebugCodegen.sameContractStaxRow ?? 'unknown'}, canRunCurrentStaxFullStringBenchmark=${spiderMonkeyTaskclusterDebugCodegen.canRunCurrentStaxFullStringBenchmark ?? 'unknown'}, selectedRowIdentityStatus=${spiderMonkeyTaskclusterDebugCodegen.selectedRowIdentityStatus ?? 'unknown'}); it proves a current diagnostic shell path but is not emitted codegen for a same-contract StAX row.` : 'Firefox/SpiderMonkey current Taskcluster debug js-shell codegen audit missing.',
        hasSpiderMonkeyTaskclusterDebugXmlCodegen ? `Firefox/SpiderMonkey current Taskcluster debug js-shell XML workload codegen audit present (taskId=${spiderMonkeyTaskclusterDebugXmlCodegen.taskId ?? 'unknown'}, buildId=${spiderMonkeyTaskclusterDebugXmlCodegen.buildId ?? 'unknown'}, sourceRevision=${spiderMonkeyTaskclusterDebugXmlCodegen.sourceRevision ?? 'unknown'}, codegenDump=${spiderMonkeyTaskclusterDebugXmlCodegen.hasCodegenDumpOutput ?? 'unknown'}, sameContractStaxRow=${spiderMonkeyTaskclusterDebugXmlCodegen.sameContractStaxRow ?? 'unknown'}, canRunCurrentStaxFullStringBenchmark=${spiderMonkeyTaskclusterDebugXmlCodegen.canRunCurrentStaxFullStringBenchmark ?? 'unknown'}, selectedRowIdentityStatus=${spiderMonkeyTaskclusterDebugXmlCodegen.selectedRowIdentityStatus ?? 'unknown'}); it ties the current diagnostic shell to an XML byte-tokenizer workload but is still not emitted codegen for a same-contract full-string StAX row.` : 'Firefox/SpiderMonkey current Taskcluster debug js-shell XML workload codegen audit missing.',
        hasSpiderMonkeyTaskclusterDebugMaterializedCodegen ? `Firefox/SpiderMonkey current Taskcluster debug js-shell materialized string/object codegen audit present (taskId=${spiderMonkeyTaskclusterDebugMaterializedCodegen.taskId ?? 'unknown'}, buildId=${spiderMonkeyTaskclusterDebugMaterializedCodegen.buildId ?? 'unknown'}, sourceRevision=${spiderMonkeyTaskclusterDebugMaterializedCodegen.sourceRevision ?? 'unknown'}, codegenDump=${spiderMonkeyTaskclusterDebugMaterializedCodegen.hasCodegenDumpOutput ?? 'unknown'}, sameContractStaxRow=${spiderMonkeyTaskclusterDebugMaterializedCodegen.sameContractStaxRow ?? 'unknown'}, canRunCurrentStaxFullStringBenchmark=${spiderMonkeyTaskclusterDebugMaterializedCodegen.canRunCurrentStaxFullStringBenchmark ?? 'unknown'}, selectedRowIdentityStatus=${spiderMonkeyTaskclusterDebugMaterializedCodegen.selectedRowIdentityStatus ?? 'unknown'}); it ties the current diagnostic shell to JS string and event-object materialization but is still not the unchanged full-string StAX benchmark.` : 'Firefox/SpiderMonkey current Taskcluster debug js-shell materialized string/object codegen audit missing.',
        hasSpiderMonkeyCodegenRerunStability ? `Firefox/SpiderMonkey codegen rerun stability audit present (pairs=${spiderMonkeyCodegenRerunStability.summary?.pairCount ?? 'unknown'}, reproduciblePairs=${spiderMonkeyCodegenRerunStability.summary?.reproduciblePairs ?? 'unknown'}, sameTaskclusterBuildPairs=${spiderMonkeyCodegenRerunStability.summary?.sameTaskclusterBuildPairs ?? 'unknown'}, sameCodegenMarkerPairs=${spiderMonkeyCodegenRerunStability.summary?.sameCodegenMarkerPairs ?? 'unknown'}, qualifiedClosureCount=${spiderMonkeyCodegenRerunStability.summary?.qualifiedClosureCount ?? 'unknown'}, throughputCountsAsTargetEvidence=${spiderMonkeyCodegenRerunStability.summary?.throughputCountsAsTargetEvidence ?? 'unknown'}); it proves diagnostic rerun reproducibility but still not same-contract StAX closure.` : 'Firefox/SpiderMonkey codegen rerun stability audit missing.',
        hasSpiderMonkeyAsciiScopeDistance ? `Firefox/SpiderMonkey ASCII scope-distance audit present (corpusFileCount=${spiderMonkeyAsciiScopeDistance.summary?.corpusFileCount ?? 'unknown'}, allCorpusFilesAscii=${spiderMonkeyAsciiScopeDistance.summary?.allCorpusFilesAscii ?? 'unknown'}, asciiByteToStringEquivalentToUtf8=${spiderMonkeyAsciiScopeDistance.summary?.asciiByteToStringEquivalentToUtf8 ?? 'unknown'}, semanticMaterializedWorkload=${spiderMonkeyAsciiScopeDistance.summary?.semanticMaterializedWorkload ?? 'unknown'}, reducesScopeDistance=${spiderMonkeyAsciiScopeDistance.summary?.reducesScopeDistance ?? 'unknown'}, closesCodegenObligation=${spiderMonkeyAsciiScopeDistance.summary?.closesCodegenObligation ?? 'unknown'}); it narrows ASCII materialized js-shell scope but is not unchanged StAX closure evidence.` : 'Firefox/SpiderMonkey ASCII scope-distance audit missing.',
        hasSpiderMonkeyMaterializedScopeDistance ? `Firefox/SpiderMonkey materialized scope-distance audit present (semanticEquivalentForAsciiFields=${spiderMonkeyMaterializedScopeDistance.outcome?.semanticEquivalentForAsciiFields ?? spiderMonkeyMaterializedScopeDistance.summary?.semanticEquivalentForAsciiFields ?? 'unknown'}, closureRequirementsMet=${spiderMonkeyMaterializedScopeDistance.summary?.closureRequirementsMet ?? 'unknown'}, closureRequirementsBlocked=${spiderMonkeyMaterializedScopeDistance.summary?.closureRequirementsBlocked ?? 'unknown'}, primarySyncByteBatchMissingGlobals=${(spiderMonkeyMaterializedScopeDistance.hostApiSurface?.primarySyncByteBatchMissingGlobals ?? []).join(', ') || 'none'}, asciiTextDecoderEquivalent=${spiderMonkeyMaterializedScopeDistance.asciiScopeDistance?.asciiByteToStringEquivalentToUtf8 ?? 'unknown'}, diagnosticThroughputMiBPerSec=${spiderMonkeyMaterializedScopeDistance.summary?.diagnosticThroughputMiBPerSec ?? 'unknown'}, throughputCountsAsTargetEvidence=${spiderMonkeyMaterializedScopeDistance.summary?.throughputCountsAsTargetEvidence ?? 'unknown'}, closesCodegenObligation=${spiderMonkeyMaterializedScopeDistance.outcome?.closesCodegenObligation ?? spiderMonkeyMaterializedScopeDistance.summary?.closesCodegenObligation ?? 'unknown'}); it records why the materialized js-shell codegen artifact is useful but still not closure evidence.` : 'Firefox/SpiderMonkey materialized scope-distance audit missing.',
        coverage.spiderMonkeyDiagnostics.closureAuditQualifiedClosureCount > 0
          ? `Firefox/SpiderMonkey same-contract emitted codegen closure evidence present (qualifiedClosureCount=${coverage.spiderMonkeyDiagnostics.closureAuditQualifiedClosureCount}).`
          : hasSpiderMonkeyEmittedIrEvidence
            ? 'Firefox/SpiderMonkey emitted JIT IR or optimized-code dump evidence present.'
            : 'Firefox/SpiderMonkey emitted JIT IR or optimized-code dump evidence missing.',
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
  if (sourceArtifact.startsWith('spidermonkey-jsshell-') || sourceArtifact.startsWith('spidermonkey-archival-debug-jsshell-') || sourceArtifact.startsWith('spidermonkey-taskcluster-debug-jsshell-')) return 'spidermonkey-jsshell';
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

  if (runtimeOrder.includes(node.runtimeId) && node.runtimeId !== 'unknown') return node.runtimeId;
  if (runtimeOrder.includes(runtime.id) && runtime.id !== 'unknown') return runtime.id;
  if (runtimeName === 'bun' || sourceArtifact.startsWith('bun-')) return 'bun-jsc';
  if (runtimeName === 'deno') return 'deno-v8';
  if (
    runtimeName === 'spidermonkey-jsshell'
    || runtime.id === 'spidermonkey-jsshell'
    || sourceArtifact.startsWith('spidermonkey-jsshell-')
    || sourceArtifact.startsWith('spidermonkey-archival-debug-jsshell-')
    || sourceArtifact.startsWith('spidermonkey-taskcluster-debug-jsshell-')
  ) return 'spidermonkey-jsshell';
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
  if (memory.primaryKind === 'not-recorded') return 'not-recorded';
  if (
    typeof memory.maxJsHeapUsedBytes === 'number'
    || typeof memory.maxJsHeapUsedMiB === 'number'
    || typeof memory.peakJsHeapUsedMiB === 'number'
  ) return 'browser-js-heap';
  if (
    typeof memory.maxRssBytes === 'number'
    || typeof memory.peakRssBytes === 'number'
    || typeof memory.maxRssMiB === 'number'
    || typeof memory.peakRssMiB === 'number'
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
  if (!environment || typeof environment !== 'object') return {
    runtimeName: null,
    browserName: null,
    browserVersion: null,
    javascriptEngine: null,
    userAgent: null,
    v8: null,
    webkitCommit: null,
  };
  return {
    runtimeName: environment.runtimeName ?? null,
    browserName: environment.browserName ?? null,
    browserVersion: environment.browserVersion ?? null,
    javascriptEngine: environment.javascriptEngine ?? null,
    userAgent: environment.userAgent ?? null,
    v8: environment.v8 ?? null,
    webkitCommit: environment.webkitCommit ?? null,
  };
}

function summarizeHostApiSurface(hostApiSurface = {}) {
  if (!hostApiSurface || typeof hostApiSurface !== 'object') return null;
  const result = {
    primarySyncByteBatchSurfaceId: hostApiSurface.primarySyncByteBatchSurfaceId ?? null,
    commonMissingGlobals: Array.isArray(hostApiSurface.commonMissingGlobals)
      ? hostApiSurface.commonMissingGlobals
      : null,
    primarySyncByteBatchMissingGlobals: Array.isArray(hostApiSurface.primarySyncByteBatchMissingGlobals)
      ? hostApiSurface.primarySyncByteBatchMissingGlobals
      : null,
    nonPrimaryHarnessMissingGlobals: Array.isArray(hostApiSurface.nonPrimaryHarnessMissingGlobals)
      ? hostApiSurface.nonPrimaryHarnessMissingGlobals
      : null,
  };
  return Object.values(result).some(value => value !== null) ? result : null;
}

function summarizeAsciiScopeDistance(asciiScopeDistance = {}) {
  if (!asciiScopeDistance || typeof asciiScopeDistance !== 'object') return null;
  const result = {
    reducesScopeDistance: typeof asciiScopeDistance.reducesScopeDistance === 'boolean'
      ? asciiScopeDistance.reducesScopeDistance
      : null,
    materializedCorpusSeedAscii: typeof asciiScopeDistance.materializedCorpusSeedAscii === 'boolean'
      ? asciiScopeDistance.materializedCorpusSeedAscii
      : null,
    asciiByteToStringEquivalentToUtf8: typeof asciiScopeDistance.asciiByteToStringEquivalentToUtf8 === 'boolean'
      ? asciiScopeDistance.asciiByteToStringEquivalentToUtf8
      : null,
    allCorpusFilesAscii: typeof asciiScopeDistance.allCorpusFilesAscii === 'boolean'
      ? asciiScopeDistance.allCorpusFilesAscii
      : null,
    closesCodegenObligation: typeof asciiScopeDistance.closesCodegenObligation === 'boolean'
      ? asciiScopeDistance.closesCodegenObligation
      : null,
  };
  return Object.values(result).some(value => value !== null) ? result : null;
}

function summarizeOutcome(outcome = {}) {
  if (!outcome || typeof outcome !== 'object') return null;
  const summary = {
    status: outcome.status ?? null,
    evidenceClass: typeof outcome.evidenceClass === 'string' ? outcome.evidenceClass : null,
    completed: typeof outcome.completed === 'boolean' ? outcome.completed : null,
    canStartDebugBrowser: typeof outcome.canStartDebugBrowser === 'boolean' ? outcome.canStartDebugBrowser : null,
    emittedDump: typeof outcome.emittedDump === 'boolean' ? outcome.emittedDump : null,
    dumpFileCount: typeof outcome.dumpFileCount === 'number' ? outcome.dumpFileCount : null,
    attemptCount: typeof outcome.attemptCount === 'number' ? outcome.attemptCount : null,
    dllBlocklistFailureCount: typeof outcome.dllBlocklistFailureCount === 'number' ? outcome.dllBlocklistFailureCount : null,
    disableDllBlocklistChangedFailure: typeof outcome.disableDllBlocklistChangedFailure === 'boolean' ? outcome.disableDllBlocklistChangedFailure : null,
    exitCode: typeof outcome.exitCode === 'number' ? outcome.exitCode : null,
    signal: typeof outcome.signal === 'string' ? outcome.signal : null,
    timedOut: typeof outcome.timedOut === 'boolean' ? outcome.timedOut : null,
    foundCount: typeof outcome.foundCount === 'number' ? outcome.foundCount : null,
    foundCandidates: Array.isArray(outcome.foundCandidates) ? outcome.foundCandidates : null,
    packageVerified: typeof outcome.packageVerified === 'boolean' ? outcome.packageVerified : null,
    hasJitExecutionStatus: typeof outcome.hasJitExecutionStatus === 'boolean' ? outcome.hasJitExecutionStatus : null,
    hasIrDumpSurface: typeof outcome.hasIrDumpSurface === 'boolean' ? outcome.hasIrDumpSurface : null,
    hasCodegenDumpOutput: typeof outcome.hasCodegenDumpOutput === 'boolean' ? outcome.hasCodegenDumpOutput : null,
    hasAsciiCurrentStaxCodegenOutput: typeof outcome.hasAsciiCurrentStaxCodegenOutput === 'boolean' ? outcome.hasAsciiCurrentStaxCodegenOutput : null,
    hasUtf8CurrentStaxCodegenOutput: typeof outcome.hasUtf8CurrentStaxCodegenOutput === 'boolean' ? outcome.hasUtf8CurrentStaxCodegenOutput : null,
    hasXmlWorkloadCodegenOutput: typeof outcome.hasXmlWorkloadCodegenOutput === 'boolean' ? outcome.hasXmlWorkloadCodegenOutput : null,
    hasMaterializedStringObjectCodegenOutput: typeof outcome.hasMaterializedStringObjectCodegenOutput === 'boolean' ? outcome.hasMaterializedStringObjectCodegenOutput : null,
    hasBytecodeDumpOutput: typeof outcome.hasBytecodeDumpOutput === 'boolean' ? outcome.hasBytecodeDumpOutput : null,
    bytecodeProbeCount: typeof outcome.bytecodeProbeCount === 'number' ? outcome.bytecodeProbeCount : null,
    bytecodeOutputProbeCount: typeof outcome.bytecodeOutputProbeCount === 'number' ? outcome.bytecodeOutputProbeCount : null,
    irOrCodegenProbeCount: typeof outcome.irOrCodegenProbeCount === 'number' ? outcome.irOrCodegenProbeCount : null,
    hasDiagnosticPrefSurface: typeof outcome.hasDiagnosticPrefSurface === 'boolean' ? outcome.hasDiagnosticPrefSurface : null,
    hasNativeDisassemblySurface: typeof outcome.hasNativeDisassemblySurface === 'boolean' ? outcome.hasNativeDisassemblySurface : null,
    nativeDumpComplete: typeof outcome.nativeDumpComplete === 'boolean' ? outcome.nativeDumpComplete : null,
    scopeComparableToCurrentFirefox: typeof outcome.scopeComparableToCurrentFirefox === 'boolean' ? outcome.scopeComparableToCurrentFirefox : null,
    sameContractStaxRow: typeof outcome.sameContractStaxRow === 'boolean' ? outcome.sameContractStaxRow : null,
    currentStaxAsciiPrimaryByteBatchRow: typeof outcome.currentStaxAsciiPrimaryByteBatchRow === 'boolean' ? outcome.currentStaxAsciiPrimaryByteBatchRow : null,
    currentStaxUtf8PrimaryByteBatchRow: typeof outcome.currentStaxUtf8PrimaryByteBatchRow === 'boolean' ? outcome.currentStaxUtf8PrimaryByteBatchRow : null,
    canReadBinaryInput: typeof outcome.canReadBinaryInput === 'boolean' ? outcome.canReadBinaryInput : null,
    canRunCurrentStaxFullStringBenchmark: typeof outcome.canRunCurrentStaxFullStringBenchmark === 'boolean' ? outcome.canRunCurrentStaxFullStringBenchmark : null,
    canRunAsciiPrimaryByteBatchBenchmark: typeof outcome.canRunAsciiPrimaryByteBatchBenchmark === 'boolean' ? outcome.canRunAsciiPrimaryByteBatchBenchmark : null,
    canRunUtf8PrimaryByteBatchBenchmark: typeof outcome.canRunUtf8PrimaryByteBatchBenchmark === 'boolean' ? outcome.canRunUtf8PrimaryByteBatchBenchmark : null,
    closesEmittedIrObligation: typeof outcome.closesEmittedIrObligation === 'boolean' ? outcome.closesEmittedIrObligation : null,
    selectedRowId: typeof outcome.selectedRowId === 'string'
      ? outcome.selectedRowId
      : typeof outcome.selectedCaseId === 'string'
        ? outcome.selectedCaseId
        : typeof outcome.rowId === 'string'
          ? outcome.rowId
          : null,
    selectedEventCount: typeof outcome.selectedEventCount === 'number'
      ? outcome.selectedEventCount
      : typeof outcome.eventCount === 'number'
        ? outcome.eventCount
        : null,
    selectedChecksum: outcome.selectedChecksum ?? outcome.checksum ?? null,
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
  const codegenProbe = summarizeCodegenProbe(shell.codegenProbe);
  const xmlCodegenProbe = summarizeCodegenProbe(shell.xmlCodegenProbe);
  const materializedCodegenProbe = summarizeCodegenProbe(shell.materializedCodegenProbe);
  const provenance = shell.provenance && typeof shell.provenance === 'object'
    ? {
        taskId: shell.provenance.taskId ?? null,
        route: shell.provenance.route ?? null,
        artifactName: shell.provenance.artifactName ?? null,
        artifactBytes: typeof shell.provenance.artifactBytes === 'number' ? shell.provenance.artifactBytes : null,
        buildId: shell.provenance.buildId ?? shell.provenance.targetTxt?.buildId ?? shell.provenance.buildhub?.buildId ?? null,
        sourceRevision: shell.provenance.sourceRevision ?? shell.provenance.targetTxt?.sourceRevision ?? shell.provenance.buildhub?.sourceRevision ?? null,
        targetVersion: shell.provenance.buildhub?.targetVersion ?? null,
        debug: typeof shell.provenance.mozinfo?.debug === 'boolean' ? shell.provenance.mozinfo.debug : null,
        official: typeof shell.provenance.mozinfo?.official === 'boolean' ? shell.provenance.mozinfo.official : null,
      }
    : null;
  const summary = {
    ...(bytecodeDumpProbe ? { bytecodeDumpProbe } : {}),
    ...(codegenProbe ? { codegenProbe } : {}),
    ...(xmlCodegenProbe ? { xmlCodegenProbe } : {}),
    ...(materializedCodegenProbe ? { materializedCodegenProbe } : {}),
    ...(provenance ? { provenance } : {}),
  };
  return Object.keys(summary).length > 0 ? summary : null;
}

function summarizeCodegenProbe(probe) {
  if (!probe || typeof probe !== 'object') return null;
  return {
    status: probe.status ?? null,
    flags: probe.flags ?? null,
    outputBytes: typeof probe.outputBytes === 'number' ? probe.outputBytes : null,
    codegenMarkerCount: typeof probe.codegenMarkerCount === 'number' ? probe.codegenMarkerCount : null,
    ionScriptMarkerCount: typeof probe.ionScriptMarkerCount === 'number' ? probe.ionScriptMarkerCount : null,
    assemblyMnemonicCount: typeof probe.assemblyMnemonicCount === 'number' ? probe.assemblyMnemonicCount : null,
  };
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
    ...(artifact.hostApiSurface ? { hostApiSurface: artifact.hostApiSurface } : {}),
    ...(artifact.asciiScopeDistance ? { asciiScopeDistance: artifact.asciiScopeDistance } : {}),
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
    `  - Unknown full-string parity JS rows: ${report.summary.unknownFullStringParityBreakdown.jsRows}`,
    `  - Unknown full-string parity bounded rows: ${report.summary.unknownFullStringParityBreakdown.boundedRows}`,
    `  - Unknown full-string parity 1 GiB+ JS rows: ${report.summary.unknownFullStringParityBreakdown.largeJsRows}`,
    `  - Unknown full-string parity rows at or above threshold: ${report.summary.unknownFullStringParityBreakdown.atOrAboveThresholdRows}`,
    `  - Unknown full-string parity counterexample-relevant rows: ${report.summary.unknownFullStringParityBreakdown.counterexampleRelevantRows}`,
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
    '## Unknown Full-String Parity Rows',
    '',
    'These rows have throughput metadata but do not claim whether they satisfy the full-string contract. They are listed with row-level exclusion reasons so unknown parity cannot silently hide a 200 MiB/s bounded full-string JavaScript counterexample.',
    '',
    '| Artifact | Runtime | Row | Size GiB | Bounded memory | MiB/s | Counterexample relevant | Exclusion reason |',
    '| --- | --- | --- | ---: | --- | ---: | --- | --- |',
  );
  if (report.unknownFullStringParityRows.length === 0) {
    lines.push('| none | | | | | | | |');
  } else {
    for (const row of report.unknownFullStringParityRows) {
      lines.push(`| \`${row.sourceArtifact}\` | ${row.runtimeLabel} | \`${row.id}\` | ${formatNumber(row.sizeGiB)} | ${formatBoolean(row.boundedMemory)} | ${formatNumber(row.mibPerSec)} | ${formatBoolean(row.counterexampleRelevant)} | ${row.counterexampleExclusionReason} |`);
    }
  }
  lines.push('');

  lines.push(
    '## Unknown Bounded-Memory Rows',
    '',
    'These rows have enough throughput/parity metadata to be recognized, but no row-level memory counter or bounded-memory flag. They are listed so remaining unknowns are auditable rather than only counted. The counterexample-relevant subset is 1 GiB+ JavaScript full-string rows, and is summarized separately above.',
    '',
    '| Artifact | Runtime | Row | Size GiB | Memory | Full string | MiB/s | Counterexample relevant | Exclusion reason |',
    '| --- | --- | --- | ---: | --- | --- | ---: | --- | --- |',
  );
  if (report.unknownBoundedMemoryRows.length === 0) {
    lines.push('| none | | | | | | | | |');
  } else {
    for (const row of report.unknownBoundedMemoryRows) {
      lines.push(`| \`${row.sourceArtifact}\` | ${row.runtimeLabel} | \`${row.id}\` | ${formatNumber(row.sizeGiB)} | ${row.memoryKind} | ${formatBoolean(row.fullStringParity)} | ${formatNumber(row.mibPerSec)} | ${formatBoolean(row.counterexampleRelevant)} | ${row.counterexampleExclusionReason} |`);
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
    `Safari/WebKit availability closure requirements: met=${report.coverage.safariWebKitStatus.availabilityClosureRequirementsMet ?? 'n/a'}, blocked=${report.coverage.safariWebKitStatus.availabilityClosureRequirementsBlocked ?? 'n/a'}`,
    `Safari/WebKit direct ReadableStream rows separate: ${formatBoolean(report.coverage.safariWebKitStatus.directReadableStreamRowsAreSeparateEvidence)}`,
    `Safari/WebKit rows with measured exact build identity: ${report.coverage.safariWebKitStatus.measuredExactBuildIdentityRowsRecorded}`,
    `Safari/WebKit 1 GiB+ bounded primary rows with measured exact build identity: ${report.coverage.safariWebKitStatus.largeBoundedPrimarySyncByteBatchRowsWithMeasuredExactBuildIdentity}`,
    `Safari/WebKit rows with row-level source pins: ${report.coverage.safariWebKitStatus.rowLevelSourceBoundaryPinnedRowsRecorded}`,
    `Safari/WebKit 1 GiB+ bounded primary rows with row-level source pins: ${report.coverage.safariWebKitStatus.largeBoundedPrimarySyncByteBatchRowsWithRowLevelSourceBoundaryPin}`,
    `Safari/WebKit accepted closure case rows: ${report.coverage.safariWebKitStatus.acceptedClosureCaseRowsRecorded}`,
    `Safari/WebKit accepted closure case ids: ${(report.coverage.safariWebKitStatus.acceptedClosureCaseIdsRecorded ?? []).join(', ') || 'none'}`,
    `Safari/WebKit all accepted closure cases recorded: ${formatBoolean(report.coverage.safariWebKitStatus.allAcceptedClosureCasesRecorded)}`,
    `Safari/WebKit accepted 1 GiB+ bounded primary rows: ${report.coverage.safariWebKitStatus.acceptedLargeBoundedPrimarySyncByteBatchRowsRecorded}`,
    `Safari/WebKit accepted 1 GiB+ bounded primary case ids: ${(report.coverage.safariWebKitStatus.acceptedLargeBoundedPrimaryClosureCaseIdsRecorded ?? []).join(', ') || 'none'}`,
    `Safari/WebKit all accepted 1 GiB+ bounded primary cases recorded: ${formatBoolean(report.coverage.safariWebKitStatus.allAcceptedLargeBoundedPrimaryClosureCasesRecorded)}`,
    `Safari/WebKit primary rows in same-contract comparison: ${formatBoolean(report.coverage.safariWebKitStatus.primaryRowsInSameContractComparison)}`,
    `Safari/WebKit 1 GiB+ bounded primary rows in same-contract comparison: ${formatBoolean(report.coverage.safariWebKitStatus.largePrimaryRowsInSameContractComparison)}`,
    `Safari/WebKit obligation closed: ${formatBoolean(report.coverage.safariWebKitStatus.closesSafariObligation)}`,
    '',
    '| Availability artifact | macOS host | Safari executable | safaridriver | Harness support | Runnable here | Browser rows | Full rows | Primary sync rows | Bounded primary rows | 1 GiB+ bounded primary rows | Accepted case rows | Accepted 1 GiB+ primary rows | Comparison primary rows | 1 GiB+ comparison primary rows | Exact build identity | Source boundary pinned |',
    '| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
    `| ${formatOptionalArtifact(report.coverage.safariWebKitStatus.availabilityArtifact)} | ${formatBoolean(report.coverage.safariWebKitStatus.hostIsMacOS)} | ${formatBoolean(report.coverage.safariWebKitStatus.safariExecutableFound)} | ${formatBoolean(report.coverage.safariWebKitStatus.safaridriverFound)} | ${formatBoolean(report.coverage.safariWebKitStatus.harnessSupportsSafari)} | ${formatBoolean(report.coverage.safariWebKitStatus.canRunSafariBrowserRows)} | ${report.coverage.safariWebKitStatus.benchmarkRowsRecorded} | ${report.coverage.safariWebKitStatus.fullStringRowsRecorded} | ${report.coverage.safariWebKitStatus.primarySyncByteBatchRowsRecorded} | ${report.coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsRecorded} | ${report.coverage.safariWebKitStatus.largeBoundedPrimarySyncByteBatchRowsRecorded} | ${report.coverage.safariWebKitStatus.acceptedClosureCaseRowsRecorded} | ${report.coverage.safariWebKitStatus.acceptedLargeBoundedPrimarySyncByteBatchRowsRecorded} | ${report.coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsInSameContractComparison} | ${report.coverage.safariWebKitStatus.largeBoundedPrimarySyncByteBatchRowsInSameContractComparison} | ${formatBoolean(report.coverage.safariWebKitStatus.exactBuildIdentityRecorded)} | ${formatBoolean(report.coverage.safariWebKitStatus.sourceBoundaryPinned)} |`,
  );

  lines.push(
    '',
    '## SpiderMonkey Diagnostic Surface',
    '',
    `Emitted SpiderMonkey IR/codegen evidence artifacts: ${report.coverage.spiderMonkeyDiagnostics.emittedIrEvidenceCount}`,
    `Raw SpiderMonkey emitted-IR closure claims: ${report.coverage.spiderMonkeyDiagnostics.emittedIrClaimCount}`,
    `SpiderMonkey diagnostics rows vs closure candidates: ${report.coverage.spiderMonkeyDiagnostics.diagnosticRowCount ?? 'unknown'}/${report.coverage.spiderMonkeyDiagnostics.closureAuditCandidateCount ?? 'unknown'} (gap=${report.coverage.spiderMonkeyDiagnostics.closureAuditDiagnosticRowGap ?? 'unknown'}, closureQualified=${report.coverage.spiderMonkeyDiagnostics.closureAuditQualifiedClosureCount ?? 'unknown'})`,
    `SpiderMonkey debug browser preflight: ${report.coverage.spiderMonkeyDiagnostics.browserPreflight?.status ?? 'not-recorded'} from ${report.coverage.spiderMonkeyDiagnostics.browserPreflight?.sourceArtifact ?? 'none'}`,
    `SpiderMonkey closure candidates outside coverage diagnostics: ${formatStringList(report.coverage.spiderMonkeyDiagnostics.closureAuditCandidateSourcesOutsideDiagnostics)}`,
    `SpiderMonkey coverage diagnostics outside closure candidates: ${formatStringList(report.coverage.spiderMonkeyDiagnostics.diagnosticSourcesOutsideClosureAudit)}`,
    `SpiderMonkey selected row identity statuses: ${formatCountMap(report.coverage.spiderMonkeyDiagnostics.selectedRowIdentityStatusCounts)}`,
    `JIT-status-only SpiderMonkey shell artifacts: ${report.coverage.spiderMonkeyDiagnostics.jitStatusOnlyCount}`,
    '',
    '| Diagnostic | Artifact | Status | Evidence class | JIT status | IR surface | Bytecode dump | Native dump complete | Current stax benchmark | Selected row identity | Selected row metadata | Comparison match | Closes emitted IR obligation | Closure qualified |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const row of report.coverage.spiderMonkeyDiagnostics.rows) {
    lines.push(`| \`${row.id}\` | \`${row.sourceArtifact}\` | ${row.status} | ${row.evidenceClass} | ${formatBoolean(row.hasJitExecutionStatus)} | ${formatBoolean(row.irDumpSurface)} | ${formatBytecodeDump(row)} | ${formatBoolean(row.nativeDumpComplete)} | ${formatBoolean(row.canRunCurrentStaxFullStringBenchmark)} | ${row.selectedRowIdentityStatus ?? 'unknown'} | ${formatBoolean(row.selectedRowMetadataComplete)} | ${formatBoolean(row.selectedRowMatchesCurrentComparison)} | ${formatBoolean(row.closesEmittedIrObligation)} | ${formatBoolean(row.emittedIrClosureQualified)} |`);
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
    case 'spidermonkey-jsshell':
      return 'SpiderMonkey js-shell';
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
  return ['node-v8', 'bun-jsc', 'deno-v8', 'spidermonkey-jsshell', 'chrome-v8-browser', 'firefox-spidermonkey-browser', 'safari-jsc-browser'].includes(runtimeId);
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

function countStringValues(values) {
  const counts = {};
  for (const value of values) {
    if (typeof value !== 'string' || value.length === 0) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .filter(value => typeof value === 'string' && value.length > 0)))
    .sort();
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

function formatCountMap(counts) {
  const entries = Object.entries(counts ?? {}).sort(([left], [right]) => left.localeCompare(right));
  return entries.length > 0
    ? entries.map(([key, value]) => `${key}=${value}`).join(', ')
    : 'none';
}

function formatStringList(values) {
  return Array.isArray(values) && values.length > 0
    ? values.map(value => `\`${value}\``).join(', ')
    : 'none';
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
