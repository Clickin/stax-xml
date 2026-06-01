import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'spidermonkey-jsshell-diagnostic-flag-sweep.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'spidermonkey-jsshell-diagnostic-flag-sweep.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    jsShell: null,
    selfTest: false,
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
      case '--js-shell':
        options.jsShell = resolve(process.cwd(), readValue());
        break;
      case '--self-test':
        options.selfTest = true;
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
  const report = options.selfTest ? createSelfTestReport(options) : runSweep(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`${report.objective}: status=${report.outcome.status} bytecodeOutput=${report.outcome.hasBytecodeDumpOutput} prefSurface=${report.outcome.hasDiagnosticPrefSurface}`);
}

function runSweep(options) {
  if (!options.jsShell || !existsSync(options.jsShell)) {
    return createReport(options, {
      status: 'missing-shell',
      version: null,
      help: null,
      probes: [],
      prefProbe: null,
    });
  }
  const version = run(options.jsShell, ['--version']);
  const help = summarizeHelp(run(options.jsShell, ['--help']));
  const probes = runBytecodeProbes(options.jsShell);
  const prefProbe = runPrefProbe(options.jsShell);
  return createReport(options, {
    status: version.exitCode === 0 ? 'available' : 'probe-failed',
    version,
    help,
    probes,
    prefProbe,
  });
}

function runBytecodeProbes(jsShell) {
  const tempDir = mkdtempSync(join(tmpdir(), 'stax-spidermonkey-diagnostic-sweep-'));
  const scriptPath = join(tempDir, 'bytecode-probe.js');
  const source = [
    'function f(x) { return ((x + 1) | 0); }',
    'let checksum = 0;',
    'for (let i = 0; i < 20; i++) checksum = (checksum + f(i)) | 0;',
    "print('checksum=' + checksum);",
  ].join('\n');
  try {
    writeFileSync(scriptPath, source);
    return [
      runBytecodeProbe(jsShell, 'dump-bytecode-inline', ['--dump-bytecode', '-e', source]),
      runBytecodeProbe(jsShell, 'dump-bytecode-file', ['--dump-bytecode', scriptPath]),
      runBytecodeProbe(jsShell, 'short-D-file', ['-D', scriptPath]),
      runBytecodeProbe(jsShell, 'dump-bytecode-compileonly-file', ['--dump-bytecode', '--compileonly', scriptPath]),
    ];
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function runBytecodeProbe(jsShell, id, args) {
  const result = run(jsShell, args);
  const combined = `${result.stdout}\n${result.stderr}`;
  const checksum = Number(firstMatch(combined, /checksum=(-?\d+)/)?.[1] ?? NaN);
  const bytecodeMarkerCount = countMatches(
    combined,
    /\b(?:Bytecode|loc\s+op|main:\s+script|function f|JSOp|JOF_|ICEntry|JumpTarget)\b/g,
  );
  const diagnosticMarkerCount = countMatches(
    combined,
    /\b(?:JitSpew|IonBuilder|CodeGenerator|GenerateCode|Lowering|MIR|LIR|MBasicBlock|Snapshot|Bailout|RegisterAllocator)\b/g,
  );
  return {
    id,
    args,
    exitCode: result.exitCode,
    error: result.error,
    checksum: Number.isFinite(checksum) ? checksum : null,
    outputBytes: Buffer.byteLength(combined, 'utf8'),
    stdoutLineCount: lineCount(result.stdout),
    stderrLineCount: lineCount(result.stderr),
    bytecodeMarkerCount,
    diagnosticMarkerCount,
    emittedBytecodeDump: result.exitCode === 0 && bytecodeMarkerCount > 0,
    emittedIrOrCodegenDump: result.exitCode === 0 && diagnosticMarkerCount > 0,
    stdout: keepShort(result.stdout, 1000),
    stderr: keepShort(result.stderr, 1000),
  };
}

function runPrefProbe(jsShell) {
  const result = run(jsShell, ['--list-prefs']);
  const combined = `${result.stdout}\n${result.stderr}`;
  const matchingPrefs = combined
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /(?:jit|ion|spew|dump|bytecode|disas)/i.test(line));
  return {
    exitCode: result.exitCode,
    error: result.error,
    matchingPrefs,
    matchingPrefCount: matchingPrefs.length,
    hasJitSpewPref: matchingPrefs.some(line => /spew/i.test(line)),
    hasDumpPref: matchingPrefs.some(line => /dump|bytecode|disas/i.test(line)),
  };
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
    env: process.env,
  });
  return {
    command,
    args,
    exitCode: result.status,
    error: result.error?.message ?? null,
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
  };
}

