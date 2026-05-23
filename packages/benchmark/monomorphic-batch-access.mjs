import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StreamEventType, StreamReaderSync } from 'stax-xml';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultFile = join(__dirname, 'test-data', 'runtime-comparison-16mib.xml');
const defaultJsonOut = join(__dirname, 'results', 'release', 'monomorphic-batch-access.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'monomorphic-batch-access.md');
const externalBaselinePath = join(__dirname, 'results', 'release', 'external-baseline.json');
const textEncoder = new TextEncoder();

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    runs: 3,
    warmups: 1,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    selfTest: false,
    fileExplicit: false,
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

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${flag} must be a non-negative integer.`);
  return parsed;
}

function main() {
  const options = parseArgs();
  const fixture = loadFixture(options);
  const variants = [
    {
      id: 'public-accessor',
      implementation: 'StreamBatch public index accessors',
      materialization: 'full-string',
      run: () => consumePublicAccessor(fixture.bytes),
    },
    {
      id: 'raw-frame-direct-decode',
      implementation: 'nextRawBatch typed arrays, direct span decode',
      materialization: 'full-string',
      run: () => consumeRawFrameDirect(fixture.bytes),
    },
    {
      id: 'raw-frame-name-id-cache',
      implementation: 'nextRawBatch typed arrays, numeric name-id cache',
      materialization: 'full-string',
      run: () => consumeRawFrameNameIdCache(fixture.bytes),
    },
  ];

  const results = variants.map((variant) => measureVariant(variant, fixture, options));
  const report = createReport(fixture, options, results);
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function loadFixture(options) {
  if (options.selfTest) {
    const bytes = textEncoder.encode(makeXml(32));
    return {
      source: 'self-test-generated',
      bytes,
      byteLength: bytes.byteLength,
      file: null,
    };
  }

  if (!existsSync(options.file) && !options.fileExplicit) {
    generateXmlFile(options.file, 16 * MIB);
  }
  if (!existsSync(options.file)) {
    throw new Error(`Benchmark fixture does not exist: ${options.file}`);
  }
  const bytes = readFileSync(options.file);
  return {
    source: 'file',
    bytes,
    byteLength: statSync(options.file).size,
    file: options.file,
  };
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
      const element = Buffer.from(makeBookElement(id));
      if (written + pendingBytes + element.byteLength + footer.byteLength > targetBytes) {
        break;
      }
      pending.push(element);
      pendingBytes += element.byteLength;
      id++;
      if (pendingBytes >= MIB) {
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

function makeXml(elements) {
  const parts = ['<?xml version="1.0" encoding="UTF-8"?>\n<root>\n'];
  for (let id = 0; id < elements; id++) {
    parts.push(makeBookElement(id));
  }
  parts.push('</root>\n');
  return parts.join('');
}

function makeBookElement(id) {
  return `  <book id="book-${id}" lang="en" code="${id % 97}">`
    + `<title>Runtime Benchmark ${id}</title>`
    + `<author>Author ${id % 4096}</author>`
    + `<description>Full string checksum text payload ${id} with stable words and numbers.</description>`
    + `<chapter number="1">Intro ${id}</chapter>`
    + `<chapter number="2">Body ${id}</chapter>`
    + '</book>\n';
}

function measureVariant(variant, fixture, options) {
  for (let index = 0; index < options.warmups; index++) {
    variant.run();
  }

  const samplesMs = [];
  let first;
  for (let index = 0; index < options.runs; index++) {
    globalThis.gc?.();
    const startedAt = performance.now();
    const result = variant.run();
    const elapsedMs = performance.now() - startedAt;
    if (first && (result.eventCount !== first.eventCount || result.checksum !== first.checksum)) {
      throw new Error(`${variant.id} produced unstable event count or checksum.`);
    }
    first ??= result;
    samplesMs.push(elapsedMs);
  }

  const avgMs = average(samplesMs);
  return {
    id: variant.id,
    implementation: variant.implementation,
    materialization: variant.materialization,
    avgMs,
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    mibPerSec: (fixture.byteLength / MIB) / (avgMs / 1000),
    eventCount: first.eventCount,
    checksum: first.checksum,
    samplesMs,
  };
}

function createReport(fixture, options, variants) {
  const baseline = variants.find((entry) => entry.id === 'public-accessor');
  const woodstoxTarget = readWoodstoxTarget();
  const parity = computeParity(variants);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'monomorphic-batch-access',
    contract: 'full-string-materialization',
    note: 'This experiment does not filter events, skip string fields, use native addons, or use Node Buffer-specific decoding.',
    environment: {
      cpuName: cpus()[0]?.model ?? 'unknown',
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
      v8: process.versions.v8,
    },
    fixture: {
      source: fixture.source,
      file: fixture.file,
      byteLength: fixture.byteLength,
      sizeMiB: fixture.byteLength / MIB,
    },
    options: {
      runs: options.runs,
      warmups: options.warmups,
    },
    woodstoxTarget,
    parity,
    variants: variants.map((entry) => ({
      ...entry,
      relativeToPublic: baseline ? entry.mibPerSec / baseline.mibPerSec : 1,
      woodstoxRatio: woodstoxTarget.woodstoxMiBPerSec
        ? entry.mibPerSec / woodstoxTarget.woodstoxMiBPerSec
        : null,
      targetStatus: woodstoxTarget.targetThroughputMiB
        ? entry.mibPerSec >= woodstoxTarget.targetThroughputMiB ? 'met' : 'below'
        : 'unknown',
    })),
    findings: createFindings(variants),
  };
}

function readWoodstoxTarget() {
  if (!existsSync(externalBaselinePath)) {
    return {
      status: 'missing',
      path: externalBaselinePath,
      baselineTool: 'woodstox',
      goalRatio: 0.9,
      targetThroughputMiB: null,
      woodstoxMiBPerSec: null,
    };
  }
  const report = JSON.parse(readFileSync(externalBaselinePath, 'utf8'));
  const woodstox = report.results?.find((entry) => entry.tool === 'woodstox');
  return {
    status: 'ok',
    path: externalBaselinePath,
    baselineTool: report.target?.baselineTool ?? 'woodstox',
    goalRatio: report.target?.goalRatio ?? 0.9,
    targetThroughputMiB: report.target?.targetThroughputMiB ?? null,
    woodstoxMiBPerSec: woodstox?.mibPerSec ?? null,
  };
}

function computeParity(variants) {
  const first = variants[0];
  const mismatch = variants.find((entry) => entry.eventCount !== first.eventCount || entry.checksum !== first.checksum);
  if (mismatch) {
    throw new Error(`Variant ${mismatch.id} does not match ${first.id}.`);
  }
  return {
    status: 'ok',
    eventCount: first.eventCount,
    checksum: first.checksum,
  };
}

function createFindings(variants) {
  const publicAccessor = variants.find((entry) => entry.id === 'public-accessor');
  const rawDirect = variants.find((entry) => entry.id === 'raw-frame-direct-decode');
  const rawNameId = variants.find((entry) => entry.id === 'raw-frame-name-id-cache');
  const findings = [
    {
      id: 'full-materialization-not-avoided',
      summary: 'Every variant consumes all events and folds element names, text, attribute names, and attribute values into the checksum.',
      evidence: variants.map((entry) => `${entry.id}: events=${entry.eventCount}, checksum=${entry.checksum}`),
    },
  ];
  if (publicAccessor && rawDirect) {
    findings.push({
      id: 'direct-raw-frame-delta',
      summary: 'Direct raw-frame traversal isolates accessor indirection from parser and string materialization cost.',
      evidence: [
        `public-accessor=${formatRate(publicAccessor.mibPerSec)}`,
        `raw-frame-direct-decode=${formatRate(rawDirect.mibPerSec)}`,
        `relative=${(rawDirect.mibPerSec / publicAccessor.mibPerSec).toFixed(2)}x`,
      ],
    });
  }
  if (publicAccessor && rawNameId) {
    findings.push({
      id: 'numeric-name-id-cache-delta',
      summary: 'The numeric name-id variant keeps full string materialization but avoids repeated accessor calls for already-interned names.',
      evidence: [
        `public-accessor=${formatRate(publicAccessor.mibPerSec)}`,
        `raw-frame-name-id-cache=${formatRate(rawNameId.mibPerSec)}`,
        `relative=${(rawNameId.mibPerSec / publicAccessor.mibPerSec).toFixed(2)}x`,
      ],
    });
  }
  return findings;
}

function consumePublicAccessor(bytes) {
  let eventCount = 0;
  let checksum = 0;

  for (const batch of new StreamReaderSync(bytes)) {
    const count = batch.eventCount;
    for (let index = 0; index < count; index++) {
      const type = batch.typeAt(index);
      eventCount++;
      checksum = mixChecksum(checksum, type);

      if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
        checksum = foldString(checksum, batch.nameAt(index));
      }
      if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
        checksum = foldString(checksum, batch.textAt(index)?.trim());
      }
      if (type === StreamEventType.START_ELEMENT) {
        const attrCount = batch.attributeCountAt(index);
        checksum = mixChecksum(checksum, attrCount);
        for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
          checksum = foldString(checksum, batch.attributeNameAt(index, attrIndex));
          checksum = foldString(checksum, batch.attributeValueAt(index, attrIndex));
        }
      }
    }
  }

  return { eventCount, checksum };
}

function consumeRawFrameDirect(bytes) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const reader = new StreamReaderSync(bytes);
  let eventCount = 0;
  let checksum = 0;
  let frame;

  while ((frame = reader.nextRawBatch()) !== null) {
    const result = consumeRawFrame(frame, checksum, eventCount, decoder, undefined);
    checksum = result.checksum;
    eventCount = result.eventCount;
  }

  return { eventCount, checksum };
}

function consumeRawFrameNameIdCache(bytes) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  const reader = new StreamReaderSync(bytes);
  const nameCache = [];
  let eventCount = 0;
  let checksum = 0;
  let frame;

  while ((frame = reader.nextRawBatch()) !== null) {
    const result = consumeRawFrame(frame, checksum, eventCount, decoder, nameCache);
    checksum = result.checksum;
    eventCount = result.eventCount;
  }

  return { eventCount, checksum };
}

function consumeRawFrame(frame, checksum, eventCount, decoder, nameCache) {
  const eventTypes = frame.eventTypes;
  const nameStarts = frame.nameStarts;
  const nameEnds = frame.nameEnds;
  const nameIds = frame.nameIds;
  const textStarts = frame.textStarts;
  const textEnds = frame.textEnds;
  const attrStarts = frame.attrStarts;
  const attrCounts = frame.attrCounts;
  const attrNameStarts = frame.attrNameStarts;
  const attrNameEnds = frame.attrNameEnds;
  const attrNameIds = frame.attrNameIds;
  const attrValueStarts = frame.attrValueStarts;
  const attrValueEnds = frame.attrValueEnds;
  const buffer = frame.buffer;
  const count = frame.eventCount;

  for (let index = 0; index < count; index++) {
    const type = eventTypes[index];
    eventCount++;
    checksum = mixChecksum(checksum, type);

    if (type === StreamEventType.START_ELEMENT || type === StreamEventType.END_ELEMENT) {
      checksum = foldString(checksum, materializeName(buffer, nameStarts[index], nameEnds[index], nameIds[index], decoder, nameCache));
    }
    if (type === StreamEventType.CHARACTERS || type === StreamEventType.CDATA) {
      const start = textStarts[index];
      checksum = foldString(checksum, start < 0 ? undefined : decodeSpan(buffer, start, textEnds[index], decoder).trim());
    }
    if (type === StreamEventType.START_ELEMENT) {
      const attrStart = attrStarts[index];
      const attrCount = attrCounts[index];
      checksum = mixChecksum(checksum, attrCount);
      const attrEnd = attrStart + attrCount;
      for (let attrIndex = attrStart; attrIndex < attrEnd; attrIndex++) {
        checksum = foldString(
          checksum,
          materializeName(buffer, attrNameStarts[attrIndex], attrNameEnds[attrIndex], attrNameIds[attrIndex], decoder, nameCache),
        );
        const value = isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, attrIndex)
          ? 'true'
          : decodeSpan(buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex], decoder);
        checksum = foldString(checksum, value);
      }
    }
  }

  return { eventCount, checksum };
}

function materializeName(buffer, start, end, nameId, decoder, nameCache) {
  if (nameId < 0 || start < 0) {
    return undefined;
  }
  if (nameCache) {
    const cached = nameCache[nameId];
    if (cached !== undefined) {
      return cached;
    }
    const value = decodeSpan(buffer, start, end, decoder);
    nameCache[nameId] = value;
    return value;
  }
  return decodeSpan(buffer, start, end, decoder);
}

function decodeSpan(buffer, start, end, decoder) {
  const ascii = decodeShortAsciiSpan(buffer, start, end);
  return ascii ?? decoder.decode(buffer.subarray(start, end));
}

function decodeShortAsciiSpan(buffer, start, end) {
  switch (end - start) {
    case 0:
      return '';
    case 1: {
      const b0 = buffer[start];
      return b0 <= 0x7f ? String.fromCharCode(b0) : undefined;
    }
    case 2: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      return (b0 | b1) <= 0x7f ? String.fromCharCode(b0, b1) : undefined;
    }
    case 3: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      return (b0 | b1 | b2) <= 0x7f ? String.fromCharCode(b0, b1, b2) : undefined;
    }
    case 4: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      return (b0 | b1 | b2 | b3) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3) : undefined;
    }
    case 5: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      return (b0 | b1 | b2 | b3 | b4) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4) : undefined;
    }
    case 6: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      return (b0 | b1 | b2 | b3 | b4 | b5) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5) : undefined;
    }
    case 7: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6) <= 0x7f ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6) : undefined;
    }
    case 8: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7)
        : undefined;
    }
    case 9: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8)
        : undefined;
    }
    case 10: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      const b9 = buffer[start + 9];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9)
        : undefined;
    }
    case 11: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      const b9 = buffer[start + 9];
      const b10 = buffer[start + 10];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10)
        : undefined;
    }
    case 12: {
      const b0 = buffer[start];
      const b1 = buffer[start + 1];
      const b2 = buffer[start + 2];
      const b3 = buffer[start + 3];
      const b4 = buffer[start + 4];
      const b5 = buffer[start + 5];
      const b6 = buffer[start + 6];
      const b7 = buffer[start + 7];
      const b8 = buffer[start + 8];
      const b9 = buffer[start + 9];
      const b10 = buffer[start + 10];
      const b11 = buffer[start + 11];
      return (b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 | b8 | b9 | b10 | b11) <= 0x7f
        ? String.fromCharCode(b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11)
        : undefined;
    }
    default:
      return undefined;
  }
}

function isImplicitAttributeValue(attrNameStarts, attrNameEnds, attrValueStarts, attrValueEnds, index) {
  return attrNameStarts[index] === attrValueStarts[index] && attrNameEnds[index] === attrValueEnds[index];
}

function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function foldString(seed, value) {
  if (!value) {
    return seed;
  }
  let next = seed;
  for (let index = 0; index < value.length; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}

function renderMarkdown(report) {
  const lines = [
    '# Monomorphic Batch Access',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This experiment keeps the full-string materialization contract: it does not filter events, skip string fields, use native addons, or use Node Buffer-specific decoding.',
    'It isolates whether monomorphic direct access to the batch frame can reduce JavaScript accessor/runtime overhead after the parser has already produced spans.',
    '',
    '## Fixture',
    '',
    `- Source: ${report.fixture.source}`,
    `- Size: ${formatBytes(report.fixture.byteLength)} (${report.fixture.byteLength} bytes)`,
    `- Runs: warmups=${report.options.warmups}, runs=${report.options.runs}`,
    '',
    '## Woodstox Target',
    '',
    ...renderWoodstoxTarget(report.woodstoxTarget),
    '',
    '## Results',
    '',
    '| Variant | Throughput | Relative to public | Woodstox ratio | 0.9x target | Average | Min | Max | Events | Checksum | Materialization |',
    '| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |',
  ];
  for (const entry of report.variants) {
    lines.push(
      `| ${entry.id} | ${formatRate(entry.mibPerSec)} | ${entry.relativeToPublic.toFixed(2)}x | `
      + `${formatOptionalRatio(entry.woodstoxRatio)} | ${entry.targetStatus} | `
      + `${formatMs(entry.avgMs)} | ${formatMs(entry.minMs)} | ${formatMs(entry.maxMs)} | `
      + `${entry.eventCount} | ${entry.checksum} | ${entry.materialization} |`,
    );
  }
  lines.push('');
  lines.push('## Parity');
  lines.push('');
  lines.push(`Status: ${report.parity.status}`);
  lines.push(`Events: ${report.parity.eventCount}`);
  lines.push(`Checksum: ${report.parity.checksum}`);
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of report.findings) {
    lines.push(`- ${finding.id}: ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}`;
}

function renderWoodstoxTarget(target) {
  if (target.status !== 'ok') {
    return [`- Status: missing (${target.path})`];
  }
  return [
    `- Baseline: ${target.baselineTool}`,
    `- Goal: ${target.goalRatio.toFixed(2)}x Woodstox`,
    `- Woodstox: ${formatOptionalRate(target.woodstoxMiBPerSec)}`,
    `- Target throughput: ${formatOptionalRate(target.targetThroughputMiB)}`,
  ];
}

function printSummary(report) {
  console.log('Monomorphic batch access');
  for (const entry of report.variants) {
    console.log(`${entry.id.padEnd(28)} ${formatRate(entry.mibPerSec).padStart(14)} relative=${entry.relativeToPublic.toFixed(2)}x events=${entry.eventCount} checksum=${entry.checksum}`);
  }
}

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
  console.log(`Wrote ${resolved}`);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatRate(value) {
  return `${value.toFixed(1)} MiB/s`;
}

function formatOptionalRate(value) {
  return Number.isFinite(value) ? formatRate(value) : 'n/a';
}

function formatOptionalRatio(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}x` : 'n/a';
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`;
}

function formatBytes(bytes) {
  const mib = bytes / MIB;
  return mib >= 1024 ? `${(mib / 1024).toFixed(2)} GiB` : `${mib.toFixed(1)} MiB`;
}

main();
