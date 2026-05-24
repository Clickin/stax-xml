import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultRepository = 'https://hg.mozilla.org/releases/mozilla-release';
const defaultGeckoRevision = '644b498d517849c3fb95679e2017e965fe62b77a';
const defaultFirefoxVersion = '143.0.1 build 20250918214338';
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-jitspew-source-pin-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-jitspew-source-pin-audit.md');

const sourcePaths = {
  jitSpewerH: 'js/src/jit/JitSpewer.h',
  jitSpewerCpp: 'js/src/jit/JitSpewer.cpp',
  jsConfigure: 'js/moz.configure',
  jsSrcMozBuild: 'js/src/moz.build',
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
    debugAvailabilityComment: findAnchor(indexed.jitSpewerH, 'JitSpewer availability comment', line => line.includes('The JitSpewer is only available on debug builds')),
    jsJitSpewHeaderIfdef: findAnchor(indexed.jitSpewerH, 'JitSpewer.h JS_JITSPEW guard', line => line.includes('#ifdef JS_JITSPEW')),
    emptyGraphSpewerBackend: findAnchor(indexed.jitSpewerH, 'non-JS_JITSPEW GraphSpewer backend', line => line.includes('bool isSpewing() { return false; }')),
    emptyJitSpewEnabled: findAnchor(indexed.jitSpewerH, 'non-JS_JITSPEW JitSpewEnabled backend', line => line.includes('JitSpewEnabled(JitSpewChannel channel) { return false; }')),
    jitSpewerCppIfdef: findAnchor(indexed.jitSpewerCpp, 'JitSpewer.cpp JS_JITSPEW guard', line => line.includes('#ifdef JS_JITSPEW')),
    jitSpewDir: findAnchor(indexed.jitSpewerCpp, 'JIT_SPEW_DIR output directory', line => line.includes('#  ifndef JIT_SPEW_DIR')),
    ionFlagsUsage: findAnchor(indexed.jitSpewerCpp, 'IONFLAGS usage text', line => line.includes('usage: IONFLAGS=option,option,option')),
    ionFlagsEnv: findAnchor(indexed.jitSpewerCpp, 'IONFLAGS environment read', line => line.includes('getenv("IONFLAGS")')),
    ionSpewFilename: findAnchor(indexed.jitSpewerCpp, 'ION_SPEW_FILENAME environment read', line => line.includes('getenv("ION_SPEW_FILENAME")')),
    codegenChannel: findAnchor(indexed.jitSpewerCpp, 'codegen channel enable', line => line.includes('EnableChannel(JitSpew_Codegen)')),
    cppEndIfdef: findAnchor(indexed.jitSpewerCpp, 'JitSpewer.cpp JS_JITSPEW endif', line => line.includes('#endif /* JS_JITSPEW */')),
    configureEnableJitSpew: findAnchor(indexed.jsConfigure, '--enable-jitspew option', line => line.includes('"--enable-jitspew"')),
    configureIonFlagsHelp: findAnchor(indexed.jsConfigure, 'IONFLAGS configure help', line => line.includes('IONFLAGS environment') && line.includes('variable')),
    configureDefineJsJitSpew: findAnchor(indexed.jsConfigure, 'JS_JITSPEW define', line => line.includes('set_define("JS_JITSPEW"')),
    configureConfigJsJitSpew: findAnchor(indexed.jsConfigure, 'JS_JITSPEW config', line => line.includes('set_config("JS_JITSPEW"')),
    configureStructuredSpew: findAnchor(indexed.jsConfigure, 'structured spew enabled with jitspew', line => line.includes('Also enable the structured spewer')),
    mozBuildJsJitSpew: findAnchor(indexed.jsSrcMozBuild, 'js/src moz.build JS_JITSPEW gate', line => line.includes('if CONFIG["JS_JITSPEW"]')),
  };
  assertFound(anchors);

  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'firefox-spidermonkey-jitspew-source-pin-audit',
    contract: 'spidermonkey-exact-revision-jitspew-source-lines',
    note: 'Exact Gecko/SpiderMonkey source-line pinning for the JitSpew/IONFLAGS diagnostic path. This explains the diagnostic dump surface and compile-time gates; it is source evidence, not emitted JIT IR or optimized-code proof.',
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

