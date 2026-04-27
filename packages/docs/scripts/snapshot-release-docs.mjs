#!/usr/bin/env node

import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../../..');
const benchmarkReleaseDir = join(repoRoot, 'packages/benchmark/results/release');
const benchmarkSnapshotRoot = join(repoRoot, 'packages/docs/src/data/benchmarks');
const docsContentDir = join(repoRoot, 'packages/docs/src/content/docs');
const docsVersionsDir = join(repoRoot, 'packages/docs/src/content/versions');
const localeDirs = new Set(['ko']);
const importPathRegex = /(from ?["'])([^"']*)(["'];?\s?)$/gm;
const versionSlugRegex = /^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

const benchmarkFiles = [
  'latest-summary.json',
  'runtime-matrix.json',
  'cross-runtime-comparison.json',
  'simdxml-upstream-comparison.json',
];

function usage() {
  console.error([
    'Usage:',
    '  pnpm --filter=stax-xml-docs snapshot:release v1.0.0',
    '',
    'Options:',
    '  --dry-run  Validate source artifacts and print the planned snapshot without writing files.',
    '  --force    Replace an existing docs benchmark snapshot for the version.',
  ].join('\n'));
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const positional = args.filter((arg) => arg !== '--dry-run' && arg !== '--force');

  if (positional.length !== 1) usage();

  const version = positional[0];
  if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    console.error(`Invalid version "${version}". Expected a tag-like semver such as v1.0.0.`);
    process.exit(1);
  }

  return { version, dryRun, force };
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function currentGitCommit() {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA;
  }

  try {
    const gitDir = resolveGitDir(join(repoRoot, '.git'));
    const head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim();

    if (!head.startsWith('ref: ')) {
      return /^[0-9a-f]{40}$/i.test(head) ? head : null;
    }

    const ref = head.slice('ref: '.length);
    const looseRefPath = join(gitDir, ref);
    if (existsSync(looseRefPath)) {
      return readFileSync(looseRefPath, 'utf8').trim();
    }

    const packedRefsPath = join(gitDir, 'packed-refs');
    if (!existsSync(packedRefsPath)) return null;

    for (const line of readFileSync(packedRefsPath, 'utf8').split(/\r?\n/)) {
      if (line.startsWith('#') || line.startsWith('^') || line.trim() === '') continue;
      const [commit, packedRef] = line.split(' ');
      if (packedRef === ref && /^[0-9a-f]{40}$/i.test(commit)) {
        return commit;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function resolveGitDir(gitPath) {
  if (statSync(gitPath).isDirectory()) return gitPath;

  const gitFile = readFileSync(gitPath, 'utf8').trim();
  const prefix = 'gitdir: ';
  if (!gitFile.startsWith(prefix)) {
    throw new Error(`Unsupported .git file format: ${gitPath}`);
  }

  return resolve(repoRoot, gitFile.slice(prefix.length));
}

function repoRelativePath(filePath) {
  return relative(repoRoot, filePath).replaceAll('\\', '/');
}

function versionedContentTargets(version) {
  return [
    join(docsContentDir, version),
    ...Array.from(localeDirs, (locale) => join(docsContentDir, locale, version)),
  ];
}

async function archiveDocsContent(version, dryRun) {
  const copiedFiles = [];
  const entries = await readdir(docsContentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === version || versionSlugRegex.test(entry.name)) continue;

    const source = join(docsContentDir, entry.name);
    if (entry.isDirectory() && localeDirs.has(entry.name)) {
      await copyDocsDirectory(source, join(source, version), version, dryRun, copiedFiles);
      continue;
    }

    await copyDocsEntry(source, join(docsContentDir, version, entry.name), version, dryRun, copiedFiles);
  }

  if (!dryRun) {
    await mkdir(docsVersionsDir, { recursive: true });
    await writeFile(join(docsVersionsDir, `${version}.json`), '{}\n', 'utf8');
  }

  return copiedFiles;
}

async function copyDocsDirectory(sourceDir, destinationDir, version, dryRun, copiedFiles) {
  if (!dryRun) {
    await mkdir(destinationDir, { recursive: true });
  }

  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === version || versionSlugRegex.test(entry.name)) continue;
    await copyDocsEntry(join(sourceDir, entry.name), join(destinationDir, entry.name), version, dryRun, copiedFiles);
  }
}

