import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const binding = require('./stax_xml_native.node');

// Legacy direct UTF-16 helpers remain exported in this low-level package for
// diagnostics and compatibility experiments. The public `stax-xml` facade
// canonicalizes string input to UTF-8 bytes before acceleration.

export default binding;
export const parseAggregateBuffer = binding.parseAggregateBuffer;
export const parseAggregateFile = binding.parseAggregateFile;
export const parseAggregateUint8Array = binding.parseAggregateUint8Array;
export const parseAggregateStringUtf8 = binding.parseAggregateStringUtf8;
export const parseStructuralIndexUint8Array =
  binding.parseStructuralIndexUint8Array ?? binding.parseSpanTableUint8Array;
export const parseItemRowsViaTableUint8Array = binding.parseItemRowsViaTableUint8Array;
export const parseObjectRowsUint8Array = binding.parseObjectRowsUint8Array;
export const parseObjectRowsViaTableUint8Array = binding.parseObjectRowsViaTableUint8Array;
export const parseObjectRecordsUint8Array = binding.parseObjectRecordsUint8Array;
export const parseDocumentNodesUint8Array = binding.parseDocumentNodesUint8Array;
export const createObjectProjectionPlan = binding.createObjectProjectionPlan;
export const StaxXmlStreamingEventBatchParser = binding.StaxXmlStreamingEventBatchParser;
export const createStreamingEventBatchParser = binding.createStreamingEventBatchParser;
