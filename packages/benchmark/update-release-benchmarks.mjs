import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { bench, barplot, run, summary } from 'mitata';
import { Builder } from 'xml2js';
import xml2js from 'xml2js';
import * as txml from 'txml';
import {
  StaxXmlParser,
  StaxXmlParserSync,
  StaxXmlWriter,
  StaxXmlWriterSync,
  StaxXmlWriterSyncSink,
  XmlEventType,
} from 'stax-xml';
import { createLargeXMLStream } from './common/large-file-generator.mjs';
import { normalizeFxpWriterTree, normalizeOrderedWriterTree, writeWriterTreeAsync, writeWriterTreeSync } from './common/writer-tree.mjs';
import { ASSET_PATHS, loadJsonFile, loadXmlFile } from './common/utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, '..', '..');
export const benchmarkDir = resolve(__dirname);
export const resultsDir = join(benchmarkDir, 'results', 'release');
export const rawDir = join(resultsDir, 'raw');
export const summaryPath = join(resultsDir, 'latest-summary.json');
export const benchmarkMarkdownPath = join(repoRoot, 'BENCHMARK.md');
const runtimeMatrixPath = join(resultsDir, 'runtime-matrix.json');
const crossRuntimeComparisonPath = join(resultsDir, 'cross-runtime-comparison.json');

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    only: null,
    verbose: true,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;

    if (arg === '--quiet') {
      args.verbose = false;
      continue;
    }

    if (arg === '--only' && argv[index + 1]) {
      args.only = new Set(argv[index + 1].split(',').map((value) => value.trim()).filter(Boolean));
      index++;
      continue;
    }
    if (arg.startsWith('--only=')) {
      args.only = new Set(arg.slice('--only='.length).split(',').map((value) => value.trim()).filter(Boolean));
    }
  }

  return args;
}