async function copyDocsEntry(source, destination, version, dryRun, copiedFiles) {
  const sourceStat = await stat(source);

  if (sourceStat.isDirectory()) {
    await copyDocsDirectory(source, destination, version, dryRun, copiedFiles);
    return;
  }

  if (!sourceStat.isFile()) return;

  const content = await readFile(source, 'utf8');
  const archived = content.replaceAll(importPathRegex, (match, start, importPath, end) => {
    return importPath.startsWith('../') ? `${start}../${importPath}${end}` : match;
  });
  const archivedWithSlug = addArchivedSlug(archived, destination);

  if (!dryRun) {
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, archivedWithSlug, 'utf8');
  }

  copiedFiles.push({
    source: repoRelativePath(source),
    destination: repoRelativePath(destination),
  });
}

function addArchivedSlug(content, destination) {
  const slug = contentSlugForDestination(destination);
  if (/^---\r?\n/.test(content)) {
    return content.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/, (_match, frontmatter) => {
      const withoutExistingSlug = frontmatter
        .split(/\r?\n/)
        .filter((line) => !line.match(/^slug:\s*/))
        .join('\n');
      return `---\n${withoutExistingSlug}\nslug: ${slug}\n---\n`;
    });
  }

  return `---\nslug: ${slug}\n---\n\n${content}`;
}

function contentSlugForDestination(destination) {
  let slug = relative(docsContentDir, destination)
    .replaceAll('\\', '/')
    .replace(/\.(md|mdx)$/, '');

  if (slug.endsWith('/index')) {
    slug = slug.slice(0, -'/index'.length);
  }

  return slug;
}

async function main() {
  const { version, dryRun, force } = parseArgs();
  const destinationDir = join(benchmarkSnapshotRoot, version);

  if (force && !dryRun) {
    await rm(destinationDir, { recursive: true, force: true });
    await rm(join(docsVersionsDir, `${version}.json`), { force: true });
    for (const target of versionedContentTargets(version)) {
      await rm(target, { recursive: true, force: true });
    }
  }

  if (!dryRun) {
    await mkdir(benchmarkSnapshotRoot, { recursive: true });
    await mkdir(destinationDir, { recursive: false });
  }

  const files = [];

  for (const fileName of benchmarkFiles) {
    const source = join(benchmarkReleaseDir, fileName);
    const destination = join(destinationDir, fileName);

    const parsed = await readJson(source);
    if (!dryRun) {
      await writeFile(destination, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    }

    files.push({
      source: repoRelativePath(source),
      destination: repoRelativePath(destination),
    });
  }

  const manifest = {
    version,
    createdAt: new Date().toISOString(),
    gitCommit: currentGitCommit(),
    sourceDir: repoRelativePath(benchmarkReleaseDir),
    files,
  };

  const docsFiles = await archiveDocsContent(version, dryRun);

  if (!dryRun) {
    await writeFile(
      join(destinationDir, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
  }

  const action = dryRun ? 'Validated benchmark docs snapshot' : 'Created benchmark docs snapshot';
  console.log(`${action}: ${repoRelativePath(destinationDir)}`);
  for (const file of files) {
    console.log(`- ${file.destination}`);
  }
  const docsAction = dryRun ? 'Validated docs content archive' : 'Created docs content archive';
  console.log(`${docsAction}: ${version} (${docsFiles.length} files)`);
}

main().catch((error) => {
  if (error?.code === 'EEXIST') {
    console.error('Snapshot already exists. Re-run with --force to replace it.');
  } else if (error?.code === 'ENOENT') {
    console.error(`Missing release benchmark artifact: ${error.path}`);
  } else if (error instanceof SyntaxError) {
    console.error(`Invalid JSON in release benchmark artifact: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exit(1);
});
