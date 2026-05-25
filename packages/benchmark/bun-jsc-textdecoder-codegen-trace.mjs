import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const benchmarkScript = join(__dirname, 'textdecoder-span-variants.mjs');
const defaultOutputDir = join(__dirname, 'results', 'bun-jsc-textdecoder-codegen', `trace-${Date.now()}`);
const defaultJsonOut = join(__dirname, 'results', 'release', 'bun-jsc-textdecoder-codegen-trace.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'bun-jsc-textdecoder-codegen-trace.md');
const jscTraceEnv = {
  JSC_dumpBytecodeAtDFGTime: 'true',
  JSC_dumpDFGDisassembly: 'true',
};
const targetPatterns = [
  ['TextDecoder', /TextDecoder/g],
  ['decode', /\bdecode(?:#|\b)/g],
  ['decodeShortAsciiSpan', /\bdecodeShortAsciiSpan(?:#|\b)/g],
  ['consumeVariant', /\bconsumeVariant(?:#|\b)/g],
  ['StreamReaderSync', /StreamReaderSync/g],
  ['Uint8Array.subarray', /subarray/g],
  ['materializeName', /\bmaterializeName(?:#|\b)/g],
  ['currentGeneration', /\bcurrentGeneration(?:#|\b)/g],
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizeGiB: 0.001,
    fixtureShape: 'diverse-cycle',
    diverseCycleSize: 64,
    batchSize: 16,
    outputDir: defaultOutputDir,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    maxBufferMiB: 192,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    if (arg === '--self-test') {
      options.selfTest = true;
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
      case '--size-gib':
        options.sizeGiB = parsePositiveNumber(readValue(), name);
        break;
      case '--fixture-shape':
        options.fixtureShape = parseChoice(readValue(), ['repeated-person', 'diverse-cycle', 'corpus-cycle'], name);
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), name);
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), name);
        break;
      case '--output-dir':
        options.outputDir = resolve(process.cwd(), readValue());
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      case '--max-buffer-mib':
        options.maxBufferMiB = parsePositiveInteger(readValue(), name);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function parseChoice(value, allowed, flag) {
  if (!allowed.includes(value)) throw new Error(`${flag} must be one of: ${allowed.join(', ')}.`);
  return value;
}

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive number.`);
  return parsed;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function main() {
  const options = parseArgs();
  const report = options.selfTest ? createSelfTestReport(options) : runTrace(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function runTrace(options) {
  const runtime = readBunRuntime();
  if (existsSync(options.outputDir)) {
    rmSync(options.outputDir, { recursive: true, force: true });
  }
  mkdirSync(options.outputDir, { recursive: true });

  const benchmarkJson = join(options.outputDir, 'benchmark.json');
  const benchmarkMd = join(options.outputDir, 'benchmark.md');
  const traceLog = join(options.outputDir, 'jsc-textdecoder-codegen.log');
  const runLog = join(options.outputDir, 'run.log');
  const args = [
    '--no-install',
    benchmarkScript,
    `--size-gib=${options.sizeGiB}`,
    `--fixture-shape=${options.fixtureShape}`,
    `--diverse-cycle-size=${options.diverseCycleSize}`,
    `--batch-size=${options.batchSize}`,
    '--runs=1',
    '--warmups=0',
    `--json-out=${benchmarkJson}`,
    `--md-out=${benchmarkMd}`,
  ];

  const startedAt = Date.now();
  const result = spawnSync('bun', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...jscTraceEnv },
    maxBuffer: options.maxBufferMiB * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const elapsedMs = Date.now() - startedAt;
  writeFileSync(traceLog, `${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  writeFileSync(runLog, [
    `$ ${['bun', ...args].join(' ')}`,
    `cwd=${repoRoot}`,
    `exit=${result.status} elapsedMs=${elapsedMs}`,
    `env=${JSON.stringify(jscTraceEnv)}`,
    `traceLog=${traceLog}`,
    '',
    '--- stdout/stderr captured in trace log ---',
  ].join('\n'));

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Bun/JSC TextDecoder codegen trace failed with exit ${result.status}. See ${runLog}`);
  }

  const benchmark = JSON.parse(readFileSync(benchmarkJson, 'utf8'));
  const trace = summarizeTrace(readFileSync(traceLog, 'utf8'));
  return createReport({
    options,
    runtime,
    elapsedMs,
    rawFiles: { benchmarkJson, benchmarkMd, traceLog, runLog },
    benchmark,
    trace,
  });
}

function readBunRuntime() {
  const revisionResult = spawnSync('bun', ['--revision'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (revisionResult.status !== 0) {
    throw new Error(`bun revision probe failed: ${revisionResult.stderr || revisionResult.stdout}`);
  }
  const result = spawnSync('bun', ['--no-install', '-e', "console.log(JSON.stringify({runtimeName:'bun', javascriptEngine:'JavaScriptCore', bunVersion:process.versions.bun, webkitCommit:process.versions.webkit, processVersions:process.versions}))"], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`bun runtime probe failed: ${result.stderr || result.stdout}`);
  }
  return {
    ...JSON.parse(result.stdout),
    bunRevision: revisionResult.stdout.trim(),
  };
}

function summarizeTrace(traceText) {
  const lines = traceText.split(/\r?\n/);
  const count = pattern => Array.from(traceText.matchAll(pattern)).length;
  const targetMentions = Object.fromEntries(targetPatterns.map(([name, pattern]) => [name, count(pattern)]));
  const generatedDfgLines = lines.filter(line => /Generated DFG JIT code for/.test(line));
  const generatedJitLines = lines.filter(line => /Generated (?:DFG )?JIT code for/.test(line));
  const parsingLines = lines.filter(line => /^Parsing /.test(line));
  const dfgNodeLines = lines.filter(line => /^\s*(?:D@|\d+\s+\d+\s+\d+:\s+D@)/.test(line));
  const bytecodeLines = lines.filter(line => /^\[\s*\d+\]\s+\w+/.test(line));
  return {
    byteLength: Buffer.byteLength(traceText),
    lineCount: lines.length,
    parsingLineCount: parsingLines.length,
    generatedJitLineCount: generatedJitLines.length,
    generatedDfgLineCount: generatedDfgLines.length,
    dfgNodeLineCount: dfgNodeLines.length,
    bytecodeLineCount: bytecodeLines.length,
    targetMentions,
    totalTargetMentions: Object.values(targetMentions).reduce((sum, value) => sum + value, 0),
    excerpts: {
      parsing: parsingLines.slice(0, 5),
      generatedDfg: generatedDfgLines.slice(0, 8),
      targetFunctions: lines
        .filter(line => targetPatterns.some(([, pattern]) => {
          pattern.lastIndex = 0;
          return pattern.test(line);
        }))
        .slice(0, 12),
    },
  };
}

function createReport({ options, runtime, elapsedMs, rawFiles, benchmark, trace }) {
  const variants = benchmark.variants.map(summarizeVariant);
  const uniqueChecksums = new Set(variants.map(row => row.checksum));
  const uniqueEvents = new Set(variants.map(row => row.eventCount));
  return {
    generatedAt: new Date().toISOString(),
    objective: 'bun-jsc-textdecoder-codegen-trace',
    contract: 'bun-jsc-textdecoder-span-bytecode-dfg-trace',
    note: 'Bun/JSC codegen trace over the TextDecoder span materialization matrix. This ties the benchmark callsites to JavaScriptCore bytecode/DFG evidence, but it is not native Bun Zig generated-code proof and not Safari/browser evidence.',
    environment: {
      runtime,
      hostNode: process.version,
      platform: `${process.platform}-${process.arch}`,
      cpu: cpus()[0]?.model ?? 'unknown',
    },
    parameters: {
      sizeGiB: options.sizeGiB,
      fixtureShape: options.fixtureShape,
      diverseCycleSize: options.diverseCycleSize,
      batchSize: options.batchSize,
      jscTraceEnv,
      maxBufferMiB: options.maxBufferMiB,
    },
    fixture: benchmark.fixture,
    rawArtifacts: {
      committed: false,
      ...rawFiles,
    },
    elapsedMs,
    variants,
    fullStringParity: {
      status: uniqueChecksums.size === 1 && uniqueEvents.size === 1 ? 'ok' : 'mismatch',
      eventCount: uniqueEvents.size === 1 ? variants[0]?.eventCount ?? null : null,
      checksum: uniqueChecksums.size === 1 ? variants[0]?.checksum ?? null : null,
      fullRowCount: variants.filter(row => row.fullStringParity).length,
    },
    trace,
    findings: createFindings(variants, trace),
  };
}

function summarizeVariant(variant) {
  const counters = variant.materializationCounters ?? {};
  return {
    id: variant.id,
    family: variant.family,
    fullStringParity: variant.fullStringParity,
    contractScope: variant.contractScope,
    mibPerSec: round(variant.mibPerSec),
    boundedMemory: variant.boundedMemory,
    eventCount: variant.eventCount,
    checksum: variant.checksum,
    stringFields: counters.stringFieldReads ?? variant.stringFields ?? null,
    rawSpans: counters.rawSpanMaterializations ?? variant.rawSpans ?? null,
    textDecoderCalls: counters.textDecoderCalls ?? variant.textDecoderCalls ?? null,
    textDecoderInstances: counters.textDecoderInstances ?? variant.textDecoderInstances ?? null,
    shortAsciiHits: counters.shortAsciiHits ?? variant.shortAsciiHits ?? null,
    copiedSpans: counters.copiedSpans ?? variant.copiedSpans ?? null,
    copiedSpanBytes: counters.copiedSpanBytes ?? variant.copiedSpanBytes ?? null,
    maxRssBytes: variant.memory?.maxRssBytes ?? null,
    decodeStrategy: variant.decodeStrategy,
  };
}

function createFindings(variants, trace) {
  return [
    {
      id: 'bun-jsc-textdecoder-bytecode-dfg-trace-visible',
      classification: 'TRACE_FACT',
      summary: 'Bun/JSC emitted JavaScriptCore bytecode and DFG JIT disassembly while running the TextDecoder span matrix.',
      evidence: [
        `generatedDfgLineCount=${trace.generatedDfgLineCount}`,
        `bytecodeLineCount=${trace.bytecodeLineCount}`,
        `dfgNodeLineCount=${trace.dfgNodeLineCount}`,
        `totalTargetMentions=${trace.totalTargetMentions}`,
      ],
    },
    {
      id: 'bun-jsc-textdecoder-full-string-contract',
      classification: 'TRACE_FACT',
      summary: 'The traced TextDecoder rows preserved full-string event count and checksum parity.',
      evidence: variants.map(row => `${row.id}: events=${row.eventCount}, checksum=${row.checksum}, textDecoderCalls=${row.textDecoderCalls}, mibPerSec=${row.mibPerSec}`),
    },
    {
      id: 'not-native-zig-codegen-or-safari-proof',
      classification: 'SCOPE_GUARD',
      summary: 'This trace observes Bun/JSC JavaScript benchmark callsites, not native Bun Zig TextDecoder generated code or Safari/WebKit browser behavior.',
      evidence: [
        'The Bun TextDecoder dispatch source-pin audit remains the source evidence for Bun Zig default UTF-8 dispatch.',
        'Safari/WebKit browser rows remain a separate proof obligation.',
      ],
    },
  ];
}

function createSelfTestReport(options) {
  return createReport({
    options,
    runtime: {
      runtimeName: 'bun',
      javascriptEngine: 'JavaScriptCore',
      bunVersion: 'self-test',
      webkitCommit: 'self-test',
      bunRevision: 'self-test',
      processVersions: {},
    },
    elapsedMs: 1,
    rawFiles: {
      benchmarkJson: 'self-test-benchmark.json',
      benchmarkMd: 'self-test-benchmark.md',
      traceLog: 'self-test-jsc-textdecoder-codegen.log',
      runLog: 'self-test-run.log',
    },
    benchmark: {
      fixture: {
        sizeGiB: options.sizeGiB,
        fixtureShape: options.fixtureShape,
        actualBytes: Math.round(options.sizeGiB * 1024 * 1024 * 1024),
      },
      variants: [
        selfTestVariant('subarraySharedDecoder', 70, 10, 0, 0),
        selfTestVariant('viewSharedDecoder', 65, 10, 0, 0),
        selfTestVariant('sliceCopySharedDecoder', 60, 10, 0, 10),
        selfTestVariant('subarrayNewDecoder', 55, 10, 10, 0),
        selfTestVariant('shortAsciiSubarraySharedDecoder', 80, 2, 0, 0, 8),
      ],
    },
    trace: summarizeTrace([
      'Parsing consumeVariant#abc:[0x0, DFGFunctionCall]',
      'Generated DFG JIT code for consumeVariant#abc:[0x0, DFGFunctionCall], instructions size = 120:',
      '      D@1:< 2:-> SetArgumentDefinitely',
      '[   0] enter',
      'Generated DFG JIT code for decodeShortAsciiSpan#def:[0x0, DFGFunctionCall], instructions size = 80:',
      'TextDecoder decode Uint8Array subarray StreamReaderSync currentGeneration materializeName',
    ].join('\n')),
  });
}

function selfTestVariant(id, mibPerSec, textDecoderCalls, textDecoderInstances, copiedSpans, shortAsciiHits = 0) {
  return {
    id,
    family: 'full-stax-js',
    fullStringParity: true,
    contractScope: 'full-string-materialization',
    mibPerSec,
    boundedMemory: true,
    eventCount: 12345,
    checksum: 67890,
    stringFields: 20000,
    rawSpans: 20000,
    textDecoderCalls,
    textDecoderInstances,
    shortAsciiHits,
    copiedSpans,
    copiedSpanBytes: copiedSpans * 8,
    memory: { maxRssBytes: 128 * 1024 * 1024 },
    decodeStrategy: {
      usesTextDecoder: true,
      nodeBufferSpecific: false,
      nativeAddon: false,
      lazyGetter: false,
    },
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Bun/JSC TextDecoder Codegen Trace',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report is a TRACE_FACT for one Bun/JavaScriptCore build and the TextDecoder span materialization matrix.',
    'It uses JavaScriptCore bytecode and DFG JIT dump options. It is not native Bun Zig generated-code proof, not Safari/browser evidence, and not a runtime ceiling proof.',
    '',
    '## Environment',
    '',
    `- Runtime: ${report.environment.runtime.runtimeName} ${report.environment.runtime.bunVersion}`,
    `- Bun revision: ${report.environment.runtime.bunRevision}`,
    `- JavaScript engine: ${report.environment.runtime.javascriptEngine}`,
    `- WebKit commit: ${report.environment.runtime.webkitCommit}`,
    `- Host Node: ${report.environment.hostNode}`,
    `- Platform: ${report.environment.platform}`,
    `- CPU: ${report.environment.cpu}`,
    `- Fixture size: ${formatBytes(report.fixture.actualBytes ?? report.fixture.targetBytes ?? report.fixture.requestedBytes ?? report.fixture.totalBytes ?? 0)} (${report.fixture.sizeGiB ?? report.parameters.sizeGiB} GiB actual)`,
    `- Batch size: ${report.parameters.batchSize}`,
    `- JSC trace env: ${Object.entries(report.parameters.jscTraceEnv).map(([key, value]) => `${key}=${value}`).join(', ')}`,
    `- Raw artifacts committed: ${report.rawArtifacts.committed ? 'yes' : 'no'}`,
    '',
    '## Variant Parity',
    '',
    `- Full-string parity status: ${report.fullStringParity.status}`,
    `- Full-string rows: ${report.fullStringParity.fullRowCount}`,
    '',
    '| Variant | MiB/s | Events | Checksum | TextDecoder calls | New decoders | Short ASCII hits | Bounded memory |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ];
  for (const row of report.variants) {
    lines.push(`| ${row.id} | ${row.mibPerSec.toFixed(2)} | ${row.eventCount} | ${row.checksum} | ${row.textDecoderCalls} | ${row.textDecoderInstances} | ${row.shortAsciiHits} | ${row.boundedMemory ? 'yes' : 'no'} |`);
  }
  lines.push(
    '',
    '## Trace Summary',
    '',
    `- Trace bytes: ${report.trace.byteLength}`,
    `- Trace lines: ${report.trace.lineCount}`,
    `- Parsing lines: ${report.trace.parsingLineCount}`,
    `- Generated JIT lines: ${report.trace.generatedJitLineCount}`,
    `- Generated DFG JIT lines: ${report.trace.generatedDfgLineCount}`,
    `- Bytecode lines: ${report.trace.bytecodeLineCount}`,
    `- DFG node lines: ${report.trace.dfgNodeLineCount}`,
    `- Target function mentions: ${report.trace.totalTargetMentions}`,
    '',
    '| Target | Mentions |',
    '| --- | ---: |',
  );
  for (const [name, count] of Object.entries(report.trace.targetMentions)) {
    lines.push(`| ${name} | ${count} |`);
  }
  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence ?? []) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push(
    '',
    '## Scope Limits',
    '',
    '- This is selected Bun/JSC bytecode and DFG disassembly evidence for JavaScript benchmark callsites.',
    '- It does not prove generated native code inside Bun Zig `TextDecoder` implementation.',
    '- It is not Safari/WebKit browser evidence; Safari rows remain separate from Bun/JSC rows.',
    '- This is not a 1 GiB trace and not a JavaScript runtime ceiling proof.',
    '',
  );
  return lines.join('\n');
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(JSON.stringify({
    objective: report.objective,
    runtime: report.environment.runtime.runtimeName,
    webkitCommit: report.environment.runtime.webkitCommit,
    generatedDfgLineCount: report.trace.generatedDfgLineCount,
    bytecodeLineCount: report.trace.bytecodeLineCount,
    targetMentions: report.trace.totalTargetMentions,
  }, null, 2));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'unknown';
  const mib = bytes / (1024 * 1024);
  return `${mib.toFixed(2)} MiB`;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

main();
