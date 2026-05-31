import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StreamEventType, StreamReaderSync } from 'stax-xml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');
const defaultOutputDir = join(__dirname, 'results', 'v8-codegen', `monomorphic-shape-${Date.now()}`);
const defaultJsonOut = join(__dirname, 'results', 'release', 'v8-monomorphic-shape-trace.json');
const defaultMdOut = join(__dirname, 'results', 'release', 'v8-monomorphic-shape-trace.md');
const warmupMarker = '[stax-v8-monomorphic-shape] warmup-complete';
const textEncoder = new TextEncoder();

const caseIds = [
  'public-accessor',
  'raw-frame-direct-decode',
  'raw-frame-name-id-cache',
];
const targetFunctions = [
  'consumePublicAccessor',
  'consumeRawFrameDirect',
  'consumeRawFrameNameIdCache',
  'consumeRawFrame',
  'materializeName',
  'decodeSpan',
  'foldString',
];
const costPatterns = [
  ['CallApiCallback', /CallApiCallback/g],
  ['CEntry', /\bCEntry(?:\b|_)/g],
  ['TypedArrayPrototypeSubArray', /TypedArrayPrototypeSubArray/g],
  ['TextDecoderDecode', /TextDecoder|decodeUTF8|_decode|validateDecoder/g],
  ['LoadIC', /\bLoadIC\b/g],
  ['KeyedLoadIC', /\bKeyedLoadIC\b/g],
  ['StoreIC', /\bStoreIC\b/g],
  ['KeyedStoreIC', /\bKeyedStoreIC\b/g],
  ['Runtime', /\bRuntime_|CallRuntime|TailCallRuntime/g],
  ['DeoptExit', /deopt reason|deopt index|bailout|deopt-eager/g],
];

globalThis.__staxXmlMonomorphicTraceSink = 0;

const options = parseArgs(process.argv.slice(2));
if (options.mode === 'driver') {
  runDriver(options);
} else if (options.mode === 'run') {
  runTraceCase(options);
} else {
  runSelfTest(options);
}

