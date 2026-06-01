import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultReleaseDir = resolve(__dirname, 'results', 'release');
const defaultMaterializedJson = resolve(defaultReleaseDir, 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json');
const defaultTokenJson = resolve(defaultReleaseDir, 'spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit.json');
const defaultApiGapJson = resolve(defaultReleaseDir, 'firefox-spidermonkey-jsshell-stax-api-gap-audit.json');
const defaultContractJson = resolve(defaultReleaseDir, 'materialization-contract-audit.json');
const defaultAsciiJson = resolve(defaultReleaseDir, 'spidermonkey-ascii-scope-distance-audit.json');
const defaultJsonOut = resolve(defaultReleaseDir, 'spidermonkey-materialized-scope-distance-audit.json');
const defaultMdOut = resolve(defaultReleaseDir, 'spidermonkey-materialized-scope-distance-audit.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    materializedJson: defaultMaterializedJson,
    tokenJson: defaultTokenJson,
    apiGapJson: defaultApiGapJson,
    contractJson: defaultContractJson,
    asciiJson: defaultAsciiJson,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
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
      case '--materialized-json':
        options.materializedJson = resolve(process.cwd(), readValue());
        break;
      case '--token-json':
        options.tokenJson = resolve(process.cwd(), readValue());
        break;
      case '--api-gap-json':
        options.apiGapJson = resolve(process.cwd(), readValue());
        break;
      case '--contract-json':
        options.contractJson = resolve(process.cwd(), readValue());
        break;
      case '--ascii-json':
        options.asciiJson = resolve(process.cwd(), readValue());
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
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
  console.log(`${report.objective}: equivalent=${report.summary.semanticEquivalentForAsciiFields} closes=${report.summary.closesCodegenObligation}`);
}

function createReport(options) {
  const materialized = readJson(options.materializedJson);
  const token = readJson(options.tokenJson);
  const apiGap = readJson(options.apiGapJson);
  const contract = readJson(options.contractJson);
  const ascii = readJson(options.asciiJson);
  return buildReport(options, { materialized, token, apiGap, contract, ascii });
}

function buildReport(options, sources) {
  const materialized = sources.materialized;
  const token = sources.token;
  const apiGap = sources.apiGap;
  const contract = sources.contract;
  const ascii = sources.ascii;
  const workload = materialized.materializedWorkload ?? {};
  const tokenWorkload = token.row ?? {};
  const missingGlobals = apiGap.summary?.commonMissingGlobals
    ?? materialized.shell?.apiProbe?.missingGlobals
    ?? [];
  const hostApiSurface = summarizeHostApiSurface(apiGap, missingGlobals);
  const asciiScopeDistance = summarizeAsciiScopeDistance(ascii);
  const sameTaskclusterBuild = [
    materialized.shell?.provenance?.taskId,
    token.shell?.provenance?.taskId,
  ].every(Boolean) && materialized.shell.provenance.taskId === token.shell.provenance.taskId;
  const checks = [
    {
      id: 'same-current-debug-shell-build',
      status: sameTaskclusterBuild ? 'pass' : 'fail',
      evidence: [
        `materializedTaskId=${materialized.shell?.provenance?.taskId ?? 'unknown'}`,
        `tokenTaskId=${token.shell?.provenance?.taskId ?? 'unknown'}`,
        `buildId=${materialized.shell?.provenance?.targetTxt?.buildId ?? materialized.shell?.provenance?.buildhub?.buildId ?? 'unknown'}`,
      ],
    },
    {
      id: 'semantic-field-folding-present',
      status: materialized.outcome?.sameSemanticChecksumFields === true && workload.fullStringParity === true ? 'pass' : 'fail',
      evidence: [
        `sameSemanticChecksumFields=${materialized.outcome?.sameSemanticChecksumFields ?? 'unknown'}`,
        `fullStringParity=${workload.fullStringParity ?? materialized.outcome?.fullStringParity ?? 'unknown'}`,
        `checksum=${workload.checksum ?? 'unknown'}`,
      ],
    },
    {
      id: 'materializes-js-strings-and-public-event-objects',
      status: workload.materializedStringCount > 0 && workload.materializedObjectCount > 0 ? 'pass' : 'fail',
      evidence: [
        `materializedStringCount=${workload.materializedStringCount ?? 'unknown'}`,
        `materializedObjectCount=${workload.materializedObjectCount ?? 'unknown'}`,
        `materializedAttributeObjectCount=${workload.materializedAttributeObjectCount ?? 'unknown'}`,
      ],
    },
    {
      id: 'token-to-materialized-workload-delta-recorded',
      status: tokenWorkload.fullStringParity === false && workload.fullStringParity === true ? 'pass' : 'fail',
      evidence: [
        `tokenFullStringParity=${tokenWorkload.fullStringParity ?? token.outcome?.fullStringParity ?? 'unknown'}`,
        `materializedFullStringParity=${workload.fullStringParity ?? materialized.outcome?.fullStringParity ?? 'unknown'}`,
        `tokenChecksum=${tokenWorkload.checksum ?? 'unknown'}`,
        `materializedChecksum=${workload.checksum ?? 'unknown'}`,
      ],
    },
    {
      id: 'unchanged-stax-host-api-gap-remains',
      status: materialized.outcome?.canRunCurrentStaxFullStringBenchmark === false
        && missingGlobals.includes('TextDecoder')
        && missingGlobals.includes('ReadableStream')
        ? 'pass'
        : 'fail',
      evidence: [
        `missingGlobals=${missingGlobals.join(', ') || 'none'}`,
        `canRunCurrentStaxFullStringBenchmark=${materialized.outcome?.canRunCurrentStaxFullStringBenchmark ?? 'unknown'}`,
      ],
    },
    {
      id: 'unchanged-stax-closure-blocked',
      status: materialized.outcome?.sameContractStaxRow === false
        && materialized.outcome?.unchangedStaxBenchmark === false
        && materialized.outcome?.closesEmittedIrObligation === false
        ? 'pass'
        : 'fail',
      evidence: [
        `sameContractStaxRow=${materialized.outcome?.sameContractStaxRow ?? 'unknown'}`,
        `unchangedStaxBenchmark=${materialized.outcome?.unchangedStaxBenchmark ?? 'unknown'}`,
        `closesEmittedIrObligation=${materialized.outcome?.closesEmittedIrObligation ?? 'unknown'}`,
      ],
    },
  ];
  const allPass = checks.every(check => check.status === 'pass');
  const closureMatrix = createClosureRequirementMatrix({ materialized, workload, missingGlobals, hostApiSurface });
  const closureRequirementsMet = closureMatrix.filter(item => item.status === 'met').length;
  const closureRequirementsBlocked = closureMatrix.filter(item => item.status === 'blocked').length;
  const closureRequirementsSatisfied = closureRequirementsBlocked === 0
    && closureRequirementsMet === closureMatrix.length;
  const sourceArtifactDeclaresClosure = materialized.outcome?.closesEmittedIrObligation === true;
  const closureClaimContradictedByScope = sourceArtifactDeclaresClosure
    && !closureRequirementsSatisfied;
  const closesCodegenObligation = sourceArtifactDeclaresClosure
    && closureRequirementsSatisfied;
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'spidermonkey-materialized-scope-distance-audit',
    contract: 'materialized-js-shell-workload-equivalence-and-scope-distance',
    note: 'Compares the current Taskcluster SpiderMonkey js-shell materialized-codegen artifact against the token-only codegen artifact, the js-shell StAX API gap, and the semantic materialization contract. This audit records exactly what the materialized js-shell workload proves and why it still cannot close the unchanged StAX codegen obligation.',
    parameters: {
      materializedJson: options.materializedJson,
      tokenJson: options.tokenJson,
      apiGapJson: options.apiGapJson,
      contractJson: options.contractJson,
      asciiJson: options.asciiJson,
      selfTest: options.selfTest,
    },
    sourceArtifacts: {
      materialized: sourceSummary(materialized),
      token: sourceSummary(token),
      apiGap: sourceSummary(apiGap),
      contract: sourceSummary(contract),
      ascii: sourceSummary(ascii),
    },
    workloadComparison: {
      token: {
        contractScope: tokenWorkload.contractScope ?? null,
        fullStringParity: tokenWorkload.fullStringParity ?? token.outcome?.fullStringParity ?? null,
        eventCount: tokenWorkload.eventCount ?? null,
        checksum: tokenWorkload.checksum ?? null,
        codegenMarkers: tokenWorkload.codegenMarkers ?? token.shell?.xmlCodegenProbe?.codegenMarkerCount ?? null,
      },
      materialized: {
        contractScope: workload.contractScope ?? null,
        fullStringParity: workload.fullStringParity ?? materialized.outcome?.fullStringParity ?? null,
        sameSemanticChecksumFields: materialized.outcome?.sameSemanticChecksumFields ?? null,
        eventCount: workload.eventCount ?? null,
        checksum: workload.checksum ?? null,
        materializedStringCount: workload.materializedStringCount ?? null,
        materializedObjectCount: workload.materializedObjectCount ?? null,
        codegenMarkers: materialized.shell?.materializedCodegenProbe?.codegenMarkerCount ?? null,
      },
    },
    semanticContract: {
      semanticFields: contract.semanticFields ?? [],
      staxEventPublicObjectsSupported: Boolean(contract.sourceChecks?.items?.some(item => item.id === 'stax-event-public-objects' && item.supported === true)),
      staxStreamIndexAccessorsSupported: Boolean(contract.sourceChecks?.items?.some(item => item.id === 'stax-stream-index-accessors' && item.supported === true)),
    },
    hostApiSurface,
    asciiScopeDistance,
    closureMatrix,
    checks,
    summary: {
      allChecksPass: allPass,
      semanticEquivalentForAsciiFields: allPass && materialized.outcome?.sameSemanticChecksumFields === true,
      materializesJsStringsAndObjects: workload.materializedStringCount > 0 && workload.materializedObjectCount > 0,
      closesDiagnosticSurfaceObligation: materialized.outcome?.closesDiagnosticSurfaceObligation === true,
      closureRequirementsMet,
      closureRequirementsBlocked,
      sourceArtifactDeclaresClosure,
      closureClaimContradictedByScope,
      closesCodegenObligation,
      unchangedStaxBenchmark: materialized.outcome?.unchangedStaxBenchmark === true,
      sameContractStaxRow: materialized.outcome?.sameContractStaxRow === true,
      conclusionAllowed: false,
    },
  };
  report.findings = createFindings(report);
  return report;
}

