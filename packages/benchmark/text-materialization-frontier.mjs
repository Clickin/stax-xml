import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultReleaseDir = resolve(__dirname, 'results', 'release');
const defaultJsonOut = resolve(defaultReleaseDir, 'text-materialization-frontier.json');
const defaultMdOut = resolve(defaultReleaseDir, 'text-materialization-frontier.md');
const targetMiBPerSec = 200;

const scaledArtifacts = [
  'text-trim-cost-decomposition.json',
  'text-trim-cost-decomposition-2gib.json',
  'text-trim-cost-decomposition-4gib.json',
  'text-trim-cost-decomposition-8gib.json',
];

const negativeArtifacts = [
  {
    file: 'text-cache-materialization-candidate-stability.json',
    controlId: 'rawFrameNameId',
    candidateId: 'rawFrameNameIdTextCache',
    family: 'repeated-text-value-cache',
  },
  {
    file: 'long-ascii-text-materialization-candidate-stability.json',
    controlId: 'rawFrameNameId',
    candidateId: 'rawFrameNameIdLongAsciiText',
    family: 'long-ascii-text-fast-path',
  },
  {
    file: 'fold-trimmed-text-candidate-stability.json',
    controlId: 'rawFrameNameId',
    candidateId: 'rawFrameNameIdFoldTrim',
    family: 'fold-trimmed-text-checksum',
  },
  {
    file: 'text-trim-guard-candidate.json',
    controlId: 'rawFrameNameId',
    candidateId: 'rawFrameNameIdTrimGuard',
    family: 'text-trim-boundary-guard',
  },
  {
    file: 'text-ascii-pretrim-candidate.json',
    controlId: 'rawFrameNameId',
    candidateId: 'rawFrameNameIdAsciiPreTrim',
    family: 'ascii-byte-pretrim-before-decode',
  },
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    releaseDir: defaultReleaseDir,
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
      case '--release-dir':
        options.releaseDir = resolve(process.cwd(), readValue());
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
}

