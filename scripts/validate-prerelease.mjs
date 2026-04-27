#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const repoRoot = new URL('..', import.meta.url);
const versionArg = process.argv[2];

if (!versionArg || !/^v\d+\.\d+\.\d+-[0-9A-Za-z.-]+$/.test(versionArg)) {
  console.error('Usage: node scripts/validate-prerelease.mjs v1.0.0-rc2');
  process.exit(1);
}

const version = versionArg.slice(1);
const publicPackagePaths = [
  'package.json',
  'packages/stax-xml/package.json',
  'packages/native-darwin-arm64/package.json',
  'packages/native-darwin-x64/package.json',
  'packages/native-linux-arm64-gnu/package.json',
  'packages/native-linux-arm64-musl/package.json',
  'packages/native-linux-x64-gnu/package.json',
  'packages/native-linux-x64-musl/package.json',
  'packages/native-wasm32-wasi/package.json',
  'packages/native-win32-arm64-msvc/package.json',
  'packages/native-win32-x64-msvc/package.json',
];

const optionalNativeDependencies = [
  '@stax-xml/native-darwin-arm64',
  '@stax-xml/native-darwin-x64',
  '@stax-xml/native-linux-arm64-gnu',
  '@stax-xml/native-linux-arm64-musl',
  '@stax-xml/native-linux-x64-gnu',
  '@stax-xml/native-linux-x64-musl',
  '@stax-xml/native-wasm32-wasi',
  '@stax-xml/native-win32-arm64-msvc',
  '@stax-xml/native-win32-x64-msvc',
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(repoRoot.pathname, relativePath), 'utf8'));
}

const errors = [];

for (const packagePath of publicPackagePaths) {
  const pkg = await readJson(packagePath);
  if (pkg.version !== version) {
    errors.push(`${packagePath}: expected version ${version}, found ${pkg.version}`);
  }
}

const facade = await readJson('packages/stax-xml/package.json');
for (const dependencyName of optionalNativeDependencies) {
  const actual = facade.optionalDependencies?.[dependencyName];
  if (actual !== version) {
    errors.push(`packages/stax-xml/package.json: expected optional dependency ${dependencyName}@${version}, found ${actual}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Prerelease package versions are consistent for ${versionArg}.`);
