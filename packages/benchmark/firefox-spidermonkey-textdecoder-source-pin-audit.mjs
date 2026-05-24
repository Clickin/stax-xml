import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultRepository = 'mozilla/gecko-dev';
const defaultGeckoRevision = '5836a062726f715fda621338a17b51aff30d0a8c';
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-textdecoder-source-pin-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-textdecoder-source-pin-audit.md');

const sourcePaths = {
  textDecoderCpp: 'dom/encoding/TextDecoder.cpp',
  textDecoderH: 'dom/encoding/TextDecoder.h',
  encodingH: 'intl/Encoding.h',
};

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sourceDir: null,
    repository: defaultRepository,
    geckoRevision: defaultGeckoRevision,
    firefoxVersion: 'gecko-dev master snapshot',
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
      case '--repository':
        options.repository = readValue();
        break;
      case '--revision':
      case '--gecko-revision':
        options.geckoRevision = readValue();
        break;
      case '--firefox-version':
        options.firefoxVersion = readValue();
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

  const fetchUrl = rawSourceUrl(options.repository, options.geckoRevision, sourcePath);
  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Gecko source ${sourcePath}: HTTP ${response.status} ${await response.text()}`);
  }
  return {
    path: sourcePath,
    text: await response.text(),
    url: browserSourceUrl(options.repository, options.geckoRevision, sourcePath),
    fetchUrl,
    fetchedAt: new Date().toISOString(),
  };
}

function rawSourceUrl(repository, revision, sourcePath) {
  return `https://raw.githubusercontent.com/${repository}/${revision}/${sourcePath}`;
}

function browserSourceUrl(repository, revision, sourcePath) {
  return `https://github.com/${repository}/blob/${revision}/${sourcePath}`;
}

