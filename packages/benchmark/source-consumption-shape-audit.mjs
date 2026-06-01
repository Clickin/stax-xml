import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultComparisonJson = resolve(__dirname, 'results', 'release', 'same-contract-runtime-comparison.json');
const defaultCoverageJson = resolve(__dirname, 'results', 'release', 'runtime-proof-coverage-audit.json');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'source-consumption-shape-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'source-consumption-shape-audit.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    comparisonJson: defaultComparisonJson,
    coverageJson: defaultCoverageJson,
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
      case '--comparison-json':
        options.comparisonJson = resolve(process.cwd(), readValue());
        break;
      case '--coverage-json':
        options.coverageJson = resolve(process.cwd(), readValue());
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
  const comparison = readComparison(options.comparisonJson);
  const coverage = readCoverage(options.coverageJson);
  const report = createReport(comparison, coverage, options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`source-consumption-shape-audit: status=${report.summary.status} rows=${report.summary.largeJsFullSourceModeRows}`);
}

function readComparison(comparisonJson) {
  if (!existsSync(comparisonJson)) {
    throw new Error(`same-contract comparison JSON was not found: ${comparisonJson}`);
  }
  const comparison = JSON.parse(readFileSync(comparisonJson, 'utf8'));
  if (comparison.objective !== 'same-contract-runtime-comparison') {
    throw new Error(`expected same-contract-runtime-comparison JSON, got ${comparison.objective ?? 'unknown'}`);
  }
  return comparison;
}

function readCoverage(coverageJson) {
  if (!coverageJson || !existsSync(coverageJson)) return null;
  const coverage = JSON.parse(readFileSync(coverageJson, 'utf8'));
  if (coverage.objective !== 'runtime-proof-coverage-audit') {
    throw new Error(`expected runtime-proof-coverage-audit JSON, got ${coverage.objective ?? 'unknown'}`);
  }
  return coverage;
}

