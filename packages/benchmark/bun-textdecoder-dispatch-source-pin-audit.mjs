import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultRepository = 'oven-sh/bun';
const defaultBunTag = 'bun-v1.3.13';
const defaultBunCommit = 'bf2e2cecf27e800962b1e7f03d66278f9d5d2e79';
const defaultWebKitCommit = '4d5e75ebd84a14edbc7ae264245dcd77fe597c10';
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'bun-textdecoder-dispatch-source-pin-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'bun-textdecoder-dispatch-source-pin-audit.md');

const sourcePaths = {
  textDecoderZig: 'src/bun.js/webcore/TextDecoder.zig',
  encodingClassesTs: 'src/bun.js/webcore/encoding.classes.ts',
  textEncodingRegistryCpp: 'src/bun.js/bindings/TextEncodingRegistry.cpp',
  textEncodingCpp: 'src/bun.js/bindings/TextEncoding.cpp',
};

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sourceDir: null,
    bunTag: defaultBunTag,
    bunCommit: defaultBunCommit,
    bunVersion: '1.3.13',
    bunRevision: `1.3.13+${defaultBunCommit.slice(0, 9)}`,
    webkitCommit: defaultWebKitCommit,
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
      case '--bun-tag':
        options.bunTag = readValue();
        break;
      case '--bun-commit':
        options.bunCommit = readValue();
        break;
      case '--bun-version':
        options.bunVersion = readValue();
        break;
      case '--bun-revision':
        options.bunRevision = readValue();
        break;
      case '--webkit-commit':
        options.webkitCommit = readValue();
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

  const fetchUrl = rawSourceUrl(options.bunCommit, sourcePath);
  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Bun source ${sourcePath}: HTTP ${response.status} ${await response.text()}`);
  }
  return {
    path: sourcePath,
    text: await response.text(),
    url: browserSourceUrl(options.bunCommit, sourcePath),
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
    classDefinition: findAnchor(indexed.encodingClassesTs, 'TextDecoder class definition', line => line.includes('name: "TextDecoder"')),
    protoDecodeBinding: findAnchor(indexed.encodingClassesTs, 'decode binds to Zig decode', line => line.includes('fn: "decode"')),
    domjitReturnsString: findAnchor(indexed.encodingClassesTs, 'DOMJIT returns JSString', line => line.includes('returns: "JSString"')),
    domjitUint8ArrayArg: findAnchor(indexed.encodingClassesTs, 'DOMJIT JSUint8Array arg', line => line.includes('args: ["JSUint8Array"]')),
    zigCodegenClass: findAnchor(indexed.textDecoderZig, 'JSTextDecoder codegen class', line => line.includes('pub const js = jsc.Codegen.JSTextDecoder')),
    defaultEncodingUtf8: findAnchor(indexed.textDecoderZig, 'default UTF-8 encoding', line => line.includes('encoding: EncodingLabel = EncodingLabel.@"UTF-8"')),
    decodeMethod: findAnchor(indexed.textDecoderZig, 'TextDecoder.decode method', line => line.includes('pub fn decode(this: *TextDecoder')),
    decodeWithoutTypeChecks: findAnchor(indexed.textDecoderZig, 'decodeWithoutTypeChecks fast path', line => line.includes('pub fn decodeWithoutTypeChecks')),
    decodeSlice: findAnchor(indexed.textDecoderZig, 'decodeSlice implementation', line => line.includes('fn decodeSlice')),
    encodingSwitch: findAnchor(indexed.textDecoderZig, 'encoding switch', line => line.includes('switch (this.encoding)')),
    latin1Branch: findAnchor(indexed.textDecoderZig, 'latin1 native branch', line => line.includes('EncodingLabel.latin1 =>')),
    latin1AsciiToJs: findAnchor(indexed.textDecoderZig, 'latin1 ASCII to JS', line => line.includes('return ZigString.init(buffer_slice).toJS(globalThis)')),
    latin1ExternalU16: findAnchor(indexed.textDecoderZig, 'latin1 external UTF-16 string', line => line.includes('return ZigString.toExternalU16(bytes.ptr, out.written, globalThis)')),
    utf8Branch: findAnchor(indexed.textDecoderZig, 'UTF-8 native branch', line => line.includes('EncodingLabel.@"UTF-8" =>')),
    utf8DecodeAlloc: findAnchor(indexed.textDecoderZig, 'UTF-8 toUTF16AllocMaybeBuffered', line => line.includes('strings.toUTF16AllocMaybeBuffered')),
    utf8ExternalU16: findAnchor(indexed.textDecoderZig, 'UTF-8 external UTF-16 string', line => line.includes('return ZigString.toExternalU16(decoded.ptr, decoded.len, globalThis)')),
    utf8AsciiToJs: findAnchor(indexed.textDecoderZig, 'UTF-8 ASCII to JS', line => line.includes('return ZigString.init(input).toJS(globalThis)')),
    utf16Branch: findAnchor(indexed.textDecoderZig, 'UTF-16 native branch', line => line.includes('inline .@"UTF-16LE", .@"UTF-16BE"')),
    otherEncodingsWebKitComment: findAnchor(indexed.textDecoderZig, 'other encodings use WebKit TextCodec', line => line.includes("Handle all other encodings using WebKit's TextCodec")),
    otherEncodingsCreateCodec: findAnchor(indexed.textDecoderZig, 'TextCodec.create for other encodings', line => line.includes('const codec = TextCodec.create(encoding_name)')),
    otherEncodingsDecode: findAnchor(indexed.textDecoderZig, 'TextCodec.decode for other encodings', line => line.includes('const result = codec.decode(buffer_slice, flush, this.fatal)')),
    registryNativeFastPathComment: findAnchor(indexed.textEncodingRegistryCpp, 'native UTF encodings not registered in codec map', line => line.includes('Native UTF-8, UTF-16, Latin1 support in Bun - not registering here')),
    registryUtfFallbackNull: findAnchor(indexed.textEncodingRegistryCpp, 'UTF-8 handled natively returns null codec', line => line.includes('return nullptr; // UTF-8 handled natively in Bun')),
    textEncodingDecode: findAnchor(indexed.textEncodingCpp, 'TextEncoding::decode uses newTextCodec', line => line.includes('String TextEncoding::decode(std::span<const uint8_t> data')),
    textEncodingDecodeNewCodec: findAnchor(indexed.textEncodingCpp, 'TextEncoding::decode newTextCodec call', line => line.includes('return newTextCodec(*this)->decode(data, true, stopOnError, sawError)')),
  };

  assertFound(anchors);

  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'bun-textdecoder-dispatch-source-pin-audit',
    contract: 'bun-exact-revision-textdecoder-dispatch-source-lines',
    note: 'Exact Bun source-line pinning for TextDecoder dispatch in Bun 1.3.13. These source facts show Bun defines TextDecoder in Zig, handles UTF-8/Latin1/UTF-16 natively, and uses WebKit TextCodec only for other encodings. This is not codegen evidence or throughput proof.',
    runtime: {
      bunVersion: options.bunVersion,
      bunRevision: options.bunRevision,
      webkitCommit: options.webkitCommit,
    },
    source: {
      repository: defaultRepository,
      tag: options.bunTag,
      revision: options.bunCommit,
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
      id: 'bun-textdecoder-js-class-dispatches-to-zig',
      classification: 'SOURCE_FACT',
      summary: 'Bun defines the TextDecoder class through generated bindings whose decode prototype method maps to the Zig TextDecoder.decode implementation.',
      evidence: [
        `TextDecoder class definition line ${report.anchors.classDefinition.lineNumber}`,
        `prototype decode binding line ${report.anchors.protoDecodeBinding.lineNumber}`,
        `DOMJIT JSString return line ${report.anchors.domjitReturnsString.lineNumber}`,
        `JSTextDecoder codegen class line ${report.anchors.zigCodegenClass.lineNumber}`,
      ],
    },
    {
      id: 'bun-textdecoder-utf8-native-path',
      classification: 'SOURCE_FACT',
      summary: 'For the default UTF-8 TextDecoder used by the benchmark rows, Bun source routes through a Zig UTF-8 branch that decodes with bun.strings and returns ZigString JS values.',
      evidence: [
        `default UTF-8 encoding line ${report.anchors.defaultEncodingUtf8.lineNumber}`,
        `TextDecoder.decode line ${report.anchors.decodeMethod.lineNumber}`,
        `decodeSlice line ${report.anchors.decodeSlice.lineNumber}`,
        `UTF-8 branch line ${report.anchors.utf8Branch.lineNumber}`,
        `toUTF16AllocMaybeBuffered line ${report.anchors.utf8DecodeAlloc.lineNumber}`,
        `ZigString.toExternalU16 line ${report.anchors.utf8ExternalU16.lineNumber}`,
        `ZigString.init(input).toJS line ${report.anchors.utf8AsciiToJs.lineNumber}`,
      ],
    },
    {
      id: 'bun-textdecoder-webkit-only-other-encodings',
      classification: 'COUNTEREXAMPLE',
      summary: 'The pinned Bun source explicitly places WebKit TextCodec behind the all-other-encodings branch, so the default UTF-8 TextDecoder benchmark rows should not be described as dispatching through WebKit TextDecoder.cpp.',
      evidence: [
        `other-encodings WebKit comment line ${report.anchors.otherEncodingsWebKitComment.lineNumber}`,
        `TextCodec.create line ${report.anchors.otherEncodingsCreateCodec.lineNumber}`,
        `TextCodec.decode line ${report.anchors.otherEncodingsDecode.lineNumber}`,
        `native UTF encodings not registered line ${report.anchors.registryNativeFastPathComment.lineNumber}`,
        `UTF-8 handled natively null codec line ${report.anchors.registryUtfFallbackNull.lineNumber}`,
      ],
    },
    {
      id: 'bun-textdecoder-dispatch-scope-guard',
      classification: 'SCOPE_GUARD',
      summary: 'This audit is source dispatch evidence for Bun 1.3.13. It is not machine-code evidence, not a benchmark row, and not proof that JavaScript runtimes have no remaining performance headroom.',
      evidence: [
        'The audit does not inspect generated machine code.',
        'The audit does not measure throughput or memory.',
        'Any 200 MiB/s+ bounded-memory full-string row would still be a counterexample to the broad runtime-limit hypothesis.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Bun TextDecoder Dispatch Source Pin Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Scope',
    '',
    'This audit pins Bun source lines for `TextDecoder` dispatch in the exact Bun 1.3.13 source revision used by the local benchmark runtime. It is source evidence for Bun dispatch only. It is not a benchmark, not JIT/codegen evidence, not Safari/browser coverage, not SpiderMonkey coverage, and not a runtime-ceiling proof.',
    '',
    '## Runtime And Source',
    '',
    `- Bun: ${report.runtime.bunRevision}`,
    `- Bun source tag: ${report.source.tag}`,
    `- Bun source commit: ${report.source.revision}`,
    `- Recorded WebKit commit: ${report.runtime.webkitCommit}`,
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
    'For Bun 1.3.13, `TextDecoder` is defined by Bun generated bindings and implemented by `src/bun.js/webcore/TextDecoder.zig`. The default `UTF-8` branch used by `new TextDecoder()` decodes in Bun Zig through `bun.strings` helpers and returns `ZigString` values to JavaScript. Latin1 and UTF-16 also have native branches.',
    '',
    'The WebKit `TextCodec` path is still present, but the pinned Bun source places it under the "all other encodings" branch. Therefore the Bun/JSC default UTF-8 TextDecoder benchmark rows should not be cited as dispatching through WebKit `WebCore/dom/TextDecoder.cpp`; the earlier WebKit source pin is useful only for the WebKit implementation boundary and for encodings that actually reach `TextCodec`.',
    '',
    'This source dispatch fact does not prove that Bun has no remaining headroom. It narrows the interpretation of the existing Bun TextDecoder rows and leaves codegen, allocation, and counterexample searches open.',
  );

  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(`bun-textdecoder-dispatch-source-pin-audit: revision=${report.source.revision}`);
  for (const [id, anchor] of Object.entries(report.anchors)) {
    console.log(`  ${id}: ${anchor.status} line=${anchor.lineNumber}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
