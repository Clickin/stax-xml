import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const binding = require(join(__dirname, 'stax_xml_native_aggregate.node'));

export const parseAggregateBuffer = binding.parseAggregateBuffer;
export const parseAggregateBufferWithSimd = binding.parseAggregateBufferWithSimd;
export const parseAggregateFile = binding.parseAggregateFile;
export const parseAggregateFileWithSimd = binding.parseAggregateFileWithSimd;
export const parseAggregateUint8Array = binding.parseAggregateUint8Array;
export const parseAggregateUint8ArrayWithSimd = binding.parseAggregateUint8ArrayWithSimd;
export const parseAggregateStringUtf8 = binding.parseAggregateStringUtf8;
export const parseAggregateStringUtf8WithSimd = binding.parseAggregateStringUtf8WithSimd;
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
export const parseObjectRecordsUint8Array =
  binding.parseObjectRecordsUint8Array;
export const parseDocumentNodesUint8Array =
  binding.parseDocumentNodesUint8Array;
export const createObjectProjectionPlan =
  binding.createObjectProjectionPlan;
export const StaxXmlStreamingEventBatchParser =
  binding.StaxXmlStreamingEventBatchParser;
export const createStreamingEventBatchParser =
  binding.createStreamingEventBatchParser;

if (
  typeof parseAggregateBuffer !== 'function' ||
  typeof parseAggregateBufferWithSimd !== 'function' ||
  typeof parseAggregateFile !== 'function' ||
  typeof parseAggregateFileWithSimd !== 'function' ||
  typeof parseAggregateUint8Array !== 'function' ||
  typeof parseAggregateUint8ArrayWithSimd !== 'function' ||
  typeof parseAggregateStringUtf8 !== 'function' ||
  typeof parseAggregateStringUtf8WithSimd !== 'function' ||
  typeof parseAggregateStringUtf16 !== 'function' ||
  typeof parseSpanTableStringUtf16 !== 'function' ||
  typeof parseStructuralIndexStringUtf16 !== 'function' ||
  typeof parseStructuralIndexUint8Array !== 'function' ||
  typeof parseItemProjectionUint8Array !== 'function' ||
  typeof parseItemProjectionViaTableUint8Array !== 'function' ||
  typeof parseItemRowsViaTableUint8Array !== 'function' ||
  typeof parseObjectRowsUint8Array !== 'function' ||
  typeof parseObjectRowsViaTableUint8Array !== 'function' ||
  typeof parseObjectRecordsUint8Array !== 'function' ||
  typeof parseDocumentNodesUint8Array !== 'function' ||
  typeof createObjectProjectionPlan !== 'function' ||
  typeof createStreamingEventBatchParser !== 'function'
) {
  throw new TypeError(
    'Native aggregate addon did not export the required aggregate, structural-index, projection, and streaming functions.',
  );
}

export function parse_aggregate_buffer(input, tier) {
  return parseAggregateBuffer(input, tier);
}

export function parse_aggregate_buffer_with_simd(input, tier, simd) {
  return parseAggregateBufferWithSimd(input, tier, simd);
}

export function parse_aggregate_file(path, tier) {
  return parseAggregateFile(path, tier);
}

export function parse_aggregate_file_with_simd(path, tier, simd) {
  return parseAggregateFileWithSimd(path, tier, simd);
}

export function parse_aggregate_uint8array(input, tier) {
  return parseAggregateUint8Array(input, tier);
}

export function parse_aggregate_uint8array_with_simd(input, tier, simd) {
  return parseAggregateUint8ArrayWithSimd(input, tier, simd);
}

export function parse_aggregate_string_utf8(input, tier) {
  return parseAggregateStringUtf8(input, tier);
}

export function parse_aggregate_string_utf8_with_simd(input, tier, simd) {
  return parseAggregateStringUtf8WithSimd(input, tier, simd);
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

export function parse_object_records_uint8array(input, spec) {
  return parseObjectRecordsUint8Array(input, spec);
}

export function parse_document_nodes_uint8array(input, options) {
  return parseDocumentNodesUint8Array(input, options);
}

export function create_object_projection_plan(spec) {
  return createObjectProjectionPlan(spec);
}
