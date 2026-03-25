import path from 'node:path';
import process from 'node:process';
import {
  ensureDir,
  getWorktreeList,
  getGitMetadata,
  getOutputRoot,
  resolveBuiltDistEntrypoint,
  runLoggedCommand,
  usage,
  writeJson,
} from './compare-runner-lib.mjs';

const [, , repoRootArg, label, suiteArg = 'all', comparisonBaselineArg = 'none'] = process.argv;

if (!repoRootArg || !label) {
  usage('Usage: node scripts/run-benchmark.mjs <repoRoot> <label> [suite] [comparisonBaseline]');
  process.exit(1);
}

const repoRoot = path.resolve(repoRootArg);
const suite = suiteArg;
const comparisonBaseline = comparisonBaselineArg;
const benchmarkOutputDir = await ensureDir(path.join(getOutputRoot(label), 'benchmarks'));
const git = await getGitMetadata(repoRoot);
const worktrees = await getWorktreeList(repoRoot);
const entrypoint = resolveBuiltDistEntrypoint(repoRoot);
const scriptPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'parser-benchmark-case.mjs');

const suiteCommands = {
  all: [
    ...buildSuiteCommands(label, 'cursor', repoRoot, scriptPath, comparisonBaseline),
    ...buildSuiteCommands(label, 'wrapper', repoRoot, scriptPath, comparisonBaseline),
    ...buildSuiteCommands(label, 'stress', repoRoot, scriptPath, comparisonBaseline),
  ],
  cursor: buildSuiteCommands(label, 'cursor', repoRoot, scriptPath, comparisonBaseline),
  wrapper: buildSuiteCommands(label, 'wrapper', repoRoot, scriptPath, comparisonBaseline),
  stress: buildSuiteCommands(label, 'stress', repoRoot, scriptPath, comparisonBaseline),
};

const commands = suiteCommands[suite];
if (!commands) {
  console.error(`Unknown suite: ${suite}`);
  console.error(`Supported suites: ${Object.keys(suiteCommands).join(', ')}`);
  process.exit(1);
}

const results = [];
let failed = false;

for (const step of commands) {
  const logPath = path.join(benchmarkOutputDir, `${step.name}.log`);
  const result = await runLoggedCommand({
    command: step.command,
    args: step.args,
    cwd: repoRoot,
    logPath,
    timeoutMs: step.timeoutMs,
  });
  const caseSummary = parseCaseSummary(result.stdout);
  results.push({
    name: step.name,
    suite: step.suite,
    command: [step.command, ...step.args],
    timeoutMs: step.timeoutMs,
    caseSummary,
    ...result,
  });

  if (result.exitCode !== 0) {
    failed = true;
    break;
  }
}

const summaryPath = path.join(benchmarkOutputDir, `${suite}.json`);
await writeJson(summaryPath, {
  label,
  comparisonBaseline,
  suite,
  repoRoot,
  git,
  entrypoint,
  timestamp: new Date().toISOString(),
  worktrees,
  results,
});

if (failed) {
  process.exit(1);
}

function buildSuiteCommands(labelValue, suiteName, repoRootValue, scriptPathValue, baselineValue) {
  const caseNamesBySuite = {
    cursor: [
      'sync-cursor-consume',
      'sync-cursor-attr-unused',
      'async-cursor-midsize-4kb',
      'async-cursor-midsize-64kb',
    ],
    wrapper: [
      'sync-parser-books',
      'sync-parser-complex',
      ...(labelValue === 'main' ? [] : [
        'async-parser-midsize-4kb',
        'async-parser-midsize-64kb',
        'async-parser-mixed-256b',
      ]),
    ],
    stress: [
      'async-parser-single-chunk',
    ],
  };

  const timeoutByCase = {
    'sync-cursor-consume': 60_000,
    'sync-cursor-attr-unused': 60_000,
    'async-cursor-midsize-4kb': 120_000,
    'async-cursor-midsize-64kb': 120_000,
    'sync-parser-books': 60_000,
    'sync-parser-complex': 60_000,
    'async-parser-midsize-4kb': 120_000,
    'async-parser-midsize-64kb': 120_000,
    'async-parser-mixed-256b': 120_000,
    'async-parser-single-chunk': 120_000,
  };

  return caseNamesBySuite[suiteName].map((caseName) => ({
    name: caseName,
    suite: suiteName,
    timeoutMs: timeoutByCase[caseName],
    command: 'node',
    args: ['--expose-gc', scriptPathValue, repoRootValue, suiteName, caseName, baselineValue],
  }));
}

function parseCaseSummary(stdout) {
  if (!stdout) {
    return null;
  }

  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}