function summarizeHostApiSurface(apiGap, missingGlobals) {
  const primarySurface = Array.isArray(apiGap.blockedSurfaces)
    ? apiGap.blockedSurfaces.find(surface => surface.id === 'sync-corpus-byte-batch-full-string')
    : null;
  const primarySyncByteBatchMissingGlobals = uniqueStrings(
    primarySurface
      ? primarySurface.shellBlockers?.flatMap(shell => shell.missingGlobals ?? []) ?? []
      : missingGlobals.filter(name => name === 'TextDecoder'),
  );
  const nonPrimaryHarnessMissingGlobals = missingGlobals.filter(name => !primarySyncByteBatchMissingGlobals.includes(name));
  return {
    commonMissingGlobals: missingGlobals,
    primarySyncByteBatchSurfaceId: primarySurface?.id ?? 'sync-corpus-byte-batch-full-string',
    primarySyncByteBatchMissingGlobals,
    nonPrimaryHarnessMissingGlobals,
    interpretation: 'For corpus-file synchronous Iterable<Uint8Array[]> StAX closure, the js-shell blocker narrows to TextDecoder; TextEncoder, ReadableStream, and fetch are generated-fixture, direct-stream, or browser-live-source harness blockers.',
  };
}

function summarizeAsciiScopeDistance(ascii) {
  return {
    objective: ascii?.objective ?? null,
    reducesScopeDistance: ascii?.summary?.reducesScopeDistance === true,
    materializedCorpusSeedAscii: ascii?.summary?.materializedCorpusSeedAscii === true,
    asciiByteToStringEquivalentToUtf8: ascii?.summary?.asciiByteToStringEquivalentToUtf8 === true,
    allCorpusFilesAscii: ascii?.summary?.allCorpusFilesAscii === true,
    closesCodegenObligation: ascii?.summary?.closesCodegenObligation === true,
  };
}