function runCommand(command, commandArgs, options = {}) {
  const baseOptions = {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  };

  const result = process.platform === 'win32' && command === 'pnpm'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', `pnpm ${commandArgs.join(' ')}`], baseOptions)
    : spawnSync(command, commandArgs, baseOptions);

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${commandArgs.join(' ')}`);
  }
}

function formatDurationNs(ns) {
  if (ns >= 1e9) return `${(ns / 1e9).toFixed(2)} s`;
  if (ns >= 1e6) return `${(ns / 1e6).toFixed(2)} ms`;
  if (ns >= 1e3) return `${(ns / 1e3).toFixed(2)} µs`;
  return `${ns.toFixed(2)} ns`;
}

function formatDurationNsCompact(ns) {
  if (ns >= 1e9) return `${(ns / 1e9).toFixed(2)} s`;
  if (ns >= 1e6) return `${(ns / 1e6).toFixed(2)} ms`;
  return `${(ns / 1e3).toFixed(2)} µs`;
}

function formatMemory(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} gb`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} mb`;
  return `${(bytes / 1024).toFixed(2)} kb`;
}

function formatOps(avgNs) {
  return `~${(1e9 / avgNs).toLocaleString(undefined, { maximumFractionDigits: avgNs < 1e6 ? 0 : 2 })} ops/sec`;
}

function normalizeSuiteResult(id, title, result) {
  return {
    id,
    title,
    context: {
      arch: result.context.arch,
      runtime: result.context.runtime,
      version: result.context.version,
      cpuName: result.context.cpu.name,
      cpuGHz: Number(result.context.cpu.freq.toFixed(2)),
    },
    cases: result.benchmarks.flatMap((benchmark) =>
      benchmark.runs
        .filter((runEntry) => runEntry.stats)
        .map((runEntry) => ({
          label: runEntry.name,
          avgNs: runEntry.stats.avg,
          minNs: runEntry.stats.min,
          p75Ns: runEntry.stats.p75,
          p99Ns: runEntry.stats.p99,
          maxNs: runEntry.stats.max,
          heapAvgBytes: runEntry.stats.heap?.avg ?? null,
        }))
    ),
  };
}

export function normalizeSuiteResultFromRawFile(id, title, rawFilePath) {
  const raw = JSON.parse(readFileSync(rawFilePath, 'utf8'));
  return normalizeSuiteResult(id, title, raw);
}

function normalizeWriter1gbSuiteResult(id, title, raw) {
  return {
    id,
    title,
    context: raw.context,
    cases: raw.results.map((entry) => {
      const elapsedNs = entry.elapsedMs * 1e6;
      return {
        label: entry.label,
        avgNs: elapsedNs,
        minNs: elapsedNs,
        p75Ns: elapsedNs,
        p99Ns: elapsedNs,
        maxNs: elapsedNs,
        heapAvgBytes: entry.memoryPeak?.heapUsed ?? null,
        rssPeakBytes: entry.memoryPeak?.rss ?? null,
        bytesWritten: entry.bytesWritten,
        records: entry.records,
        throughputMiBs: entry.throughputMiBs,
        targetBytes: raw.targetBytes,
      };
    }),
  };
}

export function normalizeWriter1gbSuiteResultFromRawFile(rawFilePath) {
  const raw = JSON.parse(readFileSync(rawFilePath, 'utf8'));
  return normalizeWriter1gbSuiteResult('writer-1gb', 'Writer 1GiB async vs sync sink', raw);
}

async function runSuite(id, title, registerSuite, verbose) {
  if (verbose) {
    console.log(`\n== ${title} ==`);
  }

  registerSuite();
  const result = await run({ format: 'quiet', throw: true });
  const normalized = normalizeSuiteResult(id, title, result);
  writeFileSync(join(rawDir, `${id}.json`), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return normalized;
}

function parseXmlToObjectBaseline(xmlString) {
  const parser = new StaxXmlParserSync(xmlString);
  let elementStack = [];
  let currentElement = null;
  let root = null;

  for (const event of parser) {
    elementStack.push(currentElement ?? event);
    if (elementStack.length > 100) {
      elementStack.splice(0, elementStack.length);
    }
  }

  return root;
}

function registerParserSyncSuite(xmlString) {
  const parseObject = () => parseXmlToObjectBaseline(xmlString);
  const consume = () => {
    const parser = new StaxXmlParserSync(xmlString);
    for (const event of parser) {
      switch (event.type) {
        case XmlEventType.START_DOCUMENT:
        case XmlEventType.END_DOCUMENT:
        case XmlEventType.START_ELEMENT:
        case XmlEventType.CHARACTERS:
        case XmlEventType.CDATA:
        case XmlEventType.END_ELEMENT:
          break;
        case XmlEventType.ERROR:
          throw event.error;
      }
    }
  };
  const parseXml2js = async () => {
    await new Promise((resolve, reject) => {
      xml2js.parseString(xmlString, (err) => (err ? reject(err) : resolve(undefined)));
    });
  };
  const parseFastXml = () => {
    const parser = new XMLParser();
    parser.parse(xmlString);
  };
  const parseTxml = () => {
    txml.parse(xmlString);
  };

  barplot(() => {
    summary(() => {
      bench('stax-xml to object', () => parseObject()).gc('inner');
      bench('stax-xml consume', () => consume()).gc('inner');
      bench('xml2js', async () => await parseXml2js()).gc('inner');
      bench('fast-xml-parser', () => parseFastXml()).gc('inner');
      bench('txml', () => parseTxml()).gc('inner');
    });
  });
}

function createAsyncEventConsumer(stream) {
  const parser = new StaxXmlParser(stream);
  return (async () => {
    let eventsProcessed = 0;
    for await (const event of parser) {
      eventsProcessed++;
      switch (event.type) {
        case XmlEventType.START_DOCUMENT:
        case XmlEventType.END_DOCUMENT:
        case XmlEventType.START_ELEMENT:
        case XmlEventType.CHARACTERS:
        case XmlEventType.CDATA:
        case XmlEventType.END_ELEMENT:
          break;
        case XmlEventType.ERROR:
          throw event.error;
      }
      if (eventsProcessed % 10000 === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
    return eventsProcessed;
  })();
}

async function consumeSyncFromGeneratedStream(stream) {
  const reader = stream.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  const content = new TextDecoder().decode(combined);
  const parser = new StaxXmlParserSync(content);
  let eventsProcessed = 0;
  for (const event of parser) {
    eventsProcessed++;
    if (event.type === XmlEventType.ERROR) {
      throw event.error;
    }
  }
  return eventsProcessed;
}

function registerAsyncParserSizeSuite(verboseStreams) {
  barplot(() => {
    summary(() => {
      bench('async parser (1MB)', async () => createAsyncEventConsumer(createLargeXMLStream({ sizeGB: 0.001, verbose: verboseStreams }))).gc('inner');
      bench('sync parser (1MB)', async () => consumeSyncFromGeneratedStream(createLargeXMLStream({ sizeGB: 0.001, verbose: verboseStreams }))).gc('inner');
      bench('async parser (10MB)', async () => createAsyncEventConsumer(createLargeXMLStream({ sizeGB: 0.01, verbose: verboseStreams }))).gc('inner');
      bench('sync parser (10MB)', async () => consumeSyncFromGeneratedStream(createLargeXMLStream({ sizeGB: 0.01, verbose: verboseStreams }))).gc('inner');
      bench('async parser (100MB)', async () => createAsyncEventConsumer(createLargeXMLStream({ sizeGB: 0.1, verbose: verboseStreams }))).gc('inner');
      bench('sync parser (100MB)', async () => consumeSyncFromGeneratedStream(createLargeXMLStream({ sizeGB: 0.1, verbose: verboseStreams }))).gc('inner');
      bench('async parser (1GB)', async () => createAsyncEventConsumer(createLargeXMLStream({ sizeGB: 1.0, verbose: verboseStreams }))).gc('inner');
    });
  });
}

async function buildXmlAsyncFromJson(data) {
  const stream = new WritableStream();
  const writer = new StaxXmlWriter(stream, { prettyPrint: true, indentString: '  ' });

  async function buildNode(node) {
    if (Array.isArray(node)) {
      for (const item of node) {
        await buildNode(item);
      }
      return;
    }
    if (typeof node !== 'object' || node === null) {
      await writer.writeCharacters(String(node));
      return;
    }

    for (const key of Object.keys(node)) {
      if (key === '_attr' || key === '__text') continue;
      const content = node[key];
      const attributes = content?._attr || {};
      const textContent = content?.__text;
      const attrsForWriter = {};

      for (const attrKey of Object.keys(attributes)) {
        attrsForWriter[attrKey.startsWith('@_') ? attrKey.slice(2) : attrKey] = attributes[attrKey];
      }

      if (Object.keys(content).length === 0 && textContent === undefined) {
        await writer.writeStartElement(key, { attributes: attrsForWriter, selfClosing: true });
      } else {
        await writer.writeStartElement(key, { attributes: attrsForWriter });
        if (textContent !== undefined) {
          await writer.writeCharacters(String(textContent));
        }
        await buildNode(content);
        await writer.writeEndElement();
      }
    }
  }

  await writer.writeStartDocument();
  await buildNode(data);
  await writer.writeEndDocument();
  await writer.flush();
}

function buildXmlSyncFromJson(data) {
  const writer = new StaxXmlWriterSync({ prettyPrint: true, indentString: '  ' });

  function buildNode(node) {
    if (Array.isArray(node)) {
      for (const item of node) {
        buildNode(item);
      }
      return;
    }
    if (typeof node !== 'object' || node === null) {
      writer.writeCharacters(String(node));
      return;
    }

    for (const key of Object.keys(node)) {
      if (key === '_attr' || key === '__text') continue;
      const content = node[key];
      const attributes = content?._attr || {};
      const textContent = content?.__text;
      const attrsForWriter = {};

      for (const attrKey of Object.keys(attributes)) {
        attrsForWriter[attrKey.startsWith('@_') ? attrKey.slice(2) : attrKey] = attributes[attrKey];
      }

      if (Object.keys(content).length === 0 && textContent === undefined) {
        writer.writeStartElement(key, { attributes: attrsForWriter, selfClosing: true });
      } else {
        writer.writeStartElement(key, { attributes: attrsForWriter });
        if (textContent !== undefined) {
          writer.writeCharacters(String(textContent));
        }
        buildNode(content);
        writer.writeEndElement();
      }
    }
  }

  writer.writeStartDocument();
  buildNode(data);
  writer.writeEndDocument();
  return writer.getXmlString();
}

function registerWriterSmallSuite() {
  const jsonOrderedContent = loadJsonFile(ASSET_PATHS.testOrdered);
  const jsonContent = loadJsonFile(ASSET_PATHS.test);
  const orderedWriterTree = normalizeOrderedWriterTree(jsonOrderedContent);

  barplot(() => {
    summary(() => {
      bench('fast-xml-parser builder', () => {
        const builder = new XMLBuilder({ format: true, ignoreAttributes: false });
        builder.build(jsonOrderedContent);
      }).gc('inner');

      bench('stax-xml writer', async () => {
        const stream = new WritableStream();
        const writer = new StaxXmlWriter(stream, {
          prettyPrint: true,
          indentString: '  ',
        });
        await writer.writeStartDocument();
        await writeWriterTreeAsync(writer, orderedWriterTree);
        await writer.writeEndDocument();
      }).gc('inner');

      bench('stax-xml writer sync', () => {
        const writer = new StaxXmlWriterSync({
          prettyPrint: true,
          indentString: '  ',
        });
        writer.writeStartDocument();
        writeWriterTreeSync(writer, orderedWriterTree);
        writer.writeEndDocument();
        writer.getXmlString();
      }).gc('inner');

      bench('stax-xml writer sync sink', () => {
        const { sink, getBytesWritten } = createInMemoryFileSink();
        const writer = new StaxXmlWriterSyncSink(sink, {
          prettyPrint: true,
          indentString: '  ',
        });
        writer.writeStartDocument();
        writeWriterTreeSync(writer, orderedWriterTree);
        writer.writeEndDocument();
        return getBytesWritten();
      }).gc('inner');

      bench('xml2js builder', () => {
        const builder = new Builder({});
        builder.buildObject(jsonContent);
      }).gc('inner');
    });
  });
}

function registerWriterBigSuite() {
  const bigJsonContent = loadJsonFile(ASSET_PATHS.big);
  const bigWriterTree = normalizeFxpWriterTree(bigJsonContent);

  barplot(() => {
    summary(() => {
      bench('fast-xml-parser builder (big.json)', () => {
        const builder = new XMLBuilder({ format: true, ignoreAttributes: false });
        builder.build(bigJsonContent);
      }).gc('inner');

      bench('stax-xml writer (big.json)', async () => {
        const stream = new WritableStream();
        const writer = new StaxXmlWriter(stream);
        await writer.writeStartDocument();
        await writeWriterTreeAsync(writer, bigWriterTree);
        await writer.writeEndDocument();
      }).gc('inner');

      bench('stax-xml writer sync (big.json)', () => {
        const writer = new StaxXmlWriterSync();
        writer.writeStartDocument();
        writeWriterTreeSync(writer, bigWriterTree);
        writer.writeEndDocument();
        writer.getXmlString();
      }).gc('inner');

      bench('stax-xml writer sync sink (big.json)', () => {
        const { sink, getBytesWritten } = createInMemoryFileSink();
        const writer = new StaxXmlWriterSyncSink(sink);
        writer.writeStartDocument();
        writeWriterTreeSync(writer, bigWriterTree);
        writer.writeEndDocument();
        return getBytesWritten();
      }).gc('inner');
    });
  });
}

function nodeStreamToWritableStream(nodeStream) {
  return new WritableStream({
    write(chunk) {
      return new Promise((resolve, reject) => {
        nodeStream.write(chunk, (error) => (error ? reject(error) : resolve()));
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        nodeStream.end((error) => (error ? reject(error) : resolve()));
      });
    },
    abort(reason) {
      nodeStream.destroy(reason);
    },
  });
}

async function writeBooksAsync(outputPath, count) {
  const { createWriteStream } = await import('node:fs');
  const fileStream = createWriteStream(outputPath);
  const writer = new StaxXmlWriter(nodeStreamToWritableStream(fileStream), {
    prettyPrint: true,
    indentString: '  ',
    bufferSize: 64 * 1024,
    enableAutoFlush: true,
  });

  await writer.writeStartDocument();
  await writer.writeStartElement('books');

  for (let index = 0; index < count; index++) {
    const bookId = index + 1;
    await writer.writeStartElement('book', { attributes: { id: `book-${bookId}` } });
    await writer.writeStartElement('title');
    await writer.writeCharacters(`Sample Book Title Number ${bookId} - Lorem ipsum dolor sit amet, consectetur adipiscing elit`);
    await writer.writeEndElement();
    await writer.writeStartElement('author');
    await writer.writeCharacters(`Author Name ${bookId}`);
    await writer.writeEndElement();
    await writer.writeEndElement();

    if (bookId % 1000 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  await writer.writeEndElement();
  await writer.writeEndDocument();
  await writer.flush();
}

function writeBooksSync(count) {
  const writer = new StaxXmlWriterSync({ prettyPrint: true, indentString: '  ' });
  writer.writeStartDocument();
  writer.writeStartElement('books');
  for (let index = 0; index < count; index++) {
    const bookId = index + 1;
    writer.writeStartElement('book', { attributes: { id: `book-${bookId}` } });
    writer.writeStartElement('title');
    writer.writeCharacters(`Sample Book Title Number ${bookId} - Lorem ipsum dolor sit amet, consectetur adipiscing elit`);
    writer.writeEndElement();
    writer.writeStartElement('author');
    writer.writeCharacters(`Author Name ${bookId}`);
    writer.writeEndElement();
    writer.writeEndElement();
  }
  writer.writeEndElement();
  writer.writeEndDocument();
  return writer.getXmlString();
}

function createInMemoryFileSink() {
  let bytesWritten = 0;

  return {
    sink: {
      write(chunk) {
        bytesWritten += Buffer.byteLength(chunk);
      },
      flush() {},
      close() {},
    },
    getBytesWritten: () => bytesWritten,
  };
}

function writeBooksSyncSink(count) {
  const { sink, getBytesWritten } = createInMemoryFileSink();
  const writer = new StaxXmlWriterSyncSink(sink, {
    prettyPrint: true,
    indentString: '  ',
    bufferSize: 64 * 1024,
    enableAutoFlush: true,
    flushThreshold: 0.8,
    flushOnClose: true,
  });

  writer.writeStartDocument();
  writer.writeStartElement('books');
  for (let index = 0; index < count; index++) {
    const bookId = index + 1;
    writer.writeStartElement('book', { attributes: { id: `book-${bookId}` } });
    writer.writeStartElement('title');
    writer.writeCharacters(`Sample Book Title Number ${bookId} - Lorem ipsum dolor sit amet, consectetur adipiscing elit`);
    writer.writeEndElement();
    writer.writeStartElement('author');
    writer.writeCharacters(`Author Name ${bookId}`);
    writer.writeEndElement();
    writer.writeEndElement();
  }
  writer.writeEndElement();
  writer.writeEndDocument();
  writer.close();
  return getBytesWritten();
}

function registerAsyncWriterSuite() {
  const asyncPath1k = join(tmpdir(), 'stax-xml-bench-async-1k.xml');
  const syncPath1k = join(tmpdir(), 'stax-xml-bench-sync-1k.xml');
  const asyncPath5k = join(tmpdir(), 'stax-xml-bench-async-5k.xml');
  const syncPath5k = join(tmpdir(), 'stax-xml-bench-sync-5k.xml');
  const asyncPath10k = join(tmpdir(), 'stax-xml-bench-async-10k.xml');
  const syncPath10k = join(tmpdir(), 'stax-xml-bench-sync-10k.xml');

  barplot(() => {
    summary(() => {
      bench('async writer (1K elements)', async () => {
        await writeBooksAsync(asyncPath1k, 1000);
      }).gc('inner');

      bench('sync writer (1K elements)', () => {
        writeFileSync(syncPath1k, writeBooksSync(1000));
      }).gc('inner');

      bench('sync writer sink in-memory (1K elements)', () => {
        writeBooksSyncSink(1000);
      }).gc('inner');

      bench('async writer (5K elements)', async () => {
        await writeBooksAsync(asyncPath5k, 5000);
      }).gc('inner');

      bench('sync writer (5K elements)', () => {
        writeFileSync(syncPath5k, writeBooksSync(5000));
      }).gc('inner');

      bench('sync writer sink in-memory (5K elements)', () => {
        writeBooksSyncSink(5000);
      }).gc('inner');

      bench('async writer (10K elements)', async () => {
        await writeBooksAsync(asyncPath10k, 10000);
      }).gc('inner');

      bench('sync writer (10K elements)', () => {
        writeFileSync(syncPath10k, writeBooksSync(10000));
      }).gc('inner');

      bench('sync writer sink in-memory (10K elements)', () => {
        writeBooksSyncSink(10000);
      }).gc('inner');
    });
  });
}

export const manifest = [
  {
    id: 'parser-2kb',
    title: 'Parser 2KB (complex.xml)',
    run: () => runSuite('parser-2kb', 'Parser 2KB (complex.xml)', () => registerParserSyncSuite(loadXmlFile(ASSET_PATHS.complex)), true),
  },
  {
    id: 'parser-4kb',
    title: 'Parser 4KB (books.xml)',
    run: () => runSuite('parser-4kb', 'Parser 4KB (books.xml)', () => registerParserSyncSuite(loadXmlFile(ASSET_PATHS.books)), true),
  },
  {
    id: 'parser-13mb',
    title: 'Parser 13MB (midsize.xml)',
    run: () => runSuite('parser-13mb', 'Parser 13MB (midsize.xml)', () => registerParserSyncSuite(loadXmlFile(ASSET_PATHS.midsize)), true),
  },
  {
    id: 'parser-98mb',
    title: 'Parser 98MB (large.xml)',
    run: () => runSuite('parser-98mb', 'Parser 98MB (large.xml)', () => registerParserSyncSuite(loadXmlFile(ASSET_PATHS.large)), true),
  },
  {
    id: 'async-size',
    title: 'Async parser size comparison',
    run: () => runSuite('async-size', 'Async parser size comparison', () => registerAsyncParserSizeSuite(false), true),
  },
  {
    id: 'writer-small',
    title: 'Writer small documents',
    run: () => runSuite('writer-small', 'Writer small documents', registerWriterSmallSuite, true),
  },
  {
    id: 'writer-big',
    title: 'Writer large documents',
    run: () => runSuite('writer-big', 'Writer large documents', registerWriterBigSuite, true),
  },
  {
    id: 'writer-async',
    title: 'Writer async vs sync',
    run: () => runSuite('writer-async', 'Writer async vs sync', registerAsyncWriterSuite, true),
  },
  {
    id: 'writer-1gb',
    title: 'Writer 1GiB async vs sync sink',
    run: () => Promise.resolve(normalizeWriter1gbSuiteResultFromRawFile(join(rawDir, 'writer-1gb.json'))),
  },
  {
    id: 'converter-parity',
    title: 'Converter API vs Plain Parser',
    run: () => {
      const rawFile = join(rawDir, 'converter-parity.json');
      runCommand('pnpm', [
        '--filter=benchmark',
        'run',
        'dev:converter:plain-output',
        '--',
        '--format',
        'json',
        '--out',
        'results/release/raw/converter-parity.json',
      ]);
      return Promise.resolve(normalizeSuiteResultFromRawFile('converter-parity', 'Converter API vs Plain Parser', rawFile));
    },
  },
];

function suiteCase(summary, suiteId, label) {
  const suite = summary.suites[suiteId];
  if (!suite) throw new Error(`Missing suite: ${suiteId}`);
  const found = suite.cases.find((entry) => entry.label === label);
  if (!found) throw new Error(`Missing benchmark case: ${suiteId} / ${label}`);
  return found;
}

function renderParserTable(summary, suiteId, rows) {
  return [
    '| Library | Average Time | Operations/sec | Memory Usage | Notes |',
    '|---------|--------------|----------------|--------------|-------|',
    ...rows.map((row) => {
      const stats = suiteCase(summary, suiteId, row.label);
      return `| ${row.display} | ${formatDurationNsCompact(stats.avgNs)} | ${formatOps(stats.avgNs)} | ${formatMemory(stats.heapAvgBytes)} | ${row.notes} |`;
    }),
  ].join('\n');
}

function renderAsyncSizeTable(summary) {
  const rows = [
    ['1MB', 'sync parser (1MB)', 'Baseline'],
    ['1MB', 'async parser (1MB)', null],
    ['10MB', 'sync parser (10MB)', 'Baseline'],
    ['10MB', 'async parser (10MB)', null],
    ['100MB', 'sync parser (100MB)', 'Baseline'],
    ['100MB', 'async parser (100MB)', null],
    ['1GB', 'async parser (1GB)', 'Memory efficient'],
  ];

  return [
    '| File Size | Parser Type | Processing Time | Memory Usage | Performance Ratio |',
    '|-----------|-------------|-----------------|--------------|-------------------|',
    ...rows.map(([size, label, ratioNote]) => {
      const stats = suiteCase(summary, 'async-size', label);
      const ratio = ratioNote ?? `${(stats.avgNs / suiteCase(summary, 'async-size', `sync parser (${size})`).avgNs).toFixed(2)}x slower`;
      const type = label.startsWith('sync') ? '**sync parser**' : 'async parser';
      return `| ${size} | ${type} | ${formatDurationNsCompact(stats.avgNs)} | ${formatMemory(stats.heapAvgBytes)} | ${ratio} |`;
    }),
  ].join('\n');
}

function renderConverterTable(summary) {
  const rows = [
    ['plain parser', 'Lowest overhead, handwritten state machine'],
    ['converter api', 'Declarative but uncompiled'],
    ['converter api compiled', 'Declarative schema with compiled root processor'],
  ];

  return [
    '| Implementation | Average time | Notes |',
    '| --- | ---: | --- |',
    ...rows.map(([label, notes]) => {
      const stats = suiteCase(summary, 'converter-parity', label);
      return `| ${label} | **${formatDurationNsCompact(stats.avgNs)}** | ${notes} |`;
    }),
  ].join('\n');
}

function renderWriterSmallTable(summary) {
  const rows = [
    ['fast-xml-parser builder', 'fast-xml-parser builder'],
    ['stax-xml writer', 'Writer API'],
    ['stax-xml writer sync', 'Sync writer API'],
    ['stax-xml writer sync sink', 'Sync streaming sink API'],
    ['xml2js builder', 'xml2js builder'],
  ];
  const fastestLabel = rows
    .map(([label]) => [label, suiteCase(summary, 'writer-small', label).avgNs])
    .sort((a, b) => a[1] - b[1])[0][0];

  return [
    '| Library | Average Time | Operations/sec | Memory Usage | Notes |',
    '|---------|--------------|----------------|--------------|-------|',
    ...rows.map(([label, notes]) => {
      const stats = suiteCase(summary, 'writer-small', label);
      const display = label === 'fast-xml-parser builder' ? '**fast-xml-parser builder**'
        : label === 'stax-xml writer sync' ? '**stax-xml writer sync**'
        : label === 'stax-xml writer sync sink' ? '**stax-xml writer sync sink**'
        : label;
      const resolvedNotes = label === fastestLabel && notes !== 'Fastest'
        ? `Fastest, ${notes}`
        : label === fastestLabel
          ? 'Fastest'
          : notes;
      return `| ${display} | ${formatDurationNsCompact(stats.avgNs)} | ${formatOps(stats.avgNs)} | ${formatMemory(stats.heapAvgBytes)} | ${resolvedNotes} |`;
    }),
  ].join('\n');
}

function renderWriterBigTable(summary) {
  const rows = [
    ['fast-xml-parser builder (big.json)', 'fast-xml-parser builder'],
    ['stax-xml writer sync (big.json)', 'Sync writer API'],
    ['stax-xml writer sync sink (big.json)', 'Sync streaming sink API'],
    ['stax-xml writer (big.json)', 'Writer API'],
  ];
  const fastestLabel = rows
    .map(([label]) => [label, suiteCase(summary, 'writer-big', label).avgNs])
    .sort((a, b) => a[1] - b[1])[0][0];

  return [
    '| Library | Average Time | Operations/sec | Memory Usage | Notes |',
    '|---------|--------------|----------------|--------------|-------|',
    ...rows.map(([label, notes]) => {
      const stats = suiteCase(summary, 'writer-big', label);
      const display = label === 'fast-xml-parser builder (big.json)' ? '**fast-xml-parser builder**'
        : label === 'stax-xml writer sync (big.json)' ? '**stax-xml writer sync**'
        : label === 'stax-xml writer sync sink (big.json)' ? '**stax-xml writer sync sink**'
        : 'stax-xml writer';
      const resolvedNotes = label === fastestLabel && notes !== 'Fastest'
        ? `Fastest, ${notes}`
        : label === fastestLabel
          ? 'Fastest'
          : notes;
      return `| ${display} | ${formatDurationNsCompact(stats.avgNs)} | ${formatOps(stats.avgNs)} | ${formatMemory(stats.heapAvgBytes)} | ${resolvedNotes} |`;
    }),
  ].join('\n');
}

function renderAsyncWriterTable(summary) {
  const elementCounts = [
    ['1K elements', 'async writer (1K elements)', 'sync writer (1K elements)', 'sync writer sink in-memory (1K elements)'],
    ['5K elements', 'async writer (5K elements)', 'sync writer (5K elements)', 'sync writer sink in-memory (5K elements)'],
    ['10K elements', 'async writer (10K elements)', 'sync writer (10K elements)', 'sync writer sink in-memory (10K elements)'],
  ];

  return [
    '| Element Count | Async Writer | Sync Writer + File | Sync Writer + Sink | Performance Ratio |',
    '|---------------|--------------|--------------------|--------------------|-------------------|',
    ...elementCounts.map(([label, asyncLabel, syncLabel, sinkLabel]) => {
      const asyncStats = suiteCase(summary, 'writer-async', asyncLabel);
      const syncStats = suiteCase(summary, 'writer-async', syncLabel);
      const sinkStats = suiteCase(summary, 'writer-async', sinkLabel);
      return `| ${label} | ${formatDurationNsCompact(asyncStats.avgNs)} | ${formatDurationNsCompact(syncStats.avgNs)} | ${formatDurationNsCompact(sinkStats.avgNs)} | ${(asyncStats.avgNs / sinkStats.avgNs).toFixed(2)}x faster (sink) |`;
    }),
  ].join('\n');
}

function renderWriter1gbTable(summary) {
  const rows = [
    ['async writer memory WritableStream', 'Async writer + memory WritableStream'],
    ['sync writer sink memory', 'Sync sink writer + memory sink'],
    ['async writer temp file', 'Async writer + temp file'],
    ['sync writer sink temp file', 'Sync sink writer + temp file'],
  ];

  return [
    '| Target | Time | Throughput | Peak Heap | Peak RSS | Written | Records |',
    '|--------|-----:|-----------:|----------:|---------:|--------:|--------:|',
    ...rows.map(([label, display]) => {
      const stats = suiteCase(summary, 'writer-1gb', label);
      const resolvedDisplay = label.startsWith('sync writer sink') ? `**${display}**` : display;
      return `| ${resolvedDisplay} | ${formatDurationNsCompact(stats.avgNs)} | ${stats.throughputMiBs.toFixed(2)} MiB/s | ${formatMemory(stats.heapAvgBytes)} | ${formatMemory(stats.rssPeakBytes)} | ${formatMemory(stats.bytesWritten)} | ${stats.records.toLocaleString()} |`;
    }),
  ].join('\n');
}

function readJsonIfExists(path) {
  if (!existsSync(path)) {
    return undefined;
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function formatRate(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} MiB/s` : 'n/a';
}

