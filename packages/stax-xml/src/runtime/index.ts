export {
  WASM_PACKAGE_NAME,
  detectRuntimePlatform,
  getStaxXmlNativePackageName,
  resolveStaxXmlRuntimeBackend,
} from './native-backend.js';
export type {
  OptionalPackageImporter,
  StaxXmlRuntimeBackend,
  StaxXmlRuntimeBackendKind,
  StaxXmlRuntimePlatform,
  StaxXmlRuntimeResolverOptions,
} from './native-backend.js';
export {
  StaxXmlWasmIterableParser,
} from './wasm-iterable-parser.js';
export type {
  StaxXmlWasmIterableParserOptions,
  StaxXmlWasmSpanTable,
} from './wasm-iterable-parser.js';
