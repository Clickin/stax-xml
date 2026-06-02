import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultAuditJson = resolve(__dirname, 'results', 'release', 'runtime-proof-coverage-audit.json');
const defaultComparisonJson = resolve(__dirname, 'results', 'release', 'same-contract-runtime-comparison.json');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    auditJson: defaultAuditJson,
    comparisonJson: defaultComparisonJson,
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
      case '--audit-json':
        options.auditJson = resolve(process.cwd(), readValue());
        break;
      case '--comparison-json':
        options.comparisonJson = resolve(process.cwd(), readValue());
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

function main() {
  const options = parseArgs();
  const audit = readAudit(options.auditJson);
  const comparison = readComparison(options.comparisonJson);
  const report = createReport(audit, comparison, options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function readAudit(auditJson) {
  if (!existsSync(auditJson)) {
    throw new Error(`coverage audit JSON was not found: ${auditJson}`);
  }
  const audit = JSON.parse(readFileSync(auditJson, 'utf8'));
  if (audit.objective !== 'runtime-proof-coverage-audit') {
    throw new Error(`expected runtime-proof-coverage-audit JSON, got ${audit.objective ?? 'unknown'}`);
  }
  return audit;
}

function readComparison(comparisonJson) {
  if (!existsSync(comparisonJson)) {
    return null;
  }
  const comparison = JSON.parse(readFileSync(comparisonJson, 'utf8'));
  if (comparison.objective !== 'same-contract-runtime-comparison') {
    throw new Error(`expected same-contract-runtime-comparison JSON, got ${comparison.objective ?? 'unknown'}`);
  }
  return comparison;
}

function readOptionalJson(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function createReport(audit, comparison, options) {
  const obligations = audit.obligations ?? [];
  const activeObligations = obligations.filter(obligation => obligation.status !== 'covered');
  const localClosure = createLocalClosure(activeObligations, audit, options);
  const handoffs = createHandoffs(activeObligations, localClosure);
  const handled = new Set(handoffs.flatMap(handoff => handoff.obligationIds));
  const unhandledObligations = activeObligations
    .filter(obligation => !handled.has(obligation.id))
    .map(obligation => ({
      id: obligation.id,
      status: obligation.status,
      reason: 'No concrete external-run handoff is defined yet for this obligation.',
      nextExperiment: obligation.nextExperiment ?? null,
    }));
  const sourceConsumptionEvidence = summarizeSourceConsumptionEvidence(comparison);
  const memoryFrontierEvidence = summarizeMemoryFrontierEvidence(comparison);
  const externalTargetEvidence = summarizeExternalTargetEvidence(comparison);
  const textMaterializationEvidence = summarizeTextMaterializationEvidence(comparison);
  const summary = createSummary(
    activeObligations,
    localClosure,
    handoffs,
    unhandledObligations,
    sourceConsumptionEvidence,
    memoryFrontierEvidence,
    externalTargetEvidence,
    textMaterializationEvidence,
  );

  return {
    generatedAt: new Date().toISOString(),
    objective: 'runtime-proof-gap-handoff',
    contract: 'external-proof-gap-runbook-linked-to-coverage-audit',
    note: 'Turns current open or partial runtime proof obligations into concrete external-run handoffs. This is not benchmark evidence, not emitted JIT IR, not Safari/WebKit throughput evidence, and not a runtime-limit conclusion.',
    inputs: {
      auditJson: options.auditJson,
      comparisonJson: options.comparisonJson,
      comparisonGeneratedAt: comparison?.generatedAt ?? null,
      comparisonObjective: comparison?.objective ?? null,
      comparisonContract: comparison?.contract ?? null,
      auditGeneratedAt: audit.generatedAt,
      auditObjective: audit.objective,
      auditContract: audit.contract,
    },
    summary,
    auditSummary: {
      artifactCount: audit.scannedArtifacts?.length ?? null,
      measuredRows: audit.summary?.measuredRowCount ?? audit.summary?.measuredRows ?? audit.rowCount ?? null,
      counterexamples: audit.summary?.counterexamples ?? null,
      activeObligations: activeObligations.map(obligation => ({
        id: obligation.id,
        status: obligation.status,
        evidence: obligation.evidence,
        nextExperiment: obligation.nextExperiment,
      })),
    },
    sourceConsumptionEvidence,
    memoryFrontierEvidence,
    externalTargetEvidence,
    textMaterializationEvidence,
    localClosure,
    handoffs,
    unhandledObligations,
    findings: createFindings(activeObligations, handoffs, unhandledObligations),
  };
}

function summarizeExternalTargetEvidence(comparison) {
  const summary = comparison?.summary ?? null;
  if (!summary) {
    return {
      status: 'missing',
      sourceArtifact: 'same-contract-runtime-comparison.json',
      reason: 'same-contract-runtime-comparison JSON was not available to the handoff generator.',
    };
  }

  const woodstoxTarget = summary.sameFixture1024MiBWoodstoxTarget ?? null;
  const quickXmlTarget = summary.sameFixture1024MiBQuickXmlTarget ?? null;
  const processRss = summary.sameFixture1024MiBProcessRssSnapshot ?? null;
  const externalBaseline = summary.externalBaseline1024MiBFileSyncBatches ?? null;
  const sameFixtureFastestJsContract = summarizeTargetRow(
    findSameFixtureFastestJsRow(summary.sameFixture1024MiBTargetRows, woodstoxTarget),
  );
  const sameFixtureFastestJsContractOk = sameFixtureFastestJsContract
    && sameFixtureFastestJsContract.sourceMode === 'file-backed-sync-iterable-byte-batches'
    && sameFixtureFastestJsContract.directReadableStream === false
    && sameFixtureFastestJsContract.fullArrayBufferParserInput === false
    && sameFixtureFastestJsContract.boundedMemory === true
    && sameFixtureFastestJsContract.memoryKind === 'process-rss'
    && typeof sameFixtureFastestJsContract.maxMiB === 'number'
    && sameFixtureFastestJsContract.maxMiB < 128;
  const status = woodstoxTarget?.targetMet === false
    && quickXmlTarget?.targetMet === false
    && externalBaseline?.woodstoxMiBPerSec
    && externalBaseline?.quickXmlMiBPerSec
    && sameFixtureFastestJsContractOk
    ? 'classified'
    : 'partial';

  return {
    status,
    sourceArtifact: 'same-contract-runtime-comparison.json',
    contract: 'woodstox-and-quickxml-0.9x-target-distance',
    fastestJsLargeFullRow: summarizeTargetRow(summary.fastestJsLargeFullRow),
    fastestPrimaryJsLargeFullRow: summarizeTargetRow(summary.fastestPrimaryJsLargeFullRow),
    fastestJsLargeFullRowTo200MiBPerSec: summary.fastestJsLargeFullRowTo200MiBPerSec ?? null,
    fastestPrimaryJsLargeFullRowTo200MiBPerSec: summary.fastestPrimaryJsLargeFullRowTo200MiBPerSec ?? null,
    fastestJsLargeFullRowTo1024MiBWoodstoxReference: summary.fastestJsLargeFullRowTo1024MiBWoodstoxReference ?? null,
    sameFixture1024MiBWoodstoxTarget: woodstoxTarget,
    sameFixture1024MiBQuickXmlTarget: quickXmlTarget,
    sameFixtureFastestJsContract,
    sameFixture1024MiBProcessRssSnapshot: processRss,
    externalBaseline1024MiBFileSyncBatches: externalBaseline,
    interpretation: 'Woodstox and quick-xml remain same-checksum semantic comparators, not same object-shape comparators; the 0.9x target is evaluated separately from the 200 MiB/s counterexample threshold.',
  };
}

function findSameFixtureFastestJsRow(targetRows, target) {
  if (!Array.isArray(targetRows) || !target) return null;
  return targetRows.find(row =>
    row.group === target.group
    && row.fastestJs?.caseId === target.fastestJsCaseId
    && row.fastestJs?.sourceArtifact === target.sourceArtifact
  )?.fastestJs ?? null;
}

function summarizeTargetRow(row) {
  if (!row) return null;
  return {
    runtimeLabel: row.runtimeLabel,
    caseId: row.caseId,
    mibPerSec: row.mibPerSec,
    sourceArtifact: row.sourceArtifact,
    memoryKind: row.memory?.primaryKind ?? null,
    maxMiB: row.memory?.maxMiB ?? row.maxRssMiB ?? null,
    boundedMemory: row.boundedMemory === true,
    sourceMode: row.sourceMode ?? null,
    directReadableStream: row.directReadableStream === null ? null : row.directReadableStream === true,
    fullArrayBufferParserInput: row.fullArrayBufferParserInput === null ? null : row.fullArrayBufferParserInput === true,
  };
}

function summarizeSourceConsumptionEvidence(comparison) {
  if (!comparison?.summary) {
    return {
      status: 'missing',
      sourceArtifact: 'same-contract-runtime-comparison.json',
      reason: 'same-contract-runtime-comparison JSON was not available to the handoff generator.',
    };
  }
  const sourceShapeSafety = comparison.summary.sourceShapeSafety ?? {};
  const primarySourceShapeSafety = comparison.summary.primarySourceShapeSafety ?? {};
  const sourceConsumptionFrontier = comparison.summary.sourceConsumptionFrontier ?? null;
  const browserLiveSourceFrontier = comparison.summary.browserLiveSourceFrontier ?? null;
  const primarySourceShapeClassified = primarySourceShapeSafety.contract === 'primary-sync-iterable-byte-batches'
    && primarySourceShapeSafety.parserInput === 'synchronous Iterable<Uint8Array[]>'
    && (primarySourceShapeSafety.rows ?? 0) > 0
    && (primarySourceShapeSafety.directReadableStreamRows ?? null) === 0
    && (primarySourceShapeSafety.asyncSourceRows ?? null) === 0
    && (primarySourceShapeSafety.fullArrayBufferRows ?? null) === 0
    && (primarySourceShapeSafety.unknownSourceModeRows ?? null) === 0;
  return {
    status: sourceShapeSafety.fullArrayBufferRows === 0
      && sourceShapeSafety.unknownArrayBufferRows === 0
      && primarySourceShapeClassified
      && sourceConsumptionFrontier?.backpressureRows === sourceConsumptionFrontier?.backpressureRowsRespected
      && browserLiveSourceFrontier?.liveRows === browserLiveSourceFrontier?.liveRowsBackpressureRespected
      ? 'classified'
      : 'partial',
    sourceArtifact: 'same-contract-runtime-comparison.json',
    rowCount: comparison.summary.rowCount ?? null,
    sourceModes: comparison.summary.sourceModes ?? [],
    primarySourceShapeSafety: {
      contract: primarySourceShapeSafety.contract ?? null,
      parserInput: primarySourceShapeSafety.parserInput ?? null,
      sourceBoundary: primarySourceShapeSafety.sourceBoundary ?? null,
      arrayBufferParserInput: primarySourceShapeSafety.arrayBufferParserInput ?? null,
      backpressureContract: primarySourceShapeSafety.backpressureContract ?? null,
      rows: primarySourceShapeSafety.rows ?? null,
      excludedRows: primarySourceShapeSafety.excludedRows ?? null,
      directReadableStreamRows: primarySourceShapeSafety.directReadableStreamRows ?? null,
      asyncSourceRows: primarySourceShapeSafety.asyncSourceRows ?? null,
      fullArrayBufferRows: primarySourceShapeSafety.fullArrayBufferRows ?? null,
      unknownSourceModeRows: primarySourceShapeSafety.unknownSourceModeRows ?? null,
      sourceModes: primarySourceShapeSafety.sourceModes ?? [],
      fastestRow: summarizeTargetRow(primarySourceShapeSafety.fastestRow),
      excludedBreakdown: (primarySourceShapeSafety.excludedBreakdown ?? []).map(entry => ({
        reason: entry.reason,
        rows: entry.rows,
        fastestRow: entry.fastestRow ? {
          sourceArtifact: entry.fastestRow.sourceArtifact,
          runtimeLabel: entry.fastestRow.runtimeLabel,
          caseId: entry.fastestRow.caseId,
          mibPerSec: entry.fastestRow.mibPerSec,
          fullStringParity: entry.fastestRow.fullStringParity,
          boundedMemory: entry.fastestRow.boundedMemory,
        } : null,
      })),
    },
    sourceShapeSafety: {
      largeJsFullSourceModeRows: sourceShapeSafety.largeJsFullSourceModeRows ?? null,
      notFullArrayBufferRows: sourceShapeSafety.notFullArrayBufferRows ?? null,
      fullArrayBufferRows: sourceShapeSafety.fullArrayBufferRows ?? null,
      unknownArrayBufferRows: sourceShapeSafety.unknownArrayBufferRows ?? null,
      corpusSeedReplayRows: sourceShapeSafety.corpusSeedReplayRows ?? null,
      fileBackedSyncIterableRows: sourceShapeSafety.fileBackedSyncIterableRows ?? null,
      directReadableStreamRows: sourceShapeSafety.directReadableStreamRows ?? null,
      sourceModeBreakdown: (sourceShapeSafety.sourceModeBreakdown ?? []).map(entry => ({
        sourceMode: entry.sourceMode,
        rows: entry.rows,
        notFullArrayBufferRows: entry.notFullArrayBufferRows,
        fullArrayBufferRows: entry.fullArrayBufferRows,
        unknownArrayBufferRows: entry.unknownArrayBufferRows,
        directReadableStreamRows: entry.directReadableStreamRows,
        corpusSeedReplayRows: entry.corpusSeedReplayRows,
        fastestRow: entry.fastestRow ? {
          sourceArtifact: entry.fastestRow.sourceArtifact,
          runtimeLabel: entry.fastestRow.runtimeLabel,
          caseId: entry.fastestRow.caseId,
          mibPerSec: entry.fastestRow.mibPerSec,
          fullStringParity: entry.fastestRow.fullStringParity,
          boundedMemory: entry.fastestRow.boundedMemory,
        } : null,
      })),
    },
    sourceConsumptionFrontier: sourceConsumptionFrontier ? {
      sourceArtifact: sourceConsumptionFrontier.sourceArtifact,
      fastestSyncIterable: sourceConsumptionFrontier.fastestSyncIterable?.id ?? null,
      fastestSyncIterableMiBPerSec: sourceConsumptionFrontier.fastestSyncIterable?.mibPerSec ?? null,
      fastestReadableStream: sourceConsumptionFrontier.fastestReadableStream?.id ?? null,
      fastestReadableStreamMiBPerSec: sourceConsumptionFrontier.fastestReadableStream?.mibPerSec ?? null,
      fastestReadableStreamRatioToFastestSyncIterable: sourceConsumptionFrontier.fastestReadableStreamRatioToFastestSyncIterable ?? null,
      backpressureRows: sourceConsumptionFrontier.backpressureRows ?? null,
      backpressureRowsRespected: sourceConsumptionFrontier.backpressureRowsRespected ?? null,
      fullArrayBufferRows: sourceConsumptionFrontier.fullArrayBufferRows ?? null,
    } : null,
    browserLiveSourceFrontier: browserLiveSourceFrontier ? {
      sourceArtifact: browserLiveSourceFrontier.sourceArtifact,
      fetchReadableStreamRow: browserLiveSourceFrontier.fetchReadableStreamRow?.id ?? null,
      fetchReadableStreamMiBPerSec: browserLiveSourceFrontier.fetchReadableStreamRow?.mibPerSec ?? null,
      fetchAsyncByteBatchRow: browserLiveSourceFrontier.fetchAsyncByteBatchRow?.id ?? null,
      fetchAsyncByteBatchMiBPerSec: browserLiveSourceFrontier.fetchAsyncByteBatchRow?.mibPerSec ?? null,
      liveRows: browserLiveSourceFrontier.liveRows ?? null,
      liveRowsBackpressureRespected: browserLiveSourceFrontier.liveRowsBackpressureRespected ?? null,
      liveRowsFullArrayBufferInput: browserLiveSourceFrontier.liveRowsFullArrayBufferInput ?? null,
    } : null,
  };
}

function summarizeMemoryFrontierEvidence(comparison) {
  const frontier = comparison?.summary?.memoryFrontier ?? null;
  if (!frontier) {
    return {
      status: 'missing',
      sourceArtifact: 'same-contract-runtime-comparison.json',
      reason: 'same-contract-runtime-comparison memory frontier was not available to the handoff generator.',
    };
  }

  const comparisonLargeFullRows = comparison.summary?.jsLargeFullRowCount ?? null;
  const fastestComparisonRow = comparison.summary?.fastestJsLargeFullRow ?? null;
  const comparisonRows = Array.isArray(comparison.comparisonRows) ? comparison.comparisonRows : [];
  const memoryRows = comparisonRows.filter(row =>
    row.jsRuntime
    && row.fullStringParity
    && (row.fixture?.sizeGiB ?? 0) >= 0.999
    && row.memory?.primaryKind
  );
  const unboundedMemoryRows = memoryRows.filter(row => !hasAcceptedBoundedMemoryProof(row));
  const unboundedRowsAtOrAbove200MiBPerSec = unboundedMemoryRows
    .filter(row => typeof row.mibPerSec === 'number' && row.mibPerSec >= 200)
    .length;
  const fastestUnboundedRow = maxBy(unboundedMemoryRows, row => row.mibPerSec);
  return {
    status: frontier.rows === comparisonLargeFullRows
      && memoryRows.length === frontier.rows
      && unboundedMemoryRows.length === frontier.unboundedRows
      && frontier.fastestBoundedRow?.mibPerSec === fastestComparisonRow?.mibPerSec
      ? 'classified'
      : 'partial',
    sourceArtifact: 'same-contract-runtime-comparison.json',
    contract: frontier.contract,
    rows: frontier.rows,
    boundedRows: frontier.boundedRows,
    unboundedRows: frontier.unboundedRows,
    unboundedRowsAtOrAbove200MiBPerSec,
    memoryKinds: frontier.memoryKinds ?? [],
    fastestBoundedRow: summarizeMemoryRowForHandoff(frontier.fastestBoundedRow),
    fastestUnboundedRow: summarizeMemoryRowForHandoff(fastestUnboundedRow),
    fastestProcessRssUnder128MiB: summarizeMemoryRowForHandoff(frontier.fastestProcessRssUnder128MiB),
    fastestBrowserJsHeapRow: summarizeMemoryRowForHandoff(frontier.fastestBrowserJsHeapRow),
    buckets: (frontier.buckets ?? []).map(bucket => ({
      kind: bucket.kind,
      rows: bucket.rows,
      boundedRows: bucket.boundedRows,
      unboundedRows: bucket.unboundedRows,
      maxMiB: bucket.maxMiB,
      fastestRow: summarizeMemoryRowForHandoff(bucket.fastestRow),
      fastestBoundedRow: summarizeMemoryRowForHandoff(bucket.fastestBoundedRow),
    })),
    interpretation: frontier.interpretation,
  };
}

function summarizeMemoryRowForHandoff(row) {
  if (!row) return null;
  return {
    runtimeLabel: row.runtimeLabel,
    caseId: row.caseId,
    mibPerSec: row.mibPerSec,
    memoryKind: row.memory?.primaryKind ?? null,
    maxMiB: row.memory?.maxMiB ?? null,
    sourceArtifact: row.sourceArtifact,
    boundedMemory: hasAcceptedBoundedMemoryProof(row),
  };
}

function hasAcceptedBoundedMemoryProof(row) {
  return row?.boundedMemory === true && hasNumericMemoryProof(row.memory);
}

function hasNumericMemoryProof(memory) {
  return (memory?.primaryKind === 'process-rss' || memory?.primaryKind === 'browser-js-heap')
    && typeof memory.maxMiB === 'number'
    && Number.isFinite(memory.maxMiB);
}

function summarizeTextMaterializationEvidence(comparison) {
  const frontier = comparison?.summary?.textMaterializationFrontier ?? null;
  if (!frontier) {
    return {
      status: 'missing',
      sourceArtifact: 'same-contract-runtime-comparison.json',
      reason: 'same-contract-runtime-comparison text materialization frontier was not available to the handoff generator.',
    };
  }

  return {
    status: frontier.fastestFull?.fullStringParity === true
      && frontier.fastestWithoutText?.fullStringParity === false
      && frontier.fullRowsCrossTarget === 0
      && frontier.noTextRowsCrossTarget > 0
      ? 'classified'
      : 'partial',
    sourceArtifact: 'same-contract-runtime-comparison.json',
    frontierArtifact: frontier.sourceArtifact,
    contract: 'text-materialization-frontier-counterexample-boundary',
    targetMiBPerSec: frontier.targetMiBPerSec,
    fastestFull: frontier.fastestFull,
    fastestWithoutText: frontier.fastestWithoutText,
    fastestNoTrim: frontier.fastestNoTrim,
    fastestFoldTrim: frontier.fastestFoldTrim,
    fastestFullToTargetRatio: frontier.fastestFullToTargetRatio,
    fastestFullRemainingMiBPerSec: frontier.fastestFullRemainingMiBPerSec,
    requiredSpeedupToTarget: frontier.requiredSpeedupToTarget,
    fastestWithoutTextToFullRatio: frontier.fastestWithoutTextToFullRatio,
    fastestNoTrimToFullRatio: frontier.fastestNoTrimToFullRatio,
    fastestFoldTrimToFullRatio: frontier.fastestFoldTrimToFullRatio,
    noTextRowsCrossTarget: frontier.noTextRowsCrossTarget,
    fullRowsCrossTarget: frontier.fullRowsCrossTarget,
    noTrimRowsCrossTarget: frontier.noTrimRowsCrossTarget,
    foldTrimRowsCrossTarget: frontier.foldTrimRowsCrossTarget,
    negativeCandidateCount: frontier.negativeCandidateCount,
    interpretation: frontier.interpretation,
  };
}

function createSummary(
  activeObligations,
  localClosure,
  handoffs,
  unhandledObligations,
  sourceConsumptionEvidence,
  memoryFrontierEvidence,
  externalTargetEvidence,
  textMaterializationEvidence,
) {
  const externalRunRequiredCount = localClosure
    .filter(item => item.localStatus === 'external-run-required' || item.localRunnable === false)
    .length;
  const localRunnableCount = localClosure
    .filter(item => item.localRunnable === true)
    .length;
  const localStatusCounts = countBy(localClosure, item => item.localStatus ?? 'unknown');
  const handoffClassificationCounts = countBy(handoffs, handoff => handoff.classification ?? 'UNKNOWN');

  return {
    activeObligationCount: activeObligations.length,
    handoffCount: handoffs.length,
    unhandledObligationCount: unhandledObligations.length,
    localClosureCount: localClosure.length,
    externalRunRequiredCount,
    localRunnableCount,
    localStatusCounts,
    handoffClassificationCounts,
    sourceConsumptionPrimary: 'synchronous Iterable<Uint8Array[]> byte batches',
    directReadableStreamScope: 'separate source-overhead evidence only',
    directReadableStreamBackpressureRequired: true,
    sourceConsumptionEvidenceStatus: sourceConsumptionEvidence.status,
    memoryFrontierEvidenceStatus: memoryFrontierEvidence.status,
    externalTargetEvidenceStatus: externalTargetEvidence.status,
    textMaterializationEvidenceStatus: textMaterializationEvidence.status,
    conclusionAllowed: false,
    conclusionBlocker: activeObligations.length === 0
      ? 'No active obligations remain, but this handoff report is not a runtime-limit conclusion artifact.'
      : 'Open or partial obligations still require external runtime evidence before any runtime-limit conclusion.',
  };
}

function createLocalClosure(activeObligations, audit, options = {}) {
  const activeById = new Map(activeObligations.map(obligation => [obligation.id, obligation]));
  const artifactByName = new Map((audit.scannedArtifacts ?? []).map(artifact => [artifact.sourceArtifact, artifact]));
  const releaseDir = options.auditJson ? dirname(options.auditJson) : dirname(defaultAuditJson);
  const items = [];

  if (activeById.has('safari-jsc-source-and-browser-rows-open')) {
    const obligation = activeById.get('safari-jsc-source-and-browser-rows-open');
    const availability = artifactByName.get('safari-webkit-availability-audit.json') ?? null;
    const availabilityRaw = readOptionalJson(resolve(releaseDir, 'safari-webkit-availability-audit.json'))
      ?? readOptionalJson(resolve(dirname(defaultAuditJson), 'safari-webkit-availability-audit.json'));
    const safariClosureAudit = artifactByName.get('safari-webkit-closure-audit.json') ?? null;
    const safariClosureAuditRaw = readOptionalJson(resolve(releaseDir, 'safari-webkit-closure-audit.json'))
      ?? readOptionalJson(resolve(dirname(defaultAuditJson), 'safari-webkit-closure-audit.json'));
    const localHostCannotRun = /current host cannot run Safari rows/i.test(obligation.evidence ?? '');
    const safariRowsRecorded = availability?.availability?.safariBenchmarkRowsRecorded === true;
    const sourceBoundaryPinned = availability?.availability?.safariSourceBoundaryPinned === true;
    const safariHostPlatform = availabilityRaw?.environment?.hostPlatform
      ?? availability?.environment?.hostPlatform
      ?? 'unknown';
    const safariExecutableFound = availability?.availability?.safariExecutableFound ?? 'unknown';
    const safaridriverFound = availability?.availability?.safaridriverFound ?? 'unknown';
    const harnessSupportsSafari = availability?.availability?.currentHarnessSupportsSafari ?? 'unknown';
    const canRunSafariBrowserRows = availability?.availability?.canRunSafariBrowserRows ?? 'unknown';
    const closureRequirementsMet = availability?.availability?.closureRequirementsMet ?? 'unknown';
    const closureRequirementsBlocked = availability?.availability?.closureRequirementsBlocked ?? 'unknown';
    const closesSafariObligation = availability?.availability?.closesSafariObligation === true;
    const safariClosureAuditPinned = safariClosureAudit?.contract === 'safari-webkit-same-contract-browser-row-closure-matrix'
      && safariClosureAuditRaw?.summary?.qualifiedClosureCount === 0
      && safariClosureAuditRaw?.summary?.conclusionAllowed === false;
    items.push({
      obligationId: 'safari-jsc-source-and-browser-rows-open',
      localStatus: localHostCannotRun ? 'external-run-required' : 'unknown-local-status',
      localRunnable: localHostCannotRun ? false : null,
      evidenceArtifacts: [availability, safariClosureAudit].filter(Boolean).map(artifact => artifact.sourceArtifact),
      blockers: localHostCannotRun
        ? [
            `Current host cannot run Safari/WebKit browser rows through the normal Safari/safaridriver path (hostPlatform=${safariHostPlatform}, safariExecutableFound=${safariExecutableFound}, safaridriverFound=${safaridriverFound}, currentHarnessSupportsSafari=${harnessSupportsSafari}, canRunSafariBrowserRows=${canRunSafariBrowserRows}).`,
            safariRowsRecorded ? 'Safari/WebKit benchmark rows are recorded.' : 'No Safari/WebKit benchmark row is recorded by the availability audit.',
            sourceBoundaryPinned ? 'Safari/WebKit source boundary is pinned.' : 'No exact Safari/WebKit source-boundary pin is recorded by the availability audit.',
            `Safari closure matrix reports closureRequirementsMet=${closureRequirementsMet}, closureRequirementsBlocked=${closureRequirementsBlocked}, closesSafariObligation=${closesSafariObligation}.`,
            safariClosureAuditPinned
              ? `The Safari/WebKit closure audit checks candidateRows=${safariClosureAuditRaw.summary.candidateCount}, comparisonGeneratedAt=${safariClosureAuditRaw.inputs?.comparisonGeneratedAt ?? 'unknown'}, comparisonRowCount=${safariClosureAuditRaw.inputs?.comparisonRowCount ?? 'unknown'}, largeBoundedPrimaryRows=${safariClosureAuditRaw.summary.largeBoundedPrimaryRows}, rowsInSameContractComparison=${safariClosureAuditRaw.summary.rowsInSameContractComparison}, measuredExactBuildIdentityRows=${safariClosureAuditRaw.summary.measuredExactBuildIdentityRows}, sourceBoundaryPinned=${safariClosureAuditRaw.summary.sourceBoundaryPinned}, qualifiedClosureCount=0, and conclusionAllowed=false.`
              : 'No Safari/WebKit closure audit pins the same-contract browser-row closure matrix.',
          ]
        : ['Safari/WebKit local runnable status was not established by the coverage audit.'],
      scopeGuard: 'This is environment availability evidence only; it is not a Safari/WebKit benchmark row or runtime limitation.',
    });
  }

  if (activeById.has('codegen-traces-open')) {
    const diagnostic = artifactByName.get('firefox-spidermonkey-diagnostic-dump-audit.json') ?? null;
    const jsShell = artifactByName.get('firefox-spidermonkey-js-shell-availability-audit.json') ?? null;
    const releaseJsShell = artifactByName.get('firefox-spidermonkey-release-jsshell-availability-audit.json') ?? null;
    const nightlyJsShell = artifactByName.get('firefox-spidermonkey-nightly-jsshell-availability-audit.json') ?? null;
    const jsShellApiGap = artifactByName.get('firefox-spidermonkey-jsshell-stax-api-gap-audit.json') ?? null;
    const staxHostApiBoundary = artifactByName.get('stax-public-reader-host-api-boundary-audit.json') ?? null;
    const jsShellTokenizerHeadroom = artifactByName.get('spidermonkey-jsshell-tokenizer-headroom.json') ?? null;
    const jsShellTokenizerHeadroomRaw = readOptionalJson(resolve(releaseDir, 'spidermonkey-jsshell-tokenizer-headroom.json'))
      ?? readOptionalJson(resolve(dirname(defaultAuditJson), 'spidermonkey-jsshell-tokenizer-headroom.json'));
    const jsShellMaterializedHeadroom = artifactByName.get('spidermonkey-jsshell-materialized-headroom.json') ?? null;
    const jsShellMaterializedHeadroomRaw = readOptionalJson(resolve(releaseDir, 'spidermonkey-jsshell-materialized-headroom.json'))
      ?? readOptionalJson(resolve(dirname(defaultAuditJson), 'spidermonkey-jsshell-materialized-headroom.json'));
    const jsShellDiagnosticFlagSweep = artifactByName.get('spidermonkey-jsshell-diagnostic-flag-sweep.json') ?? null;
    const taskclusterDebugJsShell = artifactByName.get('spidermonkey-taskcluster-debug-jsshell-codegen-audit.json') ?? null;
    const taskclusterDebugJsShellXml = artifactByName.get('spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.json') ?? null;
    const taskclusterDebugJsShellMaterialized = artifactByName.get('spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json') ?? null;
    const taskclusterDebugJsShellRerun = artifactByName.get('spidermonkey-taskcluster-debug-jsshell-codegen-rerun.json') ?? null;
    const taskclusterDebugJsShellMaterializedRerun = artifactByName.get('spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun.json') ?? null;
    const taskclusterDebugJsShellMaterializedRerunRaw = readOptionalJson(resolve(releaseDir, 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun.json'))
      ?? readOptionalJson(resolve(dirname(defaultAuditJson), 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun.json'));
    const asciiScopeDistance = artifactByName.get('spidermonkey-ascii-scope-distance-audit.json') ?? null;
    const materializedScopeDistance = artifactByName.get('spidermonkey-materialized-scope-distance-audit.json') ?? null;
    const codegenClosureAudit = artifactByName.get('spidermonkey-codegen-closure-audit.json') ?? null;
    const codegenClosureAuditRaw = readOptionalJson(resolve(releaseDir, 'spidermonkey-codegen-closure-audit.json'))
      ?? readOptionalJson(resolve(dirname(defaultAuditJson), 'spidermonkey-codegen-closure-audit.json'));
    const codegenRerunStability = artifactByName.get('spidermonkey-codegen-rerun-stability-audit.json') ?? null;
    const codegenRerunStabilityRaw = readOptionalJson(resolve(releaseDir, 'spidermonkey-codegen-rerun-stability-audit.json'))
      ?? readOptionalJson(resolve(dirname(defaultAuditJson), 'spidermonkey-codegen-rerun-stability-audit.json'));
    const codegenRerunStabilitySummary = codegenRerunStability?.summary ?? codegenRerunStabilityRaw?.summary ?? {};
    const archivalDebugJsShell = artifactByName.get('spidermonkey-archival-debug-jsshell-codegen-audit.json') ?? null;
    const buildconfig = artifactByName.get('firefox-spidermonkey-buildconfig-source-pin-audit.json') ?? null;
    const spiderMonkeyDiagnosticById = new Map((audit.coverage?.spiderMonkeyDiagnostics?.rows ?? [])
      .map(row => [row.id, row]));
    const taskclusterDebugCodegenIdentity = formatTaskclusterIdentity(taskclusterDebugJsShell);
    const taskclusterDebugXmlCodegenIdentity = formatTaskclusterIdentity(taskclusterDebugJsShellXml);
    const taskclusterDebugMaterializedCodegenIdentity = formatTaskclusterIdentity(taskclusterDebugJsShellMaterialized);
    const taskclusterDebugCodegenRerunIdentity = formatTaskclusterIdentity(taskclusterDebugJsShellRerun);
    const taskclusterDebugMaterializedCodegenRerunIdentity = formatTaskclusterIdentity(taskclusterDebugJsShellMaterializedRerun);
    const diagnosticIdentityStatusCounts = audit.coverage?.spiderMonkeyDiagnostics?.selectedRowIdentityStatusCounts ?? {};
    const diagnosticNoDump = diagnostic?.outcome?.status === 'no-dump-emitted'
      && diagnostic?.outcome?.emittedDump === false;
    const jsShellMissing = jsShell?.outcome?.status === 'not-found'
      && jsShell?.outcome?.foundCount === 0;
    const jsShellAvailable = jsShell?.outcome?.status === 'available'
      && (jsShell?.outcome?.foundCount ?? 0) > 0;
    const releaseJsShellNoIr = releaseJsShell?.outcome?.status === 'available'
      && releaseJsShell?.outcome?.closesEmittedIrObligation === false;
    const nightlyJsShellNoIr = nightlyJsShell?.outcome?.status === 'available'
      && nightlyJsShell?.outcome?.closesEmittedIrObligation === false;
    const releaseBytecodeStatus = releaseJsShell?.shell?.bytecodeDumpProbe?.status ?? 'unknown';
    const nightlyBytecodeStatus = nightlyJsShell?.shell?.bytecodeDumpProbe?.status ?? 'unknown';
    const jsShellApiGapStatus = jsShellApiGap?.summary?.status ?? null;
    const jsShellApiGapPinned = jsShellApiGapStatus === 'blocked-by-host-api-surface';
    const staxHostApiBoundaryPinned = staxHostApiBoundary?.summary?.primarySyncByteBatchRequiresTextDecoder === true
      && staxHostApiBoundary?.summary?.directReadableStreamRequiresReadableStream === true
      && staxHostApiBoundary?.summary?.stringInputRequiresTextEncoder === true
      && staxHostApiBoundary?.summary?.alternateDecoderWouldBeUnchangedClosure === false;
    const jsShellTokenizerHeadroomPinned = jsShellTokenizerHeadroom?.contract === 'spidermonkey-jsshell-corpus-token-boundary-headroom-not-stax'
      && jsShellTokenizerHeadroom?.measuredRowCount > 0
      && jsShellTokenizerHeadroomRaw?.summary?.counterexamples200MiB === 0
      && jsShellTokenizerHeadroomRaw?.summary?.memoryProofRows === 0
      && jsShellTokenizerHeadroomRaw?.summary?.fastest?.fullStringParity === false;
    const jsShellMaterializedHeadroomPinned = jsShellMaterializedHeadroom?.contract === 'spidermonkey-jsshell-ascii-materialized-string-object-headroom-not-stax'
      && jsShellMaterializedHeadroom?.measuredRowCount > 0
      && jsShellMaterializedHeadroomRaw?.summary?.sameSemanticChecksumRows > 0
      && jsShellMaterializedHeadroomRaw?.summary?.counterexamples200MiB === 0
      && jsShellMaterializedHeadroomRaw?.summary?.memoryProofRows === 0
      && jsShellMaterializedHeadroomRaw?.summary?.fastest?.fullStringParity === false
      && jsShellMaterializedHeadroomRaw?.summary?.fastest?.sameSemanticChecksumFields === true;
    const jsShellDiagnosticFlagSweepNegative = jsShellDiagnosticFlagSweep?.outcome?.bytecodeProbeCount > 0
      && jsShellDiagnosticFlagSweep?.outcome?.bytecodeOutputProbeCount === 0;
    const archivalDebugCodegen = archivalDebugJsShell?.outcome?.hasCodegenDumpOutput === true
      && archivalDebugJsShell?.outcome?.scopeComparableToCurrentFirefox === false;
    const taskclusterDebugCodegenScopeGuard = taskclusterDebugJsShell?.outcome?.hasCodegenDumpOutput === true
      && taskclusterDebugJsShell?.outcome?.scopeComparableToCurrentFirefox === true
      && taskclusterDebugJsShell?.outcome?.sameContractStaxRow === false
      && taskclusterDebugJsShell?.outcome?.closesEmittedIrObligation === false;
    const taskclusterDebugXmlCodegenScopeGuard = taskclusterDebugJsShellXml?.outcome?.hasXmlWorkloadCodegenOutput === true
      && taskclusterDebugJsShellXml?.outcome?.scopeComparableToCurrentFirefox === true
      && taskclusterDebugJsShellXml?.outcome?.sameContractStaxRow === false
      && taskclusterDebugJsShellXml?.outcome?.closesEmittedIrObligation === false;
    const taskclusterDebugMaterializedCodegenScopeGuard = taskclusterDebugJsShellMaterialized?.outcome?.hasMaterializedStringObjectCodegenOutput === true
      && taskclusterDebugJsShellMaterialized?.outcome?.scopeComparableToCurrentFirefox === true
      && taskclusterDebugJsShellMaterialized?.outcome?.sameContractStaxRow === false
      && taskclusterDebugJsShellMaterialized?.outcome?.closesEmittedIrObligation === false;
    const taskclusterDebugCodegenRerunScopeGuard = taskclusterDebugJsShellRerun?.outcome?.hasCodegenDumpOutput === true
      && taskclusterDebugJsShellRerun?.outcome?.scopeComparableToCurrentFirefox === true
      && taskclusterDebugJsShellRerun?.outcome?.sameContractStaxRow === false
      && taskclusterDebugJsShellRerun?.outcome?.closesEmittedIrObligation === false;
    const taskclusterDebugMaterializedCodegenRerunScopeGuard = taskclusterDebugJsShellMaterializedRerun?.outcome?.hasMaterializedStringObjectCodegenOutput === true
      && taskclusterDebugJsShellMaterializedRerun?.outcome?.scopeComparableToCurrentFirefox === true
      && taskclusterDebugJsShellMaterializedRerun?.outcome?.sameContractStaxRow === false
      && taskclusterDebugJsShellMaterializedRerun?.outcome?.closesEmittedIrObligation === false;
    const materializedScopeDistancePinned = materializedScopeDistance?.summary?.semanticEquivalentForAsciiFields === true
      && materializedScopeDistance?.summary?.closesCodegenObligation === false;
    const codegenClosureAuditPinned = codegenClosureAudit?.contract === 'spidermonkey-emitted-codegen-same-contract-closure-matrix'
      && codegenClosureAuditRaw?.summary?.candidateCount > 0
      && codegenClosureAuditRaw?.summary?.emittedCodegenSurfaceCount > 0
      && codegenClosureAuditRaw?.summary?.qualifiedClosureCount === 0
      && codegenClosureAuditRaw?.summary?.contradictedClosureClaimCount === 0
      && codegenClosureAuditRaw?.summary?.conclusionAllowed === false;
    const codegenClosureFrontierPinned = codegenClosureAuditPinned
      && codegenClosureAuditRaw?.summary?.closestBlockedCandidateCount > 0
      && codegenClosureAuditRaw?.summary?.minimumBlockedRequirementCount > 0
      && codegenClosureAuditRaw?.missingRequirementHistogram?.sameContractStaxRow === codegenClosureAuditRaw?.summary?.candidateCount
      && codegenClosureAuditRaw?.missingRequirementHistogram?.selectedRowMetadata === codegenClosureAuditRaw?.summary?.candidateCount
      && codegenClosureAuditRaw?.missingRequirementHistogram?.unchangedRunnable === codegenClosureAuditRaw?.summary?.candidateCount
      && codegenClosureAuditRaw?.missingRequirementHistogram?.evidenceClassAllowed === codegenClosureAuditRaw?.summary?.candidateCount;
    const closestBlockedCandidateSources = Array.isArray(codegenClosureAuditRaw?.closestBlockedCandidates)
      ? codegenClosureAuditRaw.closestBlockedCandidates
        .map(candidate => candidate?.sourceArtifact)
        .filter(sourceArtifact => typeof sourceArtifact === 'string' && sourceArtifact.length > 0)
        .sort()
      : [];
    const codegenRerunStabilityContract = codegenRerunStability?.contract ?? codegenRerunStabilityRaw?.contract ?? null;
    const codegenRerunStabilityPinned = codegenRerunStabilityContract === 'spidermonkey-debug-jsshell-codegen-rerun-reproducibility-not-closure'
      && codegenRerunStabilitySummary.pairCount === 2
      && codegenRerunStabilitySummary.reproduciblePairs === 2
      && codegenRerunStabilitySummary.sameTaskclusterBuildPairs === 2
      && codegenRerunStabilitySummary.sameCodegenMarkerPairs === 2
      && codegenRerunStabilitySummary.throughputCountsAsTargetEvidence === false
      && codegenRerunStabilitySummary.qualifiedClosureCount === 0
      && codegenRerunStabilitySummary.conclusionAllowed === false;
    const asciiScopeDistancePinned = asciiScopeDistance?.summary?.allCorpusFilesAscii === true
      && asciiScopeDistance?.summary?.asciiByteToStringEquivalentToUtf8 === true
      && asciiScopeDistance?.summary?.semanticMaterializedWorkload === true
      && asciiScopeDistance?.summary?.reducesScopeDistance === true
      && asciiScopeDistance?.summary?.closesCodegenObligation === false;
    const jsShellCommonMissing = Array.isArray(jsShellApiGap?.summary?.commonMissingGlobals)
      ? jsShellApiGap.summary.commonMissingGlobals.join(', ')
      : 'unknown';
    const buildconfigNoJitSpew = (audit.coverage?.sourcePins ?? []).some(pin =>
      pin.kind === 'Firefox installed buildconfig JitSpew boundary'
      && /enableJitSpew=false/.test(pin.limitation ?? '')
    );
    const blocked = diagnosticNoDump && releaseJsShellNoIr && nightlyJsShellNoIr;
    items.push({
      obligationId: 'codegen-traces-open',
      localStatus: blocked ? 'external-run-required' : 'partial-local-status',
      localRunnable: blocked ? false : null,
      evidenceArtifacts: [diagnostic, jsShell, releaseJsShell, nightlyJsShell, jsShellApiGap, staxHostApiBoundary, jsShellTokenizerHeadroom, jsShellMaterializedHeadroom, jsShellDiagnosticFlagSweep, taskclusterDebugJsShell, taskclusterDebugJsShellXml, taskclusterDebugJsShellMaterialized, taskclusterDebugJsShellRerun, taskclusterDebugJsShellMaterializedRerun, asciiScopeDistance, materializedScopeDistance, codegenClosureAudit, codegenRerunStability, archivalDebugJsShell, buildconfig]
        .filter(Boolean)
        .map(artifact => artifact.sourceArtifact),
      blockers: [
        diagnosticNoDump
          ? 'Installed Firefox diagnostic dump audit emitted no JIT diagnostic dump.'
          : 'Installed Firefox diagnostic dump status is not a confirmed no-dump result.',
        jsShellMissing
          ? 'No local SpiderMonkey JS shell was found for JIT IR probing across env, PATH, and filesystem search-root probes.'
          : jsShellAvailable
            ? `Local SpiderMonkey JS shell candidates are available (${jsShell.outcome.foundCount}), but this availability audit records no emitted JIT IR or optimized-code dump.`
            : 'SpiderMonkey JS shell availability is not pinned as available or missing.',
        releaseJsShellNoIr
          ? `Official Firefox release jsshell is executable and JIT status is observable, but it exposes no emitted IR/native dump surface, bytecode dump status is ${releaseBytecodeStatus}, and it cannot run the current stax full-string benchmark unchanged.`
          : 'Official Firefox release jsshell diagnostic status is not pinned as available-without-IR.',
        nightlyJsShellNoIr
          ? `Official Firefox nightly jsshell is executable and JIT status is observable, but it exposes no emitted IR/native dump surface, bytecode dump status is ${nightlyBytecodeStatus}, and it cannot run the current stax full-string benchmark unchanged.`
          : 'Official Firefox nightly jsshell diagnostic status is not pinned as available-without-IR.',
        jsShellApiGapPinned
          ? `The js-shell StAX API gap audit pins the unchanged-harness blocker as host API surface, with common missing globals: ${jsShellCommonMissing}.`
          : 'The js-shell StAX API gap audit is missing or does not pin the unchanged-harness host API blocker.',
        staxHostApiBoundaryPinned
          ? 'The StAX public reader host API boundary audit pins the current TextDecoder/ReadableStream/TextEncoder boundary: primarySyncByteBatchRequiresTextDecoder=true, directReadableStreamRequiresReadableStream=true, stringInputRequiresTextEncoder=true, and alternateDecoderWouldBeUnchangedClosure=false.'
          : 'The StAX public reader host API boundary audit is missing or does not pin the current TextDecoder/ReadableStream/TextEncoder boundary.',
        jsShellTokenizerHeadroomPinned
          ? `The SpiderMonkey js-shell tokenizer headroom audit records partial parser-core headroom only: fastest=${formatNumber(jsShellTokenizerHeadroomRaw.summary.fastest.mibPerSec)} MiB/s, fullStringParity=false, memoryProofRows=0, counterexamples200MiB=0.`
          : 'The SpiderMonkey js-shell tokenizer headroom audit is missing or does not pin non-StAX partial headroom as non-counterexample evidence.',
        jsShellMaterializedHeadroomPinned
          ? `The SpiderMonkey js-shell materialized headroom audit records JS string/object materialization headroom only: fastest=${formatNumber(jsShellMaterializedHeadroomRaw.summary.fastest.mibPerSec)} MiB/s, sameSemanticChecksumFields=true, fullStringParity=false, memoryProofRows=0, counterexamples200MiB=0.`
          : 'The SpiderMonkey js-shell materialized headroom audit is missing or does not pin non-StAX string/object materialization headroom as non-counterexample evidence.',
        jsShellDiagnosticFlagSweepNegative
          ? `The public js-shell diagnostic flag sweep tried ${jsShellDiagnosticFlagSweep.outcome.bytecodeProbeCount} bytecode flag combinations and found ${jsShellDiagnosticFlagSweep.outcome.bytecodeOutputProbeCount} bytecode-output probes plus diagnosticPrefSurface=${jsShellDiagnosticFlagSweep.outcome.hasDiagnosticPrefSurface}.`
          : 'The public js-shell diagnostic flag sweep is missing or did not confirm the no-bytecode-output flag surface.',
        archivalDebugCodegen
          ? 'An archived Firefox 36 era debug js-shell emits JitSpew codegen output, proving the expected diagnostic surface shape, but it is not comparable to the current Firefox/SpiderMonkey benchmark rows.'
          : 'No scoped archival debug js-shell codegen surface proof is recorded.',
        taskclusterDebugCodegenScopeGuard
          ? `A current Taskcluster debug js-shell emits JitSpew codegen output (${taskclusterDebugCodegenIdentity}), but sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=${taskclusterDebugJsShell.outcome?.canRunCurrentStaxFullStringBenchmark ?? 'unknown'}, and selectedRowIdentityStatus=${spiderMonkeyDiagnosticById.get('taskcluster-debug-jsshell-codegen')?.selectedRowIdentityStatus ?? 'unknown'}.`
          : 'No current Taskcluster debug js-shell codegen scope guard is recorded.',
        taskclusterDebugXmlCodegenScopeGuard
          ? `A current Taskcluster debug js-shell emits JitSpew codegen output while running the XML byte-tokenizer workload (${taskclusterDebugXmlCodegenIdentity}), but fullStringParity=false, sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=${taskclusterDebugJsShellXml.outcome?.canRunCurrentStaxFullStringBenchmark ?? 'unknown'}, and selectedRowIdentityStatus=${spiderMonkeyDiagnosticById.get('taskcluster-debug-jsshell-xml-codegen')?.selectedRowIdentityStatus ?? 'unknown'}.`
          : 'No current Taskcluster debug js-shell XML workload codegen scope guard is recorded.',
        taskclusterDebugMaterializedCodegenScopeGuard
          ? `A current Taskcluster debug js-shell emits JitSpew codegen output while materializing JS strings and public event-shaped objects (${taskclusterDebugMaterializedCodegenIdentity}), but unchangedStaxBenchmark=false, sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=${taskclusterDebugJsShellMaterialized.outcome?.canRunCurrentStaxFullStringBenchmark ?? 'unknown'}, and selectedRowIdentityStatus=${spiderMonkeyDiagnosticById.get('taskcluster-debug-jsshell-materialized-codegen')?.selectedRowIdentityStatus ?? 'unknown'}.`
          : 'No current Taskcluster debug js-shell materialized string/object codegen scope guard is recorded.',
        taskclusterDebugCodegenRerunScopeGuard
          ? `A rerun of the current Taskcluster debug js-shell codegen probe reproduces JitSpew output (${taskclusterDebugCodegenRerunIdentity}, codegenMarkers=${taskclusterDebugJsShellRerun.shell?.codegenProbe?.codegenMarkerCount ?? 'unknown'}), but sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=${taskclusterDebugJsShellRerun.outcome?.canRunCurrentStaxFullStringBenchmark ?? 'unknown'}, and closesEmittedIrObligation=false.`
          : 'No rerun Taskcluster debug js-shell codegen scope guard is recorded.',
        taskclusterDebugMaterializedCodegenRerunScopeGuard
          ? `A rerun of the current Taskcluster debug js-shell materialized string/object probe reproduces JitSpew output (${taskclusterDebugMaterializedCodegenRerunIdentity}, codegenMarkers=${taskclusterDebugJsShellMaterializedRerun.shell?.materializedCodegenProbe?.codegenMarkerCount ?? 'unknown'}, throughputMiBPerSec=${formatNumber(taskclusterDebugJsShellMaterializedRerunRaw?.materializedWorkload?.throughputMiBPerSec)}), but unchangedStaxBenchmark=false, sameContractStaxRow=false, canRunCurrentStaxFullStringBenchmark=${taskclusterDebugJsShellMaterializedRerun.outcome?.canRunCurrentStaxFullStringBenchmark ?? 'unknown'}, and closesEmittedIrObligation=false.`
          : 'No rerun Taskcluster debug js-shell materialized string/object codegen scope guard is recorded.',
        `Coverage diagnostic identity status counts: selectedRowIdentityStatusCounts ${formatCountMap(diagnosticIdentityStatusCounts)}.`,
        asciiScopeDistancePinned
          ? `The ASCII scope-distance audit pins corpusFileCount=${asciiScopeDistance.summary?.corpusFileCount ?? 'unknown'}, allCorpusFilesAscii=true, asciiByteToStringEquivalentToUtf8=true, semanticMaterializedWorkload=true, and reducesScopeDistance=true while closesCodegenObligation=false, so ASCII corpus equivalence narrows materialized js-shell scope but does not supply unchanged StAX closure evidence.`
          : 'No ASCII scope-distance audit pins corpus UTF-8 equivalence and materialized workload scope narrowing.',
        materializedScopeDistancePinned
          ? `The materialized scope-distance audit pins semanticEquivalentForAsciiFields=true while closureRequirementsMet=${materializedScopeDistance.summary?.closureRequirementsMet ?? 'unknown'} and closureRequirementsBlocked=${materializedScopeDistance.summary?.closureRequirementsBlocked ?? 'unknown'}; primarySyncByteBatchMissingGlobals=${(materializedScopeDistance.hostApiSurface?.primarySyncByteBatchMissingGlobals ?? []).join(', ') || 'unknown'}; asciiTextDecoderEquivalent=${materializedScopeDistance.asciiScopeDistance?.asciiByteToStringEquivalentToUtf8 ?? 'unknown'}; diagnosticThroughputMiBPerSec=${materializedScopeDistance.summary?.diagnosticThroughputMiBPerSec ?? 'unknown'}; throughputCountsAsTargetEvidence=${materializedScopeDistance.summary?.throughputCountsAsTargetEvidence ?? 'unknown'}; closesCodegenObligation=false, preventing the materialized js-shell artifact from being cited as unchanged StAX closure evidence.`
          : 'No materialized scope-distance audit pins the semantic-equivalence and closure boundary.',
        codegenClosureAuditPinned
          ? `The SpiderMonkey codegen closure audit checks ${codegenClosureAuditRaw.summary.candidateCount} diagnostic/codegen candidates against same-contract comparison generatedAt=${codegenClosureAuditRaw.inputs?.comparisonGeneratedAt ?? 'unknown'}, comparisonRowCount=${codegenClosureAuditRaw.inputs?.comparisonRowCount ?? 'unknown'}, finds emittedCodegenSurfaceCount=${codegenClosureAuditRaw.summary.emittedCodegenSurfaceCount}, sameContractStaxRowCount=${codegenClosureAuditRaw.summary.sameContractStaxRowCount}, unchangedRunnableCount=${codegenClosureAuditRaw.summary.unchangedRunnableCount}, selectedRowMetadataCount=${codegenClosureAuditRaw.summary.selectedRowMetadataCount}, selectedRowComparisonMatchCount=${codegenClosureAuditRaw.summary.selectedRowComparisonMatchCount}, selectedRowComparisonMismatchCount=${codegenClosureAuditRaw.summary.selectedRowComparisonMismatchCount}, selectedRowComparisonMissingCount=${codegenClosureAuditRaw.summary.selectedRowComparisonMissingCount}, selectedRowMetadataMissingFieldCounts ${formatCountMap(codegenClosureAuditRaw.summary.selectedRowMetadataMissingFieldCounts)}, closingMetadataMissingFieldCounts ${formatCountMap(codegenClosureAuditRaw.summary.closingMetadataMissingFieldCounts)}, disallowedEvidenceClassCounts ${formatCountMap(codegenClosureAuditRaw.summary.disallowedEvidenceClassCounts)}, selectedRowIdentityStatusCounts ${formatCountMap(codegenClosureAuditRaw.summary.selectedRowIdentityStatusCounts)}, qualifiedClosureCount=0, contradictedClosureClaimCount=0, and conclusionAllowed=false.`
          : 'No SpiderMonkey codegen closure audit pins the same-contract closure matrix for current diagnostic/codegen artifacts.',
        codegenClosureFrontierPinned
          ? `The SpiderMonkey codegen closure frontier has closestBlockedCandidateCount=${codegenClosureAuditRaw.summary.closestBlockedCandidateCount}, minimumBlockedRequirementCount=${codegenClosureAuditRaw.summary.minimumBlockedRequirementCount}, closestBlockedCandidates=${formatStringList(closestBlockedCandidateSources)}, and common missing requirements sameContractStaxRow=${codegenClosureAuditRaw.missingRequirementHistogram.sameContractStaxRow}, selectedRowMetadata=${codegenClosureAuditRaw.missingRequirementHistogram.selectedRowMetadata}, unchangedRunnable=${codegenClosureAuditRaw.missingRequirementHistogram.unchangedRunnable}, evidenceClassAllowed=${codegenClosureAuditRaw.missingRequirementHistogram.evidenceClassAllowed}.`
          : 'No SpiderMonkey codegen closure frontier summary pins closest blocked candidates and common missing requirements.',
        codegenRerunStabilityPinned
          ? `The SpiderMonkey codegen rerun stability audit compares ${codegenRerunStabilitySummary.pairCount} original/rerun pairs, reproduces ${codegenRerunStabilitySummary.reproduciblePairs} pairs on the same Taskcluster build and codegen marker counts, but qualifiedClosureCount=0, throughputCountsAsTargetEvidence=false, and conclusionAllowed=false.`
          : 'No SpiderMonkey codegen rerun stability audit pins original/rerun reproducibility as non-closure evidence.',
        buildconfigNoJitSpew
          ? 'Installed Firefox about:buildconfig records --enable-js-shell / MOZ_PACKAGE_JSSHELL but does not mention --enable-jitspew, JS_JITSPEW, or JS_STRUCTURED_SPEW.'
          : 'Installed Firefox buildconfig JitSpew boundary is not pinned as a no-JitSpew release build.',
      ],
      diagnosticIdentityStatusCounts,
      scopeGuard: 'These are local, official-shell, and Taskcluster debug-shell diagnostic facts only; they are not emitted SpiderMonkey JIT IR or optimized-code evidence for a same-contract StAX row.',
    });
  }

  return items;
}

function createHandoffs(activeObligations, localClosure) {
  const byId = new Map(activeObligations.map(obligation => [obligation.id, obligation]));
  const localClosureById = new Map(localClosure.map(item => [item.obligationId, item]));
  const handoffs = [];

  if (byId.has('safari-jsc-source-and-browser-rows-open')) {
    handoffs.push({
      id: 'safari-webkit-browser-row-handoff',
      obligationIds: ['safari-jsc-source-and-browser-rows-open'],
      classification: 'EXTERNAL_RUN_REQUIRED',
      localClosure: localClosureById.get('safari-jsc-source-and-browser-rows-open') ?? null,
      proofGoal: 'Produce same-contract Safari/WebKit browser rows separate from Bun/JSC, then rerun the coverage audit and counterexample scan.',
      sourceConsumptionContract: {
        primaryParserInput: 'Prepared full rows must consume StreamReaderSync over a synchronous Iterable<Uint8Array[]> generated by byteBatches(fixture).',
        demandDrivenSource: 'byteBatches(fixture) must yield one grouped Uint8Array[] batch per parser pull; the benchmark must not pass one full XML ArrayBuffer or full XML string as parser input.',
        directReadableStreamScope: 'Direct Response.body ReadableStream rows are source-overhead evidence only and must be reported as separate fetchReadableStreamFull or fetchAsyncByteBatchFull rows, not merged into the primary Safari/WebKit full-row target.',
        backpressureRequirement: 'Any direct ReadableStream row must read from the source only from pull() or reader.read() demand and must record that backpressure is respected.',
      },
      sourceBoundaryContract: {
        browserBuildIdentity: 'Record the exact Safari version, WebKit build/source revision when available, platform, and safaridriver version used for the row.',
        stringBoundary: 'Pin Safari/WebKit string creation and ownership source lines for the exact tested build or explicitly mark the source-boundary obligation as still open.',
        textDecoderBoundary: 'Pin Safari/WebKit TextDecoder/UTF-8 decode source lines for the exact tested build before citing TextDecoder internals for Safari rows.',
        bunWebKitScopeGuard: 'Bun/JSC and Bun-patched WebKit source pins are not Safari browser JSC source pins unless the tested Safari/WebKit build identity matches and is recorded.',
      },
      prerequisites: [
        'macOS host with the exact Safari/WebKit build under test.',
        'Safari WebDriver enabled and safaridriver available, normally /usr/bin/safaridriver.',
        'Repository checkout with benchmark dependencies installed and stax-xml build artifacts available.',
        'Use the same full-string checksum rows: stringFull, eventObjectFull, and rawFrameNameId before broadening cases.',
      ],
      commands: [
        {
          id: 'safari-availability-audit',
          purpose: 'Record whether the host can run Safari/WebKit rows.',
          command: 'node packages/benchmark/safari-webkit-availability-audit.mjs --json-out packages/benchmark/results/release/safari-webkit-availability-audit.json --md-out packages/benchmark/results/release/safari-webkit-availability-audit.md',
        },
        {
          id: 'safari-smoke',
          purpose: 'Prove the safaridriver harness can launch the target browser and preserve checksum parity on a small row.',
          command: 'node packages/benchmark/safari-webdriver-candidate-headroom.mjs --driver-executable /usr/bin/safaridriver --size-gib 0.001 --fixture-shape diverse-cycle --diverse-cycle-size 64 --cases stringFull,eventObjectFull,rawFrameNameId --json-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-smoke.json --md-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-smoke.md',
        },
        {
          id: 'safari-books-corpus-cross-process',
          purpose: 'Generate the first 1 GiB same-contract Safari/WebKit corpus stability row set.',
          command: 'node packages/benchmark/browser-candidate-headroom-cross-process.mjs --harness safari-webdriver --driver-executable /usr/bin/safaridriver --process-runs 3 --size-gib 1 --fixture-shape corpus-cycle --corpus-file packages/benchmark/assets/books.xml --batch-size 1 --cases stringFull,eventObjectFull,rawFrameNameId --output-dir packages/benchmark/results/cross-process/safari-webdriver-books-corpus --json-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-cross-process-books-corpus.json --md-out packages/benchmark/results/release/safari-webdriver-candidate-headroom-cross-process-books-corpus.md',
        },
        {
          id: 'safari-webkit-closure-audit',
          purpose: 'Recompute the same-contract Safari/WebKit browser-row closure matrix before reclassifying the obligation.',
          command: 'node packages/benchmark/safari-webkit-closure-audit.mjs --json-out packages/benchmark/results/release/safari-webkit-closure-audit.json --md-out packages/benchmark/results/release/safari-webkit-closure-audit.md',
        },
        {
          id: 'post-safari-audits',
          purpose: 'Classify whether Safari rows close the obligation or create a counterexample.',
          command: 'node packages/benchmark/same-contract-runtime-comparison.mjs --json-out packages/benchmark/results/release/same-contract-runtime-comparison.json --md-out packages/benchmark/results/release/same-contract-runtime-comparison.md && node packages/benchmark/safari-webkit-closure-audit.mjs --json-out packages/benchmark/results/release/safari-webkit-closure-audit.json --md-out packages/benchmark/results/release/safari-webkit-closure-audit.md && node packages/benchmark/runtime-counterexample-scan.mjs --json-out packages/benchmark/results/release/runtime-counterexample-scan.json --md-out packages/benchmark/results/release/runtime-counterexample-scan.md && node packages/benchmark/runtime-proof-coverage-audit.mjs --json-out packages/benchmark/results/release/runtime-proof-coverage-audit.json --md-out packages/benchmark/results/release/runtime-proof-coverage-audit.md && node packages/benchmark/source-consumption-shape-audit.mjs --json-out packages/benchmark/results/release/source-consumption-shape-audit.json --md-out packages/benchmark/results/release/source-consumption-shape-audit.md && node packages/benchmark/memory-frontier-audit.mjs --json-out packages/benchmark/results/release/memory-frontier-audit.json --md-out packages/benchmark/results/release/memory-frontier-audit.md && node packages/benchmark/target-distance-audit.mjs --json-out packages/benchmark/results/release/target-distance-audit.json --md-out packages/benchmark/results/release/target-distance-audit.md && node packages/benchmark/text-materialization-boundary-audit.mjs --json-out packages/benchmark/results/release/text-materialization-boundary-audit.json --md-out packages/benchmark/results/release/text-materialization-boundary-audit.md && node packages/benchmark/runtime-limit-proof-obligation-gate.mjs --json-out packages/benchmark/results/release/runtime-limit-proof-obligation-gate.json --md-out packages/benchmark/results/release/runtime-limit-proof-obligation-gate.md && node packages/benchmark/runtime-proof-gap-handoff.mjs --json-out packages/benchmark/results/release/runtime-proof-gap-handoff.json --md-out packages/benchmark/results/release/runtime-proof-gap-handoff.md',
        },
      ],
      expectedEvidence: [
        'Safari/WebKit environment.browserName or javascriptEngine is recognized as safari-jsc-browser by runtime-proof-coverage-audit.',
        'Rows preserve fullStringParity and the same event/checksum contract.',
        'Primary full rows record the synchronous Iterable<Uint8Array[]> source contract; direct ReadableStream rows, if run, remain separately named source-overhead rows.',
        'Any direct ReadableStream row records demand-driven pull/read consumption and backpressure-respecting behavior.',
        'Memory evidence is classified explicitly; missing Safari JS heap counters must not be treated as bounded-memory proof.',
        'Exact Safari/WebKit build identity and source-boundary status are recorded separately from Bun/JSC WebKit evidence.',
      ],
      closureChecks: [
        'runtime-proof-coverage-audit.json coverage.safariWebKitStatus.evidenceClass must be browser-row-evidence.',
        'runtime-proof-coverage-audit.json coverage.safariWebKitStatus.benchmarkRowsRecorded must be greater than 0.',
        'runtime-proof-coverage-audit.json coverage.safariWebKitStatus.directReadableStreamFullStringRowsRecorded must be reported separately and must not substitute for primarySyncByteBatchRowsRecorded.',
        'runtime-proof-coverage-audit.json coverage.safariWebKitStatus.directReadableStreamRowsAreSeparateEvidence must be true.',
        'runtime-proof-coverage-audit.json coverage.safariWebKitStatus.primarySyncByteBatchRowsRecorded must be greater than 0.',
        'runtime-proof-coverage-audit.json coverage.safariWebKitStatus.boundedPrimarySyncByteBatchRowsRecorded must be greater than 0.',
        'runtime-proof-coverage-audit.json coverage.safariWebKitStatus.primaryRowsInSameContractComparison must be true, with bounded primary row id, event count, and checksum matching same-contract-runtime-comparison.json.',
        'runtime-proof-coverage-audit.json coverage.safariWebKitStatus.largeBoundedPrimarySyncByteBatchRowsRecorded must be greater than 0 for 1 GiB+ Safari/WebKit primary rows.',
        'runtime-proof-coverage-audit.json coverage.safariWebKitStatus.largePrimaryRowsInSameContractComparison must be true, with 1 GiB+ bounded primary row id, event count, and checksum matching same-contract-runtime-comparison.json.',
        'runtime-proof-coverage-audit.json coverage.safariWebKitStatus.exactBuildIdentityRecorded must be true.',
        'runtime-proof-coverage-audit.json coverage.safariWebKitStatus.sourceBoundaryPinned must be true.',
        'safari-webkit-closure-audit.json summary.qualifiedClosureCount must be greater than 0 before safari-jsc-source-and-browser-rows-open can be closed.',
        'runtime-proof-coverage-audit.json coverage.safariWebKitStatus.closesSafariObligation must be true before safari-jsc-source-and-browser-rows-open can be marked covered.',
        'runtime-counterexample-scan.json must include any Safari/WebKit full-string rows and classify any 200 MiB/s+ bounded-memory row as a counterexample.',
        'target-distance-audit.json must be regenerated after Safari/WebKit rows so Woodstox and quick-xml 0.9x target distances use the same updated JavaScript comparison set.',
      ],
      scopeGuards: [
        'Safari rows are browser JSC evidence; they do not replace Bun/JSC rows.',
        'Bun/JSC WebKit source pins must not be reused as Safari source-boundary evidence without an exact build match.',
        'A missing or failing safaridriver run is environment evidence only, not a runtime limitation.',
        'Do not compare direct ReadableStream throughput against sync byte-batch rows as if they were the same source-consumption shape.',
      ],
    });
  }

  if (byId.has('codegen-traces-open')) {
    handoffs.push({
      id: 'spidermonkey-codegen-handoff',
      obligationIds: ['codegen-traces-open'],
      classification: 'EXTERNAL_RUN_REQUIRED',
      localClosure: localClosureById.get('codegen-traces-open') ?? null,
      proofGoal: 'Capture emitted SpiderMonkey JIT IR, optimized-code, or codegen diagnostics for same-contract Firefox/SpiderMonkey full-string rows.',
      prerequisites: [
        'Diagnostic-capable Firefox build or SpiderMonkey shell built with the required JitSpew/codegen diagnostics enabled.',
        'Set FIREFOX_PATH when using a non-default Firefox build; set SPIDERMONKEY_JS_SHELL, JSSHELL, or JS_SHELL when probing a shell.',
        'Keep checksum parity rows small first, then scale only after dump emission is proven.',
      ],
      commands: [
        {
          id: 'firefox-buildconfig-boundary',
          purpose: 'Record whether the selected Firefox build exposes JitSpew/codegen diagnostic build flags.',
          command: 'FIREFOX_PATH=/path/to/firefox node packages/benchmark/firefox-spidermonkey-buildconfig-source-pin-audit.mjs --json-out packages/benchmark/results/release/firefox-spidermonkey-buildconfig-source-pin-audit.json --md-out packages/benchmark/results/release/firefox-spidermonkey-buildconfig-source-pin-audit.md',
        },
        {
          id: 'firefox-diagnostic-installed-or-debug-build',
          purpose: 'Run the existing browser diagnostic dump audit against the Firefox build selected by FIREFOX_PATH.',
          command: 'FIREFOX_PATH=/path/to/firefox node packages/benchmark/firefox-spidermonkey-diagnostic-dump-audit.mjs --size-gib 0.0001 --fixture-shape diverse-cycle --diverse-cycle-size 16 --cases rawFrameNameId --output-dir packages/benchmark/results/firefox-spidermonkey-diagnostic-dump-audit --json-out packages/benchmark/results/release/firefox-spidermonkey-diagnostic-dump-audit.json --md-out packages/benchmark/results/release/firefox-spidermonkey-diagnostic-dump-audit.md',
        },
        {
          id: 'spidermonkey-js-shell-availability',
          purpose: 'Record whether a local SpiderMonkey shell is available for follow-up JIT diagnostics.',
          command: 'SPIDERMONKEY_JS_SHELL=/path/to/js node packages/benchmark/firefox-spidermonkey-js-shell-availability-audit.mjs --json-out packages/benchmark/results/release/firefox-spidermonkey-js-shell-availability-audit.json --md-out packages/benchmark/results/release/firefox-spidermonkey-js-shell-availability-audit.md',
        },
        {
          id: 'spidermonkey-official-jsshell-surface',
          purpose: 'Repeat the official release/nightly jsshell diagnostic surface audit before assuming a downloaded shell can emit MIR/LIR or optimized code.',
          command: 'node packages/benchmark/firefox-spidermonkey-release-jsshell-availability-audit.mjs --package-kind release --json-out packages/benchmark/results/release/firefox-spidermonkey-release-jsshell-availability-audit.json --md-out packages/benchmark/results/release/firefox-spidermonkey-release-jsshell-availability-audit.md && node packages/benchmark/firefox-spidermonkey-release-jsshell-availability-audit.mjs --package-kind nightly --json-out packages/benchmark/results/release/firefox-spidermonkey-nightly-jsshell-availability-audit.json --md-out packages/benchmark/results/release/firefox-spidermonkey-nightly-jsshell-availability-audit.md',
        },
        {
          id: 'spidermonkey-jsshell-tokenizer-headroom',
          purpose: 'Refresh js-shell tokenizer headroom as partial non-StAX evidence before reclassifying runtime-limit or counterexample status.',
          command: 'node packages/benchmark/spidermonkey-jsshell-tokenizer-headroom.mjs --json-out packages/benchmark/results/release/spidermonkey-jsshell-tokenizer-headroom.json --md-out packages/benchmark/results/release/spidermonkey-jsshell-tokenizer-headroom.md',
        },
        {
          id: 'spidermonkey-jsshell-materialized-headroom',
          purpose: 'Refresh js-shell string/object materialization headroom as partial non-StAX evidence before reclassifying runtime-limit or counterexample status.',
          command: 'node packages/benchmark/spidermonkey-jsshell-materialized-headroom.mjs --json-out packages/benchmark/results/release/spidermonkey-jsshell-materialized-headroom.json --md-out packages/benchmark/results/release/spidermonkey-jsshell-materialized-headroom.md',
        },
        {
          id: 'stax-public-reader-host-api-boundary',
          purpose: 'Re-pin the current StAX public reader TextDecoder/ReadableStream/TextEncoder boundary before evaluating js-shell closure.',
          command: 'node packages/benchmark/stax-public-reader-host-api-boundary-audit.mjs --json-out packages/benchmark/results/release/stax-public-reader-host-api-boundary-audit.json --md-out packages/benchmark/results/release/stax-public-reader-host-api-boundary-audit.md',
        },
        {
          id: 'spidermonkey-codegen-closure-audit',
          purpose: 'Recompute the same-contract SpiderMonkey codegen closure matrix before reclassifying the obligation.',
          command: 'node packages/benchmark/spidermonkey-codegen-closure-audit.mjs --json-out packages/benchmark/results/release/spidermonkey-codegen-closure-audit.json --md-out packages/benchmark/results/release/spidermonkey-codegen-closure-audit.md',
        },
        {
          id: 'spidermonkey-codegen-rerun-stability-audit',
          purpose: 'Recompute original/rerun SpiderMonkey debug js-shell codegen stability as diagnostic non-closure evidence.',
          command: 'node packages/benchmark/spidermonkey-codegen-rerun-stability-audit.mjs --json-out packages/benchmark/results/release/spidermonkey-codegen-rerun-stability-audit.json --md-out packages/benchmark/results/release/spidermonkey-codegen-rerun-stability-audit.md',
        },
        {
          id: 'post-spidermonkey-audits',
          purpose: 'Reclassify the codegen obligation after diagnostic artifacts are generated.',
          command: 'node packages/benchmark/stax-public-reader-host-api-boundary-audit.mjs --json-out packages/benchmark/results/release/stax-public-reader-host-api-boundary-audit.json --md-out packages/benchmark/results/release/stax-public-reader-host-api-boundary-audit.md && node packages/benchmark/spidermonkey-jsshell-tokenizer-headroom.mjs --json-out packages/benchmark/results/release/spidermonkey-jsshell-tokenizer-headroom.json --md-out packages/benchmark/results/release/spidermonkey-jsshell-tokenizer-headroom.md && node packages/benchmark/spidermonkey-jsshell-materialized-headroom.mjs --json-out packages/benchmark/results/release/spidermonkey-jsshell-materialized-headroom.json --md-out packages/benchmark/results/release/spidermonkey-jsshell-materialized-headroom.md && node packages/benchmark/spidermonkey-codegen-closure-audit.mjs --json-out packages/benchmark/results/release/spidermonkey-codegen-closure-audit.json --md-out packages/benchmark/results/release/spidermonkey-codegen-closure-audit.md && node packages/benchmark/spidermonkey-codegen-rerun-stability-audit.mjs --json-out packages/benchmark/results/release/spidermonkey-codegen-rerun-stability-audit.json --md-out packages/benchmark/results/release/spidermonkey-codegen-rerun-stability-audit.md && node packages/benchmark/runtime-counterexample-scan.mjs --json-out packages/benchmark/results/release/runtime-counterexample-scan.json --md-out packages/benchmark/results/release/runtime-counterexample-scan.md && node packages/benchmark/runtime-proof-coverage-audit.mjs --json-out packages/benchmark/results/release/runtime-proof-coverage-audit.json --md-out packages/benchmark/results/release/runtime-proof-coverage-audit.md && node packages/benchmark/source-consumption-shape-audit.mjs --json-out packages/benchmark/results/release/source-consumption-shape-audit.json --md-out packages/benchmark/results/release/source-consumption-shape-audit.md && node packages/benchmark/memory-frontier-audit.mjs --json-out packages/benchmark/results/release/memory-frontier-audit.json --md-out packages/benchmark/results/release/memory-frontier-audit.md && node packages/benchmark/target-distance-audit.mjs --json-out packages/benchmark/results/release/target-distance-audit.json --md-out packages/benchmark/results/release/target-distance-audit.md && node packages/benchmark/text-materialization-boundary-audit.mjs --json-out packages/benchmark/results/release/text-materialization-boundary-audit.json --md-out packages/benchmark/results/release/text-materialization-boundary-audit.md && node packages/benchmark/runtime-limit-proof-obligation-gate.mjs --json-out packages/benchmark/results/release/runtime-limit-proof-obligation-gate.json --md-out packages/benchmark/results/release/runtime-limit-proof-obligation-gate.md && node packages/benchmark/runtime-proof-gap-handoff.mjs --json-out packages/benchmark/results/release/runtime-proof-gap-handoff.json --md-out packages/benchmark/results/release/runtime-proof-gap-handoff.md',
        },
      ],
      expectedEvidence: [
        'A release artifact whose objective records emitted Firefox/SpiderMonkey JIT IR, optimized-code, or codegen dump evidence.',
        'The artifact must include the runtime/build identity, diagnostic flags, selected row id, event count, and checksum parity.',
        'The artifact must declare closesEmittedIrObligation=true only when sameContractStaxRow=true and canRunCurrentStaxFullStringBenchmark=true.',
        'The artifact must report selectedRowMatchesCurrentComparison=true against same-contract-runtime-comparison.json with event count and checksum parity.',
        'The artifact must report evidenceClassAllowed=true; diagnostic scope-guard, availability, source-pin, and negative-diagnostic classes cannot close the obligation.',
        'The coverage audit must classify the artifact as SpiderMonkey codegen evidence, not merely profiler/source/availability evidence.',
      ],
      closureChecks: [
        'runtime-proof-coverage-audit.json coverage.spiderMonkeyDiagnostics.emittedIrEvidenceCount must be greater than 0.',
        'runtime-proof-coverage-audit.json coverage.spiderMonkeyDiagnostics.missingIrSurfaceCount must be 0 for the SpiderMonkey diagnostic rows that are claimed as codegen closure evidence.',
        'spidermonkey-materialized-scope-distance-audit.json summary.closureRequirementsBlocked must be 0 before any materialized js-shell codegen artifact can be cited as same-contract StAX closure evidence.',
        'spidermonkey-materialized-scope-distance-audit.json summary.closesCodegenObligation must be true before materialized string/object codegen can close codegen-traces-open.',
        'spidermonkey-codegen-closure-audit.json summary.qualifiedClosureCount must be greater than 0 before codegen-traces-open can be closed.',
        'spidermonkey-codegen-rerun-stability-audit.json summary.qualifiedClosureCount must remain 0 unless the compared rerun artifacts are same-contract StAX closure evidence.',
        'Any SpiderMonkey closing artifact must report sameContractStaxRow=true and canRunCurrentStaxFullStringBenchmark=true, or explicitly explain why the browser-row artifact rather than js-shell artifact supplies unchanged StAX closure.',
        'The closing artifact selected row id must match a current same-contract full-string JavaScript row in same-contract-runtime-comparison.json, with event count and checksum parity recorded.',
        'The closing artifact must not have evidenceClass jit-status-only, source-pin-only, negative-diagnostic-surface, or missing-availability-audit.',
        'The closing artifact must include runtime/build identity, diagnostic flags, selected row id, event count, checksum parity, and emitted IR or optimized-code dump metadata.',
      ],
      scopeGuards: [
        'The existing no-dump diagnostic audit is a negative result for the installed browser build only.',
        'The installed buildconfig audit explains the local diagnostic surface but is still not emitted JIT IR.',
        'JS shell and official jsshell availability are environment evidence only until a dump or IR artifact is captured.',
        'Codegen rerun stability is reproducibility evidence only; it does not turn diagnostic js-shell workloads into unchanged StAX rows.',
      ],
    });
  }

  return handoffs;
}

function createFindings(activeObligations, handoffs, unhandledObligations) {
  return [
    {
      id: 'handoff-scope',
      classification: 'SCOPE_GUARD',
      summary: 'The handoff records next experiments for open proof gaps; it is not itself benchmark, allocation, or codegen evidence.',
      evidence: [
        `activeObligations=${activeObligations.map(row => `${row.id}:${row.status}`).join(', ') || 'none'}`,
        `handoffs=${handoffs.map(row => row.id).join(', ') || 'none'}`,
      ],
    },
    {
      id: 'handoff-coverage',
      classification: unhandledObligations.length === 0 ? 'CONTRACT_FACT' : 'OPEN',
      summary: unhandledObligations.length === 0
        ? 'Every currently active proof obligation has a concrete handoff entry.'
        : 'At least one active proof obligation still lacks a concrete handoff entry.',
      evidence: unhandledObligations.length === 0
        ? ['unhandledObligations=0']
        : unhandledObligations.map(row => `${row.id}: ${row.reason}`),
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Runtime Proof Gap Handoff',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Audit Input',
    '',
    `- Audit JSON: ${report.inputs.auditJson}`,
    `- Audit generated: ${report.inputs.auditGeneratedAt}`,
    `- Comparison JSON: ${report.inputs.comparisonJson}`,
    `- Comparison generated: ${report.inputs.comparisonGeneratedAt ?? 'n/a'}`,
    `- Active obligations: ${report.auditSummary.activeObligations.length}`,
    '',
    '## Summary',
    '',
    `- Handoffs: ${report.summary.handoffCount}`,
    `- Unhandled obligations: ${report.summary.unhandledObligationCount}`,
    `- External-run required closures: ${report.summary.externalRunRequiredCount}`,
    `- Locally runnable closures: ${report.summary.localRunnableCount}`,
    `- Audit artifacts: ${report.auditSummary.artifactCount ?? 'n/a'}`,
    `- Audit measured rows: ${report.auditSummary.measuredRows ?? 'n/a'}`,
    `- Primary source consumption: ${report.summary.sourceConsumptionPrimary}`,
    `- Direct ReadableStream scope: ${report.summary.directReadableStreamScope}`,
    `- Direct ReadableStream backpressure required: ${report.summary.directReadableStreamBackpressureRequired ? 'yes' : 'no'}`,
    `- Source consumption evidence status: ${report.summary.sourceConsumptionEvidenceStatus}`,
    `- Memory frontier evidence status: ${report.summary.memoryFrontierEvidenceStatus}`,
    `- External target evidence status: ${report.summary.externalTargetEvidenceStatus}`,
    `- Text materialization evidence status: ${report.summary.textMaterializationEvidenceStatus}`,
    `- Runtime-limit conclusion allowed: ${report.summary.conclusionAllowed ? 'yes' : 'no'}`,
    `- Conclusion blocker: ${report.summary.conclusionBlocker}`,
    '',
    '## Source Consumption Evidence',
    '',
    `- Status: ${report.sourceConsumptionEvidence.status}`,
    `- Source artifact: ${report.sourceConsumptionEvidence.sourceArtifact}`,
  ];

  if (report.sourceConsumptionEvidence.status === 'missing') {
    lines.push(`- Reason: ${report.sourceConsumptionEvidence.reason}`);
  } else {
    const evidence = report.sourceConsumptionEvidence;
    lines.push(
      `- Aggregate rows: ${evidence.rowCount}`,
      `- Source modes: ${evidence.sourceModes.join(', ') || 'none'}`,
      `- 1 GiB+ JS full-string source-mode rows not using full ArrayBuffer parser input: ${evidence.sourceShapeSafety.notFullArrayBufferRows}/${evidence.sourceShapeSafety.largeJsFullSourceModeRows}`,
      `- Full ArrayBuffer parser-input rows: ${evidence.sourceShapeSafety.fullArrayBufferRows}`,
      `- Unknown parser-input rows: ${evidence.sourceShapeSafety.unknownArrayBufferRows}`,
      `- Corpus seed replay rows: ${evidence.sourceShapeSafety.corpusSeedReplayRows}`,
      `- File-backed sync Iterable<Uint8Array[]> rows: ${evidence.sourceShapeSafety.fileBackedSyncIterableRows}`,
      `- Separate direct ReadableStream source-overhead rows: ${evidence.sourceShapeSafety.directReadableStreamRows}`,
      `- Primary source contract: ${evidence.primarySourceShapeSafety.contract}`,
      `- Primary parser input: ${evidence.primarySourceShapeSafety.parserInput}`,
      `- Primary source boundary: ${evidence.primarySourceShapeSafety.sourceBoundary}`,
      `- Primary ArrayBuffer parser input: ${evidence.primarySourceShapeSafety.arrayBufferParserInput}`,
      `- Primary backpressure contract: ${evidence.primarySourceShapeSafety.backpressureContract}`,
      `- Primary sync byte-batch rows: ${evidence.primarySourceShapeSafety.rows}; excluded rows: ${evidence.primarySourceShapeSafety.excludedRows}`,
      `- Primary source modes: ${evidence.primarySourceShapeSafety.sourceModes.join(', ') || 'none'}`,
      `- Primary excluded direct/async/full-ArrayBuffer/unknown rows: ${evidence.primarySourceShapeSafety.directReadableStreamRows}/${evidence.primarySourceShapeSafety.asyncSourceRows}/${evidence.primarySourceShapeSafety.fullArrayBufferRows}/${evidence.primarySourceShapeSafety.unknownSourceModeRows}`,
      `- Fastest primary source row: ${formatTargetEvidenceRow(evidence.primarySourceShapeSafety.fastestRow)}`,
    );
    if (evidence.primarySourceShapeSafety.excludedBreakdown.length > 0) {
      lines.push(
        '',
        '| Primary exclusion reason | Rows | Fastest excluded row |',
        '| --- | ---: | --- |',
        ...evidence.primarySourceShapeSafety.excludedBreakdown.map(entry =>
          `| \`${entry.reason}\` | ${entry.rows} | ${entry.fastestRow ? `${entry.fastestRow.runtimeLabel} \`${entry.fastestRow.caseId}\` ${formatNumber(entry.fastestRow.mibPerSec)} MiB/s from \`${entry.fastestRow.sourceArtifact}\`` : 'n/a'} |`
        ),
      );
    }
    if (evidence.sourceShapeSafety.sourceModeBreakdown.length > 0) {
      lines.push(
        '',
        '| Source mode | Rows | Not full ArrayBuffer | Direct ReadableStream | Corpus seed replay | Fastest row |',
        '| --- | ---: | ---: | ---: | ---: | --- |',
        ...evidence.sourceShapeSafety.sourceModeBreakdown.map(sourceShapeMarkdownRow),
      );
    }
    if (evidence.sourceConsumptionFrontier) {
      lines.push(
        `- Node source frontier: ${evidence.sourceConsumptionFrontier.fastestSyncIterable} ${formatNumber(evidence.sourceConsumptionFrontier.fastestSyncIterableMiBPerSec)} MiB/s vs ${evidence.sourceConsumptionFrontier.fastestReadableStream} ${formatNumber(evidence.sourceConsumptionFrontier.fastestReadableStreamMiBPerSec)} MiB/s (${formatNumber(evidence.sourceConsumptionFrontier.fastestReadableStreamRatioToFastestSyncIterable)}x); backpressure ${evidence.sourceConsumptionFrontier.backpressureRowsRespected}/${evidence.sourceConsumptionFrontier.backpressureRows}; fullArrayBufferRows=${evidence.sourceConsumptionFrontier.fullArrayBufferRows}`,
      );
    }
    if (evidence.browserLiveSourceFrontier) {
      lines.push(
        `- Browser live fetch frontier: ${evidence.browserLiveSourceFrontier.fetchReadableStreamRow} ${formatNumber(evidence.browserLiveSourceFrontier.fetchReadableStreamMiBPerSec)} MiB/s; ${evidence.browserLiveSourceFrontier.fetchAsyncByteBatchRow} ${formatNumber(evidence.browserLiveSourceFrontier.fetchAsyncByteBatchMiBPerSec)} MiB/s; backpressure ${evidence.browserLiveSourceFrontier.liveRowsBackpressureRespected}/${evidence.browserLiveSourceFrontier.liveRows}; fullArrayBufferRows=${evidence.browserLiveSourceFrontier.liveRowsFullArrayBufferInput}`,
      );
    }
  }

  lines.push(
    '',
    '## Memory Frontier Evidence',
    '',
    `- Status: ${report.memoryFrontierEvidence.status}`,
    `- Source artifact: ${report.memoryFrontierEvidence.sourceArtifact}`,
  );

  if (report.memoryFrontierEvidence.status === 'missing') {
    lines.push(`- Reason: ${report.memoryFrontierEvidence.reason}`);
  } else {
    const evidence = report.memoryFrontierEvidence;
    lines.push(
      `- Contract: ${evidence.contract}`,
      `- 1 GiB+ JS full-string memory rows: ${evidence.rows}`,
      `- Bounded rows: ${evidence.boundedRows}`,
      `- Unbounded or unproven rows: ${evidence.unboundedRows}`,
      `- Unbounded or unproven rows at or above 200 MiB/s: ${evidence.unboundedRowsAtOrAbove200MiBPerSec}`,
      `- Memory kinds: ${evidence.memoryKinds.join(', ') || 'none'}`,
      `- Fastest bounded row: ${formatMemoryEvidenceRow(evidence.fastestBoundedRow)}`,
      `- Fastest unbounded or unproven row: ${formatMemoryEvidenceRow(evidence.fastestUnboundedRow)}`,
      `- Fastest process RSS row under 128 MiB: ${formatMemoryEvidenceRow(evidence.fastestProcessRssUnder128MiB)}`,
      `- Fastest browser JS heap row: ${formatMemoryEvidenceRow(evidence.fastestBrowserJsHeapRow)}`,
      '',
      '| Memory kind | Rows | Bounded | Unbounded/unproven | Max recorded | Fastest row | Fastest bounded row |',
      '| --- | ---: | ---: | ---: | ---: | --- | --- |',
    );
    for (const bucket of evidence.buckets) {
      lines.push(`| ${bucket.kind} | ${bucket.rows} | ${bucket.boundedRows} | ${bucket.unboundedRows} | ${formatNumber(bucket.maxMiB)} MiB | ${formatMemoryEvidenceRow(bucket.fastestRow)} | ${formatMemoryEvidenceRow(bucket.fastestBoundedRow)} |`);
    }
    lines.push('', `- Interpretation: ${evidence.interpretation}`);
  }

  lines.push(
    '',
    '## External Target Evidence',
    '',
    `- Status: ${report.externalTargetEvidence.status}`,
    `- Source artifact: ${report.externalTargetEvidence.sourceArtifact}`,
  );

  if (report.externalTargetEvidence.status === 'missing') {
    lines.push(`- Reason: ${report.externalTargetEvidence.reason}`);
  } else {
    const evidence = report.externalTargetEvidence;
    const woodstox = evidence.sameFixture1024MiBWoodstoxTarget;
    const quickXml = evidence.sameFixture1024MiBQuickXmlTarget;
    const external = evidence.externalBaseline1024MiBFileSyncBatches;
    const rss = evidence.sameFixture1024MiBProcessRssSnapshot;
    const sameFixtureFastestJsContract = evidence.sameFixtureFastestJsContract;
    lines.push(
      `- Contract: ${evidence.contract}`,
      `- Fastest aggregated JS full row: ${formatTargetEvidenceRow(evidence.fastestJsLargeFullRow)}`,
      `- Fastest primary sync byte-batch JS full row: ${formatTargetEvidenceRow(evidence.fastestPrimaryJsLargeFullRow)}`,
      `- Fastest JS full row vs 200 MiB/s: ${formatNumber(evidence.fastestJsLargeFullRowTo200MiBPerSec?.ratio)}x, ${formatNumber(evidence.fastestJsLargeFullRowTo200MiBPerSec?.remainingMiBPerSec)} MiB/s remaining`,
      `- Fastest primary JS full row vs 200 MiB/s: ${formatNumber(evidence.fastestPrimaryJsLargeFullRowTo200MiBPerSec?.ratio)}x, ${formatNumber(evidence.fastestPrimaryJsLargeFullRowTo200MiBPerSec?.remainingMiBPerSec)} MiB/s remaining`,
      `- Fastest JS full row vs 1024 MiB Woodstox reference: ${formatNumber(evidence.fastestJsLargeFullRowTo1024MiBWoodstoxReference?.ratio)}x, ${formatNumber(evidence.fastestJsLargeFullRowTo1024MiBWoodstoxReference?.remainingTo90PercentMiBPerSec)} MiB/s below 0.9x target`,
      `- Same-fixture Woodstox target: ${woodstox.fastestJsCaseId} ${formatNumber(woodstox.fastestJsMiBPerSec)} MiB/s vs Woodstox ${formatNumber(woodstox.woodstoxMiBPerSec)} MiB/s; 0.9x target ${formatNumber(woodstox.target90MiBPerSec)} MiB/s; remaining ${formatNumber(woodstox.remainingTo90PercentMiBPerSec)} MiB/s; targetMet=${formatNullableBoolean(woodstox.targetMet)}`,
      `- Same-fixture quick-xml target: ${quickXml.fastestJsCaseId} ${formatNumber(quickXml.fastestJsMiBPerSec)} MiB/s vs quick-xml ${formatNumber(quickXml.quickXmlMiBPerSec)} MiB/s; 0.9x target ${formatNumber(quickXml.target90MiBPerSec)} MiB/s; remaining ${formatNumber(quickXml.remainingTo90PercentMiBPerSec)} MiB/s; targetMet=${formatNullableBoolean(quickXml.targetMet)}`,
      `- Same-fixture fastest JS source/memory contract: ${formatTargetEvidenceRow(sameFixtureFastestJsContract)}; sourceMode=${sameFixtureFastestJsContract?.sourceMode ?? 'n/a'}; directReadableStream=${formatNullableBoolean(sameFixtureFastestJsContract?.directReadableStream)}; fullArrayBufferParserInput=${formatNullableBoolean(sameFixtureFastestJsContract?.fullArrayBufferParserInput)}; boundedMemory=${formatNullableBoolean(sameFixtureFastestJsContract?.boundedMemory)}`,
      `- 1024 MiB external baseline: stax-stream ${formatNumber(external.staxStreamMiBPerSec)} MiB/s (${formatNumber(external.staxStreamWoodstoxRatio)}x Woodstox); rawFrameNameId ${formatNumber(external.rawFrameNameIdMiBPerSec)} MiB/s (${formatNumber(external.rawFrameNameIdWoodstoxRatio)}x Woodstox); Woodstox ${formatNumber(external.woodstoxMiBPerSec)} MiB/s; quick-xml ${formatNumber(external.quickXmlMiBPerSec)} MiB/s (${formatNumber(external.quickXmlWoodstoxRatio)}x Woodstox)`,
      `- Same-fixture process RSS: JS ${formatNumber(rss.fastestJs?.maxRssMiB)} MiB; Woodstox ${formatNumber(rss.woodstox?.maxRssMiB)} MiB; quick-xml ${formatNumber(rss.quickXml?.maxRssMiB)} MiB`,
      `- Process RSS caveat: ${rss.caveat}`,
      `- Interpretation: ${evidence.interpretation}`,
    );
  }

  lines.push(
    '',
    '## Text Materialization Evidence',
    '',
    `- Status: ${report.textMaterializationEvidence.status}`,
    `- Source artifact: ${report.textMaterializationEvidence.sourceArtifact}`,
  );

  if (report.textMaterializationEvidence.status === 'missing') {
    lines.push(`- Reason: ${report.textMaterializationEvidence.reason}`);
  } else {
    const evidence = report.textMaterializationEvidence;
    lines.push(
      `- Frontier artifact: ${evidence.frontierArtifact}`,
      `- Contract: ${evidence.contract}`,
      `- Target: ${formatNumber(evidence.targetMiBPerSec)} MiB/s`,
      `- Fastest full-string row: ${formatTextFrontierRow(evidence.fastestFull)}`,
      `- Fastest without text/CDATA strings row: ${formatTextFrontierRow(evidence.fastestWithoutText)}`,
      `- Fastest no-trim row: ${formatTextFrontierRow(evidence.fastestNoTrim)}`,
      `- Fastest fold-trim row: ${formatTextFrontierRow(evidence.fastestFoldTrim)}`,
      `- Fastest full row target distance: ${formatNumber(evidence.fastestFullToTargetRatio)}x target, ${formatNumber(evidence.fastestFullRemainingMiBPerSec)} MiB/s remaining, ${formatNumber(evidence.requiredSpeedupToTarget)}x speedup required`,
      `- Without-text to full ratio: ${formatNumber(evidence.fastestWithoutTextToFullRatio)}x`,
      `- No-trim to full ratio: ${formatNumber(evidence.fastestNoTrimToFullRatio)}x`,
      `- Fold-trim to full ratio: ${formatNumber(evidence.fastestFoldTrimToFullRatio)}x`,
      `- Rows crossing target: full=${evidence.fullRowsCrossTarget}, withoutText=${evidence.noTextRowsCrossTarget}, noTrim=${evidence.noTrimRowsCrossTarget}, foldTrim=${evidence.foldTrimRowsCrossTarget}`,
      `- Negative candidate count: ${evidence.negativeCandidateCount}`,
      `- Interpretation: ${evidence.interpretation}`,
    );
  }

  lines.push(
    '',
    '## Active Obligations',
    '',
  );

  for (const obligation of report.auditSummary.activeObligations) {
    lines.push(`- ${obligation.id} (${obligation.status}): ${obligation.evidence}`);
    lines.push(`  - Next: ${obligation.nextExperiment}`);
  }

  lines.push('', '## Handoffs', '');
  for (const handoff of report.handoffs) {
    lines.push(`### ${handoff.id}`);
    lines.push('');
    lines.push(`- Classification: ${handoff.classification}`);
    lines.push(`- Obligations: ${handoff.obligationIds.join(', ')}`);
    lines.push(`- Proof goal: ${handoff.proofGoal}`);
    if (handoff.localClosure) {
      lines.push(`- Local closure status: ${handoff.localClosure.localStatus}`);
      lines.push(`- Locally runnable now: ${formatNullableBoolean(handoff.localClosure.localRunnable)}`);
      lines.push(`- Local closure scope: ${handoff.localClosure.scopeGuard}`);
      if (handoff.localClosure.diagnosticIdentityStatusCounts) {
        lines.push(`- Diagnostic identity status counts: ${formatCountMap(handoff.localClosure.diagnosticIdentityStatusCounts)}`);
      }
      lines.push('- Local blockers:');
      for (const blocker of handoff.localClosure.blockers) {
        lines.push(`  - ${blocker}`);
      }
      lines.push(`- Local evidence artifacts: ${handoff.localClosure.evidenceArtifacts.join(', ') || 'none'}`);
    }
    lines.push('');
    lines.push('Prerequisites:');
    for (const prerequisite of handoff.prerequisites) {
      lines.push(`- ${prerequisite}`);
    }
    if (handoff.sourceConsumptionContract) {
      lines.push('');
      lines.push('Source consumption contract:');
      for (const [name, value] of Object.entries(handoff.sourceConsumptionContract)) {
        lines.push(`- ${name}: ${value}`);
      }
    }
    if (handoff.sourceBoundaryContract) {
      lines.push('');
      lines.push('Source boundary contract:');
      for (const [name, value] of Object.entries(handoff.sourceBoundaryContract)) {
        lines.push(`- ${name}: ${value}`);
      }
    }
    lines.push('');
    lines.push('Commands:');
    for (const command of handoff.commands) {
      lines.push(`- ${command.id}: ${command.purpose}`);
      lines.push(`  - \`${command.command}\``);
    }
    lines.push('');
    lines.push('Expected evidence:');
    for (const item of handoff.expectedEvidence) {
      lines.push(`- ${item}`);
    }
    if (handoff.closureChecks?.length > 0) {
      lines.push('');
      lines.push('Closure checks:');
      for (const item of handoff.closureChecks) {
        lines.push(`- ${item}`);
      }
    }
    lines.push('');
    lines.push('Scope guards:');
    for (const guard of handoff.scopeGuards) {
      lines.push(`- ${guard}`);
    }
    lines.push('');
  }

  if (report.unhandledObligations.length > 0) {
    lines.push('## Unhandled Obligations', '');
    for (const obligation of report.unhandledObligations) {
      lines.push(`- ${obligation.id} (${obligation.status}): ${obligation.reason}`);
    }
    lines.push('');
  }

  lines.push('## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const item of finding.evidence) {
      lines.push(`  - ${item}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function formatNullableBoolean(value) {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return 'unknown';
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function formatTaskclusterIdentity(artifact) {
  const provenance = artifact?.shell?.provenance ?? {};
  const taskId = provenance.taskId ?? 'unknown';
  const buildId = provenance.buildId ?? provenance.targetTxt?.buildId ?? provenance.buildhub?.buildId ?? 'unknown';
  const sourceRevision = provenance.sourceRevision
    ?? provenance.targetTxt?.sourceRevision
    ?? provenance.buildhub?.sourceRevision
    ?? 'unknown';
  return `taskId=${taskId}, buildId=${buildId}, sourceRevision=${sourceRevision}`;
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

function sourceShapeMarkdownRow(entry) {
  const fastest = entry.fastestRow;
  const fastestText = fastest
    ? `${fastest.runtimeLabel} ${fastest.caseId} ${formatNumber(fastest.mibPerSec)} MiB/s from ${fastest.sourceArtifact}`
    : 'n/a';
  return `| ${entry.sourceMode} | ${entry.rows} | ${entry.notFullArrayBufferRows} | ${entry.directReadableStreamRows} | ${entry.corpusSeedReplayRows} | ${fastestText} |`;
}

function formatMemoryEvidenceRow(row) {
  if (!row) return 'none';
  const memory = row.maxMiB === null || row.maxMiB === undefined
    ? row.memoryKind
    : `${row.memoryKind} max ${formatNumber(row.maxMiB)} MiB`;
  return `${row.runtimeLabel} ${row.caseId} ${formatNumber(row.mibPerSec)} MiB/s (${memory})`;
}

function formatTargetEvidenceRow(row) {
  if (!row) return 'none';
  const memory = row.maxMiB === null || row.maxMiB === undefined
    ? row.memoryKind
    : `${row.memoryKind} max ${formatNumber(row.maxMiB)} MiB`;
  return `${row.runtimeLabel} ${row.caseId} ${formatNumber(row.mibPerSec)} MiB/s (${memory})`;
}

function formatTextFrontierRow(row) {
  if (!row) return 'none';
  return `${row.id} from ${row.sourceArtifact} at ${formatNumber(row.mibPerSec)} MiB/s (fullStringParity=${formatNullableBoolean(row.fullStringParity)}, boundedMemory=${formatNullableBoolean(row.boundedMemory)})`;
}

function countBy(values, keyOf) {
  const counts = {};
  for (const value of values) {
    const key = keyOf(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function maxBy(items, score) {
  let best = null;
  let bestScore = -Infinity;
  for (const item of items) {
    const value = score(item);
    if (typeof value === 'number' && value > bestScore) {
      best = item;
      bestScore = value;
    }
  }
  return best;
}

function printSummary(report) {
  console.log(`runtime-proof-gap-handoff: handoffs=${report.handoffs.length} unhandled=${report.unhandledObligations.length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
