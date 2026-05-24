import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { cpus, platform, release } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'safari-webkit-availability-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'safari-webkit-availability-audit.md');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
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
  const report = createReport();
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function createReport() {
  const commands = [
    commandProbe('safaridriver'),
    commandProbe('Safari'),
    commandProbe('MiniBrowser'),
    commandProbe('WebKitWebDriver'),
  ];
  const paths = [
    pathProbe('macOS Safari app', '/Applications/Safari.app/Contents/MacOS/Safari'),
    pathProbe('macOS safaridriver', '/usr/bin/safaridriver'),
    pathProbe('Windows legacy Safari app', 'C:\\Program Files\\Safari\\Safari.exe'),
    pathProbe('Windows legacy Safari x86 app', 'C:\\Program Files (x86)\\Safari\\Safari.exe'),
  ];
  const environmentVariables = [
    envProbe('SAFARI_PATH'),
    envProbe('WEBKIT_PATH'),
    envProbe('WEBKIT_BROWSER_PATH'),
    envProbe('PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH'),
  ];
  const availableExecutable = firstAvailable([
    ...commands.map(item => item.resolvedPath),
    ...paths.filter(item => item.exists).map(item => item.path),
    ...environmentVariables.filter(item => item.exists).map(item => item.value),
  ]);
  const isMac = platform() === 'darwin';
  const hasSafaridriver = commands.some(item => item.name === 'safaridriver' && item.found)
    || paths.some(item => item.label === 'macOS safaridriver' && item.exists);
  const harnessSupport = {
    chromiumCdp: true,
    firefoxBidi: true,
    firefoxBidiTextDecoder: true,
    safariWebDriver: false,
    webkitRemoteInspector: false,
    note: 'Current benchmark browser harnesses support Chrome/Edge through CDP and Firefox through built-in WebDriver BiDi; no Safari/WebKit harness path is implemented.',
  };
  const canRunSafariBrowserRows = isMac && Boolean(availableExecutable) && hasSafaridriver && harnessSupport.safariWebDriver;

  return {
    generatedAt: new Date().toISOString(),
    objective: 'safari-webkit-availability-audit',
    contract: 'local-safari-webkit-browser-row-availability',
    note: 'ENVIRONMENT_FACT_LIMIT evidence for the current host and repository harness. It does not benchmark Safari/WebKit and does not prove Safari/WebKit cannot be a counterexample elsewhere.',
    environment: {
      runtimeName: 'browser',
      browserName: 'Safari/WebKit',
      javascriptEngine: 'JavaScriptCore',
      hostPlatform: `${platform()}-${process.arch}`,
      osRelease: release(),
      cpuName: cpus()[0]?.model ?? 'unknown',
    },
    probes: {
      commands,
      paths,
      environmentVariables,
      harnessSupport,
    },
    summary: {
      hostIsMacOS: isMac,
      safariExecutableFound: Boolean(availableExecutable),
      safariExecutablePath: availableExecutable,
      safaridriverFound: hasSafaridriver,
      currentHarnessSupportsSafari: harnessSupport.safariWebDriver || harnessSupport.webkitRemoteInspector,
      canRunSafariBrowserRows,
      openObligationRemains: true,
    },
    findings: createFindings(isMac, availableExecutable, hasSafaridriver, harnessSupport, canRunSafariBrowserRows),
  };
}

function commandProbe(name) {
  const resolvedPath = resolveCommand(name);
  return {
    name,
    found: Boolean(resolvedPath),
    resolvedPath,
  };
}

function resolveCommand(name) {
  const command = platform() === 'win32' ? 'where.exe' : 'command';
  const args = platform() === 'win32' ? [name] : ['-v', name];
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: platform() !== 'win32',
  });
  if (result.status !== 0) return null;
  const first = String(result.stdout ?? '').split(/\r?\n/).map(line => line.trim()).find(Boolean);
  return first ?? null;
}

function pathProbe(label, path) {
  return {
    label,
    path,
    exists: existsSync(path),
  };
}

function envProbe(name) {
  const value = process.env[name] || null;
  return {
    name,
    value,
    exists: Boolean(value && existsSync(value)),
  };
}

