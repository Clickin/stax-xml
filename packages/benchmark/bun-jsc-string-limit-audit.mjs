import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const JSC_MAX_STRING_LENGTH = 2_147_483_647;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'bun-jsc-string-limit-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'bun-jsc-string-limit-audit.md');
const defaultEventReaderPath = resolve(__dirname, 'results', 'release', 'event-reader-string-large.json');
const packageVersion = JSON.parse(readFileSync(resolve(__dirname, '../stax-xml/package.json'), 'utf8')).version;
const textEncoder = new TextEncoder();

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sizesMiB: [512, 1024],
    fixtureShape: 'diverse-cycle',
    diverseCycleSize: 4096,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    eventReaderPath: defaultEventReaderPath,
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
      case '--size-mib':
        options.sizesMiB = [parsePositiveNumber(readValue(), '--size-mib')];
        break;
      case '--sizes-mib':
        options.sizesMiB = readValue().split(',').map((value) => parsePositiveNumber(value.trim(), '--sizes-mib'));
        break;
      case '--fixture-shape':
        options.fixtureShape = readValue();
        break;
      case '--diverse-cycle-size':
        options.diverseCycleSize = parsePositiveInteger(readValue(), '--diverse-cycle-size');
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      case '--event-reader-path':
        options.eventReaderPath = resolve(process.cwd(), readValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['repeated-person', 'diverse-cycle'].includes(options.fixtureShape)) {
    throw new Error('--fixture-shape must be one of repeated-person, diverse-cycle.');
  }
  return options;
}

function parsePositiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive number.`);
  return parsed;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function main() {
  const options = parseArgs();
  const runtime = readBunRuntime();
  const rows = createFixtureRows(options.fixtureShape, options.diverseCycleSize);
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'bun-jsc-string-limit-audit',
    contract: 'bun-jsc-complete-js-string-input-boundary',
    note: 'This pins a Bun/JSC maximum-string source/runtime fact and checks whether it explains the 1 GiB EventReaderSync complete-string failure. It is not a byte-batch runtime ceiling.',
    packageVersion,
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
    },
    runtime,
    options: {
      sizesMiB: options.sizesMiB,
      fixtureShape: options.fixtureShape,
      diverseCycleSize: options.diverseCycleSize,
      eventReaderPath: options.eventReaderPath,
    },
    jscMaxStringLength: createJscMaxStringLength(),
    overLimitProbe: runBunOverLimitProbe(),
    fixtureProjections: options.sizesMiB.map((sizeMiB) => projectFixture(sizeMiB, rows, JSC_MAX_STRING_LENGTH)),
    eventReaderRelease: loadEventReaderRelease(options.eventReaderPath),
    sourceFacts: createSourceFacts(runtime),
  };
  report.findings = createFindings(report);

  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function readBunRuntime() {
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
  };
}

function createJscMaxStringLength() {
  return {
    value: JSC_MAX_STRING_LENGTH,
    units: 'UTF-16 code units',
    formula: 'std::numeric_limits<int32_t>::max()',
    valueMiCodeUnits: JSC_MAX_STRING_LENGTH / MIB,
  };
}

function runBunOverLimitProbe() {
  const requestedLength = JSC_MAX_STRING_LENGTH + 1;
  const code = `const requestedLength=${requestedLength}; try { 'x'.repeat(requestedLength); console.log(JSON.stringify({status:'unexpected-success', requestedLength})); } catch (error) { console.log(JSON.stringify({status:'throws', requestedLength, errorName:error.name, errorMessage:error.message})); }`;
  const result = spawnSync('bun', ['-e', code], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    return {
      status: 'process-failed',
      requestedLength,
      exitCode: result.status,
      stderrTail: tail(result.stderr),
      stdoutTail: tail(result.stdout),
    };
  }
  return JSON.parse(result.stdout);
}

function projectFixture(sizeMiB, rows, maxStringLength) {
  const targetBytes = Math.floor(sizeMiB * MIB);
  const cycleUtf8Bytes = rows.reduce((sum, row) => sum + row.utf8Bytes, 0);
  const cycleStringCodeUnits = rows.reduce((sum, row) => sum + row.stringCodeUnits, 0);
  const fullCycles = Math.floor(targetBytes / cycleUtf8Bytes);
  let actualUtf8Bytes = cycleUtf8Bytes * fullCycles;
  let stringCodeUnits = cycleStringCodeUnits * fullCycles;
  let tailRows = 0;
  while (actualUtf8Bytes < targetBytes) {
    const row = rows[tailRows % rows.length];
    actualUtf8Bytes += row.utf8Bytes;
    stringCodeUnits += row.stringCodeUnits;
    tailRows++;
  }
  const exceedsJscMaxStringLength = stringCodeUnits > maxStringLength;
  return {
    sizeMiB,
    targetBytes,
    actualUtf8Bytes,
    actualMiB: actualUtf8Bytes / MIB,
    stringCodeUnits,
    estimatedUtf16Bytes: stringCodeUnits * 2,
    estimatedUtf16MiB: (stringCodeUnits * 2) / MIB,
    fullCycles,
    tailRows,
    cycleUtf8Bytes,
    cycleStringCodeUnits,
    exceedsJscMaxStringLength,
    jscCodeUnitHeadroom: maxStringLength - stringCodeUnits,
    constructingCompleteStringIsExpectedToFailByJscLength: exceedsJscMaxStringLength,
  };
}

function loadEventReaderRelease(eventReaderPath) {
  if (!existsSync(eventReaderPath)) {
    return {
      status: 'missing',
      path: eventReaderPath,
    };
  }

  const report = JSON.parse(readFileSync(eventReaderPath, 'utf8'));
  const failure = report.rows.find((row) => row.status !== 'ok');
  const largestSuccessful = report.rows
    .filter((row) => row.status === 'ok' && row.fixture?.stringCodeUnits !== undefined)
    .toSorted((a, b) => b.sizeMiB - a.sizeMiB)[0];
  return {
    status: 'loaded',
    path: eventReaderPath,
    generatedAt: report.generatedAt,
    contract: report.contract,
    nodeV8Environment: report.environment,
    largestSuccessfulSizeMiB: largestSuccessful?.sizeMiB,
    largestSuccessfulStringCodeUnits: largestSuccessful?.fixture?.stringCodeUnits,
    v8ReleaseFailure: failure
      ? {
          status: failure.status,
          sizeMiB: failure.sizeMiB,
          error: failure.error,
          stackHead: typeof failure.stack === 'string' ? failure.stack.split(/\r?\n/).slice(0, 3).join('\n') : undefined,
        }
      : undefined,
  };
}

function createSourceFacts(runtime) {
  const webkitUrl = `https://github.com/oven-sh/webkit/blob/${runtime.webkitCommit}/Source/WTF/wtf/text/StringImpl.h`;
  return [
    {
      id: 'bun-uses-javascriptcore',
      type: 'official-doc',
      url: 'https://bun.com/docs',
      fact: 'Bun describes its JavaScript runtime as built on JavaScriptCore.',
    },
    {
      id: 'bun-patched-webkit-source',
      type: 'official-doc',
      url: 'https://bun.com/docs/project/license',
      fact: 'Bun documents that it statically links JavaScriptCore/WebKit and points to the patched WebKit mirror.',
    },
    {
      id: 'bun-runtime-webkit-commit',
      type: 'runtime',
      url: undefined,
      fact: `Local Bun ${runtime.bunRevision} exposes process.versions.webkit=${runtime.webkitCommit}.`,
    },
    {
      id: 'jsc-stringimpl-maxlength',
      type: 'source',
      url: `${webkitUrl}#L153`,
      fact: `Bun ${runtime.bunVersion} patched WebKit StringImplShape::MaxLength is std::numeric_limits<int32_t>::max().`,
    },
    {
      id: 'jsc-stringimpl-isvalidlength',
      type: 'source',
      url: `${webkitUrl}#L1248-L1251`,
      fact: 'StringImpl::isValidLength bounds concrete character storage by MaxLength and allocation-size limits for the character type.',
    },
  ];
}

