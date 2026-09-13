import { readFileSync, writeFileSync } from 'node:fs';

export const BOOTSTRAP_ITERATIONS = 10_000;
export const BOOTSTRAP_SEED = 260913;
const MIB = 1024 * 1024;
const ENTITY_FIXTURES = ['named-attr', 'numeric-attr', 'custom-attr'];
const VALID_VARIANTS = ['R0', 'W0', 'A1', 'AT1'];

export function median(values) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) return Number.NaN;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function geometricMean(values) {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!valid.length) return Number.NaN;
  return Math.exp(valid.reduce((sum, value) => sum + Math.log(value), 0) / valid.length);
}

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 16), 2246822519) + 3266489917) >>> 0;
    state ^= state >>> 13;
    return (state >>> 0) / 0x100000000;
  };
}

function sampleValues(value) {
  const samples = Array.isArray(value) ? value : value?.samples ?? value?.timesMs;
  if (!Array.isArray(samples)) return [];
  return samples.map((sample) => typeof sample === 'number' ? sample : sample?.ms ?? sample?.timeMs).filter(Number.isFinite);
}

function metricValues(value, metric) {
  if (metric === 'fullMs' && value?.samples) return sampleValues(value);
  const raw = value?.[metric];
  if (Array.isArray(raw)) return raw.map((sample) => typeof sample === 'number' ? sample : sample?.ms ?? sample?.timeMs).filter(Number.isFinite);
  return Number.isFinite(raw) ? [raw] : [];
}

function blockId(block, index) {
  return block?.block ?? block?.index ?? index;
}

function blockVariant(block, id) {
  return block?.variants?.[id] ?? block?.results?.[id] ?? block?.[id];
}

export function pairedRatios(blocks, baselineId = 'R0', candidateId) {
  const pairs = [];
  for (const [index, block] of (blocks ?? []).entries()) {
    const baselineMedian = median(sampleValues(blockVariant(block, baselineId)));
    const candidateMedian = median(sampleValues(blockVariant(block, candidateId)));
    if (baselineMedian > 0 && candidateMedian > 0) {
      pairs.push({ block: blockId(block, index), baselineMedian, candidateMedian, ratio: candidateMedian / baselineMedian });
    }
  }
  return pairs;
}

function missingPairBlocks(blocks, baselineId, candidateId) {
  const missing = [];
  for (const [index, block] of (blocks ?? []).entries()) {
    const baseline = sampleValues(blockVariant(block, baselineId));
    const candidate = sampleValues(blockVariant(block, candidateId));
    const baselineMedian = median(baseline);
    const candidateMedian = median(candidate);
    if (!(baselineMedian > 0) || !(candidateMedian > 0)) missing.push(blockId(block, index));
  }
  return missing;
}

function pairedMetricRatios(blocks, baselineId, candidateId, metric) {
  const pairs = [];
  for (const [index, block] of (blocks ?? []).entries()) {
    const baselineMedian = median(metricValues(blockVariant(block, baselineId), metric));
    const candidateMedian = median(metricValues(blockVariant(block, candidateId), metric));
    if (baselineMedian > 0 && candidateMedian > 0) {
      pairs.push({ block: blockId(block, index), baselineMedian, candidateMedian, ratio: candidateMedian / baselineMedian });
    }
  }
  return pairs;
}

function summarizeMetricPair(blocks, candidateId, metric, options = {}) {
  const baselineId = options.baselineId ?? 'R0';
  const pairs = pairedMetricRatios(blocks, baselineId, candidateId, metric);
  const confidence = bootstrapCI(pairs.map((pair) => pair.ratio), options);
  const missingBlocks = [];
  for (const [index, block] of (blocks ?? []).entries()) {
    const baselineMedian = median(metricValues(blockVariant(block, baselineId), metric));
    const candidateMedian = median(metricValues(blockVariant(block, candidateId), metric));
    if (!(baselineMedian > 0) || !(candidateMedian > 0)) missingBlocks.push(blockId(block, index));
  }
  return { metric, candidate: candidateId, baseline: baselineId, ...confidence, pairs, missingBlocks, dataComplete: pairs.length > 0 && missingBlocks.length === 0 };
}

