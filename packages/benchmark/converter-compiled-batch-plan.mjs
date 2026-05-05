import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { StreamEventType, StreamReaderSync } from 'stax-xml';
import { x } from 'stax-xml/converter';

const MIB = 1024 * 1024;
const textEncoder = new TextEncoder();

const bookSchema = x.object({
  id: x.string().xpath('./@id'),
  title: x.string().xpath('./title'),
  author: x.string().xpath('./author'),
  price: x.number().xpath('./price'),
  featured: x.string().xpath('./featured').optional(),
});

const catalogSchema = x.object({
  books: x.array(bookSchema, '/catalog/book'),
  firstTitle: x.string().xpath('/catalog/book/title').optional(),
});
const compiledCatalogSchema = catalogSchema.compile();

const args = parseArgs();
const fixture = createCatalogFixture(args.targetBytes);
const parseOptions = { maxEvents: args.maxEvents };

console.log('Converter compiled batch-plan benchmark');
console.log(`target=${formatBytes(fixture.bytes.byteLength)}, books=${fixture.bookCount}, warmups=${args.warmups}, runs=${args.runs}, maxEvents=${args.maxEvents}`);

const parity = {
  manual: consumeManualStreamReader(fixture.bytes),
  converterAuto: catalogSchema.parseSync(fixture.bytes, parseOptions),
  converterCompiled: compiledCatalogSchema.parseSync(fixture.bytes, parseOptions),
};
const manualSummary = summarize(parity.manual);
const autoSummary = summarize(parity.converterAuto);
const compiledSummary = summarize(parity.converterCompiled);

if (!sameSummary(manualSummary, autoSummary) || !sameSummary(manualSummary, compiledSummary)) {
  throw new Error(`Converter parity mismatch: ${JSON.stringify({ manualSummary, autoSummary, compiledSummary })}`);
}

const cases = [
  ['manual-streamreader-sync', () => consumeManualStreamReader(fixture.bytes)],
  ['converter-auto-compiled-batch-plan', () => catalogSchema.parseSync(fixture.bytes, parseOptions)],
  ['converter-explicit-compiled-batch-plan', () => compiledCatalogSchema.parseSync(fixture.bytes, parseOptions)],
];

const results = [];
for (const [name, fn] of cases) {
  for (let index = 0; index < args.warmups; index++) {
    fn();
  }
  const samples = [];
  for (let index = 0; index < args.runs; index++) {
    globalThis.gc?.();
    const before = process.memoryUsage();
    const start = performance.now();
    const value = fn();
    const elapsedMs = performance.now() - start;
    const after = process.memoryUsage();
    samples.push({
      elapsedMs,
      summary: summarize(value),
      heapDeltaBytes: after.heapUsed - before.heapUsed,
      rssDeltaBytes: after.rss - before.rss,
    });
  }
  const averageMs = average(samples.map((sample) => sample.elapsedMs));
  results.push({
    name,
    averageMs,
    throughputMiBs: fixture.bytes.byteLength / MIB / (averageMs / 1000),
    minMs: Math.min(...samples.map((sample) => sample.elapsedMs)),
    maxMs: Math.max(...samples.map((sample) => sample.elapsedMs)),
    averageHeapDeltaBytes: average(samples.map((sample) => sample.heapDeltaBytes)),
    averageRssDeltaBytes: average(samples.map((sample) => sample.rssDeltaBytes)),
    summary: samples[0].summary,
  });
}

const output = {
  generatedAt: new Date().toISOString(),
  package: 'stax-xml',
  runtime: {
    name: 'node',
    version: process.version.slice(1),
    platform: `${process.platform}-${process.arch}`,
  },
  fixture: {
    bytes: fixture.bytes.byteLength,
    bookCount: fixture.bookCount,
  },
  contract: {
    parser: 'pure JavaScript StreamReaderSync batch path',
    manual: 'manual object projection over StreamReaderSync eventCount plus index accessors',
    converterAuto: 'converter schema parseSync(bytes), auto-lowered to compiled dispatch batch plan',
    converterCompiled: 'converter schema compile().parseSync(bytes), explicit compiled dispatch batch plan',
    maxEvents: args.maxEvents,
    native: false,
    wasm: false,
  },
  warmups: args.warmups,
  runs: args.runs,
  results,
};

printTable(output);

