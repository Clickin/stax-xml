import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const quickXmlDir = join(__dirname, 'external', 'quick-xml');
const quickXmlExe = join(quickXmlDir, 'target', 'release', process.platform === 'win32' ? 'quick_xml_baseline.exe' : 'quick_xml_baseline');
const defaultFile = join(__dirname, 'test-data', 'runtime-comparison-16mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'quick-xml-allocation-count.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'quick-xml-allocation-count.md');
const variantFixtureDir = join(__dirname, 'test-data');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    runs: 1,
    warmups: 4,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    fileExplicit: false,
    skipBuild: false,
    includeVariants: false,
    variantSizeBytes: MIB,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    if (arg === '--self-test') {
      options.selfTest = true;
      continue;
    }
    if (arg === '--skip-build') {
      options.skipBuild = true;
      continue;
    }
    if (arg === '--include-variants') {
      options.includeVariants = true;
      continue;
    }

    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} requires a value.`);
      index++;
      return value;
    };

    switch (name) {
      case '--file':
        options.file = resolve(process.cwd(), readValue());
        options.fileExplicit = true;
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--variant-size-kib':
        options.variantSizeBytes = parsePositiveInteger(readValue(), name) * 1024;
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

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${flag} must be a non-negative integer.`);
  return parsed;
}

