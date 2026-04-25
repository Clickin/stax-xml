import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = resolve(__dirname, '..', '..', 'native-wasm32-wasi');

const generatedWasm = join(packageDir, 'stax_xml_native.wasm');
const releaseWasm = join(packageDir, 'stax_xml_native.wasm32-wasi.wasm');
const generatedDebugWasm = join(packageDir, 'stax_xml_native.debug.wasm');
const releaseDebugWasm = join(packageDir, 'stax_xml_native.wasm32-wasi.debug.wasm');
const generatedBrowserReExport = join(packageDir, 'browser.js');

if (!existsSync(generatedWasm)) {
  throw new Error(`Expected generated wasm output: ${generatedWasm}`);
}

copyFileSync(generatedWasm, releaseWasm);
rmSync(generatedWasm);

if (existsSync(generatedDebugWasm)) {
  rmSync(generatedDebugWasm);
}

rmSync(releaseDebugWasm, { force: true });
rmSync(generatedBrowserReExport, { force: true });

const requiredFiles = [
  'index.mjs',
  'index.d.ts',
  'stax_xml_native.wasi.cjs',
  'stax_xml_native.wasi-browser.js',
  'stax_xml_native.wasm32-wasi.wasm',
  'wasi-worker.mjs',
  'wasi-worker-browser.mjs',
  'package.json',
  'README.md',
  'LICENSE',
];

for (const file of requiredFiles) {
  const path = join(packageDir, file);
  if (!existsSync(path)) {
    throw new Error(`Missing wasm package file: ${path}`);
  }
}

const magic = readFileSync(releaseWasm).subarray(0, 4);
if (magic[0] !== 0x00 || magic[1] !== 0x61 || magic[2] !== 0x73 || magic[3] !== 0x6d) {
  throw new Error(`${releaseWasm} is not a WebAssembly binary.`);
}

console.log(`wasm package staged: ${releaseWasm}`);
