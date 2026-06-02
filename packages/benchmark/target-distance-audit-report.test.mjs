import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'target-distance-audit-report-test.json');
const mdOut = join(tmpDir, 'target-distance-audit-report-test.md');
const driftComparisonOut = join(tmpDir, 'target-distance-drift-comparison.json');
const driftJsonOut = join(tmpDir, 'target-distance-drift.json');
const driftMdOut = join(tmpDir, 'target-distance-drift.md');
const semanticDriftComparisonOut = join(tmpDir, 'target-distance-semantic-drift-comparison.json');
const semanticDriftJsonOut = join(tmpDir, 'target-distance-semantic-drift.json');
const semanticDriftMdOut = join(tmpDir, 'target-distance-semantic-drift.md');

test('target distance audit keeps Woodstox and quick-xml 0.9x goals explicit', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [jsonOut, mdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const result = spawnSync(process.execPath, [
    join(__dirname, 'target-distance-audit.mjs'),
    '--json-out',
    jsonOut,
    '--md-out',
    mdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
  assert.equal(report.objective, 'target-distance-audit');
  assert.equal(report.contract, 'woodstox-and-quickxml-0.9x-target-distance');
  assert.equal(report.summary.status, 'classified');
  assert.equal(report.summary.conclusionAllowed, false);
  assert.equal(report.summary.sharedFastestJsTargetRow, true);
  assert.equal(report.summary.overallJsFrontierSeparatedFromSameFixtureTarget, true);

  const woodstox = report.summary.sameFixture1024MiBWoodstoxTarget;
  assert.equal(woodstox.fastestJsCaseId, 'stax-raw-frame-name-id-batch-8');
  assert.equal(woodstox.fastestJsRateMiBPerSec, 152.11);
  assert.equal(woodstox.woodstoxSourceArtifact, 'file-backed-trim-boundary-check-candidate.json');
  assert.equal(woodstox.woodstoxRateMiBPerSec, 351.56);
  assert.equal(woodstox.target90MiBPerSec, 316.4);
  assert.equal(woodstox.fastestJsWoodstoxRatio, 0.43);
  assert.equal(woodstox.remainingTo90PercentMiBPerSec, 164.29);
  assert.equal(woodstox.targetMet, false);

  const quickXml = report.summary.sameFixture1024MiBQuickXmlTarget;
  assert.equal(quickXml.fastestJsCaseId, 'stax-raw-frame-name-id-batch-8');
  assert.equal(quickXml.fastestJsRateMiBPerSec, 152.11);
  assert.equal(quickXml.quickXmlSourceArtifact, 'file-backed-short-attr-value-cache-candidate.json');
  assert.equal(quickXml.quickXmlRateMiBPerSec, 274.63);
  assert.equal(quickXml.target90MiBPerSec, 247.17);
  assert.equal(quickXml.fastestJsQuickXmlRatio, 0.55);
  assert.equal(quickXml.remainingTo90PercentMiBPerSec, 95.06);
  assert.equal(quickXml.targetMet, false);

  const fastestJsContract = report.summary.sameFixtureFastestJsContract;
  assert.equal(fastestJsContract.group, 'file-backed-batch-size-sweep');
  assert.equal(fastestJsContract.sourceArtifact, 'file-backed-batch-size-sweep.json');
  assert.equal(fastestJsContract.caseId, 'stax-raw-frame-name-id-batch-8');
  assert.equal(fastestJsContract.rateMiBPerSec, 152.11);
  assert.equal(fastestJsContract.fullStringParity, true);
  assert.equal(fastestJsContract.eventCount, 61236571);
  assert.equal(fastestJsContract.checksum, -716099804);
  assert.equal(fastestJsContract.sameSemanticContractAsWoodstox, true);
  assert.equal(fastestJsContract.sameSemanticContractAsQuickXml, true);
  assert.equal(fastestJsContract.woodstoxEventCount, 61236571);
  assert.equal(fastestJsContract.woodstoxChecksum, -716099804);
  assert.equal(fastestJsContract.quickXmlEventCount, 61236571);
  assert.equal(fastestJsContract.quickXmlChecksum, -716099804);
  assert.equal(fastestJsContract.sourceMode, 'file-backed-sync-iterable-byte-batches');
  assert.equal(fastestJsContract.directReadableStream, false);
  assert.equal(fastestJsContract.fullArrayBufferParserInput, false);
  assert.equal(fastestJsContract.boundedMemory, true);
  assert.equal(fastestJsContract.memoryKind, 'process-rss');
  assert.equal(fastestJsContract.maxRssMiB, 61.77);
  assert.equal(fastestJsContract.maxHeapUsedMiB, 6.83);
  assert.equal(fastestJsContract.maxExternalMiB, 3.66);
  assert.equal(fastestJsContract.maxArrayBuffersMiB, 1.67);

  const overallFrontier = report.summary.overallJsFrontier;
  assert.equal(overallFrontier.sourceArtifact, 'text-trim-cost-decomposition.json');
  assert.equal(overallFrontier.caseId, 'rawFrameNameId');
  assert.equal(overallFrontier.rateMiBPerSec, 185.5);
  assert.equal(overallFrontier.boundedMemory, true);
  assert.equal(overallFrontier.fullStringParity, true);
  assert.equal(overallFrontier.targetDistanceOnly, true);
  assert.equal(overallFrontier.sameFixtureExternalBaseline, false);
  assert.equal(overallFrontier.sameAsSameFixtureTargetRow, false);

  const external = report.summary.externalBaseline1024MiBFileSyncBatches;
  assert.equal(external.staxStreamRateMiBPerSec, 124.62);
  assert.equal(external.rawFrameNameIdRateMiBPerSec, 132.54);
  assert.equal(external.woodstoxRateMiBPerSec, 337.97);
  assert.equal(external.quickXmlRateMiBPerSec, 270.26);
  assert.equal(external.quickXmlWoodstoxRatio, 0.8);
  assert.equal(external.target90MiBPerSec, 304.17);

  assert.equal(report.quickXmlTargetRows.length, 6);
  assert.equal(report.quickXmlTargetRows[0].group, 'file-backed-batch-size-sweep');
  assert.equal(report.quickXmlTargetRows[0].quickXml90MiBPerSec, 247.17);
  assert.equal(report.quickXmlTargetRows[0].remainingTo90PercentMiBPerSec, 95.06);
  assert.equal(report.quickXmlTargetRows[0].targetMet, false);
  assert.match(report.quickXmlTargetRows[0].caveat, /separate candidate artifact/);
  assert.equal(report.quickXmlTargetRows[2].group, 'file-backed-short-attr-value-cache-candidate');
  assert.match(report.quickXmlTargetRows[2].caveat, /same artifact/);

  const rss = report.summary.sameFixture1024MiBProcessRssSnapshot;
  assert.equal(rss.fastestJs.maxRssMiB, 61.77);
  assert.equal(rss.woodstox.maxRssMiB, 312.71);
  assert.equal(rss.quickXml.maxRssMiB, 4.78);
  assert.match(rss.caveat, /not allocation-model equivalence/);

  assert.ok(report.findings.some(entry => entry.id === 'woodstox-0-9x-target-not-met'));
  assert.ok(report.findings.some(entry => entry.id === 'quickxml-0-9x-target-not-met'));
  assert.ok(report.findings.some(entry => entry.id === 'external-baseline-separate-from-candidate-target'));
  assert.ok(report.findings.some(entry => entry.id === 'same-fixture-targets-share-js-row' && entry.classification === 'SOURCE_FACT'));
  assert.ok(report.findings.some(entry => entry.id === 'same-fixture-fastest-js-contract-classified'));
  assert.ok(report.findings.some(entry => entry.id === 'overall-js-frontier-separate-from-same-fixture-target'));
  assert.ok(report.findings.some(entry => entry.id === 'target-distance-not-runtime-ceiling'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Target Distance Audit/);
  assert.match(markdown, /Same-fixture JS row: `stax-raw-frame-name-id-batch-8` 152\.11 MiB\/s/);
  assert.match(markdown, /Woodstox and quick-xml target rows share JS baseline: true/);
  assert.match(markdown, /Same-fixture JS source\/memory contract: Node\/V8 `stax-raw-frame-name-id-batch-8` 152\.11 MiB\/s, fullStringParity=true, eventCount=61236571, checksum=-716099804, sameAsWoodstox=true, sameAsQuickXml=true, sourceMode=file-backed-sync-iterable-byte-batches, directReadableStream=false, fullArrayBufferParserInput=false, boundedMemory=true, process-rss max 61\.77 MiB/);
  assert.match(markdown, /Overall JS frontier row: `rawFrameNameId` 185\.50 MiB\/s from `text-trim-cost-decomposition\.json`; same-fixture external baseline: false/);
  assert.match(markdown, /Overall JS frontier separated from same-fixture target row: true/);
  assert.match(markdown, /Woodstox target: 351\.56 MiB\/s; 0\.9x target 316\.40 MiB\/s; JS ratio 0\.43x; remaining 164\.29 MiB\/s; targetMet=false/);
  assert.match(markdown, /quick-xml target: 274\.63 MiB\/s; 0\.9x target 247\.17 MiB\/s; JS ratio 0\.55x; remaining 95\.06 MiB\/s; targetMet=false/);
  assert.match(markdown, /stax-stream: 124\.62 MiB\/s \(0\.37x Woodstox\)/);
  assert.match(markdown, /rawFrameNameId: 132\.54 MiB\/s \(0\.39x Woodstox\)/);
  assert.match(markdown, /quick-xml: 270\.26 MiB\/s \(0\.80x Woodstox\)/);
  assert.match(markdown, /\| `file-backed-batch-size-sweep` \| `stax-raw-frame-name-id-batch-8` \| 152\.11 \| `file-backed-short-attr-value-cache-candidate\.json` \| 274\.63 \| 247\.17 \| 95\.06 \| no \| same books 1024 MiB fixture family, but quick-xml reference comes from a separate candidate artifact \|/);
  assert.match(markdown, /same-fixture fastest JavaScript target row preserves the full-string event\/checksum contract against Woodstox and quick-xml/);
  assert.match(markdown, /overall fastest JavaScript full-string row is not used as the Woodstox\/quick-xml same-fixture target baseline/);
  assert.match(markdown, /A target-distance deficit is not proof that JavaScript runtimes have no further headroom/);
});

test('target distance audit downgrades if same JS target row loses full-string semantic identity', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [semanticDriftComparisonOut, semanticDriftJsonOut, semanticDriftMdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const comparison = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'same-contract-runtime-comparison.json'), 'utf8'));
  comparison.summary.sameFixture1024MiBTargetRows[0].fastestJs.fullStringParity = false;
  writeFileSync(semanticDriftComparisonOut, `${JSON.stringify(comparison, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'target-distance-audit.mjs'),
    '--comparison-json',
    semanticDriftComparisonOut,
    '--json-out',
    semanticDriftJsonOut,
    '--md-out',
    semanticDriftMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(semanticDriftJsonOut, 'utf8'));
  assert.equal(report.summary.status, 'partial');
  assert.equal(report.summary.sameFixtureFastestJsContract.fullStringParity, false);
  assert.equal(report.summary.sameFixtureFastestJsContract.sameSemanticContractAsWoodstox, false);
  assert.equal(report.summary.sameFixtureFastestJsContract.sameSemanticContractAsQuickXml, false);
  assert.ok(report.findings.some(entry =>
    entry.id === 'same-fixture-fastest-js-contract-classified'
    && entry.classification === 'HYPOTHESIS'
  ));

  const markdown = readFileSync(semanticDriftMdOut, 'utf8');
  assert.match(markdown, /Status: partial/);
  assert.match(markdown, /fullStringParity=false/);
  assert.match(markdown, /sameAsWoodstox=false/);
});

test('target distance audit downgrades if Woodstox and quick-xml use different JS target rows', () => {
  mkdirSync(tmpDir, { recursive: true });
  for (const filePath of [driftComparisonOut, driftJsonOut, driftMdOut]) {
    if (existsSync(filePath)) rmSync(filePath);
  }

  const comparison = JSON.parse(readFileSync(join(__dirname, 'results', 'release', 'same-contract-runtime-comparison.json'), 'utf8'));
  comparison.summary.sameFixture1024MiBQuickXmlTarget.fastestJsCaseId = 'stax-stream-batch-8';
  comparison.summary.sameFixture1024MiBQuickXmlTarget.fastestJsMiBPerSec = 120.01;
  comparison.summary.sameFixture1024MiBQuickXmlTarget.fastestJsQuickXmlRatio = 0.44;
  comparison.summary.sameFixture1024MiBQuickXmlTarget.remainingTo90PercentMiBPerSec = 127.16;
  writeFileSync(driftComparisonOut, `${JSON.stringify(comparison, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    join(__dirname, 'target-distance-audit.mjs'),
    '--comparison-json',
    driftComparisonOut,
    '--json-out',
    driftJsonOut,
    '--md-out',
    driftMdOut,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const report = JSON.parse(readFileSync(driftJsonOut, 'utf8'));
  assert.equal(report.summary.status, 'partial');
  assert.equal(report.summary.sharedFastestJsTargetRow, false);
  assert.equal(report.summary.sameFixture1024MiBWoodstoxTarget.fastestJsCaseId, 'stax-raw-frame-name-id-batch-8');
  assert.equal(report.summary.sameFixture1024MiBQuickXmlTarget.fastestJsCaseId, 'stax-stream-batch-8');
  assert.ok(report.findings.some(entry =>
    entry.id === 'same-fixture-targets-share-js-row'
    && entry.classification === 'HYPOTHESIS'
  ));

  const markdown = readFileSync(driftMdOut, 'utf8');
  assert.match(markdown, /Status: partial/);
  assert.match(markdown, /Woodstox and quick-xml target rows share JS baseline: false/);
});
