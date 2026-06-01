import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultReleaseJson = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-release-jsshell-availability-audit.json');
const defaultNightlyJson = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-nightly-jsshell-availability-audit.json');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-jsshell-stax-api-gap-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-jsshell-stax-api-gap-audit.md');

const requiredGlobals = [
  { name: 'TextDecoder', expected: 'function', reason: 'Full-string rows materialize UTF-8 XML spans as JavaScript strings.' },
  { name: 'TextEncoder', expected: 'function', reason: 'Current generated-fixture and harness paths encode XML strings into Uint8Array fixtures.' },
  { name: 'ReadableStream', expected: 'function', reason: 'Browser-compatible source paths and unchanged harness checks expect Web Streams.' },
  { name: 'fetch', expected: 'function', reason: 'Browser-compatible live source rows and unchanged harness checks expect fetch.' },
  { name: 'Uint8Array', expected: 'function', reason: 'Neutral byte-batch parser input is Uint8Array-based.' },
];

const requiredSurfaces = [
  {
    id: 'sync-byte-batch-full-string',
    label: 'StreamReaderSync generated-fixture Iterable<Uint8Array[]> full-string rows',
    contract: 'Generated-fixture same-contract StAX rows over synchronous byte batches.',
    requiredGlobals: ['Uint8Array', 'TextDecoder', 'TextEncoder'],
    reason: 'Uint8Array carries parser input, TextDecoder materializes StAX strings, and TextEncoder is used by the current generated-fixture harness.',
  },
  {
    id: 'sync-corpus-byte-batch-full-string',
    label: 'StreamReaderSync corpus-file Iterable<Uint8Array[]> full-string rows',
    contract: 'Corpus-file same-contract StAX rows over synchronous byte batches.',
    requiredGlobals: ['Uint8Array', 'TextDecoder'],
    reason: 'The official shells can read binary XML with read(..., "binary"), so TextEncoder is not a corpus-file blocker; TextDecoder remains required for full StAX string materialization.',
  },
  {
    id: 'async-byte-batch-full-string',
    label: 'createEventReaderFromAsyncByteBatches full-string rows',
    contract: 'Async byte-batch public event rows without direct ReadableStream consumption.',
    requiredGlobals: ['Uint8Array', 'TextDecoder'],
    reason: 'The parser input is Uint8Array[] and public event-object materialization still depends on TextDecoder.',
  },
  {
    id: 'readable-stream-full-string',
    label: 'EventReader ReadableStream<Uint8Array> full-string rows',
    contract: 'Direct Web ReadableStream source-overhead rows.',
    requiredGlobals: ['Uint8Array', 'TextDecoder', 'ReadableStream'],
    reason: 'The public EventReader constructor checks for a Web ReadableStream and materializes strings through the same decoder-backed event path.',
  },
  {
    id: 'browser-fetch-live-source',
    label: 'browser fetch live-source rows',
    contract: 'Live fetch Response.body rows such as fetchReadableStreamFull and fetchAsyncByteBatchFull.',
    requiredGlobals: ['Uint8Array', 'TextDecoder', 'ReadableStream', 'fetch'],
    reason: 'The live browser source rows require fetch, Response.body ReadableStream support, byte input, and full string materialization.',
  },
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    releaseJson: defaultReleaseJson,
    nightlyJson: defaultNightlyJson,
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
      case '--release-json':
        options.releaseJson = resolve(process.cwd(), readValue());
        break;
      case '--nightly-json':
        options.nightlyJson = resolve(process.cwd(), readValue());
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
  const reports = [
    readShellReport(options.releaseJson, 'release'),
    readShellReport(options.nightlyJson, 'nightly'),
  ];
  const report = createReport(reports, options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function readShellReport(filePath, packageKind) {
  if (!existsSync(filePath)) throw new Error(`SpiderMonkey shell audit JSON not found: ${filePath}`);
  const report = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!/^firefox-spidermonkey-(?:release|nightly)-jsshell-availability-audit$/.test(report.objective ?? '')) {
    throw new Error(`expected Firefox SpiderMonkey jsshell availability audit, got ${report.objective ?? 'unknown'}`);
  }
  return { filePath, packageKind, report };
}

function createReport(inputs, options) {
  const shellRows = inputs.map(input => summarizeShell(input));
  const allAvailable = shellRows.every(row => row.status === 'available');
  const allCanReadBinary = shellRows.every(row => row.binaryInput === 'ok');
  const allHaveJitStatus = shellRows.every(row => row.hasJitExecutionStatus === true);
  const allCanRunUnchanged = shellRows.every(row => row.canRunCurrentStaxFullStringBenchmark === true);
  const missingByShell = shellRows.map(row => row.missingRequiredGlobals);
  const commonMissingGlobals = requiredGlobals
    .map(item => item.name)
    .filter(name => missingByShell.every(missing => missing.includes(name)));
  const blockedSurfaces = summarizeBlockedSurfaces(shellRows);
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'firefox-spidermonkey-jsshell-stax-api-gap-audit',
    contract: 'spidermonkey-jsshell-current-stax-full-string-api-surface-gap',
    note: 'Synthesizes the official release/nightly SpiderMonkey js-shell API probes against the unchanged current full-string stax benchmark surface. This is not benchmark evidence, emitted JIT IR, optimized-code evidence, or a runtime-limit conclusion.',
    inputs: {
      releaseJson: options.releaseJson,
      nightlyJson: options.nightlyJson,
    },
    requiredGlobals,
    requiredSurfaces,
    summary: {
      status: allAvailable && allCanReadBinary && allHaveJitStatus && !allCanRunUnchanged
        ? 'blocked-by-host-api-surface'
        : allCanRunUnchanged ? 'unchanged-harness-runnable' : 'incomplete',
      shellCount: shellRows.length,
      availableShellCount: shellRows.filter(row => row.status === 'available').length,
      jitStatusShellCount: shellRows.filter(row => row.hasJitExecutionStatus === true).length,
      binaryReadableShellCount: shellRows.filter(row => row.binaryInput === 'ok').length,
      unchangedRunnableShellCount: shellRows.filter(row => row.canRunCurrentStaxFullStringBenchmark === true).length,
      commonMissingGlobals,
      commonMissingGlobalCount: commonMissingGlobals.length,
      blockedSurfaceCount: blockedSurfaces.filter(surface => surface.blockedShellCount > 0).length,
      canCloseEmittedIrObligation: false,
      conclusionAllowed: false,
    },
    shells: shellRows,
    blockedSurfaces,
  };
  report.findings = createFindings(report);
  return report;
}