export function bootstrapCI(ratios, options = {}) {
  const values = (ratios ?? []).filter((value) => Number.isFinite(value) && value > 0);
  const iterations = options.iterations ?? BOOTSTRAP_ITERATIONS;
  const seed = options.seed ?? BOOTSTRAP_SEED;
  if (!values.length) return { estimate: Number.NaN, meanRatio: Number.NaN, lower: Number.NaN, upper: Number.NaN, iterations: 0, seed, ratios: [] };
  const estimate = geometricMean(values);
  const meanRatio = values.reduce((sum, value) => sum + value, 0) / values.length;
  const next = random(seed);
  const samples = new Array(iterations);
  for (let iteration = 0; iteration < iterations; iteration++) {
    let sum = 0;
    for (let index = 0; index < values.length; index++) sum += Math.log(values[Math.floor(next() * values.length)]);
    samples[iteration] = Math.exp(sum / values.length);
  }
  samples.sort((a, b) => a - b);
  const lowerIndex = Math.floor((iterations - 1) * 0.025);
  const upperIndex = Math.ceil((iterations - 1) * 0.975);
  return { estimate, meanRatio, lower: samples[lowerIndex], upper: samples[upperIndex], iterations, seed, ratios: values };
}

export function summarizePair(blocks, candidateId, options = {}) {
  const baselineId = options.baselineId ?? 'R0';
  const pairs = pairedRatios(blocks, baselineId, candidateId);
  const confidence = bootstrapCI(pairs.map((pair) => pair.ratio), options);
  const missingBlocks = missingPairBlocks(blocks, baselineId, candidateId);
  return {
    candidate: candidateId,
    baseline: baselineId,
    ...confidence,
    pairs,
    missingBlocks,
    dataComplete: pairs.length > 0 && missingBlocks.length === 0,
  };
}

function flattenRows(report) {
  if (Array.isArray(report?.rows)) return report.rows;
  if (Array.isArray(report?.cases)) return report.cases;
  const rows = [];
  for (const [key, value] of Object.entries(report?.results ?? report?.cases ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && (value.variants || value.blocks || value.samples)) {
      rows.push({ case: key, ...value });
      continue;
    }
    for (const [lane, laneValue] of Object.entries(value ?? {})) rows.push({ case: `${lane}/${key}`, lane, fixture: key, ...laneValue });
  }
  return rows;
}

function rowCase(row) {
  return String(row.case ?? row.id ?? `${row.lane ?? row.laneId ?? ''}/${row.fixture ?? row.fixtureId ?? ''}`);
}

function rowBlocks(row) {
  if (Array.isArray(row?.blocks)) return row.blocks;
  return row && (row.variants || row.results || row.block !== undefined) ? [row] : [];
}

function groupRows(reports) {
  const groups = new Map();
  for (const row of reports.flatMap((report) => flattenRows(report))) {
    const key = rowCase(row);
    let group = groups.get(key);
    if (!group) {
      group = { case: key, lane: row.lane ?? row.laneId ?? '', fixture: row.fixture ?? row.fixtureId ?? '', kind: row.kind, api: row.api ?? row.kind ?? row.lane ?? row.laneId ?? '', rows: [] };
      groups.set(key, group);
    }
    group.rows.push(row);
    if (!group.lane) group.lane = row.lane ?? row.laneId ?? '';
    if (!group.fixture) group.fixture = row.fixture ?? row.fixtureId ?? '';
    if (!group.kind) group.kind = row.kind;
    if (!group.api) group.api = row.api ?? row.kind ?? group.lane;
  }
  return [...groups.values()];
}

function groupBlocks(group) {
  return group.rows.flatMap(rowBlocks);
}

