import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..', '..');

const [packageDirName = detectPackageDirName()] = process.argv.slice(2).filter(arg => arg !== '--');
const source = join(repoRoot, 'packages', 'native-aggregate', 'stax_xml_native_aggregate.node');
const packageDir = join(repoRoot, 'packages', packageDirName);
const target = join(packageDir, 'stax_xml_native.node');

if (!existsSync(source)) {
  throw new Error(`Missing native addon output: ${source}. Run pnpm --dir packages/native-aggregate run build:native first.`);
}
if (!existsSync(packageDir)) {
  throw new Error(`Unsupported native platform package: ${packageDirName}`);
}

copyFileSync(source, target);
console.log(`staged ${target}`);

function detectPackageDirName() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'darwin' && arch === 'arm64') return 'native-darwin-arm64';
  if (platform === 'darwin' && arch === 'x64') return 'native-darwin-x64';
  if (platform === 'win32' && arch === 'arm64') return 'native-win32-arm64-msvc';
  if (platform === 'win32' && arch === 'x64') return 'native-win32-x64-msvc';
  if (platform === 'linux' && arch === 'arm64') return `native-linux-arm64-${detectLinuxLibc()}`;
  if (platform === 'linux' && arch === 'x64') return `native-linux-x64-${detectLinuxLibc()}`;
  throw new Error(`Unsupported native platform: ${platform}/${arch}`);
}

function detectLinuxLibc() {
  const report = process.report?.getReport?.();
  return typeof report?.header?.glibcVersionRuntime === 'string' ? 'gnu' : 'musl';
}