function summarizeBlockedSurfaces(shellRows) {
  return requiredSurfaces.map(surface => {
    const shellBlockers = shellRows.map(shell => {
      const missingGlobals = surface.requiredGlobals.filter(name => shell.apiSurface[name] !== 'function');
      return {
        packageKind: shell.packageKind,
        blocked: missingGlobals.length > 0,
        missingGlobals,
      };
    });
    return {
      ...surface,
      blockedShellCount: shellBlockers.filter(shell => shell.blocked).length,
      runnableShellCount: shellBlockers.filter(shell => !shell.blocked).length,
      shellBlockers,
    };
  });
}

function summarizeShell(input) {
  const report = input.report;
  const api = report.shell?.apiProbe ?? {};
  const missingRequiredGlobals = requiredGlobals
    .filter(item => api[item.name] !== item.expected)
    .map(item => item.name);
  return {
    packageKind: input.packageKind,
    sourceArtifact: input.filePath.split(/[\\/]/).pop(),
    status: report.outcome?.status ?? null,
    packageVerified: report.outcome?.packageVerified ?? null,
    version: oneLine(report.shell?.version?.stdout),
    hasJitExecutionStatus: report.outcome?.hasJitExecutionStatus === true,
    hasIrDumpSurface: report.outcome?.hasIrDumpSurface === true,
    canReadBinaryInput: report.outcome?.canReadBinaryInput === true,
    binaryInput: report.shell?.binaryInputProbe?.status ?? null,
    canRunCurrentStaxFullStringBenchmark: report.outcome?.canRunCurrentStaxFullStringBenchmark === true,
    apiSurface: Object.fromEntries(requiredGlobals.map(item => [item.name, api[item.name] ?? 'missing'])),
    missingRequiredGlobals,
  };
}

