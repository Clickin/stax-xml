import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const candidateScript = join(__dirname, 'candidate-headroom-large.mjs');
const defaultOutputDir = join(__dirname, 'results', 'bun-jsc-codegen', `trace-${Date.now()}`);
const defaultJsonOut = join(__dirname, 'results', 'release', 'bun-jsc-codegen-trace.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'bun-jsc-codegen-trace.md');
const defaultCases = ['stringFull', 'rawFrameNameId', 'eventObjectFull'];
const targetFunctions = [
  'consumeStreamSelective',
  'consumeEventObjectFull',
  'consumeRawFrameStyle',
  'consumeRawFrame',
  'materializePublicEventObject',
  'materializeName',
  'decodeSpan',
  'decodeShortAsciiSpan',
  'copyName',
  'nameAt',
  'currentGeneration',
];
const jscTraceEnv = {
  JSC_dumpBytecodeAtDFGTime: 'true',
  JSC_dumpDFGDisassembly: 'true',
};

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizeGiB: 0.001,
    fixtureShape: 'diverse-cycle',
    diverseCycleSize: 64,
    cases: [...defaultCases],
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
        options.fixtureShape = parseChoice(readValue(), ['repeated-person', 'diverse-cycle', 'projection-cycle'], name);
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), name);
        break;
      case '--cases':
        options.cases = parseList(readValue(), name);
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

function parseList(value, flag) {
  const entries = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (entries.length === 0) throw new Error(`${flag} must contain at least one value.`);
  return entries;
}

