import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultComparisonJson = resolve(__dirname, 'results', 'release', 'same-contract-runtime-comparison.json');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'text-materialization-boundary-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'text-materialization-boundary-audit.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
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
  const comparison = readComparison(options.comparisonJson);
  const report = createReport(comparison, options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`text-materialization-boundary-audit: status=${report.summary.status} fullRowsCrossTarget=${report.summary.fullRowsCrossTarget}`);
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

function createReport(comparison, options) {
  const frontier = comparison.summary?.textMaterializationFrontier;
  if (!frontier) {
    throw new Error('same-contract comparison JSON does not contain summary.textMaterializationFrontier');
  }

  const status = frontier.fastestFull?.fullStringParity === true
    && frontier.fastestWithoutText?.fullStringParity === false
    && frontier.fullRowsCrossTarget === 0
    && frontier.noTextRowsCrossTarget > 0
    && frontier.noTrimRowsCrossTarget === 0
    && frontier.foldTrimRowsCrossTarget === 0
    ? 'classified'
    : 'partial';

  return {
    generatedAt: new Date().toISOString(),
    objective: 'text-materialization-boundary-audit',
    contract: 'text-cdata-materialization-headroom-is-not-full-string-counterexample',
    note: 'Audits the current text/CDATA materialization boundary from the same-contract aggregate. This is not a benchmark run and does not prove a JavaScript runtime ceiling.',
    inputs: {
      comparisonJson: options.comparisonJson,
      comparisonGeneratedAt: comparison.generatedAt ?? null,
      comparisonObjective: comparison.objective,
      comparisonContract: comparison.contract,
      frontierArtifact: frontier.sourceArtifact,
    },
    summary: {
      status,
      targetMiBPerSec: frontier.targetMiBPerSec,
      fastestFull: summarizeFrontierRow(frontier.fastestFull),
      fastestWithoutText: summarizeFrontierRow(frontier.fastestWithoutText),
      fastestNoTrim: summarizeFrontierRow(frontier.fastestNoTrim),
      fastestFoldTrim: summarizeFrontierRow(frontier.fastestFoldTrim),
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
      conclusionAllowed: false,
    },
    interpretation: frontier.interpretation,
    findings: createFindings(frontier),
  };
}

function summarizeFrontierRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    sourceArtifact: row.sourceArtifact,
    rateMiBPerSec: row.mibPerSec,
    boundedMemory: row.boundedMemory ?? null,
    fullStringParity: row.fullStringParity,
    textStringReads: row.textStringReads ?? null,
    stringFieldReads: row.stringFieldReads ?? null,
  };
}

function createFindings(frontier) {
  return [
    {
      id: 'full-string-target-not-crossed',
      classification: 'SOURCE_FACT',
      summary: `Current full-string rows crossing ${frontier.targetMiBPerSec} MiB/s: ${frontier.fullRowsCrossTarget}.`,
    },
    {
      id: 'without-text-is-partial-headroom',
      classification: 'SOURCE_FACT',
      summary: `Text/CDATA omission crosses the target in ${frontier.noTextRowsCrossTarget} rows but is not full-string parity.`,
    },
    {
      id: 'trim-only-not-counterexample',
      classification: 'SOURCE_FACT',
      summary: `No no-trim or fold-trim row crosses the target under the current frontier.`,
    },
    {
      id: 'negative-candidate-set-recorded',
      classification: 'SOURCE_FACT',
      summary: `${frontier.negativeCandidateCount} text/materialization candidates are recorded as negative or partial frontier evidence.`,
    },
  ];
}

function renderMarkdown(report) {
  const summary = report.summary;
  const lines = [
    '# Text Materialization Boundary Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Status: ${summary.status}`,
    `- Source artifact: ${report.inputs.comparisonJson}`,
    `- Frontier artifact: ${report.inputs.frontierArtifact}`,
    `- Target: ${formatNumber(summary.targetMiBPerSec)} MiB/s`,
    `- Fastest full-string row: ${formatFrontierRow(summary.fastestFull)}`,
    `- Fastest without-text row: ${formatFrontierRow(summary.fastestWithoutText)}`,
    `- Fastest no-trim row: ${formatFrontierRow(summary.fastestNoTrim)}`,
    `- Fastest fold-trim row: ${formatFrontierRow(summary.fastestFoldTrim)}`,
    `- Full-string remaining to target: ${formatNumber(summary.fastestFullRemainingMiBPerSec)} MiB/s`,
    `- Required full-string speedup: ${formatNumber(summary.requiredSpeedupToTarget)}x`,
    `- Without-text to full ratio: ${formatNumber(summary.fastestWithoutTextToFullRatio)}x`,
    `- No-trim to full ratio: ${formatNumber(summary.fastestNoTrimToFullRatio)}x`,
    `- Fold-trim to full ratio: ${formatNumber(summary.fastestFoldTrimToFullRatio)}x`,
    `- Full-string rows crossing target: ${summary.fullRowsCrossTarget}`,
    `- Without-text rows crossing target: ${summary.noTextRowsCrossTarget}`,
    `- No-trim rows crossing target: ${summary.noTrimRowsCrossTarget}`,
    `- Fold-trim rows crossing target: ${summary.foldTrimRowsCrossTarget}`,
    `- Negative candidate count: ${summary.negativeCandidateCount}`,
    '',
    '## Findings',
    '',
    '| ID | Classification | Summary |',
    '| --- | --- | --- |',
    ...report.findings.map(finding => `| \`${finding.id}\` | ${finding.classification} | ${finding.summary} |`),
    '',
    `Interpretation: ${report.interpretation}`,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function formatFrontierRow(row) {
  if (!row) return 'none';
  const textReads = row.textStringReads === null ? 'n/a' : row.textStringReads;
  const fieldReads = row.stringFieldReads === null ? 'n/a' : row.stringFieldReads;
  return `\`${row.id}\` ${formatNumber(row.rateMiBPerSec)} MiB/s from \`${row.sourceArtifact}\` (fullStringParity=${row.fullStringParity}, textStringReads=${textReads}, stringFieldReads=${fieldReads})`;
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function writeOutput(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

main();
