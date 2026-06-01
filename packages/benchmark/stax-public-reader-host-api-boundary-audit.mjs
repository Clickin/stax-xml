import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'stax-public-reader-host-api-boundary-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'stax-public-reader-host-api-boundary-audit.md');

const sourceFiles = {
  iterableReader: resolve(repoRoot, 'packages', 'stax-xml', 'src', 'IterableReader.ts'),
  eventReader: resolve(repoRoot, 'packages', 'stax-xml', 'src', 'EventReader.ts'),
  eventReaderSync: resolve(repoRoot, 'packages', 'stax-xml', 'src', 'EventReaderSync.ts'),
  streamReaderCore: resolve(repoRoot, 'packages', 'stax-xml', 'src', 'stream-reader-core.ts'),
};

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
  console.log(`${report.objective}: primaryTextDecoder=${report.summary.primarySyncByteBatchRequiresTextDecoder} stream=${report.summary.directReadableStreamRequiresReadableStream} alternateDecoderClosure=${report.summary.alternateDecoderWouldBeUnchangedClosure}`);
}

function createReport() {
  const sources = Object.fromEntries(Object.entries(sourceFiles).map(([key, path]) => [key, readSource(path)]));
  const checks = [
    {
      id: 'iterable-reader-constructs-textdecoder',
      source: 'IterableReader.ts',
      expected: 'IterableReader constructs a native TextDecoder for byte-span string materialization.',
      matched: /this\.decoder\s*=\s*new TextDecoder\(options\.encoding \?\? 'utf-8'/.test(sources.iterableReader.text)
        && /fatal:\s*this\.documentMode === 'document'/.test(sources.iterableReader.text)
        && /ignoreBOM:\s*true/.test(sources.iterableReader.text),
    },
    {
      id: 'iterable-reader-decodes-non-ascii-spans',
      source: 'IterableReader.ts',
      expected: 'decodeSpan falls back to TextDecoder.decode(currentBuffer.subarray(start, end)).',
      matched: /decodeSpan\(start: number, end: number\): string[\s\S]+?decodeShortAsciiSpan/.test(sources.iterableReader.text)
        && /return this\.decoder\.decode\(this\.currentBuffer\.subarray\(start, end\)\)/.test(sources.iterableReader.text),
    },
    {
      id: 'iterable-reader-public-copy-methods-use-decoder',
      source: 'IterableReader.ts',
      expected: 'copyText, copyAttrValue, and copyAttributesObject route public string values through decodeSpan/materializeName.',
      matched: /copyText\(index: number\): string \| undefined[\s\S]+?this\.decodeSpan/.test(sources.iterableReader.text)
        && /copyAttrValue\(eventIndex: number, attrIndex: number\): string \| undefined[\s\S]+?this\.decodeSpan/.test(sources.iterableReader.text)
        && /copyAttributesObject\(eventIndex: number\): Record<string, string>[\s\S]+?attributes\[name\] = this\.decodeSpan/.test(sources.iterableReader.text),
    },
    {
      id: 'stream-batch-public-accessors-call-copy-methods',
      source: 'stream-reader-core.ts',
      expected: 'StreamBatch public name/text/attribute accessors call source copy methods.',
      matched: /nameAt\(index: number\): string \| undefined[\s\S]+?return this\.source\.copyName\(index\)/.test(sources.streamReaderCore.text)
        && /textAt\(index: number\): string \| undefined[\s\S]+?return this\.source\.copyText\(index\)/.test(sources.streamReaderCore.text)
        && /attributeNameAt\(eventIndex: number, attrIndex: number\): string \| undefined[\s\S]+?return this\.source\.copyAttrName/.test(sources.streamReaderCore.text)
        && /attributeValueAt\(eventIndex: number, attrIndexOrName: number \| string\): string \| undefined[\s\S]+?this\.source\.copyAttrValue/.test(sources.streamReaderCore.text),
    },
    {
      id: 'event-reader-requires-web-readable-stream',
      source: 'EventReader.ts',
      expected: 'The async public EventReader constructor requires a Web ReadableStream and consumes it through getReader().',
      matched: /constructor\(xmlStream: ReadableStream<Uint8Array>/.test(sources.eventReader.text)
        && /xmlStream instanceof ReadableStream/.test(sources.eventReader.text)
        && /this\.reader = stream\.getReader\(\)/.test(sources.eventReader.text),
    },
    {
      id: 'event-reader-sync-string-input-uses-textencoder',
      source: 'EventReaderSync.ts',
      expected: 'String-input EventReaderSync encodes document-mode strings through a native TextEncoder before StreamReaderSync.',
      matched: /const textEncoder = new TextEncoder\(\)/.test(sources.eventReaderSync.text)
        && /new StreamReaderSync\(textEncoder\.encode\(xml\)/.test(sources.eventReaderSync.text),
    },
  ];
  const allChecksPass = checks.every(check => check.matched);
  const summary = {
    allChecksPass,
    primarySyncByteBatchRequiresTextDecoder: checksById(checks, 'iterable-reader-constructs-textdecoder', 'iterable-reader-decodes-non-ascii-spans', 'iterable-reader-public-copy-methods-use-decoder', 'stream-batch-public-accessors-call-copy-methods'),
    directReadableStreamRequiresReadableStream: checksById(checks, 'event-reader-requires-web-readable-stream'),
    stringInputRequiresTextEncoder: checksById(checks, 'event-reader-sync-string-input-uses-textencoder'),
    primarySyncByteBatchRequiredGlobals: ['Uint8Array', 'TextDecoder'],
    directReadableStreamRequiredGlobals: ['Uint8Array', 'TextDecoder', 'ReadableStream'],
    stringInputRequiredGlobals: ['TextEncoder', 'TextDecoder'],
    alternateDecoderWouldBeUnchangedClosure: false,
    conclusionAllowed: false,
  };
  return {
    generatedAt: new Date().toISOString(),
    objective: 'stax-public-reader-host-api-boundary-audit',
    contract: 'current-stax-public-reader-host-api-boundary',
    note: 'Static source-boundary audit for the current StAX public reader host API surface. It pins the TextDecoder/ReadableStream/TextEncoder boundary used by same-contract full-string rows; it is not benchmark evidence, codegen evidence, or a runtime-limit conclusion.',
    sources: Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, source.summary])),
    checks,
    summary,
    findings: createFindings(summary),
  };
}

