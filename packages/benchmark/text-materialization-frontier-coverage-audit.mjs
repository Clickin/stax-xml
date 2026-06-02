import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultComparisonJson = resolve(__dirname, 'results', 'release', 'same-contract-runtime-comparison.json');
const defaultFrontierJson = resolve(__dirname, 'results', 'release', 'text-materialization-frontier.json');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'text-materialization-frontier-coverage-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'text-materialization-frontier-coverage-audit.md');
const targetMiBPerSec = 200;

const requiredCandidateGroups = [
  {
    group: 'text-cache-negative-stability',
    cases: ['rawFrameNameIdTextCache'],
  },
  {
    group: 'offset-text-cache-negative',
    cases: ['rawFrameNameIdOffsetTextCache'],
  },
  {
    group: 'long-ascii-text-negative-stability',
    cases: ['rawFrameNameIdLongAsciiText'],
  },
  {
    group: 'medium-ascii-text-negative',
    cases: ['rawFrameNameIdMediumAsciiText'],
  },
  {
    group: 'unrolled-medium-ascii-text-negative',
    cases: ['rawFrameNameIdUnrolledMediumAsciiText'],
  },
  {
    group: 'medium-ascii-attr-value-negative',
    cases: ['rawFrameNameIdMediumAsciiAttrValue'],
  },
  {
    group: 'attr-value-cache-negative',
    cases: ['rawFrameNameIdAttrValueCache', 'rawFrameStringCache'],
  },
  {
    group: 'bun-cache-candidates-books-corpus',
    cases: [
      'rawFrameNameIdAttrValueCache',
      'rawFrameNameIdOffsetTextCache',
      'rawFrameNameIdUnrolledMediumAsciiText',
    ],
  },
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    comparisonJson: defaultComparisonJson,
    frontierJson: defaultFrontierJson,
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
      case '--frontier-json':
        options.frontierJson = resolve(process.cwd(), readValue());
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
  const comparison = readJson(options.comparisonJson, 'same-contract-runtime-comparison');
  const frontier = readJson(options.frontierJson, 'text-materialization-frontier');
  const report = createReport({ options, comparison, frontier });
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`text-materialization-frontier-coverage-audit: status=${report.summary.status} missing=${report.summary.missingCandidateCount}`);
  if (report.summary.missingCandidateCount > 0) {
    process.exitCode = 1;
  }
}

function readJson(filePath, expectedObjective) {
  if (!existsSync(filePath)) {
    throw new Error(`missing JSON: ${filePath}`);
  }
  const artifact = JSON.parse(readFileSync(filePath, 'utf8'));
  if (artifact.objective !== expectedObjective) {
    throw new Error(`expected ${expectedObjective} JSON, got ${artifact.objective ?? 'unknown'}`);
  }
  return artifact;
}

function createReport({ options, comparison, frontier }) {
  const frontierKeys = createFrontierKeySet(frontier);
  const rows = comparison.rows ?? comparison.comparisonRows ?? [];
  const groups = requiredCandidateGroups.map(spec => summarizeRequiredGroup(spec, rows, frontierKeys));
  const missingCandidates = groups.flatMap(group => group.candidates.filter(candidate => !candidate.coveredByFrontier));
  const coveredCandidates = groups.flatMap(group => group.candidates.filter(candidate => candidate.coveredByFrontier));
  const crossingCandidates = coveredCandidates.filter(candidate => candidate.mibPerSec >= targetMiBPerSec);
  const summary = {
    status: missingCandidates.length === 0 ? 'classified' : 'coverage-gap',
    targetMiBPerSec,
    comparisonGeneratedAt: comparison.generatedAt ?? null,
    frontierGeneratedAt: frontier.generatedAt ?? null,
    requiredGroupCount: groups.length,
    requiredCandidateCount: groups.reduce((sum, group) => sum + group.candidates.length, 0),
    coveredCandidateCount: coveredCandidates.length,
    missingCandidateCount: missingCandidates.length,
    coveredCandidatesCrossTarget: crossingCandidates.length,
    frontierNegativeCandidateCount: frontier.summary?.negativeCandidateCount ?? null,
    frontierFullParityNegativeCandidateCount: frontier.summary?.fullParityNegativeCandidateCount ?? null,
    conclusionAllowed: false,
  };
  return {
    generatedAt: new Date().toISOString(),
    objective: 'text-materialization-frontier-coverage-audit',
    contract: 'same-contract-materialization-negative-coverage',
    note: 'Checks that selected same-contract materialization negative/cache candidate groups from the runtime comparison are represented in text-materialization-frontier negativeRows.',
    inputs: {
      comparisonJson: options.comparisonJson,
      comparisonGeneratedAt: comparison.generatedAt ?? null,
      frontierJson: options.frontierJson,
      frontierGeneratedAt: frontier.generatedAt ?? null,
    },
    summary,
    requiredGroups: groups,
    missingCandidates,
    findings: createFindings(summary, groups),
  };
}

