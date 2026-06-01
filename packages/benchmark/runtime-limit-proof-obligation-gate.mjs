import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultLedgerPath = resolve(repoRoot, 'docs', 'plans', '2026-05-23-stax-api-performance-proof-ledger.md');
const defaultCoverageJson = resolve(__dirname, 'results', 'release', 'runtime-proof-coverage-audit.json');
const defaultComparisonJson = resolve(__dirname, 'results', 'release', 'same-contract-runtime-comparison.json');
const defaultCounterexampleScanJson = resolve(__dirname, 'results', 'release', 'runtime-counterexample-scan.json');
const defaultHandoffJson = resolve(__dirname, 'results', 'release', 'runtime-proof-gap-handoff.json');
const defaultSourceAuditJson = resolve(__dirname, 'results', 'release', 'source-consumption-shape-audit.json');
const defaultMemoryFrontierJson = resolve(__dirname, 'results', 'release', 'memory-frontier-audit.json');
const defaultTargetDistanceJson = resolve(__dirname, 'results', 'release', 'target-distance-audit.json');
const defaultTextMaterializationBoundaryJson = resolve(__dirname, 'results', 'release', 'text-materialization-boundary-audit.json');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'runtime-limit-proof-obligation-gate.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'runtime-limit-proof-obligation-gate.md');

const runtimeLimitClaimId = 'CLAIM-JS-RUNTIME-LIMIT-200MIB';

const requiredClaimGuards = [
  {
    id: 'runtime-limit-remains-hypothesis',
    claimId: runtimeLimitClaimId,
    requiredStatus: ['HYPOTHESIS'],
    description: 'The broad 200 MiB/s JavaScript runtime-limit claim must remain a hypothesis while proof obligations are open.',
  },
  {
    id: 'woodstox-object-shape-counterexample',
    claimId: 'CLAIM-WOODSTOX-SAME-JS-OBJECTS',
    requiredStatus: ['COUNTEREXAMPLE'],
    description: 'Woodstox must stay recorded as semantic/checksum parity, not JavaScript object-shape parity.',
  },
  {
    id: 'quickxml-object-shape-counterexample',
    claimId: 'CLAIM-QUICKXML-SAME-JS-OBJECTS',
    requiredStatus: ['COUNTEREXAMPLE'],
    description: 'quick-xml must stay recorded as semantic/checksum parity, not JavaScript object-shape parity.',
  },
  {
    id: 'lazy-getters-negative-result',
    claimId: 'CLAIM-LAZY-GETTERS',
    requiredStatus: ['NEGATIVE_RESULT'],
    description: 'Lazy getters must remain a recorded negative result unless new benchmark evidence reopens them.',
  },
  {
    id: 'node-buffer-not-neutral-primary',
    claimId: 'CLAIM-NODE-BUFFER-PRIMARY',
    requiredStatus: ['NEGATIVE_RESULT'],
    description: 'Node Buffer lanes must not be mixed into neutral/browser-compatible claims.',
  },
  {
    id: 'node-textdecoder-source-boundary',
    claimId: 'CLAIM-NODE-TEXTDECODER-SOURCE-BOUNDARY',
    requiredStatus: ['SOURCE_FACT'],
    description: 'Node TextDecoder source boundaries must be pinned before using Node TextDecoder rows as engine evidence.',
  },
  {
    id: 'chrome-blink-textdecoder-source-boundary',
    claimId: 'CLAIM-CHROME-BLINK-TEXTDECODER-SOURCE-BOUNDARY',
    requiredStatus: ['SOURCE_FACT'],
    description: 'Chrome/Blink TextDecoder source boundaries must be pinned separately from Node/Bun source facts.',
  },
  {
    id: 'bun-webkit-textdecoder-source-boundary',
    claimId: 'CLAIM-BUN-WEBKIT-TEXTDECODER-SOURCE-BOUNDARY',
    requiredStatus: ['SOURCE_FACT'],
    description: 'The WebKit implementation boundary must remain separate from Bun dispatch evidence.',
  },
  {
    id: 'bun-textdecoder-dispatch-counterexample',
    claimId: 'CLAIM-BUN-TEXTDECODER-DISPATCH-SOURCE-BOUNDARY',
    requiredStatus: ['SOURCE_FACT', 'COUNTEREXAMPLE'],
    description: 'Bun default UTF-8 TextDecoder dispatch must stay pinned as Bun Zig, not WebKit TextDecoder.cpp.',
  },
  {
    id: 'firefox-spidermonkey-textdecoder-source-boundary',
    claimId: 'CLAIM-FIREFOX-SPIDERMONKEY-TEXTDECODER-SOURCE-BOUNDARY',
    requiredStatus: ['SOURCE_FACT'],
    description: 'Firefox/SpiderMonkey-facing Gecko TextDecoder source boundaries must be recorded as source facts only.',
  },
];

const requiredArtifactMentions = [
  'materialization-contract-audit.md',
  'same-contract-runtime-comparison.md',
  'runtime-counterexample-scan.md',
  'runtime-proof-coverage-audit.md',
  'quick-xml-shape-audit.md',
  'quick-xml-allocation-count.md',
  'quick-xml-allocation-count-stability.md',
  'woodstox-hotspot-trace.md',
  'woodstox-jfr-allocation.md',
  'woodstox-measured-jfr-allocation.md',
  'woodstox-measured-jfr-allocation-rerun.md',
  'candidate-headroom-large.md',
  'bun-candidate-headroom-large.md',
  'browser-candidate-headroom-large.md',
  'firefox-bidi-candidate-headroom.md',
  'text-cdata-cost-decomposition.md',
  'text-materialization-frontier.md',
  'text-trim-guard-candidate.md',
  'text-ascii-pretrim-candidate.md',
  'all-ascii-span-materialization-candidate.md',
  'sync-byte-batch-shape-batch1.md',
  'sync-byte-batch-shape-batch16.md',
  'textdecoder-span-variants.md',
  'bun-textdecoder-span-variants.md',
  'browser-textdecoder-span-variants.md',
  'node-textdecoder-source-pin-audit.md',
  'chrome-blink-textdecoder-source-pin-audit.md',
  'bun-textdecoder-dispatch-source-pin-audit.md',
  'firefox-spidermonkey-textdecoder-source-pin-audit.md',
  'bun-jsc-partial-codegen-trace.md',
  'bun-jsc-textdecoder-codegen-trace.md',
  'stream-source-consumption-shapes.md',
  'stream-source-consumption-backpressure-counters.md',
  'event-reader-byte-batch-cross-process-corpus.md',
  'segment-scan-headroom.md',
  'segment-tokenizer-headroom.md',
  'segment-tokenizer-string-frontier.md',
  'runtime-proof-gap-handoff.md',
];

