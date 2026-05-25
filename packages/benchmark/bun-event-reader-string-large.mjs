import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventReaderSync, XmlEventType } from '../stax-xml/dist/index.js';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = fileURLToPath(import.meta.url);
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'bun-event-reader-string-large.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'bun-event-reader-string-large.md');
const defaultStringLimitPath = resolve(__dirname, 'results', 'release', 'bun-jsc-string-limit-audit.json');
const packageVersion = JSON.parse(readFileSync(resolve(__dirname, '../stax-xml/package.json'), 'utf8')).version;
const textEncoder = new TextEncoder();

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    childRun: false,
    sizesMiB: [1024],
    runs: 1,
    warmups: 0,
    fixtureShape: 'diverse-cycle',
    diverseCycleSize: 4096,
    sampleEveryEvents: 250_000,
    boundedRssMiB: 512,
    timeoutMs: 10 * 60 * 1000,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    stringLimitPath: defaultStringLimitPath,
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
      case '--bounded-rss-mib':
        options.boundedRssMiB = parsePositiveNumber(readValue(), '--bounded-rss-mib');
        break;
      case '--timeout-ms':
        options.timeoutMs = parsePositiveInteger(readValue(), '--timeout-ms');
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      case '--string-limit-path':
        options.stringLimitPath = resolve(process.cwd(), readValue());
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

  const runtime = readBunRuntime();
  const rows = options.sizesMiB.map((sizeMiB) => runChild(sizeMiB, options));
  const report = createReport(options, runtime, rows);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function readBunRuntime() {
  const revisionResult = spawnSync('bun', ['--revision'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: MIB,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (revisionResult.status !== 0) {
    throw new Error(`bun revision probe failed: ${revisionResult.stderr || revisionResult.stdout}`);
  }

  const result = spawnSync('bun', ['-e', "console.log(JSON.stringify({bunVersion:process.versions.bun, versions:process.versions, userAgent:typeof navigator !== 'undefined' ? navigator.userAgent : null}))"], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: MIB,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`bun runtime probe failed: ${result.stderr || result.stdout}`);
  }
  const parsed = JSON.parse(result.stdout);
  return {
    bunVersion: parsed.bunVersion,
    bunRevision: revisionResult.stdout.trim(),
    webkitCommit: parsed.versions.webkit,
    userAgent: parsed.userAgent,
    processVersions: parsed.versions,
  };
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
  const child = spawnSync('bun', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 16 * MIB,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeoutMs,
  });

  if (child.error) {
    return {
      status: child.error.code === 'ETIMEDOUT' ? 'process-timeout' : 'process-error',
      runner: 'bun-child',
      sizeMiB,
      error: child.error.message,
      stdoutTail: tail(child.stdout),
      stderrTail: tail(child.stderr),
    };
  }

  if (child.status !== 0) {
    return {
      status: 'process-failed',
      runner: 'bun-child',
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
      runner: 'bun-child',
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
        throw new Error('Bun EventReaderSync produced unstable event count or checksum.');
      }
      first ??= result;
      samplesMs.push(elapsedMs);
      memorySamples.push(createMemorySample(beforeParse, afterParse));
    }

    const avgMs = average(samplesMs);
    return {
      status: 'ok',
      runner: 'bun-child',
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
      fullStringParity: true,
      boundedMemory: peak.maxRssBytes <= options.boundedRssMiB * MIB,
      sourceMode: 'complete-js-string',
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
      runner: 'bun-child',
      sizeMiB,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
  }
}

function createReport(options, runtime, rows) {
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'bun-event-reader-string-large',
    contract: 'bun-event-reader-sync-string-input-full-object-materialization',
    note: 'This measures EventReaderSync public event-object materialization over a complete XML string in Bun/JSC. It is not a byte-batch runtime ceiling.',
    packageVersion,
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      nodeParent: process.version,
    },
    runtime,
    options: {
      sizesMiB: options.sizesMiB,
      runs: options.runs,
      warmups: options.warmups,
      fixtureShape: options.fixtureShape,
      diverseCycleSize: options.diverseCycleSize,
      sampleEveryEvents: options.sampleEveryEvents,
      boundedRssMiB: options.boundedRssMiB,
      timeoutMs: options.timeoutMs,
      stringLimitPath: options.stringLimitPath,
    },
    relatedStringLimitAudit: loadStringLimitAudit(options.stringLimitPath),
    rows,
  };
  report.findings = createFindings(report);
  return report;
}

