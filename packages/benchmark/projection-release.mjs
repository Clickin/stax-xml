import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sax from 'sax';
import { SaxesParser } from 'saxes';
import { EventReaderSync, StreamEventType, StreamReaderSync, XmlEventType } from 'stax-xml';
import { attr, attrEquals, childText, compileProjection, many, projectXmlSync } from 'stax-xml/projection';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageVersion = JSON.parse(
  readFileSync(resolve(__dirname, '../stax-xml/package.json'), 'utf8'),
).version;

const rowVariants = createRowVariants();
const headerBytes = encoder.encode('<root>\n');
const footerBytes = encoder.encode('</root>\n');
const batchSize = 16;

const lowProjection = compileProjection({
  books: many('/root/book', {
    id: attr('id'),
    title: childText('title'),
  }, {
    where: attrEquals('code', '7'),
  }),
});

const highProjection = compileProjection({
  books: many('/root/book', {
    id: attr('id'),
    title: childText('title'),
  }),
});

const options = parseArgs();
const comparisonFixture = createStringFixture(options.compareSizeMiB * MIB);
const comparisonCases = runComparisonCases(comparisonFixture, options);
const generatedSizes = options.sizesGiB.map((sizeGiB) => {
  const fixture = createGeneratedFixture(sizeGiB * GIB);
  return {
    fixture,
    cases: runGeneratedCases(fixture, options),
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  package: 'stax-xml',
  packageVersion,
  environment: {
    runtime: 'node',
    version: process.versions.node,
    platform: `${process.platform}-${process.arch}`,
    cpuName: cpus()[0]?.model ?? 'unknown',
  },
  options: {
    compareSizeMiB: options.compareSizeMiB,
    sizesGiB: options.sizesGiB,
    warmups: options.warmups,
    runs: options.runs,
  },
  contract: {
    parser: 'pure JavaScript stax-xml/projection over StreamReaderSync byte batches',
    lowSelectivity: 'select /root/book where @code="7", capture @id and child title',
    highSelectivity: 'select every /root/book, capture @id and child title',
    inMemoryComparison: 'projection vs manual StreamReaderSync, EventReaderSync, sax, and saxes over the same generated XML string',
    generatedSizeComparison: 'projection vs manual StreamReaderSync over generated Uint8Array batches without building the full input string',
    native: false,
    wasm: false,
  },
  comparison: {
    fixture: comparisonFixture.summary,
    cases: comparisonCases,
  },
  generatedSizes,
};

if (options.jsonOut) {
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
}
if (options.mdOut) {
  writeOutput(options.mdOut, renderMarkdown(report));
}
printSummary(report);

function parseArgs(argv = process.argv.slice(2)) {
  const parsed = {
    compareSizeMiB: 16,
    sizesGiB: [1, 4],
    warmups: 0,
    runs: 3,
    jsonOut: 'packages/benchmark/results/release/projection-benchmark.json',
    mdOut: 'packages/benchmark/results/release/projection-benchmark.md',
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;
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
      case '--compare-size-mib':
        parsed.compareSizeMiB = parsePositiveNumber(readValue(), '--compare-size-mib');
        break;
      case '--sizes-gib':
        parsed.sizesGiB = readValue().split(',').map((value) => parsePositiveNumber(value.trim(), '--sizes-gib'));
        break;
      case '--size-gib':
        parsed.sizesGiB = [parsePositiveNumber(readValue(), '--size-gib')];
        break;
      case '--runs':
        parsed.runs = parsePositiveInteger(readValue(), '--runs');
        break;
      case '--warmups':
        parsed.warmups = parseNonNegativeInteger(readValue(), '--warmups');
        break;
      case '--json-out':
        parsed.jsonOut = readValue();
        break;
      case '--md-out':
        parsed.mdOut = readValue();
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (parsed.sizesGiB.length === 0) {
    throw new Error('--sizes-gib must include at least one size.');
  }
  return parsed;
}

function runComparisonCases(fixture, options) {
  const cases = [
    ['projection-low-selectivity', () => consumeProjection(fixture.bytes, lowProjection)],
    ['manual-streamreader-low-selectivity', () => consumeManualStreamReader(fixture.bytes, 'low')],
    ['eventreader-low-selectivity', () => consumeEventReader(fixture.xml, 'low')],
    ['sax-low-selectivity', () => consumeSax(fixture.xml, 'low')],
    ['saxes-low-selectivity', () => consumeSaxes(fixture.xml, 'low')],
    ['projection-high-selectivity', () => consumeProjection(fixture.bytes, highProjection)],
    ['manual-streamreader-high-selectivity', () => consumeManualStreamReader(fixture.bytes, 'high')],
    ['eventreader-high-selectivity', () => consumeEventReader(fixture.xml, 'high')],
    ['sax-high-selectivity', () => consumeSax(fixture.xml, 'high')],
    ['saxes-high-selectivity', () => consumeSaxes(fixture.xml, 'high')],
  ].map(([name, run]) => measure(name, run, fixture.summary.actualBytes, options));

  assertParity(cases, 'low');
  assertParity(cases, 'high');
  return cases;
}

function runGeneratedCases(fixture, options) {
  const cases = [
    ['projection-low-selectivity', () => consumeProjection(byteBatches(fixture), lowProjection)],
    ['manual-streamreader-low-selectivity', () => consumeManualStreamReader(byteBatches(fixture), 'low')],
    ['projection-high-selectivity', () => consumeProjection(byteBatches(fixture), highProjection)],
    ['manual-streamreader-high-selectivity', () => consumeManualStreamReader(byteBatches(fixture), 'high')],
  ].map(([name, run]) => measure(name, run, fixture.actualBytes, options));

  assertParity(cases, 'low');
  assertParity(cases, 'high');
  return cases;
}

function consumeProjection(input, projection) {
  let records = 0;
  let checksum = 2166136261;

  projectXmlSync(input, projection, {
    onRecord(record) {
      records++;
      checksum = foldString(checksum, record.id);
      checksum = foldString(checksum, record.title);
    },
  });

  return { records, checksum };
}

function consumeManualStreamReader(input, selectivity) {
  const reader = new StreamReaderSync(input);
  const elementStack = [];
  let currentRecord;
  let records = 0;
  let checksum = 2166136261;

  for (const batch of reader) {
    for (let index = 0; index < batch.eventCount; index++) {
      const type = batch.typeAt(index);
      if (type === StreamEventType.START_ELEMENT) {
        const name = batch.nameAt(index);
        elementStack.push(name);
        if (name === 'book' && shouldSelect(selectivity, batch.attributeValueAt(index, 'code'))) {
          currentRecord = {
            id: batch.attributeValueAt(index, 'id') ?? '',
            title: '',
          };
        }
        continue;
      }
      if ((type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) && currentRecord) {
        const currentElement = elementStack[elementStack.length - 1];
        const parentElement = elementStack[elementStack.length - 2];
        if (parentElement === 'book' && currentElement === 'title') {
          currentRecord.title += batch.textAt(index)?.trim() ?? '';
        }
        continue;
      }
      if (type === StreamEventType.END_ELEMENT) {
        const name = elementStack.pop();
        if (name === 'book' && currentRecord) {
          records++;
          checksum = foldString(foldString(checksum, currentRecord.id), currentRecord.title);
          currentRecord = undefined;
        }
      }
    }
  }

  return { records, checksum };
}

function consumeEventReader(xml, selectivity) {
  const elementStack = [];
  let currentRecord;
  let records = 0;
  let checksum = 2166136261;

  for (const event of new EventReaderSync(xml, { autoDecodeEntities: false })) {
    if (event.type === XmlEventType.START_ELEMENT) {
      const name = event.name ?? event.localName;
      elementStack.push(name);
      if (name === 'book' && shouldSelect(selectivity, event.attributes?.code)) {
        currentRecord = {
          id: event.attributes?.id ?? '',
          title: '',
        };
      }
      continue;
    }
    if ((event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) && currentRecord) {
      const currentElement = elementStack[elementStack.length - 1];
      const parentElement = elementStack[elementStack.length - 2];
      if (parentElement === 'book' && currentElement === 'title') {
        currentRecord.title += event.value?.trim() ?? '';
      }
      continue;
    }
    if (event.type === XmlEventType.END_ELEMENT) {
      const name = elementStack.pop();
      if (name === 'book' && currentRecord) {
        records++;
        checksum = foldString(foldString(checksum, currentRecord.id), currentRecord.title);
        currentRecord = undefined;
      }
    }
  }

  return { records, checksum };
}

function consumeSax(xml, selectivity) {
  const parser = sax.parser(true, { trim: false, normalize: false });
  const elementStack = [];
  let currentRecord;
  let records = 0;
  let checksum = 2166136261;

  parser.onopentag = (node) => {
    elementStack.push(node.name);
    if (node.name === 'book' && shouldSelect(selectivity, node.attributes?.code)) {
      currentRecord = {
        id: String(node.attributes?.id ?? ''),
        title: '',
      };
    }
  };
  parser.ontext = (text) => {
    if (!currentRecord) return;
    const currentElement = elementStack[elementStack.length - 1];
    const parentElement = elementStack[elementStack.length - 2];
    const value = text.trim();
    if (parentElement === 'book' && currentElement === 'title' && value) {
      currentRecord.title += value;
    }
  };
  parser.onclosetag = (name) => {
    elementStack.pop();
    if (name === 'book' && currentRecord) {
      records++;
      checksum = foldString(foldString(checksum, currentRecord.id), currentRecord.title);
      currentRecord = undefined;
    }
  };
  parser.write(xml).close();
  return { records, checksum };
}

function consumeSaxes(xml, selectivity) {
  const parser = new SaxesParser({ xmlns: false });
  const elementStack = [];
  let currentRecord;
  let records = 0;
  let checksum = 2166136261;

  parser.on('opentag', (node) => {
    elementStack.push(node.name);
    if (node.name === 'book' && shouldSelect(selectivity, node.attributes?.code)) {
      currentRecord = {
        id: String(node.attributes?.id ?? ''),
        title: '',
      };
    }
  });
  parser.on('text', (text) => {
    if (!currentRecord) return;
    const currentElement = elementStack[elementStack.length - 1];
    const parentElement = elementStack[elementStack.length - 2];
    const value = text.trim();
    if (parentElement === 'book' && currentElement === 'title' && value) {
      currentRecord.title += value;
    }
  });
  parser.on('closetag', (node) => {
    const name = typeof node === 'string' ? node : node.name;
    elementStack.pop();
    if (name === 'book' && currentRecord) {
      records++;
      checksum = foldString(foldString(checksum, currentRecord.id), currentRecord.title);
      currentRecord = undefined;
    }
  });
  parser.write(xml).close();
  return { records, checksum };
}

function shouldSelect(selectivity, code) {
  return selectivity === 'high' || code === '7';
}

function measure(name, run, actualBytes, options) {
  for (let index = 0; index < options.warmups; index++) {
    run();
  }

  const samplesMs = [];
  const heapDeltas = [];
  const rssDeltas = [];
  let first;

  for (let index = 0; index < options.runs; index++) {
    globalThis.gc?.();
    const before = process.memoryUsage();
    const startedAt = performance.now();
    const result = run();
    const elapsedMs = performance.now() - startedAt;
    const after = process.memoryUsage();

    if (first && (first.records !== result.records || first.checksum !== result.checksum)) {
      throw new Error(`${name} produced unstable records/checksum.`);
    }
    first ??= result;
    samplesMs.push(elapsedMs);
    heapDeltas.push(after.heapUsed - before.heapUsed);
    rssDeltas.push(after.rss - before.rss);
  }

  const avgMs = average(samplesMs);
  return {
    name,
    selectivity: name.includes('-low-') ? 'low' : 'high',
    records: first.records,
    checksum: first.checksum,
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    throughputMiBs: (actualBytes / MIB) / (avgMs / 1000),
    avgHeapDeltaBytes: average(heapDeltas),
    avgRssDeltaBytes: average(rssDeltas),
    samplesMs,
  };
}

function assertParity(cases, selectivity) {
  const selected = cases.filter((entry) => entry.selectivity === selectivity);
  const reference = selected[0];
  for (const entry of selected.slice(1)) {
    if (entry.records !== reference.records || entry.checksum !== reference.checksum) {
      throw new Error(
        `Projection benchmark parity failed for ${selectivity}: `
        + `${reference.name} records=${reference.records} checksum=${reference.checksum}; `
        + `${entry.name} records=${entry.records} checksum=${entry.checksum}`,
      );
    }
  }
}

function createStringFixture(targetBytes) {
  const parts = [decoder.decode(headerBytes)];
  let actualBytes = headerBytes.byteLength;
  let rowCount = 0;

  while (actualBytes + footerBytes.byteLength < targetBytes) {
    const row = rowVariants[rowCount % rowVariants.length];
    parts.push(row.xml);
    actualBytes += row.bytes.byteLength;
    rowCount++;
  }

  parts.push(decoder.decode(footerBytes));
  actualBytes += footerBytes.byteLength;
  const xml = parts.join('');

  return {
    xml,
    bytes: encoder.encode(xml),
    summary: {
      kind: 'in-memory-string',
      targetBytes,
      actualBytes,
      sizeMiB: actualBytes / MIB,
      rowCount,
    },
  };
}

function createGeneratedFixture(targetBytes) {
  let actualBytes = headerBytes.byteLength;
  let rowCount = 0;

  while (actualBytes + footerBytes.byteLength < targetBytes) {
    actualBytes += rowVariants[rowCount % rowVariants.length].bytes.byteLength;
    rowCount++;
  }
  actualBytes += footerBytes.byteLength;

  return {
    kind: 'generated-byte-batches',
    targetBytes,
    actualBytes,
    sizeGiB: actualBytes / GIB,
    rowCount,
  };
}

function* byteBatches(fixture) {
  yield [headerBytes];
  let batch = [];
  for (let index = 0; index < fixture.rowCount; index++) {
    batch.push(rowVariants[index % rowVariants.length].bytes);
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) {
    yield batch;
  }
  yield [footerBytes];
}

function createRowVariants() {
  const variants = [];
  for (let index = 0; index < 970; index++) {
    const code = index % 97;
    const id = `book-${index}`;
    const title = `Projection Benchmark ${index}`;
    const xml =
      `<book id="${id}" lang="en" code="${code}">`
      + `<title>${title}</title>`
      + `<author>Author ${index % 113}</author>`
      + `<description>Repeated projection benchmark payload ${index} `
      + 'with stable ASCII text to keep the generated input deterministic. '
      + 'The projection plan intentionally ignores this description field.</description>'
      + `<chapter number="1">Intro ${index}</chapter>`
      + `<chapter number="2">Body ${index}</chapter>`
      + '</book>\n';
    variants.push({
      code: String(code),
      xml,
      bytes: encoder.encode(xml),
    });
  }
  return variants;
}

function printSummary(report) {
  console.log('Projection benchmark completed');
  console.log(`comparison=${formatBytes(report.comparison.fixture.actualBytes)}, warmups=${report.options.warmups}, runs=${report.options.runs}`);
  for (const entry of report.comparison.cases) {
    console.log(`${entry.name.padEnd(40)} ${entry.throughputMiBs.toFixed(1).padStart(8)} MiB/s records=${entry.records} checksum=${entry.checksum}`);
  }
  for (const size of report.generatedSizes) {
    console.log(`generated=${formatBytes(size.fixture.actualBytes)}, rows=${size.fixture.rowCount}`);
    for (const entry of size.cases) {
      console.log(`${entry.name.padEnd(40)} ${entry.throughputMiBs.toFixed(1).padStart(8)} MiB/s records=${entry.records} checksum=${entry.checksum}`);
    }
  }
}

function renderMarkdown(report) {
  const lines = [
    '# Projection Benchmark',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This benchmark covers the `stax-xml/projection` API over pure JavaScript byte batches.',
    'The in-memory comparison includes `StreamReaderSync`, `EventReaderSync`, `sax`, and `saxes`.',
    'The generated-size comparison avoids constructing a giant XML string and compares projection against a manual `StreamReaderSync` projection over the same generated byte batches.',
    '',
    '## Environment',
    '',
    `- Package: stax-xml ${report.packageVersion}`,
    `- Runtime: Node ${report.environment.version} (${report.environment.platform})`,
    `- CPU: ${report.environment.cpuName}`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    '',
    '## In-Memory Parser Comparison',
    '',
    `Fixture size: ${formatBytes(report.comparison.fixture.actualBytes)}, rows=${report.comparison.fixture.rowCount}`,
    '',
    renderCasesTable(report.comparison.cases),
    '',
    '## Generated Byte-Batch Size Comparison',
    '',
  ];

  for (const size of report.generatedSizes) {
    lines.push(`### ${formatBytes(size.fixture.actualBytes)}`);
    lines.push('');
    lines.push(`Rows: ${size.fixture.rowCount}`);
    lines.push('');
    lines.push(renderCasesTable(size.cases));
    lines.push('');
  }

  lines.push('## Contract');
  lines.push('');
  lines.push('- Low selectivity selects `/root/book[@code="7"]` and captures `@id` plus direct `title` text.');
  lines.push('- High selectivity selects every `/root/book` and captures the same fields.');
  lines.push('- Rows sharing selectivity must preserve projected record count and checksum.');
  lines.push('- Generated-size rows avoid full-input string materialization and remain on the browser-compatible `Uint8Array`/`TextDecoder` path.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function renderCasesTable(cases) {
  const lines = [
    '| Case | Selectivity | Throughput | Average | Min | Max | Records | Checksum | Avg heap delta | Avg RSS delta |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const entry of cases) {
    lines.push(
      `| ${entry.name} | ${entry.selectivity} | ${entry.throughputMiBs.toFixed(1)} MiB/s | `
      + `${entry.avgMs.toFixed(2)} ms | ${entry.minMs.toFixed(2)} ms | ${entry.maxMs.toFixed(2)} ms | `
      + `${entry.records} | ${entry.checksum} | ${formatSignedBytes(entry.avgHeapDeltaBytes)} | ${formatSignedBytes(entry.avgRssDeltaBytes)} |`,
    );
  }

  return lines.join('\n');
}

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
  console.log(`Wrote ${resolved}`);
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

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive number.`);
  }
  return parsed;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function foldString(seed, value) {
  if (!value) return seed;
  let next = seed;
  for (let index = 0; index < value.length; index++) {
    next = Math.imul(next ^ value.charCodeAt(index), 16777619);
  }
  return next | 0;
}

function formatBytes(bytes) {
  const abs = Math.abs(bytes);
  if (abs >= GIB) return `${(bytes / GIB).toFixed(2)} GiB`;
  if (abs >= MIB) return `${(bytes / MIB).toFixed(1)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function formatSignedBytes(bytes) {
  const prefix = bytes > 0 ? '+' : '';
  return `${prefix}${formatBytes(bytes)}`;
}
