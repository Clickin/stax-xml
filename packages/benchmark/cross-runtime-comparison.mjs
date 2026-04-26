import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { cpus } from 'node:os';
import { basename, delimiter, dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultFile = join(__dirname, 'test-data', 'runtime-comparison-16mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'cross-runtime-comparison.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'cross-runtime-comparison.md');
const woodstoxDir = join(__dirname, 'external', 'woodstox');
const quickXmlDir = join(__dirname, 'external', 'quick-xml-bench');
const simdXmlDir = join(__dirname, 'external', 'simdxml-bench');
const nodeStringReturnPath = join(__dirname, 'node-string-return.mjs');
const nativeAggregatePackageJsonPath = join(__dirname, '..', 'native-aggregate', 'package.json');
const DEFAULT_SIMDXML_MAX_MIB = 64;

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    runs: 3,
    warmups: 1,
    tiers: ['count-only', 'name-string-only', 'text-string-only', 'attr-value-string-only', 'full-string'],
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    skipBuild: false,
    skipJava25: false,
    fileExplicit: false,
    simdxmlMaxMiB: DEFAULT_SIMDXML_MAX_MIB,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg === '--') continue;
    if (arg === '--skip-build') {
      options.skipBuild = true;
      continue;
    }
    if (arg === '--skip-java25') {
      options.skipJava25 = true;
      continue;
    }

    const [name, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error(`${arg} requires a value.`);
      }
      index++;
      return value;
    };

    switch (name) {
      case '--file':
        options.file = resolve(process.cwd(), readValue());
        options.fileExplicit = true;
        break;
      case '--runs':
        options.runs = parsePositiveInteger(readValue(), '--runs');
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), '--warmups');
        break;
      case '--tiers':
        options.tiers = readValue().split(',').map(value => value.trim()).filter(Boolean);
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      case '--simdxml-max-mib':
        options.simdxmlMaxMiB = parsePositiveNumber(readValue(), '--simdxml-max-mib');
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!existsSync(options.file) && !options.fileExplicit) {
    generateXmlFile(options.file, 16 * 1024 * 1024);
  }
  if (!existsSync(options.file)) {
    throw new Error(`Benchmark fixture does not exist: ${options.file}`);
  }
  return options;
}

function generateXmlFile(filePath, targetBytes) {
  mkdirSync(dirname(filePath), { recursive: true });
  const fd = openSync(filePath, 'w');
  const header = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<root>\n');
  const footer = Buffer.from('</root>\n');
  const pending = [];
  let pendingBytes = 0;
  let written = 0;
  let id = 0;

  try {
    writeSync(fd, header);
    written += header.byteLength;
    while (written + pendingBytes + footer.byteLength < targetBytes) {
      const element = Buffer.from(
        `  <book id="book-${id}" lang="en" code="${id % 97}">` +
          `<title>Runtime Benchmark ${id}</title>` +
          `<author>Author ${id % 4096}</author>` +
          `<description>Full string checksum text payload ${id} with stable words and numbers.</description>` +
          `<chapter number="1">Intro ${id}</chapter>` +
          `<chapter number="2">Body ${id}</chapter>` +
        '</book>\n',
      );
      if (written + pendingBytes + element.byteLength + footer.byteLength > targetBytes) {
        break;
      }
      pending.push(element);
      pendingBytes += element.byteLength;
      id++;
      if (pendingBytes >= 1024 * 1024) {
        writeSync(fd, Buffer.concat(pending, pendingBytes));
        written += pendingBytes;
        pending.length = 0;
        pendingBytes = 0;
      }
    }
    if (pendingBytes > 0) {
      writeSync(fd, Buffer.concat(pending, pendingBytes));
    }
    writeSync(fd, footer);
  } finally {
    closeSync(fd);
  }
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }
  return parsed;
}

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive number.`);
  }
  return parsed;
}

function run(command, args, options = {}) {
  const useCmd = process.platform === 'win32' && command === 'mvn';
  const resolvedCommand = useCmd ? 'cmd.exe' : command;
  const resolvedArgs = useCmd
    ? ['/d', '/s', '/c', ['mvn', ...args].map(quoteWindowsShellArg).join(' ')]
    : args;
  const result = spawnSync(resolvedCommand, resolvedArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${resolvedCommand} ${resolvedArgs.join(' ')}\n${result.stderr.trim() || result.stdout.trim()}`,
    );
  }
  return result;
}

