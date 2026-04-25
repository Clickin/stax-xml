import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');
const cargoHome = process.env.CARGO_HOME || join(repoRoot, '.cargo');

mkdirSync(cargoHome, { recursive: true });

const cargoArgs = ['build', '--release'];
if (process.argv.includes('--offline')) {
  cargoArgs.push('--offline');
}
const target = readArgValue('--target');
if (target) {
  cargoArgs.push('--target', target);
}

const result = spawnSync('cargo', cargoArgs, {
  cwd: __dirname,
  stdio: 'inherit',
  env: {
    ...process.env,
    CARGO_HOME: cargoHome,
  },
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const source = nativeLibraryPath();
const output = join(__dirname, 'stax_xml_native_aggregate.node');
copyFileSync(source, output);
console.log(`native aggregate addon: ${output}`);

function nativeLibraryPath() {
  const targetDir = target
    ? join(__dirname, 'target', target, 'release')
    : join(__dirname, 'target', 'release');
  const candidates = process.platform === 'win32'
    ? ['stax_xml_native_aggregate.dll']
    : process.platform === 'darwin'
      ? ['libstax_xml_native_aggregate.dylib']
      : ['libstax_xml_native_aggregate.so'];

  for (const candidate of candidates) {
    const path = join(targetDir, candidate);
    if (existsSync(path)) return path;
  }
  throw new Error(`Could not find native library in ${targetDir}.`);
}

function readArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}