function createReport(comparison, coverage, options) {
  const summary = comparison.summary ?? {};
  const sourceShape = summary.sourceShapeSafety ?? {};
  const primarySourceShape = summary.primarySourceShapeSafety ?? {};
  const sourceFrontier = summary.sourceConsumptionFrontier ?? null;
  const browserFrontier = summary.browserLiveSourceFrontier ?? null;
  const largeRows = sourceShape.largeJsFullSourceModeRows ?? 0;
  const notFullArrayBufferRows = sourceShape.notFullArrayBufferRows ?? 0;
  const fullArrayBufferRows = sourceShape.fullArrayBufferRows ?? 0;
  const unknownArrayBufferRows = sourceShape.unknownArrayBufferRows ?? 0;
  const primaryRows = primarySourceShape.rows ?? 0;
  const primaryDirectReadableStreamRows = primarySourceShape.directReadableStreamRows ?? null;
  const primaryAsyncSourceRows = primarySourceShape.asyncSourceRows ?? null;
  const primaryFullArrayBufferRows = primarySourceShape.fullArrayBufferRows ?? null;
  const primaryUnknownSourceModeRows = primarySourceShape.unknownSourceModeRows ?? null;
  const backpressureRows = sourceFrontier?.backpressureRows ?? 0;
  const backpressureRowsRespected = sourceFrontier?.backpressureRowsRespected ?? 0;
  const liveRows = browserFrontier?.liveRows ?? 0;
  const liveRowsBackpressureRespected = browserFrontier?.liveRowsBackpressureRespected ?? 0;
  const representativeStreamRowsRespectBackpressure = representativeStreamBackpressureRespected(sourceFrontier, browserFrontier);
  const status = largeRows > 0
    && notFullArrayBufferRows === largeRows
    && fullArrayBufferRows === 0
    && unknownArrayBufferRows === 0
    && primaryRows > 0
    && primaryDirectReadableStreamRows === 0
    && primaryAsyncSourceRows === 0
    && primaryFullArrayBufferRows === 0
    && primaryUnknownSourceModeRows === 0
    && backpressureRows === backpressureRowsRespected
    && liveRows === liveRowsBackpressureRespected
    && representativeStreamRowsRespectBackpressure
    ? 'classified'
    : 'partial';

  return {
    generatedAt: new Date().toISOString(),
    objective: 'source-consumption-shape-audit',
    contract: 'large-js-full-string-rows-are-not-full-arraybuffer-parser-input',
    note: 'Audits source-consumption metadata from the same-contract aggregate. This is not a benchmark run and not a runtime-limit conclusion.',
    inputs: {
      comparisonJson: options.comparisonJson,
      comparisonGeneratedAt: comparison.generatedAt ?? null,
      comparisonObjective: comparison.objective,
      comparisonContract: comparison.contract,
      coverageJson: options.coverageJson,
      coverageGeneratedAt: coverage?.generatedAt ?? null,
      coverageObjective: coverage?.objective ?? null,
    },
    summary: {
      status,
      aggregateRowCount: summary.rowCount ?? null,
      jsLargeFullRowCount: summary.jsLargeFullRowCount ?? null,
      sourceModes: summary.sourceModes ?? [],
      largeJsFullSourceModeRows: largeRows,
      notFullArrayBufferRows,
      fullArrayBufferRows,
      unknownArrayBufferRows,
      directReadableStreamRows: sourceShape.directReadableStreamRows ?? null,
      corpusSeedReplayRows: sourceShape.corpusSeedReplayRows ?? null,
      fileBackedSyncIterableRows: sourceShape.fileBackedSyncIterableRows ?? null,
      syncIterableRows: findBreakdownRows(sourceShape, 'sync-iterable-byte-batches'),
      primarySourceContract: primarySourceShape.contract ?? null,
      primaryParserInput: primarySourceShape.parserInput ?? null,
      primarySourceBoundary: primarySourceShape.sourceBoundary ?? null,
      primaryArrayBufferParserInput: primarySourceShape.arrayBufferParserInput ?? null,
      primaryBackpressureContract: primarySourceShape.backpressureContract ?? null,
      primarySyncByteBatchRows: primaryRows,
      primaryExcludedRows: primarySourceShape.excludedRows ?? null,
      primaryDirectReadableStreamRows,
      primaryAsyncSourceRows,
      primaryFullArrayBufferRows,
      primaryUnknownSourceModeRows,
      primarySourceModes: primarySourceShape.sourceModes ?? [],
      primaryFastestRow: primarySourceShape.fastestRow ? summarizeRow(primarySourceShape.fastestRow) : null,
      asyncOrReadableRowsRespectBackpressure: backpressureRows === backpressureRowsRespected,
      browserLiveRowsRespectBackpressure: liveRows === liveRowsBackpressureRespected,
      representativeStreamRowsRespectBackpressure,
      conclusionAllowed: false,
    },
    primaryExcludedBreakdown: (primarySourceShape.excludedBreakdown ?? []).map(entry => ({
      reason: entry.reason,
      rows: entry.rows,
      fastestRow: entry.fastestRow ? summarizeRow(entry.fastestRow) : null,
    })),
    sourceModeBreakdown: (sourceShape.sourceModeBreakdown ?? []).map(entry => ({
      sourceMode: entry.sourceMode,
      rows: entry.rows,
      notFullArrayBufferRows: entry.notFullArrayBufferRows,
      fullArrayBufferRows: entry.fullArrayBufferRows,
      unknownArrayBufferRows: entry.unknownArrayBufferRows,
      directReadableStreamRows: entry.directReadableStreamRows,
      corpusSeedReplayRows: entry.corpusSeedReplayRows,
      fastestRow: entry.fastestRow ? summarizeRow(entry.fastestRow) : null,
    })),
    sourceConsumptionFrontier: sourceFrontier ? {
      sourceArtifact: sourceFrontier.sourceArtifact,
      fastestSyncIterable: summarizeFrontierRow(sourceFrontier.fastestSyncIterable),
      fastestReadableStream: summarizeFrontierRow(sourceFrontier.fastestReadableStream),
      fastestReadableStreamRatioToFastestSyncIterable: sourceFrontier.fastestReadableStreamRatioToFastestSyncIterable ?? null,
      backpressureRows,
      backpressureRowsRespected,
      fullArrayBufferRows: sourceFrontier.fullArrayBufferRows ?? null,
    } : null,
    browserLiveSourceFrontier: browserFrontier ? {
      sourceArtifact: browserFrontier.sourceArtifact,
      fetchReadableStreamRow: summarizeFrontierRow(browserFrontier.fetchReadableStreamRow),
      fetchAsyncByteBatchRow: summarizeFrontierRow(browserFrontier.fetchAsyncByteBatchRow),
      liveRows,
      liveRowsBackpressureRespected,
      liveRowsFullArrayBufferInput: browserFrontier.liveRowsFullArrayBufferInput ?? null,
    } : null,
    coverageCrosscheck: createCoverageCrosscheck(coverage, options),
    findings: createFindings(status, sourceShape, primarySourceShape, sourceFrontier, browserFrontier, representativeStreamRowsRespectBackpressure),
  };
}

