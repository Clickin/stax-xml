import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StreamReaderSync } from '../stax-xml/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = join(__dirname, 'results', 'release', 'raw-batch-kind-shape-audit.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'raw-batch-kind-shape-audit.md');
const streamReaderSyncSource = join(__dirname, '..', 'stax-xml', 'src', 'StreamReaderSync.ts');
const streamReaderCoreSource = join(__dirname, '..', 'stax-xml', 'src', 'stream-reader-core.ts');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} requires a value.`);
      index++;
      return value;
    };

    switch (name) {
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function main() {
  const options = parseArgs();
  const report = createReport();
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`raw-batch-kind-shape-audit: declared=${report.summary.declaredKindCount} observed=${report.summary.observedKindCount} unavailable=${report.summary.unavailableDeclaredKinds.length}`);
}

function createReport() {
  const coreSource = readFileSync(streamReaderCoreSource, 'utf8');
  const syncSource = readFileSync(streamReaderSyncSource, 'utf8');
  const declaredKinds = extractDeclaredKinds(coreSource);
  const observedKinds = observeRawBatchKinds();
  const returnedKindLiterals = extractReturnedKindLiterals(syncSource);
  const unavailableDeclaredKinds = declaredKinds.filter(kind => !observedKinds.includes(kind));
  return {
    generatedAt: new Date().toISOString(),
    objective: 'raw-batch-kind-shape-audit',
    contract: 'runtime-and-source-raw-batch-kind-shape',
    note: 'Audits which StreamReaderSyncRawBatch discriminant kinds are declared in public types versus actually returned by the current StreamReaderSync.nextRawBatch implementation. This is source/runtime shape evidence, not a throughput benchmark.',
    environment: {
      node: process.version,
      v8: process.versions.v8,
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
    },
    sourceFiles: {
      streamReaderCore: streamReaderCoreSource,
      streamReaderSync: streamReaderSyncSource,
    },
    declaredKinds,
    observedKinds,
    returnedKindLiterals,
    summary: {
      declaredKindCount: declaredKinds.length,
      observedKindCount: observedKinds.length,
      unavailableDeclaredKinds,
      wordTableAvailable: observedKinds.includes('word-table'),
      soaStringArenaAvailable: observedKinds.includes('soa-string-arena'),
    },
    findings: createFindings(declaredKinds, observedKinds, returnedKindLiterals, unavailableDeclaredKinds),
  };
}

function extractDeclaredKinds(source) {
  return unique([...source.matchAll(/readonly kind:\s+'([^']+)'/g)].map(match => match[1])).sort();
}

function extractReturnedKindLiterals(source) {
  return unique([...source.matchAll(/kind:\s+'([^']+)'/g)].map(match => match[1])).sort();
}

function observeRawBatchKinds() {
  const xml = new TextEncoder().encode('<root><item id="1">alpha</item><item id="2">beta</item></root>');
  const reader = new StreamReaderSync(xml);
  const kinds = [];
  let frame;
  while ((frame = reader.nextRawBatch()) !== null) {
    kinds.push(frame.kind);
  }
  return unique(kinds).sort();
}

function createFindings(declaredKinds, observedKinds, returnedKindLiterals, unavailableDeclaredKinds) {
  return [
    {
      id: 'raw-batch-declared-kinds',
      classification: 'SOURCE_FACT',
      summary: 'StreamReaderSyncRawBatch currently declares multiple discriminant kinds in public types.',
      evidence: declaredKinds,
    },
    {
      id: 'raw-batch-runtime-kinds',
      classification: 'SOURCE_FACT',
      summary: 'The current StreamReaderSync.nextRawBatch implementation returns only the kinds observed by this runtime audit.',
      evidence: observedKinds.map(kind => `${kind}: observed`).concat(returnedKindLiterals.map(kind => `${kind}: source return literal`)),
    },
    {
      id: 'word-table-string-arena-unavailable',
      classification: unavailableDeclaredKinds.length > 0 ? 'NEGATIVE_RESULT' : 'SOURCE_FACT',
      summary: unavailableDeclaredKinds.length > 0
        ? 'Declared raw-batch kinds are not all implemented by the current runtime path.'
        : 'All declared raw-batch kinds were observed at runtime.',
      evidence: unavailableDeclaredKinds.map(kind => `${kind}: declared but not observed`),
    },
    {
      id: 'shape-scope-guard',
      classification: 'SCOPE_GUARD',
      summary: 'Unavailable raw-batch kinds are implementation opportunities, not measured performance counterexamples or runtime ceiling proof.',
      evidence: ['No throughput conclusion is allowed from this shape audit.'],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Raw Batch Kind Shape Audit');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(report.note);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Declared raw-batch kinds: ${report.declaredKinds.map(kind => `\`${kind}\``).join(', ')}`);
  lines.push(`- Observed runtime raw-batch kinds: ${report.observedKinds.map(kind => `\`${kind}\``).join(', ') || 'none'}`);
  lines.push(`- Source return kind literals: ${report.returnedKindLiterals.map(kind => `\`${kind}\``).join(', ') || 'none'}`);
  lines.push(`- word-table available: ${report.summary.wordTableAvailable ? 'yes' : 'no'}`);
  lines.push(`- soa-string-arena available: ${report.summary.soaStringArenaAvailable ? 'yes' : 'no'}`);
  lines.push(`- Unavailable declared kinds: ${report.summary.unavailableDeclaredKinds.map(kind => `\`${kind}\``).join(', ') || 'none'}`);
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  lines.push('## Limits');
  lines.push('');
  lines.push('- This artifact does not benchmark a word-table or string-arena implementation.');
  lines.push('- Missing availability is not evidence that those layouts would be slow; it only means current release rows have not tested them.');
  lines.push('- A future implementation must still pass the same full-string checksum, bounded-memory, and runtime comparison gates.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function unique(values) {
  return [...new Set(values)];
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

main();
