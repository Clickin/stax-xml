import { constants as bufferConstants, kStringMaxLength } from 'node:buffer';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'v8-string-limit-audit.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'v8-string-limit-audit.md');
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
  const rows = createFixtureRows(options.fixtureShape, options.diverseCycleSize);
  const runtimeMaxStringLength = createRuntimeMaxStringLength();
  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'v8-string-limit-audit',
    contract: 'node-v8-complete-js-string-input-boundary',
    note: 'This pins the complete JS string input boundary for current Node/V8. It is not a byte-batch runtime ceiling and not a 200 MiB/s impossibility proof.',
    packageVersion,
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
      v8: process.versions.v8,
    },
    options: {
      sizesMiB: options.sizesMiB,
      fixtureShape: options.fixtureShape,
      diverseCycleSize: options.diverseCycleSize,
      eventReaderPath: options.eventReaderPath,
    },
    runtimeMaxStringLength,
    overLimitProbe: runOverLimitProbe(runtimeMaxStringLength.value),
    fixtureProjections: options.sizesMiB.map((sizeMiB) => projectFixture(sizeMiB, rows, runtimeMaxStringLength.value)),
    eventReaderRelease: loadEventReaderRelease(options.eventReaderPath, runtimeMaxStringLength.value),
    sourceFacts: createSourceFacts(),
  };
  report.findings = createFindings(report);

  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function createRuntimeMaxStringLength() {
  const formula64Bit = '(1 << 29) - 24';
  const formula64BitValue = (1 << 29) - 24;
  const formula32Bit = '(1 << 28) - 16';
  const formula32BitValue = (1 << 28) - 16;
  return {
    value: bufferConstants.MAX_STRING_LENGTH,
    aliasValue: kStringMaxLength,
    units: 'UTF-16 code units',
    formula64Bit,
    formula64BitValue,
    formula32Bit,
    formula32BitValue,
    matches64BitFormula: bufferConstants.MAX_STRING_LENGTH === formula64BitValue,
    valueMiCodeUnits: bufferConstants.MAX_STRING_LENGTH / MIB,
  };
}