function createFindings(report) {
  const projected1024 = report.fixtureProjections.find((row) => row.sizeMiB === 1024);
  return [
    {
      id: 'jsc-max-string-source-fact',
      status: 'source-and-runtime-fact',
      summary: 'Bun/JSC exposes a larger single-string source limit than current Node/V8 for this local Bun build.',
      evidence: [
        `bun=${report.runtime.bunVersion}`,
        `webkit=${report.runtime.webkitCommit}`,
        `StringImpl::MaxLength=${formatInteger(report.jscMaxStringLength.value)}`,
        `over-limit probe=${report.overLimitProbe.errorName}: ${report.overLimitProbe.errorMessage}`,
      ],
    },
    {
      id: 'jsc-limit-does-not-explain-1gib-v8-failure',
      status: 'counterexample-to-porting-v8-limit',
      summary: 'The 1024 MiB generated fixture projection is below the Bun/JSC StringImpl::MaxLength source limit.',
      evidence: [
        projected1024
          ? `1024 MiB projection=${formatInteger(projected1024.stringCodeUnits)} code units`
          : '1024 MiB projection missing',
        projected1024
          ? `JSC code-unit headroom=${formatInteger(projected1024.jscCodeUnitHeadroom)}`
          : 'JSC headroom unavailable',
        report.eventReaderRelease.v8ReleaseFailure
          ? `Node/V8 release failure=${report.eventReaderRelease.v8ReleaseFailure.error}`
          : 'Node/V8 release failure missing',
      ],
    },
    {
      id: 'scope-boundary',
      status: 'not-a-runtime-ceiling',
      summary: 'This only distinguishes string-length invariants; it does not prove Bun/JSC can parse a 1 GiB complete string within acceptable memory.',
      evidence: [
        'No 1 GiB Bun EventReaderSync parse row is measured here.',
        'No browser JSC/Safari runtime row is measured here.',
        'This is not a byte-batch runtime ceiling.',
      ],
    },
  ];
}

function createFixtureRows(shape, cycleSize) {
  if (shape === 'repeated-person') {
    return [createFixtureRow(makeRepeatedPersonRow())];
  }
  return Array.from({ length: cycleSize }, (_, id) => createFixtureRow(makeDiverseRow(id)));
}

function createFixtureRow(xml) {
  const bytes = textEncoder.encode(xml);
  return {
    xml,
    utf8Bytes: bytes.byteLength,
    stringCodeUnits: xml.length,
  };
}

function makeRepeatedPersonRow() {
  return '<person id="123"><name>Jane Doe</name><age>42</age></person>';
}

function makeDiverseRow(id) {
  const rootNames = ['person', 'record', 'entry', 'invoice', 'profile', 'asset', 'sample'];
  const childNames = ['name', 'title', 'summary', 'note', 'group', 'bucket', 'payload'];
  const rootName = `${rootNames[id % rootNames.length]}${id % 257}`;
  const childA = `${childNames[id % childNames.length]}${(id * 3) % 193}`;
  const childB = `${childNames[(id + 2) % childNames.length]}${(id * 5) % 197}`;
  const childC = `${childNames[(id + 4) % childNames.length]}${(id * 7) % 199}`;
  const attrA = `data${id % 997}`;
  const attrB = `code${(id * 11) % 991}`;
  const attrC = `flag${(id * 17) % 983}`;
  const utf8Text = id % 11 === 0
    ? ` ${String.fromCodePoint(0x2603)}-${id}-${String.fromCodePoint(0x1f642)}`
    : '';

  return `<${rootName} id="item-${id}" ${attrA}="value-${(id * 31) % 65521}" ${attrB}="group-${id % 4093}" ${attrC}="${id % 2 === 0 ? 'true' : 'false'}">`
    + `<${childA}>Runtime Benchmark ${id}${utf8Text}</${childA}>`
    + `<${childB} rank="${id % 29}">Full string checksum payload ${(id * 8191) % 104729}</${childB}>`
    + `<${childC} shard="${id % 37}" bucket="${(id * 19) % 389}">Text ${id} ${(id * id) % 99991}</${childC}>`
    + `</${rootName}>`;
}