function main() {
  const options = parseArgs();
  const report = options.selfTest ? createSelfTestReport(options) : runAllocationCount(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function createSelfTestReport(options) {
  const benchmark = {
    runtime: '1.0.0',
    avgMs: 50,
    minMs: 49,
    maxMs: 51,
    mibPerSec: 320,
    eventCount: 967967,
    checksum: -746772258,
    samplesMs: [50],
    allocationSamples: [
      {
        allocCount: 8,
        allocBytes: 1146880,
        deallocCount: 8,
        deallocBytes: 1146880,
        reallocCount: 2,
        reallocBytesIn: 768,
        reallocBytesOut: 1536,
        allocationOperations: 10,
        totalAllocatedBytes: 1148416,
        totalReleasedBytes: 1147648,
        netAllocatedBytes: 768,
      },
    ],
    allocationSummary: {
      allocCount: 8,
      allocBytes: 1146880,
      deallocCount: 8,
      deallocBytes: 1146880,
      reallocCount: 2,
      reallocBytesIn: 768,
      reallocBytesOut: 1536,
      allocationOperations: 10,
      totalAllocatedBytes: 1148416,
      totalReleasedBytes: 1147648,
      netAllocatedBytes: 768,
    },
    shapeSamples: [
      {
        textDecodeCount: 42,
        textBorrowedCount: 42,
        textOwnedCount: 0,
        textNonEmptyCount: 42,
        cdataDecodeCount: 1,
        cdataBorrowedCount: 1,
        cdataOwnedCount: 0,
        cdataNonEmptyCount: 1,
        totalDecodeCount: 43,
        totalBorrowedCount: 43,
        totalOwnedCount: 0,
        totalNonEmptyCount: 43,
      },
    ],
    shapeSummary: {
      textDecodeCount: 42,
      textBorrowedCount: 42,
      textOwnedCount: 0,
      textNonEmptyCount: 42,
      cdataDecodeCount: 1,
      cdataBorrowedCount: 1,
      cdataOwnedCount: 0,
      cdataNonEmptyCount: 1,
      totalDecodeCount: 43,
      totalBorrowedCount: 43,
      totalOwnedCount: 0,
      totalNonEmptyCount: 43,
    },
  };
  return createReport({
    options: { ...options, includeVariants: true },
    environment: {
      rustc: 'rustc self-test',
      cargo: 'cargo self-test',
      cpuName: 'self-test',
      platform: 'self-test',
    },
    fixture: {
      path: null,
      sizeBytes: 16 * MIB,
      sizeMiB: 16,
      source: 'self-test',
    },
    command: ['quick_xml_baseline', '--count-allocations'],
    elapsedMs: 0,
    benchmark,
    variants: [
      createSelfTestVariant('escaped-utf8', 101, 1234, 11, 11, 0),
      createSelfTestVariant('nonascii-utf8', 102, 1235, 12, 12, 0),
      createSelfTestVariant('cdata-utf8', 103, 1236, 13, 13, 0),
      createSelfTestVariant('utf8-bom', 104, 1237, 14, 14, 0),
    ],
  });
}

function createSelfTestVariant(id, eventCount, checksum, decodeCount, borrowedCount, ownedCount) {
  const benchmark = {
    runtime: '1.0.0',
    avgMs: 5,
    minMs: 5,
    maxMs: 5,
    mibPerSec: 64,
    eventCount,
    checksum,
    samplesMs: [5],
    allocationSamples: [
      {
        allocCount: 3,
        allocBytes: 1024,
        deallocCount: 3,
        deallocBytes: 1024,
        reallocCount: 0,
        reallocBytesIn: 0,
        reallocBytesOut: 0,
        allocationOperations: 3,
        totalAllocatedBytes: 1024,
        totalReleasedBytes: 1024,
        netAllocatedBytes: 0,
      },
    ],
    allocationSummary: {
      allocCount: 3,
      allocBytes: 1024,
      deallocCount: 3,
      deallocBytes: 1024,
      reallocCount: 0,
      reallocBytesIn: 0,
      reallocBytesOut: 0,
      allocationOperations: 3,
      totalAllocatedBytes: 1024,
      totalReleasedBytes: 1024,
      netAllocatedBytes: 0,
    },
    shapeSamples: [
      {
        textDecodeCount: decodeCount,
        textBorrowedCount: borrowedCount,
        textOwnedCount: ownedCount,
        textNonEmptyCount: decodeCount,
        cdataDecodeCount: 0,
        cdataBorrowedCount: 0,
        cdataOwnedCount: 0,
        cdataNonEmptyCount: 0,
        totalDecodeCount: decodeCount,
        totalBorrowedCount: borrowedCount,
        totalOwnedCount: ownedCount,
        totalNonEmptyCount: decodeCount,
      },
    ],
    shapeSummary: {
      textDecodeCount: decodeCount,
      textBorrowedCount: borrowedCount,
      textOwnedCount: ownedCount,
      textNonEmptyCount: decodeCount,
      cdataDecodeCount: 0,
      cdataBorrowedCount: 0,
      cdataOwnedCount: 0,
      cdataNonEmptyCount: 0,
      totalDecodeCount: decodeCount,
      totalBorrowedCount: borrowedCount,
      totalOwnedCount: ownedCount,
      totalNonEmptyCount: decodeCount,
    },
  };
  return {
    id,
    description: `${id} self-test fixture`,
    fixture: {
      path: null,
      sizeBytes: 512,
      sizeMiB: 512 / MIB,
      source: 'self-test',
    },
    command: {
      cwd: repoRoot,
      argv: ['quick_xml_baseline', '--count-allocations', '--fixture', id],
      elapsedMs: 0,
    },
    benchmark,
    allocation: analyzeAllocations(benchmark, { sizeMiB: 512 / MIB }),
  };
}

function runAllocationCount(options) {
  ensureFixture(options);
  ensureQuickXmlBinary(options);
  const environment = {
    rustc: firstLine(runCommandChecked('rustc', ['--version'], repoRoot)),
    cargo: firstLine(runCommandChecked('cargo', ['--version'], repoRoot)),
    cpuName: cpus()[0]?.model ?? 'unknown',
    platform: `${process.platform}-${process.arch}`,
  };
  const primary = runFixture(options, {
    id: 'primary',
    description: 'runtime-comparison-16mib baseline fixture',
    path: options.file,
    source: 'file',
  });
  const variants = options.includeVariants
    ? generateVariantFixtures(options).map(spec => runFixture(options, spec))
    : [];
  return createReport({
    options,
    environment,
    fixture: primary.fixture,
    command: primary.command.argv,
    elapsedMs: primary.command.elapsedMs,
    benchmark: primary.benchmark,
    variants,
  });
}

function runFixture(options, spec) {
  const stats = statSync(spec.path);
  const fixture = {
    path: spec.path,
    sizeBytes: stats.size,
    sizeMiB: stats.size / MIB,
    source: spec.source ?? 'file',
  };
  const args = createQuickXmlArgs(spec.path, options);
  const startedAt = Date.now();
  const result = runCommand(quickXmlExe, args, repoRoot);
  const elapsedMs = Date.now() - startedAt;
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`quick-xml allocation count run failed for ${spec.id}: ${trimSpawnOutput(result)}`);
  }
  const benchmark = JSON.parse(String(result.stdout ?? '').trim());
  validateBenchmark(benchmark, options.runs);
  return {
    id: spec.id,
    description: spec.description,
    fixture,
    command: {
      cwd: repoRoot,
      argv: [quickXmlExe, ...args],
      elapsedMs,
    },
    benchmark,
    allocation: analyzeAllocations(benchmark, fixture),
  };
}

