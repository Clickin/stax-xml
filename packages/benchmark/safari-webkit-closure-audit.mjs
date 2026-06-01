import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultReleaseDir = resolve(__dirname, 'results', 'release');
const defaultJsonOut = resolve(defaultReleaseDir, 'safari-webkit-closure-audit.json');
const defaultMdOut = resolve(defaultReleaseDir, 'safari-webkit-closure-audit.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    releaseDir: defaultReleaseDir,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    minLargeGiB: 0.999,
    selfTest: false,
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
        options.minLargeGiB = Number(readValue());
        if (!Number.isFinite(options.minLargeGiB) || options.minLargeGiB <= 0) {
          throw new Error('--min-large-gib must be a positive number.');
        }
        break;
      case '--self-test':
        options.selfTest = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function main() {
  const options = parseArgs();
  const report = options.selfTest ? createSelfTestReport(options) : createReport(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`${report.objective}: candidates=${report.summary.candidateCount} qualified=${report.summary.qualifiedClosureCount}`);
}

function createReport(options) {
  if (!existsSync(options.releaseDir)) {
    throw new Error(`--release-dir does not exist: ${options.releaseDir}`);
  }
  const roots = readdirSync(options.releaseDir)
    .filter(file => file.endsWith('.json'))
    .sort()
    .map(file => ({ sourceArtifact: file, root: JSON.parse(readFileSync(join(options.releaseDir, file), 'utf8')) }));
  const comparison = roots.find(artifact => artifact.sourceArtifact === 'same-contract-runtime-comparison.json')?.root ?? {};
  return buildReport(options, roots, extractComparisonRows(comparison));
}

function createSelfTestReport(options) {
  const roots = [
    {
      sourceArtifact: 'safari-webkit-availability-audit.json',
      root: {
        objective: 'safari-webkit-availability-audit',
        summary: {
          hostIsMacOS: true,
          safariExecutableFound: true,
          safaridriverFound: true,
          currentHarnessSupportsSafari: true,
          canRunSafariBrowserRows: true,
          safariBenchmarkRowsRecorded: true,
          exactSafariBuildIdentityRecorded: true,
          safariSourceBoundaryPinned: true,
          directReadableStreamRowsAreSeparateEvidence: true,
        },
      },
    },
    {
      sourceArtifact: 'safari-self-test-rows.json',
      root: {
        rows: [
          {
            id: 'safari-valid',
            runtimeId: 'safari-jsc-browser',
            sizeGiB: 1,
            mibPerSec: 123,
            fullStringParity: true,
            sourceMode: 'sync-iterable-byte-batches',
            directReadableStream: false,
            fullArrayBufferParserInput: false,
            demandDrivenSource: true,
            boundedMemory: true,
            memory: { primaryKind: 'browser-js-heap', peakBytes: 64 * MIB },
            eventCount: 12,
            checksum: 34,
            environment: {
              browserName: 'Safari',
              browserVersion: '18.0',
              userAgent: 'Version/18.0 Safari/605.1.15',
            },
          },
          {
            id: 'safari-direct-stream',
            runtimeId: 'safari-jsc-browser',
            sizeGiB: 1,
            mibPerSec: 125,
            fullStringParity: true,
            sourceMode: 'fetch-readable-stream-pull',
            directReadableStream: true,
            fullArrayBufferParserInput: false,
            demandDrivenSource: true,
            boundedMemory: true,
            memory: { primaryKind: 'browser-js-heap', peakBytes: 64 * MIB },
            eventCount: 12,
            checksum: 34,
            environment: {
              browserName: 'Safari',
              browserVersion: '18.0',
              userAgent: 'Version/18.0 Safari/605.1.15',
            },
          },
        ],
      },
    },
  ];
  const comparisonRows = [
    { id: 'safari-valid', runtimeId: 'safari-jsc-browser', eventCount: 12, checksum: 34 },
  ];
  return buildReport(options, roots, comparisonRows);
}

function buildReport(options, artifacts, comparisonRows) {
  const availability = summarizeAvailability(artifacts.find(artifact =>
    artifact.sourceArtifact === 'safari-webkit-availability-audit.json'
  )?.root);
  const rows = artifacts.flatMap(artifact => extractSafariRows(artifact));
  const candidates = rows.map(row => createCandidate(row, availability, comparisonRows, options.minLargeGiB));
  const qualified = candidates.filter(candidate => candidate.qualifiedClosure);
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'safari-webkit-closure-audit',
    contract: 'safari-webkit-same-contract-browser-row-closure-matrix',
    note: 'Audits Safari/WebKit browser-row artifacts against the exact closure requirements for safari-jsc-source-and-browser-rows-open. This is not a Safari benchmark run; it prevents availability rows, Bun/JSC rows, direct ReadableStream rows, and rows without build/source/memory proof from closing the obligation.',
    parameters: {
      releaseDir: options.releaseDir,
      minLargeGiB: options.minLargeGiB,
      selfTest: options.selfTest,
    },
    availability,
    candidates,
    summary: {
      candidateCount: candidates.length,
      fullStringRows: candidates.filter(candidate => candidate.requirements.fullStringParity.met).length,
      primarySyncByteBatchRows: candidates.filter(candidate => candidate.requirements.primarySyncByteBatch.met).length,
      boundedPrimaryRows: candidates.filter(candidate => candidate.requirements.boundedMemory.met && candidate.requirements.primarySyncByteBatch.met).length,
      largeBoundedPrimaryRows: candidates.filter(candidate => candidate.requirements.largeOneGiB.met && candidate.requirements.boundedMemory.met && candidate.requirements.primarySyncByteBatch.met).length,
      rowsInSameContractComparison: candidates.filter(candidate => candidate.requirements.sameContractComparison.met).length,
      measuredExactBuildIdentityRows: candidates.filter(candidate => candidate.requirements.measuredExactBuildIdentity.met).length,
      sourceBoundaryPinned: availability.safariSourceBoundaryPinned === true,
      qualifiedClosureCount: qualified.length,
      contradictedAvailabilityClosure: availability.closesSafariObligation === true && qualified.length === 0,
      conclusionAllowed: qualified.length > 0,
    },
  };
  report.findings = createFindings(report);
  return report;
}

