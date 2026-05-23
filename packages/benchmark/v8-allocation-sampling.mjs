import inspector from 'node:inspector';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventReaderSync, StreamEventType, StreamReaderSync, XmlEventType } from 'stax-xml';

const MIB = 1024 * 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultFile = join(__dirname, 'test-data', 'runtime-comparison-16mib.xml');
const defaultOutputDir = join(__dirname, 'results', 'v8-allocation', 'monomorphic-release');
const defaultJsonOut = join(__dirname, 'results', 'release', 'v8-allocation-sampling.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'v8-allocation-sampling.md');
const textEncoder = new TextEncoder();
const caseIds = ['public-accessor', 'event-reader-object', 'raw-frame-direct-decode', 'raw-frame-name-id-cache'];
const targetFunctions = new Set([
  'consumePublicAccessor',
  'consumeEventReaderObject',
  'consumeRawFrameDirect',
  'consumeRawFrameNameIdCache',
  'consumeRawFrame',
  'materializeName',
  'decodeSpan',
  'decodeShortAsciiSpan',
  'foldString',
]);

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    file: defaultFile,
    fileExplicit: false,
    outputDir: defaultOutputDir,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    cases: [...caseIds],
    warmups: 1,
    iterations: 2,
    samplingInterval: 16 * 1024,
    selfTest: false,
    elements: 32,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg || arg === '--') continue;
    if (arg === '--self-test') {
      options.selfTest = true;
      options.warmups = 1;
      options.iterations = 2;
      options.samplingInterval = 1024;
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
      case '--output-dir':
        options.outputDir = resolve(process.cwd(), readValue());
        break;
      case '--json-out':
        options.jsonOut = resolve(process.cwd(), readValue());
        break;
      case '--md-out':
        options.mdOut = resolve(process.cwd(), readValue());
        break;
      case '--cases':
        options.cases = parseCaseList(readValue());
        break;
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--iterations':
        options.iterations = parsePositiveInteger(readValue(), name);
        break;
      case '--sampling-interval':
        options.samplingInterval = parsePositiveInteger(readValue(), name);
        break;
      case '--elements':
        options.elements = parsePositiveInteger(readValue(), name);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function parseCaseList(value) {
  if (value === 'all') return [...caseIds];
  const parsed = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (parsed.length === 0) throw new Error('--cases must not be empty.');
  for (const entry of parsed) {
    if (!caseIds.includes(entry)) {
      throw new Error(`Unknown case: ${entry}. Expected one of ${caseIds.join(', ')}`);
    }
  }
  return parsed;
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

async function main() {
  const options = parseArgs();
  const fixture = loadFixture(options);
  mkdirSync(options.outputDir, { recursive: true });

  const cases = [];
  for (const caseId of options.cases) {
    cases.push(await sampleCase(caseId, fixture, options));
  }

  const report = createReport({ options, fixture, cases });
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
}

function loadFixture(options) {
  if (options.selfTest) {
    const xml = makeXml(options.elements);
    const bytes = textEncoder.encode(xml);
    return {
      source: 'self-test-generated',
      file: null,
      xml,
      bytes,
      byteLength: bytes.byteLength,
    };
  }

  if (!existsSync(options.file)) {
    throw new Error(`Benchmark fixture does not exist: ${options.file}`);
  }
  const bytes = readFileSync(options.file);
  const xml = readFileSync(options.file, 'utf8');
  return {
    source: 'file',
    file: options.file,
    xml,
    bytes,
    byteLength: statSync(options.file).size,
  };
}

async function sampleCase(caseId, fixture, options) {
  for (let index = 0; index < options.warmups; index++) {
    consumeCase(caseId, fixture);
  }

  globalThis.gc?.();
  const session = new inspector.Session();
  session.connect();
  try {
    await post(session, 'HeapProfiler.startSampling', { samplingInterval: options.samplingInterval });
    const samplesMs = [];
    let stable;
    for (let index = 0; index < options.iterations; index++) {
      const startedAt = performance.now();
      const result = consumeCase(caseId, fixture);
      const elapsedMs = performance.now() - startedAt;
      if (stable && (stable.eventCount !== result.eventCount || stable.checksum !== result.checksum)) {
        throw new Error(`${caseId} produced unstable event count or checksum.`);
      }
      stable ??= result;
      samplesMs.push(elapsedMs);
    }
    const { profile } = await post(session, 'HeapProfiler.stopSampling');
    const rawProfilePath = join(options.outputDir, `${caseId}.heapprofile.json`);
    writeFileSync(rawProfilePath, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
    const summary = summarizeProfile(profile);
    return {
      caseId,
      eventCount: stable.eventCount,
      checksum: stable.checksum,
      avgMs: average(samplesMs),
      samplesMs,
      sampledBytes: summary.sampledBytes,
      sampleCount: summary.sampleCount,
      targetFunctionBytes: summary.targetFunctionBytes,
      staxXmlSourceBytes: summary.staxXmlSourceBytes,
      topFrames: summary.topFrames,
      rawProfilePath,
    };
  } finally {
    session.disconnect();
  }
}

function post(session, method, params = {}) {
  return new Promise((resolvePromise, reject) => {
    session.post(method, params, (error, result) => {
      if (error) reject(error);
      else resolvePromise(result ?? {});
    });
  });
}

function summarizeProfile(profile) {
  const nodes = [];
  collectNodes(profile?.head, nodes);
  const sampledBytes = nodes.reduce((sum, node) => sum + node.selfSize, 0);
  const topFrames = nodes
    .filter(node => node.selfSize > 0)
    .sort((a, b) => b.selfSize - a.selfSize)
    .slice(0, 16)
    .map(node => ({
      functionName: node.functionName,
      url: node.url,
      lineNumber: node.lineNumber,
      columnNumber: node.columnNumber,
      selfSize: node.selfSize,
      percent: sampledBytes > 0 ? node.selfSize / sampledBytes : 0,
    }));
  return {
    sampledBytes,
    sampleCount: Array.isArray(profile?.samples) ? profile.samples.length : 0,
    targetFunctionBytes: nodes
      .filter(node => targetFunctions.has(node.functionName))
      .reduce((sum, node) => sum + node.selfSize, 0),
    staxXmlSourceBytes: nodes
      .filter(node => /(?:packages[\\/])?stax-xml[\\/]/.test(node.url) || /node_modules[\\/]stax-xml[\\/]/.test(node.url))
      .reduce((sum, node) => sum + node.selfSize, 0),
    topFrames,
  };
}

function collectNodes(node, output) {
  if (!node) return;
  const callFrame = node.callFrame ?? {};
  output.push({
    id: node.id,
    selfSize: Number(node.selfSize ?? 0),
    functionName: callFrame.functionName || '(anonymous)',
    url: callFrame.url || '',
    lineNumber: Number(callFrame.lineNumber ?? -1),
    columnNumber: Number(callFrame.columnNumber ?? -1),
  });
  for (const child of node.children ?? []) {
    collectNodes(child, output);
  }
}

function createReport({ options, fixture, cases }) {
  const parity = computeParity(cases);
  return {
    generatedAt: new Date().toISOString(),
    objective: 'v8-allocation-sampling',
    contract: 'inspector-heapprofiler-sampling',
    note: 'V8 inspector HeapProfiler allocation sampling for full-string JavaScript reader shapes. Sampling is statistical and runtime-specific.',
    environment: {
      node: process.version,
      v8: process.versions.v8,
      platform: `${process.platform}-${process.arch}`,
      cpuName: cpus()[0]?.model ?? 'unknown',
    },
    fixture: {
      source: fixture.source,
      file: fixture.file,
      byteLength: fixture.byteLength,
      sizeMiB: fixture.byteLength / MIB,
    },
    options: {
      warmups: options.warmups,
      iterations: options.iterations,
      samplingInterval: options.samplingInterval,
      cases: options.cases,
    },
    rawArtifacts: {
      outputDir: options.outputDir,
      committed: false,
      profiles: cases.map(entry => entry.rawProfilePath),
    },
    parity,
    cases,
    findings: createFindings(cases),
  };
}

function computeParity(cases) {
  const first = cases[0];
  const mismatch = cases.find(entry => entry.eventCount !== first.eventCount || entry.checksum !== first.checksum);
  if (mismatch) {
    throw new Error(`Case ${mismatch.caseId} does not match ${first.caseId}.`);
  }
  return {
    status: 'ok',
    eventCount: first.eventCount,
    checksum: first.checksum,
  };
}

function createFindings(cases) {
  return [
    {
      id: 'same-contract-result',
      classification: 'TRACE_FACT',
      summary: 'All sampled shapes preserved the same event count and checksum during allocation sampling.',
      evidence: cases.map(entry => `${entry.caseId}: events=${entry.eventCount}, checksum=${entry.checksum}`),
    },
    {
      id: 'sampled-allocation-shape',
      classification: 'TRACE_FACT',
      summary: 'HeapProfiler sampled JavaScript allocation bytes per full-string reader shape in this Node/V8 build.',
      evidence: cases.map(entry => `${entry.caseId}: sampledBytes=${entry.sampledBytes}, targetFunctionBytes=${entry.targetFunctionBytes}, staxXmlSourceBytes=${entry.staxXmlSourceBytes}`),
    },
    {
      id: 'sampling-attribution-limit',
      classification: 'TRACE_FACT_LIMIT',
      summary: 'Function/source byte attribution is based on sampled self-size frames and can attribute work to native frames instead of the JavaScript caller.',
      evidence: [
        'A zero source-byte bucket in this report does not mean the reader performed no work or allocated no values.',
      ],
    },
    {
      id: 'allocation-sampling-not-ceiling-proof',
      classification: 'TRACE_FACT_LIMIT',
      summary: 'This is statistical allocation evidence for one runtime/build/input, not a proof that JavaScript runtimes have no further headroom.',
      evidence: [
        'Need larger fixtures, browser/Bun/JSC runs, and deeper source/asm evidence before promoting runtime-limit claims.',
      ],
    },
  ];
}

function renderMarkdown(report) {
  const lines = [
    '# V8 Allocation Sampling',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report is a TRACE_FACT for one Node/V8 build and one fixture.',
    'It uses inspector `HeapProfiler.startSampling` / `HeapProfiler.stopSampling` around each full-string reader shape.',
    'It is not a proof that JavaScript runtimes have no further headroom.',
    '',
    '## Environment',
    '',
    `- Node: ${report.environment.node}`,
    `- V8: ${report.environment.v8}`,
    `- Platform: ${report.environment.platform}`,
    `- CPU: ${report.environment.cpuName}`,
    `- Fixture: ${report.fixture.source}${report.fixture.file ? ` (${report.fixture.file})` : ''}`,
    `- Fixture size: ${formatBytes(report.fixture.byteLength)} (${report.fixture.byteLength} bytes)`,
    `- Runs: warmups=${report.options.warmups}, iterations=${report.options.iterations}`,
    `- Sampling interval: ${report.options.samplingInterval} bytes`,
    '',
    '## Raw Artifacts',
    '',
    `- Output dir: ${report.rawArtifacts.outputDir}`,
    `- Committed: ${report.rawArtifacts.committed ? 'yes' : 'no'}`,
    '',
    '## Results',
    '',
    '| Case | Avg time | Events | Checksum | Sampled bytes | Samples | Target function bytes | stax-xml source bytes |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const entry of report.cases) {
    lines.push(`| ${entry.caseId} | ${formatMs(entry.avgMs)} | ${entry.eventCount} | ${entry.checksum} | ${formatBytes(entry.sampledBytes)} | ${entry.sampleCount} | ${formatBytes(entry.targetFunctionBytes)} | ${formatBytes(entry.staxXmlSourceBytes)} |`);
  }

  lines.push('');
  lines.push('## Top Frames');
  lines.push('');
  for (const entry of report.cases) {
    lines.push(`### ${entry.caseId}`);
    lines.push('');
    if (entry.topFrames.length === 0) {
      lines.push('- No sampled allocation frames.');
      lines.push('');
      continue;
    }
    lines.push('| Function | Self size | Percent | Source |');
    lines.push('| --- | ---: | ---: | --- |');
    for (const frame of entry.topFrames.slice(0, 8)) {
      lines.push(`| ${escapePipe(frame.functionName)} | ${formatBytes(frame.selfSize)} | ${(frame.percent * 100).toFixed(1)}% | ${escapePipe(formatFrameSource(frame))} |`);
    }
    lines.push('');
  }

  lines.push('## Parity');
  lines.push('');
  lines.push(`Status: ${report.parity.status}`);
  lines.push(`Events: ${report.parity.eventCount}`);
  lines.push(`Checksum: ${report.parity.checksum}`);
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

function formatFrameSource(frame) {
  if (!frame.url) return '(native or anonymous)';
  return `${frame.url}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`;
}

function printSummary(report) {
  console.log('V8 allocation sampling');
  for (const entry of report.cases) {
    console.log(`${entry.caseId}: sampled=${formatBytes(entry.sampledBytes)} samples=${entry.sampleCount} events=${entry.eventCount} checksum=${entry.checksum}`);
  }
}

function consumeCase(caseId, fixture) {
  switch (caseId) {
    case 'public-accessor':
      return consumePublicAccessor(fixture.bytes);
    case 'event-reader-object':
      return consumeEventReaderObject(fixture.xml);
    case 'raw-frame-direct-decode':
      return consumeRawFrameDirect(fixture.bytes);
    case 'raw-frame-name-id-cache':
      return consumeRawFrameNameIdCache(fixture.bytes);
    default:
      throw new Error(`Unknown case: ${caseId}`);
  }
}

function makeXml(elements) {
  const parts = ['<?xml version="1.0" encoding="UTF-8"?>\n<root>\n'];
  for (let id = 0; id < elements; id++) {
    parts.push(
      `  <book id="book-${id}" lang="en" code="${id % 97}">`
      + `<title>Runtime Benchmark ${id}</title>`
      + `<author>Author ${id % 4096}</author>`
      + `<description>Full string checksum text payload ${id} with stable words and numbers.</description>`
      + `<chapter number="1">Intro ${id}</chapter>`
      + `<chapter number="2">Body ${id}</chapter>`
      + '</book>\n',
    );
  }
  parts.push('</root>\n');
  return parts.join('');
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

function consumeEventReaderObject(xml) {
  let eventCount = 0;
  let checksum = 0;

  for (const event of new EventReaderSync(xml)) {
    const typeCode = publicEventTypeCode(event.type);
    eventCount++;
    checksum = mixChecksum(checksum, typeCode);

    if (event.type === XmlEventType.START_ELEMENT || event.type === XmlEventType.END_ELEMENT) {
      checksum = foldString(checksum, event.name);
    }
    if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
      checksum = foldString(checksum, event.value?.trim());
    }
    if (event.type === XmlEventType.START_ELEMENT) {
      const entries = Object.entries(event.attributes);
      checksum = mixChecksum(checksum, entries.length);
      for (const [name, value] of entries) {
        checksum = foldString(checksum, name);
        checksum = foldString(checksum, value);
      }
    }
  }

  return { eventCount, checksum };
}

function publicEventTypeCode(type) {
  switch (type) {
    case XmlEventType.START_DOCUMENT:
      return 0;
    case XmlEventType.END_DOCUMENT:
      return 1;
    case XmlEventType.START_ELEMENT:
      return 2;
    case XmlEventType.END_ELEMENT:
      return 3;
    case XmlEventType.CHARACTERS:
      return 4;
    case XmlEventType.CDATA:
      return 5;
    default:
      return 6;
  }
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
  if (frame.kind !== 'frame') {
    throw new Error(`Unsupported raw batch kind in allocation sampler: ${frame.kind}`);
  }

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

function writeOutput(path, content) {
  const resolved = resolve(process.cwd(), path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, content, 'utf8');
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`;
}

function formatBytes(bytes) {
  const absBytes = Math.abs(bytes);
  if (absBytes >= 1024 * MIB) return `${(bytes / (1024 * MIB)).toFixed(2)} GiB`;
  if (absBytes >= MIB) return `${(bytes / MIB).toFixed(1)} MiB`;
  if (absBytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes.toFixed(0)} B`;
}

function escapePipe(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

await main();