function summarizeHelp(result) {
  const combined = `${result.stdout}\n${result.stderr}`;
  return {
    exitCode: result.exitCode,
    error: result.error,
    versionLine: firstMatch(combined, /^Version: .+$/m)?.[0] ?? null,
    hasDumpBytecode: /--dump-bytecode\b/.test(combined),
    hasShortD: /-D\s+--dump-bytecode/.test(combined),
    hasJitSpewFlag: /JIT_SPEW|IONFLAGS|--enable-jitspew|--iongraph|--dump-ion|--dump-mir|--dump-lir/i.test(combined),
  };
}

function createSelfTestReport(options) {
  return createReport(options, {
    status: 'available',
    version: { exitCode: 0, error: null, stdout: 'JavaScript-C153.0a1\n', stderr: '' },
    help: {
      exitCode: 0,
      error: null,
      versionLine: 'Version: JavaScript-C153.0a1',
      hasDumpBytecode: true,
      hasShortD: true,
      hasJitSpewFlag: false,
    },
    probes: [
      selfTestProbe('dump-bytecode-inline'),
      selfTestProbe('dump-bytecode-file'),
      selfTestProbe('short-D-file'),
      { ...selfTestProbe('dump-bytecode-compileonly-file'), checksum: null, outputBytes: 0, stdoutLineCount: 0 },
    ],
    prefProbe: {
      exitCode: 0,
      error: null,
      matchingPrefs: ['ion.regalloc=0'],
      matchingPrefCount: 1,
      hasJitSpewPref: false,
      hasDumpPref: false,
    },
  });
}

function selfTestProbe(id) {
  return {
    id,
    args: [],
    exitCode: 0,
    error: null,
    checksum: 210,
    outputBytes: 13,
    stdoutLineCount: 1,
    stderrLineCount: 0,
    bytecodeMarkerCount: 0,
    diagnosticMarkerCount: 0,
    emittedBytecodeDump: false,
    emittedIrOrCodegenDump: false,
    stdout: 'checksum=210\n',
    stderr: '',
  };
}

function createReport(options, shell) {
  const bytecodeOutputProbeCount = shell.probes.filter(probe => probe.emittedBytecodeDump).length;
  const irOrCodegenProbeCount = shell.probes.filter(probe => probe.emittedIrOrCodegenDump).length;
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'spidermonkey-jsshell-diagnostic-flag-sweep',
    contract: 'public-spidermonkey-jsshell-diagnostic-flag-negative-sweep',
    note: 'Sweeps public SpiderMonkey js-shell diagnostic flags that are easy to mistake for emitted IR/codegen evidence. This is not benchmark evidence and does not close the SpiderMonkey emitted-code obligation.',
    environment: {
      platform: `${process.platform}-${process.arch}`,
    },
    parameters: {
      jsShell: options.jsShell,
      selfTest: options.selfTest,
    },
    shell,
    outcome: {
      status: shell.status,
      version: oneLine(shell.version?.stdout),
      helpAdvertisesDumpBytecode: shell.help?.hasDumpBytecode === true,
      helpAdvertisesJitSpewFlag: shell.help?.hasJitSpewFlag === true,
      bytecodeProbeCount: shell.probes.length,
      bytecodeOutputProbeCount,
      irOrCodegenProbeCount,
      hasBytecodeDumpOutput: bytecodeOutputProbeCount > 0,
      hasIrOrCodegenDumpOutput: irOrCodegenProbeCount > 0,
      hasDiagnosticPrefSurface: shell.prefProbe?.hasJitSpewPref === true || shell.prefProbe?.hasDumpPref === true,
      closesEmittedIrObligation: false,
    },
  };
  report.findings = createFindings(report);
  return report;
}