function createFrontierKeySet(frontier) {
  return new Set((frontier.negativeRows ?? []).map(row => `${row.sourceArtifact}:${row.candidate.id}`));
}

function summarizeRequiredGroup(spec, rows, frontierKeys) {
  const groupRows = rows.filter(row => row.group === spec.group);
  const candidates = spec.cases.map(caseId => {
    const row = groupRows.find(entry => entry.caseId === caseId) ?? null;
    const sourceArtifact = row?.sourceArtifact ?? groupRows[0]?.sourceArtifact ?? null;
    const key = sourceArtifact ? `${sourceArtifact}:${caseId}` : null;
    return {
      group: spec.group,
      sourceArtifact,
      caseId,
      runtime: row?.runtimeId ? { id: row.runtimeId } : null,
      rowPresentInComparison: Boolean(row),
      fullStringParity: row?.fullStringParity ?? null,
      boundedMemory: row?.boundedMemory ?? null,
      mibPerSec: round(row?.mibPerSec ?? null),
      coveredByFrontier: Boolean(key && frontierKeys.has(key)),
      belowTarget: typeof row?.mibPerSec === 'number' ? row.mibPerSec < targetMiBPerSec : null,
    };
  });
  return {
    group: spec.group,
    sourceArtifacts: uniqueNonEmpty(groupRows.map(row => row.sourceArtifact)),
    comparisonRowCount: groupRows.length,
    requiredCaseIds: spec.cases,
    candidates,
  };
}

function createFindings(summary, groups) {
  return [
    {
      id: 'required-materialization-candidates-covered',
      classification: summary.missingCandidateCount === 0 ? 'SOURCE_FACT' : 'COVERAGE_GAP',
      summary: `${summary.coveredCandidateCount}/${summary.requiredCandidateCount} required materialization negative candidates are represented in the text frontier.`,
      evidence: groups.map(group => `${group.group}: ${group.candidates.filter(candidate => candidate.coveredByFrontier).length}/${group.candidates.length}`),
    },
    {
      id: 'covered-candidates-remain-below-target',
      classification: 'NEGATIVE_RESULT',
      summary: `${summary.coveredCandidatesCrossTarget} covered required candidates cross ${targetMiBPerSec} MiB/s.`,
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Text Materialization Frontier Coverage Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Status: ${report.summary.status}`,
    `- Required groups: ${report.summary.requiredGroupCount}`,
    `- Required candidates: ${report.summary.requiredCandidateCount}`,
    `- Covered candidates: ${report.summary.coveredCandidateCount}`,
    `- Missing candidates: ${report.summary.missingCandidateCount}`,
    `- Covered candidates crossing ${targetMiBPerSec} MiB/s: ${report.summary.coveredCandidatesCrossTarget}`,
    `- Frontier negative candidates: ${report.summary.frontierNegativeCandidateCount}`,
    `- Frontier full-parity negative candidates: ${report.summary.frontierFullParityNegativeCandidateCount}`,
    '',
    '## Required Groups',
    '',
    '| Group | Cases | Covered | Missing |',
    '| --- | ---: | ---: | ---: |',
    ...report.requiredGroups.map(group => {
      const covered = group.candidates.filter(candidate => candidate.coveredByFrontier).length;
      return `| \`${group.group}\` | ${group.candidates.length} | ${covered} | ${group.candidates.length - covered} |`;
    }),
    '',
    '## Findings',
    '',
    '| ID | Classification | Summary |',
    '| --- | --- | --- |',
    ...report.findings.map(finding => `| \`${finding.id}\` | ${finding.classification} | ${finding.summary} |`),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function uniqueNonEmpty(values) {
  return [...new Set(values.filter(value => typeof value === 'string' && value.length > 0))].sort();
}

function round(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

main();