const openObligationDisclosures = [
  {
    id: 'safari-jsc-source-and-browser-rows-open',
    pattern: /Safari\/JSC|Safari\/browser/i,
    description: 'Safari/browser JSC source and benchmark coverage remains separate from Bun/JSC coverage.',
  },
  {
    id: 'codegen-traces-open',
    pattern: /codegen traces|generated-code evidence|JIT\/codegen/i,
    description: 'Runtime codegen/JIT evidence remains required for broad runtime-limit conclusions.',
  },
  {
    id: 'allocation-profiles-open',
    pattern: /allocation profiles|allocation evidence|heap\/allocation/i,
    description: 'Allocation/heap evidence remains required for runtimes without adequate traces.',
  },
  {
    id: 'independent-corpus-suite-open',
    pattern: /additional independent corpus|broad corpus suite|more independent real\/corpus/i,
    description: 'More independent real/corpus fixtures remain required.',
  },
  {
    id: 'counterexample-rule-present',
    pattern: /Any 200 MiB\/s\+ bounded-memory full-string JS row is a counterexample|Treat any 200 MiB\/s\+ bounded-memory full-string JavaScript row as a\s+counterexample/i,
    description: 'The ledger must preserve the rule that a bounded full-string 200 MiB/s JavaScript row disproves the limit claim.',
  },
];

const requiredProofRules = [
  {
    id: 'target-contract-not-object-shape',
    pattern: /full-string StAX-like reader contract, not as\s+identical object shape across languages/i,
    description: 'The target must be defined as the same full-string StAX contract, not identical runtime object shape.',
  },
  {
    id: 'woodstox-same-js-object-shape-rejected',
    pattern: /Future text must say "same high-level data\/checksum contract", not "same object shape"/i,
    description: 'Woodstox object-shape parity with JavaScript public events must stay rejected.',
  },
  {
    id: 'quickxml-same-js-object-shape-rejected',
    pattern: /quick-xml creates the same object shape as the JavaScript public event path\.[^\n]*\| `COUNTEREXAMPLE`/i,
    description: 'quick-xml object-shape parity with JavaScript public events must stay rejected.',
  },
  {
    id: 'engine-invariant-not-impossibility-proof',
    pattern: /`ENGINE_INVARIANT` about JS strings is not by itself a performance\s+impossibility proof/i,
    description: 'Language/runtime string invariants alone must not be promoted to performance impossibility.',
  },
  {
    id: 'negative-results-not-global-proof',
    pattern: /`NEGATIVE_RESULT` for lazy getters, Buffer lanes, or value caches does not\s+prove that all JavaScript runtime headroom is exhausted/i,
    description: 'Failed implementation families narrow search space but do not prove the whole runtime ceiling.',
  },
  {
    id: 'lazy-getters-reopen-burden',
    pattern: /This rejection can be revisited only with a benchmark that proves full-string or real StAX consumer improvement,\s+bounded memory, and no cache-shape regression/i,
    description: 'Lazy getters remain closed unless a full-string benchmark proves improvement without cache-shape regression.',
  },
  {
    id: 'bounded-full-string-counterexample-rule',
    pattern: /Treat any 200 MiB\/s\+ bounded-memory full-string JavaScript row as a\s+counterexample/i,
    description: 'A bounded 200 MiB/s full-string JavaScript row must remain a counterexample to the broad limit claim.',
  },
  {
    id: 'source-shapes-separated',
    pattern: /direct ReadableStream overhead evidence stays\s+distinct from\s+synchronous byte-batch rows/i,
    description: 'Direct ReadableStream source-overhead rows must remain separate from synchronous byte-batch parser rows.',
  },
  {
    id: 'byte-batches-not-full-arraybuffer',
    pattern: /does\s+not\s+prebuild one repeated 1 GiB ArrayBuffer parser input/i,
    description: 'Large byte-batch rows must not be treated as one prebuilt full-XML ArrayBuffer parser input.',
  },
  {
    id: 'byte-batch-backpressure-preserved',
    pattern: /preserve\s+backpressure by pulling at most the next batch on demand/i,
    description: 'Byte-batch source rows must preserve demand-driven consumption instead of preconsuming the stream.',
  },
  {
    id: 'raw-frame-source-shapes-backpressure-counted',
    pattern: /focused audit\s+now includes seven source-shape rows[\s\S]+?async `nextRawBatch\(\)` raw-frame[\s\S]+?direct\s+`ReadableStream` `nextRawBatch\(\)` raw-frame[\s\S]+?same backpressure counter contract/i,
    description: 'Focused source-shape evidence must include raw-frame async and ReadableStream rows under the same backpressure counters.',
  },
  {
    id: 'handoff-source-consumption-classified',
    pattern: /source-consumption evidence status is\s+`classified`[\s\S]+?all\s+\d+ JavaScript 1 GiB\+ full-string rows with source-mode metadata are not full\s+`ArrayBuffer` parser-input rows[\s\S]+?browser live fetch frontier records `fetchReadableStreamFull` at 9\.68\s+MiB\/s and `fetchAsyncByteBatchFull` at 9\.77 MiB\/s[\s\S]+?Safari\/WebKit browser\s+rows and SpiderMonkey emitted IR remain active obligations/i,
    description: 'The handoff must carry classified source-consumption evidence without closing Safari/WebKit or SpiderMonkey obligations.',
  },
  {
    id: 'handoff-external-target-distance-classified',
    pattern: /external target-distance evidence from the same\s+aggregate[\s\S]+?fastest aggregated\s+JavaScript full-string row is 0\.93x of the 200 MiB\/s threshold and 0\.55x of the\s+1024 MiB Woodstox reference[\s\S]+?118\.67 MiB\/s below the 0\.9x Woodstox target[\s\S]+?Woodstox is 351\.56 MiB\/s\s+with a 316\.40 MiB\/s 0\.9x target, and quick-xml is 274\.63 MiB\/s with a\s+247\.17 MiB\/s 0\.9x target[\s\S]+?not object-shape equivalence/i,
    description: 'The handoff must carry Woodstox and quick-xml 0.9x target-distance evidence under the same checksum contract.',
  },
  {
    id: 'handoff-text-materialization-frontier-classified',
    pattern: /text-materialization frontier[\s\S]+?fastest full-string row remains\s+`rawFrameNameId` from `text-trim-cost-decomposition\.json` at 185\.50 MiB\/s[\s\S]+?14\.50 MiB\/s below the 200 MiB\/s threshold and requiring a 1\.08x speedup[\s\S]+?`withoutTextStrings` from\s+`text-trim-cost-decomposition-4gib\.json`, reaches 252\.36 MiB\/s[\s\S]+?not full-string parity[\s\S]+?four no-text rows cross 200 MiB\/s\s+while zero full-string, no-trim, or fold-trim rows do/i,
    description: 'The handoff must carry the text-materialization frontier without treating no-text headroom as a full-string counterexample.',
  },
  {
    id: 'segment-headroom-not-stax-counterexample',
    pattern: /segment-scan-headroom\.md[\s\S]+?grouped segment-aware scan (?:reached|at) 682\.83 MiB\/s[\s\S]+?segment-tokenizer-headroom\.md[\s\S]+?grouped segment-aware (?:tokenization )?(?:reached|row reaches only) 196\.26 MiB\/s[\s\S]+?(?:partial|headroom)[\s\S]+?not (?:a )?full(?:-string)? StAX counterexample/i,
    description: 'Segment scan/tokenizer headroom must stay classified as partial evidence, not a full StAX counterexample.',
  },
  {
    id: 'segment-string-frontier-below-threshold',
    pattern: /segment-tokenizer-string-frontier\.md[\s\S]+?tokenOnly[\s\S]{0,40}?(?:at|reached) 234\.30 MiB\/s[\s\S]+?allTokenStringsNoObjects[\s\S]{0,40}?(?:at|reached) 66\.58 MiB\/s[\s\S]+?200 MiB\/s bounded full-string counterexamples:\s*0/i,
    description: 'Segment tokenizer string materialization frontier must show token-only headroom collapses below the 200 MiB/s full-string counterexample threshold.',
  },
  {
    id: 'woodstox-reference-not-identical-input',
    pattern: /fastest aggregated JS row\s+and the 1024 MiB Woodstox reference can come from different corpus fixtures/i,
    description: 'Cross-fixture Woodstox ratios must remain target-distance references, not identical-input target passes.',
  },
  {
    id: 'same-fixture-woodstox-target-unmet',
    pattern: /same-fixture 1024 MiB JS row vs Woodstox target[\s\S]+?below (?:the )?0\.9x target/i,
    description: 'The current same-fixture 1024 MiB JS row must stay recorded as below the 0.9x Woodstox target.',
  },
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    ledger: defaultLedgerPath,
    coverageJson: defaultCoverageJson,
    comparisonJson: defaultComparisonJson,
    counterexampleScanJson: defaultCounterexampleScanJson,
    handoffJson: defaultHandoffJson,
    sourceAuditJson: defaultSourceAuditJson,
    memoryFrontierJson: defaultMemoryFrontierJson,
    targetDistanceJson: defaultTargetDistanceJson,
    textMaterializationBoundaryJson: defaultTextMaterializationBoundaryJson,
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
      case '--ledger':
        options.ledger = resolve(process.cwd(), readValue());
        break;
      case '--coverage-json':
        options.coverageJson = resolve(process.cwd(), readValue());
        break;
      case '--comparison-json':
        options.comparisonJson = resolve(process.cwd(), readValue());
        break;
      case '--counterexample-scan-json':
        options.counterexampleScanJson = resolve(process.cwd(), readValue());
        break;
      case '--handoff-json':
        options.handoffJson = resolve(process.cwd(), readValue());
        break;
      case '--source-audit-json':
        options.sourceAuditJson = resolve(process.cwd(), readValue());
        break;
      case '--memory-frontier-json':
        options.memoryFrontierJson = resolve(process.cwd(), readValue());
        break;
      case '--target-distance-json':
        options.targetDistanceJson = resolve(process.cwd(), readValue());
        break;
      case '--text-materialization-boundary-json':
        options.textMaterializationBoundaryJson = resolve(process.cwd(), readValue());
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

  if (!existsSync(options.ledger)) {
    throw new Error(`--ledger does not exist: ${options.ledger}`);
  }
  return options;
}

