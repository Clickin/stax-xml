import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventReaderSync, XmlEventType } from 'stax-xml';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = fileURLToPath(import.meta.url);
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'event-reader-string-large.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'event-reader-string-large.md');
const externalBaselinePath = resolve(__dirname, 'results', 'release', 'external-baseline.json');
const packageVersion = JSON.parse(readFileSync(resolve(__dirname, '../stax-xml/package.json'), 'utf8')).version;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { ignoreBOM: true });

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    childRun: false,
    sizesMiB: [1024],
    runs: 1,
    warmups: 0,
    fixtureShape: 'diverse-cycle',
    diverseCycleSize: 4096,
    sampleEveryEvents: 250_000,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    if (arg === '--child-run') {
      options.childRun = true;
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
      case '--size-mib':
        options.sizesMiB = [parsePositiveNumber(readValue(), '--size-mib')];
        break;
      case '--sizes-mib':
        options.sizesMiB = readValue().split(',').map((value) => parsePositiveNumber(value.trim(), '--sizes-mib'));
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), '--runs');
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), '--warmups');
        break;
      case '--fixture-shape':
        options.fixtureShape = readValue();
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), '--diverse-cycle-size');
        break;
      case '--sample-every-events':
        options.sampleEveryEvents = parsePositiveInteger(readValue(), '--sample-every-events');
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

  if (!['repeated-person', 'diverse-cycle'].includes(options.fixtureShape)) {
    throw new Error('--fixture-shape must be one of repeated-person, diverse-cycle.');
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

function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${flag} must be a non-negative integer.`);
  return parsed;
}

function main() {
  const options = parseArgs();
  if (options.childRun) {
    const result = runMeasuredChild(options);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  const rows = options.sizesMiB.map((sizeMiB) => runChild(sizeMiB, options));
  const report = createReport(options, rows);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function runChild(sizeMiB, options) {
  const args = [
    '--expose-gc',
    scriptPath,
    '--child-run',
    `--size-mib=${sizeMiB}`,
    `--runs=${options.runs}`,
    `--warmups=${options.warmups}`,
    `--fixture-shape=${options.fixtureShape}`,
    `--diverse-cycle-size=${options.diverseCycleSize}`,
    `--sample-every-events=${options.sampleEveryEvents}`,
  ];
  const child = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 16 * MIB,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (child.status !== 0) {
    return {
      status: 'process-failed',
      sizeMiB,
      exitCode: child.status,
      signal: child.signal,
      stdoutTail: tail(child.stdout),
      stderrTail: tail(child.stderr),
    };
  }

  try {
    return JSON.parse(child.stdout);
  } catch (error) {
    return {
      status: 'invalid-output',
      sizeMiB,
      error: error instanceof Error ? error.message : String(error),
      stdoutTail: tail(child.stdout),
      stderrTail: tail(child.stderr),
    };
  }
}

function runMeasuredChild(options) {
  const sizeMiB = options.sizesMiB[0];
  const targetBytes = Math.floor(sizeMiB * MIB);
  const rows = createFixtureRows(options.fixtureShape, options.diverseCycleSize);
  const rowStats = summarizeRows(rows);

  try {
    globalThis.gc?.();
    const beforeGenerate = takeMemorySnapshot();
    const generationStartedAt = performance.now();
    const fixture = createXmlString(targetBytes, rows);
    const generationMs = performance.now() - generationStartedAt;
    const afterGenerate = takeMemorySnapshot();

    for (let index = 0; index < options.warmups; index++) {
      consumeEventReaderObject(fixture.xml, options.sampleEveryEvents);
    }

    const samplesMs = [];
    const memorySamples = [];
    let first;
    let peak = createPeakTracker(afterGenerate);
    for (let index = 0; index < options.runs; index++) {
      globalThis.gc?.();
      const beforeParse = takeMemorySnapshot();
      peak = createPeakTracker(beforeParse);
      const startedAt = performance.now();
      const result = consumeEventReaderObject(fixture.xml, options.sampleEveryEvents, peak);
      const elapsedMs = performance.now() - startedAt;
      const afterParse = takeMemorySnapshot();
      updatePeak(peak, afterParse);
      if (first && (result.eventCount !== first.eventCount || result.checksum !== first.checksum)) {
        throw new Error('EventReaderSync produced unstable event count or checksum.');
      }
      first ??= result;
      samplesMs.push(elapsedMs);
      memorySamples.push(createMemorySample(beforeParse, afterParse));
    }

    const avgMs = average(samplesMs);
    return {
      status: 'ok',
      sizeMiB,
      fixture: {
        generated: true,
        shape: options.fixtureShape,
        rowCycleSize: rows.length,
        minRowBytes: rowStats.minRowBytes,
        maxRowBytes: rowStats.maxRowBytes,
        averageRowBytes: rowStats.averageRowBytes,
        targetBytes,
        actualUtf8Bytes: fixture.actualUtf8Bytes,
        sizeGiB: fixture.actualUtf8Bytes / GIB,
        stringCodeUnits: fixture.xml.length,
        estimatedUtf16Bytes: fixture.xml.length * 2,
      },
      generation: {
        ms: generationMs,
        before: beforeGenerate,
        after: afterGenerate,
        delta: createMemoryDelta(beforeGenerate, afterGenerate),
      },
      avgMs,
      minMs: Math.min(...samplesMs),
      maxMs: Math.max(...samplesMs),
      mibPerSec: (fixture.actualUtf8Bytes / MIB) / (avgMs / 1000),
      eventCount: first.eventCount,
      checksum: first.checksum,
      samplesMs,
      memory: {
        ...summarizeMemorySamples(memorySamples),
        peakRssBytes: peak.maxRssBytes,
        peakHeapUsedBytes: peak.maxHeapUsedBytes,
        peakHeapTotalBytes: peak.maxHeapTotalBytes,
      },
      materializationCounters: first.materializationCounters,
    };
  } catch (error) {
    return {
      status: 'error',
      sizeMiB,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
  }
}

function createReport(options, rows) {
  return {
    generatedAt: new Date().toISOString(),
    objective: 'event-reader-string-large',
    contract: 'event-reader-sync-string-input-full-object-materialization',
    note: 'This measures EventReaderSync over a complete XML string. It is a reference/object path, not the bounded byte-batch StreamReaderSync target.',
    packageVersion,
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
      v8: process.versions.v8,
    },
    options: {
      sizesMiB: options.sizesMiB,
      runs: options.runs,
      warmups: options.warmups,
      fixtureShape: options.fixtureShape,
      diverseCycleSize: options.diverseCycleSize,
      sampleEveryEvents: options.sampleEveryEvents,
    },
    woodstoxTarget: readWoodstoxTarget(),
    rows,
    findings: createFindings(rows),
  };
}

function readWoodstoxTarget() {
  if (!existsSync(externalBaselinePath)) {
    return {
      status: 'missing',
      path: externalBaselinePath,
      baselineTool: 'woodstox',
      goalRatio: 0.9,
      targetThroughputMiB: null,
      woodstoxMiBPerSec: null,
    };
  }
  const report = JSON.parse(readFileSync(externalBaselinePath, 'utf8'));
  const woodstox = report.results?.find((entry) => entry.tool === 'woodstox');
  return {
    status: 'ok',
    path: externalBaselinePath,
    baselineTool: report.target?.baselineTool ?? 'woodstox',
    goalRatio: report.target?.goalRatio ?? 0.9,
    targetThroughputMiB: report.target?.targetThroughputMiB ?? null,
    woodstoxMiBPerSec: woodstox?.mibPerSec ?? null,
  };
}

function createFindings(rows) {
  const successful = rows.filter((entry) => entry.status === 'ok');
  const failed = rows.filter((entry) => entry.status !== 'ok');
  const largest = maxBy(successful, (entry) => entry.fixture.actualUtf8Bytes);
  return [
    {
      id: 'string-input-boundary',
      summary: 'EventReaderSync requires a complete XML string before parsing, so input memory is part of the measured boundary.',
      evidence: successful.map((entry) => `${formatBytes(entry.fixture.actualUtf8Bytes)} input, estimated UTF-16=${formatBytes(entry.fixture.estimatedUtf16Bytes)}`),
    },
    {
      id: 'event-object-materialization',
      summary: 'Rows materialize public event objects and attribute objects/maps while folding the full checksum contract.',
      evidence: successful.map((entry) => `${formatBytes(entry.fixture.actualUtf8Bytes)}: events=${entry.eventCount}, objects=${entry.materializationCounters.eventObjects}`),
    },
    {
      id: 'largest-successful-row',
      summary: largest
        ? 'Largest successful row is evidence for the EventReaderSync string-input reference path only.'
        : 'No successful rows were recorded.',
      evidence: largest
        ? [
          `size=${formatBytes(largest.fixture.actualUtf8Bytes)}`,
          `throughput=${formatRate(largest.mibPerSec)}`,
          `peakRSS=${formatBytes(largest.memory.peakRssBytes)}`,
          `checksum=${largest.checksum}`,
        ]
        : [],
    },
    {
      id: 'failed-rows',
      summary: failed.length > 0 ? 'At least one size failed in the isolated child process.' : 'No isolated child-process failures were recorded.',
      evidence: failed.map((entry) => `${entry.sizeMiB} MiB: status=${entry.status}`),
    },
  ];
}

function consumeEventReaderObject(xml, sampleEveryEvents, peak = createPeakTracker(takeMemorySnapshot())) {
  const materializationCounters = createMaterializationCounters();
  let eventCount = 0;
  let checksum = 0;

  for (const event of new EventReaderSync(xml)) {
    const typeCode = publicEventTypeCode(event.type);
    materializationCounters.eventObjects++;
    eventCount++;
    checksum = mixChecksum(checksum, typeCode);

    if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
      countStringField(materializationCounters, 'name');
      checksum = foldString(checksum, event.name);
    }
    if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
      countStringField(materializationCounters, 'text');
      checksum = foldString(checksum, event.value?.trim());
    }
    if (event.type === XmlEventType.START_ELEMENT) {
      const entries = Object.entries(event.attributes);
      materializationCounters.attributePairs += entries.length;
      checksum = mixChecksum(checksum, entries.length);
      for (const [name, value] of entries) {
        countStringField(materializationCounters, 'attrName');
        checksum = foldString(checksum, name);
        countStringField(materializationCounters, 'attrValue');
        checksum = foldString(checksum, value);
      }
    }
    if (eventCount % sampleEveryEvents === 0) {
      updatePeak(peak, takeMemorySnapshot());
    }
  }

  return { eventCount, checksum, materializationCounters };
}

function createXmlString(targetBytes, rows) {
  const cycleUtf8Bytes = rows.reduce((sum, row) => sum + row.utf8Bytes, 0);
  const cycleString = rows.map((row) => row.xml).join('');
  const fullCycles = Math.floor(targetBytes / cycleUtf8Bytes);
  const parts = [];
  let actualUtf8Bytes = 0;
  if (fullCycles > 0) {
    parts.push(cycleString.repeat(fullCycles));
    actualUtf8Bytes += cycleUtf8Bytes * fullCycles;
  }
  let rowIndex = 0;
  while (actualUtf8Bytes < targetBytes) {
    const row = rows[rowIndex % rows.length];
    parts.push(row.xml);
    actualUtf8Bytes += row.utf8Bytes;
    rowIndex++;
  }
  return {
    xml: parts.join(''),
    actualUtf8Bytes,
  };
}

function createFixtureRows(shape, cycleSize) {
  if (shape === 'repeated-person') {
    return [createFixtureRow(makeRepeatedPersonRow())];
  }
  return Array.from({ length: cycleSize }, (_, id) => createFixtureRow(makeDiverseRow(id)));
}

function createFixtureRow(xml) {
  const bytes = textEncoder.encode(xml);
  return {
    xml,
    utf8Bytes: bytes.byteLength,
  };
}

function makeRepeatedPersonRow() {
  return '<person id="123"><name>Jane Doe</name><age>42</age></person>';
}

function makeDiverseRow(id) {
  const rootNames = ['person', 'record', 'entry', 'invoice', 'profile', 'asset', 'sample'];
  const childNames = ['name', 'title', 'summary', 'note', 'group', 'bucket', 'payload'];
  const rootName = `${rootNames[id % rootNames.length]}${id % 257}`;
  const childA = `${childNames[id % childNames.length]}${(id * 3) % 193}`;
  const childB = `${childNames[(id + 2) % childNames.length]}${(id * 5) % 197}`;
  const childC = `${childNames[(id + 4) % childNames.length]}${(id * 7) % 199}`;
  const attrA = `data${id % 997}`;
  const attrB = `code${(id * 11) % 991}`;
  const attrC = `flag${(id * 17) % 983}`;
  const utf8Text = id % 11 === 0
    ? ` ${String.fromCodePoint(0x2603)}-${id}-${String.fromCodePoint(0x1f642)}`
    : '';

  return `<${rootName} id="item-${id}" ${attrA}="value-${(id * 31) % 65521}" ${attrB}="group-${id % 4093}" ${attrC}="${id % 2 === 0 ? 'true' : 'false'}">`
    + `<${childA}>Runtime Benchmark ${id}${utf8Text}</${childA}>`
    + `<${childB} rank="${id % 29}">Full string checksum payload ${(id * 8191) % 104729}</${childB}>`
    + `<${childC} shard="${id % 37}" bucket="${(id * 19) % 389}">Text ${id} ${(id * id) % 99991}</${childC}>`
    + `</${rootName}>`;
}

function summarizeRows(rowList) {
  const rowBytes = rowList.map((entry) => entry.utf8Bytes);
  return {
    minRowBytes: Math.min(...rowBytes),
    maxRowBytes: Math.max(...rowBytes),
    averageRowBytes: average(rowBytes),
  };
}

function createMaterializationCounters() {
  return {
    stringFieldReads: 0,
    nameStringReads: 0,
    textStringReads: 0,
    attrNameStringReads: 0,
    attrValueStringReads: 0,
    eventObjects: 0,
    attributePairs: 0,
  };
}

function countStringField(counters, kind) {
  counters.stringFieldReads++;
  switch (kind) {
    case 'name':
      counters.nameStringReads++;
      break;
    case 'text':
      counters.textStringReads++;
      break;
    case 'attrName':
      counters.attrNameStringReads++;
      break;
    case 'attrValue':
      counters.attrValueStringReads++;
      break;
    default:
      throw new Error(`Unknown string field kind: ${kind}`);
  }
}

function publicEventTypeCode(type) {
  switch (type) {
    case XmlEventType.START_DOCUMENT:
      return 0;
    case XmlEventType.END_DOCUMENT:
      return 1;
    case XmlEventType.START_ELEMENT:
      return 2;
    case XmlEventType.END_ELEMENT:
      return 3;
    case XmlEventType.CHARACTERS:
      return 4;
    case XmlEventType.CDATA:
      return 5;
    default:
      return 6;
  }
}

function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function foldString(seed, value) {
  if (!value) {
    return seed;
  }
  let next = seed;
  for (let index = 0; index < value.length; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}

function takeMemorySnapshot() {
  const usage = process.memoryUsage();
  return {
    rssBytes: usage.rss,
    heapTotalBytes: usage.heapTotal,
    heapUsedBytes: usage.heapUsed,
    externalBytes: usage.external,
    arrayBuffersBytes: usage.arrayBuffers,
  };
}

function createMemorySample(before, after) {
  return {
    before,
    after,
    delta: createMemoryDelta(before, after),
  };
}

function createMemoryDelta(before, after) {
  return {
    rssBytes: after.rssBytes - before.rssBytes,
    heapTotalBytes: after.heapTotalBytes - before.heapTotalBytes,
    heapUsedBytes: after.heapUsedBytes - before.heapUsedBytes,
    externalBytes: after.externalBytes - before.externalBytes,
    arrayBuffersBytes: after.arrayBuffersBytes - before.arrayBuffersBytes,
  };
}

function summarizeMemorySamples(samples) {
  return {
    avgHeapUsedDeltaBytes: average(samples.map((sample) => sample.delta.heapUsedBytes)),
    avgHeapTotalDeltaBytes: average(samples.map((sample) => sample.delta.heapTotalBytes)),
    avgRssDeltaBytes: average(samples.map((sample) => sample.delta.rssBytes)),
    avgExternalDeltaBytes: average(samples.map((sample) => sample.delta.externalBytes)),
    avgArrayBuffersDeltaBytes: average(samples.map((sample) => sample.delta.arrayBuffersBytes)),
    maxHeapUsedBytes: Math.max(...samples.flatMap((sample) => [sample.before.heapUsedBytes, sample.after.heapUsedBytes])),
    maxHeapTotalBytes: Math.max(...samples.flatMap((sample) => [sample.before.heapTotalBytes, sample.after.heapTotalBytes])),
    maxRssBytes: Math.max(...samples.flatMap((sample) => [sample.before.rssBytes, sample.after.rssBytes])),
    samples,
  };
}

function createPeakTracker(initial) {
  return {
    maxRssBytes: initial.rssBytes,
    maxHeapUsedBytes: initial.heapUsedBytes,
    maxHeapTotalBytes: initial.heapTotalBytes,
  };
}

function updatePeak(peak, snapshot) {
  peak.maxRssBytes = Math.max(peak.maxRssBytes, snapshot.rssBytes);
  peak.maxHeapUsedBytes = Math.max(peak.maxHeapUsedBytes, snapshot.heapUsedBytes);
  peak.maxHeapTotalBytes = Math.max(peak.maxHeapTotalBytes, snapshot.heapTotalBytes);
}

function renderMarkdown(report) {
  const lines = [
    '# EventReaderSync String-Input Large Benchmark',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This experiment measures `EventReaderSync` over a complete XML string.',
    'It is a reference object path for string-input memory behavior, not the bounded byte-batch `StreamReaderSync` target.',
    'Rows run in isolated child processes so a large-string failure can be recorded without losing the report.',
    '',
    '## Environment',
    '',
    `- Package: stax-xml ${report.packageVersion}`,
    `- Runtime: ${report.environment.node}, V8 ${report.environment.v8}`,
    `- Fixture shape: ${report.options.fixtureShape}`,
    `- Row cycle size: ${report.options.diverseCycleSize}`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    '',
    '## Woodstox Target',
    '',
    ...renderWoodstoxTarget(report.woodstoxTarget),
    '',
    '## Results',
    '',
    '| Size | Status | Throughput | Average | Events | Checksum | Event objects | String fields | Peak RSS | Peak heap used | Estimated UTF-16 input |',
    '| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const row of report.rows) {
    if (row.status !== 'ok') {
      lines.push(`| ${row.sizeMiB} MiB | ${row.status} | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |`);
      continue;
    }
    lines.push(
      `| ${formatBytes(row.fixture.actualUtf8Bytes)} | ok | ${formatRate(row.mibPerSec)} | ${formatMs(row.avgMs)} | `
      + `${formatCount(row.eventCount)} | ${row.checksum} | ${formatCount(row.materializationCounters.eventObjects)} | `
      + `${formatCount(row.materializationCounters.stringFieldReads)} | ${formatBytes(row.memory.peakRssBytes)} | `
      + `${formatBytes(row.memory.peakHeapUsedBytes)} | ${formatBytes(row.fixture.estimatedUtf16Bytes)} |`,
    );
  }

  lines.push('');
  lines.push('## Generation Memory');
  lines.push('');
  lines.push('| Size | Generation time | Heap delta | RSS delta | Heap after generation | RSS after generation |');
  lines.push('| ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const row of report.rows.filter((entry) => entry.status === 'ok')) {
    lines.push(
      `| ${formatBytes(row.fixture.actualUtf8Bytes)} | ${formatMs(row.generation.ms)} | `
      + `${formatSignedBytes(row.generation.delta.heapUsedBytes)} | ${formatSignedBytes(row.generation.delta.rssBytes)} | `
      + `${formatBytes(row.generation.after.heapUsedBytes)} | ${formatBytes(row.generation.after.rssBytes)} |`,
    );
  }

  lines.push('');
  lines.push('## Parse Memory');
  lines.push('');
  lines.push('| Size | Avg heap delta | Avg RSS delta | Max endpoint heap | Max endpoint RSS | Peak sampled heap | Peak sampled RSS |');
  lines.push('| ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const row of report.rows.filter((entry) => entry.status === 'ok')) {
    lines.push(
      `| ${formatBytes(row.fixture.actualUtf8Bytes)} | ${formatSignedBytes(row.memory.avgHeapUsedDeltaBytes)} | `
      + `${formatSignedBytes(row.memory.avgRssDeltaBytes)} | ${formatBytes(row.memory.maxHeapUsedBytes)} | `
      + `${formatBytes(row.memory.maxRssBytes)} | ${formatBytes(row.memory.peakHeapUsedBytes)} | `
      + `${formatBytes(row.memory.peakRssBytes)} |`,
    );
  }

  lines.push('');
  lines.push('## Materialization Counters');
  lines.push('');
  lines.push('| Size | Names | Text | Attr names | Attr values | Attribute pairs |');
  lines.push('| ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const row of report.rows.filter((entry) => entry.status === 'ok')) {
    const counters = row.materializationCounters;
    lines.push(
      `| ${formatBytes(row.fixture.actualUtf8Bytes)} | ${formatCount(counters.nameStringReads)} | `
      + `${formatCount(counters.textStringReads)} | ${formatCount(counters.attrNameStringReads)} | `
      + `${formatCount(counters.attrValueStringReads)} | ${formatCount(counters.attributePairs)} |`,
    );
  }

  const failedRows = report.rows.filter((entry) => entry.status !== 'ok');
  if (failedRows.length > 0) {
    lines.push('');
    lines.push('## Failures');
    lines.push('');
    for (const row of failedRows) {
      lines.push(`- ${row.sizeMiB} MiB: ${row.status}`);
      if (row.stderrTail) {
        lines.push(`  - stderr tail: ${row.stderrTail.replace(/\r?\n/g, ' ')}`);
      }
      if (row.error) {
        lines.push(`  - error: ${row.error}`);
      }
    }
  }

  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id}: ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function renderWoodstoxTarget(target) {
  if (target.status !== 'ok') {
    return [
      `- Status: ${target.status}`,
      `- External baseline path: ${target.path}`,
      '- Woodstox throughput: unavailable',
      '- 0.9x target: unavailable',
    ];
  }
  return [
    `- Baseline tool: ${target.baselineTool}`,
    `- Woodstox throughput: ${formatOptionalRate(target.woodstoxMiBPerSec)}`,
    `- Goal ratio: ${target.goalRatio.toFixed(2)}x`,
    `- 0.9x target throughput: ${formatOptionalRate(target.targetThroughputMiB)}`,
  ];
}

function printSummary(report) {
  console.log('EventReaderSync string-input large benchmark');
  for (const row of report.rows) {
    if (row.status !== 'ok') {
      console.log(`${String(row.sizeMiB).padStart(8)} MiB status=${row.status}`);
      continue;
    }
    console.log(
      `${formatBytes(row.fixture.actualUtf8Bytes).padStart(10)} ${formatRate(row.mibPerSec).padStart(14)} `
      + `peakRSS=${formatBytes(row.memory.peakRssBytes)} events=${row.eventCount} checksum=${row.checksum}`,
    );
  }
}

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
  console.log(`Wrote ${resolved}`);
}

function maxBy(values, selector) {
  let selected;
  for (const value of values) {
    if (!selected || selector(value) > selector(selected)) {
      selected = value;
    }
  }
  return selected;
}

function tail(value, maxLength = 4000) {
  if (!value) return '';
  return value.length > maxLength ? value.slice(value.length - maxLength) : value;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatRate(value) {
  return `${value.toFixed(2)} MiB/s`;
}

function formatOptionalRate(value) {
  return value == null ? 'n/a' : formatRate(value);
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`;
}

function formatCount(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatBytes(value) {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= GIB) return `${sign}${(abs / GIB).toFixed(2)} GiB`;
  if (abs >= MIB) return `${sign}${(abs / MIB).toFixed(1)} MiB`;
  if (abs >= 1024) return `${sign}${(abs / 1024).toFixed(1)} KiB`;
  return `${sign}${abs.toFixed(0)} B`;
}

function formatSignedBytes(value) {
  if (value === 0) return '0 B';
  return `${value > 0 ? '+' : ''}${formatBytes(value)}`;
}

main();
