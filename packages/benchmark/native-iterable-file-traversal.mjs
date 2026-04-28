import { closeSync, existsSync, mkdirSync, openSync, statSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  NodeIterableReader,
  nodeFileByteBatchesSync,
} from 'stax-xml/iterable/node';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDataDir = join(__dirname, 'test-data');
const chunkSize = 1024 * 1024;
const batchSize = 1;

const options = parseArgs();
mkdirSync(testDataDir, { recursive: true });

const rows = [];
for (const sizeMiB of options.sizesMiB) {
  const fixture = ensureFixture(sizeMiB);
  const js = measureScenario({
    label: 'JS iterable parser',
    filePath: fixture.filePath,
    sizeMiB: fixture.sizeMiB,
    backend: 'js',
    warmups: options.warmups,
    runs: options.runs,
  });
  const auto = measureScenario({
    label: 'auto iterable parser',
    filePath: fixture.filePath,
    sizeMiB: fixture.sizeMiB,
    backend: 'auto',
    warmups: options.warmups,
    runs: options.runs,
  });

  rows.push({ sizeMiB, js, auto, speedup: js.avgMs / auto.avgMs });
}

console.log('\nNative Iterable File Traversal');
console.log('Public API path: nodeFileByteBatchesSync(file) -> NodeIterableReader -> nextBatch/event accessors');
console.log(`Chunk size: ${formatMiB(chunkSize)}; batch size: ${batchSize}; warmups: ${options.warmups}; runs: ${options.runs}`);
console.log('');
console.log('| Size | Backend | Throughput | Avg | Events | Checksum | Batches |');
console.log('| --- | --- | ---: | ---: | ---: | ---: | ---: |');
for (const row of rows) {
  printRow(row.sizeMiB, 'JS forced', row.js);
  printRow(row.sizeMiB, `${row.auto.backendKind} auto`, row.auto);
  console.log(`| ${row.sizeMiB} MiB | speedup | ${row.speedup.toFixed(2)}x | | | | |`);
}

function measureScenario({ label, filePath, sizeMiB, backend, warmups, runs }) {
  let last;
  for (let index = 0; index < warmups; index++) {
    last = consumeFile(filePath, backend);
  }

  const samples = [];
  for (let index = 0; index < runs; index++) {
    if (globalThis.gc) globalThis.gc();
    const startedAt = performance.now();
    const result = consumeFile(filePath, backend);
    const elapsedMs = performance.now() - startedAt;
    if (last && (last.events !== result.events || last.checksum !== result.checksum)) {
      throw new Error(`${label} produced unstable event count or checksum.`);
    }
    last = result;
    samples.push(elapsedMs);
  }

  const avgMs = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  return {
    ...last,
    avgMs,
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
    throughputMiBs: sizeMiB / (avgMs / 1000),
  };
}

function consumeFile(filePath, backend) {
  const parser = new NodeIterableReader(
    nodeFileByteBatchesSync(filePath, { chunkSize, batchSize }),
    { backend },
  );
  const state = { events: 0, checksum: 2166136261, batches: 0 };
  while (parser.nextBatch()) {
    consumeBatch(parser, state);
    state.batches++;
  }
  return {
    ...state,
    backendKind: parser.backendKind(),
  };
}

function consumeBatch(parser, state) {
  const buffer = parser.buffer();
  for (let index = 0; index < parser.eventCount(); index++) {
    state.events++;
    state.checksum = mixChecksum(state.checksum, parser.eventType(index));
    state.checksum = mixSpanChecksum(state.checksum, buffer, parser.nameStart(index), parser.nameEnd(index));
    state.checksum = mixSpanChecksum(state.checksum, buffer, parser.textStart(index), parser.textEnd(index));

    const attrCount = parser.attrCount(index);
    state.checksum = mixChecksum(state.checksum, attrCount);
    for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
      state.checksum = mixSpanChecksum(
        state.checksum,
        buffer,
        parser.attrNameStart(index, attrIndex),
        parser.attrNameEnd(index, attrIndex),
      );
      state.checksum = mixSpanChecksum(
        state.checksum,
        buffer,
        parser.attrValueStart(index, attrIndex),
        parser.attrValueEnd(index, attrIndex),
      );
    }
  }
}