function createReport(options) {
  const scaledReports = scaledArtifacts.map(file => ({ file, report: readReleaseJson(options.releaseDir, file) }));
  const scaledRows = scaledReports.flatMap(({ file, report }) => extractScaledRows(report, file));
  const negativeRows = negativeArtifacts.map(spec => extractNegativeRow(readReleaseJson(options.releaseDir, spec.file), spec));
  const fullRows = scaledRows.filter(row => row.role === 'full');
  const noTextRows = scaledRows.filter(row => row.role === 'without-text');
  const noTrimRows = scaledRows.filter(row => row.role === 'no-trim');
  const foldTrimRows = scaledRows.filter(row => row.role === 'fold-trim');
  const fastestFull = maxBy(fullRows, row => row.mibPerSec);
  const fastestWithoutText = maxBy(noTextRows, row => row.mibPerSec);
  const fastestNoTrim = maxBy(noTrimRows, row => row.mibPerSec);
  const fastestFoldTrim = maxBy(foldTrimRows, row => row.mibPerSec);
  const sameScalePairs = fullRows.map(full => {
    const withoutText = noTextRows.find(row => row.sizeGiB === full.sizeGiB) ?? null;
    const noTrim = noTrimRows.find(row => row.sizeGiB === full.sizeGiB) ?? null;
    const foldTrim = foldTrimRows.find(row => row.sizeGiB === full.sizeGiB) ?? null;
    return {
      sizeGiB: full.sizeGiB,
      sourceArtifact: full.sourceArtifact,
      full: summarizeRow(full),
      withoutText: summarizeRow(withoutText),
      noTrim: summarizeRow(noTrim),
      foldTrim: summarizeRow(foldTrim),
      withoutTextSpeedup: ratio(withoutText?.mibPerSec, full.mibPerSec),
      noTrimSpeedup: ratio(noTrim?.mibPerSec, full.mibPerSec),
      foldTrimSpeedup: ratio(foldTrim?.mibPerSec, full.mibPerSec),
      omittedTextStringReads: (full.counters?.textStringReads ?? null) !== null && withoutText?.counters
        ? full.counters.textStringReads - withoutText.counters.textStringReads
        : null,
      fullTextStringReads: full.counters?.textStringReads ?? null,
    };
  });
  const summary = {
    targetMiBPerSec,
    scaledArtifactCount: scaledArtifacts.length,
    fullRowCount: fullRows.length,
    nearFullWithoutTextRowCount: noTextRows.length,
    negativeCandidateCount: negativeRows.length,
    fastestFull: summarizeRow(fastestFull),
    fastestWithoutText: summarizeRow(fastestWithoutText),
    fastestNoTrim: summarizeRow(fastestNoTrim),
    fastestFoldTrim: summarizeRow(fastestFoldTrim),
    fastestFullToTargetRatio: ratio(fastestFull?.mibPerSec, targetMiBPerSec),
    fastestFullRemainingMiBPerSec: round(targetMiBPerSec - fastestFull.mibPerSec),
    requiredSpeedupToTarget: ratio(targetMiBPerSec, fastestFull?.mibPerSec),
    fastestWithoutTextToFullRatio: ratio(fastestWithoutText?.mibPerSec, fastestFull?.mibPerSec),
    fastestNoTrimToFullRatio: ratio(fastestNoTrim?.mibPerSec, fastestFull?.mibPerSec),
    fastestFoldTrimToFullRatio: ratio(fastestFoldTrim?.mibPerSec, fastestFull?.mibPerSec),
    noTextRowsCrossTarget: noTextRows.filter(row => row.mibPerSec >= targetMiBPerSec).length,
    fullRowsCrossTarget: fullRows.filter(row => row.mibPerSec >= targetMiBPerSec).length,
    noTrimRowsCrossTarget: noTrimRows.filter(row => row.mibPerSec >= targetMiBPerSec).length,
    foldTrimRowsCrossTarget: foldTrimRows.filter(row => row.mibPerSec >= targetMiBPerSec).length,
    maximumTextOmissionSpeedup: round(Math.max(...sameScalePairs.map(pair => pair.withoutTextSpeedup).filter(isFiniteNumber))),
    maximumNoTrimSpeedup: round(Math.max(...sameScalePairs.map(pair => pair.noTrimSpeedup).filter(isFiniteNumber))),
    maximumFoldTrimSpeedup: round(Math.max(...sameScalePairs.map(pair => pair.foldTrimSpeedup).filter(isFiniteNumber))),
    conclusionAllowed: false,
    sourceConsumption: summarizeSourceConsumption(scaledReports.map(entry => entry.report)),
  };
  return {
    generatedAt: new Date().toISOString(),
    objective: 'text-materialization-frontier',
    contract: 'same-corpus-text-materialization-headroom-synthesis',
    note: 'Synthesizes existing text/CDATA materialization experiments. It is not a new benchmark run and not a runtime-limit conclusion.',
    metadata: {
      releaseDir: options.releaseDir,
      sourceArtifacts: [...scaledArtifacts, ...negativeArtifacts.map(spec => spec.file)],
    },
    summary,
    sameScalePairs,
    negativeRows,
    findings: createFindings(summary, sameScalePairs, negativeRows),
  };
}

function summarizeSourceConsumption(reports) {
  const contracts = reports.map(report => report.sourceContract ?? report.sourceConsumption ?? {});
  return {
    parserInput: uniqueNonEmpty(contracts.map(contract => contract.parserInput)),
    arrayBufferConsumption: uniqueNonEmpty(contracts.map(contract => contract.arrayBufferConsumption)),
    batchBackpressure: uniqueNonEmpty(contracts.map(contract => contract.batchBackpressure)),
    readableStreamScope: uniqueNonEmpty(contracts.map(contract => contract.readableStreamScope)),
  };
}

