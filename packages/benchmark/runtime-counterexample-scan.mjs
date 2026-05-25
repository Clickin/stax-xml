import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultReleaseDir = resolve(__dirname, 'results', 'release');
const defaultJsonOut = resolve(defaultReleaseDir, 'runtime-counterexample-scan.json');
const defaultMdOut = resolve(defaultReleaseDir, 'runtime-counterexample-scan.md');

const ignoredArtifacts = new Set([
  'latest-summary.json',
  'runtime-limit-proof-obligation-gate.json',
  'same-contract-runtime-comparison.json',
  'runtime-counterexample-scan.json',
  'runtime-proof-coverage-audit.json',
]);

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    releaseDir: defaultReleaseDir,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    thresholdMiBPerSec: 200,
    minSizeGiB: 0.999,
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
      case '--threshold-mib-per-sec':
        options.thresholdMiBPerSec = parsePositiveNumber(readValue(), name);
        break;
      case '--min-size-gib':
        options.minSizeGiB = parsePositiveNumber(readValue(), name);
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
  if (report.summary.counterexampleCount > 0) {
    process.exitCode = 1;
  }
}

function createReport(options) {
  const artifactFiles = readdirSync(options.releaseDir)
    .filter(file => file.endsWith('.json'))
    .sort();
  const scannedArtifacts = [];
  const ignored = [];
  const measuredRows = [];
  const aggregateRows = [];
  const parseErrors = [];

  for (const file of artifactFiles) {
    if (ignoredArtifacts.has(file)) {
      ignored.push(file);
      continue;
    }
    const filePath = join(options.releaseDir, file);
    try {
      const root = JSON.parse(readFileSync(filePath, 'utf8'));
      scannedArtifacts.push(file);
      measuredRows.push(...extractMeasuredRows(file, root));
      aggregateRows.push(...extractAggregateRows(file, root));
    } catch (error) {
      parseErrors.push({ file, message: error?.message ?? String(error) });
    }
  }

  const largeJsFullRows = measuredRows.filter(row =>
    row.jsRuntime
    && row.fullStringParity === true
    && row.sizeGiB !== null
    && row.sizeGiB >= options.minSizeGiB
  );
  const counterexamples = largeJsFullRows.filter(row =>
    row.boundedMemory === true
    && row.hasMemoryProof
    && row.mibPerSec >= options.thresholdMiBPerSec
  );
  const partialHeadroomRows = measuredRows.filter(row =>
    row.jsRuntime
    && row.fullStringParity === false
    && row.sizeGiB !== null
    && row.sizeGiB >= options.minSizeGiB
    && row.mibPerSec >= options.thresholdMiBPerSec
  );
  const textMaterializationHeadroomRows = partialHeadroomRows
    .filter(row => row.contractScope === 'full-materialization-minus-text-cdata')
    .slice()
    .sort((left, right) => right.mibPerSec - left.mibPerSec);
  const unboundedOrUnknownLargeFullRows = largeJsFullRows.filter(row => row.boundedMemory !== true || !row.hasMemoryProof);
  const largeFullMemoryRejectionBreakdown = summarizeMemoryRejection(unboundedOrUnknownLargeFullRows);
  const fastestLargeFullRows = largeJsFullRows
    .slice()
    .sort((left, right) => right.mibPerSec - left.mibPerSec)
    .slice(0, 12);
  const fastestLargeFullRowsWithMemoryProof = largeJsFullRows
    .filter(row => row.boundedMemory === true && row.hasMemoryProof)
    .slice()
    .sort((left, right) => right.mibPerSec - left.mibPerSec)
    .slice(0, 12);
  const largeJsFullAggregateRows = aggregateRows.filter(row =>
    row.jsRuntime
    && row.fullStringParity === true
    && row.sizeGiB !== null
    && row.sizeGiB >= options.minSizeGiB
  );
  const fastestLargeFullAggregateRowsWithMemoryProof = largeJsFullAggregateRows
    .filter(row => row.boundedMemory === true && row.hasMemoryProof)
    .slice()
    .sort((left, right) => right.mibPerSec - left.mibPerSec)
    .slice(0, 12);
  const sourceModeRows = measuredRows.filter(row => row.sourceMode !== null);
  const largeJsFullSourceModeRows = largeJsFullRows.filter(row => row.sourceMode !== null);
  const sourceModeBreakdown = summarizeSourceModes(sourceModeRows);
  const largeJsFullSourceModeBreakdown = summarizeSourceModes(largeJsFullSourceModeRows);
  const rowClassificationCompleteness = summarizeRowClassificationCompleteness(measuredRows);
  const unknownBoundedMemoryBreakdown = summarizeUnknownBoundedMemoryRows(measuredRows, options);

  return {
    generatedAt: new Date().toISOString(),
    objective: 'runtime-counterexample-scan',
    contract: 'release-json-recognized-row-counterexample-search',
    note: 'Scans recognized throughput rows in primary release JSON artifacts for 1 GiB+ full-string JavaScript rows that meet the 200 MiB/s bounded-memory counterexample rule. This is a guard over existing artifacts, not a new benchmark run or a runtime-limit proof.',
    parameters: {
      thresholdMiBPerSec: options.thresholdMiBPerSec,
      minSizeGiB: options.minSizeGiB,
      releaseDir: options.releaseDir,
    },
    scannedArtifacts,
    ignoredArtifacts: ignored,
    parseErrors,
    summary: {
      scannedArtifactCount: scannedArtifacts.length,
      ignoredArtifactCount: ignored.length,
      parseErrorCount: parseErrors.length,
      measuredRowCount: measuredRows.length,
      aggregateRowCount: aggregateRows.length,
      largeJsFullRowCount: largeJsFullRows.length,
      largeJsFullAggregateRowCount: largeJsFullAggregateRows.length,
      sourceModeRowCount: sourceModeRows.length,
      largeJsFullSourceModeRowCount: largeJsFullSourceModeRows.length,
      sourceModeBreakdown,
      largeJsFullSourceModeBreakdown,
      rowClassificationCompleteness,
      unknownBoundedMemoryBreakdown,
      counterexampleCount: counterexamples.length,
      partialHeadroomRowCount: partialHeadroomRows.length,
      unboundedOrUnknownLargeFullRowCount: unboundedOrUnknownLargeFullRows.length,
      largeFullMemoryRejectionBreakdown,
      fastestLargeFullRow: summarizeRow(fastestLargeFullRows[0]),
      fastestLargeFullRowWithMemoryProof: summarizeRow(fastestLargeFullRowsWithMemoryProof[0]),
      fastestLargeFullAggregateRowWithMemoryProof: summarizeRow(fastestLargeFullAggregateRowsWithMemoryProof[0]),
      fastestPartialHeadroomRow: summarizeRow(partialHeadroomRows.slice().sort((left, right) => right.mibPerSec - left.mibPerSec)[0]),
      textMaterializationHeadroomRowCount: textMaterializationHeadroomRows.length,
      fastestTextMaterializationHeadroomRow: summarizeRow(textMaterializationHeadroomRows[0]),
      conclusionAllowed: false,
    },
    counterexamples,
    fastestLargeFullRows,
    fastestLargeFullRowsWithMemoryProof,
    fastestLargeFullAggregateRowsWithMemoryProof,
    partialHeadroomRows: partialHeadroomRows
      .slice()
      .sort((left, right) => right.mibPerSec - left.mibPerSec),
    textMaterializationHeadroomRows,
    unboundedOrUnknownLargeFullRows,
    aggregateRows,
    sourceModeRows,
    findings: createFindings(counterexamples, partialHeadroomRows, textMaterializationHeadroomRows, largeFullMemoryRejectionBreakdown, rowClassificationCompleteness, fastestLargeFullAggregateRowsWithMemoryProof, largeJsFullSourceModeBreakdown),
  };
}