function formatMs(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)} ms` : 'n/a';
}

function formatPct(value) {
  return Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%` : 'n/a';
}

function renderRuntimeMatrixTable(runtimeMatrix) {
  return [
    '| Runtime | Version | Scenario | Throughput | Average | Checksum |',
    '| --- | --- | --- | ---: | ---: | ---: |',
    ...runtimeMatrix.results.flatMap((result) => {
      if (result.status !== 'ok') {
        return [`| ${result.runtime.id} | n/a | n/a | n/a | n/a | ${result.status} |`];
      }
      return result.scenarios.map((scenario) =>
        `| ${result.runtime.id} | ${result.runtime.version} | ${scenario.id} | ${formatRate(scenario.mibPerSec)} | ${formatMs(scenario.avgMs)} | ${scenario.checksum} |`
      );
    }),
  ].join('\n');
}

function findScenario(tier, id) {
  return tier.scenarios.find((scenario) => scenario.id === id);
}

function renderCrossRuntimeTable(crossRuntime) {
  const tiers = crossRuntime.nodeStringReturn.files[0].tiers;
  return [
    '| Tier | stax-xml on Node | Woodstox on Java 8 | quick-xml | Node/Woodstox | Node/quick-xml |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...tiers.map((tier) => {
      const node = findScenario(tier, 'node');
      const woodstox = findScenario(tier, 'woodstox');
      const quickXml = findScenario(tier, 'quick-xml');
      const nodeWoodstox = node?.mibPerSec && woodstox?.mibPerSec ? `${(node.mibPerSec / woodstox.mibPerSec).toFixed(2)}x` : 'n/a';
      const nodeQuickXml = node?.mibPerSec && quickXml?.mibPerSec ? `${(node.mibPerSec / quickXml.mibPerSec).toFixed(2)}x` : 'n/a';
      return `| ${tier.id} | ${formatRate(node?.mibPerSec)} | ${formatRate(woodstox?.mibPerSec)} | ${formatRate(quickXml?.mibPerSec)} | ${nodeWoodstox} | ${nodeQuickXml} |`;
    }),
  ].join('\n');
}

