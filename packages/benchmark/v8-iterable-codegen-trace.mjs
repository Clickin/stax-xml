import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IterableEventType, IterableReader, toByteBatches } from 'stax-xml/iterable';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');

const FIXTURE_IDS = ['attribute-heavy', 'high-cardinality', 'mixed-utf8', 'shuffled-attribute-order'];
const TIER_IDS = ['count-only', 'attr-object-batch', 'attr-direct-loop', 'attr-frame-loop', 'full-string-direct'];
const TARGET_FUNCTIONS = [
  'nextBatch',
  'nextBatchFrame',
  'batchFrame',
  'refreshFrame',
  'prepareBuffer',
  'parseBuffer',
  'intern',
  'internName',
  'lookupNameId',
  'nameEquals',
  'decodeSpan',
  'parseTag',
  'parseBangTag',
  'parseProcessingInstruction',
  'parseEndTag',
  'parseStartTag',
  'parseAttributes',
  'addAttribute',
  'addEvent',
  'addText',
  'copyName',
  'copyText',
  'copyAttributesObject',
  'copyAttrName',
  'copyAttrValue',
  'consumeParser',
];
const COST_PATTERNS = [
  ['CallApiCallback', /CallApiCallback/g],
  ['CEntry', /\bCEntry(?:\b|_)/g],
  ['TypedArrayPrototypeSubArray', /TypedArrayPrototypeSubArray/g],
  ['TextDecoderDecode', /TextDecoder|decodeUTF8|_decode|validateDecoder/g],
  ['LoadIC', /\bLoadIC\b/g],
  ['KeyedLoadIC', /\bKeyedLoadIC\b/g],
  ['StoreIC', /\bStoreIC\b/g],
  ['KeyedStoreIC', /\bKeyedStoreIC\b/g],
  ['SetKeyedProperty', /SetKeyedProperty/g],
  ['Runtime', /\bRuntime_|CallRuntime|TailCallRuntime/g],
  ['DeoptExit', /deopt reason|deopt index|bailout|deopt-eager/g],
];
const HOT_ASSEMBLY_FUNCTIONS = new Set([
  'parseBuffer',
  'parseStartTag',
  'parseAttributes',
  'internName',
  'lookupNameId',
  'decodeSpan',
  'copyName',
  'copyText',
  'copyAttrName',
  'copyAttrValue',
  'copyAttributesObject',
]);
const ASSEMBLY_RISK_PATTERNS = [
  ['overflowChecks', /\bjo\b/g],
  ['overflowDeopts', /deopt reason\s+'overflow'/g],
  ['boundsDeopts', /deopt reason\s+'out of bounds'/g],
  ['wrongMapDeopts', /deopt reason\s+'wrong map'/g],
  ['wrongCallTargetDeopts', /deopt reason\s+'wrong call target'/g],
  ['runtimeCalls', /\bRuntime_|CallRuntime|TailCallRuntime/g],
  ['cEntryCalls', /\bCEntry(?:\b|_)/g],
  ['typedArraySubArray', /TypedArrayPrototypeSubArray/g],
  ['textDecoderSignals', /TextDecoder|decodeUTF8|_decode|validateDecoder/g],
];
const DEFAULT_MATRIX = [
  ['attribute-heavy', 'count-only'],
  ['attribute-heavy', 'attr-frame-loop'],
  ['attribute-heavy', 'attr-object-batch'],
  ['high-cardinality', 'count-only'],
  ['high-cardinality', 'attr-frame-loop'],
  ['high-cardinality', 'attr-object-batch'],
  ['mixed-utf8', 'full-string-direct'],
];

const DEFAULT_WARMUPS = 150;
const DEFAULT_ITERATIONS = 20;
const DEFAULT_ELEMENTS = 512;
const DEFAULT_CHUNK_SIZE = 4096;
const DEFAULT_BATCH_SIZE = 4;
const ATTR_OBJECT_SINK_SIZE = 1024;
const WARMUP_COMPLETE_MARKER = '[stax-v8-trace] warmup-complete';
const attrObjectSink = createSparseSlots(ATTR_OBJECT_SINK_SIZE);
const frameChecksumDecoder = new TextDecoder('utf-8');

globalThis.__staxXmlV8TraceSink = 0;

function createSparseSlots(size) {
  const slots = [];
  slots.length = size;
  return slots;
}

