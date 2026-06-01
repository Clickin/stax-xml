import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultReleaseDir = resolve(__dirname, 'results', 'release');
const defaultJsonOut = resolve(defaultReleaseDir, 'spidermonkey-codegen-rerun-stability-audit.json');
const defaultMdOut = resolve(defaultReleaseDir, 'spidermonkey-codegen-rerun-stability-audit.md');

const defaultInputs = {
  baselineCodegen: resolve(defaultReleaseDir, 'spidermonkey-taskcluster-debug-jsshell-codegen-audit.json'),
  rerunCodegen: resolve(defaultReleaseDir, 'spidermonkey-taskcluster-debug-jsshell-codegen-rerun.json'),
  baselineMaterialized: resolve(defaultReleaseDir, 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json'),
  rerunMaterialized: resolve(defaultReleaseDir, 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun.json'),
  closureAudit: resolve(defaultReleaseDir, 'spidermonkey-codegen-closure-audit.json'),
};

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    ...defaultInputs,
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
      case '--baseline-codegen':
        options.baselineCodegen = resolve(process.cwd(), readValue());
        break;
      case '--rerun-codegen':
        options.rerunCodegen = resolve(process.cwd(), readValue());
        break;
      case '--baseline-materialized':
        options.baselineMaterialized = resolve(process.cwd(), readValue());
        break;
      case '--rerun-materialized':
        options.rerunMaterialized = resolve(process.cwd(), readValue());
        break;
      case '--closure-audit':
        options.closureAudit = resolve(process.cwd(), readValue());
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
  console.log(`${report.objective}: reproducible=${report.summary.allReproducible} qualified=${report.summary.qualifiedClosureCount}`);
}

function createReport(options) {
  const sources = Object.fromEntries(Object.entries(defaultInputs).map(([key]) => [key, readJson(options[key])]));
  return buildReport(options, sources);
}

function createSelfTestReport(options) {
  return buildReport(options, {
    baselineCodegen: fixtureCodegen({ artifact: 'baseline-codegen.json', markers: 10 }),
    rerunCodegen: fixtureCodegen({ artifact: 'rerun-codegen.json', markers: 10 }),
    baselineMaterialized: fixtureMaterialized({ artifact: 'baseline-materialized.json', markers: 20, throughput: 0.5 }),
    rerunMaterialized: fixtureMaterialized({ artifact: 'rerun-materialized.json', markers: 20, throughput: 0.45 }),
    closureAudit: {
      objective: 'spidermonkey-codegen-closure-audit',
      summary: {
        candidateCount: 4,
        emittedCodegenSurfaceCount: 4,
        qualifiedClosureCount: 0,
        conclusionAllowed: false,
      },
    },
  });
}

function buildReport(options, sources) {
  const pairs = [
    comparePair({
      id: 'taskcluster-debug-basic-codegen',
      baseline: sources.baselineCodegen,
      rerun: sources.rerunCodegen,
      probeName: 'codegenProbe',
      outputFlag: 'hasCodegenDumpOutput',
    }),
    comparePair({
      id: 'taskcluster-debug-materialized-codegen',
      baseline: sources.baselineMaterialized,
      rerun: sources.rerunMaterialized,
      probeName: 'materializedCodegenProbe',
      outputFlag: 'hasMaterializedStringObjectCodegenOutput',
    }),
  ];
  const allReproducible = pairs.every(pair => pair.reproducibleCodegen === true);
  const sameTaskclusterBuildPairs = pairs.filter(pair => pair.sameTaskclusterBuild).length;
  const sameCodegenMarkerPairs = pairs.filter(pair => pair.sameCodegenMarkerCount).length;
  const allRemainNonClosure = pairs.every(pair => pair.sameContractStaxRow === false && pair.closesEmittedIrObligation === false);
  const closureSummary = sources.closureAudit?.summary ?? {};
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'spidermonkey-codegen-rerun-stability-audit',
    contract: 'spidermonkey-debug-jsshell-codegen-rerun-reproducibility-not-closure',
    note: 'Compares original and rerun Taskcluster debug SpiderMonkey js-shell codegen artifacts. This is reproducibility evidence for emitted JitSpew/codegen diagnostics, not same-contract StAX closure evidence.',
    parameters: {
      baselineCodegen: options.baselineCodegen,
      rerunCodegen: options.rerunCodegen,
      baselineMaterialized: options.baselineMaterialized,
      rerunMaterialized: options.rerunMaterialized,
      closureAudit: options.closureAudit,
      selfTest: options.selfTest,
    },
    pairs,
    closureAudit: {
      objective: sources.closureAudit?.objective ?? null,
      candidateCount: closureSummary.candidateCount ?? null,
      emittedCodegenSurfaceCount: closureSummary.emittedCodegenSurfaceCount ?? null,
      qualifiedClosureCount: closureSummary.qualifiedClosureCount ?? null,
      conclusionAllowed: closureSummary.conclusionAllowed ?? null,
    },
    summary: {
      pairCount: pairs.length,
      reproduciblePairs: pairs.filter(pair => pair.reproducibleCodegen).length,
      sameTaskclusterBuildPairs,
      sameCodegenMarkerPairs,
      allReproducible,
      allRemainNonClosure,
      throughputCountsAsTargetEvidence: false,
      qualifiedClosureCount: closureSummary.qualifiedClosureCount ?? null,
      conclusionAllowed: false,
    },
  };
  report.findings = createFindings(report);
  return report;
}

