import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpus } from 'node:os';
import { dirname, join, parse, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { Parser as HtmlParser } from 'htmlparser2';
import { barplot, bench, run, summary as mitataSummary } from 'mitata';
import sax from 'sax';
import { SaxesParser } from 'saxes';
import { Builder } from 'xml2js';
import xml2js from 'xml2js';
import * as txml from 'txml';
import {
  StreamReaderSync,
  EventReaderSync,
  Writer,
  WriterSync,
  WriterSyncSink,
  XmlEventType,
} from 'stax-xml';
import {
  assertParserSurfaceParity,
  createStaxParserSurfaceRunners,
} from './common/parser-scenarios.mjs';
import {
  normalizeFxpWriterTree,
  normalizeOrderedWriterTree,
  writeWriterTreeAsync,
  writeWriterTreeSync,
} from './common/writer-tree.mjs';
import { ASSET_PATHS, loadJsonFile, loadXmlBuffer } from './common/utils.mjs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const benchmarkDir = resolve(__dirname);
const resultsDir = join(benchmarkDir, 'results', 'release');
const rawDir = join(resultsDir, 'raw');
const summaryPath = join(resultsDir, 'latest-summary.json');
const benchmarkMarkdownPath = join(repoRoot, 'BENCHMARK.md');
const runtimeMatrixPath = join(resultsDir, 'runtime-matrix.json');
const readerCrossRuntimePath = join(resultsDir, 'reader-cross-runtime.json');
const writerCrossRuntimePath = join(resultsDir, 'writer-cross-runtime.json');
const streamReader4GiBPath = join(resultsDir, 'stream-reader-4gb.json');
const converterBatchPlanPath = join(resultsDir, 'converter-compiled-batch-plan.json');
const writer1GiBRawPath = join(rawDir, 'writer-1gb.json');
const benchmarkPackageJsonPath = join(benchmarkDir, 'package.json');
const staxPackageJsonPath = join(repoRoot, 'packages', 'stax-xml', 'package.json');
const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

const streamSizeCases = [
  { display: '1MiB', targetBytes: MIB, warmups: 1, runs: 3 },
  { display: '10MiB', targetBytes: 10 * MIB, warmups: 1, runs: 3 },
  { display: '100MiB', targetBytes: 100 * MIB, warmups: 1, runs: 3 },
  { display: '1GiB', targetBytes: GIB, warmups: 0, runs: 3 },
];

const parser98MbMitataOptions = {
  min_samples: 3,
  min_cpu_time: 128 * 1e6,
};

function createReleaseRunId(date = new Date()) {
  return date.toISOString().replaceAll(':', '-').replace('.', '-');
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function readRequiredJson(filePath, command) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing release benchmark artifact: ${filePath}\nRun ${command} first.`);
  }
  return readJson(filePath);
}

function writeJson(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function commandVersion(command, args) {
  const candidates = process.platform === 'win32'
    ? [`${command}.cmd`, command]
    : [command];

  for (const candidate of candidates) {
    const result = spawnSync(candidate, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.status === 0) {
      return `${result.stdout}\n${result.stderr}`
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean) ?? null;
    }
  }

  return null;
}

function packageJsonPathFor(packageName) {
  if (packageName === 'stax-xml') return staxPackageJsonPath;

  try {
    return require.resolve(`${packageName}/package.json`);
  } catch {
    try {
      return findNearestPackageJson(require.resolve(packageName));
    } catch {
      return null;
    }
  }
}

function findNearestPackageJson(startPath) {
  let current = dirname(startPath);
  const root = parse(current).root;

  while (current && current !== root) {
    const candidate = join(current, 'package.json');
    if (existsSync(candidate)) return candidate;
    current = dirname(current);
  }

  return null;
}

function collectBenchmarkPackageVersions() {
  const benchmarkPackage = readJson(benchmarkPackageJsonPath);
  const declared = {
    ...(benchmarkPackage.dependencies ?? {}),
    ...(benchmarkPackage.devDependencies ?? {}),
  };

  return Object.entries(declared)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, range]) => {
      const packagePath = packageJsonPathFor(name);
      if (!packagePath || !existsSync(packagePath)) {
        return { name, declared: range, version: null, source: 'unresolved', status: 'missing' };
      }
      const packageJson = readJson(packagePath);
      return {
        name,
        declared: range,
        version: packageJson.version ?? null,
        source: name === 'stax-xml' ? 'workspace' : 'npm',
        status: 'ok',
      };
    });
}

function collectEnvironment() {
  const cpu = cpus()[0];
  const pnpmVersion = process.env.npm_config_user_agent?.match(/pnpm\/([^\s]+)/)?.[1]
    ?? commandVersion('pnpm', ['--version']);
  return {
    arch: `${process.arch}-${process.platform}`,
    runtime: 'node',
    version: process.versions.node,
    cpuName: cpu?.model ?? 'unknown',
    cpuGHz: Number(((cpu?.speed ?? 0) / 1000).toFixed(2)),
    packageManager: pnpmVersion ? `pnpm@${pnpmVersion}` : null,
    packages: collectBenchmarkPackageVersions(),
    nodeComponents: Object.entries(process.versions)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, version]) => ({ name, version })),
  };
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

async function runMitataSuite(id, title, registerSuite, runOptions = {}) {
  console.log(`\n== ${title} ==`);
  await registerSuite();
  const result = await run({ format: 'quiet', throw: true, ...runOptions });
  writeJson(join(rawDir, `${id}.json`), result);
  return normalizeSuiteResult(id, title, result);
}

async function registerParserSyncSuite(assetPath) {
  const inputBuffer = loadXmlBuffer(assetPath);
  const xmlString = inputBuffer.toString('utf8');
  await assertParserSurfaceParity({ assetPath, xmlString, inputBuffer });
  const staxSurfaceRunners = createStaxParserSurfaceRunners({ assetPath, xmlString, inputBuffer });

  barplot(() => {
    mitataSummary(() => {
      for (const scenario of staxSurfaceRunners) {
        bench(scenario.label, scenario.run).gc('inner');
      }
    });
  });
}

async function registerNpmXmlParserSuite() {
  const inputBuffer = loadXmlBuffer(ASSET_PATHS.books);
  const xmlString = inputBuffer.toString('utf8');
  await assertParserSurfaceParity({ assetPath: ASSET_PATHS.books, xmlString, inputBuffer });

  barplot(() => {
    mitataSummary(() => {
      bench('stax-xml EventReaderSync (JS event checksum)', () => consumeStaxEventReader(xmlString)).gc('inner');
      bench('stax-xml StreamReaderSync (JS event checksum)', () => consumeStaxStreamReader(inputBuffer)).gc('inner');
      bench('fast-xml-parser XMLParser', () => checksumJson(new XMLParser({ ignoreAttributes: false }).parse(xmlString))).gc('inner');
      bench('txml parse', () => checksumJson(txml.parse(xmlString))).gc('inner');
      bench('xml2js parseString', async () => checksumJson(await parseXml2js(xmlString))).gc('inner');
      bench('sax strict event parser', () => consumeSax(xmlString)).gc('inner');
      bench('saxes event parser', () => consumeSaxes(xmlString)).gc('inner');
      bench('htmlparser2 xmlMode parser', () => consumeHtmlparser2(xmlString)).gc('inner');
    });
  });
}

function consumeStaxEventReader(xmlString) {
  let checksum = 2166136261;
  let events = 0;
  for (const event of new EventReaderSync(xmlString, { autoDecodeEntities: false, documentMode: 'fragment' })) {
    events++;
    checksum = mixChecksum(checksum, event.type);
    if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
      checksum = foldString(checksum, event.name ?? event.localName ?? '');
    }
    if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
      checksum = foldString(checksum, event.value ?? '');
    }
    if (event.type === XmlEventType.START_ELEMENT) {
      for (const attribute of event.attributes ?? []) {
        checksum = foldString(checksum, attribute.name);
        checksum = foldString(checksum, attribute.value);
      }
    }
  }
  return checksum ^ events;
}

function consumeStaxStreamReader(inputBuffer) {
  const reader = new StreamReaderSync(inputBuffer, { documentMode: 'fragment' });
  let checksum = 2166136261;
  let events = 0;

  while (reader.next()) {
    const type = reader.eventType();
    events++;
    checksum = foldStreamReaderEvent(reader, type, checksum);
  }

  return checksum ^ events;
}

function parseXml2js(xmlString) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xmlString, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function consumeSax(xmlString) {
  const parser = sax.parser(true, { trim: false, normalize: false });
  let checksum = 2166136261;
  parser.onopentag = (node) => {
    checksum = foldString(mixChecksum(checksum, 1), node.name);
    for (const [name, value] of Object.entries(node.attributes ?? {})) {
      checksum = foldString(foldString(checksum, name), String(value));
    }
  };
  parser.ontext = (text) => {
    if (!isWhitespace(text)) checksum = foldString(mixChecksum(checksum, 2), text);
  };
  parser.onclosetag = (name) => {
    checksum = foldString(mixChecksum(checksum, 3), name);
  };
  parser.write(xmlString).close();
  return checksum;
}

function consumeSaxes(xmlString) {
  const parser = new SaxesParser({ xmlns: false });
  let checksum = 2166136261;
  parser.on('opentag', (node) => {
    checksum = foldString(mixChecksum(checksum, 1), node.name);
    for (const [name, value] of Object.entries(node.attributes ?? {})) {
      checksum = foldString(foldString(checksum, name), String(value));
    }
  });
  parser.on('text', (text) => {
    if (!isWhitespace(text)) checksum = foldString(mixChecksum(checksum, 2), text);
  });
  parser.on('closetag', (name) => {
    checksum = foldString(mixChecksum(checksum, 3), typeof name === 'string' ? name : name.name);
  });
  parser.write(xmlString).close();
  return checksum;
}

function consumeHtmlparser2(xmlString) {
  let checksum = 2166136261;
  const parser = new HtmlParser({
    onopentag(name, attributes) {
      checksum = foldString(mixChecksum(checksum, 1), name);
      for (const [attrName, attrValue] of Object.entries(attributes ?? {})) {
        checksum = foldString(foldString(checksum, attrName), String(attrValue));
      }
    },
    ontext(text) {
      if (!isWhitespace(text)) checksum = foldString(mixChecksum(checksum, 2), text);
    },
    onclosetag(name) {
      checksum = foldString(mixChecksum(checksum, 3), name);
    },
  }, { xmlMode: true });
  parser.write(xmlString);
  parser.end();
  return checksum;
}

function checksumJson(value) {
  return foldString(2166136261, JSON.stringify(value));
}

function isWhitespace(value) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code !== 32 && code !== 9 && code !== 10 && code !== 13) return false;
  }
  return true;
}

function mixChecksum(seed, value) {
  let hash = (seed ^ Number(value)) >>> 0;
  hash = Math.imul(hash, 16777619) >>> 0;
  return hash;
}

function foldString(seed, value) {
  let hash = seed >>> 0;
  const text = String(value ?? '');
  hash = mixChecksum(hash, text.length);
  for (let index = 0; index < text.length; index++) {
    hash = mixChecksum(hash, text.charCodeAt(index));
  }
  return hash;
}

function foldStreamReaderEvent(reader, type, checksum) {
  checksum = mixChecksum(checksum, type);
  if (type === XmlEventType.START_ELEMENT || type === XmlEventType.END_ELEMENT) {
    checksum = foldString(checksum, reader.name());
  }
  if (type === XmlEventType.CHARACTERS || type === XmlEventType.CDATA) {
    checksum = foldString(checksum, reader.text());
  }
  if (type === XmlEventType.START_ELEMENT) {
    const attributeCount = reader.attributeCount();
    checksum = mixChecksum(checksum, attributeCount);
    for (let attributeIndex = 0; attributeIndex < attributeCount; attributeIndex++) {
      checksum = foldString(checksum, reader.attributeName(attributeIndex));
      checksum = foldString(checksum, reader.attributeValue(attributeIndex));
    }
  }
  return checksum;
}

function measureStreamSizeCase(fixtureCase) {
  const row = new TextEncoder().encode(
    '<person id="123"><name>Jane Doe</name><age>42</age></person>',
  );
  const actualBytes = Math.ceil(fixtureCase.targetBytes / row.byteLength) * row.byteLength;

  for (let index = 0; index < fixtureCase.warmups; index++) {
    consumeCursorSize(row, fixtureCase.targetBytes);
  }

  const timesMs = [];
  const heapDeltas = [];
  let last;

  globalThis.gc?.();
  const memoryBaseline = process.memoryUsage();
  const heapBaselineBytes = memoryBaseline.heapUsed;
  const rssBaselineBytes = memoryBaseline.rss;
  let heapPeakBytes = heapBaselineBytes;
  let rssPeakBytes = rssBaselineBytes;

  for (let index = 0; index < fixtureCase.runs; index++) {
    globalThis.gc?.();
    const before = process.memoryUsage();
    const startedAt = performance.now();
    last = consumeCursorSize(row, fixtureCase.targetBytes);
    const elapsedMs = performance.now() - startedAt;
    const after = process.memoryUsage();
    timesMs.push(elapsedMs);
    heapDeltas.push(after.heapUsed - before.heapUsed);
    heapPeakBytes = Math.max(heapPeakBytes, after.heapUsed);
    rssPeakBytes = Math.max(rssPeakBytes, after.rss);
  }

  const avgMs = average(timesMs);
  return {
    label: `StreamReaderSync iterable chunks (${fixtureCase.display} generated chunks)`,
    avgNs: avgMs * 1e6,
    minNs: Math.min(...timesMs) * 1e6,
    p75Ns: percentile(timesMs, 0.75) * 1e6,
    p99Ns: percentile(timesMs, 0.99) * 1e6,
    maxNs: Math.max(...timesMs) * 1e6,
    heapAvgBytes: average(heapDeltas),
    heapBaselineBytes,
    heapPeakBytes,
    heapDeltaBytes: heapPeakBytes - heapBaselineBytes,
    rssBaselineBytes,
    rssPeakBytes,
    rssDeltaBytes: rssPeakBytes - rssBaselineBytes,
    bytes: actualBytes,
    events: last.events,
    checksum: last.checksum,
    throughputMiBs: (actualBytes / MIB) / (avgMs / 1000),
  };
}

function measureStreamSizeCaseIsolated(fixtureCase) {
  const result = spawnSync(
    process.execPath,
    ['--expose-gc', fileURLToPath(import.meta.url), '--stream-size-case', fixtureCase.display],
    { cwd: benchmarkDir, encoding: 'utf8', windowsHide: true },
  );
  if (result.status !== 0) {
    throw new Error(`Stream-size worker failed for ${fixtureCase.display}:\n${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

function consumeCursorSize(row, targetBytes) {
  const reader = new StreamReaderSync(byteChunks(row, targetBytes), { documentMode: 'fragment' });
  let events = 0;
  let checksum = 2166136261;

  while (reader.next()) {
    const type = reader.eventType();
    events++;
    checksum = foldStreamReaderEvent(reader, type, checksum);
  }

  return { events, checksum };
}

function* byteChunks(row, targetBytes) {
  let emittedBytes = 0;
  while (emittedBytes < targetBytes) {
    yield row;
    emittedBytes += row.byteLength;
  }
}

function normalizeStreamReader4GiBCase(raw) {
  const result = raw.results.find((entry) => entry.style === 'iterable-cursor') ?? raw.results[0];
  return {
    label: 'StreamReaderSync iterable chunks (4GiB generated chunks)',
    avgNs: result.avgMs * 1e6,
    minNs: result.minMs * 1e6,
    p75Ns: result.avgMs * 1e6,
    p99Ns: result.maxMs * 1e6,
    maxNs: result.maxMs * 1e6,
    heapAvgBytes: result.memory?.avgHeapUsedDeltaBytes ?? null,
    heapDeltaBytes: result.memory?.heapUsedDeltaBytes ?? result.memory?.avgHeapUsedDeltaBytes ?? null,
    rssDeltaBytes: result.memory?.rssDeltaBytes ?? result.memory?.avgRssDeltaBytes ?? result.avgRssDelta ?? null,
    bytes: raw.fixture.actualBytes,
    events: result.events,
    checksum: result.checksum,
    throughputMiBs: result.avgMiBs,
  };
}

function normalizeWriterCrossRuntimeSuite(raw) {
  return {
    context: {
      collectedAt: raw.generatedAt,
      workload: raw.workload,
      environment: raw.environment,
    },
    cases: Object.entries(raw.cases).map(([label, runs]) => ({
      label,
      avgNs: percentile(runs.map((run) => run.seconds * 1e9), 0.5),
      throughputMiBs: percentile(runs.map((run) => run.throughputMiBs), 0.5),
      bytes: runs[0]?.bytes ?? raw.workload.outputBytes,
      records: runs[0]?.records ?? raw.workload.records,
      runs: runs.length,
    })),
  };
}

function normalizeReaderCrossRuntimeSuite(raw) {
  return {
    context: {
      collectedAt: raw.generatedAt,
      fixture: raw.fixture,
      environment: raw.environment,
    },
    cases: Object.entries(raw.cases).map(([label, runs]) => ({
      label,
      avgNs: percentile(runs.map((run) => run.seconds * 1e9), 0.5),
      throughputMiBs: percentile(runs.map((run) => run.throughputMiBs), 0.5),
      events: runs[0]?.events,
      checksum: runs[0]?.checksum,
      runs: runs.length,
    })),
  };
}

function runStreamSizeSuite() {
  console.log('\n== StreamReaderSync iterable chunk size series ==');
  const cases = streamSizeCases.map(measureStreamSizeCaseIsolated);
  const stream4GiB = readRequiredJson(
    streamReader4GiBPath,
    'pnpm --filter benchmark run release:stream-reader:4gb',
  );
  cases.push(normalizeStreamReader4GiBCase(stream4GiB));
  const raw = {
    id: 'stream-size',
    title: 'StreamReaderSync iterable chunk size comparison',
    generatedAt: new Date().toISOString(),
    cases,
  };
  writeJson(join(rawDir, 'stream-size.json'), raw);
  return raw;
}

function normalizeConverterSuiteFromFile(filePath) {
  const raw = readRequiredJson(
    filePath,
    'pnpm --filter benchmark run release:converter:compiled-batch',
  );
  const labels = {
    'manual-cursor-reader-sync': 'Manual StreamReaderSync projection',
    'converter-auto-compiled-batch-plan': 'Converter schema.parseSync(bytes)',
  };

  return {
    id: 'converter-parity',
    title: 'Converter compiled batch-plan comparison',
    context: raw.metadata,
    cases: Object.values(raw.variants).map((entry) => ({
      label: labels[entry.id] ?? entry.id,
      avgNs: entry.avgMs * 1e6,
      minNs: entry.minMs * 1e6,
      p75Ns: entry.avgMs * 1e6,
      p99Ns: entry.maxMs * 1e6,
      maxNs: entry.maxMs * 1e6,
      heapAvgBytes: entry.memory.avgHeapUsedDeltaBytes,
      rssDeltaBytes: entry.memory.avgRssDeltaBytes,
      throughputMiBs: entry.mibPerSec,
      books: entry.eventCount,
      checksum: entry.checksum,
    })),
  };
}

function normalizeWriter1GiBSuiteFromFile(filePath) {
  const raw = readRequiredJson(filePath, 'pnpm --filter benchmark run release:writer:1gb');
  return {
    id: 'writer-1gb',
    title: 'Writer 1GiB async vs sync sink',
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

function createCountingWritableStream() {
  let bytesWritten = 0;
  return {
    stream: new WritableStream({
      write(chunk) {
        bytesWritten += chunk.length;
      },
    }),
    getBytesWritten: () => bytesWritten,
  };
}

async function writeAsyncTree(nodes, options = {}, documentMode = 'document') {
  const { stream, getBytesWritten } = createCountingWritableStream();
  const writer = new Writer(stream, options);
  if (documentMode === 'document') await writer.writeStartDocument();
  await writeWriterTreeAsync(writer, nodes);
  await writer.writeEndDocument();
  await writer.close();
  return getBytesWritten();
}

function writeSyncTree(nodes, options = {}, documentMode = 'document') {
  const writer = new WriterSync(options);
  if (documentMode === 'document') writer.writeStartDocument();
  writeWriterTreeSync(writer, nodes);
  writer.writeEndDocument();
  return writer.getXmlString().length;
}

function createInMemorySink() {
  let bytesWritten = 0;
  return {
    sink: {
      write(chunk) {
        bytesWritten += Buffer.byteLength(chunk);
      },
    },
    getBytesWritten: () => bytesWritten,
  };
}

function writeSyncSinkTree(nodes, options = {}, documentMode = 'document') {
  const { sink, getBytesWritten } = createInMemorySink();
  const writer = new WriterSyncSink(sink, options);
  if (documentMode === 'document') writer.writeStartDocument();
  writeWriterTreeSync(writer, nodes);
  writer.writeEndDocument();
  writer.close();
  return getBytesWritten();
}

function registerWriterSmallSuite() {
  const jsonOrderedContent = loadJsonFile(ASSET_PATHS.testOrdered);
  const jsonContent = loadJsonFile(ASSET_PATHS.test);
  const orderedWriterTree = normalizeOrderedWriterTree(jsonOrderedContent);

  barplot(() => {
    mitataSummary(() => {
      bench('fast-xml-parser builder', () => {
        const builder = new XMLBuilder({ format: true, ignoreAttributes: false });
        return builder.build(jsonOrderedContent).length;
      }).gc('inner');
      bench('stax-xml writer', async () => writeAsyncTree(orderedWriterTree, { prettyPrint: true, indentString: '  ' })).gc('inner');
      bench('stax-xml writer sync', () => writeSyncTree(orderedWriterTree, { prettyPrint: true, indentString: '  ' })).gc('inner');
      bench('stax-xml writer sync sink', () => writeSyncSinkTree(orderedWriterTree, { prettyPrint: true, indentString: '  ' })).gc('inner');
      bench('xml2js builder', () => new Builder({}).buildObject(jsonContent).length).gc('inner');
    });
  });
}

function registerWriterBigSuite() {
  const bigJsonContent = loadJsonFile(ASSET_PATHS.big);
  const bigWriterTree = normalizeFxpWriterTree(bigJsonContent);

  barplot(() => {
    mitataSummary(() => {
      bench('fast-xml-parser builder (big.json)', () => {
        const builder = new XMLBuilder({ format: false, ignoreAttributes: false });
        return builder.build(bigJsonContent).length;
      }).gc('inner');
      bench('stax-xml writer sync (big.json)', () => writeSyncTree(bigWriterTree, {}, 'fragment')).gc('inner');
      bench('stax-xml writer sync sink (big.json)', () => writeSyncSinkTree(bigWriterTree, {}, 'fragment')).gc('inner');
      bench('stax-xml writer (big.json)', async () => writeAsyncTree(bigWriterTree, {}, 'fragment')).gc('inner');
    });
  });
}

function writeBooksSync(bookCount) {
  const writer = new WriterSync();
  writer.writeStartDocument();
  writer.writeStartElement('books');
  for (let index = 0; index < bookCount; index++) {
    const bookId = index + 1;
    writer.writeStartElement('book', { attributes: { id: `book-${bookId}` } });
    writer.writeStartElement('title');
    writer.writeCharacters(`Sample Book Title Number ${bookId}`);
    writer.writeEndElement();
    writer.writeStartElement('author');
    writer.writeCharacters(`Author Name ${bookId}`);
    writer.writeEndElement();
    writer.writeEndElement();
  }
  writer.writeEndElement();
  writer.writeEndDocument();
  return writer.getXmlString().length;
}

function writeBooksSyncSink(bookCount) {
  const { sink, getBytesWritten } = createInMemorySink();
  const writer = new WriterSyncSink(sink);
  writer.writeStartDocument();
  writer.writeStartElement('books');
  for (let index = 0; index < bookCount; index++) {
    const bookId = index + 1;
    writer.writeStartElement('book', { attributes: { id: `book-${bookId}` } });
    writer.writeStartElement('title');
    writer.writeCharacters(`Sample Book Title Number ${bookId}`);
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

async function writeBooksAsync(bookCount) {
  const { stream, getBytesWritten } = createCountingWritableStream();
  const writer = new Writer(stream);
  await writer.writeStartDocument();
  await writer.writeStartElement('books');
  for (let index = 0; index < bookCount; index++) {
    const bookId = index + 1;
    await writer.writeStartElement('book', { attributes: { id: `book-${bookId}` } });
    await writer.writeStartElement('title');
    await writer.writeCharacters(`Sample Book Title Number ${bookId}`);
    await writer.writeEndElement();
    await writer.writeStartElement('author');
    await writer.writeCharacters(`Author Name ${bookId}`);
    await writer.writeEndElement();
    await writer.writeEndElement();
  }
  await writer.writeEndElement();
  await writer.writeEndDocument();
  await writer.close();
  return getBytesWritten();
}

function registerAsyncWriterSuite() {
  barplot(() => {
    mitataSummary(() => {
      bench('async writer (1K elements)', async () => writeBooksAsync(1000)).gc('inner');
      bench('sync writer (1K elements)', () => writeBooksSync(1000)).gc('inner');
      bench('sync writer sink in-memory (1K elements)', () => writeBooksSyncSink(1000)).gc('inner');
      bench('async writer (5K elements)', async () => writeBooksAsync(5000)).gc('inner');
      bench('sync writer (5K elements)', () => writeBooksSync(5000)).gc('inner');
      bench('sync writer sink in-memory (5K elements)', () => writeBooksSyncSink(5000)).gc('inner');
      bench('async writer (10K elements)', async () => writeBooksAsync(10000)).gc('inner');
      bench('sync writer (10K elements)', () => writeBooksSync(10000)).gc('inner');
      bench('sync writer sink in-memory (10K elements)', () => writeBooksSyncSink(10000)).gc('inner');
    });
  });
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function findCase(summary, suiteId, label) {
  return summary.suites[suiteId]?.cases.find((entry) => entry.label === label);
}

function formatDuration(ns) {
  if (!Number.isFinite(ns)) return 'n/a';
  if (ns >= 1e9) return `${(ns / 1e9).toFixed(2)} s`;
  if (ns >= 1e6) return `${(ns / 1e6).toFixed(2)} ms`;
  return `${(ns / 1e3).toFixed(2)} us`;
}

function formatMemory(bytes) {
  if (!Number.isFinite(bytes)) return 'n/a';
  if (Math.abs(bytes) >= GIB) return `${(bytes / GIB).toFixed(2)} GiB`;
  if (Math.abs(bytes) >= MIB) return `${(bytes / MIB).toFixed(1)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function formatOps(avgNs) {
  return `${(1e9 / avgNs).toLocaleString('en-US', { maximumFractionDigits: avgNs < 1e6 ? 0 : 2 })} ops/sec`;
}

function renderTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function renderParserTable(summary, suiteId) {
  const fixtureBytes = {
    'parser-2kb': statSync(ASSET_PATHS.complex).size,
    'parser-4kb': statSync(ASSET_PATHS.books).size,
    'parser-13mb': statSync(ASSET_PATHS.midsize).size,
    'parser-98mb': statSync(ASSET_PATHS.large).size,
  }[suiteId];
  const cases = summary.suites[suiteId]?.cases ?? [];
  return renderTable(
    ['Library', 'Average', 'MB/s', 'Ops/sec', 'Heap'],
    cases.map((stats) => {
      return [
        stats.label,
        formatDuration(stats.avgNs),
        stats.avgNs ? `${((fixtureBytes / 1e6) / (stats.avgNs / 1e9)).toFixed(2)} MB/s` : 'n/a',
        formatOps(stats.avgNs),
        formatMemory(stats?.heapAvgBytes),
      ];
    }),
  );
}

function renderConverterTable(summary) {
  const suite = summary.suites['converter-parity'];
  return renderTable(
    ['Projection', 'Throughput', 'Average', 'Heap delta', 'RSS delta', 'Checksum'],
    suite.cases.map((entry) => [
      entry.label,
      `${entry.throughputMiBs.toFixed(2)} MiB/s`,
      formatDuration(entry.avgNs),
      formatMemory(entry.heapAvgBytes),
      formatMemory(entry.rssDeltaBytes),
      String(entry.checksum),
    ]),
  );
}

function renderRuntimeMatrixTable() {
  const runtimeMatrix = readRequiredJson(
    runtimeMatrixPath,
    'pnpm --filter benchmark run release:runtime-matrix',
  );
  return renderTable(
    ['Runtime', 'Workload', 'Throughput', 'Average', 'Peak heap', 'Peak RSS', 'Events', 'Checksum'],
    runtimeMatrix.results.flatMap((runtime) => runtime.scenarios.map((scenario) => [
      `${runtime.runtime.id} ${runtime.runtime.version}`,
      scenario.id,
      `${scenario.mibPerSec.toFixed(2)} MiB/s`,
      `${scenario.avgMs.toFixed(2)} ms`,
      formatMemory(scenario.peakHeapUsedBytes),
      formatMemory(scenario.peakRssBytes),
      scenario.eventCount.toLocaleString('en-US'),
      String(scenario.checksum),
    ])),
  );
}

function renderWriterCrossRuntimeTable(summary) {
  const suite = summary.suites['writer-cross-runtime'];
  if (!suite) {
    return 'Pending final aggregation by `pnpm --filter benchmark run release:summary`.';
  }
  const versions = suite.context.environment;
  const labels = {
    'stax-xml': `stax-xml WriterSyncSink (${versions.node})`,
    woodstox: `Woodstox ${versions.woodstox} (Java ${versions.java})`,
    'quick-xml': `quick-xml ${versions.quickXml} (Rust ${versions.rust})`,
  };
  return renderTable(
    ['Writer', 'Median throughput', 'Median time', 'Written', 'Records'],
    suite.cases.map((entry) => [
      labels[entry.label] ?? entry.label,
      `${entry.throughputMiBs.toFixed(1)} MiB/s`,
      formatDuration(entry.avgNs),
      formatMemory(entry.bytes),
      entry.records.toLocaleString('en-US'),
    ]),
  );
}

function renderReaderCrossRuntimeTable(summary) {
  const suite = summary.suites['reader-cross-runtime'];
  if (!suite) {
    return 'Pending final aggregation by `pnpm --filter benchmark run release:summary`.';
  }
  const versions = suite.context.environment;
  const labels = {
    'stax-xml': `stax-xml StreamReaderSync (${versions.node})`,
    woodstox: `Woodstox ${versions.woodstox} (Java ${versions.java})`,
    'quick-xml': `quick-xml ${versions.quickXml} (Rust ${versions.rust})`,
  };
  return renderTable(
    ['Reader', 'Median throughput', 'Median time', 'Events', 'Checksum'],
    suite.cases.map((entry) => [
      labels[entry.label] ?? entry.label,
      `${entry.throughputMiBs.toFixed(1)} MiB/s`,
      formatDuration(entry.avgNs),
      entry.events.toLocaleString('en-US'),
      String(entry.checksum),
    ]),
  );
}

function renderBenchmarkMarkdown(summary) {
  const npmRows = [
    'stax-xml EventReaderSync (JS event checksum)',
    'stax-xml StreamReaderSync (JS event checksum)',
    'fast-xml-parser XMLParser',
    'txml parse',
    'xml2js parseString',
    'sax strict event parser',
    'saxes event parser',
    'htmlparser2 xmlMode parser',
  ].map((label) => {
    const stats = findCase(summary, 'npm-xml-parsers', label);
    return [label, formatDuration(stats?.avgNs), stats ? formatOps(stats.avgNs) : 'n/a', formatMemory(stats?.heapAvgBytes)];
  });

  const streamRows = summary.suites['stream-size'].cases.map((entry) => [
    entry.label.replace('StreamReaderSync iterable chunks ', ''),
    `${entry.throughputMiBs.toFixed(2)} MiB/s`,
    formatDuration(entry.avgNs),
    formatMemory(entry.heapDeltaBytes),
    formatMemory(entry.rssDeltaBytes),
  ]);

  return [
    '# StAX-XML Benchmarks',
    '',
    `Generated: ${summary.generatedAt}`,
    `Run ID: ${summary.runId}`,
    '',
    'The core release tables measure public pure JavaScript surfaces. Explicit cross-language reader and writer sections compare equivalent public pull APIs and real file sinks without changing that core contract.',
    '',
    '## Environment',
    '',
    `- Runtime: Node ${summary.environment.version} (${summary.environment.arch})`,
    `- CPU: ${summary.environment.cpuName} (~${summary.environment.cpuGHz.toFixed(2)} GHz)`,
    `- Package manager: ${summary.environment.packageManager ?? 'n/a'}`,
    '',
    '## Parser Fixture Series',
    '',
    'Every row parses the same XML and returns the same canonical JavaScript record array. The benchmark validates full-result parity before measuring parse-plus-projection time.',
    '',
    '### 2 KiB',
    '',
    renderParserTable(summary, 'parser-2kb'),
    '',
    '### 4 KiB',
    '',
    renderParserTable(summary, 'parser-4kb'),
    '',
    '### 13 MiB',
    '',
    renderParserTable(summary, 'parser-13mb'),
    '',
    '### 98 MiB',
    '',
    renderParserTable(summary, 'parser-98mb'),
    '',
    '## Maintained Node XML Parser Comparison',
    '',
    renderTable(['Library', 'Average', 'Ops/sec', 'Heap'], npmRows),
    '',
    '## StreamReaderSync Incremental Size Series',
    '',
    renderTable(['Size', 'Throughput', 'Average', 'Heap delta', 'RSS delta'], streamRows),
    '',
    '## Runtime Matrix',
    '',
    'The same generated 16 MiB fixture and checksum workloads run on Node, Bun, and Deno. Memory columns are absolute measured-run endpoint peaks for each runtime process.',
    '',
    renderRuntimeMatrixTable(),
    '',
    '## Cross-Language Reader Comparison',
    '',
    'The same in-memory UTF-8 fixture is parsed by public pull-reader APIs in Node, Java, and Rust. File I/O is outside the timed region; all element names, non-whitespace text, and attribute names/values are materialized and must preserve the same event count and checksum.',
    '',
    renderReaderCrossRuntimeTable(summary),
    '',
    '## Converter IR Projection',
    '',
    `Converter section generated: ${summary.suites['converter-parity'].context.collectedAt}`,
    '',
    renderConverterTable(summary),
    '',
    'The converter row uses `schema.parseSync(bytes)`: schema is lowered to IR, then executed by generated code when runtime code generation is available. It is compared only with the equivalent manual object projection on this catalog fixture.',
    '',
    '## Cross-Language Writer Comparison',
    '',
    'The public writer APIs in Node, Java, and Rust generate the same compact XML workload and write it to a real file sink. Rows are medians of three end-to-end runs.',
    '',
    renderWriterCrossRuntimeTable(summary),
    '',
    '### Reader/Writer Throughput Asymmetry',
    '',
    'The 1 GiB rows are intentionally different workloads. `WriterSyncSink` writing to a temp file is mostly deterministic append work: the caller already knows each element name, attribute, and text value, so the writer validates its own state, encodes known JavaScript strings, and flushes large sequential chunks to the file descriptor. It does not search arbitrary XML for delimiters, recover tokens across chunk boundaries, or discover names, text, and attributes from incoming bytes.',
    '',
    '`StreamReaderSync` is a CPU-bound parsing path. The current 1 GiB row uses generated byte batches rather than disk I/O, so storage speed is not the limiter. The reader must scan every byte, classify markup versus text, maintain XML state, keep the accessor API stable, and decode/materialize JavaScript strings for names, text, and attributes when the consumer asks for them. The main restriction is pure-JavaScript byte scanning plus UTF-8 span decoding/string materialization; native parsers such as Woodstox or quick-xml can put delimiter search and tokenization in JVM/Rust code with lower-level buffer access.',
    '',
    'Native-addon or FFI-style experiments do not change that public-contract boundary. A Rust, C, or C++ tokenizer can reduce delimiter-search cost, and a lower-level boundary can expose pointers, buffers, or spans more directly. It still cannot hand ordinary JavaScript consumers a ready-made zero-copy StAX event stream with JavaScript strings. Once the benchmark contract requires JavaScript strings and events, V8 heap objects must be created or copied, and that materialization cost dominates the tokenizer-language or boundary choice.',
    '',
    '## Release Artifacts',
    '',
    '- Runtime matrix: `packages/benchmark/results/release/runtime-matrix.json`',
    '- Cross-language reader comparison: `packages/benchmark/results/release/reader-cross-runtime.json`',
    '- 4 GiB cursor reader: `packages/benchmark/results/release/stream-reader-4gb.json`',
    '- Converter compiled batch plan: `packages/benchmark/results/release/converter-compiled-batch-plan.json`',
    '- 1 GiB writer raw result: `packages/benchmark/results/release/raw/writer-1gb.json`',
    '- Cross-language writer comparison: `packages/benchmark/results/release/writer-cross-runtime.json`',
    '',
  ].join('\n');
}

function updateConverterSection() {
  const summary = readRequiredJson(summaryPath, 'pnpm --filter benchmark run release:expanded');
  summary.suites['converter-parity'] = normalizeConverterSuiteFromFile(converterBatchPlanPath);
  writeJson(summaryPath, summary);
  writeFileSync(benchmarkMarkdownPath, renderBenchmarkMarkdown(summary), 'utf8');
  console.log(`Updated converter section in ${summaryPath}`);
  console.log(`Updated converter section in ${benchmarkMarkdownPath}`);
}

async function main() {
  const streamSizeCaseIndex = process.argv.indexOf('--stream-size-case');
  if (streamSizeCaseIndex !== -1) {
    const display = process.argv[streamSizeCaseIndex + 1];
    const fixtureCase = streamSizeCases.find((entry) => entry.display === display);
    if (!fixtureCase) throw new Error(`Unknown stream-size case: ${display}`);
    process.stdout.write(JSON.stringify(measureStreamSizeCase(fixtureCase)));
    return;
  }
  if (process.argv.includes('--converter-only')) {
    updateConverterSection();
    return;
  }
  mkdirSync(rawDir, { recursive: true });
  const runId = createReleaseRunId();
  const generatedAt = new Date().toISOString();

  readRequiredJson(runtimeMatrixPath, 'pnpm --filter benchmark run release:runtime-matrix');
  const readerCrossRuntime = readRequiredJson(
    readerCrossRuntimePath,
    'pnpm --filter benchmark run release:reader:cross-runtime',
  );
  const writerCrossRuntime = readRequiredJson(
    writerCrossRuntimePath,
    'pnpm --filter benchmark run release:writer:cross-runtime',
  );

  const suites = {
    'parser-2kb': await runMitataSuite('parser-2kb', 'Parser 2KB (complex.xml)', () => registerParserSyncSuite(ASSET_PATHS.complex)),
    'parser-4kb': await runMitataSuite('parser-4kb', 'Parser 4KB (books.xml)', () => registerParserSyncSuite(ASSET_PATHS.books)),
    'parser-13mb': await runMitataSuite('parser-13mb', 'Parser 13MB (midsize.xml)', () => registerParserSyncSuite(ASSET_PATHS.midsize)),
    'parser-98mb': await runMitataSuite('parser-98mb', 'Parser 98MB (large.xml)', () => registerParserSyncSuite(ASSET_PATHS.large), parser98MbMitataOptions),
    'npm-xml-parsers': await runMitataSuite('npm-xml-parsers', 'Node npm XML parser comparison (books.xml)', registerNpmXmlParserSuite),
    'stream-size': runStreamSizeSuite(),
    'reader-cross-runtime': normalizeReaderCrossRuntimeSuite(readerCrossRuntime),
    'converter-parity': normalizeConverterSuiteFromFile(converterBatchPlanPath),
    'writer-small': await runMitataSuite('writer-small', 'Writer small documents', registerWriterSmallSuite),
    'writer-big': await runMitataSuite('writer-big', 'Writer large documents', registerWriterBigSuite),
    'writer-async': await runMitataSuite('writer-async', 'Writer async vs sync', registerAsyncWriterSuite),
    'writer-1gb': normalizeWriter1GiBSuiteFromFile(writer1GiBRawPath),
    'writer-cross-runtime': normalizeWriterCrossRuntimeSuite(writerCrossRuntime),
  };

  const summary = {
    generatedAt,
    runId,
    contract: {
      parser: 'pure JavaScript public API surfaces',
      excludes: ['native addons', 'Wasm parser modules', 'backend fallback rows'],
      includes: [
        'parser fixture series',
        'maintained Node npm XML parser comparison',
        'StreamReaderSync incremental size series from 1MiB to 4GiB',
        'runtime matrix artifact',
        'Node/Java/Rust reader comparison',
        'converter compiled batch-plan comparison',
        'writer small/big/async/1GiB rows',
        'Node/Java/Rust writer comparison',
      ],
    },
    environment: collectEnvironment(),
    artifacts: {
      runtimeMatrix: 'packages/benchmark/results/release/runtime-matrix.json',
      readerCrossRuntime: 'packages/benchmark/results/release/reader-cross-runtime.json',
      streamReader4GiB: 'packages/benchmark/results/release/stream-reader-4gb.json',
      converterCompiledBatchPlan: 'packages/benchmark/results/release/converter-compiled-batch-plan.json',
      writer1GiB: 'packages/benchmark/results/release/raw/writer-1gb.json',
      writerCrossRuntime: 'packages/benchmark/results/release/writer-cross-runtime.json',
    },
    suites,
  };

  writeJson(summaryPath, summary);
  writeFileSync(benchmarkMarkdownPath, renderBenchmarkMarkdown(summary), 'utf8');
  console.log(`\nWrote ${summaryPath}`);
  console.log(`Wrote ${benchmarkMarkdownPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
