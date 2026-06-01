import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultReleaseDir = resolve(__dirname, 'results', 'release');
const defaultJsonOut = resolve(defaultReleaseDir, 'spidermonkey-codegen-closure-audit.json');
const defaultMdOut = resolve(defaultReleaseDir, 'spidermonkey-codegen-closure-audit.md');

const disallowedEvidenceClasses = new Set([
  'availability-only',
  'jit-status-only',
  'host-api-surface-gap',
  'diagnostic-flag-sweep-negative',
  'negative-diagnostic-surface',
  'source-pin-only',
  'archival-codegen-scope-guard',
  'current-debug-codegen-scope-guard',
  'current-debug-xml-codegen-scope-guard',
  'current-debug-materialized-codegen-scope-guard',
]);

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    releaseDir: defaultReleaseDir,
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
      case '--release-dir':
        options.releaseDir = resolve(process.cwd(), readValue());
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
  console.log(`${report.objective}: candidates=${report.summary.candidateCount} qualified=${report.summary.qualifiedClosureCount}`);
}

function createReport(options) {
  if (!existsSync(options.releaseDir)) {
    throw new Error(`--release-dir does not exist: ${options.releaseDir}`);
  }
  const artifacts = readdirSync(options.releaseDir)
    .filter(file => file.endsWith('.json'))
    .filter(file => /spidermonkey|firefox/i.test(file))
    .filter(file => file !== 'spidermonkey-codegen-closure-audit.json')
    .sort()
    .map(file => readArtifact(options.releaseDir, file));
  return buildReport(options, artifacts);
}

function createSelfTestReport(options) {
  return buildReport(options, [
    {
      sourceArtifact: 'spidermonkey-codegen-closure-audit.json',
      root: {
        objective: 'spidermonkey-codegen-closure-audit',
        summary: {
          candidateCount: 2,
          qualifiedClosureCount: 1,
        },
      },
    },
    {
      sourceArtifact: 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json',
      root: {
        objective: 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit',
        outcome: {
          status: 'materialized-string-object-codegen-output-emitted',
          hasCodegenDumpOutput: true,
          sameContractStaxRow: false,
          unchangedStaxBenchmark: false,
          canRunCurrentStaxFullStringBenchmark: false,
          closesEmittedIrObligation: false,
          selectedRowIdentityStatus: 'not-claimed-non-stax-diagnostic',
        },
        shell: {
          provenance: {
            taskId: 'self-test-task',
            buildId: '20260601000000',
            sourceRevision: 'abc123',
          },
          materializedCodegenProbe: {
            status: 'materialized-string-object-codegen-output-emitted',
            flags: 'codegen',
            outputBytes: 4096,
            codegenMarkerCount: 42,
            nativeDumpComplete: true,
          },
        },
      },
    },
    {
      sourceArtifact: 'spidermonkey-same-contract-closure.json',
      root: {
        objective: 'spidermonkey-same-contract-closure',
        outcome: {
          status: 'codegen-output-emitted',
          hasCodegenDumpOutput: true,
          sameContractStaxRow: true,
          unchangedStaxBenchmark: true,
          canRunCurrentStaxFullStringBenchmark: true,
          closesEmittedIrObligation: true,
          selectedRowId: 'firefox-row',
          selectedEventCount: 12,
          selectedChecksum: 34,
          selectedRowIdentityStatus: 'same-contract-stax-row',
        },
        shell: {
          provenance: {
            taskId: 'closure-task',
            buildId: '20260602000000',
            sourceRevision: 'def456',
          },
          codegenProbe: {
            status: 'codegen-output-emitted',
            flags: 'codegen',
            outputBytes: 8192,
            codegenMarkerCount: 99,
            nativeDumpComplete: true,
          },
        },
      },
    },
  ]);
}

