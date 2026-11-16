#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_PACKAGE_JSON = 'packages/stax-xml/package.json';
const SEMVER_RELEASE_RE = /^(\d+)\.(\d+)\.(\d+)$/;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

function git(args, allowFailure = false) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trimEnd();
  } catch (error) {
    if (allowFailure) return null;
    throw error;
  }
}

function readPackageVersionFromRef(spec) {
  const raw = git(['show', spec], true);
  if (!raw) return null;
  try {
    return JSON.parse(raw).version ?? null;
  } catch {
    return null;
  }
}

function minorSnapshotExists(major, minor) {
  const docsDir = join(repoRoot, 'packages/docs/src/content/docs');
  return (
    existsSync(join(docsDir, `v${major}.${minor}`)) ||
    existsSync(join(docsDir, `v${major}.${minor}.0`))
  );
}

export function resolveMinorSnapshotTarget({ prevVersion, nextVersion, hasSnapshot }) {
  if (!nextVersion || nextVersion === prevVersion) return null;

  const match = nextVersion.match(SEMVER_RELEASE_RE);
  if (!match) return null;

  const [, major, minor, patch] = match;
  if (patch !== '0') return null;

  const minorTag = `v${major}.${minor}`;
  if (hasSnapshot(major, minor)) return null;

  return minorTag;
}

function main() {
  if (process.env.SKIP_DOCS_SNAPSHOT === '1') {
    return;
  }

  const stagedFilesOutput = git([
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=ACMR',
  ]);
  const stagedFiles = stagedFilesOutput
    ? stagedFilesOutput.split(/\r?\n/).filter(Boolean)
    : [];

  if (!stagedFiles.includes(PUBLIC_PACKAGE_JSON)) {
    return;
  }

  const nextVersion = readPackageVersionFromRef(`:${PUBLIC_PACKAGE_JSON}`);
  const prevVersion = readPackageVersionFromRef(`HEAD:${PUBLIC_PACKAGE_JSON}`);
  const minorTag = resolveMinorSnapshotTarget({
    prevVersion,
    nextVersion,
    hasSnapshot: minorSnapshotExists,
  });

  if (!minorTag) {
    return;
  }

  const snapshotScript = join(
    repoRoot,
    'packages/docs/scripts/snapshot-release-docs.mjs',
  );

  execFileSync(process.execPath, [snapshotScript, minorTag], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  const pathsToStage = [
    `packages/docs/src/content/docs/${minorTag}`,
    `packages/docs/src/content/docs/ko/${minorTag}`,
    `packages/docs/src/content/versions/${minorTag}.json`,
    `packages/docs/src/data/benchmarks/${minorTag}`,
  ].filter((relativePath) => existsSync(join(repoRoot, relativePath)));

  if (pathsToStage.length > 0) {
    execFileSync('git', ['add', ...pathsToStage], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
  }

  console.log(
    `[pre-commit] Generated and staged minor docs snapshot ${minorTag} for stax-xml@${nextVersion}.`,
  );
}

const isEntrypoint =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  main();
}