function extractScaledRows(report, sourceArtifact) {
  return (report.variants ?? []).flatMap(row => {
    const role = roleFor(row.id);
    if (!role) return [];
    return [createRow(report, row, sourceArtifact, role)];
  });
}

function extractNegativeRow(report, spec) {
  const control = findVariant(report, spec.controlId);
  const candidate = findVariant(report, spec.candidateId);
  return {
    family: spec.family,
    sourceArtifact: spec.file,
    control: summarizeRow(createRow(report, control, spec.file, 'full')),
    candidate: summarizeRow(createRow(report, candidate, spec.file, 'negative-candidate')),
    candidateToControlRatio: ratio(candidate.mibPerSec, control.mibPerSec),
    candidatePreservesFullStringParity: candidate.fullStringParity === true,
    candidateCrossesTarget: candidate.mibPerSec >= targetMiBPerSec,
    rejectedForFullTarget: candidate.fullStringParity !== true
      || candidate.mibPerSec < targetMiBPerSec
      || candidate.mibPerSec < control.mibPerSec,
  };
}

function roleFor(id) {
  switch (id) {
    case 'rawFrameNameId':
      return 'full';
    case 'withoutTextStrings':
      return 'without-text';
    case 'rawFrameNameIdNoTrim':
      return 'no-trim';
    case 'rawFrameNameIdFoldTrim':
      return 'fold-trim';
    default:
      return null;
  }
}

function createRow(report, row, sourceArtifact, role) {
  return {
    id: row.id,
    role,
    sourceArtifact,
    sizeGiB: round(report.fixture?.sizeGiB),
    mibPerSec: round(row.mibPerSec),
    fullStringParity: row.fullStringParity === true,
    boundedMemory: row.boundedMemory === true,
    eventCount: row.eventCount,
    checksum: row.checksum,
    counters: pickCounters(row.materializationCounters),
  };
}

function findVariant(report, id) {
  const row = (report.variants ?? []).find(variant => variant.id === id);
  if (!row) throw new Error(`Missing variant ${id}.`);
  return row;
}

function pickCounters(counters = {}) {
  return {
    stringFieldReads: counters.stringFieldReads ?? null,
    nameStringReads: counters.nameStringReads ?? null,
    textStringReads: counters.textStringReads ?? null,
    attrNameStringReads: counters.attrNameStringReads ?? null,
    attrValueStringReads: counters.attrValueStringReads ?? null,
    rawSpanMaterializations: counters.rawSpanMaterializations ?? null,
    rawTextSpanMaterializations: counters.rawTextSpanMaterializations ?? null,
    rawValueCacheHits: counters.rawValueCacheHits ?? null,
    rawValueCacheMisses: counters.rawValueCacheMisses ?? null,
    longAsciiTextHits: counters.longAsciiTextHits ?? null,
    longAsciiTextFallbacks: counters.longAsciiTextFallbacks ?? null,
  };
}

