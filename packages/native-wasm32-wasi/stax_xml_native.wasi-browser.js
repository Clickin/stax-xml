import {
  createOnMessage as __wasmCreateOnMessageForFsProxy,
  getDefaultContext as __emnapiGetDefaultContext,
  instantiateNapiModule as __emnapiInstantiateNapiModule,
  WASI as __WASI,
} from '@napi-rs/wasm-runtime'



const __wasi = new __WASI({
  version: 'preview1',
})

const __wasmUrl = new URL('./stax_xml_native.wasm32-wasi.wasm', import.meta.url).href
const __emnapiContext = __emnapiGetDefaultContext()


const __sharedMemory = new WebAssembly.Memory({
  initial: 4000,
  maximum: 65536,
  shared: true,
})

const __wasmFile = await fetch(__wasmUrl).then((res) => res.arrayBuffer())

const {
  instance: __napiInstance,
  module: __wasiModule,
  napiModule: __napiModule,
} = await __emnapiInstantiateNapiModule(__wasmFile, {
  context: __emnapiContext,
  asyncWorkPoolSize: 4,
  wasi: __wasi,
  onCreateWorker() {
    const worker = new Worker(new URL('./wasi-worker-browser.mjs', import.meta.url), {
      type: 'module',
    })


    return worker
  },
  overwriteImports(importObject) {
    importObject.env = {
      ...importObject.env,
      ...importObject.napi,
      ...importObject.emnapi,
      memory: __sharedMemory,
    }
    return importObject
  },
  beforeInit({ instance }) {
    for (const name of Object.keys(instance.exports)) {
      if (name.startsWith('__napi_register__')) {
        instance.exports[name]()
      }
    }
  },
})
export default __napiModule.exports
export const StaxXmlObjectProjectionPlan = __napiModule.exports.StaxXmlObjectProjectionPlan
export const StaxXmlStreamingEventBatchParser = __napiModule.exports.StaxXmlStreamingEventBatchParser
export const createObjectProjectionPlan = __napiModule.exports.createObjectProjectionPlan
export const createStreamingEventBatchParser = __napiModule.exports.createStreamingEventBatchParser
export const parseAggregateBuffer = __napiModule.exports.parseAggregateBuffer
export const parseAggregateBufferWithSimd = __napiModule.exports.parseAggregateBufferWithSimd
export const parseAggregateFile = __napiModule.exports.parseAggregateFile
export const parseAggregateFileWithSimd = __napiModule.exports.parseAggregateFileWithSimd
export const parseAggregateStringUtf8 = __napiModule.exports.parseAggregateStringUtf8
export const parseAggregateStringUtf8WithSimd = __napiModule.exports.parseAggregateStringUtf8WithSimd
export const parseAggregateUint8Array = __napiModule.exports.parseAggregateUint8Array
export const parseAggregateUint8ArrayWithSimd = __napiModule.exports.parseAggregateUint8ArrayWithSimd
export const parseDocumentNodesUint8Array = __napiModule.exports.parseDocumentNodesUint8Array
export const parseItemProjectionUint8Array = __napiModule.exports.parseItemProjectionUint8Array
export const parseItemProjectionViaTableUint8Array = __napiModule.exports.parseItemProjectionViaTableUint8Array
export const parseItemRowsViaTableUint8Array = __napiModule.exports.parseItemRowsViaTableUint8Array
export const parseObjectRecordsUint8Array = __napiModule.exports.parseObjectRecordsUint8Array
export const parseObjectRowsUint8Array = __napiModule.exports.parseObjectRowsUint8Array
export const parseObjectRowsViaTableUint8Array = __napiModule.exports.parseObjectRowsViaTableUint8Array
export const parseSpanTableUint8Array = __napiModule.exports.parseSpanTableUint8Array
export const parseStructuralIndexUint8Array = __napiModule.exports.parseStructuralIndexUint8Array
