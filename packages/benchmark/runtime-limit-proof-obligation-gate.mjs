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
const defaultHandoffValidationJson = resolve(__dirname, 'results', 'release', 'runtime-proof-handoff-validation.json');
const defaultSourceAuditJson = resolve(__dirname, 'results', 'release', 'source-consumption-shape-audit.json');
const defaultMemoryFrontierJson = resolve(__dirname, 'results', 'release', 'memory-frontier-audit.json');
const defaultTargetDistanceJson = resolve(__dirname, 'results', 'release', 'target-distance-audit.json');
const defaultTextMaterializationBoundaryJson = resolve(__dirname, 'results', 'release', 'text-materialization-boundary-audit.json');
const defaultJsonOut = resolve(__dirname, 'results', 'release', 'runtime-limit-proof-obligation-gate.json');
const defaultMdOut = resolve(__dirname, 'results', 'release', 'runtime-limit-proof-obligation-gate.md');

const runtimeLimitClaimId = 'CLAIM-JS-RUNTIME-LIMIT-200MIB';
const expectedSpiderMonkeyClosureGapArtifacts = [
  'spidermonkey-jsshell-materialized-headroom.json',
  'spidermonkey-jsshell-tokenizer-headroom.json',
  'spidermonkey-taskcluster-debug-jsshell-codegen-rerun.json',
  'spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun.json',
];

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
  'stax-public-reader-host-api-boundary-audit.md',
  'bun-jsc-partial-codegen-trace.md',
  'bun-jsc-textdecoder-codegen-trace.md',
  'stream-source-consumption-shapes.md',
  'stream-source-consumption-backpressure-counters.md',
  'event-reader-byte-batch-cross-process-corpus.md',
  'segment-scan-headroom.md',
  'segment-tokenizer-headroom.md',
  'segment-tokenizer-string-frontier.md',
  'runtime-proof-gap-handoff.md',
  'runtime-proof-handoff-validation.md',
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
    handoffValidationJson: defaultHandoffValidationJson,
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
      case '--handoff-validation-json':
        options.handoffValidationJson = resolve(process.cwd(), readValue());
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
  const handoffValidation = readOptionalJson(options.handoffValidationJson, 'runtime-proof-handoff-validation');
  const sourceAudit = readOptionalJson(options.sourceAuditJson, 'source-consumption-shape-audit');
  const memoryFrontier = readOptionalJson(options.memoryFrontierJson, 'memory-frontier-audit');
  const targetDistance = readOptionalJson(options.targetDistanceJson, 'target-distance-audit');
  const textMaterializationBoundary = readOptionalJson(options.textMaterializationBoundaryJson, 'text-materialization-boundary-audit');
  const report = createReport({ options, ledgerMarkdown, coverageAudit, comparison, counterexampleScan, handoff, handoffValidation, sourceAudit, memoryFrontier, targetDistance, textMaterializationBoundary });
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

function createReport({ options, ledgerMarkdown, coverageAudit, comparison, counterexampleScan, handoff, handoffValidation, sourceAudit, memoryFrontier, targetDistance, textMaterializationBoundary }) {
  const claims = parseClaimRows(ledgerMarkdown);
  const coverageSnapshot = createCoverageSnapshot(coverageAudit);
  const counterexampleSnapshot = createCounterexampleSnapshot(comparison, counterexampleScan, coverageAudit);
  const handoffSnapshot = createHandoffSnapshot(handoff);
  const handoffValidationSnapshot = createHandoffValidationSnapshot(handoffValidation, handoffSnapshot);
  const sourceAuditSnapshot = createSourceAuditSnapshot(sourceAudit, comparison, coverageAudit);
  const frontierAuditSnapshot = createFrontierAuditSnapshot(memoryFrontier, targetDistance, textMaterializationBoundary, comparison);
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
  for (const guard of counterexampleSnapshot.guards.filter(item => !item.satisfied)) {
    errors.push(`Missing counterexample scan guard ${guard.id}: ${guard.description}`);
  }
  for (const guard of handoffSnapshot.guards.filter(item => !item.satisfied)) {
    errors.push(`Missing handoff guard ${guard.id}: ${guard.description}`);
  }
  for (const guard of handoffValidationSnapshot.guards.filter(item => !item.satisfied)) {
    errors.push(`Missing handoff validation guard ${guard.id}: ${guard.description}`);
  }
  for (const guard of coverageSnapshot.guards.filter(item => !item.satisfied)) {
    errors.push(`Missing coverage guard ${guard.id}: ${guard.description}`);
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
      handoffValidationJson: options.handoffValidationJson,
      sourceAuditJson: options.sourceAuditJson,
      memoryFrontierJson: options.memoryFrontierJson,
      targetDistanceJson: options.targetDistanceJson,
      textMaterializationBoundaryJson: options.textMaterializationBoundaryJson,
      coverageLoaded: coverageSnapshot.loaded,
      comparisonLoaded: counterexampleSnapshot.comparisonLoaded,
      counterexampleScanLoaded: counterexampleSnapshot.counterexampleScanLoaded,
      handoffLoaded: handoffSnapshot.loaded,
      handoffValidationLoaded: handoffValidationSnapshot.loaded,
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
    handoffValidationSnapshot,
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
      satisfiedCounterexampleScanGuards: counterexampleSnapshot.guards.filter(item => item.satisfied).length,
      requiredCounterexampleScanGuards: counterexampleSnapshot.guards.length,
      satisfiedCoverageGuards: coverageSnapshot.guards.filter(item => item.satisfied).length,
      requiredCoverageGuards: coverageSnapshot.guards.length,
      satisfiedHandoffGuards: handoffSnapshot.guards.filter(item => item.satisfied).length,
      requiredHandoffGuards: handoffSnapshot.guards.length,
      satisfiedHandoffValidationGuards: handoffValidationSnapshot.guards.filter(item => item.satisfied).length,
      requiredHandoffValidationGuards: handoffValidationSnapshot.guards.length,
      satisfiedSourceAuditGuards: sourceAuditSnapshot.guards.filter(item => item.satisfied).length,
      requiredSourceAuditGuards: sourceAuditSnapshot.guards.length,
      satisfiedFrontierAuditGuards: frontierAuditSnapshot.guards.filter(item => item.satisfied).length,
      requiredFrontierAuditGuards: frontierAuditSnapshot.guards.length,
    },
  };
}

