import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultRepository = 'oven-sh/webkit';
const defaultWebKitCommit = '4d5e75ebd84a14edbc7ae264245dcd77fe597c10';
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'bun-webkit-textdecoder-source-pin-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'bun-webkit-textdecoder-source-pin-audit.md');

const sourcePaths = {
  textDecoderCpp: 'Source/WebCore/dom/TextDecoder.cpp',
  textDecoderH: 'Source/WebCore/dom/TextDecoder.h',
  textCodecH: 'Source/WebCore/PAL/pal/text/TextCodec.h',
  textEncodingRegistryCpp: 'Source/WebCore/PAL/pal/text/TextEncodingRegistry.cpp',
  textCodecUtf8Cpp: 'Source/WebCore/PAL/pal/text/TextCodecUTF8.cpp',
};

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sourceDir: null,
    webkitCommit: defaultWebKitCommit,
    bunVersion: '1.3.13',
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
      case '--webkit-commit':
        options.webkitCommit = readValue();
        break;
      case '--bun-version':
        options.bunVersion = readValue();
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
    if (!existsSync(filePath)) {
      throw new Error(`Missing fixture source file: ${filePath}`);
    }
    return {
      path: sourcePath,
      text: readFileSync(filePath, 'utf8'),
      url: `source-file:${filePath}`,
      fetchedAt: new Date().toISOString(),
    };
  }

  const fetchUrl = rawSourceUrl(options.webkitCommit, sourcePath);
  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch WebKit source ${sourcePath}: HTTP ${response.status} ${await response.text()}`);
  }
  return {
    path: sourcePath,
    text: await response.text(),
    url: browserSourceUrl(options.webkitCommit, sourcePath),
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
    textDecoderDecode: findAnchor(indexed.textDecoderCpp, 'TextDecoder::decode', line => line.includes('ExceptionOr<String> TextDecoder::decode')),
    bufferSourceSpan: findAnchor(indexed.textDecoderCpp, 'BufferSource span extraction', line => line.includes('data = inputBuffer->span()')),
    newTextCodec: findAnchor(indexed.textDecoderCpp, 'newTextCodec', line => line.includes('m_codec = newTextCodec(m_textEncoding)')),
    stripByteOrderMark: findAnchor(indexed.textDecoderCpp, 'stripByteOrderMark', line => line.includes('m_codec->stripByteOrderMark()')),
    codecDecodeCall: findAnchor(indexed.textDecoderCpp, 'TextCodec::decode call', line => line.includes('String result = m_codec->decode(data, !options.stream, m_options.fatal, sawError)')),
    fatalErrorHandling: findAnchor(indexed.textDecoderCpp, 'fatal decode error handling', line => line.includes('return Exception { ExceptionCode::TypeError }')),
    resultReturn: findAnchor(indexed.textDecoderCpp, 'decoded String return', line => line.includes('return result')),
    codecMember: findAnchor(indexed.textDecoderH, 'TextCodec member', line => line.includes('std::unique_ptr<PAL::TextCodec> m_codec')),
    textCodecDecodeVirtual: findAnchor(indexed.textCodecH, 'TextCodec decode virtual', line => line.includes('virtual String decode(std::span<const uint8_t> data')),
    textCodecUtf8RegisterNames: findAnchor(indexed.textCodecUtf8Cpp, 'TextCodecUTF8 registerEncodingNames', line => line.includes('void TextCodecUTF8::registerEncodingNames')),
    textCodecUtf8RegisterUtf8Name: findAnchor(indexed.textCodecUtf8Cpp, 'UTF-8 encoding name', line => line.includes('registrar("UTF-8"_s, "UTF-8"_s)')),
    textCodecUtf8CodecFactory: findAnchor(indexed.textCodecUtf8Cpp, 'TextCodecUTF8::codec', line => line.includes('std::unique_ptr<TextCodecUTF8> TextCodecUTF8::codec()')),
    textCodecUtf8RegisterCodecs: findAnchor(indexed.textCodecUtf8Cpp, 'TextCodecUTF8 registerCodecs', line => line.includes('void TextCodecUTF8::registerCodecs')),
    registryRegistersUtf8: findAnchor(indexed.textEncodingRegistryCpp, 'registry registers TextCodecUTF8', line => line.includes('TextCodecUTF8::registerCodecs(addToTextCodecMap)')),
    registryNewTextCodec: findAnchor(indexed.textEncodingRegistryCpp, 'newTextCodec registry lookup', line => line.includes('std::unique_ptr<TextCodec> newTextCodec(const TextEncoding& encoding)')),
    registryFallbackUtf8: findAnchor(indexed.textEncodingRegistryCpp, 'newTextCodec UTF-8 fallback', line => line.includes('return TextCodecUTF8::codec()')),
    textCodecUtf8Decode: findAnchor(indexed.textCodecUtf8Cpp, 'TextCodecUTF8::decode', line => line.includes('String TextCodecUTF8::decode')),
    latin1Buffer: findAnchor(indexed.textCodecUtf8Cpp, 'Latin1 StringBuffer', line => line.includes('StringBuffer<Latin1Character> buffer')),
    asciiFastPath: findAnchor(indexed.textCodecUtf8Cpp, 'ASCII fast path', line => line.includes('Fast path for ASCII. Most UTF-8 text will be ASCII.')),
    copyAsciiMachineWord: findAnchor(indexed.textCodecUtf8Cpp, 'copyASCIIMachineWord', line => line.includes('copyASCIIMachineWord(destination, source)')),
    latin1StringAdopt: findAnchor(indexed.textCodecUtf8Cpp, 'Latin1 String::adopt', line => line.includes('return String::adopt(WTF::move(buffer))')),
    upConvertTo16Bit: findAnchor(indexed.textCodecUtf8Cpp, 'upConvertTo16Bit label', line => line.includes('upConvertTo16Bit:')),
    utf16Buffer: findAnchor(indexed.textCodecUtf8Cpp, 'UTF-16 StringBuffer', line => line.includes('StringBuffer<char16_t> buffer16')),
    appendCharacter: findAnchor(indexed.textCodecUtf8Cpp, 'appendCharacter', line => line.includes('destination16 = appendCharacter(destination16, character)')),
    utf16StringAdopt: findAnchor(indexed.textCodecUtf8Cpp, 'UTF-16 String::adopt', line => line.includes('return String::adopt(WTF::move(buffer16))')),
  };

  assertFound(anchors);

  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'bun-webkit-textdecoder-source-pin-audit',
    contract: 'bun-patched-webkit-exact-revision-textdecoder-source-lines',
    note: 'Exact Bun-patched WebKit source-line pinning for WebKit TextDecoder and UTF-8 TextCodec boundaries. These source facts constrain the WebKit implementation at the Bun/JSC benchmark commit; they are not Bun runtime dispatch proof, codegen evidence, or throughput proof.',
    runtime: {
      bunVersion: options.bunVersion,
      webkitCommit: options.webkitCommit,
    },
    source: {
      repository: defaultRepository,
      revision: options.webkitCommit,
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
      id: 'bun-patched-webkit-textdecoder-host-api-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'The pinned WebKit TextDecoder implementation extracts a BufferSource span, creates a TextCodec, and calls TextCodec::decode to return a WebKit String.',
      evidence: [
        `TextDecoder::decode line ${report.anchors.textDecoderDecode.lineNumber}`,
        `BufferSource span extraction line ${report.anchors.bufferSourceSpan.lineNumber}`,
        `newTextCodec line ${report.anchors.newTextCodec.lineNumber}`,
        `TextCodec::decode call line ${report.anchors.codecDecodeCall.lineNumber}`,
        `decoded String return line ${report.anchors.resultReturn.lineNumber}`,
      ],
    },
    {
      id: 'bun-patched-webkit-utf8-codec-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'The pinned WebKit UTF-8 codec registers UTF-8, decodes bytes into StringBuffer storage, uses ASCII fast paths, and adopts Latin1 or UTF-16 buffers into WebKit String values.',
      evidence: [
        `TextCodecUTF8::registerCodecs line ${report.anchors.textCodecUtf8RegisterCodecs.lineNumber}`,
        `TextCodecUTF8::decode line ${report.anchors.textCodecUtf8Decode.lineNumber}`,
        `Latin1 StringBuffer line ${report.anchors.latin1Buffer.lineNumber}`,
        `copyASCIIMachineWord line ${report.anchors.copyAsciiMachineWord.lineNumber}`,
        `Latin1 String::adopt line ${report.anchors.latin1StringAdopt.lineNumber}`,
        `UTF-16 StringBuffer line ${report.anchors.utf16Buffer.lineNumber}`,
        `UTF-16 String::adopt line ${report.anchors.utf16StringAdopt.lineNumber}`,
      ],
    },
    {
      id: 'bun-webkit-source-pin-scope-guard',
      classification: 'SCOPE_GUARD',
      summary: 'This source pin explains the WebKit TextDecoder implementation at the Bun-patched WebKit commit. It is not proof that Bun runtime dispatch reaches these exact functions, not Safari/browser coverage, not SpiderMonkey coverage, and not a runtime-ceiling proof.',
      evidence: [
        'The audit does not run a benchmark row.',
        'The audit does not inspect Bun native dispatch or generated machine code.',
        'Any 200 MiB/s+ bounded-memory full-string row would still be a counterexample to the broad runtime-limit hypothesis.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Bun-Patched WebKit TextDecoder Source Pin Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Scope',
    '',
    'This audit pins WebKit `TextDecoder` and UTF-8 `TextCodec` source lines for the exact Bun-patched WebKit commit recorded by the Bun/JSC TextDecoder benchmark artifacts. It is source evidence for that WebKit implementation only. It is not a Bun runtime dispatch proof, not Safari/JSC browser coverage, not SpiderMonkey coverage, not JIT/codegen evidence, and not a runtime-ceiling proof.',
    '',
    '## Runtime And Source',
    '',
    `- Bun artifact runtime: ${report.runtime.bunVersion}`,
    `- WebKit commit: ${report.source.revision}`,
    `- Repository: ${report.source.repository}`,
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
    'For this Bun-patched WebKit revision, WebKit `TextDecoder.decode()` is implemented as a host-API path that extracts a byte span from `BufferSource`, creates a `TextCodec`, and returns a WebKit `String` from the codec. The UTF-8 codec source decodes into `StringBuffer<Latin1Character>` first, has an ASCII machine-word fast path, and falls back to `StringBuffer<char16_t>` before adopting either buffer into a `String`.',
    '',
    'This narrows the WebKit source-boundary gap for the Bun/JSC TextDecoder benchmark commit. It does not by itself prove Bun dispatch, Safari/browser behavior, generated code, or that JavaScript runtimes have no remaining performance headroom.',
  );

  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(`bun-webkit-textdecoder-source-pin-audit: revision=${report.source.revision}`);
  for (const [id, anchor] of Object.entries(report.anchors)) {
    console.log(`  ${id}: ${anchor.status} line=${anchor.lineNumber}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
