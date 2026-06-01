import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultComparisonJson = resolve(__dirname, 'results', 'release', 'same-contract-runtime-comparison.json');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'target-distance-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'target-distance-audit.md');

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
  console.log(`target-distance-audit: status=${report.summary.status} woodstoxTargetMet=${report.summary.sameFixture1024MiBWoodstoxTarget.targetMet}`);
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
  const summary = comparison.summary ?? {};
  const woodstoxTarget = summary.sameFixture1024MiBWoodstoxTarget;
  const quickXmlTarget = summary.sameFixture1024MiBQuickXmlTarget;
  const externalBaseline = summary.externalBaseline1024MiBFileSyncBatches;
  const processRss = summary.sameFixture1024MiBProcessRssSnapshot;
  const fastestComparableJsRow = findFastestComparableJsTargetRow(summary.sameFixture1024MiBTargetRows, woodstoxTarget);
  const sharedFastestJsTargetRow = targetsShareFastestJsRow(woodstoxTarget, quickXmlTarget);
  if (!woodstoxTarget || !quickXmlTarget || !externalBaseline) {
    throw new Error('same-contract comparison JSON does not contain required target-distance summaries');
  }
  const fastestComparableJsContract = summarizeComparableJsTargetRow(fastestComparableJsRow);
  const fastestComparableJsContractOk = fastestComparableJsContract
    && fastestComparableJsContract.sourceMode === 'file-backed-sync-iterable-byte-batches'
    && fastestComparableJsContract.directReadableStream === false
    && fastestComparableJsContract.fullArrayBufferParserInput === false
    && fastestComparableJsContract.boundedMemory === true
    && fastestComparableJsContract.memoryKind === 'process-rss'
    && typeof fastestComparableJsContract.maxRssMiB === 'number'
    && fastestComparableJsContract.maxRssMiB < 128;

  const status = woodstoxTarget.targetMet === false
    && quickXmlTarget.targetMet === false
    && typeof woodstoxTarget.remainingTo90PercentMiBPerSec === 'number'
    && typeof quickXmlTarget.remainingTo90PercentMiBPerSec === 'number'
    && sharedFastestJsTargetRow
    && fastestComparableJsContractOk
    ? 'classified'
    : 'partial';

  return {
    generatedAt: new Date().toISOString(),
    objective: 'target-distance-audit',
    contract: 'woodstox-and-quickxml-0.9x-target-distance',
    note: 'Audits the distance from current same-contract JavaScript rows to Woodstox and quick-xml targets. This is not a benchmark run, not object-shape equivalence, and not a JavaScript runtime ceiling proof.',
    inputs: {
      comparisonJson: options.comparisonJson,
      comparisonGeneratedAt: comparison.generatedAt ?? null,
      comparisonObjective: comparison.objective,
      comparisonContract: comparison.contract,
    },
    summary: {
      status,
      sameFixture1024MiBWoodstoxTarget: summarizeWoodstoxTarget(woodstoxTarget),
      sameFixture1024MiBQuickXmlTarget: summarizeQuickXmlTarget(quickXmlTarget),
      sharedFastestJsTargetRow,
      sameFixtureFastestJsContract: fastestComparableJsContract,
      externalBaseline1024MiBFileSyncBatches: summarizeExternalBaseline(externalBaseline),
      sameFixture1024MiBProcessRssSnapshot: summarizeProcessRssSnapshot(processRss),
      conclusionAllowed: false,
    },
    quickXmlTargetRows: (summary.sameFixture1024MiBQuickXmlTargetRows ?? []).map(summarizeQuickXmlTargetRow),
    findings: createFindings(woodstoxTarget, quickXmlTarget, externalBaseline, fastestComparableJsContractOk, sharedFastestJsTargetRow),
  };
}

function targetsShareFastestJsRow(woodstoxTarget, quickXmlTarget) {
  if (!woodstoxTarget || !quickXmlTarget) return false;
  return woodstoxTarget.group === quickXmlTarget.group
    && woodstoxTarget.sourceArtifact === quickXmlTarget.sourceArtifact
    && woodstoxTarget.fastestJsCaseId === quickXmlTarget.fastestJsCaseId
    && woodstoxTarget.fastestJsMiBPerSec === quickXmlTarget.fastestJsMiBPerSec;
}