function createFrontierAuditSnapshot(memoryFrontier, targetDistance, textMaterializationBoundary, comparison = null) {
  const memory = {
    loaded: Boolean(memoryFrontier),
    generatedAt: memoryFrontier?.generatedAt ?? null,
    inputComparisonGeneratedAt: memoryFrontier?.inputs?.comparisonGeneratedAt ?? null,
    currentComparisonGeneratedAt: comparison?.generatedAt ?? null,
    status: memoryFrontier?.summary?.status ?? null,
    fastestBoundedRateMiBPerSec: memoryFrontier?.summary?.fastestBoundedRow?.rateMiBPerSec ?? null,
    fastestBoundedMaxMiB: memoryFrontier?.summary?.fastestBoundedRow?.maxMiB ?? null,
    unboundedRows: memoryFrontier?.summary?.unboundedRows ?? null,
    boundedRowsWithoutNumericMemoryProof: memoryFrontier?.summary?.boundedRowsWithoutNumericMemoryProof ?? null,
    unboundedRowsAtOrAbove200MiBPerSec: memoryFrontier?.summary?.unboundedRowsAtOrAbove200MiBPerSec ?? null,
    conclusionAllowed: memoryFrontier?.summary?.conclusionAllowed ?? null,
  };
  const woodstox = targetDistance?.summary?.sameFixture1024MiBWoodstoxTarget ?? {};
  const quickXml = targetDistance?.summary?.sameFixture1024MiBQuickXmlTarget ?? {};
  const fastestJsContract = targetDistance?.summary?.sameFixtureFastestJsContract ?? {};
  const target = {
    loaded: Boolean(targetDistance),
    generatedAt: targetDistance?.generatedAt ?? null,
    inputComparisonGeneratedAt: targetDistance?.inputs?.comparisonGeneratedAt ?? null,
    currentComparisonGeneratedAt: comparison?.generatedAt ?? null,
    status: targetDistance?.summary?.status ?? null,
    woodstoxTargetMet: woodstox.targetMet ?? null,
    quickXmlTargetMet: quickXml.targetMet ?? null,
    sharedFastestJsTargetRow: targetDistance?.summary?.sharedFastestJsTargetRow ?? null,
    woodstoxRemainingMiBPerSec: woodstox.remainingTo90PercentMiBPerSec ?? null,
    quickXmlRemainingMiBPerSec: quickXml.remainingTo90PercentMiBPerSec ?? null,
    fastestJsCaseId: woodstox.fastestJsCaseId ?? null,
    fastestJsRateMiBPerSec: woodstox.fastestJsRateMiBPerSec ?? null,
    fastestJsSourceMode: fastestJsContract.sourceMode ?? null,
    fastestJsDirectReadableStream: fastestJsContract.directReadableStream ?? null,
    fastestJsFullArrayBufferParserInput: fastestJsContract.fullArrayBufferParserInput ?? null,
    fastestJsBoundedMemory: fastestJsContract.boundedMemory ?? null,
    fastestJsMemoryKind: fastestJsContract.memoryKind ?? null,
    fastestJsMaxRssMiB: fastestJsContract.maxRssMiB ?? null,
    conclusionAllowed: targetDistance?.summary?.conclusionAllowed ?? null,
  };
  const text = {
    loaded: Boolean(textMaterializationBoundary),
    generatedAt: textMaterializationBoundary?.generatedAt ?? null,
    inputComparisonGeneratedAt: textMaterializationBoundary?.inputs?.comparisonGeneratedAt ?? null,
    currentComparisonGeneratedAt: comparison?.generatedAt ?? null,
    status: textMaterializationBoundary?.summary?.status ?? null,
    fastestFullRateMiBPerSec: textMaterializationBoundary?.summary?.fastestFull?.rateMiBPerSec ?? null,
    fastestWithoutTextFullStringParity: textMaterializationBoundary?.summary?.fastestWithoutText?.fullStringParity ?? null,
    fullRowsCrossTarget: textMaterializationBoundary?.summary?.fullRowsCrossTarget ?? null,
    noTextRowsCrossTarget: textMaterializationBoundary?.summary?.noTextRowsCrossTarget ?? null,
    noTrimRowsCrossTarget: textMaterializationBoundary?.summary?.noTrimRowsCrossTarget ?? null,
    foldTrimRowsCrossTarget: textMaterializationBoundary?.summary?.foldTrimRowsCrossTarget ?? null,
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
      id: 'frontier-audits-current-comparison',
      description: 'Frontier audits must reference the currently loaded same-contract-runtime-comparison.json generatedAt.',
      satisfied: memory.loaded
        && target.loaded
        && text.loaded
        && typeof memory.inputComparisonGeneratedAt === 'string'
        && memory.inputComparisonGeneratedAt === memory.currentComparisonGeneratedAt
        && target.inputComparisonGeneratedAt === target.currentComparisonGeneratedAt
        && text.inputComparisonGeneratedAt === text.currentComparisonGeneratedAt,
    },
    {
      id: 'memory-frontier-classified',
      description: 'memory-frontier-audit.json must classify 1 GiB+ JavaScript full-string memory rows and keep unbounded rows visible.',
      satisfied: memory.loaded
        && memory.status === 'classified'
        && typeof memory.fastestBoundedRateMiBPerSec === 'number'
        && typeof memory.fastestBoundedMaxMiB === 'number'
        && typeof memory.unboundedRows === 'number'
        && memory.unboundedRows > 0
        && memory.boundedRowsWithoutNumericMemoryProof === 0
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
        && target.sharedFastestJsTargetRow === true
        && typeof target.woodstoxRemainingMiBPerSec === 'number'
        && target.woodstoxRemainingMiBPerSec > 0
        && typeof target.quickXmlRemainingMiBPerSec === 'number'
        && target.quickXmlRemainingMiBPerSec > 0
        && target.conclusionAllowed === false,
    },
    {
      id: 'target-distance-js-contract-primary-bounded',
      description: 'target-distance-audit.json must compare external targets against a bounded file-backed synchronous byte-batch JavaScript row, not direct streams or full ArrayBuffer parser input.',
      satisfied: target.loaded
        && target.status === 'classified'
        && target.fastestJsSourceMode === 'file-backed-sync-iterable-byte-batches'
        && target.fastestJsDirectReadableStream === false
        && target.fastestJsFullArrayBufferParserInput === false
        && target.fastestJsBoundedMemory === true
        && target.fastestJsMemoryKind === 'process-rss'
        && typeof target.fastestJsMaxRssMiB === 'number'
        && target.fastestJsMaxRssMiB < 128
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
    {
      id: 'text-frontier-trim-variants-below-target',
      description: 'text-materialization-boundary-audit.json must show no-trim and fold-trim variants do not cross 200 MiB/s, and without-text headroom is not full-string parity.',
      satisfied: text.loaded
        && text.status === 'classified'
        && text.noTrimRowsCrossTarget === 0
        && text.foldTrimRowsCrossTarget === 0
        && text.fastestWithoutTextFullStringParity === false
        && text.conclusionAllowed === false,
    },
  ];
}