function renderJava25Table(crossRuntime) {
  const rows = crossRuntime.java25Verification.tiers;
  if (rows.length === 0) {
    return `Java 25 verification was skipped: ${crossRuntime.java25Verification.reason}`;
  }
  return [
    '| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Status |',
    '| --- | ---: | ---: | ---: | --- |',
    ...rows.map((entry) =>
      `| ${entry.tier} | ${formatRate(entry.java8MibPerSec)} | ${formatRate(entry.java25?.mibPerSec)} | ${formatPct(entry.deltaVsJava8)} | ${entry.java25?.status ?? 'skipped'} |`
    ),
  ].join('\n');
}

function createRuntimeAndNativeDirectionBlock() {
  const runtimeMatrix = readJsonIfExists(runtimeMatrixPath);
  const crossRuntime = readJsonIfExists(crossRuntimeComparisonPath);
  if (!runtimeMatrix && !crossRuntime) {
    return '';
  }

  const sections = ['## Runtime Matrix And Native Direction'];

  if (runtimeMatrix) {
    sections.push(`The same built JavaScript implementation was measured on Node, Bun, and Deno with a generated single-root ${runtimeMatrix.fixture.sizeMiB.toFixed(2)} MiB XML fixture. This is a runtime-codegen and compatibility check, not a native-addon benchmark.`);
    sections.push(renderRuntimeMatrixTable(runtimeMatrix));
  }

  if (crossRuntime) {
    sections.push('The non-JS comparator uses the same event-count and checksum contract. Woodstox is reported on Java 8 for the public baseline because Java 8 is its minimum supported runtime target; Java 25 is measured only as a verification check.');
    sections.push(renderCrossRuntimeTable(crossRuntime));
    sections.push('### Woodstox Java 25 Verification');
    sections.push(renderJava25Table(crossRuntime));
  }

  sections.push(`### Why Native Addons Are The Acceleration Path

The JavaScript parser remains the compatibility fallback, but it is not the release performance ceiling. Prior pure-JS optimization work improved the iterable event-frame backend, yet full-string workloads still stayed behind native parser baselines, especially \`quick-xml\`. The remaining costs are delimiter scanning, string materialization, and stable object/API shapes around attributes and text.

The Rust native path is intended to move the hot tokenizer and string/span aggregation work into code that can use native and SIMD-oriented scanning strategies, closer in direction to native parsers such as \`quick-xml\` and simdjson-style designs. The package topology therefore keeps \`stax-xml\` as the facade while adding optional native/Wasm acceleration packages; environments that cannot load binaries continue to use the JavaScript fallback.`);

  return `${sections.join('\n\n')}\n`;
}

