import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'multi-chunk-batch-shape-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'multi-chunk-batch-shape-audit.md');
const sourceFiles = [
  resolve(__dirname, '../stax-xml/src/IterableReader.ts'),
  resolve(__dirname, '../stax-xml/src/iterable/Uint8ArrayCurrentCursor.ts'),
];

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
  printSummary(report);
}

function createReport() {
  const files = sourceFiles.map(readSourceFile);
  const requiredFacts = [
    createFact(files, {
      id: 'single-item-batch-direct-view',
      classification: 'SOURCE_FACT',
      summary: 'Both sync byte readers special-case a single Uint8Array batch without pending tail as a direct view.',
      patterns: [
        'if (!hasTail && batch.length === 1)',
        'return asUint8ArrayView(batch[0]!)',
      ],
    }),
    createFact(files, {
      id: 'multi-item-batch-concat',
      classification: 'SOURCE_FACT',
      summary: 'Both sync byte readers concatenate multi-item Uint8Array batches into one parser buffer before scanning.',
      patterns: [
        'return concatUint8Arrays(buffers, total)',
        'buffer.set(chunk, offset)',
      ],
    }),
    createFact(files, {
      id: 'single-buffer-span-model',
      classification: 'SOURCE_FACT',
      summary: 'Parser spans, materialization, and raw batch frames are indexed into one currentBuffer, so no-concat chunk-array scanning is a parser-core change rather than a benchmark flag.',
      patterns: [
        'private currentBuffer: Uint8Array',
        'nameStarts',
        'attrNameStarts',
        'decodeUtf8(this.currentBuffer',
        'this.frame.buffer = this.currentBuffer',
      ],
    }),
  ];
  const missingFacts = requiredFacts.filter(fact => fact.missingPatterns.length > 0);
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'multi-chunk-batch-shape-audit',
    contract: 'sync-uint8array-byte-batch-buffer-shape',
    note: 'Audits the current sync parser source shape behind Iterable<Uint8Array[]> batch-size experiments. This is source evidence only; it is not a benchmark row and not a runtime-limit conclusion.',
    sourceFiles: files.map(file => ({
      path: relative(repoRoot, file.path),
      lineCount: file.lines.length,
      currentBufferOccurrences: countPattern(file.text, 'currentBuffer'),
      pendingTailOccurrences: countPattern(file.text, 'pendingTail'),
      concatOccurrences: countPattern(file.text, 'concatUint8Arrays'),
    })),
    findings: [
      ...requiredFacts,
      {
        id: 'no-concat-prototype-scope',
        classification: missingFacts.length === 0 ? 'SCOPE_GUARD' : 'OPEN',
        summary: missingFacts.length === 0
          ? 'A no-concat multi-chunk batch path would need to replace the single-currentBuffer span model or add a segmented-buffer abstraction through scanning, span storage, decoding, and raw-frame exposure.'
          : 'The audit could not verify all source-shape facts, so no conclusion about the no-concat prototype scope is allowed.',
        evidence: missingFacts.length === 0
          ? [
              'current model: single Uint8Array currentBuffer',
              'multi-item batch: concat before scan',
              'raw frame: exposes one buffer plus start/end spans',
            ]
          : missingFacts.map(fact => `${fact.id}: missing ${fact.missingPatterns.join(', ')}`),
      },
    ],
  };
  report.summary = {
    status: missingFacts.length === 0 ? 'source-shape-confirmed' : 'source-shape-incomplete',
    missingFactCount: missingFacts.length,
    sourceFileCount: files.length,
  };
  return report;
}

function readSourceFile(path) {
  if (!existsSync(path)) {
    throw new Error(`source file was not found: ${path}`);
  }
  const text = readFileSync(path, 'utf8');
  return {
    path,
    text,
    lines: text.split(/\r?\n/),
  };
}

function createFact(files, options) {
  const evidence = [];
  const missingPatterns = [];
  for (const pattern of options.patterns) {
    const matches = files.flatMap(file => findPattern(file, pattern));
    if (matches.length === 0) {
      missingPatterns.push(pattern);
      continue;
    }
    evidence.push(...matches.map(match => `${relative(repoRoot, match.path)}:${match.line}: ${pattern}`));
  }
  return {
    id: options.id,
    classification: options.classification,
    summary: options.summary,
    evidence,
    missingPatterns,
  };
}

function findPattern(file, pattern) {
  const matches = [];
  for (let index = 0; index < file.lines.length; index++) {
    if (file.lines[index].includes(pattern)) {
      matches.push({ path: file.path, line: index + 1 });
    }
  }
  return matches;
}

function countPattern(text, pattern) {
  return text.split(pattern).length - 1;
}

function renderMarkdown(report) {
  const lines = [
    '# Multi-Chunk Batch Shape Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Status: ${report.summary.status}`,
    `- Source files: ${report.summary.sourceFileCount}`,
    `- Missing facts: ${report.summary.missingFactCount}`,
    '',
    '## Source Files',
    '',
    '| File | Lines | currentBuffer | pendingTail | concatUint8Arrays |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...report.sourceFiles.map(file =>
      `| ${file.path} | ${file.lineCount} | ${file.currentBufferOccurrences} | ${file.pendingTailOccurrences} | ${file.concatOccurrences} |`),
    '',
    '## Findings',
    '',
  ];
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const item of finding.evidence) {
      lines.push(`  - ${item}`);
    }
    if ((finding.missingPatterns ?? []).length > 0) {
      lines.push(`  - missing: ${finding.missingPatterns.join(', ')}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function printSummary(report) {
  console.log(`multi-chunk-batch-shape-audit: status=${report.summary.status} missing=${report.summary.missingFactCount}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
