import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const harnessPath = join(__dirname, 'firefox-bidi-candidate-headroom.mjs');
const defaultJsonOut = join(__dirname, 'results', 'release', 'firefox-spidermonkey-profiler-trace.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'firefox-spidermonkey-profiler-trace.md');
const defaultOutputDir = join(__dirname, 'results', 'firefox-spidermonkey-profiler-trace');
const defaultCorpusFile = join(__dirname, 'assets', 'books.xml');
const targetTerms = [
  'consumeRawFrame',
  'consumePublicAccessor',
  'consumeEventObject',
  'materialize',
  'decode',
  'TextDecoder',
  'foldString',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizeGiB: 0.01,
    fixtureShape: 'diverse-cycle',
    diverseCycleSize: 512,
    corpusFile: defaultCorpusFile,
    batchSize: 16,
    cases: ['stringFull', 'eventObjectFull', 'rawFrameNameId'],
    browserTimeoutMs: 180_000,
    profilerFeatures: 'js,stackwalk,cpu',
    outputDir: defaultOutputDir,
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
      case '--size-gib':
        options.sizeGiB = parsePositiveNumber(readValue(), name);
        break;
      case '--fixture-shape':
        options.fixtureShape = parseFixtureShape(readValue(), name);
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), name);
        break;
      case '--corpus-file':
        options.corpusFile = resolve(process.cwd(), readValue());
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), name);
        break;
      case '--cases':
        options.cases = parseList(readValue(), name);
        break;
      case '--browser-timeout-ms':
        options.browserTimeoutMs = parsePositiveInteger(readValue(), name);
        break;
      case '--profiler-features':
        options.profilerFeatures = readValue();
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
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.fixtureShape === 'corpus-cycle' && !existsSync(options.corpusFile)) {
    throw new Error(`--corpus-file does not exist: ${options.corpusFile}`);
  }
  return options;
}

function parseList(value, flag) {
  const parsed = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (parsed.length === 0) throw new Error(`${flag} must contain at least one value.`);
  return parsed;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive number.`);
  return parsed;
}

function parseFixtureShape(value, flag) {
  if (value === 'diverse-cycle' || value === 'corpus-cycle' || value === 'projection-cycle') return value;
  throw new Error(`${flag} must be diverse-cycle, corpus-cycle, or projection-cycle.`);
}

function main() {
  const options = parseArgs();
  mkdirSync(options.outputDir, { recursive: true });
  const rawProfilePath = join(options.outputDir, 'firefox-spidermonkey-profile.json');
  const childJsonOut = join(options.outputDir, 'firefox-spidermonkey-profile-benchmark.json');
  const childMdOut = join(options.outputDir, 'firefox-spidermonkey-profile-benchmark.md');

  const child = runProfiledBenchmark(options, rawProfilePath, childJsonOut, childMdOut);
  const benchmark = JSON.parse(readFileSync(childJsonOut, 'utf8'));
  const profile = JSON.parse(readFileSync(rawProfilePath, 'utf8'));
  const report = createReport(options, child, benchmark, profile, rawProfilePath, childJsonOut, childMdOut);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function runProfiledBenchmark(options, rawProfilePath, childJsonOut, childMdOut) {
  const args = [
    harnessPath,
    '--size-gib',
    String(options.sizeGiB),
    '--fixture-shape',
    options.fixtureShape,
    '--diverse-cycle-size',
    String(options.diverseCycleSize),
    '--corpus-file',
    options.corpusFile,
    '--batch-size',
    String(options.batchSize),
    '--runs',
    '1',
    '--warmups',
    '0',
    '--cases',
    options.cases.join(','),
    '--no-host-process-memory',
    '--graceful-browser-close',
    '--browser-timeout-ms',
    String(options.browserTimeoutMs),
    '--json-out',
    childJsonOut,
    '--md-out',
    childMdOut,
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      MOZ_PROFILER_STARTUP: '1',
      MOZ_PROFILER_SHUTDOWN: rawProfilePath,
      MOZ_PROFILER_STARTUP_FEATURES: options.profilerFeatures,
    },
  });
  if (result.error) throw new Error(`Firefox profiled benchmark failed to spawn: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`Firefox profiled benchmark failed with exit ${result.status}:\n${result.stderr || result.stdout}`);
  }
  if (!existsSync(rawProfilePath)) {
    throw new Error(`Firefox profiler did not write profile: ${rawProfilePath}`);
  }
  return {
    command: process.execPath,
    args,
    status: result.status,
    stdout: String(result.stdout ?? '').trim(),
    stderr: String(result.stderr ?? '').trim(),
  };
}

