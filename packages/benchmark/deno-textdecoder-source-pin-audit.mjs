import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultRepository = 'denoland/deno';
const defaultDenoVersion = '2.7.13';
const defaultRevision = `v${defaultDenoVersion}`;
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'deno-textdecoder-source-pin-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'deno-textdecoder-source-pin-audit.md');

const sourcePaths = {
  textEncodingJs: 'ext/web/08_text_encoding.js',
  webLibRs: 'ext/web/lib.rs',
};

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sourceDir: null,
    revision: defaultRevision,
    denoVersion: defaultDenoVersion,
    v8Version: '14.7.173.20-rusty',
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
      case '--deno-version':
        options.denoVersion = readValue();
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
    throw new Error(`Failed to fetch Deno source ${sourcePath}: HTTP ${response.status} ${await response.text()}`);
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
    opImports: findAnchor(indexed.textEncodingJs, 'TextDecoder encoding op imports', line => line.includes('op_encoding_decode_utf8')),
    textDecoderClass: findAnchor(indexed.textEncodingJs, 'TextDecoder class', line => line.includes('class TextDecoder')),
    constructor: findAnchor(indexed.textEncodingJs, 'TextDecoder constructor', line => line.includes('constructor(label = "utf-8"')),
    utf8LabelFastPath: findAnchor(indexed.textEncodingJs, 'UTF-8 label fast path', line => line.includes('Fast path for common UTF-8 labels')),
    utf8SinglePassFlag: findAnchor(indexed.textEncodingJs, 'UTF-8 single-pass flag', line => line.includes('this.#utf8SinglePass = encoding === "utf-8" && !options.fatal')),
    decodeMethod: findAnchor(indexed.textEncodingJs, 'TextDecoder.decode method', line => line.includes('decode(input = new Uint8Array()')),
    uint8ArrayFastPath: findAnchor(indexed.textEncodingJs, 'Uint8Array validation fast path', line => line.includes('Fast path: skip full BufferSource validation for Uint8Array')),
    typedArrayBuffer: findAnchor(indexed.textEncodingJs, 'TypedArray buffer extraction', line => line.includes('buffer = TypedArrayPrototypeGetBuffer')),
    sharedArrayClone: findAnchor(indexed.textEncodingJs, 'SharedArrayBuffer clone boundary', line => line.includes('We clone the data into a non-shared ArrayBuffer')),
    singlePassFastPath: findAnchor(indexed.textEncodingJs, 'single-pass decode fast path', line => line.includes('Fast path for single pass encoding.')),
    utf8OpCall: findAnchor(indexed.textEncodingJs, 'op_encoding_decode_utf8 call', line => line.includes('return op_encoding_decode_utf8(input, this.#ignoreBOM)')),
    singleOpCall: findAnchor(indexed.textEncodingJs, 'op_encoding_decode_single call', line => line.includes('return op_encoding_decode_single(')),
    newDecoderOpCall: findAnchor(indexed.textEncodingJs, 'op_encoding_new_decoder call', line => line.includes('this.#handle = op_encoding_new_decoder(')),
    streamingOpCall: findAnchor(indexed.textEncodingJs, 'op_encoding_decode streaming call', line => line.includes('return op_encoding_decode(input, this.#handle, stream)')),
    extensionOpRegistration: findAnchor(indexed.webLibRs, 'deno_web extension op registration', line => line.trim() === 'op_encoding_decode_utf8,'),
    rustDecodeUtf8Function: findAnchor(indexed.webLibRs, 'op_encoding_decode_utf8 function', line => line.includes('fn op_encoding_decode_utf8')),
    rustAnybufferInput: findAnchor(indexed.webLibRs, 'op_encoding_decode_utf8 anybuffer input', line => line.includes('#[anybuffer] zero_copy: &[u8]')),
    rustBomSkip: findAnchor(indexed.webLibRs, 'UTF-8 BOM skip', line => line.includes('&& buf[0] == 0xef')),
    rustNewFromUtf8: findAnchor(indexed.webLibRs, 'v8::String::new_from_utf8 return', line => line.includes('match v8::String::new_from_utf8')),
    rustDecodeSingleFunction: findAnchor(indexed.webLibRs, 'op_encoding_decode_single function', line => line.includes('fn op_encoding_decode_single')),
    rustMaxUtf16Buffer: findAnchor(indexed.webLibRs, 'encoding_rs max UTF-16 buffer length', line => line.includes('.max_utf16_buffer_length(data.len())')),
    rustUtf16OutputVec: findAnchor(indexed.webLibRs, 'UTF-16 output Vec allocation', line => line.includes('let mut output = vec![0; max_buffer_length]')),
    rustDecodeToUtf16: findAnchor(indexed.webLibRs, 'encoding_rs decode_to_utf16', line => line.includes('decoder.decode_to_utf16(data, &mut output')),
    rustU16StringReturn: findAnchor(indexed.webLibRs, 'U16String return', line => line.includes('Ok(output.into())')),
    rustStreamingFunction: findAnchor(indexed.webLibRs, 'op_encoding_decode streaming function', line => line.includes('fn op_encoding_decode(')),
    rustTextDecoderResource: findAnchor(indexed.webLibRs, 'TextDecoderResource decoder state', line => line.includes('struct TextDecoderResource')),
  };

  assertFound(anchors);

  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'deno-textdecoder-source-pin-audit',
    contract: 'deno-exact-revision-textdecoder-string-boundary-source-lines',
    note: 'Exact Deno source-line pinning for TextDecoder.decode in Deno 2.7.13. These source facts constrain the Deno TextDecoder host boundary for the Deno/V8 TextDecoder benchmark rows; they are not codegen evidence or a throughput proof.',
    runtime: {
      denoVersion: options.denoVersion,
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
      id: 'deno-textdecoder-js-dispatch-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'Deno implements TextDecoder in ext/web/08_text_encoding.js and routes default non-fatal UTF-8 single-pass decode to op_encoding_decode_utf8.',
      evidence: [
        `TextDecoder class line ${report.anchors.textDecoderClass.lineNumber}`,
        `decode method line ${report.anchors.decodeMethod.lineNumber}`,
        `UTF-8 single-pass flag line ${report.anchors.utf8SinglePassFlag.lineNumber}`,
        `op_encoding_decode_utf8 call line ${report.anchors.utf8OpCall.lineNumber}`,
      ],
    },
    {
      id: 'deno-textdecoder-input-boundary-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'Deno skips full BufferSource validation for non-shared Uint8Array input, extracts ArrayBuffer storage for typed arrays, and clones SharedArrayBuffer-backed input before passing it to Rust.',
      evidence: [
        `Uint8Array validation fast path line ${report.anchors.uint8ArrayFastPath.lineNumber}`,
        `TypedArray buffer extraction line ${report.anchors.typedArrayBuffer.lineNumber}`,
        `SharedArrayBuffer clone boundary line ${report.anchors.sharedArrayClone.lineNumber}`,
      ],
    },
    {
      id: 'deno-textdecoder-v8-string-creation-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'Deno op_encoding_decode_utf8 takes a zero-copy anybuffer byte slice and creates the JavaScript result through v8::String::new_from_utf8.',
      evidence: [
        `op_encoding_decode_utf8 function line ${report.anchors.rustDecodeUtf8Function.lineNumber}`,
        `#[anybuffer] input line ${report.anchors.rustAnybufferInput.lineNumber}`,
        `v8::String::new_from_utf8 line ${report.anchors.rustNewFromUtf8.lineNumber}`,
      ],
    },
    {
      id: 'deno-textdecoder-non-utf8-streaming-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'For non-UTF-8 or streaming paths, Deno uses encoding_rs decoders, allocates a UTF-16 output Vec sized by max_utf16_buffer_length, and returns U16String.',
      evidence: [
        `op_encoding_decode_single function line ${report.anchors.rustDecodeSingleFunction.lineNumber}`,
        `max_utf16_buffer_length line ${report.anchors.rustMaxUtf16Buffer.lineNumber}`,
        `output Vec line ${report.anchors.rustUtf16OutputVec.lineNumber}`,
        `decode_to_utf16 line ${report.anchors.rustDecodeToUtf16.lineNumber}`,
        `U16String return line ${report.anchors.rustU16StringReturn.lineNumber}`,
      ],
    },
    {
      id: 'deno-textdecoder-source-pin-scope-guard',
      classification: 'SCOPE_GUARD',
      summary: 'This pins Deno TextDecoder source boundaries only. It is not V8 optimized-code evidence, allocation census evidence, Safari/WebKit coverage, or an impossibility proof.',
      evidence: [
        `Deno source revision ${report.source.revision}`,
        `Deno ${report.runtime.denoVersion}`,
        `V8 ${report.runtime.v8Version}`,
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Deno TextDecoder Source Pin Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Runtime',
    '',
    `- Deno: ${report.runtime.denoVersion}`,
    `- V8: ${report.runtime.v8Version}`,
    `- Source revision: ${report.source.revision}`,
    '',
    '## Anchors',
    '',
    '| Anchor | File | Line | URL |',
    '| --- | --- | ---: | --- |',
  ];
  for (const anchor of Object.values(report.anchors)) {
    lines.push(`| ${anchor.label} | ${anchor.file} | ${anchor.lineNumber} | ${anchor.url} |`);
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

function printSummary(report) {
  console.log('Deno TextDecoder source pin audit');
  console.log(`revision=${report.source.revision}`);
  console.log(`anchors=${Object.keys(report.anchors).length}`);
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  console.log(`Wrote ${filePath}`);
}

void main();
