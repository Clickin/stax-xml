#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const packageDir = join(repoRoot, 'packages/stax-xml');

const args = process.argv.slice(2);
const packMode = args.includes('--pack');
const versionArg = args.find((arg) => !arg.startsWith('--'));
const unknownArgs = args.filter((arg) => arg.startsWith('--') && arg !== '--pack');

if (unknownArgs.length > 0) {
  console.error(`Unknown option(s): ${unknownArgs.join(', ')}`);
  usage();
}

if (!versionArg || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(versionArg)) {
  usage();
}

const version = versionArg.slice(1);
const manifestDependencyFields = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
  'bundledDependencies',
  'bundleDependencies',
];
const forbiddenPackageNamePatterns = [
  /^@stax-xml\/native(?:-|$)/,
  /^@napi-rs\//,
  /node-gyp/,
  /node-pre-gyp/,
  /node-addon-api/,
  /bindings$/,
];
const forbiddenRuntimeContentPatterns = [
  /@stax-xml\/native(?:-|['"])/,
  /@napi-rs\//,
  /node-gyp/,
  /node-pre-gyp/,
  /node-addon-api/,
  /require\(["']bindings["']\)/,
  /["'][^"']+\.node["']/,
  /["'][^"']+\.wasm["']/,
];
const forbiddenPublishedPathPatterns = [
  /^src\//,
  /^test\//,
  /^performance\//,
  /^node_modules\//,
  /^packages\/native-/,
  /binding\.gyp$/,
  /\.node$/,
  /\.wasm$/,
];

function usage() {
  console.error([
    'Usage: node scripts/validate-prerelease.mjs v1.0.0-rc3 [--pack]',
    '',
    'Checks the pure-JS release contract:',
    '- root and public package versions match the release tag',
    '- stax-xml publishes only the JS facade package',
    '- runtime dependencies do not include native addon or Wasm parser packages',
    '- optional --pack validates the npm publish file list after build',
  ].join('\n'));
  process.exit(1);
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(repoRoot, relativePath), 'utf8'));
}

async function collectFiles(root, extensions, files = []) {
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(path, extensions, files);
    } else if (entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension))) {
      files.push(path);
    }
  }

  return files;
}

function dependencyEntries(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((name) => [name, '(bundled)']);
  }
  return Object.entries(value);
}

function checkDependencyField(errors, pkg, packagePath, field) {
  const entries = dependencyEntries(pkg[field]);
  if (field === 'optionalDependencies' && entries.length > 0) {
    errors.push(`${packagePath}: optionalDependencies must stay empty for the pure-JS package`);
  }

  for (const [name, specifier] of entries) {
    if (forbiddenPackageNamePatterns.some((pattern) => pattern.test(name))) {
      errors.push(`${packagePath}: ${field} contains forbidden runtime package ${name}@${specifier}`);
    }
  }
}

function checkExportTarget(errors, packagePath, target, trail) {
  if (typeof target === 'string') {
    if (!target.startsWith('./dist/')) {
      errors.push(`${packagePath}: export ${trail} points outside dist: ${target}`);
    }
    if (/\.(node|wasm)$/.test(target)) {
      errors.push(`${packagePath}: export ${trail} points at a binary parser artifact: ${target}`);
    }
    return;
  }

  if (!target || typeof target !== 'object') return;

  for (const [key, value] of Object.entries(target)) {
    checkExportTarget(errors, packagePath, value, `${trail}.${key}`);
  }
}

function checkPublicManifest(errors, pkg, packagePath) {
  if (!Array.isArray(pkg.files) || pkg.files.length !== 1 || pkg.files[0] !== 'dist') {
    errors.push(`${packagePath}: files must be exactly ["dist"]`);
  }

  for (const field of manifestDependencyFields) {
    checkDependencyField(errors, pkg, packagePath, field);
  }

  for (const [exportName, target] of Object.entries(pkg.exports ?? {})) {
    checkExportTarget(errors, packagePath, target, exportName);
  }
}

async function checkSourceForForbiddenRuntimeImports(errors) {
  const files = await collectFiles(join(packageDir, 'src'), ['.ts']);
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    for (const pattern of forbiddenRuntimeContentPatterns) {
      if (pattern.test(content)) {
        errors.push(`${repoRelative(file)}: contains forbidden native/Wasm runtime reference ${pattern}`);
      }
    }
  }
}

async function checkPackageLayout(errors) {
  const entries = await readdir(join(repoRoot, 'packages'), { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && /^native(?:-|$)/.test(entry.name)) {
      errors.push(`packages/${entry.name}: native platform packages must not be part of the pure-JS release workspace`);
    }
  }
}

async function checkPackedFiles(errors) {
  const npmCommand = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'npm';
  const npmArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm.cmd pack --dry-run --json']
    : ['pack', '--dry-run', '--json'];
  const { stdout } = await execFileAsync(npmCommand, npmArgs, {
    cwd: packageDir,
    maxBuffer: 1024 * 1024 * 16,
    windowsHide: true,
  });
  const packed = JSON.parse(stdout);
  const files = packed[0]?.files?.map((file) => file.path) ?? [];
  const fileSet = new Set(files);

  for (const required of ['package.json', 'README.md', 'dist/index.js', 'dist/index.d.ts']) {
    if (!fileSet.has(required)) {
      errors.push(`npm pack: missing required publish artifact ${required}`);
    }
  }

  for (const path of files) {
    const allowedTopLevel = path === 'package.json' || path === 'README.md' || path === 'LICENSE';
    if (!path.startsWith('dist/') && !allowedTopLevel) {
      errors.push(`npm pack: unexpected published file outside dist: ${path}`);
    }
    if (forbiddenPublishedPathPatterns.some((pattern) => pattern.test(path))) {
      errors.push(`npm pack: forbidden native/source artifact in publish file list: ${path}`);
    }
  }

  const runtimeFiles = files.filter((path) => /\.(js|mjs|cjs|d\.ts)$/.test(path));
  for (const path of runtimeFiles) {
    const content = await readFile(join(packageDir, path), 'utf8');
    for (const pattern of forbiddenRuntimeContentPatterns) {
      if (pattern.test(content)) {
        errors.push(`npm pack: ${path} contains forbidden native/Wasm runtime reference ${pattern}`);
      }
    }
  }
}

function repoRelative(path) {
  return relative(repoRoot, path).replaceAll('\\', '/');
}

const errors = [];
const rootPackage = await readJson('package.json');
const publicPackage = await readJson('packages/stax-xml/package.json');

for (const [packagePath, pkg] of [
  ['package.json', rootPackage],
  ['packages/stax-xml/package.json', publicPackage],
]) {
  if (pkg.version !== version) {
    errors.push(`${packagePath}: expected version ${version}, found ${pkg.version}`);
  }
}

checkPublicManifest(errors, publicPackage, 'packages/stax-xml/package.json');
await checkPackageLayout(errors);
await checkSourceForForbiddenRuntimeImports(errors);

if (packMode) {
  await checkPackedFiles(errors);
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const suffix = packMode ? ' including npm pack contents' : '';
console.log(`Pure-JS release package checks passed for ${versionArg}${suffix}.`);