function createQuickXmlArgs(file, options) {
  return [
    '--file',
    file,
    '--runs',
    String(options.runs),
    '--warmups',
    String(options.warmups),
    '--count-allocations',
  ];
}

function createReport({ options, environment, fixture, command, elapsedMs, benchmark, variants = [] }) {
  validateBenchmark(benchmark, options.runs);
  const allocation = analyzeAllocations(benchmark, fixture);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'quick-xml-allocation-count',
    contract: 'measured-consume-global-allocator-count',
    note: 'Global allocator counters for Rust + quick-xml measured consume runs after warmup. This is allocation-call evidence for this binary, not stack attribution, type attribution, object-lifetime proof, or a speed baseline.',
    environment,
    fixture,
    options: {
      runs: options.runs,
      warmups: options.warmups,
      countAllocations: true,
      includeVariants: options.includeVariants,
      variantSizeBytes: options.variantSizeBytes,
    },
    command: {
      cwd: repoRoot,
      argv: command,
      elapsedMs,
    },
    benchmark,
    allocation,
    variants,
    findings: createFindings(benchmark, allocation, variants),
  };
}

function validateBenchmark(benchmark, expectedRuns) {
  if (!Array.isArray(benchmark.samplesMs) || benchmark.samplesMs.length !== expectedRuns) {
    throw new Error(`quick-xml emitted ${benchmark.samplesMs?.length ?? 0} samples, expected ${expectedRuns}.`);
  }
  if (!Array.isArray(benchmark.allocationSamples) || benchmark.allocationSamples.length !== expectedRuns) {
    throw new Error(`quick-xml emitted ${benchmark.allocationSamples?.length ?? 0} allocation samples, expected ${expectedRuns}.`);
  }
  for (const field of ['eventCount', 'checksum', 'mibPerSec', 'allocationSummary', 'shapeSummary']) {
    if (benchmark[field] === undefined || benchmark[field] === null) {
      throw new Error(`quick-xml output is missing ${field}.`);
    }
  }
  if (!Array.isArray(benchmark.shapeSamples) || benchmark.shapeSamples.length !== expectedRuns) {
    throw new Error(`quick-xml emitted ${benchmark.shapeSamples?.length ?? 0} shape samples, expected ${expectedRuns}.`);
  }
}

function analyzeAllocations(benchmark, fixture) {
  const samples = benchmark.allocationSamples;
  const summary = benchmark.allocationSummary;
  const average = divideAllocationStats(summary, samples.length);
  return {
    samples,
    summary,
    averagePerRun: average,
    shapeSamples: benchmark.shapeSamples,
    shapeSummary: benchmark.shapeSummary,
    shapeAveragePerRun: divideAllocationStats(benchmark.shapeSummary, samples.length),
    operationsPerEvent: average.allocationOperations / benchmark.eventCount,
    totalAllocatedBytesPerMiB: average.totalAllocatedBytes / fixture.sizeMiB,
    caveats: [
      'Counters start after warmup and immediately before the measured consume call, then stop immediately after consume returns.',
      'The counter is process-global inside this single-threaded comparator binary, so it counts allocator calls made by Rust/quick-xml during the measured window.',
      'The counter has no stack attribution, allocator object type attribution, or object lifetime information.',
      'Escaped XML text rows use the comparator decode boundary and do not unescape entities before checksum folding.',
      'The timed throughput row includes allocator counter overhead and must not replace the non-instrumented quick-xml speed baseline.',
    ],
  };
}

function divideAllocationStats(stats, divisor) {
  const copy = {};
  for (const [key, value] of Object.entries(stats)) {
    copy[key] = typeof value === 'number' ? value / divisor : value;
  }
  return copy;
}