function buildReport(options, artifacts) {
  const candidates = artifacts
    .map(createCandidate)
    .filter(candidate => candidate.objective !== 'spidermonkey-codegen-closure-audit')
    .filter(candidate => candidate.hasAnyDiagnosticSurface || /codegen|diagnostic|jsshell|js-shell|buildconfig/i.test(candidate.sourceArtifact))
    .sort((left, right) => left.sourceArtifact.localeCompare(right.sourceArtifact));
  const qualified = candidates.filter(candidate => candidate.qualifiedClosure);
  const contradicted = candidates.filter(candidate => candidate.declaresClosure && !candidate.qualifiedClosure);
  const blocked = candidates.filter(candidate => !candidate.qualifiedClosure);
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'spidermonkey-codegen-closure-audit',
    contract: 'spidermonkey-emitted-codegen-same-contract-closure-matrix',
    note: 'Audits SpiderMonkey diagnostic/codegen artifacts against the exact closure requirements for codegen-traces-open. This is not benchmark evidence and not emitted IR by itself; it prevents diagnostic js-shell or availability artifacts from being promoted to same-contract StAX closure evidence.',
    parameters: {
      releaseDir: options.releaseDir,
      selfTest: options.selfTest,
    },
    candidates,
    summary: {
      candidateCount: candidates.length,
      diagnosticSurfaceCount: candidates.filter(candidate => candidate.hasAnyDiagnosticSurface).length,
      emittedCodegenSurfaceCount: candidates.filter(candidate => candidate.requirements.emittedCodegenSurface.met).length,
      sameContractStaxRowCount: candidates.filter(candidate => candidate.requirements.sameContractStaxRow.met).length,
      unchangedRunnableCount: candidates.filter(candidate => candidate.requirements.unchangedRunnable.met).length,
      selectedRowMetadataCount: candidates.filter(candidate => candidate.requirements.selectedRowMetadata.met).length,
      closingMetadataCount: candidates.filter(candidate => candidate.requirements.closingMetadata.met).length,
      qualifiedClosureCount: qualified.length,
      contradictedClosureClaimCount: contradicted.length,
      blockedCandidateCount: blocked.length,
      conclusionAllowed: qualified.length > 0,
    },
  };
  report.findings = createFindings(report);
  return report;
}

function createCandidate(artifact) {
  const root = artifact.root ?? {};
  const outcome = root.outcome ?? {};
  const summary = root.summary ?? {};
  const shell = root.shell ?? {};
  const provenance = shell.provenance ?? {};
  const codegenMarkerCount = firstFiniteNumber(
    shell.codegenProbe?.codegenMarkerCount,
    shell.xmlCodegenProbe?.codegenMarkerCount,
    shell.materializedCodegenProbe?.codegenMarkerCount,
    summary.codegenMarkers,
  );
  const hasCodegenDumpOutput = outcome.hasCodegenDumpOutput === true
    || outcome.codegenDump === true
    || summary.codegenDump === true
    || codegenMarkerCount > 0;
  const irDumpSurface = outcome.irDumpSurface === true
    || summary.irDumpSurface === true
    || shell.codegenProbe?.irDumpSurface === true
    || shell.xmlCodegenProbe?.irDumpSurface === true
    || shell.materializedCodegenProbe?.irDumpSurface === true;
  const nativeDumpComplete = outcome.nativeDumpComplete === true
    || summary.nativeDumpComplete === true
    || shell.codegenProbe?.nativeDumpComplete === true
    || shell.xmlCodegenProbe?.nativeDumpComplete === true
    || shell.materializedCodegenProbe?.nativeDumpComplete === true;
  const evidenceClass = outcome.evidenceClass ?? summary.evidenceClass ?? inferEvidenceClass(artifact.sourceArtifact, outcome);
  const selectedRowId = firstString(outcome.selectedRowId, summary.selectedRowId);
  const selectedEventCount = firstFiniteNumber(outcome.selectedEventCount, summary.selectedEventCount);
  const selectedChecksum = firstFiniteNumber(outcome.selectedChecksum, summary.selectedChecksum);
  const runtimeBuildIdentityRecorded = hasSpiderMonkeyRuntimeBuildIdentity(root);
  const diagnosticFlagsRecorded = hasSpiderMonkeyDiagnosticFlags(root);
  const emittedDumpMetadataRecorded = hasSpiderMonkeyEmittedDumpMetadata(root, outcome);
  const requirements = {
    emittedCodegenSurface: {
      met: hasCodegenDumpOutput || irDumpSurface || nativeDumpComplete,
      evidence: [
        `hasCodegenDumpOutput=${hasCodegenDumpOutput}`,
        `irDumpSurface=${irDumpSurface}`,
        `nativeDumpComplete=${nativeDumpComplete}`,
        `codegenMarkers=${codegenMarkerCount ?? 'unknown'}`,
      ],
    },
    sameContractStaxRow: {
      met: outcome.sameContractStaxRow === true,
      evidence: [`sameContractStaxRow=${outcome.sameContractStaxRow ?? 'unknown'}`],
    },
    unchangedRunnable: {
      met: outcome.canRunCurrentStaxFullStringBenchmark === true || outcome.unchangedStaxBenchmark === true,
      evidence: [
        `canRunCurrentStaxFullStringBenchmark=${outcome.canRunCurrentStaxFullStringBenchmark ?? 'unknown'}`,
        `unchangedStaxBenchmark=${outcome.unchangedStaxBenchmark ?? 'unknown'}`,
      ],
    },
    selectedRowMetadata: {
      met: Boolean(selectedRowId) && Number.isFinite(selectedEventCount) && Number.isFinite(selectedChecksum),
      evidence: [
        `selectedRowId=${selectedRowId ?? 'unknown'}`,
        `selectedEventCount=${selectedEventCount ?? 'unknown'}`,
        `selectedChecksum=${selectedChecksum ?? 'unknown'}`,
      ],
    },
    closingMetadata: {
      met: runtimeBuildIdentityRecorded
        && diagnosticFlagsRecorded
        && emittedDumpMetadataRecorded,
      evidence: [
        `taskId=${provenance.taskId ?? 'unknown'}`,
        `buildId=${provenance.buildId ?? provenance.targetTxt?.buildId ?? provenance.buildhub?.buildId ?? 'unknown'}`,
        `sourceRevision=${provenance.sourceRevision ?? provenance.targetTxt?.sourceRevision ?? 'unknown'}`,
        `runtimeBuildIdentityRecorded=${runtimeBuildIdentityRecorded}`,
        `diagnosticFlagsRecorded=${diagnosticFlagsRecorded}`,
        `emittedDumpMetadataRecorded=${emittedDumpMetadataRecorded}`,
      ],
    },
    evidenceClassAllowed: {
      met: !disallowedEvidenceClasses.has(evidenceClass),
      evidence: [`evidenceClass=${evidenceClass ?? 'unknown'}`],
    },
  };
  const unmetRequirements = Object.entries(requirements)
    .filter(([, requirement]) => !requirement.met)
    .map(([id]) => id);
  const qualifiedClosure = unmetRequirements.length === 0;
  const declaresClosure = outcome.closesEmittedIrObligation === true || summary.closesCodegenObligation === true;
  return {
    sourceArtifact: artifact.sourceArtifact,
    objective: root.objective ?? null,
    status: outcome.status ?? summary.status ?? null,
    evidenceClass,
    hasAnyDiagnosticSurface: hasCodegenDumpOutput || irDumpSurface || nativeDumpComplete || codegenMarkerCount > 0,
    selectedRowIdentityStatus: outcome.selectedRowIdentityStatus ?? summary.selectedRowIdentityStatus ?? null,
    requirements,
    unmetRequirements,
    declaresClosure,
    qualifiedClosure,
  };
}