function createCandidate(row, availability, comparisonRows, minLargeGiB) {
  const requirements = {
    browserRowEvidence: {
      met: row.runtimeId === 'safari-jsc-browser',
      evidence: [`runtimeId=${row.runtimeId ?? 'unknown'}`],
    },
    fullStringParity: {
      met: row.fullStringParity === true,
      evidence: [`fullStringParity=${row.fullStringParity ?? 'unknown'}`],
    },
    primarySyncByteBatch: {
      met: row.directReadableStream === false
        && row.fullArrayBufferParserInput === false
        && row.demandDrivenSource === true
        && typeof row.sourceMode === 'string'
        && /sync-iterable-byte-batches$/.test(row.sourceMode),
      evidence: [
        `sourceMode=${row.sourceMode ?? 'unknown'}`,
        `directReadableStream=${row.directReadableStream ?? 'unknown'}`,
        `fullArrayBufferParserInput=${row.fullArrayBufferParserInput ?? 'unknown'}`,
        `demandDrivenSource=${row.demandDrivenSource ?? 'unknown'}`,
      ],
    },
    boundedMemory: {
      met: hasAcceptedBoundedMemoryProof(row),
      evidence: [
        `boundedMemory=${row.boundedMemory ?? 'unknown'}`,
        `memoryKind=${row.memoryKind ?? 'unknown'}`,
        `peakMemoryBytes=${row.peakMemoryBytes ?? 'unknown'}`,
      ],
    },
    largeOneGiB: {
      met: typeof row.sizeGiB === 'number' && row.sizeGiB >= minLargeGiB,
      evidence: [`sizeGiB=${row.sizeGiB ?? 'unknown'}`],
    },
    sameContractComparison: {
      met: comparisonRows.some(comparison =>
        comparison.id === row.id
          && comparison.runtimeId === 'safari-jsc-browser'
          && comparison.eventCount === row.eventCount
          && comparison.checksum === row.checksum
      ),
      evidence: [
        `id=${row.id ?? 'unknown'}`,
        `eventCount=${row.eventCount ?? 'unknown'}`,
        `checksum=${row.checksum ?? 'unknown'}`,
      ],
    },
    measuredExactBuildIdentity: {
      met: hasMeasuredSafariBuildIdentity(row),
      evidence: [
        `browserVersion=${row.environment?.browserVersion ?? 'unknown'}`,
        `userAgent=${row.environment?.userAgent ?? 'unknown'}`,
      ],
    },
    sourceBoundaryPinned: {
      met: availability.safariSourceBoundaryPinned === true,
      evidence: [`safariSourceBoundaryPinned=${availability.safariSourceBoundaryPinned ?? 'unknown'}`],
    },
    directStreamSeparate: {
      met: availability.directReadableStreamRowsAreSeparateEvidence === true,
      evidence: [`directReadableStreamRowsAreSeparateEvidence=${availability.directReadableStreamRowsAreSeparateEvidence ?? 'unknown'}`],
    },
  };
  const unmetRequirements = Object.entries(requirements)
    .filter(([, requirement]) => !requirement.met)
    .map(([id]) => id);
  return {
    sourceArtifact: row.sourceArtifact,
    id: row.id,
    runtimeId: row.runtimeId,
    mibPerSec: row.mibPerSec,
    requirements,
    unmetRequirements,
    qualifiedClosure: unmetRequirements.length === 0,
  };
}

