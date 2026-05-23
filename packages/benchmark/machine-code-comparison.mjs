import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StreamEventType, StreamReaderSync } from '../stax-xml/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultOutputDir = join(__dirname, 'results', 'machine-code-comparison', new Date().toISOString().replace(/[:.]/g, '-'));
const defaultFixture = join(__dirname, 'test-data', 'runtime-comparison-16mib.xml');
const woodstoxDir = join(__dirname, 'external', 'woodstox');
const quickXmlDir = join(__dirname, 'external', 'quick-xml');
const woodstoxJar = join(woodstoxDir, 'target', 'woodstox-baseline-1.0.0-bench.jar');
const quickXmlCargo = join(quickXmlDir, 'Cargo.toml');
const targetFunctions = ['consumeStaxStream', 'foldString'];
const marker = '[stax-machine-code-target] done';

const patternSpecs = {
  v8Bytecode: [
    ['Runtime', /\bRuntime\b|CallRuntime|StaGlobal|GetNamedProperty/g],
    ['CallProperty', /\bCallProperty\b/g],
    ['GetNamedProperty', /\bGetNamedProperty\b/g],
    ['CreateObjectLiteral', /\bCreateObjectLiteral\b/g],
  ],
  v8Opt: [
    ['CEntry', /\bCEntry(?:\b|_)/g],
    ['Runtime', /\bRuntime_|CallRuntime|TailCallRuntime/g],
    ['DeoptExit', /deopt reason|deopt index|bailout|deopt-eager/g],
    ['TextDecoder', /TextDecoder|decodeUTF8|_decode|validateDecoder/g],
    ['TypedArraySubArray', /TypedArrayPrototypeSubArray|subarray/g],
    ['Call', /\bcall\b|\bCall\b/g],
  ],
  jsc: [
    ['GeneratedJitCode', /Generated (?:Baseline |DFG |FTL |JIT )?code|Generated JIT code/g],
    ['ConsumeLinks', /Linking call in consumeStaxStream#/g],
    ['ConsumeBaseline', /Generated Baseline JIT code for consumeStaxStream#/g],
    ['FoldStringBaseline', /Generated Baseline JIT code for foldString#/g],
    ['Baseline', /\bBaseline\b/g],
    ['DFG', /\bDFG\b/g],
    ['B3', /\bB3\b|\bb3\s+/g],
    ['Air', /\bAir\b/g],
    ['Patchpoint', /\bPatchpoint\b/g],
    ['SlowPath', /SlowPath|slow_/g],
    ['TextDecoder', /TextDecoder|decode/gi],
    ['TypedArray', /TypedArray|Uint8Array|ArrayBuffer/g],
    ['Call', /\bcallq?\b|\bCall\b/g],
  ],
  jvmBytecode: [
    ['invoke', /\binvoke(?:virtual|interface|static|special)\b/g],
    ['invokeinterface', /\binvokeinterface\b/g],
    ['new', /\bnew\b/g],
    ['getfield', /\bgetfield\b/g],
    ['if', /\bif(?:eq|ne|lt|ge|gt|le|nonnull|null|_icmp\w*)\b/g],
  ],
  rustAsm: [
    ['memchr', /memchr/gi],
    ['simdCompare', /\b(?:v?pcmpeq|v?pcmp|v?ptest|v?pmovmskb|v?movdqu|v?movdqa|v?pshufb)\b/gi],
    ['call', /\bcall[q]?\b/gi],
    ['branch', /\b(?:je|jne|jae|jbe|jg|jl|jmp)\b/gi],
    ['utf8', /utf8|from_utf8|core::str/gi],
  ],
};

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    outputDir: defaultOutputDir,
    fixture: defaultFixture,
    mode: 'driver',
    selfTest: false,
    quick: false,
    skipV8: false,
    skipJsc: false,
    skipJvm: false,
    skipQuickXmlAsm: false,
    skipBuild: false,
    elements: 512,
    warmups: 80,
    iterations: 8,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg === '--') continue;
    if (arg === '--self-test') {
      options.selfTest = true;
      continue;
    }
    if (arg === '--quick') {
      options.quick = true;
      options.elements = 96;
      options.warmups = 20;
      options.iterations = 3;
      continue;
    }
    if (arg === '--skip-v8') {
      options.skipV8 = true;
      continue;
    }
    if (arg === '--skip-jsc') {
      options.skipJsc = true;
      continue;
    }
    if (arg === '--skip-jvm') {
      options.skipJvm = true;
      continue;
    }
    if (arg === '--skip-quick-xml-asm') {
      options.skipQuickXmlAsm = true;
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
      case '--mode':
        options.mode = readValue();
        break;
      case '--output-dir':
        options.outputDir = resolve(process.cwd(), readValue());
        break;
      case '--fixture':
        options.fixture = resolve(process.cwd(), readValue());
        break;
      case '--elements':
        options.elements = parsePositiveInteger(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--iterations':
        options.iterations = parsePositiveInteger(readValue(), name);
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

function runCommand(command, args, cwd = repoRoot) {
  if (process.platform === 'win32' && (command === 'mvn' || command === 'cargo')) {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', formatWindowsCommand(command, args)], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function formatWindowsCommand(command, args) {
  return [command, ...args].map(quoteWindowsArg).join(' ');
}

function quoteWindowsArg(value) {
  if (/^[A-Za-z0-9_./:=\\-]+$/.test(value)) return value;
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function trimSpawnOutput(result) {
  return String(result.stderr ?? '').trim() || String(result.stdout ?? '').trim();
}

function main() {
  const options = parseArgs();
  if (options.mode === 'v8-target') {
    runV8Target(options);
    return;
  }

  mkdirSync(options.outputDir, { recursive: true });
  const staticEvidence = options.selfTest
    ? createSelfTestEvidence(options.outputDir)
    : captureStaticEvidence(options);
  const report = createReport(options, staticEvidence);

  writeFileSync(join(options.outputDir, 'comparison-summary.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(join(options.outputDir, 'machine-code-comparison.md'), createMarkdown(report), 'utf8');
  console.log(`Wrote ${join(options.outputDir, 'comparison-summary.json')}`);
  console.log(`Wrote ${join(options.outputDir, 'machine-code-comparison.md')}`);
}

function captureStaticEvidence(options) {
  return {
    v8: options.skipV8 ? skippedEvidence('skipped') : captureV8(options),
    jsc: options.skipJsc ? skippedEvidence('skipped') : captureJsc(options),
    jvm: options.skipJvm ? skippedEvidence('skipped') : captureJvm(options),
    quickXml: options.skipQuickXmlAsm ? skippedEvidence('skipped') : captureQuickXmlAsm(options),
  };
}

function skippedEvidence(reason) {
  return { status: 'skipped', reason, artifacts: [] };
}

function captureV8(options) {
  const outputDir = join(options.outputDir, 'v8');
  mkdirSync(outputDir, { recursive: true });
  const bytecodeArtifacts = [];
  const optArtifacts = [];
  const traceArtifacts = [];

  for (const functionName of targetFunctions) {
    const bytecodePath = join(outputDir, `${functionName}.bytecode.log`);
    const bytecode = runNodeTrace([
      '--print-bytecode',
      `--print-bytecode-filter=${functionName}`,
      import.meta.filename ?? fileURLToPath(import.meta.url),
      '--mode',
      'v8-target',
      '--elements',
      String(options.elements),
      '--warmups',
      String(options.warmups),
      '--iterations',
      String(options.iterations),
    ]);
    writeFileSync(bytecodePath, `${bytecode.stdout}\n${bytecode.stderr}`, 'utf8');
    bytecodeArtifacts.push(bytecodePath);

    const optPath = join(outputDir, `${functionName}.optcode.log`);
    const opt = runNodeTrace([
      '--allow-natives-syntax',
      '--trace-opt',
      '--trace-deopt',
      '--print-opt-code',
      `--print-opt-code-filter=${functionName}`,
      import.meta.filename ?? fileURLToPath(import.meta.url),
      '--mode',
      'v8-target',
      '--elements',
      String(options.elements),
      '--warmups',
      String(options.warmups),
      '--iterations',
      String(options.iterations),
    ]);
    writeFileSync(optPath, `${opt.stdout}\n${opt.stderr}`, 'utf8');
    optArtifacts.push(optPath);
    traceArtifacts.push(optPath);
  }

  const bytecodeText = bytecodeArtifacts.map(path => readFileSync(path, 'utf8')).join('\n');
  const optText = optArtifacts.map(path => readFileSync(path, 'utf8')).join('\n');
  return {
    status: 'ok',
    artifacts: [...bytecodeArtifacts, ...optArtifacts],
    bytecode: {
      patterns: countPatterns(bytecodeText, patternSpecs.v8Bytecode),
      bytecodeLengths: collectNumbers(bytecodeText, /Bytecode length:\s+(\d+)/g),
    },
    optimizedAsm: {
      patterns: countPatterns(optText, patternSpecs.v8Opt),
      instructionSizes: collectNumbers(optText, /Instructions \(size = (\d+)\)/g),
    },
    trace: {
      patterns: countPatterns(traceArtifacts.map(path => readFileSync(path, 'utf8')).join('\n'), patternSpecs.v8Opt),
    },
  };
}

function runNodeTrace(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`node trace failed: ${trimSpawnOutput(result)}`);
  }
  return result;
}

function captureJsc(options) {
  const outputDir = join(options.outputDir, 'jsc');
  mkdirSync(outputDir, { recursive: true });
  const version = spawnSync('bun', ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (version.error || version.status !== 0) {
    return skippedEvidence(`bun unavailable: ${trimSpawnOutput(version) || version.error?.message || 'unknown error'}`);
  }

  const jscPath = join(outputDir, 'consumeStaxStream.jsc.log');
  const result = spawnSync('bun', [
    import.meta.filename ?? fileURLToPath(import.meta.url),
    '--mode',
    'v8-target',
    '--elements',
    String(options.elements),
    '--warmups',
    String(Math.max(options.warmups, 80)),
    '--iterations',
    String(options.iterations),
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      JSC_dumpDisassembly: 'true',
      JSC_dumpDFGDisassembly: 'true',
      JSC_dumpBytecodeAtDFGTime: 'true',
      JSC_dumpGraphAfterParsing: 'true',
      JSC_reportBaselineCompileTimes: 'true',
      JSC_useConcurrentJIT: 'false',
    },
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  writeFileSync(jscPath, `${result.stdout}\n${result.stderr}`, 'utf8');
  if (result.status !== 0) {
    throw new Error(`bun jsc trace failed: ${trimSpawnOutput(result) || result.error?.message}`);
  }
  const text = readFileSync(jscPath, 'utf8');
  return {
    status: 'ok',
    artifacts: [jscPath],
    version: String(version.stdout).trim(),
    jit: {
      patterns: countPatterns(text, patternSpecs.jsc),
      byteLengths: collectJscByteLengths(text),
    },
  };
}

function captureJvm(options) {
  const outputDir = join(options.outputDir, 'jvm');
  mkdirSync(outputDir, { recursive: true });
  if (!options.skipBuild) {
    const build = runCommand('mvn', ['-q', '-DskipTests', 'package'], woodstoxDir);
    if (build.status !== 0 || !existsSync(woodstoxJar)) {
      throw new Error(`woodstox build failed: ${trimSpawnOutput(build) || build.error?.message}`);
    }
  }
  const javapPath = join(outputDir, 'WoodstoxBench.javap.txt');
  const javap = runCommand('javap', [
    '-classpath',
    woodstoxJar,
    '-c',
    '-p',
    'com.staxxml.benchmark.WoodstoxBench',
  ]);
  if (javap.status !== 0) {
    throw new Error(`javap failed: ${trimSpawnOutput(javap) || javap.error?.message}`);
  }
  writeFileSync(javapPath, javap.stdout, 'utf8');
  return {
    status: 'ok',
    artifacts: [javapPath],
    bytecode: {
      patterns: countPatterns(javap.stdout, patternSpecs.jvmBytecode),
      methods: collectMethodNames(javap.stdout),
    },
  };
}

function captureQuickXmlAsm(options) {
  const outputDir = join(options.outputDir, 'quick-xml');
  mkdirSync(outputDir, { recursive: true });
  if (!options.skipBuild) {
    const build = runCommand('cargo', [
      'rustc',
      '--release',
      '--manifest-path',
      quickXmlCargo,
      '--',
      '--emit=asm',
    ]);
    if (build.status !== 0) {
      throw new Error(`quick-xml asm build failed: ${trimSpawnOutput(build) || build.error?.message}`);
    }
  }
  const asmSource = findNewestFile(join(quickXmlDir, 'target', 'release', 'deps'), /\.s$/);
  if (!asmSource) {
    throw new Error('quick-xml asm file was not produced.');
  }
  const asmPath = join(outputDir, 'quick_xml_baseline.s');
  copyFileSync(asmSource, asmPath);
  const asmText = readFileSync(asmPath, 'utf8');
  return {
    status: 'ok',
    artifacts: [asmPath],
    asm: {
      patterns: countPatterns(asmText, patternSpecs.rustAsm),
      byteLength: Buffer.byteLength(asmText),
    },
  };
}

function findNewestFile(directory, pattern) {
  if (!existsSync(directory)) return undefined;
  let newest;
  for (const entry of readdirSync(directory)) {
    if (!pattern.test(entry)) continue;
    const path = join(directory, entry);
    const stat = statSync(path);
    if (!newest || stat.mtimeMs > newest.mtimeMs) {
      newest = { path, mtimeMs: stat.mtimeMs };
    }
  }
  return newest?.path;
}

function countPatterns(text, specs) {
  const result = {};
  for (const [name, pattern] of specs) {
    result[name] = Array.from(text.matchAll(pattern)).length;
  }
  return result;
}

function collectNumbers(text, pattern) {
  return Array.from(text.matchAll(pattern), match => Number(match[1])).filter(Number.isFinite);
}

function collectJscByteLengths(text) {
  return Array.from(text.matchAll(/instructions size = (\d+)|\) (\d+) bytes:/g), match => Number(match[1] ?? match[2]))
    .filter(Number.isFinite);
}

function collectMethodNames(text) {
  return Array.from(text.matchAll(/^\s+(?:private|public|static|final|protected).*? ([A-Za-z0-9_$]+)\(/gm), match => match[1]);
}

function createSelfTestEvidence(outputDir) {
  const v8Bytecode = 'Bytecode length: 42\nRuntime\nCallProperty\nGetNamedProperty\n';
  const v8Opt = 'Instructions (size = 128)\nCEntry\nCallRuntime\nTextDecoder\n';
  const jsc = 'Generated Baseline JIT code for consumeStaxStream#abc\nGenerated Baseline JIT code for foldString#def\nLinking call in consumeStaxStream#abc\nDFG B3 Air Patchpoint SlowPath\ncallq TextDecoder Uint8Array\ninstructions size = 128\n';
  const jvm = '  public static void main(java.lang.String[]);\n   0: invokestatic #1\n   3: invokeinterface #2\n   6: new #3\n';
  const rust = 'callq _memchr\nvpcmpeqb %ymm0, %ymm1, %ymm2\njne label\ncore::str::from_utf8\n';
  const artifactDir = join(outputDir, 'self-test-artifacts');
  mkdirSync(artifactDir, { recursive: true });
  const v8Path = join(artifactDir, 'v8.log');
  const jscPath = join(artifactDir, 'jsc.log');
  const jvmPath = join(artifactDir, 'jvm.txt');
  const rustPath = join(artifactDir, 'quick-xml.s');
  writeFileSync(v8Path, `${v8Bytecode}\n${v8Opt}`, 'utf8');
  writeFileSync(jscPath, jsc, 'utf8');
  writeFileSync(jvmPath, jvm, 'utf8');
  writeFileSync(rustPath, rust, 'utf8');
  return {
    v8: {
      status: 'ok',
      artifacts: [v8Path],
      bytecode: {
        patterns: countPatterns(v8Bytecode, patternSpecs.v8Bytecode),
        bytecodeLengths: collectNumbers(v8Bytecode, /Bytecode length:\s+(\d+)/g),
      },
      optimizedAsm: {
        patterns: countPatterns(v8Opt, patternSpecs.v8Opt),
        instructionSizes: collectNumbers(v8Opt, /Instructions \(size = (\d+)\)/g),
      },
    },
    jsc: {
      status: 'ok',
      artifacts: [jscPath],
      version: 'self-test',
      jit: {
        patterns: countPatterns(jsc, patternSpecs.jsc),
        byteLengths: collectJscByteLengths(jsc),
      },
    },
    jvm: {
      status: 'ok',
      artifacts: [jvmPath],
      bytecode: {
        patterns: countPatterns(jvm, patternSpecs.jvmBytecode),
        methods: collectMethodNames(jvm),
      },
    },
    quickXml: {
      status: 'ok',
      artifacts: [rustPath],
      asm: {
        patterns: countPatterns(rust, patternSpecs.rustAsm),
        byteLength: Buffer.byteLength(rust),
      },
    },
  };
}

function createReport(options, staticEvidence) {
  const benchmark = readExternalBaseline();
  return {
    generatedAt: new Date().toISOString(),
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
      v8: process.versions.v8,
    },
    constraints: {
      staticEvidenceRequired: true,
      nativeAddon: 'excluded-until-stable-js-event-and-string-generation',
      benchmarkContract: 'full-string-checksum',
    },
    benchmark,
    staticEvidence,
    findings: createFindings(staticEvidence, benchmark),
    rejectedHypotheses: rejectedHypotheses(),
    nextStaticChecks: [
      'Compare V8 optimized-code calls against quick-xml asm for delimiter search and UTF-8 boundary handling.',
      'Use Bun/JSC disassembly only for JSC claims; do not infer JSC behavior from V8 optimized-code artifacts.',
      'Use javap output only as JVM bytecode evidence; do not infer HotSpot machine-code wins without PrintAssembly or JITWatch-grade evidence.',
      'Capture the same static artifacts for projection-specific workloads before claiming the projection path closes the gap.',
    ],
  };
}

function readExternalBaseline() {
  const path = join(__dirname, 'results', 'release', 'external-baseline.json');
  if (!existsSync(path)) {
    return { status: 'missing', path };
  }
  const report = JSON.parse(readFileSync(path, 'utf8'));
  return {
    status: 'ok',
    path,
    target: report.target,
    results: report.results.map(entry => ({
      tool: entry.tool,
      mibPerSec: entry.mibPerSec,
      woodstoxRatio: entry.woodstoxRatio,
      eventCount: entry.eventCount,
      checksum: entry.checksum,
      targetStatus: entry.targetStatus,
    })),
  };
}

function createFindings(staticEvidence, benchmark) {
  const findings = [];
  const v8RuntimeSignals = (staticEvidence.v8.optimizedAsm?.patterns?.Runtime ?? 0)
    + (staticEvidence.v8.optimizedAsm?.patterns?.CEntry ?? 0);
  if (staticEvidence.v8.status === 'ok') {
    findings.push({
      id: 'v8-runtime-boundary-visible',
      summary: 'V8 output still needs runtime/CEntry review before any string-materialization hypothesis is accepted.',
      evidence: [
        `V8 optimized asm Runtime=${staticEvidence.v8.optimizedAsm?.patterns?.Runtime ?? 0}`,
        `V8 optimized asm CEntry=${staticEvidence.v8.optimizedAsm?.patterns?.CEntry ?? 0}`,
        `V8 bytecode lengths=${(staticEvidence.v8.bytecode?.bytecodeLengths ?? []).join(',') || 'n/a'}`,
      ],
      status: v8RuntimeSignals > 0 ? 'supported-by-static-patterns' : 'needs-manual-inspection',
    });
  }
  if (staticEvidence.jvm.status === 'ok') {
    findings.push({
      id: 'jvm-bytecode-is-not-hotspot-asm',
      summary: 'JVM evidence currently proves bytecode shape, not final HotSpot machine code.',
      evidence: [
        `javap invoke=${staticEvidence.jvm.bytecode?.patterns?.invoke ?? 0}`,
        `javap invokeinterface=${staticEvidence.jvm.bytecode?.patterns?.invokeinterface ?? 0}`,
      ],
      status: 'bounded-static-evidence',
    });
  }
  if (staticEvidence.jsc.status === 'ok') {
    findings.push({
      id: 'jsc-jit-evidence-is-runtime-specific',
      summary: 'Bun/JSC disassembly is captured separately, so V8 conclusions should not be projected onto JSC without this artifact.',
      evidence: [
        `Bun version=${staticEvidence.jsc.version ?? 'unknown'}`,
        `JSC consume links=${staticEvidence.jsc.jit?.patterns?.ConsumeLinks ?? 0}`,
        `JSC consume baseline=${staticEvidence.jsc.jit?.patterns?.ConsumeBaseline ?? 0}`,
        `JSC Baseline=${staticEvidence.jsc.jit?.patterns?.Baseline ?? 0}`,
        `JSC DFG=${staticEvidence.jsc.jit?.patterns?.DFG ?? 0}`,
        `JSC B3=${staticEvidence.jsc.jit?.patterns?.B3 ?? 0}`,
      ],
      status: 'supported-by-static-patterns',
    });
  }
  if (staticEvidence.quickXml.status === 'ok') {
    findings.push({
      id: 'quick-xml-native-search-symbols-present',
      summary: 'quick-xml asm contains native search/branch evidence that must be compared against V8 generated loops before porting ideas.',
      evidence: [
        `quick-xml asm memchr=${staticEvidence.quickXml.asm?.patterns?.memchr ?? 0}`,
        `quick-xml asm simdCompare=${staticEvidence.quickXml.asm?.patterns?.simdCompare ?? 0}`,
        `quick-xml asm byteLength=${staticEvidence.quickXml.asm?.byteLength ?? 0}`,
      ],
      status: 'supported-by-static-patterns',
    });
  }
  if (benchmark.status === 'ok') {
    const staxStream = benchmark.results.find(entry => entry.tool === 'stax-stream');
    const woodstox = benchmark.results.find(entry => entry.tool === 'woodstox');
    if (staxStream && woodstox) {
      findings.push({
        id: 'woodstox-gap-is-material',
        summary: 'The current StreamReaderSync full-string path remains far below the 0.9x Woodstox target.',
        evidence: [
          `stax-stream=${staxStream.mibPerSec.toFixed(1)} MiB/s`,
          `woodstox=${woodstox.mibPerSec.toFixed(1)} MiB/s`,
          `woodstoxRatio=${staxStream.woodstoxRatio.toFixed(2)}x`,
        ],
        status: 'benchmark-backed',
      });
    }
  }
  return findings;
}

function rejectedHypotheses() {
  return [
    {
      id: 'native-addon-tokenizer-only',
      reason: 'Excluded by user constraint until native code can safely create JS events plus UTF-16 or UTF-8 strings for Node.',
    },
    {
      id: 'node-buffer-primary-fast-lane',
      reason: 'Prior neutral-vs-Node iterable evidence did not justify a browser-compatibility split.',
    },
    {
      id: 'buffer-indexof-as-memchr3-clone',
      reason: 'Repeated JS Buffer.indexOf does not reproduce quick-xml memchr3 machine-code shape and does not solve materialization costs.',
    },
    {
      id: 'lazy-event-getters',
      reason: 'Previously helped count-only paths but did not solve full-string materialization and risks hidden-class instability.',
    },
    {
      id: 'general-localname-map-cache',
      reason: 'String key creation and hashing were already part of the hot cost; use plan-specific byte matching instead.',
    },
  ];
}

function createMarkdown(report) {
  const lines = [
    '# Machine-Code Comparison',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'The native addon is excluded until native code can safely and stably construct JavaScript events plus UTF-16 or UTF-8 string values for Node.',
    'Every hypothesis below is tied to static evidence artifacts or is marked as a rejected prior line.',
    '',
    '## Benchmark Context',
    '',
  ];

  if (report.benchmark.status === 'ok') {
    lines.push('| Tool | Throughput | Woodstox ratio | Events | Checksum |');
    lines.push('| --- | ---: | ---: | ---: | ---: |');
    for (const row of report.benchmark.results) {
      lines.push(`| ${row.tool} | ${formatRate(row.mibPerSec)} | ${formatRatio(row.woodstoxRatio)} | ${row.eventCount} | ${row.checksum} |`);
    }
  } else {
    lines.push(`External baseline missing: ${report.benchmark.path}`);
  }

  lines.push('');
  lines.push('## Static Evidence');
  lines.push('');
  appendEvidence(lines, 'V8', report.staticEvidence.v8);
  appendEvidence(lines, 'JSC / Bun', report.staticEvidence.jsc);
  appendEvidence(lines, 'JVM', report.staticEvidence.jvm);
  appendEvidence(lines, 'quick-xml', report.staticEvidence.quickXml);

  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id}: ${finding.summary} (${finding.status})`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }

  lines.push('');
  lines.push('## Rejected Hypotheses');
  lines.push('');
  for (const entry of report.rejectedHypotheses) {
    lines.push(`- ${entry.id}: ${entry.reason}`);
  }

  lines.push('');
  lines.push('## Next Static Checks');
  lines.push('');
  for (const check of report.nextStaticChecks) {
    lines.push(`- ${check}`);
  }

  return `${lines.join('\n')}\n`;
}

function appendEvidence(lines, label, evidence) {
  lines.push(`### ${label}`);
  lines.push('');
  if (evidence.status !== 'ok') {
    lines.push(`Status: ${evidence.status} ${evidence.reason ?? ''}`.trim());
    lines.push('');
    return;
  }
  lines.push(`Artifacts: ${evidence.artifacts.map(path => relativePath(path)).join(', ')}`);
  if (evidence.bytecode?.patterns) {
    lines.push(`Bytecode patterns: ${formatPatterns(evidence.bytecode.patterns)}`);
  }
  if (evidence.optimizedAsm?.patterns) {
    lines.push(`Optimized asm patterns: ${formatPatterns(evidence.optimizedAsm.patterns)}`);
  }
  if (evidence.jit?.patterns) {
    lines.push(`JIT patterns: ${formatPatterns(evidence.jit.patterns)}`);
  }
  if (evidence.asm?.patterns) {
    lines.push(`Asm patterns: ${formatPatterns(evidence.asm.patterns)}`);
  }
  lines.push('');
}

function formatPatterns(patterns) {
  return Object.entries(patterns).map(([name, value]) => `${name}=${value}`).join(', ');
}

function formatRate(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} MiB/s` : 'n/a';
}

function formatRatio(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}x` : 'n/a';
}

function relativePath(path) {
  return path.startsWith(repoRoot) ? path.slice(repoRoot.length + 1).replace(/\\/g, '/') : path;
}

function runV8Target(options) {
  const bytes = new TextEncoder().encode(makeXml(options.elements));
  const samples = [];
  for (let index = 0; index < options.warmups; index++) {
    samples.push(consumeStaxStream(bytes));
  }
  optimizeFunction(consumeStaxStream, bytes);
  optimizeFunction(foldString, 0, 'Runtime Benchmark 1');
  for (let index = 0; index < options.iterations; index++) {
    samples.push(consumeStaxStream(bytes));
  }
  const checksum = samples.reduce((seed, sample) => seed ^ sample.checksum ^ sample.eventCount, 0);
  console.log(`${marker} checksum=${checksum}`);
}

function optimizeFunction(fn, ...args) {
  try {
    // eslint-disable-next-line no-eval
    eval('%PrepareFunctionForOptimization(fn)');
    fn(...args);
    // eslint-disable-next-line no-eval
    eval('%OptimizeFunctionOnNextCall(fn)');
    fn(...args);
  } catch {
    fn(...args);
  }
}

function makeXml(elements) {
  const parts = ['<?xml version="1.0" encoding="UTF-8"?>\n<root>\n'];
  for (let id = 0; id < elements; id++) {
    parts.push(
      `  <book id="book-${id}" lang="en" code="${id % 97}">` +
      `<title>Runtime Benchmark ${id}</title>` +
      `<author>Author ${id % 4096}</author>` +
      `<description>Full string checksum text payload ${id} with stable words and numbers.</description>` +
      `<chapter number="1">Intro ${id}</chapter>` +
      `<chapter number="2">Body ${id}</chapter>` +
      '</book>\n',
    );
  }
  parts.push('</root>\n');
  return parts.join('');
}

function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function foldString(seed, value) {
  if (!value) return seed;
  let next = seed;
  for (let index = 0; index < value.length; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}

function consumeStaxStream(bytes) {
  let eventCount = 0;
  let checksum = 0;

  for (const batch of new StreamReaderSync(bytes)) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const type = batch.typeAt(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        checksum = foldString(checksum, batch.nameAt(index));
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        checksum = foldString(checksum, batch.textAt(index)?.trim());
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrCount = batch.attributeCountAt(index);
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          checksum = foldString(checksum, batch.attributeNameAt(index, attrIndex));
          checksum = foldString(checksum, batch.attributeValueAt(index, attrIndex));
        }
      }
    }
  }

  return { eventCount, checksum };
}

main();
