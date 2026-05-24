import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultRepository = 'https://hg.mozilla.org/releases/mozilla-release';
const defaultGeckoRevision = '644b498d517849c3fb95679e2017e965fe62b77a';
const defaultFirefoxVersion = '143.0.1 build 20250918214338';
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-string-source-pin-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-string-source-pin-audit.md');

const sourcePaths = {
  stringTypeH: 'js/src/vm/StringType.h',
  stringTypeCpp: 'js/src/vm/StringType.cpp',
  stringTypeInlH: 'js/src/vm/StringType-inl.h',
  publicStringH: 'js/public/String.h',
};

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sourceDir: null,
    repository: defaultRepository,
    geckoRevision: defaultGeckoRevision,
    firefoxVersion: defaultFirefoxVersion,
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
  if (/^https:\/\/hg\.mozilla\.org\//.test(repository)) {
    return `${repository.replace(/\/$/, '')}/raw-file/${revision}/${sourcePath}`;
  }
  if (/^https:\/\/github\.com\//.test(repository)) {
    const repoPath = repository.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
    return `https://raw.githubusercontent.com/${repoPath}/${revision}/${sourcePath}`;
  }
  return `https://raw.githubusercontent.com/${repository}/${revision}/${sourcePath}`;
}

function browserSourceUrl(repository, revision, sourcePath) {
  if (/^https:\/\/hg\.mozilla\.org\//.test(repository)) {
    return `${repository.replace(/\/$/, '')}/file/${revision}/${sourcePath}`;
  }
  if (/^https:\/\/github\.com\//.test(repository)) {
    const repoPath = repository.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
    return `https://github.com/${repoPath}/blob/${revision}/${sourcePath}`;
  }
  return `https://github.com/${repository}/blob/${revision}/${sourcePath}`;
}

function createReport({ options, sources }) {
  const indexed = Object.fromEntries(
    Object.entries(sources).map(([key, source]) => [key, { source, lines: source.text.split(/\r?\n/) }]),
  );
  const anchors = {
    jsStringSmdoc: findAnchor(indexed.stringTypeH, 'JavaScript Strings SMDOC', line => line.includes('[SMDOC] JavaScript Strings')),
    conceptualChars: findAnchor(indexed.stringTypeH, 'conceptual chars and length', line => line.includes('Conceptually, a JS string is just an array of chars and a length')),
    jsStringClass: findAnchor(indexed.stringTypeH, 'JSString cell class', line => line.includes('class JSString : public js::gc::CellWithLengthAndFlags')),
    ownedCharsMalloc: findAnchor(indexed.stringTypeH, 'OwnedChars malloc ownership', line => line.includes('chars_ is a buffer allocated in the malloc heap')),
    ownedCharsStringBuffer: findAnchor(indexed.stringTypeH, 'OwnedChars StringBuffer ownership', line => line.includes('chars_ is allocated as a refcounted StringBuffer')),
    jsLinearStringClass: findAnchor(indexed.stringTypeH, 'JSLinearString class', line => line.includes('class JSLinearString : public JSString')),
    promotionMayMallocCopy: findAnchor(indexed.stringTypeH, 'promotion may malloc and copy chars', line => line.includes('Make sure chars are not in the nursery, mallocing and copying if necessary')),
    newStringCopyNDeclaration: findAnchor(indexed.stringTypeH, 'NewStringCopyN declaration', line => line.includes('extern JSLinearString* NewStringCopyN(')),
    inlineStringAllocation: findAnchor(indexed.stringTypeInlH, 'AllocateInlineString', line => line.includes('AllocateInlineString(')),
    externalStringConstructor: findAnchor(indexed.stringTypeInlH, 'JSExternalString constructor', line => line.includes('inline JSExternalString::JSExternalString(')),
    newStringCopyNImpl: findAnchor(indexed.stringTypeCpp, 'NewStringCopyN implementation', line => line.includes('JSLinearString* NewStringCopyNDontDeflateNonStaticValidLength')),
    allocChars: findAnchor(indexed.stringTypeCpp, 'AllocChars for copied string', line => line.includes('::AllocChars<CharT>(cx, n, heap)')),
    podCopy: findAnchor(indexed.stringTypeCpp, 'PodCopy into owned chars', line => line.includes('PodCopy(news.data(), s, n)')),
    deflateBranch: findAnchor(indexed.stringTypeCpp, 'NewStringCopyN deflate branch', line => line.includes('CanStoreCharsAsLatin1(s, n)')),
    publicCopyComment: findAnchor(indexed.publicStringH, 'public copy ownership comment', line => line.includes('all the JS_New*StringCopy* functions do not take')),
    publicNewStringCopyN: findAnchor(indexed.publicStringH, 'JS_NewStringCopyN', line => line.includes('JS_NewStringCopyN(JSContext* cx, const char* s')),
    publicNewStringCopyUtf8N: findAnchor(indexed.publicStringH, 'JS_NewStringCopyUTF8N', line => line.includes('JS_NewStringCopyUTF8N(JSContext* cx')),
    publicGetChars: findAnchor(indexed.publicStringH, 'JS_GetString chars accessors', line => line.includes('JS_GetLatin1StringCharsAndLength')),
    publicCopyStringChars: findAnchor(indexed.publicStringH, 'JS_CopyStringChars', line => line.includes('JS_CopyStringChars(')),
    publicStringBufferAccess: findAnchor(indexed.publicStringH, 'StringBuffer-backed string access', line => line.includes('If the provided string is backed by a StringBuffer')),
  };
  assertFound(anchors);

  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'firefox-spidermonkey-string-source-pin-audit',
    contract: 'spidermonkey-exact-revision-string-source-lines',
    note: 'Exact Gecko/SpiderMonkey source-line pinning for JS string representation and public string-copy boundaries. These source facts constrain the pinned Firefox/SpiderMonkey build; they are not benchmark evidence, not codegen evidence, and not a throughput proof.',
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
  return lines.slice(start, end).map((text, offset) => ({
    lineNumber: start + offset + 1,
    text,
  }));
}

