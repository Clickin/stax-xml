import { spawnSync } from 'node:child_process';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const quickXmlDir = join(__dirname, 'external', 'quick-xml');
const comparatorSrc = join(quickXmlDir, 'src', 'main.rs');
const defaultExternalBaseline = join(__dirname, 'results', 'release', 'external-baseline.json');
const defaultJsonOut = join(__dirname, 'results', 'release', 'quick-xml-shape-audit.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'quick-xml-shape-audit.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    externalBaseline: defaultExternalBaseline,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    if (arg === '--self-test') {
      options.selfTest = true;
      continue;
    }
    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} requires a value.`);
      index++;
      return value;
    };

    switch (name) {
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      case '--external-baseline':
        options.externalBaseline = resolve(process.cwd(), readValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function main() {
  const options = parseArgs();
  const report = options.selfTest ? createSelfTestReport() : createReport(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  console.log(`Wrote ${options.jsonOut}`);
  console.log(`Wrote ${options.mdOut}`);
}

function createSelfTestReport() {
  const sources = {
    comparator: {
      path: 'self-test/main.rs',
      text: `
let mut reader = Reader::from_reader(BufReader::with_capacity(1024 * 1024, file));
let mut buffer = Vec::with_capacity(64 * 1024);
match reader.read_event_into(&mut buffer)? {
  Event::Start(event) => {
    fold_bytes(checksum, event.name().as_ref())?;
    let mut collected = Vec::new();
    for attr in event.attributes().with_checks(false) {
      collected.push(attr?);
    }
    for attr in collected {
      fold_bytes(checksum, attr.key.as_ref())?;
      fold_bytes(checksum, attr.value.as_ref())?;
    }
  }
  Event::Text(event) => {
    let text = event.decode()?;
    fold_text_event(checksum, &text, 4, &mut event_count);
  }
  _ => {}
}
buffer.clear();
for unit in value.encode_utf16() {}
`,
    },
    quickXml: {
      root: 'self-test/quick-xml-0.40.1',
      version: '0.40.1',
      files: {
        eventsMod: `
pub struct BytesStart<'a> { pub(crate) buf: Cow<'a, [u8]> }
pub struct BytesText<'a> { content: Cow<'a, [u8]> }
impl<'a> BytesText<'a> { pub fn decode(&self) -> Result<Cow<'a, str>, EncodingError> { todo!() } }
pub enum Event<'a> { Start(BytesStart<'a>), Text(BytesText<'a>) }
`,
        attributes: `pub struct Attribute<'a> { pub value: Cow<'a, [u8]> }`,
        bufferedReader: `pub fn read_event_into<'b>(&mut self, buf: &'b mut Vec<u8>) -> Result<Event<'b>> { todo!() }`,
        readerMod: `memchr::memchr_iter(b'>', chunk);`,
        encoding: `pub fn decode<'b>(&self, bytes: &'b [u8]) -> Result<Cow<'b, str>, EncodingError> { todo!() }`,
      },
    },
  };
  return buildReport({
    generatedAt: 'self-test',
    environment: {
      rustc: 'rustc self-test',
      cargo: 'cargo self-test',
      cpuName: 'self-test',
      platform: 'self-test',
    },
    metadata: {
      quickXmlVersion: '0.40.1',
      quickXmlSource: 'self-test/quick-xml-0.40.1',
      comparatorSource: 'self-test/main.rs',
    },
    baseline: {
      source: 'self-test',
      quickXml: {
        mibPerSec: 300,
        eventCount: 967967,
        checksum: -746772258,
        woodstoxRatio: 0.91,
        targetStatus: 'met',
      },
    },
    sources,
  });
}

