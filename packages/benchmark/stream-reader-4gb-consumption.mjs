import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { StreamEventType, StreamReaderSync } from 'stax-xml';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

const sizeGiB = Number.parseFloat(readOption('--size-gib') ?? '4');
const runs = Number.parseInt(readOption('--runs') ?? '3', 10);
const warmups = Number.parseInt(readOption('--warmups') ?? '0', 10);
const style = readOption('--style') ?? 'index-for';
const jsonOut = readOption('--json-out');
const mdOut = readOption('--md-out');
const targetBytes = Math.floor(sizeGiB * GIB);

const styles = style === 'both'
  ? ['index-for', 'while-index']
  : [style];

for (const candidate of styles) {
  if (candidate !== 'index-for' && candidate !== 'while-index') {
    throw new Error(`Unknown style: ${candidate}`);
  }
}

const row = new TextEncoder().encode(
  '<person id="123"><name>Jane Doe</name><age>42</age></person>',
);
const batchSize = 16;
const expectedBytes = Math.ceil(targetBytes / row.byteLength) * row.byteLength;

const results = [];

console.log(`StreamReaderSync 4GiB consumption checksum`);
console.log(`target=${formatBytes(expectedBytes)}, rowBytes=${row.byteLength}, warmups=${warmups}, runs=${runs}, style=${style}`);

for (const candidate of styles) {
  const measured = measure(candidate);
  results.push({ style: candidate, ...measured });
  console.log(`${candidate.padEnd(12)} avg=${measured.avgMs.toFixed(2)} ms throughput=${measured.avgMiBs.toFixed(2)} MiB/s min=${measured.minMs.toFixed(2)} ms max=${measured.maxMs.toFixed(2)} ms events=${measured.events} checksum=${measured.checksum} rssDelta=${formatBytes(measured.avgRssDelta)}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  packageVersion: '1.0.0-rc3',
  runtime: {
    id: 'node',
    version: process.versions.node,
    platform: `${process.platform}-${process.arch}`,
  },
  fixture: {
    generated: true,
    rowXml: new TextDecoder().decode(row),
    rowBytes: row.byteLength,
    targetBytes,
    actualBytes: expectedBytes,
    sizeGiB: expectedBytes / GIB,
  },
  options: {
    warmups,
    runs,
    style,
  },
  results,
};

if (jsonOut) {
  writeOutput(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
}
if (mdOut) {
  writeOutput(mdOut, renderMarkdown(report));
}

function measure(candidate) {
  for (let index = 0; index < warmups; index++) {
    consume(candidate);
  }

  const times = [];
  const rssDeltas = [];
  let last;
  for (let index = 0; index < runs; index++) {
    globalThis.gc?.();
    const beforeRss = process.memoryUsage().rss;
    const start = performance.now();
    last = consume(candidate);
    const elapsed = performance.now() - start;
    const afterRss = process.memoryUsage().rss;
    times.push(elapsed);
    rssDeltas.push(afterRss - beforeRss);
  }

  const avgMs = average(times);
  return {
    ...last,
    avgMs,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    avgMiBs: (expectedBytes / MIB) / (avgMs / 1000),
    avgRssDelta: average(rssDeltas),
  };
}

function consume(candidate) {
  return candidate === 'index-for'
    ? consumeIndexFor()
    : consumeWhileIndex();
}

function consumeIndexFor() {
  const parser = new StreamReaderSync(byteBatches());
  let events = 0;
  let checksum = 0;

  for (const batch of parser) {
    const eventCount = batch.eventCount;
    for (let index = 0; index < eventCount; index++) {
      const type = batch.typeAt(index);
      events++;
      checksum = mix(checksum, type);
      checksum = foldEvent(batch, index, type, checksum);
    }
  }

  return { events, checksum };
}

function consumeWhileIndex() {
  const parser = new StreamReaderSync(byteBatches());
  let events = 0;
  let checksum = 0;
  let batch;

  while ((batch = parser.nextBatch()) !== null) {
    let index = 0;
    const eventCount = batch.eventCount;
    while (index < eventCount) {
      const type = batch.typeAt(index);
      events++;
      checksum = mix(checksum, type);
      checksum = foldEvent(batch, index, type, checksum);
      index++;
    }
  }

  return { events, checksum };
}

function foldEvent(batch, index, type, checksum) {
  if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
    checksum = foldString(checksum, batch.nameAt(index));
  }
  if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
    checksum = foldString(checksum, batch.textAt(index)?.trim());
  }
  if (type === StreamEventType.START_ELEMENT) {
    const attrCount = batch.attributeCountAt(index);
    checksum = mix(checksum, attrCount);
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      checksum = foldString(checksum, batch.attributeNameAt(index, attrIndex));
      checksum = foldString(checksum, batch.attributeValueAt(index, attrIndex));
    }
  }
  return checksum;
}

function* byteBatches() {
  let emittedBytes = 0;
  while (emittedBytes < targetBytes) {
    const batch = [];
    for (let index = 0; index < batchSize && emittedBytes < targetBytes; index++) {
      batch.push(row);
      emittedBytes += row.byteLength;
    }
    yield batch;
  }
}

function readOption(name) {
  const prefix = `${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
  console.log(`Wrote ${resolved}`);
}

function renderMarkdown(report) {
  const lines = [
    '# StreamReaderSync 4GiB Index-First Benchmark',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This benchmark uses `StreamReaderSync` over generated `Uint8Array` batches and consumes each `StreamBatch` with `eventCount` plus index accessors.',
    'It measures the public pure JavaScript stream reader path and does not use native addons, Wasm modules, or backend selection.',
    '',
    '## Environment',
    '',
    `- Package: stax-xml ${report.packageVersion}`,
    `- Runtime: Node ${report.runtime.version} (${report.runtime.platform})`,
    `- Fixture: generated repeated person rows, ${formatBytes(report.fixture.actualBytes)}`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    '',
    '## Results',
    '',
    '| Style | Throughput | Average | Min | Max | Events | Checksum | Avg RSS delta |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const result of report.results) {
    lines.push(
      `| ${result.style} | ${result.avgMiBs.toFixed(2)} MiB/s | ${result.avgMs.toFixed(2)} ms | ` +
      `${result.minMs.toFixed(2)} ms | ${result.maxMs.toFixed(2)} ms | ${result.events} | ${result.checksum} | ${formatBytes(result.avgRssDelta)} |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatBytes(bytes) {
  const mib = bytes / MIB;
  return mib >= 1024 ? `${(mib / 1024).toFixed(2)} GiB` : `${mib.toFixed(1)} MiB`;
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
