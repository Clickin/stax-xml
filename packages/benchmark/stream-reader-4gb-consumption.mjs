import inspector from 'node:inspector';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { StreamReaderSync, XmlEventType } from 'stax-xml';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageVersion = JSON.parse(
  readFileSync(resolve(__dirname, '../stax-xml/package.json'), 'utf8'),
).version;

const sizeGiB = Number.parseFloat(readOption('--size-gib') ?? '4');
const runs = Number.parseInt(readOption('--runs') ?? '3', 10);
const warmups = Number.parseInt(readOption('--warmups') ?? '0', 10);
const style = readOption('--style') ?? 'iterable-cursor';
const jsonOut = readOption('--json-out');
const mdOut = readOption('--md-out');
const targetBytes = Math.floor(sizeGiB * GIB);
const allocationSampling = readFlag('--allocation-sampling');
const allocationSamplingInterval = Number.parseInt(readOption('--allocation-sampling-interval') ?? `${64 * 1024}`, 10);
const allocationOutputDir = readOption('--allocation-output-dir') ?? 'results/v8-allocation/stream-reader-large-shape';
const fixtureShape = readOption('--fixture-shape') ?? 'repeated-person';
const diverseCycleSize = Number.parseInt(readOption('--diverse-cycle-size') ?? '4096', 10);
const boundedRssMiB = Number.parseFloat(readOption('--bounded-rss-mib') ?? '512');

if (!Number.isInteger(allocationSamplingInterval) || allocationSamplingInterval <= 0) {
  throw new Error('--allocation-sampling-interval must be a positive integer.');
}
if (!Number.isFinite(boundedRssMiB) || boundedRssMiB <= 0) {
  throw new Error('--bounded-rss-mib must be a positive number.');
}
if (!['repeated-person', 'diverse-cycle'].includes(fixtureShape)) {
  throw new Error('--fixture-shape must be one of repeated-person, diverse-cycle.');
}
if (!Number.isInteger(diverseCycleSize) || diverseCycleSize <= 0) {
  throw new Error('--diverse-cycle-size must be a positive integer.');
}

const styleIds = ['iterable-cursor'];
const styleGroups = new Map([
  ['both', ['iterable-cursor']],
  ['shapes', ['iterable-cursor']],
  ['all', styleIds],
]);
const styles = styleGroups.get(style) ?? [style];