function main() {
  const options = parseArgs();
  const ledgerMarkdown = readFileSync(options.ledger, 'utf8');
  const coverageAudit = readCoverageAudit(options.coverageJson);
  const comparison = readOptionalJson(options.comparisonJson, 'same-contract-runtime-comparison');
  const counterexampleScan = readOptionalJson(options.counterexampleScanJson, 'runtime-counterexample-scan');
  const handoff = readOptionalJson(options.handoffJson, 'runtime-proof-gap-handoff');
  const sourceAudit = readOptionalJson(options.sourceAuditJson, 'source-consumption-shape-audit');
  const memoryFrontier = readOptionalJson(options.memoryFrontierJson, 'memory-frontier-audit');
  const targetDistance = readOptionalJson(options.targetDistanceJson, 'target-distance-audit');
  const textMaterializationBoundary = readOptionalJson(options.textMaterializationBoundaryJson, 'text-materialization-boundary-audit');
  const report = createReport({ options, ledgerMarkdown, coverageAudit, comparison, counterexampleScan, handoff, sourceAudit, memoryFrontier, targetDistance, textMaterializationBoundary });
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
  if (!report.gate.pass) {
    process.exitCode = 1;
  }
}

function readOptionalJson(filePath, expectedObjective) {
  if (!filePath || !existsSync(filePath)) return null;
  const artifact = JSON.parse(readFileSync(filePath, 'utf8'));
  if (artifact.objective !== expectedObjective) {
    throw new Error(`expected ${expectedObjective} JSON, got ${artifact.objective ?? 'unknown'}`);
  }
  return artifact;
}

function readCoverageAudit(coverageJson) {
  if (!coverageJson || !existsSync(coverageJson)) return null;
  const audit = JSON.parse(readFileSync(coverageJson, 'utf8'));
  if (audit.objective !== 'runtime-proof-coverage-audit') {
    throw new Error(`expected runtime-proof-coverage-audit JSON, got ${audit.objective ?? 'unknown'}`);
  }
  return audit;
}