function createReport(options, child, benchmark, profile, rawProfilePath, childJsonOut, childMdOut) {
  const profileSummary = summarizeProfile(profile);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'firefox-spidermonkey-profiler-trace',
    contract: 'gecko-profiler-same-contract-browser-reader-shapes',
    note: 'Firefox/SpiderMonkey Gecko Profiler startup/shutdown profile around the Firefox BiDi same-contract browser reader harness. This is sampled profiler evidence, not JIT IR, not a deterministic codegen dump, and not a runtime ceiling proof.',
    environment: {
      ...benchmark.environment,
      hostPlatform: `${process.platform}-${process.arch}`,
      cpuName: cpus()[0]?.model ?? 'unknown',
    },
    options: {
      sizeGiB: options.sizeGiB,
      fixtureShape: options.fixtureShape,
      diverseCycleSize: options.diverseCycleSize,
      corpusFile: options.fixtureShape === 'corpus-cycle' ? basename(options.corpusFile) : null,
      batchSize: options.batchSize,
      cases: options.cases,
      profilerFeatures: options.profilerFeatures,
    },
    rawArtifacts: {
      profilePath: rawProfilePath,
      benchmarkJsonPath: childJsonOut,
      benchmarkMdPath: childMdOut,
      committed: false,
    },
    fixture: benchmark.fixture,
    variants: benchmark.variants.map(row => ({
      id: row.id,
      family: row.family,
      mibPerSec: row.mibPerSec,
      eventCount: row.eventCount,
      checksum: row.checksum,
      fullStringParity: row.fullStringParity,
      boundedMemory: row.boundedMemory,
      memoryKind: row.memory?.kind ?? null,
    })),
    profile: profileSummary,
    findings: createFindings(benchmark, profileSummary),
    child,
  };
}

function summarizeProfile(profile) {
  const threadSummaries = (profile.threads ?? []).map(summarizeThread);
  const targetTermHits = targetTerms.map(term => ({
    term,
    frameLocationHits: sum(threadSummaries.map(thread => thread.targetTermHits[term]?.frameLocationHits ?? 0)),
    sampleStackHits: sum(threadSummaries.map(thread => thread.targetTermHits[term]?.sampleStackHits ?? 0)),
  }));
  return {
    formatVersion: profile.meta?.version ?? null,
    interval: profile.meta?.interval ?? null,
    stackwalk: profile.meta?.stackwalk ?? null,
    processType: profile.meta?.processType ?? null,
    profilingStartTime: profile.meta?.profilingStartTime ?? null,
    profilingEndTime: profile.meta?.profilingEndTime ?? null,
    features: profile.meta?.configuration?.features ?? [],
    threadCount: threadSummaries.length,
    totalSamples: sum(threadSummaries.map(thread => thread.sampleCount)),
    totalFrames: sum(threadSummaries.map(thread => thread.frameCount)),
    totalJsRelevantFrames: sum(threadSummaries.map(thread => thread.jsRelevantFrameCount)),
    targetTermHits,
    threads: threadSummaries,
  };
}