function parseArgs(argv) {
  const options = {
    mode: 'driver',
    cases: [...caseIds],
    caseId: 'raw-frame-name-id-cache',
    functions: [...targetFunctions],
    outputDir: defaultOutputDir,
    jsonOut: defaultJsonOut,
    mdOut: defaultMdOut,
    warmups: 120,
    iterations: 24,
    elements: 512,
    fixtureFile: null,
    quick: false,
    skipOptCode: false,
    skipTrace: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg === '--quick') {
      options.quick = true;
      options.warmups = 24;
      options.iterations = 6;
      options.elements = 128;
      continue;
    }
    if (arg === '--skip-opt-code') {
      options.skipOptCode = true;
      continue;
    }
    if (arg === '--skip-trace') {
      options.skipTrace = true;
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
      case '--mode':
        options.mode = parseChoice(readValue(), ['driver', 'run', 'self-test'], name);
        break;
      case '--case':
        options.caseId = parseChoice(readValue(), caseIds, name);
        break;
      case '--cases':
        options.cases = parseList(readValue(), caseIds, name);
        break;
      case '--functions':
        options.functions = parseList(readValue(), targetFunctions, name);
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
      case '--warmups':
        options.warmups = parseNonNegativeInteger(readValue(), name);
        break;
      case '--iterations':
        options.iterations = parsePositiveInteger(readValue(), name);
        break;
      case '--elements':
        options.elements = parsePositiveInteger(readValue(), name);
        break;
      case '--fixture-file':
        options.fixtureFile = resolve(process.cwd(), readValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function parseChoice(value, allowed, flag) {
  if (!allowed.includes(value)) {
    throw new Error(`${flag} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

function parseList(value, allowed, flag) {
  if (value === 'all') return [...allowed];
  const entries = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0) throw new Error(`${flag} must not be empty.`);
  for (const entry of entries) {
    if (!allowed.includes(entry)) {
      throw new Error(`${flag} contains unknown id ${entry}. Expected: ${allowed.join(', ')}`);
    }
  }
  return entries;
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

function runDriver(options) {
  mkdirSync(options.outputDir, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    v8: process.versions.v8,
    cpuName: cpus()[0]?.model ?? 'unknown',
    platform: `${process.platform}-${process.arch}`,
    outputDir: options.outputDir,
    cases: options.cases,
    functions: options.functions,
    warmups: options.warmups,
    iterations: options.iterations,
    elements: options.elements,
    fixtureFile: options.fixtureFile,
    quick: options.quick,
    artifacts: [],
  };

  for (const caseId of options.cases) {
    if (!options.skipTrace) {
      manifest.artifacts.push(runTraceProcess(options, {
        kind: 'trace',
        caseId,
        flags: ['--allow-natives-syntax', '--trace-opt', '--trace-deopt', '--trace-file-names'],
        fileName: `${caseId}-trace.log`,
      }));
    }

    if (!options.skipOptCode) {
      for (const functionName of options.functions) {
        manifest.artifacts.push(runTraceProcess(options, {
          kind: 'optcode',
          caseId,
          functionName,
          flags: [
            '--allow-natives-syntax',
            '--print-opt-code',
            `--print-opt-code-filter=${functionName}`,
            '--print-opt-source',
          ],
          fileName: `${caseId}-${functionName}-optcode.log`,
        }));
      }
    }
  }

  const rawManifestPath = join(options.outputDir, 'manifest.json');
  writeFileSync(rawManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const summary = buildSummary(manifest, rawManifestPath);
  writeOutput(options.jsonOut, `${JSON.stringify(summary, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(summary));
  console.log(`V8 monomorphic shape trace summary: ${options.jsonOut}`);
}

function runTraceProcess(options, trace) {
  const logPath = join(options.outputDir, trace.fileName);
  const args = [
    ...trace.flags,
    __filename,
    '--mode=run',
    `--case=${trace.caseId}`,
    `--warmups=${options.warmups}`,
    `--iterations=${options.iterations}`,
    `--elements=${options.elements}`,
    ...(options.fixtureFile ? [`--fixture-file=${options.fixtureFile}`] : []),
  ];
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 128 * 1024 * 1024,
  });
  const elapsedMs = Date.now() - startedAt;
  writeFileSync(logPath, [
    `$ ${[process.execPath, ...args].join(' ')}`,
    `cwd=${repoRoot}`,
    `exit=${result.status} elapsedMs=${elapsedMs}`,
    '',
    '--- stdout ---',
    result.stdout ?? '',
    '',
    '--- stderr ---',
    result.stderr ?? '',
  ].join('\n'));

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${trace.kind} trace failed for ${trace.caseId}${trace.functionName ? `/${trace.functionName}` : ''}. See ${logPath}`);
  }

  return {
    kind: trace.kind,
    caseId: trace.caseId,
    functionName: trace.functionName,
    logPath,
    elapsedMs,
    exit: result.status,
    bytes: existsSync(logPath) ? readFileSync(logPath, 'utf8').length : 0,
  };
}

function buildSummary(manifest, rawManifestPath) {
  const cases = manifest.cases.map((caseId) => analyzeCase(manifest, caseId));
  return {
    generatedAt: new Date().toISOString(),
    objective: 'v8-monomorphic-shape-trace',
    contract: 'trace-fact-only',
    note: 'V8 trace and optimized-code signals for monomorphic JavaScript reader shapes. This is not a throughput benchmark or impossibility proof.',
    environment: {
      node: manifest.node,
      v8: manifest.v8,
      cpuName: manifest.cpuName,
      platform: manifest.platform,
    },
    fixture: {
      source: manifest.fixtureFile ? 'corpus-file' : 'self-generated',
      file: manifest.fixtureFile,
      elements: manifest.elements,
      byteLength: loadFixtureBytes({
        elements: manifest.elements,
        fixtureFile: manifest.fixtureFile,
      }).byteLength,
    },
    options: {
      warmups: manifest.warmups,
      iterations: manifest.iterations,
      quick: manifest.quick,
      cases: manifest.cases,
      functions: manifest.functions,
    },
    rawArtifacts: {
      manifestPath: rawManifestPath,
      outputDir: manifest.outputDir,
      committed: false,
    },
    cases,
    findings: createFindings(cases),
  };
}

function analyzeCase(manifest, caseId) {
  const artifacts = manifest.artifacts.filter((artifact) => artifact.caseId === caseId);
  const traceArtifacts = artifacts.filter((artifact) => artifact.kind === 'trace');
  const optArtifacts = artifacts.filter((artifact) => artifact.kind === 'optcode');
  const optimizedFunctions = new Set();
  const deoptLines = [];
  const warmupDeoptLines = [];
  const postWarmupDeoptLines = [];
  let result;

  for (const artifact of traceArtifacts) {
    if (!existsSync(artifact.logPath)) continue;
    let phase = 'warmup';
    for (const line of readFileSync(artifact.logPath, 'utf8').split('\n')) {
      if (line.includes(warmupMarker)) {
        phase = 'post-warmup';
        continue;
      }
      if (/completed optimizing/.test(line)) {
        const match = line.match(/<JSFunction ([^ ]+)/);
        if (match) optimizedFunctions.add(match[1]);
      }
      if (/bailout|deopt/i.test(line)) {
        deoptLines.push(line);
        if (phase === 'post-warmup') {
          postWarmupDeoptLines.push(line);
        } else {
          warmupDeoptLines.push(line);
        }
      }
      const jsonMatch = line.match(/\{"caseId":.+\}$/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    }
  }

  const patternCounts = Object.fromEntries(costPatterns.map(([name]) => [name, 0]));
  const optCodeFiles = [];
  for (const artifact of optArtifacts) {
    if (!existsSync(artifact.logPath)) continue;
    const text = readFileSync(artifact.logPath, 'utf8');
    optCodeFiles.push({
      functionName: artifact.functionName,
      bytes: text.length,
      path: artifact.logPath,
      riskCounts: countCostPatterns(text),
      sourceSnippets: extractFunctionSources(text),
    });
    for (const [name, value] of Object.entries(countCostPatterns(text))) {
      patternCounts[name] += value;
    }
  }

  const status = postWarmupDeoptLines.length > 0
    ? 'deopt-after-warmup'
    : optimizedFunctions.size > 0 ? 'optimized-no-post-warmup-deopt' : 'no-optimization-seen';

  return {
    caseId,
    status,
    result,
    optimizedFunctions: [...optimizedFunctions].sort(),
    deoptCount: deoptLines.length,
    warmupDeoptCount: warmupDeoptLines.length,
    postWarmupDeoptCount: postWarmupDeoptLines.length,
    postWarmupDeoptSamples: postWarmupDeoptLines.slice(0, 8).map((line) => line.slice(0, 260)),
    patternCounts,
    optCodeFiles,
  };
}

function countCostPatterns(text) {
  return Object.fromEntries(costPatterns.map(([name, pattern]) => [name, countMatches(text, pattern)]));
}

function countMatches(text, pattern) {
  pattern.lastIndex = 0;
  let count = 0;
  while (pattern.exec(text) !== null) count++;
  return count;
}

function extractFunctionSources(text) {
  const snippets = [];
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const header = lines[index];
    if (!header?.includes('--- FUNCTION SOURCE')) continue;
    snippets.push({
      header: header.slice(0, 180),
      source: (lines[index + 1] ?? '').slice(0, 260),
    });
  }
  return snippets.slice(0, 3);
}

function createFindings(cases) {
  return [
    {
      id: 'post-warmup-deopt-gate',
      summary: 'Records whether each reader shape deoptimized after the warmup marker in this Node/V8 run.',
      evidence: cases.map((entry) => `${entry.caseId}: status=${entry.status}, postWarmupDeopts=${entry.postWarmupDeoptCount}`),
    },
    {
      id: 'optimized-code-risk-signals',
      summary: 'Counts selected V8 optimized-code/runtime/native-call signals in filtered optcode logs.',
      evidence: cases.map((entry) => `${entry.caseId}: ${formatSignals(entry.patternCounts)}`),
    },
  ];
}

function renderMarkdown(summary) {
  const lines = [
    '# V8 Monomorphic Shape Trace',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    'This report is a TRACE_FACT for one Node/V8 build and one generated fixture.',
    'It summarizes raw V8 trace/optimized-code logs without committing those large raw logs.',
    'It is not a proof that JavaScript runtimes have no further headroom.',
    '',
    '## Environment',
    '',
    `- Node: ${summary.environment.node}`,
    `- V8: ${summary.environment.v8}`,
    `- Platform: ${summary.environment.platform}`,
    `- CPU: ${summary.environment.cpuName}`,
    `- Fixture: ${summary.fixture.source}${summary.fixture.file ? ` (${summary.fixture.file})` : `, ${summary.fixture.elements} generated elements`}, ${summary.fixture.byteLength} bytes`,
    `- Runs: warmups=${summary.options.warmups}, iterations=${summary.options.iterations}`,
    '',
    '## Raw Artifacts',
    '',
    `- Output dir: ${summary.rawArtifacts.outputDir}`,
    `- Manifest: ${summary.rawArtifacts.manifestPath}`,
    `- Committed: ${summary.rawArtifacts.committed ? 'yes' : 'no'}`,
    '',
    '## Trace Gate',
    '',
    '| Case | Status | Events | Checksum | Optimized functions | Deopts warmup/post-warmup |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
  ];
  for (const entry of summary.cases) {
    lines.push(
      `| ${entry.caseId} | ${entry.status} | ${entry.result?.eventCount ?? 'n/a'} | `
      + `${entry.result?.checksum ?? 'n/a'} | ${entry.optimizedFunctions.length} | `
      + `${entry.warmupDeoptCount}/${entry.postWarmupDeoptCount} |`,
    );
  }

  lines.push('');
  lines.push('## Optimized-Code Signals');
  lines.push('');
  lines.push('| Case | Native/runtime/IC/deopt signals | Optcode files |');
  lines.push('| --- | --- | ---: |');
  for (const entry of summary.cases) {
    lines.push(`| ${entry.caseId} | ${formatSignals(entry.patternCounts)} | ${entry.optCodeFiles.length} |`);
  }

  lines.push('');
  lines.push('## Findings');
  lines.push('');
  for (const finding of summary.findings) {
    lines.push(`- ${finding.id}: ${finding.summary}`);
    for (const evidence of finding.evidence) {
      lines.push(`  - ${evidence}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}`;
}

function formatSignals(counts) {
  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => `${name}=${value}`)
    .join(', ') || 'none';
}

function runTraceCase(options) {
  const bytes = loadFixtureBytes(options);
  let last;
  for (let index = 0; index < options.warmups + options.iterations; index++) {
    last = consumeCase(options.caseId, bytes);
    if (index + 1 === options.warmups) {
      console.log(warmupMarker);
    }
  }
  globalThis.__staxXmlMonomorphicTraceSink = mixChecksum(
    globalThis.__staxXmlMonomorphicTraceSink,
    last.checksum,
  );
  console.log(JSON.stringify({
    caseId: options.caseId,
    warmups: options.warmups,
    iterations: options.iterations,
    elements: options.elements,
    fixtureFile: options.fixtureFile,
    fixtureBytes: bytes.byteLength,
    eventCount: last.eventCount,
    checksum: last.checksum,
    sink: globalThis.__staxXmlMonomorphicTraceSink >>> 0,
  }));
}

function runSelfTest(options) {
  const bytes = options.fixtureFile
    ? loadFixtureBytes(options)
    : textEncoder.encode(makeXml(Math.min(options.elements, 16)));
  const results = caseIds.map((caseId) => [caseId, consumeCase(caseId, bytes)]);
  const [, first] = results[0];
  for (const [caseId, result] of results) {
    if (result.eventCount !== first.eventCount || result.checksum !== first.checksum) {
      throw new Error(`Self-test mismatch for ${caseId}.`);
    }
  }
  console.log(JSON.stringify({
    status: 'ok',
    eventCount: first.eventCount,
    checksum: first.checksum,
  }));
}

function loadFixtureBytes(options) {
  if (options.fixtureFile) {
    return readFileSync(options.fixtureFile);
  }
  return textEncoder.encode(makeXml(options.elements));
}

function consumeCase(caseId, bytes) {
  switch (caseId) {
    case 'public-accessor':
      return consumePublicAccessor(bytes);
    case 'raw-frame-direct-decode':
      return consumeRawFrameDirect(bytes);
    case 'raw-frame-name-id-cache':
      return consumeRawFrameNameIdCache(bytes);
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
    throw new Error(`Unsupported raw batch kind in V8 trace benchmark: ${frame.kind}`);
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