function createSourceAuditSnapshot(sourceAudit, comparison = null, coverageAudit = null) {
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
  const representativeStreamRowsRespectBackpressure = summary?.representativeStreamRowsRespectBackpressure ?? null;
  return {
    loaded: Boolean(sourceAudit),
    generatedAt: sourceAudit?.generatedAt ?? null,
    inputComparisonGeneratedAt: sourceAudit?.inputs?.comparisonGeneratedAt ?? null,
    currentComparisonGeneratedAt: comparison?.generatedAt ?? null,
    inputCoverageGeneratedAt: sourceAudit?.inputs?.coverageGeneratedAt ?? null,
    currentCoverageGeneratedAt: coverageAudit?.generatedAt ?? null,
    status: summary?.status ?? null,
    primarySourceContract: summary?.primarySourceContract ?? null,
    primaryParserInput,
    primarySourceBoundary: summary?.primarySourceBoundary ?? null,
    primarySyncByteBatchRows,
    primaryDirectReadableStreamRows,
    primaryAsyncSourceRows,
    primaryFullArrayBufferRows,
    primaryUnknownSourceModeRows,
    representativeStreamRowsRespectBackpressure,
    coverageCrosscheckStatus: coverageCrosscheck?.status ?? null,
    coverageSourceModeRows: sourceModeRows,
    coverageNotFullArrayBufferRows: notFullArrayBufferRows,
    coverageFullArrayBufferRows: fullArrayBufferRows,
    coverageUnknownArrayBufferRows: unknownArrayBufferRows,
    coverageDirectReadableStreamRows: directReadableStreamRows,
    guards: createSourceAuditGuards({
      loaded: Boolean(sourceAudit),
      inputComparisonGeneratedAt: sourceAudit?.inputs?.comparisonGeneratedAt ?? null,
      currentComparisonGeneratedAt: comparison?.generatedAt ?? null,
      inputCoverageGeneratedAt: sourceAudit?.inputs?.coverageGeneratedAt ?? null,
      currentCoverageGeneratedAt: coverageAudit?.generatedAt ?? null,
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
      representativeStreamRowsRespectBackpressure,
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
      id: 'source-audit-current-inputs',
      description: 'source-consumption-shape-audit.json must reference the currently loaded comparison and coverage audit generatedAt values.',
      satisfied: typeof snapshot.inputComparisonGeneratedAt === 'string'
        && snapshot.inputComparisonGeneratedAt === snapshot.currentComparisonGeneratedAt
        && typeof snapshot.inputCoverageGeneratedAt === 'string'
        && snapshot.inputCoverageGeneratedAt === snapshot.currentCoverageGeneratedAt,
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
    {
      id: 'representative-stream-backpressure-proven',
      description: 'Representative direct ReadableStream and async byte-batch rows must carry explicit backpressure proof before source-overhead evidence is cited.',
      satisfied: snapshot.representativeStreamRowsRespectBackpressure === true,
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

function createHandoffValidationSnapshot(validation, handoffSnapshot = null) {
  if (!validation) {
    return {
      loaded: false,
      generatedAt: null,
      validatedHandoffGeneratedAt: null,
      currentHandoffGeneratedAt: handoffSnapshot?.generatedAt ?? null,
      pass: null,
      allContractsPresent: null,
      requiredHandoffsPresent: null,
      unhandledObligationCount: null,
      handoffIds: [],
      guards: createHandoffValidationGuards(null),
    };
  }

  const handoffChecks = Array.isArray(validation.handoffChecks) ? validation.handoffChecks : [];
  const snapshot = {
    loaded: true,
    generatedAt: validation.generatedAt ?? null,
    validatedHandoffGeneratedAt: validation.inputs?.handoffGeneratedAt ?? null,
    currentHandoffGeneratedAt: handoffSnapshot?.generatedAt ?? null,
    pass: validation.summary?.pass ?? null,
    allContractsPresent: validation.summary?.allContractsPresent ?? null,
    requiredHandoffsPresent: validation.summary?.requiredHandoffsPresent ?? null,
    unhandledObligationCount: validation.summary?.unhandledObligationCount ?? null,
    handoffIds: handoffChecks.map(check => check.id).filter(Boolean),
    guards: [],
  };
  snapshot.guards = createHandoffValidationGuards(snapshot);
  return snapshot;
}

function createHandoffValidationGuards(snapshot) {
  return [
    {
      id: 'handoff-validation-loaded',
      description: 'runtime-proof-handoff-validation.json must be loaded by the gate.',
      satisfied: snapshot?.loaded === true,
    },
    {
      id: 'handoff-validation-pass',
      description: 'runtime-proof-handoff-validation.json summary.pass must be true before the gate can pass.',
      satisfied: snapshot?.pass === true,
    },
    {
      id: 'handoff-validation-contracts-present',
      description: 'runtime-proof-handoff-validation.json must report all required contracts present.',
      satisfied: snapshot?.allContractsPresent === true,
    },
    {
      id: 'handoff-validation-required-handoffs-present',
      description: 'runtime-proof-handoff-validation.json must report required Safari and SpiderMonkey handoffs present.',
      satisfied: snapshot?.requiredHandoffsPresent === true,
    },
    {
      id: 'handoff-validation-current-handoff',
      description: 'runtime-proof-handoff-validation.json must validate the currently loaded runtime-proof-gap-handoff.json generatedAt.',
      satisfied: typeof snapshot?.validatedHandoffGeneratedAt === 'string'
        && snapshot.validatedHandoffGeneratedAt === snapshot.currentHandoffGeneratedAt,
    },
    {
      id: 'handoff-validation-no-unhandled-obligations',
      description: 'runtime-proof-handoff-validation.json must validate a handoff with zero unhandled obligations.',
      satisfied: snapshot?.unhandledObligationCount === 0,
    },
  ];
}

function createHandoffGuards(byId) {
  const safari = byId?.get('safari-webkit-browser-row-handoff') ?? null;
  const spiderMonkey = byId?.get('spidermonkey-codegen-handoff') ?? null;
  const safariChecks = safari?.closureChecks ?? [];
  const safariBlockers = safari?.localClosure?.blockers ?? [];
  const spiderExpected = spiderMonkey?.expectedEvidence ?? [];
  const spiderChecks = spiderMonkey?.closureChecks ?? [];
  const spiderBlockers = spiderMonkey?.localClosure?.blockers ?? [];
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
      id: 'safari-closure-checks-same-contract-comparison',
      description: 'Safari closure checks must require bounded primary rows to match same-contract-runtime-comparison.json by row id, event count, and checksum via primaryRowsInSameContractComparison.',
      satisfied: safariChecks.some(item => /primaryRowsInSameContractComparison must be true/.test(item))
        && safariChecks.some(item => /same-contract-runtime-comparison\.json/.test(item))
        && safariChecks.some(item => /row id, event count, and checksum/.test(item)),
    },
    {
      id: 'safari-closure-checks-1gib-primary',
      description: 'Safari closure checks must require largeBoundedPrimarySyncByteBatchRowsRecorded and largePrimaryRowsInSameContractComparison for 1 GiB+ bounded primary row id, event count, and checksum parity.',
      satisfied: safariChecks.some(item => /largeBoundedPrimarySyncByteBatchRowsRecorded must be greater than 0/.test(item))
        && safariChecks.some(item => /largePrimaryRowsInSameContractComparison must be true/.test(item))
        && safariChecks.some(item => /1 GiB\+ bounded primary row id, event count, and checksum/.test(item)),
    },
    {
      id: 'safari-local-availability-blocker',
      description: 'Safari handoff must preserve the local Safari availability blocker and zero-candidate closure audit summary.',
      satisfied: safariBlockers.some(item => /Current host cannot run Safari\/WebKit browser rows/.test(item))
        && safariBlockers.some(item => /Safari\/WebKit closure audit checks candidateRows=0/.test(item)),
    },
    {
      id: 'spidermonkey-closing-artifact-schema-evidence',
      description: 'SpiderMonkey expected evidence must require explicit closure declarations, same-contract row status, comparison match, and allowed evidence class.',
      satisfied: spiderExpected.some(item => /closesEmittedIrObligation=true/.test(item))
        && spiderExpected.some(item => /sameContractStaxRow=true/.test(item))
        && spiderExpected.some(item => /canRunCurrentStaxFullStringBenchmark=true/.test(item))
        && spiderExpected.some(item => /selectedRowMatchesCurrentComparison=true/.test(item))
        && spiderExpected.some(item => /evidenceClassAllowed=true/.test(item)),
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
    {
      id: 'spidermonkey-same-contract-comparison-required',
      description: 'SpiderMonkey closing artifacts must require the selected row id to match same-contract-runtime-comparison.json with event count and checksum parity.',
      satisfied: spiderChecks.some(item => /selected row id must match a current same-contract full-string JavaScript row/.test(item))
        && spiderChecks.some(item => /same-contract-runtime-comparison\.json/.test(item))
        && spiderChecks.some(item => /event count and checksum parity/.test(item)),
    },
    {
      id: 'spidermonkey-closing-metadata-required',
      description: 'SpiderMonkey closing artifacts must require runtime/build identity, diagnostic flags, row identity, checksum parity, and emitted IR or optimized-code dump metadata.',
      satisfied: spiderChecks.some(item => /closing artifact must include runtime\/build identity/.test(item))
        && spiderChecks.some(item => /diagnostic flags/.test(item))
        && spiderChecks.some(item => /selected row id/.test(item))
        && spiderChecks.some(item => /checksum parity/.test(item))
        && spiderChecks.some(item => /emitted IR or optimized-code dump metadata/.test(item)),
    },
    {
      id: 'spidermonkey-diagnostic-row-identity-blocker',
      description: 'SpiderMonkey diagnostic rows must remain blocked with selectedRowIdentityStatus=not-claimed-non-stax-diagnostic until they are same-contract StAX closure evidence.',
      satisfied: spiderBlockers.some(item => /selectedRowIdentityStatus=not-claimed-non-stax-diagnostic/.test(item)),
    },
    {
      id: 'spidermonkey-closure-audit-identity-statuses',
      description: 'SpiderMonkey closure audit must preserve non-StAX diagnostic identity status counts for closure-matrix candidates.',
      satisfied: spiderBlockers.some(item => /selectedRowIdentityStatusCounts not-claimed-non-stax-diagnostic=\d+/.test(item)),
    },
    {
      id: 'spidermonkey-selected-row-metadata-missing-fields',
      description: 'SpiderMonkey closure audit must preserve which selected-row metadata fields are missing from closure-matrix candidates.',
      satisfied: spiderBlockers.some(item =>
        /selectedRowMetadataMissingFieldCounts selectedChecksum=\d+, selectedEventCount=\d+, selectedRowId=\d+/.test(item)
      ),
    },
    {
      id: 'spidermonkey-selected-row-comparison-match-counts',
      description: 'SpiderMonkey closure audit must preserve selected-row comparison match counts against same-contract-runtime-comparison.json.',
      satisfied: spiderBlockers.some(item =>
        /selectedRowComparisonMatchCount=\d+, selectedRowComparisonMismatchCount=\d+, selectedRowComparisonMissingCount=\d+/.test(item)
      ),
    },
    {
      id: 'spidermonkey-codegen-comparison-freshness',
      description: 'SpiderMonkey closure audit must preserve the same-contract comparison generatedAt and row count used for selected-row matching.',
      satisfied: spiderBlockers.some(item =>
        /against same-contract comparison generatedAt=[^,]+, comparisonRowCount=\d+/.test(item)
      ),
    },
    {
      id: 'spidermonkey-closing-metadata-missing-fields',
      description: 'SpiderMonkey closure audit must preserve which closing metadata subfields are missing from closure-matrix candidates.',
      satisfied: spiderBlockers.some(item =>
        /closingMetadataMissingFieldCounts diagnosticFlags=\d+, emittedDumpMetadata=\d+, runtimeBuildIdentity=\d+/.test(item)
      ),
    },
    {
      id: 'spidermonkey-disallowed-evidence-class-counts',
      description: 'SpiderMonkey closure audit must preserve which diagnostic scope-guard evidence classes are disallowed as closure evidence.',
      satisfied: spiderBlockers.some(item =>
        /disallowedEvidenceClassCounts .*current-debug-codegen-scope-guard=\d+/.test(item)
      ),
    },
    {
      id: 'spidermonkey-closure-frontier-blockers',
      description: 'SpiderMonkey handoff must preserve named closest blocked candidates and common missing requirements from the closure audit frontier.',
      satisfied: spiderBlockers.some(item =>
        /closestBlockedCandidateCount=\d+/.test(item)
        && /minimumBlockedRequirementCount=\d+/.test(item)
        && /closestBlockedCandidates=.*spidermonkey-taskcluster-debug-jsshell-codegen-audit\.json/.test(item)
        && /closestBlockedCandidates=.*spidermonkey-taskcluster-debug-jsshell-codegen-rerun\.json/.test(item)
        && /closestBlockedCandidates=.*spidermonkey-taskcluster-debug-jsshell-materialized-codegen-audit\.json/.test(item)
        && /closestBlockedCandidates=.*spidermonkey-taskcluster-debug-jsshell-materialized-codegen-rerun\.json/.test(item)
        && /closestBlockedCandidates=.*spidermonkey-taskcluster-debug-jsshell-xml-codegen-audit\.json/.test(item)
        && /sameContractStaxRow=\d+/.test(item)
        && /selectedRowMetadata=\d+/.test(item)
        && /unchangedRunnable=\d+/.test(item)
      ),
    },
    {
      id: 'spidermonkey-contradicted-closure-claims-clear',
      description: 'SpiderMonkey closure audit must preserve contradictedClosureClaimCount=0 before codegen evidence can be reclassified.',
      satisfied: spiderBlockers.some(item => /contradictedClosureClaimCount=0/.test(item)),
    },
  ];
}

function createCounterexampleSnapshot(comparison, counterexampleScan, coverageAudit = null) {
  const comparisonCount = comparison?.summary?.jsRuntimeCounterexamples200MiB ?? null;
  const comparisonContract = comparison?.comparisonContract ?? null;
  const comparisonRows = Array.isArray(comparison?.comparisonRows) ? comparison.comparisonRows : null;
  const scanCount = counterexampleScan?.summary?.counterexampleCount ?? null;
  const snapshot = {
    comparisonLoaded: Boolean(comparison),
    comparisonGeneratedAt: comparison?.generatedAt ?? null,
    comparisonObjective: comparison?.objective ?? null,
    comparisonContractId: comparison?.contract ?? null,
    comparisonSemanticBasis: comparisonContract?.semanticBasis ?? null,
    comparisonObjectShapeEquivalence: comparisonContract?.objectShapeEquivalence ?? null,
    comparisonTargetDistanceOnly: comparisonContract?.targetDistanceOnly ?? null,
    comparisonPrimaryJsPublicEventCase: comparisonContract?.primaryJsPublicEventCase ?? null,
    comparisonPrimaryJsSourceContract: comparisonContract?.primaryJsSourceContract ?? null,
    comparisonSourceModeEquivalence: comparisonContract?.sourceModeEquivalence ?? null,
    comparisonMemoryEquivalence: comparisonContract?.memoryEquivalence ?? null,
    comparisonExternalBaselineRuntimeIds: Array.isArray(comparisonContract?.externalBaselines)
      ? comparisonContract.externalBaselines.map(entry => entry.runtimeId)
      : [],
    comparisonSummaryRowCount: comparison?.summary?.rowCount ?? null,
    comparisonRowCount: comparisonRows ? comparisonRows.length : null,
    comparisonJsLargeFullRowCount: comparison?.summary?.jsLargeFullRowCount ?? null,
    comparisonCounterexampleCount: typeof comparisonCount === 'number' ? comparisonCount : null,
    counterexampleScanLoaded: Boolean(counterexampleScan),
    counterexampleScanGeneratedAt: counterexampleScan?.generatedAt ?? null,
    thresholdMiBPerSec: counterexampleScan?.parameters?.thresholdMiBPerSec ?? null,
    minSizeGiB: counterexampleScan?.parameters?.minSizeGiB ?? null,
    scanParseErrorCount: counterexampleScan?.summary?.parseErrorCount ?? null,
    scanScannedArtifactCount: counterexampleScan?.summary?.scannedArtifactCount ?? null,
    coverageScannedArtifactCount: coverageAudit?.summary?.scannedArtifactCount ?? null,
    scanMeasuredRowCount: counterexampleScan?.summary?.measuredRowCount ?? null,
    coverageMeasuredRowCount: coverageAudit?.summary?.measuredRowCount ?? null,
    scanCounterexampleCount: typeof scanCount === 'number' ? scanCount : null,
    currentCounterexampleCount: (typeof comparisonCount === 'number' ? comparisonCount : 0)
      + (typeof scanCount === 'number' ? scanCount : 0),
  };
  snapshot.guards = createCounterexampleScanGuards(snapshot);
  return snapshot;
}

function createCounterexampleScanGuards(snapshot) {
  return [
    {
      id: 'same-contract-comparison-loaded',
      description: 'same-contract-runtime-comparison.json must be loaded by the gate.',
      satisfied: snapshot.comparisonLoaded === true,
    },
    {
      id: 'same-contract-comparison-contract',
      description: 'same-contract-runtime-comparison.json must preserve checksum/event-count semantics without claiming JavaScript object-shape, memory, or source-mode equivalence.',
      satisfied: snapshot.comparisonObjective === 'same-contract-runtime-comparison'
        && snapshot.comparisonContractId === 'same-full-string-checksum-contract-not-same-object-shape'
        && /same full-string event count and checksum/i.test(snapshot.comparisonSemanticBasis ?? '')
        && snapshot.comparisonObjectShapeEquivalence === false
        && snapshot.comparisonTargetDistanceOnly === true
        && snapshot.comparisonPrimaryJsPublicEventCase === 'eventObjectFull'
        && /synchronous Iterable<Uint8Array\[\]> byte batches/.test(snapshot.comparisonPrimaryJsSourceContract ?? '')
        && /exclude direct ReadableStream/.test(snapshot.comparisonPrimaryJsSourceContract ?? '')
        && /file-backed JavaScript rows use synchronous Iterable<Uint8Array\[\]>/.test(snapshot.comparisonSourceModeEquivalence ?? '')
        && snapshot.comparisonMemoryEquivalence === false
        && snapshot.comparisonExternalBaselineRuntimeIds.includes('woodstox-jvm')
        && snapshot.comparisonExternalBaselineRuntimeIds.includes('quick-xml-rust'),
    },
    {
      id: 'same-contract-comparison-row-count',
      description: 'same-contract-runtime-comparison.json summary.rowCount must match the actual comparisonRows length.',
      satisfied: typeof snapshot.comparisonSummaryRowCount === 'number'
        && snapshot.comparisonSummaryRowCount > 0
        && snapshot.comparisonSummaryRowCount === snapshot.comparisonRowCount,
    },
    {
      id: 'same-contract-comparison-large-js-rows',
      description: 'same-contract-runtime-comparison.json must include large full-string JavaScript rows for the counterexample frontier.',
      satisfied: typeof snapshot.comparisonJsLargeFullRowCount === 'number'
        && snapshot.comparisonJsLargeFullRowCount > 0,
    },
    {
      id: 'counterexample-scan-loaded',
      description: 'runtime-counterexample-scan.json must be loaded by the gate.',
      satisfied: snapshot.counterexampleScanLoaded === true,
    },
    {
      id: 'counterexample-scan-parameters',
      description: 'runtime-counterexample-scan.json must preserve the 200 MiB/s and 0.999 GiB counterexample threshold contract.',
      satisfied: snapshot.thresholdMiBPerSec === 200
        && snapshot.minSizeGiB === 0.999,
    },
    {
      id: 'counterexample-scan-no-parse-errors',
      description: 'runtime-counterexample-scan.json must report zero release artifact parse errors.',
      satisfied: snapshot.scanParseErrorCount === 0,
    },
    {
      id: 'counterexample-scan-current-coverage-shape',
      description: 'runtime-counterexample-scan.json must scan the same artifact and measured-row counts as the current coverage audit.',
      satisfied: typeof snapshot.scanScannedArtifactCount === 'number'
        && snapshot.scanScannedArtifactCount === snapshot.coverageScannedArtifactCount
        && typeof snapshot.scanMeasuredRowCount === 'number'
        && snapshot.scanMeasuredRowCount === snapshot.coverageMeasuredRowCount,
    },
  ];
}

function createCoverageSnapshot(audit) {
  if (!audit) {
    return {
      loaded: false,
      generatedAt: null,
      activeObligationIds: [],
      coveredObligationIds: [],
      byId: {},
      spiderMonkeyDiagnostics: {
        selectedRowIdentityStatusCounts: {},
        diagnosticRowCount: null,
        diagnosticRowSourceArtifacts: [],
        closureAuditCandidateCount: null,
        closureAuditCandidateSourceArtifacts: [],
        closureAuditDiagnosticRowGap: null,
        closureAuditCandidateSourcesOutsideDiagnostics: [],
        diagnosticSourcesOutsideClosureAudit: [],
        closureAuditQualifiedClosureCount: null,
      },
      spiderMonkeyTaskclusterRouteFreshness: {
        routeFresh: null,
        expectedIdentityMatchesRoute: null,
        artifactIdentityMatchesRoute: null,
        checkedArtifactCount: null,
        mismatchedArtifacts: [],
      },
      guards: createCoverageGuards(null),
    };
  }

  const obligations = Array.isArray(audit.obligations) ? audit.obligations : [];
  const spiderMonkeyDiagnostics = {
    selectedRowIdentityStatusCounts: audit.coverage?.spiderMonkeyDiagnostics?.selectedRowIdentityStatusCounts ?? {},
    diagnosticRowCount: audit.coverage?.spiderMonkeyDiagnostics?.diagnosticRowCount ?? null,
    diagnosticRowSourceArtifacts: audit.coverage?.spiderMonkeyDiagnostics?.diagnosticRowSourceArtifacts ?? [],
    closureAuditCandidateCount: audit.coverage?.spiderMonkeyDiagnostics?.closureAuditCandidateCount ?? null,
    closureAuditCandidateSourceArtifacts: audit.coverage?.spiderMonkeyDiagnostics?.closureAuditCandidateSourceArtifacts ?? [],
    closureAuditDiagnosticRowGap: audit.coverage?.spiderMonkeyDiagnostics?.closureAuditDiagnosticRowGap ?? null,
    closureAuditCandidateSourcesOutsideDiagnostics: audit.coverage?.spiderMonkeyDiagnostics?.closureAuditCandidateSourcesOutsideDiagnostics ?? [],
    diagnosticSourcesOutsideClosureAudit: audit.coverage?.spiderMonkeyDiagnostics?.diagnosticSourcesOutsideClosureAudit ?? [],
    closureAuditQualifiedClosureCount: audit.coverage?.spiderMonkeyDiagnostics?.closureAuditQualifiedClosureCount ?? null,
  };
  const routeFreshnessArtifact = (Array.isArray(audit.scannedArtifacts) ? audit.scannedArtifacts : [])
    .find(artifact => artifact.sourceArtifact === 'spidermonkey-taskcluster-debug-jsshell-route-freshness-audit.json');
  const routeFreshness = routeFreshnessArtifact?.availability ?? {};
  const snapshot = {
    loaded: true,
    generatedAt: audit.generatedAt ?? null,
    activeObligationIds: obligations
      .filter(obligation => obligation.status !== 'covered')
      .map(obligation => obligation.id),
    coveredObligationIds: obligations
      .filter(obligation => obligation.status === 'covered')
      .map(obligation => obligation.id),
    byId: {},
    spiderMonkeyDiagnostics,
    spiderMonkeyTaskclusterRouteFreshness: {
      routeFresh: routeFreshness.routeFresh ?? null,
      expectedIdentityMatchesRoute: routeFreshness.expectedIdentityMatchesRoute ?? null,
      artifactIdentityMatchesRoute: routeFreshness.artifactIdentityMatchesRoute ?? null,
      checkedArtifactCount: routeFreshness.checkedArtifactCount ?? null,
      mismatchedArtifacts: Array.isArray(routeFreshness.mismatchedArtifacts)
        ? routeFreshness.mismatchedArtifacts
        : [],
    },
    guards: [],
  };
  const byId = Object.fromEntries(obligations.map(obligation => [obligation.id, {
    id: obligation.id,
    status: obligation.status ?? null,
    evidence: obligation.evidence ?? null,
    nextExperiment: obligation.nextExperiment ?? null,
  }]));
  snapshot.byId = byId;
  snapshot.guards = createCoverageGuards(snapshot);
  return snapshot;
}

function createCoverageGuards(snapshot) {
  const counts = snapshot?.spiderMonkeyDiagnostics?.selectedRowIdentityStatusCounts ?? {};
  const spiderMonkeyDiagnostics = snapshot?.spiderMonkeyDiagnostics ?? {};
  const routeFreshness = snapshot?.spiderMonkeyTaskclusterRouteFreshness ?? {};
  return [
    {
      id: 'coverage-loaded',
      description: 'runtime-proof-coverage-audit.json must be loaded by the gate.',
      satisfied: snapshot?.loaded === true,
    },
    {
      id: 'spidermonkey-identity-status-counts-present',
      description: 'Coverage audit must expose coverage.spiderMonkeyDiagnostics.selectedRowIdentityStatusCounts for gate-level review.',
      satisfied: typeof counts === 'object'
        && counts !== null
        && Object.keys(counts).length > 0,
    },
    {
      id: 'spidermonkey-non-stax-diagnostic-rows-visible',
      description: 'Coverage audit must keep non-StAX SpiderMonkey diagnostic rows visible via selectedRowIdentityStatusCounts.not-claimed-non-stax-diagnostic.',
      satisfied: typeof counts['not-claimed-non-stax-diagnostic'] === 'number'
        && counts['not-claimed-non-stax-diagnostic'] > 0,
    },
    {
      id: 'spidermonkey-closure-audit-surface-visible',
      description: 'Coverage audit must expose SpiderMonkey diagnostic row count, closure-audit candidate count, their gap, and qualifiedClosureCount so gate review sees the curated coverage surface is not the full closure matrix.',
      satisfied: typeof spiderMonkeyDiagnostics.diagnosticRowCount === 'number'
        && typeof spiderMonkeyDiagnostics.closureAuditCandidateCount === 'number'
        && typeof spiderMonkeyDiagnostics.closureAuditDiagnosticRowGap === 'number'
        && spiderMonkeyDiagnostics.closureAuditCandidateCount >= spiderMonkeyDiagnostics.diagnosticRowCount
        && spiderMonkeyDiagnostics.closureAuditCandidateCount - spiderMonkeyDiagnostics.diagnosticRowCount === spiderMonkeyDiagnostics.closureAuditDiagnosticRowGap
        && typeof spiderMonkeyDiagnostics.closureAuditQualifiedClosureCount === 'number',
    },
    {
      id: 'spidermonkey-closure-audit-gap-artifacts-visible',
      description: 'Coverage audit must name the SpiderMonkey closure candidates outside curated diagnostics rows and report no diagnostic rows outside the closure audit.',
      satisfied: hasSameStringSet(
        spiderMonkeyDiagnostics.closureAuditCandidateSourcesOutsideDiagnostics,
        expectedSpiderMonkeyClosureGapArtifacts,
      )
        && Array.isArray(spiderMonkeyDiagnostics.diagnosticSourcesOutsideClosureAudit)
        && spiderMonkeyDiagnostics.diagnosticSourcesOutsideClosureAudit.length === 0,
    },
    {
      id: 'spidermonkey-taskcluster-route-freshness',
      description: 'Taskcluster route freshness must show the current SpiderMonkey debug-shell artifacts match the latest route task and expected build/source identity.',
      satisfied: routeFreshness.routeFresh === true
        && routeFreshness.expectedIdentityMatchesRoute === true
        && routeFreshness.artifactIdentityMatchesRoute === true
        && routeFreshness.checkedArtifactCount === 5
        && Array.isArray(routeFreshness.mismatchedArtifacts)
        && routeFreshness.mismatchedArtifacts.length === 0,
    },
  ];
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
  `- SpiderMonkey diagnostics rows vs closure candidates: ${report.coverageSnapshot.spiderMonkeyDiagnostics.diagnosticRowCount ?? 'unknown'}/${report.coverageSnapshot.spiderMonkeyDiagnostics.closureAuditCandidateCount ?? 'unknown'} (gap=${report.coverageSnapshot.spiderMonkeyDiagnostics.closureAuditDiagnosticRowGap ?? 'unknown'}, closureQualified=${report.coverageSnapshot.spiderMonkeyDiagnostics.closureAuditQualifiedClosureCount ?? 'unknown'})`,
  `- SpiderMonkey closure candidates outside coverage diagnostics: ${formatStringList(report.coverageSnapshot.spiderMonkeyDiagnostics.closureAuditCandidateSourcesOutsideDiagnostics)}`,
  `- SpiderMonkey coverage diagnostics outside closure candidates: ${formatStringList(report.coverageSnapshot.spiderMonkeyDiagnostics.diagnosticSourcesOutsideClosureAudit)}`,
  `- SpiderMonkey selected row identity statuses: ${formatCountMap(report.coverageSnapshot.spiderMonkeyDiagnostics.selectedRowIdentityStatusCounts)}`,
  `- SpiderMonkey Taskcluster route freshness: ${report.coverageSnapshot.spiderMonkeyTaskclusterRouteFreshness?.routeFresh === true ? 'fresh' : 'stale'} (artifactIdentityMatchesRoute=${report.coverageSnapshot.spiderMonkeyTaskclusterRouteFreshness?.artifactIdentityMatchesRoute === true ? 'yes' : 'no'}, checkedArtifacts=${report.coverageSnapshot.spiderMonkeyTaskclusterRouteFreshness?.checkedArtifactCount ?? 'unknown'}, mismatchedArtifacts=${formatStringList(report.coverageSnapshot.spiderMonkeyTaskclusterRouteFreshness?.mismatchedArtifacts ?? [])})`,
    '',
    '| ID | Satisfied | Meaning |',
    '| --- | --- | --- |',
  );
  for (const item of report.coverageSnapshot.guards) {
    lines.push(`| \`${item.id}\` | ${item.satisfied ? 'yes' : 'no'} | ${item.description} |`);
  }

  lines.push(
    '',
    '## Counterexample Snapshot',
    '',
    report.counterexampleSnapshot.comparisonLoaded
      ? `- Same-contract comparison loaded: yes (${report.counterexampleSnapshot.comparisonGeneratedAt ?? 'unknown generatedAt'})`
      : '- Same-contract comparison loaded: no',
    `- Same-contract comparison contract: ${report.counterexampleSnapshot.comparisonContractId ?? 'unknown'}; publicEventCase=${report.counterexampleSnapshot.comparisonPrimaryJsPublicEventCase ?? 'unknown'}; objectShapeEquivalence=${String(report.counterexampleSnapshot.comparisonObjectShapeEquivalence)}; memoryEquivalence=${String(report.counterexampleSnapshot.comparisonMemoryEquivalence)}`,
    `- Same-contract comparison rows: ${formatNullableCount(report.counterexampleSnapshot.comparisonSummaryRowCount)}/${formatNullableCount(report.counterexampleSnapshot.comparisonRowCount)}; largeFullJsRows=${formatNullableCount(report.counterexampleSnapshot.comparisonJsLargeFullRowCount)}`,
    `- Same-contract comparison counterexamples: ${formatNullableCount(report.counterexampleSnapshot.comparisonCounterexampleCount)}`,
    report.counterexampleSnapshot.counterexampleScanLoaded
      ? `- Runtime counterexample scan loaded: yes (${report.counterexampleSnapshot.counterexampleScanGeneratedAt ?? 'unknown generatedAt'})`
      : '- Runtime counterexample scan loaded: no',
    `- Counterexample scan contract: threshold=${formatNullableRate(report.counterexampleSnapshot.thresholdMiBPerSec)} MiB/s, minSizeGiB=${formatNullableRate(report.counterexampleSnapshot.minSizeGiB)}, parseErrors=${formatNullableCount(report.counterexampleSnapshot.scanParseErrorCount)}`,
    `- Counterexample scan coverage shape: artifacts=${formatNullableCount(report.counterexampleSnapshot.scanScannedArtifactCount)}/${formatNullableCount(report.counterexampleSnapshot.coverageScannedArtifactCount)}, measuredRows=${formatNullableCount(report.counterexampleSnapshot.scanMeasuredRowCount)}/${formatNullableCount(report.counterexampleSnapshot.coverageMeasuredRowCount)}`,
    `- Runtime counterexample scan counterexamples: ${formatNullableCount(report.counterexampleSnapshot.scanCounterexampleCount)}`,
    `- Current release counterexamples: ${report.counterexampleSnapshot.currentCounterexampleCount}`,
  );
  for (const item of report.counterexampleSnapshot.guards) {
    lines.push(`- ${item.satisfied ? '[x]' : '[ ]'} ${item.id}: ${item.description}`);
  }

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
    '## Handoff Validation Snapshot',
    '',
    report.handoffValidationSnapshot.loaded
      ? `- Handoff validation loaded: yes (${report.handoffValidationSnapshot.generatedAt ?? 'unknown generatedAt'})`
      : '- Handoff validation loaded: no',
    `- Handoff validation target handoff generatedAt: ${report.handoffValidationSnapshot.validatedHandoffGeneratedAt ?? 'unknown'} (current ${report.handoffValidationSnapshot.currentHandoffGeneratedAt ?? 'unknown'})`,
    `- Handoff validation pass: ${formatYesNo(report.handoffValidationSnapshot.pass)}`,
    `- Required handoffs present: ${formatYesNo(report.handoffValidationSnapshot.requiredHandoffsPresent)}`,
    `- Required contracts present: ${formatYesNo(report.handoffValidationSnapshot.allContractsPresent)}`,
    `- Unhandled obligations in validated handoff: ${formatNullableCount(report.handoffValidationSnapshot.unhandledObligationCount)}`,
    `- Validated handoff IDs: ${report.handoffValidationSnapshot.handoffIds?.join(', ') || 'none'}`,
    '',
    '| ID | Satisfied | Meaning |',
    '| --- | --- | --- |',
  );
  for (const item of report.handoffValidationSnapshot.guards) {
    lines.push(`| \`${item.id}\` | ${item.satisfied ? 'yes' : 'no'} | ${item.description} |`);
  }

  lines.push(
    '',
    '## Source Audit Snapshot',
    '',
    report.sourceAuditSnapshot.loaded
      ? `- Source audit loaded: yes (${report.sourceAuditSnapshot.generatedAt ?? 'unknown generatedAt'})`
      : '- Source audit loaded: no',
    `- Source audit inputs: comparison=${report.sourceAuditSnapshot.inputComparisonGeneratedAt ?? 'unknown'} (current ${report.sourceAuditSnapshot.currentComparisonGeneratedAt ?? 'unknown'}), coverage=${report.sourceAuditSnapshot.inputCoverageGeneratedAt ?? 'unknown'} (current ${report.sourceAuditSnapshot.currentCoverageGeneratedAt ?? 'unknown'})`,
    `- Source audit status: ${report.sourceAuditSnapshot.status ?? 'unknown'}`,
    `- Primary parser input: ${report.sourceAuditSnapshot.primaryParserInput ?? 'unknown'}`,
    `- Primary sync byte-batch rows: ${formatNullableCount(report.sourceAuditSnapshot.primarySyncByteBatchRows)}`,
    `- Primary direct ReadableStream rows: ${formatNullableCount(report.sourceAuditSnapshot.primaryDirectReadableStreamRows)}`,
    `- Primary async source rows: ${formatNullableCount(report.sourceAuditSnapshot.primaryAsyncSourceRows)}`,
    `- Primary full ArrayBuffer parser-input rows: ${formatNullableCount(report.sourceAuditSnapshot.primaryFullArrayBufferRows)}`,
    `- Representative stream rows respect backpressure: ${formatYesNo(report.sourceAuditSnapshot.representativeStreamRowsRespectBackpressure)}`,
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
    `- Frontier audit comparison inputs: memory=${report.frontierAuditSnapshot.memory.inputComparisonGeneratedAt ?? 'unknown'}, target=${report.frontierAuditSnapshot.targetDistance.inputComparisonGeneratedAt ?? 'unknown'}, text=${report.frontierAuditSnapshot.textMaterialization.inputComparisonGeneratedAt ?? 'unknown'} (current ${report.frontierAuditSnapshot.memory.currentComparisonGeneratedAt ?? report.frontierAuditSnapshot.targetDistance.currentComparisonGeneratedAt ?? report.frontierAuditSnapshot.textMaterialization.currentComparisonGeneratedAt ?? 'unknown'})`,
    `- Fastest bounded JS row: ${formatNullableRate(report.frontierAuditSnapshot.memory.fastestBoundedRateMiBPerSec)} MiB/s at ${formatNullableRate(report.frontierAuditSnapshot.memory.fastestBoundedMaxMiB)} MiB`,
    `- Unbounded or unproven memory rows: ${formatNullableCount(report.frontierAuditSnapshot.memory.unboundedRows)}`,
    `- Bounded rows without numeric memory proof: ${formatNullableCount(report.frontierAuditSnapshot.memory.boundedRowsWithoutNumericMemoryProof)}`,
    `- Unbounded rows at or above 200 MiB/s: ${formatNullableCount(report.frontierAuditSnapshot.memory.unboundedRowsAtOrAbove200MiBPerSec)}`,
    report.frontierAuditSnapshot.targetDistance.loaded
      ? `- Target distance loaded: yes (${report.frontierAuditSnapshot.targetDistance.generatedAt ?? 'unknown generatedAt'})`
      : '- Target distance loaded: no',
    `- Woodstox 0.9x target met: ${formatYesNo(report.frontierAuditSnapshot.targetDistance.woodstoxTargetMet)}`,
    `- Woodstox 0.9x remaining: ${formatNullableRate(report.frontierAuditSnapshot.targetDistance.woodstoxRemainingMiBPerSec)} MiB/s`,
    `- quick-xml 0.9x target met: ${formatYesNo(report.frontierAuditSnapshot.targetDistance.quickXmlTargetMet)}`,
    `- quick-xml 0.9x remaining: ${formatNullableRate(report.frontierAuditSnapshot.targetDistance.quickXmlRemainingMiBPerSec)} MiB/s`,
    `- Shared JS target row: ${formatYesNo(report.frontierAuditSnapshot.targetDistance.sharedFastestJsTargetRow)}`,
    `- Target JS contract: sourceMode=${report.frontierAuditSnapshot.targetDistance.fastestJsSourceMode ?? 'unknown'}, directReadableStream=${formatYesNo(report.frontierAuditSnapshot.targetDistance.fastestJsDirectReadableStream)}, fullArrayBufferParserInput=${formatYesNo(report.frontierAuditSnapshot.targetDistance.fastestJsFullArrayBufferParserInput)}, boundedMemory=${formatYesNo(report.frontierAuditSnapshot.targetDistance.fastestJsBoundedMemory)}, memoryKind=${report.frontierAuditSnapshot.targetDistance.fastestJsMemoryKind ?? 'unknown'}, maxRssMiB=${formatNullableRate(report.frontierAuditSnapshot.targetDistance.fastestJsMaxRssMiB)}`,
    report.frontierAuditSnapshot.textMaterialization.loaded
      ? `- Text materialization boundary loaded: yes (${report.frontierAuditSnapshot.textMaterialization.generatedAt ?? 'unknown generatedAt'})`
      : '- Text materialization boundary loaded: no',
    `- Fastest full-string row: ${formatNullableRate(report.frontierAuditSnapshot.textMaterialization.fastestFullRateMiBPerSec)} MiB/s`,
    `- Full-string rows crossing 200 MiB/s: ${formatNullableCount(report.frontierAuditSnapshot.textMaterialization.fullRowsCrossTarget)}`,
    `- No-text rows crossing 200 MiB/s: ${formatNullableCount(report.frontierAuditSnapshot.textMaterialization.noTextRowsCrossTarget)}`,
    `- No-trim rows crossing 200 MiB/s: ${formatNullableCount(report.frontierAuditSnapshot.textMaterialization.noTrimRowsCrossTarget)}`,
    `- Fold-trim rows crossing 200 MiB/s: ${formatNullableCount(report.frontierAuditSnapshot.textMaterialization.foldTrimRowsCrossTarget)}`,
    `- Without-text full-string parity: ${formatYesNo(report.frontierAuditSnapshot.textMaterialization.fastestWithoutTextFullStringParity)}`,
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

function formatCountMap(counts) {
  const entries = Object.entries(counts ?? {}).sort(([left], [right]) => left.localeCompare(right));
  return entries.length > 0
    ? entries.map(([key, value]) => `${key}=${value}`).join(', ')
    : 'none';
}

function hasSameStringSet(actual, expected) {
  if (!Array.isArray(actual)) return false;
  const actualSet = new Set(actual.filter(value => typeof value === 'string'));
  return actualSet.size === expected.length && expected.every(value => actualSet.has(value));
}

function formatStringList(values) {
  return Array.isArray(values) && values.length > 0
    ? values.map(value => `\`${value}\``).join(', ')
    : 'none';
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
