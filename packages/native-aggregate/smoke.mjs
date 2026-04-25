import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parse_aggregate_buffer,
  parse_aggregate_file,
  parse_aggregate_uint8array,
  parse_span_table_string_utf16,
  parse_aggregate_string_utf16,
  parse_aggregate_string_utf8,
} from './index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

for (const tier of ['count-only', 'full-string-direct', 'event-object-full']) {
  const bufferResult = normalize(parse_aggregate_buffer(sample, tier));
  assertEqual(bufferResult.tier, tier, `${tier} tier echo`);
  assertEqual(bufferResult.eventCount, 10, `${tier} event count`);
  assertEqual(bufferResult.attrCountTotal, 2, `${tier} attr count`);

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
  assertEqual(spanTable.readUInt32LE(8), bufferResult.attrCountTotal, `${tier} span table attr count`);

  mkdirSync(join(__dirname, 'target'), { recursive: true });
  const filePath = join(__dirname, 'target', 'smoke.xml');
  writeFileSync(filePath, sample);
  const fileResult = normalize(parse_aggregate_file(filePath, tier));
  assertEqual(fileResult.eventCount, bufferResult.eventCount, `${tier} file event count`);
  assertEqual(fileResult.checksum, bufferResult.checksum, `${tier} file checksum`);
}

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

console.log('native aggregate smoke ok');

function normalize(result) {
  return {
    tier: result.tier,
    eventCount: result.eventCount ?? result.event_count,
    checksum: result.checksum,
    attrCountTotal: result.attrCountTotal ?? result.attr_count_total,
  };
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
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
