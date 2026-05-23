import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultRevision = 'refs/tags/14.8.178.22';
const defaultSourcePath = 'include/v8-primitive.h';
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'chrome-v8-source-pin-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'chrome-v8-source-pin-audit.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    revision: defaultRevision,
    sourcePath: defaultSourcePath,
    sourceFile: null,
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
      case '--source-path':
        options.sourcePath = readValue();
        break;
      case '--source-file':
        options.sourceFile = resolve(process.cwd(), readValue());
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

  if (options.sourceFile && !existsSync(options.sourceFile)) {
    throw new Error(`--source-file does not exist: ${options.sourceFile}`);
  }
  return options;
}

async function main() {
  const options = parseArgs();
  const source = await loadSource(options);
  const report = createReport(options, source);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

async function loadSource(options) {
  if (options.sourceFile) {
    return {
      text: readFileSync(options.sourceFile, 'utf8'),
      url: `source-file:${options.sourceFile}`,
      fetchedAt: new Date().toISOString(),
    };
  }

  const url = sourceUrl(options.revision, options.sourcePath);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Chromium source: HTTP ${response.status} ${await response.text()}`);
  }
  const encoded = await response.text();
  return {
    text: Buffer.from(encoded, 'base64').toString('utf8'),
    url,
    fetchedAt: new Date().toISOString(),
  };
}

function sourceUrl(revision, sourcePath) {
  return `https://chromium.googlesource.com/v8/v8/+/${encodePathSegment(revision)}/${sourcePath}?format=TEXT`;
}

function encodePathSegment(value) {
  return value.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

function createReport(options, source) {
  const lines = source.text.split(/\r?\n/);
  const anchors = {
    kMaxLength: findAnchor(
      lines,
      'String::kMaxLength',
      (line, index) => line.includes('static constexpr int kMaxLength') && contextText(lines, index, 3).includes('(1 << 29) - 24'),
    ),
    newFromUtf8: findAnchor(lines, 'String::NewFromUtf8', line => line.includes('NewFromUtf8(')),
    externalResourceDispose: findAnchor(lines, 'external string resource Dispose', (line, index) => (
      line.includes('Dispose') && contextText(lines, index, 6).includes('ExternalStringResource')
    )),
    newExternalOneByte: findAnchor(lines, 'String::NewExternalOneByte', line => line.includes('NewExternalOneByte')),
  };

  assertFound(anchors, ['kMaxLength', 'newFromUtf8', 'externalResourceDispose', 'newExternalOneByte']);

  return {
    generatedAt: new Date().toISOString(),
    objective: 'chrome-v8-source-pin-audit',
    contract: 'chrome-v8-exact-revision-string-boundary-source-lines',
    note: 'Exact Chromium/V8 source-line pinning for browser string boundary evidence. These source facts constrain complete-string and external-string claims, but they are not throughput proof.',
    environment: {
      browserVersion: options.browserVersion,
      v8Version: options.v8Version,
    },
    source: {
      repository: 'v8/v8',
      revision: options.revision,
      path: options.sourcePath,
      url: source.url,
      fetchedAt: source.fetchedAt,
    },
    derived: {
      x64MaxStringLengthCodeUnits: 536_870_888,
      formula: '(1 << 29) - 24',
      projectedBrowserStringLimitAuditCodeUnits: 1_072_245_626,
      projectedExcessCodeUnits: 1_072_245_626 - 536_870_888,
    },
    anchors,
    findings: createFindings(anchors),
  };
}

function findAnchor(lines, label, predicate) {
  const index = lines.findIndex(predicate);
  if (index < 0) {
    return {
      status: 'missing',
      label,
      lineNumber: null,
      context: [],
    };
  }
  return {
    status: 'found',
    label,
    lineNumber: index + 1,
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

function assertFound(anchors, keys) {
  const missing = keys.filter(key => anchors[key].status !== 'found');
  if (missing.length > 0) {
    throw new Error(`Missing source anchors: ${missing.join(', ')}`);
  }
}

function createFindings(anchors) {
  return [
    {
      id: 'browser-v8-string-max-length-source-pin',
      classification: 'SOURCE_FACT',
      summary: 'The exact Chromium/V8 source used by the browser artifact pins String::kMaxLength to the 64-bit V8 formula used by the browser string-limit audit.',
      evidence: [
        `String::kMaxLength line ${anchors.kMaxLength.lineNumber}`,
        'x64 formula resolves to 536,870,888 UTF-16 code units.',
      ],
    },
    {
      id: 'new-from-utf8-allocating-api-boundary',
      classification: 'SOURCE_FACT',
      summary: 'The V8 public UTF-8 string creation API is pinned at this revision for source-level string-boundary discussion.',
      evidence: [
        `String::NewFromUtf8 line ${anchors.newFromUtf8.lineNumber}`,
      ],
    },
    {
      id: 'external-string-resource-lifetime-boundary',
      classification: 'SOURCE_FACT',
      summary: 'The external-string API remains a resource-lifetime contract, not a portable parser-owned byte-span-to-primitive-string escape hatch.',
      evidence: [
        `External resource Dispose line ${anchors.externalResourceDispose.lineNumber}`,
        `NewExternalOneByte line ${anchors.newExternalOneByte.lineNumber}`,
      ],
    },
    {
      id: 'source-pin-not-throughput-proof',
      classification: 'SOURCE_FACT_LIMIT',
      summary: 'Source-line pinning constrains string-size and ownership claims, but it does not prove that Chrome/V8 or JavaScript runtimes have no remaining performance headroom.',
      evidence: [
        'Keep runtime-limit claims below CONCLUSION until broader counterexample searches and runtime traces are complete.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# Chrome V8 Source Pin Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report is a SOURCE_FACT for one Chromium/V8 revision and browser artifact.',
    'It pins string-boundary source lines for the Chrome/V8 browser string-limit audit; it is not a throughput proof.',
    '',
    '## Environment',
    '',
    `- Browser: ${report.environment.browserVersion}`,
    `- V8: ${report.environment.v8Version}`,
    `- Repository: ${report.source.repository}`,
    `- Revision: ${report.source.revision}`,
    `- Path: ${report.source.path}`,
    `- Source URL: ${report.source.url}`,
    '',
    '## Derived Boundary',
    '',
    `- String::kMaxLength x64 formula: \`${report.derived.formula}\``,
    `- String::kMaxLength x64 code units: ${formatCount(report.derived.x64MaxStringLengthCodeUnits)}`,
    `- Projected 1024 MiB browser audit code units: ${formatCount(report.derived.projectedBrowserStringLimitAuditCodeUnits)}`,
    `- Projected excess code units: ${formatCount(report.derived.projectedExcessCodeUnits)}`,
    '',
    '## Anchors',
    '',
    '| Anchor | Status | Line |',
    '| --- | --- | ---: |',
  ];

  for (const [key, anchor] of Object.entries(report.anchors)) {
    lines.push(`| ${key} | ${anchor.status} | ${anchor.lineNumber ?? 'n/a'} |`);
  }

  lines.push('');
  lines.push('## Source Context');
  lines.push('');
  for (const [key, anchor] of Object.entries(report.anchors)) {
    lines.push(`### ${key}`);
    lines.push('');
    for (const line of anchor.context) {
      lines.push(`- ${line.lineNumber}: \`${escapeMarkdownCode(line.text.trim())}\``);
    }
    lines.push('');
  }

  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function escapeMarkdownCode(value) {
  return value.replaceAll('`', '\\`');
}

function formatCount(value) {
  return value.toLocaleString('en-US');
}

function writeOutput(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function printSummary(report) {
  console.log('Chrome V8 source pin audit');
  console.log(`revision=${report.source.revision}`);
  for (const [key, anchor] of Object.entries(report.anchors)) {
    console.log(`${key}: ${anchor.status} line=${anchor.lineNumber ?? 'n/a'}`);
  }
}

await main();
