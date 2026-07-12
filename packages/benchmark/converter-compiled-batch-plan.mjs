#!/usr/bin/env node
/**
 * Converter compiled batch-plan benchmark.
 *
 * Rewritten to use the shared benchmark harness.
 * Run: node --expose-gc converter-compiled-batch-plan.mjs [options]
 *
 * Equivalent to original. Cases extracted to harness/cases/converter-catalog.mjs.
 *
 * Options:
 *   --size-mib=<n>   Target buffer size in MiB (default 16)
 *   --runs=<n>       Measurement iterations (default 5)
 *   --warmups=<n>    Warmup iterations (default 1)
 *   --max-events=<n> Max events for converter parseSync (default 20000000)
 *   --json-out=<path>
 *   --md-out=<path>
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { StreamReaderSync, XmlEventType } from 'stax-xml';
import { dirname, resolve } from 'node:path';
import { runBenchmark } from './harness/run.mjs';
import {
  createCatalogFixture,
  createConverterCases,
  summarize,
  sameSummary,
  catalogSchema,
  compiledCatalogSchema,
} from './harness/cases/converter-catalog.mjs';

const MIB = 1024 * 1024;

const args = parseArgs();
const targetBytes = args.targetBytes;
const fixture = createCatalogFixture(targetBytes);
const parseOptions = { maxEvents: args.maxEvents };

console.log('Converter compiled batch-plan benchmark');
console.log(`target=${formatBytes(fixture.bytes.byteLength)}, books=${fixture.bookCount}, warmups=${args.warmups}, runs=${args.runs}, maxEvents=${args.maxEvents}`);

// ── Parity check (cross-variant, before measurement) ────────────
{
  const manualResult = consumeManualCursorReader(fixture.bytes);
  const manualSummary = summarize(manualResult);
  const autoSummary = summarize(catalogSchema.parseSync(fixture.bytes, parseOptions));
  const compiledSummary = summarize(compiledCatalogSchema.parseSync(fixture.bytes, parseOptions));

  if (!sameSummary(manualSummary, autoSummary) || !sameSummary(manualSummary, compiledSummary)) {
    throw new Error(`Converter parity mismatch: ${JSON.stringify({ manualSummary, autoSummary, compiledSummary })}`);
  }
}

// ── Benchmark via harness ───────────────────────────────────────
async function main() {
  const result = await runBenchmark({
    label: 'converter-compiled-batch-plan',
    fixture: { kind: 'buffer', buffer: fixture.bytes },
    runs: args.runs,
    warmups: args.warmups,
    parityCheck: true,
    cases: createConverterCases(fixture.bytes),
  });

  // Print table (same format as original)
  for (const [id, v] of Object.entries(result.variants)) {
    console.log(`${id.padEnd(39)} avg=${formatMs(v.avgMs)} throughput=${v.mibPerSec.toFixed(2)} MiB/s events=${v.eventCount} checksum=${v.checksum}`);
  }

  // Write output
  if (args.jsonOut) {
    writeOutput(args.jsonOut, JSON.stringify(result, null, 2) + '\n');
    console.log(`Wrote ${resolve(process.cwd(), args.jsonOut)}`);
  }
  if (args.mdOut) {
    writeOutput(args.mdOut, formatMarkdown(result));
    console.log(`Wrote ${resolve(process.cwd(), args.mdOut)}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

// ── Manual consumer (parity reference) ──────────────────────────

function consumeManualCursorReader(bytes) {
  const result = { books: [], firstTitle: undefined };
  let currentBook;
  let currentElement = '';
  const reader = new StreamReaderSync(bytes);

  while (reader.next()) {
    const type = reader.eventType();
    if (type === XmlEventType.START_ELEMENT) {
      const name = reader.name();
      if (name === 'book') {
        currentBook = {
          id: reader.attributeValue('id') ?? '',
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
    if (type === XmlEventType.CHARACTERS && currentBook) {
      const text = reader.text()?.trim();
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
    if (type === XmlEventType.END_ELEMENT) {
      const name = reader.name();
      if (name === 'book' && currentBook) {
        result.books.push(currentBook);
        currentBook = undefined;
      }
      currentElement = '';
    }
  }

  return result;
}

// ── CLI arg parsing ─────────────────────────────────────────────

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

function formatMarkdown(result) {
  const variants = Object.values(result.variants);
  const lines = [
    '# Converter Compiled Batch-Plan Benchmark',
    '',
    `Generated: ${result.metadata.collectedAt}`,
    '',
    'This benchmark compares a manual `CursorReaderSync` projection with converter schemas that are auto-lowered or explicitly lowered to the compiled cursor dispatch plan.',
    '',
    '## Results',
    '',
    '| Case | Throughput | Average | Min | Max | Events | Checksum |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...variants.map((v) =>
      `| ${v.id} | ${v.mibPerSec.toFixed(2)} MiB/s | ${formatMs(v.avgMs)} | ${formatMs(v.minMs)} | ${formatMs(v.maxMs)} | ${v.eventCount} | ${v.checksum} |`
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
