import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'node-textdecoder-source-pin-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'node-textdecoder-source-pin-audit.md');
const defaultRepository = 'nodejs/node';

const sourcePaths = {
  encodingJs: 'lib/internal/encoding.js',
  encodingBinding: 'src/encoding_binding.cc',
  stringBytes: 'src/string_bytes.cc',
};

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sourceDir: null,
    revision: `v${process.versions.node}`,
    nodeVersion: process.version,
    v8Version: process.versions.v8,
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
      case '--source-dir':
        options.sourceDir = resolve(process.cwd(), readValue());
        break;
      case '--revision':
        options.revision = readValue();
        break;
      case '--node-version':
        options.nodeVersion = readValue();
        break;
      case '--v8-version':
        options.v8Version = readValue();
        break;
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

  if (options.sourceDir && !existsSync(options.sourceDir)) {
    throw new Error(`--source-dir does not exist: ${options.sourceDir}`);
  }
  return options;
}

async function main() {
  const options = parseArgs();
  const sources = await loadSources(options);
  const report = createReport({ options, sources });
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

async function loadSources(options) {
  const loaded = {};
  for (const [key, sourcePath] of Object.entries(sourcePaths)) {
    loaded[key] = await loadSource(options, sourcePath);
  }
  return loaded;
}

async function loadSource(options, sourcePath) {
  if (options.sourceDir) {
    const filePath = join(options.sourceDir, ...sourcePath.split('/'));
    if (!existsSync(filePath)) throw new Error(`Missing fixture source file: ${filePath}`);
    return {
      path: sourcePath,
      text: readFileSync(filePath, 'utf8'),
      url: `source-file:${filePath}`,
      fetchedAt: new Date().toISOString(),
    };
  }

  const fetchUrl = rawSourceUrl(options.revision, sourcePath);
  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Node source ${sourcePath}: HTTP ${response.status} ${await response.text()}`);
  }
  return {
    path: sourcePath,
    text: await response.text(),
    url: browserSourceUrl(options.revision, sourcePath),
    fetchUrl,
    fetchedAt: new Date().toISOString(),
  };
}

function rawSourceUrl(revision, sourcePath) {
  return `https://raw.githubusercontent.com/${defaultRepository}/${revision}/${sourcePath}`;
}

function browserSourceUrl(revision, sourcePath) {
  return `https://github.com/${defaultRepository}/blob/${revision}/${sourcePath}`;
}

function createReport({ options, sources }) {
  const indexed = Object.fromEntries(
    Object.entries(sources).map(([key, source]) => [key, { source, lines: source.text.split(/\r?\n/) }]),
  );

  const anchors = {
    textDecoderClass: findAnchor(indexed.encodingJs, 'TextDecoder class', line => line.includes('class TextDecoder')),
    textDecoderDecode: findAnchor(indexed.encodingJs, 'TextDecoder.decode', line => line.includes('decode(input = empty')),
    utf8FastPath: findAnchor(indexed.encodingJs, 'kUTF8FastPath branch', line => line.includes('this[kUTF8FastPath]')),
    directDecodeUtf8: findAnchor(indexed.encodingJs, 'direct decodeUTF8 fast path', line => line.includes('return decodeUTF8(input, ignoreBom, this[kFatal])')),
    streamingDecodeUtf8: findAnchor(indexed.encodingJs, 'streaming decodeUTF8 call', line => line.includes('decodeUTF8(u, ignoreBom || prefix, this[kFatal])')),
    parseInputFunction: findAnchor(indexed.encodingJs, 'parseInput function', line => line.includes('function parseInput(input)')),
    parseInputViewFastBuffer: findAnchor(indexed.encodingJs, 'ArrayBufferView FastBuffer wrapper', line => line.includes('new FastBuffer(input.buffer, input.byteOffset, input.byteLength)')),
    decodeUtf8Binding: findAnchor(indexed.encodingBinding, 'BindingData::DecodeUTF8', line => line.includes('BindingData::DecodeUTF8')),
    arrayBufferViewContents: findAnchor(indexed.encodingBinding, 'ArrayBufferViewContents<char>', line => line.includes('ArrayBufferViewContents<char> buffer(args[0])')),
    simdutfFatalAsciiValidation: findAnchor(indexed.encodingBinding, 'fatal ASCII validation', line => line.includes('simdutf::validate_ascii_with_errors(data, length)')),
    bindingStringBytesEncodeUtf8: findAnchor(indexed.encodingBinding, 'DecodeUTF8 StringBytes::Encode UTF8', line => line.includes('StringBytes::Encode(env->isolate(), data, length, UTF8)')),
    stringBytesEncode: findAnchor(indexed.stringBytes, 'StringBytes::Encode', line => line.includes('StringBytes::Encode(Isolate* isolate')),
    stringBytesUtf8Case: findAnchor(indexed.stringBytes, 'StringBytes UTF8 case', (line, index, lines) => (
      line.includes('case UTF8') && contextText(lines, index, 35).includes('String::NewFromUtf8')
    )),
    asciiFastPathCopy: findAnchor(indexed.stringBytes, 'UTF8 ASCII fast path NewFromCopy', (line, index, lines) => (
      line.includes('return ExternOneByteString::NewFromCopy(isolate, buf, buflen)') &&
      contextText(lines, index, 4).includes('ASCII fast path')
    )),
    newFromUtf8Fallback: findAnchor(indexed.stringBytes, 'String::NewFromUtf8 fallback', line => line.includes('String::NewFromUtf8(isolate, buf, v8::NewStringType::kNormal, buflen)')),
    simdutfUtf16Conversion: findAnchor(indexed.stringBytes, 'simdutf UTF8 to UTF16 conversion', line => line.includes('simdutf::convert_valid_utf8_to_utf16')),
    externalTwoByteNew: findAnchor(indexed.stringBytes, 'ExternTwoByteString::New', line => line.includes('return ExternTwoByteString::New(isolate, dst, utf16len)')),
    externStringCopy: findAnchor(indexed.stringBytes, 'ExternString NewFromCopy memcpy', line => line.includes('memcpy(new_data, data, length * sizeof(*new_data))')),
    newFromOneByte: findAnchor(indexed.stringBytes, 'String::NewFromOneByte simple copy', line => line.includes('String::NewFromOneByte(isolate')),
    newFromTwoByte: findAnchor(indexed.stringBytes, 'String::NewFromTwoByte simple copy', line => line.includes('String::NewFromTwoByte(isolate')),
  };

  assertFound(anchors);

  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'node-textdecoder-source-pin-audit',
    contract: 'node-exact-revision-textdecoder-string-boundary-source-lines',
    note: 'Exact Node source-line pinning for TextDecoder.decode and StringBytes::Encode. These source facts constrain the Node TextDecoder string-creation boundary; they are not a throughput proof and do not cover browser TextDecoder implementations.',
    environment: {
      nodeVersion: options.nodeVersion,
      v8Version: options.v8Version,
    },
    source: {
      repository: defaultRepository,
      revision: options.revision,
      files: Object.values(sourcePaths),
      fetchedAt: Object.values(sources).map(source => source.fetchedAt).sort()[0],
    },
    anchors,
  };
  report.findings = createFindings(report);
  return report;
}

