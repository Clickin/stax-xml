import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const [, , suiteArg, baselineSummaryArg, featureSummaryArg] = process.argv;

if (!suiteArg || !baselineSummaryArg || !featureSummaryArg) {
  console.error(
    'Usage: node scripts/evaluate-core-parser-gates.mjs <suite> <baselineSuiteJson> <featureSuiteJson>'
  );
  process.exit(1);
}

const suite = suiteArg;
const baselineSummary = JSON.parse(readFileSync(path.resolve(baselineSummaryArg), 'utf8'));
const featureSummary = JSON.parse(readFileSync(path.resolve(featureSummaryArg), 'utf8'));

const evaluators = {
  cursor: evaluateCursorGate,
  wrapper: evaluateWrapperGate,
  stress: evaluateStressSuite,
};

const evaluator = evaluators[suite];
if (!evaluator) {
  console.error(`Unknown suite: ${suite}`);
  console.error(`Supported suites: ${Object.keys(evaluators).join(', ')}`);
  process.exit(1);
}

const result = evaluator(baselineSummary, featureSummary);
console.log(JSON.stringify(result, null, 2));

if (suite !== 'stress' && !result.pass) {
  process.exit(1);
}

function evaluateCursorGate(baselineSummaryValue, featureSummaryValue) {
  const checks = [
    evaluateImprovementCheck(
      baselineSummaryValue,
      featureSummaryValue,
      'sync-cursor-consume',
      10
    ),
    evaluateImprovementCheck(
      baselineSummaryValue,
      featureSummaryValue,
      'sync-cursor-attr-unused',
      25
    ),
    evaluateRatioCheck(
      baselineSummaryValue,
      featureSummaryValue,
      'async-cursor-midsize-4kb',
      1.5
    ),
    evaluateRatioCheck(
      baselineSummaryValue,
      featureSummaryValue,
      'async-cursor-midsize-64kb',
      1.5
    ),
  ];

  return finalizeGateResult(
    'cursor',
    'checkpoint',
    checks,
    baselineSummaryValue,
    featureSummaryValue
  );
}

function evaluateWrapperGate(baselineSummaryValue, featureSummaryValue) {
  const representativeCases = [
    'sync-parser-books',
    'sync-parser-complex',
  ];

  const regressionChecks = representativeCases.map((caseName) =>
    evaluateMaxRegressionCheck(baselineSummaryValue, featureSummaryValue, caseName, 5)
  );

  const improvementChecks = representativeCases.map((caseName) =>
    evaluateImprovementCheck(baselineSummaryValue, featureSummaryValue, caseName, 5)
  );

  const asyncChecks = [
    evaluateFeatureOnlyCompletionCheck(
      'async-parser-midsize-4kb'
    ),
    evaluateFeatureOnlyCompletionCheck(
      'async-parser-midsize-64kb'
    ),
    evaluateFeatureOnlyCompletionCheck(
      'async-parser-mixed-256b'
    ),
  ];

  const atLeastOneImprovement = {
    caseName: 'representative-wrapper-improvement',
    rule: 'at least one representative wrapper case improves by >= 5%',
    pass: improvementChecks.some((check) => check.pass),
    improvements: improvementChecks.map((check) => ({
      caseName: check.caseName,
      improvementPct: check.improvementPct,
      pass: check.pass,
    })),
  };

  return finalizeGateResult(
    'wrapper',
    'main',
    [...regressionChecks, atLeastOneImprovement, ...asyncChecks],
    baselineSummaryValue,
    featureSummaryValue
  );
}

function evaluateStressSuite(baselineSummaryValue, featureSummaryValue) {
  const check = evaluateSignalCheck(
    baselineSummaryValue,
    featureSummaryValue,
    'async-parser-single-chunk'
  );

  return {
    suite: 'stress',
    gateType: 'signal-only',
    pass: true,
    baselineLabel: baselineSummaryValue.label,
    featureLabel: featureSummaryValue.label,
    timestamp: new Date().toISOString(),
    checks: [check],
  };
}

function finalizeGateResult(suiteName, baselineLabel, checks, baselineSummaryValue, featureSummaryValue) {
  return {
    suite: suiteName,
    gateType: `${baselineLabel}-vs-feature`,
    pass: checks.every((check) => check.pass),
    baselineLabel: baselineSummaryValue.label,
    featureLabel: featureSummaryValue.label,
    baselineHead: baselineSummaryValue.git?.head ?? null,
    featureHead: featureSummaryValue.git?.head ?? null,
    timestamp: new Date().toISOString(),
    checks,
  };
}

