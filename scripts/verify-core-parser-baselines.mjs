import path from 'node:path';
import process from 'node:process';
import {
  getGitMetadata,
  getGitStatusSummary,
  getWorktreeList,
  resolveBuiltDistEntrypoint,
} from './compare-runner-lib.mjs';

const args = process.argv.slice(2);
const positional = [];
const expectations = {
  main: null,
  checkpoint: null,
  feature: null,
};

for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (arg === '--expect-main') {
    expectations.main = args[++index] ?? null;
    continue;
  }
  if (arg === '--expect-checkpoint') {
    expectations.checkpoint = args[++index] ?? null;
    continue;
  }
  if (arg === '--expect-feature') {
    expectations.feature = args[++index] ?? null;
    continue;
  }
  positional.push(arg);
}

const [mainRootArg, checkpointRootArg, featureRootArg] = positional;

if (!mainRootArg || !checkpointRootArg || !featureRootArg) {
  console.error(
    'Usage: node scripts/verify-core-parser-baselines.mjs <mainRoot> <checkpointRoot> <featureRoot> [--expect-main <sha>] [--expect-checkpoint <sha>] [--expect-feature <sha>]'
  );
  process.exit(1);
}

const repoRoots = {
  main: path.resolve(mainRootArg),
  checkpoint: path.resolve(checkpointRootArg),
  feature: path.resolve(featureRootArg),
};

const worktrees = await getWorktreeList(repoRoots.feature);
const repos = {};
const issues = [];

for (const [label, repoRoot] of Object.entries(repoRoots)) {
  const git = await getGitMetadata(repoRoot);
  const rawStatus = await getGitStatusSummary(repoRoot);
  const status = {
    dirty: false,
    entries: rawStatus.entries.filter((entry) => !isIgnoredStatusEntry(entry)),
  };
  status.dirty = status.entries.length > 0;
  const entrypoint = resolveBuiltDistEntrypoint(repoRoot);
  const expectedHead = expectations[label];
  const headMatchesExpected = expectedHead ? matchesExpectedHead(git.head, expectedHead) : null;

  repos[label] = {
    repoRoot,
    git,
    status,
    entrypoint,
    expectedHead,
    headMatchesExpected,
  };

  if (expectedHead && !headMatchesExpected) {
    issues.push(`${label} HEAD changed: expected ${expectedHead}, found ${git.head}`);
  }
}

if (repos.main.status.dirty) {
  issues.push('main worktree is dirty');
}
if (repos.checkpoint.status.dirty) {
  issues.push('checkpoint worktree is dirty');
}

const summary = {
  timestamp: new Date().toISOString(),
  repoRoots,
  worktrees,
  repos,
  issues,
  ok: issues.length === 0,
};

console.log(JSON.stringify(summary, null, 2));

if (issues.length > 0) {
  process.exit(1);
}

function matchesExpectedHead(actualHead, expectedHead) {
  return actualHead === expectedHead || actualHead.startsWith(expectedHead);
}

function isIgnoredStatusEntry(entry) {
  return entry.endsWith('.omx/') || entry.includes(' .omx/');
}