function createFindings(report) {
  return [
    {
      id: 'spidermonkey-jsshell-api-gap',
      classification: 'NEGATIVE_RESULT',
      summary: 'The official release and nightly SpiderMonkey js-shells are executable and can read binary XML, but both lack required Web-compatible globals for the current full-string stax benchmark unchanged.',
      evidence: [
        `commonMissingGlobals=${report.summary.commonMissingGlobals.join(', ') || 'none'}`,
        `blockedSurfaces=${report.summary.blockedSurfaceCount}/${report.blockedSurfaces.length}`,
        `unchangedRunnableShells=${report.summary.unchangedRunnableShellCount}/${report.summary.shellCount}`,
      ],
    },
    {
      id: 'spidermonkey-jsshell-api-gap-scope',
      classification: 'SCOPE_GUARD',
      summary: 'This gap is a host API surface fact, not a SpiderMonkey throughput limit or emitted-code proof.',
      evidence: [
        'Adding a polyfill or alternate decoder would create a different harness surface and must not be counted as the unchanged current StAX full-string benchmark.',
        'Corpus-file byte-batch rows do not require TextEncoder when binary input is read directly by the shell, but they still require TextDecoder for the public full-string contract.',
        'A diagnostic-capable shell or Firefox build can still close the emitted IR/codegen obligation.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Firefox/SpiderMonkey JS Shell StAX API Gap Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Status: ${report.summary.status}`,
    `- Shells checked: ${report.summary.shellCount}`,
    `- Available shells: ${report.summary.availableShellCount}`,
    `- JIT-status shells: ${report.summary.jitStatusShellCount}`,
    `- Binary-readable shells: ${report.summary.binaryReadableShellCount}`,
    `- Unchanged current StAX full-string runnable shells: ${report.summary.unchangedRunnableShellCount}`,
    `- Common missing globals: ${report.summary.commonMissingGlobals.join(', ') || 'none'}`,
    `- Blocked current StAX surfaces: ${report.summary.blockedSurfaceCount}/${report.blockedSurfaces.length}`,
    `- Closes emitted IR obligation: ${report.summary.canCloseEmittedIrObligation ? 'yes' : 'no'}`,
    `- Runtime-limit conclusion allowed: ${report.summary.conclusionAllowed ? 'yes' : 'no'}`,
    '',
    '## Shells',
    '',
    '| Shell | Version | JIT status | Binary input | Missing required globals | Current benchmark unchanged |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const shell of report.shells) {
    lines.push(`| ${shell.packageKind} | ${shell.version} | ${shell.hasJitExecutionStatus ? 'yes' : 'no'} | ${shell.binaryInput} | ${shell.missingRequiredGlobals.join(', ') || 'none'} | ${shell.canRunCurrentStaxFullStringBenchmark ? 'yes' : 'no'} |`);
  }
  lines.push('', '## Required Globals', '', '| Global | Expected | Reason |', '| --- | --- | --- |');
  for (const item of report.requiredGlobals) {
    lines.push(`| ${item.name} | ${item.expected} | ${item.reason} |`);
  }
  lines.push('', '## Blocked StAX Surfaces', '', '| Surface | Contract | Required globals | Blocked shells | Missing globals |', '| --- | --- | --- | ---: | --- |');
  for (const surface of report.blockedSurfaces) {
    const missing = Array.from(new Set(surface.shellBlockers.flatMap(shell => shell.missingGlobals)));
    lines.push(`| ${surface.label} | ${surface.contract} | ${surface.requiredGlobals.join(', ')} | ${surface.blockedShellCount}/${report.summary.shellCount} | ${missing.join(', ') || 'none'} |`);
  }
  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) lines.push(`  - ${evidence}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeOutput(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function printSummary(report) {
  console.log(`firefox-spidermonkey-jsshell-stax-api-gap-audit: status=${report.summary.status} commonMissing=${report.summary.commonMissingGlobalCount}`);
}

function oneLine(value) {
  return String(value ?? 'not-recorded').trim().replace(/\s+/g, ' ') || 'not-recorded';
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