function confidenceStatus(confidence, threshold, complete = true) {
  if (!complete || !confidence || !confidence.pairs?.length || !Number.isFinite(confidence.lower) || !Number.isFinite(confidence.upper) || confidence.lower > confidence.upper) return 'INCONCLUSIVE';
  if (confidence.lower > threshold) return 'FAIL';
  if (confidence.upper <= threshold) return 'PASS';
  return 'INCONCLUSIVE';
}

function aggregateStatus(items) {
  if (!items.length) return 'INCONCLUSIVE';
  if (items.some((item) => item.status === 'FAIL')) return 'FAIL';
  if (items.some((item) => item.status === 'INCONCLUSIVE')) return 'INCONCLUSIVE';
  return 'PASS';
}

function caseItem(group, candidate, options = {}) {
  const summary = summarizePair(groupBlocks(group), candidate, options);
  const threshold = options.threshold;
  return {
    case: group.case,
    lane: group.lane,
    api: group.api,
    fixture: group.fixture,
    kind: group.kind,
    candidate,
    threshold,
    status: confidenceStatus(summary, threshold, summary.dataComplete),
    ...summary,
  };
}

function coldCaseItem(group, candidate, options = {}) {
  const metrics = {};
  for (const metric of ['constructorMs', 'firstNextMs', 'firstNextCloseMs', 'fullMs']) {
    const summary = summarizeMetricPair(groupBlocks(group), candidate, metric, options);
    metrics[metric] = { ...summary, threshold: options.threshold, status: confidenceStatus(summary, options.threshold, summary.dataComplete) };
  }
  // Import and close are useful diagnostics, but are deliberately not folded
  // into the cold gate's parser lifecycle metrics.
  const reporting = {};
  for (const metric of ['importMs', 'closeMs']) reporting[metric] = summarizeMetricPair(groupBlocks(group), candidate, metric, options);
  const statuses = Object.values(metrics).map((item) => item.status);
  const status = aggregateStatus(statuses.map((value) => ({ status: value })));
  return {
    case: group.case,
    lane: group.lane,
    api: group.api,
    fixture: group.fixture,
    kind: group.kind,
    candidate,
    threshold: options.threshold,
    metrics,
    reporting,
    // Keep full parse at the top level for consumers of the original table.
    ...metrics.fullMs,
    status,
  };
}

function entitySummary(items, candidate, options = {}) {
  const usable = items.filter((item) => item.candidate === candidate && ENTITY_FIXTURES.includes(item.fixture));
  const byLane = new Map();
  for (const item of usable) {
    if (!byLane.has(item.lane)) byLane.set(item.lane, []);
    byLane.get(item.lane).push(item);
  }
  const lanes = [];
  for (const [lane, laneItems] of byLane) {
    const expectedCases = laneItems.map((item) => item.case);
    const byBlock = new Map();
    for (const item of laneItems) {
      for (const pair of item.pairs) {
        if (!byBlock.has(pair.block)) byBlock.set(pair.block, new Map());
        byBlock.get(pair.block).set(item.case, pair.ratio);
      }
    }
    const blockPairs = [];
    const missingBlocks = [];
    for (const [block, values] of byBlock) {
      if (expectedCases.every((key) => Number.isFinite(values.get(key)) && values.get(key) > 0)) {
        blockPairs.push({ block, ratios: expectedCases.map((key) => values.get(key)), ratio: geometricMean(expectedCases.map((key) => values.get(key))) });
      } else missingBlocks.push(block);
    }
    const missingCases = laneItems.filter((item) => !item.pairs.length || !item.dataComplete).map((item) => item.case);
    const confidence = bootstrapCI(blockPairs.map((pair) => pair.ratio), options);
    lanes.push({
      lane,
      api: laneItems[0]?.api ?? lane,
      candidate,
      fixtures: [...new Set(laneItems.map((item) => item.fixture))],
      cases: laneItems,
      pairs: blockPairs,
      missingCases,
      missingBlocks,
      dataComplete: blockPairs.length > 0 && !missingCases.length && !missingBlocks.length,
      threshold: options.threshold,
      status: confidenceStatus(confidence, options.threshold, blockPairs.length > 0 && !missingCases.length && !missingBlocks.length),
      ...confidence,
    });
  }
  const status = aggregateStatus(lanes);
  const allPairs = lanes.flatMap((lane) => lane.pairs);
  // Lanes are independent APIs. Do not turn their block pairs into one
  // confidence interval; callers can read the per-lane table above.
  const confidence = lanes.length === 1
    ? lanes[0]
    : { estimate: Number.NaN, meanRatio: Number.NaN, lower: Number.NaN, upper: Number.NaN, iterations: 0, seed: options.seed };
  return {
    candidate,
    status,
    threshold: options.threshold,
    lanes,
    pairs: allPairs,
    estimate: confidence.estimate,
    meanRatio: confidence.meanRatio,
    lower: confidence.lower,
    upper: confidence.upper,
    iterations: confidence.iterations,
    seed: confidence.seed,
  };
}