function createFindings(summary, sameScalePairs, negativeRows) {
  return [
    {
      id: 'full-text-frontier-below-target',
      classification: 'BENCH_FACT',
      summary: `The fastest full-string text-materializing row remains ${formatNumber(summary.fastestFull.mibPerSec)} MiB/s, ${formatNumber(summary.fastestFullRemainingMiBPerSec)} MiB/s below the ${targetMiBPerSec} MiB/s counterexample threshold.`,
      evidence: [
        `${summary.fastestFull.sourceArtifact}:${summary.fastestFull.id}`,
        `requiredSpeedup=${formatNumber(summary.requiredSpeedupToTarget)}x`,
      ],
    },
    {
      id: 'text-cdata-omission-crosses-target',
      classification: 'HEADROOM_EVIDENCE_PRESENT',
      summary: `${summary.noTextRowsCrossTarget} near-full row(s) cross ${targetMiBPerSec} MiB/s only after omitting text/CDATA strings.`,
      evidence: sameScalePairs
        .filter(pair => pair.withoutText?.mibPerSec >= targetMiBPerSec)
        .map(pair => `${pair.sourceArtifact}: withoutText=${formatNumber(pair.withoutText.mibPerSec)} MiB/s, full=${formatNumber(pair.full.mibPerSec)} MiB/s, omittedTextReads=${formatInteger(pair.omittedTextStringReads)}`),
    },
    {
      id: 'trim-only-not-enough',
      classification: 'NEGATIVE_RESULT',
      summary: 'Removing only text trim does not close the 200 MiB/s gap, and the fold-trim checksum variant is slower than the full row.',
      evidence: [
        `fastestNoTrim=${formatNumber(summary.fastestNoTrim.mibPerSec)} MiB/s`,
        `maximumNoTrimSpeedup=${formatNumber(summary.maximumNoTrimSpeedup)}x`,
        `fastestFoldTrim=${formatNumber(summary.fastestFoldTrim.mibPerSec)} MiB/s`,
        `maximumFoldTrimSpeedup=${formatNumber(summary.maximumFoldTrimSpeedup)}x`,
      ],
    },
    {
      id: 'cache-and-ascii-candidates-rejected',
      classification: 'NEGATIVE_RESULT',
      summary: 'The current repeated text cache, long ASCII text fast path, and fold-trim candidate rows do not improve the full target row.',
      evidence: negativeRows.map(row => `${row.family}: candidate/control=${formatNumber(row.candidateToControlRatio)}x, candidate=${formatNumber(row.candidate.mibPerSec)} MiB/s`),
    },
    {
      id: 'not-a-counterexample',
      classification: 'SCOPE_GUARD',
      summary: 'Rows that omit text/CDATA strings identify headroom but are not full-string StAX counterexamples.',
      evidence: [
        `fullRowsCrossTarget=${summary.fullRowsCrossTarget}`,
        `withoutTextRowsCrossTarget=${summary.noTextRowsCrossTarget}`,
        'withoutTextRows fullStringParity=false',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Text Materialization Frontier',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Fastest full-string row: ${formatSummaryRow(report.summary.fastestFull)}`,
    `- Fastest full-string row vs 200 MiB/s: ${formatNumber(report.summary.fastestFullToTargetRatio)}x, ${formatNumber(report.summary.fastestFullRemainingMiBPerSec)} MiB/s remaining, ${formatNumber(report.summary.requiredSpeedupToTarget)}x speedup required`,
    `- Fastest without-text row: ${formatSummaryRow(report.summary.fastestWithoutText)}`,
    `- Fastest without-text / fastest full ratio: ${formatNumber(report.summary.fastestWithoutTextToFullRatio)}x`,
    `- Maximum same-scale without-text speedup: ${formatNumber(report.summary.maximumTextOmissionSpeedup)}x`,
    `- Maximum no-trim speedup: ${formatNumber(report.summary.maximumNoTrimSpeedup)}x`,
    `- Maximum fold-trim speedup: ${formatNumber(report.summary.maximumFoldTrimSpeedup)}x`,
    `- Full rows crossing 200 MiB/s: ${report.summary.fullRowsCrossTarget}`,
    `- Without-text rows crossing 200 MiB/s: ${report.summary.noTextRowsCrossTarget}`,
    `- Conclusion allowed: ${report.summary.conclusionAllowed ? 'yes' : 'no'}`,
    '',
    '## Source Consumption',
    '',
    `- Parser input: ${formatList(report.summary.sourceConsumption.parserInput)}`,
    `- ArrayBuffer consumption: ${formatList(report.summary.sourceConsumption.arrayBufferConsumption)}`,
    `- Batch/backpressure: ${formatList(report.summary.sourceConsumption.batchBackpressure)}`,
    `- ReadableStream scope: ${formatList(report.summary.sourceConsumption.readableStreamScope)}`,
    '',
    '## Same-Scale Rows',
    '',
    '| Size | Full | No trim | Fold trim | Without text | Without/full | Omitted text reads |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const pair of report.sameScalePairs) {
    lines.push(`| ${formatNumber(pair.sizeGiB)} GiB | ${formatNumber(pair.full?.mibPerSec)} | ${formatNumber(pair.noTrim?.mibPerSec)} | ${formatNumber(pair.foldTrim?.mibPerSec)} | ${formatNumber(pair.withoutText?.mibPerSec)} | ${formatNumber(pair.withoutTextSpeedup)}x | ${formatInteger(pair.omittedTextStringReads)} |`);
  }

  lines.push(
    '',
    '## Negative Candidates',
    '',
    '| Family | Control | Candidate | Candidate/control | Full parity | Crosses target | Rejected |',
    '| --- | ---: | ---: | ---: | --- | --- | --- |',
  );
  for (const row of report.negativeRows) {
    lines.push(`| ${row.family} | ${formatNumber(row.control.mibPerSec)} | ${formatNumber(row.candidate.mibPerSec)} | ${formatNumber(row.candidateToControlRatio)}x | ${row.candidatePreservesFullStringParity ? 'yes' : 'no'} | ${row.candidateCrossesTarget ? 'yes' : 'no'} | ${row.rejectedForFullTarget ? 'yes' : 'no'} |`);
  }

  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }

  lines.push(
    '',
    '## Limits',
    '',
    '- This report synthesizes existing release artifacts only; it does not run a new benchmark.',
    '- `withoutTextStrings` rows omit all text/CDATA string materialization, change the checksum, and are not full-string StAX rows.',
    '- The negative candidates reject the current implementations on this corpus shape, not every possible text materialization design.',
    '- A future 200 MiB/s+ bounded-memory full-string row remains a counterexample to the broad runtime-limit hypothesis.',
  );

  return `${lines.join('\n')}\n`;
}

function summarizeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    sourceArtifact: row.sourceArtifact,
    sizeGiB: row.sizeGiB,
    mibPerSec: row.mibPerSec,
    fullStringParity: row.fullStringParity,
    boundedMemory: row.boundedMemory,
    eventCount: row.eventCount,
    checksum: row.checksum,
    textStringReads: row.counters?.textStringReads ?? null,
    stringFieldReads: row.counters?.stringFieldReads ?? null,
  };
}