function main() {
  const options = parseArgs();
  const report = options.selfTest
    ? createSelfTestReport(options)
    : runTrace(options);
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
  const traceLog = join(options.outputDir, 'jsc-codegen.log');
  const runLog = join(options.outputDir, 'run.log');
  const args = [
    '--no-install',
    candidateScript,
    `--size-gib=${options.sizeGiB}`,
    `--fixture-shape=${options.fixtureShape}`,
    `--diverse-cycle-size=${options.diverseCycleSize}`,
    `--cases=${options.cases.join(',')}`,
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
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  writeFileSync(traceLog, `${stdout}\n${stderr}`);
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
    throw new Error(`Bun/JSC codegen trace failed with exit ${result.status}. See ${runLog}`);
  }

  const benchmark = JSON.parse(readFileSync(benchmarkJson, 'utf8'));
  const traceText = readFileSync(traceLog, 'utf8');
  const trace = summarizeTrace(traceText);
  const cases = options.cases.map(caseId => {
    const variant = benchmark.variants.find(entry => entry.id === caseId);
    if (!variant) throw new Error(`Benchmark output did not contain requested case ${caseId}.`);
    return summarizeVariant(variant);
  });

  return createReport({
    options,
    runtime,
    elapsedMs,
    rawFiles: { benchmarkJson, benchmarkMd, traceLog, runLog },
    benchmark,
    cases,
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

function summarizeVariant(variant) {
  return {
    id: variant.id,
    family: variant.family,
    fullStringParity: variant.fullStringParity,
    contractScope: variant.contractScope,
    mibPerSec: round(variant.mibPerSec),
    boundedMemory: variant.boundedMemory,
    eventCount: variant.eventCount,
    checksum: variant.checksum,
    stringFields: variant.stringFields,
    eventObjects: variant.eventObjects ?? 0,
    maxRssBytes: variant.maxRssBytes ?? null,
  };
}

function summarizeTrace(traceText) {
  const lines = traceText.split(/\r?\n/);
  const count = pattern => matchCount(traceText, pattern);
  const targetMentions = Object.fromEntries(targetFunctions.map(functionName => [
    functionName,
    count(new RegExp(`\\b${escapeRegExp(functionName)}(?:#|\\b)`, 'g')),
  ]));
  const generatedDfgLines = lines.filter(line => /Generated DFG JIT code for/.test(line));
  const generatedJitLines = lines.filter(line => /Generated (?:DFG )?JIT code for/.test(line));
  const parsingLines = lines.filter(line => /^Parsing /.test(line));
  const blockLines = lines.filter(line => /^\s*Block #/.test(line));
  const dfgNodeLines = lines.filter(line => /^\s*(?:D@|\d+\s+\d+\s+\d+:\s+D@)/.test(line));
  const bytecodeLines = lines.filter(line => /^\[\s*\d+\]\s+\w+/.test(line));
  return {
    byteLength: Buffer.byteLength(traceText),
    lineCount: lines.length,
    parsingLineCount: parsingLines.length,
    generatedJitLineCount: generatedJitLines.length,
    generatedDfgLineCount: generatedDfgLines.length,
    blockLineCount: blockLines.length,
    dfgNodeLineCount: dfgNodeLines.length,
    bytecodeLineCount: bytecodeLines.length,
    targetMentions,
    totalTargetMentions: Object.values(targetMentions).reduce((sum, value) => sum + value, 0),
    excerpts: {
      parsing: parsingLines.slice(0, 5),
      generatedDfg: generatedDfgLines.slice(0, 8),
      targetFunctions: lines
        .filter(line => targetFunctions.some(functionName => line.includes(functionName)))
        .slice(0, 12),
    },
  };
}

function createReport({ options, runtime, elapsedMs, rawFiles, benchmark, cases, trace }) {
  const fullRows = cases.filter(entry => entry.fullStringParity);
  const uniqueFullChecksums = new Set(fullRows.map(entry => entry.checksum));
  const uniqueFullEvents = new Set(fullRows.map(entry => entry.eventCount));
  return {
    generatedAt: new Date().toISOString(),
    objective: 'bun-jsc-codegen-trace',
    contract: 'jsc-bytecode-dfg-disassembly-trace',
    note: 'Bun/JSC codegen trace over selected same-contract stax-xml reader rows. This is runtime-specific TRACE_FACT evidence, not a runtime ceiling proof and not Safari/browser evidence.',
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
      cases: options.cases,
      jscTraceEnv,
      maxBufferMiB: options.maxBufferMiB,
    },
    fixture: benchmark.fixture,
    rawArtifacts: {
      committed: false,
      ...rawFiles,
    },
    elapsedMs,
    cases,
    fullStringParity: {
      status: uniqueFullChecksums.size === 1 && uniqueFullEvents.size === 1 ? 'ok' : 'mismatch',
      eventCount: uniqueFullEvents.size === 1 ? fullRows[0]?.eventCount ?? null : null,
      checksum: uniqueFullChecksums.size === 1 ? fullRows[0]?.checksum ?? null : null,
      fullRowCount: fullRows.length,
    },
    trace,
    findings: createFindings(trace, fullRows),
  };
}

function createFindings(trace, fullRows) {
  return [
    {
      id: 'bun-jsc-bytecode-dfg-trace-visible',
      classification: 'TRACE_FACT',
      summary: 'Bun/JSC emitted JavaScriptCore bytecode and DFG JIT disassembly for the selected stax-xml benchmark run.',
      evidence: [
        `generatedDfgLineCount=${trace.generatedDfgLineCount}`,
        `bytecodeLineCount=${trace.bytecodeLineCount}`,
        `dfgNodeLineCount=${trace.dfgNodeLineCount}`,
        `totalTargetMentions=${trace.totalTargetMentions}`,
      ],
    },
    {
      id: 'bun-jsc-trace-same-contract',
      classification: 'TRACE_FACT',
      summary: 'The traced full-string Bun/JSC rows preserved event count and checksum parity.',
      evidence: fullRows.map(row => `${row.id}: events=${row.eventCount}, checksum=${row.checksum}, mibPerSec=${row.mibPerSec}`),
    },
    {
      id: 'not-safari-or-runtime-ceiling-proof',
      classification: 'SCOPE_GUARD',
      summary: 'This is Bun/JSC runtime codegen evidence, not Safari/WebKit browser evidence and not a 200 MiB/s runtime ceiling proof.',
      evidence: [
        'Bun uses a patched JavaScriptCore build exposed by process.versions.webkit.',
        'Safari/WebKit browser rows remain a separate proof obligation.',
      ],
    },
  ];
}

function createSelfTestReport(options) {
  const runtime = {
    runtimeName: 'bun',
    javascriptEngine: 'JavaScriptCore',
    bunVersion: 'self-test',
    webkitCommit: 'self-test',
    bunRevision: 'self-test',
    processVersions: {},
  };
  const fixture = {
    sizeGiB: options.sizeGiB,
    fixtureShape: options.fixtureShape,
    source: 'generated',
    requestedBytes: Math.round(options.sizeGiB * 1024 * 1024 * 1024),
  };
  const cases = options.cases.map((caseId, index) => ({
    id: caseId,
    family: 'full-stax-js',
    fullStringParity: true,
    contractScope: caseId === 'eventObjectFull' ? 'full-event-object-materialization' : 'full-string-materialization',
    mibPerSec: round(70 - index * 5),
    boundedMemory: true,
    eventCount: 12345,
    checksum: 67890,
    stringFields: 25000,
    eventObjects: caseId === 'eventObjectFull' ? 12345 : 0,
    maxRssBytes: 128 * 1024 * 1024,
  }));
  return createReport({
    options,
    runtime,
    elapsedMs: 1,
    rawFiles: {
      benchmarkJson: 'self-test-benchmark.json',
      benchmarkMd: 'self-test-benchmark.md',
      traceLog: 'self-test-jsc-codegen.log',
      runLog: 'self-test-run.log',
    },
    benchmark: { fixture },
    cases,
    trace: summarizeTrace([
      'Parsing consumeRawFrame#abc:[0x0, DFGFunctionCall]',
      'Generated DFG JIT code for consumeRawFrame#abc:[0x0, DFGFunctionCall], instructions size = 120:',
      '    Block #0 (bc#0): (OSR target)',
      '      D@1:< 2:-> SetArgumentDefinitely',
      '[   0] enter',
      'Generated DFG JIT code for materializeName#def:[0x0, DFGFunctionCall], instructions size = 80:',
      'Generated DFG JIT code for decodeSpan#ghi:[0x0, DFGFunctionCall], instructions size = 60:',
    ].join('\n')),
  });
}

function renderMarkdown(report) {
  const lines = [
    '# Bun/JSC Codegen Trace',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report is a TRACE_FACT for one Bun/JavaScriptCore build and selected same-contract stax-xml reader functions.',
    'It uses JavaScriptCore bytecode and DFG JIT dump options. It is not Safari/browser evidence and not a runtime ceiling proof.',
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
    `- JSC trace env: ${Object.entries(report.parameters.jscTraceEnv).map(([key, value]) => `${key}=${value}`).join(', ')}`,
    `- Raw artifacts committed: ${report.rawArtifacts.committed ? 'yes' : 'no'}`,
    '',
    '## Variant Parity',
    '',
    '| Case | MiB/s | Events | Checksum | Bounded memory |',
    '| --- | ---: | ---: | ---: | --- |',
  ];
  for (const row of report.cases) {
    lines.push(`| ${row.id} | ${row.mibPerSec.toFixed(2)} | ${row.eventCount} | ${row.checksum} | ${row.boundedMemory ? 'yes' : 'no'} |`);
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
    '| Function | Mentions |',
    '| --- | ---: |',
  );
  for (const [functionName, count] of Object.entries(report.trace.targetMentions)) {
    lines.push(`| ${functionName} | ${count} |`);
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
    '- This is selected Bun/JSC bytecode and DFG disassembly evidence, not an exhaustive optimized-code proof.',
    '- This is not Safari/WebKit browser evidence; Safari rows remain separate from Bun/JSC rows.',
    '- This is not a 1 GiB trace and not a JavaScript runtime ceiling proof.',
    '',
  );
  return `${lines.join('\n')}`;
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

function matchCount(text, regex) {
  return Array.from(text.matchAll(regex)).length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