function analyzeRetentionLane(rows, mode, candidates, options = {}) {
  const baseline = rows.filter((row) => row.variant === 'R0' && row.mode === mode);
  const byKey = (variant) => new Map(rows.filter((row) => row.variant === variant && row.mode === mode).map((row) => [retentionKey(row), row]));
  const baselineByKey = new Map(baseline.map((row) => [retentionKey(row), row]));
  const expectedKeys = options.expectedKeys ?? [...baselineByKey.keys()];
  const duplicateBaselineKeys = duplicateKeys(baseline);
  const candidateResults = [];
  const failures = [];
  const missing = [];
  const absoluteFailures = [];
  const slopeFailures = [];
  for (const candidate of candidates) {
    const candidateRows = rows.filter((row) => row.variant === candidate && row.mode === mode);
    const candidateByKey = byKey(candidate);
    const duplicateCandidateKeys = duplicateKeys(candidateRows);
    const pairs = [];
    for (const key of expectedKeys) {
      const base = baselineByKey.get(key);
      const value = candidateByKey.get(key);
      const [keyScenario, keyCount, keyRepeat] = key.split('\u0000');
      const detail = { key, scenario: base?.scenario ?? keyScenario ?? 'default', count: base?.count ?? Number(keyCount), repeat: base?.repeat ?? Number(keyRepeat ?? 0), variant: candidate };
      if (!base) {
        missing.push({ ...detail, reason: 'baseline row missing' });
        continue;
      }
      if (duplicateBaselineKeys.has(key)) {
        missing.push({ ...detail, reason: 'duplicate baseline row' });
        continue;
      }
      if (!value) {
        missing.push({ ...detail, reason: 'candidate row missing' });
        continue;
      }
      if (duplicateCandidateKeys.has(key)) {
        missing.push({ ...detail, reason: 'duplicate candidate row' });
        continue;
      }
      const baseUnits = keptUnits(base);
      const candidateUnits = keptUnits(value);
      const baseHeap = heapMetric(base);
      const candidateHeap = heapMetric(value);
      if (!Number.isFinite(baseUnits) || !Number.isFinite(candidateUnits) || baseUnits !== candidateUnits) {
        missing.push({ ...detail, reason: 'kept units differ', baselineKeptUnits: baseUnits, candidateKeptUnits: candidateUnits });
        continue;
      }
      if (!Number.isFinite(baseHeap) || !Number.isFinite(candidateHeap)) {
        missing.push({ ...detail, reason: 'retained heap data missing' });
        continue;
      }
      const discardedSourceBytes = discardedBytes(base);
      const delta = candidateHeap - baseHeap;
      const absolute = absoluteHeapMetric(value);
      const absoluteLimit = Math.max(2 * MIB, baseUnits * 4);
      const pair = { ...detail, baselineRetainedHeapBytes: baseHeap, candidateRetainedHeapBytes: candidateHeap, additionalRetainedHeapBytes: delta, keptUnits: baseUnits, discardedSourceBytes, absoluteRetainedHeapBytes: absolute, absoluteLimitBytes: absoluteLimit };
      pairs.push(pair);
      if (mode === 'normalized-result' && !['none', 'rare-attr', 'rare-text'].includes(detail.scenario) && (!Number.isFinite(absolute) || absolute > absoluteLimit || Number(value.sourceHeldBytes ?? 0) > 0)) {
        absoluteFailures.push({ ...pair, reason: Number(value.sourceHeldBytes ?? 0) > 0 ? 'source retained' : 'absolute normalized retention exceeded' });
      }
    }
    const extraKeys = candidateRows.filter((row) => !baselineByKey.has(retentionKey(row))).map((row) => retentionKey(row));
    const candidateMissing = missing.filter((item) => item.variant === candidate);
    for (const key of extraKeys) candidateMissing.push({ key, variant: candidate, reason: 'baseline row missing' });
    const scenarios = options.expectedScenarios ?? [...new Set(expectedKeys.map((key) => baselineByKey.get(key)?.scenario ?? key.split('\u0000')[0] ?? 'default'))];
    const scenarioResults = [];
    for (const scenario of scenarios) {
      const scenarioPairs = pairs.filter((pair) => pair.scenario === scenario);
      const scenarioKeys = expectedKeys.filter((key) => {
        const base = baselineByKey.get(key);
        return (base?.scenario ?? key.split('\u0000')[0] ?? 'default') === scenario;
      });
      const scenarioMissing = candidateMissing.filter((item) => item.scenario === scenario || item.scenario === undefined);
      const points = [...new Set(scenarioPairs.map((pair) => pair.count))].map((count) => {
        const selected = scenarioPairs.filter((pair) => pair.count === count);
        return { count, discardedSourceBytes: median(selected.map((pair) => pair.discardedSourceBytes)), additionalRetainedHeapBytes: median(selected.map((pair) => pair.additionalRetainedHeapBytes)) };
      }).filter((point) => Number.isFinite(point.discardedSourceBytes) && Number.isFinite(point.additionalRetainedHeapBytes));
      const slope = linearSlope(points.map((point) => [point.discardedSourceBytes, point.additionalRetainedHeapBytes]));
      const scenarioAbsoluteFailures = absoluteFailures.filter((item) => item.scenario === scenario);
      const scenarioStatus = scenarioAbsoluteFailures.length || (Number.isFinite(slope) && slope > (options.slopeLimit ?? 0.01))
        ? 'FAIL'
        : scenarioPairs.length === scenarioKeys.length && scenarioKeys.length > 0 && !scenarioMissing.length ? 'PASS' : 'INCONCLUSIVE';
      const scenarioResult = { scenario, expectedCount: scenarioKeys.length, pairCount: scenarioPairs.length, pairs: scenarioPairs, missing: scenarioMissing, absoluteFailures: scenarioAbsoluteFailures, slope, slopeLimit: options.slopeLimit ?? 0.01, points, status: scenarioStatus };
      scenarioResults.push(scenarioResult);
      if (Number.isFinite(slope) && slope > (options.slopeLimit ?? 0.01)) slopeFailures.push({ variant: candidate, mode, ...scenarioResult });
    }
    if (absoluteFailures.filter((item) => item.variant === candidate).length) failures.push(...absoluteFailures.filter((item) => item.variant === candidate));
    const result = { variant: candidate, mode, pairs, expectedCount: expectedKeys.length, pairCount: pairs.length, missing: candidateMissing, absoluteFailures: absoluteFailures.filter((item) => item.variant === candidate), scenarios: scenarioResults, slope: scenarioResults.length === 1 ? scenarioResults[0].slope : null, slopeLimit: options.slopeLimit ?? 0.01 };
    result.status = aggregateStatus(scenarioResults);
    candidateResults.push(result);
  }
  return { mode, status: aggregateStatus(candidateResults), candidates: candidateResults, failures, missing, absoluteFailures, slopeFailures, baselineCount: baseline.length, candidateCount: candidateResults.reduce((sum, item) => sum + item.pairCount, 0), thresholdBytes: 2 * MIB, slopeLimit: options.slopeLimit ?? 0.01 };
}

