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
    safariWebDriver: true,
    webkitRemoteInspector: false,
    entryPoints: [
      harnessEntryPoint('safari smoke harness', 'safari-webdriver-candidate-headroom.mjs'),
      harnessEntryPoint('cross-process browser harness', 'browser-candidate-headroom-cross-process.mjs'),
    ],
    note: 'Current benchmark browser harnesses support Chrome/Edge through CDP, Firefox through built-in WebDriver BiDi, and Safari/WebKit through the safaridriver WebDriver wrapper, including cross-process stability rows, when safaridriver is available.',
  };
  const canRunSafariBrowserRows = isMac && Boolean(availableExecutable) && hasSafaridriver && harnessSupport.safariWebDriver;
  const closureMatrix = createClosureMatrix({
    isMac,
    availableExecutable,
    hasSafaridriver,
    harnessSupport,
    canRunSafariBrowserRows,
  });
  const closureRequirementsMet = closureMatrix.filter(item => item.status === 'met').length;
  const closureRequirementsBlocked = closureMatrix.filter(item => item.status === 'blocked').length;

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
      safariBenchmarkRowsRecorded: false,
      exactSafariBuildIdentityRecorded: false,
      safariSourceBoundaryPinned: false,
      primarySyncByteBatchRowsRecorded: false,
      boundedPrimarySyncByteBatchRowsRecorded: false,
      directReadableStreamRowsAreSeparateEvidence: true,
      closureRequirementsMet,
      closureRequirementsBlocked,
      closesSafariObligation: false,
      openObligationRemains: true,
    },
    closureMatrix,
    findings: createFindings(isMac, availableExecutable, hasSafaridriver, harnessSupport, canRunSafariBrowserRows),
  };
}

function createClosureMatrix({
  isMac,
  availableExecutable,
  hasSafaridriver,
  harnessSupport,
  canRunSafariBrowserRows,
}) {
  return [
    closureRequirement(
      'host-is-macos',
      isMac,
      'Host can run Apple Safari through the normal Safari/safaridriver path.',
      'Current host is not macOS, so this audit cannot produce local Safari browser rows.',
    ),
    closureRequirement(
      'safari-executable-found',
      Boolean(availableExecutable),
      'Safari/WebKit executable is available on the current host.',
      'No Safari/WebKit executable was found on PATH, common install paths, or configured environment variables.',
    ),
    closureRequirement(
      'safaridriver-found',
      hasSafaridriver,
      'safaridriver or an equivalent WebKit WebDriver is available.',
      'No safaridriver/WebKit driver was found.',
    ),
    closureRequirement(
      'harness-supports-safari',
      harnessSupport.safariWebDriver || harnessSupport.webkitRemoteInspector,
      'Repository harness has a Safari/WebKit execution path.',
      'Repository harness does not expose a Safari/WebKit execution path.',
    ),
    closureRequirement(
      'can-run-safari-browser-rows',
      canRunSafariBrowserRows,
      'Current host can run Safari/WebKit browser benchmark rows.',
      'Current host cannot run Safari/WebKit browser benchmark rows.',
    ),
    closureRequirement(
      'safari-benchmark-rows-recorded',
      false,
      'Same-contract Safari/WebKit benchmark rows are recorded.',
      'No Safari/WebKit benchmark row is recorded by this environment audit.',
    ),
    closureRequirement(
      'primary-sync-byte-batch-rows-recorded',
      false,
      'Safari/WebKit primary rows use synchronous Iterable<Uint8Array[]> byte batches.',
      'No Safari/WebKit primary sync byte-batch row is recorded.',
    ),
    closureRequirement(
      'bounded-primary-sync-byte-batch-rows-recorded',
      false,
      'At least one Safari/WebKit primary sync byte-batch row has bounded-memory evidence.',
      'No bounded Safari/WebKit primary sync byte-batch row is recorded.',
    ),
    closureRequirement(
      'exact-build-identity-recorded',
      false,
      'Exact Safari/WebKit build identity is recorded for the tested row.',
      'No exact Safari/WebKit build identity is recorded.',
    ),
    closureRequirement(
      'source-boundary-pinned',
      false,
      'Safari/WebKit string and decoder source boundary is pinned for the tested build.',
      'No Safari/WebKit source boundary is pinned.',
    ),
    closureRequirement(
      'direct-readable-stream-not-substitute',
      true,
      'Direct ReadableStream rows are explicitly scoped as separate source-overhead evidence.',
      'Direct ReadableStream rows could be mistaken for primary byte-batch closure evidence.',
    ),
  ];
}

function closureRequirement(id, ok, met, blocked) {
  return {
    id,
    status: ok ? 'met' : 'blocked',
    summary: ok ? met : blocked,
  };
}

function harnessEntryPoint(label, relativePath) {
  const path = resolve(__dirname, relativePath);
  return {
    label,
    path,
    exists: existsSync(path),
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
    `- Safari benchmark rows recorded: ${formatBoolean(report.summary.safariBenchmarkRowsRecorded)}`,
    `- Exact Safari build identity recorded: ${formatBoolean(report.summary.exactSafariBuildIdentityRecorded)}`,
    `- Safari source boundary pinned: ${formatBoolean(report.summary.safariSourceBoundaryPinned)}`,
    `- Primary sync byte-batch rows recorded: ${formatBoolean(report.summary.primarySyncByteBatchRowsRecorded)}`,
    `- Bounded primary sync byte-batch rows recorded: ${formatBoolean(report.summary.boundedPrimarySyncByteBatchRowsRecorded)}`,
    `- Direct ReadableStream rows are separate evidence: ${formatBoolean(report.summary.directReadableStreamRowsAreSeparateEvidence)}`,
    `- Closure requirements met: ${report.summary.closureRequirementsMet}`,
    `- Closure requirements blocked: ${report.summary.closureRequirementsBlocked}`,
    `- Closes Safari obligation: ${formatBoolean(report.summary.closesSafariObligation)}`,
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
  lines.push('', '## Environment Probes', '', '| Variable | Exists | Value |', '| --- | --- | --- |');
  for (const probe of report.probes.environmentVariables) {
    lines.push(`| ${probe.name} | ${formatBoolean(probe.exists)} | ${probe.value ?? ''} |`);
  }
  lines.push('', '## Harness Scope', '');
  lines.push(report.probes.harnessSupport.note);
  lines.push('', '| Entry point | Exists | Path |', '| --- | --- | --- |');
  for (const entryPoint of report.probes.harnessSupport.entryPoints) {
    lines.push(`| ${entryPoint.label} | ${formatBoolean(entryPoint.exists)} | ${entryPoint.path} |`);
  }
  lines.push('', '## Closure Matrix', '', '| Requirement | Status | Summary |', '| --- | --- | --- |');
  for (const requirement of report.closureMatrix) {
    lines.push(`| \`${requirement.id}\` | ${requirement.status} | ${requirement.summary} |`);
  }
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