function createFindings(benchmark, allocation, variants) {
  const findings = [
    {
      id: 'same-contract-result',
      classification: 'BENCH_FACT',
      summary: 'The allocation-count run preserved the shared full-string checksum contract.',
      evidence: [
        `events=${benchmark.eventCount}`,
        `checksum=${benchmark.checksum}`,
        `instrumentedThroughput=${benchmark.mibPerSec.toFixed(1)} MiB/s`,
      ],
    },
    {
      id: 'measured-allocation-counters',
      classification: 'TRACE_FACT',
      summary: 'The comparator emitted exact global allocator call counters for each measured consume run.',
      evidence: [
        `allocationSamples=${allocation.samples.length}`,
        `avgAllocationOperations=${allocation.averagePerRun.allocationOperations.toFixed(1)}`,
        `avgTotalAllocatedBytes=${formatBytes(allocation.averagePerRun.totalAllocatedBytes)}`,
        `avgNetAllocatedBytes=${formatBytes(allocation.averagePerRun.netAllocatedBytes)}`,
      ],
    },
    {
      id: 'cow-ownership-counters',
      classification: 'TRACE_FACT',
      summary: 'The measured run counted quick-xml text and CDATA decode ownership at the Cow<str> boundary.',
      evidence: [
        `avgDecodeCount=${allocation.shapeAveragePerRun.totalDecodeCount.toFixed(1)}`,
        `avgBorrowedCount=${allocation.shapeAveragePerRun.totalBorrowedCount.toFixed(1)}`,
        `avgOwnedCount=${allocation.shapeAveragePerRun.totalOwnedCount.toFixed(1)}`,
      ],
    },
    {
      id: 'not-js-object-shape',
      classification: 'SOURCE_FACT_LINK',
      summary: 'The measured binary still uses the Rust quick-xml comparator shape, not JavaScript public event objects.',
      evidence: [
        'Pair this report with quick-xml-shape-audit.md for Event lifetime, Cow byte/string, and attribute Vec source facts.',
      ],
    },
    {
      id: 'not-stack-or-lifetime-proof',
      classification: 'LIMITATION',
      summary: 'The counter does not prove allocation stacks, allocator object types, or object lifetimes.',
      evidence: allocation.caveats,
    },
  ];
  if (variants.length > 0) {
    findings.splice(3, 0, {
      id: 'variant-cow-ownership-counters',
      classification: 'TRACE_FACT',
      summary: 'Generated UTF-8 fixture variants also counted quick-xml text and CDATA decode ownership at the Cow<str> boundary.',
      evidence: variants.map(variant => (
        `${variant.id}: decode=${variant.allocation.shapeSummary.totalDecodeCount}, borrowed=${variant.allocation.shapeSummary.totalBorrowedCount}, owned=${variant.allocation.shapeSummary.totalOwnedCount}`
      )),
    });
  }
  return findings;
}

function ensureFixture(options) {
  if (!existsSync(options.file) && !options.fileExplicit) {
    generateXmlFile(options.file, 16 * MIB);
  }
  if (!existsSync(options.file)) {
    throw new Error(`Benchmark fixture does not exist: ${options.file}`);
  }
}

function ensureQuickXmlBinary(options) {
  if (options.skipBuild && existsSync(quickXmlExe)) return;
  const result = runCommand('cargo', [
    'build',
    '--release',
    '--features',
    'count-allocations',
    '--manifest-path',
    join(quickXmlDir, 'Cargo.toml'),
  ], repoRoot);
  if (result.error) throw result.error;
  if (result.status !== 0 || !existsSync(quickXmlExe)) {
    throw new Error(`cargo build failed for quick-xml comparator: ${trimSpawnOutput(result)}`);
  }
}

function generateXmlFile(filePath, targetBytes) {
  mkdirSync(dirname(filePath), { recursive: true });
  const fd = openSync(filePath, 'w');
  const header = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<root>\n');
  const footer = Buffer.from('</root>\n');
  const pending = [];
  let pendingBytes = 0;
  let written = 0;
  let id = 0;

  try {
    writeSync(fd, header);
    written += header.byteLength;
    while (written + pendingBytes + footer.byteLength < targetBytes) {
      const element = Buffer.from(makeBookElement(id));
      if (written + pendingBytes + element.byteLength + footer.byteLength > targetBytes) break;
      pending.push(element);
      pendingBytes += element.byteLength;
      id++;
      if (pendingBytes >= MIB) {
        writeSync(fd, Buffer.concat(pending, pendingBytes));
        written += pendingBytes;
        pending.length = 0;
        pendingBytes = 0;
      }
    }
    if (pendingBytes > 0) {
      writeSync(fd, Buffer.concat(pending, pendingBytes));
    }
    writeSync(fd, footer);
  } finally {
    closeSync(fd);
  }
}

function makeBookElement(id) {
  return `  <book id="book-${id}" lang="en" code="${id % 97}">`
    + `<title>Runtime Benchmark ${id}</title>`
    + `<author>Author ${id % 4096}</author>`
    + `<description>Full string checksum text payload ${id} with stable words and numbers.</description>`
    + `<chapter number="1">Intro ${id}</chapter>`
    + `<chapter number="2">Body ${id}</chapter>`
    + '</book>\n';
}