function extractMeasuredRows(sourceArtifact, root) {
  const rows = [];
  visit(root, [], createInitialContext(sourceArtifact, root), (node, path, context) => {
    if (isDerivedProjectionPath(path)) return;
    if (!isMeasuredNode(node)) return;
    const row = createMeasuredRow(sourceArtifact, node, path, context);
    if (row) rows.push(row);
  });
  return rows;
}

function extractAggregateRows(sourceArtifact, root) {
  const rows = [];
  visit(root, [], createInitialContext(sourceArtifact, root), (node, path, context) => {
    if (!isAggregateMeasuredNode(node)) return;
    const row = createAggregateRow(sourceArtifact, node, path, context);
    if (row) rows.push(row);
  });
  return rows;
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
  });
}

function extendContext(node, context) {
  const fixture = normalizeFixture(node.fixture) ?? context.fixture;
  const environment = node.environment ?? context.environment;
  const runtime = node.runtime ?? context.runtime;
  return {
    ...context,
    fixture,
    environment,
    runtime,
    objective: node.objective ?? context.objective,
    contract: node.contract ?? context.contract,
  };
}

function isMeasuredNode(node) {
  return typeof node.mibPerSec === 'number' && Number.isFinite(node.mibPerSec);
}

function isDerivedProjectionPath(path) {
  return path.includes('summary') || path.includes('comparisons');
}

