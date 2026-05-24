import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultRevision = 'refs/tags/148.0.7778.179';
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'chrome-blink-textdecoder-source-pin-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'chrome-blink-textdecoder-source-pin-audit.md');

const sourcePaths = {
  textDecoderCc: 'third_party/blink/renderer/modules/encoding/text_decoder.cc',
  textDecoderH: 'third_party/blink/renderer/modules/encoding/text_decoder.h',
  textCodecUtf8Cc: 'third_party/blink/renderer/platform/wtf/text/text_codec_utf8.cc',
};

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    revision: defaultRevision,
    sourceDir: null,
    browserVersion: 'Chrome/148.0.7778.179',
    v8Version: '14.8.178.22',
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
      case '--revision':
        options.revision = readValue();
        break;
      case '--source-dir':
        options.sourceDir = resolve(process.cwd(), readValue());
        break;
      case '--browser-version':
        options.browserVersion = readValue();
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

  const fetchUrl = sourceUrl(options.revision, sourcePath);
  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Chromium source ${sourcePath}: HTTP ${response.status} ${await response.text()}`);
  }
  return {
    path: sourcePath,
    text: Buffer.from(await response.text(), 'base64').toString('utf8'),
    url: browserSourceUrl(options.revision, sourcePath),
    fetchUrl,
    fetchedAt: new Date().toISOString(),
  };
}

function sourceUrl(revision, sourcePath) {
  return `https://chromium.googlesource.com/chromium/src/+/${encodePathSegment(revision)}/${sourcePath}?format=TEXT`;
}

function browserSourceUrl(revision, sourcePath) {
  return `https://chromium.googlesource.com/chromium/src/+/${encodePathSegment(revision)}/${sourcePath}`;
}