function assertFound(anchors) {
  const missing = Object.entries(anchors)
    .filter(([, anchor]) => anchor.status !== 'found')
    .map(([key, anchor]) => `${key}: ${anchor.label} in ${anchor.file}`)
    .join('\n');
  if (missing) {
    throw new Error(`Missing expected SpiderMonkey string source anchors:\n${missing}`);
  }
}

function createFindings(report) {
  return [
    {
      id: 'spidermonkey-jsstring-representation-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'The pinned SpiderMonkey source defines JS strings as engine GC cells with chars/length representation variants.',
      evidence: [
        `JSString class line ${report.anchors.jsStringClass.lineNumber}`,
        `JSLinearString class line ${report.anchors.jsLinearStringClass.lineNumber}`,
        `OwnedChars malloc ownership line ${report.anchors.ownedCharsMalloc.lineNumber}`,
        `OwnedChars StringBuffer ownership line ${report.anchors.ownedCharsStringBuffer.lineNumber}`,
      ],
    },
    {
      id: 'spidermonkey-string-copy-boundary-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'The pinned public API and internal NewStringCopyN path distinguish ownership-taking APIs from copy APIs and copy counted input into engine-owned chars.',
      evidence: [
        `public JS_New*StringCopy comment line ${report.anchors.publicCopyComment.lineNumber}`,
        `NewStringCopyN declaration line ${report.anchors.newStringCopyNDeclaration.lineNumber}`,
        `AllocChars line ${report.anchors.allocChars.lineNumber}`,
        `PodCopy line ${report.anchors.podCopy.lineNumber}`,
      ],
    },
    {
      id: 'spidermonkey-string-source-pin-scope-limit',
      classification: 'TRACE_FACT_LIMIT',
      summary: 'This source pin constrains string ownership/copy boundaries, but it is not generated-code, profiler, allocation, or throughput evidence.',
      evidence: [
        'It does not prove that Firefox/SpiderMonkey full-string rows have no remaining optimization headroom.',
        'It does not replace SpiderMonkey allocation or codegen traces for the benchmark shapes.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Firefox/SpiderMonkey String Source Pin Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report is a SOURCE_FACT for the tested Firefox/SpiderMonkey JS string boundary.',
    'It pins exact SpiderMonkey source lines for representation and string-copy APIs; it is not a benchmark, allocation profile, or runtime ceiling proof.',
    '',
    '## Source',
    '',
    `- Firefox build: ${report.environment.firefoxVersion}`,
    `- Repository: ${report.source.repository}`,
    `- Revision: ${report.source.revision}`,
    `- Files: ${report.source.files.join(', ')}`,
    '',
    '## Findings',
    '',
    ...report.findings.flatMap(finding => [
      `- ${finding.id} (${finding.classification}): ${finding.summary}`,
      ...finding.evidence.map(item => `  - ${item}`),
    ]),
    '',
    '## Selected Anchors',
    '',
    ...Object.entries(report.anchors).map(([key, anchor]) => `- ${key}: ${anchor.file}:${anchor.lineNumber} ${anchor.url}`),
    '',
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(JSON.stringify({
    objective: report.objective,
    revision: report.source.revision,
    jsStringLine: report.anchors.jsStringClass.lineNumber,
    copyCommentLine: report.anchors.publicCopyComment.lineNumber,
    podCopyLine: report.anchors.podCopy.lineNumber,
  }, null, 2));
}

await main();
