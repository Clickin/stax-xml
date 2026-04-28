export {
  WASM_PACKAGE_NAME,
  createStaxXmlRuntimeFromBackend,
  detectRuntimePlatform,
  getInitializedStaxXmlRuntime,
  getStaxXmlNativePackageName,
  getStaxXmlRuntime,
  getStaxXmlRuntimeForAsyncApi,
  getStaxXmlRuntimeForSyncApi,
  initStaxXml,
  resetStaxXmlRuntimeForTests,
  resolveStaxXmlRuntimeBackend,
} from './native-backend.js';
export type {
  InitStaxXmlOptions,
  OptionalPackageImporter,
  StaxXmlRuntime,
  StaxXmlRuntimeBackend,
  StaxXmlRuntimeBackendKind,
  StaxXmlRuntimeBackendPreference,
  StaxXmlRuntimeCapabilities,
  StaxXmlRuntimePlatform,
  StaxXmlRuntimeResolverOptions,
  StaxXmlStreamingEventBatch,
  StaxXmlStreamingEventBatchFactory,
  StaxXmlStreamingEventBatchParser,
} from './native-backend.js';
export {
  StaxXmlWasmIterableParser,
} from './wasm-iterable-parser.js';
export type {
  StaxXmlWasmIterableParserOptions,
  StaxXmlWasmSpanTable,
} from './wasm-iterable-parser.js';
export {
  StaxXmlStructuralIndexParser,
} from './structural-index-parser.js';
export type {
  StaxXmlStructuralIndexParserOptions,
  StructuralIndexSource,
  StructuralIndexSourceKind,
  StructuralIndexTable,
} from './structural-index-parser.js';