function createReport({ options, sources }) {
  const indexed = Object.fromEntries(
    Object.entries(sources).map(([key, source]) => [key, { source, lines: source.text.split(/\r?\n/) }]),
  );

  const anchors = {
    textDecoderInit: findAnchor(indexed.textDecoderCpp, 'TextDecoder::Init', line => line.includes('void TextDecoder::Init(const nsAString& aLabel')),
    textDecoderForLabelNoReplacement: findAnchor(indexed.textDecoderCpp, 'Encoding::ForLabelNoReplacement', line => line.includes('Encoding::ForLabelNoReplacement(aLabel)')),
    initWithEncoding: findAnchor(indexed.textDecoderCpp, 'TextDecoder::InitWithEncoding', line => line.includes('void TextDecoder::InitWithEncoding')),
    encodingNameStored: findAnchor(indexed.textDecoderCpp, 'encoding name stored', line => line.includes('aEncoding->Name(mEncoding)')),
    fatalOptionStored: findAnchor(indexed.textDecoderCpp, 'fatal option stored', line => line.includes('mFatal = aOptions.mFatal')),
    decoderWithoutBom: findAnchor(indexed.textDecoderCpp, 'NewDecoderWithoutBOMHandling', line => line.includes('mDecoder = aEncoding->NewDecoderWithoutBOMHandling()')),
    decoderWithBomRemoval: findAnchor(indexed.textDecoderCpp, 'NewDecoderWithBOMRemoval', line => line.includes('mDecoder = aEncoding->NewDecoderWithBOMRemoval()')),
    decodeNative: findAnchor(indexed.textDecoderCpp, 'TextDecoderCommon::DecodeNative', line => line.includes('void TextDecoderCommon::DecodeNative')),
    truncateOutput: findAnchor(indexed.textDecoderCpp, 'output string truncate', line => line.includes('aOutDecodedString.Truncate()')),
    maxUtf16BufferLength: findAnchor(indexed.textDecoderCpp, 'MaxUTF16BufferLength', line => line.includes('mDecoder->MaxUTF16BufferLength(aInput.Length())')),
    mutableData: findAnchor(indexed.textDecoderCpp, 'GetMutableData', line => line.includes('aOutDecodedString.GetMutableData(needed.value(), fallible)')),
    decodeToUtf16WithoutReplacement: findAnchor(indexed.textDecoderCpp, 'DecodeToUTF16WithoutReplacement', line => line.includes('mDecoder->DecodeToUTF16WithoutReplacement')),
    decodeToUtf16: findAnchor(indexed.textDecoderCpp, 'DecodeToUTF16', line => line.includes('mDecoder->DecodeToUTF16(aInput')),
    setLength: findAnchor(indexed.textDecoderCpp, 'SetLength', line => line.includes('aOutDecodedString.SetLength(written, fallible)')),
    resetWithoutBom: findAnchor(indexed.textDecoderCpp, 'NewDecoderWithoutBOMHandlingInto reset', line => line.includes('NewDecoderWithoutBOMHandlingInto(*mDecoder)')),
    resetWithBomRemoval: findAnchor(indexed.textDecoderCpp, 'NewDecoderWithBOMRemovalInto reset', line => line.includes('NewDecoderWithBOMRemovalInto(*mDecoder)')),
    decodeMethod: findAnchor(indexed.textDecoderCpp, 'TextDecoder::Decode', line => line.includes('void TextDecoder::Decode(')),
    decodeNullInput: findAnchor(indexed.textDecoderCpp, 'DecodeNative null input', line => line.includes('DecodeNative(nullptr, aOptions.mStream, aOutDecodedString, aRv)')),
    processTypedArrays: findAnchor(indexed.textDecoderCpp, 'ProcessTypedArrays', line => line.includes('ProcessTypedArrays') && line.includes('.Value')),
    decodeTypedArrayNative: findAnchor(indexed.textDecoderCpp, 'DecodeNative typed array', line => line.includes('DecodeNative(aData, aOptions.mStream, aOutDecodedString, aRv)')),
    getEncoding: findAnchor(indexed.textDecoderCpp, 'GetEncoding', line => line.includes('void TextDecoderCommon::GetEncoding')),
    textDecoderBinding: findAnchor(indexed.textDecoderH, 'TextDecoderBinding include', line => line.includes('TextDecoderBinding.h')),
    encodingHeaderInclude: findAnchor(indexed.textDecoderH, 'mozilla/Encoding.h include', line => line.includes('mozilla/Encoding.h')),
    textDecoderCommonClass: findAnchor(indexed.textDecoderH, 'TextDecoderCommon class', line => line.includes('class TextDecoderCommon')),
    decodeNativeDeclaration: findAnchor(indexed.textDecoderH, 'DecodeNative declaration', line => line.includes('void DecodeNative(mozilla::Span<const uint8_t>')),
    decoderMember: findAnchor(indexed.textDecoderH, 'Decoder storage', line => line.includes('mozilla::UniquePtr<mozilla::Decoder> mDecoder')),
    encodingNameMember: findAnchor(indexed.textDecoderH, 'mEncoding storage', line => line.includes('nsCString mEncoding')),
    textDecoderClass: findAnchor(indexed.textDecoderH, 'TextDecoder class', line => line.includes('class TextDecoder final')),
    constructorDeclaration: findAnchor(indexed.textDecoderH, 'Constructor declaration', line => line.includes('UniquePtr<TextDecoder> Constructor')),
    bindingWrap: findAnchor(indexed.textDecoderH, 'TextDecoder_Binding::Wrap', line => line.includes('TextDecoder_Binding::Wrap')),
    initDeclaration: findAnchor(indexed.textDecoderH, 'Init declaration', line => line.includes('void Init(const nsAString& aLabel')),
    initWithEncodingDeclaration: findAnchor(indexed.textDecoderH, 'InitWithEncoding declaration', line => line.includes('void InitWithEncoding')),
    decodeDeclaration: findAnchor(indexed.textDecoderH, 'Decode declaration', line => line.includes('void Decode(const Optional<BufferSource>& aBuffer')),
    encodingRsComment: findAnchor(indexed.encodingH, 'encoding_rs source comment', line => line.includes('Adapted from third_party/rust/encoding_c/include/encoding_rs_cpp.h')),
    encodingRsImplementationComment: findAnchor(indexed.encodingH, 'encoding_rs implementation comment', line => line.includes('third_party/rust/encoding_c/.')),
    ffiDecodeNsString: findAnchor(indexed.encodingH, 'mozilla_encoding_decode_to_nsstring', line => line.includes('mozilla_encoding_decode_to_nsstring(')),
    ffiDecodeNsStringWithBomRemoval: findAnchor(indexed.encodingH, 'mozilla_encoding_decode_to_nsstring_with_bom_removal', line => line.includes('mozilla_encoding_decode_to_nsstring_with_bom_removal')),
    ffiDecodeNsStringWithoutBom: findAnchor(indexed.encodingH, 'mozilla_encoding_decode_to_nsstring_without_bom_handling', line => line.includes('mozilla_encoding_decode_to_nsstring_without_bom_handling(')),
    ffiDecodeNsStringWithoutReplacement: findAnchor(indexed.encodingH, 'mozilla_encoding_decode_to_nsstring_without_bom_handling_and_without_replacement', line => line.includes('mozilla_encoding_decode_to_nsstring_without_bom_handling_and_without_replacement')),
    encodingClass: findAnchor(indexed.encodingH, 'Encoding class', line => line.includes('class Encoding final')),
    forLabel: findAnchor(indexed.encodingH, 'Encoding::ForLabel', line => line.includes('static inline const Encoding* ForLabel(Span<const char> aLabel)')),
    forLabelString: findAnchor(indexed.encodingH, 'Encoding::ForLabel string overload', line => line.includes('static inline const Encoding* ForLabel(const nsAString& aLabel)')),
    forLabelNoReplacement: findAnchor(indexed.encodingH, 'Encoding::ForLabelNoReplacement', line => line.includes('ForLabelNoReplacement(Span<const char> aLabel)')),
    forLabelNoReplacementString: findAnchor(indexed.encodingH, 'Encoding::ForLabelNoReplacement string overload', line => line.includes('ForLabelNoReplacement(const nsAString& aLabel)')),
    encodingName: findAnchor(indexed.encodingH, 'Encoding::Name', line => line.includes('void Name(nsACString& aName)')),
    decodeWithBomRemoval: findAnchor(indexed.encodingH, 'DecodeWithBOMRemoval', line => line.includes('DecodeWithBOMRemoval(Span<const uint8_t> aBytes')),
    decodeWithBomRemovalFfi: findAnchor(indexed.encodingH, 'DecodeWithBOMRemoval FFI', line => line.includes('mozilla_encoding_decode_to_nsstring_with_bom_removal(')),
    decodeWithoutBomHandling: findAnchor(indexed.encodingH, 'DecodeWithoutBOMHandling', line => line.includes('DecodeWithoutBOMHandling(Span<const uint8_t> aBytes')),
    decodeWithoutBomHandlingFfi: findAnchor(indexed.encodingH, 'DecodeWithoutBOMHandling FFI', line => line.includes('mozilla_encoding_decode_to_nsstring_without_bom_handling(')),
    decodeWithoutBomHandlingNoReplacement: findAnchor(indexed.encodingH, 'DecodeWithoutBOMHandlingAndWithoutReplacement', line => line.includes('inline nsresult DecodeWithoutBOMHandlingAndWithoutReplacement(')),
    decodeWithoutBomHandlingNoReplacementFfi: findAnchor(indexed.encodingH, 'DecodeWithoutBOMHandlingAndWithoutReplacement FFI', line => line.includes('mozilla_encoding_decode_to_nsstring_without_bom_handling_and_without_replacement(')),
    newDecoder: findAnchor(indexed.encodingH, 'NewDecoder', line => line.includes('UniquePtr<Decoder> NewDecoder()')),
    newDecoderFfi: findAnchor(indexed.encodingH, 'encoding_new_decoder', line => line.includes('encoding_new_decoder(this)')),
    newDecoderWithBomRemoval: findAnchor(indexed.encodingH, 'NewDecoderWithBOMRemoval', line => line.includes('UniquePtr<Decoder> NewDecoderWithBOMRemoval()')),
    newDecoderWithBomRemovalFfi: findAnchor(indexed.encodingH, 'encoding_new_decoder_with_bom_removal', line => line.includes('encoding_new_decoder_with_bom_removal(this)')),
    newDecoderWithBomRemovalInto: findAnchor(indexed.encodingH, 'NewDecoderWithBOMRemovalInto', line => line.includes('void NewDecoderWithBOMRemovalInto(Decoder& aDecoder)')),
    newDecoderWithBomRemovalIntoFfi: findAnchor(indexed.encodingH, 'encoding_new_decoder_with_bom_removal_into', line => line.includes('encoding_new_decoder_with_bom_removal_into(this')),
    newDecoderWithoutBomHandling: findAnchor(indexed.encodingH, 'NewDecoderWithoutBOMHandling', line => line.includes('UniquePtr<Decoder> NewDecoderWithoutBOMHandling()')),
    newDecoderWithoutBomHandlingFfi: findAnchor(indexed.encodingH, 'encoding_new_decoder_without_bom_handling', line => line.includes('encoding_new_decoder_without_bom_handling(this)')),
    newDecoderWithoutBomHandlingInto: findAnchor(indexed.encodingH, 'NewDecoderWithoutBOMHandlingInto', line => line.includes('void NewDecoderWithoutBOMHandlingInto(Decoder& aDecoder)')),
    newDecoderWithoutBomHandlingIntoFfi: findAnchor(indexed.encodingH, 'encoding_new_decoder_without_bom_handling_into', line => line.includes('encoding_new_decoder_without_bom_handling_into(this')),
    decoderClass: findAnchor(indexed.encodingH, 'Decoder class', line => line.includes('class Decoder final')),
    decoderEncoding: findAnchor(indexed.encodingH, 'Decoder::Encoding', line => line.includes('NotNull<const mozilla::Encoding*> Encoding() const')),
    decoderMaxUtf16BufferLength: findAnchor(indexed.encodingH, 'Decoder::MaxUTF16BufferLength', line => line.includes('CheckedInt<size_t> MaxUTF16BufferLength(size_t aU16Length) const')),
    decoderMaxUtf16BufferLengthFfi: findAnchor(indexed.encodingH, 'decoder_max_utf16_buffer_length', line => line.includes('decoder_max_utf16_buffer_length(this, aU16Length)')),
    decoderDecodeToUtf16: findAnchor(indexed.encodingH, 'Decoder::DecodeToUTF16', line => line.includes('DecodeToUTF16(')),
    decoderDecodeToUtf16Ffi: findAnchor(indexed.encodingH, 'decoder_decode_to_utf16 FFI', line => line.includes('decoder_decode_to_utf16(')),
    decoderDecodeToUtf16WithoutReplacement: findAnchor(indexed.encodingH, 'Decoder::DecodeToUTF16WithoutReplacement', line => line.includes('DecodeToUTF16WithoutReplacement')),
    decoderDecodeToUtf16WithoutReplacementFfi: findAnchor(indexed.encodingH, 'decoder_decode_to_utf16_without_replacement FFI', line => line.includes('decoder_decode_to_utf16_without_replacement(')),
    latin1OptimizationComment: findAnchor(indexed.encodingH, 'SpiderMonkey-style string storage optimization warning', line => line.includes('SpiderMonkey-style string')),
    latin1ByteCompatibleUpTo: findAnchor(indexed.encodingH, 'Latin1ByteCompatibleUpTo', line => line.includes('mozilla::Maybe<size_t> Latin1ByteCompatibleUpTo')),
  };

  assertFound(anchors);

  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'firefox-spidermonkey-textdecoder-source-pin-audit',
    contract: 'gecko-exact-revision-textdecoder-source-lines',
    note: 'Exact Gecko source-line pinning for the Firefox/SpiderMonkey TextDecoder host-API boundary. These source facts constrain the Gecko TextDecoder path at the pinned source revision; they are not Firefox benchmark evidence, not SpiderMonkey codegen evidence, and not a throughput proof.',
    environment: {
      firefoxVersion: options.firefoxVersion,
    },
    source: {
      repository: options.repository,
      revision: options.geckoRevision,
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
      id: 'gecko-textdecoder-host-api-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'Gecko TextDecoder initializes the encoding label through mozilla::Encoding, stores a Decoder, and routes BufferSource input into DecodeNative.',
      evidence: [
        `TextDecoder::Init line ${report.anchors.textDecoderInit.lineNumber}`,
        `Encoding::ForLabelNoReplacement line ${report.anchors.textDecoderForLabelNoReplacement.lineNumber}`,
        `NewDecoderWithoutBOMHandling line ${report.anchors.decoderWithoutBom.lineNumber}`,
        `NewDecoderWithBOMRemoval line ${report.anchors.decoderWithBomRemoval.lineNumber}`,
        `ProcessTypedArrays line ${report.anchors.processTypedArrays.lineNumber}`,
      ],
    },
    {
      id: 'gecko-textdecoder-utf16-output-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'The pinned Gecko TextDecoder path materializes decoded output into an nsAString UTF-16 buffer through Decoder::DecodeToUTF16 or DecodeToUTF16WithoutReplacement.',
      evidence: [
        `TextDecoderCommon::DecodeNative line ${report.anchors.decodeNative.lineNumber}`,
        `MaxUTF16BufferLength line ${report.anchors.maxUtf16BufferLength.lineNumber}`,
        `GetMutableData line ${report.anchors.mutableData.lineNumber}`,
        `DecodeToUTF16WithoutReplacement line ${report.anchors.decodeToUtf16WithoutReplacement.lineNumber}`,
        `DecodeToUTF16 line ${report.anchors.decodeToUtf16.lineNumber}`,
        `SetLength line ${report.anchors.setLength.lineNumber}`,
      ],
    },
    {
      id: 'gecko-encoding-rs-source-boundary',
      classification: 'SOURCE_FACT',
      summary: 'mozilla::Encoding is adapted from encoding_rs C++ bindings and its Decoder methods cross encoding_rs FFI wrappers for UTF-16 decoding.',
      evidence: [
        `encoding_rs adaptation comment line ${report.anchors.encodingRsComment.lineNumber}`,
        `mozilla_encoding_decode_to_nsstring line ${report.anchors.ffiDecodeNsString.lineNumber}`,
        `class Encoding final line ${report.anchors.encodingClass.lineNumber}`,
        `class Decoder final line ${report.anchors.decoderClass.lineNumber}`,
        `decoder_decode_to_utf16 line ${report.anchors.decoderDecodeToUtf16Ffi.lineNumber}`,
        `decoder_decode_to_utf16_without_replacement line ${report.anchors.decoderDecodeToUtf16WithoutReplacementFfi.lineNumber}`,
      ],
    },
    {
      id: 'gecko-spidermonkey-string-optimization-scope-guard',
      classification: 'SCOPE_GUARD',
      summary: 'Encoding.h exposes a Latin1ByteCompatibleUpTo helper for SpiderMonkey-style string storage optimizations, but the pinned TextDecoder.cpp path audited here uses the nsAString UTF-16 DecodeNative path. This source fact is not a Firefox benchmark, codegen trace, or runtime-ceiling proof.',
      evidence: [
        `SpiderMonkey-style string storage optimization warning line ${report.anchors.latin1OptimizationComment.lineNumber}`,
        `Latin1ByteCompatibleUpTo line ${report.anchors.latin1ByteCompatibleUpTo.lineNumber}`,
        'The audit does not run a Firefox benchmark row.',
        'The audit does not inspect SpiderMonkey-generated machine code.',
        'Any 200 MiB/s+ bounded-memory full-string row would still be a counterexample to the broad runtime-limit hypothesis.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Firefox/SpiderMonkey TextDecoder Source Pin Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Scope',
    '',
    'This audit pins Mozilla Gecko source lines for the DOM `TextDecoder.decode()` host-API boundary used by Firefox/SpiderMonkey. It is source evidence for the pinned `mozilla/gecko-dev` revision only. It is not a Firefox benchmark row, not SpiderMonkey JIT/codegen evidence, not heap/allocation evidence, and not a runtime-ceiling proof.',
    '',
    '## Runtime And Source',
    '',
    `- Firefox: ${report.environment.firefoxVersion}`,
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
    'For this Gecko source revision, `TextDecoder.decode()` is a Gecko host-API path. The DOM binding owns a `mozilla::Decoder`, maps labels through `mozilla::Encoding`, processes `BufferSource` input, and materializes decoded output through an `nsAString` UTF-16 buffer before returning through the binding surface.',
    '',
    '`intl/Encoding.h` also contains a separate `Latin1ByteCompatibleUpTo` helper documented for SpiderMonkey-style string storage optimizations. That helper is useful scope evidence, but it does not change the audited `TextDecoder.cpp` path into a zero-copy JavaScript string path and it does not prove that Firefox/SpiderMonkey has no remaining performance headroom.',
    '',
    'The source pin narrows one non-V8 browser source-boundary gap. It must be paired with Firefox benchmark rows, SpiderMonkey codegen/profiler traces, and allocation evidence before supporting any broader runtime-limit conclusion.',
  );

  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(`firefox-spidermonkey-textdecoder-source-pin-audit: revision=${report.source.revision}`);
  for (const [id, anchor] of Object.entries(report.anchors)) {
    console.log(`  ${id}: ${anchor.status} line=${anchor.lineNumber}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