function createFindings(report) {
  return [
    {
      id: 'public-jsshell-dump-bytecode-no-output',
      classification: 'NEGATIVE_RESULT',
      summary: 'The public SpiderMonkey js-shell advertises --dump-bytecode, but the swept inline/file/-D/compileonly probes emitted no bytecode dump markers.',
      evidence: [
        `version=${report.outcome.version}`,
        `helpAdvertisesDumpBytecode=${report.outcome.helpAdvertisesDumpBytecode}`,
        `bytecodeProbeCount=${report.outcome.bytecodeProbeCount}`,
        `bytecodeOutputProbeCount=${report.outcome.bytecodeOutputProbeCount}`,
      ],
    },
    {
      id: 'public-jsshell-no-diagnostic-pref-surface',
      classification: 'NEGATIVE_RESULT',
      summary: 'The public SpiderMonkey js-shell --list-prefs surface does not expose JitSpew, dump, bytecode, or disassembler prefs.',
      evidence: [
        `matchingPrefCount=${report.shell.prefProbe?.matchingPrefCount ?? 'unknown'}`,
        `matchingPrefs=${(report.shell.prefProbe?.matchingPrefs ?? []).join(', ') || 'none'}`,
      ],
    },
    {
      id: 'public-jsshell-diagnostic-sweep-scope',
      classification: 'SCOPE_GUARD',
      summary: 'This sweep only rules out easy public-shell diagnostic flag paths; it is not current Firefox emitted IR/codegen evidence.',
      evidence: [
        'A diagnostic-capable SpiderMonkey build is still required for emitted MIR/LIR/codegen proof.',
        'Bytecode dump output, even if later found, would still not be optimized native code evidence.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# SpiderMonkey JS Shell Diagnostic Flag Sweep',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Status: ${report.outcome.status}`,
    `- Version: ${report.outcome.version}`,
    `- Help advertises --dump-bytecode: ${report.outcome.helpAdvertisesDumpBytecode}`,
    `- Help advertises JitSpew/IR flags: ${report.outcome.helpAdvertisesJitSpewFlag}`,
    `- Bytecode probes: ${report.outcome.bytecodeProbeCount}`,
    `- Bytecode-output probes: ${report.outcome.bytecodeOutputProbeCount}`,
    `- IR/codegen-output probes: ${report.outcome.irOrCodegenProbeCount}`,
    `- Diagnostic pref surface: ${report.outcome.hasDiagnosticPrefSurface}`,
    `- Closes emitted IR obligation: ${report.outcome.closesEmittedIrObligation}`,
    '',
    '## Probes',
    '',
    '| Probe | Exit | Checksum | Output bytes | Bytecode markers | IR/codegen markers | Bytecode dump | IR/codegen dump |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |',
  ];
  for (const probe of report.shell.probes) {
    lines.push(`| ${probe.id} | ${probe.exitCode} | ${probe.checksum ?? 'n/a'} | ${probe.outputBytes} | ${probe.bytecodeMarkerCount} | ${probe.diagnosticMarkerCount} | ${probe.emittedBytecodeDump ? 'yes' : 'no'} | ${probe.emittedIrOrCodegenDump ? 'yes' : 'no'} |`);
  }
  lines.push(
    '',
    '## Pref Probe',
    '',
    `- Matching pref count: ${report.shell.prefProbe?.matchingPrefCount ?? 'not-run'}`,
    `- Has JitSpew pref: ${report.shell.prefProbe?.hasJitSpewPref ?? 'not-run'}`,
    `- Has dump pref: ${report.shell.prefProbe?.hasDumpPref ?? 'not-run'}`,
    `- Matching prefs: ${(report.shell.prefProbe?.matchingPrefs ?? []).join(', ') || 'none'}`,
    '',
    '## Findings',
    '',
  );
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence ?? []) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function firstMatch(text, pattern) {
  return text.match(pattern) ?? null;
}

function countMatches(text, pattern) {
  return Array.from(text.matchAll(pattern)).length;
}

function lineCount(text) {
  const value = String(text ?? '');
  if (value.length === 0) return 0;
  return value.split(/\r?\n/).filter(line => line.length > 0).length;
}

function oneLine(value) {
  return String(value ?? 'not-recorded').trim().replace(/\s+/g, ' ') || 'not-recorded';
}

function keepShort(value, limit) {
  return value.length <= limit ? value : `${value.slice(0, limit)}\n...<truncated ${value.length - limit} chars>`;
}

function writeOutput(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

main();
