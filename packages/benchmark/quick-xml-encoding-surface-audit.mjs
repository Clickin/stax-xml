import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const quickXmlDir = join(__dirname, 'external', 'quick-xml');
const cargoTomlPath = join(quickXmlDir, 'Cargo.toml');
const quickXmlExe = join(quickXmlDir, 'target', 'release', process.platform === 'win32' ? 'quick_xml_baseline.exe' : 'quick_xml_baseline');
const defaultJsonOut = join(__dirname, 'results', 'release', 'quick-xml-encoding-surface-audit.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'quick-xml-encoding-surface-audit.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    selfTest: false,
    skipBuild: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    if (arg === '--self-test') {
      options.selfTest = true;
      continue;
    }
    if (arg === '--skip-build') {
      options.skipBuild = true;
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
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function main() {
  const options = parseArgs();
  const report = options.selfTest ? createSelfTestReport(options) : runAudit(options);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function createSelfTestReport(options) {
  return createReport({
    options,
    cargoToml: '[dependencies]\nquick-xml = "0.40.1"\n\n[features]\ncount-allocations = []\n',
    cargoTree: 'quick_xml_baseline v1.0.0\n└── quick-xml feature "default"\n    └── quick-xml v0.40.1\n',
    utf16Probe: {
      fixturePath: 'self-test-utf16le.xml',
      exitCode: 1,
      status: 'rejected',
      stdout: '',
      stderr: 'cannot decode input using UTF-8: invalid utf-8 sequence of 1 bytes from index 0',
      error: null,
    },
  });
}

function runAudit(options) {
  if (!options.skipBuild && !existsSync(quickXmlExe)) {
    const build = runCommand('cargo', [
      'build',
      '--release',
      '--manifest-path',
      cargoTomlPath,
    ], repoRoot);
    if (build.error) throw build.error;
    if (build.status !== 0) throw new Error(`quick-xml comparator build failed: ${trimSpawnOutput(build)}`);
  }
  if (!existsSync(quickXmlExe)) {
    throw new Error(`quick-xml comparator binary is missing: ${quickXmlExe}`);
  }

  const cargoToml = readFileSync(cargoTomlPath, 'utf8');
  const cargoTree = runCommandChecked('cargo', [
    'tree',
    '-e',
    'features',
    '--manifest-path',
    cargoTomlPath,
    '--features',
    'count-allocations',
  ], repoRoot);
  const utf16Probe = runUtf16Probe();
  return createReport({ options, cargoToml, cargoTree, utf16Probe });
}

function runUtf16Probe() {
  const dir = mkdtempSync(join(tmpdir(), 'stax-quickxml-encoding-'));
  const fixturePath = join(dir, 'utf16le.xml');
  const utf16Body = Buffer.from(
    '<?xml version="1.0" encoding="UTF-16"?><root><entry id="1">cafe</entry></root>',
    'utf16le',
  );
  writeFileSync(fixturePath, Buffer.concat([Buffer.from([0xff, 0xfe]), utf16Body]));
  const result = runCommand(quickXmlExe, [
    '--file',
    fixturePath,
    '--runs',
    '1',
    '--warmups',
    '0',
  ], repoRoot);
  return {
    fixturePath,
    exitCode: result.status,
    status: result.status === 0 ? 'accepted' : 'rejected',
    stdout: keepShort(String(result.stdout ?? '')),
    stderr: keepShort(String(result.stderr ?? '')),
    error: result.error?.message ?? null,
  };
}

function createReport({ options, cargoToml, cargoTree, utf16Probe }) {
  const quickXmlDependencyLine = cargoToml.split(/\r?\n/).find(line => /^\s*quick-xml\s*=/.test(line)) ?? null;
  const quickXmlFeatureLines = cargoTree.split(/\r?\n/).filter(line => /quick-xml feature/.test(line));
  const hasEncodingFeature = quickXmlFeatureLines.some(line => /"encoding"/.test(line));
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'quick-xml-encoding-surface-audit',
    contract: 'rust-quick-xml-comparator-encoding-surface',
    note: 'Records the current Rust quick-xml comparator feature surface and a non-UTF-8 probe. This is comparator-scope evidence, not a JavaScript runtime benchmark or runtime ceiling proof.',
    environment: {
      platform: `${process.platform}-${process.arch}`,
    },
    comparator: {
      cargoTomlPath,
      quickXmlDependencyLine,
      featureCommand: 'cargo tree -e features --features count-allocations',
      quickXmlFeatureLines,
      hasEncodingFeature,
    },
    utf16Probe,
    options: {
      selfTest: options.selfTest,
      skipBuild: options.skipBuild,
    },
  };
  report.findings = createFindings(report);
  return report;
}

function createFindings(report) {
  return [
    {
      id: 'quick-xml-current-feature-surface',
      classification: 'SOURCE_FACT',
      summary: 'The current comparator uses the quick-xml default feature surface plus the local count-allocations feature; the quick-xml encoding feature is not active.',
      evidence: [
        `dependency=${report.comparator.quickXmlDependencyLine}`,
        `quickXmlFeatureLines=${report.comparator.quickXmlFeatureLines.join(' | ')}`,
        `hasEncodingFeature=${report.comparator.hasEncodingFeature}`,
      ],
    },
    {
      id: 'quick-xml-utf16-probe-rejected',
      classification: report.utf16Probe.status === 'rejected' ? 'NEGATIVE_RESULT' : 'COUNTEREXAMPLE',
      summary: report.utf16Probe.status === 'rejected'
        ? 'Under the current comparator feature surface, a UTF-16 XML probe is rejected before producing a same-contract benchmark row.'
        : 'The current comparator accepted the UTF-16 XML probe; non-UTF-8 allocation counters should be added.',
      evidence: [
        `status=${report.utf16Probe.status}`,
        `exitCode=${report.utf16Probe.exitCode}`,
        `stderr=${report.utf16Probe.stderr || 'none'}`,
      ],
    },
    {
      id: 'encoding-surface-scope',
      classification: 'SCOPE_GUARD',
      summary: 'This audit prevents overclaiming non-UTF-8 quick-xml comparator coverage.',
      evidence: [
        'Do not treat existing quick-xml allocation counters as non-UTF-8 evidence unless the comparator explicitly enables and verifies that feature surface.',
        'This is not JavaScript runtime evidence and not a 200 MiB/s ceiling proof.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# quick-xml Encoding Surface Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Comparator Feature Surface',
    '',
    `- Cargo.toml: ${report.comparator.cargoTomlPath}`,
    `- Dependency line: ${report.comparator.quickXmlDependencyLine ?? 'not found'}`,
    `- Feature command: ${report.comparator.featureCommand}`,
    `- quick-xml encoding feature active: ${report.comparator.hasEncodingFeature ? 'yes' : 'no'}`,
    '',
    '```text',
    report.comparator.quickXmlFeatureLines.join('\n') || 'no quick-xml feature lines found',
    '```',
    '',
    '## UTF-16 Probe',
    '',
    `- Status: ${report.utf16Probe.status}`,
    `- Exit code: ${report.utf16Probe.exitCode}`,
    `- stderr: ${report.utf16Probe.stderr || 'none'}`,
    '',
    '## Findings',
    '',
    ...report.findings.flatMap(finding => [
      `- ${finding.id} (${finding.classification}): ${finding.summary}`,
      ...finding.evidence.map(entry => `  - ${entry}`),
    ]),
    '',
  ];
  return `${lines.join('\n')}`;
}

function runCommandChecked(command, args, cwd) {
  const result = runCommand(command, args, cwd);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${trimSpawnOutput(result)}`);
  return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
}

function runCommand(command, args, cwd) {
  if (process.platform === 'win32' && command === 'cargo') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', formatWindowsCommand(command, args)], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 256 * 1024 * 1024,
    });
  }
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  });
}

function formatWindowsCommand(command, args) {
  return [command, ...args].map(quoteWindowsArg).join(' ');
}

function quoteWindowsArg(value) {
  if (/^[A-Za-z0-9_./:=\\+\-]+$/.test(value)) return value;
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function trimSpawnOutput(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

function keepShort(text) {
  return text.trim().replace(/\s+/g, ' ').slice(0, 500);
}

function writeOutput(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

function printSummary(report) {
  console.log(`quick-xml-encoding-surface-audit: encodingFeature=${report.comparator.hasEncodingFeature} utf16=${report.utf16Probe.status}`);
}

main();
