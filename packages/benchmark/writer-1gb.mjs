import { closeSync, createWriteStream, mkdirSync, mkdtempSync, openSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Writer, WriterSyncSink } from 'stax-xml';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const DEFAULT_TARGET_BYTES = GIB;
const QUICK_TARGET_BYTES = 16 * MIB;

const DESCRIPTION =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ' +
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';

function parseByteSize(value) {
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb|kib|mib|gib)?$/i);
  if (!match) {
    throw new Error(`Invalid byte size: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = (match[2] || 'b').toLowerCase();
  const multipliers = {
    b: 1,
    kb: 1000,
    mb: 1000 * 1000,
    gb: 1000 * 1000 * 1000,
    kib: 1024,
    mib: MIB,
    gib: GIB,
  };
  return Math.floor(amount * multipliers[unit]);
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    targetBytes: DEFAULT_TARGET_BYTES,
    mode: 'all',
    keepTemp: false,
    prettyPrint: true,
    json: false,
    jsonOut: undefined,
    probeEvery: undefined,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;

    if (arg === '--quick') {
      args.targetBytes = QUICK_TARGET_BYTES;
      continue;
    }
    if (arg === '--keep-temp') {
      args.keepTemp = true;
      continue;
    }
    if (arg === '--compact') {
      args.prettyPrint = false;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--json-out' || arg === '--out') {
      args.jsonOut = argv[++index];
      continue;
    }
    if (arg.startsWith('--json-out=') || arg.startsWith('--out=')) {
      args.jsonOut = arg.slice(arg.indexOf('=') + 1);
      continue;
    }

    if (arg === '--bytes' || arg === '--target-bytes') {
      args.targetBytes = parseByteSize(argv[++index]);
      continue;
    }
    if (arg.startsWith('--bytes=') || arg.startsWith('--target-bytes=')) {
      args.targetBytes = parseByteSize(arg.slice(arg.indexOf('=') + 1));
      continue;
    }
    if (arg === '--size-gb') {
      args.targetBytes = Math.floor(Number(argv[++index]) * GIB);
      continue;
    }
    if (arg.startsWith('--size-gb=')) {
      args.targetBytes = Math.floor(Number(arg.slice('--size-gb='.length)) * GIB);
      continue;
    }
    if (arg === '--mode') {
      args.mode = argv[++index] || args.mode;
      continue;
    }
    if (arg.startsWith('--mode=')) {
      args.mode = arg.slice('--mode='.length);
      continue;
    }
    if (arg === '--probe-every') {
      args.probeEvery = Number(argv[++index]);
      continue;
    }
    if (arg.startsWith('--probe-every=')) {
      args.probeEvery = Number(arg.slice('--probe-every='.length));
    }
  }

  if (!Number.isFinite(args.targetBytes) || args.targetBytes <= 0) {
    throw new Error(`Invalid target byte count: ${args.targetBytes}`);
  }
  if (!['all', 'memory', 'file'].includes(args.mode)) {
    throw new Error(`Invalid --mode=${args.mode}; expected all, memory, or file`);
  }
  if (args.probeEvery !== undefined && (!Number.isInteger(args.probeEvery) || args.probeEvery <= 0)) {
    throw new Error(`Invalid --probe-every=${args.probeEvery}`);
  }
  if (args.jsonOut !== undefined && args.jsonOut.trim() === '') {
    throw new Error('Invalid empty --json-out path');
  }

  return args;
}

function createContext() {
  const cpu = process.report?.getReport?.().header?.cpus?.[0];
  return {
    arch: `${process.arch}-${process.platform}`,
    runtime: 'node',
    version: process.version.slice(1),
    cpuName: cpu?.model || 'unknown',
    cpuGHz: cpu?.speed ? Number((cpu.speed / 1000).toFixed(2)) : 0,
  };
}

function formatBytes(bytes) {
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(2)} GiB`;
  if (bytes >= MIB) return `${(bytes / MIB).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KiB`;
  return `${bytes} B`;
}

function formatMs(ms) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms.toFixed(2)} ms`;
}

function formatThroughput(bytes, ms) {
  return `${(bytes / MIB / (ms / 1000)).toFixed(2)} MiB/s`;
}

function createMemorySampler() {
  let peak = process.memoryUsage();

  return {
    sample() {
      const current = process.memoryUsage();
      peak = {
        rss: Math.max(peak.rss, current.rss),
        heapTotal: Math.max(peak.heapTotal, current.heapTotal),
        heapUsed: Math.max(peak.heapUsed, current.heapUsed),
        external: Math.max(peak.external, current.external),
        arrayBuffers: Math.max(peak.arrayBuffers, current.arrayBuffers),
      };
    },
    peak() {
      return peak;
    },
  };
}

function createMemoryWritableTarget() {
  let bytesWritten = 0;

  return {
    stream: new WritableStream({
      write(chunk) {
        bytesWritten += chunk.byteLength;
      }
    }),
    getBytesWritten: () => bytesWritten,
    close() {},
  };
}

function createFileWritableTarget(filePath) {
  let bytesWritten = 0;
  const nodeStream = createWriteStream(filePath);

  return {
    stream: new WritableStream({
      write(chunk) {
        bytesWritten += chunk.byteLength;
        return new Promise((resolve, reject) => {
          nodeStream.write(chunk, (error) => error ? reject(error) : resolve());
        });
      },
      close() {
        return new Promise((resolve, reject) => {
          nodeStream.end((error) => error ? reject(error) : resolve());
        });
      },
      abort(reason) {
        nodeStream.destroy(reason);
      }
    }),
    getBytesWritten: () => bytesWritten,
    getFileBytes: () => statSync(filePath).size,
    close() {},
  };
}

function createMemoryTextSink() {
  let bytesWritten = 0;

  return {
    sink: {
      write(chunk) {
        bytesWritten += Buffer.byteLength(chunk, 'utf8');
      },
      flush() {},
      close() {},
    },
    getBytesWritten: () => bytesWritten,
    close() {},
  };
}

function createFileTextSink(filePath) {
  const fd = openSync(filePath, 'w');
  let bytesWritten = 0;
  let closed = false;

  const close = () => {
    if (!closed) {
      closeSync(fd);
      closed = true;
    }
  };

  return {
    sink: {
      write(chunk) {
        bytesWritten += writeSync(fd, chunk, undefined, 'utf8');
      },
      flush() {},
      close,
    },
    getBytesWritten: () => bytesWritten,
    getFileBytes: () => statSync(filePath).size,
    close,
  };
}

function createBookData(bookId) {
  const isbn = `978${((bookId * 48271) % 900000000) + 100000000}`;
  const year = 2020 + (bookId % 5);
  const month = (bookId % 12) + 1;
  const day = (bookId % 28) + 1;

  return {
    bookId,
    isbn,
    year,
    month: month.toString().padStart(2, '0'),
    day: day.toString().padStart(2, '0'),
  };
}

async function writeBookAsync(writer, bookId) {
  const data = createBookData(bookId);

  await writer.writeStartElement('book', { attributes: { id: `book-${data.bookId}` } });
  await writer.writeStartElement('title');
  await writer.writeCharacters(`Sample Book Title Number ${data.bookId} - Lorem ipsum dolor sit amet, consectetur adipiscing elit`);
  await writer.writeEndElement();
  await writer.writeStartElement('author');
  await writer.writeCharacters(`Author Name ${data.bookId}`);
  await writer.writeEndElement();
  await writer.writeStartElement('isbn');
  await writer.writeCharacters(data.isbn);
  await writer.writeEndElement();
  await writer.writeStartElement('publisher');
  await writer.writeCharacters(`Sample Publisher ${data.bookId}`);
  await writer.writeEndElement();
  await writer.writeStartElement('publishDate');
  await writer.writeCharacters(`${data.year}-${data.month}-${data.day}`);
  await writer.writeEndElement();
  await writer.writeStartElement('description');
  await writer.writeCharacters(DESCRIPTION);
  await writer.writeEndElement();
  await writer.writeStartElement('chapters');
  for (let chapter = 1; chapter <= 3; chapter++) {
    await writer.writeStartElement('chapter', { attributes: { number: String(chapter) } });
    await writer.writeCharacters(`${chapter === 1 ? 'Introduction' : chapter === 2 ? 'Main Content' : 'Conclusion'} Chapter for Book ${data.bookId}`);
    await writer.writeEndElement();
  }
  await writer.writeEndElement();
  await writer.writeEndElement();
}

function writeBookSync(writer, bookId) {
  const data = createBookData(bookId);

  writer.writeStartElement('book', { attributes: { id: `book-${data.bookId}` } });
  writer.writeStartElement('title');
  writer.writeCharacters(`Sample Book Title Number ${data.bookId} - Lorem ipsum dolor sit amet, consectetur adipiscing elit`);
  writer.writeEndElement();
  writer.writeStartElement('author');
  writer.writeCharacters(`Author Name ${data.bookId}`);
  writer.writeEndElement();
  writer.writeStartElement('isbn');
  writer.writeCharacters(data.isbn);
  writer.writeEndElement();
  writer.writeStartElement('publisher');
  writer.writeCharacters(`Sample Publisher ${data.bookId}`);
  writer.writeEndElement();
  writer.writeStartElement('publishDate');
  writer.writeCharacters(`${data.year}-${data.month}-${data.day}`);
  writer.writeEndElement();
  writer.writeStartElement('description');
  writer.writeCharacters(DESCRIPTION);
  writer.writeEndElement();
  writer.writeStartElement('chapters');
  for (let chapter = 1; chapter <= 3; chapter++) {
    writer.writeStartElement('chapter', { attributes: { number: String(chapter) } });
    writer.writeCharacters(`${chapter === 1 ? 'Introduction' : chapter === 2 ? 'Main Content' : 'Conclusion'} Chapter for Book ${data.bookId}`);
    writer.writeEndElement();
  }
  writer.writeEndElement();
  writer.writeEndElement();
}

function getProbeEvery(args) {
  if (args.probeEvery) return args.probeEvery;
  return args.targetBytes < 64 * MIB ? 64 : 2048;
}

async function writeTargetBytesAsync({ targetBytes, prettyPrint, probeEvery, target, sampler }) {
  const writer = new Writer(target.stream, {
    prettyPrint,
    indentString: '  ',
    bufferSize: 64 * 1024,
    enableAutoFlush: true,
    flushThreshold: 0.8,
  });

  await writer.writeStartDocument();
  await writer.writeStartElement('books');

  let bookId = 0;
  while (target.getBytesWritten() < targetBytes) {
    bookId++;
    await writeBookAsync(writer, bookId);

    if (bookId % probeEvery === 0) {
      await writer.flush();
      sampler.sample();
    }
  }

  await writer.writeEndElement();
  await writer.writeEndDocument();
  sampler.sample();

  return bookId;
}

function writeTargetBytesSyncSink({ targetBytes, prettyPrint, probeEvery, target, sampler }) {
  const writer = new WriterSyncSink(target.sink, {
    prettyPrint,
    indentString: '  ',
    bufferSize: 64 * 1024,
    enableAutoFlush: true,
    flushThreshold: 0.8,
    flushOnClose: true,
  });

  writer.writeStartDocument();
  writer.writeStartElement('books');

  let bookId = 0;
  while (target.getBytesWritten() < targetBytes) {
    bookId++;
    writeBookSync(writer, bookId);

    if (bookId % probeEvery === 0) {
      writer.flush();
      sampler.sample();
    }
  }

  writer.writeEndElement();
  writer.writeEndDocument();
  writer.close();
  sampler.sample();

  return bookId;
}

async function measureCase({ label, kind, targetBytes, prettyPrint, probeEvery, createTarget }) {
  if (global.gc) {
    global.gc();
  }

  const sampler = createMemorySampler();
  const before = process.memoryUsage();
  const target = createTarget();
  const startedAt = performance.now();
  let records = 0;

  try {
    if (kind === 'async') {
      records = await writeTargetBytesAsync({ targetBytes, prettyPrint, probeEvery, target, sampler });
    } else {
      records = writeTargetBytesSyncSink({ targetBytes, prettyPrint, probeEvery, target, sampler });
    }

    const elapsedMs = performance.now() - startedAt;
    const bytesWritten = target.getBytesWritten();
    const fileBytes = target.getFileBytes?.();

    if (bytesWritten < targetBytes) {
      throw new Error(`${label} wrote ${bytesWritten} bytes, below target ${targetBytes}`);
    }
    if (fileBytes !== undefined && fileBytes !== bytesWritten) {
      throw new Error(`${label} counted ${bytesWritten} bytes but file contains ${fileBytes}`);
    }

    return {
      label,
      kind,
      records,
      bytesWritten,
      elapsedMs,
      throughputMiBs: bytesWritten / MIB / (elapsedMs / 1000),
      memoryBefore: before,
      memoryAfter: process.memoryUsage(),
      memoryPeak: sampler.peak(),
    };
  } finally {
    target.close?.();
  }
}

function printResultTable(results) {
  const rows = [
    ['Case', 'Written', 'Records', 'Time', 'Throughput', 'Peak RSS', 'Peak heap'],
    ['---', '---:', '---:', '---:', '---:', '---:', '---:'],
    ...results.map((result) => [
      result.label,
      formatBytes(result.bytesWritten),
      result.records.toLocaleString(),
      formatMs(result.elapsedMs),
      formatThroughput(result.bytesWritten, result.elapsedMs),
      formatBytes(result.memoryPeak.rss),
      formatBytes(result.memoryPeak.heapUsed),
    ]),
  ];

  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  for (const row of rows) {
    console.log(row.map((cell, column) => cell.padEnd(widths[column])).join(' | '));
  }
}

async function main() {
  const args = parseArgs();
  const log = args.json ? console.error : console.log;
  const probeEvery = getProbeEvery(args);
  const includeMemory = args.mode === 'all' || args.mode === 'memory';
  const includeFile = args.mode === 'all' || args.mode === 'file';
  const tempDir = includeFile ? mkdtempSync(join(tmpdir(), 'stax-xml-writer-1gb-')) : undefined;
  const results = [];

  log(`XML writer large-document benchmark`);
  log(`Target: ${formatBytes(args.targetBytes)} (${args.prettyPrint ? 'pretty' : 'compact'}, probe every ${probeEvery} records)`);
  if (includeFile) {
    log(`Temp directory: ${tempDir}${args.keepTemp ? ' (kept)' : ' (removed after run)'}`);
  }
  log('');

  try {
    if (includeMemory) {
      results.push(await measureCase({
        label: 'async writer memory WritableStream',
        kind: 'async',
        targetBytes: args.targetBytes,
        prettyPrint: args.prettyPrint,
        probeEvery,
        createTarget: createMemoryWritableTarget,
      }));
      results.push(await measureCase({
        label: 'sync writer sink memory',
        kind: 'sync-sink',
        targetBytes: args.targetBytes,
        prettyPrint: args.prettyPrint,
        probeEvery,
        createTarget: createMemoryTextSink,
      }));
    }

    if (includeFile) {
      results.push(await measureCase({
        label: 'async writer temp file',
        kind: 'async',
        targetBytes: args.targetBytes,
        prettyPrint: args.prettyPrint,
        probeEvery,
        createTarget: () => createFileWritableTarget(join(tempDir, 'async-writer.xml')),
      }));
      results.push(await measureCase({
        label: 'sync writer sink temp file',
        kind: 'sync-sink',
        targetBytes: args.targetBytes,
        prettyPrint: args.prettyPrint,
        probeEvery,
        createTarget: () => createFileTextSink(join(tempDir, 'sync-sink-writer.xml')),
      }));
    }
  } finally {
    if (tempDir && !args.keepTemp) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    context: createContext(),
    targetBytes: args.targetBytes,
    prettyPrint: args.prettyPrint,
    probeEvery,
    results,
  };

  if (args.jsonOut) {
    const outputPath = resolve(process.cwd(), args.jsonOut);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    log(`Wrote raw JSON to ${outputPath}`);
  }

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    printResultTable(results);
  }
}

await main();
