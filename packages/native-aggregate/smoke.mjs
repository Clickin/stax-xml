import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parse_aggregate_buffer,
  parse_aggregate_buffer_with_simd,
  parse_aggregate_file,
  parse_aggregate_file_with_simd,
  parse_aggregate_uint8array,
  parse_aggregate_uint8array_with_simd,
  parse_span_table_string_utf16,
  parse_structural_index_string_utf16,
  parse_structural_index_uint8array,
  parse_item_projection_uint8array,
  parse_item_projection_via_table_uint8array,
  parse_item_rows_via_table_uint8array,
  parse_object_rows_uint8array,
  parse_object_rows_via_table_uint8array,
  parse_aggregate_string_utf16,
  parse_aggregate_string_utf8,
  parse_aggregate_string_utf8_with_simd,
} from './index.mjs';

const sampleText =
  '<?xml version="1.0" encoding="UTF-8"?>' +
    '<!DOCTYPE root>' +
    '<root>' +
    '<item a="1 > 0" b=\'x > y\'>안녕</item>' +
    '<!-- skipped -->' +
    '<?pi skipped?>' +
    '<![CDATA[<raw>value</raw>]]>' +
    '<empty />' +
    '</root>';
const sample = Buffer.from(sampleText);
const sampleUint8 = new Uint8Array(sample.buffer, sample.byteOffset, sample.byteLength);

for (const tier of [
  'count-only',
  'name-string-only',
  'text-string-only',
  'attr-value-string-only',
  'full-string-direct',
  'event-object-full',
]) {
  const bufferResult = normalize(parse_aggregate_buffer(sample, tier));
  assertEqual(bufferResult.tier, tier, `${tier} tier echo`);
  assertEqual(bufferResult.eventCount, 10, `${tier} event count`);
  assertEqual(bufferResult.attrCountTotal, expectedAttrCountTotal(tier), `${tier} attr count`);

  const uint8ArrayResult = normalize(parse_aggregate_uint8array(sampleUint8, tier));
  assertEqual(uint8ArrayResult.eventCount, bufferResult.eventCount, `${tier} uint8array event count`);
  assertEqual(uint8ArrayResult.checksum, bufferResult.checksum, `${tier} uint8array checksum`);

  const utf8StringResult = normalize(parse_aggregate_string_utf8(sampleText, tier));
  assertEqual(utf8StringResult.eventCount, bufferResult.eventCount, `${tier} utf8 string event count`);
  assertEqual(utf8StringResult.checksum, bufferResult.checksum, `${tier} utf8 string checksum`);

  const utf16StringResult = normalize(parse_aggregate_string_utf16(sampleText, tier));
  assertEqual(utf16StringResult.eventCount, bufferResult.eventCount, `${tier} utf16 string event count`);
  assertEqual(utf16StringResult.checksum, bufferResult.checksum, `${tier} utf16 string checksum`);

  const spanTable = parse_span_table_string_utf16(sampleText);
  assertEqual(Buffer.isBuffer(spanTable), true, `${tier} span table buffer`);
  assertEqual(spanTable.readUInt32LE(0), 0x31545053, `${tier} span table magic`);
  assertEqual(spanTable.readUInt32LE(4), bufferResult.eventCount, `${tier} span table event count`);
  assertEqual(spanTable.readUInt32LE(8), 2, `${tier} span table attr count`);
  assertEqual(spanTable.readUInt32LE(24), 0, `${tier} span table utf16 source kind`);

  const structuralUtf16 = parse_structural_index_string_utf16(sampleText);
  assertEqual(Buffer.isBuffer(structuralUtf16), true, `${tier} structural utf16 buffer`);
  assertEqual(structuralUtf16.readUInt32LE(0), 0x31545053, `${tier} structural utf16 magic`);
  assertEqual(structuralUtf16.readUInt32LE(4), bufferResult.eventCount, `${tier} structural utf16 event count`);
  assertEqual(structuralUtf16.readUInt32LE(24), 0, `${tier} structural utf16 source kind`);

  const structuralUtf8 = parse_structural_index_uint8array(sampleUint8);
  assertEqual(Buffer.isBuffer(structuralUtf8), true, `${tier} structural utf8 buffer`);
  assertEqual(structuralUtf8.readUInt32LE(0), 0x31545053, `${tier} structural utf8 magic`);
  assertEqual(structuralUtf8.readUInt32LE(4), bufferResult.eventCount, `${tier} structural utf8 event count`);
  assertEqual(structuralUtf8.readUInt32LE(12), sampleUint8.byteLength, `${tier} structural utf8 input bytes`);
  assertEqual(structuralUtf8.readUInt32LE(24), 1, `${tier} structural utf8 source kind`);

  const smokeDir = join(tmpdir(), `stax-xml-native-aggregate-smoke-${process.pid}`);
  mkdirSync(smokeDir, { recursive: true });
  const filePath = join(smokeDir, `smoke-${tier}.xml`);
  writeFileSync(filePath, sample);
  const fileResult = normalize(parse_aggregate_file(filePath, tier));
  assertEqual(fileResult.eventCount, bufferResult.eventCount, `${tier} file event count`);
  assertEqual(fileResult.checksum, bufferResult.checksum, `${tier} file checksum`);
}