function createClosureRequirementMatrix({ materialized, workload, missingGlobals, hostApiSurface }) {
  return [
    {
      id: 'emitted-codegen-surface',
      required: 'The diagnostic shell emits codegen/IR or optimized-code output for the tested workload.',
      observed: materialized.outcome?.hasCodegenDumpOutput === true
        ? `codegenDump=true, nativeDumpComplete=${materialized.outcome?.nativeDumpComplete ?? 'unknown'}`
        : `codegenDump=${materialized.outcome?.hasCodegenDumpOutput ?? 'unknown'}`,
      status: materialized.outcome?.hasCodegenDumpOutput === true ? 'met' : 'blocked',
    },
    {
      id: 'full-string-semantic-materialization',
      required: 'The workload materializes JS strings and public event objects for the checksum fields under test.',
      observed: `fullStringParity=${workload.fullStringParity ?? materialized.outcome?.fullStringParity ?? 'unknown'}, materializedStringCount=${workload.materializedStringCount ?? 'unknown'}, materializedObjectCount=${workload.materializedObjectCount ?? 'unknown'}`,
      status: workload.fullStringParity === true && workload.materializedStringCount > 0 && workload.materializedObjectCount > 0
        ? 'met'
        : 'blocked',
    },
    {
      id: 'same-contract-stax-row',
      required: 'The emitted codegen corresponds to the unchanged same-contract StAX benchmark row.',
      observed: `sameContractStaxRow=${materialized.outcome?.sameContractStaxRow ?? 'unknown'}`,
      status: materialized.outcome?.sameContractStaxRow === true ? 'met' : 'blocked',
    },
    {
      id: 'unchanged-stax-benchmark',
      required: 'The benchmark harness is unchanged from the current TextDecoder/ReadableStream StAX row.',
      observed: `unchangedStaxBenchmark=${materialized.outcome?.unchangedStaxBenchmark ?? 'unknown'}`,
      status: materialized.outcome?.unchangedStaxBenchmark === true ? 'met' : 'blocked',
    },
    {
      id: 'host-api-surface',
      required: 'The js-shell can run the current full-string StAX harness without host API substitution.',
      observed: `canRunCurrentStaxFullStringBenchmark=${materialized.outcome?.canRunCurrentStaxFullStringBenchmark ?? 'unknown'}, missingGlobals=${missingGlobals.join(', ') || 'none'}, primarySyncByteBatchMissingGlobals=${hostApiSurface.primarySyncByteBatchMissingGlobals.join(', ') || 'none'}`,
      status: materialized.outcome?.canRunCurrentStaxFullStringBenchmark === true ? 'met' : 'blocked',
    },
    {
      id: 'closure-declared-by-source-artifact',
      required: 'The source artifact declares that it closes the emitted-IR obligation.',
      observed: `closesEmittedIrObligation=${materialized.outcome?.closesEmittedIrObligation ?? 'unknown'}`,
      status: materialized.outcome?.closesEmittedIrObligation === true ? 'met' : 'blocked',
    },
  ];
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(value => typeof value === 'string' && value.length > 0))];
}

