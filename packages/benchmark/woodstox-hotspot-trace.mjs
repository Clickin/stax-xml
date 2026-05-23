import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultFile = join(__dirname, 'test-data', 'runtime-comparison-16mib.xml');
const woodstoxDir = join(__dirname, 'external', 'woodstox');
const woodstoxJar = join(woodstoxDir, 'target', 'woodstox-baseline-1.0.0-bench.jar');
const defaultRawOut = join(__dirname, 'results', 'woodstox-hotspot', 'woodstox-hotspot-trace.log');
const defaultJsonOut = join(__dirname, 'results', 'release', 'woodstox-hotspot-trace.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'woodstox-hotspot-trace.md');

const traceFlags = [
  '-XX:+UnlockDiagnosticVMOptions',
  '-XX:+PrintCompilation',
  '-XX:+PrintInlining',
  '-XX:CompileThreshold=100',
];
const keyPatterns = [
  ['consume', /WoodstoxBench::consume|com\.staxxml\.benchmark\.WoodstoxBench::consume/g],
  ['foldString', /WoodstoxBench::foldString|com\.staxxml\.benchmark\.WoodstoxBench::foldString/g],
  ['readerNext', /XMLStreamReader::next|BasicStreamReader::next|StreamScanner::next/g],
  ['getLocalName', /getLocalName/g],
  ['getAttributeLocalName', /getAttributeLocalName/g],
  ['getAttributeValue', /getAttributeValue/g],
  ['getText', /getText/g],
  ['woodstoxInternal', /com\.ctc\.wstx|Wstx|BasicStreamReader|StreamScanner|TextBuffer/g],
  ['inline', /\binline\b/g],
  ['notInline', /not inline|callee is too large|too big|no static binding|virtual call|not compilable/g],
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    runs: 1,
    warmups: 4,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    rawOut: defaultRawOut,
    fileExplicit: false,
    skipBuild: false,
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
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      case '--raw-out':
        options.rawOut = resolve(process.cwd(), readValue());
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
  const report = options.selfTest ? createSelfTestReport(options) : runHotSpotTrace(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function createSelfTestReport(options) {
  const rawLog = [
    '     91  141       4       com.staxxml.benchmark.WoodstoxBench::consume (326 bytes)',
    '                              @ 75   com.ctc.wstx.stax.WstxInputFactory::createXMLStreamReader (16 bytes)   inline',
    '                              @ 113   com.ctc.wstx.sr.BasicStreamReader::getLocalName (12 bytes)   inline',
    '                              @ 139   com.ctc.wstx.sr.BasicStreamReader::getAttributeLocalName (18 bytes)   inline',
    '                              @ 148   com.ctc.wstx.sr.BasicStreamReader::getAttributeValue (20 bytes)   inline',
    '                              @ 186   com.ctc.wstx.sr.BasicStreamReader::getText (26 bytes)   callee is too large',
    '                              @ 250   com.ctc.wstx.sr.BasicStreamReader::next (22 bytes)   inline',
    '{"runtime":"1.8.0_472","avgMs":42.0,"minMs":41.0,"maxMs":43.0,"mibPerSec":381.0,"eventCount":276,"checksum":812383466,"samplesMs":[42.0]}',
  ].join('\n');
  return createReport({
    options,
    rawLog,
    javaVersionText: 'openjdk version "1.8.0_472"\nOpenJDK 64-Bit Server VM (Temurin)(build 25.472-b08, mixed mode)',
    fixture: {
      path: null,
      sizeBytes: 12345,
      sizeMiB: 12345 / MIB,
      source: 'self-test',
    },
    command: ['java', ...traceFlags, '-jar', 'woodstox-baseline-1.0.0-bench.jar'],
    rawArtifact: {
      path: options.rawOut,
      committed: false,
    },
    elapsedMs: 0,
  });
}

function runHotSpotTrace(options) {
  ensureFixture(options);
  ensureWoodstoxJar(options);

  const javaVersion = runCommand('java', ['-version'], repoRoot);
  const args = [
    ...traceFlags,
    '-jar',
    woodstoxJar,
    '--file',
    options.file,
    '--runs',
    String(options.runs),
    '--warmups',
    String(options.warmups),
  ];
  const startedAt = Date.now();
  const result = runCommand('java', args, repoRoot);
  const elapsedMs = Date.now() - startedAt;
  const rawLog = [
    `$ ${['java', ...args].join(' ')}`,
    `cwd=${repoRoot}`,
    `exit=${result.status} elapsedMs=${elapsedMs}`,
    '',
    '--- stdout ---',
    result.stdout ?? '',
    '',
    '--- stderr ---',
    result.stderr ?? '',
  ].join('\n');
  writeOutput(options.rawOut, rawLog);

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`woodstox hotspot trace failed. See ${options.rawOut}`);
  }

  const stats = statSync(options.file);
  return createReport({
    options,
    rawLog,
    javaVersionText: `${javaVersion.stdout ?? ''}\n${javaVersion.stderr ?? ''}`.trim(),
    fixture: {
      path: options.file,
      sizeBytes: stats.size,
      sizeMiB: stats.size / MIB,
      source: 'file',
    },
    command: ['java', ...args],
    rawArtifact: {
      path: options.rawOut,
      committed: false,
    },
    elapsedMs,
  });
}

function ensureFixture(options) {
  if (!existsSync(options.file) && !options.fileExplicit) {
    generateXmlFile(options.file, 16 * MIB);
  }
  if (!existsSync(options.file)) {
    throw new Error(`Benchmark fixture does not exist: ${options.file}`);
  }
}

function ensureWoodstoxJar(options) {
  if (options.skipBuild && existsSync(woodstoxJar)) return;
  const result = runCommand('mvn', ['-q', '-DskipTests', 'package'], woodstoxDir);
  if (result.error) throw result.error;
  if (result.status !== 0 || !existsSync(woodstoxJar)) {
    throw new Error(`mvn package failed for Woodstox comparator: ${String(result.stderr || result.stdout).trim()}`);
  }
}

function createReport({ options, rawLog, javaVersionText, fixture, command, rawArtifact, elapsedMs }) {
  const benchmark = extractBenchmarkJson(rawLog);
  const analysis = analyzeHotSpotLog(rawLog);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'woodstox-hotspot-trace',
    contract: 'hotspot-printcompilation-printinlining',
    note: 'HotSpot compilation/inlining trace for Java + Woodstox comparator. This is not an allocation profile or a proof of Woodstox internal object lifetime.',
    environment: {
      java: firstLine(javaVersionText),
      javaVersionText,
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
    },
    fixture,
    options: {
      runs: options.runs,
      warmups: options.warmups,
      traceFlags,
    },
    command: {
      cwd: repoRoot,
      argv: command,
      elapsedMs,
    },
    rawArtifact,
    benchmark,
    analysis,
    findings: createFindings(benchmark, analysis),
  };
}

