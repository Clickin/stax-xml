import path from 'node:path';
import process from 'node:process';
import {
  ensureDir,
  getGitMetadata,
  getOutputRoot,
  runLoggedCommand,
  usage,
  writeJson,
} from './compare-runner-lib.mjs';

const [, , repoRootArg, label, suiteArg = 'all'] = process.argv;

if (!repoRootArg || !label) {
  usage('Usage: node scripts/run-benchmark.mjs <repoRoot> <label> [suite]');
  process.exit(1);
}

const repoRoot = path.resolve(repoRootArg);
const suite = suiteArg;
const benchmarkOutputDir = await ensureDir(path.join(getOutputRoot(label), 'benchmarks'));
const git = await getGitMetadata(repoRoot);
const scriptPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'parser-benchmark-case.mjs');
const tsxPath = path.join(path.dirname(path.dirname(scriptPath)), 'node_modules', 'tsx', 'dist', 'cli.mjs');

const suiteCommands = {
  all: [
    { name: 'sync-consume', command: 'node', args: ['--expose-gc', tsxPath, scriptPath, repoRoot, 'sync-consume'] },
    { name: 'sync-attr-heavy', command: 'node', args: ['--expose-gc', tsxPath, scriptPath, repoRoot, 'sync-attr-heavy'] },
    { name: 'async-consume-single-chunk', command: 'node', args: ['--expose-gc', tsxPath, scriptPath, repoRoot, 'async-consume-single-chunk'] },
    { name: 'async-consume-64kb-chunk', command: 'node', args: ['--expose-gc', tsxPath, scriptPath, repoRoot, 'async-consume-64kb-chunk'] },
  ],
  'sync-consume': [
    { name: 'sync-consume', command: 'node', args: ['--expose-gc', tsxPath, scriptPath, repoRoot, 'sync-consume'] },
  ],
  'sync-attr-heavy': [
    { name: 'sync-attr-heavy', command: 'node', args: ['--expose-gc', tsxPath, scriptPath, repoRoot, 'sync-attr-heavy'] },
  ],
  'async-consume-single-chunk': [
    { name: 'async-consume-single-chunk', command: 'node', args: ['--expose-gc', tsxPath, scriptPath, repoRoot, 'async-consume-single-chunk'] },
  ],
  'async-consume-64kb-chunk': [
    { name: 'async-consume-64kb-chunk', command: 'node', args: ['--expose-gc', tsxPath, scriptPath, repoRoot, 'async-consume-64kb-chunk'] },
  ],
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
  });
  results.push({
    name: step.name,
    command: [step.command, ...step.args],
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
  suite,
  repoRoot,
  git,
  generatedAt: new Date().toISOString(),
  results,
});

if (failed) {
  process.exit(1);
}