function createReport({ options, ledgerMarkdown, coverageAudit, comparison, counterexampleScan, handoff, sourceAudit, memoryFrontier, targetDistance, textMaterializationBoundary }) {
  const claims = parseClaimRows(ledgerMarkdown);
  const coverageSnapshot = createCoverageSnapshot(coverageAudit);
  const counterexampleSnapshot = createCounterexampleSnapshot(comparison, counterexampleScan);
  const handoffSnapshot = createHandoffSnapshot(handoff);
  const sourceAuditSnapshot = createSourceAuditSnapshot(sourceAudit);
  const frontierAuditSnapshot = createFrontierAuditSnapshot(memoryFrontier, targetDistance, textMaterializationBoundary);
  const claimGuards = requiredClaimGuards.map(requirement => evaluateClaimGuard(requirement, claims));
  const artifactMentions = requiredArtifactMentions.map(file => ({
    id: file,
    file,
    present: ledgerMarkdown.includes(file),
  }));
  const openObligations = openObligationDisclosures.map(obligation => ({
    ...obligation,
    disclosed: obligation.pattern.test(ledgerMarkdown),
    coverageStatus: coverageSnapshot.byId[obligation.id]?.status ?? null,
    coverageEvidence: coverageSnapshot.byId[obligation.id]?.evidence ?? null,
  }));
  const proofRules = requiredProofRules.map(rule => ({
    ...rule,
    satisfied: rule.pattern.test(ledgerMarkdown),
  }));

  const runtimeClaim = claims[runtimeLimitClaimId] ?? null;
  const runtimeStatus = runtimeClaim?.status ?? null;
  const runtimeMarkedConclusion = statusHas(runtimeStatus, 'CONCLUSION');
  const missingClaimGuards = claimGuards.filter(item => !item.satisfied);
  const missingArtifactMentions = artifactMentions.filter(item => !item.present);
  const missingOpenDisclosures = openObligations.filter(item => !item.disclosed);
  const missingProofRules = proofRules.filter(item => !item.satisfied);
  const errors = [];

  if (runtimeMarkedConclusion) {
    errors.push(`${runtimeLimitClaimId} is marked CONCLUSION while this gate still has open obligations.`);
  }
  for (const item of missingClaimGuards) {
    errors.push(`Missing claim guard ${item.id}: expected ${item.claimId} status ${item.requiredStatus.join(' + ')}.`);
  }
  for (const item of missingArtifactMentions) {
    errors.push(`Missing required artifact mention: ${item.file}.`);
  }
  for (const item of missingOpenDisclosures) {
    errors.push(`Missing open-obligation disclosure: ${item.id}.`);
  }
  for (const item of missingProofRules) {
    errors.push(`Missing proof rule: ${item.id}.`);
  }
  if (counterexampleSnapshot.currentCounterexampleCount > 0) {
    errors.push(`Current release artifacts contain ${counterexampleSnapshot.currentCounterexampleCount} bounded full-string JavaScript counterexample(s); the runtime-limit ledger must be updated before the gate can pass.`);
  }
  for (const guard of handoffSnapshot.guards.filter(item => !item.satisfied)) {
    errors.push(`Missing handoff guard ${guard.id}: ${guard.description}`);
  }
  for (const guard of sourceAuditSnapshot.guards.filter(item => !item.satisfied)) {
    errors.push(`Missing source audit guard ${guard.id}: ${guard.description}`);
  }
  for (const guard of frontierAuditSnapshot.guards.filter(item => !item.satisfied)) {
    errors.push(`Missing frontier audit guard ${guard.id}: ${guard.description}`);
  }

  const pass = errors.length === 0;
  return {
    generatedAt: new Date().toISOString(),
    objective: 'runtime-limit-proof-obligation-gate',
    contract: 'static-ledger-proof-obligations',
    note: 'Static proof-obligation gate for the broad 200 MiB/s JavaScript runtime-limit claim. Passing this gate currently means the ledger is conservative: the broad claim remains a hypothesis and known open obligations are disclosed.',
    metadata: {
      ledger: options.ledger,
      coverageJson: options.coverageJson,
      comparisonJson: options.comparisonJson,
      counterexampleScanJson: options.counterexampleScanJson,
      handoffJson: options.handoffJson,
      sourceAuditJson: options.sourceAuditJson,
      memoryFrontierJson: options.memoryFrontierJson,
      targetDistanceJson: options.targetDistanceJson,
      textMaterializationBoundaryJson: options.textMaterializationBoundaryJson,
      coverageLoaded: coverageSnapshot.loaded,
      comparisonLoaded: counterexampleSnapshot.comparisonLoaded,
      counterexampleScanLoaded: counterexampleSnapshot.counterexampleScanLoaded,
      handoffLoaded: handoffSnapshot.loaded,
      sourceAuditLoaded: sourceAuditSnapshot.loaded,
      memoryFrontierLoaded: frontierAuditSnapshot.memory.loaded,
      targetDistanceLoaded: frontierAuditSnapshot.targetDistance.loaded,
      textMaterializationBoundaryLoaded: frontierAuditSnapshot.textMaterialization.loaded,
    },
    conclusionClaim: runtimeLimitClaimId,
    conclusionAllowed: false,
    gate: {
      pass,
      status: pass ? 'incomplete-proof-correctly-blocked' : 'ledger-guard-failed',
      errors,
    },
    runtimeClaim: runtimeClaim ? {
      id: runtimeLimitClaimId,
      status: runtimeStatus,
      markedConclusion: runtimeMarkedConclusion,
    } : null,
    claimGuards,
    artifactMentions,
    counterexampleSnapshot,
    handoffSnapshot,
    sourceAuditSnapshot,
    frontierAuditSnapshot,
    coverageSnapshot,
    openObligations,
    proofRules,
    summary: {
      satisfiedClaimGuards: claimGuards.filter(item => item.satisfied).length,
      requiredClaimGuards: claimGuards.length,
      presentArtifactMentions: artifactMentions.filter(item => item.present).length,
      requiredArtifactMentions: artifactMentions.length,
      disclosedOpenObligations: openObligations.filter(item => item.disclosed).length,
      requiredOpenObligations: openObligations.length,
      satisfiedProofRules: proofRules.filter(item => item.satisfied).length,
      requiredProofRules: proofRules.length,
      currentCounterexamples: counterexampleSnapshot.currentCounterexampleCount,
      satisfiedHandoffGuards: handoffSnapshot.guards.filter(item => item.satisfied).length,
      requiredHandoffGuards: handoffSnapshot.guards.length,
      satisfiedSourceAuditGuards: sourceAuditSnapshot.guards.filter(item => item.satisfied).length,
      requiredSourceAuditGuards: sourceAuditSnapshot.guards.length,
      satisfiedFrontierAuditGuards: frontierAuditSnapshot.guards.filter(item => item.satisfied).length,
      requiredFrontierAuditGuards: frontierAuditSnapshot.guards.length,
    },
  };
}