function createFindings(report) {
  const findings = [
    {
      id: 'spidermonkey-codegen-closure-matrix',
      classification: 'SCOPE_GUARD',
      summary: 'SpiderMonkey diagnostic/codegen artifacts are classified through the same-contract closure matrix before they can close codegen-traces-open.',
      evidence: [
        `candidates=${report.summary.candidateCount}`,
        `qualifiedClosures=${report.summary.qualifiedClosureCount}`,
      ],
    },
  ];
  if (report.summary.qualifiedClosureCount === 0) {
    findings.push({
      id: 'spidermonkey-codegen-closure-not-met',
      classification: 'NEGATIVE_RESULT',
      summary: 'No current SpiderMonkey diagnostic/codegen artifact satisfies emitted-codegen, unchanged StAX, selected-row metadata, and closing-metadata requirements together.',
      evidence: [
        `emittedCodegenSurface=${report.summary.emittedCodegenSurfaceCount}`,
        `sameContractStaxRows=${report.summary.sameContractStaxRowCount}`,
        `unchangedRunnable=${report.summary.unchangedRunnableCount}`,
      ],
    });
  }
  return findings;
}

function renderMarkdown(report) {
  const lines = [
    '# SpiderMonkey Codegen Closure Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Candidates checked: ${report.summary.candidateCount}`,
    `- Diagnostic/codegen surface candidates: ${report.summary.diagnosticSurfaceCount}`,
    `- Emitted-codegen surface count: ${report.summary.emittedCodegenSurfaceCount}`,
    `- Same-contract StAX row count: ${report.summary.sameContractStaxRowCount}`,
    `- Unchanged runnable count: ${report.summary.unchangedRunnableCount}`,
    `- Selected row metadata count: ${report.summary.selectedRowMetadataCount}`,
    `- Closing metadata count: ${report.summary.closingMetadataCount}`,
    `- Qualified closures: ${report.summary.qualifiedClosureCount}`,
    `- Contradicted closure claims: ${report.summary.contradictedClosureClaimCount}`,
    `- Conclusion allowed: ${report.summary.conclusionAllowed ? 'yes' : 'no'}`,
    '',
    '## Closure Matrix',
    '',
    '| Artifact | Evidence class | Diagnostic surface | Same StAX row | Unchanged runnable | Row metadata | Closing metadata | Allowed class | Qualified | Missing |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const candidate of report.candidates) {
    lines.push([
      `| \`${candidate.sourceArtifact}\``,
      candidate.evidenceClass ?? 'unknown',
      yesNo(candidate.requirements.emittedCodegenSurface.met),
      yesNo(candidate.requirements.sameContractStaxRow.met),
      yesNo(candidate.requirements.unchangedRunnable.met),
      yesNo(candidate.requirements.selectedRowMetadata.met),
      yesNo(candidate.requirements.closingMetadata.met),
      yesNo(candidate.requirements.evidenceClassAllowed.met),
      yesNo(candidate.qualifiedClosure),
      candidate.unmetRequirements.length ? candidate.unmetRequirements.join(', ') : 'none',
      '|',
    ].join(' | '));
  }
  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence ?? []) lines.push(`  - ${evidence}`);
  }
  return `${lines.join('\n')}\n`;
}

