import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultReleaseDir = resolve(__dirname, 'results', 'release');
const defaultMaterializedJson = resolve(defaultReleaseDir, 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.json');
const defaultMaterializedSource = resolve(__dirname, 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit.mjs');
const defaultCorpusFiles = [
  resolve(__dirname, 'assets', 'books.xml'),
  resolve(__dirname, 'assets', 'midsize.xml'),
  resolve(__dirname, 'assets', 'large.xml'),
].filter(existsSync);
const defaultJsonOut = resolve(defaultReleaseDir, 'spidermonkey-ascii-scope-distance-audit.json');
const defaultMdOut = resolve(defaultReleaseDir, 'spidermonkey-ascii-scope-distance-audit.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    materializedJson: defaultMaterializedJson,
    materializedSource: defaultMaterializedSource,
    corpusFiles: [...defaultCorpusFiles],
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
      case '--materialized-source':
        options.materializedSource = resolve(process.cwd(), readValue());
        break;
      case '--corpus-files':
        options.corpusFiles = readValue().split(',').map(entry => resolve(process.cwd(), entry.trim())).filter(Boolean);
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
  console.log(`${report.objective}: corpusAscii=${report.summary.allCorpusFilesAscii} materializedSeedAscii=${report.summary.materializedCorpusSeedAscii} closes=${report.summary.closesCodegenObligation}`);
}

function createReport(options) {
  const materialized = readJson(options.materializedJson);
  const materializedSource = readRequiredFile(options.materializedSource);
  const corpusRows = options.corpusFiles.map(filePath => inspectCorpus(filePath));
  return buildReport(options, { materialized, materializedSource, corpusRows });
}

function createSelfTestReport(options) {
  const materialized = {
    objective: 'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit',
    outcome: {
      sameSemanticChecksumFields: true,
      fullStringParity: true,
      sameContractStaxRow: false,
      unchangedStaxBenchmark: false,
      closesEmittedIrObligation: false,
    },
    fixture: {
      source: 'ascii-corpus-seed-replay',
      sourceFile: 'self-test/ascii.xml',
      corpusSeedBytes: 21,
      targetBytes: 1024,
    },
    materializedWorkload: {
      fullStringParity: true,
      eventCount: 4,
      checksum: 123,
      materializedStringCount: 5,
      materializedObjectCount: 4,
    },
  };
  const materializedSource = `
function asciiFromBytes(bytes, start, end) {
  return String.fromCharCode.apply(null, bytes.subarray(start, end));
}
function foldString(seed, value) { return seed; }
function processTag(bytes, parser) { return parser; }
`;
  const corpusRows = [
    inspectBytes('self-test/ascii.xml', Buffer.from('<r a="b">text</r>\n', 'utf8')),
    inspectBytes('self-test/non-ascii.xml', Buffer.from('<r>é</r>', 'utf8')),
  ];
  return buildReport(options, { materialized, materializedSource, corpusRows });
}

function buildReport(options, sources) {
  const materialized = sources.materialized;
  const materializedWorkload = materialized.materializedWorkload ?? {};
  const materializedSourceChecks = createSourceChecks(sources.materializedSource);
  const corpusRows = sources.corpusRows;
  const materializedSourceFile = materialized.fixture?.sourceFile ?? null;
  const materializedCorpus = corpusRows.find(row => samePathSuffix(row.filePath, materializedSourceFile))
    ?? corpusRows.find(row => row.basename === basename(materializedSourceFile ?? ''));
  const allCorpusFilesAscii = corpusRows.length > 0 && corpusRows.every(row => row.nonAsciiByteCount === 0);
  const materializedCorpusSeedAscii = materializedCorpus?.nonAsciiByteCount === 0;
  const asciiByteToStringEquivalentToUtf8 = corpusRows
    .filter(row => row.nonAsciiByteCount === 0)
    .every(row => row.asciiByteToStringEquivalentToUtf8 === true);
  const sourceMaterializerIsAscii = materializedSourceChecks.asciiFromBytes && materializedSourceChecks.fromCharCode;
  const semanticMaterializedWorkload = materialized.outcome?.sameSemanticChecksumFields === true
    && (materializedWorkload.fullStringParity ?? materialized.outcome?.fullStringParity) === true
    && materializedWorkload.materializedStringCount > 0
    && materializedWorkload.materializedObjectCount > 0;
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'spidermonkey-ascii-scope-distance-audit',
    contract: 'spidermonkey-js-shell-ascii-materializer-utf8-equivalence-scope',
    note: 'Audits the ASCII-only scope in the SpiderMonkey debug js-shell materialized-codegen artifact. For corpus seeds whose bytes are all <= 0x7f, String.fromCharCode over bytes produces the same JavaScript string code units as non-streaming UTF-8 TextDecoder for those spans. This reduces the materialized js-shell scope distance for ASCII corpus seeds, but it still does not make the artifact the unchanged StAX benchmark or close the emitted-code obligation.',
    parameters: {
      materializedJson: options.materializedJson,
      materializedSource: options.materializedSource,
      corpusFiles: options.corpusFiles,
      selfTest: options.selfTest,
    },
    materializedArtifact: {
      objective: materialized.objective ?? null,
      contract: materialized.contract ?? null,
      sourceFile: materializedSourceFile,
      fixture: materialized.fixture ?? null,
      outcome: materialized.outcome ?? null,
      workload: {
        fullStringParity: materializedWorkload.fullStringParity ?? materialized.outcome?.fullStringParity ?? null,
        eventCount: materializedWorkload.eventCount ?? null,
        checksum: materializedWorkload.checksum ?? null,
        materializedStringCount: materializedWorkload.materializedStringCount ?? null,
        materializedObjectCount: materializedWorkload.materializedObjectCount ?? null,
      },
    },
    materializedSourceChecks,
    corpusRows,
    checks: [
      {
        id: 'materialized-source-uses-ascii-byte-materializer',
        status: sourceMaterializerIsAscii ? 'pass' : 'fail',
        evidence: sourceCheckEvidence(materializedSourceChecks),
      },
      {
        id: 'materialized-workload-folds-semantic-strings',
        status: semanticMaterializedWorkload ? 'pass' : 'fail',
        evidence: [
          `sameSemanticChecksumFields=${materialized.outcome?.sameSemanticChecksumFields ?? 'unknown'}`,
          `fullStringParity=${materializedWorkload.fullStringParity ?? materialized.outcome?.fullStringParity ?? 'unknown'}`,
          `materializedStringCount=${materializedWorkload.materializedStringCount ?? 'unknown'}`,
          `materializedObjectCount=${materializedWorkload.materializedObjectCount ?? 'unknown'}`,
        ],
      },
      {
        id: 'materialized-corpus-seed-is-ascii',
        status: materializedCorpusSeedAscii ? 'pass' : 'fail',
        evidence: materializedCorpus
          ? [`file=${materializedCorpus.filePath}`, `maxByte=${materializedCorpus.maxByte}`, `nonAsciiByteCount=${materializedCorpus.nonAsciiByteCount}`]
          : [`sourceFile=${materializedSourceFile ?? 'unknown'}`, 'matchedCorpusRow=none'],
      },
      {
        id: 'ascii-corpus-byte-to-string-equivalence',
        status: allCorpusFilesAscii && asciiByteToStringEquivalentToUtf8 ? 'pass' : 'fail',
        evidence: corpusRows.map(row => `${row.basename}: bytes=${row.byteLength} maxByte=${row.maxByte} nonAscii=${row.nonAsciiByteCount}`),
      },
      {
        id: 'unchanged-stax-closure-still-blocked',
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
    ],
  };
  const allChecksPass = report.checks.every(check => check.status === 'pass');
  report.summary = {
    allChecksPass,
    corpusFileCount: corpusRows.length,
    allCorpusFilesAscii,
    materializedCorpusSeedAscii,
    asciiByteToStringEquivalentToUtf8,
    semanticMaterializedWorkload,
    reducesScopeDistance: allChecksPass,
    closesCodegenObligation: false,
    conclusionAllowed: false,
  };
  report.findings = createFindings(report);
  return report;
}

function createSourceChecks(source) {
  return {
    asciiFromBytes: /function\s+asciiFromBytes\s*\(/.test(source),
    fromCharCode: /String\.fromCharCode\.apply/.test(source),
    processTag: /function\s+processTag\s*\(/.test(source),
    foldString: /function\s+foldString\s*\(/.test(source),
  };
}

function sourceCheckEvidence(checks) {
  return Object.entries(checks).map(([key, value]) => `${key}=${value}`);
}

function inspectCorpus(filePath) {
  return inspectBytes(filePath, readFileSync(filePath));
}

function inspectBytes(filePath, bytes) {
  let maxByte = 0;
  let nonAsciiByteCount = 0;
  for (const byte of bytes) {
    if (byte > maxByte) maxByte = byte;
    if (byte > 0x7f) nonAsciiByteCount++;
  }
  const asciiByteToStringEquivalentToUtf8 = nonAsciiByteCount === 0
    && sampleEquivalence(bytes);
  return {
    filePath,
    basename: basename(filePath),
    byteLength: bytes.length,
    maxByte,
    nonAsciiByteCount,
    asciiByteToStringEquivalentToUtf8,
    utf8EquivalenceRule: nonAsciiByteCount === 0
      ? 'all bytes <= 0x7f, so each UTF-8 byte maps to the same UTF-16 code unit as String.fromCharCode(byte)'
      : 'contains bytes > 0x7f, so ASCII byte materialization is not UTF-8 equivalent',
  };
}

function sampleEquivalence(bytes) {
  const decoder = new TextDecoder();
  const spans = [
    [0, bytes.length],
    [0, Math.min(bytes.length, 4096)],
    [Math.max(0, Math.floor(bytes.length / 2) - 2048), Math.min(bytes.length, Math.floor(bytes.length / 2) + 2048)],
    [Math.max(0, bytes.length - 4096), bytes.length],
  ];
  return spans.every(([start, end]) => decoder.decode(bytes.subarray(start, end)) === asciiFromBytes(bytes, start, end));
}

function asciiFromBytes(bytes, start, end) {
  let value = '';
  for (let index = start; index < end; index += 8192) {
    const sliceEnd = Math.min(end, index + 8192);
    value += String.fromCharCode.apply(null, bytes.subarray(index, sliceEnd));
  }
  return value;
}

function createFindings(report) {
  return [
    {
      id: 'spidermonkey-materialized-ascii-utf8-equivalence',
      classification: 'SOURCE_FACT',
      summary: 'For ASCII-only corpus seeds, the SpiderMonkey js-shell materializer creates the same JS string code units that UTF-8 TextDecoder would create for those byte spans.',
      evidence: [
        `allCorpusFilesAscii=${report.summary.allCorpusFilesAscii}`,
        `materializedCorpusSeedAscii=${report.summary.materializedCorpusSeedAscii}`,
        `asciiByteToStringEquivalentToUtf8=${report.summary.asciiByteToStringEquivalentToUtf8}`,
      ],
    },
    {
      id: 'spidermonkey-materialized-codegen-scope-narrowed',
      classification: 'SCOPE_GUARD',
      summary: 'The ASCII equivalence narrows the materialized js-shell codegen scope gap for ASCII corpus seeds but does not close the unchanged StAX emitted-code obligation.',
      evidence: [
        `reducesScopeDistance=${report.summary.reducesScopeDistance}`,
        `closesCodegenObligation=${report.summary.closesCodegenObligation}`,
        `conclusionAllowed=${report.summary.conclusionAllowed}`,
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# SpiderMonkey ASCII Scope Distance Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- All checks pass: ${report.summary.allChecksPass ? 'yes' : 'no'}`,
    `- Corpus files checked: ${report.summary.corpusFileCount}`,
    `- All corpus files ASCII-only: ${report.summary.allCorpusFilesAscii ? 'yes' : 'no'}`,
    `- Materialized corpus seed ASCII-only: ${report.summary.materializedCorpusSeedAscii ? 'yes' : 'no'}`,
    `- ASCII byte materializer equals UTF-8 TextDecoder for checked ASCII spans: ${report.summary.asciiByteToStringEquivalentToUtf8 ? 'yes' : 'no'}`,
    `- Reduces SpiderMonkey materialized js-shell scope distance: ${report.summary.reducesScopeDistance ? 'yes' : 'no'}`,
    `- Closes emitted-code obligation: ${report.summary.closesCodegenObligation ? 'yes' : 'no'}`,
    `- Runtime-limit conclusion allowed: ${report.summary.conclusionAllowed ? 'yes' : 'no'}`,
    '',
    '## Corpus Rows',
    '',
    '| File | Bytes | Max byte | Non-ASCII bytes | UTF-8 equivalence |',
    '| --- | ---: | ---: | ---: | --- |',
  ];
  for (const row of report.corpusRows) {
    lines.push(`| ${row.basename} | ${row.byteLength} | ${row.maxByte} | ${row.nonAsciiByteCount} | ${row.asciiByteToStringEquivalentToUtf8 ? 'yes' : 'no'} |`);
  }
  lines.push('', '## Checks', '', '| Check | Status | Evidence |', '| --- | --- | --- |');
  for (const check of report.checks) {
    lines.push(`| ${check.id} | ${check.status} | ${check.evidence.join('; ')} |`);
  }
  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const item of finding.evidence) lines.push(`  - ${item}`);
  }
  lines.push('');
  return lines.join('\n');
}

function readJson(filePath) {
  return JSON.parse(readRequiredFile(filePath));
}

function readRequiredFile(filePath) {
  if (!existsSync(filePath)) throw new Error(`Required file not found: ${filePath}`);
  return readFileSync(filePath, 'utf8');
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function basename(filePath) {
  return String(filePath).split(/[\\/]/).pop();
}

function samePathSuffix(left, right) {
  if (!left || !right) return false;
  const normalizedLeft = String(left).replace(/\\/g, '/');
  const normalizedRight = String(right).replace(/\\/g, '/');
  return normalizedLeft.endsWith(normalizedRight) || normalizedRight.endsWith(normalizedLeft);
}

main();
