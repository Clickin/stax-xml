import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const packageDir = process.argv[2];
if (!packageDir) {
  throw new Error('Usage: node scripts/assert-pack-contents.mjs <package-dir>');
}

const resolvedPackageDir = resolve(packageDir);
const tmp = join(tmpdir(), `stax-pack-${process.pid}-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

try {
  const pack = spawnNpm(['pack', '--json', resolvedPackageDir, '--pack-destination', tmp]);
  if (pack.error) {
    throw pack.error;
  }
  if (pack.status !== 0) {
    throw new Error(pack.stderr || pack.stdout || `npm pack failed with exit code ${pack.status}`);
  }
  const result = JSON.parse(pack.stdout)[0];
  if (!result || !Array.isArray(result.files) || typeof result.filename !== 'string') {
    throw new Error('npm pack did not return the expected JSON file list.');
  }
  const entries = new Set(
    result.files.map((file) => `package/${file.path.replaceAll('\\', '/')}`)
  );
  const packageJson = JSON.parse(readFileSync(join(resolvedPackageDir, 'package.json'), 'utf8'));
  const missing = [];

  for (const file of packageJson.files ?? []) {
    const normalized = file.replaceAll('\\', '/');
    if (!entries.has(`package/${normalized}`)) {
      missing.push(normalized);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Packed tarball is missing files: ${missing.join(', ')}`);
  }

  console.log(`pack contents ok: ${join(tmp, result.filename)}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

function spawnNpm(args) {
  if (process.platform !== 'win32') {
    return spawnSync('npm', args, { encoding: 'utf8' });
  }
  const command = ['npm', ...args].map(quoteCmdArg).join(' ');
  return spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', command], {
    encoding: 'utf8'
  });
}

function quoteCmdArg(value) {
  if (value.includes('"')) {
    throw new Error(`Cannot pass npm argument containing a double quote: ${value}`);
  }
  return /[\s&()^|<>]/.test(value) ? `"${value}"` : value;
}