function readArtifact(releaseDir, file) {
  return {
    sourceArtifact: file,
    root: JSON.parse(readFileSync(join(releaseDir, file), 'utf8')),
  };
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

function hasSpiderMonkeyRuntimeBuildIdentity(root) {
  if (root?.outcome?.runtimeBuildIdentityRecorded === true) return true;
  const provenance = root?.shell?.provenance ?? {};
  const buildId = firstString(
    provenance.buildId,
    provenance.targetTxt?.buildId,
    provenance.buildhub?.buildId,
  );
  const sourceRevision = firstString(
    provenance.sourceRevision,
    provenance.targetTxt?.sourceRevision,
    provenance.buildhub?.sourceRevision,
  );
  return Boolean(buildId && sourceRevision);
}

function hasSpiderMonkeyDiagnosticFlags(root) {
  if (root?.outcome?.diagnosticFlagsRecorded === true) return true;
  return getSpiderMonkeyCodegenProbes(root).some(probe => {
    const flags = probe?.flags;
    return typeof flags === 'string'
      ? flags.length > 0
      : Array.isArray(flags) && flags.length > 0;
  });
}

function hasSpiderMonkeyEmittedDumpMetadata(root, outcome) {
  if (outcome?.emittedDumpMetadataRecorded === true) return true;
  return outcome?.hasCodegenDumpOutput === true
    && getSpiderMonkeyCodegenProbes(root).some(hasPositiveSpiderMonkeyCodegenProbe);
}

function getSpiderMonkeyCodegenProbes(root) {
  const shell = root?.shell ?? {};
  return [
    shell.codegenProbe,
    shell.xmlCodegenProbe,
    shell.materializedCodegenProbe,
  ].filter(Boolean);
}

function hasPositiveSpiderMonkeyCodegenProbe(probe) {
  const status = typeof probe.status === 'string' ? probe.status : '';
  const emittedStatus = /codegen-output-emitted$/.test(status);
  const positiveOutputBytes = typeof probe.outputBytes === 'number' && probe.outputBytes > 0;
  const positiveCodegenMarkers = typeof probe.codegenMarkerCount === 'number' && probe.codegenMarkerCount > 0;
  const positiveIonMarkers = typeof probe.ionScriptMarkerCount === 'number' && probe.ionScriptMarkerCount > 0;
  const positiveAssemblyMnemonics = typeof probe.assemblyMnemonicCount === 'number' && probe.assemblyMnemonicCount > 0;
  return emittedStatus
    && (
      positiveCodegenMarkers
      || positiveIonMarkers
      || positiveAssemblyMnemonics
      || positiveOutputBytes
    );
}

function inferEvidenceClass(sourceArtifact, outcome) {
  if (/availability-audit/.test(sourceArtifact)) return 'availability-only';
  if (/buildconfig|source-pin/.test(sourceArtifact)) return 'source-pin-only';
  if (/diagnostic-dump/.test(sourceArtifact) && outcome?.status === 'no-dump-emitted') return 'negative-diagnostic-surface';
  if (/archival/.test(sourceArtifact)) return 'archival-codegen-scope-guard';
  if (/materialized-codegen/.test(sourceArtifact)) return 'current-debug-materialized-codegen-scope-guard';
  if (/xml-codegen/.test(sourceArtifact)) return 'current-debug-xml-codegen-scope-guard';
  if (/codegen/.test(sourceArtifact)) return 'current-debug-codegen-scope-guard';
  return 'unknown';
}

function yesNo(value) {
  return value ? 'yes' : 'no';
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function pathToFileUrl(filePath) {
  return filePath ? `file:///${resolve(filePath).replace(/\\/g, '/')}` : '';
}

if (import.meta.url === pathToFileUrl(process.argv[1])) main();