function generateVariantFixtures(options) {
  mkdirSync(variantFixtureDir, { recursive: true });
  const specs = [
    {
      id: 'escaped-utf8',
      description: 'UTF-8 text with XML entity spellings in text and attributes; comparator decodes but does not unescape.',
      row: id => `  <entry id="e-${id}" note="A &amp; B ${id}"><text>Escaped &amp; entity &lt;tag&gt; &quot;quote&quot; ${id}</text></entry>\n`,
    },
    {
      id: 'nonascii-utf8',
      description: 'UTF-8 text with Korean, Japanese, Greek, and emoji code points.',
      row: id => `  <entry id="n-${id}" lang="ko"><text>한글 일본어 日本語 Ελληνικά emoji 😀 ${id}</text></entry>\n`,
    },
    {
      id: 'cdata-utf8',
      description: 'UTF-8 CDATA sections with markup-looking payload.',
      row: id => `  <entry id="c-${id}"><![CDATA[CDATA payload <tag attr="value"> & raw-ish text ${id}]]></entry>\n`,
    },
    {
      id: 'utf8-bom',
      description: 'UTF-8 document with BOM and non-ASCII text.',
      bom: true,
      row: id => `  <entry id="b-${id}"><text>BOM UTF-8 café 한글 ${id}</text></entry>\n`,
    },
  ];

  return specs.map((spec) => {
    const path = join(variantFixtureDir, `quick-xml-${spec.id}.xml`);
    writeVariantFixture(path, spec, options.variantSizeBytes);
    return {
      id: spec.id,
      description: spec.description,
      path,
      source: 'generated',
    };
  });
}

function writeVariantFixture(path, spec, targetBytes) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
  let id = 0;
  while (Buffer.byteLength(xml, 'utf8') < targetBytes) {
    xml += spec.row(id);
    id++;
  }
  xml += '</root>\n';
  const payload = Buffer.from(xml, 'utf8');
  const content = spec.bom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), payload]) : payload;
  writeFileSync(path, content);
}

function renderMarkdown(report) {
  const lines = [
    '# quick-xml Measured Allocation Count',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.options.includeVariants
      ? 'This report is a TRACE_FACT for one Rust + quick-xml binary, one primary XML fixture, and generated UTF-8 fixture variants.'
      : 'This report is a TRACE_FACT for one Rust + quick-xml binary and one XML fixture.',
    'It counts Rust global allocator calls only inside measured `consume()` windows after warmup.',
    'It preserves the same high-level data/checksum contract, but it is not a JavaScript object-shape row and not a speed baseline.',
    '',
    '## Environment',
    '',
    `- Rust: ${report.environment.rustc}`,
    `- Cargo: ${report.environment.cargo}`,
    `- Platform: ${report.environment.platform}`,
    `- CPU: ${report.environment.cpuName}`,
    `- Fixture: ${report.fixture.path ?? report.fixture.source}`,
    `- Fixture size: ${report.fixture.sizeMiB.toFixed(2)} MiB`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    `- Variant matrix: ${report.options.includeVariants ? 'yes' : 'no'}`,
    '',
    '## Benchmark Result',
    '',
    '| Runtime | Instrumented throughput | Average | Events | Checksum |',
    '| --- | ---: | ---: | ---: | ---: |',
    `| ${escapePipe(report.benchmark.runtime)} | ${report.benchmark.mibPerSec.toFixed(1)} MiB/s | ${report.benchmark.avgMs.toFixed(2)} ms | ${report.benchmark.eventCount} | ${report.benchmark.checksum} |`,
    '',
    '## Allocation Counts',
    '',
    '| Metric | Total | Average per run |',
    '| --- | ---: | ---: |',
    allocationRow('allocCount', report),
    allocationRow('allocBytes', report, formatBytes),
    allocationRow('deallocCount', report),
    allocationRow('deallocBytes', report, formatBytes),
    allocationRow('reallocCount', report),
    allocationRow('reallocBytesIn', report, formatBytes),
    allocationRow('reallocBytesOut', report, formatBytes),
    allocationRow('allocationOperations', report),
    allocationRow('totalAllocatedBytes', report, formatBytes),
    allocationRow('totalReleasedBytes', report, formatBytes),
    allocationRow('netAllocatedBytes', report, formatBytes),
    '',
    `Average allocation operations per event: ${report.allocation.operationsPerEvent.toExponential(3)}.`,
    `Average allocated bytes per fixture MiB: ${formatBytes(report.allocation.totalAllocatedBytesPerMiB)}.`,
    '',
    '## Cow Ownership Counts',
    '',
    '| Metric | Total | Average per run |',
    '| --- | ---: | ---: |',
    shapeRow('textDecodeCount', report),
    shapeRow('textBorrowedCount', report),
    shapeRow('textOwnedCount', report),
    shapeRow('textNonEmptyCount', report),
    shapeRow('cdataDecodeCount', report),
    shapeRow('cdataBorrowedCount', report),
    shapeRow('cdataOwnedCount', report),
    shapeRow('cdataNonEmptyCount', report),
    shapeRow('totalDecodeCount', report),
    shapeRow('totalBorrowedCount', report),
    shapeRow('totalOwnedCount', report),
    shapeRow('totalNonEmptyCount', report),
    '',
    ...renderVariantSection(report),
    '## Caveats',
    '',
    ...report.allocation.caveats.map(caveat => `- ${caveat}`),
    '',
    '## Findings',
    '',
    ...report.findings.flatMap(finding => [
      `- ${finding.id} (${finding.classification}): ${finding.summary}`,
      ...finding.evidence.map(entry => `  - ${entry}`),
    ]),
    '',
  ];
  return lines.join('\n');
}

