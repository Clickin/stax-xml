import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultFile = join(__dirname, 'test-data', 'runtime-comparison-16mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'runtime-matrix.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'runtime-matrix.md');
const runnerPath = join(__dirname, 'runtime-stax-runner.mjs');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    runs: 3,
    warmups: 1,
    runtimes: ['node', 'bun', 'deno'],
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    allowMissing: false,
    fileExplicit: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg === '--') continue;
    if (arg === '--allow-missing') {
      options.allowMissing = true;
      continue;
    }

    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error(`${arg} requires a value.`);
      }
      index++;
      return value;
    };

    switch (name) {
      case '--file':
        options.file = resolve(process.cwd(), readValue());
        options.fileExplicit = true;
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), '--runs');
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), '--warmups');
        break;
      case '--runtimes':
        options.runtimes = readValue().split(',').map(value => value.trim()).filter(Boolean);
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

  if (!existsSync(options.file) && !options.fileExplicit) {
    generateXmlFile(options.file, 16 * 1024 * 1024);
  }
  if (!existsSync(options.file)) {
    throw new Error(`Benchmark fixture does not exist: ${options.file}`);
  }

  return options;
}

function generateXmlFile(filePath, targetBytes) {
  mkdirSync(dirname(filePath), { recursive: true });
  const fd = openSync(filePath, 'w');
  const header = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<root>\n');
  const footer = Buffer.from('</root>\n');
  const pending = [];
  let pendingBytes = 0;
  let written = 0;
  let id = 0;

  try {
    writeSync(fd, header);
    written += header.byteLength;
    while (written + pendingBytes + footer.byteLength < targetBytes) {
      const element = Buffer.from(
        `  <book id="book-${id}" lang="en" code="${id % 97}">` +
          `<title>Runtime Benchmark ${id}</title>` +
          `<author>Author ${id % 4096}</author>` +
          `<description>Full string checksum text payload ${id} with stable words and numbers.</description>` +
          `<chapter number="1">Intro ${id}</chapter>` +
          `<chapter number="2">Body ${id}</chapter>` +
        '</book>\n',
      );
      if (written + pendingBytes + element.byteLength + footer.byteLength > targetBytes) {
        break;
      }
      pending.push(element);
      pendingBytes += element.byteLength;
      id++;
      if (pendingBytes >= 1024 * 1024) {
        writeSync(fd, Buffer.concat(pending, pendingBytes));
        written += pendingBytes;
        pending.length = 0;
        pendingBytes = 0;
      }
    }
    if (pendingBytes > 0) {
      writeSync(fd, Buffer.concat(pending, pendingBytes));
    }
    writeSync(fd, footer);
  } finally {
    closeSync(fd);
  }
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }
  return parsed;
}

function runtimeCommand(runtime, options) {
  const baseArgs = [
    runnerPath,
    '--file',
    options.file,
    '--runs',
    String(options.runs),
    '--warmups',
    String(options.warmups),
    '--runtime-id',
    runtime,
  ];

  if (runtime === 'node') {
    return {
      command: process.execPath,
      args: ['--expose-gc', ...baseArgs],
    };
  }
  if (runtime === 'bun') {
    return {
      command: 'bun',
      args: baseArgs,
    };
  }
  if (runtime === 'deno') {
    return {
      command: 'deno',
      args: ['run', '--allow-read', '--allow-env', ...baseArgs],
    };
  }
  throw new Error(`Unknown runtime: ${runtime}`);
}

function runRuntime(runtime, options) {
  const { command, args } = runtimeCommand(runtime, options);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    return {
      runtime: { id: runtime, version: null },
      status: 'skipped',
      reason: result.error.message,
    };
  }
  if (result.status !== 0) {
    return {
      runtime: { id: runtime, version: null },
      status: 'failed',
      reason: trimSpawnOutput(result) || `exit ${result.status}`,
    };
  }

  try {
    const parsed = JSON.parse(result.stdout);
    return {
      ...parsed,
      status: 'ok',
      stderr: String(result.stderr ?? '').trim() || undefined,
    };
  } catch (error) {
    return {
      runtime: { id: runtime, version: null },
      status: 'failed',
      reason: `Invalid JSON from runtime runner: ${error.message}\n${result.stdout}`,
    };
  }
}