function findAnchor(indexedSource, label, predicate) {
  const { source, lines } = indexedSource;
  const index = lines.findIndex((line, lineIndex) => predicate(line, lineIndex, lines));
  if (index < 0) {
    return {
      status: 'missing',
      label,
      file: source.path,
      lineNumber: null,
      url: null,
      context: [],
    };
  }
  return {
    status: 'found',
    label,
    file: source.path,
    lineNumber: index + 1,
    url: `${source.url}${source.url.startsWith('source-file:') ? ':' : '#L'}${index + 1}`,
    context: contextLines(lines, index, 2),
  };
}

function contextLines(lines, index, radius) {
  const start = Math.max(0, index - radius);
  const end = Math.min(lines.length, index + radius + 1);
  const output = [];
  for (let next = start; next < end; next++) {
    output.push({
      lineNumber: next + 1,
      text: lines[next],
    });
  }
  return output;
}

function contextText(lines, index, radius) {
  const start = Math.max(0, index - radius);
  const end = Math.min(lines.length, index + radius + 1);
  return lines.slice(start, end).join('\n');
}

function assertFound(anchors) {
  const missing = Object.entries(anchors)
    .filter(([, anchor]) => anchor.status !== 'found')
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing source anchors: ${missing.join(', ')}`);
  }
}

function createFindings(report) {
  return [
    {
      id: 'node-textdecoder-js-fast-path-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'Node TextDecoder.decode reaches a UTF-8 fast path that calls the internal decodeUTF8 binding for non-streaming and streaming UTF-8 inputs.',
      evidence: [
        `TextDecoder.decode line ${report.anchors.textDecoderDecode.lineNumber}`,
        `direct decodeUTF8 line ${report.anchors.directDecodeUtf8.lineNumber}`,
        `streaming decodeUTF8 line ${report.anchors.streamingDecodeUtf8.lineNumber}`,
      ],
    },
    {
      id: 'node-textdecoder-buffer-source-boundary',
      classification: 'SOURCE_FACT',
      summary: 'The Node fast path accepts ArrayBuffer and ArrayBufferView input at the binding boundary; stream bookkeeping can wrap ArrayBufferView input as FastBuffer, but the benchmark does not call Buffer.toString().',
      evidence: [
        `parseInput line ${report.anchors.parseInputFunction.lineNumber}`,
        `ArrayBufferView FastBuffer wrapper line ${report.anchors.parseInputViewFastBuffer.lineNumber}`,
        `ArrayBufferViewContents<char> line ${report.anchors.arrayBufferViewContents.lineNumber}`,
      ],
    },
    {
      id: 'node-textdecoder-v8-string-creation-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'Node DecodeUTF8 returns JavaScript strings through StringBytes::Encode; its UTF-8 branch uses ASCII copy, simdutf UTF-16 conversion plus external string resource, or V8 String::NewFromUtf8 fallback.',
      evidence: [
        `DecodeUTF8 StringBytes::Encode UTF8 line ${report.anchors.bindingStringBytesEncodeUtf8.lineNumber}`,
        `ASCII NewFromCopy line ${report.anchors.asciiFastPathCopy.lineNumber}`,
        `simdutf UTF-16 conversion line ${report.anchors.simdutfUtf16Conversion.lineNumber}`,
        `String::NewFromUtf8 fallback line ${report.anchors.newFromUtf8Fallback.lineNumber}`,
      ],
    },
    {
      id: 'node-textdecoder-source-pin-scope-guard',
      classification: 'SCOPE_GUARD',
      summary: 'These source lines explain the Node TextDecoder boundary only. They are not browser TextDecoder internals, not a JIT/codegen trace, and not evidence that JavaScript runtimes have no remaining headroom.',
      evidence: [
        'The audit does not run a benchmark row.',
        'The audit does not inspect Blink, WebKit, or SpiderMonkey TextDecoder implementations.',
        'Any 200 MiB/s+ bounded-memory full-string row would still be a counterexample to the broad runtime-limit hypothesis.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Node TextDecoder Source Pin Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Scope',
    '',
    'This audit pins Node source lines for `TextDecoder.decode()` and its UTF-8 string-creation boundary. It is source evidence for the Node/V8 TextDecoder rows only. It is not a benchmark, not browser TextDecoder coverage, not codegen evidence, and not a runtime-ceiling proof.',
    '',
    '## Runtime And Source',
    '',
    `- Node: ${report.environment.nodeVersion}`,
    `- V8: ${report.environment.v8Version}`,
    `- Repository: ${report.source.repository}`,
    `- Revision: ${report.source.revision}`,
    `- Files: ${report.source.files.map(file => `\`${file}\``).join(', ')}`,
    '',
    '## Anchors',
    '',
    '| ID | File | Line | Source | Meaning |',
    '| --- | --- | ---: | --- | --- |',
  ];

  for (const [id, anchor] of Object.entries(report.anchors)) {
    lines.push(`| \`${id}\` | \`${anchor.file}\` | ${anchor.lineNumber} | ${anchor.url} | ${anchor.label} |`);
  }

  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`### ${finding.id}`, '', `Classification: ${finding.classification}`, '', finding.summary, '');
    for (const evidence of finding.evidence) {
      lines.push(`- ${evidence}`);
    }
    lines.push('');
  }

  lines.push(
    '## Interpretation',
    '',
    'For this Node revision, `TextDecoder.decode()` is not a hand-written JavaScript string materializer in the benchmark loop. The UTF-8 fast path crosses into Node native binding code and returns V8 strings through `StringBytes::Encode`. That source boundary explains why Node TextDecoder rows must be interpreted as Node/V8 host-API evidence, not as proof about Blink, WebKit, SpiderMonkey, or all JavaScript runtimes.',
    '',
    'The source pin also does not make Node `Buffer.toString()` a neutral browser-compatible lane. The benchmark rows still avoid direct `Buffer.toString()` calls, native addons, and lazy getters; this audit only documents Node internal implementation boundaries for the standard `TextDecoder` API.',
  );

  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(`node-textdecoder-source-pin-audit: revision=${report.source.revision}`);
  for (const [id, anchor] of Object.entries(report.anchors)) {
    console.log(`  ${id}: ${anchor.status} line=${anchor.lineNumber}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
