import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultComparisonJson = resolve(__dirname, 'results', 'release', 'same-contract-runtime-comparison.json');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'memory-frontier-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'memory-frontier-audit.md');

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
  console.log(`memory-frontier-audit: status=${report.summary.status} bounded=${report.summary.boundedRows}/${report.summary.rows}`);
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
  const comparisonSummary = comparison.summary ?? {};
  const frontier = comparisonSummary.memoryFrontier;
  if (!frontier) {
    throw new Error('same-contract comparison JSON does not contain summary.memoryFrontier');
  }

  const rows = frontier.rows ?? 0;
  const boundedRows = frontier.boundedRows ?? 0;
  const unboundedRows = frontier.unboundedRows ?? 0;
  const comparisonRows = Array.isArray(comparison.comparisonRows) ? comparison.comparisonRows : [];
  const memoryRows = comparisonRows.filter(row =>
    row.jsRuntime
    && row.fullStringParity
    && (row.fixture?.sizeGiB ?? 0) >= 0.999
    && row.memory?.primaryKind
  );
  const unboundedMemoryRows = memoryRows.filter(row => row.boundedMemory !== true);
  const unboundedRowsAtOrAbove200MiBPerSec = unboundedMemoryRows
    .filter(row => typeof row.mibPerSec === 'number' && row.mibPerSec >= 200)
    .length;
  const fastestUnboundedRow = maxBy(unboundedMemoryRows, row => row.mibPerSec);
  const status = rows === comparisonSummary.jsLargeFullRowCount
    && boundedRows + unboundedRows === rows
    && memoryRows.length === rows
    && unboundedMemoryRows.length === unboundedRows
    && frontier.fastestBoundedRow?.mibPerSec === comparisonSummary.fastestJsLargeFullRow?.mibPerSec
    ? 'classified'
    : 'partial';

  return {
    generatedAt: new Date().toISOString(),
    objective: 'memory-frontier-audit',
    contract: 'same-contract-1gib-plus-js-full-string-memory-frontier',
    note: 'Audits memory classification from the same-contract aggregate. This is not a benchmark run, does not normalize memory models across runtimes, and does not prove a JavaScript runtime ceiling.',
    inputs: {
      comparisonJson: options.comparisonJson,
      comparisonGeneratedAt: comparison.generatedAt ?? null,
      comparisonObjective: comparison.objective,
      comparisonContract: comparison.contract,
    },
    summary: {
      status,
      rows,
      boundedRows,
      unboundedRows,
      unboundedRowsAtOrAbove200MiBPerSec,
      jsLargeFullRowCount: comparisonSummary.jsLargeFullRowCount ?? null,
      memoryKinds: frontier.memoryKinds ?? [],
      fastestBoundedRow: summarizeMemoryRow(frontier.fastestBoundedRow),
      fastestUnboundedRow: summarizeMemoryRow(fastestUnboundedRow),
      fastestProcessRssUnder128MiB: summarizeMemoryRow(frontier.fastestProcessRssUnder128MiB),
      fastestBrowserJsHeapRow: summarizeMemoryRow(frontier.fastestBrowserJsHeapRow),
      sameFixture1024MiBProcessRssSnapshot: summarizeProcessRssSnapshot(comparisonSummary.sameFixture1024MiBProcessRssSnapshot),
      conclusionAllowed: false,
    },
    buckets: (frontier.buckets ?? []).map(bucket => ({
      kind: bucket.kind,
      rows: bucket.rows,
      boundedRows: bucket.boundedRows,
      unboundedRows: bucket.unboundedRows,
      maxMiB: bucket.maxMiB,
      fastestRow: summarizeMemoryRow(bucket.fastestRow),
      fastestBoundedRow: summarizeMemoryRow(bucket.fastestBoundedRow),
    })),
    interpretation: frontier.interpretation,
    findings: createFindings(frontier, comparisonSummary.sameFixture1024MiBProcessRssSnapshot, unboundedRowsAtOrAbove200MiBPerSec),
  };
}