function representativeStreamBackpressureRespected(sourceFrontier, browserFrontier) {
  const representativeRows = [
    sourceFrontier?.fastestReadableStream,
    browserFrontier?.fetchReadableStreamRow,
    browserFrontier?.fetchAsyncByteBatchRow,
  ].filter(Boolean);
  return representativeRows.length === 0
    || representativeRows.every(row => row.respectsBackpressure === true);
}

function createCoverageCrosscheck(coverage, options) {
  if (!coverage) {
    return {
      status: 'missing',
      sourceArtifact: basename(options.coverageJson),
      reason: 'runtime-proof-coverage-audit JSON was not available.',
      sourceModeRows: 0,
      notFullArrayBufferRows: 0,
      fullArrayBufferRows: 0,
      unknownArrayBufferRows: 0,
      directReadableStreamRows: 0,
      demandDrivenRows: 0,
      sourceModeBreakdown: [],
    };
  }

  const sourceInputSafety = coverage.summary?.largeJsFullSourceInputSafety ?? {};
  const sourceModeRows = sourceInputSafety.sourceModeRows ?? 0;
  const notFullArrayBufferRows = sourceInputSafety.notFullArrayBufferRows ?? 0;
  const fullArrayBufferRows = sourceInputSafety.fullArrayBufferRows ?? 0;
  const unknownArrayBufferRows = sourceInputSafety.unknownArrayBufferRows ?? 0;
  const directReadableStreamRows = sourceInputSafety.directReadableStreamRows ?? 0;
  const demandDrivenRows = sourceInputSafety.demandDrivenRows ?? 0;
  const status = sourceModeRows > 0
    && notFullArrayBufferRows === sourceModeRows
    && fullArrayBufferRows === 0
    && unknownArrayBufferRows === 0
    ? 'consistent'
    : 'partial';

  return {
    status,
    sourceArtifact: basename(options.coverageJson),
    sourceModeRows,
    notFullArrayBufferRows,
    fullArrayBufferRows,
    unknownArrayBufferRows,
    directReadableStreamRows,
    demandDrivenRows,
    sourceModeBreakdown: (sourceInputSafety.sourceModeBreakdown ?? []).map(entry => ({
      sourceMode: entry.sourceMode,
      rows: entry.rows,
      notFullArrayBufferRows: entry.notFullArrayBufferRows,
      fullArrayBufferRows: entry.fullArrayBufferRows,
      unknownArrayBufferRows: entry.unknownArrayBufferRows,
      directReadableStreamRows: entry.directReadableStreamRows,
      demandDrivenRows: entry.demandDrivenRows,
      fastestRow: entry.fastestRow ? summarizeCoverageRow(entry.fastestRow) : null,
    })),
  };
}

function findBreakdownRows(sourceShape, sourceMode) {
  return sourceShape.sourceModeBreakdown
    ?.find(entry => entry.sourceMode === sourceMode)
    ?.rows ?? null;
}