function createReport(options) {
  const metadata = readCargoMetadata();
  const quickXmlPackage = metadata.packages.find(pkg => pkg.name === 'quick-xml');
  if (!quickXmlPackage) throw new Error('quick-xml package was not found in cargo metadata.');

  const quickXmlSrcDir = dirname(quickXmlPackage.targets[0].src_path);
  const sources = {
    comparator: {
      path: comparatorSrc,
      text: readRequiredFile(comparatorSrc),
    },
    quickXml: {
      root: dirname(quickXmlSrcDir),
      version: quickXmlPackage.version,
      files: {
        eventsMod: readRequiredFile(join(quickXmlSrcDir, 'events', 'mod.rs')),
        attributes: readRequiredFile(join(quickXmlSrcDir, 'events', 'attributes.rs')),
        bufferedReader: readRequiredFile(join(quickXmlSrcDir, 'reader', 'buffered_reader.rs')),
        readerMod: readRequiredFile(join(quickXmlSrcDir, 'reader', 'mod.rs')),
        encoding: readRequiredFile(join(quickXmlSrcDir, 'encoding.rs')),
      },
    },
  };

  return buildReport({
    generatedAt: new Date().toISOString(),
    environment: {
      rustc: firstLine(runCommand('rustc', ['--version'], repoRoot)),
      cargo: firstLine(runCommand('cargo', ['--version'], repoRoot)),
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
    },
    metadata: {
      quickXmlVersion: quickXmlPackage.version,
      quickXmlSource: dirname(quickXmlSrcDir),
      comparatorSource: comparatorSrc,
    },
    baseline: readExternalBaseline(options.externalBaseline),
    sources,
  });
}

function buildReport({ generatedAt, environment, metadata, baseline, sources }) {
  const checks = analyzeSources(sources);
  return {
    generatedAt,
    objective: 'quick-xml-shape-audit',
    contract: 'source-shape-audit',
    note: 'Source-level shape audit for Rust + quick-xml comparator. This is not an allocation profile or machine-code trace.',
    environment,
    metadata,
    baseline,
    checks,
    findings: createFindings(checks, baseline),
  };
}

function analyzeSources(sources) {
  const comparator = sources.comparator.text;
  const quick = sources.quickXml.files;
  const allQuickXml = Object.values(quick).join('\n');
  const checks = [
    {
      id: 'comparator-reuses-read-buffer',
      label: 'Comparator reuses one reader buffer',
      supported: /read_event_into\(&mut buffer\)/.test(comparator) && /buffer\.clear\(\)/.test(comparator),
      evidence: ['read_event_into(&mut buffer)', 'buffer.clear()'],
    },
    {
      id: 'quick-xml-event-lifetime-tied-to-buffer',
      label: 'quick-xml read_event_into returns events tied to caller buffer lifetime',
      supported: /pub fn read_event_into<'b>\(&mut self, buf: &'b mut Vec<u8>\) -> Result<Event<'b>>/.test(quick.bufferedReader),
      evidence: ['Reader::read_event_into<\'b>(&mut self, buf: &\'b mut Vec<u8>) -> Result<Event<\'b>>'],
    },
    {
      id: 'event-storage-is-cow-bytes',
      label: 'quick-xml event structs store Cow byte slices',
      supported: /pub struct BytesStart<'a>[\s\S]*buf:\s*Cow<'a, \[u8\]>/.test(quick.eventsMod)
        && /pub struct BytesText<'a>[\s\S]*content:\s*Cow<'a, \[u8\]>/.test(quick.eventsMod)
        && /pub value:\s*Cow<'a, \[u8\]>/.test(quick.attributes),
      evidence: ['BytesStart Cow<[u8]>', 'BytesText Cow<[u8]>', 'Attribute value Cow<[u8]>'],
    },
    {
      id: 'names-and-attributes-fold-bytes',
      label: 'Comparator folds names and attribute values from byte views',
      supported: /event\.name\(\)\.as_ref\(\)/.test(comparator)
        && /attr\.key\.as_ref\(\)/.test(comparator)
        && /attr\.value\.as_ref\(\)/.test(comparator),
      evidence: ['event.name().as_ref()', 'attr.key.as_ref()', 'attr.value.as_ref()'],
    },
    {
      id: 'attributes-materialized-as-vec',
      label: 'Comparator materializes each start tag attribute iterator into a Vec',
      supported: /let mut collected = Vec::new\(\);[\s\S]*collected\.push\(attr\?\);/.test(comparator),
      evidence: ['let mut collected = Vec::new()', 'collected.push(attr?)'],
    },
    {
      id: 'text-decodes-to-cow-str',
      label: 'Text and CDATA path decodes to Cow<str>',
      supported: /event\.decode\(\)\?/.test(comparator)
        && /pub fn decode\(&self\) -> Result<Cow<'a, str>, EncodingError>/.test(quick.eventsMod)
        && /pub fn decode<'b>\(&self, bytes: &'b \[u8\]\) -> Result<Cow<'b, str>, EncodingError>/.test(quick.encoding),
      evidence: ['event.decode()?', 'BytesText::decode -> Cow<str>', 'Decoder::decode -> Cow<str>'],
    },
    {
      id: 'checksum-uses-utf16-units',
      label: 'Rust checksum folds UTF-16 code units like JS string charCodeAt',
      supported: /encode_utf16\(\)/.test(comparator),
      evidence: ['value.encode_utf16()'],
    },
    {
      id: 'quick-xml-uses-memchr-scanning',
      label: 'quick-xml reader source uses memchr byte scanning',
      supported: /memchr::memchr/.test(allQuickXml),
      evidence: ['memchr::memchr* in reader source'],
    },
  ];

  return {
    allSupported: checks.every(check => check.supported),
    items: checks,
    missing: checks.filter(check => !check.supported).map(check => check.id),
  };
}