function summarizeAvailability(root = {}) {
  const summary = root?.summary ?? {};
  return {
    present: Boolean(root && Object.keys(root).length),
    hostIsMacOS: summary.hostIsMacOS ?? null,
    safariExecutableFound: summary.safariExecutableFound ?? null,
    safaridriverFound: summary.safaridriverFound ?? null,
    currentHarnessSupportsSafari: summary.currentHarnessSupportsSafari ?? null,
    canRunSafariBrowserRows: summary.canRunSafariBrowserRows ?? null,
    safariBenchmarkRowsRecorded: summary.safariBenchmarkRowsRecorded ?? null,
    exactSafariBuildIdentityRecorded: summary.exactSafariBuildIdentityRecorded ?? null,
    safariSourceBoundaryPinned: summary.safariSourceBoundaryPinned ?? null,
    directReadableStreamRowsAreSeparateEvidence: summary.directReadableStreamRowsAreSeparateEvidence ?? null,
    closureRequirementsMet: summary.closureRequirementsMet ?? null,
    closureRequirementsBlocked: summary.closureRequirementsBlocked ?? null,
    closesSafariObligation: summary.closesSafariObligation ?? null,
  };
}

function extractSafariRows(artifact) {
  const rows = [];
  visit(artifact.root, node => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const normalized = normalizeRow(artifact.sourceArtifact, node);
    if (normalized && normalized.runtimeId === 'safari-jsc-browser') rows.push(normalized);
  });
  return rows;
}

function normalizeRow(sourceArtifact, node) {
  const runtimeId = normalizeRuntimeId(node);
  if (runtimeId !== 'safari-jsc-browser') return null;
  const id = firstString(node.id, node.caseId, node.name);
  const mibPerSec = firstFiniteNumber(node.mibPerSec, node.throughputMiBPerSec);
  if (!id || !Number.isFinite(mibPerSec)) return null;
  const memory = node.memory && typeof node.memory === 'object' ? node.memory : {};
  const peakMemoryBytes = firstFiniteNumber(
    node.peakMemoryBytes,
    node.maxMemoryBytes,
    memory.peakBytes,
    memory.maxBytes,
    memory.maxUsedJSHeapSize,
  );
  return {
    sourceArtifact,
    id,
    runtimeId,
    mibPerSec,
    sizeGiB: firstFiniteNumber(node.sizeGiB, node.inputGiB),
    fullStringParity: typeof node.fullStringParity === 'boolean' ? node.fullStringParity : null,
    sourceMode: firstString(node.sourceMode, node.source?.mode),
    directReadableStream: typeof node.directReadableStream === 'boolean' ? node.directReadableStream : null,
    fullArrayBufferParserInput: typeof node.fullArrayBufferParserInput === 'boolean'
      ? node.fullArrayBufferParserInput
      : null,
    demandDrivenSource: typeof node.demandDrivenSource === 'boolean' ? node.demandDrivenSource : null,
    boundedMemory: typeof node.boundedMemory === 'boolean' ? node.boundedMemory : null,
    memoryKind: firstString(node.memoryKind, memory.primaryKind, memory.kind),
    peakMemoryBytes,
    eventCount: firstFiniteNumber(node.eventCount, node.events),
    checksum: firstFiniteNumber(node.checksum),
    environment: node.environment && typeof node.environment === 'object' ? node.environment : {},
  };
}

function normalizeRuntimeId(node) {
  const explicit = firstString(node.runtimeId, node.runtime, node.runtimeLabel);
  if (explicit && /safari|webkit/i.test(explicit) && !/bun/i.test(explicit)) return 'safari-jsc-browser';
  const environment = node.environment && typeof node.environment === 'object' ? node.environment : {};
  const browserName = firstString(environment.browserName, environment.name);
  const engine = firstString(environment.javascriptEngine, environment.engine);
  if ((browserName && /safari/i.test(browserName)) || (engine && /safari|webkit|jsc/i.test(engine))) {
    if (!(browserName && /bun/i.test(browserName))) return 'safari-jsc-browser';
  }
  return explicit ?? null;
}

function extractComparisonRows(root = {}) {
  const rows = [];
  visit(root, node => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const runtimeId = normalizeRuntimeId(node);
    const id = firstString(node.id, node.caseId, node.rowId);
    const eventCount = firstFiniteNumber(node.eventCount);
    const checksum = firstFiniteNumber(node.checksum);
    if (runtimeId === 'safari-jsc-browser' && id && Number.isFinite(eventCount) && Number.isFinite(checksum)) {
      rows.push({ id, runtimeId, eventCount, checksum });
    }
  });
  return rows;
}