function createFindings(report) {
  return [
    {
      id: 'spidermonkey-jitspew-compile-gate-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'The pinned SpiderMonkey JitSpew implementation is guarded by JS_JITSPEW, and the non-JS_JITSPEW backend reports no active spewing.',
      evidence: [
        anchorRef(report.anchors.jsJitSpewHeaderIfdef),
        anchorRef(report.anchors.emptyGraphSpewerBackend),
        anchorRef(report.anchors.emptyJitSpewEnabled),
        anchorRef(report.anchors.jitSpewerCppIfdef),
      ],
    },
    {
      id: 'spidermonkey-ionflags-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'IONFLAGS, ION_SPEW_FILENAME, JIT_SPEW_DIR, and the codegen channel are implemented inside the guarded JitSpewer source path.',
      evidence: [
        anchorRef(report.anchors.ionFlagsUsage),
        anchorRef(report.anchors.ionFlagsEnv),
        anchorRef(report.anchors.ionSpewFilename),
        anchorRef(report.anchors.jitSpewDir),
        anchorRef(report.anchors.codegenChannel),
      ],
    },
    {
      id: 'spidermonkey-enable-jitspew-build-option-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'The pinned Gecko configure logic exposes --enable-jitspew and maps it to JS_JITSPEW and JS_STRUCTURED_SPEW.',
      evidence: [
        anchorRef(report.anchors.configureEnableJitSpew),
        anchorRef(report.anchors.configureIonFlagsHelp),
        anchorRef(report.anchors.configureDefineJsJitSpew),
        anchorRef(report.anchors.configureConfigJsJitSpew),
        anchorRef(report.anchors.configureStructuredSpew),
        anchorRef(report.anchors.mozBuildJsJitSpew),
      ],
    },
    {
      id: 'spidermonkey-jitspew-scope-guard',
      classification: 'SCOPE_GUARD',
      summary: 'This source pin does not prove the installed Firefox binary build flags and does not close the Firefox/SpiderMonkey JIT IR or optimized-code proof obligation.',
      evidence: [
        'Pair this with a diagnostic dump run or a build configuration artifact before claiming emitted codegen evidence.',
        'A no-dump browser result remains a scoped negative result, not proof that SpiderMonkey has no codegen headroom.',
      ],
    },
  ];
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
    .map(([key, anchor]) => `${key} (${anchor.label})`);
  if (missing.length > 0) {
    throw new Error(`Missing required SpiderMonkey JitSpew anchors: ${missing.join(', ')}`);
  }
}

function renderMarkdown(report) {
  const lines = [
    '# Firefox/SpiderMonkey JitSpew Source Pin Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Source',
    '',
    `- Repository: ${report.source.repository}`,
    `- Revision: ${report.source.revision}`,
    `- Firefox build: ${report.environment.firefoxVersion}`,
    '',
    '## Anchors',
    '',
    '| Anchor | File | Line | URL |',
    '| --- | --- | ---: | --- |',
    ...Object.values(report.anchors).map(anchor =>
      `| ${anchor.label} | ${anchor.file} | ${anchor.lineNumber} | ${anchor.url} |`),
    '',
    '## Findings',
    '',
    ...report.findings.flatMap(finding => [
      `- ${finding.id} (${finding.classification}): ${finding.summary}`,
      ...finding.evidence.map(entry => `  - ${entry}`),
    ]),
    '',
    'This is not emitted JIT IR, not an optimized-code dump, and not a runtime ceiling proof.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function anchorRef(anchor) {
  return `${anchor.label}: ${anchor.file}:${anchor.lineNumber}`;
}

function printSummary(report) {
  console.log(`firefox-spidermonkey-jitspew-source-pin-audit: anchors=${Object.keys(report.anchors).length}`);
}

function writeOutput(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

main();
