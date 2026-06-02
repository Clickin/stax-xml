import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-release-jsshell-availability-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-release-jsshell-availability-audit.md');
const defaultBinaryProbeFile = resolve(__dirname, 'assets', 'books.xml');
const defaultPackageUrl = 'https://archive.mozilla.org/pub/firefox/releases/143.0.1/jsshell/jsshell-win64.zip';
const defaultSumsUrl = 'https://archive.mozilla.org/pub/firefox/releases/143.0.1/SHA512SUMS';
const defaultPackagePathInSums = 'jsshell/jsshell-win64.zip';
const jitProbeSource = [
  'let ionHits = 0;',
  'function f(x) { if (inIon()) ionHits++; return (x + 1) | 0; }',
  'let checksum = 0;',
  'for (let i = 0; i < 5000; i++) checksum = (checksum + f(i)) | 0;',
  "print('ionHits=' + ionHits);",
  "print('checksum=' + checksum);",
  "print('ionEnable=' + getJitCompilerOptions()['ion.enable']);",
  "print('ionWarmup=' + getJitCompilerOptions()['ion.warmup.trigger']);",
].join(' ');
const builtinProbeSource = [
  "const names = ['hasDisassembler', 'disnative', 'disblic', 'inJit', 'inIon', 'getJitCompilerOptions'];",
  'for (const name of names) print(name + "=" + typeof this[name]);',
  "print('hasDisassemblerValue=' + (typeof hasDisassembler === 'function' ? hasDisassembler() : 'missing'));",
].join(' ');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    jsShell: null,
    packageZip: null,
    sha512sums: null,
    packageUrl: defaultPackageUrl,
    sumsUrl: defaultSumsUrl,
    packagePathInSums: defaultPackagePathInSums,
    packageKind: 'release',
    buildInfoUrl: null,
    buildInfoFile: null,
    binaryProbeFile: defaultBinaryProbeFile,
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
      case '--package-zip':
        options.packageZip = resolve(process.cwd(), readValue());
        break;
      case '--sha512sums':
        options.sha512sums = resolve(process.cwd(), readValue());
        break;
      case '--package-url':
        options.packageUrl = readValue();
        break;
      case '--sums-url':
        options.sumsUrl = readValue();
        break;
      case '--package-path-in-sums':
        options.packagePathInSums = readValue();
        break;
      case '--package-kind':
        options.packageKind = parsePackageKind(readValue(), name);
        break;
      case '--build-info-url':
        options.buildInfoUrl = readValue();
        break;
      case '--build-info-file':
        options.buildInfoFile = resolve(process.cwd(), readValue());
        break;
      case '--binary-probe-file':
        options.binaryProbeFile = resolve(process.cwd(), readValue());
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

function parsePackageKind(value, flag) {
  if (value === 'release' || value === 'nightly') return value;
  throw new Error(`${flag} must be release or nightly.`);
}

