import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const binding = require(join(__dirname, 'stax_xml_native_aggregate.node'));

export const parseAggregateBuffer = binding.parseAggregateBuffer;
export const parseAggregateFile = binding.parseAggregateFile;
export const parseAggregateUint8Array = binding.parseAggregateUint8Array;
export const parseAggregateStringUtf8 = binding.parseAggregateStringUtf8;
export const parseAggregateStringUtf16 = binding.parseAggregateStringUtf16;
export const parseSpanTableStringUtf16 = binding.parseSpanTableStringUtf16;

if (
  typeof parseAggregateBuffer !== 'function' ||
  typeof parseAggregateFile !== 'function' ||
  typeof parseAggregateUint8Array !== 'function' ||
  typeof parseAggregateStringUtf8 !== 'function' ||
  typeof parseAggregateStringUtf16 !== 'function' ||
  typeof parseSpanTableStringUtf16 !== 'function'
) {
  throw new TypeError(
    'Native aggregate addon did not export parseAggregateBuffer/parseAggregateFile/parseAggregateUint8Array/parseAggregateStringUtf8/parseAggregateStringUtf16/parseSpanTableStringUtf16.',
  );
}

export function parse_aggregate_buffer(input, tier) {
  return parseAggregateBuffer(input, tier);
}

export function parse_aggregate_file(path, tier) {
  return parseAggregateFile(path, tier);
}

export function parse_aggregate_uint8array(input, tier) {
  return parseAggregateUint8Array(input, tier);
}

export function parse_aggregate_string_utf8(input, tier) {
  return parseAggregateStringUtf8(input, tier);
}

export function parse_aggregate_string_utf16(input, tier) {
  return parseAggregateStringUtf16(input, tier);
}

export function parse_span_table_string_utf16(input) {
  return parseSpanTableStringUtf16(input);
}
