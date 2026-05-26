import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-js-shell-availability-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'firefox-spidermonkey-js-shell-availability-audit.md');
const defaultCandidateNames = [
  'js',
  'js.exe',
  'jsshell',
  'jsshell.exe',
  'spidermonkey',
  'spidermonkey.exe',
  'mozjs',
  'mozjs.exe',
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    candidates: [...defaultCandidateNames],
    envCandidates: ['SPIDERMONKEY_JS_SHELL', 'JSSHELL', 'JS_SHELL'],
    searchRoots: defaultSearchRoots(),
    selfTest: null,
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
      case '--candidates':
        options.candidates = parseList(readValue(), name);
        break;
      case '--search-roots':
        options.searchRoots = parseList(readValue(), name).map(root => resolve(process.cwd(), root));
        break;
      case '--self-test':
        options.selfTest = readValue();
        if (options.selfTest !== 'missing' && options.selfTest !== 'found') {
          throw new Error('--self-test must be missing or found.');
        }
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
  return options;
}

function parseList(value, flag) {
  const parsed = value.split(',').map(item => item.trim()).filter(Boolean);
  if (parsed.length === 0) throw new Error(`${flag} must contain at least one value.`);
  return parsed;
}

function main() {
  const options = parseArgs();
  const report = options.selfTest
    ? createSelfTestReport(options)
    : createReport(options, probeShells(options));
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function probeShells(options) {
  const envProbes = options.envCandidates.map(name => probePath(process.env[name], `env:${name}`));
  const pathProbes = options.candidates.map(command => probeCommand(command));
  const filesystemProbes = options.searchRoots.flatMap(root => probeSearchRoot(root, options.candidates));
  return [...envProbes, ...pathProbes, ...filesystemProbes];
}

function defaultSearchRoots() {
  const roots = [];
  const addRoot = (value) => {
    if (!value) return;
    roots.push(resolve(process.cwd(), value));
  };
  const addFirefoxPathParent = (value) => {
    if (!value) return;
    addRoot(dirname(resolve(process.cwd(), value)));
  };

  addFirefoxPathParent(process.env.FIREFOX_PATH);
  addRoot(process.env.MOZILLA_FIVE_HOME);
  addRoot(process.env.ProgramW6432 ? join(process.env.ProgramW6432, 'Mozilla Firefox') : null);
  addRoot(process.env.ProgramFiles ? join(process.env.ProgramFiles, 'Mozilla Firefox') : null);
  addRoot(process.env['ProgramFiles(x86)'] ? join(process.env['ProgramFiles(x86)'], 'Mozilla Firefox') : null);
  addRoot(process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Mozilla Firefox') : null);

  return [...new Set(roots)];
}

function probeSearchRoot(root, candidates) {
  if (!existsSync(root)) {
    return [{
      source: 'filesystem-root',
      candidate: root,
      status: 'root-missing',
      resolvedPath: root,
    }];
  }
  const stat = statSync(root);
  if (!stat.isDirectory()) {
    return [{
      source: 'filesystem-root',
      candidate: root,
      status: 'root-not-directory',
      resolvedPath: root,
    }];
  }
  return candidates.map(candidate => probePath(join(root, candidate), `filesystem:${root}`));
}

function probePath(filePath, source) {
  if (!filePath) {
    return { source, candidate: null, status: 'not-configured', resolvedPath: null };
  }
  const resolvedPath = resolve(process.cwd(), filePath);
  if (!existsSync(resolvedPath)) {
    return { source, candidate: filePath, status: 'missing', resolvedPath };
  }
  const stat = statSync(resolvedPath);
  if (!stat.isFile()) {
    return { source, candidate: filePath, status: 'not-file', resolvedPath };
  }
  return probeExecutable(resolvedPath, source, filePath);
}

function probeCommand(command) {
  return probeExecutable(command, 'PATH', command);
}

function probeExecutable(command, source, candidate) {
  const result = spawnSync(command, ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
  });
  if (result.error) {
    return {
      source,
      candidate,
      status: result.error.code === 'ENOENT' ? 'missing' : 'spawn-error',
      resolvedPath: command,
      error: result.error.message,
    };
  }
  return {
    source,
    candidate,
    status: result.status === 0 ? 'found' : 'ran-nonzero',
    resolvedPath: command,
    exitCode: result.status,
    stdout: keepShort(String(result.stdout ?? '')),
    stderr: keepShort(String(result.stderr ?? '')),
  };
}

function createSelfTestReport(options) {
  const probes = options.selfTest === 'found'
    ? [{
        source: 'PATH',
        candidate: 'js',
        status: 'found',
        resolvedPath: 'js',
        exitCode: 0,
        stdout: 'JavaScript-C mock shell',
        stderr: '',
      }]
    : options.candidates.map(candidate => ({
        source: 'PATH',
        candidate,
        status: 'missing',
        resolvedPath: candidate,
        error: 'spawn ENOENT',
      }));
  return createReport(options, probes);
}

function createReport(options, probes) {
  const found = probes.filter(probe => probe.status === 'found');
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'firefox-spidermonkey-js-shell-availability-audit',
    contract: 'local-spidermonkey-js-shell-codegen-surface-availability',
    note: 'Checks whether a local SpiderMonkey JavaScript shell is available for follow-up JIT IR or optimized-code diagnostics. This is environment evidence only; absence of a shell is not proof that SpiderMonkey cannot emit codegen evidence elsewhere.',
    environment: {
      platform: `${process.platform}-${process.arch}`,
      pathEntries: String(process.env.PATH ?? '').split(delimiter).filter(Boolean).length,
      searchRootCount: options.searchRoots.length,
    },
    parameters: {
      candidates: options.candidates,
      envCandidates: options.envCandidates,
      searchRoots: options.searchRoots,
      selfTest: options.selfTest,
    },
    outcome: {
      status: found.length > 0 ? 'available' : 'not-found',
      foundCount: found.length,
      foundCandidates: found.map(probe => probe.candidate),
    },
    probes,
  };
  report.findings = createFindings(report);
  return report;
}