function checksById(checks, ...ids) {
  return ids.every(id => checks.find(check => check.id === id)?.matched === true);
}

function createFindings(summary) {
  return [
    {
      id: 'stax-primary-sync-byte-batch-textdecoder-boundary',
      classification: 'SOURCE_FACT',
      summary: 'Current primary synchronous Iterable<Uint8Array[]> full-string rows require TextDecoder for public string materialization.',
      evidence: [
        `primarySyncByteBatchRequiresTextDecoder=${summary.primarySyncByteBatchRequiresTextDecoder}`,
        `primarySyncByteBatchRequiredGlobals=${summary.primarySyncByteBatchRequiredGlobals.join(', ')}`,
      ],
    },
    {
      id: 'stax-host-api-substitution-scope-guard',
      classification: 'SCOPE_GUARD',
      summary: 'A js-shell polyfill or alternate decoder can be useful diagnostic evidence, but it is not unchanged StAX public-reader closure evidence.',
      evidence: [
        `directReadableStreamRequiresReadableStream=${summary.directReadableStreamRequiresReadableStream}`,
        `stringInputRequiresTextEncoder=${summary.stringInputRequiresTextEncoder}`,
        `alternateDecoderWouldBeUnchangedClosure=${summary.alternateDecoderWouldBeUnchangedClosure}`,
      ],
    },
  ];
}

function readSource(path) {
  if (!existsSync(path)) throw new Error(`Source file not found: ${path}`);
  const text = readFileSync(path, 'utf8');
  return {
    text,
    summary: {
      path: relative(repoRoot, path).replace(/\\/g, '/'),
      bytes: Buffer.byteLength(text, 'utf8'),
    },
  };
}

function renderMarkdown(report) {
  const lines = [
    '# StAX Public Reader Host API Boundary Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- All checks pass: ${report.summary.allChecksPass}`,
    `- Primary sync byte-batch requires TextDecoder: ${report.summary.primarySyncByteBatchRequiresTextDecoder}`,
    `- Direct ReadableStream requires ReadableStream: ${report.summary.directReadableStreamRequiresReadableStream}`,
    `- String input requires TextEncoder: ${report.summary.stringInputRequiresTextEncoder}`,
    `- Alternate decoder is unchanged closure: ${report.summary.alternateDecoderWouldBeUnchangedClosure}`,
    '',
    '## Checks',
    '',
    '| Check | Source | Matched | Expected |',
    '| --- | --- | --- | --- |',
  ];
  for (const check of report.checks) {
    lines.push(`| \`${check.id}\` | \`${check.source}\` | ${check.matched ? 'yes' : 'no'} | ${check.expected} |`);
  }
  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const item of finding.evidence) {
      lines.push(`  - ${item}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function writeOutput(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

main();