function sourceSummary(root) {
  return {
    objective: root.objective ?? null,
    contract: root.contract ?? null,
    outcome: root.outcome ?? null,
  };
}

function createFindings(report) {
  const findings = [
    {
      id: 'materialized-js-shell-semantic-equivalence-bounded',
      classification: 'SOURCE_FACT',
      summary: 'The materialized js-shell workload folds the same semantic string fields for the ASCII corpus-seed scope and records positive JS string/object materialization counters.',
      evidence: [
        `semanticEquivalentForAsciiFields=${report.summary.semanticEquivalentForAsciiFields}`,
        `materializedStringCount=${report.workloadComparison.materialized.materializedStringCount ?? 'unknown'}`,
        `materializedObjectCount=${report.workloadComparison.materialized.materializedObjectCount ?? 'unknown'}`,
        `checksum=${report.workloadComparison.materialized.checksum ?? 'unknown'}`,
      ],
    },
    {
      id: 'materialized-js-shell-ascii-textdecoder-equivalence',
      classification: 'SOURCE_FACT',
      summary: 'For the checked ASCII corpus scope, the js-shell materializer produces the same string code units that UTF-8 TextDecoder would produce, narrowing the remaining TextDecoder blocker to unchanged host API/codegen evidence.',
      evidence: [
        `reducesScopeDistance=${report.asciiScopeDistance.reducesScopeDistance}`,
        `materializedCorpusSeedAscii=${report.asciiScopeDistance.materializedCorpusSeedAscii}`,
        `asciiByteToStringEquivalentToUtf8=${report.asciiScopeDistance.asciiByteToStringEquivalentToUtf8}`,
      ],
    },
    {
      id: 'materialized-js-shell-not-unchanged-stax',
      classification: 'SCOPE_GUARD',
      summary: 'The same artifact remains outside unchanged StAX closure because the js-shell host API cannot run the TextDecoder/ReadableStream benchmark surface.',
      evidence: [
        `sameContractStaxRow=${report.summary.sameContractStaxRow}`,
        `unchangedStaxBenchmark=${report.summary.unchangedStaxBenchmark}`,
        `closesCodegenObligation=${report.summary.closesCodegenObligation}`,
      ],
    },
    {
      id: 'materialized-js-shell-closure-negative',
      classification: 'NEGATIVE_RESULT',
      summary: 'This audit rejects using the materialized js-shell codegen artifact as closure evidence for codegen-traces-open.',
      evidence: [
        'requiredClosure=same-contract full-string StAX emitted codegen',
        'observedClosure=ASCII js-shell materialized workload codegen',
        `allChecksPass=${report.summary.allChecksPass}`,
      ],
    },
  ];
  if (report.summary.closureClaimContradictedByScope) {
    findings.push({
      id: 'materialized-js-shell-contradictory-closure-claim',
      classification: 'SCOPE_GUARD',
      summary: 'The source artifact claims emitted-IR closure, but same-contract StAX closure requirements remain blocked.',
      evidence: [
        `sourceArtifactDeclaresClosure=${report.summary.sourceArtifactDeclaresClosure}`,
        `closureRequirementsMet=${report.summary.closureRequirementsMet}`,
        `closureRequirementsBlocked=${report.summary.closureRequirementsBlocked}`,
        `closesCodegenObligation=${report.summary.closesCodegenObligation}`,
      ],
    });
  }
  return findings;
}