function summarizeRow(row) {
  return {
    sourceArtifact: row.sourceArtifact,
    runtimeLabel: row.runtimeLabel,
    caseId: row.caseId,
    rateMiBPerSec: row.mibPerSec,
    fullStringParity: row.fullStringParity,
    boundedMemory: row.boundedMemory,
  };
}

function summarizeFrontierRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    parserInput: row.parserInput ?? null,
    sourceMode: row.sourceMode ?? null,
    rateMiBPerSec: row.mibPerSec ?? null,
    directReadableStream: row.directReadableStream ?? null,
    fullArrayBufferParserInput: row.fullArrayBufferParserInput ?? null,
    respectsBackpressure: row.respectsBackpressure ?? null,
    eventCount: row.eventCount ?? null,
    checksum: row.checksum ?? null,
  };
}

function summarizeCoverageRow(row) {
  return {
    sourceArtifact: row.sourceArtifact,
    runtimeLabel: row.runtimeLabel,
    caseId: row.id,
    rateMiBPerSec: row.mibPerSec,
    fullStringParity: row.fullStringParity,
    boundedMemory: row.boundedMemory,
  };
}

function createFindings(status, sourceShape, primarySourceShape, sourceFrontier, browserFrontier, representativeStreamRowsRespectBackpressure) {
  const primaryRows = primarySourceShape.rows ?? 0;
  const primaryIsSyncByteBatchesOnly = primaryRows > 0
    && (primarySourceShape.directReadableStreamRows ?? null) === 0
    && (primarySourceShape.asyncSourceRows ?? null) === 0
    && (primarySourceShape.fullArrayBufferRows ?? null) === 0
    && (primarySourceShape.unknownSourceModeRows ?? null) === 0;
  const findings = [
    {
      id: 'source-contract-classified',
      classification: status === 'classified' ? 'SOURCE_FACT' : 'HYPOTHESIS',
      summary: status === 'classified'
        ? 'All current 1 GiB+ JavaScript full-string rows with source metadata are classified as not full ArrayBuffer parser input.'
        : 'Current source-consumption metadata is incomplete.',
    },
    {
      id: 'direct-readable-stream-separated',
      classification: 'SOURCE_FACT',
      summary: 'Direct ReadableStream rows are counted separately from synchronous byte-batch parser rows.',
    },
    {
      id: 'primary-frontier-sync-byte-batches-only',
      classification: primaryIsSyncByteBatchesOnly ? 'SOURCE_FACT' : 'HYPOTHESIS',
      summary: primaryIsSyncByteBatchesOnly
        ? 'Primary JavaScript frontier is restricted to synchronous Iterable<Uint8Array[]> byte-batch rows.'
        : 'Primary JavaScript frontier source shape is not fully restricted to synchronous byte-batch rows.',
    },
  ];

  if ((sourceFrontier?.backpressureRows ?? 0) > 0 || (browserFrontier?.liveRows ?? 0) > 0) {
    findings.push({
      id: 'backpressure-respected',
      classification: representativeStreamRowsRespectBackpressure ? 'SOURCE_FACT' : 'HYPOTHESIS',
      summary: representativeStreamRowsRespectBackpressure
        ? 'Rows that exercise async/readable or live fetch source paths record backpressure-respecting counters, and representative rows carry backpressure proof.'
        : 'Rows that exercise async/readable or live fetch source paths have incomplete representative backpressure proof.',
    });
  }

  if ((sourceShape.corpusSeedReplayRows ?? 0) > 0) {
    findings.push({
      id: 'corpus-replay-not-full-target-arraybuffer',
      classification: 'SOURCE_FACT',
      summary: 'Corpus-cycle rows replay smaller seed buffers and are not classified as one full-target ArrayBuffer parser input.',
    });
  }

  return findings;
}