function findFastestComparableJsTargetRow(targetRows, target) {
  if (!Array.isArray(targetRows) || !target) return null;
  return targetRows.find(row =>
    row.group === target.group
    && row.fastestJs?.caseId === target.fastestJsCaseId
    && row.fastestJs?.sourceArtifact === target.sourceArtifact
  )?.fastestJs ?? null;
}

function summarizeWoodstoxTarget(target) {
  return {
    group: target.group,
    sourceArtifact: target.sourceArtifact,
    fastestJsCaseId: target.fastestJsCaseId,
    fastestJsRateMiBPerSec: target.fastestJsMiBPerSec,
    woodstoxSourceArtifact: target.woodstoxSourceArtifact,
    woodstoxRateMiBPerSec: target.woodstoxMiBPerSec,
    target90MiBPerSec: target.target90MiBPerSec,
    fastestJsWoodstoxRatio: target.fastestJsWoodstoxRatio,
    remainingTo90PercentMiBPerSec: target.remainingTo90PercentMiBPerSec,
    targetMet: target.targetMet,
  };
}

function summarizeQuickXmlTarget(target) {
  return {
    group: target.group,
    sourceArtifact: target.sourceArtifact,
    fastestJsCaseId: target.fastestJsCaseId,
    fastestJsRateMiBPerSec: target.fastestJsMiBPerSec,
    quickXmlSourceArtifact: target.quickXmlSourceArtifact,
    quickXmlRateMiBPerSec: target.quickXmlMiBPerSec,
    target90MiBPerSec: target.target90MiBPerSec,
    fastestJsQuickXmlRatio: target.fastestJsQuickXmlRatio,
    remainingTo90PercentMiBPerSec: target.remainingTo90PercentMiBPerSec,
    targetMet: target.targetMet,
  };
}

function summarizeComparableJsTargetRow(row) {
  if (!row) return null;
  return {
    group: row.group,
    sourceArtifact: row.sourceArtifact,
    runtimeLabel: row.runtimeLabel,
    caseId: row.caseId,
    rateMiBPerSec: row.mibPerSec,
    sourceMode: row.sourceMode ?? null,
    directReadableStream: row.directReadableStream ?? null,
    fullArrayBufferParserInput: row.fullArrayBufferParserInput ?? null,
    boundedMemory: row.boundedMemory === true,
    memoryKind: row.memory?.primaryKind ?? null,
    maxRssMiB: row.memory?.maxMiB ?? null,
    maxHeapUsedMiB: row.memory?.maxHeapUsedMiB ?? null,
    maxExternalMiB: row.memory?.maxExternalMiB ?? null,
    maxArrayBuffersMiB: row.memory?.maxArrayBuffersMiB ?? null,
  };
}

function summarizeExternalBaseline(baseline) {
  return {
    staxStreamRateMiBPerSec: baseline.staxStreamMiBPerSec,
    staxStreamWoodstoxRatio: baseline.staxStreamWoodstoxRatio,
    rawFrameNameIdRateMiBPerSec: baseline.rawFrameNameIdMiBPerSec,
    rawFrameNameIdWoodstoxRatio: baseline.rawFrameNameIdWoodstoxRatio,
    woodstoxRateMiBPerSec: baseline.woodstoxMiBPerSec,
    quickXmlRateMiBPerSec: baseline.quickXmlMiBPerSec,
    quickXmlWoodstoxRatio: baseline.quickXmlWoodstoxRatio,
    target90MiBPerSec: baseline.target90MiBPerSec,
  };
}

function summarizeProcessRssSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    caveat: snapshot.caveat,
    fastestJs: summarizeRssRow(snapshot.fastestJs),
    woodstox: summarizeRssRow(snapshot.woodstox),
    quickXml: summarizeRssRow(snapshot.quickXml),
  };
}

function summarizeRssRow(row) {
  if (!row) return null;
  return {
    runtimeLabel: row.runtimeLabel,
    caseId: row.caseId,
    sourceArtifact: row.sourceArtifact,
    rateMiBPerSec: row.mibPerSec,
    memoryKind: row.memoryKind,
    maxRssMiB: row.maxRssMiB,
  };
}