function summarizeMemoryRow(row) {
  if (!row) return null;
  return {
    runtimeLabel: row.runtimeLabel,
    caseId: row.caseId,
    rateMiBPerSec: row.mibPerSec,
    memoryKind: row.memory?.primaryKind ?? null,
    maxMiB: row.memory?.maxMiB ?? null,
    sourceArtifact: row.sourceArtifact,
    boundedMemory: row.boundedMemory === true,
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

function createFindings(frontier, processRssSnapshot, unboundedRowsAtOrAbove200MiBPerSec) {
  const findings = [
    {
      id: 'memory-frontier-classified',
      classification: 'SOURCE_FACT',
      summary: `${frontier.boundedRows}/${frontier.rows} current JavaScript 1 GiB+ full-string rows are bounded under their recorded memory metric.`,
    },
    {
      id: 'memory-kinds-not-normalized',
      classification: 'SOURCE_FACT',
      summary: 'Process RSS, browser JS heap, and browser host-probe-only rows remain separate memory kinds.',
    },
  ];

  if (unboundedRowsAtOrAbove200MiBPerSec === 0) {
    findings.push({
      id: 'no-unbounded-target-row',
      classification: 'SOURCE_FACT',
      summary: 'No current unbounded or unproven-memory JavaScript 1 GiB+ full-string row reaches 200 MiB/s.',
    });
  }

  if (frontier.buckets?.some(bucket => bucket.kind === 'browser-js-heap-unavailable' && bucket.boundedRows === 0)) {
    findings.push({
      id: 'firefox-heap-unavailable-not-bounded-proof',
      classification: 'SOURCE_FACT',
      summary: 'Firefox/SpiderMonkey browser rows without page JS heap counters remain unbounded or unproven for counterexample purposes.',
    });
  }

  if (processRssSnapshot) {
    findings.push({
      id: 'same-fixture-rss-snapshot-not-allocation-model',
      classification: 'SOURCE_FACT',
      summary: 'Same-fixture process RSS rows are endpoint memory evidence and not allocation-model equivalence across JavaScript, Java, and Rust.',
    });
  }

  return findings;
}

function renderMarkdown(report) {
  const lines = [
    '# Memory Frontier Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Status: ${report.summary.status}`,
    `- Source artifact: ${report.inputs.comparisonJson}`,
    `- Rows classified: ${report.summary.rows}`,
    `- JavaScript 1 GiB+ full-string rows: ${report.summary.jsLargeFullRowCount}`,
    `- Bounded rows: ${report.summary.boundedRows}`,
    `- Unbounded or unproven rows: ${report.summary.unboundedRows}`,
    `- Unbounded or unproven rows at or above 200 MiB/s: ${report.summary.unboundedRowsAtOrAbove200MiBPerSec}`,
    `- Memory kinds: ${report.summary.memoryKinds.join(', ')}`,
    `- Fastest bounded row: ${formatMemoryRow(report.summary.fastestBoundedRow)}`,
    `- Fastest unbounded or unproven row: ${formatMemoryRow(report.summary.fastestUnboundedRow)}`,
    `- Fastest process RSS row under 128 MiB: ${formatMemoryRow(report.summary.fastestProcessRssUnder128MiB)}`,
    `- Fastest browser JS heap row: ${formatMemoryRow(report.summary.fastestBrowserJsHeapRow)}`,
    '',
    '## Memory Kind Buckets',
    '',
    '| Memory kind | Rows | Bounded | Unbounded or unproven | Max MiB | Fastest row | Fastest bounded row |',
    '| --- | ---: | ---: | ---: | ---: | --- | --- |',
    ...report.buckets.map(bucketMarkdownRow),
    '',
    '## Same-Fixture Process RSS Snapshot',
    '',
  ];

  const snapshot = report.summary.sameFixture1024MiBProcessRssSnapshot;
  if (snapshot) {
    lines.push(
      `- Caveat: ${snapshot.caveat}`,
      `- JavaScript: ${formatRssRow(snapshot.fastestJs)}`,
      `- Woodstox: ${formatRssRow(snapshot.woodstox)}`,
      `- quick-xml: ${formatRssRow(snapshot.quickXml)}`,
      '',
    );
  } else {
    lines.push('- No same-fixture process RSS snapshot was available.', '');
  }

  lines.push(
    '## Findings',
    '',
    '| ID | Classification | Summary |',
    '| --- | --- | --- |',
    ...report.findings.map(finding => `| \`${finding.id}\` | ${finding.classification} | ${finding.summary} |`),
    '',
    `Interpretation: ${report.interpretation}`,
    '',
  );

  return `${lines.join('\n')}\n`;
}

function bucketMarkdownRow(bucket) {
  return `| ${bucket.kind} | ${bucket.rows} | ${bucket.boundedRows} | ${bucket.unboundedRows} | ${formatNullableMiB(bucket.maxMiB)} | ${formatMemoryRow(bucket.fastestRow)} | ${formatMemoryRow(bucket.fastestBoundedRow)} |`;
}

function formatMemoryRow(row) {
  if (!row) return 'none';
  return `${row.runtimeLabel} \`${row.caseId}\` ${formatNumber(row.rateMiBPerSec)} MiB/s (${row.memoryKind} max ${formatNullableMiB(row.maxMiB)}, \`${row.sourceArtifact}\`)`;
}

function formatRssRow(row) {
  if (!row) return 'none';
  return `${row.runtimeLabel} \`${row.caseId}\` ${formatNumber(row.rateMiBPerSec)} MiB/s, process RSS ${formatNullableMiB(row.maxRssMiB)} from \`${row.sourceArtifact}\``;
}

function formatNullableMiB(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)} MiB` : 'n/a';
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function maxBy(items, score) {
  let best = null;
  let bestScore = -Infinity;
  for (const item of items) {
    const value = score(item);
    if (typeof value === 'number' && value > bestScore) {
      best = item;
      bestScore = value;
    }
  }
  return best;
}

function writeOutput(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

main();
