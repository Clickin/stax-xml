import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultFile = join(__dirname, 'test-data', 'runtime-comparison-16mib.xml');
const woodstoxDir = join(__dirname, 'external', 'woodstox');
const woodstoxJar = join(woodstoxDir, 'target', 'woodstox-baseline-1.0.0-bench.jar');
const defaultRawJfrOut = join(__dirname, 'results', 'woodstox-jfr', 'woodstox-allocation.jfr');
const defaultRawEventsJsonOut = join(__dirname, 'results', 'woodstox-jfr', 'woodstox-allocation-events.json');
const defaultJsonOut = join(__dirname, 'results', 'release', 'woodstox-jfr-allocation.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'woodstox-jfr-allocation.md');
const allocationEvents = 'ObjectAllocationInNewTLAB,ObjectAllocationOutsideTLAB';

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    runs: 1,
    warmups: 4,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    rawJfrOut: defaultRawJfrOut,
    rawEventsJsonOut: defaultRawEventsJsonOut,
    stackDepth: 32,
    recordingMode: 'process',
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
      case '--raw-jfr-out':
        options.rawJfrOut = resolve(process.cwd(), readValue());
        break;
      case '--raw-events-json-out':
        options.rawEventsJsonOut = resolve(process.cwd(), readValue());
        break;
      case '--stack-depth':
        options.stackDepth = parsePositiveInteger(readValue(), name);
        break;
      case '--recording-mode': {
        const value = readValue();
        if (!['process', 'measured'].includes(value)) {
          throw new Error('--recording-mode must be one of process, measured.');
        }
        options.recordingMode = value;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.recordingMode === 'measured' && options.runs !== 1) {
    throw new Error('--recording-mode=measured currently requires --runs 1.');
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
  const report = options.selfTest ? createSelfTestReport(options) : runJfrAllocation(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function createSelfTestReport(options) {
  const fixture = {
    path: null,
    sizeBytes: 12345,
    sizeMiB: 12345 / MIB,
    source: 'self-test',
  };
  const benchmark = {
    runtime: '1.8.0_472',
    avgMs: 42.0,
    minMs: 41.0,
    maxMs: 43.0,
    mibPerSec: 381.0,
    eventCount: 276,
    checksum: 812383466,
    samplesMs: [42.0],
  };
  const rawEvents = {
    recording: {
      events: [
        fakeAllocationEvent('[C', 40, [
          ['java/util/Arrays', 'copyOfRange'],
          ['java/lang/String', '<init>'],
          ['com/ctc/wstx/util/TextBuffer', 'contentsAsString'],
          ['com/ctc/wstx/sr/BasicStreamReader', 'getText'],
          ['com/staxxml/benchmark/WoodstoxBench', 'consume'],
        ]),
        fakeAllocationEvent('java/lang/String', 24, [
          ['com/ctc/wstx/util/TextBuilder', 'getAllValues'],
          ['com/ctc/wstx/sr/AttributeCollector', 'getValue'],
          ['com/ctc/wstx/sr/BasicStreamReader', 'getAttributeValue'],
          ['com/staxxml/benchmark/WoodstoxBench', 'consume'],
        ]),
        fakeAllocationEvent('com/ctc/wstx/sr/Attribute', 32, [
          ['com/ctc/wstx/sr/BasicStreamReader', 'nextFromTree'],
          ['com/ctc/wstx/sr/BasicStreamReader', 'next'],
          ['com/staxxml/benchmark/WoodstoxBench', 'consume'],
        ]),
        fakeAllocationEvent('java/lang/String', 24, [], 'C1 CompilerThread0'),
      ],
    },
  };

  return createReport({
    options,
    javaVersionText: 'openjdk version "1.8.0_472"\nOpenJDK 64-Bit Server VM (Temurin)(build 25.472-b08, mixed mode)',
    fixture,
    command: selfTestCommand(options),
    rawArtifacts: {
      jfr: { path: options.rawJfrOut, committed: false },
      allocationEventsJson: { path: options.rawEventsJsonOut, committed: false },
    },
    elapsedMs: 0,
    benchmark,
    jfrSummaryText: [
      ' Event Type                            Count  Size (bytes)',
      '===========================================================',
      ' jdk.ObjectAllocationInNewTLAB             4           128',
      ' jdk.ObjectAllocationOutsideTLAB           0             0',
    ].join('\n'),
    rawEvents,
  });
}

function selfTestCommand(options) {
  if (options.recordingMode === 'measured') {
    return ['java', '-XX:+FlightRecorder', '-jar', 'woodstox-baseline-1.0.0-bench.jar', '--measured-jfr-out', 'self-test.jfr'];
  }
  return ['java', '-XX:+FlightRecorder', '-XX:StartFlightRecording=filename=self-test.jfr,settings=profile,dumponexit=true', '-jar', 'woodstox-baseline-1.0.0-bench.jar'];
}

function fakeAllocationEvent(className, allocationSize, frames, threadName = 'main') {
  return {
    type: 'jdk.ObjectAllocationInNewTLAB',
    values: {
      eventThread: { javaName: threadName },
      stackTrace: {
        truncated: false,
        frames: frames.map(([typeName, methodName]) => ({
          method: {
            type: { name: typeName },
            name: methodName,
          },
          lineNumber: 1,
          bytecodeIndex: 0,
          type: 'JIT compiled',
        })),
      },
      objectClass: { name: className },
      allocationSize,
      tlabSize: 1024,
    },
  };
}

function runJfrAllocation(options) {
  ensureFixture(options);
  ensureWoodstoxJar(options);
  mkdirSync(dirname(options.rawJfrOut), { recursive: true });
  mkdirSync(dirname(options.rawEventsJsonOut), { recursive: true });
  removeIfExists(options.rawJfrOut);
  removeIfExists(options.rawEventsJsonOut);

  const javaVersion = runCommand('java', ['-version'], repoRoot);
  const args = createJavaArgs(options);
  const startedAt = Date.now();
  const result = runCommand('java', args, repoRoot);
  const elapsedMs = Date.now() - startedAt;
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`woodstox JFR allocation run failed: ${trimSpawnOutput(result)}`);
  }
  if (!existsSync(options.rawJfrOut)) {
    throw new Error(`woodstox JFR allocation run did not write ${options.rawJfrOut}`);
  }

  const summary = runCommand('jfr', ['summary', options.rawJfrOut], repoRoot);
  if (summary.error) throw summary.error;
  if (summary.status !== 0) {
    throw new Error(`jfr summary failed: ${trimSpawnOutput(summary)}`);
  }

  const printed = runCommand('jfr', [
    'print',
    '--json',
    '--events',
    allocationEvents,
    '--stack-depth',
    String(options.stackDepth),
    options.rawJfrOut,
  ], repoRoot);
  if (printed.error) throw printed.error;
  if (printed.status !== 0) {
    throw new Error(`jfr print allocation events failed: ${trimSpawnOutput(printed)}`);
  }
  writeOutput(options.rawEventsJsonOut, printed.stdout ?? '');

  const rawEvents = JSON.parse(printed.stdout || '{"recording":{"events":[]}}');
  const benchmark = extractBenchmarkJson(result.stdout ?? '');
  const stats = statSync(options.file);
  return createReport({
    options,
    javaVersionText: `${javaVersion.stdout ?? ''}\n${javaVersion.stderr ?? ''}`.trim(),
    fixture: {
      path: options.file,
      sizeBytes: stats.size,
      sizeMiB: stats.size / MIB,
      source: 'file',
    },
    command: ['java', ...args],
    rawArtifacts: {
      jfr: { path: options.rawJfrOut, committed: false },
      allocationEventsJson: { path: options.rawEventsJsonOut, committed: false },
    },
    elapsedMs,
    benchmark,
    jfrSummaryText: summary.stdout ?? '',
    rawEvents,
  });
}

function createJavaArgs(options) {
  const args = [
    '-XX:+FlightRecorder',
    `-XX:FlightRecorderOptions=stackdepth=${options.stackDepth}`,
  ];
  if (options.recordingMode === 'process') {
    const recordingOption = `filename=${options.rawJfrOut},settings=profile,dumponexit=true`;
    args.push(`-XX:StartFlightRecording=${recordingOption}`);
  }
  args.push(
    '-jar',
    woodstoxJar,
    '--file',
    options.file,
    '--runs',
    String(options.runs),
    '--warmups',
    String(options.warmups),
  );
  if (options.recordingMode === 'measured') {
    args.push('--measured-jfr-out', options.rawJfrOut);
  }
  return args;
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
    throw new Error(`mvn package failed for Woodstox comparator: ${trimSpawnOutput(result)}`);
  }
}

