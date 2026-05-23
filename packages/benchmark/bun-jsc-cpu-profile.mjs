import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const candidateScript = join(__dirname, 'candidate-headroom-large.mjs');
const defaultOutputDir = join(__dirname, 'results', 'bun-jsc-cpu-profile', `profile-${Date.now()}`);
const defaultJsonOut = join(__dirname, 'results', 'release', 'bun-jsc-cpu-profile.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'bun-jsc-cpu-profile.md');
const defaultCases = ['scanAllNoDecode', 'stringFull', 'eventObjectFull', 'rawFrameNameId'];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizeGiB: 0.015625,
    fixtureShape: 'diverse-cycle',
    diverseCycleSize: 4096,
    cases: [...defaultCases],
    outputDir: defaultOutputDir,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    cpuProfInterval: 1000,
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
      case '--size-gib':
        options.sizeGiB = parsePositiveNumber(readValue(), name);
        break;
      case '--fixture-shape':
        options.fixtureShape = readValue();
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), name);
        break;
      case '--cases':
        options.cases = parseCaseList(readValue());
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
      case '--cpu-prof-interval':
        options.cpuProfInterval = parsePositiveInteger(readValue(), name);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['repeated-person', 'diverse-cycle', 'projection-cycle'].includes(options.fixtureShape)) {
    throw new Error('--fixture-shape must be one of repeated-person, diverse-cycle, projection-cycle.');
  }
  return options;
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

function parseCaseList(value) {
  const parsed = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (parsed.length === 0) throw new Error('--cases must contain at least one case id.');
  return parsed;
}

