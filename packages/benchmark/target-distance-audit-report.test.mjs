import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const tmpDir = join(__dirname, 'results', 'tmp');
const jsonOut = join(tmpDir, 'target-distance-audit-report-test.json');
const mdOut = join(tmpDir, 'target-distance-audit-report-test.md');

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
  assert.equal(fastestJsContract.sourceMode, 'file-backed-sync-iterable-byte-batches');
  assert.equal(fastestJsContract.directReadableStream, false);
  assert.equal(fastestJsContract.fullArrayBufferParserInput, false);
  assert.equal(fastestJsContract.boundedMemory, true);
  assert.equal(fastestJsContract.memoryKind, 'process-rss');
  assert.equal(fastestJsContract.maxRssMiB, 61.77);
  assert.equal(fastestJsContract.maxHeapUsedMiB, 6.83);
  assert.equal(fastestJsContract.maxExternalMiB, 3.66);
  assert.equal(fastestJsContract.maxArrayBuffersMiB, 1.67);

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
  assert.ok(report.findings.some(entry => entry.id === 'same-fixture-fastest-js-contract-classified'));
  assert.ok(report.findings.some(entry => entry.id === 'target-distance-not-runtime-ceiling'));

  const markdown = readFileSync(mdOut, 'utf8');
  assert.match(markdown, /# Target Distance Audit/);
  assert.match(markdown, /Same-fixture JS row: `stax-raw-frame-name-id-batch-8` 152\.11 MiB\/s/);
  assert.match(markdown, /Same-fixture JS source\/memory contract: Node\/V8 `stax-raw-frame-name-id-batch-8` 152\.11 MiB\/s, sourceMode=file-backed-sync-iterable-byte-batches, directReadableStream=false, fullArrayBufferParserInput=false, boundedMemory=true, process-rss max 61\.77 MiB/);
  assert.match(markdown, /Woodstox target: 351\.56 MiB\/s; 0\.9x target 316\.40 MiB\/s; JS ratio 0\.43x; remaining 164\.29 MiB\/s; targetMet=false/);
  assert.match(markdown, /quick-xml target: 274\.63 MiB\/s; 0\.9x target 247\.17 MiB\/s; JS ratio 0\.55x; remaining 95\.06 MiB\/s; targetMet=false/);
  assert.match(markdown, /stax-stream: 124\.62 MiB\/s \(0\.37x Woodstox\)/);
  assert.match(markdown, /rawFrameNameId: 132\.54 MiB\/s \(0\.39x Woodstox\)/);
  assert.match(markdown, /quick-xml: 270\.26 MiB\/s \(0\.80x Woodstox\)/);
  assert.match(markdown, /\| `file-backed-batch-size-sweep` \| `stax-raw-frame-name-id-batch-8` \| 152\.11 \| `file-backed-short-attr-value-cache-candidate\.json` \| 274\.63 \| 247\.17 \| 95\.06 \| no \| same books 1024 MiB fixture family, but quick-xml reference comes from a separate candidate artifact \|/);
  assert.match(markdown, /same-fixture fastest JavaScript target row is file-backed synchronous Iterable<Uint8Array\[\]> input/);
  assert.match(markdown, /A target-distance deficit is not proof that JavaScript runtimes have no further headroom/);
});
