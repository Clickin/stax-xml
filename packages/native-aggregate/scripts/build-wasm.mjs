import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = resolve(__dirname, '..');
const enableSimd128 = process.argv.includes('--simd128');

const args = [
  'build',
  '--release',
  '--target',
  'wasm32-wasip1-threads',
  '--package-json-path',
  '../native-wasm32-wasi/package.json',
  '--output-dir',
  '../native-wasm32-wasi',
];

const existingRustFlags = process.env.RUSTFLAGS?.trim() ?? '';
const rustFlags = enableSimd128
  ? [existingRustFlags, '-C target-feature=+simd128'].filter(Boolean).join(' ')
  : existingRustFlags;

console.log(`[build-wasm] simd128=${enableSimd128 ? 'on' : 'off'}`);
if (rustFlags) {
  console.log(`[build-wasm] RUSTFLAGS=${rustFlags}`);
}

const napiBinary = resolveNapiBinary();
const build = spawnSync(napiBinary.command, napiBinary.args.concat(args), {
  cwd: packageDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    ...(rustFlags ? { RUSTFLAGS: rustFlags } : {}),
  },
});

if (build.error) {
  throw build.error;
}

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const stage = spawnSync('node', ['./scripts/stage-wasm-package.mjs'], {
  cwd: packageDir,
  stdio: 'inherit',
  env: process.env,
});

if (stage.status !== 0) {
  process.exit(stage.status ?? 1);
}

function resolveNapiBinary() {
  const cliEntry = join(
    packageDir,
    'node_modules',
    '@napi-rs',
    'cli',
    'dist',
    'cli.js',
  );
  if (existsSync(cliEntry)) {
    return { command: process.execPath, args: [cliEntry] };
  }
  const localBinary = join(
    packageDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'napi.CMD' : 'napi',
  );
  if (existsSync(localBinary)) {
    return process.platform === 'win32'
      ? { command: process.env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', `"${localBinary}"`] }
      : { command: localBinary, args: [] };
  }
  return process.platform === 'win32'
    ? { command: process.env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', 'napi'] }
    : { command: 'napi', args: [] };
}
