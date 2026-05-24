import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const candidateScript = join(__dirname, 'candidate-headroom-large.mjs');
const defaultOutputDir = join(__dirname, 'results', 'bun-jsc-heap-allocation-profile', `profile-${Date.now()}`);
const defaultJsonOut = join(__dirname, 'results', 'release', 'bun-jsc-heap-allocation-profile.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'bun-jsc-heap-allocation-profile.md');
const defaultCases = ['stringFull', 'eventObjectFull', 'rawFrameNameId'];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizeGiB: 0.015625,
    fixtureShape: 'diverse-cycle',
    diverseCycleSize: 4096,
    cases: [...defaultCases],
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
  const parsed = value.split(',').map(entry => entry.trim()).filter(Boolean);
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

  const cases = options.cases.map(caseId => runHeapCase(options, caseId));
  const report = createReport({ options, runtimeProbe, cases });
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
  const result = spawnSync('bun', ['--no-install', '-e', "console.log(JSON.stringify({runtimeName:'bun', javascriptEngine:'JavaScriptCore', bunVersion:process.versions.bun, webkitCommit:process.versions.webkit, processVersions:process.versions}))"], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
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

function runHeapCase(options, caseId) {
  const benchmarkJson = join(options.outputDir, `${caseId}-benchmark.json`);
  const benchmarkMd = join(options.outputDir, `${caseId}-benchmark.md`);
  const bunOutputDir = toBunCliPath(relative(repoRoot, options.outputDir));
  const bunBenchmarkJson = toBunCliPath(relative(repoRoot, benchmarkJson));
  const bunBenchmarkMd = toBunCliPath(relative(repoRoot, benchmarkMd));
  const args = [
    '--no-install',
    '--heap-prof-md',
    `--heap-prof-dir=${bunOutputDir}`,
    `--heap-prof-name=${caseId}`,
    candidateScript,
    `--size-gib=${options.sizeGiB}`,
    `--fixture-shape=${options.fixtureShape}`,
    `--diverse-cycle-size=${options.diverseCycleSize}`,
    `--cases=${caseId}`,
    '--runs=1',
    '--warmups=0',
    `--json-out=${bunBenchmarkJson}`,
    `--md-out=${bunBenchmarkMd}`,
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
    throw new Error(`Bun heap allocation profile case failed for ${caseId}. See ${runLog}`);
  }

  const benchmark = JSON.parse(readFileSync(benchmarkJson, 'utf8'));
  const variant = benchmark.variants.find(entry => entry.id === caseId);
  if (!variant) {
    throw new Error(`Bun benchmark output for ${caseId} did not contain the requested variant.`);
  }
  const heapProfileMd = findHeapProfileFile(options.outputDir, caseId);
  const heapMarkdown = readFileSync(heapProfileMd, 'utf8');
  return {
    caseId,
    command: ['bun', ...args],
    elapsedMs,
    rawFiles: {
      benchmarkJson,
      benchmarkMd,
      heapProfileMd,
      runLog,
    },
    fixture: benchmark.fixture,
    result: summarizeVariant(variant),
    heapProfile: summarizeHeapMarkdown(heapMarkdown),
  };
}

function findHeapProfileFile(outputDir, caseId) {
  const exact = join(outputDir, caseId);
  if (existsSync(exact)) return exact;
  const files = readdirSync(outputDir)
    .filter(fileName => fileName.startsWith(caseId) && !fileName.endsWith('.json') && !fileName.endsWith('.log') && !fileName.endsWith('-benchmark.md'))
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
  if (!files[0]) {
    throw new Error(`Could not find Bun heap profile markdown for ${caseId} in ${outputDir}`);
  }
  return join(outputDir, files[0]);
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
    boundedMemory: variant.boundedMemory,
    maxRssMiB: variant.memory?.maxRssBytes / (1024 * 1024),
    stringFieldReads: variant.materializationCounters?.stringFieldReads ?? 0,
    publicEventObjects: variant.materializationCounters?.publicEventObjects ?? 0,
    rawSpanMaterializations: variant.materializationCounters?.rawSpanMaterializations ?? 0,
  };
}

function summarizeHeapMarkdown(markdown) {
  return {
    totalHeapBytes: parseSummaryBytes(markdown, 'Total Heap Size'),
    totalObjects: parseSummaryInteger(markdown, 'Total Objects'),
    totalEdges: parseSummaryInteger(markdown, 'Total Edges'),
    uniqueTypes: parseSummaryInteger(markdown, 'Unique Types'),
    gcRoots: parseSummaryInteger(markdown, 'GC Roots'),
    topTypesByRetainedSize: parseTopTypes(markdown).slice(0, 12),
  };
}

function parseSummaryBytes(markdown, label) {
  const escaped = escapeRegExp(label);
  const match = markdown.match(new RegExp(`\\|\\s*${escaped}\\s*\\|[^\\n]*\\((\\d+) bytes\\)\\s*\\|`));
  if (!match) throw new Error(`Could not parse heap summary byte metric: ${label}`);
  return Number(match[1]);
}

function parseSummaryInteger(markdown, label) {
  const escaped = escapeRegExp(label);
  const match = markdown.match(new RegExp(`\\|\\s*${escaped}\\s*\\|\\s*([\\d,]+)\\s*\\|`));
  if (!match) throw new Error(`Could not parse heap summary integer metric: ${label}`);
  return Number(match[1].replaceAll(',', ''));
}

function parseTopTypes(markdown) {
  const sectionStart = markdown.indexOf('## Top 50 Types by Retained Size');
  if (sectionStart < 0) return [];
  const nextSection = markdown.indexOf('\n## ', sectionStart + 1);
  const section = markdown.slice(sectionStart, nextSection < 0 ? undefined : nextSection);
  return section.split('\n')
    .map(line => line.trim())
    .filter(line => /^\|\s*\d+\s*\|/.test(line))
    .map(line => {
      const cells = line.split('|').map(cell => cell.trim()).filter(Boolean);
      return {
        rank: Number(cells[0]),
        type: cells[1]?.replace(/^`|`$/g, '') ?? '',
        count: Number(cells[2]?.replaceAll(',', '') ?? 0),
        selfSize: cells[3] ?? '',
        retainedSize: cells[4] ?? '',
        largestInstance: cells[5] ?? '',
      };
    });
}

function createReport({ options, runtimeProbe, cases }) {
  return {
    generatedAt: new Date().toISOString(),
    objective: 'bun-jsc-heap-allocation-profile',
    contract: 'bun-jsc-heap-profile-retained-snapshot',
    note: 'Bun/JSC --heap-prof-md retained heap snapshots around same-contract JavaScript full-string reader rows. This is retained-heap evidence after process exit, not an allocation census or runtime ceiling proof.',
    runtime: runtimeProbe,
    host: {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      cpuName: cpus()[0]?.model ?? 'unknown',
    },
    options: {
      sizeGiB: options.sizeGiB,
      fixtureShape: options.fixtureShape,
      diverseCycleSize: options.diverseCycleSize,
      cases: options.cases,
    },
    fullStringParity: computeFullStringParity(cases),
    cases,
    findings: createFindings(cases),
  };
}

function computeFullStringParity(cases) {
  const rows = cases.map(entry => entry.result).filter(entry => entry.fullStringParity);
  const first = rows[0];
  if (!first) return { status: 'not-applicable', rowIds: [], eventCount: null, checksum: null };
  const mismatch = rows.find(entry => entry.eventCount !== first.eventCount || entry.checksum !== first.checksum);
  if (mismatch) {
    throw new Error(`Full-string case ${mismatch.id} does not match ${first.id}.`);
  }
  return {
    status: 'ok',
    eventCount: first.eventCount,
    checksum: first.checksum,
    rowIds: rows.map(entry => entry.id),
  };
}

function createFindings(cases) {
  return [
    {
      id: 'same-contract-result',
      classification: 'ALLOCATION_FACT',
      summary: 'All Bun/JSC heap-profiled rows preserved the same full-string event count and checksum.',
      evidence: cases.map(entry => `${entry.caseId}: events=${entry.result.eventCount}, checksum=${entry.result.checksum}`),
    },
    {
      id: 'retained-heap-snapshot',
      classification: 'ALLOCATION_FACT',
      summary: 'Bun --heap-prof-md emitted retained JavaScriptCore heap snapshots with object/type counts for each row.',
      evidence: cases.map(entry => `${entry.caseId}: heapBytes=${entry.heapProfile.totalHeapBytes}, objects=${entry.heapProfile.totalObjects}, gcRoots=${entry.heapProfile.gcRoots}`),
    },
    {
      id: 'heap-profile-not-allocation-census',
      classification: 'TRACE_FACT_LIMIT',
      summary: 'The Bun heap profile is retained-heap evidence after the profiled process exits, not a per-allocation census or a browser Safari/WebKit measurement.',
      evidence: [
        'It strengthens Bun/JSC allocation evidence beyond endpoint memory counters.',
        'It does not close Safari/browser JSC rows, Bun/JSC IR/codegen, or non-V8 browser allocation evidence.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Bun/JSC Heap Allocation Profile',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report is an ALLOCATION_FACT for one Bun/JSC build and one generated fixture.',
    'It summarizes `bun --heap-prof-md` retained heap snapshots around same-contract full-string JavaScript reader rows.',
    'It is not a JavaScriptCore allocation census, not Safari/browser evidence, and not a runtime ceiling proof.',
    '',
    '## Runtime',
    '',
    `- Bun revision: ${report.runtime.bunRevision}`,
    `- Bun version: ${report.runtime.bunVersion}`,
    `- WebKit commit: ${report.runtime.webkitCommit}`,
    `- Host Node: ${report.host.node}`,
    `- Host platform: ${report.host.platform}`,
    '',
    '## Full String Parity',
    '',
    `- Status: ${report.fullStringParity.status}`,
    `- Event count: ${report.fullStringParity.eventCount}`,
    `- Checksum: ${report.fullStringParity.checksum}`,
    `- Rows: ${report.fullStringParity.rowIds.join(', ')}`,
    '',
    '## Cases',
    '',
    '| Case | MiB/s | Events | Checksum | Bounded | Max RSS MiB | Heap bytes | Objects | GC roots | Top retained types |',
    '| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |',
    ...report.cases.map(entry => [
      entry.caseId,
      formatNumber(entry.result.mibPerSec),
      entry.result.eventCount,
      entry.result.checksum,
      entry.result.boundedMemory ? 'yes' : 'no',
      formatNumber(entry.result.maxRssMiB),
      entry.heapProfile.totalHeapBytes,
      entry.heapProfile.totalObjects,
      entry.heapProfile.gcRoots,
      entry.heapProfile.topTypesByRetainedSize.slice(0, 5).map(type => `${type.type}:${type.retainedSize}`).join(', '),
    ].join(' | ')).map(row => `| ${row} |`),
    '',
    '## Raw Artifacts',
    '',
    '- Raw heap profile markdown files are not committed.',
    ...report.cases.flatMap(entry => [
      `- ${entry.caseId} heap profile: ${entry.rawFiles.heapProfileMd}`,
      `- ${entry.caseId} benchmark JSON: ${entry.rawFiles.benchmarkJson}`,
    ]),
    '',
    '## Findings',
    '',
    ...report.findings.flatMap(finding => [
      `- ${finding.id} (${finding.classification}): ${finding.summary}`,
      ...finding.evidence.map(item => `  - ${item}`),
    ]),
    '',
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(JSON.stringify({
    objective: report.objective,
    runtime: report.runtime.bunRevision,
    cases: report.cases.map(entry => ({
      id: entry.caseId,
      mibPerSec: entry.result.mibPerSec,
      heapBytes: entry.heapProfile.totalHeapBytes,
      objects: entry.heapProfile.totalObjects,
    })),
  }, null, 2));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}

function toBunCliPath(pathValue) {
  return pathValue.replaceAll('\\', '/');
}

main();