function trimSpawnOutput(result) {
  return String(result.stderr ?? '').trim() || String(result.stdout ?? '').trim();
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`;
}

function formatRate(value) {
  return `${value.toFixed(1)} MiB/s`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'n/a';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function createRuntimeComparisons(results) {
  const workloads = [];
  const seen = new Set();

  for (const result of results) {
    if (result.status !== 'ok') continue;
    for (const scenario of result.scenarios) {
      if (seen.has(scenario.id)) continue;
      seen.add(scenario.id);
      workloads.push(scenario.id);
    }
  }

  return workloads.map((workload) => {
    const runtimes = [];
    let baseline;

    for (const result of results) {
      if (result.status !== 'ok') {
        continue;
      }
      const scenario = result.scenarios.find(entry => entry.id === workload);
      if (!scenario) {
        continue;
      }
      const entry = {
        runtime: result.runtime.id,
        version: result.runtime.version,
        status: scenario.status,
        mibPerSec: scenario.mibPerSec,
        avgMs: scenario.avgMs,
        eventCount: scenario.eventCount,
        checksum: scenario.checksum,
        peakHeapUsedBytes: scenario.peakHeapUsedBytes,
      };
      if (!baseline && scenario.status === 'ok') {
        baseline = entry;
      }
      runtimes.push(entry);
    }

    const parity = baseline
      ? {
          status: runtimes.every(entry => (
            entry.status === 'ok'
            && entry.eventCount === baseline.eventCount
            && entry.checksum === baseline.checksum
          )) ? 'ok' : 'mismatch',
          eventCount: baseline.eventCount,
          checksum: baseline.checksum,
          mismatches: runtimes
            .filter(entry => (
              entry.status !== 'ok'
              || entry.eventCount !== baseline.eventCount
              || entry.checksum !== baseline.checksum
            ))
            .map(entry => ({
              runtime: entry.runtime,
              status: entry.status,
              eventCount: entry.eventCount,
              checksum: entry.checksum,
            })),
        }
      : {
          status: 'missing',
          eventCount: null,
          checksum: null,
          mismatches: [],
        };

    const baselineThroughput = baseline?.mibPerSec ?? null;
    return {
      workload,
      baselineRuntime: baseline?.runtime ?? null,
      parity,
      runtimes: runtimes.map(entry => ({
        ...entry,
        relativeToBaseline: baselineThroughput ? entry.mibPerSec / baselineThroughput : null,
      })),
    };
  });
}

function createWorkloadDetails(report) {
  return [
    '<details>',
    '<summary>Workload contract: Node, Bun, and Deno runtime matrix</summary>',
    '',
    `The matrix uses one generated single-root ${report.fixture.sizeMiB.toFixed(2)} MiB XML fixture.`,
    '',
    'Sample XML shape, shortened:',
    '',
    '~~~xml',
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<root>',
    '  <book id="book-N" lang="en" code="...">',
    '    <title>Runtime Benchmark N</title>',
    '    <author>Author ...</author>',
    '    <description>Full string checksum text payload ...</description>',
    '    <chapter number="1">Intro ...</chapter>',
    '    <chapter number="2">Body ...</chapter>',
    '  </book>',
    '</root>',
    '~~~',
    '',
    'Output shape:',
    '',
    '~~~text',
    'runtime-result = {',
    '  workload: "public-sync-full-string" | "stream-sync-index-full-string" |',
    '            "projection-low-selectivity" | "projection-high-selectivity" |',
    '            "event-count-only" | "event-full-string",',
    '  eventCount: number, // record count for projection workloads',
    '  checksum: fold(event type, names, text, attr names, attr values),',
    '  peakHeapUsedBytes: number',
    '}',
    '~~~',
    '',
    'Runtime methods:',
    '',
    '- Node reads text with `fs.readFileSync`, then runs the built package through `node --expose-gc`.',
    '- Bun reads text with `Bun.file(path).text()`, then runs the same built JavaScript package.',
    '- Deno reads text with `Deno.readTextFile` under `--allow-read --allow-env`, then runs the same built JavaScript package.',
    '- `public-sync-full-string` uses `EventReaderSync` over one string.',
    '- `stream-sync-index-full-string` uses `StreamReaderSync` over bytes and consumes each `StreamBatch` with `eventCount` plus index accessors.',
    '- `projection-low-selectivity` uses `stax-xml/projection` over bytes, selects `/root/book[@code="7"]`, and folds only `id` plus direct `title` child text.',
    '- `projection-high-selectivity` uses the same projected fields but selects every `/root/book` record.',
    '- `event-count-only` and `event-full-string` use public event reader checksum tiers; they are not async parser rows.',
    '- This matrix measures only the public pure JavaScript reader path.',
    '',
    '</details>',
  ].join('\n');
}

function createMarkdown(report) {
  const lines = [
    '# JavaScript Runtime Benchmark Matrix',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This fixture compares the same built `stax-xml` JavaScript implementation on Node, Bun, and Deno.',
    'It does not compare binary parser modules or non-JavaScript parser backends.',
    '',
    '## Environment',
    '',
    `- CPU: ${report.environment.cpuName}`,
    `- Fixture: ${report.fixture.path}`,
    `- Fixture size: ${report.fixture.sizeMiB.toFixed(2)} MiB`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    '',
    '## Workloads',
    '',
    createWorkloadDetails(report),
    '',
    '## Runtime Comparisons',
    '',
    'Compare rows only within the same workload. Each workload preserves one input fixture, one API path, one materialization shape, and one checksum contract across runtimes.',
    '',
    '| Workload | Runtime | Version | Throughput | Relative to baseline | Average | Events | Checksum | Peak heap | Status |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ];

  for (const comparison of report.comparisons) {
    for (const runtime of comparison.runtimes) {
      lines.push(
        `| ${comparison.workload} | ${runtime.runtime} | ${escapePipe(runtime.version)} | ` +
        `${formatRate(runtime.mibPerSec)} | ${formatRelative(runtime.relativeToBaseline)} | ` +
        `${formatMs(runtime.avgMs)} | ${runtime.eventCount} | ${runtime.checksum} | ` +
        `${formatBytes(runtime.peakHeapUsedBytes)} | ${runtime.status} |`,
      );
    }
    if (comparison.parity.status !== 'ok') {
      lines.push(`| ${comparison.workload} | parity | n/a | n/a | n/a | n/a | ${comparison.parity.eventCount ?? 'n/a'} | ${comparison.parity.checksum ?? 'n/a'} | n/a | ${comparison.parity.status} |`);
    }
  }

  const failedResults = report.results.filter(result => result.status !== 'ok');
  for (const result of failedResults) {
    lines.push(`| runtime-startup | ${result.runtime.id} | n/a | n/a | n/a | n/a | n/a | n/a | n/a | ${result.status}: ${escapePipe(result.reason)} |`);
  }

  lines.push('');
  lines.push('## Contract');
  lines.push('');
  lines.push('- `public-sync-full-string` uses `EventReaderSync` and folds element names, text, attribute names, and attribute values into a checksum.');
  lines.push('- `stream-sync-index-full-string` uses `StreamReaderSync` and folds the same full-string checksum through batch-local index accessors.');
  lines.push('- `projection-low-selectivity` uses `stax-xml/projection`, byte-span selector matching, `attrEquals("code", "7")`, `attr("id")`, and `childText("title")`; its event count column is projected record count.');
  lines.push('- `projection-high-selectivity` uses the same projection engine and projected fields without the attribute predicate, so it materializes every generated book record.');
  lines.push('- `event-count-only` uses the public event reader without string field folding beyond event counts and attribute counts.');
  lines.push('- `event-full-string` uses the same public event reader and materializes the full string checksum workload.');
  lines.push('- All runtime rows must preserve event count and checksum within the same workload.');

  return `${lines.join('\n')}\n`;
}

function formatRelative(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return `${value.toFixed(2)}x`;
}

function escapePipe(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

async function main() {
  const options = parseArgs();
  const results = options.runtimes.map(runtime => runRuntime(runtime, options));
  const failed = results.filter(result => result.status !== 'ok');
  if (failed.length > 0 && !options.allowMissing) {
    for (const result of failed) {
      console.error(`${result.runtime.id}: ${result.status}: ${result.reason}`);
    }
    process.exitCode = 1;
  }

  const fileSizeBytes = existsSync(options.file) ? statSync(options.file).size : 0;
  const report = {
    generatedAt: new Date().toISOString(),
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
    },
    fixture: {
      path: options.file,
      sizeBytes: fileSizeBytes,
      sizeMiB: fileSizeBytes / 1024 / 1024,
    },
    options: {
      runs: options.runs,
      warmups: options.warmups,
      runtimes: options.runtimes,
    },
    results,
  };
  report.comparisons = createRuntimeComparisons(results);

  mkdirSync(dirname(options.jsonOut), { recursive: true });
  writeFileSync(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(options.mdOut, createMarkdown(report), 'utf8');
  console.log(`Wrote ${options.jsonOut}`);
  console.log(`Wrote ${options.mdOut}`);
}

void main();