function parseArgs(argv) {
  const options = {
    mode: 'driver',
    fixture: 'attribute-heavy',
    tier: 'count-only',
    matrix: DEFAULT_MATRIX.map(([fixture, tier]) => ({ fixture, tier })),
    functions: [...TARGET_FUNCTIONS],
    outputDir: join(__dirname, 'results', 'v8-codegen', String(Date.now())),
    warmups: DEFAULT_WARMUPS,
    iterations: DEFAULT_ITERATIONS,
    elements: DEFAULT_ELEMENTS,
    chunkSize: DEFAULT_CHUNK_SIZE,
    batchSize: DEFAULT_BATCH_SIZE,
    quick: false,
    skipBytecode: false,
    skipOptCode: false,
    skipTrace: false,
    wholeParser: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg === '--quick') {
      options.quick = true;
      options.warmups = 20;
      options.iterations = 4;
      options.elements = 96;
      continue;
    }
    if (arg === '--skip-bytecode') {
      options.skipBytecode = true;
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
    if (arg === '--whole-parser') {
      options.wholeParser = true;
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
      case '--fixture':
        options.fixture = parseChoice(readValue(), FIXTURE_IDS, name);
        break;
      case '--tier':
        options.tier = parseChoice(readValue(), TIER_IDS, name);
        break;
      case '--matrix':
        options.matrix = parseMatrix(readValue());
        break;
      case '--functions':
        options.functions = parseList(readValue(), TARGET_FUNCTIONS, name);
        break;
      case '--output-dir':
        options.outputDir = resolve(process.cwd(), readValue());
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
      case '--chunk-size':
        options.chunkSize = parsePositiveInteger(readValue(), name);
        break;
      case '--batch-size':
        options.batchSize = parsePositiveInteger(readValue(), name);
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
  const entries = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (entries.length === 0) throw new Error(`${flag} must not be empty.`);
  for (const entry of entries) {
    if (!allowed.includes(entry)) throw new Error(`${flag} contains unknown id ${entry}. Expected: ${allowed.join(', ')}`);
  }
  return entries;
}

function parseMatrix(value) {
  const entries = value.split(',').map(entry => entry.trim()).filter(Boolean);
  if (entries.length === 0) throw new Error('--matrix must not be empty.');
  return entries.map(entry => {
    const [fixture, tier] = entry.split(':');
    if (!fixture || !tier) throw new Error(`Invalid matrix entry ${entry}. Expected fixture:tier.`);
    return {
      fixture: parseChoice(fixture, FIXTURE_IDS, '--matrix fixture'),
      tier: parseChoice(tier, TIER_IDS, '--matrix tier'),
    };
  });
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
    outputDir: options.outputDir,
    warmups: options.warmups,
    iterations: options.iterations,
    elements: options.elements,
    chunkSize: options.chunkSize,
    batchSize: options.batchSize,
    matrix: options.matrix,
    functions: options.functions,
    wholeParser: options.wholeParser,
    artifacts: [],
  };

  for (const { fixture, tier } of options.matrix) {
    if (!options.skipTrace) {
      manifest.artifacts.push(runTraceProcess(options, {
        fixture,
        tier,
        kind: 'trace',
        flags: ['--allow-natives-syntax', '--trace-opt', '--trace-deopt', '--trace-file-names'],
        fileName: `${fixture}-${tier}-trace.log`,
      }));
    }

    if (options.wholeParser && !options.skipOptCode) {
      manifest.artifacts.push(runTraceProcess(options, {
        fixture,
        tier,
        kind: 'whole-optcode',
        flags: [
          '--allow-natives-syntax',
          '--print-opt-code',
          '--print-opt-source',
        ],
        fileName: `${fixture}-${tier}-whole-optcode.log`,
      }));
    }

    for (const functionName of options.functions) {
      if (!options.skipBytecode) {
        manifest.artifacts.push(runTraceProcess(options, {
          fixture,
          tier,
          functionName,
          kind: 'bytecode',
          flags: ['--print-bytecode', `--print-bytecode-filter=${functionName}`],
          fileName: `${fixture}-${tier}-${functionName}-bytecode.log`,
        }));
      }
      if (!options.skipOptCode) {
        manifest.artifacts.push(runTraceProcess(options, {
          fixture,
          tier,
          functionName,
          kind: 'optcode',
          flags: [
            '--allow-natives-syntax',
            '--print-opt-code',
            `--print-opt-code-filter=${functionName}`,
            '--print-opt-source',
          ],
          fileName: `${fixture}-${tier}-${functionName}-optcode.log`,
        }));
      }
    }
  }

  const manifestPath = join(options.outputDir, 'manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeAssemblySummary(options.outputDir, manifest);
  console.log(`V8 iterable codegen traces saved to ${options.outputDir}`);
  console.log(`Manifest: ${manifestPath}`);
}

function runTraceProcess(options, trace) {
  const logPath = join(options.outputDir, trace.fileName);
  const args = [
    ...trace.flags,
    __filename,
    '--mode=run',
    `--fixture=${trace.fixture}`,
    `--tier=${trace.tier}`,
    `--warmups=${options.warmups}`,
    `--iterations=${options.iterations}`,
    `--elements=${options.elements}`,
    `--chunk-size=${options.chunkSize}`,
    `--batch-size=${options.batchSize}`,
  ];
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 256 * 1024 * 1024,
  });
  const elapsedMs = Date.now() - startedAt;

  writeFileSync(logPath, [
    `$ ${[process.execPath, ...args].join(' ')}`,
    `cwd=${REPO_ROOT}`,
    `exit=${result.status} elapsedMs=${elapsedMs}`,
    '',
    '--- stdout ---',
    result.stdout ?? '',
    '',
    '--- stderr ---',
    result.stderr ?? '',
  ].join('\n'));

  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${trace.kind} trace failed for ${trace.fixture}/${trace.tier}${trace.functionName ? `/${trace.functionName}` : ''}. See ${logPath}`);

  console.log(`[trace] ${trace.kind} ${trace.fixture}/${trace.tier}${trace.functionName ? `/${trace.functionName}` : ''} -> ${logPath}`);
  return {
    kind: trace.kind,
    fixture: trace.fixture,
    tier: trace.tier,
    functionName: trace.functionName,
    logPath,
    elapsedMs,
    exit: result.status,
  };
}

function writeAssemblySummary(outputDir, manifest) {
  const summary = buildAssemblySummary(manifest);
  const jsonPath = join(outputDir, 'assembly-summary.json');
  const mdPath = join(outputDir, 'assembly-report.md');
  writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(mdPath, formatAssemblyReport(summary));
}

function buildAssemblySummary(manifest) {
  const scenarios = [];
  for (const { fixture, tier } of manifest.matrix) {
    const artifacts = (manifest.artifacts ?? []).filter(artifact => artifact.fixture === fixture && artifact.tier === tier);
    const traceArtifacts = artifacts.filter(artifact => artifact.kind === 'trace');
    const optArtifacts = artifacts.filter(artifact => artifact.kind === 'optcode' || artifact.kind === 'whole-optcode');
    const bytecodeArtifacts = artifacts.filter(artifact => artifact.kind === 'bytecode');
    const traceLines = [];
    const optimizedFunctions = new Set();
    const deoptLines = [];
    const warmupDeoptLines = [];
    const postWarmupDeoptLines = [];

    for (const artifact of traceArtifacts) {
      if (!existsSync(artifact.logPath)) continue;
      let tracePhase = 'warmup';
      for (const line of readFileSync(artifact.logPath, 'utf8').split('\n')) {
        if (line.includes(WARMUP_COMPLETE_MARKER)) {
          tracePhase = 'post-warmup';
          continue;
        }
        if (/completed optimizing/.test(line)) {
          const match = line.match(/<JSFunction ([^ ]+)/);
          if (match) optimizedFunctions.add(match[1]);
        }
        if (/bailout|deopt/i.test(line)) {
          deoptLines.push(line);
          if (tracePhase === 'post-warmup') {
            postWarmupDeoptLines.push(line);
          } else {
            warmupDeoptLines.push(line);
          }
        }
        if (line.includes('JSFunction')) {
          traceLines.push(line);
        }
      }
    }

    const patternCounts = Object.fromEntries(COST_PATTERNS.map(([name]) => [name, 0]));
    const optCodeFiles = [];
    const assemblyFunctionReports = [];
    for (const artifact of optArtifacts) {
      if (!existsSync(artifact.logPath)) continue;
      const text = readFileSync(artifact.logPath, 'utf8');
      const assemblyReport = analyzeOptCodeArtifact(artifact, text);
      if (assemblyReport.isHotFunction) {
        assemblyFunctionReports.push(assemblyReport);
      }
      optCodeFiles.push({
        kind: artifact.kind,
        functionName: artifact.functionName,
        logPath: artifact.logPath,
        bytes: text.length,
      });
      for (const [name, pattern] of COST_PATTERNS) {
        patternCounts[name] += countMatches(text, pattern);
      }
    }

    const warmupParserDeopts = warmupDeoptLines.filter(isParserDeoptLine);
    const parserDeopts = postWarmupDeoptLines.filter(isParserDeoptLine);
    const assemblyGate = buildAssemblyGate(parserDeopts, assemblyFunctionReports);
    scenarios.push({
      fixture,
      tier,
      optimizedFunctions: [...optimizedFunctions].sort(),
      deoptCount: deoptLines.length,
      warmupDeoptCount: warmupDeoptLines.length,
      postWarmupDeoptCount: postWarmupDeoptLines.length,
      warmupParserDeopts,
      parserDeopts,
      consumerDeopts: postWarmupDeoptLines.filter(line => /consumeParser|checksum|foldString/.test(line)),
      patternCounts,
      assemblyGate,
      assemblyFunctionReports,
      optCodeFiles,
      bytecodeFiles: bytecodeArtifacts.map(artifact => ({
        functionName: artifact.functionName,
        logPath: artifact.logPath,
      })),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    node: manifest.node,
    v8: manifest.v8,
    warmups: manifest.warmups,
    iterations: manifest.iterations,
    elements: manifest.elements,
    wholeParser: manifest.wholeParser,
    contract: [
      'Decision order is assembly-first: inspect post-warmup generated TurboFan code before accepting or rejecting source changes.',
      'Hot parser functions should complete TurboFan optimization and avoid runtime deopts after warmup.',
      'Hot parser assembly warnings require source/optcode review and baseline comparison; benchmark numbers alone are not an accept/reject gate.',
      'Hot short-span materialization should avoid TypedArrayPrototypeSubArray, TextDecoder native/API callbacks, and CEntry where possible.',
      'Parser hot loops should minimize IC/runtime calls in optimized code; consumer harness deopts are tracked separately.',
      'A local assembly improvement is not accepted unless the scenario-level parser assembly and integrated benchmark stay healthy.',
    ],
    scenarios,
  };
}

function analyzeOptCodeArtifact(artifact, text) {
  const functionName = artifact.functionName ?? '(whole-parser)';
  const riskCounts = Object.fromEntries(ASSEMBLY_RISK_PATTERNS.map(([name]) => [name, 0]));
  for (const [name, pattern] of ASSEMBLY_RISK_PATTERNS) {
    riskCounts[name] = countMatches(text, pattern);
  }
  const sourceSnippets = extractFunctionSources(text);
  const isHotFunction = artifact.kind === 'optcode' && HOT_ASSEMBLY_FUNCTIONS.has(functionName);
  const riskScore = Object.values(riskCounts).reduce((sum, value) => sum + value, 0);
  return {
    kind: artifact.kind,
    functionName,
    logPath: artifact.logPath,
    isHotFunction,
    riskScore,
    riskCounts,
    sourceSnippets: sourceSnippets.slice(0, 8),
  };
}

function extractFunctionSources(text) {
  const snippets = [];
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const header = lines[index];
    if (!header?.includes('--- FUNCTION SOURCE')) continue;
    const sourceLine = lines[index + 1] ?? '';
    snippets.push({
      header: header.slice(0, 220),
      source: sourceLine.slice(0, 320),
    });
  }
  return snippets;
}

function buildAssemblyGate(parserDeopts, assemblyFunctionReports) {
  const riskyHotFunctions = assemblyFunctionReports
    .filter(report => report.riskScore > 0)
    .map(report => ({
      functionName: report.functionName,
      riskScore: report.riskScore,
      riskCounts: Object.fromEntries(Object.entries(report.riskCounts).filter(([, value]) => value > 0)),
      logPath: report.logPath,
    }))
    .sort((left, right) => right.riskScore - left.riskScore);
  const status = parserDeopts.length > 0
    ? 'fail'
    : riskyHotFunctions.length > 0 ? 'warn' : 'pass';
  return {
    status,
    parserPostWarmupDeopts: parserDeopts.length,
    hotFunctionWarningCount: riskyHotFunctions.length,
    riskyHotFunctions,
  };
}

function isParserDeoptLine(line) {
  return /parseBuffer|parseTag|parseStartTag|parseAttributes|addAttribute|batchFrame|refreshFrame|copyAttributesObject|decodeSpan|internName|nameKey|<JSFunction d /.test(line);
}

function countMatches(text, pattern) {
  pattern.lastIndex = 0;
  let count = 0;
  while (pattern.exec(text) !== null) count++;
  return count;
}

function formatAssemblyReport(summary) {
  return [
    '# V8 Iterable Parser Assembly Report',
    '',
    `Generated: ${summary.generatedAt}`,
    `Node: ${summary.node}`,
    `V8: ${summary.v8}`,
    `Warmups/iterations: ${summary.warmups}/${summary.iterations}`,
    `Elements: ${summary.elements}`,
    `Whole-parser optcode: ${summary.wholeParser ? 'yes' : 'no'}`,
    '',
    '## Assembly Contract',
    ...summary.contract.map(entry => `- ${entry}`),
    '',
    '## Assembly Gate',
    '| Scenario | Gate | Parser post-warmup deopts | Hot function warnings | Top hot assembly risks |',
    '| --- | --- | ---: | ---: | --- |',
    ...summary.scenarios.map(scenario => {
      const topRisks = scenario.assemblyGate.riskyHotFunctions.slice(0, 3)
        .map(report => `${report.functionName}(${formatRiskCounts(report.riskCounts)})`)
        .join('; ') || 'none';
      return `| ${scenario.fixture}/${scenario.tier} | ${scenario.assemblyGate.status} | ${scenario.assemblyGate.parserPostWarmupDeopts} | ${scenario.assemblyGate.hotFunctionWarningCount} | ${topRisks} |`;
    }),
    '',
    '## Hot Function Assembly Risks',
    ...summary.scenarios.flatMap(scenario => {
      if (scenario.assemblyGate.riskyHotFunctions.length === 0) {
        return [`- ${scenario.fixture}/${scenario.tier}: none`];
      }
      return [
        `- ${scenario.fixture}/${scenario.tier}:`,
        ...scenario.assemblyGate.riskyHotFunctions.slice(0, 10).map(report =>
          `  - ${report.functionName}: ${formatRiskCounts(report.riskCounts)} (${report.logPath})`),
      ];
    }),
    '',
    '## Scenario Summary',
    '| Scenario | TurboFan functions | Deopts total/post-warmup | Parser deopts warmup/post-warmup | Native/runtime/IC signals |',
    '| --- | ---: | ---: | ---: | --- |',
    ...summary.scenarios.map(scenario => {
      const signals = Object.entries(scenario.patternCounts)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => `${name}=${value}`)
        .join(', ') || 'none';
      return `| ${scenario.fixture}/${scenario.tier} | ${scenario.optimizedFunctions.length} | ${scenario.deoptCount}/${scenario.postWarmupDeoptCount} | ${scenario.warmupParserDeopts.length}/${scenario.parserDeopts.length} | ${signals} |`;
    }),
    '',
    '## Post-Warmup Parser Deopts',
    ...summary.scenarios.flatMap(scenario => {
      if (scenario.parserDeopts.length === 0) return [`- ${scenario.fixture}/${scenario.tier}: none`];
      return [
        `- ${scenario.fixture}/${scenario.tier}:`,
        ...scenario.parserDeopts.slice(0, 12).map(line => `  - ${line.slice(0, 240)}`),
        ...(scenario.parserDeopts.length > 12 ? [`  - ... ${scenario.parserDeopts.length - 12} more`] : []),
      ];
    }),
    '',
    '## Warmup Parser Deopts',
    ...summary.scenarios.flatMap(scenario => {
      if (scenario.warmupParserDeopts.length === 0) return [`- ${scenario.fixture}/${scenario.tier}: none`];
      return [
        `- ${scenario.fixture}/${scenario.tier}: ${scenario.warmupParserDeopts.length}`,
        ...scenario.warmupParserDeopts.slice(0, 6).map(line => `  - ${line.slice(0, 240)}`),
        ...(scenario.warmupParserDeopts.length > 6 ? [`  - ... ${scenario.warmupParserDeopts.length - 6} more`] : []),
      ];
    }),
    '',
    '## Optcode Artifacts',
    ...summary.scenarios.flatMap(scenario => [
      `- ${scenario.fixture}/${scenario.tier}:`,
      ...scenario.optCodeFiles.map(file => `  - ${file.kind}${file.functionName ? `/${file.functionName}` : ''}: ${file.logPath} (${file.bytes} bytes)`),
    ]),
    '',
  ].join('\n');
}

function formatRiskCounts(riskCounts) {
  return Object.entries(riskCounts)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => `${name}=${value}`)
    .join(', ') || 'none';
}

function runHarness(options) {
  const xmlBytes = new TextEncoder().encode(createFixtureXml(options.fixture, options.elements));
  const chunks = Array.from(chunkBytes(xmlBytes, options.chunkSize));
  const batches = () => Array.from(toByteBatches(chunks, { batchSize: options.batchSize }));
  const natives = createV8Natives();

  if (natives) natives.prepare(consumeParser);
  let lastResult = { eventCount: 0, attrCount: 0, checksum: 0 };
  for (let index = 0; index < options.warmups; index++) {
    lastResult = consumeParser(new IterableReader(batches()), options.tier);
  }

  console.log(WARMUP_COMPLETE_MARKER);
  if (natives) natives.optimizeNext(consumeParser);
  for (let index = 0; index < options.iterations; index++) {
    lastResult = consumeParser(new IterableReader(batches()), options.tier);
  }

  const status = natives ? natives.status(consumeParser) : undefined;
  console.log(JSON.stringify({
    mode: 'run',
    fixture: options.fixture,
    tier: options.tier,
    warmups: options.warmups,
    iterations: options.iterations,
    elements: options.elements,
    byteLength: xmlBytes.byteLength,
    chunks: chunks.length,
    eventCount: lastResult.eventCount,
    attrCount: lastResult.attrCount,
    checksum: lastResult.checksum,
    sink: globalThis.__staxXmlV8TraceSink,
    consumeParserOptimizationStatus: status,
  }));
}

function createV8Natives() {
  try {
    return {
      prepare: Function('fn', '%PrepareFunctionForOptimization(fn);'),
      optimizeNext: Function('fn', '%OptimizeFunctionOnNextCall(fn);'),
      status: Function('fn', 'return %GetOptimizationStatus(fn);'),
    };
  } catch {
    return undefined;
  }
}

function createFixtureXml(fixtureId, elements) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
  for (let id = 0; id < elements; id++) {
    xml += createFixtureElement(fixtureId, id);
  }
  xml += '</root>\n';
  return xml;
}

function createFixtureElement(fixtureId, id) {
  switch (fixtureId) {
    case 'attribute-heavy':
      return createAttributeHeavyElement(id);
    case 'high-cardinality':
      return createHighCardinalityElement(id);
    case 'mixed-utf8':
      return createMixedUtf8Element(id);
    case 'shuffled-attribute-order':
      return createShuffledAttributeOrderElement(id);
    default:
      throw new Error(`Unknown fixture: ${fixtureId}`);
  }
}

function createAttributeHeavyElement(id) {
  const hex = id.toString(16).padStart(8, '0');
  return (
    `  <item id="item-${hex}" a0="${id}" a1="${id % 97}" a2="state-${id % 11}" a3="${hex}" ` +
    `a4="group-${id % 101}" a5="flag-${id % 2}" a6="region-${id % 17}" a7="code-${id % 65535}" ` +
    `a8="kind-${id % 23}" a9="owner-${hex}" a10="serial-${id}-${hex}" a11="active">` +
      `<name>Name ${hex}</name>` +
      `<value>${id % 4096}</value>` +
    '</item>\n'
  );
}

function createHighCardinalityElement(id) {
  const hex = id.toString(16).padStart(8, '0');
  const tenant = id % 2048;
  return (
    `  <event tenant_${tenant}="t-${tenant}" metric_${id % 8192}="${id}" code_${hex.slice(0, 4)}="${hex}" ` +
    `trace_${id % 4096}="trace-${hex}" shard_${id % 31}="${id % 31}">` +
      `<payload key_${id % 16384}="value-${hex}">High cardinality payload ${id}</payload>` +
    '</event>\n'
  );
}

function createMixedUtf8Element(id) {
  const word = ['한글', '日本語', 'cafe', 'delta'][id % 4];
  return (
    `  <book id="book-${id}" lang="${word}" code="${id % 97}" status="mixed-${id % 7}">` +
      `<title>${word} Sample Book ${id}</title>` +
      `<author>Author ${word} ${id % 4096}</author>` +
      `<description>Mixed UTF-8 payload ${word} with ascii and non-ascii text ${id}.</description>` +
      `<chapter number="1">Intro ${word}</chapter>` +
      `<chapter number="2">Body ${id}</chapter>` +
    '</book>\n'
  );
}

function createShuffledAttributeOrderElement(id) {
  const hex = id.toString(16).padStart(8, '0');
  const attrs = [
    ['id', `item-${hex}`],
    ['a0', String(id)],
    ['a1', String(id % 97)],
    ['a2', `state-${id % 11}`],
    ['a3', hex],
    ['a4', `group-${id % 101}`],
    ['a5', `flag-${id % 2}`],
    ['a6', `region-${id % 17}`],
    ['a7', `code-${id % 65535}`],
    ['a8', `kind-${id % 23}`],
    ['a9', `owner-${hex}`],
    ['a10', `serial-${id}-${hex}`],
    ['a11', 'active'],
  ];
  const offset = id % attrs.length;
  const ordered = attrs.slice(offset).concat(attrs.slice(0, offset));
  const attrText = ordered.map(([name, value]) => `${name}="${value}"`).join(' ');
  return (
    `  <item ${attrText}>` +
      `<name>Name ${hex}</name>` +
      `<value>${id % 4096}</value>` +
    '</item>\n'
  );
}

function* chunkBytes(bytes, chunkSize) {
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    yield bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength));
  }
}

function mixChecksum(seed, value) {
  return Math.imul((seed ^ value) | 0, 16777619) | 0;
}

function foldString(seed, value) {
  if (!value) return seed;
  let next = seed;
  for (let index = 0; index < value.length; index++) {
    next = ((next << 5) - next + value.charCodeAt(index)) | 0;
  }
  return next;
}

function consumeParser(parser, tier) {
  let eventCount = 0;
  let attrCountTotal = 0;
  let checksum = 0;
  let attrObjects = 0;

  while (parser.nextBatch()) {
    if (tier === 'attr-frame-loop') {
      const frame = parser.batchFrame();
      const eventTypes = frame.eventTypes;
      const attrCounts = frame.attrCounts;
      const count = frame.eventCount;
      for (let index = 0; index < count; index++) {
        const type = eventTypes[index];
        const attrCount = attrCounts[index];
        eventCount++;
        attrCountTotal += attrCount;
        checksum = mixChecksum(checksum, type);
        checksum = mixChecksum(checksum, attrCount);

        if (type === IterableEventType.START_ELEMENT) {
          checksum = checksumAttributesFrame(frame, index, attrCount, checksum);
        }
      }
      continue;
    }

    const count = parser.eventCount();
    for (let index = 0; index < count; index++) {
      const type = parser.eventType(index);
      const attrCount = parser.attrCount(index);
      eventCount++;
      attrCountTotal += attrCount;
      checksum = mixChecksum(checksum, type);
      checksum = mixChecksum(checksum, attrCount);

      if (tier === 'count-only') {
        checksum = mixChecksum(checksum, parser.nameStart(index));
      } else if (tier === 'attr-object-batch') {
        if (type === IterableEventType.START_ELEMENT) {
          const attributes = parser.copyAttributesObject(index);
          attrObjectSink[attrObjects & (ATTR_OBJECT_SINK_SIZE - 1)] = attributes;
          attrObjects++;
          checksum = checksumAttributesObject(checksum, attributes);
        }
      } else if (tier === 'attr-direct-loop') {
        if (type === IterableEventType.START_ELEMENT) {
          checksum = checksumAttributesDirect(parser, index, attrCount, checksum);
        }
      } else if (tier === 'full-string-direct') {
        checksum = consumeFullStringDirect(parser, index, type, attrCount, checksum);
      } else {
        throw new Error(`Unknown tier: ${tier}`);
      }
    }
  }

  globalThis.__staxXmlV8TraceSink = mixChecksum(globalThis.__staxXmlV8TraceSink, checksum);
  return { eventCount, attrCount: attrCountTotal, checksum };
}

function consumeFullStringDirect(parser, index, type, attrCount, checksum) {
  if (type === IterableEventType.START_ELEMENT || type === IterableEventType.END_ELEMENT) {
    checksum = foldString(checksum, parser.copyName(index));
  }
  if (type === IterableEventType.CHARACTERS || type === IterableEventType.CDATA) {
    checksum = foldString(checksum, parser.copyText(index)?.trim());
  }
  if (type === IterableEventType.START_ELEMENT) {
    checksum = checksumAttributesDirect(parser, index, attrCount, checksum);
  }
  return checksum;
}

function checksumAttributesObject(seed, attributes) {
  let checksum = mixChecksum(seed, Object.keys(attributes).length);
  for (const name of Object.keys(attributes)) {
    checksum = foldString(checksum, name);
    checksum = foldString(checksum, attributes[name]);
  }
  return checksum;
}

function checksumAttributesDirect(parser, eventIndex, attrCount, seed) {
  let checksum = seed;
  for (let attr = 0; attr < attrCount; attr++) {
    checksum = foldString(checksum, parser.copyAttrName(eventIndex, attr));
    checksum = foldString(checksum, parser.copyAttrValue(eventIndex, attr));
  }
  return checksum;
}

function checksumAttributesFrame(frame, eventIndex, attrCount, seed) {
  let checksum = seed;
  const buffer = frame.buffer;
  const attrNameStarts = frame.attrNameStarts;
  const attrNameEnds = frame.attrNameEnds;
  const attrValueStarts = frame.attrValueStarts;
  const attrValueEnds = frame.attrValueEnds;
  let attrIndex = frame.attrStarts[eventIndex];
  const attrEnd = attrIndex + attrCount;
  while (attrIndex < attrEnd) {
    checksum = foldSpanBytes(checksum, buffer, attrNameStarts[attrIndex], attrNameEnds[attrIndex]);
    checksum = foldSpanBytes(checksum, buffer, attrValueStarts[attrIndex], attrValueEnds[attrIndex]);
    attrIndex++;
  }
  return checksum;
}

function foldSpanBytes(seed, buffer, start, end) {
  let next = seed;
  for (let index = start; index < end; index++) {
    const byte = buffer[index];
    if (byte > 0x7f) {
      return foldString(seed, frameChecksumDecoder.decode(buffer.subarray(start, end)));
    }
    next = ((next << 5) - next + byte) | 0;
  }
  return next;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.mode === 'self-test') {
    runSelfTest();
  } else if (options.mode === 'run') {
    runHarness(options);
  } else {
    runDriver(options);
  }
}

function runSelfTest() {
  const artifact = {
    kind: 'optcode',
    functionName: 'parseAttributes',
    logPath: 'self-test.log',
  };
  const text = [
    '--- FUNCTION SOURCE (file:///dist/iterable.js:parseAttributes) id{1,-1} start{1} ---',
    '(e,t,n){let r=n,i=t;for(;i<r;)i++}',
    '000000  0f80be0f0000         jo 000000',
    "                                                             ;; debug: deopt reason 'overflow'",
    "                                                             ;; debug: deopt reason 'out of bounds'",
    'call 000000  (CEntry_Return1_ArgvOnStack_NoBuiltinExit)',
    'TypedArrayPrototypeSubArray',
    'TextDecoder',
  ].join('\n');
  const report = analyzeOptCodeArtifact(artifact, text);
  assert.equal(report.isHotFunction, true);
  assert.equal(report.riskCounts.overflowChecks, 1);
  assert.equal(report.riskCounts.overflowDeopts, 1);
  assert.equal(report.riskCounts.boundsDeopts, 1);
  assert.equal(report.riskCounts.cEntryCalls, 1);
  assert.equal(report.riskCounts.typedArraySubArray, 1);
  assert.equal(report.riskCounts.textDecoderSignals, 1);
  const gate = buildAssemblyGate([], [report]);
  assert.equal(gate.status, 'warn');
  assert.equal(buildAssemblyGate(['parser deopt'], [report]).status, 'fail');
  console.log('v8-iterable-codegen-trace self-test passed');
}

main();