function summarizeQuickXmlTargetRow(row) {
  return {
    group: row.group,
    fastestJsCaseId: row.fastestJs?.caseId ?? null,
    fastestJsRateMiBPerSec: row.fastestJs?.mibPerSec ?? null,
    quickXmlSourceArtifact: row.quickXmlReference?.sourceArtifact ?? null,
    quickXmlRateMiBPerSec: row.quickXmlReference?.mibPerSec ?? null,
    quickXml90MiBPerSec: row.quickXml90MiBPerSec,
    jsQuickXmlRatio: row.jsQuickXmlRatio,
    remainingTo90PercentMiBPerSec: row.remainingTo90PercentMiBPerSec,
    targetMet: row.targetMet,
    caveat: row.caveat,
  };
}

function createFindings(woodstoxTarget, quickXmlTarget, externalBaseline, fastestComparableJsContractOk, sharedFastestJsTargetRow) {
  return [
    {
      id: 'woodstox-0-9x-target-not-met',
      classification: 'SOURCE_FACT',
      summary: `Current fastest same-fixture JavaScript row is ${woodstoxTarget.remainingTo90PercentMiBPerSec} MiB/s below the Woodstox 0.9x target.`,
    },
    {
      id: 'quickxml-0-9x-target-not-met',
      classification: 'SOURCE_FACT',
      summary: `Current fastest same-fixture JavaScript row is ${quickXmlTarget.remainingTo90PercentMiBPerSec} MiB/s below the quick-xml 0.9x target.`,
    },
    {
      id: 'external-baseline-separate-from-candidate-target',
      classification: 'SOURCE_FACT',
      summary: `The 1024 MiB external baseline keeps stax-stream, rawFrameNameId, Woodstox, and quick-xml rows visible separately from later same-fixture candidate targets.`,
    },
    {
      id: 'same-fixture-targets-share-js-row',
      classification: sharedFastestJsTargetRow ? 'SOURCE_FACT' : 'HYPOTHESIS',
      summary: sharedFastestJsTargetRow
        ? 'Woodstox and quick-xml 0.9x target distances use the same fastest JavaScript baseline row.'
        : 'Woodstox and quick-xml 0.9x target distances do not use the same fastest JavaScript baseline row.',
    },
    {
      id: 'same-fixture-fastest-js-contract-classified',
      classification: fastestComparableJsContractOk ? 'SOURCE_FACT' : 'HYPOTHESIS',
      summary: fastestComparableJsContractOk
        ? 'The same-fixture fastest JavaScript target row is file-backed synchronous Iterable<Uint8Array[]> input, not direct ReadableStream, not full ArrayBuffer parser input, and bounded under process RSS.'
        : 'The same-fixture fastest JavaScript target row is missing or does not satisfy the expected source/memory contract.',
    },
    {
      id: 'target-distance-not-runtime-ceiling',
      classification: 'SOURCE_FACT',
      summary: 'A target-distance deficit is not proof that JavaScript runtimes have no further headroom.',
    },
  ];
}