function isAggregateMeasuredNode(node) {
  return typeof node.avgMiBPerSec === 'number' && Number.isFinite(node.avgMiBPerSec);
}

function createMeasuredRow(sourceArtifact, node, path, context) {
  const fixture = normalizeFixture(node.fixture) ?? context.fixture;
  const sizeGiB = fixture?.sizeGiB ?? null;
  const fullStringParity = classifyFullStringParity(node, context);
  const boundedMemory = typeof node.boundedMemory === 'boolean' ? node.boundedMemory : null;
  const jsRuntime = classifyJsRuntime(sourceArtifact, node, context);
  const id = String(node.id ?? node.tool ?? node.name ?? path.at(-1) ?? 'row');
  const memoryKind = classifyMemoryKind(node);
  return {
    sourceArtifact,
    jsonPath: path.join('.'),
    id,
    runtimeLabel: inferRuntimeLabel(sourceArtifact, node, context),
    jsRuntime,
    fullStringParity,
    boundedMemory,
    sizeGiB,
    sizeMiB: fixture?.sizeMiB ?? null,
    mibPerSec: round(node.mibPerSec),
    eventCount: normalizeEventCount(node),
    checksum: node.checksum ?? null,
    contractScope: node.contractScope ?? node.workload ?? context.contract ?? null,
    family: node.family ?? null,
    counterexampleStatus: node.counterexampleStatus ?? null,
    memoryKind,
    hasMemoryProof: memoryKind !== 'not-recorded',
    sourceMode: node.sourceMode ?? null,
    batchSize: node.batchSize ?? null,
    chunkKiB: node.chunkKiB ?? null,
    respectsBackpressure: typeof node.respectsBackpressure === 'boolean' ? node.respectsBackpressure : null,
  };
}

function createAggregateRow(sourceArtifact, node, path, context) {
  const fixture = normalizeFixture(node.fixture) ?? context.fixture;
  const sizeGiB = fixture?.sizeGiB ?? null;
  const fullStringParity = classifyFullStringParity(node, context);
  const boundedMemory = typeof node.boundedMemoryAll === 'boolean'
    ? node.boundedMemoryAll
    : (typeof node.boundedMemory === 'boolean' ? node.boundedMemory : null);
  const jsRuntime = classifyJsRuntime(sourceArtifact, node, context);
  const id = String(node.id ?? node.tool ?? node.name ?? path.at(-1) ?? 'row');
  const memoryKind = classifyMemoryKind(node);
  return {
    sourceArtifact,
    jsonPath: path.join('.'),
    id,
    runtimeLabel: inferRuntimeLabel(sourceArtifact, node, context),
    jsRuntime,
    fullStringParity,
    boundedMemory,
    sizeGiB,
    sizeMiB: fixture?.sizeMiB ?? null,
    mibPerSec: round(node.avgMiBPerSec),
    minMibPerSec: round(node.minMiBPerSec),
    maxMibPerSec: round(node.maxMiBPerSec),
    spreadPercent: round(typeof node.spreadRatio === 'number' ? node.spreadRatio * 100 : null),
    sampleCount: node.sampleCount ?? null,
    eventCount: Array.isArray(node.eventCounts) && node.eventCounts.length === 1 ? node.eventCounts[0] : normalizeEventCount(node),
    checksum: Array.isArray(node.checksums) && node.checksums.length === 1 ? node.checksums[0] : null,
    contractScope: node.contractScope ?? node.workload ?? context.contract ?? null,
    family: node.family ?? null,
    counterexampleStatus: node.counterexampleFound === true ? 'found' : (node.counterexampleStatus ?? 'not-found'),
    memoryKind,
    hasMemoryProof: memoryKind !== 'not-recorded',
    sourceMode: node.sourceMode ?? null,
    batchSize: node.batchSize ?? null,
    chunkKiB: node.chunkKiB ?? null,
    respectsBackpressure: typeof node.respectsBackpressure === 'boolean' ? node.respectsBackpressure : null,
  };
}

function summarizeSourceModes(rows) {
  const byMode = new Map();
  for (const row of rows) {
    const mode = row.sourceMode ?? 'unknown';
    const current = byMode.get(mode) ?? {
      sourceMode: mode,
      rowCount: 0,
      fullStringRowCount: 0,
      boundedFullStringRowCount: 0,
      fastestMiBPerSec: null,
      fastestRow: null,
      backpressureRows: 0,
    };
    current.rowCount++;
    if (row.fullStringParity === true) {
      current.fullStringRowCount++;
      if (row.boundedMemory === true && row.hasMemoryProof) {
        current.boundedFullStringRowCount++;
      }
    }
    if (row.respectsBackpressure === true) {
      current.backpressureRows++;
    }
    if (current.fastestMiBPerSec === null || row.mibPerSec > current.fastestMiBPerSec) {
      current.fastestMiBPerSec = row.mibPerSec;
      current.fastestRow = summarizeRow(row);
    }
    byMode.set(mode, current);
  }
  return Array.from(byMode.values())
    .sort((left, right) => {
      if (right.rowCount !== left.rowCount) return right.rowCount - left.rowCount;
      return left.sourceMode.localeCompare(right.sourceMode);
    });
}