function encodePathSegment(value) {
  return value.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

function createReport({ options, sources }) {
  const indexed = Object.fromEntries(
    Object.entries(sources).map(([key, source]) => [key, { source, lines: source.text.split(/\r?\n/) }]),
  );

  const anchors = {
    textDecoderDecode: findAnchor(indexed.textDecoderCc, 'TextDecoder::decode', line => line.includes('String TextDecoder::decode')),
    textDecoderDelegatesDecode: findAnchor(indexed.textDecoderCc, 'decode delegates to Decode', line => line.includes('return Decode(input_span, options, exception_state)')),
    textDecoderPrivateDecode: findAnchor(indexed.textDecoderCc, 'TextDecoder::Decode', line => line.includes('String TextDecoder::Decode(base::span<const uint8_t> input')),
    newTextCodec: findAnchor(indexed.textDecoderCc, 'NewTextCodec', line => line.includes('codec_ = NewTextCodec(encoding_)')),
    streamFlushBehavior: findAnchor(indexed.textDecoderCc, 'stream flush behavior', line => line.includes('FlushBehavior flush =')),
    codecDecodeCall: findAnchor(indexed.textDecoderCc, 'TextCodec::Decode call', line => line.includes('String s = codec_->Decode(input, flush, fatal_, saw_error)')),
    fatalErrorHandling: findAnchor(indexed.textDecoderCc, 'fatal decode error handling', line => line.includes('exception_state.ThrowTypeError("The encoded data was not valid.")')),
    bomErase: findAnchor(indexed.textDecoderCc, 'BOM erase', line => line.includes('s.erase(0, 1)')),
    codecMember: findAnchor(indexed.textDecoderH, 'TextCodec member', line => line.includes('std::unique_ptr<TextCodec> codec_')),
    textCodecUtf8Create: findAnchor(indexed.textCodecUtf8Cc, 'TextCodecUtf8::Create', line => line.includes('TextCodecUtf8::Create')),
    textCodecUtf8Decode: findAnchor(indexed.textCodecUtf8Cc, 'TextCodecUtf8::Decode', line => line.includes('String TextCodecUtf8::Decode')),
    latin1Buffer: findAnchor(indexed.textCodecUtf8Cc, 'LChar InlinedStringBuffer', line => line.includes('InlinedStringBuffer<LChar> buffer')),
    asciiFastPath: findAnchor(indexed.textCodecUtf8Cc, 'ASCII fast path', line => line.includes('Fast path for ASCII. Most UTF-8 text will be ASCII.')),
    copyAsciiMachineWord: findAnchor(indexed.textCodecUtf8Cc, 'CopyAsciiMachineWord', line => line.includes('CopyAsciiMachineWord(')),
    latin1ToString: findAnchor(indexed.textCodecUtf8Cc, 'LChar buffer ToString', line => line.includes('return std::move(buffer).ToString(characters_decoded)')),
    upConvertTo16Bit: findAnchor(indexed.textCodecUtf8Cc, 'upConvertTo16Bit label', line => line.includes('upConvertTo16Bit:')),
    utf16Buffer: findAnchor(indexed.textCodecUtf8Cc, 'UChar InlinedStringBuffer', line => line.includes('InlinedStringBuffer<UChar> buffer16')),
    appendCharacter: findAnchor(indexed.textCodecUtf8Cc, 'AppendCharacter', line => line.includes('destination16 = AppendCharacter(destination16, character)')),
    utf16ToString: findAnchor(indexed.textCodecUtf8Cc, 'UChar buffer ToString', line => line.includes('return std::move(buffer16).ToString(characters_decoded)')),
  };

  assertFound(anchors);

  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'chrome-blink-textdecoder-source-pin-audit',
    contract: 'chrome-blink-exact-revision-textdecoder-source-lines',
    note: 'Exact Chromium/Blink source-line pinning for the Chrome TextDecoder host-API boundary. These source facts constrain the Chrome/Blink TextDecoder path; they are not codegen evidence and not a throughput proof.',
    environment: {
      browserVersion: options.browserVersion,
      v8Version: options.v8Version,
    },
    source: {
      repository: 'chromium/src',
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
    url: `${source.url}${source.url.startsWith('source-file:') ? ':' : '#'}${index + 1}`,
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
      id: 'chrome-blink-textdecoder-host-api-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'Chrome/Blink TextDecoder.decode delegates byte spans to TextDecoder::Decode, creates or reuses a TextCodec, and calls TextCodec::Decode with stream/fatal options.',
      evidence: [
        `TextDecoder::decode line ${report.anchors.textDecoderDecode.lineNumber}`,
        `NewTextCodec line ${report.anchors.newTextCodec.lineNumber}`,
        `codec_->Decode line ${report.anchors.codecDecodeCall.lineNumber}`,
      ],
    },
    {
      id: 'chrome-blink-utf8-codec-string-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'The pinned UTF-8 codec decodes into Blink string buffers and returns Blink String values through LChar or UChar ToString paths.',
      evidence: [
        `TextCodecUtf8::Decode line ${report.anchors.textCodecUtf8Decode.lineNumber}`,
        `LChar buffer line ${report.anchors.latin1Buffer.lineNumber}`,
        `LChar ToString line ${report.anchors.latin1ToString.lineNumber}`,
        `UChar buffer line ${report.anchors.utf16Buffer.lineNumber}`,
        `UChar ToString line ${report.anchors.utf16ToString.lineNumber}`,
      ],
    },
    {
      id: 'chrome-blink-utf8-ascii-fast-path-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'The pinned UTF-8 codec has an explicit ASCII fast path with machine-word copying before falling back to non-ASCII handling.',
      evidence: [
        `ASCII fast path line ${report.anchors.asciiFastPath.lineNumber}`,
        `CopyAsciiMachineWord line ${report.anchors.copyAsciiMachineWord.lineNumber}`,
        `upConvertTo16Bit line ${report.anchors.upConvertTo16Bit.lineNumber}`,
      ],
    },
    {
      id: 'chrome-blink-source-pin-scope-guard',
      classification: 'SCOPE_GUARD',
      summary: 'This source pin explains Chrome/Blink TextDecoder boundaries only. It is not Safari/JSC, Firefox/SpiderMonkey, Node, or Bun TextDecoder evidence, and it is not codegen or a runtime-ceiling proof.',
      evidence: [
        'The audit does not run a benchmark row.',
        'The audit does not inspect generated machine code.',
        'Any 200 MiB/s+ bounded-memory full-string row would still be a counterexample to the broad runtime-limit hypothesis.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Chrome/Blink TextDecoder Source Pin Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Scope',
    '',
    'This audit pins Chromium/Blink source lines for `TextDecoder.decode()` and the UTF-8 `TextCodec` path used by Chrome browser TextDecoder rows. It is source evidence for Chrome/Blink only. It is not a benchmark, not JIT/codegen evidence, not Safari/JSC or Firefox/SpiderMonkey coverage, and not a runtime-ceiling proof.',
    '',
    '## Runtime And Source',
    '',
    `- Browser: ${report.environment.browserVersion}`,
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
    'For this Chrome/Blink source revision, the browser `TextDecoder.decode()` path is a Blink host-API path: JavaScript calls into Blink `TextDecoder`, which delegates to `TextCodec`, and UTF-8 decoding returns Blink `String` values from `InlinedStringBuffer<LChar>` or `InlinedStringBuffer<UChar>`. This is different evidence from Node/V8 `TextDecoder`, which is implemented through Node internal bindings.',
    '',
    'The source pin narrows one browser source-boundary gap. It does not prove that Chrome/V8 or JavaScript runtimes have no remaining performance headroom, and it does not cover non-V8 browsers or generated code for the benchmark loop.',
  );

  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(`chrome-blink-textdecoder-source-pin-audit: revision=${report.source.revision}`);
  for (const [id, anchor] of Object.entries(report.anchors)) {
    console.log(`  ${id}: ${anchor.status} line=${anchor.lineNumber}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