function renderMarkdown(report) {
  const woodstox = report.summary.sameFixture1024MiBWoodstoxTarget;
  const quickXml = report.summary.sameFixture1024MiBQuickXmlTarget;
  const fastestJsContract = report.summary.sameFixtureFastestJsContract;
  const external = report.summary.externalBaseline1024MiBFileSyncBatches;
  const rss = report.summary.sameFixture1024MiBProcessRssSnapshot;
  const lines = [
    '# Target Distance Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Status: ${report.summary.status}`,
    `- Source artifact: ${report.inputs.comparisonJson}`,
    `- Same-fixture JS row: \`${woodstox.fastestJsCaseId}\` ${formatNumber(woodstox.fastestJsRateMiBPerSec)} MiB/s`,
    `- Woodstox and quick-xml target rows share JS baseline: ${formatBoolean(report.summary.sharedFastestJsTargetRow)}`,
    `- Same-fixture JS source/memory contract: ${formatComparableJsTargetRow(fastestJsContract)}`,
    `- Woodstox target: ${formatNumber(woodstox.woodstoxRateMiBPerSec)} MiB/s; 0.9x target ${formatNumber(woodstox.target90MiBPerSec)} MiB/s; JS ratio ${formatNumber(woodstox.fastestJsWoodstoxRatio)}x; remaining ${formatNumber(woodstox.remainingTo90PercentMiBPerSec)} MiB/s; targetMet=${woodstox.targetMet}`,
    `- quick-xml target: ${formatNumber(quickXml.quickXmlRateMiBPerSec)} MiB/s; 0.9x target ${formatNumber(quickXml.target90MiBPerSec)} MiB/s; JS ratio ${formatNumber(quickXml.fastestJsQuickXmlRatio)}x; remaining ${formatNumber(quickXml.remainingTo90PercentMiBPerSec)} MiB/s; targetMet=${quickXml.targetMet}`,
    '',
    '## External 1024 MiB Baseline',
    '',
    `- stax-stream: ${formatNumber(external.staxStreamRateMiBPerSec)} MiB/s (${formatNumber(external.staxStreamWoodstoxRatio)}x Woodstox)`,
    `- rawFrameNameId: ${formatNumber(external.rawFrameNameIdRateMiBPerSec)} MiB/s (${formatNumber(external.rawFrameNameIdWoodstoxRatio)}x Woodstox)`,
    `- Woodstox: ${formatNumber(external.woodstoxRateMiBPerSec)} MiB/s`,
    `- quick-xml: ${formatNumber(external.quickXmlRateMiBPerSec)} MiB/s (${formatNumber(external.quickXmlWoodstoxRatio)}x Woodstox)`,
    `- 0.9x Woodstox target: ${formatNumber(external.target90MiBPerSec)} MiB/s`,
    '',
    '## quick-xml Target Rows',
    '',
    '| Group | JS row | JS MiB/s | quick-xml artifact | quick-xml MiB/s | 0.9x MiB/s | Remaining | Target met | Caveat |',
    '| --- | --- | ---: | --- | ---: | ---: | ---: | --- | --- |',
    ...report.quickXmlTargetRows.map(quickXmlTargetRowMarkdown),
    '',
    '## Same-Fixture Process RSS Snapshot',
    '',
  ];

  if (rss) {
    lines.push(
      `- Caveat: ${rss.caveat}`,
      `- JavaScript: ${formatRssRow(rss.fastestJs)}`,
      `- Woodstox: ${formatRssRow(rss.woodstox)}`,
      `- quick-xml: ${formatRssRow(rss.quickXml)}`,
      '',
    );
  }

  lines.push(
    '## Findings',
    '',
    '| ID | Classification | Summary |',
    '| --- | --- | --- |',
    ...report.findings.map(finding => `| \`${finding.id}\` | ${finding.classification} | ${finding.summary} |`),
    '',
  );

  return `${lines.join('\n')}\n`;
}

function quickXmlTargetRowMarkdown(row) {
  return `| \`${row.group}\` | \`${row.fastestJsCaseId}\` | ${formatNumber(row.fastestJsRateMiBPerSec)} | \`${row.quickXmlSourceArtifact}\` | ${formatNumber(row.quickXmlRateMiBPerSec)} | ${formatNumber(row.quickXml90MiBPerSec)} | ${formatNumber(row.remainingTo90PercentMiBPerSec)} | ${row.targetMet ? 'yes' : 'no'} | ${row.caveat ?? ''} |`;
}

function formatRssRow(row) {
  if (!row) return 'none';
  return `${row.runtimeLabel} \`${row.caseId}\` ${formatNumber(row.rateMiBPerSec)} MiB/s, process RSS ${formatNumber(row.maxRssMiB)} MiB from \`${row.sourceArtifact}\``;
}

function formatComparableJsTargetRow(row) {
  if (!row) return 'none';
  return `${row.runtimeLabel} \`${row.caseId}\` ${formatNumber(row.rateMiBPerSec)} MiB/s, sourceMode=${row.sourceMode}, directReadableStream=${formatBoolean(row.directReadableStream)}, fullArrayBufferParserInput=${formatBoolean(row.fullArrayBufferParserInput)}, boundedMemory=${formatBoolean(row.boundedMemory)}, ${row.memoryKind} max ${formatNumber(row.maxRssMiB)} MiB`;
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
