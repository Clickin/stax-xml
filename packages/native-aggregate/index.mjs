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
export const parseStructuralIndexStringUtf16 =
  binding.parseStructuralIndexStringUtf16 ?? binding.parseSpanTableStringUtf16;
export const parseStructuralIndexUint8Array =
  binding.parseStructuralIndexUint8Array ?? binding.parseSpanTableUint8Array;
export const parseItemProjectionUint8Array = binding.parseItemProjectionUint8Array;
export const parseItemProjectionViaTableUint8Array =
  binding.parseItemProjectionViaTableUint8Array;
export const parseItemRowsViaTableUint8Array =
  binding.parseItemRowsViaTableUint8Array;
export const parseObjectRowsUint8Array =
  binding.parseObjectRowsUint8Array;
export const parseObjectRowsViaTableUint8Array =
  binding.parseObjectRowsViaTableUint8Array;

if (
  typeof parseAggregateBuffer !== 'function' ||
  typeof parseAggregateFile !== 'function' ||
  typeof parseAggregateUint8Array !== 'function' ||
  typeof parseAggregateStringUtf8 !== 'function' ||
  typeof parseAggregateStringUtf16 !== 'function' ||
  typeof parseSpanTableStringUtf16 !== 'function' ||
  typeof parseStructuralIndexStringUtf16 !== 'function' ||
  typeof parseStructuralIndexUint8Array !== 'function' ||
  typeof parseItemProjectionUint8Array !== 'function' ||
  typeof parseItemProjectionViaTableUint8Array !== 'function' ||
  typeof parseItemRowsViaTableUint8Array !== 'function' ||
  typeof parseObjectRowsUint8Array !== 'function' ||
  typeof parseObjectRowsViaTableUint8Array !== 'function'
) {
  throw new TypeError(
    'Native aggregate addon did not export the required aggregate and structural-index functions.',
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

export function parse_structural_index_string_utf16(input) {
  return parseStructuralIndexStringUtf16(input);
}

export function parse_structural_index_uint8array(input) {
  return parseStructuralIndexUint8Array(input);
}

export function parse_item_projection_uint8array(input) {
  return parseItemProjectionUint8Array(input);
}

export function parse_item_projection_via_table_uint8array(input) {
  return parseItemProjectionViaTableUint8Array(input);
}

export function parse_item_rows_via_table_uint8array(input) {
  return parseItemRowsViaTableUint8Array(input);
}

export function parse_object_rows_uint8array(input, spec) {
  return parseObjectRowsUint8Array(input, spec);
}

export function parse_object_rows_via_table_uint8array(input, spec) {
  return parseObjectRowsViaTableUint8Array(input, spec);
}