function createFrontierAuditSnapshot(memoryFrontier, targetDistance, textMaterializationBoundary) {
  const memory = {
    loaded: Boolean(memoryFrontier),
    generatedAt: memoryFrontier?.generatedAt ?? null,
    status: memoryFrontier?.summary?.status ?? null,
    fastestBoundedRateMiBPerSec: memoryFrontier?.summary?.fastestBoundedRow?.rateMiBPerSec ?? null,
    fastestBoundedMaxMiB: memoryFrontier?.summary?.fastestBoundedRow?.maxMiB ?? null,
    unboundedRows: memoryFrontier?.summary?.unboundedRows ?? null,
    unboundedRowsAtOrAbove200MiBPerSec: memoryFrontier?.summary?.unboundedRowsAtOrAbove200MiBPerSec ?? null,
    conclusionAllowed: memoryFrontier?.summary?.conclusionAllowed ?? null,
  };
  const woodstox = targetDistance?.summary?.sameFixture1024MiBWoodstoxTarget ?? {};
  const quickXml = targetDistance?.summary?.sameFixture1024MiBQuickXmlTarget ?? {};
  const target = {
    loaded: Boolean(targetDistance),
    generatedAt: targetDistance?.generatedAt ?? null,
    status: targetDistance?.summary?.status ?? null,
    woodstoxTargetMet: woodstox.targetMet ?? null,
    quickXmlTargetMet: quickXml.targetMet ?? null,
    woodstoxRemainingMiBPerSec: woodstox.remainingTo90PercentMiBPerSec ?? null,
    quickXmlRemainingMiBPerSec: quickXml.remainingTo90PercentMiBPerSec ?? null,
    fastestJsCaseId: woodstox.fastestJsCaseId ?? null,
    fastestJsRateMiBPerSec: woodstox.fastestJsRateMiBPerSec ?? null,
    conclusionAllowed: targetDistance?.summary?.conclusionAllowed ?? null,
  };
  const text = {
    loaded: Boolean(textMaterializationBoundary),
    generatedAt: textMaterializationBoundary?.generatedAt ?? null,
    status: textMaterializationBoundary?.summary?.status ?? null,
    fastestFullRateMiBPerSec: textMaterializationBoundary?.summary?.fastestFull?.rateMiBPerSec ?? null,
    fullRowsCrossTarget: textMaterializationBoundary?.summary?.fullRowsCrossTarget ?? null,
    noTextRowsCrossTarget: textMaterializationBoundary?.summary?.noTextRowsCrossTarget ?? null,
    fastestFullRemainingMiBPerSec: textMaterializationBoundary?.summary?.fastestFullRemainingMiBPerSec ?? null,
    conclusionAllowed: textMaterializationBoundary?.summary?.conclusionAllowed ?? null,
  };
  return {
    memory,
    targetDistance: target,
    textMaterialization: text,
    guards: createFrontierAuditGuards(memory, target, text),
  };
}

function createFrontierAuditGuards(memory, target, text) {
  return [
    {
      id: 'memory-frontier-classified',
      description: 'memory-frontier-audit.json must classify 1 GiB+ JavaScript full-string memory rows and keep unbounded rows visible.',
      satisfied: memory.loaded
        && memory.status === 'classified'
        && typeof memory.fastestBoundedRateMiBPerSec === 'number'
        && typeof memory.fastestBoundedMaxMiB === 'number'
        && typeof memory.unboundedRows === 'number'
        && memory.unboundedRows > 0
        && memory.conclusionAllowed === false,
    },
    {
      id: 'memory-frontier-no-unbounded-target-row',
      description: 'memory-frontier-audit.json must show unbounded or unproven-memory full-string rows do not reach the 200 MiB/s target.',
      satisfied: memory.loaded
        && memory.status === 'classified'
        && memory.unboundedRowsAtOrAbove200MiBPerSec === 0
        && memory.conclusionAllowed === false,
    },
    {
      id: 'target-distance-not-met',
      description: 'target-distance-audit.json must show same-fixture JavaScript remains below both Woodstox and quick-xml 0.9x targets.',
      satisfied: target.loaded
        && target.status === 'classified'
        && target.woodstoxTargetMet === false
        && target.quickXmlTargetMet === false
        && typeof target.woodstoxRemainingMiBPerSec === 'number'
        && target.woodstoxRemainingMiBPerSec > 0
        && typeof target.quickXmlRemainingMiBPerSec === 'number'
        && target.quickXmlRemainingMiBPerSec > 0
        && target.conclusionAllowed === false,
    },
    {
      id: 'text-frontier-no-full-counterexample',
      description: 'text-materialization-boundary-audit.json must show no full-string rows cross 200 MiB/s while no-text rows remain partial headroom.',
      satisfied: text.loaded
        && text.status === 'classified'
        && typeof text.fastestFullRateMiBPerSec === 'number'
        && text.fastestFullRateMiBPerSec < 200
        && text.fullRowsCrossTarget === 0
        && typeof text.noTextRowsCrossTarget === 'number'
        && text.noTextRowsCrossTarget > 0
        && text.conclusionAllowed === false,
    },
  ];
}

function createSourceAuditSnapshot(sourceAudit) {
  const coverageCrosscheck = sourceAudit?.coverageCrosscheck ?? null;
  const sourceModeRows = coverageCrosscheck?.sourceModeRows ?? null;
  const notFullArrayBufferRows = coverageCrosscheck?.notFullArrayBufferRows ?? null;
  const fullArrayBufferRows = coverageCrosscheck?.fullArrayBufferRows ?? null;
  const unknownArrayBufferRows = coverageCrosscheck?.unknownArrayBufferRows ?? null;
  const directReadableStreamRows = coverageCrosscheck?.directReadableStreamRows ?? null;
  const summary = sourceAudit?.summary ?? null;
  const primaryParserInput = summary?.primaryParserInput ?? null;
  const primarySyncByteBatchRows = summary?.primarySyncByteBatchRows ?? null;
  const primaryDirectReadableStreamRows = summary?.primaryDirectReadableStreamRows ?? null;
  const primaryAsyncSourceRows = summary?.primaryAsyncSourceRows ?? null;
  const primaryFullArrayBufferRows = summary?.primaryFullArrayBufferRows ?? null;
  const primaryUnknownSourceModeRows = summary?.primaryUnknownSourceModeRows ?? null;
  return {
    loaded: Boolean(sourceAudit),
    generatedAt: sourceAudit?.generatedAt ?? null,
    status: summary?.status ?? null,
    primarySourceContract: summary?.primarySourceContract ?? null,
    primaryParserInput,
    primarySourceBoundary: summary?.primarySourceBoundary ?? null,
    primarySyncByteBatchRows,
    primaryDirectReadableStreamRows,
    primaryAsyncSourceRows,
    primaryFullArrayBufferRows,
    primaryUnknownSourceModeRows,
    coverageCrosscheckStatus: coverageCrosscheck?.status ?? null,
    coverageSourceModeRows: sourceModeRows,
    coverageNotFullArrayBufferRows: notFullArrayBufferRows,
    coverageFullArrayBufferRows: fullArrayBufferRows,
    coverageUnknownArrayBufferRows: unknownArrayBufferRows,
    coverageDirectReadableStreamRows: directReadableStreamRows,
    guards: createSourceAuditGuards({
      loaded: Boolean(sourceAudit),
      coverageCrosscheck,
      sourceModeRows,
      notFullArrayBufferRows,
      fullArrayBufferRows,
      unknownArrayBufferRows,
      directReadableStreamRows,
      primaryParserInput,
      primarySyncByteBatchRows,
      primaryDirectReadableStreamRows,
      primaryAsyncSourceRows,
      primaryFullArrayBufferRows,
      primaryUnknownSourceModeRows,
    }),
  };
}

