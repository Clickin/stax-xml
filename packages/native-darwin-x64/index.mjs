import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const binding = require('./stax_xml_native.node');

export default binding;
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
export const parseItemRowsViaTableUint8Array = binding.parseItemRowsViaTableUint8Array;
export const parseObjectRowsUint8Array = binding.parseObjectRowsUint8Array;
export const parseObjectRowsViaTableUint8Array = binding.parseObjectRowsViaTableUint8Array;