function createFindings(checks, baseline) {
  const findings = [
    {
      id: 'same-contract-result',
      classification: baseline.quickXml ? 'BENCH_FACT' : 'MISSING_BENCH_FACT',
      summary: baseline.quickXml
        ? 'Existing external baseline records quick-xml under the same full-string checksum contract.'
        : 'No quick-xml external baseline row was available to attach to this audit.',
      evidence: baseline.quickXml ? [
        `throughput=${baseline.quickXml.mibPerSec.toFixed(1)} MiB/s`,
        `woodstoxRatio=${baseline.quickXml.woodstoxRatio?.toFixed(2) ?? 'n/a'}x`,
        `events=${baseline.quickXml.eventCount}`,
        `checksum=${baseline.quickXml.checksum}`,
      ] : ['Run bench:external-baseline with quick-xml enabled.'],
    },
    {
      id: 'not-js-object-shape',
      classification: 'SOURCE_FACT',
      summary: 'quick-xml comparator uses Rust enum events, borrowed byte views, Cow strings, and a reused buffer rather than JS public event objects.',
      evidence: evidenceFor(checks, [
        'quick-xml-event-lifetime-tied-to-buffer',
        'event-storage-is-cow-bytes',
        'comparator-reuses-read-buffer',
      ]),
    },
    {
      id: 'attribute-vector-materialization',
      classification: 'SOURCE_FACT',
      summary: 'The current Rust comparator still materializes attributes into a Vec before folding so it can mix the attribute count first.',
      evidence: evidenceFor(checks, ['attributes-materialized-as-vec']),
    },
    {
      id: 'text-cow-boundary',
      classification: 'SOURCE_FACT',
      summary: 'Text and CDATA call quick-xml decode and receive Cow<str>; source audit alone does not prove borrowed-vs-owned frequency.',
      evidence: evidenceFor(checks, ['text-decodes-to-cow-str']),
    },
    {
      id: 'allocation-not-covered-by-source-audit',
      classification: 'MISSING_TRACE_FACT',
      summary: 'This source audit is not an allocation profile, machine-code trace, or proof of runtime allocation counts.',
      evidence: ['Use quick-xml-allocation-count.md for measured allocator counters; stack/type attribution and Cow borrowed-vs-owned frequency still require separate evidence.'],
    },
  ];

  if (!checks.allSupported) {
    findings.push({
      id: 'source-pattern-missing',
      classification: 'AUDIT_WARNING',
      summary: 'One or more expected source patterns were not found.',
      evidence: checks.missing,
    });
  }

  return findings;
}