function hasAcceptedBoundedMemoryProof(row) {
  return row.boundedMemory === true
    && (row.memoryKind === 'process-rss' || row.memoryKind === 'browser-js-heap')
    && Number.isFinite(row.peakMemoryBytes)
    && row.peakMemoryBytes <= 512 * MIB;
}

function hasMeasuredSafariBuildIdentity(row) {
  return typeof row.environment?.browserVersion === 'string'
    && row.environment.browserVersion.length > 0
    && row.environment.browserVersion !== 'unknown'
    && typeof row.environment?.userAgent === 'string'
    && row.environment.userAgent.length > 0
    && /Safari\//.test(row.environment.userAgent);
}

function createFindings(report) {
  const findings = [
    {
      id: 'safari-webkit-closure-matrix',
      classification: 'SCOPE_GUARD',
      summary: 'Safari/WebKit rows are classified through a same-contract browser-row closure matrix before they can close safari-jsc-source-and-browser-rows-open.',
      evidence: [
        `candidates=${report.summary.candidateCount}`,
        `qualifiedClosures=${report.summary.qualifiedClosureCount}`,
      ],
    },
  ];
  if (report.summary.qualifiedClosureCount === 0) {
    findings.push({
      id: 'safari-webkit-closure-not-met',
      classification: 'NEGATIVE_RESULT',
      summary: 'No current Safari/WebKit artifact satisfies browser-row, primary sync byte-batch, bounded memory, 1 GiB, same-contract comparison, exact build identity, and source-boundary requirements together.',
      evidence: [
        `candidateRows=${report.summary.candidateCount}`,
        `largeBoundedPrimaryRows=${report.summary.largeBoundedPrimaryRows}`,
        `rowsInSameContractComparison=${report.summary.rowsInSameContractComparison}`,
      ],
    });
  }
  return findings;
}

function renderMarkdown(report) {
  const lines = [
    '# Safari/WebKit Closure Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Candidate Safari/WebKit rows: ${report.summary.candidateCount}`,
    `- Full-string rows: ${report.summary.fullStringRows}`,
    `- Primary sync byte-batch rows: ${report.summary.primarySyncByteBatchRows}`,
    `- Large bounded primary rows: ${report.summary.largeBoundedPrimaryRows}`,
    `- Rows in same-contract comparison: ${report.summary.rowsInSameContractComparison}`,
    `- Rows with measured exact build identity: ${report.summary.measuredExactBuildIdentityRows}`,
    `- Source boundary pinned: ${yesNo(report.summary.sourceBoundaryPinned)}`,
    `- Qualified closures: ${report.summary.qualifiedClosureCount}`,
    `- Conclusion allowed: ${yesNo(report.summary.conclusionAllowed)}`,
    '',
    '## Availability',
    '',
    `- Host macOS: ${yesNo(report.availability.hostIsMacOS)}`,
    `- Safari executable found: ${yesNo(report.availability.safariExecutableFound)}`,
    `- safaridriver found: ${yesNo(report.availability.safaridriverFound)}`,
    `- Harness supports Safari: ${yesNo(report.availability.currentHarnessSupportsSafari)}`,
    `- Availability closes Safari obligation: ${yesNo(report.availability.closesSafariObligation)}`,
    '',
    '## Closure Matrix',
    '',
    '| Artifact | Row | Primary sync | Bounded memory | 1 GiB+ | Same contract | Build identity | Source boundary | Qualified | Missing |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  if (report.candidates.length === 0) {
    lines.push('| none | | | | | | | | | |');
  } else {
    for (const candidate of report.candidates) {
      lines.push([
        `| \`${candidate.sourceArtifact}\``,
        `\`${candidate.id ?? 'unknown'}\``,
        yesNo(candidate.requirements.primarySyncByteBatch.met),
        yesNo(candidate.requirements.boundedMemory.met),
        yesNo(candidate.requirements.largeOneGiB.met),
        yesNo(candidate.requirements.sameContractComparison.met),
        yesNo(candidate.requirements.measuredExactBuildIdentity.met),
        yesNo(candidate.requirements.sourceBoundaryPinned.met),
        yesNo(candidate.qualifiedClosure),
        candidate.unmetRequirements.length ? candidate.unmetRequirements.join(', ') : 'none',
        '|',
      ].join(' | '));
    }
  }
  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence ?? []) lines.push(`  - ${evidence}`);
  }
  return `${lines.join('\n')}\n`;
}

function visit(node, callback) {
  callback(node);
  if (Array.isArray(node)) {
    for (const item of node) visit(item, callback);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const value of Object.values(node)) visit(value, callback);
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

function yesNo(value) {
  return value === true ? 'yes' : 'no';
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function pathToFileUrl(filePath) {
  return filePath ? `file:///${resolve(filePath).replace(/\\/g, '/')}` : '';
}

if (import.meta.url === pathToFileUrl(process.argv[1])) main();
