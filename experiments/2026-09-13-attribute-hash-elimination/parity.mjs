import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const base=process.argv[2],candidate=process.argv[3];
const apis=await Promise.all([base,candidate].map(p=>import(pathToFileURL(`${p}/index.js`))));
const dir=new URL('./fixtures/',import.meta.url);
const docs=fs.readdirSync(dir).filter(n=>/^(duplicate-|prefix-|first-|ends-|cardinality-|unicode-)/.test(n)).map(n=>[n,fs.readFileSync(new URL(n,dir),'utf8')]);
docs.push(['namespace-expanded','<r xmlns:p="u" xmlns:q="u" p:a="1" q:a="2"/>'],['namespace-valid','<r xmlns:p="u" xmlns:q="v" p:a="1" q:a="2"/>'],['entities','<r a="&custom;&#x1F600; &amp;" b="&#13;&#10;">&custom;</r>'],['fragment','<r a="1"/><r a="2"/>'],['error-order','<r a="1" a="&bogus;"/>']);
function consume(api,xml,namespaceAware,chunked,documentMode){
 const options={namespaceAware,documentMode,addEntities:[{entity:'custom',value:'ok'}]};
 const bytes=new TextEncoder().encode(xml);const input=()=>chunked?{*[Symbol.iterator](){for(let i=0;i<bytes.length;i+=37)yield bytes.subarray(i,i+37);}}:bytes;
 const events=[];let eventError;
 try{for(const e of new api.EventReaderSync(input(),options))events.push({...e,attributes:e.attributes?[...e.attributes]:undefined});}catch(e){eventError=[e.name,e.message];}
 const tokens=[];let error;const r=new api.StreamReaderSync(input(),options);
 try{while(r.next()){const type=r.eventType();const t={type,attrs:[]};if(type==='START_ELEMENT'||type==='END_ELEMENT')t.name=r.name();if(['CHARACTERS','CDATA','COMMENT','DTD'].includes(type))t.text=r.text();if(t.type==='START_ELEMENT'){for(let i=0;i<r.attributeCount();i++){const n=r.attributeName(i),ns=r.attributeNamespaceURI(i),local=r.attributeLocalName(i);t.attrs.push([n,ns,local,r.attributePrefix(i),r.attributeValue(i),r.attributeValue(n),r.attributeValue(ns,local)]);}t.missing=r.attributeValue('nonexistent');}tokens.push(t);}}catch(e){error=[e.name,e.message];}
 return JSON.stringify({events,eventError,tokens,error});
}
let cases=0;
for(const [name,xml]of docs)for(const ns of [true,false])for(const chunked of [false,true])for(const mode of ['document','fragment']){
 const reference=consume(apis[0],xml,ns,chunked,mode);
 const parsed=JSON.parse(reference);
 if(/^(prefix-|first-|ends-|cardinality-|unicode-)/.test(name)){
  assert.equal(parsed.error,undefined,name);
  assert.equal(parsed.eventError,undefined,name);
  assert.equal(parsed.tokens.filter(t=>t.type==='START_ELEMENT').length,701,name);
 }
 if(name.startsWith('duplicate-')){
  assert.match(parsed.error?.[1]??'',/Duplicate attribute:/,name);
  assert.match(parsed.eventError?.[1]??'',/Duplicate attribute:/,name);
 }
 assert.equal(reference,consume(apis[1],xml,ns,chunked,mode),`${name} ns=${ns} chunked=${chunked} mode=${mode}`);cases++;
}
console.log(JSON.stringify({cases,result:'PASS'}));