function createSourceAuditGuards(snapshot) {
  return [
    {
      id: 'source-audit-loaded',
      description: 'source-consumption-shape-audit.json must be loaded by the gate.',
      satisfied: snapshot.loaded,
    },
    {
      id: 'coverage-crosscheck-consistent',
      description: 'Source audit coverage crosscheck must be consistent with the wider coverage source-mode scan.',
      satisfied: snapshot.coverageCrosscheck?.status === 'consistent',
    },
    {
      id: 'coverage-crosscheck-not-full-arraybuffer',
      description: 'Coverage crosscheck must report every source-mode row as not full ArrayBuffer parser input.',
      satisfied: typeof snapshot.sourceModeRows === 'number'
        && snapshot.sourceModeRows > 0
        && snapshot.notFullArrayBufferRows === snapshot.sourceModeRows
        && snapshot.fullArrayBufferRows === 0
        && snapshot.unknownArrayBufferRows === 0,
    },
    {
      id: 'coverage-crosscheck-readable-stream-separated',
      description: 'Coverage crosscheck must keep direct ReadableStream rows visible as separate source-overhead evidence.',
      satisfied: typeof snapshot.directReadableStreamRows === 'number'
        && snapshot.directReadableStreamRows > 0,
    },
    {
      id: 'primary-source-sync-byte-batches-only',
      description: 'Primary source audit rows must stay synchronous Iterable<Uint8Array[]> byte batches with async and direct ReadableStream rows excluded.',
      satisfied: snapshot.primaryParserInput === 'synchronous Iterable<Uint8Array[]>'
        && typeof snapshot.primarySyncByteBatchRows === 'number'
        && snapshot.primarySyncByteBatchRows > 0
        && snapshot.primaryDirectReadableStreamRows === 0
        && snapshot.primaryAsyncSourceRows === 0
        && snapshot.primaryFullArrayBufferRows === 0
        && snapshot.primaryUnknownSourceModeRows === 0,
    },
  ];
}

function createHandoffSnapshot(handoff) {
  if (!handoff) {
    return {
      loaded: false,
      generatedAt: null,
      activeObligationIds: [],
      guards: createHandoffGuards(null),
    };
  }
  const handoffs = Array.isArray(handoff.handoffs) ? handoff.handoffs : [];
  const byId = new Map(handoffs.map(item => [item.id, item]));
  const activeObligationIds = (handoff.auditSummary?.activeObligations ?? [])
    .map(obligation => obligation.id)
    .filter(Boolean);
  return {
    loaded: true,
    generatedAt: handoff.generatedAt ?? null,
    activeObligationIds,
    summary: {
      sourceConsumptionEvidenceStatus: handoff.summary?.sourceConsumptionEvidenceStatus ?? null,
      directReadableStreamScope: handoff.summary?.directReadableStreamScope ?? null,
      directReadableStreamBackpressureRequired: handoff.summary?.directReadableStreamBackpressureRequired ?? null,
      conclusionAllowed: handoff.summary?.conclusionAllowed ?? null,
    },
    handoffIds: handoffs.map(item => item.id),
    guards: createHandoffGuards(byId),
  };
}

function createHandoffGuards(byId) {
  const safari = byId?.get('safari-webkit-browser-row-handoff') ?? null;
  const spiderMonkey = byId?.get('spidermonkey-codegen-handoff') ?? null;
  const safariChecks = safari?.closureChecks ?? [];
  const spiderChecks = spiderMonkey?.closureChecks ?? [];
  return [
    {
      id: 'handoff-loaded',
      description: 'runtime-proof-gap-handoff.json must be loaded by the gate.',
      satisfied: Boolean(byId),
    },
    {
      id: 'safari-primary-byte-batch-contract',
      description: 'Safari handoff must require primary synchronous Iterable<Uint8Array[]> rows and keep direct ReadableStream rows separate.',
      satisfied: /synchronous Iterable<Uint8Array\[\]>/.test(safari?.sourceConsumptionContract?.primaryParserInput ?? '')
        && /source-overhead evidence only/.test(safari?.sourceConsumptionContract?.directReadableStreamScope ?? '')
        && /not merged/.test(safari?.sourceConsumptionContract?.directReadableStreamScope ?? ''),
    },
    {
      id: 'safari-closure-checks-primary-bounded',
      description: 'Safari closure checks must require primary and bounded sync byte-batch rows plus closesSafariObligation=true.',
      satisfied: safariChecks.some(item => /primarySyncByteBatchRowsRecorded must be greater than 0/.test(item))
        && safariChecks.some(item => /boundedPrimarySyncByteBatchRowsRecorded must be greater than 0/.test(item))
        && safariChecks.some(item => /closesSafariObligation must be true/.test(item)),
    },
    {
      id: 'spidermonkey-emitted-ir-required',
      description: 'SpiderMonkey closure checks must require emitted IR/codegen evidence and no missing IR surface.',
      satisfied: spiderChecks.some(item => /emittedIrEvidenceCount must be greater than 0/.test(item))
        && spiderChecks.some(item => /missingIrSurfaceCount must be 0/.test(item)),
    },
    {
      id: 'spidermonkey-materialized-scope-not-enough',
      description: 'SpiderMonkey materialized js-shell codegen must require closureRequirementsBlocked=0 and closesCodegenObligation=true before closing.',
      satisfied: spiderChecks.some(item => /closureRequirementsBlocked must be 0/.test(item))
        && spiderChecks.some(item => /closesCodegenObligation must be true/.test(item)),
    },
    {
      id: 'spidermonkey-unchanged-stax-required',
      description: 'SpiderMonkey closing artifacts must require sameContractStaxRow=true and canRunCurrentStaxFullStringBenchmark=true unless a browser-row artifact supplies closure.',
      satisfied: spiderChecks.some(item => /sameContractStaxRow=true and canRunCurrentStaxFullStringBenchmark=true/.test(item)),
    },
  ];
}

function createCounterexampleSnapshot(comparison, counterexampleScan) {
  const comparisonCount = comparison?.summary?.jsRuntimeCounterexamples200MiB ?? null;
  const scanCount = counterexampleScan?.summary?.counterexampleCount ?? null;
  return {
    comparisonLoaded: Boolean(comparison),
    comparisonGeneratedAt: comparison?.generatedAt ?? null,
    comparisonCounterexampleCount: typeof comparisonCount === 'number' ? comparisonCount : null,
    counterexampleScanLoaded: Boolean(counterexampleScan),
    counterexampleScanGeneratedAt: counterexampleScan?.generatedAt ?? null,
    scanCounterexampleCount: typeof scanCount === 'number' ? scanCount : null,
    currentCounterexampleCount: (typeof comparisonCount === 'number' ? comparisonCount : 0)
      + (typeof scanCount === 'number' ? scanCount : 0),
  };
}

