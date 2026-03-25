import path from 'node:path';
import process from 'node:process';
import {
  ensureDir,
  getWorktreeList,
  getGitMetadata,
  getOutputRoot,
  listCpuProfiles,
  resolveBuiltDistEntrypoint,
  runLoggedCommand,
  usage,
  writeJson,
} from './compare-runner-lib.mjs';

const separatorIndex = process.argv.indexOf('--');
const headArgs = separatorIndex === -1 ? process.argv.slice(2) : process.argv.slice(2, separatorIndex);
const tailArgs = separatorIndex === -1 ? [] : process.argv.slice(separatorIndex + 1);

const [repoRootArg, label, suite, comparisonBaseline, profileName, entryScriptArg] = headArgs;

if (!repoRootArg || !label || !suite || !comparisonBaseline || !profileName || !entryScriptArg) {
  usage(
    'Usage: node scripts/run-node-cpu-prof.mjs <repoRoot> <label> <suite> <comparisonBaseline> <profileName> <entryScript> [-- <args...>]'
  );
  process.exit(1);
}

const repoRoot = path.resolve(repoRootArg);
const entryScript = path.isAbsolute(entryScriptArg)
  ? entryScriptArg
  : path.join(repoRoot, entryScriptArg);
const outputDir = await ensureDir(path.join(getOutputRoot(label), 'profiles', profileName));
const logPath = path.join(outputDir, `${profileName}.log`);
const git = await getGitMetadata(repoRoot);
const worktrees = await getWorktreeList(repoRoot);
const distEntrypoint = resolveBuiltDistEntrypoint(repoRoot);

const result = await runLoggedCommand({
  command: 'node',
  args: ['--cpu-prof', '--cpu-prof-dir', outputDir, entryScript, ...tailArgs],
  cwd: repoRoot,
  logPath,
});

const profiles = await listCpuProfiles(outputDir);
const summaryPath = path.join(outputDir, `${profileName}.json`);
await writeJson(summaryPath, {
  label,
  suite,
  comparisonBaseline,
  profileName,
  repoRoot,
  entrypoint: entryScript,
  distEntrypoint,
  args: tailArgs,
  git,
  timestamp: new Date().toISOString(),
  worktrees,
  result,
  profiles,
});

if (result.exitCode !== 0) {
  process.exit(1);
}