const twoStage = normalize(parse_aggregate_buffer(sample, 'event-count-two-stage'));
for (const [label, result] of [
  ['buffer simd off', parse_aggregate_buffer_with_simd(sample, 'event-count-two-stage', 'off')],
  ['uint8array simd off', parse_aggregate_uint8array_with_simd(sampleUint8, 'event-count-two-stage', 'off')],
  ['utf8 string simd off', parse_aggregate_string_utf8_with_simd(sampleText, 'event-count-two-stage', 'off')],
]) {
  const normalized = normalize(result);
  assertEqual(normalized.eventCount, twoStage.eventCount, `${label} event count`);
  assertEqual(normalized.checksum, twoStage.checksum, `${label} checksum`);
}
const simdSmokeDir = join(tmpdir(), `stax-xml-native-aggregate-smoke-${process.pid}`);
mkdirSync(simdSmokeDir, { recursive: true });
const simdFilePath = join(simdSmokeDir, 'smoke-simd.xml');
writeFileSync(simdFilePath, sample);
const fileSimd = normalize(parse_aggregate_file_with_simd(simdFilePath, 'event-count-two-stage', 'off'));
assertEqual(fileSimd.eventCount, twoStage.eventCount, 'file simd off event count');
assertEqual(fileSimd.checksum, twoStage.checksum, 'file simd off checksum');

assertThrows(
  () => parse_aggregate_buffer(Buffer.from('<root><item a="1 > 2></item></root>'), 'full-string-direct'),
  /Unclosed start tag/,
  'incomplete quoted tail',
);
assertThrows(
  () => parse_aggregate_uint8array(new TextEncoder().encode('<root><item a="1 > 2></item></root>'), 'full-string-direct'),
  /Unclosed start tag/,
  'uint8array incomplete quoted tail',
);
assertThrows(
  () => parse_aggregate_string_utf16('<root><item a="1 > 2></item></root>', 'full-string-direct'),
  /Unclosed start tag/,
  'utf16 incomplete quoted tail',
);

const projectionSample = Buffer.from(
  '<root><item id="7"><name>Alice</name><value>안녕</value></item><item id="11"><name>Bob</name><value>cafe</value></item></root>',
);
const projection = parse_item_projection_uint8array(projectionSample);
const tableProjection = parse_item_projection_via_table_uint8array(projectionSample);
const tableRows = parse_item_rows_via_table_uint8array(projectionSample);
const objectRowsSpec = {
  itemName: 'item',
  fields: [
    { outputName: 'id', valueKind: 'number', sourceKind: 'attribute', sourceName: 'id', textMode: 'direct' },
    { outputName: 'name', valueKind: 'string', sourceKind: 'element', sourceName: 'name', textMode: 'subtree' },
    { outputName: 'value', valueKind: 'string', sourceKind: 'element', sourceName: 'value', textMode: 'subtree' },
  ],
};
const directObjectRows = parse_object_rows_uint8array(projectionSample, objectRowsSpec);
const objectRows = parse_object_rows_via_table_uint8array(projectionSample, objectRowsSpec);
assertEqual(projection.itemCount, 2, 'item projection count');
assertEqual(projection.checksum, projectionChecksum([
  { id: 7, name: 'Alice', value: '안녕' },
  { id: 11, name: 'Bob', value: 'cafe' },
]), 'item projection checksum');
assertEqual(tableProjection.itemCount, projection.itemCount, 'table item projection count');
assertEqual(tableProjection.checksum, projection.checksum, 'table item projection checksum');
assertEqual(tableRows.eventCount, 20, 'table item rows event count');
assertEqual(tableRows.maxDepth, 3, 'table item rows max depth');
assertEqual(tableRows.rows.length, 2, 'table item rows length');
assertEqual(tableRows.rows[0].id, 7, 'table item rows first id');
assertEqual(tableRows.rows[0].name, 'Alice', 'table item rows first name');
assertEqual(tableRows.rows[0].value, '안녕', 'table item rows first value');
assertEqual(objectRows.eventCount, 20, 'object rows event count');
assertEqual(objectRows.fieldCount, 3, 'object rows field count');
assertEqual(objectRows.rowCount, 2, 'object rows length');
assertEqual(objectRows.columns[0].present.join(','), 'true,true', 'object rows id present flags');
assertEqual(numberValues(objectRows.columns[0]).join('|'), '7|11', 'object rows id values');
assertEqual(objectRows.columns[0].values.length, 0, 'object rows id string values');
assertEqual(objectRows.columns[1].values[0], 'Alice', 'object rows first name');
assertEqual(objectRows.columns[2].values[0], '안녕', 'object rows first value');
assertEqual(directObjectRows.rowCount, objectRows.rowCount, 'direct object rows length');
assertEqual(directObjectRows.columns[1].values[0], 'Alice', 'direct object rows first name');

console.log('native aggregate smoke ok');

function normalize(result) {
  return {
    tier: result.tier,
    eventCount: result.eventCount ?? result.event_count,
    checksum: result.checksum,
    attrCountTotal: result.attrCountTotal ?? result.attr_count_total,
  };
}

function expectedAttrCountTotal(tier) {
  return tier === 'name-string-only' || tier === 'text-string-only' ? 0 : 2;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function numberValues(column) {
  return column.numberValues ?? column.number_values;
}


function assertThrows(fn, pattern, label) {
  try {
    fn();
  } catch (error) {
    if (!pattern.test(String(error?.message ?? error))) {
      throw new Error(`${label}: wrong error ${String(error?.message ?? error)}`);
    }
    return;
  }
  throw new Error(`${label}: expected throw`);
}

function projectionChecksum(rows) {
  let value = rows.length;
  for (const row of rows) {
    value = mix(value, row.id);
    value = fold(value, row.name);
    value = fold(value, row.value);
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