function quoteWindowsShellArg(value) {
  if (!/[ \t"&|<>^]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

function buildExternalTools(options) {
  if (!options.skipBuild) {
    run('mvn', [
      '-q',
      '-f',
      join(woodstoxDir, 'pom.xml'),
      '-DskipTests',
      'package',
      'dependency:build-classpath',
      `-Dmdep.outputFile=${join(woodstoxDir, 'target', 'classpath.txt')}`,
    ]);
    run('cargo', [
      'build',
      '--manifest-path',
      join(quickXmlDir, 'Cargo.toml'),
      '--release',
      '--locked',
    ]);
    run('cargo', [
      'build',
      '--manifest-path',
      join(simdXmlDir, 'Cargo.toml'),
      '--release',
      '--locked',
    ]);
  }

  const classpathFile = join(woodstoxDir, 'target', 'classpath.txt');
  const depsClasspath = readFileSync(classpathFile, 'utf8').trim();
  const woodstoxClasspath = [
    join(woodstoxDir, 'target', 'classes'),
    depsClasspath,
  ].filter(Boolean).join(delimiter);

  const quickXmlExe = join(
    quickXmlDir,
    'target',
    'release',
    process.platform === 'win32' ? 'quick-xml-bench.exe' : 'quick-xml-bench',
  );
  const simdXmlExe = join(
    simdXmlDir,
    'target',
    'release',
    process.platform === 'win32' ? 'simdxml-bench.exe' : 'simdxml-bench',
  );

  return {
    java8: findJava8(),
    java25: options.skipJava25 ? undefined : findJava25(),
    woodstoxClasspath,
    quickXmlExe,
    simdXmlExe,
  };
}

function findJava8() {
  if (process.env.STAX_XML_JAVA8) return process.env.STAX_XML_JAVA8;
  if (process.env.STAX_XML_JAVA8_HOME) return join(process.env.STAX_XML_JAVA8_HOME, 'bin', javaExeName());
  return 'java';
}

function findJava25() {
  if (process.env.STAX_XML_JAVA25) return process.env.STAX_XML_JAVA25;
  if (process.env.STAX_XML_JAVA25_HOME) return join(process.env.STAX_XML_JAVA25_HOME, 'bin', javaExeName());

  const candidates = [
    'C:\\sdkman\\candidates\\java\\25.0.1-tem\\bin\\java.exe',
    'C:\\sdkman\\candidates\\java\\25-zulu\\bin\\java.exe',
    '/usr/lib/jvm/java-25-openjdk/bin/java',
  ];
  return candidates.find(candidate => existsSync(candidate));
}

function javaExeName() {
  return process.platform === 'win32' ? 'java.exe' : 'java';
}

function quoteCommandPart(value) {
  if (!/[ "';&|<>]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

function woodstoxCommand(javaExe, classpath) {
  return [
    quoteCommandPart(javaExe),
    '-cp',
    quoteCommandPart(classpath),
    'com.staxxml.bench.WoodstoxBench',
  ].join(' ');
}

function quickXmlCommand(exe) {
  return quoteCommandPart(exe);
}

function simdXmlCommand(exe) {
  return quoteCommandPart(exe);
}

function runNodeStringReturn(options, tools) {
  const rawOut = join(dirname(options.jsonOut), 'raw', 'cross-runtime-node-string-return.json');
  mkdirSync(dirname(rawOut), { recursive: true });
  run(process.execPath, [
    '--expose-gc',
    nodeStringReturnPath,
    '--file',
    options.file,
    '--runs',
    String(options.runs),
    '--warmups',
    String(options.warmups),
    '--tiers',
    options.tiers.join(','),
    '--woodstox-cmd',
    woodstoxCommand(tools.java8, tools.woodstoxClasspath),
    '--quick-xml-cmd',
    quickXmlCommand(tools.quickXmlExe),
    '--simdxml-cmd',
    simdXmlCommand(tools.simdXmlExe),
    '--simdxml-max-mib',
    String(options.simdxmlMaxMiB),
    '--json-out',
    rawOut,
  ], { stdio: 'inherit' });

  return {
    rawOut,
    report: JSON.parse(readFileSync(rawOut, 'utf8')),
  };
}

function runExternalCommand(command, file, tier, runs, warmups) {
  const result = spawnSync(command, [], {
    shell: true,
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      STAX_XML_BENCH_FILE: file,
      STAX_XML_BENCH_TIER: tier,
      STAX_XML_BENCH_RUNS: String(runs),
      STAX_XML_BENCH_WARMUPS: String(warmups),
      STAX_XML_BENCH_CONTRACT: 'namespace-off,skip-decl-comment-pi-doctype,cdata-event,skip-whitespace-text,trim-text-checksum,entity-decode-off',
    },
  });
  if (result.error) {
    return { status: 'skipped', reason: result.error.message };
  }
  if (result.status !== 0) {
    return {
      status: 'failed',
      reason: result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`,
    };
  }
  return {
    status: 'ok',
    ...JSON.parse(result.stdout),
  };
}

function nativeTierForComparatorTier(tier) {
  if (tier === 'count-only') return 'count-only';
  if (tier === 'name-string-only') return 'name-string-only';
  if (tier === 'text-string-only') return 'text-string-only';
  if (tier === 'attr-value-string-only') return 'attr-value-string-only';
  if (tier === 'full-string') return 'full-string-direct';
  return null;
}

function normalizeNativeAggregateResult(result) {
  return {
    eventCount: result.eventCount ?? result.event_count,
    checksum: result.checksum,
    attrCountTotal: result.attrCountTotal ?? result.attr_count_total,
    objectCount: result.objectCount ?? result.object_count ?? 0,
  };
}

async function measureNativeAddon(options) {
  let native;
  try {
    native = await import('@stax-xml/native-aggregate-probe');
  } catch (error) {
    return {
      status: 'skipped',
      reason: error instanceof Error ? error.message : String(error),
      tiers: options.tiers.map(tier => ({
        tier,
        id: 'stax-xml-native-addon-js-wrapper',
        status: 'skipped',
        reason: '@stax-xml/native-aggregate-probe could not be loaded.',
      })),
      fileTiers: options.tiers.map(tier => ({
        tier,
        id: 'stax-xml-native-addon-file',
        status: 'skipped',
        reason: '@stax-xml/native-aggregate-probe could not be loaded.',
      })),
    };
  }

  const fileSizeMiB = statSync(options.file).size / 1024 / 1024;
  const input = readFileSync(options.file);
  const tiers = measureNativeAddonTiers({
    id: 'stax-xml-native-addon-buffer',
    fileSizeMiB,
    tiers: options.tiers,
    warmups: options.warmups,
    runs: options.runs,
    invoke: nativeTier => native.parse_aggregate_buffer(input, nativeTier),
  });
  const fileTiers = measureNativeAddonTiers({
    id: 'stax-xml-native-addon-file',
    fileSizeMiB,
    tiers: options.tiers,
    warmups: options.warmups,
    runs: options.runs,
    invoke: nativeTier => native.parse_aggregate_file(options.file, nativeTier),
  });

  return {
    status: tiers.every(entry => entry.status === 'ok') && fileTiers.every(entry => entry.status === 'ok') ? 'ok' : 'partial',
    packageName: '@stax-xml/native-aggregate-probe',
    entrypoint: '@stax-xml/native-aggregate-probe JS module',
    tiers,
    fileTiers,
  };
}

function measureNativeAddonTiers({ id, fileSizeMiB, tiers, warmups, runs, invoke }) {
  return tiers.map(tier => {
    const nativeTier = nativeTierForComparatorTier(tier);
    if (!nativeTier) {
      return {
        tier,
        nativeTier: null,
        id,
        status: 'not-supported',
        reason: `Current native aggregate probe does not define a tier for ${tier}.`,
      };
    }

    for (let index = 0; index < warmups; index++) {
      invoke(nativeTier);
    }

    const samplesMs = [];
    let eventCount = 0;
    let checksum = 0;
    let attrCountTotal = 0;
    let objectCount = 0;
    for (let index = 0; index < runs; index++) {
      if (globalThis.gc) globalThis.gc();
      const startedAt = performance.now();
      const result = normalizeNativeAggregateResult(invoke(nativeTier));
      const elapsedMs = performance.now() - startedAt;
      if (index > 0 && (result.eventCount !== eventCount || result.checksum !== checksum)) {
        throw new Error(`${id} ${tier} produced unstable event count or checksum between runs.`);
      }
      eventCount = result.eventCount;
      checksum = result.checksum;
      attrCountTotal = result.attrCountTotal;
      objectCount = result.objectCount;
      samplesMs.push(elapsedMs);
    }

    const avgMs = samplesMs.reduce((sum, value) => sum + value, 0) / samplesMs.length;
    return {
      tier,
      nativeTier,
      id,
      status: 'ok',
      avgMs,
      minMs: Math.min(...samplesMs),
      maxMs: Math.max(...samplesMs),
      mibPerSec: fileSizeMiB / (avgMs / 1000),
      eventCount,
      checksum,
      attrCountTotal,
      objectCount,
      samplesMs,
    };
  });
}

function javaVersion(command) {
  const result = spawnSync(command, ['-version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) {
    return null;
  }
  return (result.stderr || result.stdout).split(/\r?\n/)[0].trim();
}

function quickXmlVersion(exe) {
  const result = spawnSync(exe, ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) {
    return null;
  }
  try {
    return JSON.parse(result.stdout).quickXmlVersion;
  } catch {
    return null;
  }
}

function simdXmlVersion(exe) {
  const result = spawnSync(exe, ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) {
    return null;
  }
  try {
    return JSON.parse(result.stdout).simdxmlVersion;
  } catch {
    return null;
  }
}

function verifyJava25(options, tools, baseReport) {
  if (!tools.java25) {
    return {
      status: 'skipped',
      reason: 'Java 25 executable was not found. Set STAX_XML_JAVA25 or STAX_XML_JAVA25_HOME to enable verification.',
      tiers: [],
    };
  }

  const command = woodstoxCommand(tools.java25, tools.woodstoxClasspath);
  const tiers = [];
  for (const tier of options.tiers) {
    const result = runExternalCommand(command, options.file, tier, options.runs, options.warmups);
    const base = findScenario(baseReport, tier, 'woodstox');
    tiers.push({
      tier,
      java25: result,
      java8MibPerSec: base?.mibPerSec ?? null,
      deltaVsJava8: result.status === 'ok' && base?.mibPerSec
        ? (result.mibPerSec - base.mibPerSec) / base.mibPerSec
        : null,
    });
  }

  return {
    status: tiers.every(entry => entry.java25.status === 'ok') ? 'ok' : 'partial',
    java25Version: javaVersion(tools.java25),
    tiers,
  };
}

function findScenario(report, tierId, scenarioId) {
  return report.files
    .flatMap(file => file.tiers)
    .find(tier => tier.id === tierId)
    ?.scenarios.find(scenario => scenario.id === scenarioId);
}

function formatRate(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} MiB/s` : 'n/a';
}

function formatMs(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)} ms` : 'n/a';
}

function formatPct(value) {
  return Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%` : 'n/a';
}

function escapePipe(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function createScenarioDetails(report) {
  return [
    '<details>',
    '<summary>Scenario contract: stax-xml JS/native, Woodstox, quick-xml, and simdxml comparator</summary>',
    '',
    `The comparator uses one generated single-root ${report.fixture.sizeMiB.toFixed(2)} MiB XML fixture.`,
    '',
    'Sample XML shape, shortened:',
    '',
    '~~~xml',
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<root>',
    '  <book id="book-N" lang="en" code="...">',
    '    <title>Runtime Benchmark N</title>',
    '    <author>Author ...</author>',
    '    <description>Full string checksum text payload ...</description>',
    '    <chapter number="1">Intro ...</chapter>',
    '    <chapter number="2">Body ...</chapter>',
    '  </book>',
    '</root>',
    '~~~',
    '',
    'Output shape:',
    '',
    '~~~text',
    'comparator-result = {',
    '  tier: "count-only" | "name-string-only" | "attr-value-string-only" | "text-string-only" | "full-string",',
    '  implementation: "stax-xml-js-node" | "stax-xml-native-addon-buffer" | "stax-xml-native-addon-file" | "woodstox-java8" | "quick-xml" | "simdxml-file" | "simdxml-memory",',
    '  eventCount: number,',
    '  checksum: fold(selected event data for tier)',
    '}',
    '~~~',
    '',
    'Parsing methods:',
    '',
    '- `stax-xml JS on Node`: built JavaScript iterable backend, run on Node, with tier-specific checksum folding.',
    '- `stax-xml native addon (Buffer)`: JS package wrapper imports the N-API aggregate addon before sampling, reads the fixture into one Node Buffer, and each measured sample calls through the wrapper and N-API boundary in the same Node process.',
    '- `stax-xml native addon (file)`: the same wrapper calls the native file helper each sample, so this row includes Rust-side file read and allocation cost.',
    '- Woodstox: Java StAX `XMLStreamReader`, namespace-aware parsing disabled, coalescing enabled, DTD/external entities disabled, buffered file input.',
    '- `quick-xml`: Rust `Reader` over buffered file input; declaration, PI, doctype, and comments are skipped; text is trimmed for checksum parity.',
    `- simdxml structural index (file): Rust \`simdxml::parse\` after reading the fixture inside each measured sample; skipped above ${report.options.simdxmlMaxMiB} MiB by default to avoid excessive memory use.`,
    `- simdxml structural index (memory): the same adapter with the fixture read once before warmup, so it is the closest comparator to the native Buffer row.`,
    '- Java 8 is the public Woodstox row because it is Woodstox\'s minimum runtime target; Java 25 is a separate verification row.',
    '',
    '</details>',
  ].join('\n');
}

function createMarkdown(report) {
  const lines = [
    '# Cross-Runtime Parser Comparator',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This artifact compares the Node stax-xml iterable backend, the native addon through its JavaScript package wrapper, and non-JS parser baselines under the same checksum contract.',
    'The public Woodstox row uses Java 8 because Woodstox supports Java 8 as its minimum runtime target; Java 25 is reported only as a verification check.',
    '',
    '## Environment',
    '',
    `- CPU: ${report.environment.cpuName}`,
    `- Platform: ${report.environment.platform}`,
    `- Fixture: ${report.fixture.path}`,
    `- Fixture size: ${report.fixture.sizeMiB.toFixed(2)} MiB`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    `- simdxml max fixture: ${report.options.simdxmlMaxMiB} MiB`,
    `- Java 8: ${escapePipe(report.tools.java8Version ?? 'unknown')}`,
    `- Java 25 check: ${escapePipe(report.java25Verification.java25Version ?? report.java25Verification.reason ?? 'not available')}`,
    `- quick-xml crate: ${report.tools.quickXmlVersion ?? 'unknown'}`,
    `- simdxml crate: ${report.tools.simdxmlVersion ?? 'unknown'}`,
    `- stax-xml native addon: ${report.tools.nativeAggregateVersion ?? 'unknown'}`,
    '',
    '## Scenario',
    '',
    createScenarioDetails(report),
    '',
    '## Public Comparator Tables',
    '',
  ];

  const firstFile = report.nodeStringReturn.files[0];
  for (const tier of firstFile.tiers) {
    lines.push(`### ${tier.id}`);
    lines.push('');
    lines.push(renderTierComparatorTable(report, tier.id));
    lines.push('');
  }

  lines.push('');
  lines.push('## Java 25 Verification');
  lines.push('');
  lines.push('| Tier | Woodstox Java 8 | Woodstox Java 25 | Delta | Java 25 avg | Status |');
  lines.push('| --- | ---: | ---: | ---: | ---: | --- |');
  for (const entry of report.java25Verification.tiers) {
    lines.push(
      `| ${entry.tier} | ${formatRate(entry.java8MibPerSec)} | ${formatRate(entry.java25?.mibPerSec)} | ` +
      `${formatPct(entry.deltaVsJava8)} | ${formatMs(entry.java25?.avgMs)} | ${entry.java25?.status ?? 'skipped'} |`,
    );
  }
  if (report.java25Verification.tiers.length === 0) {
    lines.push(`| n/a | n/a | n/a | n/a | n/a | ${escapePipe(report.java25Verification.reason)} |`);
  }

  lines.push('');
  lines.push('## Contract');
  lines.push('');
  for (const item of report.nodeStringReturn.contract) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('Checksum and event counts are preserved by the compared rows for the current fixture. If a future fixture introduces namespaces or entity-heavy content, this contract must be reviewed before publishing the table.');

  return `${lines.join('\n')}\n`;
}

function ratio(a, b) {
  if (!a?.mibPerSec || !b?.mibPerSec) return 'n/a';
  return `${(a.mibPerSec / b.mibPerSec).toFixed(2)}x`;
}

function tierById(report, tierId) {
  return report.nodeStringReturn.files[0].tiers.find(tier => tier.id === tierId);
}

function nativeTierById(report, tierId) {
  return report.nativeAddon?.tiers?.find(tier => tier.tier === tierId);
}

function nativeFileTierById(report, tierId) {
  return report.nativeAddon?.fileTiers?.find(tier => tier.tier === tierId);
}

function scenarioById(report, tierId, scenarioId) {
  return tierById(report, tierId)?.scenarios.find(scenario => scenario.id === scenarioId);
}

function comparatorRows(report, tierId) {
  const jsNode = scenarioById(report, tierId, 'node');
  return [
    ['stax-xml JS on Node', jsNode],
    ['stax-xml native addon (Buffer)', nativeTierById(report, tierId)],
    ['stax-xml native addon (file)', nativeFileTierById(report, tierId)],
    ['Woodstox on Java 8', scenarioById(report, tierId, 'woodstox')],
    ['quick-xml', scenarioById(report, tierId, 'quick-xml')],
    ['simdxml structural index (file)', scenarioById(report, tierId, 'simdxml')],
    ['simdxml structural index (memory)', scenarioById(report, tierId, 'simdxml-memory')],
  ];
}

function comparatorStatus(result) {
  if (!result) return 'missing';
  if (result.status === 'ok') return 'ok';
  return result.reason ?? result.status ?? 'n/a';
}

function relativeToJs(result, jsNode) {
  if (!result?.mibPerSec || !jsNode?.mibPerSec) return 'n/a';
  return `${(result.mibPerSec / jsNode.mibPerSec).toFixed(2)}x`;
}

function renderTierComparatorTable(report, tierId) {
  const jsNode = scenarioById(report, tierId, 'node');
  return [
    '| Implementation | Throughput | Average | Relative to stax-xml JS | Status |',
    '| --- | ---: | ---: | ---: | --- |',
    ...comparatorRows(report, tierId).map(([label, result]) =>
      `| ${label} | ${formatRate(result?.mibPerSec)} | ${formatMs(result?.avgMs)} | ${relativeToJs(result, jsNode)} | ${escapePipe(comparatorStatus(result))} |`
    ),
  ].join('\n');
}

function nativeAggregateVersion() {
  try {
    return JSON.parse(readFileSync(nativeAggregatePackageJsonPath, 'utf8')).version;
  } catch {
    return null;
  }
}

async function main() {
  const options = parseArgs();
  const tools = buildExternalTools(options);
  const nodeStringReturn = runNodeStringReturn(options, tools);
  const nativeAddon = await measureNativeAddon(options);
  const java25Verification = verifyJava25(options, tools, nodeStringReturn.report);
  const fileStat = statSync(options.file);

  const report = {
    generatedAt: new Date().toISOString(),
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
    },
    fixture: {
      path: options.file,
      name: basename(options.file),
      sizeBytes: fileStat.size,
      sizeMiB: fileStat.size / 1024 / 1024,
    },
    options: {
      runs: options.runs,
      warmups: options.warmups,
      tiers: options.tiers,
      simdxmlMaxMiB: options.simdxmlMaxMiB,
    },
    tools: {
      java8Command: tools.java8,
      java8Version: javaVersion(tools.java8),
      java25Command: tools.java25 ?? null,
      quickXmlCommand: tools.quickXmlExe,
      quickXmlVersion: quickXmlVersion(tools.quickXmlExe),
      simdxmlCommand: tools.simdXmlExe,
      simdxmlVersion: simdXmlVersion(tools.simdXmlExe),
      nativeAggregatePackage: '@stax-xml/native-aggregate-probe',
      nativeAggregateVersion: nativeAggregateVersion(),
    },
    rawNodeStringReturnPath: nodeStringReturn.rawOut,
    nodeStringReturn: nodeStringReturn.report,
    nativeAddon,
    java25Verification,
  };

  mkdirSync(dirname(options.jsonOut), { recursive: true });
  writeFileSync(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(options.mdOut, createMarkdown(report), 'utf8');
  console.log(`Wrote ${options.jsonOut}`);
  console.log(`Wrote ${options.mdOut}`);
}

void main();