function createCoverageSnapshot(audit) {
  if (!audit) {
    return {
      loaded: false,
      generatedAt: null,
      activeObligationIds: [],
      coveredObligationIds: [],
      byId: {},
    };
  }

  const obligations = Array.isArray(audit.obligations) ? audit.obligations : [];
  const byId = Object.fromEntries(obligations.map(obligation => [obligation.id, {
    id: obligation.id,
    status: obligation.status ?? null,
    evidence: obligation.evidence ?? null,
    nextExperiment: obligation.nextExperiment ?? null,
  }]));
  return {
    loaded: true,
    generatedAt: audit.generatedAt ?? null,
    activeObligationIds: obligations
      .filter(obligation => obligation.status !== 'covered')
      .map(obligation => obligation.id),
    coveredObligationIds: obligations
      .filter(obligation => obligation.status === 'covered')
      .map(obligation => obligation.id),
    byId,
  };
}

function parseClaimRows(markdown) {
  const claims = {};
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith('| `CLAIM-')) continue;
    const cells = line.split('|').map(cell => cell.trim());
    if (cells.length < 6) continue;
    const id = cells[1]?.replace(/^`|`$/g, '');
    if (!id) continue;
    claims[id] = {
      id,
      claim: cells[2] ?? '',
      status: cells[3] ?? '',
      evidence: cells[4] ?? '',
      missing: cells[5] ?? '',
      row: line,
    };
  }
  return claims;
}

function evaluateClaimGuard(requirement, claims) {
  const claim = claims[requirement.claimId] ?? null;
  const actualStatus = claim?.status ?? null;
  const satisfied = Boolean(claim) && requirement.requiredStatus.every(status => statusHas(actualStatus, status));
  return {
    ...requirement,
    actualStatus,
    satisfied,
  };
}

function statusHas(statusText, status) {
  return typeof statusText === 'string' && statusText.includes(`\`${status}\``);
}