function summarizeMemoryRejection(rows) {
  return {
    total: rows.length,
    explicitNotBounded: rows.filter(row => row.boundedMemory === false).length,
    boundedFlagWithoutRowMemoryProof: rows.filter(row => row.boundedMemory === true && !row.hasMemoryProof).length,
    unknownBoundedFlag: rows.filter(row => row.boundedMemory === null).length,
    missingRowMemoryProof: rows.filter(row => !row.hasMemoryProof).length,
  };
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
  return {
    total: unknownRows.length,
    jsRows: unknownRows.filter(row => row.jsRuntime).length,
    fullStringRows: unknownRows.filter(row => row.fullStringParity === true).length,
    jsFullStringRows: unknownRows.filter(row => row.jsRuntime && row.fullStringParity === true).length,
    largeJsFullStringRows: unknownRows.filter(row =>
      row.jsRuntime
      && row.fullStringParity === true
      && row.sizeGiB !== null
      && row.sizeGiB >= options.minSizeGiB
    ).length,
    rowsWithMemoryCounter: unknownRows.filter(row => row.hasMemoryProof).length,
  };
}

function classifyFullStringParity(node, context) {
  if (node.fullStringParity === true) return true;
  if (node.fullStringParity === false) return false;
  if (node.workload === 'full-string-checksum') return true;
  if (/^(woodstox-|quick-xml-)|^materialization-contract-audit\.json$/.test(context.sourceArtifact ?? '')) return true;
  const id = typeof node.id === 'string' ? node.id : '';
  if (/projection|event-count-only|scan-all-no-decode|scanAllNoDecode|semantic-checksum|SemanticChecksum/i.test(id)) return false;
  if (/full-string|event-full-string|full-string|raw-frame|rawFrame|cursor|public-accessor|event-reader-object|stream-(batch|event)/i.test(id)) return true;
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

function normalizeEventCount(node) {
  return node.eventCount ?? node.events ?? null;
}

function classifyJsRuntime(sourceArtifact, node, context) {
  if (node.tool === 'woodstox' || node.tool === 'quick-xml') return false;
  if (typeof node.tool === 'string' && node.tool.startsWith('stax-')) return true;
  const runtimeName = context.environment?.runtimeName;
  if (['node', 'bun', 'browser', 'deno'].includes(runtimeName)) return true;
  if (['node', 'bun', 'browser', 'deno'].includes(context.runtime?.id)) return true;
  if (context.environment?.v8 || context.environment?.node) return true;
  if (/^(candidate-headroom|bun-candidate-headroom|browser-candidate-headroom|textdecoder-span|bun-textdecoder-span|browser-textdecoder-span|stream-reader|event-reader|bun-event-reader|browser-string-limit|runtime-matrix|projection-benchmark)/.test(sourceArtifact)) {
    return !/quick-xml|woodstox/.test(sourceArtifact);
  }
  return false;
}

function inferRuntimeLabel(sourceArtifact, node, context) {
  if (node.tool === 'woodstox') return 'Java/Woodstox';
  if (node.tool === 'quick-xml') return 'Rust/quick-xml';
  if (node.tool === 'stax-stream') return 'Node/V8 stax-stream';
  if (node.tool === 'stax-raw-frame-name-id') return 'Node/V8 stax-raw-frame-name-id';
  if (node.tool === 'stax-event') return 'Node/V8 stax-event';
  const environment = context.environment ?? {};
  if (environment.runtimeName === 'bun') return 'Bun/JSC';
  if (environment.runtimeName === 'browser') {
    const browser = environment.browserName ?? 'Browser';
    const engine = environment.javascriptEngine ?? 'unknown';
    return `${browser}/${engine}`;
  }
  if (environment.runtimeName === 'deno') return 'Deno/V8';
  if (environment.runtimeName === 'node' || environment.v8) return 'Node/V8';
  if (context.runtime?.id === 'node' || context.runtime?.v8) return 'Node/V8';
  if (context.runtime?.id === 'bun') return 'Bun/JSC';
  if (context.runtime?.id === 'deno') return 'Deno/V8';
  if (sourceArtifact.startsWith('bun-')) return 'Bun/JSC';
  if (sourceArtifact.startsWith('browser-')) return 'Chrome/V8 browser';
  return 'unknown';
}

function classifyMemoryKind(node) {
  const memory = node.memory;
  if (typeof node.maxRssBytes === 'number') return 'process-rss';
  if (typeof node.maxJsHeapUsedBytes === 'number') return 'browser-js-heap';
  if (!memory || typeof memory !== 'object') return 'not-recorded';
  if (memory.scope === 'browser-js-heap' && typeof memory.maxJsHeapUsedBytes === 'number') return 'browser-js-heap';
  if (typeof memory.maxJsHeapUsedBytes === 'number') return 'browser-js-heap';
  if (memory.maxRssBytes !== undefined) return 'process-rss';
  return 'recorded-unknown-kind';
}

function normalizeFixture(fixture) {
  if (!fixture || typeof fixture !== 'object') return null;
  const actualBytes = numberOrNull(fixture.actualBytes ?? fixture.sizeBytes);
  const sizeGiB = numberOrNull(fixture.sizeGiB) ?? (actualBytes !== null ? actualBytes / GIB : null);
  const sizeMiB = numberOrNull(fixture.sizeMiB) ?? (actualBytes !== null ? actualBytes / MIB : null);
  if (sizeGiB === null && sizeMiB === null && actualBytes === null) return null;
  return {
    sizeGiB: round(sizeGiB),
    sizeMiB: round(sizeMiB),
    actualBytes,
    shape: fixture.shape ?? null,
    source: fixture.source ?? null,
  };
}

function createFindings(counterexamples, partialHeadroomRows, textMaterializationHeadroomRows, largeFullMemoryRejectionBreakdown, rowClassificationCompleteness, fastestLargeFullAggregateRowsWithMemoryProof, largeJsFullSourceModeBreakdown) {
  const sourceModes = largeJsFullSourceModeBreakdown.map(entry => `${entry.sourceMode}:${entry.rowCount}`);
  const memoryRejectionSummary = `${largeFullMemoryRejectionBreakdown.total} recognized 1 GiB+ full-string JavaScript row(s) fail the bounded-memory counterexample criterion: ${largeFullMemoryRejectionBreakdown.explicitNotBounded} explicit boundedMemory=false, ${largeFullMemoryRejectionBreakdown.boundedFlagWithoutRowMemoryProof} bounded flag without row-level memory proof, ${largeFullMemoryRejectionBreakdown.unknownBoundedFlag} unknown bounded flag.`;
  const incompleteClassificationRows = rowClassificationCompleteness.unknownFullStringParityRows + rowClassificationCompleteness.unknownBoundedMemoryRows;
  return [
    {
      id: 'bounded-full-string-counterexample-search',
      status: counterexamples.length > 0 ? 'COUNTEREXAMPLE_FOUND' : 'NOT_FOUND_IN_RECOGNIZED_RELEASE_ROWS',
      summary: counterexamples.length > 0
        ? `${counterexamples.length} recognized release row(s) meet the 200 MiB/s bounded full-string JS rule.`
        : 'No recognized release row currently meets the 200 MiB/s bounded full-string JS rule.',
    },
    {
      id: 'partial-headroom-not-stax-counterexample',
      status: partialHeadroomRows.length > 0 ? 'HEADROOM_EVIDENCE_PRESENT' : 'NOT_FOUND',
      summary: `${partialHeadroomRows.length} recognized 1 GiB+ partial/projection JavaScript row(s) reach the threshold but are not full-string StAX counterexamples.`,
    },
    {
      id: 'text-materialization-headroom',
      status: textMaterializationHeadroomRows.length > 0 ? 'HEADROOM_EVIDENCE_PRESENT' : 'NOT_FOUND',
      summary: `${textMaterializationHeadroomRows.length} recognized 1 GiB+ near-full row(s) cross the threshold only after omitting text/CDATA string materialization.`,
    },
    {
      id: 'unbounded-or-unknown-full-rows-not-counterexamples',
      status: largeFullMemoryRejectionBreakdown.total > 0 ? 'LIMITED_EVIDENCE_PRESENT' : 'NONE',
      summary: memoryRejectionSummary,
    },
    {
      id: 'measured-row-classification-complete',
      status: incompleteClassificationRows === 0 ? 'CONTRACT_FACT' : 'LIMITED_EVIDENCE_PRESENT',
      summary: `${rowClassificationCompleteness.measuredRows} recognized measured row(s) include fullStringParity and boundedMemory classifications; ${rowClassificationCompleteness.unknownFullStringParityRows} have unknown fullStringParity and ${rowClassificationCompleteness.unknownBoundedMemoryRows} have unknown boundedMemory.`,
    },
    {
      id: 'cross-process-aggregate-rows-separated',
      status: fastestLargeFullAggregateRowsWithMemoryProof.length > 0 ? 'AGGREGATE_EVIDENCE_PRESENT' : 'NOT_FOUND',
      summary: fastestLargeFullAggregateRowsWithMemoryProof.length > 0
        ? 'Cross-process aggregate rows are reported separately from individual sample rows so fastest-row triage does not hide average-throughput evidence.'
        : 'No cross-process aggregate full-string rows with memory proof were recognized.',
    },
    {
      id: 'source-consumption-modes-separated',
      status: sourceModes.length > 0 ? 'SOURCE_MODE_EVIDENCE_PRESENT' : 'NOT_FOUND',
      summary: sourceModes.length > 0
        ? `Recognized 1 GiB+ full-string rows expose source-mode metadata for ${sourceModes.join(', ')}.`
        : 'No recognized 1 GiB+ full-string rows expose source-mode metadata.',
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Runtime Counterexample Scan',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This scan walks recognized throughput rows in primary release JSON artifacts and applies the broad counterexample rule mechanically: JavaScript runtime, 1 GiB+ fixture, full-string parity, bounded memory, and throughput at or above the threshold.',
    '',
    '## Summary',
    '',
    `- Scanned artifacts: ${report.summary.scannedArtifactCount}`,
    `- Ignored derived artifacts: ${report.summary.ignoredArtifactCount}`,
    `- Measured rows recognized: ${report.summary.measuredRowCount}`,
    `- Aggregate rows recognized: ${report.summary.aggregateRowCount}`,
    `- 1 GiB+ JS full-string rows recognized: ${report.summary.largeJsFullRowCount}`,
    `- 1 GiB+ JS full-string aggregate rows recognized: ${report.summary.largeJsFullAggregateRowCount}`,
    `- Rows with explicit source mode: ${report.summary.sourceModeRowCount}`,
    `- 1 GiB+ JS full-string rows with explicit source mode: ${report.summary.largeJsFullSourceModeRowCount}`,
    `- Rows with unknown full-string parity: ${report.summary.rowClassificationCompleteness.unknownFullStringParityRows}`,
    `- Rows with unknown bounded-memory flag: ${report.summary.rowClassificationCompleteness.unknownBoundedMemoryRows}`,
    `  - Unknown bounded-memory JS rows: ${report.summary.unknownBoundedMemoryBreakdown.jsRows}`,
    `  - Unknown bounded-memory full-string rows: ${report.summary.unknownBoundedMemoryBreakdown.fullStringRows}`,
    `  - Unknown bounded-memory 1 GiB+ JS full-string rows: ${report.summary.unknownBoundedMemoryBreakdown.largeJsFullStringRows}`,
    `  - Unknown bounded-memory rows with memory counters: ${report.summary.unknownBoundedMemoryBreakdown.rowsWithMemoryCounter}`,
    `- Counterexamples found: ${report.summary.counterexampleCount}`,
    `- Partial/projection threshold rows: ${report.summary.partialHeadroomRowCount}`,
    `- Text/CDATA materialization headroom rows: ${report.summary.textMaterializationHeadroomRowCount}`,
    `- Full-string rows failing bounded-memory criterion: ${report.summary.unboundedOrUnknownLargeFullRowCount}`,
    `  - Explicit boundedMemory=false rows: ${report.summary.largeFullMemoryRejectionBreakdown.explicitNotBounded}`,
    `  - Bounded flag without row-level memory proof: ${report.summary.largeFullMemoryRejectionBreakdown.boundedFlagWithoutRowMemoryProof}`,
    `  - Unknown bounded-memory flag rows: ${report.summary.largeFullMemoryRejectionBreakdown.unknownBoundedFlag}`,
    `  - Rows missing row-level memory proof: ${report.summary.largeFullMemoryRejectionBreakdown.missingRowMemoryProof}`,
    `- Fastest 1 GiB+ JS full-string row: ${formatRowSummary(report.summary.fastestLargeFullRow)}`,
    `- Fastest 1 GiB+ JS full-string row with memory proof: ${formatRowSummary(report.summary.fastestLargeFullRowWithMemoryProof)}`,
    `- Fastest 1 GiB+ JS full-string aggregate row with memory proof: ${formatAggregateRowSummary(report.summary.fastestLargeFullAggregateRowWithMemoryProof)}`,
    `- Fastest partial/projection threshold row: ${formatRowSummary(report.summary.fastestPartialHeadroomRow)}`,
    `- Fastest text/CDATA materialization headroom row: ${formatRowSummary(report.summary.fastestTextMaterializationHeadroomRow)}`,
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
    '## Counterexamples',
    '',
    '| Artifact | Runtime | Row | Size GiB | MiB/s | Memory | Events | Checksum |',
    '| --- | --- | --- | ---: | ---: | --- | ---: | ---: |',
  );
  if (report.counterexamples.length === 0) {
    lines.push('| none | | | | | | | |');
  } else {
    for (const row of report.counterexamples) lines.push(renderRow(row));
  }

  lines.push(
    '',
    '## Fastest 1 GiB+ Full-String JS Rows With Memory Proof',
    '',
    '| Artifact | Runtime | Row | Size GiB | MiB/s | Bounded | Memory | Events | Checksum |',
    '| --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: |',
  );
  for (const row of report.fastestLargeFullRowsWithMemoryProof) {
    lines.push(renderRow(row, true));
  }

  lines.push(
    '',
    '## Fastest 1 GiB+ Full-String JS Rows Regardless Of Memory Proof',
    '',
    'Rows in this table are useful for throughput triage, but rows without a row-level memory counter are not bounded-memory counterexamples.',
    '',
    '| Artifact | Runtime | Row | Size GiB | MiB/s | Bounded | Memory | Events | Checksum |',
    '| --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: |',
  );
  for (const row of report.fastestLargeFullRows) {
    lines.push(renderRow(row, true));
  }

  lines.push(
    '',
    '## Fastest 1 GiB+ Full-String JS Cross-Process Aggregate Rows With Memory Proof',
    '',
    'Rows in this table are averages or aggregate summaries from cross-process artifacts. They are shown separately from individual child samples.',
    '',
    '| Artifact | Runtime | Row | Size GiB | Avg MiB/s | Min | Max | Spread | Samples | Bounded | Memory | Events | Checksum |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: |',
  );
  if (report.fastestLargeFullAggregateRowsWithMemoryProof.length === 0) {
    lines.push('| none | | | | | | | | | | | | |');
  } else {
    for (const row of report.fastestLargeFullAggregateRowsWithMemoryProof) {
      lines.push(renderAggregateRow(row));
    }
  }

  lines.push(
    '',
    '## Source Mode Breakdown For 1 GiB+ Full-String JS Rows',
    '',
    'This table records input-consumption metadata when release rows expose it. It keeps synchronous byte-batch rows separate from direct ReadableStream rows.',
    '',
    '| Source mode | Rows | Full rows | Bounded full rows | Fastest MiB/s | Fastest row | Backpressure rows |',
    '| --- | ---: | ---: | ---: | ---: | --- | ---: |',
  );
  if (report.summary.largeJsFullSourceModeBreakdown.length === 0) {
    lines.push('| none | | | | | | |');
  } else {
    for (const entry of report.summary.largeJsFullSourceModeBreakdown) {
      lines.push(renderSourceModeBreakdownRow(entry));
    }
  }

  lines.push(
    '',
    '## Partial Or Projection Threshold Rows',
    '',
    'These rows may show runtime/parser headroom, but they do not preserve the full-string StAX contract and therefore are not runtime-limit counterexamples.',
    '',
    '| Artifact | Runtime | Row | Size GiB | MiB/s | Contract | Events | Checksum |',
    '| --- | --- | --- | ---: | ---: | --- | ---: | ---: |',
  );
  if (report.partialHeadroomRows.length === 0) {
    lines.push('| none | | | | | | | |');
  } else {
    for (const row of report.partialHeadroomRows) {
      lines.push(`| \`${row.sourceArtifact}\` | ${row.runtimeLabel} | \`${row.id}\` | ${formatNumber(row.sizeGiB)} | ${formatNumber(row.mibPerSec)} | ${escapePipe(row.contractScope ?? row.family ?? 'partial')} | ${row.eventCount ?? ''} | ${row.checksum ?? ''} |`);
    }
  }

  lines.push(
    '',
    '## Text/CDATA Materialization Headroom Rows',
    '',
    'These near-full rows still materialize element names and attributes, but omit text/CDATA strings. They identify a current headroom axis without satisfying full-string StAX parity.',
    '',
    '| Artifact | Runtime | Row | Size GiB | MiB/s | Contract | Events | Checksum |',
    '| --- | --- | --- | ---: | ---: | --- | ---: | ---: |',
  );
  if (report.textMaterializationHeadroomRows.length === 0) {
    lines.push('| none | | | | | | | |');
  } else {
    for (const row of report.textMaterializationHeadroomRows) {
      lines.push(`| \`${row.sourceArtifact}\` | ${row.runtimeLabel} | \`${row.id}\` | ${formatNumber(row.sizeGiB)} | ${formatNumber(row.mibPerSec)} | ${escapePipe(row.contractScope ?? row.family ?? 'partial')} | ${row.eventCount ?? ''} | ${row.checksum ?? ''} |`);
    }
  }

  lines.push(
    '',
    '## Findings',
    '',
  );
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.status}): ${finding.summary}`);
  }

  lines.push(
    '',
    '## Limits',
    '',
    '- This scan recognizes rows by common release JSON fields such as `mibPerSec`, `fullStringParity`, `boundedMemory`, and fixture size. Rows without those fields are not used as counterexample proof.',
    '- A row must carry row-level memory evidence, not only a derived bounded flag, before it can satisfy the bounded-memory counterexample rule.',
    '- A missing counterexample in this scan is not an impossibility proof. It only says the current recognized release rows do not contain one.',
    '- Derived summary artifacts are ignored to avoid circular evidence.',
  );

  return `${lines.join('\n')}\n`;
}

function renderRow(row, includeBounded = false) {
  const bounded = includeBounded ? ` | ${formatBounded(row)}` : '';
  return `| \`${row.sourceArtifact}\` | ${row.runtimeLabel} | \`${row.id}\` | ${formatNumber(row.sizeGiB)} | ${formatNumber(row.mibPerSec)}${bounded} | ${row.memoryKind} | ${row.eventCount ?? ''} | ${row.checksum ?? ''} |`;
}