function createReport({ options, javaVersionText, fixture, command, rawArtifacts, elapsedMs, benchmark, jfrSummaryText, rawEvents }) {
  const analysis = analyzeAllocationEvents(rawEvents);
  const jfrSummary = parseJfrSummary(jfrSummaryText);
  return {
    generatedAt: new Date().toISOString(),
    objective: options.recordingMode === 'measured' ? 'woodstox-measured-jfr-allocation' : 'woodstox-jfr-allocation',
    contract: options.recordingMode === 'measured' ? 'jfr-measured-allocation-sampling' : 'jfr-allocation-sampling',
    note: options.recordingMode === 'measured'
      ? 'JFR allocation events for one measured Java + Woodstox consume run after warmup. This is sampled allocation evidence, not a deterministic allocation census or a proof of all Woodstox object lifetimes.'
      : 'JFR allocation events for the Java + Woodstox comparator process. This is process-level sampled allocation evidence, not a deterministic allocation census or a proof of all Woodstox object lifetimes.',
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
      stackDepth: options.stackDepth,
      jfrSettings: 'profile',
      recordingMode: options.recordingMode,
      allocationEvents,
    },
    command: {
      cwd: repoRoot,
      argv: command,
      elapsedMs,
    },
    rawArtifacts,
    benchmark,
    jfrSummary,
    allocation: analysis,
    findings: createFindings(benchmark, analysis, options.recordingMode),
  };
}