function evidenceFor(checks, ids) {
  return ids.flatMap((id) => {
    const check = checks.items.find(item => item.id === id);
    return check ? check.evidence.map(entry => `${check.id}: ${entry}`) : [`${id}: missing check`];
  });
}

function readCargoMetadata() {
  const output = runCommand('cargo', [
    'metadata',
    '--manifest-path',
    join(quickXmlDir, 'Cargo.toml'),
    '--format-version',
    '1',
  ], repoRoot);
  return JSON.parse(output);
}

function readExternalBaseline(path) {
  if (!existsSync(path)) {
    return {
      source: path,
      quickXml: null,
      woodstox: null,
    };
  }
  const report = JSON.parse(readFileSync(path, 'utf8'));
  return {
    source: path,
    generatedAt: report.generatedAt,
    fixture: report.fixture,
    options: report.options,
    quickXml: report.results.find(result => result.tool === 'quick-xml' && result.status === 'ok') ?? null,
    woodstox: report.results.find(result => result.tool === 'woodstox' && result.status === 'ok') ?? null,
  };
}

function renderMarkdown(report) {
  const lines = [
    '# quick-xml Shape Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report is a SOURCE_FACT for the Rust + quick-xml comparator shape.',
    'It is not an allocation profile, machine-code trace, or proof that JavaScript runtime headroom is exhausted.',
    '',
    '## Environment',
    '',
    `- Rust: ${report.environment.rustc}`,
    `- Cargo: ${report.environment.cargo}`,
    `- Platform: ${report.environment.platform}`,
    `- CPU: ${report.environment.cpuName}`,
    `- Comparator source: ${report.metadata.comparatorSource}`,
    `- quick-xml version: ${report.metadata.quickXmlVersion}`,
    `- quick-xml source: ${report.metadata.quickXmlSource}`,
    '',
    '## Baseline Anchor',
    '',
  ];

  if (report.baseline.quickXml) {
    lines.push('| Tool | Throughput | Woodstox ratio | Events | Checksum | Target |');
    lines.push('| --- | ---: | ---: | ---: | ---: | --- |');
    lines.push(`| quick-xml | ${report.baseline.quickXml.mibPerSec.toFixed(1)} MiB/s | ${formatRatio(report.baseline.quickXml.woodstoxRatio)} | ${report.baseline.quickXml.eventCount} | ${report.baseline.quickXml.checksum} | ${report.baseline.quickXml.targetStatus} |`);
  } else {
    lines.push('No quick-xml external baseline row was available.');
  }

  lines.push('');
  lines.push('## Source Checks');
  lines.push('');
  lines.push('| Check | Supported | Evidence |');
  lines.push('| --- | --- | --- |');
  for (const check of report.checks.items) {
    lines.push(`| ${check.id} | ${check.supported ? 'yes' : 'no'} | ${check.evidence.map(escapePipe).join('<br>')} |`);
  }

  lines.push('');
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

function formatRatio(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}x` : 'n/a';
}

function escapePipe(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function runCommand(command, args, cwd) {
  const result = process.platform === 'win32' && (command === 'cargo' || command === 'rustc')
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', formatWindowsCommand(command, args)], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    })
    : spawnSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${String(result.stderr || result.stdout).trim()}`);
  }
  return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
}

function formatWindowsCommand(command, args) {
  return [command, ...args].map(quoteWindowsArg).join(' ');
}

function quoteWindowsArg(value) {
  if (/^[A-Za-z0-9_./:=\\+\-]+$/.test(value)) {
    return value;
  }
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function readRequiredFile(path) {
  if (!existsSync(path)) throw new Error(`Missing source file: ${path}`);
  return readFileSync(path, 'utf8');
}

function writeOutput(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

function firstLine(text) {
  return String(text).split(/\r?\n/).find(Boolean) ?? 'unknown';
}

main();