function readReleaseJson(releaseDir, file) {
  const filePath = resolve(releaseDir, file);
  if (!existsSync(filePath)) {
    throw new Error(`Required release artifact is missing: ${filePath}`);
  }
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function maxBy(items, valueFn) {
  let best = null;
  let bestValue = -Infinity;
  for (const item of items) {
    const value = valueFn(item);
    if (typeof value === 'number' && Number.isFinite(value) && value > bestValue) {
      best = item;
      bestValue = value;
    }
  }
  return best;
}

function ratio(numerator, denominator) {
  return isFiniteNumber(numerator) && isFiniteNumber(denominator) && denominator !== 0
    ? round(numerator / denominator)
    : null;
}

function round(value) {
  return isFiniteNumber(value) ? Math.round(value * 100) / 100 : null;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function uniqueNonEmpty(values) {
  return [...new Set(values.filter(value => typeof value === 'string' && value.length > 0))];
}

function formatSummaryRow(row) {
  if (!row) return 'none';
  return `${row.id} from ${row.sourceArtifact} at ${formatNumber(row.mibPerSec)} MiB/s`;
}

function formatNumber(value) {
  return isFiniteNumber(value) ? value.toFixed(2) : 'n/a';
}

function formatInteger(value) {
  return Number.isInteger(value) ? value.toLocaleString('en-US') : 'n/a';
}

function formatList(values) {
  return Array.isArray(values) && values.length > 0 ? values.join(' / ') : 'n/a';
}

function printSummary(report) {
  console.log(`text-materialization-frontier: full=${formatNumber(report.summary.fastestFull.mibPerSec)} MiB/s withoutText=${formatNumber(report.summary.fastestWithoutText.mibPerSec)} MiB/s fullCounterexamples=${report.summary.fullRowsCrossTarget}`);
}

main();