function renderAggregateRow(row) {
  return `| \`${row.sourceArtifact}\` | ${row.runtimeLabel} | \`${row.id}\` | ${formatNumber(row.sizeGiB)} | ${formatNumber(row.mibPerSec)} | ${formatNumber(row.minMibPerSec)} | ${formatNumber(row.maxMibPerSec)} | ${formatNumber(row.spreadPercent)}% | ${row.sampleCount ?? ''} | ${formatBounded(row)} | ${row.memoryKind} | ${row.eventCount ?? ''} | ${row.checksum ?? ''} |`;
}

function renderSourceModeBreakdownRow(entry) {
  const row = entry.fastestRow;
  const fastest = row
    ? `${row.runtimeLabel} ${row.id} from ${row.sourceArtifact}`
    : 'none';
  return `| \`${entry.sourceMode}\` | ${entry.rowCount} | ${entry.fullStringRowCount} | ${entry.boundedFullStringRowCount} | ${formatNumber(entry.fastestMiBPerSec)} | ${escapePipe(fastest)} | ${entry.backpressureRows} |`;
}

function summarizeRow(row) {
  if (!row) return null;
  return {
    sourceArtifact: row.sourceArtifact,
    runtimeLabel: row.runtimeLabel,
    id: row.id,
    sizeGiB: row.sizeGiB,
    mibPerSec: row.mibPerSec,
    minMibPerSec: row.minMibPerSec,
    maxMibPerSec: row.maxMibPerSec,
    spreadPercent: row.spreadPercent,
    sampleCount: row.sampleCount,
    boundedMemory: row.boundedMemory,
    fullStringParity: row.fullStringParity,
    memoryKind: row.memoryKind,
    hasMemoryProof: row.hasMemoryProof,
    eventCount: row.eventCount,
    checksum: row.checksum,
    sourceMode: row.sourceMode,
    batchSize: row.batchSize,
    chunkKiB: row.chunkKiB,
    respectsBackpressure: row.respectsBackpressure,
  };
}