function summarizeThread(thread) {
  const stringTable = thread.stringTable ?? [];
  const frameSchema = thread.frameTable?.schema ?? {};
  const frameRows = thread.frameTable?.data ?? [];
  const stackSchema = thread.stackTable?.schema ?? {};
  const stackRows = thread.stackTable?.data ?? [];
  const sampleSchema = thread.samples?.schema ?? {};
  const sampleRows = thread.samples?.data ?? [];
  const frameByIndex = frameRows.map(row => {
    const location = stringTable[row[frameSchema.location]] ?? '';
    return {
      location,
      relevantForJS: row[frameSchema.relevantForJS] === true,
      implementation: row[frameSchema.implementation] ?? null,
    };
  });
  const stackFrameCache = new Map();
  const topLocations = countTopLocations(sampleRows, sampleSchema, stackRows, stackSchema, frameByIndex, stackFrameCache);
  const targetTermHits = {};
  for (const term of targetTerms) {
    const pattern = new RegExp(escapeRegExp(term), 'i');
    targetTermHits[term] = {
      frameLocationHits: frameByIndex.filter(frame => pattern.test(frame.location)).length,
      sampleStackHits: countSampleStackHits(sampleRows, sampleSchema, stackRows, stackSchema, frameByIndex, stackFrameCache, pattern),
    };
  }
  return {
    name: thread.name,
    processType: thread.processType ?? null,
    processName: thread.processName ?? null,
    sampleCount: sampleRows.length,
    frameCount: frameRows.length,
    stackCount: stackRows.length,
    jsRelevantFrameCount: frameByIndex.filter(frame => frame.relevantForJS).length,
    targetTermHits,
    topLocations,
  };
}