function createEnglishBenchmarkBlock(summary) {
  const env = summary.environment;

  return `## Benchmark Environment

The refreshed benchmark tables on this page were rerun with:
- **CPU**: ${env.cpuName} (~${env.cpuGHz.toFixed(2)} GHz)
- **Runtime**: ${env.runtime} ${env.version} (${env.arch}) with garbage collection exposed (\`--expose-gc\`)
- **Tool**: [Mitata](https://github.com/evanw/mitata)
- **Canonical Set**: parser 2KB / 4KB / 13MB / 98MB, async size-comparison, writer small / big / async, converter parity

## Parser Performance

### Small Documents (2KB)

For typical web service responses and configuration files (complex.xml):

${renderParserTable(summary, 'parser-2kb', [
  { display: '**txml**', label: 'txml', notes: 'Fastest, lightweight' },
  { display: '**stax-xml to object**', label: 'stax-xml to object', notes: 'Object conversion' },
  { display: '**stax-xml consume**', label: 'stax-xml consume', notes: 'Stream processing' },
  { display: 'fast-xml-parser', label: 'fast-xml-parser', notes: 'DOM-based' },
  { display: 'xml2js', label: 'xml2js', notes: 'Callback-based, memory intensive' },
])}

### Medium Documents (4KB)

For larger API responses and data files (books.xml):

${renderParserTable(summary, 'parser-4kb', [
  { display: '**txml**', label: 'txml', notes: 'Fastest, lightweight' },
  { display: '**stax-xml consume**', label: 'stax-xml consume', notes: 'Stream processing' },
  { display: '**stax-xml to object**', label: 'stax-xml to object', notes: 'Object conversion' },
  { display: 'fast-xml-parser', label: 'fast-xml-parser', notes: 'Good balance' },
  { display: 'xml2js', label: 'xml2js', notes: 'Memory intensive' },
])}

### Large Documents (1MB to 1GB)

For processing large XML files (RSS feeds, data exports, etc.):

${renderAsyncSizeTable(summary)}

**Key Insights:**
- Sync parsing is the direct in-memory path; async parsing trades some scheduling overhead for flatter memory behavior.
- The relative timing can move by fixture and runtime, so the generated table is the source of truth.
- For files above 100MB, avoid the public full-string sync path when retaining the full XML string is not acceptable; use async streams for non-blocking work or the synchronous iterable byte-batch backend for blocking batch jobs.

${createRuntimeAndNativeDirectionBlock()}

### Sync Parser Library Comparison

#### Medium-Large Documents (13MB)

Performance results on midsize.xml (13MB):

${renderParserTable(summary, 'parser-13mb', [
  { display: '**xml2js**', label: 'xml2js', notes: 'Exceptional performance*' },
  { display: '**stax-xml to object**', label: 'stax-xml to object', notes: 'Object conversion' },
  { display: '**stax-xml consume**', label: 'stax-xml consume', notes: 'Stream processing' },
  { display: '**txml**', label: 'txml', notes: 'Lightweight DOM' },
  { display: 'fast-xml-parser', label: 'fast-xml-parser', notes: 'Memory intensive' },
])}

*xml2js remains an outlier on this fixture, likely because the document shape heavily favors its DOM-oriented parsing model.

#### Large Documents (98MB)

Performance results on large.xml (98MB):

${renderParserTable(summary, 'parser-98mb', [
  { display: '**stax-xml consume**', label: 'stax-xml consume', notes: 'Best overall' },
  { display: '**stax-xml to object**', label: 'stax-xml to object', notes: 'Memory efficient' },
  { display: '**txml**', label: 'txml', notes: 'High memory' },
  { display: 'fast-xml-parser', label: 'fast-xml-parser', notes: 'Slow, memory intensive' },
  { display: 'xml2js', label: 'xml2js', notes: 'Slowest performance' },
])}

## Converter API vs Plain Parser

The benchmark below compares three ways to build the **same object output**:

- A handwritten plain parser built directly on \`StaxXmlParserSync\`
- The declarative converter API
- The converter API with \`.compile()\` enabled

Current fixture:

- \`catalog\` document
- \`800\` \`<featured>\` elements
- \`800\` \`<book>\` elements
- result includes root object fields, root arrays, direct scalar fields, and transformed derived fields

${renderConverterTable(summary)}

Interpretation:

- The handwritten parser remains the raw-throughput ceiling.
- The uncompiled converter API pays a large abstraction cost.
- The compiled converter path still carries meaningful overhead, but it is faster than the uncompiled converter path on this fixture.

## Writer Performance

These builder benchmarks use a builder-friendly intermediate representation on each side.
\`fast-xml-parser\` consumes its ordered object tree directly, while the \`stax-xml\` writer benchmarks normalize the source fixture once into a writer-friendly precompiled tree outside the timed region.
The measured time therefore focuses on XML emission throughput rather than repeated JSON-shape adaptation.
The memory column is Mitata's average heap footprint for the benchmark case, so it includes fixture/tree residency and harness overhead rather than only the incremental output buffer.

### Small Document Building

Building XML documents from small JSON data:

${renderWriterSmallTable(summary)}

### Large Document Building (1MB)

Building large XML documents from big JSON data:

${renderWriterBigTable(summary)}

### Async vs Sync Writer Comparison

This comparison measures the writer APIs themselves on the same generated document shape. It includes async file output, sync string output followed by file write, and the sync sink path with an in-memory file-like target.
It is intended to show \`stax-xml\` async vs sync overhead and sink overhead, not to imply that all paths have identical durability guarantees.

${renderAsyncWriterTable(summary)}

### 1GiB Writer Comparison

This one-shot benchmark writes a 1GiB XML document through both async writer and sync sink writer paths.
It includes in-memory targets and temp-file targets to separate writer overhead from file I/O cost.

${renderWriter1gbTable(summary)}

Based on this run, \`StaxXmlWriterSyncSink\` is the recommended path for large XML file output. It provides the highest write throughput, and peak RSS stays in the same range as async writing.
`;
}