function renderMarkdown(report) {
  const lines = [
    '# Bun/JSC String Limit Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Scope',
    '',
    'This audit pins a Bun/JSC maximum-string source/runtime fact and compares it against the generated `EventReaderSync` complete-string fixture lengths. It is not a byte-batch runtime ceiling and not a 200 MiB/s impossibility proof.',
    '',
    '## Runtime Limit',
    '',
    `- Bun: ${report.runtime.bunVersion}`,
    `- Bun revision: ${report.runtime.bunRevision}`,
    `- Bun user agent: ${report.runtime.userAgent}`,
    `- Bun WebKit commit: ${report.runtime.webkitCommit}`,
    `- StringImpl::MaxLength: ${formatInteger(report.jscMaxStringLength.value)} UTF-16 code units`,
    `- Source formula: ${report.jscMaxStringLength.formula}`,
    `- Over-limit probe: ${report.overLimitProbe.errorName}: ${report.overLimitProbe.errorMessage}`,
    '',
    '## Fixture Projections',
    '',
    '| Size | Actual UTF-8 | String code units | Estimated UTF-16 | Below JSC limit? |',
    '| --- | ---: | ---: | ---: | --- |',
  ];

  for (const row of report.fixtureProjections) {
    lines.push(`| ${row.sizeMiB} MiB | ${formatMiB(row.actualUtf8Bytes)} | ${formatInteger(row.stringCodeUnits)} | ${formatMiB(row.estimatedUtf16Bytes)} | ${row.exceedsJscMaxStringLength ? 'no' : `yes, ${formatInteger(row.jscCodeUnitHeadroom)} code units headroom`} |`);
  }

  lines.push('', '## EventReaderSync Release Cross-Check', '');
  if (report.eventReaderRelease.status === 'loaded') {
    lines.push(
      `- Node/V8 artifact: ${report.eventReaderRelease.path}`,
      `- Contract: ${report.eventReaderRelease.contract}`,
      `- Largest successful Node/V8 complete-string row: ${report.eventReaderRelease.largestSuccessfulSizeMiB} MiB`,
    );
    if (report.eventReaderRelease.v8ReleaseFailure) {
      lines.push(`- Node/V8 failed release row: ${report.eventReaderRelease.v8ReleaseFailure.sizeMiB} MiB with ${report.eventReaderRelease.v8ReleaseFailure.error}`);
    }
  } else {
    lines.push(`- EventReaderSync release artifact was ${report.eventReaderRelease.status}: ${report.eventReaderRelease.path}`);
  }

  lines.push(
    '',
    '## Source Facts',
    '',
    '| ID | Source | Fact |',
    '| --- | --- | --- |',
  );
  for (const fact of report.sourceFacts) {
    lines.push(`| \`${fact.id}\` | ${fact.url ?? 'runtime probe'} | ${fact.fact} |`);
  }

  lines.push('', '## Findings', '');
  for (const finding of report.findings) {
    lines.push(`### ${finding.id}`, '', finding.summary, '');
    for (const evidence of finding.evidence) {
      lines.push(`- ${evidence}`);
    }
    lines.push('');
  }

  lines.push(
    '## Interpretation',
    '',
    'The 1024 MiB projection is below the JSC string-length limit for this local Bun build, so the Node/V8 `RangeError: Invalid string length` at 1024 MiB is not a 1 GiB JSC string-length failure. This is a counterexample to porting the V8 complete-string size conclusion directly to Bun/JSC.',
    '',
    'This does not prove Bun/JSC can parse the complete 1 GiB string with acceptable memory, and it does not prove anything about browser Safari rows. It only narrows the source-level string-length part of the proof ledger.',
  );

  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  const projected1024 = report.fixtureProjections.find((row) => row.sizeMiB === 1024);
  const summary = projected1024
    ? `1024 MiB projection has ${formatInteger(projected1024.jscCodeUnitHeadroom)} JSC code-unit headroom`
    : '1024 MiB projection missing';
  console.log(`bun-jsc-string-limit-audit: Bun ${report.runtime.bunVersion}, ${summary}`);
}

function tail(value, maxChars = 4000) {
  if (!value) return '';
  return value.length <= maxChars ? value : value.slice(-maxChars);
}

function formatInteger(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return 'n/a';
  return Math.round(value).toLocaleString('en-US');
}

function formatNumber(value, digits = 2) {
  if (value === undefined || value === null || Number.isNaN(value)) return 'n/a';
  return value.toFixed(digits);
}

function formatMiB(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return 'n/a';
  return `${formatNumber(value / MIB, 1)} MiB`;
}

main();