function parseJfrSummary(text) {
  const eventCounts = {};
  for (const line of String(text).split(/\r?\n/)) {
    const match = line.match(/^\s+(jdk\.[A-Za-z0-9]+)\s+(\d+)\s+(\d+)/);
    if (!match) continue;
    eventCounts[match[1]] = {
      count: Number(match[2]),
      sizeBytes: Number(match[3]),
    };
  }
  return {
    allocationEventCounts: {
      ObjectAllocationInNewTLAB: eventCounts['jdk.ObjectAllocationInNewTLAB']?.count ?? 0,
      ObjectAllocationOutsideTLAB: eventCounts['jdk.ObjectAllocationOutsideTLAB']?.count ?? 0,
    },
    eventCounts,
  };
}

function analyzeAllocationEvents(rawEvents) {
  const events = (rawEvents?.recording?.events ?? [])
    .filter(event => /ObjectAllocation(?:InNewTLAB|OutsideTLAB)$/.test(event.type));
  const samples = events.map(normalizeAllocationEvent);
  const mainThreadSamples = samples.filter(sample => sample.threadName === 'main');
  const consumeStackSamples = samples.filter(sample => sample.stack.some(frame => frame.className === 'com.staxxml.benchmark.WoodstoxBench' && frame.methodName === 'consume'));
  const woodstoxStackSamples = samples.filter(sample => sample.stack.some(frame => frame.className.startsWith('com.ctc.wstx.')));
  const stringBoundarySamples = consumeStackSamples.filter(isStringBoundarySample);

  return {
    eventCount: samples.length,
    sampledBytes: sum(samples.map(sample => sample.allocationSize)),
    mainThreadEventCount: mainThreadSamples.length,
    mainThreadSampledBytes: sum(mainThreadSamples.map(sample => sample.allocationSize)),
    consumeStackEventCount: consumeStackSamples.length,
    consumeStackSampledBytes: sum(consumeStackSamples.map(sample => sample.allocationSize)),
    woodstoxStackEventCount: woodstoxStackSamples.length,
    woodstoxStackSampledBytes: sum(woodstoxStackSamples.map(sample => sample.allocationSize)),
    stringBoundaryEventCount: stringBoundarySamples.length,
    stringBoundarySampledBytes: sum(stringBoundarySamples.map(sample => sample.allocationSize)),
    topClasses: topClassSummary(samples),
    topConsumeClasses: topClassSummary(consumeStackSamples),
    keySamples: consumeStackSamples
      .filter(sample => sample.stack.length > 0)
      .sort((a, b) => b.allocationSize - a.allocationSize)
      .slice(0, 12)
      .map(sample => ({
        eventType: sample.eventType,
        objectClass: sample.objectClass,
        allocationSize: sample.allocationSize,
        threadName: sample.threadName,
        topFrame: formatFrame(sample.stack[0]),
        stack: sample.stack.slice(0, 8).map(formatFrame),
      })),
  };
}