function main() {
  const options = parseArgs();
  const report = options.selfTest ? createSelfTestReport(options) : runAudit(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function runAudit(options) {
  const packageVerification = verifyPackage(options);
  const shell = probeShell(options);
  return createReport(options, packageVerification, shell);
}

function verifyPackage(options) {
  const packageExists = options.packageZip && existsSync(options.packageZip);
  const packageSha512 = packageExists
    ? createHash('sha512').update(readFileSync(options.packageZip)).digest('hex')
    : null;
  if (!options.packageZip || !options.sha512sums) {
    return {
      status: 'not-checked',
      packageZip: options.packageZip,
      sha512sums: options.sha512sums,
      packageSha512,
      expectedLine: null,
      hashMatches: null,
    };
  }
  if (!existsSync(options.packageZip) || !existsSync(options.sha512sums)) {
    return {
      status: 'missing-input',
      packageZip: options.packageZip,
      sha512sums: options.sha512sums,
      packageSha512,
      expectedLine: null,
      hashMatches: false,
    };
  }
  const expectedLine = readFileSync(options.sha512sums, 'utf8')
    .split(/\r?\n/)
    .find(line => line.endsWith(`  ${options.packagePathInSums}`)) ?? null;
  return {
    status: expectedLine?.startsWith(`${packageSha512}  `) ? 'verified' : 'mismatch',
    packageZip: options.packageZip,
    sha512sums: options.sha512sums,
    packageSha512,
    expectedLine,
    hashMatches: Boolean(expectedLine?.startsWith(`${packageSha512}  `)),
  };
}

function probeShell(options) {
  const jsShell = options.jsShell;
  if (!jsShell) {
    return {
      status: 'not-configured',
      jsShell: null,
      version: null,
      help: null,
      jitProbe: null,
    };
  }
  if (!existsSync(jsShell)) {
    return {
      status: 'missing',
      jsShell,
      version: null,
      help: null,
      jitProbe: null,
    };
  }
  const version = run(jsShell, ['--version']);
  const help = run(jsShell, ['--help']);
  const builtinProbe = run(jsShell, ['-e', builtinProbeSource]);
  const jitProbe = run(jsShell, [
    '--ion-eager',
    '--ion-offthread-compile=off',
    '-e',
    jitProbeSource,
  ]);
  const nativeDumpProbe = runNativeDumpProbe(jsShell);
  const bytecodeDumpProbe = runBytecodeDumpProbe(jsShell);
  const envJitSpewProbe = runEnvJitSpewProbe(jsShell);
  const apiProbe = runApiProbe(jsShell);
  const binaryInputProbe = runBinaryInputProbe(jsShell, options.binaryProbeFile);
  return {
    status: version.exitCode === 0 && help.exitCode === 0 && jitProbe.exitCode === 0 && builtinProbe.exitCode === 0 ? 'available' : 'probe-failed',
    jsShell,
    version,
    help: summarizeHelp(help.stdout),
    builtinProbe: summarizeBuiltinProbe(builtinProbe),
    jitProbe: summarizeJitProbe(jitProbe),
    nativeDumpProbe,
    bytecodeDumpProbe,
    envJitSpewProbe,
    apiProbe,
    binaryInputProbe,
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
    env: options.env ?? process.env,
  });
  return {
    command,
    args,
    exitCode: result.status,
    error: result.error?.message ?? null,
    stdout: keepShort(String(result.stdout ?? ''), 20_000),
    stderr: keepShort(String(result.stderr ?? ''), 20_000),
  };
}

function summarizeHelp(text) {
  return {
    versionLine: firstMatch(text, /^Version: .+$/m),
    hasIonEager: /--ion-eager\b/.test(text),
    hasIonOffthreadCompile: /--ion-offthread-compile=on\/off\b/.test(text),
    hasDumpBytecode: /--dump-bytecode\b/.test(text),
    hasJitSpewFlag: /JIT_SPEW|IONFLAGS|--enable-jitspew|--iongraph|--dump-ion|--dump-mir|--dump-lir/i.test(text),
    hasInIonHelp: /\binIon\b/.test(text),
  };
}

function summarizeJitProbe(runResult) {
  const combined = `${runResult.stdout}\n${runResult.stderr}`;
  const ionHits = Number(firstMatch(combined, /ionHits=(\d+)/)?.[1] ?? NaN);
  const checksum = Number(firstMatch(combined, /checksum=(-?\d+)/)?.[1] ?? NaN);
  const ionEnable = Number(firstMatch(combined, /ionEnable=(-?\d+)/)?.[1] ?? NaN);
  const ionWarmup = Number(firstMatch(combined, /ionWarmup=(-?\d+)/)?.[1] ?? NaN);
  return {
    exitCode: runResult.exitCode,
    error: runResult.error,
    ionHits: Number.isFinite(ionHits) ? ionHits : null,
    checksum: Number.isFinite(checksum) ? checksum : null,
    ionEnable: Number.isFinite(ionEnable) ? ionEnable : null,
    ionWarmup: Number.isFinite(ionWarmup) ? ionWarmup : null,
    stdout: keepShort(runResult.stdout, 2000),
    stderr: keepShort(runResult.stderr, 2000),
  };
}

function summarizeBuiltinProbe(runResult) {
  const combined = `${runResult.stdout}\n${runResult.stderr}`;
  return {
    exitCode: runResult.exitCode,
    error: runResult.error,
    hasDisassemblerBuiltin: /hasDisassembler=function/.test(combined),
    hasDisnativeBuiltin: /disnative=function/.test(combined),
    hasDisblicBuiltin: /disblic=function/.test(combined),
    hasInJitBuiltin: /inJit=function/.test(combined),
    hasInIonBuiltin: /inIon=function/.test(combined),
    hasJitCompilerOptionsBuiltin: /getJitCompilerOptions=function/.test(combined),
    hasDisassemblerValue: firstMatch(combined, /hasDisassemblerValue=(\w+)/)?.[1] ?? null,
    stdout: keepShort(runResult.stdout, 2000),
    stderr: keepShort(runResult.stderr, 2000),
  };
}

function runNativeDumpProbe(jsShell) {
  const tempDir = mkdtempSync(join(tmpdir(), 'stax-spidermonkey-native-dump-'));
  const nativePath = join(tempDir, 'native.bin');
  const shellPath = nativePath.replace(/\\/g, '/');
  try {
    const result = run(jsShell, [
      '--ion-eager',
      '--ion-offthread-compile=off',
      '-e',
      [
        'function f(x) { return ((x + 1) | 0); }',
        'for (let i = 0; i < 5000; i++) f(i);',
        "print('hasDisassembler=' + hasDisassembler());",
        `try { disnative(f, ${JSON.stringify(shellPath)}); print('disnativeWrite=ok'); } catch (e) { print('disnativeWriteError=' + e); }`,
      ].join(' '),
    ]);
    const fileExists = existsSync(nativePath);
    const bytes = fileExists ? readFileSync(nativePath) : null;
    return {
      exitCode: result.exitCode,
      error: result.error,
      fileCreated: fileExists,
      fileBytes: fileExists ? statSync(nativePath).size : 0,
      fileSha256: bytes ? createHash('sha256').update(bytes).digest('hex') : null,
      hasDisassembler: firstMatch(`${result.stdout}\n${result.stderr}`, /hasDisassembler=(\w+)/)?.[1] ?? null,
      disnativeWriteError: firstMatch(`${result.stdout}\n${result.stderr}`, /disnativeWriteError=(.+)/)?.[1] ?? null,
      stdout: keepShort(result.stdout, 2000),
      stderr: keepShort(result.stderr, 2000),
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function runBytecodeDumpProbe(jsShell) {
  const tempDir = mkdtempSync(join(tmpdir(), 'stax-spidermonkey-bytecode-dump-'));
  const scriptPath = join(tempDir, 'bytecode-probe.js');
  try {
    writeFileSync(scriptPath, [
      'function f(x) { return ((x + 1) | 0); }',
      'let checksum = 0;',
      'for (let i = 0; i < 5000; i++) checksum = (checksum + f(i)) | 0;',
      "print('checksum=' + checksum);",
    ].join('\n'));
    const flags = ['--ion-eager', '--baseline-eager', '--ion-offthread-compile=off', '--dump-bytecode'];
    const result = run(jsShell, [...flags, scriptPath]);
    const combined = `${result.stdout}\n${result.stderr}`;
    const bytecodeMarkerCount = countMatches(
      combined,
      /\b(?:Bytecode|IonScript|BB\s+#\d+|loc\s+op|main:\s+script|function f|JSOp|JOF_|ICEntry|JumpTarget)\b/g,
    );
    const checksum = Number(firstMatch(combined, /checksum=(-?\d+)/)?.[1] ?? NaN);
    const outputBytes = Buffer.byteLength(combined, 'utf8');
    return {
      status: result.exitCode === 0
        ? bytecodeMarkerCount > 0 ? 'bytecode-output-emitted' : 'no-bytecode-output'
        : 'failed',
      exitCode: result.exitCode,
      error: result.error,
      flags: flags.join(' '),
      scriptPathBasename: 'bytecode-probe.js',
      outputBytes,
      bytecodeMarkerCount,
      checksum: Number.isFinite(checksum) ? checksum : null,
      stdoutLineCount: lineCount(result.stdout),
      stderrLineCount: lineCount(result.stderr),
      stdout: keepShort(result.stdout, 4000),
      stderr: keepShort(result.stderr, 4000),
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function runEnvJitSpewProbe(jsShell) {
  const flags = 'logs,codegen,mir,lir,aborts,scripts';
  const result = run(jsShell, [
    '--ion-eager',
    '--ion-offthread-compile=off',
    '-e',
    [
      'let ionHits = 0;',
      'function f(x) { if (inIon()) ionHits++; return ((x + 1) | 0); }',
      'let checksum = 0;',
      'for (let i = 0; i < 5000; i++) checksum = (checksum + f(i)) | 0;',
      "print('ionHits=' + ionHits);",
      "print('checksum=' + checksum);",
    ].join(' '),
  ], {
    env: {
      ...process.env,
      IONFLAGS: flags,
      JIT_SPEW: flags,
    },
  });
  const combined = `${result.stdout}\n${result.stderr}`;
  const ionHits = Number(firstMatch(combined, /ionHits=(\d+)/)?.[1] ?? NaN);
  const checksum = Number(firstMatch(combined, /checksum=(-?\d+)/)?.[1] ?? NaN);
  const diagnosticMarkerCount = countMatches(
    combined,
    /\b(?:JitSpew|IonBuilder|CodeGenerator|GenerateCode|Lowering|MIR|LIR|MBasicBlock|Snapshot|Bailout|RegisterAllocator)\b/g,
  );
  return {
    status: result.exitCode === 0
      ? diagnosticMarkerCount > 0 ? 'jitspew-output-emitted' : 'no-jitspew-output'
      : 'failed',
    flags,
    exitCode: result.exitCode,
    error: result.error,
    ionHits: Number.isFinite(ionHits) ? ionHits : null,
    checksum: Number.isFinite(checksum) ? checksum : null,
    outputBytes: Buffer.byteLength(combined, 'utf8'),
    diagnosticMarkerCount,
    stdoutLineCount: lineCount(result.stdout),
    stderrLineCount: lineCount(result.stderr),
    stdout: keepShort(result.stdout, 4000),
    stderr: keepShort(result.stderr, 4000),
  };
}

function runApiProbe(jsShell) {
  const script = [
    "const names = ['TextDecoder','TextEncoder','ReadableStream','TransformStream','fetch','performance','console','setTimeout','Promise','URL','ArrayBuffer','Uint8Array','DataView','read','snarf','os'];",
    'for (const name of names) print(name + "=" + typeof this[name]);',
  ].join(' ');
  const result = run(jsShell, ['-e', script]);
  const combined = `${result.stdout}\n${result.stderr}`;
  const typeOf = name => firstMatch(combined, new RegExp(`${name}=(\\w+)`))?.[1] ?? null;
  return {
    exitCode: result.exitCode,
    error: result.error,
    TextDecoder: typeOf('TextDecoder'),
    TextEncoder: typeOf('TextEncoder'),
    ReadableStream: typeOf('ReadableStream'),
    TransformStream: typeOf('TransformStream'),
    fetch: typeOf('fetch'),
    performance: typeOf('performance'),
    console: typeOf('console'),
    setTimeout: typeOf('setTimeout'),
    Promise: typeOf('Promise'),
    URL: typeOf('URL'),
    ArrayBuffer: typeOf('ArrayBuffer'),
    Uint8Array: typeOf('Uint8Array'),
    DataView: typeOf('DataView'),
    read: typeOf('read'),
    snarf: typeOf('snarf'),
    os: typeOf('os'),
    stdout: keepShort(result.stdout, 2000),
    stderr: keepShort(result.stderr, 2000),
  };
}

function runBinaryInputProbe(jsShell, filePath) {
  if (!filePath || !existsSync(filePath)) {
    return {
      status: 'missing-input',
      filePath,
      exitCode: null,
      byteLength: null,
      checksum: null,
      firstBytes: null,
      error: null,
    };
  }
  const relativePath = relative(process.cwd(), filePath);
  const pathForShell = relativePath && !relativePath.startsWith('..') && !isAbsolute(relativePath)
    ? relativePath
    : filePath;
  const shellPath = pathForShell.replace(/\\/g, '/');
  const script = [
    `const bytes = read(${JSON.stringify(shellPath)}, 'binary');`,
    'let checksum = 0;',
    'for (let i = 0; i < bytes.length; i++) checksum = (checksum + bytes[i]) | 0;',
    "print('byteLength=' + bytes.length);",
    "print('checksum=' + checksum);",
    "print('firstBytes=' + Array.prototype.join.call(bytes.slice(0, 8), ','));",
  ].join(' ');
  const result = run(jsShell, ['-e', script]);
  const combined = `${result.stdout}\n${result.stderr}`;
  const byteLength = Number(firstMatch(combined, /byteLength=(\d+)/)?.[1] ?? NaN);
  const checksum = Number(firstMatch(combined, /checksum=(-?\d+)/)?.[1] ?? NaN);
  return {
    status: result.exitCode === 0 && Number.isFinite(byteLength) ? 'ok' : 'failed',
    filePath,
    exitCode: result.exitCode,
    byteLength: Number.isFinite(byteLength) ? byteLength : null,
    checksum: Number.isFinite(checksum) ? checksum : null,
    firstBytes: firstMatch(combined, /firstBytes=([0-9,]*)/)?.[1] ?? null,
    error: result.error,
    stdout: keepShort(result.stdout, 2000),
    stderr: keepShort(result.stderr, 2000),
  };
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

function createSelfTestReport(options) {
  return createReport(
    options,
    {
      status: 'verified',
      packageZip: 'self-test/jsshell-win64.zip',
      sha512sums: 'self-test/SHA512SUMS',
      packageSha512: 'abc123',
      expectedLine: `abc123  ${options.packagePathInSums}`,
      hashMatches: true,
    },
    {
      status: 'available',
      jsShell: 'self-test/js.exe',
      version: { exitCode: 0, stdout: 'JavaScript-C143.0.1\n', stderr: '', error: null },
      help: {
        versionLine: 'Version: JavaScript-C143.0.1',
        hasIonEager: true,
        hasIonOffthreadCompile: true,
        hasDumpBytecode: true,
        hasJitSpewFlag: false,
        hasInIonHelp: false,
      },
      builtinProbe: {
        exitCode: 0,
        error: null,
        hasDisassemblerBuiltin: true,
        hasDisnativeBuiltin: true,
        hasDisblicBuiltin: true,
        hasInJitBuiltin: true,
        hasInIonBuiltin: true,
        hasJitCompilerOptionsBuiltin: true,
        hasDisassemblerValue: 'false',
        stdout: 'hasDisassembler=function\ndisnative=function\ndisblic=function\ninJit=function\ninIon=function\ngetJitCompilerOptions=function\nhasDisassemblerValue=false\n',
        stderr: '',
      },
      jitProbe: {
        exitCode: 0,
        error: null,
        ionHits: 4988,
        checksum: 12502500,
        ionEnable: 1,
        ionWarmup: 0,
        stdout: 'ionHits=4988\nchecksum=12502500\nionEnable=1\nionWarmup=0\n',
        stderr: '',
      },
      nativeDumpProbe: {
        exitCode: 0,
        error: null,
        fileCreated: true,
        fileBytes: 93,
        fileSha256: 'self-test-sha256',
        hasDisassembler: 'false',
        disnativeWriteError: 'Error: Did not write all function bytes to the file.',
        stdout: 'hasDisassembler=false\ndisnativeWriteError=Error: Did not write all function bytes to the file.\n',
        stderr: '',
      },
      bytecodeDumpProbe: {
        status: 'bytecode-output-emitted',
        exitCode: 0,
        error: null,
        flags: '--ion-eager --baseline-eager --ion-offthread-compile=off --dump-bytecode',
        scriptPathBasename: 'bytecode-probe.js',
        outputBytes: 160,
        bytecodeMarkerCount: 3,
        checksum: 12502500,
        stdoutLineCount: 1,
        stderrLineCount: 8,
        stdout: 'checksum=12502500\n',
        stderr: 'IonScript [1 blocks]:\nBB #0 [00000,1,15] :: 3534 hits\n',
      },
      envJitSpewProbe: {
        status: 'no-jitspew-output',
        flags: 'logs,codegen,mir,lir,aborts,scripts',
        exitCode: 0,
        error: null,
        ionHits: 4988,
        checksum: 12502500,
        outputBytes: 29,
        diagnosticMarkerCount: 0,
        stdoutLineCount: 2,
        stderrLineCount: 0,
        stdout: 'ionHits=4988\nchecksum=12502500\n',
        stderr: '',
      },
      apiProbe: {
        exitCode: 0,
        error: null,
        TextDecoder: 'undefined',
        TextEncoder: 'undefined',
        ReadableStream: 'undefined',
        TransformStream: 'undefined',
        fetch: 'undefined',
        performance: 'object',
        console: 'object',
        setTimeout: 'function',
        Promise: 'function',
        URL: 'undefined',
        ArrayBuffer: 'function',
        Uint8Array: 'function',
        DataView: 'function',
        read: 'function',
        snarf: 'function',
        os: 'object',
        stdout: 'TextDecoder=undefined\nUint8Array=function\nread=function\n',
        stderr: '',
      },
      binaryInputProbe: {
        status: 'ok',
        filePath: 'self-test/books.xml',
        exitCode: 0,
        byteLength: 4551,
        checksum: 356687,
        firstBytes: '60,63,120,109,108,32,118,101',
        error: null,
        stdout: 'byteLength=4551\nchecksum=356687\nfirstBytes=60,63,120,109,108,32,118,101\n',
        stderr: '',
      },
    },
  );
}

function createReport(options, packageVerification, shell) {
  const objective = `firefox-spidermonkey-${options.packageKind}-jsshell-availability-audit`;
  const contract = `official-firefox-${options.packageKind}-jsshell-jit-status-and-diagnostic-surface`;
  const hasJitExecutionStatus = shell.jitProbe?.ionHits > 0 && shell.jitProbe?.ionEnable === 1;
  const hasIrDumpSurface = shell.help?.hasJitSpewFlag === true;
  const hasBytecodeDumpOutput = shell.bytecodeDumpProbe?.status === 'bytecode-output-emitted';
  const hasEnvJitSpewOutput = shell.envJitSpewProbe?.status === 'jitspew-output-emitted';
  const report = {
    generatedAt: new Date().toISOString(),
    objective,
    contract,
    note: `Checks an official Firefox ${options.packageKind} SpiderMonkey JavaScript shell package for local JIT execution status and diagnostic surface. This is not emitted JIT IR, optimized-code, throughput, or browser evidence.`,
    environment: {
      platform: `${process.platform}-${process.arch}`,
    },
    parameters: {
      packageUrl: options.packageUrl,
      sumsUrl: options.sumsUrl,
      packagePathInSums: options.packagePathInSums,
      packageKind: options.packageKind,
      buildInfoUrl: options.buildInfoUrl,
      selfTest: options.selfTest,
    },
    buildInfo: readBuildInfo(options),
    packageVerification,
    shell,
    outcome: {
      status: shell.status,
      packageVerified: packageVerification.hashMatches === true,
      hasJitExecutionStatus,
      hasIrDumpSurface,
      hasBytecodeDumpOutput,
      hasEnvJitSpewOutput,
      hasNativeDisassemblySurface: shell.builtinProbe?.hasDisassemblerValue === 'true',
      nativeDumpComplete: shell.nativeDumpProbe?.fileCreated === true && shell.nativeDumpProbe?.disnativeWriteError === null,
      canReadBinaryInput: shell.binaryInputProbe?.status === 'ok',
      canRunCurrentStaxFullStringBenchmark: shell.apiProbe?.TextDecoder === 'function'
        && shell.apiProbe?.TextEncoder === 'function'
        && shell.apiProbe?.ReadableStream === 'function'
        && shell.apiProbe?.fetch === 'function'
        && shell.apiProbe?.Uint8Array === 'function'
        && shell.binaryInputProbe?.status === 'ok',
      closesEmittedIrObligation: false,
    },
  };
  report.findings = createFindings(report);
  return report;
}

function readBuildInfo(options) {
  if (!options.buildInfoFile) {
    return {
      status: 'not-configured',
      url: options.buildInfoUrl,
      file: null,
      buildId: null,
      sourceRevision: null,
      sourceUrl: null,
      raw: null,
    };
  }
  if (!existsSync(options.buildInfoFile)) {
    return {
      status: 'missing-input',
      url: options.buildInfoUrl,
      file: options.buildInfoFile,
      buildId: null,
      sourceRevision: null,
      sourceUrl: null,
      raw: null,
    };
  }
  const raw = readFileSync(options.buildInfoFile, 'utf8').trim();
  const lines = raw.split(/\r?\n/);
  const sourceUrl = firstMatch(raw, /(https:\/\/hg\.mozilla\.org\/[^\s]+)/)?.[1] ?? null;
  return {
    status: 'ok',
    url: options.buildInfoUrl,
    file: options.buildInfoFile,
    buildId: lines[0] ?? null,
    sourceRevision: firstMatch(raw, /https:\/\/hg\.mozilla\.org\/[^\s]+\/rev\/([0-9a-f]+)/)?.[1] ?? null,
    sourceUrl,
    raw,
  };
}

function createFindings(report) {
  const packageKind = report.parameters.packageKind;
  return [
    {
      id: `official-${packageKind}-jsshell-available`,
      classification: 'ENVIRONMENT_FACT',
      summary: report.outcome.status === 'available'
        ? `The official Firefox ${packageKind} SpiderMonkey JavaScript shell is executable locally.`
        : `The official Firefox ${packageKind} SpiderMonkey JavaScript shell was not executable locally.`,
      evidence: [
        `version=${oneLine(report.shell.version?.stdout)}`,
        `packageVerified=${report.outcome.packageVerified}`,
        `packageUrl=${report.parameters.packageUrl}`,
      ],
    },
    {
      id: 'spidermonkey-jit-status-observed',
      classification: report.outcome.hasJitExecutionStatus ? 'TRACE_FACT' : 'NEGATIVE_RESULT',
      summary: report.outcome.hasJitExecutionStatus
        ? `The ${packageKind} SpiderMonkey shell can observe Ion execution status with inIon() under --ion-eager.`
        : `The ${packageKind} SpiderMonkey shell did not observe Ion execution status in the probe.`,
      evidence: [
        `ionHits=${report.shell.jitProbe?.ionHits ?? 'unknown'}`,
        `checksum=${report.shell.jitProbe?.checksum ?? 'unknown'}`,
        `ionEnable=${report.shell.jitProbe?.ionEnable ?? 'unknown'}`,
        `ionWarmup=${report.shell.jitProbe?.ionWarmup ?? 'unknown'}`,
      ],
    },
    {
      id: `spidermonkey-${packageKind}-jsshell-no-ir-dump-surface`,
      classification: 'NEGATIVE_RESULT',
      summary: `The ${packageKind} SpiderMonkey shell exposes Ion controls and native dump helper names, but no active disassembler or JitSpew/IONFLAGS/IR dump surface.`,
      evidence: [
        `hasIonEager=${report.shell.help?.hasIonEager ?? 'unknown'}`,
        `hasIonOffthreadCompile=${report.shell.help?.hasIonOffthreadCompile ?? 'unknown'}`,
        `hasDumpBytecode=${report.shell.help?.hasDumpBytecode ?? 'unknown'}`,
        `hasBytecodeDumpOutput=${report.outcome.hasBytecodeDumpOutput}`,
        `hasJitSpewFlag=${report.shell.help?.hasJitSpewFlag ?? 'unknown'}`,
        `hasDisnativeBuiltin=${report.shell.builtinProbe?.hasDisnativeBuiltin ?? 'unknown'}`,
        `hasDisblicBuiltin=${report.shell.builtinProbe?.hasDisblicBuiltin ?? 'unknown'}`,
        `hasDisassembler=${report.shell.builtinProbe?.hasDisassemblerValue ?? 'unknown'}`,
        `bytecodeDumpStatus=${report.shell.bytecodeDumpProbe?.status ?? 'unknown'}`,
        `bytecodeDumpMarkers=${report.shell.bytecodeDumpProbe?.bytecodeMarkerCount ?? 'unknown'}`,
        `envJitSpewStatus=${report.shell.envJitSpewProbe?.status ?? 'unknown'}`,
        `envJitSpewMarkers=${report.shell.envJitSpewProbe?.diagnosticMarkerCount ?? 'unknown'}`,
        `envJitSpewStderrLines=${report.shell.envJitSpewProbe?.stderrLineCount ?? 'unknown'}`,
        `nativeDumpBytes=${report.shell.nativeDumpProbe?.fileBytes ?? 'unknown'}`,
        `nativeDumpError=${report.shell.nativeDumpProbe?.disnativeWriteError ?? 'none'}`,
        'This narrows the local diagnostic path but does not close the emitted JIT IR obligation.',
      ],
    },
    {
      id: `spidermonkey-${packageKind}-jsshell-stax-api-gap`,
      classification: 'NEGATIVE_RESULT',
      summary: `The ${packageKind} SpiderMonkey shell can read binary XML into Uint8Array, but lacks TextDecoder/TextEncoder and Web stream globals needed to run the current full-string stax-xml benchmark unchanged.`,
      evidence: [
        `TextDecoder=${report.shell.apiProbe?.TextDecoder ?? 'unknown'}`,
        `TextEncoder=${report.shell.apiProbe?.TextEncoder ?? 'unknown'}`,
        `ReadableStream=${report.shell.apiProbe?.ReadableStream ?? 'unknown'}`,
        `fetch=${report.shell.apiProbe?.fetch ?? 'unknown'}`,
        `Uint8Array=${report.shell.apiProbe?.Uint8Array ?? 'unknown'}`,
        `binaryInput=${report.shell.binaryInputProbe?.status ?? 'unknown'}`,
        `binaryBytes=${report.shell.binaryInputProbe?.byteLength ?? 'unknown'}`,
        `canRunCurrentStaxFullStringBenchmark=${report.outcome.canRunCurrentStaxFullStringBenchmark}`,
      ],
    },
    {
      id: `${packageKind}-jsshell-scope`,
      classification: 'SCOPE_GUARD',
      summary: 'This audit is shell JIT-status evidence only; it is not browser throughput, allocation, emitted IR, or optimized-code evidence.',
      evidence: [
        'A diagnostic-capable SpiderMonkey shell or Firefox build is still required for emitted MIR/LIR/codegen dump evidence.',
        '--dump-bytecode output, if available, is bytecode diagnostic evidence and is not MIR/LIR or optimized native code.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const packageKindLabel = report.parameters.packageKind[0].toUpperCase() + report.parameters.packageKind.slice(1);
  const lines = [
    `# Firefox SpiderMonkey ${packageKindLabel} JS Shell Availability Audit`,
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Status: ${report.outcome.status}`,
    `- Package verified: ${report.outcome.packageVerified}`,
    `- JIT execution status observed: ${report.outcome.hasJitExecutionStatus}`,
    `- IR dump surface present: ${report.outcome.hasIrDumpSurface}`,
    `- Bytecode dump output emitted: ${report.outcome.hasBytecodeDumpOutput}`,
    `- IONFLAGS/JIT_SPEW output emitted: ${report.outcome.hasEnvJitSpewOutput}`,
    `- Native disassembly surface present: ${report.outcome.hasNativeDisassemblySurface}`,
    `- Native dump complete: ${report.outcome.nativeDumpComplete}`,
    `- Binary XML input readable: ${report.outcome.canReadBinaryInput}`,
    `- Can run current stax full-string benchmark unchanged: ${report.outcome.canRunCurrentStaxFullStringBenchmark}`,
    `- Closes emitted IR obligation: ${report.outcome.closesEmittedIrObligation}`,
    `- Package URL: ${report.parameters.packageUrl}`,
    `- Sums URL: ${report.parameters.sumsUrl}`,
    `- Build id: ${report.buildInfo.buildId ?? 'not-recorded'}`,
    `- Source revision: ${report.buildInfo.sourceRevision ?? 'not-recorded'}`,
    '',
    '## Package Verification',
    '',
    `- Status: ${report.packageVerification.status}`,
    `- SHA512 match: ${report.packageVerification.hashMatches}`,
    `- SHA512: ${report.packageVerification.packageSha512 ?? 'not-recorded'}`,
    `- Expected line: ${report.packageVerification.expectedLine ?? 'not-recorded'}`,
    '',
    '## Build Info',
    '',
    `- Status: ${report.buildInfo.status}`,
    `- URL: ${report.buildInfo.url ?? 'not-recorded'}`,
    `- File: ${report.buildInfo.file ?? 'not-recorded'}`,
    `- Build id: ${report.buildInfo.buildId ?? 'not-recorded'}`,
    `- Source revision: ${report.buildInfo.sourceRevision ?? 'not-recorded'}`,
    `- Source URL: ${report.buildInfo.sourceUrl ?? 'not-recorded'}`,
    '',
    '## Shell Surface',
    '',
    `- JS shell: ${report.shell.jsShell ?? 'not-configured'}`,
    `- Version: ${oneLine(report.shell.version?.stdout)}`,
    `- Help version: ${report.shell.help?.versionLine ?? 'not-recorded'}`,
    `- has --ion-eager: ${report.shell.help?.hasIonEager}`,
    `- has --ion-offthread-compile: ${report.shell.help?.hasIonOffthreadCompile}`,
    `- has --dump-bytecode: ${report.shell.help?.hasDumpBytecode}`,
    `- has JitSpew/IR dump flag surface: ${report.shell.help?.hasJitSpewFlag}`,
    `- has disnative builtin: ${report.shell.builtinProbe?.hasDisnativeBuiltin}`,
    `- has disblic builtin: ${report.shell.builtinProbe?.hasDisblicBuiltin}`,
    `- has inJit builtin: ${report.shell.builtinProbe?.hasInJitBuiltin}`,
    `- hasDisassembler(): ${report.shell.builtinProbe?.hasDisassemblerValue ?? 'not-recorded'}`,
    `- TextDecoder: ${report.shell.apiProbe?.TextDecoder ?? 'not-recorded'}`,
    `- TextEncoder: ${report.shell.apiProbe?.TextEncoder ?? 'not-recorded'}`,
    `- ReadableStream: ${report.shell.apiProbe?.ReadableStream ?? 'not-recorded'}`,
    `- fetch: ${report.shell.apiProbe?.fetch ?? 'not-recorded'}`,
    `- binary read helper: ${report.shell.apiProbe?.read ?? 'not-recorded'}`,
    '',
    '## JIT Status Probe',
    '',
    `- Exit code: ${report.shell.jitProbe?.exitCode ?? 'not-run'}`,
    `- Ion hits: ${report.shell.jitProbe?.ionHits ?? 'not-recorded'}`,
    `- Checksum: ${report.shell.jitProbe?.checksum ?? 'not-recorded'}`,
    `- ion.enable: ${report.shell.jitProbe?.ionEnable ?? 'not-recorded'}`,
    `- ion.warmup.trigger: ${report.shell.jitProbe?.ionWarmup ?? 'not-recorded'}`,
    '',
    '## Bytecode Dump Probe',
    '',
    `- Status: ${report.shell.bytecodeDumpProbe?.status ?? 'not-run'}`,
    `- Exit code: ${report.shell.bytecodeDumpProbe?.exitCode ?? 'not-run'}`,
    `- Checksum: ${report.shell.bytecodeDumpProbe?.checksum ?? 'not-recorded'}`,
    `- Output bytes: ${report.shell.bytecodeDumpProbe?.outputBytes ?? 'not-recorded'}`,
    `- Bytecode marker count: ${report.shell.bytecodeDumpProbe?.bytecodeMarkerCount ?? 'not-recorded'}`,
    `- Stdout lines: ${report.shell.bytecodeDumpProbe?.stdoutLineCount ?? 'not-recorded'}`,
    `- Stderr lines: ${report.shell.bytecodeDumpProbe?.stderrLineCount ?? 'not-recorded'}`,
    '',
    '## IONFLAGS/JIT_SPEW Probe',
    '',
    `- Status: ${report.shell.envJitSpewProbe?.status ?? 'not-run'}`,
    `- Flags: ${report.shell.envJitSpewProbe?.flags ?? 'not-recorded'}`,
    `- Exit code: ${report.shell.envJitSpewProbe?.exitCode ?? 'not-run'}`,
    `- Ion hits: ${report.shell.envJitSpewProbe?.ionHits ?? 'not-recorded'}`,
    `- Checksum: ${report.shell.envJitSpewProbe?.checksum ?? 'not-recorded'}`,
    `- Output bytes: ${report.shell.envJitSpewProbe?.outputBytes ?? 'not-recorded'}`,
    `- Diagnostic marker count: ${report.shell.envJitSpewProbe?.diagnosticMarkerCount ?? 'not-recorded'}`,
    `- Stdout lines: ${report.shell.envJitSpewProbe?.stdoutLineCount ?? 'not-recorded'}`,
    `- Stderr lines: ${report.shell.envJitSpewProbe?.stderrLineCount ?? 'not-recorded'}`,
    '',
    '## Native Dump Probe',
    '',
    `- File created: ${report.shell.nativeDumpProbe?.fileCreated ?? 'not-run'}`,
    `- File bytes: ${report.shell.nativeDumpProbe?.fileBytes ?? 'not-recorded'}`,
    `- File SHA256: ${report.shell.nativeDumpProbe?.fileSha256 ?? 'not-recorded'}`,
    `- hasDisassembler: ${report.shell.nativeDumpProbe?.hasDisassembler ?? 'not-recorded'}`,
    `- disnative write error: ${report.shell.nativeDumpProbe?.disnativeWriteError ?? 'none'}`,
    '',
    '## Binary Input Probe',
    '',
    `- Status: ${report.shell.binaryInputProbe?.status ?? 'not-run'}`,
    `- File: ${report.shell.binaryInputProbe?.filePath ?? 'not-recorded'}`,
    `- Byte length: ${report.shell.binaryInputProbe?.byteLength ?? 'not-recorded'}`,
    `- Checksum: ${report.shell.binaryInputProbe?.checksum ?? 'not-recorded'}`,
    `- First bytes: ${report.shell.binaryInputProbe?.firstBytes ?? 'not-recorded'}`,
    '',
    '## Findings',
    '',
  ];
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence ?? []) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeOutput(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function printSummary(report) {
  console.log(`${report.objective}: status=${report.outcome.status} jitStatus=${report.outcome.hasJitExecutionStatus} irDumpSurface=${report.outcome.hasIrDumpSurface}`);
}

function keepShort(value, limit = 4000) {
  return value.length <= limit ? value : `${value.slice(0, limit)}\n...<truncated ${value.length - limit} chars>`;
}

function oneLine(value) {
  return String(value ?? 'not-recorded').trim().replace(/\s+/g, ' ') || 'not-recorded';
}

main();
