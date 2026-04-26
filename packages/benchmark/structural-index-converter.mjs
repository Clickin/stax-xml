import { performance } from 'node:perf_hooks';
import { x } from 'stax-xml/converter';
import { StaxXmlStructuralIndexParser } from 'stax-xml/runtime';

const encoder = new TextEncoder();
const nativeAggregate = await loadNativeAggregateProbe();
const args = new Set(process.argv.slice(2));
const quick = args.has('--quick');
const sizesMiB = readListArg('--sizes-mib', quick ? '16' : '16,128').map(Number);
const fixtures = readListArg('--fixtures', 'attribute-heavy,mixed-utf8');

const schema = x.array(
  x.object({
    id: x.number().xpath('./@id').int(),
    name: x.string().xpath('./name'),
    value: x.string().xpath('./value'),
  }),
  '//item',
).compile();
const objectRowsSpec = {
  itemName: 'item',
  fields: [
    { outputName: 'id', valueKind: 'number', sourceKind: 'attribute', sourceName: 'id', textMode: 'direct' },
    { outputName: 'name', valueKind: 'string', sourceKind: 'element', sourceName: 'name', textMode: 'subtree' },
    { outputName: 'value', valueKind: 'string', sourceKind: 'element', sourceName: 'value', textMode: 'subtree' },
  ],
};

for (const sizeMiB of sizesMiB) {
  for (const fixture of fixtures) {
    const xml = createFixtureXml(fixture, sizeMiB);
    const bytes = encoder.encode(xml);
    const parseOptions = { maxEvents: 20_000_000 };
    const js = await measure('js-string', () => schema.parse(xml, {
      ...parseOptions,
      acceleration: { backend: 'js' },
    }));
    const byte = await measure('byte-auto', () => schema.parse(bytes, {
      ...parseOptions,
      acceleration: { backend: 'auto', simd: 'auto-safe' },
    }));
    const nativeBuffer = nativeAggregate?.parseStructuralIndexUint8Array
      ? await measure('native-buffer-table', () => {
        const table = nativeAggregate.parseStructuralIndexUint8Array(bytes);
        return schema.parse(new StaxXmlStructuralIndexParser(bytes, table), parseOptions);
      })
      : undefined;
    const nativeProjection = nativeAggregate?.parseItemProjectionUint8Array
      ? await measureProjection('native-item-projection', () => nativeAggregate.parseItemProjectionUint8Array(bytes))
      : undefined;
    const nativeTableProjection = nativeAggregate?.parseItemProjectionViaTableUint8Array
      ? await measureProjection('native-table-projection', () => nativeAggregate.parseItemProjectionViaTableUint8Array(bytes))
      : undefined;
    const nativeTableRows = nativeAggregate?.parseItemRowsViaTableUint8Array
      ? await measureRows('native-table-rows', () => nativeAggregate.parseItemRowsViaTableUint8Array(bytes))
      : undefined;
    const nativeObjectRows = nativeAggregate?.parseObjectRowsViaTableUint8Array
      ? await measureObjectRows('native-object-rows', () => nativeAggregate.parseObjectRowsViaTableUint8Array(bytes, objectRowsSpec))
      : undefined;
    const ratio = js.ms / byte.ms;
    console.log(JSON.stringify({
      fixture,
      sizeMiB,
      bytes: bytes.byteLength,
      jsMs: round(js.ms),
      byteAutoMs: round(byte.ms),
      nativeBufferMs: nativeBuffer ? round(nativeBuffer.ms) : undefined,
      nativeProjectionMs: nativeProjection ? round(nativeProjection.ms) : undefined,
      nativeTableProjectionMs: nativeTableProjection ? round(nativeTableProjection.ms) : undefined,
      nativeTableRowsMs: nativeTableRows ? round(nativeTableRows.ms) : undefined,
      nativeObjectRowsMs: nativeObjectRows ? round(nativeObjectRows.ms) : undefined,
      speedup: round(ratio),
      nativeBufferSpeedup: nativeBuffer ? round(js.ms / nativeBuffer.ms) : undefined,
      nativeProjectionSpeedup: nativeProjection ? round(js.ms / nativeProjection.ms) : undefined,
      nativeTableProjectionSpeedup: nativeTableProjection ? round(js.ms / nativeTableProjection.ms) : undefined,
      nativeTableRowsSpeedup: nativeTableRows ? round(js.ms / nativeTableRows.ms) : undefined,
      nativeObjectRowsSpeedup: nativeObjectRows ? round(js.ms / nativeObjectRows.ms) : undefined,
      jsChecksum: js.checksum,
      byteChecksum: byte.checksum,
      nativeBufferChecksum: nativeBuffer?.checksum,
      nativeProjectionChecksum: nativeProjection?.checksum,
      nativeTableProjectionChecksum: nativeTableProjection?.checksum,
      nativeTableRowsChecksum: nativeTableRows?.checksum,
      nativeObjectRowsChecksum: nativeObjectRows?.checksum,
      parity: js.checksum === byte.checksum,
      nativeBufferParity: nativeBuffer ? js.checksum === nativeBuffer.checksum : undefined,
      nativeProjectionParity: nativeProjection ? js.checksum === nativeProjection.checksum : undefined,
      nativeTableProjectionParity: nativeTableProjection ? js.checksum === nativeTableProjection.checksum : undefined,
      nativeTableRowsParity: nativeTableRows ? js.checksum === nativeTableRows.checksum : undefined,
      nativeObjectRowsParity: nativeObjectRows ? js.checksum === nativeObjectRows.checksum : undefined,
    }));
  }
}

async function measure(name, run) {
  const start = performance.now();
  const result = await run();
  const ms = performance.now() - start;
  return { name, ms, checksum: checksum(result) };
}

async function measureProjection(name, run) {
  const start = performance.now();
  const result = await run();
  const ms = performance.now() - start;
  return {
    name,
    ms,
    checksum: result.checksum,
    itemCount: result.itemCount ?? result.item_count,
  };
}

async function measureRows(name, run) {
  const start = performance.now();
  const result = await run();
  const ms = performance.now() - start;
  return {
    name,
    ms,
    checksum: checksum(result.rows),
    itemCount: result.rows.length,
  };
}

async function measureObjectRows(name, run) {
  const start = performance.now();
  const result = await run();
  const ms = performance.now() - start;
  return {
    name,
    ms,
    checksum: checksumObjectRows(result.columns, result.rowCount ?? result.row_count),
    itemCount: result.rowCount ?? result.row_count,
  };
}

function createFixtureXml(fixture, sizeMiB) {
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

function checksum(rows) {
  let value = rows.length;
  for (const row of rows) {
    value = mix(value, row.id);
    value = fold(value, row.name);
    value = fold(value, row.value);
  }
  return value | 0;
}

function checksumObjectRows(columns, rowCount) {
  let value = rowCount;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    value = mix(value, Number(columns[0].values[rowIndex]));
    value = fold(value, columns[1].values[rowIndex]);
    value = fold(value, columns[2].values[rowIndex]);
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

function readListArg(name, fallback) {
  const prefix = `${name}=`;
  const value = process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
  return value.split(',').map(part => part.trim()).filter(Boolean);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

async function loadNativeAggregateProbe() {
  try {
    return await import('@stax-xml/native-aggregate-probe');
  } catch {
    return undefined;
  }
}
