import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const defaultLedgerPath = resolve(repoRoot, 'docs', 'plans', '2026-05-23-stax-api-performance-proof-ledger.md');
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
  'candidate-headroom-large.md',
  'bun-candidate-headroom-large.md',
  'browser-candidate-headroom-large.md',
  'firefox-bidi-candidate-headroom.md',
  'text-cdata-cost-decomposition.md',
  'textdecoder-span-variants.md',
  'bun-textdecoder-span-variants.md',
  'browser-textdecoder-span-variants.md',
  'node-textdecoder-source-pin-audit.md',
  'chrome-blink-textdecoder-source-pin-audit.md',
  'bun-textdecoder-dispatch-source-pin-audit.md',
  'firefox-spidermonkey-textdecoder-source-pin-audit.md',
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
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    ledger: defaultLedgerPath,
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
  const report = createReport({ options, ledgerMarkdown });
  writeOutput(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(options.mdOut, renderMarkdown(report));
  printSummary(report);
  if (!report.gate.pass) {
    process.exitCode = 1;
  }
}

function createReport({ options, ledgerMarkdown }) {
  const claims = parseClaimRows(ledgerMarkdown);
  const claimGuards = requiredClaimGuards.map(requirement => evaluateClaimGuard(requirement, claims));
  const artifactMentions = requiredArtifactMentions.map(file => ({
    id: file,
    file,
    present: ledgerMarkdown.includes(file),
  }));
  const openObligations = openObligationDisclosures.map(obligation => ({
    ...obligation,
    disclosed: obligation.pattern.test(ledgerMarkdown),
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

  const pass = errors.length === 0;
  return {
    generatedAt: new Date().toISOString(),
    objective: 'runtime-limit-proof-obligation-gate',
    contract: 'static-ledger-proof-obligations',
    note: 'Static proof-obligation gate for the broad 200 MiB/s JavaScript runtime-limit claim. Passing this gate currently means the ledger is conservative: the broad claim remains a hypothesis and known open obligations are disclosed.',
    metadata: {
      ledger: options.ledger,
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
    },
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
    'These are intentionally open obligations. They must be disclosed while the broad runtime-limit claim remains below `CONCLUSION`.',
    '',
    '| ID | Disclosed | Meaning |',
    '| --- | --- | --- |',
  );
  for (const item of report.openObligations) {
    lines.push(`| \`${item.id}\` | ${item.disclosed ? 'yes' : 'no'} | ${item.description} |`);
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
    'A passing report currently means the proof ledger is conservative, not that the target runtime limit has been proven. The broad claim remains blocked by open Safari/browser JSC rows, codegen traces, allocation evidence, broader corpus coverage, and the proof rules above. A future 200 MiB/s+ bounded-memory full-string JavaScript row remains a counterexample.',
  );

  return `${lines.join('\n')}\n`;
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
