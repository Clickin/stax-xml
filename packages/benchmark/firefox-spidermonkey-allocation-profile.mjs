import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultReleaseDir = resolve(__dirname, 'results', 'release');
const defaultJsonOut = resolve(defaultReleaseDir, 'firefox-spidermonkey-allocation-profile.json');
const defaultMdOut = resolve(defaultReleaseDir, 'firefox-spidermonkey-allocation-profile.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    releaseDir: defaultReleaseDir,
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
      case '--release-dir':
        options.releaseDir = resolve(process.cwd(), readValue());
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

  if (!existsSync(options.releaseDir)) {
    throw new Error(`--release-dir does not exist: ${options.releaseDir}`);
  }
  return options;
}

function main() {
  const options = parseArgs();
  const report = createReport(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function createReport(options) {
  const sourceArtifacts = readdirSync(options.releaseDir)
    .filter(file => file.startsWith('firefox-bidi-') && file.endsWith('.json'))
    .sort()
    .map(file => {
      const root = JSON.parse(readFileSync(join(options.releaseDir, file), 'utf8'));
      return summarizeFirefoxArtifact(file, root);
    })
    .filter(Boolean);

  const probeRows = sourceArtifacts.flatMap(artifact => artifact.variantHostMemoryRows);
  const aggregateRows = sourceArtifacts.flatMap(artifact => artifact.aggregateHostMemoryRows);
  const allHostRows = [...probeRows, ...aggregateRows];

  return {
    generatedAt: new Date().toISOString(),
    objective: 'firefox-spidermonkey-allocation-profile',
    contract: 'non-v8-browser-host-process-memory-allocation-evidence',
    note: 'Firefox/SpiderMonkey host process-tree memory evidence extracted from existing Firefox BiDi release artifacts. This is ALLOCATION_FACT_LIMIT evidence, not row-level JS heap proof and not portable browser RSS.',
    environment: {
      runtimeName: 'browser',
      javascriptEngine: 'SpiderMonkey',
      browserName: 'Firefox',
      browserVersion: firstNonNull(sourceArtifacts.map(artifact => artifact.environment.browserVersion)),
      userAgent: firstNonNull(sourceArtifacts.map(artifact => artifact.environment.userAgent)),
      hostPlatform: `${process.platform}-${process.arch}`,
      cpuName: cpus()[0]?.model ?? 'unknown',
    },
    sourceArtifacts: sourceArtifacts.map(artifact => ({
      sourceArtifact: artifact.sourceArtifact,
      objective: artifact.objective,
      fixture: artifact.fixture,
      variantHostMemoryRows: artifact.variantHostMemoryRows.length,
      aggregateHostMemoryRows: artifact.aggregateHostMemoryRows.length,
    })),
    summary: {
      scannedFirefoxArtifacts: sourceArtifacts.length,
      variantHostMemoryRowCount: probeRows.length,
      aggregateHostMemoryRowCount: aggregateRows.length,
      maxWorkingSetBytes: max(allHostRows.map(row => row.maxWorkingSetBytes)),
      maxPrivateBytes: max(allHostRows.map(row => row.maxPrivateBytes)),
      maxProcessCount: max(allHostRows.map(row => row.maxProcessCount)),
      fullStringProbeRowCount: probeRows.filter(row => row.fullStringParity).length,
    },
    variantHostMemoryRows: probeRows,
    aggregateHostMemoryRows: aggregateRows,
    findings: createFindings(probeRows, aggregateRows),
  };
}

function summarizeFirefoxArtifact(sourceArtifact, root) {
  if (!root?.environment || root.environment.javascriptEngine !== 'SpiderMonkey') {
    return null;
  }
  const variantHostMemoryRows = [];
  for (const variant of root.variants ?? []) {
    if (!variant?.hostProcessMemoryProbe) continue;
    variantHostMemoryRows.push({
      sourceArtifact,
      caseId: variant.id,
      family: variant.family,
      fixtureShape: root.fixture?.shape ?? null,
      fixtureSource: root.fixture?.source ?? null,
      corpusSeed: root.fixture?.sourceFile ? basename(root.fixture.sourceFile) : null,
      sizeGiB: root.fixture?.sizeGiB ?? null,
      fullStringParity: variant.fullStringParity === true,
      eventCount: variant.eventCount ?? null,
      checksum: variant.checksum ?? null,
      probeThroughputMiBPerSec: round(variant.hostProcessMemoryProbe.probeMibPerSec ?? null),
      probeEventCount: variant.hostProcessMemoryProbe.probeEventCount ?? null,
      probeChecksum: variant.hostProcessMemoryProbe.probeChecksum ?? null,
      scope: variant.hostProcessMemoryProbe.scope,
      maxWorkingSetBytes: variant.hostProcessMemoryProbe.maxWorkingSetBytes,
      maxPrivateBytes: variant.hostProcessMemoryProbe.maxPrivateBytes,
      maxProcessCount: variant.hostProcessMemoryProbe.maxProcessCount,
      sampleCount: variant.hostProcessMemoryProbe.samples?.length ?? 0,
      limitation: 'fresh-browser per-case Windows process-tree probe; not row-level JS heap proof',
    });
  }

  const aggregateHostMemoryRows = [];
  const rootAggregate = summarizeHostMemory(sourceArtifact, 'artifact-host-process-memory', root.hostProcessMemory, root.fixture, root.environment);
  if (rootAggregate) aggregateHostMemoryRows.push(rootAggregate);
  for (const child of root.childReports ?? []) {
    const childAggregate = summarizeHostMemory(
      sourceArtifact,
      `child-run-${child.runIndex}`,
      child.hostProcessMemory,
      root.fixture,
      child.environment ?? root.environment,
    );
    if (childAggregate) aggregateHostMemoryRows.push(childAggregate);
  }

  if (variantHostMemoryRows.length === 0 && aggregateHostMemoryRows.length === 0) {
    return null;
  }
  return {
    sourceArtifact,
    objective: root.objective,
    environment: root.environment,
    fixture: {
      source: root.fixture?.source ?? null,
      shape: root.fixture?.shape ?? null,
      sourceFile: root.fixture?.sourceFile ? basename(root.fixture.sourceFile) : null,
      sizeGiB: root.fixture?.sizeGiB ?? null,
    },
    variantHostMemoryRows,
    aggregateHostMemoryRows,
  };
}

function summarizeHostMemory(sourceArtifact, rowId, hostProcessMemory, fixture, environment) {
  if (!hostProcessMemory) return null;
  return {
    sourceArtifact,
    rowId,
    runtimeName: environment?.runtimeName ?? 'browser',
    javascriptEngine: environment?.javascriptEngine ?? 'SpiderMonkey',
    browserName: environment?.browserName ?? 'Firefox',
    fixtureShape: fixture?.shape ?? null,
    fixtureSource: fixture?.source ?? null,
    corpusSeed: fixture?.sourceFile ? basename(fixture.sourceFile) : null,
    sizeGiB: fixture?.sizeGiB ?? null,
    scope: hostProcessMemory.scope,
    maxWorkingSetBytes: hostProcessMemory.maxWorkingSetBytes,
    maxPrivateBytes: hostProcessMemory.maxPrivateBytes,
    maxProcessCount: hostProcessMemory.maxProcessCount,
    sampleCount: hostProcessMemory.samples?.length ?? 0,
    limitation: hostProcessMemory.note ?? 'host process-tree memory; not portable browser RSS or JS heap proof',
  };
}

function createFindings(probeRows, aggregateRows) {
  return [
    {
      id: 'firefox-host-process-memory-evidence-present',
      classification: 'ALLOCATION_FACT_LIMIT',
      summary: 'Firefox/SpiderMonkey release artifacts include Windows host process-tree memory evidence for same-contract browser rows.',
      evidence: [
        `variantHostMemoryRows=${probeRows.length}`,
        `aggregateHostMemoryRows=${aggregateRows.length}`,
        `fullStringProbeRows=${probeRows.filter(row => row.fullStringParity).length}`,
      ],
    },
    {
      id: 'not-js-heap-or-portable-rss',
      classification: 'SCOPE_GUARD',
      summary: 'Firefox does not expose Chromium performance.memory in page context; these counters are host process-tree evidence, not row-level JS heap proof or portable browser RSS.',
      evidence: [
        'Rows remain non-counterexamples under the bounded JS heap proof rule.',
        'The separate Firefox memory API source-pin audit records the page API absence.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Firefox/SpiderMonkey Allocation Profile',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report is an ALLOCATION_FACT_LIMIT artifact for Firefox/SpiderMonkey host process-tree memory evidence.',
    'It is not row-level JS heap proof, not portable browser RSS, and not a JavaScript runtime ceiling proof.',
    '',
    '## Summary',
    '',
    `- Scanned Firefox artifacts: ${report.summary.scannedFirefoxArtifacts}`,
    `- Variant host-memory rows: ${report.summary.variantHostMemoryRowCount}`,
    `- Aggregate host-memory rows: ${report.summary.aggregateHostMemoryRowCount}`,
    `- Full-string probe rows: ${report.summary.fullStringProbeRowCount}`,
    `- Max working set: ${formatBytes(report.summary.maxWorkingSetBytes)}`,
    `- Max private bytes: ${formatBytes(report.summary.maxPrivateBytes)}`,
    `- Max process count: ${report.summary.maxProcessCount ?? 'n/a'}`,
    '',
    '## Variant Host-Memory Rows',
    '',
    '| Source | Case | Fixture | Events | Checksum | Max working set | Max private bytes |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: |',
  ];
  for (const row of report.variantHostMemoryRows.slice(0, 40)) {
    lines.push(`| ${row.sourceArtifact} | ${row.caseId} | ${formatFixture(row)} | ${row.eventCount ?? ''} | ${row.checksum ?? ''} | ${formatBytes(row.maxWorkingSetBytes)} | ${formatBytes(row.maxPrivateBytes)} |`);
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
    '- This artifact closes the missing non-V8 browser allocation-evidence family only at the host process-tree level.',
    '- It does not make Firefox rows bounded-memory counterexamples under the row-level JS heap proof rule.',
    '- It does not cover Safari/WebKit browser rows.',
    '',
  );
  return `${lines.join('\n')}`;
}

function formatFixture(row) {
  const source = row.corpusSeed ?? row.fixtureShape ?? row.fixtureSource ?? 'unknown';
  return `${source} ${row.sizeGiB ? `${row.sizeGiB.toFixed(2)} GiB` : ''}`.trim();
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(JSON.stringify({
    objective: report.objective,
    scannedFirefoxArtifacts: report.summary.scannedFirefoxArtifacts,
    variantHostMemoryRows: report.summary.variantHostMemoryRowCount,
    aggregateHostMemoryRows: report.summary.aggregateHostMemoryRowCount,
    maxWorkingSetMiB: round(report.summary.maxWorkingSetBytes / 1024 / 1024),
    maxPrivateMiB: round(report.summary.maxPrivateBytes / 1024 / 1024),
  }, null, 2));
}

function firstNonNull(values) {
  return values.find(value => value !== null && value !== undefined) ?? null;
}

function max(values) {
  const finite = values.filter(value => Number.isFinite(value));
  return finite.length > 0 ? Math.max(...finite) : null;
}

function basename(filePath) {
  return String(filePath).replaceAll('\\', '/').split('/').pop();
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'n/a';
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

main();