function duplicateKeys(rows) {
  const seen = new Set();
  const duplicates = new Set();
  for (const row of rows) {
    const key = retentionKey(row);
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return duplicates;
}

function retentionKey(row) {
  return `${row.scenario ?? row.fixture ?? 'default'}\u0000${row.count ?? ''}\u0000${row.repeat ?? 0}`;
}

function keptUnits(row) {
  return Number(row.keptChars ?? row.returnedChars ?? row.keptUnits ?? Number.NaN);
}

function heapMetric(row) {
  return Number(row.retainedHeapBytes ?? row.heapDeltaBytes ?? Number.NaN);
}

function absoluteHeapMetric(row) {
  return Number(row.heapDeltaBytes ?? row.retainedHeapBytes ?? Number.NaN);
}

function discardedBytes(row) {
  const source = Number(row.sourceBytes);
  const kept = keptUnits(row);
  return Number.isFinite(source) ? Math.max(0, source - (Number.isFinite(kept) ? kept * 2 : 0)) : Number.NaN;
}

function linearSlope(points) {
  if (points.length < 2) return 0;
  const meanX = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  let numerator = 0;
  let denominator = 0;
  for (const [x, y] of points) {
    numerator += (x - meanX) * (y - meanY);
    denominator += (x - meanX) ** 2;
  }
  return denominator ? numerator / denominator : 0;
}

function controlCheck(rows, mode, scenarios, expectedRows = []) {
  const controls = rows.filter((row) => row.mode === mode);
  const expected = scenarios.length ? scenarios : [...new Set(controls.map((row) => row.scenario ?? 'default'))];
  const missing = [];
  const invalid = [];
  const expectedKeys = expectedRows.length
    ? expectedRows.map((row) => retentionKey(row))
    : expected.map((scenario) => `${scenario}\u0000\u0000\u0000`);
  const variants = [...new Set(expectedRows.map((row) => row.variant).filter(Boolean))];
  const expectedVariantKeys = variants.length
    ? variants.flatMap((variant) => expectedKeys.map((key) => `${variant}\u0000${key}`))
    : expectedKeys;
  const indexed = new Map();
  for (const row of controls) indexed.set(`${row.variant ?? ''}\u0000${retentionKey(row)}`, row);
  for (const key of expectedVariantKeys) {
    const row = indexed.get(key) ?? indexed.get(`\u0000${key}`);
    if (!row) {
      missing.push(key);
      continue;
    }
    if (!Number.isFinite(Number(row.retainedHeapBytes ?? row.heapDeltaBytes)) || (mode === 'positive-control' && !(Number(row.sourceHeldBytes) > 0)) || (mode === 'plus-diagnostic' && !Number.isFinite(Number(row.plusDiagnosticChars)))) invalid.push({ row, reason: mode === 'positive-control' ? 'positive control did not retain source' : 'diagnostic heap data missing' });
  }
  for (const row of controls) {
    if (!Number.isFinite(Number(row.retainedHeapBytes ?? row.heapDeltaBytes)) || (mode === 'positive-control' && !(Number(row.sourceHeldBytes) > 0)) || (mode === 'plus-diagnostic' && !Number.isFinite(Number(row.plusDiagnosticChars)))) invalid.push({ row, reason: mode === 'positive-control' ? 'positive control did not retain source' : 'diagnostic heap data missing' });
  }
  return { mode, rows: controls, expectedScenarios: expected, missing, invalid, status: !controls.length || missing.length || invalid.length ? 'INCONCLUSIVE' : 'PASS' };
}

export function analyzeGates(input, options = {}) {
  const primary = input.primary ?? input;
  const guards = input.guards;
  const retention = input.retention;
  const candidates = options.candidates ?? ['W0', 'A1', 'AT1'];
  const groups = groupRows([primary, guards]);
  const ordinaryItems = [];
  const coldItems = [];
  const allItems = [];
  for (const group of groups) {
    for (const candidate of candidates) {
      const item = group.lane === 'G5'
        ? coldCaseItem(group, candidate, { seed: options.seed ?? BOOTSTRAP_SEED, iterations: options.iterations ?? BOOTSTRAP_ITERATIONS, threshold: options.coldLimit ?? 1.10 })
        : caseItem(group, candidate, { seed: options.seed ?? BOOTSTRAP_SEED, iterations: options.iterations ?? BOOTSTRAP_ITERATIONS, threshold: options.ordinaryLimit ?? 1.02 });
      allItems.push(item);
      if (group.lane === 'G5') coldItems.push(item);
      else ordinaryItems.push(item);
    }
  }
  const ordinaryGate = { status: aggregateStatus(ordinaryItems), threshold: options.ordinaryLimit ?? 1.02, cases: ordinaryItems, pairs: ordinaryItems };
  const coldGate = { status: aggregateStatus(coldItems), threshold: options.coldLimit ?? 1.10, metrics: ['constructorMs', 'firstNextMs', 'firstNextCloseMs', 'fullMs'], cases: coldItems, pairs: coldItems };
  const entityItems = allItems.filter((item) => ENTITY_FIXTURES.includes(item.fixture));
  const entityByCandidate = {};
  for (const candidate of candidates.filter((id) => id !== 'W0' && id !== 'R0')) entityByCandidate[candidate] = entitySummary(entityItems, candidate, { seed: options.seed ?? BOOTSTRAP_SEED, iterations: options.iterations ?? BOOTSTRAP_ITERATIONS, threshold: options.entityLimit ?? 1 / 1.1 });
  const textItems = groups.filter((group) => group.fixture === 'named-text').flatMap((group) => [caseItem(group, 'AT1', { baselineId: 'A1', seed: options.seed ?? BOOTSTRAP_SEED, iterations: options.iterations ?? BOOTSTRAP_ITERATIONS, threshold: 1 })]);
  const textGate = { status: aggregateStatus(textItems), threshold: 1, cases: textItems, pairs: textItems };
  const retentionGate = retention ? analyzeRetention(retention) : { status: 'NOT RUN', reason: 'retention report was not supplied' };
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    gates: {
      correctness: { status: input.correctness === false ? 'FAIL' : input.correctness === true ? 'PASS' : 'INCONCLUSIVE' },
      ordinaryNonRegression: ordinaryGate,
      coldEarlyClose: coldGate,
      entityGain: entityByCandidate,
      textExtension: textGate,
      memory: retentionGate,
      packaging: { status: input.packaging === false ? 'FAIL' : input.packaging === true ? 'PASS' : 'NOT RUN' },
    },
    tables: { cases: allItems, ordinary: ordinaryItems, cold: coldItems, entity: entityByCandidate, text: textItems },
    pairs: allItems,
  };
}

