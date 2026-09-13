import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
const [build, fixture, access='full', ns='true', repeats='3', warmups='2'] = process.argv.slice(2);
const api = await import(pathToFileURL(`${build}/index.js`));
const {x} = await import(pathToFileURL(`${build}/converter.js`));
const source = fs.readFileSync(fixture);
const options = {namespaceAware:ns==='true', documentMode:'fragment',maxEvents:20000000};
const schema=x.array(x.object({id:x.string().xpath('./@id'),name:x.string().xpath('./name'),age:x.string().xpath('./age')}),'/root/any_name/person');
const catalog=x.array(x.object({id:x.string().xpath('./@id'),title:x.string().xpath('./title'),price:x.string().xpath('./price')}),'/catalog/book');
const s=v=>v?.length??0;
function run() {
 let sum=0;
 if(access==='converter') {const rows=(fixture.includes('catalog')?catalog:schema).parseSync(source,options);for(const row of rows) for(const v of Object.values(row))sum+=s(v);return sum;}
 if(access==='event') {const ring=new Array(256);let n=0;for(const e of new api.EventReaderSync(source,options)){sum+=s(e.type)+s(e.name)+s(e.localName)+s(e.prefix)+s(e.namespaceURI)+s(e.value)+s(e.target)+s(e.data);if(e.attributes)for(const [key,a]of e.attributes)sum+=s(key)+s(a.name)+s(a.localName)+s(a.prefix)+s(a.namespaceURI)+s(a.value);ring[n++&255]=e;}for(const e of ring)sum+=s(e?.type);return sum;}
 const r=new api.StreamReaderSync(source,options);
 while(r.next()) {const type=r.eventType();sum+=s(type);if(access==='type')continue;
 if(type==='START_ELEMENT'||type==='END_ELEMENT'){sum+=s(r.name());if(access==='full'||access==='lookup')sum+=s(r.localName())+s(r.prefix())+s(r.namespaceURI());}
 else if(['CHARACTERS','CDATA','COMMENT','DTD'].includes(type))sum+=s(r.text());
 if(type==='START_ELEMENT'&&(access==='full'||access==='lookup'))for(let i=0;i<r.attributeCount();i++){const name=r.attributeName(i);sum+=s(name)+s(r.attributeLocalName(i))+s(r.attributePrefix(i))+s(r.attributeNamespaceURI(i))+s(r.attributeValue(i));if(access==='lookup')sum+=s(r.attributeValue(name));}
 }
 return sum;
}
for(let i=0;i<Number(warmups);i++)run();
const samples=[];let checksum;
for(let i=0;i<Number(repeats);i++){const before=performance.now();checksum=run();samples.push(performance.now()-before);}
console.log(JSON.stringify({build,fixture,access,namespaceAware:options.namespaceAware,bytes:source.length,checksum,samples,counters:globalThis.__hashWork??null}));
