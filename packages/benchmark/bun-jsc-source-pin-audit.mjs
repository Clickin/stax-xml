import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'bun-jsc-source-pin-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'bun-jsc-source-pin-audit.md');
const defaultRepository = 'oven-sh/webkit';

const sourcePaths = {
  jsStringHeader: 'Source/JavaScriptCore/runtime/JSString.h',
  wtfStringHeader: 'Source/WTF/wtf/text/WTFString.h',
  stringImplHeader: 'Source/WTF/wtf/text/StringImpl.h',
  stringImplCpp: 'Source/WTF/wtf/text/StringImpl.cpp',
};

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sourceDir: null,
    webkitCommit: null,
    bunVersion: null,
    bunRevision: null,
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
      case '--bun-revision':
        options.bunRevision = readValue();
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
  const runtime = readRuntime(options);
  const revision = options.webkitCommit ?? runtime.webkitCommit;
  if (!revision) {
    throw new Error('Missing WebKit commit. Provide --webkit-commit or run with Bun available.');
  }

  const sources = await loadSources(options, revision);
  const report = createReport({ options, runtime, revision, sources });
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function readRuntime(options) {
  if (options.bunVersion || options.bunRevision || options.webkitCommit) {
    return {
      bunVersion: options.bunVersion ?? 'unknown',
      bunRevision: options.bunRevision ?? 'unknown',
      webkitCommit: options.webkitCommit ?? null,
      source: 'arguments',
    };
  }

  const revisionResult = spawnSync('bun', ['--revision'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (revisionResult.status !== 0) {
    throw new Error(`bun revision probe failed: ${revisionResult.stderr || revisionResult.stdout}`);
  }

  const result = spawnSync('bun', ['-e', "console.log(JSON.stringify({bunVersion:process.versions.bun, versions:process.versions, userAgent:typeof navigator !== 'undefined' ? navigator.userAgent : null}))"], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`bun runtime probe failed: ${result.stderr || result.stdout}`);
  }

  const parsed = JSON.parse(result.stdout);
  return {
    bunVersion: parsed.bunVersion,
    bunRevision: revisionResult.stdout.trim(),
    webkitCommit: parsed.versions.webkit,
    userAgent: parsed.userAgent,
    processVersions: parsed.versions,
    source: 'bun-runtime-probe',
  };
}

async function loadSources(options, revision) {
  const loaded = {};
  for (const [key, sourcePath] of Object.entries(sourcePaths)) {
    loaded[key] = await loadSource(options, revision, sourcePath);
  }
  return loaded;
}

async function loadSource(options, revision, sourcePath) {
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

  const fetchUrl = rawSourceUrl(revision, sourcePath);
  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch WebKit source ${sourcePath}: HTTP ${response.status} ${await response.text()}`);
  }
  return {
    path: sourcePath,
    text: await response.text(),
    url: browserSourceUrl(revision, sourcePath),
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

function createReport({ runtime, revision, sources }) {
  const indexed = Object.fromEntries(
    Object.entries(sources).map(([key, source]) => [key, { source, lines: source.text.split(/\r?\n/) }]),
  );

  const anchors = {
    jsStringClass: findAnchor(indexed.jsStringHeader, 'JSString cell class', line => line.includes('class JSString : public JSCell')),
    jsStringMaxLength: findAnchor(indexed.jsStringHeader, 'JSString MaxLength', line => line.includes('static constexpr unsigned MaxLength') && line.includes('std::numeric_limits<int32_t>::max()')),
    jsStringValueInternal: findAnchor(indexed.jsStringHeader, 'JSString valueInternal', line => line.includes('String& valueInternal() const')),
    jsStringConstructorStoresString: findAnchor(indexed.jsStringHeader, 'JSString stores WTF::String', line => line.includes('new (&uninitializedValueInternal()) String(WTF::move(value))')),
    jsStringAllocateCell: findAnchor(indexed.jsStringHeader, 'JSString allocateCell', line => line.includes('allocateCell<JSString>')),
    jsStringViewReturnsValue: findAnchor(indexed.jsStringHeader, 'JSString view returns valueInternal', line => line.includes('return { this, valueInternal() };')),
    wtfStringClass: findAnchor(indexed.wtfStringHeader, 'WTF::String class', line => line.includes('class String final')),
    wtfStringMaxLength: findAnchor(indexed.wtfStringHeader, 'WTF::String MaxLength', line => line.includes('static constexpr unsigned MaxLength = StringImpl::MaxLength')),
    wtfStringCreateUninitialized: findAnchor(indexed.wtfStringHeader, 'WTF::String createUninitialized', line => line.includes('static String createUninitialized') && line.includes('StringImpl::createUninitialized')),
    wtfStringImplPointer: findAnchor(indexed.wtfStringHeader, 'WTF::String StringImpl pointer', line => line.includes('RefPtr<StringImpl> m_impl')),
    stringImplMaxLength: findAnchor(indexed.stringImplHeader, 'StringImpl MaxLength', line => line.includes('static constexpr unsigned MaxLength = std::numeric_limits<int32_t>::max()')),
    stringImplBufferOwnership: findAnchor(indexed.stringImplHeader, 'StringImpl BufferOwnership', line => line.includes('enum BufferOwnership') && line.includes('BufferInternal')),
    stringImplIsValidLength: findAnchor(indexed.stringImplHeader, 'StringImpl isValidLength', line => line.includes('static constexpr bool isValidLength')),
    stringImplCreate: findAnchor(indexed.stringImplHeader, 'StringImpl create span', line => line.includes('static Ref<StringImpl> create(std::span<const char16_t>)')),
    stringImplCreateWithoutCopying: findAnchor(indexed.stringImplHeader, 'StringImpl createWithoutCopying', line => line.includes('createWithoutCopying(std::span<const char16_t>')),
    stringImplTryCreateUninitialized: findAnchor(indexed.stringImplHeader, 'StringImpl tryCreateUninitialized', line => line.includes('tryCreateUninitialized') && line.includes('std::span<CharacterType>&')),
    stringImplCreateInternal: findAnchor(indexed.stringImplCpp, 'StringImpl createInternal', line => line.includes('StringImpl::createInternal(std::span<const CharacterType> characters)')),
    stringImplCreateUninitializedInternal: findAnchor(indexed.stringImplCpp, 'StringImpl createUninitializedInternalNonEmpty', line => line.includes('createUninitializedInternalNonEmpty(characters.size(), data)')),
    stringImplCreateCopyCharacters: findAnchor(indexed.stringImplCpp, 'StringImpl copyCharacters', line => line.includes('copyCharacters(data, characters)')),
    stringImplCreate8BitIfPossible: findAnchor(indexed.stringImplCpp, 'StringImpl create8BitIfPossible', line => line.includes('StringImpl::create8BitIfPossible(std::span<const char16_t> characters)')),
    stringImplCreate8BitCopyElements: findAnchor(indexed.stringImplCpp, 'StringImpl copyElements', line => line.includes('copyElements(data, characters)')),
  };

  assertFound(anchors);

  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'bun-jsc-source-pin-audit',
    contract: 'bun-jsc-exact-webkit-string-boundary-source-lines',
    note: 'Exact Bun-patched WebKit source-line pinning for JavaScriptCore string boundary evidence. These source facts constrain JSString/WTF::String/StringImpl ownership claims, but they are not throughput proof.',
    runtime,
    source: {
      repository: defaultRepository,
      revision,
      files: Object.values(sourcePaths),
      fetchedAt: Object.values(sources).map(source => source.fetchedAt).sort()[0],
    },
    derived: {
      stringImplMaxLengthCodeUnits: 2_147_483_647,
      formula: 'std::numeric_limits<int32_t>::max()',
      projected1024MiBGeneratedFixtureCodeUnits: 1_072_245_626,
      projected1024MiBHeadroomCodeUnits: 2_147_483_647 - 1_072_245_626,
    },
    anchors,
  };
  report.findings = createFindings(report);
  return report;
}

function findAnchor(indexedSource, label, predicate) {
  const { source, lines } = indexedSource;
  const index = lines.findIndex(predicate);
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
      id: 'jsc-jsstring-engine-cell-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'JavaScriptCore JSString is pinned as a JSCell-backed engine value that stores a WTF::String in the VM-managed cell, not as an arbitrary parser-owned byte-span primitive.',
      evidence: [
        `JSString class line ${report.anchors.jsStringClass.lineNumber}`,
        `JSString constructor stores WTF::String line ${report.anchors.jsStringConstructorStoresString.lineNumber}`,
        `JSString allocateCell line ${report.anchors.jsStringAllocateCell.lineNumber}`,
        `JSString view returns valueInternal line ${report.anchors.jsStringViewReturnsValue.lineNumber}`,
      ],
    },
    {
      id: 'jsc-stringimpl-storage-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'WTF::String is pinned as a RefPtr<StringImpl> wrapper, and the ordinary StringImpl create path allocates uninitialized internal storage then copies the supplied character span.',
      evidence: [
        `WTF::String RefPtr<StringImpl> line ${report.anchors.wtfStringImplPointer.lineNumber}`,
        `StringImpl createInternal line ${report.anchors.stringImplCreateInternal.lineNumber}`,
        `StringImpl copyCharacters line ${report.anchors.stringImplCreateCopyCharacters.lineNumber}`,
        `StringImpl create8BitIfPossible copyElements line ${report.anchors.stringImplCreate8BitCopyElements.lineNumber}`,
      ],
    },
    {
      id: 'jsc-string-max-length-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'The same pinned WebKit revision defines the JSC/WTF maximum string length as int32 max, matching the Bun/JSC string-limit audit.',
      evidence: [
        `JSString MaxLength line ${report.anchors.jsStringMaxLength.lineNumber}`,
        `StringImpl MaxLength line ${report.anchors.stringImplMaxLength.lineNumber}`,
        `String::MaxLength line ${report.anchors.wtfStringMaxLength.lineNumber}`,
        `1024 MiB generated projection headroom=${formatInteger(report.derived.projected1024MiBHeadroomCodeUnits)} code units`,
      ],
    },
    {
      id: 'source-pin-not-throughput-proof',
      classification: 'SCOPE_GUARD',
      summary: 'This source pin constrains the engine-owned string boundary only; it is not a throughput proof and does not prove that all JS-runtime headroom has been exhausted.',
      evidence: [
        'No benchmark row is run by this audit.',
        'No browser Safari/JSC row is run by this audit.',
        'No claim about a 200 MiB/s ceiling follows from these source lines alone.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Bun/JSC Source Pin Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Scope',
    '',
    'This audit pins JavaScriptCore string-boundary source lines for the exact Bun-patched WebKit revision used by the local Bun/JSC benchmark artifacts. It is evidence for the engine-owned string boundary, not a throughput proof and not a claim that no JavaScript headroom remains.',
    '',
    '## Runtime And Source',
    '',
    `- Bun: ${report.runtime.bunVersion}`,
    `- Bun revision: ${report.runtime.bunRevision}`,
    `- WebKit commit: ${report.source.revision}`,
    `- Repository: ${report.source.repository}`,
    `- StringImpl::MaxLength: ${formatInteger(report.derived.stringImplMaxLengthCodeUnits)} UTF-16 code units`,
    `- Source formula: ${report.derived.formula}`,
    `- 1024 MiB generated fixture projection: ${formatInteger(report.derived.projected1024MiBGeneratedFixtureCodeUnits)} UTF-16 code units`,
    `- 1024 MiB generated fixture headroom: ${formatInteger(report.derived.projected1024MiBHeadroomCodeUnits)} UTF-16 code units`,
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
    'For this Bun/JSC revision, the JavaScript string value boundary is represented by JSC `JSString` cells holding WTF `String` / `StringImpl` storage. The ordinary `StringImpl::create` path allocates engine-managed string storage and copies character spans into it. This supports the narrow claim that portable JavaScript string primitives are engine-owned values rather than parser-owned byte-span views.',
    '',
    'The source lines do not prove a throughput ceiling. They also do not reject future JavaScript runtime headroom, projection-specific wins, browser-specific differences, or native engine-internal APIs with different lifetime contracts.',
  );

  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(`bun-jsc-source-pin-audit: revision=${report.source.revision}`);
  for (const [id, anchor] of Object.entries(report.anchors)) {
    console.log(`  ${id}: ${anchor.status} line=${anchor.lineNumber}`);
  }
}

function formatInteger(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return 'n/a';
  return Math.round(value).toLocaleString('en-US');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