function ensureFixture(sizeMiB) {
  const targetBytes = sizeMiB * 1024 * 1024;
  const filePath = join(testDataDir, `native-iterable-file-traversal-${sizeMiB}mib.xml`);
  if (existsSync(filePath) && statSync(filePath).size >= targetBytes) {
    return { filePath, sizeMiB, bytes: statSync(filePath).size };
  }

  const fd = openSync(filePath, 'w');
  let written = 0;
  let id = 0;
  try {
    written += writeBuffer(fd, '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n');
    while (written < targetBytes - 16) {
      written += writeBuffer(fd, createElement(id++));
    }
    written += writeBuffer(fd, '</root>\n');
  } finally {
    closeSync(fd);
  }
  return { filePath, sizeMiB, bytes: written };
}

function writeBuffer(fd, value) {
  const buffer = Buffer.from(value, 'utf8');
  writeSync(fd, buffer);
  return buffer.byteLength;
}

function createElement(id) {
  return `  <book id="book-${id}" lang="en" code="N${id % 997}">
    <title>Native Iterable File Traversal ${id}</title>
    <author>Author ${id % 113}</author>
    <description>Chunked public iterable parser benchmark payload ${id} with attribute and text spans.</description>
    <chapters><chapter number="1">Intro ${id}</chapter><chapter number="2">Body ${id}</chapter></chapters>
  </book>
`;
}

function mixChecksum(checksum, value) {
  return Math.imul(checksum ^ (value >>> 0), 16777619) >>> 0;
}

function mixSpanChecksum(checksum, buffer, start, end) {
  if (start < 0 || end <= start) {
    return mixChecksum(checksum, 0);
  }
  const length = end - start;
  checksum = mixChecksum(checksum, length);
  checksum = mixChecksum(checksum, buffer[start] ?? 0);
  checksum = mixChecksum(checksum, buffer[start + (length >> 1)] ?? 0);
  checksum = mixChecksum(checksum, buffer[end - 1] ?? 0);
  return checksum;
}

function printRow(sizeMiB, backend, result) {
  console.log(
    `| ${sizeMiB} MiB | ${backend} | ${result.throughputMiBs.toFixed(1)} MiB/s | ` +
      `${result.avgMs.toFixed(2)} ms | ${result.events} | ${result.checksum} | ${result.batches} |`,
  );
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    sizesMiB: [16, 128],
    warmups: 1,
    runs: 3,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--quick') {
      args.sizesMiB = [16];
      args.warmups = 1;
      args.runs = 2;
      continue;
    }
    if (arg === '--sizes-mib' && argv[index + 1]) {
      args.sizesMiB = parseSizeList(argv[++index]);
      continue;
    }
    if (arg.startsWith('--sizes-mib=')) {
      args.sizesMiB = parseSizeList(arg.slice('--sizes-mib='.length));
      continue;
    }
    if (arg === '--runs' && argv[index + 1]) {
      args.runs = parsePositiveInteger(argv[++index], 'runs');
      continue;
    }
    if (arg.startsWith('--runs=')) {
      args.runs = parsePositiveInteger(arg.slice('--runs='.length), 'runs');
      continue;
    }
    if (arg === '--warmups' && argv[index + 1]) {
      args.warmups = parsePositiveInteger(argv[++index], 'warmups');
      continue;
    }
    if (arg.startsWith('--warmups=')) {
      args.warmups = parsePositiveInteger(arg.slice('--warmups='.length), 'warmups');
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function parseSizeList(value) {
  const sizes = value.split(',').map(part => parsePositiveInteger(part.trim(), 'sizes-mib'));
  if (sizes.length === 0) {
    throw new Error('sizes-mib must include at least one size.');
  }
  return sizes;
}

function parsePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(0)} MiB`;
}