function extractBenchmarkJson(rawLog) {
  const matches = [...rawLog.matchAll(/\{"runtime":.+?\}/gs)].map(match => match[0]);
  if (matches.length === 0) {
    throw new Error('Woodstox benchmark JSON was not found in HotSpot trace output.');
  }
  return JSON.parse(matches[matches.length - 1]);
}

function analyzeHotSpotLog(rawLog) {
  const lines = rawLog.split(/\r?\n/);
  const compilationLines = lines.filter(line => /^\s*\d+\s+\d+/.test(line));
  const inliningLines = lines.filter(line => /@ \d+/.test(line));
  const keyCounts = Object.fromEntries(keyPatterns.map(([name]) => [name, 0]));
  for (const line of lines) {
    for (const [name, pattern] of keyPatterns) {
      keyCounts[name] += countMatches(line, pattern);
    }
  }
  const keyInliningLines = lines
    .filter(line => /WoodstoxBench::(?:consume|foldString)|XMLStreamReader::next|WstxInputFactory::createXMLStreamReader|BasicStreamReader::(?:next|getLocalName|getAttributeLocalName|getAttributeValue|getText)|StreamScanner::next/.test(line))
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 80);
  const notInlineLines = keyInliningLines.filter(line => /not inline|callee is too large|too big|no static binding|virtual call|not compilable/.test(line));

  return {
    compilationLineCount: compilationLines.length,
    inliningLineCount: inliningLines.length,
    keyCounts,
    woodstoxBenchConsumeCompilationCount: countMatches(rawLog, /WoodstoxBench::consume/g),
    keyInliningLines,
    notInlineLines,
    hasPrintInliningEvidence: inliningLines.length > 0 && keyInliningLines.length > 0,
  };
}