export function analyzeRetention(report) {
  const rows = report?.rows ?? report?.results ?? [];
  if (!Array.isArray(rows) || !rows.length) return { status: 'INCONCLUSIVE', reason: 'no retention rows' };
  const scenarios = report.options?.scenarios ?? [...new Set(rows.map((row) => row.scenario ?? 'default'))];
  const variants = [...new Set(rows.map((row) => row.variant).filter((variant) => variant && variant !== 'R0' && variant !== 'positive-control'))];
  if (!rows.some((row) => row.variant === 'R0' && row.mode === 'normalized-result') || !variants.length) return { status: 'INCONCLUSIVE', reason: 'baseline or candidate retention rows missing' };
  const planned = report.options?.counts?.length && report.options?.repeats
    ? report.options.counts.flatMap((count) => scenarios.flatMap((scenario) => Array.from({ length: report.options.repeats }, (_, repeat) => `${scenario}\u0000${count}\u0000${repeat}`)))
    : undefined;
  const normalized = analyzeRetentionLane(rows, 'normalized-result', variants, { expectedKeys: planned, expectedScenarios: scenarios });
  const raw = analyzeRetentionLane(rows, 'raw', variants, { expectedKeys: planned, expectedScenarios: scenarios });
  const controlRows = rows.filter((row) => row.variant && row.variant !== 'positive-control' && row.mode === 'normalized-result');
  const positiveControl = controlCheck(rows, 'positive-control', scenarios, controlRows);
  const plusDiagnostic = controlCheck(rows, 'plus-diagnostic', scenarios, controlRows);
  const statuses = [normalized.status, raw.status, positiveControl.status, plusDiagnostic.status];
  return {
    status: statuses.includes('FAIL') ? 'FAIL' : statuses.every((status) => status === 'PASS') ? 'PASS' : 'INCONCLUSIVE',
    thresholdBytes: 2 * MIB,
    slopeLimit: 0.01,
    scenarios,
    normalized,
    raw,
    positiveControl,
    plusDiagnostic,
    failures: [...normalized.failures, ...raw.failures],
    baselineCount: normalized.baselineCount,
    candidateCount: normalized.candidateCount,
  };
}

