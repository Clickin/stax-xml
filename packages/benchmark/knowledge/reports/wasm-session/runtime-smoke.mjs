import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const root = process.env.STAX_SMOKE_ROOT ?? '/Users/senghyunjo/github/stax-xml/packages';
const entry = (name, file) => root === 'installed' ? name : pathToFileURL(`${root}/${file}`).href;
const NativeWasm = globalThis.WebAssembly;
globalThis.WebAssembly = undefined;
const js = await import(entry('stax-xml', 'stax-xml/dist/index.js'));
const wasm = await import(entry('@stax-xml/wasm', 'wasm/dist/index.js'));
const { x } = await import(entry('stax-xml/converter', 'stax-xml/dist/converter.js'));
const encoder = new TextEncoder();
function values(reader) { const result=[]; try { while(reader.next()!==null) result.push([reader.eventType(),reader.name(),reader.text()]); } finally { reader.close(); } return result; }
const simple = '<r>ok</r>';
assert.deepEqual(values(new js.StreamReaderSync(encoder.encode(simple))),values(new wasm.StreamReaderSync(simple)));
const utf16 = new Uint8Array(Array.from(simple).flatMap(c=>[c.charCodeAt(0),0]));
assert.deepEqual(values(new wasm.StreamReaderSync(utf16,{encoding:'utf-16le'})),values(new js.StreamReaderSync(simple)));
assert.throws(()=>new wasm.StreamReaderSync(encoder.encode(simple)),/not initialized/);
globalThis.WebAssembly = NativeWasm;
const NativeDecoder = globalThis.TextDecoder;
let decoderCalls = 0;
globalThis.TextDecoder = class extends NativeDecoder { decode(...args) { decoderCalls++; return super.decode(...args); } };
const variants = [];
for (const variant of ['scalar','simd']) {
  await wasm.initWasm({variant});
  const session = new wasm.WasmTokenInputSession({});
  const xml = encoder.encode('<?xml version="1.0"?><r xmlns:p="u" p:a="é">😀&amp;</r>');
  const before = decoderCalls;
  let tokens = 0;
  for(let offset=0;offset<xml.length;offset++) {
    session.pushBytes(xml.subarray(offset,offset+1),offset+1===xml.length);
    for(;;) { const type=session.cursor.next(); if(type===wasm.NEED_INPUT || type===null) break; tokens++; }
  }
  assert.equal(tokens,5);
  assert.equal(decoderCalls,before,'Wasm byte ingestion and type-only tokenization must not decode in JS');
  session.dispose();
  const bytes = encoder.encode('<book><title>한글😀</title><count>7</count></book>');
  const schema=x.object({title:x.string('/book/title'),count:x.number('/book/count')});
  const expected={title:'한글😀',count:7};
  assert.deepEqual(schema.parseSync(bytes,wasm.withWasmBackend({})),expected);
  async function* chunks() { for(let i=0;i<bytes.length;i++) yield bytes.subarray(i,i+1); }
  assert.deepEqual(await schema.parse(chunks(),wasm.withWasmBackend({})),expected);
  const asyncValues=[];
  const reader=new wasm.StreamReader(chunks());
  try { while(await reader.next()!==null) asyncValues.push([reader.eventType(),reader.name(),reader.text()]); } finally {await reader.close();}
  assert.deepEqual(asyncValues,values(new js.StreamReaderSync(bytes)));
  variants.push({variant,rawByteIngressDecoderCalls:0,oneByteUtf8Tokens:tokens,converterSync:true,converterAsync:true,readerAsync:true});
}
globalThis.TextDecoder=NativeDecoder;
console.log(JSON.stringify({root,noWebAssemblyJs:true,directStringFallback:true,nonUtf8Fallback:true,uninitializedFailure:true,variants},null,2));