function formatAggregateRowSummary(row) {
  if (!row) return 'none';
  const bounded = formatBounded(row);
  const spread = typeof row.spreadPercent === 'number' ? `, spread ${formatNumber(row.spreadPercent)}%` : '';
  const samples = row.sampleCount !== null && row.sampleCount !== undefined ? `, samples ${row.sampleCount}` : '';
  return `${row.runtimeLabel} ${row.id} from ${row.sourceArtifact} at avg ${formatNumber(row.mibPerSec)} MiB/s (${bounded}, ${row.memoryKind}${samples}${spread})`;
}

function formatRowSummary(row) {
  if (!row) return 'none';
  const bounded = formatBounded(row);
  return `${row.runtimeLabel} ${row.id} from ${row.sourceArtifact} at ${formatNumber(row.mibPerSec)} MiB/s (${bounded}, ${row.memoryKind})`;
}

function formatBounded(row) {
  if (row.boundedMemory === true && row.hasMemoryProof) return 'yes';
  if (row.boundedMemory === true) return 'flag-only';
  if (row.boundedMemory === false) return 'no';
  return 'unknown';
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

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '';
}

function escapePipe(value) {
  return String(value).replaceAll('|', '\\|');
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(`runtime-counterexample-scan: rows=${report.summary.measuredRowCount} counterexamples=${report.summary.counterexampleCount}`);
}

main();