function createSelfTestReport(options) {
  return buildReport(options, {
    materialized: {
      objective: 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit',
      contract: 'current-taskcluster-debug-spidermonkey-materialized-string-object-codegen-surface-not-unchanged-stax',
      outcome: {
        sameSemanticChecksumFields: true,
        hasCodegenDumpOutput: true,
        fullStringParity: true,
        sameContractStaxRow: false,
        unchangedStaxBenchmark: false,
        canRunCurrentStaxFullStringBenchmark: false,
        closesDiagnosticSurfaceObligation: true,
        closesEmittedIrObligation: false,
      },
      shell: {
        provenance: {
          taskId: 'bzK0wWZvQoOguMjTIbRJ_g',
          targetTxt: { buildId: '20260531212007' },
        },
        materializedCodegenProbe: { codegenMarkerCount: 234522 },
      },
      materializedWorkload: {
        contractScope: 'ascii-js-string-and-public-event-object-materialization',
        fullStringParity: true,
        eventCount: 55759,
        checksum: -553631888,
        materializedStringCount: 61289,
        materializedObjectCount: 55759,
        materializedAttributeObjectCount: 19586,
      },
    },
    token: {
      objective: 'spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit',
      contract: 'current-taskcluster-debug-spidermonkey-xml-workload-codegen-surface-not-same-contract-stax',
      outcome: { fullStringParity: false },
      shell: {
        provenance: { taskId: 'bzK0wWZvQoOguMjTIbRJ_g' },
        xmlCodegenProbe: { codegenMarkerCount: 151431 },
      },
      row: {
        contractScope: 'xml-token-boundary-no-string-materialization',
        fullStringParity: false,
        eventCount: 55759,
        checksum: 9292058,
      },
    },
    apiGap: {
      objective: 'firefox-spidermonkey-jsshell-stax-api-gap-audit',
      contract: 'spidermonkey-jsshell-host-api-surface-gap',
      summary: {
        commonMissingGlobals: ['TextDecoder', 'TextEncoder', 'ReadableStream', 'fetch'],
      },
      blockedSurfaces: [
        {
          id: 'sync-corpus-byte-batch-full-string',
          shellBlockers: [
            { packageKind: 'release', blocked: true, missingGlobals: ['TextDecoder'] },
            { packageKind: 'nightly', blocked: true, missingGlobals: ['TextDecoder'] },
          ],
        },
      ],
    },
    contract: {
      objective: 'materialization-contract-audit',
      contract: 'semantic-materialization-not-object-shape',
      semanticFields: ['event type', 'element local name', 'attribute count', 'attribute local name', 'attribute value', 'trimmed non-empty text', 'UTF-16-code-unit checksum'],
      sourceChecks: {
        items: [
          { id: 'stax-event-public-objects', supported: true },
          { id: 'stax-stream-index-accessors', supported: true },
        ],
      },
    },
    ascii: {
      objective: 'spidermonkey-ascii-scope-distance-audit',
      contract: 'spidermonkey-js-shell-ascii-materializer-utf8-equivalence-scope',
      summary: {
        reducesScopeDistance: true,
        materializedCorpusSeedAscii: true,
        asciiByteToStringEquivalentToUtf8: true,
        allCorpusFilesAscii: false,
        closesCodegenObligation: false,
      },
    },
  });
}