function renderMarkdown(report) {
  const lines = [
    '# Source Consumption Shape Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Status: ${report.summary.status}`,
    `- Source artifact: ${report.inputs.comparisonJson}`,
    `- Aggregate rows: ${report.summary.aggregateRowCount}`,
    `- JavaScript 1 GiB+ full-string rows: ${report.summary.jsLargeFullRowCount}`,
    `- 1 GiB+ JS full-string rows with source-mode metadata: ${report.summary.largeJsFullSourceModeRows}`,
    `- Rows not using full ArrayBuffer parser input: ${report.summary.notFullArrayBufferRows}/${report.summary.largeJsFullSourceModeRows}`,
    `- Full ArrayBuffer parser-input rows: ${report.summary.fullArrayBufferRows}`,
    `- Unknown parser-input rows: ${report.summary.unknownArrayBufferRows}`,
    `- Direct ReadableStream rows: ${report.summary.directReadableStreamRows}`,
    `- Corpus seed replay rows: ${report.summary.corpusSeedReplayRows}`,
    `- File-backed sync Iterable<Uint8Array[]> rows: ${report.summary.fileBackedSyncIterableRows}`,
    `- Sync Iterable<Uint8Array[]> rows: ${report.summary.syncIterableRows}`,
    `- Primary source contract: ${report.summary.primarySourceContract}`,
    `- Primary parser input: ${report.summary.primaryParserInput}`,
    `- Primary source boundary: ${report.summary.primarySourceBoundary}`,
    `- Primary ArrayBuffer parser input: ${report.summary.primaryArrayBufferParserInput}`,
    `- Primary backpressure contract: ${report.summary.primaryBackpressureContract}`,
    `- Primary sync byte-batch rows: ${report.summary.primarySyncByteBatchRows}`,
    `- Primary excluded rows: ${report.summary.primaryExcludedRows}`,
    `- Primary direct ReadableStream rows: ${report.summary.primaryDirectReadableStreamRows}`,
    `- Primary async source rows: ${report.summary.primaryAsyncSourceRows}`,
    `- Primary full ArrayBuffer parser-input rows: ${report.summary.primaryFullArrayBufferRows}`,
    `- Primary unknown source-mode rows: ${report.summary.primaryUnknownSourceModeRows}`,
    `- Primary fastest row: ${formatSummaryRow(report.summary.primaryFastestRow)}`,
    `- Async/readable source frontier respects backpressure: ${formatBoolean(report.summary.asyncOrReadableRowsRespectBackpressure)}`,
    `- Browser live source frontier respects backpressure: ${formatBoolean(report.summary.browserLiveRowsRespectBackpressure)}`,
    `- Representative stream rows respect backpressure: ${formatBoolean(report.summary.representativeStreamRowsRespectBackpressure)}`,
    '',
    '## Primary Exclusions',
    '',
    '| Reason | Rows | Fastest excluded row |',
    '| --- | ---: | --- |',
    ...report.primaryExcludedBreakdown.map(primaryExcludedMarkdownRow),
    '',
    '## Source Mode Breakdown',
    '',
    '| Source mode | Rows | Not full ArrayBuffer | Full ArrayBuffer | Unknown | Direct ReadableStream | Corpus replay | Fastest row |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...report.sourceModeBreakdown.map(sourceModeMarkdownRow),
    '',
    '## Source Frontiers',
    '',
  ];

  if (report.sourceConsumptionFrontier) {
    const frontier = report.sourceConsumptionFrontier;
    lines.push(
      `- Node/source-shape audit artifact: ${frontier.sourceArtifact}`,
      `- Fastest sync Iterable<Uint8Array[]> row: ${formatFrontierRow(frontier.fastestSyncIterable)}`,
      `- Fastest direct ReadableStream row: ${formatFrontierRow(frontier.fastestReadableStream)}`,
      `- Direct ReadableStream ratio to fastest sync iterable: ${formatNumber(frontier.fastestReadableStreamRatioToFastestSyncIterable)}x`,
      `- Backpressure rows respected: ${frontier.backpressureRowsRespected}/${frontier.backpressureRows}`,
      `- Frontier full ArrayBuffer rows: ${frontier.fullArrayBufferRows}`,
      '',
    );
  }

  if (report.browserLiveSourceFrontier) {
    const frontier = report.browserLiveSourceFrontier;
    lines.push(
      `- Browser live source artifact: ${frontier.sourceArtifact}`,
      `- Fetch ReadableStream row: ${formatFrontierRow(frontier.fetchReadableStreamRow)}`,
      `- Fetch async byte-batch row: ${formatFrontierRow(frontier.fetchAsyncByteBatchRow)}`,
      `- Live rows respecting backpressure: ${frontier.liveRowsBackpressureRespected}/${frontier.liveRows}`,
      `- Live rows using full ArrayBuffer parser input: ${frontier.liveRowsFullArrayBufferInput}`,
      '',
    );
  }

  lines.push(
    '## Coverage Crosscheck',
    '',
    `- Source artifact: ${report.coverageCrosscheck.sourceArtifact}`,
    `- Status: ${report.coverageCrosscheck.status}`,
    `- Coverage source-mode rows: ${report.coverageCrosscheck.sourceModeRows}`,
    `- Coverage not-full-ArrayBuffer rows: ${report.coverageCrosscheck.notFullArrayBufferRows}/${report.coverageCrosscheck.sourceModeRows}`,
    `- Coverage full ArrayBuffer rows: ${report.coverageCrosscheck.fullArrayBufferRows}`,
    `- Coverage unknown ArrayBuffer rows: ${report.coverageCrosscheck.unknownArrayBufferRows}`,
    `- Coverage direct ReadableStream rows: ${report.coverageCrosscheck.directReadableStreamRows}`,
    `- Coverage demand-driven rows: ${report.coverageCrosscheck.demandDrivenRows}`,
    '',
    '| Source mode | Rows | Not full ArrayBuffer | Full ArrayBuffer | Unknown | Direct ReadableStream | Demand-driven | Fastest row |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...report.coverageCrosscheck.sourceModeBreakdown.map(coverageSourceModeMarkdownRow),
    '',
    '## Findings',
    '',
    '| ID | Classification | Summary |',
    '| --- | --- | --- |',
    ...report.findings.map(finding => `| \`${finding.id}\` | ${finding.classification} | ${finding.summary} |`),
    '',
  );

  return `${lines.join('\n')}\n`;
}

