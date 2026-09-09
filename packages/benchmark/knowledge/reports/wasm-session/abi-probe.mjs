import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createStaxParserSurfaceRunners } from '/Users/senghyunjo/github/stax-xml/packages/benchmark/common/parser-scenarios.mjs';
const entry = process.argv[2];
const output = process.argv[3];
const wasm = await import(pathToFileURL(entry).href);
await wasm.initWasm({variant:'simd'});
const counts = {};
let decodedBytes = 0;
let decodeCalls = 0;
let ingressDecodeCalls = 0;
const sessions = [];
const backend = {
  ...wasm.wasmTokenBackendFactory,
  createByteSession(options) {
    const session = wasm.wasmTokenBackendFactory.createByteSession(options);
    sessions.push(session);
    const cursor = session.cursor;
    const raw = cursor.raw;
    const calls = new Map();
    cursor.raw = new Proxy({ ...raw }, { get(target,key) {
      const value = Reflect.get(target,key);
      if (typeof value !== 'function') return value;
      if (!calls.has(key)) calls.set(key,(...args)=>{counts[key]=(counts[key]??0)+1; return value(...args);});
      return calls.get(key);
    }});
    const decode = cursor.decoder.decode.bind(cursor.decoder);
    cursor.decoder.decode = (bytes, ...args)=>{decodeCalls++; decodedBytes+=bytes?.byteLength??0; return decode(bytes,...args);};
    const push = session.pushBytes.bind(session);
    session.pushBytes = (...args)=>{const previous=decodeCalls; push(...args); ingressDecodeCalls+=decodeCalls-previous;};
    return session;
  },
};
const assetPath = '/Users/senghyunjo/github/stax-xml/packages/benchmark/assets/midsize.xml';
const inputBuffer = readFileSync(assetPath);
const runners = createStaxParserSurfaceRunners({assetPath,inputBuffer,backend});
const rows = await runners[1].run();
for (const session of sessions) session.dispose();
const report = {entry,bytes:inputBuffer.length,records:rows.length,counts,decodeCalls,decodedBytes,ingressDecodeCalls,note:'Instrumented call counts only; no throughput attribution from proxy overhead.'};
writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