function readJson(filePath) {
  if (!existsSync(filePath)) throw new Error(`Missing JSON input: ${filePath}`);
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function renderMarkdown(report) {
  const lines = [
    '# SpiderMonkey Materialized Scope Distance Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- All checks pass: ${report.summary.allChecksPass}`,
    `- Semantic-equivalent for ASCII fields: ${report.summary.semanticEquivalentForAsciiFields}`,
    `- Materializes JS strings and objects: ${report.summary.materializesJsStringsAndObjects}`,
    `- Closes diagnostic surface obligation: ${report.summary.closesDiagnosticSurfaceObligation}`,
    `- Closure requirements met: ${report.summary.closureRequirementsMet}`,
    `- Closure requirements blocked: ${report.summary.closureRequirementsBlocked}`,
    `- Source artifact declares emitted-IR closure: ${report.summary.sourceArtifactDeclaresClosure}`,
    `- Closure claim contradicted by scope: ${report.summary.closureClaimContradictedByScope}`,
    `- Closes codegen obligation: ${report.summary.closesCodegenObligation}`,
    `- Same-contract StAX row: ${report.summary.sameContractStaxRow}`,
    `- Unchanged StAX benchmark: ${report.summary.unchangedStaxBenchmark}`,
    `- Primary sync byte-batch missing globals: ${report.hostApiSurface.primarySyncByteBatchMissingGlobals.join(', ') || 'none'}`,
    `- Non-primary harness missing globals: ${report.hostApiSurface.nonPrimaryHarnessMissingGlobals.join(', ') || 'none'}`,
    `- ASCII TextDecoder equivalence reduces scope distance: ${report.asciiScopeDistance.reducesScopeDistance}`,
    '',
    '## Workload Comparison',
    '',
    `- Token workload: ${report.workloadComparison.token.contractScope}, fullStringParity=${report.workloadComparison.token.fullStringParity}, checksum=${report.workloadComparison.token.checksum}, codegenMarkers=${report.workloadComparison.token.codegenMarkers}`,
    `- Materialized workload: ${report.workloadComparison.materialized.contractScope}, fullStringParity=${report.workloadComparison.materialized.fullStringParity}, checksum=${report.workloadComparison.materialized.checksum}, materializedStringCount=${report.workloadComparison.materialized.materializedStringCount}, materializedObjectCount=${report.workloadComparison.materialized.materializedObjectCount}, codegenMarkers=${report.workloadComparison.materialized.codegenMarkers}`,
    '',
    '## Closure Requirement Matrix',
    '',
    '| Requirement | Status | Required | Observed |',
    '| --- | --- | --- | --- |',
    ...report.closureMatrix.map(item => `| \`${item.id}\` | ${item.status} | ${item.required} | ${item.observed} |`),
    '',
    '## Checks',
    '',
  ];
  for (const check of report.checks) {
    lines.push(`- ${check.id}: ${check.status}`);
    for (const evidence of check.evidence) lines.push(`  - ${evidence}`);
  }
  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) lines.push(`  - ${evidence}`);
  }
  return `${lines.join('\n')}\n`;
}

function writeOutput(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

main();