function createFindings(benchmark, analysis) {
  return [
    {
      id: 'same-contract-result',
      summary: 'Woodstox trace run preserved the full-string checksum benchmark result.',
      evidence: [
        `events=${benchmark.eventCount}`,
        `checksum=${benchmark.checksum}`,
        `throughput=${benchmark.mibPerSec.toFixed(1)} MiB/s`,
      ],
    },
    {
      id: 'hotspot-inlining-visible',
      summary: 'HotSpot emitted compilation/inlining lines for the Woodstox comparator boundary.',
      evidence: [
        `compilationLines=${analysis.compilationLineCount}`,
        `inliningLines=${analysis.inliningLineCount}`,
        `consumeMentions=${analysis.keyCounts.consume}`,
        `woodstoxInternalMentions=${analysis.keyCounts.woodstoxInternal}`,
      ],
    },
    {
      id: 'allocation-still-missing',
      summary: 'PrintCompilation/PrintInlining does not prove allocation behavior or borrowed/owned string lifetimes.',
      evidence: [
        'Need JFR, async-profiler, or equivalent allocation sampling before attributing Woodstox speed to allocation shape.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Woodstox HotSpot Trace',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report is a TRACE_FACT for one Java/HotSpot build and one XML fixture.',
    'It captures `PrintCompilation` and `PrintInlining` for the Java + Woodstox comparator.',
    'It is not an allocation profile and does not prove Woodstox string/object lifetime behavior.',
    '',
    '## Environment',
    '',
    `- Java: ${report.environment.java}`,
    `- Platform: ${report.environment.platform}`,
    `- CPU: ${report.environment.cpuName}`,
    `- Fixture: ${report.fixture.path ?? report.fixture.source}`,
    `- Fixture size: ${report.fixture.sizeMiB.toFixed(2)} MiB`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    `- Raw trace: ${report.rawArtifact.path}`,
    `- Raw trace committed: ${report.rawArtifact.committed ? 'yes' : 'no'}`,
    '',
    '## Benchmark Result',
    '',
    '| Runtime | Throughput | Average | Events | Checksum |',
    '| --- | ---: | ---: | ---: | ---: |',
    `| ${escapePipe(report.benchmark.runtime)} | ${report.benchmark.mibPerSec.toFixed(1)} MiB/s | ${report.benchmark.avgMs.toFixed(2)} ms | ${report.benchmark.eventCount} | ${report.benchmark.checksum} |`,
    '',
    '## HotSpot Trace Summary',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| Compilation lines | ${report.analysis.compilationLineCount} |`,
    `| Inlining lines | ${report.analysis.inliningLineCount} |`,
    `| WoodstoxBench.consume mentions | ${report.analysis.keyCounts.consume} |`,
    `| Woodstox internal mentions | ${report.analysis.keyCounts.woodstoxInternal} |`,
    `| Key non-inline lines | ${report.analysis.notInlineLines.length} |`,
    `| PrintInlining evidence | ${report.analysis.hasPrintInliningEvidence ? 'yes' : 'no'} |`,
    '',
    '## Key Inlining Lines',
    '',
    ...report.analysis.keyInliningLines.slice(0, 30).map(line => `- ${line}`),
    '',
    '## Findings',
    '',
    ...report.findings.flatMap(finding => [
      `- ${finding.id}: ${finding.summary}`,
      ...finding.evidence.map(entry => `  - ${entry}`),
    ]),
    '',
  ];
  return lines.join('\n');
}

function runCommand(command, args, cwd) {
  if (process.platform === 'win32' && command === 'mvn') {
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

function countMatches(text, pattern) {
  pattern.lastIndex = 0;
  let count = 0;
  while (pattern.exec(text) !== null) count++;
  return count;
}

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
}

function firstLine(text) {
  return String(text).split(/\r?\n/).find(Boolean) ?? 'unknown';
}

function escapePipe(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function printSummary(report) {
  console.log('Woodstox HotSpot trace');
  console.log(`throughput=${report.benchmark.mibPerSec.toFixed(1)} MiB/s events=${report.benchmark.eventCount} checksum=${report.benchmark.checksum}`);
  console.log(`compilationLines=${report.analysis.compilationLineCount} inliningLines=${report.analysis.inliningLineCount} consumeMentions=${report.analysis.keyCounts.consume}`);
}

main();