function evaluateImprovementCheck(baselineSummaryValue, featureSummaryValue, caseName, minImprovementPct) {
  const baseline = getCaseSummary(baselineSummaryValue, caseName);
  const feature = getCaseSummary(featureSummaryValue, caseName);
  if (!baseline || !feature) {
    return missingCaseCheck(caseName, `missing benchmark result for ${caseName}`);
  }

  const improvementPct = percentageDelta(baseline.meanMs, feature.meanMs);
  return {
    caseName,
    rule: `improvement >= ${minImprovementPct}%`,
    pass: improvementPct >= minImprovementPct,
    baselineMeanMs: baseline.meanMs,
    featureMeanMs: feature.meanMs,
    improvementPct,
  };
}

function evaluateMaxRegressionCheck(baselineSummaryValue, featureSummaryValue, caseName, maxRegressionPct) {
  const baseline = getCaseSummary(baselineSummaryValue, caseName);
  const feature = getCaseSummary(featureSummaryValue, caseName);
  if (!baseline || !feature) {
    return missingCaseCheck(caseName, `missing benchmark result for ${caseName}`);
  }

  const regressionPct = ((feature.meanMs - baseline.meanMs) / baseline.meanMs) * 100;
  return {
    caseName,
    rule: `regression <= ${maxRegressionPct}%`,
    pass: regressionPct <= maxRegressionPct,
    baselineMeanMs: baseline.meanMs,
    featureMeanMs: feature.meanMs,
    regressionPct,
  };
}

function evaluateRatioCheck(baselineSummaryValue, featureSummaryValue, caseName, maxRatio) {
  const baseline = getCaseSummary(baselineSummaryValue, caseName);
  const feature = getCaseSummary(featureSummaryValue, caseName);
  if (!baseline || !feature) {
    return missingCaseCheck(caseName, `missing benchmark result for ${caseName}`);
  }

  const ratio = feature.meanMs / baseline.meanMs;
  const correctnessMatch = compareCorrectness(baseline, feature);
  return {
    caseName,
    rule: `completed and ratio <= ${maxRatio}x`,
    pass: !feature.timedOut && ratio <= maxRatio && correctnessMatch,
    baselineMeanMs: baseline.meanMs,
    featureMeanMs: feature.meanMs,
    ratio,
    featureTimedOut: feature.timedOut ?? false,
    correctnessMatch,
  };
}

function evaluateFeatureOnlyCompletionCheck(caseName) {
  const feature = getCaseSummary(featureSummary, caseName);
  if (!feature) {
    return missingCaseCheck(caseName, `missing benchmark result for ${caseName}`);
  }

  return {
    caseName,
    rule: 'completed without timeout',
    pass: !feature.timedOut,
    featureTimedOut: feature.timedOut ?? false,
    featureMeanMs: feature.meanMs ?? null,
    featureChecksum: feature.correctness?.trace?.checksum ?? null,
  };
}

function evaluateSignalCheck(baselineSummaryValue, featureSummaryValue, caseName) {
  const baseline = getCaseSummary(baselineSummaryValue, caseName);
  const feature = getCaseSummary(featureSummaryValue, caseName);
  if (!baseline || !feature) {
    return {
      caseName,
      status: 'missing',
      pass: true,
      note: 'signal only; missing result does not fail the suite',
    };
  }

  return {
    caseName,
    status: 'signal',
    pass: true,
    baselineMeanMs: baseline.meanMs,
    featureMeanMs: feature.meanMs,
    ratio: feature.meanMs / baseline.meanMs,
    baselineChecksum: baseline.correctness?.trace?.checksum ?? null,
    featureChecksum: feature.correctness?.trace?.checksum ?? null,
    featureTimedOut: feature.timedOut ?? false,
  };
}

function getCaseSummary(summary, caseName) {
  const result = summary.results?.find((entry) => entry.name === caseName);
  if (!result?.caseSummary) {
    return null;
  }

  return {
    ...result.caseSummary,
    timedOut: result.timedOut ?? false,
  };
}

function compareCorrectness(baseline, feature) {
  return baseline.correctness?.trace?.checksum === feature.correctness?.trace?.checksum;
}

function percentageDelta(baselineMeanMs, featureMeanMs) {
  return ((baselineMeanMs - featureMeanMs) / baselineMeanMs) * 100;
}

function missingCaseCheck(caseName, reason) {
  return {
    caseName,
    pass: false,
    reason,
  };
}