function sourceModeMarkdownRow(entry) {
  const fastest = entry.fastestRow
    ? formatSummaryRow(entry.fastestRow)
    : 'n/a';
  return `| \`${entry.sourceMode}\` | ${entry.rows} | ${entry.notFullArrayBufferRows} | ${entry.fullArrayBufferRows} | ${entry.unknownArrayBufferRows} | ${entry.directReadableStreamRows} | ${entry.corpusSeedReplayRows} | ${fastest} |`;
}

function coverageSourceModeMarkdownRow(entry) {
  const fastest = entry.fastestRow
    ? formatSummaryRow(entry.fastestRow)
    : 'n/a';
  return `| \`${entry.sourceMode}\` | ${entry.rows} | ${entry.notFullArrayBufferRows} | ${entry.fullArrayBufferRows} | ${entry.unknownArrayBufferRows} | ${entry.directReadableStreamRows} | ${entry.demandDrivenRows} | ${fastest} |`;
}

function primaryExcludedMarkdownRow(entry) {
  return `| \`${entry.reason}\` | ${entry.rows} | ${formatSummaryRow(entry.fastestRow)} |`;
}

function formatSummaryRow(row) {
  if (!row) return 'n/a';
  return `${row.runtimeLabel} \`${row.caseId}\` ${formatNumber(row.rateMiBPerSec)} MiB/s from \`${row.sourceArtifact}\``;
}

function formatFrontierRow(row) {
  if (!row) return 'n/a';
  const source = row.parserInput ?? row.sourceMode ?? 'n/a';
  return `\`${row.id}\` (${source}, ${formatNumber(row.rateMiBPerSec)} MiB/s, directReadableStream=${formatBoolean(row.directReadableStream)}, fullArrayBufferParserInput=${formatBoolean(row.fullArrayBufferParserInput)}, respectsBackpressure=${formatBoolean(row.respectsBackpressure)})`;
}

function formatBoolean(value) {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return 'n/a';
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function writeOutput(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

main();
