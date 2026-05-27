import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp', 'runtime-limit-proof-obligation-gate');
const goodLedger = join(tmpDir, 'good-proof-ledger.md');
const badLedger = join(tmpDir, 'bad-proof-ledger.md');
const goodJsonOut = join(tmpDir, 'good-runtime-limit-proof-obligation-gate.json');
const goodMdOut = join(tmpDir, 'good-runtime-limit-proof-obligation-gate.md');
const badJsonOut = join(tmpDir, 'bad-runtime-limit-proof-obligation-gate.json');
const badMdOut = join(tmpDir, 'bad-runtime-limit-proof-obligation-gate.md');

test('runtime-limit proof-obligation gate permits only a conservative non-conclusion ledger', () => {
  resetTmp();
  writeFileSync(goodLedger, createLedgerFixture('`HYPOTHESIS`'));

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    goodLedger,
    '--json-out',
    goodJsonOut,
    '--md-out',
    goodMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(goodJsonOut, 'utf8'));
  assert.equal(report.objective, 'runtime-limit-proof-obligation-gate');
  assert.equal(report.contract, 'static-ledger-proof-obligations');
  assert.equal(report.gate.pass, true);
  assert.equal(report.gate.status, 'incomplete-proof-correctly-blocked');
  assert.equal(report.conclusionAllowed, false);
  assert.equal(report.runtimeClaim.markedConclusion, false);
  assert.equal(report.summary.satisfiedClaimGuards, report.summary.requiredClaimGuards);
  assert.equal(report.summary.presentArtifactMentions, report.summary.requiredArtifactMentions);
  assert.equal(report.summary.disclosedOpenObligations, report.summary.requiredOpenObligations);
  assert.equal(report.summary.satisfiedProofRules, report.summary.requiredProofRules);
  assert.ok(report.openObligations.some(item => item.id === 'safari-jsc-source-and-browser-rows-open' && item.disclosed));
  assert.ok(report.artifactMentions.some(item => item.file === 'firefox-spidermonkey-textdecoder-source-pin-audit.md' && item.present));
  assert.ok(report.artifactMentions.some(item => item.file === 'firefox-bidi-candidate-headroom.md' && item.present));
  assert.ok(report.artifactMentions.some(item => item.file === 'stream-source-consumption-backpressure-counters.md' && item.present));
  assert.ok(report.proofRules.some(item => item.id === 'target-contract-not-object-shape' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'lazy-getters-reopen-burden' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'source-shapes-separated' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'byte-batches-not-full-arraybuffer' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'byte-batch-backpressure-preserved' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'raw-frame-source-shapes-backpressure-counted' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'woodstox-reference-not-identical-input' && item.satisfied));
  assert.ok(report.proofRules.some(item => item.id === 'same-fixture-woodstox-target-unmet' && item.satisfied));

  const markdown = readFileSync(goodMdOut, 'utf8');
  assert.match(markdown, /# Runtime-Limit Proof Obligation Gate/);
  assert.match(markdown, /Gate pass: yes/);
  assert.match(markdown, /Conclusion allowed: no/);
  assert.match(markdown, /runtime-limit-remains-hypothesis/);
  assert.match(markdown, /safari-jsc-source-and-browser-rows-open/);
  assert.match(markdown, /## Proof Rules/);
  assert.match(markdown, /target-contract-not-object-shape/);
  assert.match(markdown, /lazy-getters-reopen-burden/);
  assert.match(markdown, /source-shapes-separated/);
  assert.match(markdown, /byte-batch-backpressure-preserved/);
  assert.match(markdown, /raw-frame-source-shapes-backpressure-counted/);
  assert.match(markdown, /woodstox-reference-not-identical-input/);
  assert.match(markdown, /same-fixture-woodstox-target-unmet/);
  assert.match(markdown, /A future 200 MiB\/s\+ bounded-memory full-string JavaScript row remains a counterexample/);
});

test('runtime-limit proof-obligation gate fails if the broad claim is upgraded too early', () => {
  resetTmp();
  writeFileSync(badLedger, createLedgerFixture('`CONCLUSION`'));

  const result = spawnSync(process.execPath, [
    join(__dirname, 'runtime-limit-proof-obligation-gate.mjs'),
    '--ledger',
    badLedger,
    '--json-out',
    badJsonOut,
    '--md-out',
    badMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(badJsonOut, 'utf8'));
  assert.equal(report.gate.pass, false);
  assert.equal(report.gate.status, 'ledger-guard-failed');
  assert.equal(report.conclusionAllowed, false);
  assert.equal(report.runtimeClaim.markedConclusion, true);
  assert.ok(report.gate.errors.some(error => error.includes('marked CONCLUSION')));
  assert.ok(report.claimGuards.some(item => item.id === 'runtime-limit-remains-hypothesis' && !item.satisfied));

  const markdown = readFileSync(badMdOut, 'utf8');
  assert.match(markdown, /Gate pass: no/);
  assert.match(markdown, /marked CONCLUSION/);
});

function resetTmp() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [goodJsonOut, goodMdOut, badJsonOut, badMdOut]) {
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
}

function createLedgerFixture(runtimeStatus) {
  return [
    '# stax-api Performance Proof Ledger',
    '',
    '## Proof Vocabulary',
    '',
    'Rules:',
    '',
    '- `ENGINE_INVARIANT` about JS strings is not by itself a performance impossibility proof.',
    '- `NEGATIVE_RESULT` for lazy getters, Buffer lanes, or value caches does not prove that all JavaScript runtime headroom is exhausted.',
    '',
    '## Runtime-Limit Conclusion Gate',
    '',
    'Define the target shape as a full-string StAX-like reader contract, not as identical object shape across languages.',
    'Treat any 200 MiB/s+ bounded-memory full-string JavaScript row as a counterexample.',
    '',
    '## Current Claims',
    '',
    '| ID | Claim | Status | Current evidence | Missing proof or counterexample search |',
    '| --- | --- | --- | --- | --- |',
    `| \`CLAIM-JS-RUNTIME-LIMIT-200MIB\` | A JS-runtime StAX reader cannot exceed 200 MiB/s with acceptable memory. | ${runtimeStatus} | Current rows are slow. | Must expand Safari/browser JSC rows, codegen traces, allocation profiles, and additional independent corpus fixtures. |`,
    '| `CLAIM-WOODSTOX-SAME-JS-OBJECTS` | Woodstox creates the same object shape as the JavaScript public event path. | `COUNTEREXAMPLE` | materialization-contract-audit.md | None; this claim is rejected. Future text must say "same high-level data/checksum contract", not "same object shape". |',
    '| `CLAIM-QUICKXML-SAME-JS-OBJECTS` | quick-xml creates the same object shape as the JavaScript public event path. | `COUNTEREXAMPLE` | quick-xml-shape-audit.md | None; this claim is rejected. Future text must say "same high-level data/checksum contract", not "same object shape". |',
    '| `CLAIM-LAZY-GETTERS` | Lazy event getters are not a candidate. | `NEGATIVE_RESULT` | materialization-contract-audit.md | This rejection can be revisited only with a benchmark that proves full-string or real StAX consumer improvement, bounded memory, and no cache-shape regression. |',
    '| `CLAIM-NODE-BUFFER-PRIMARY` | Node Buffer is not neutral primary. | `NEGATIVE_RESULT` | textdecoder-span-variants.md | Keep neutral browser lane. |',
    '| `CLAIM-NODE-TEXTDECODER-SOURCE-BOUNDARY` | Node TextDecoder source boundary. | `SOURCE_FACT` | node-textdecoder-source-pin-audit.md | Not codegen. |',
    '| `CLAIM-CHROME-BLINK-TEXTDECODER-SOURCE-BOUNDARY` | Chrome/Blink TextDecoder source boundary. | `SOURCE_FACT` | chrome-blink-textdecoder-source-pin-audit.md | Not codegen. |',
    '| `CLAIM-BUN-WEBKIT-TEXTDECODER-SOURCE-BOUNDARY` | Bun WebKit source boundary. | `SOURCE_FACT` | bun-webkit-textdecoder-source-pin-audit.md | Not dispatch proof. |',
    '| `CLAIM-BUN-TEXTDECODER-DISPATCH-SOURCE-BOUNDARY` | Bun dispatch source boundary. | `SOURCE_FACT` + `COUNTEREXAMPLE` | bun-textdecoder-dispatch-source-pin-audit.md | Not throughput. |',
    '| `CLAIM-FIREFOX-SPIDERMONKEY-TEXTDECODER-SOURCE-BOUNDARY` | Firefox/Gecko source boundary. | `SOURCE_FACT` | firefox-spidermonkey-textdecoder-source-pin-audit.md | Not heap/allocation, not generated-code evidence. |',
    '',
    'Artifacts: same-contract-runtime-comparison.md, runtime-counterexample-scan.md, runtime-proof-coverage-audit.md, quick-xml-allocation-count.md, quick-xml-allocation-count-stability.md, woodstox-hotspot-trace.md, woodstox-jfr-allocation.md, woodstox-measured-jfr-allocation.md, woodstox-measured-jfr-allocation-rerun.md, candidate-headroom-large.md, bun-candidate-headroom-large.md, browser-candidate-headroom-large.md, firefox-bidi-candidate-headroom.md, text-cdata-cost-decomposition.md, text-materialization-frontier.md, text-trim-guard-candidate.md, text-ascii-pretrim-candidate.md, all-ascii-span-materialization-candidate.md, sync-byte-batch-shape-batch1.md, sync-byte-batch-shape-batch16.md, bun-textdecoder-span-variants.md, browser-textdecoder-span-variants.md, bun-jsc-partial-codegen-trace.md, bun-jsc-textdecoder-codegen-trace.md, stream-source-consumption-shapes.md, stream-source-consumption-backpressure-counters.md, event-reader-byte-batch-cross-process-corpus.md.',
    '',
    'Source-shape rules: direct ReadableStream overhead evidence stays',
    'distinct from synchronous byte-batch rows. The current large matrix does not prebuild one repeated 1 GiB ArrayBuffer parser input. The byte-batch rows preserve backpressure by pulling at most the next batch on demand.',
    'The focused audit now includes seven source-shape rows: async `nextRawBatch()` raw-frame rows and direct `ReadableStream` `nextRawBatch()` raw-frame rows under the same backpressure counter contract.',
    '',
    'Woodstox target rules: the fastest aggregated JS row and the 1024 MiB Woodstox reference can come from different corpus fixtures. Same-fixture 1024 MiB JS row vs Woodstox target: stax-raw-frame-name-id-chunk-32kib at 0.80x Woodstox, 19.95 MiB/s below 0.9x target.',
    '',
    'Open work: Safari/browser JSC source pins and rows, Firefox/SpiderMonkey codegen/allocation evidence, broader allocation evidence, codegen traces, and a broad corpus suite remain open.',
    '',
  ].join('\n');
}
