import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { x } from 'stax-xml/converter';
import { detectRuntimePlatform, getStaxXmlNativePackageName } from 'stax-xml/runtime';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');
const encoder = new TextEncoder();
const args = new Set(process.argv.slice(2));
const quick = args.has('--quick');
const sizesMiB = readListArg('--sizes-mib', quick ? '16' : '16,128').map(Number);
const fixtures = readListArg('--fixtures', 'attribute-heavy,mixed-utf8');

if (process.env.STAX_XML_PLATFORM_CONVERTER_CHILD !== '1') {
  const staged = stageLocalNativePlatformPackage();
  const child = spawnSync(process.execPath, [
    ...process.execArgv,
    fileURLToPath(import.meta.url),
    ...process.argv.slice(2),
  ], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      STAX_XML_PLATFORM_CONVERTER_CHILD: '1',
    },
  });
  staged.cleanup();
  process.exit(child.status ?? 1);
}

const itemSchema = x.array(
  x.object({
    id: x.number().xpath('./@id').int(),
    name: x.string().xpath('./name'),
    value: x.string().xpath('./value'),
  }),
  '//item',
).compile();

const entrySchema = x.array(
  x.object({
    code: x.string().xpath('./@code'),
    label: x.string().xpath('./label'),
    score: x.number().xpath('./score').int(),
  }),
  '//entry',
).compile();

for (const sizeMiB of sizesMiB) {
  for (const fixture of fixtures) {
    await runScenario('hardcoded-item', fixture, sizeMiB, itemSchema, createItemFixtureXml(fixture, sizeMiB), checksumItemRows);
    await runScenario('generic-entry', fixture, sizeMiB, entrySchema, createEntryFixtureXml(fixture, sizeMiB), checksumEntryRows);
  }
}

async function runScenario(schemaName, fixture, sizeMiB, schema, xml, checksumRows) {
  const bytes = encoder.encode(xml);
  const parseOptions = { maxEvents: 20_000_000 };
  const js = await measure('js-string', () => schema.parse(xml, {
    ...parseOptions,
    acceleration: { backend: 'js' },
  }), checksumRows);
  const native = await measure('native-platform-converter', () => schema.parse(bytes, {
    ...parseOptions,
    acceleration: { backend: 'native', simd: 'auto-safe' },
  }), checksumRows);

  console.log(JSON.stringify({
    schema: schemaName,
    fixture,
    sizeMiB,
    bytes: bytes.byteLength,
    jsMs: round(js.ms),
    nativePlatformConverterMs: round(native.ms),
    nativePlatformConverterSpeedup: round(js.ms / native.ms),
    jsChecksum: js.checksum,
    nativePlatformChecksum: native.checksum,
    parity: js.checksum === native.checksum,
  }));
}

function createItemFixtureXml(fixture, sizeMiB) {
  const targetBytes = sizeMiB * 1024 * 1024;
  const parts = ['<root>'];
  let length = parts[0].length;
  let index = 0;
  while (length < targetBytes) {
    const label = fixture === 'mixed-utf8' ? `이름-${index}` : `name-${index}`;
    const value = fixture === 'attribute-heavy'
      ? `value-${index}-${index % 17}`
      : `본문-${index}-cafe`;
    const row = `<item id="${index}" a="${index % 3}" b="${index % 5}" c="${index % 7}"><name>${label}</name><value>${value}</value></item>`;
    parts.push(row);
    length += row.length;
    index++;
  }
  parts.push('</root>');
  return parts.join('');
}

function createEntryFixtureXml(fixture, sizeMiB) {
  const targetBytes = sizeMiB * 1024 * 1024;
  const parts = ['<root>'];
  let length = parts[0].length;
  let index = 0;
  while (length < targetBytes) {
    const label = fixture === 'mixed-utf8' ? `라벨-${index}` : `label-${index}`;
    const score = String(index % 100_000);
    const row = `<entry code="code-${index}" a="${index % 3}" b="${index % 5}"><label>${label}</label><score>${score}</score></entry>`;
    parts.push(row);
    length += row.length;
    index++;
  }
  parts.push('</root>');
  return parts.join('');
}

async function measure(name, run, checksumRows) {
  const start = performance.now();
  const result = await run();
  const ms = performance.now() - start;
  return { name, ms, checksum: checksumRows(result) };
}

function checksumItemRows(rows) {
  let value = rows.length;
  for (const row of rows) {
    value = mix(value, row.id);
    value = fold(value, row.name);
    value = fold(value, row.value);
  }
  return value | 0;
}

function checksumEntryRows(rows) {
  let value = rows.length;
  for (const row of rows) {
    value = fold(value, row.code);
    value = fold(value, row.label);
    value = mix(value, row.score);
  }
  return value | 0;
}

function fold(seed, text) {
  let value = seed;
  for (let index = 0; index < text.length; index++) {
    value = mix(value, text.charCodeAt(index));
  }
  return value;
}

function mix(seed, value) {
  return ((seed ^ value) * 16777619) | 0;
}

function stageLocalNativePlatformPackage() {
  const packageName = getStaxXmlNativePackageName(detectRuntimePlatform());
  if (!packageName) {
    throw new Error('No native platform package is available for this runtime.');
  }

  const packageDir = resolve(repoRoot, 'packages', packageName.split('/').at(-1));
  const source = resolve(repoRoot, 'packages/native-aggregate/stax_xml_native_aggregate.node');
  const target = resolve(packageDir, 'stax_xml_native.node');
  if (!existsSync(source)) {
    throw new Error('Native aggregate addon is missing. Run pnpm --filter benchmark run build:native-aggregate first.');
  }
  if (existsSync(target)) {
    throw new Error(`Refusing to overwrite existing platform addon: ${target}`);
  }

  copyFileSync(source, target);
  return {
    cleanup() {
      rmSyncWithRetry(target);
    },
  };
}

function rmSyncWithRetry(path) {
  let lastError;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      rmSync(path, { force: true });
      return;
    } catch (error) {
      lastError = error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  throw lastError;
}

function readListArg(name, fallback) {
  const prefix = `${name}=`;
  const value = process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
  return value.split(',').map(part => part.trim()).filter(Boolean);
}

function round(value) {
  return Math.round(value * 100) / 100;
}
