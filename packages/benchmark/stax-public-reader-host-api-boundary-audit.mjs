import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'stax-public-reader-host-api-boundary-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'stax-public-reader-host-api-boundary-audit.md');

const sourceFiles = {
  index: resolve(repoRoot, 'packages', 'stax-xml', 'src', 'index.ts'),
  iterableReader: resolve(repoRoot, 'packages', 'stax-xml', 'src', 'IterableReader.ts'),
  eventReader: resolve(repoRoot, 'packages', 'stax-xml', 'src', 'EventReader.ts'),
  eventReaderSync: resolve(repoRoot, 'packages', 'stax-xml', 'src', 'EventReaderSync.ts'),
  xmlObject: resolve(repoRoot, 'packages', 'stax-xml', 'src', 'XmlObject.ts'),
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
  console.log(`${report.objective}: primaryTextDecoder=${report.summary.primarySyncByteBatchRequiresTextDecoder} asciiPrimaryTextDecoder=${report.summary.asciiPrimarySyncByteBatchRequiresTextDecoder} stream=${report.summary.directReadableStreamRequiresReadableStream} alternateDecoderClosure=${report.summary.alternateDecoderWouldBeUnchangedClosure}`);
}

function createReport() {
  const sources = Object.fromEntries(Object.entries(sourceFiles).map(([key, path]) => [key, readSource(path)]));
  const checks = [
    {
      id: 'iterable-reader-constructs-textdecoder',
      source: 'IterableReader.ts',
      expected: 'IterableReader lazily constructs a native TextDecoder for non-ASCII byte-span string materialization.',
      matched: /private decoder: TextDecoder \| undefined/.test(sources.iterableReader.text)
        && /private getDecoder\(\): TextDecoder[\s\S]+?this\.decoder \?\?= new TextDecoder\(this\.decoderEncoding/.test(sources.iterableReader.text)
        && /fatal:\s*this\.decoderFatal/.test(sources.iterableReader.text)
        && /ignoreBOM:\s*true/.test(sources.iterableReader.text),
    },
    {
      id: 'iterable-reader-decodes-non-ascii-spans',
      source: 'IterableReader.ts',
      expected: 'decodeSpan first accepts short ASCII spans and falls back to TextDecoder only through getDecoder().',
      matched: /decodeSpan\(start: number, end: number\): string[\s\S]+?return this\.decodeBufferSpan\(this\.currentBuffer, start, end\)/.test(sources.iterableReader.text)
        && /private decodeBufferSpan\(buffer: Uint8Array, start: number, end: number\): string[\s\S]+?decodeShortAsciiSpan/.test(sources.iterableReader.text)
        && /return this\.getDecoder\(\)\.decode\(buffer\.subarray\(start, end\)\)/.test(sources.iterableReader.text),
    },
    {
      id: 'iterable-reader-ascii-spans-avoid-textdecoder',
      source: 'IterableReader.ts',
      expected: 'ASCII name/text/attribute spans return before getDecoder(), so ASCII primary byte-batch rows do not require TextDecoder.',
      matched: /private decodeBufferSpan\(buffer: Uint8Array, start: number, end: number\): string[\s\S]+?if \(ascii !== undefined\) \{[\s\S]+?return ascii;[\s\S]+?\}[\s\S]+?return this\.getDecoder\(\)\.decode/.test(sources.iterableReader.text)
        && /private materializeName\(nameId: number, buffer: Uint8Array, start: number, end: number\): string[\s\S]+?const name = this\.decodeBufferSpan\(buffer, start, end\)/.test(sources.iterableReader.text),
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
      expected: 'String-input EventReaderSync lazily encodes document-mode strings through a native TextEncoder before StreamReaderSync.',
      matched: /let textEncoder: TextEncoder \| undefined/.test(sources.eventReaderSync.text)
        && /function encodeXmlString\(xml: string\): Uint8Array[\s\S]+?textEncoder \?\?= new TextEncoder\(\)/.test(sources.eventReaderSync.text)
        && /new StreamReaderSync\(encodeXmlString\(xml\)/.test(sources.eventReaderSync.text),
    },
    {
      id: 'xml-object-string-input-uses-lazy-textencoder',
      source: 'XmlObject.ts',
      expected: 'String-input tree/object helpers lazily encode strings through a native TextEncoder, while byte inputs do not require it.',
      matched: /let textEncoder: TextEncoder \| undefined/.test(sources.xmlObject.text)
        && /function encodeXmlString\(input: string\): Uint8Array[\s\S]+?textEncoder \?\?= new TextEncoder\(\)/.test(sources.xmlObject.text)
        && /typeof input === 'string' \? encodeXmlString\(input\) : input/.test(sources.xmlObject.text)
        && /yield encodeXmlString\(input\)/.test(sources.xmlObject.text),
    },
    {
      id: 'root-import-no-top-level-textencoder',
      source: 'index.ts',
      expected: 'The root barrel can re-export StreamReaderSync, EventReaderSync, and XmlObject without a top-level TextEncoder allocation.',
      matched: /export \{ StreamEventType, StreamReaderSync \} from "\.\/StreamReaderSync\.js";/.test(sources.index.text)
        && !/const textEncoder = new TextEncoder\(\)/.test(sources.eventReaderSync.text)
        && !/const textEncoder = new TextEncoder\(\)/.test(sources.xmlObject.text),
    },
  ];
  const allChecksPass = checks.every(check => check.matched);
  const summary = {
    allChecksPass,
    primarySyncByteBatchRequiresTextDecoder: checksById(checks, 'iterable-reader-constructs-textdecoder', 'iterable-reader-decodes-non-ascii-spans', 'iterable-reader-public-copy-methods-use-decoder', 'stream-batch-public-accessors-call-copy-methods'),
    asciiPrimarySyncByteBatchRequiresTextDecoder: !checksById(checks, 'iterable-reader-ascii-spans-avoid-textdecoder'),
    directReadableStreamRequiresReadableStream: checksById(checks, 'event-reader-requires-web-readable-stream'),
    stringInputRequiresTextEncoder: checksById(checks, 'event-reader-sync-string-input-uses-textencoder', 'xml-object-string-input-uses-lazy-textencoder'),
    rootImportRequiresTextEncoder: !checksById(checks, 'root-import-no-top-level-textencoder'),
    primarySyncByteBatchRequiredGlobals: ['Uint8Array', 'TextDecoder'],
    asciiPrimarySyncByteBatchRequiredGlobals: ['Uint8Array'],
    directReadableStreamRequiredGlobals: ['Uint8Array', 'TextDecoder', 'ReadableStream'],
    stringInputRequiredGlobals: ['TextEncoder', 'TextDecoder'],
    rootImportRequiredGlobals: [],
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
        `asciiPrimarySyncByteBatchRequiresTextDecoder=${summary.asciiPrimarySyncByteBatchRequiresTextDecoder}`,
        `asciiPrimarySyncByteBatchRequiredGlobals=${summary.asciiPrimarySyncByteBatchRequiredGlobals.join(', ')}`,
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
    {
      id: 'stax-root-import-textencoder-not-primary-blocker',
      classification: 'SOURCE_FACT',
      summary: 'Root imports and primary byte-batch reader access do not require TextEncoder; TextEncoder is limited to string-input convenience paths.',
      evidence: [
        `rootImportRequiresTextEncoder=${summary.rootImportRequiresTextEncoder}`,
        `stringInputRequiresTextEncoder=${summary.stringInputRequiresTextEncoder}`,
        `rootImportRequiredGlobals=${summary.rootImportRequiredGlobals.join(', ') || 'none'}`,
      ],
    },
    {
      id: 'stax-ascii-primary-byte-batch-textdecoder-not-blocker',
      classification: 'SOURCE_FACT',
      summary: 'ASCII primary byte-batch name, text, and attribute accessors can materialize strings through the internal ASCII span path without TextDecoder.',
      evidence: [
        `asciiPrimarySyncByteBatchRequiresTextDecoder=${summary.asciiPrimarySyncByteBatchRequiresTextDecoder}`,
        `asciiPrimarySyncByteBatchRequiredGlobals=${summary.asciiPrimarySyncByteBatchRequiredGlobals.join(', ')}`,
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
    `- ASCII primary sync byte-batch requires TextDecoder: ${report.summary.asciiPrimarySyncByteBatchRequiresTextDecoder}`,
    `- Direct ReadableStream requires ReadableStream: ${report.summary.directReadableStreamRequiresReadableStream}`,
    `- String input requires TextEncoder: ${report.summary.stringInputRequiresTextEncoder}`,
    `- Root import requires TextEncoder: ${report.summary.rootImportRequiresTextEncoder}`,
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