for (const candidate of styles) {
  if (!styleIds.includes(candidate)) {
    throw new Error(`Unknown style: ${candidate}`);
  }
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
const rows = createFixtureRows(fixtureShape, diverseCycleSize);
const rowStats = summarizeRows(rows);
const expectedBytes = computeExpectedBytes(targetBytes, rows);

const results = [];

console.log('CursorReader iterable large shape consumption checksum');
console.log(`target=${formatBytes(expectedBytes)}, fixtureShape=${fixtureShape}, rowCycleSize=${rows.length}, rowBytes=${rowStats.minRowBytes}-${rowStats.maxRowBytes}, warmups=${warmups}, runs=${runs}, style=${style}`);
if (allocationSampling) {
  mkdirSync(resolve(process.cwd(), allocationOutputDir), { recursive: true });
  console.log(`allocationSampling=true interval=${allocationSamplingInterval} outputDir=${allocationOutputDir}`);
}

for (const candidate of styles) {
  const measured = await measure(candidate);
  results.push({ style: candidate, ...measured });
  console.log(`${candidate.padEnd(18)} avg=${measured.avgMs.toFixed(2)} ms throughput=${measured.avgMiBs.toFixed(2)} MiB/s min=${measured.minMs.toFixed(2)} ms max=${measured.maxMs.toFixed(2)} ms events=${measured.events} checksum=${measured.checksum} rssDelta=${formatSignedBytes(measured.memory.rssDeltaBytes)} strings=${measured.materialization.stringFieldReads}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  objective: allocationSampling ? 'stream-reader-large-shape-allocation' : 'stream-reader-large-shape',
  contract: allocationSampling ? 'generated-byte-chunk-full-string-allocation-sampling' : 'generated-byte-chunk-full-string',
  packageVersion,
  runtime: {
    id: 'node',
    version: process.versions.node,
    v8: process.versions.v8,
    platform: `${process.platform}-${process.arch}`,
  },
  fixture: {
    generated: true,
    shape: fixtureShape,
    rowXml: textDecoder.decode(rows[0]),
    rowBytes: rows[0].byteLength,
    rowCycleSize: rows.length,
    minRowBytes: rowStats.minRowBytes,
    maxRowBytes: rowStats.maxRowBytes,
    averageRowBytes: rowStats.averageRowBytes,
    targetBytes,
    actualBytes: expectedBytes,
    sizeGiB: expectedBytes / GIB,
  },
  options: {
    warmups,
    runs,
    style,
    boundedRssMiB,
  },
  allocationSampling: {
    enabled: allocationSampling,
    samplingInterval: allocationSamplingInterval,
    rawArtifacts: {
      outputDir: resolve(process.cwd(), allocationOutputDir),
      committed: false,
      profiles: results
        .map((result) => result.allocation?.rawProfilePath)
        .filter(Boolean),
    },
    note: allocationSampling
      ? 'V8 HeapProfiler allocation sampling is statistical self-size evidence and not a deterministic allocation census.'
      : 'Disabled for this run.',
  },
  parity: computeParity(results),
  results,
};

if (jsonOut) {
  writeOutput(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
}
if (mdOut) {
  writeOutput(mdOut, renderMarkdown(report));
}

async function measure(candidate) {
  for (let index = 0; index < warmups; index++) {
    consume(candidate);
  }

  const times = [];
  const memorySamples = [];
  let last;
  globalThis.gc?.();
  const memoryBaseline = takeMemorySnapshot();
  const session = allocationSampling ? new inspector.Session() : null;
  try {
    if (session) {
      session.connect();
      await post(session, 'HeapProfiler.startSampling', { samplingInterval: allocationSamplingInterval });
    }
    for (let index = 0; index < runs; index++) {
      globalThis.gc?.();
      const before = takeMemorySnapshot();
      const start = performance.now();
      last = consume(candidate);
      const elapsed = performance.now() - start;
      const after = takeMemorySnapshot();
      times.push(elapsed);
      memorySamples.push(createMemorySample(before, after));
    }

    let allocation;
    if (session) {
      const { profile } = await post(session, 'HeapProfiler.stopSampling');
      const rawProfilePath = writeAllocationProfile(candidate, profile);
      allocation = {
        ...summarizeProfile(profile),
        rawProfilePath,
      };
    }

    const avgMs = average(times);
    const avgMiBs = (expectedBytes / MIB) / (avgMs / 1000);
    const memory = summarizeMemorySamples(memoryBaseline, memorySamples);
    return {
      ...last,
      avgMs,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      avgMiBs,
      mibPerSec: avgMiBs,
      fullStringParity: true,
      contractScope: 'full-string-materialization',
      sourceMode: 'generated-sync-iterable-byte-chunks',
      boundedMemory: memory.maxRssBytes <= boundedRssMiB * MIB,
      memory,
      allocation,
    };
  } finally {
    session?.disconnect();
  }
}

function post(session, method, params = {}) {
  return new Promise((resolvePromise, reject) => {
    session.post(method, params, (error, result) => {
      if (error) reject(error);
      else resolvePromise(result ?? {});
    });
  });
}

function writeAllocationProfile(candidate, profile) {
  const rawProfilePath = resolve(process.cwd(), allocationOutputDir, `${candidate}.heapprofile.json`);
  mkdirSync(dirname(rawProfilePath), { recursive: true });
  writeFileSync(rawProfilePath, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  return rawProfilePath;
}

function summarizeProfile(profile) {
  const nodes = [];
  collectNodes(profile?.head, nodes);
  const sampledBytes = nodes.reduce((sum, node) => sum + node.selfSize, 0);
  return {
    sampledBytes,
    sampleCount: Array.isArray(profile?.samples) ? profile.samples.length : 0,
    staxXmlSourceBytes: nodes
      .filter(node => /packages[\\/]stax-xml[\\/]/.test(node.url) || /node_modules[\\/]stax-xml[\\/]/.test(node.url))
      .reduce((sum, node) => sum + node.selfSize, 0),
    benchmarkSourceBytes: nodes
      .filter(node => node.url.includes('stream-reader-4gb-consumption.mjs'))
      .reduce((sum, node) => sum + node.selfSize, 0),
    topFrames: nodes
      .filter(node => node.selfSize > 0)
      .sort((a, b) => b.selfSize - a.selfSize)
      .slice(0, 16)
      .map(node => ({
        functionName: node.functionName,
        url: node.url,
        lineNumber: node.lineNumber,
        columnNumber: node.columnNumber,
        selfSize: node.selfSize,
        percent: sampledBytes > 0 ? node.selfSize / sampledBytes : 0,
      })),
  };
}

function collectNodes(node, output) {
  if (!node) return;
  const callFrame = node.callFrame ?? {};
  output.push({
    id: node.id,
    selfSize: Number(node.selfSize ?? 0),
    functionName: callFrame.functionName || '(anonymous)',
    url: callFrame.url || '',
    lineNumber: Number(callFrame.lineNumber ?? -1),
    columnNumber: Number(callFrame.columnNumber ?? -1),
  });
  for (const child of node.children ?? []) {
    collectNodes(child, output);
  }
}

function consume(candidate) {
  switch (candidate) {
    case 'iterable-cursor':
      return consumeIterableCursor();
    default:
      throw new Error(`Unknown style: ${candidate}`);
  }
}

function takeMemorySnapshot() {
  const usage = process.memoryUsage();
  return {
    rssBytes: usage.rss,
    heapUsedBytes: usage.heapUsed,
    heapTotalBytes: usage.heapTotal,
    externalBytes: usage.external,
    arrayBuffersBytes: usage.arrayBuffers,
  };
}

function createMemorySample(before, after) {
  return {
    before,
    after,
    delta: {
      rssBytes: after.rssBytes - before.rssBytes,
      heapUsedBytes: after.heapUsedBytes - before.heapUsedBytes,
      heapTotalBytes: after.heapTotalBytes - before.heapTotalBytes,
      externalBytes: after.externalBytes - before.externalBytes,
      arrayBuffersBytes: after.arrayBuffersBytes - before.arrayBuffersBytes,
    },
  };
}

function summarizeMemorySamples(baseline, samples) {
  const maxRssBytes = Math.max(baseline.rssBytes, ...samples.map((sample) => sample.after.rssBytes));
  return {
    rssBaselineBytes: baseline.rssBytes,
    rssDeltaBytes: maxRssBytes - baseline.rssBytes,
    avgRssDeltaBytes: average(samples.map((sample) => sample.delta.rssBytes)),
    avgHeapUsedDeltaBytes: average(samples.map((sample) => sample.delta.heapUsedBytes)),
    avgHeapTotalDeltaBytes: average(samples.map((sample) => sample.delta.heapTotalBytes)),
    avgExternalDeltaBytes: average(samples.map((sample) => sample.delta.externalBytes)),
    avgArrayBuffersDeltaBytes: average(samples.map((sample) => sample.delta.arrayBuffersBytes)),
    maxRssBytes,
    maxHeapUsedBytes: Math.max(...samples.map((sample) => sample.after.heapUsedBytes)),
    samples,
  };
}

function consumeIterableCursor() {
  const cursor = new StreamReaderSync(byteChunks(), { documentMode: 'fragment' });
  const materialization = createMaterializationStats();
  let events = 0;
  let checksum = 0;

  while (cursor.next()) {
    const type = cursor.eventType();
    events++;
    checksum = mix(checksum, type);
    checksum = foldCursorEvent(cursor, type, checksum, materialization);
  }

  return { events, checksum, materialization };
}

function foldCursorEvent(cursor, type, checksum, materialization) {
  if (type === XmlEventType.START_ELEMENT || type === XmlEventType.END_ELEMENT) {
    countStringField(materialization, 'name');
    checksum = foldString(checksum, cursor.name());
  }
  if (type === XmlEventType.CHARACTERS || type === XmlEventType.CDATA) {
    countStringField(materialization, 'text');
    checksum = foldString(checksum, cursor.text()?.trim());
  }
  if (type === XmlEventType.START_ELEMENT) {
    const attrCount = cursor.attributeCount();
    checksum = mix(checksum, attrCount);
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      countStringField(materialization, 'attrName');
      checksum = foldString(checksum, cursor.attributeName(attrIndex));
      countStringField(materialization, 'attrValue');
      checksum = foldString(checksum, cursor.attributeValue(attrIndex));
    }
  }
  return checksum;
}

function createMaterializationStats() {
  return {
    stringFieldReads: 0,
    nameStringReads: 0,
    textStringReads: 0,
    attrNameStringReads: 0,
    attrValueStringReads: 0,
    rawSpanMaterializations: 0,
    rawNameSpanMaterializations: 0,
    rawTextSpanMaterializations: 0,
    rawAttrNameSpanMaterializations: 0,
    rawAttrValueSpanMaterializations: 0,
    rawNameCacheHits: 0,
    rawNameCacheMisses: 0,
    implicitAttrValueReads: 0,
    eventObjects: 0,
  };
}

function countStringField(stats, kind) {
  stats.stringFieldReads++;
  switch (kind) {
    case 'name':
      stats.nameStringReads++;
      break;
    case 'text':
      stats.textStringReads++;
      break;
    case 'attrName':
      stats.attrNameStringReads++;
      break;
    case 'attrValue':
      stats.attrValueStringReads++;
      break;
    default:
      throw new Error(`Unknown string field kind: ${kind}`);
  }
}

function* byteChunks() {
  let emittedBytes = 0;
  let rowIndex = 0;
  while (emittedBytes < targetBytes) {
    const nextRow = rows[rowIndex % rows.length];
    yield nextRow;
    emittedBytes += nextRow.byteLength;
    rowIndex++;
  }
}

function createFixtureRows(shape, cycleSize) {
  if (shape === 'repeated-person') {
    return [textEncoder.encode(makeRepeatedPersonRow())];
  }
  return Array.from({ length: cycleSize }, (_, id) => textEncoder.encode(makeDiverseRow(id)));
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
  const rowBytes = rowList.map((entry) => entry.byteLength);
  return {
    minRowBytes: Math.min(...rowBytes),
    maxRowBytes: Math.max(...rowBytes),
    averageRowBytes: average(rowBytes),
  };
}

function computeExpectedBytes(target, rowList) {
  const cycleBytes = rowList.reduce((sum, entry) => sum + entry.byteLength, 0);
  let emittedBytes = Math.floor(target / cycleBytes) * cycleBytes;
  let rowIndex = 0;
  while (emittedBytes < target) {
    emittedBytes += rowList[rowIndex % rowList.length].byteLength;
    rowIndex++;
  }
  return emittedBytes;
}

function readOption(name) {
  const prefix = `${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function readFlag(name) {
  return process.argv.includes(name);
}

function computeParity(entries) {
  const first = entries[0];
  const mismatch = entries.find((entry) => entry.events !== first.events || entry.checksum !== first.checksum);
  if (mismatch) {
    throw new Error(`Style ${mismatch.style} does not match ${first.style}.`);
  }
  return {
    status: 'ok',
    events: first.events,
    checksum: first.checksum,
  };
}

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
  console.log(`Wrote ${resolved}`);
}

function renderMarkdown(report) {
  const lines = [
    '# CursorReader Iterable Large Shape Benchmark',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This benchmark uses generated `Uint8Array` chunks and consumes each row without loading a complete XML document string.',
    'It measures the pure JavaScript iterable cursor path and does not use native addons, Wasm modules, or backend selection.',
    'Raw-frame and iterable cursor rows keep the same full-string checksum contract while separating access-shape overhead.',
    '',
    '## Environment',
    '',
    `- Package: stax-xml ${report.packageVersion}`,
    `- Runtime: Node ${report.runtime.version} / V8 ${report.runtime.v8} (${report.runtime.platform})`,
    `- Fixture: generated byte-batch rows, ${formatBytes(report.fixture.actualBytes)}`,
    `- Fixture shape: ${report.fixture.shape}`,
    `- Row cycle size: ${report.fixture.rowCycleSize}`,
    `- Row bytes: min=${report.fixture.minRowBytes}, max=${report.fixture.maxRowBytes}, avg=${report.fixture.averageRowBytes.toFixed(1)}`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    '',
    '## Results',
    '',
    '| Style | Throughput | Average | Min | Max | Events | Checksum | String fields | Raw span materializations |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const result of report.results) {
    lines.push(
      `| ${result.style} | ${result.avgMiBs.toFixed(2)} MiB/s | ${result.avgMs.toFixed(2)} ms | ` +
      `${result.minMs.toFixed(2)} ms | ${result.maxMs.toFixed(2)} ms | ${result.events} | ${result.checksum} | ` +
      `${formatCount(result.materialization.stringFieldReads)} | ${formatCount(result.materialization.rawSpanMaterializations)} |`,
    );
  }

  lines.push('');
  lines.push('## Memory');
  lines.push('');
  lines.push('RSS delta is the maximum measured-run endpoint minus the post-warmup, post-GC baseline in the same process.');
  lines.push('');
  lines.push('| Style | Avg heap delta | RSS delta | Max heap used | Max RSS |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const result of report.results) {
    lines.push(
      `| ${result.style} | ${formatSignedBytes(result.memory.avgHeapUsedDeltaBytes)} | ` +
      `${formatSignedBytes(result.memory.rssDeltaBytes)} | ${formatBytes(result.memory.maxHeapUsedBytes)} | ` +
      `${formatBytes(result.memory.maxRssBytes)} |`,
    );
  }

  lines.push('');
  lines.push('## Materialization Counters');
  lines.push('');
  lines.push('String fields are the names, text values, attribute names, and attribute values consumed by the checksum contract. Raw span materializations are string creations performed by the raw-frame benchmark code rather than by public accessors.');
  lines.push('');
  lines.push('| Style | Names | Text | Attr names | Attr values | Raw name spans | Raw text spans | Raw attr-name spans | Raw attr-value spans | Name cache hit/miss | Implicit attr values | Event objects |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const result of report.results) {
    const stats = result.materialization;
    lines.push(
      `| ${result.style} | ${formatCount(stats.nameStringReads)} | ${formatCount(stats.textStringReads)} | ` +
      `${formatCount(stats.attrNameStringReads)} | ${formatCount(stats.attrValueStringReads)} | ` +
      `${formatCount(stats.rawNameSpanMaterializations)} | ${formatCount(stats.rawTextSpanMaterializations)} | ` +
      `${formatCount(stats.rawAttrNameSpanMaterializations)} | ${formatCount(stats.rawAttrValueSpanMaterializations)} | ` +
      `${formatCount(stats.rawNameCacheHits)}/${formatCount(stats.rawNameCacheMisses)} | ` +
      `${formatCount(stats.implicitAttrValueReads)} | ${formatCount(stats.eventObjects)} |`,
    );
  }

  if (report.allocationSampling.enabled) {
    lines.push('');
    lines.push('## V8 Allocation Sampling');
    lines.push('');
    lines.push('V8 HeapProfiler allocation sampling is statistical self-size evidence and not a deterministic allocation census.');
    lines.push('');
    lines.push(`- Sampling interval: ${report.allocationSampling.samplingInterval} bytes`);
    lines.push(`- Raw output dir: ${report.allocationSampling.rawArtifacts.outputDir}`);
    lines.push(`- Raw artifacts committed: ${report.allocationSampling.rawArtifacts.committed ? 'yes' : 'no'}`);
    lines.push('');
    lines.push('| Style | Sampled bytes | Samples | stax-xml source bytes | Benchmark source bytes |');
    lines.push('| --- | ---: | ---: | ---: | ---: |');
    for (const result of report.results) {
      const allocation = result.allocation;
      lines.push(
        `| ${result.style} | ${formatBytes(allocation.sampledBytes)} | ${allocation.sampleCount} | ` +
        `${formatBytes(allocation.staxXmlSourceBytes)} | ${formatBytes(allocation.benchmarkSourceBytes)} |`,
      );
    }

    lines.push('');
    lines.push('### Top Frames');
    for (const result of report.results) {
      lines.push('');
      lines.push(`#### ${result.style}`);
      lines.push('');
      const allocation = result.allocation;
      if (!allocation.topFrames.length) {
        lines.push('- No sampled allocation frames.');
        continue;
      }
      lines.push('| Function | Self size | Percent | Source |');
      lines.push('| --- | ---: | ---: | --- |');
      for (const frame of allocation.topFrames.slice(0, 8)) {
        lines.push(
          `| ${escapePipe(frame.functionName)} | ${formatBytes(frame.selfSize)} | ` +
          `${(frame.percent * 100).toFixed(1)}% | ${escapePipe(formatFrameSource(frame))} |`,
        );
      }
    }
  }

  lines.push('');
  lines.push('## Parity');
  lines.push('');
  lines.push(`Status: ${report.parity.status}`);
  lines.push(`Events: ${report.parity.events}`);
  lines.push(`Checksum: ${report.parity.checksum}`);
  lines.push('');
  return lines.join('\n');
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatBytes(bytes) {
  const absBytes = Math.abs(bytes);
  let value;
  if (absBytes >= GIB) {
    value = `${(absBytes / GIB).toFixed(2)} GiB`;
  } else if (absBytes >= MIB) {
    value = `${(absBytes / MIB).toFixed(1)} MiB`;
  } else if (absBytes >= 1024) {
    value = `${(absBytes / 1024).toFixed(1)} KiB`;
  } else {
    value = `${absBytes.toFixed(0)} B`;
  }
  return bytes < 0 ? `-${value}` : value;
}

function formatSignedBytes(bytes) {
  if (bytes === 0) return formatBytes(bytes);
  return `${bytes > 0 ? '+' : ''}${formatBytes(bytes)}`;
}

function formatCount(value) {
  return String(value);
}

function formatFrameSource(frame) {
  if (!frame.url) return '(native or anonymous)';
  return `${frame.url}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`;
}

function escapePipe(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function mix(seed, value) {
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
