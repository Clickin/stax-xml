import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { x } from 'stax-xml/converter';
import { StaxXmlIterableParser, toByteBatches } from 'stax-xml/iterable';
import { detectRuntimePlatform, getStaxXmlNativePackageName } from 'stax-xml/runtime';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const args = new Set(process.argv.slice(2));
const quick = args.has('--quick');
const breakdown = args.has('--breakdown');
const inputKind = args.has('--buffer') ? 'buffer' : 'uint8array';
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
const entryProjectionSpec = {
  itemName: 'entry',
  fields: [
    { outputName: 'code', valueKind: 'string', sourceKind: 'attribute', sourceName: 'code', textMode: 'direct' },
    { outputName: 'label', valueKind: 'string', sourceKind: 'element', sourceName: 'label', textMode: 'subtree' },
    { outputName: 'score', valueKind: 'number', sourceKind: 'element', sourceName: 'score', textMode: 'subtree' },
  ],
};
const entryCodeOnlyProjectionSpec = {
  itemName: 'entry',
  fields: [
    { outputName: 'code', valueKind: 'string', sourceKind: 'attribute', sourceName: 'code', textMode: 'direct' },
  ],
};
const entryCodeLabelProjectionSpec = {
  itemName: 'entry',
  fields: [
    { outputName: 'code', valueKind: 'string', sourceKind: 'attribute', sourceName: 'code', textMode: 'direct' },
    { outputName: 'label', valueKind: 'string', sourceKind: 'element', sourceName: 'label', textMode: 'subtree' },
  ],
};
const entryScoreOnlyProjectionSpec = {
  itemName: 'entry',
  fields: [
    { outputName: 'score', valueKind: 'number', sourceKind: 'element', sourceName: 'score', textMode: 'subtree' },
  ],
};
const entryHydrators = [
  { fieldName: 'code', missingValue: '', parseValue: rawValue => rawValue },
  { fieldName: 'label', missingValue: '', parseValue: rawValue => rawValue },
  { fieldName: 'score', missingValue: Number.NaN, parseValue: rawValue => parseIntegerValue(rawValue) },
];
const hydrateEntryStable = createStableEntryHydrator(entryHydrators);
const platformModule = await importStagedPlatformModule();
const projectObjectRows = platformModule.parseObjectRowsUint8Array
  ?? platformModule.parseObjectRowsViaTableUint8Array;

for (const sizeMiB of sizesMiB) {
  for (const fixture of fixtures) {
    await runScenario('hardcoded-item', fixture, sizeMiB, itemSchema, createItemFixtureXml(fixture, sizeMiB), checksumItemRows);
    const entryXml = createEntryFixtureXml(fixture, sizeMiB);
    await runScenario('generic-entry', fixture, sizeMiB, entrySchema, entryXml, checksumEntryRows);
    if (breakdown) {
      await runGenericBreakdown(fixture, sizeMiB, entryXml);
    }
  }
}