function countTopLocations(sampleRows, sampleSchema, stackRows, stackSchema, frameByIndex, stackFrameCache) {
  const counts = new Map();
  for (const sample of sampleRows) {
    for (const frame of framesForStack(sample[sampleSchema.stack], stackRows, stackSchema, frameByIndex, stackFrameCache)) {
      if (!frame.location) continue;
      counts.set(frame.location, (counts.get(frame.location) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([location, sampleHits]) => ({ location, sampleHits }));
}

function countSampleStackHits(sampleRows, sampleSchema, stackRows, stackSchema, frameByIndex, stackFrameCache, pattern) {
  let hits = 0;
  for (const sample of sampleRows) {
    const frames = framesForStack(sample[sampleSchema.stack], stackRows, stackSchema, frameByIndex, stackFrameCache);
    if (frames.some(frame => pattern.test(frame.location))) hits++;
  }
  return hits;
}

function framesForStack(stackIndex, stackRows, stackSchema, frameByIndex, cache) {
  if (stackIndex === null || stackIndex === undefined) return [];
  if (cache.has(stackIndex)) return cache.get(stackIndex);
  const row = stackRows[stackIndex];
  if (!row) return [];
  const prefixFrames = framesForStack(row[stackSchema.prefix], stackRows, stackSchema, frameByIndex, cache);
  const frame = frameByIndex[row[stackSchema.frame]];
  const frames = frame ? [...prefixFrames, frame] : prefixFrames;
  cache.set(stackIndex, frames);
  return frames;
}

function createFindings(benchmark, profile) {
  const targetEvidence = profile.targetTermHits
    .filter(row => row.frameLocationHits > 0 || row.sampleStackHits > 0)
    .map(row => `${row.term}: frameLocations=${row.frameLocationHits}, sampleStacks=${row.sampleStackHits}`);
  return [
    {
      id: 'gecko-profiler-profile-captured',
      classification: 'TRACE_FACT',
      summary: 'Firefox wrote a Gecko Profiler JSON profile for the same browser reader harness through graceful BiDi browser.close shutdown.',
      evidence: [
        `threads=${profile.threadCount}`,
        `samples=${profile.totalSamples}`,
        `frames=${profile.totalFrames}`,
        `features=${profile.features.join(',')}`,
      ],
    },
    {
      id: 'same-contract-profiled-run',
      classification: 'BENCH_FACT',
      summary: 'The profiled Firefox run preserved same-contract event count and checksum parity for selected full-string rows.',
      evidence: benchmark.variants.map(row => `${row.id}: events=${row.eventCount}, checksum=${row.checksum}, throughput=${row.mibPerSec.toFixed(2)} MiB/s`),
    },
    {
      id: 'spidermonkey-profiler-target-frame-evidence',
      classification: targetEvidence.length > 0 ? 'TRACE_FACT' : 'LIMITED_EVIDENCE',
      summary: targetEvidence.length > 0
        ? 'The sampled profile contains benchmark-related JavaScript frame names.'
        : 'The sampled profile was captured, but benchmark-specific JavaScript frame names were not visible in the summarized frame table.',
      evidence: targetEvidence.length > 0 ? targetEvidence : ['targetFrameHits=0'],
    },
    {
      id: 'not-jit-ir-or-runtime-ceiling-proof',
      classification: 'SCOPE_GUARD',
      summary: 'Gecko Profiler samples are not SpiderMonkey JIT IR, not a deterministic optimized-code dump, and not a proof that no faster JavaScript implementation exists.',
      evidence: [
        'Use this as runtime-specific profile evidence only.',
        'Safari/WebKit browser rows remain separate.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Firefox/SpiderMonkey Profiler Trace',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report captures a Gecko Profiler startup/shutdown profile around the Firefox BiDi same-contract reader harness.',
    'It is sampled SpiderMonkey/Gecko profile evidence, not JIT IR, not a deterministic optimized-code dump, and not a JavaScript runtime ceiling proof.',
    '',
    '## Options',
    '',
    `- Fixture shape: ${report.options.fixtureShape}`,
    `- Size GiB: ${report.options.sizeGiB}`,
    `- Cases: ${report.options.cases.join(', ')}`,
    `- Profiler features: ${report.options.profilerFeatures}`,
    `- Raw profile committed: ${report.rawArtifacts.committed ? 'yes' : 'no'}`,
    '',
    '## Variants',
    '',
    '| Variant | Throughput | Events | Checksum | Full-string parity |',
    '| --- | ---: | ---: | ---: | --- |',
  ];
  for (const row of report.variants) {
    lines.push(`| ${row.id} | ${formatRate(row.mibPerSec)} | ${row.eventCount} | ${row.checksum} | ${row.fullStringParity ? 'yes' : 'no'} |`);
  }
  lines.push(
    '',
    '## Profile Summary',
    '',
    `- Threads: ${report.profile.threadCount}`,
    `- Samples: ${report.profile.totalSamples}`,
    `- Frames: ${report.profile.totalFrames}`,
    `- JS-relevant frames: ${report.profile.totalJsRelevantFrames}`,
    `- Interval: ${report.profile.interval ?? 'n/a'}`,
    `- Stackwalk: ${report.profile.stackwalk}`,
    `- Features: ${report.profile.features.join(', ') || 'n/a'}`,
    '',
    '## Target Term Hits',
    '',
    '| Term | Frame locations | Sample stacks |',
    '| --- | ---: | ---: |',
  );
  for (const row of report.profile.targetTermHits) {
    lines.push(`| ${row.term} | ${row.frameLocationHits} | ${row.sampleStackHits} |`);
  }
  lines.push('', '## Threads', '');
  for (const thread of report.profile.threads) {
    lines.push(`### ${thread.name}`);
    lines.push('');
    lines.push(`- Samples: ${thread.sampleCount}`);
    lines.push(`- Frames: ${thread.frameCount}`);
    lines.push(`- JS-relevant frames: ${thread.jsRelevantFrameCount}`);
    lines.push('- Top sampled locations:');
    for (const top of thread.topLocations.slice(0, 6)) {
      lines.push(`  - ${escapeMarkdown(top.location)} (${top.sampleHits})`);
    }
    lines.push('');
  }
  lines.push('## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence ?? []) {
      lines.push(`  - ${evidence}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function printSummary(report) {
  console.log('Firefox/SpiderMonkey profiler trace');
  console.log(`threads=${report.profile.threadCount} samples=${report.profile.totalSamples} frames=${report.profile.totalFrames}`);
  for (const row of report.profile.targetTermHits) {
    console.log(`${row.term}: frameLocations=${row.frameLocationHits} sampleStacks=${row.sampleStackHits}`);
  }
}

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
  console.log(`Wrote ${resolved}`);
}

function sum(values) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function formatRate(value) {
  return `${value.toFixed(2)} MiB/s`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeMarkdown(value) {
  return String(value).replace(/\|/g, '\\|');
}

main();