function renderVariantSection(report) {
  if (!report.variants.length) return [];
  return [
    '## Generated Fixture Variants',
    '',
    'These rows use the same quick-xml comparator contract on generated UTF-8 fixtures. They are counterchecks for the `Cow<str>` boundary, not replacements for the 16 MiB external baseline.',
    '',
    '| Variant | Fixture size | Instrumented throughput | Events | Checksum | Decode | Borrowed | Owned | Allocation ops | Notes |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...report.variants.map(variant => {
      const shape = variant.allocation.shapeSummary;
      return `| ${variant.id} | ${variant.fixture.sizeMiB.toFixed(2)} MiB | ${variant.benchmark.mibPerSec.toFixed(1)} MiB/s | ${variant.benchmark.eventCount} | ${variant.benchmark.checksum} | ${shape.totalDecodeCount} | ${shape.totalBorrowedCount} | ${shape.totalOwnedCount} | ${variant.allocation.summary.allocationOperations} | ${escapePipe(variant.description)} |`;
    }),
    '',
  ];
}

function allocationRow(key, report, formatter = formatNumber) {
  return `| ${key} | ${formatter(report.allocation.summary[key])} | ${formatter(report.allocation.averagePerRun[key])} |`;
}

function shapeRow(key, report) {
  return `| ${key} | ${formatNumber(report.allocation.shapeSummary[key])} | ${formatNumber(report.allocation.shapeAveragePerRun[key])} |`;
}

function runCommandChecked(command, args, cwd) {
  const result = runCommand(command, args, cwd);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${trimSpawnOutput(result)}`);
  return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
}

function runCommand(command, args, cwd) {
  if (process.platform === 'win32' && command === 'cargo') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', formatWindowsCommand(command, args)], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 256 * 1024 * 1024,
    });
  }
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  });
}

function formatWindowsCommand(command, args) {
  return [command, ...args].map(quoteWindowsArg).join(' ');
}

function quoteWindowsArg(value) {
  if (/^[A-Za-z0-9_./:=\\+\-]+$/.test(value)) {
    return value;
  }
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
}

function firstLine(text) {
  return String(text).split(/\r?\n/).find(Boolean) ?? 'unknown';
}

function formatBytes(bytes) {
  const sign = bytes < 0 ? '-' : '';
  const absBytes = Math.abs(bytes);
  if (absBytes >= MIB) return `${sign}${(absBytes / MIB).toFixed(2)} MiB`;
  if (absBytes >= 1024) return `${sign}${(absBytes / 1024).toFixed(1)} KiB`;
  return `${sign}${absBytes.toFixed(0)} B`;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return 'n/a';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

function trimSpawnOutput(result) {
  return String(result.stderr || result.stdout || result.error?.message || '').trim();
}

function escapePipe(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function printSummary(report) {
  console.log('quick-xml allocation count');
  console.log(`throughput=${report.benchmark.mibPerSec.toFixed(1)} MiB/s events=${report.benchmark.eventCount} checksum=${report.benchmark.checksum}`);
  console.log(`allocationOperations=${formatNumber(report.allocation.summary.allocationOperations)} totalAllocated=${formatBytes(report.allocation.summary.totalAllocatedBytes)} netAllocated=${formatBytes(report.allocation.summary.netAllocatedBytes)}`);
}

main();