function renderMarkdown(report) {
  const lines = [
    '# Runtime-Limit Proof Obligation Gate',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Scope',
    '',
    'This is a static gate over the proof ledger for the broad `CLAIM-JS-RUNTIME-LIMIT-200MIB` claim. It does not prove a JavaScript runtime ceiling. It checks that the current ledger keeps the broad claim below conclusion strength while known proof obligations remain open.',
    '',
    '## Verdict',
    '',
    `- Gate pass: ${report.gate.pass ? 'yes' : 'no'}`,
    `- Gate status: ${report.gate.status}`,
    `- Conclusion allowed: ${report.conclusionAllowed ? 'yes' : 'no'}`,
    `- Runtime claim status: ${report.runtimeClaim?.status ?? 'missing'}`,
    '',
  ];

  if (report.gate.errors.length > 0) {
    lines.push('## Errors', '');
    for (const error of report.gate.errors) {
      lines.push(`- ${error}`);
    }
    lines.push('');
  }

  lines.push(
    '## Claim Guards',
    '',
    '| ID | Claim | Required status | Actual status | Satisfied |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const item of report.claimGuards) {
    lines.push(`| \`${item.id}\` | \`${item.claimId}\` | ${item.requiredStatus.map(status => `\`${status}\``).join(' + ')} | ${item.actualStatus ?? 'missing'} | ${item.satisfied ? 'yes' : 'no'} |`);
  }

  lines.push(
    '',
    '## Artifact Mentions',
    '',
    '| Artifact | Present |',
    '| --- | --- |',
  );
  for (const item of report.artifactMentions) {
    lines.push(`| \`${item.file}\` | ${item.present ? 'yes' : 'no'} |`);
  }

  lines.push(
    '',
    '## Open Obligations',
    '',
    'These are static disclosure guards. They must stay disclosed while the broad runtime-limit claim remains below `CONCLUSION`; the coverage snapshot column records whether the current evidence audit still treats each guard as active.',
    '',
    '| ID | Disclosed | Coverage status | Meaning |',
    '| --- | --- | --- | --- |',
  );
  for (const item of report.openObligations) {
    lines.push(`| \`${item.id}\` | ${item.disclosed ? 'yes' : 'no'} | ${item.coverageStatus ?? 'not in coverage audit'} | ${item.description} |`);
  }

  lines.push(
    '',
    '## Coverage Snapshot',
    '',
    report.coverageSnapshot.loaded
      ? `- Coverage audit loaded: yes (${report.coverageSnapshot.generatedAt ?? 'unknown generatedAt'})`
      : '- Coverage audit loaded: no',
    `- Active coverage obligations: ${report.coverageSnapshot.activeObligationIds.join(', ') || 'none'}`,
    `- Covered coverage obligations: ${report.coverageSnapshot.coveredObligationIds.join(', ') || 'none'}`,
  );

  lines.push(
    '',
    '## Counterexample Snapshot',
    '',
    report.counterexampleSnapshot.comparisonLoaded
      ? `- Same-contract comparison loaded: yes (${report.counterexampleSnapshot.comparisonGeneratedAt ?? 'unknown generatedAt'})`
      : '- Same-contract comparison loaded: no',
    `- Same-contract comparison counterexamples: ${formatNullableCount(report.counterexampleSnapshot.comparisonCounterexampleCount)}`,
    report.counterexampleSnapshot.counterexampleScanLoaded
      ? `- Runtime counterexample scan loaded: yes (${report.counterexampleSnapshot.counterexampleScanGeneratedAt ?? 'unknown generatedAt'})`
      : '- Runtime counterexample scan loaded: no',
    `- Runtime counterexample scan counterexamples: ${formatNullableCount(report.counterexampleSnapshot.scanCounterexampleCount)}`,
    `- Current release counterexamples: ${report.counterexampleSnapshot.currentCounterexampleCount}`,
  );

  lines.push(
    '',
    '## Handoff Snapshot',
    '',
    report.handoffSnapshot.loaded
      ? `- Handoff loaded: yes (${report.handoffSnapshot.generatedAt ?? 'unknown generatedAt'})`
      : '- Handoff loaded: no',
    `- Handoff active obligations: ${report.handoffSnapshot.activeObligationIds.join(', ') || 'none'}`,
    `- Handoff IDs: ${report.handoffSnapshot.handoffIds?.join(', ') || 'none'}`,
    '',
    '| ID | Satisfied | Meaning |',
    '| --- | --- | --- |',
  );
  for (const item of report.handoffSnapshot.guards) {
    lines.push(`| \`${item.id}\` | ${item.satisfied ? 'yes' : 'no'} | ${item.description} |`);
  }

  lines.push(
    '',
    '## Source Audit Snapshot',
    '',
    report.sourceAuditSnapshot.loaded
      ? `- Source audit loaded: yes (${report.sourceAuditSnapshot.generatedAt ?? 'unknown generatedAt'})`
      : '- Source audit loaded: no',
    `- Source audit status: ${report.sourceAuditSnapshot.status ?? 'unknown'}`,
    `- Primary parser input: ${report.sourceAuditSnapshot.primaryParserInput ?? 'unknown'}`,
    `- Primary sync byte-batch rows: ${formatNullableCount(report.sourceAuditSnapshot.primarySyncByteBatchRows)}`,
    `- Primary direct ReadableStream rows: ${formatNullableCount(report.sourceAuditSnapshot.primaryDirectReadableStreamRows)}`,
    `- Primary async source rows: ${formatNullableCount(report.sourceAuditSnapshot.primaryAsyncSourceRows)}`,
    `- Primary full ArrayBuffer parser-input rows: ${formatNullableCount(report.sourceAuditSnapshot.primaryFullArrayBufferRows)}`,
    `- Coverage crosscheck status: ${report.sourceAuditSnapshot.coverageCrosscheckStatus ?? 'unknown'}`,
    `- Coverage source-mode rows: ${formatNullableCount(report.sourceAuditSnapshot.coverageSourceModeRows)}`,
    `- Coverage not-full-ArrayBuffer rows: ${formatNullableCount(report.sourceAuditSnapshot.coverageNotFullArrayBufferRows)}/${formatNullableCount(report.sourceAuditSnapshot.coverageSourceModeRows)}`,
    `- Coverage full ArrayBuffer rows: ${formatNullableCount(report.sourceAuditSnapshot.coverageFullArrayBufferRows)}`,
    `- Coverage direct ReadableStream rows: ${formatNullableCount(report.sourceAuditSnapshot.coverageDirectReadableStreamRows)}`,
    '',
    '| ID | Satisfied | Meaning |',
    '| --- | --- | --- |',
  );
  for (const item of report.sourceAuditSnapshot.guards) {
    lines.push(`| \`${item.id}\` | ${item.satisfied ? 'yes' : 'no'} | ${item.description} |`);
  }

  lines.push(
    '',
    '## Frontier Audit Snapshot',
    '',
    report.frontierAuditSnapshot.memory.loaded
      ? `- Memory frontier loaded: yes (${report.frontierAuditSnapshot.memory.generatedAt ?? 'unknown generatedAt'})`
      : '- Memory frontier loaded: no',
    `- Fastest bounded JS row: ${formatNullableRate(report.frontierAuditSnapshot.memory.fastestBoundedRateMiBPerSec)} MiB/s at ${formatNullableRate(report.frontierAuditSnapshot.memory.fastestBoundedMaxMiB)} MiB`,
    `- Unbounded or unproven memory rows: ${formatNullableCount(report.frontierAuditSnapshot.memory.unboundedRows)}`,
    `- Unbounded rows at or above 200 MiB/s: ${formatNullableCount(report.frontierAuditSnapshot.memory.unboundedRowsAtOrAbove200MiBPerSec)}`,
    report.frontierAuditSnapshot.targetDistance.loaded
      ? `- Target distance loaded: yes (${report.frontierAuditSnapshot.targetDistance.generatedAt ?? 'unknown generatedAt'})`
      : '- Target distance loaded: no',
    `- Woodstox 0.9x target met: ${formatYesNo(report.frontierAuditSnapshot.targetDistance.woodstoxTargetMet)}`,
    `- Woodstox 0.9x remaining: ${formatNullableRate(report.frontierAuditSnapshot.targetDistance.woodstoxRemainingMiBPerSec)} MiB/s`,
    `- quick-xml 0.9x target met: ${formatYesNo(report.frontierAuditSnapshot.targetDistance.quickXmlTargetMet)}`,
    `- quick-xml 0.9x remaining: ${formatNullableRate(report.frontierAuditSnapshot.targetDistance.quickXmlRemainingMiBPerSec)} MiB/s`,
    report.frontierAuditSnapshot.textMaterialization.loaded
      ? `- Text materialization boundary loaded: yes (${report.frontierAuditSnapshot.textMaterialization.generatedAt ?? 'unknown generatedAt'})`
      : '- Text materialization boundary loaded: no',
    `- Fastest full-string row: ${formatNullableRate(report.frontierAuditSnapshot.textMaterialization.fastestFullRateMiBPerSec)} MiB/s`,
    `- Full-string rows crossing 200 MiB/s: ${formatNullableCount(report.frontierAuditSnapshot.textMaterialization.fullRowsCrossTarget)}`,
    `- No-text rows crossing 200 MiB/s: ${formatNullableCount(report.frontierAuditSnapshot.textMaterialization.noTextRowsCrossTarget)}`,
    '',
    '| ID | Satisfied | Meaning |',
    '| --- | --- | --- |',
  );
  for (const item of report.frontierAuditSnapshot.guards) {
    lines.push(`| \`${item.id}\` | ${item.satisfied ? 'yes' : 'no'} | ${item.description} |`);
  }

  lines.push(
    '',
    '## Proof Rules',
    '',
    'These checks keep known semantic distinctions from being collapsed into a stronger runtime-limit claim.',
    '',
    '| ID | Satisfied | Meaning |',
    '| --- | --- | --- |',
  );
  for (const item of report.proofRules) {
    lines.push(`| \`${item.id}\` | ${item.satisfied ? 'yes' : 'no'} | ${item.description} |`);
  }

  lines.push(
    '',
    '## Interpretation',
    '',
    createInterpretation(report),
  );

  return `${lines.join('\n')}\n`;
}

function formatNullableCount(value) {
  return typeof value === 'number' ? String(value) : 'unknown';
}

function formatNullableRate(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'unknown';
}

function formatYesNo(value) {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return 'unknown';
}

function createInterpretation(report) {
  const activeCoverage = report.coverageSnapshot.activeObligationIds;
  const activeText = activeCoverage.length > 0
    ? `Current coverage audit blockers: ${activeCoverage.join(', ')}.`
    : report.coverageSnapshot.loaded
      ? 'The coverage audit reports no active coverage obligations, but this static gate still is not a runtime-limit conclusion artifact.'
      : 'Coverage-audit status was not loaded, so static disclosure guards must be read without current covered/open reconciliation.';
  return [
    'A passing report currently means the proof ledger is conservative, not that the target runtime limit has been proven.',
    activeText,
    'Static disclosure guards may include evidence families that the latest coverage audit already marks covered; those guards prevent stale broad conclusions, not duplicate the active coverage list.',
    'A future 200 MiB/s+ bounded-memory full-string JavaScript row remains a counterexample.',
  ].join(' ');
}

function writeOutput(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function printSummary(report) {
  console.log(`runtime-limit-proof-obligation-gate: pass=${report.gate.pass} conclusionAllowed=${report.conclusionAllowed}`);
  if (report.gate.errors.length > 0) {
    for (const error of report.gate.errors) {
      console.log(`  error: ${error}`);
    }
  }
}

main();