function createBenchmarkMarkdown(summary) {
  return `# Benchmarks

Generated: ${summary.generatedAt}

Environment:
- CPU: ${summary.environment.cpuName} (~${summary.environment.cpuGHz.toFixed(2)} GHz)
- Runtime: ${summary.environment.runtime} ${summary.environment.version} (${summary.environment.arch})

This report is generated from the canonical release benchmark set. The docs benchmark pages are derived from the same raw JSON results.

${createEnglishBenchmarkBlock(summary)}
`;
}

async function main() {
  const args = parseArgs();
  mkdirSync(rawDir, { recursive: true });

  const suites = {};
  for (const entry of manifest) {
    if (args.only && !args.only.has(entry.id)) {
      continue;
    }
    suites[entry.id] = await entry.run();
  }

  const firstSuite = Object.values(suites)[0];
  if (!firstSuite) {
    throw new Error('No benchmark suites were selected');
  }
  const ranFullCanonicalSet = Object.keys(suites).length === manifest.length;

  if (ranFullCanonicalSet) {
    await aggregateReleaseBenchmarks({ verbose: args.verbose });
  }

  if (args.verbose) {
    if (ranFullCanonicalSet) {
      console.log('\nRaw benchmark execution complete.');
    } else {
      console.log('\nRaw benchmark execution complete. Skipped summary/BENCHMARK generation because only a subset of the canonical set was run.');
    }
  }
}

export async function aggregateReleaseBenchmarks({ verbose = true } = {}) {
  const suites = {};
  for (const entry of manifest) {
    const rawFile = join(rawDir, `${entry.id}.json`);
    suites[entry.id] = entry.id === 'writer-1gb'
      ? normalizeWriter1gbSuiteResultFromRawFile(rawFile)
      : normalizeSuiteResultFromRawFile(entry.id, entry.title, rawFile);
  }
  const firstSuite = Object.values(suites)[0];
  if (!firstSuite) {
    throw new Error('No canonical benchmark results found');
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    environment: firstSuite.context,
    suites,
  };

  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeFileSync(benchmarkMarkdownPath, `${createBenchmarkMarkdown(summary)}\n`, 'utf8');

  if (verbose) {
    console.log(`Wrote summary JSON to ${summaryPath}`);
    console.log(`Updated ${benchmarkMarkdownPath}`);
  }

  return summary;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