function createFindings(report) {
  if (report.outcome.foundCount > 0) {
    return [
      {
        id: 'spidermonkey-js-shell-available',
        classification: 'ENVIRONMENT_FACT',
        summary: 'A local SpiderMonkey JavaScript shell candidate is available for future JIT diagnostic runs.',
        evidence: report.outcome.foundCandidates.map(candidate => `candidate=${candidate}`),
      },
      scopeGuard(),
    ];
  }
  return [
      {
        id: 'spidermonkey-js-shell-not-found',
        classification: 'NEGATIVE_RESULT',
      summary: 'No local SpiderMonkey JavaScript shell candidate was found on PATH, in configured environment variables, or under configured filesystem search roots.',
      evidence: [
        `candidates=${report.parameters.candidates.join(', ')}`,
        `envCandidates=${report.parameters.envCandidates.join(', ')}`,
        `searchRoots=${report.parameters.searchRoots.join(', ') || 'none'}`,
        'This blocks local js-shell JIT IR probing, but it is not evidence that SpiderMonkey has no codegen headroom.',
      ],
    },
    scopeGuard(),
  ];
}

function scopeGuard() {
  return {
    id: 'js-shell-availability-scope',
    classification: 'SCOPE_GUARD',
    summary: 'This audit records local tool availability only; it is not emitted JIT IR, optimized-code, allocation, or throughput evidence.',
    evidence: [
      'A future debug/nightly SpiderMonkey shell or macOS/browser host can still close the codegen proof obligation.',
    ],
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Firefox/SpiderMonkey JS Shell Availability Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Outcome',
    '',
    `- Status: ${report.outcome.status}`,
    `- Found candidates: ${report.outcome.foundCandidates.join(', ') || 'none'}`,
    `- Platform: ${report.environment.platform}`,
    `- Search roots: ${report.parameters.searchRoots.join(', ') || 'none'}`,
    '',
    '## Probes',
    '',
    '| Source | Candidate | Status | Detail |',
    '| --- | --- | --- | --- |',
    ...report.probes.map(probe =>
      `| ${probe.source} | ${probe.candidate ?? 'none'} | ${probe.status} | ${probeDetail(probe)} |`),
    '',
    '## Findings',
    '',
    ...report.findings.flatMap(finding => [
      `- ${finding.id} (${finding.classification}): ${finding.summary}`,
      ...finding.evidence.map(entry => `  - ${entry}`),
    ]),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function probeDetail(probe) {
  return probe.stdout || probe.stderr || probe.error || probe.resolvedPath || '';
}

function keepShort(text) {
  return text.trim().slice(0, 500);
}

function printSummary(report) {
  console.log(`firefox-spidermonkey-js-shell-availability-audit: status=${report.outcome.status} found=${report.outcome.foundCount}`);
}

function writeOutput(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

main();
