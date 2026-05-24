import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const workloadScript = join(__dirname, 'v8-monomorphic-shape-trace.mjs');
const defaultOutputDir = join(__dirname, 'results', 'deno-v8-codegen', `trace-${Date.now()}`);
const defaultJsonOut = join(__dirname, 'results', 'release', 'deno-v8-codegen-trace.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'deno-v8-codegen-trace.md');
const warmupMarker = '[stax-v8-monomorphic-shape] warmup-complete';
const textEncoder = new TextEncoder();

const caseIds = [
  'public-accessor',
  'raw-frame-direct-decode',
  'raw-frame-name-id-cache',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    denoBin: process.env.DENO_BIN || 'deno',
    outputDir: defaultOutputDir,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    cases: [...caseIds],
    warmups: 24,
    iterations: 6,
    elements: 128,
    quick: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg === '--quick') {
      options.quick = true;
      options.warmups = 12;
      options.iterations = 3;
      options.elements = 64;
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
      case '--deno-bin':
        options.denoBin = readValue();
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
      case '--cases':
        options.cases = parseCaseList(readValue(), name);
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--iterations':
        options.iterations = parsePositiveInteger(readValue(), name);
        break;
      case '--elements':
        options.elements = parsePositiveInteger(readValue(), name);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function parseCaseList(value, flag) {
  if (value === 'all') return [...caseIds];
  const entries = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (entries.length === 0) throw new Error(`${flag} must not be empty.`);
  for (const entry of entries) {
    if (!caseIds.includes(entry)) {
      throw new Error(`${flag} contains unknown case ${entry}. Expected: ${caseIds.join(', ')}`);
    }
  }
  return entries;
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
  mkdirSync(options.outputDir, { recursive: true });
  const version = readDenoVersion(options);
  const manifest = {
    generatedAt: new Date().toISOString(),
    denoBin: options.denoBin,
    denoVersion: version.deno,
    v8Version: version.v8,
    typescriptVersion: version.typescript,
    cpuName: cpus()[0]?.model ?? 'unknown',
    platform: `${process.platform}-${process.arch}`,
    outputDir: options.outputDir,
    cases: options.cases,
    warmups: options.warmups,
    iterations: options.iterations,
    elements: options.elements,
    quick: options.quick,
    artifacts: options.cases.map(caseId => runTraceProcess(options, caseId)),
  };
  const manifestPath = join(options.outputDir, 'manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const summary = buildSummary(manifest, manifestPath);
  writeOutput(options.jsonOut, `${JSON.stringify(summary, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(summary));
  console.log(`Deno V8 codegen trace summary: ${options.jsonOut}`);
}

function readDenoVersion(options) {
  const result = spawnSync(options.denoBin, ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'deno --version failed');
  const lines = result.stdout.split(/\r?\n/);
  return {
    deno: lines.find(line => line.startsWith('deno '))?.replace(/^deno\s+/, '') ?? null,
    v8: lines.find(line => line.startsWith('v8 '))?.replace(/^v8\s+/, '') ?? null,
    typescript: lines.find(line => line.startsWith('typescript '))?.replace(/^typescript\s+/, '') ?? null,
  };
}

function runTraceProcess(options, caseId) {
  const logPath = join(options.outputDir, `${caseId}-trace.log`);
  const args = [
    'run',
    '--allow-read',
    '--allow-env',
    '--allow-sys',
    '--v8-flags=--trace-opt,--trace-deopt,--trace-file-names',
    workloadScript,
    '--mode=run',
    `--case=${caseId}`,
    `--warmups=${options.warmups}`,
    `--iterations=${options.iterations}`,
    `--elements=${options.elements}`,
  ];
  const startedAt = Date.now();
  const result = spawnSync(options.denoBin, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  const elapsedMs = Date.now() - startedAt;
  writeFileSync(logPath, [
    `$ ${[options.denoBin, ...args].join(' ')}`,
    `cwd=${repoRoot}`,
    `exit=${result.status} elapsedMs=${elapsedMs}`,
    '',
    '--- stdout ---',
    result.stdout ?? '',
    '',
    '--- stderr ---',
    result.stderr ?? '',
  ].join('\n'));

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Deno V8 trace failed for ${caseId}. See ${logPath}`);
  }
  return {
    kind: 'trace',
    caseId,
    logPath,
    elapsedMs,
    exit: result.status,
    bytes: existsSync(logPath) ? readFileSync(logPath, 'utf8').length : 0,
  };
}

function buildSummary(manifest, manifestPath) {
  const cases = manifest.cases.map(caseId => analyzeCase(manifest, caseId));
  return {
    generatedAt: new Date().toISOString(),
    objective: 'deno-v8-codegen-trace',
    contract: 'trace-fact-only',
    note: 'Deno/V8 trace-opt and trace-deopt signals for selected stax-xml reader rows. This is runtime-specific TRACE_FACT evidence, not a throughput benchmark, allocation profile, or runtime ceiling proof.',
    environment: {
      denoVersion: manifest.denoVersion,
      v8Version: manifest.v8Version,
      typescriptVersion: manifest.typescriptVersion,
      cpuName: manifest.cpuName,
      platform: manifest.platform,
    },
    fixture: {
      source: 'self-generated',
      elements: manifest.elements,
      byteLength: textEncoder.encode(makeXml(manifest.elements)).byteLength,
    },
    options: {
      warmups: manifest.warmups,
      iterations: manifest.iterations,
      quick: manifest.quick,
      cases: manifest.cases,
    },
    rawArtifacts: {
      manifestPath,
      outputDir: manifest.outputDir,
      committed: false,
    },
    cases,
    findings: createFindings(cases),
  };
}

function analyzeCase(manifest, caseId) {
  const artifact = manifest.artifacts.find(entry => entry.caseId === caseId);
  const optimizedFunctions = new Set();
  const compilationTargets = new Set();
  const deoptLines = [];
  const warmupDeoptLines = [];
  const postWarmupDeoptLines = [];
  let result;
  let phase = 'warmup';

  if (artifact && existsSync(artifact.logPath)) {
    for (const line of readFileSync(artifact.logPath, 'utf8').split('\n')) {
      if (line.includes(warmupMarker)) {
        phase = 'post-warmup';
        continue;
      }
      const completed = line.match(/completed (?:compiling|optimizing).+<JSFunction ([^ ]+).+\(target ([^)]+)\)/);
      if (completed) {
        optimizedFunctions.add(completed[1]);
        compilationTargets.add(completed[2]);
      }
      if (/bailout|deopt/i.test(line)) {
        deoptLines.push(line);
        if (phase === 'post-warmup') {
          postWarmupDeoptLines.push(line);
        } else {
          warmupDeoptLines.push(line);
        }
      }
      const jsonMatch = line.match(/\{"caseId":.+\}$/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    }
  }

  const targetFunctionNames = [
    'consumePublicAccessor',
    'consumeRawFrame',
    'materializeName',
    'decodeSpan',
    'foldString',
    'parseBuffer',
    'parseTag',
    'parseStartTag',
  ];
  const targetHits = targetFunctionNames.filter(name => optimizedFunctions.has(name));
  const status = postWarmupDeoptLines.length > 0
    ? 'deopt-after-warmup'
    : targetHits.length > 0 ? 'target-optimized-no-post-warmup-deopt' : 'trace-without-target-optimization';

  return {
    caseId,
    status,
    result,
    optimizedFunctions: [...optimizedFunctions].sort(),
    targetOptimizedFunctions: targetHits,
    compilationTargets: [...compilationTargets].sort(),
    deoptCount: deoptLines.length,
    warmupDeoptCount: warmupDeoptLines.length,
    postWarmupDeoptCount: postWarmupDeoptLines.length,
    postWarmupDeoptSamples: postWarmupDeoptLines.slice(0, 8).map(line => line.slice(0, 260)),
    logBytes: artifact?.bytes ?? 0,
    elapsedMs: artifact?.elapsedMs ?? 0,
  };
}

function createFindings(cases) {
  return [
    {
      id: 'deno-v8-optimization-seen',
      classification: 'TRACE_FACT',
      summary: 'Deno/V8 emitted trace-opt signals for selected stax-xml parser and reader functions in this small generated workload.',
      evidence: cases.map(entry =>
        `${entry.caseId}: targets=${entry.compilationTargets.join('/') || 'none'}, optimizedTargets=${entry.targetOptimizedFunctions.join(',') || 'none'}`,
      ),
    },
    {
      id: 'post-warmup-deopt-observed',
      classification: 'TRACE_FACT',
      summary: 'Records whether each case deoptimized after the warmup marker; this is a trace observation, not a ceiling proof.',
      evidence: cases.map(entry =>
        `${entry.caseId}: warmupDeopts=${entry.warmupDeoptCount}, postWarmupDeopts=${entry.postWarmupDeoptCount}`,
      ),
    },
    {
      id: 'scope-guard',
      classification: 'SCOPE_GUARD',
      summary: 'This trace is a small selected-function Deno/V8 run, not a 1 GiB benchmark, allocation profile, browser trace, or impossibility proof.',
      evidence: ['Deno trace flags used: --trace-opt,--trace-deopt,--trace-file-names'],
    },
  ];
}

function renderMarkdown(summary) {
  const lines = [
    '# Deno V8 Codegen Trace',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    summary.note,
    '',
    '## Environment',
    '',
    `- Deno: ${summary.environment.denoVersion}`,
    `- V8: ${summary.environment.v8Version}`,
    `- TypeScript: ${summary.environment.typescriptVersion}`,
    `- Platform: ${summary.environment.platform}`,
    `- CPU: ${summary.environment.cpuName}`,
    `- Fixture: ${summary.fixture.elements} generated elements, ${summary.fixture.byteLength} bytes`,
    `- Runs: warmups=${summary.options.warmups}, iterations=${summary.options.iterations}`,
    '',
    '## Raw Artifacts',
    '',
    `- Output dir: ${summary.rawArtifacts.outputDir}`,
    `- Manifest: ${summary.rawArtifacts.manifestPath}`,
    `- Committed: ${summary.rawArtifacts.committed ? 'yes' : 'no'}`,
    '',
    '## Trace Gate',
    '',
    '| Case | Status | Events | Checksum | Target optimized functions | Compilation targets | Deopts warmup/post-warmup |',
    '| --- | --- | ---: | ---: | --- | --- | ---: |',
  ];
  for (const entry of summary.cases) {
    lines.push(
      `| ${entry.caseId} | ${entry.status} | ${entry.result?.eventCount ?? 'n/a'} | `
      + `${entry.result?.checksum ?? 'n/a'} | ${entry.targetOptimizedFunctions.join(', ') || 'none'} | `
      + `${entry.compilationTargets.join(', ') || 'none'} | ${entry.warmupDeoptCount}/${entry.postWarmupDeoptCount} |`,
    );
  }
  lines.push('', '## Findings', '');
  for (const finding of summary.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function makeXml(elements) {
  let xml = '<root>';
  for (let index = 0; index < elements; index++) {
    xml += `<item id="${index}" code="c${index % 17}"><name>Name ${index}</name><value>${index * 3}</value></item>`;
  }
  return `${xml}</root>`;
}

main();