if (args.jsonOut) {
  writeOutput(args.jsonOut, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${resolve(process.cwd(), args.jsonOut)}`);
}
if (args.mdOut) {
  writeOutput(args.mdOut, formatMarkdown(output));
  console.log(`Wrote ${resolve(process.cwd(), args.mdOut)}`);
}

function consumeManualStreamReader(bytes) {
  const result = { books: [], firstTitle: undefined };
  let currentBook;
  let currentElement = '';

  for (const batch of new StreamReaderSync(bytes)) {
    for (let index = 0; index < batch.eventCount; index++) {
      const type = batch.typeAt(index);
      if (type === StreamEventType.START_ELEMENT) {
        const name = batch.nameAt(index);
        if (name === 'book') {
          currentBook = {
            id: batch.attributeValueAt(index, 'id') ?? '',
            title: '',
            author: '',
            price: 0,
            featured: undefined,
          };
        } else if (currentBook) {
          currentElement = name ?? '';
        }
        continue;
      }
      if (type === StreamEventType.CHARACTERS && currentBook) {
        const text = batch.textAt(index)?.trim();
        if (!text) continue;
        if (currentElement === 'title') {
          currentBook.title += text;
          result.firstTitle ??= currentBook.title;
        } else if (currentElement === 'author') {
          currentBook.author += text;
        } else if (currentElement === 'price') {
          currentBook.price = Number(text);
        } else if (currentElement === 'featured') {
          currentBook.featured = text;
        }
        continue;
      }
      if (type === StreamEventType.END_ELEMENT) {
        const name = batch.nameAt(index);
        if (name === 'book' && currentBook) {
          result.books.push(currentBook);
          currentBook = undefined;
        }
        currentElement = '';
      }
    }
  }

  return result;
}

function createCatalogFixture(targetBytes) {
  const rows = [];
  let byteLength = '<catalog></catalog>'.length;
  let index = 0;
  while (byteLength < targetBytes) {
    const row = [
      `<book id="book-${index}">`,
      `<title>Compiled Batch Plan ${index}</title>`,
      `<author>Author ${index % 97}</author>`,
      `<price>${(10 + (index % 500) / 10).toFixed(2)}</price>`,
      index % 5 === 0 ? `<featured>true</featured>` : '',
      '</book>',
    ].join('');
    rows.push(row);
    byteLength += row.length;
    index++;
  }
  const xml = `<catalog>${rows.join('')}</catalog>`;
  return {
    bytes: textEncoder.encode(xml),
    bookCount: rows.length,
  };
}

function summarize(value) {
  let checksum = 0;
  for (const book of value.books) {
    checksum = fold(checksum, book.id);
    checksum = fold(checksum, book.title);
    checksum = fold(checksum, book.author);
    checksum = fold(checksum, String(book.price));
    checksum = fold(checksum, book.featured ?? '');
  }
  return {
    books: value.books.length,
    firstTitle: value.firstTitle,
    checksum,
  };
}

function fold(seed, value) {
  let hash = seed | 0;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash | 0;
}

function sameSummary(left, right) {
  return left.books === right.books
    && left.firstTitle === right.firstTitle
    && left.checksum === right.checksum;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    targetBytes: 16 * MIB,
    warmups: 1,
    runs: 5,
    maxEvents: 20000000,
    jsonOut: undefined,
    mdOut: undefined,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--runs') args.runs = Number(argv[++index]);
    else if (arg.startsWith('--runs=')) args.runs = Number(arg.slice('--runs='.length));
    else if (arg === '--warmups') args.warmups = Number(argv[++index]);
    else if (arg.startsWith('--warmups=')) args.warmups = Number(arg.slice('--warmups='.length));
    else if (arg === '--size-mib') args.targetBytes = Number(argv[++index]) * MIB;
    else if (arg.startsWith('--size-mib=')) args.targetBytes = Number(arg.slice('--size-mib='.length)) * MIB;
    else if (arg === '--max-events') args.maxEvents = Number(argv[++index]);
    else if (arg.startsWith('--max-events=')) args.maxEvents = Number(arg.slice('--max-events='.length));
    else if (arg === '--json-out') args.jsonOut = argv[++index];
    else if (arg.startsWith('--json-out=')) args.jsonOut = arg.slice('--json-out='.length);
    else if (arg === '--md-out') args.mdOut = argv[++index];
    else if (arg.startsWith('--md-out=')) args.mdOut = arg.slice('--md-out='.length);
  }
  return args;
}

function formatBytes(bytes) {
  return `${(bytes / MIB).toFixed(2)} MiB`;
}

function formatMs(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(2)} ms`;
}

function printTable(output) {
  for (const result of output.results) {
    console.log(`${result.name.padEnd(39)} avg=${formatMs(result.averageMs)} throughput=${result.throughputMiBs.toFixed(2)} MiB/s books=${result.summary.books} checksum=${result.summary.checksum}`);
  }
}

function formatMarkdown(output) {
  const lines = [
    '# Converter Compiled Batch-Plan Benchmark',
    '',
    `Generated: ${output.generatedAt}`,
    '',
    'This benchmark compares a manual `StreamReaderSync` projection with converter schemas that are auto-lowered or explicitly lowered to the compiled batch dispatch plan.',
    'It measures the pure JavaScript path and does not use native addons, Wasm modules, or backend selection.',
    '',
    '## Results',
    '',
    '| Case | Throughput | Average | Min | Max | Books | Checksum |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...output.results.map((result) =>
      `| ${result.name} | ${result.throughputMiBs.toFixed(2)} MiB/s | ${formatMs(result.averageMs)} | ${formatMs(result.minMs)} | ${formatMs(result.maxMs)} | ${result.summary.books} | ${result.summary.checksum} |`
    ),
    '',
  ];
  return lines.join('\n');
}

function writeOutput(path, content) {
  const outputPath = resolve(process.cwd(), path);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, content, 'utf8');
}