function comparePair({ id, baseline, rerun, probeName, outputFlag }) {
  const baselineProbe = baseline.shell?.[probeName] ?? {};
  const rerunProbe = rerun.shell?.[probeName] ?? {};
  const baselineMarkers = finiteNumber(baselineProbe.codegenMarkerCount);
  const rerunMarkers = finiteNumber(rerunProbe.codegenMarkerCount);
  const baselineOutput = baseline.outcome?.[outputFlag] === true;
  const rerunOutput = rerun.outcome?.[outputFlag] === true;
  const baselineIdentity = runtimeBuildIdentity(baseline);
  const rerunIdentity = runtimeBuildIdentity(rerun);
  const throughputBaseline = finiteNumber(baselineProbe.payload?.throughputMiBPerSec);
  const throughputRerun = finiteNumber(rerunProbe.payload?.throughputMiBPerSec);
  return {
    id,
    baselineArtifact: baseline.sourceArtifact ?? null,
    rerunArtifact: rerun.sourceArtifact ?? null,
    sameTaskclusterBuild: sameIdentity(baselineIdentity, rerunIdentity),
    taskId: rerunIdentity.taskId ?? baselineIdentity.taskId,
    buildId: rerunIdentity.buildId ?? baselineIdentity.buildId,
    sourceRevision: rerunIdentity.sourceRevision ?? baselineIdentity.sourceRevision,
    baselineCodegenMarkers: baselineMarkers,
    rerunCodegenMarkers: rerunMarkers,
    sameCodegenMarkerCount: baselineMarkers === rerunMarkers,
    markerRatio: ratio(rerunMarkers, baselineMarkers),
    baselineThroughputMiBPerSec: throughputBaseline,
    rerunThroughputMiBPerSec: throughputRerun,
    throughputRatio: ratio(throughputRerun, throughputBaseline),
    reproducibleCodegen: baselineOutput && rerunOutput && baselineMarkers > 0 && rerunMarkers > 0,
    sameContractStaxRow: baseline.outcome?.sameContractStaxRow === true || rerun.outcome?.sameContractStaxRow === true,
    unchangedStaxBenchmark: baseline.outcome?.unchangedStaxBenchmark === true || rerun.outcome?.unchangedStaxBenchmark === true,
    canRunCurrentStaxFullStringBenchmark: baseline.outcome?.canRunCurrentStaxFullStringBenchmark === true || rerun.outcome?.canRunCurrentStaxFullStringBenchmark === true,
    closesEmittedIrObligation: baseline.outcome?.closesEmittedIrObligation === true || rerun.outcome?.closesEmittedIrObligation === true,
  };
}