async function runScenario(schemaName, fixture, sizeMiB, schema, xml, checksumRows) {
  const bytes = encodeXml(xml);
  const parseOptions = { maxEvents: 20_000_000 };
  const js = await measure('js-string', () => schema.parse(xml, {
    ...parseOptions,
    acceleration: { backend: 'js' },
  }), checksumRows);
  const native = await measure('native-platform-converter', () => schema.parse(bytes, {
    ...parseOptions,
    acceleration: { backend: 'native', simd: 'auto-safe' },
  }), checksumRows);
  const publicIterable = await measureIterable('public-iterable-parser', bytes);

  console.log(JSON.stringify({
    schema: schemaName,
    inputKind,
    fixture,
    sizeMiB,
    bytes: bytes.byteLength,
    jsMs: round(js.ms),
    nativePlatformConverterMs: round(native.ms),
    publicIterableMs: round(publicIterable.ms),
    nativePlatformConverterSpeedup: round(js.ms / native.ms),
    nativePlatformConverterVsPublicIterable: round(publicIterable.ms / native.ms),
    jsChecksum: js.checksum,
    nativePlatformChecksum: native.checksum,
    publicIterableEvents: publicIterable.eventCount,
    publicIterableChecksum: publicIterable.checksum,
    parity: js.checksum === native.checksum,
    nativeDirectRowsAreDiagnostic: false,
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

async function runGenericBreakdown(fixture, sizeMiB, xml) {
  const bytes = encodeXml(xml);
  const source = createUtf8SpanSource(bytes);
  const publicIterable = await measureIterable('public-iterable-parser', bytes);
  const nativeProjection = await measureNativeProjection(() => (
    projectObjectRows(bytes, entryProjectionSpec)
  ));
  const tableProjection = platformModule.parseObjectRowsUint8Array
    ? await measureNativeProjection(() => (
      platformModule.parseObjectRowsViaTableUint8Array(bytes, entryProjectionSpec)
    ))
    : undefined;
  const codeOnlyProjection = await measureNativeProjection(() => (
    projectObjectRows(bytes, entryCodeOnlyProjectionSpec)
  ));
  const codeLabelProjection = await measureNativeProjection(() => (
    projectObjectRows(bytes, entryCodeLabelProjectionSpec)
  ));
  const scoreOnlyProjection = await measureNativeProjection(() => (
    projectObjectRows(bytes, entryScoreOnlyProjectionSpec)
  ));
  const dynamicHydration = await measure('dynamic-hydration-only', () => (
    hydrateEntryDynamic(nativeProjection.result, source)
  ), checksumEntryRows);
  const stableHydration = await measure('stable-hydration-only', () => (
    hydrateEntryStable(nativeProjection.result, source)
  ), checksumEntryRows);

  console.log(JSON.stringify({
    schema: 'generic-entry-breakdown',
    inputKind,
    fixture,
    sizeMiB,
    bytes: bytes.byteLength,
    publicIterableMs: round(publicIterable.ms),
    nativeProjectionMs: round(nativeProjection.ms),
    nativeProjectionViaTableMs: tableProjection ? round(tableProjection.ms) : undefined,
    nativeProjectionCodeOnlyMs: round(codeOnlyProjection.ms),
    nativeProjectionCodeLabelMs: round(codeLabelProjection.ms),
    nativeProjectionScoreOnlyMs: round(scoreOnlyProjection.ms),
    dynamicHydrationMs: round(dynamicHydration.ms),
    stableHydrationMs: round(stableHydration.ms),
    hydrationSpeedup: round(dynamicHydration.ms / stableHydration.ms),
    nativeProjectionVsPublicIterable: round(publicIterable.ms / nativeProjection.ms),
    nativeProjectionChecksum: checksumEntryColumns(nativeProjection.result.columns, nativeProjection.result.rowCount, source),
    publicIterableEvents: publicIterable.eventCount,
    publicIterableChecksum: publicIterable.checksum,
    dynamicHydrationChecksum: dynamicHydration.checksum,
    stableHydrationChecksum: stableHydration.checksum,
    parity: dynamicHydration.checksum === stableHydration.checksum
      && dynamicHydration.checksum === checksumEntryColumns(nativeProjection.result.columns, nativeProjection.result.rowCount, source),
    nativeDirectBreakdownIsDiagnostic: true,
  }));
}

async function measure(name, run, checksumRows) {
  const start = performance.now();
  const result = await run();
  const ms = performance.now() - start;
  return { name, ms, checksum: checksumRows(result) };
}

async function measureIterable(name, bytes) {
  const start = performance.now();
  const result = consumePublicIterable(bytes);
  const ms = performance.now() - start;
  return { name, ms, ...result };
}

async function measureNativeProjection(run) {
  if (globalThis.gc) globalThis.gc();
  const start = performance.now();
  const result = await run();
  const ms = performance.now() - start;
  return { ms, result };
}

function hydrateEntryDynamic(result, source) {
  const columns = result.columns;
  const rowCount = result.rowCount ?? result.row_count;
  const rows = new Array(rowCount);
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const output = {};
    for (let fieldIndex = 0; fieldIndex < entryHydrators.length; fieldIndex++) {
      const hydrator = entryHydrators[fieldIndex];
      const column = columns[fieldIndex];
      output[hydrator.fieldName] = column.present[rowIndex]
        ? hydrator.parseValue(cellValue(source, column, rowIndex))
        : hydrator.missingValue;
    }
    rows[rowIndex] = output;
  }
  return rows;
}

function createStableEntryHydrator(hydrators) {
  const [code, label, score] = hydrators;
  return function hydrateEntryStableRows(result, source) {
    const columns = result.columns;
    const rowCount = result.rowCount ?? result.row_count;
    const codeColumn = columns[0];
    const labelColumn = columns[1];
    const scoreColumn = columns[2];
    const rows = new Array(rowCount);
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const codeValue = codeColumn.present[rowIndex]
        ? code.parseValue(cellValue(source, codeColumn, rowIndex))
        : code.missingValue;
      const labelValue = labelColumn.present[rowIndex]
        ? label.parseValue(cellValue(source, labelColumn, rowIndex))
        : label.missingValue;
      const scoreValue = scoreColumn.present[rowIndex]
        ? score.parseValue(cellValue(source, scoreColumn, rowIndex))
        : score.missingValue;
      rows[rowIndex] = { code: codeValue, label: labelValue, score: scoreValue };
    }
    return rows;
  };
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

function checksumEntryColumns(columns, rowCount, source) {
  let value = rowCount;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    value = fold(value, cellValue(source, columns[0], rowIndex));
    value = fold(value, cellValue(source, columns[1], rowIndex));
    value = mix(value, Number(cellValue(source, columns[2], rowIndex)));
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

function consumePublicIterable(bytes) {
  const parser = new StaxXmlIterableParser(toByteBatches([bytes], { batchSize: 1 }));
  let eventCount = 0;
  let checksumValue = 2166136261;

  while (parser.nextBatch()) {
    const buffer = parser.buffer();
    for (let index = 0; index < parser.eventCount(); index++) {
      const attrCount = parser.attrCount(index);
      eventCount++;
      checksumValue = mix(checksumValue, parser.eventType(index));
      checksumValue = mixSpan(checksumValue, buffer, parser.nameStart(index), parser.nameEnd(index));
      checksumValue = mixSpan(checksumValue, buffer, parser.textStart(index), parser.textEnd(index));
      checksumValue = mix(checksumValue, attrCount);
      for (let attrIndex = 0; attrIndex < attrCount; attrIndex++) {
        checksumValue = mixSpan(checksumValue, buffer, parser.attrNameStart(index, attrIndex), parser.attrNameEnd(index, attrIndex));
        checksumValue = mixSpan(checksumValue, buffer, parser.attrValueStart(index, attrIndex), parser.attrValueEnd(index, attrIndex));
      }
    }
  }

  return { eventCount, checksum: checksumValue | 0 };
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

function mixSpan(seed, buffer, start, end) {
  if (start < 0 || end <= start) {
    return mix(seed, 0);
  }
  const length = end - start;
  let value = mix(seed, length);
  value = mix(value, buffer[start] ?? 0);
  value = mix(value, buffer[start + (length >> 1)] ?? 0);
  value = mix(value, buffer[end - 1] ?? 0);
  return value;
}

function parseIntegerValue(rawValue) {
  const parsed = typeof rawValue === 'number'
    ? rawValue
    : Number.parseFloat(rawValue.trim());
  if (!Number.isInteger(parsed)) {
    throw new Error(`Expected integer, got ${parsed}`);
  }
  return parsed;
}

function cellValue(source, column, rowIndex) {
  const values = column.numberValues ?? column.number_values;
  if (Array.isArray(values) && values.length > 0) {
    return values[rowIndex];
  }
  const starts = column.spanStarts ?? column.span_starts;
  const ends = column.spanEnds ?? column.span_ends;
  if (Array.isArray(starts) && Array.isArray(ends) && starts[rowIndex] >= 0) {
    return source.buffer
      ? source.buffer.toString('utf8', starts[rowIndex], ends[rowIndex])
      : decoder.decode(source.view.subarray(starts[rowIndex], ends[rowIndex]));
  }
  return column.values[rowIndex];
}

function createUtf8SpanSource(input) {
  if (globalThis.Buffer?.isBuffer(input)) {
    return { view: input, buffer: input };
  }
  if (globalThis.Buffer?.from) {
    return { view: input, buffer: globalThis.Buffer.from(input.buffer, input.byteOffset, input.byteLength) };
  }
  return { view: input };
}

function encodeXml(xml) {
  return inputKind === 'buffer' ? Buffer.from(xml) : encoder.encode(xml);
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

async function importStagedPlatformModule() {
  const packageName = getStaxXmlNativePackageName(detectRuntimePlatform());
  if (!packageName) {
    throw new Error('No native platform package is available for this runtime.');
  }
  const packageDir = resolve(repoRoot, 'packages', packageName.split('/').at(-1));
  return import(pathToFileURL(resolve(packageDir, 'index.mjs')).href);
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