function createFindings(isMac, availableExecutable, hasSafaridriver, harnessSupport, canRunSafariBrowserRows) {
  const findings = [
    {
      id: 'local-host-platform',
      classification: 'ENVIRONMENT_FACT_LIMIT',
      summary: isMac
        ? 'Current host is macOS, so Safari/WebKit row execution may be possible if Safari, safaridriver, and a harness path are available.'
        : 'Current host is not macOS, so Apple Safari browser rows are not locally runnable through the normal Safari/safaridriver path.',
    },
    {
      id: 'local-safari-executable',
      classification: availableExecutable ? 'ENVIRONMENT_FACT_LIMIT' : 'OPEN',
      summary: availableExecutable
        ? `A local Safari/WebKit-like executable was found at ${availableExecutable}.`
        : 'No local Safari/WebKit executable was found through PATH, common install paths, or explicit environment variables.',
    },
    {
      id: 'local-safaridriver',
      classification: hasSafaridriver ? 'ENVIRONMENT_FACT_LIMIT' : 'OPEN',
      summary: hasSafaridriver
        ? 'A local safaridriver/WebKit driver command or path was found.'
        : 'No local safaridriver/WebKit driver path was found.',
    },
    {
      id: 'repo-harness-support',
      classification: harnessSupport.safariWebDriver || harnessSupport.webkitRemoteInspector ? 'ENVIRONMENT_FACT_LIMIT' : 'OPEN',
      summary: harnessSupport.note,
    },
    {
      id: 'safari-row-obligation-remains',
      classification: canRunSafariBrowserRows ? 'READY' : 'OPEN',
      summary: canRunSafariBrowserRows
        ? 'The local environment appears ready for Safari/WebKit row implementation, but no row has been recorded by this audit.'
        : 'Safari/WebKit browser rows remain unrecorded; this audit only explains the local gap and is not a substitute for same-contract rows.',
    },
  ];
  return findings;
}

function renderMarkdown(report) {
  const lines = [
    '# Safari/WebKit Availability Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    report.note,
    '',
    '## Summary',
    '',
    `- Host platform: ${report.environment.hostPlatform}`,
    `- Host is macOS: ${formatBoolean(report.summary.hostIsMacOS)}`,
    `- Safari executable found: ${formatBoolean(report.summary.safariExecutableFound)}`,
    `- Safari executable path: ${report.summary.safariExecutablePath ?? 'none'}`,
    `- safaridriver found: ${formatBoolean(report.summary.safaridriverFound)}`,
    `- Current harness supports Safari/WebKit: ${formatBoolean(report.summary.currentHarnessSupportsSafari)}`,
    `- Can run Safari browser rows now: ${formatBoolean(report.summary.canRunSafariBrowserRows)}`,
    `- Open obligation remains: ${formatBoolean(report.summary.openObligationRemains)}`,
    '',
    '## Command Probes',
    '',
    '| Command | Found | Resolved path |',
    '| --- | --- | --- |',
  ];
  for (const probe of report.probes.commands) {
    lines.push(`| ${probe.name} | ${formatBoolean(probe.found)} | ${probe.resolvedPath ?? ''} |`);
  }
  lines.push('', '## Path Probes', '', '| Label | Exists | Path |', '| --- | --- | --- |');
  for (const probe of report.probes.paths) {
    lines.push(`| ${probe.label} | ${formatBoolean(probe.exists)} | ${probe.path} |`);
  }
  lines.push('', '## Harness Scope', '');
  lines.push(report.probes.harnessSupport.note);
  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id} (${finding.classification}): ${finding.summary}`);
  }
  lines.push(
    '',
    '## Scope Limits',
    '',
    '- This is an environment availability audit, not a benchmark row.',
    '- This does not prove Safari/WebKit cannot exceed any throughput threshold.',
    '- A future Safari/WebKit row must still use the same full-string contract and counterexample scanner.',
    '',
  );
  return `${lines.join('\n')}`;
}

function firstAvailable(values) {
  return values.find(value => typeof value === 'string' && value.length > 0) ?? null;
}

function formatBoolean(value) {
  return value ? 'yes' : 'no';
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(`safari-webkit-availability-audit: canRunSafariBrowserRows=${report.summary.canRunSafariBrowserRows}`);
}

main();