function loadStringLimitAudit(stringLimitPath) {
  if (!existsSync(stringLimitPath)) {
    return {
      status: 'missing',
      path: stringLimitPath,
    };
  }

  const report = JSON.parse(readFileSync(stringLimitPath, 'utf8'));
  const projection1024 = report.fixtureProjections?.find((entry) => entry.sizeMiB === 1024);
  return {
    status: 'ok',
    path: stringLimitPath,
    objective: report.objective,
    contract: report.contract,
    jscMaxStringLength: report.jscMaxStringLength,
    projection1024: projection1024
      ? {
        stringCodeUnits: projection1024.stringCodeUnits,
        exceedsJscMaxStringLength: projection1024.exceedsJscMaxStringLength,
        jscCodeUnitHeadroom: projection1024.jscCodeUnitHeadroom,
      }
      : null,
  };
}

function createFindings(report) {
  const successful = report.rows.filter((entry) => entry.status === 'ok');
  const failed = report.rows.filter((entry) => entry.status !== 'ok');
  const largest = maxBy(successful, (entry) => entry.fixture.actualUtf8Bytes);
  const oneGiB = report.rows.find((entry) => entry.sizeMiB === 1024);
  return [
    {
      id: 'bun-complete-string-parse-row',
      summary: 'Bun/JSC rows measure the same EventReaderSync complete-string public event-object path, not a projected or byte-batch path.',
      evidence: successful.map((entry) => `${formatBytes(entry.fixture.actualUtf8Bytes)}: ${formatRate(entry.mibPerSec)}, bounded=${entry.boundedMemory ? 'yes' : 'no'}, peakRSS=${formatBytes(entry.memory.peakRssBytes)}, events=${formatCount(entry.eventCount)}`),
    },
    {
      id: 'public-event-object-materialization',
      summary: 'Successful rows materialize public event objects and attribute object entries while folding the full checksum contract.',
      evidence: successful.map((entry) => `${formatBytes(entry.fixture.actualUtf8Bytes)}: eventObjects=${formatCount(entry.materializationCounters.eventObjects)}, stringFields=${formatCount(entry.materializationCounters.stringFieldReads)}`),
    },
    {
      id: 'largest-successful-row',
      summary: largest
        ? 'Largest successful Bun row is evidence for the complete-string EventReaderSync reference path only.'
        : 'No successful Bun complete-string row was recorded.',
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
      id: 'one-gib-status',
      summary: oneGiB
        ? `The configured 1 GiB Bun complete-string row ended with status ${oneGiB.status}.`
        : 'No configured 1 GiB Bun complete-string row was requested in this report.',
      evidence: oneGiB
        ? oneGiB.status === 'ok'
          ? [`throughput=${formatRate(oneGiB.mibPerSec)}`, `peakRSS=${formatBytes(oneGiB.memory.peakRssBytes)}`, `checksum=${oneGiB.checksum}`]
          : [`status=${oneGiB.status}`, oneGiB.error ? `error=${oneGiB.error}` : null, oneGiB.stderrTail ? `stderr=${oneGiB.stderrTail}` : null].filter(Boolean)
        : [],
    },
    {
      id: 'failed-rows',
      summary: failed.length > 0 ? 'At least one Bun child row failed or timed out.' : 'No Bun child-process failures were recorded.',
      evidence: failed.map((entry) => `${entry.sizeMiB} MiB: status=${entry.status}`),
    },
    {
      id: 'not-byte-batch-ceiling',
      summary: 'This report cannot prove a byte-batch runtime ceiling because complete-string input construction and public object materialization are in scope.',
      evidence: [
        'Use candidate-headroom-large or stream-reader large rows for bounded byte-batch claims.',
        `related string-limit audit status=${report.relatedStringLimitAudit.status}`,
      ],
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
    '# Bun EventReaderSync String-Input Large Benchmark',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This experiment measures `EventReaderSync` over a complete XML string in Bun/JSC.',
    'It folds the full checksum through public event objects and attribute entries.',
    'It is not a byte-batch runtime ceiling and not a proof that bounded-memory streaming is impossible.',
    '',
    '## Environment',
    '',
    `- Package: stax-xml ${report.packageVersion}`,
    `- Runtime: Bun ${report.runtime.bunVersion} (${report.runtime.bunRevision})`,
    `- WebKit commit: ${report.runtime.webkitCommit}`,
    `- Parent runtime: ${report.environment.nodeParent}`,
    `- Fixture shape: ${report.options.fixtureShape}`,
    `- Row cycle size: ${report.options.diverseCycleSize}`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    `- Bounded RSS gate: ${formatBytes(report.options.boundedRssMiB * MIB)}`,
    `- Child timeout: ${report.options.timeoutMs} ms`,
    '',
    '## Related String-Limit Audit',
    '',
    ...renderRelatedStringLimitAudit(report.relatedStringLimitAudit),
    '',
    '## Results',
    '',
    '| Size | Status | Throughput | Average | Bounded memory | Events | Checksum | Event objects | String fields | Peak RSS | Peak heap used | Estimated UTF-16 input |',
    '| ---: | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const row of report.rows) {
    if (row.status !== 'ok') {
      lines.push(`| ${row.sizeMiB} MiB | ${row.status} | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |`);
      continue;
    }
    lines.push(
      `| ${formatBytes(row.fixture.actualUtf8Bytes)} | ok | ${formatRate(row.mibPerSec)} | ${formatMs(row.avgMs)} | `
      + `${row.boundedMemory ? 'yes' : 'no'} | ${formatCount(row.eventCount)} | ${row.checksum} | ${formatCount(row.materializationCounters.eventObjects)} | `
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
  lines.push('| Size | Avg heap delta | Avg RSS delta | Max heap used | Max RSS |');
  lines.push('| ---: | ---: | ---: | ---: | ---: |');
  for (const row of report.rows.filter((entry) => entry.status === 'ok')) {
    lines.push(
      `| ${formatBytes(row.fixture.actualUtf8Bytes)} | ${formatSignedBytes(row.memory.avgHeapUsedDeltaBytes)} | `
      + `${formatSignedBytes(row.memory.avgRssDeltaBytes)} | ${formatBytes(row.memory.maxHeapUsedBytes)} | ${formatBytes(row.memory.maxRssBytes)} |`,
    );
  }

  lines.push('');
  lines.push('## Failed Rows');
  lines.push('');
  const failedRows = report.rows.filter((entry) => entry.status !== 'ok');
  if (failedRows.length === 0) {
    lines.push('- None.');
  } else {
    for (const row of failedRows) {
      lines.push(`- ${row.sizeMiB} MiB: ${row.status}${row.error ? ` (${row.error})` : ''}`);
      if (row.stderrTail) {
        lines.push(`  - stderr tail: \`${row.stderrTail.replaceAll('`', "'")}\``);
      }
    }
  }

  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- \`${finding.id}\`: ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function renderRelatedStringLimitAudit(entry) {
  if (entry.status !== 'ok') {
    return [`- Status: ${entry.status}`, `- Path: ${entry.path}`];
  }
  const lines = [
    `- Audit: ${entry.objective}`,
    `- JSC max string length: ${formatCount(entry.jscMaxStringLength.value)} ${entry.jscMaxStringLength.units}`,
  ];
  if (entry.projection1024) {
    lines.push(`- 1024 MiB projected string length: ${formatCount(entry.projection1024.stringCodeUnits)} code units`);
    lines.push(`- 1024 MiB JSC code-unit headroom: ${formatCount(entry.projection1024.jscCodeUnitHeadroom)}`);
  }
  return lines;
}

function printSummary(report) {
  const largest = maxBy(report.rows.filter((entry) => entry.status === 'ok'), (entry) => entry.fixture.actualUtf8Bytes);
  const failedCount = report.rows.filter((entry) => entry.status !== 'ok').length;
  if (!largest) {
    console.log(`bun-event-reader-string-large: no successful rows, failed=${failedCount}`);
    return;
  }
  console.log(`bun-event-reader-string-large: largest=${formatBytes(largest.fixture.actualUtf8Bytes)}, throughput=${formatRate(largest.mibPerSec)}, peakRSS=${formatBytes(largest.memory.peakRssBytes)}, failed=${failedCount}`);
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxBy(values, score) {
  let best;
  let bestScore = -Infinity;
  for (const value of values) {
    const current = score(value);
    if (current > bestScore) {
      best = value;
      bestScore = current;
    }
  }
  return best;
}

function tail(value, limit = 4000) {
  if (!value) return '';
  return value.length > limit ? value.slice(-limit) : value;
}

function formatRate(value) {
  return `${value.toFixed(2)} MiB/s`;
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`;
}

function formatBytes(value) {
  const abs = Math.abs(value);
  if (abs >= GIB) return `${(value / GIB).toFixed(2)} GiB`;
  if (abs >= MIB) return `${(value / MIB).toFixed(2)} MiB`;
  if (abs >= 1024) return `${(value / 1024).toFixed(2)} KiB`;
  return `${value} B`;
}

function formatSignedBytes(value) {
  return `${value >= 0 ? '+' : ''}${formatBytes(value)}`;
}

function formatCount(value) {
  return Math.round(value).toLocaleString('en-US');
}

main();