function createFindings(report) {
  return [
    {
      id: 'spidermonkey-debug-codegen-rerun-reproduced',
      classification: 'TRACE_FACT',
      summary: 'Taskcluster debug SpiderMonkey js-shell codegen output was reproduced by rerun artifacts.',
      evidence: report.pairs.map(pair => `${pair.id}: reproducibleCodegen=${pair.reproducibleCodegen}, markerRatio=${formatNumber(pair.markerRatio)}`),
    },
    {
      id: 'spidermonkey-debug-rerun-not-same-contract-closure',
      classification: 'NEGATIVE_RESULT',
      summary: 'The reproduced debug js-shell codegen artifacts still do not close the same-contract StAX codegen obligation.',
      evidence: [
        `allRemainNonClosure=${report.summary.allRemainNonClosure}`,
        `qualifiedClosureCount=${report.summary.qualifiedClosureCount ?? 'unknown'}`,
        `throughputCountsAsTargetEvidence=${report.summary.throughputCountsAsTargetEvidence}`,
      ],
    },
    {
      id: 'spidermonkey-debug-rerun-scope',
      classification: 'SCOPE_GUARD',
      summary: 'Rerun reproducibility is diagnostic-surface evidence only; it is not a throughput target row or same-contract StAX closure.',
      evidence: ['sameContractStaxRow=false remains required for non-closure classification.'],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# SpiderMonkey Codegen Rerun Stability Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Pairs checked: ${report.summary.pairCount}`,
    `- Reproducible pairs: ${report.summary.reproduciblePairs}`,
    `- Same Taskcluster build pairs: ${report.summary.sameTaskclusterBuildPairs}`,
    `- Same codegen marker-count pairs: ${report.summary.sameCodegenMarkerPairs}`,
    `- All remain non-closure: ${yesNo(report.summary.allRemainNonClosure)}`,
    `- Throughput counts as target evidence: ${yesNo(report.summary.throughputCountsAsTargetEvidence)}`,
    `- Closure audit qualified closures: ${report.summary.qualifiedClosureCount ?? 'unknown'}`,
    `- Conclusion allowed: ${yesNo(report.summary.conclusionAllowed)}`,
    '',
    '## Pairs',
    '',
    '| Pair | Same build | Markers original | Markers rerun | Same markers | Marker ratio | MiB/s original | MiB/s rerun | MiB/s ratio | Reproduced | Same-contract | Closes |',
    '| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- | --- |',
    ...report.pairs.map(pair =>
      `| \`${pair.id}\` | ${yesNo(pair.sameTaskclusterBuild)} | ${formatNumber(pair.baselineCodegenMarkers)} | ${formatNumber(pair.rerunCodegenMarkers)} | ${yesNo(pair.sameCodegenMarkerCount)} | ${formatNumber(pair.markerRatio)} | ${formatNumber(pair.baselineThroughputMiBPerSec)} | ${formatNumber(pair.rerunThroughputMiBPerSec)} | ${formatNumber(pair.throughputRatio)} | ${yesNo(pair.reproducibleCodegen)} | ${yesNo(pair.sameContractStaxRow)} | ${yesNo(pair.closesEmittedIrObligation)} |`
    ),
    '',
    '## Findings',
    '',
    ...report.findings.map(finding => `- ${finding.classification}: ${finding.summary}`),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function fixtureCodegen({ artifact, markers }) {
  return {
    sourceArtifact: artifact,
    outcome: {
      hasCodegenDumpOutput: true,
      sameContractStaxRow: false,
      canRunCurrentStaxFullStringBenchmark: false,
      closesEmittedIrObligation: false,
    },
    shell: {
      provenance: { taskId: 'task', buildId: '20260601000000', sourceRevision: 'revision' },
      codegenProbe: { codegenMarkerCount: markers },
    },
  };
}

function fixtureMaterialized({ artifact, markers, throughput }) {
  return {
    sourceArtifact: artifact,
    outcome: {
      hasMaterializedStringObjectCodegenOutput: true,
      sameContractStaxRow: false,
      unchangedStaxBenchmark: false,
      canRunCurrentStaxFullStringBenchmark: false,
      closesEmittedIrObligation: false,
    },
    shell: {
      provenance: { taskId: 'task', buildId: '20260601000000', sourceRevision: 'revision' },
      materializedCodegenProbe: {
        codegenMarkerCount: markers,
        payload: { throughputMiBPerSec: throughput },
      },
    },
  };
}

function readJson(filePath) {
  if (!existsSync(filePath)) throw new Error(`Missing input JSON: ${filePath}`);
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function finiteNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function ratio(numerator, denominator) {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0
    ? round(numerator / denominator)
    : null;
}

function runtimeBuildIdentity(artifact) {
  const provenance = artifact.shell?.provenance ?? {};
  return {
    taskId: provenance.taskId ?? null,
    buildId: provenance.buildId ?? provenance.targetTxt?.buildId ?? provenance.buildhub?.buildId ?? null,
    sourceRevision: provenance.sourceRevision ?? provenance.targetTxt?.sourceRevision ?? provenance.buildhub?.sourceRevision ?? null,
  };
}

function sameIdentity(left, right) {
  return Boolean(
    left.taskId
    && right.taskId
    && left.taskId === right.taskId
    && left.buildId
    && right.buildId
    && left.buildId === right.buildId
    && left.sourceRevision
    && right.sourceRevision
    && left.sourceRevision === right.sourceRevision
  );
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(2) : 'n/a';
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