function normalizeAllocationEvent(event) {
  const values = event.values ?? {};
  return {
    eventType: event.type,
    threadName: values.eventThread?.javaName ?? 'unknown',
    objectClass: normalizeClassName(values.objectClass?.name ?? 'unknown'),
    allocationSize: Number(values.allocationSize ?? 0),
    stack: (values.stackTrace?.frames ?? []).map(frame => ({
      className: normalizeClassName(frame.method?.type?.name ?? 'unknown'),
      methodName: frame.method?.name ?? 'unknown',
      lineNumber: frame.lineNumber ?? null,
      frameType: frame.type ?? null,
    })),
  };
}

function normalizeClassName(name) {
  if (name === '[C') return 'char[]';
  if (name === '[B') return 'byte[]';
  if (name === '[I') return 'int[]';
  if (name === '[Ljava/lang/Object;') return 'java.lang.Object[]';
  return String(name).replace(/\//g, '.');
}

function isStringBoundarySample(sample) {
  if (sample.objectClass === 'java.lang.String' || sample.objectClass === 'char[]') return true;
  return sample.stack.some(frame => {
    const fullName = `${frame.className}::${frame.methodName}`;
    return /java\.lang\.String::<init>|java\.util\.Arrays::copyOfRange|TextBuffer::contentsAsString|TextBuilder::getAllValues|BasicStreamReader::getText|BasicStreamReader::getAttributeValue|BasicStreamReader::getLocalName/.test(fullName);
  });
}

function topClassSummary(samples) {
  const byClass = new Map();
  for (const sample of samples) {
    const current = byClass.get(sample.objectClass) ?? {
      objectClass: sample.objectClass,
      samples: 0,
      sampledBytes: 0,
    };
    current.samples++;
    current.sampledBytes += sample.allocationSize;
    byClass.set(sample.objectClass, current);
  }
  return [...byClass.values()]
    .sort((a, b) => b.sampledBytes - a.sampledBytes || b.samples - a.samples || a.objectClass.localeCompare(b.objectClass))
    .slice(0, 16);
}

function createFindings(benchmark, analysis, recordingMode) {
  const findings = [
    {
      id: 'same-contract-result',
      summary: 'Woodstox JFR run preserved the full-string checksum benchmark result.',
      evidence: [
        `events=${benchmark.eventCount}`,
        `checksum=${benchmark.checksum}`,
        `throughput=${benchmark.mibPerSec.toFixed(1)} MiB/s`,
      ],
    },
    {
      id: 'allocation-samples-visible',
      summary: recordingMode === 'measured'
        ? 'JFR emitted allocation samples for the measured comparator consume run.'
        : 'JFR emitted allocation samples for the comparator process.',
      evidence: [
        `allocationEvents=${analysis.eventCount}`,
        `sampledBytes=${formatBytes(analysis.sampledBytes)}`,
        `consumeStackEvents=${analysis.consumeStackEventCount}`,
        `woodstoxStackEvents=${analysis.woodstoxStackEventCount}`,
      ],
    },
    {
      id: 'not-deterministic-census',
      summary: recordingMode === 'measured'
        ? 'JFR allocation events are measured-run sampled evidence, not a deterministic allocation census.'
        : 'JFR allocation events are sampled process-level evidence, not a deterministic allocation census.',
      evidence: [
        recordingMode === 'measured'
          ? 'The recording starts after warmups and after the pre-run System.gc(), then stops after the measured consume call.'
          : 'The recording covers JVM startup, warmups, and the measured run because the comparator is launched as a separate process.',
        'Use it to identify observed allocation paths, not to prove total allocation volume or all object lifetimes.',
      ],
    },
  ];
  if (analysis.stringBoundaryEventCount > 0) {
    findings.splice(2, 0, {
      id: 'string-materialization-stack-visible',
      summary: 'At least one sampled consume stack crosses Woodstox text or attribute accessors into Java String/char materialization.',
      evidence: [
        `stringBoundaryEvents=${analysis.stringBoundaryEventCount}`,
        `stringBoundarySampledBytes=${formatBytes(analysis.stringBoundarySampledBytes)}`,
      ],
    });
  }
  return findings;
}

function extractBenchmarkJson(stdout) {
  const matches = [...String(stdout).matchAll(/\{"runtime":.+?\}/gs)].map(match => match[0]);
  if (matches.length === 0) {
    throw new Error('Woodstox benchmark JSON was not found in JFR run output.');
  }
  return JSON.parse(matches[matches.length - 1]);
}

function renderMarkdown(report) {
  const measuredMode = report.options.recordingMode === 'measured';
  const lines = [
    measuredMode ? '# Woodstox Measured-Run JFR Allocation Sampling' : '# Woodstox JFR Allocation Sampling',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report is a TRACE_FACT for one Java/HotSpot build and one XML fixture.',
    measuredMode
      ? 'It captures JFR `ObjectAllocationInNewTLAB` and `ObjectAllocationOutsideTLAB` events around one measured Java + Woodstox `consume` call after warmup.'
      : 'It captures JFR `ObjectAllocationInNewTLAB` and `ObjectAllocationOutsideTLAB` events for the Java + Woodstox comparator process.',
    measuredMode
      ? 'It is measured-run sampled evidence, not a deterministic allocation census and not proof of every Woodstox object lifetime.'
      : 'It is sampled process-level evidence, not a deterministic allocation census and not proof of every Woodstox object lifetime.',
    '',
    '## Environment',
    '',
    `- Java: ${report.environment.java}`,
    `- Platform: ${report.environment.platform}`,
    `- CPU: ${report.environment.cpuName}`,
    `- Fixture: ${report.fixture.path ?? report.fixture.source}`,
    `- Fixture size: ${report.fixture.sizeMiB.toFixed(2)} MiB`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    `- JFR settings: ${report.options.jfrSettings}`,
    `- Recording mode: ${report.options.recordingMode}`,
    `- Stack depth: ${report.options.stackDepth}`,
    `- Raw JFR: ${report.rawArtifacts.jfr.path}`,
    `- Raw JFR committed: ${report.rawArtifacts.jfr.committed ? 'yes' : 'no'}`,
    `- Raw allocation JSON: ${report.rawArtifacts.allocationEventsJson.path}`,
    `- Raw allocation JSON committed: ${report.rawArtifacts.allocationEventsJson.committed ? 'yes' : 'no'}`,
    '',
    '## Benchmark Result',
    '',
    '| Runtime | Throughput | Average | Events | Checksum |',
    '| --- | ---: | ---: | ---: | ---: |',
    `| ${escapePipe(report.benchmark.runtime)} | ${report.benchmark.mibPerSec.toFixed(1)} MiB/s | ${report.benchmark.avgMs.toFixed(2)} ms | ${report.benchmark.eventCount} | ${report.benchmark.checksum} |`,
    '',
    '## Allocation Summary',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| JFR allocation events | ${report.allocation.eventCount} |`,
    `| JFR sampled allocation bytes | ${formatBytes(report.allocation.sampledBytes)} |`,
    `| Main-thread allocation events | ${report.allocation.mainThreadEventCount} |`,
    `| WoodstoxBench.consume stack events | ${report.allocation.consumeStackEventCount} |`,
    `| Woodstox stack events | ${report.allocation.woodstoxStackEventCount} |`,
    `| String-boundary events | ${report.allocation.stringBoundaryEventCount} |`,
    `| Summary ObjectAllocationInNewTLAB count | ${report.jfrSummary.allocationEventCounts.ObjectAllocationInNewTLAB} |`,
    `| Summary ObjectAllocationOutsideTLAB count | ${report.jfrSummary.allocationEventCounts.ObjectAllocationOutsideTLAB} |`,
    '',
    '## Top Allocation Classes',
    '',
    '| Object class | Samples | Sampled bytes |',
    '| --- | ---: | ---: |',
    ...report.allocation.topClasses.map(entry => `| ${escapePipe(entry.objectClass)} | ${entry.samples} | ${formatBytes(entry.sampledBytes)} |`),
    '',
    '## Top Consume-Stack Classes',
    '',
    '| Object class | Samples | Sampled bytes |',
    '| --- | ---: | ---: |',
    ...report.allocation.topConsumeClasses.map(entry => `| ${escapePipe(entry.objectClass)} | ${entry.samples} | ${formatBytes(entry.sampledBytes)} |`),
    '',
    '## Key Consume Allocation Samples',
    '',
    '| Object class | Bytes | Thread | Top frame | Stack prefix |',
    '| --- | ---: | --- | --- | --- |',
    ...report.allocation.keySamples.map(sample => `| ${escapePipe(sample.objectClass)} | ${formatBytes(sample.allocationSize)} | ${escapePipe(sample.threadName)} | ${escapePipe(sample.topFrame)} | ${escapePipe(sample.stack.join(' <- '))} |`),
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

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
}

function removeIfExists(path) {
  if (existsSync(path)) {
    rmSync(path);
  }
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function firstLine(text) {
  return String(text).split(/\r?\n/).find(Boolean) ?? 'unknown';
}

function formatFrame(frame) {
  return `${frame.className}::${frame.methodName}`;
}

function formatBytes(bytes) {
  const absBytes = Math.abs(bytes);
  let value;
  if (absBytes >= MIB) {
    value = `${(absBytes / MIB).toFixed(1)} MiB`;
  } else if (absBytes >= 1024) {
    value = `${(absBytes / 1024).toFixed(1)} KiB`;
  } else {
    value = `${absBytes.toFixed(0)} B`;
  }
  return bytes < 0 ? `-${value}` : value;
}

function trimSpawnOutput(result) {
  return String(result.stderr || result.stdout || result.error?.message || '').trim();
}

function escapePipe(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function printSummary(report) {
  console.log('Woodstox JFR allocation sampling');
  console.log(`throughput=${report.benchmark.mibPerSec.toFixed(1)} MiB/s events=${report.benchmark.eventCount} checksum=${report.benchmark.checksum}`);
  console.log(`allocationEvents=${report.allocation.eventCount} consumeStackEvents=${report.allocation.consumeStackEventCount} stringBoundaryEvents=${report.allocation.stringBoundaryEventCount}`);
}

main();