function validateManifest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Build manifest must be an object.');
  if (value.schemaVersion !== 1) throw new Error('Build manifest schemaVersion must be 1.');
  if (!Array.isArray(value.variants) || !value.variants.length) throw new Error('Build manifest must contain staged variants.');
  const seen = new Set();
  for (const variant of value.variants) {
    if (!variant || !VALID_VARIANTS.includes(variant.id) || seen.has(variant.id)) throw new Error('Build manifest variants are invalid or duplicated.');
    seen.add(variant.id);
    if (typeof variant.entry !== 'string' || !variant.entry) throw new Error(`${variant.id}.entry is required.`);
  }
  if (!seen.has('R0')) throw new Error('Build manifest must contain R0.');
  return { valid: true, schemaVersion: value.schemaVersion, variants: [...seen] };
}

export function parseArgs(args = process.argv.slice(2)) {
  const input = [...args];
  const command = input[0]?.startsWith('--') ? 'analyze' : (input.shift() ?? 'analyze');
  const allowed = command === 'validate' ? new Set(['--manifest']) : new Set(['--input', '--guards', '--retention', '--manifest', '--out', '--iterations', '--seed']);
  if (!['analyze', 'validate'].includes(command)) throw new Error(`Unknown command: ${command}`);
  const options = {};
  for (let index = 0; index < input.length; index++) {
    const arg = input[index];
    if (!arg.startsWith('--') || !allowed.has(arg.split('=', 1)[0])) throw new Error(`Unknown argument: ${arg}`);
    const [name, inline] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const value = inline ?? input[++index];
    if (value === undefined) throw new Error(`${name} requires a value.`);
    options[name.slice(2)] = ['iterations', 'seed'].includes(name.slice(2)) ? Number(value) : value;
  }
  if (command === 'validate') {
    if (!options.manifest) throw new Error('--manifest is required.');
  } else if (!options.input || !options.out) {
    throw new Error('--input and --out are required.');
  }
  return command === 'validate' ? { command, ...options } : options;
}

export async function main(args = process.argv.slice(2)) {
  const parsed = parseArgs(args);
  if (parsed.command === 'validate') {
    const value = JSON.parse(readFileSync(parsed.manifest, 'utf8'));
    const result = validateManifest(value);
    console.log(JSON.stringify(result));
    return result;
  }
  const input = JSON.parse(readFileSync(parsed.input, 'utf8'));
  const guards = parsed.guards ? JSON.parse(readFileSync(parsed.guards, 'utf8')) : undefined;
  const retention = parsed.retention ? JSON.parse(readFileSync(parsed.retention, 'utf8')) : undefined;
  const output = analyzeGates({ primary: input, guards, retention }, { iterations: parsed.iterations, seed: parsed.seed });
  writeFileSync(parsed.out, `${JSON.stringify(output, null, 2)}\n`);
  return output;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