function main() {
  const options = parseArgs();
  const runtimeProbe = readBunRuntime();
  if (existsSync(options.outputDir)) {
    rmSync(options.outputDir, { recursive: true, force: true });
  }
  mkdirSync(options.outputDir, { recursive: true });

  const cases = options.cases.map((caseId) => runProfileCase(options, caseId));
  const runtime = cases[0]?.benchmark.environment ?? runtimeProbe;
  const report = createReport({ options, runtime, runtimeProbe, cases });
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function readBunRuntime() {
  const revisionResult = spawnSync('bun', ['--revision'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (revisionResult.status !== 0) {
    throw new Error(`bun revision probe failed: ${revisionResult.stderr || revisionResult.stdout}`);
  }
  const result = spawnSync('bun', ['--no-install', '-e', "console.log(JSON.stringify({runtimeName:'bun', javascriptEngine:'JavaScriptCore', bunVersion:process.versions.bun, webkitCommit:process.versions.webkit, userAgent:typeof navigator !== 'undefined' ? navigator.userAgent : null, processVersions:process.versions}))"], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`bun runtime probe failed: ${result.stderr || result.stdout}`);
  }
  const parsed = JSON.parse(result.stdout);
  return {
    ...parsed,
    bunRevision: revisionResult.stdout.trim(),
  };
}

function runProfileCase(options, caseId) {
  const benchmarkJson = join(options.outputDir, `${caseId}-benchmark.json`);
  const benchmarkMd = join(options.outputDir, `${caseId}-benchmark.md`);
  const args = [
    '--no-install',
    '--cpu-prof',
    '--cpu-prof-md',
    `--cpu-prof-dir=${options.outputDir}`,
    `--cpu-prof-name=${caseId}`,
    `--cpu-prof-interval=${options.cpuProfInterval}`,
    candidateScript,
    `--size-gib=${options.sizeGiB}`,
    `--fixture-shape=${options.fixtureShape}`,
    `--diverse-cycle-size=${options.diverseCycleSize}`,
    `--cases=${caseId}`,
    '--runs=1',
    '--warmups=0',
    `--json-out=${benchmarkJson}`,
    `--md-out=${benchmarkMd}`,
  ];

  const startedAt = Date.now();
  const result = spawnSync('bun', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const elapsedMs = Date.now() - startedAt;
  const runLog = join(options.outputDir, `${caseId}-run.log`);
  writeFileSync(runLog, [
    `$ ${['bun', ...args].join(' ')}`,
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
    throw new Error(`Bun CPU profile case failed for ${caseId}. See ${runLog}`);
  }

  const benchmark = JSON.parse(readFileSync(benchmarkJson, 'utf8'));
  const variant = benchmark.variants.find((entry) => entry.id === caseId);
  if (!variant) {
    throw new Error(`Bun benchmark output for ${caseId} did not contain the requested variant.`);
  }

  const profileJson = findProfileFile(options.outputDir, caseId, '.cpuprofile');
  const profileMd = findProfileFile(options.outputDir, caseId, '.md');
  const profile = summarizeProfile(JSON.parse(readFileSync(profileJson, 'utf8')));
  return {
    caseId,
    command: ['bun', ...args],
    elapsedMs,
    rawFiles: {
      benchmarkJson,
      benchmarkMd,
      profileJson,
      profileMd,
      runLog,
    },
    benchmark,
    result: summarizeVariant(variant),
    profile,
  };
}

function findProfileFile(outputDir, caseId, extension) {
  const files = readdirSync(outputDir)
    .filter((fileName) => fileName.startsWith(caseId) && fileName.endsWith(extension))
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
  const match = files.find((fileName) => !fileName.endsWith('-benchmark.md')) ?? files[0];
  if (!match) {
    throw new Error(`Could not find Bun CPU profile ${extension} for ${caseId} in ${outputDir}`);
  }
  return join(outputDir, match);
}

function summarizeVariant(variant) {
  return {
    id: variant.id,
    family: variant.family,
    implementation: variant.implementation,
    contractScope: variant.contractScope,
    fullStringParity: variant.fullStringParity,
    mibPerSec: variant.mibPerSec,
    eventCount: variant.eventCount,
    checksum: variant.checksum,
    maxRssMiB: variant.memory?.maxRssBytes / (1024 * 1024),
    stringFieldReads: variant.materializationCounters?.stringFieldReads ?? 0,
    publicEventObjects: variant.materializationCounters?.publicEventObjects ?? 0,
    rawSpanMaterializations: variant.materializationCounters?.rawSpanMaterializations ?? 0,
    nameCacheHits: variant.materializationCounters?.nameCacheHits ?? 0,
    nameCacheMisses: variant.materializationCounters?.nameCacheMisses ?? 0,
  };
}

function summarizeProfile(profile) {
  const nodesById = new Map(profile.nodes.map((node) => [node.id, node]));
  const selfMicrosByKey = new Map();
  const sampleCountByKey = new Map();
  const samples = profile.samples ?? [];
  const timeDeltas = profile.timeDeltas ?? [];
  const fallbackDelta = estimateFallbackDelta(profile, samples.length);

  for (let index = 0; index < samples.length; index++) {
    const node = nodesById.get(samples[index]);
    if (!node) continue;
    const deltaMicros = Number(timeDeltas[index] ?? fallbackDelta);
    const key = functionKey(node.callFrame);
    selfMicrosByKey.set(key, (selfMicrosByKey.get(key) ?? 0) + deltaMicros);
    sampleCountByKey.set(key, (sampleCountByKey.get(key) ?? 0) + 1);
  }

  const durationMicros = [...selfMicrosByKey.values()].reduce((sum, value) => sum + value, 0);
  const functions = [...selfMicrosByKey.entries()]
    .map(([key, selfMicros]) => {
      const frame = parseFunctionKey(key);
      return {
        ...frame,
        selfMicros,
        selfMs: selfMicros / 1000,
        selfPercent: percent(selfMicros, durationMicros),
        samples: sampleCountByKey.get(key) ?? 0,
      };
    })
    .sort((a, b) => b.selfMicros - a.selfMicros);

  const categoryMicros = {
    staxXml: 0,
    benchmark: 0,
    native: 0,
    other: 0,
  };
  for (const entry of functions) {
    if (isStaxXmlFrame(entry.url)) categoryMicros.staxXml += entry.selfMicros;
    else if (isBenchmarkFrame(entry.url)) categoryMicros.benchmark += entry.selfMicros;
    else if (isNativeFrame(entry)) categoryMicros.native += entry.selfMicros;
    else categoryMicros.other += entry.selfMicros;
  }

  const presentFunctions = summarizePresentFunctions(profile.nodes);
  return {
    sampleCount: samples.length,
    profiledDurationMs: durationMicros / 1000,
    topSelfFunctions: functions.slice(0, 12),
    staxXmlSelfPercent: percent(categoryMicros.staxXml, durationMicros),
    benchmarkSelfPercent: percent(categoryMicros.benchmark, durationMicros),
    nativeSelfPercent: percent(categoryMicros.native, durationMicros),
    otherSelfPercent: percent(categoryMicros.other, durationMicros),
    categoryMicros,
    presentFunctions,
  };
}

function estimateFallbackDelta(profile, sampleCount) {
  if (sampleCount <= 0) return 0;
  if (Number.isFinite(profile.startTime) && Number.isFinite(profile.endTime) && profile.endTime > profile.startTime) {
    return (profile.endTime - profile.startTime) / sampleCount;
  }
  return 1000;
}

function functionKey(callFrame) {
  const functionName = callFrame.functionName || '(anonymous)';
  const url = normalizeUrl(callFrame.url);
  const lineNumber = Number.isInteger(callFrame.lineNumber) ? callFrame.lineNumber + 1 : null;
  return JSON.stringify({ functionName, url, lineNumber });
}

function parseFunctionKey(key) {
  return JSON.parse(key);
}

function normalizeUrl(url) {
  if (!url) return '[native code]';
  return url.replace(/^file:\/\/\//, '').replaceAll('/', '\\');
}

function isStaxXmlFrame(url) {
  return url.includes('packages\\stax-xml\\dist\\index.js');
}

function isBenchmarkFrame(url) {
  return url.includes('packages\\benchmark\\candidate-headroom-large.mjs');
}

function isNativeFrame(entry) {
  return entry.url === '[native code]' || entry.url.startsWith('node:') || entry.url.startsWith('internal:');
}

function summarizePresentFunctions(nodes) {
  const targets = [
    'nextBatch',
    'parseBuffer',
    'parseStartTag',
    'parseAttributes',
    'parseEndTag',
    'addEvent',
    'consumeStreamSelective',
    'consumeEventObjectFull',
    'consumeRawFrame',
    'consumeRawFrameStyle',
    'materializeName',
    'decodeSpan',
    'foldString',
  ];
  const names = new Map();
  for (const node of nodes) {
    const name = node.callFrame.functionName || '(anonymous)';
    names.set(name, (names.get(name) ?? 0) + 1);
  }
  return Object.fromEntries(targets.map((target) => [target, names.get(target) ?? 0]));
}

function createReport({ options, runtime, runtimeProbe, cases }) {
  const fullRows = cases.filter((entry) => entry.result.fullStringParity);
  const firstFull = fullRows[0]?.result;
  const fullStringParity = fullRows.length === 0
    ? { status: 'not-applicable', rowIds: [] }
    : {
        status: fullRows.every((entry) => entry.result.eventCount === firstFull.eventCount && entry.result.checksum === firstFull.checksum) ? 'ok' : 'mismatch',
        rowIds: fullRows.map((entry) => entry.caseId),
        eventCount: firstFull.eventCount,
        checksum: firstFull.checksum,
      };

  const profileTotals = summarizeProfileTotals(cases);
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'bun-jsc-cpu-profile',
    contract: 'profiler-trace-fact-only',
    note: 'Bun/JSC CPU profiler sampling for selected same-contract candidate rows. This is profiler evidence, not a JavaScriptCore codegen/assembly dump and not a 200 MiB/s ceiling proof.',
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
    },
    runtime,
    runtimeProbe,
    options: {
      sizeGiB: options.sizeGiB,
      fixtureShape: options.fixtureShape,
      diverseCycleSize: options.diverseCycleSize,
      cases: options.cases,
      cpuProfInterval: options.cpuProfInterval,
    },
    rawArtifacts: {
      outputDir: options.outputDir,
      committed: false,
      reason: 'Raw .cpuprofile, markdown profile, per-case benchmark JSON/MD, and run logs are generated evidence files; the release artifact keeps only the curated summary.',
    },
    fullStringParity,
    profileTotals,
    cases: cases.map((entry) => ({
      caseId: entry.caseId,
      elapsedMs: entry.elapsedMs,
      rawFiles: entry.rawFiles,
      result: entry.result,
      profile: entry.profile,
    })),
  };
  report.findings = createFindings(report);
  return report;
}

function summarizeProfileTotals(cases) {
  const sampleCount = sum(cases, (entry) => entry.profile.sampleCount);
  const profiledDurationMs = sum(cases, (entry) => entry.profile.profiledDurationMs);
  const categoryMicros = {
    staxXml: sum(cases, (entry) => entry.profile.categoryMicros.staxXml),
    benchmark: sum(cases, (entry) => entry.profile.categoryMicros.benchmark),
    native: sum(cases, (entry) => entry.profile.categoryMicros.native),
    other: sum(cases, (entry) => entry.profile.categoryMicros.other),
  };
  const durationMicros = Object.values(categoryMicros).reduce((total, value) => total + value, 0);
  return {
    sampleCount,
    profiledDurationMs,
    staxXmlSelfPercent: percent(categoryMicros.staxXml, durationMicros),
    benchmarkSelfPercent: percent(categoryMicros.benchmark, durationMicros),
    nativeSelfPercent: percent(categoryMicros.native, durationMicros),
    otherSelfPercent: percent(categoryMicros.other, durationMicros),
    categoryMicros,
  };
}

function createFindings(report) {
  const fastestFull = report.cases
    .filter((entry) => entry.result.fullStringParity)
    .toSorted((a, b) => b.result.mibPerSec - a.result.mibPerSec)[0];
  return [
    {
      id: 'bun-cpu-profiler-trace-visible',
      classification: 'TRACE_FACT',
      summary: 'Bun/JSC emitted CPU profiler samples for the selected candidate rows.',
      evidence: [
        `cases=${report.cases.map((entry) => entry.caseId).join(',')}`,
        `samples=${report.profileTotals.sampleCount}`,
        `profiledDurationMs=${formatNumber(report.profileTotals.profiledDurationMs)}`,
        `staxXmlSelf=${formatNumber(report.profileTotals.staxXmlSelfPercent)}%`,
      ],
    },
    {
      id: 'full-string-parity-preserved',
      classification: 'BENCH_FACT',
      summary: 'The selected full-string rows preserved the same event count and checksum while profiling was enabled.',
      evidence: [
        `status=${report.fullStringParity.status}`,
        `rows=${report.fullStringParity.rowIds.join(',')}`,
        `eventCount=${formatInteger(report.fullStringParity.eventCount)}`,
        `checksum=${report.fullStringParity.checksum}`,
        fastestFull ? `fastestFull=${fastestFull.caseId} ${formatNumber(fastestFull.result.mibPerSec)} MiB/s` : 'fastestFull=n/a',
      ],
    },
    {
      id: 'not-codegen-or-ceiling-proof',
      classification: 'SCOPE_GUARD',
      summary: 'Bun CPU profiler output is sampled stack evidence, not a codegen trace, not an allocation census, and not a 200 MiB/s ceiling proof.',
      evidence: [
        'No JavaScriptCore optimized IR or assembly is captured.',
        'The profiled fixture is intentionally smaller than 1 GiB to keep profiler overhead manageable.',
        'A future 200 MiB/s bounded-memory full-string row would still be a counterexample.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Bun/JSC CPU Profile',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Scope',
    '',
    'This is a `TRACE_FACT` for selected Bun/JSC candidate rows using Bun CPU profiler sampling. It is not a codegen trace, not an allocation census, and not a 200 MiB/s ceiling proof.',
    '',
    '## Runtime',
    '',
    `- Runtime: ${report.runtime.runtimeName ?? 'bun'} / ${report.runtime.javascriptEngine ?? 'JavaScriptCore'}`,
    `- Bun: ${report.runtime.bunVersion ?? report.runtimeProbe.bunVersion}`,
    `- Bun revision: ${report.runtime.bunRevision ?? report.runtimeProbe.bunRevision}`,
    `- WebKit commit: ${report.runtime.webkitCommit ?? report.runtimeProbe.webkitCommit}`,
    `- Fixture: ${report.options.fixtureShape}, ${formatNumber(report.options.sizeGiB * 1024, 1)} MiB target`,
    `- Cases: ${report.options.cases.join(', ')}`,
    '',
    '## Raw Artifacts',
    '',
    `- Output dir: ${report.rawArtifacts.outputDir}`,
    `- Committed: ${report.rawArtifacts.committed ? 'yes' : 'no'}`,
    `- Reason: ${report.rawArtifacts.reason}`,
    '',
    '## Profile Totals',
    '',
    `- Samples: ${formatInteger(report.profileTotals.sampleCount)}`,
    `- Profiled duration: ${formatNumber(report.profileTotals.profiledDurationMs)} ms`,
    `- stax-xml self time: ${formatNumber(report.profileTotals.staxXmlSelfPercent)}%`,
    `- benchmark harness self time: ${formatNumber(report.profileTotals.benchmarkSelfPercent)}%`,
    `- native/internal self time: ${formatNumber(report.profileTotals.nativeSelfPercent)}%`,
    '',
    '## Cases',
    '',
    '| Case | MiB/s | Events | Checksum | Strings | Max RSS | Samples | stax-xml self | Top self functions |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ];

  for (const entry of report.cases) {
    lines.push(`| \`${entry.caseId}\` | ${formatNumber(entry.result.mibPerSec)} | ${formatInteger(entry.result.eventCount)} | ${entry.result.checksum} | ${formatInteger(entry.result.stringFieldReads)} | ${formatNumber(entry.result.maxRssMiB)} MiB | ${formatInteger(entry.profile.sampleCount)} | ${formatNumber(entry.profile.staxXmlSelfPercent)}% | ${formatTopFunctions(entry.profile.topSelfFunctions)} |`);
  }

  lines.push('', '## Full String Parity', '');
  lines.push(`- Status: ${report.fullStringParity.status}`);
  lines.push(`- Rows: ${report.fullStringParity.rowIds.join(', ') || 'n/a'}`);
  if (report.fullStringParity.status === 'ok') {
    lines.push(`- Event count: ${formatInteger(report.fullStringParity.eventCount)}`);
    lines.push(`- Checksum: ${report.fullStringParity.checksum}`);
  }

  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`### ${finding.id}`, '', `Classification: ${finding.classification}`, '', finding.summary, '');
    for (const evidence of finding.evidence) {
      lines.push(`- ${evidence}`);
    }
    lines.push('');
  }

  lines.push(
    '## Interpretation',
    '',
    'This profile adds Bun/JSC sampled stack evidence for the same partial/full candidate row vocabulary used by the 1 GiB headroom matrix. It can support hotpath triage, but it does not replace JavaScriptCore codegen evidence and does not justify concluding that JavaScript runtimes cannot reach the target.',
  );

  return `${lines.join('\n')}\n`;
}

function formatTopFunctions(entries) {
  return entries.slice(0, 4).map((entry) => `${entry.functionName} ${formatNumber(entry.selfPercent)}%`).join('; ');
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log('Bun/JSC CPU profile');
  console.log(`cases=${report.cases.map((entry) => entry.caseId).join(',')}`);
  console.log(`samples=${report.profileTotals.sampleCount} profiledMs=${formatNumber(report.profileTotals.profiledDurationMs)}`);
  for (const entry of report.cases) {
    console.log(`${entry.caseId.padEnd(20)} ${formatNumber(entry.result.mibPerSec).padStart(8)} MiB/s samples=${entry.profile.sampleCount}`);
  }
}

function sum(entries, getter) {
  return entries.reduce((total, entry) => total + (getter(entry) || 0), 0);
}

function percent(value, total) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return (value / total) * 100;
}

function formatInteger(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return 'n/a';
  return Math.round(value).toLocaleString('en-US');
}

function formatNumber(value, digits = 2) {
  if (value === undefined || value === null || Number.isNaN(value)) return 'n/a';
  return value.toFixed(digits);
}

main();
