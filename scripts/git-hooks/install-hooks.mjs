#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.CI) {
  process.exit(0);
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
if (!existsSync(join(repoRoot, '.git'))) {
  process.exit(0);
}

try {
  const currentHooksPath = execFileSync(
    'git',
    ['config', '--local', '--get', 'core.hooksPath'],
    { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  ).trim();

  if (currentHooksPath === '.githooks') {
    process.exit(0);
  }
} catch {
  // core.hooksPath is not set locally yet.
}

execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], {
  cwd: repoRoot,
  stdio: 'inherit',
});
console.log('Configured git core.hooksPath=.githooks');