function runOverLimitProbe(maxStringLength) {
  const requestedLength = maxStringLength + 1;
  try {
    'x'.repeat(requestedLength);
    return {
      status: 'unexpected-success',
      requestedLength,
    };
  } catch (error) {
    return {
      status: 'throws',
      requestedLength,
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
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
  const exceedsMaxStringLength = stringCodeUnits > maxStringLength;
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
    exceedsMaxStringLength,
    codeUnitsOverLimit: stringCodeUnits - maxStringLength,
    constructingCompleteStringIsExpectedToFail: exceedsMaxStringLength,
  };
}

function loadEventReaderRelease(eventReaderPath, maxStringLength) {
  if (!existsSync(eventReaderPath)) {
    return {
      status: 'missing',
      path: eventReaderPath,
    };
  }

  const report = JSON.parse(readFileSync(eventReaderPath, 'utf8'));
  const successfulRows = report.rows.filter((row) => row.status === 'ok' && row.fixture?.stringCodeUnits !== undefined);
  const largestSuccessful = successfulRows.toSorted((a, b) => b.sizeMiB - a.sizeMiB)[0];
  const releaseFailure = report.rows.find((row) => row.status !== 'ok');
  return {
    status: 'loaded',
    path: eventReaderPath,
    generatedAt: report.generatedAt,
    contract: report.contract,
    environment: report.environment,
    largestSuccessfulSizeMiB: largestSuccessful?.sizeMiB,
    largestSuccessfulThroughputMiBPerSec: largestSuccessful?.mibPerSec,
    largestSuccessfulStringCodeUnits: largestSuccessful?.fixture?.stringCodeUnits,
    largestSuccessfulUtf8Bytes: largestSuccessful?.fixture?.actualUtf8Bytes,
    largestSuccessfulEstimatedUtf16Bytes: largestSuccessful?.fixture?.estimatedUtf16Bytes,
    largestSuccessfulPeakRssBytes: largestSuccessful?.memory?.peakRssBytes,
    largestSuccessfulCodeUnitHeadroom: largestSuccessful ? maxStringLength - largestSuccessful.fixture.stringCodeUnits : undefined,
    largestSuccessfulBelowRuntimeLimit: largestSuccessful ? largestSuccessful.fixture.stringCodeUnits < maxStringLength : undefined,
    releaseFailure: releaseFailure
      ? {
          status: releaseFailure.status,
          sizeMiB: releaseFailure.sizeMiB,
          error: releaseFailure.error,
          stackHead: typeof releaseFailure.stack === 'string' ? releaseFailure.stack.split(/\r?\n/).slice(0, 3).join('\n') : undefined,
        }
      : undefined,
  };
}

function createSourceFacts() {
  return [
    {
      id: 'node-buffer-docs-max-string-length',
      type: 'official-doc',
      url: 'https://nodejs.org/docs/latest-v24.x/api/buffer.html#bufferconstantsmax_string_length',
      fact: 'Node documents buffer.constants.MAX_STRING_LENGTH as the largest single string length in UTF-16 code units and engine-dependent.',
    },
    {
      id: 'node-v24-buffer-js-constant',
      type: 'source',
      url: 'https://github.com/nodejs/node/blob/v24.15.0/lib/buffer.js#L166-L168',
      fact: 'Node v24.15.0 exposes MAX_STRING_LENGTH from internal binding kStringMaxLength.',
    },
    {
      id: 'node-v24-buffer-cc-binding',
      type: 'source',
      url: 'https://github.com/nodejs/node/blob/v24.15.0/src/node_buffer.cc#L1665-L1666',
      fact: 'Node v24.15.0 sets kStringMaxLength to v8::String::kMaxLength.',
    },
    {
      id: 'node-v24-v8-string-kmaxlength',
      type: 'source',
      url: 'https://github.com/nodejs/node/blob/v24.15.0/deps/v8/include/v8-primitive.h#L126-L127',
      fact: 'Vendored V8 defines v8::String::kMaxLength as (1 << 28) - 16 on 32-bit API pointers and (1 << 29) - 24 otherwise.',
    },
    {
      id: 'node-v24-v8-string-creation-guard',
      type: 'source',
      url: 'https://github.com/nodejs/node/blob/v24.15.0/deps/v8/include/v8-primitive.h#L534-L546',
      fact: 'V8 public string allocation APIs document empty results when length exceeds kMaxLength.',
    },
    {
      id: 'node-v24-v8-external-string-lifetime',
      type: 'source',
      url: 'https://github.com/nodejs/node/blob/v24.15.0/deps/v8/include/v8-primitive.h#L435-L439',
      fact: 'V8 external one-byte strings require immutable Latin-1 external data, not arbitrary UTF-8 parser spans.',
    },
  ];
}

function createFindings(report) {
  const projectedFailure = report.fixtureProjections.find((row) => row.exceedsMaxStringLength);
  const largest = report.eventReaderRelease.status === 'loaded'
    ? report.eventReaderRelease.largestSuccessfulSizeMiB
    : undefined;
  return [
    {
      id: 'node-v8-single-string-limit',
      summary: 'Current Node/V8 exposes a single JS string maximum matching v8::String::kMaxLength.',
      evidence: [
        `MAX_STRING_LENGTH=${report.runtimeMaxStringLength.value}`,
        `formula64Bit=${report.runtimeMaxStringLength.formula64Bit}`,
        `over-limit probe=${report.overLimitProbe.errorName}: ${report.overLimitProbe.errorMessage}`,
      ],
    },
    {
      id: 'event-reader-complete-string-boundary',
      summary: 'The EventReaderSync complete-string input path reaches this string boundary before parsing 1 GiB input.',
      evidence: [
        largest === undefined
          ? 'release EventReaderSync artifact missing'
          : `largest successful release row=${largest} MiB`,
        projectedFailure === undefined
          ? 'no projected fixture exceeds MAX_STRING_LENGTH'
          : `${projectedFailure.sizeMiB} MiB projection exceeds MAX_STRING_LENGTH by ${formatInteger(projectedFailure.codeUnitsOverLimit)} code units`,
        report.eventReaderRelease.releaseFailure
          ? `${report.eventReaderRelease.releaseFailure.sizeMiB} MiB release row=${report.eventReaderRelease.releaseFailure.error}`
          : 'no failed release row recorded',
      ],
    },
    {
      id: 'scope-boundary',
      summary: 'This is a complete-string EventReaderSync input invariant, not a byte-batch runtime ceiling.',
      evidence: [
        'It does not apply to StreamReaderSync byte batches that never build one full XML string.',
        'It is not a 200 MiB/s impossibility proof.',
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
    '# V8 String Limit Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Scope',
    '',
    'This audit pins the complete JS string input boundary for the current Node/V8 benchmark runtime. It is not a byte-batch runtime ceiling and not a 200 MiB/s impossibility proof.',
    '',
    '## Runtime Limit',
    '',
    `- Node: ${report.environment.node}`,
    `- V8: ${report.environment.v8}`,
    `- MAX_STRING_LENGTH: ${formatInteger(report.runtimeMaxStringLength.value)} UTF-16 code units`,
    `- V8 64-bit formula: ${report.runtimeMaxStringLength.formula64Bit} = ${formatInteger(report.runtimeMaxStringLength.formula64BitValue)}`,
    `- Formula match: ${report.runtimeMaxStringLength.matches64BitFormula ? 'yes' : 'no'}`,
    `- Over-limit probe: ${report.overLimitProbe.errorName}: ${report.overLimitProbe.errorMessage}`,
    '',
    '## Fixture Projections',
    '',
    '| Size | Actual UTF-8 | String code units | Estimated UTF-16 | Over MAX_STRING_LENGTH? |',
    '| --- | ---: | ---: | ---: | --- |',
  ];

  for (const row of report.fixtureProjections) {
    lines.push(`| ${row.sizeMiB} MiB | ${formatMiB(row.actualUtf8Bytes)} | ${formatInteger(row.stringCodeUnits)} | ${formatMiB(row.estimatedUtf16Bytes)} | ${row.exceedsMaxStringLength ? `yes, +${formatInteger(row.codeUnitsOverLimit)} code units` : 'no'} |`);
  }

  lines.push('', '## EventReaderSync Release Row', '');
  if (report.eventReaderRelease.status === 'loaded') {
    lines.push(
      `- Artifact: ${report.eventReaderRelease.path}`,
      `- Contract: ${report.eventReaderRelease.contract}`,
      `- Largest successful row: ${report.eventReaderRelease.largestSuccessfulSizeMiB} MiB at ${formatNumber(report.eventReaderRelease.largestSuccessfulThroughputMiBPerSec)} MiB/s`,
      `- Largest successful string code units: ${formatInteger(report.eventReaderRelease.largestSuccessfulStringCodeUnits)}`,
      `- Code-unit headroom below MAX_STRING_LENGTH: ${formatInteger(report.eventReaderRelease.largestSuccessfulCodeUnitHeadroom)}`,
      `- Peak RSS on largest successful row: ${formatGiB(report.eventReaderRelease.largestSuccessfulPeakRssBytes)}`,
    );
    if (report.eventReaderRelease.releaseFailure) {
      lines.push(`- Failed release row: ${report.eventReaderRelease.releaseFailure.sizeMiB} MiB with RangeError: ${report.eventReaderRelease.releaseFailure.error}`);
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
    lines.push(`| \`${fact.id}\` | ${fact.url} | ${fact.fact} |`);
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
    'The complete-string `EventReaderSync` path has a pinned Node/V8 failure mechanism for 1 GiB generated input: it must first construct one JS string, and the projected string length exceeds the current runtime `MAX_STRING_LENGTH` before parsing starts.',
    '',
    'This does not cover Bun/JSC or browser engines, and it does not prove that pure JavaScript byte-batch readers cannot find more throughput headroom. A 200 MiB/s+ bounded-memory `StreamReaderSync` row would still be a counterexample to the broader runtime-limit hypothesis.',
  );

  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  const projectedFailure = report.fixtureProjections.find((row) => row.exceedsMaxStringLength);
  const failureText = projectedFailure
    ? `${projectedFailure.sizeMiB} MiB projection exceeds MAX_STRING_LENGTH by ${formatInteger(projectedFailure.codeUnitsOverLimit)} code units`
    : 'no projected fixture exceeds MAX_STRING_LENGTH';
  console.log(`v8-string-limit-audit: MAX_STRING_LENGTH=${formatInteger(report.runtimeMaxStringLength.value)}, ${failureText}`);
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

function formatGiB(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return 'n/a';
  return `${formatNumber(value / GIB, 2)} GiB`;
}

main();
