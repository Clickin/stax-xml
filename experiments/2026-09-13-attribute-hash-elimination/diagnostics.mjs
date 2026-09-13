import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [build,fixture,mode='cold',ns='true']=process.argv.slice(2);
const start=performance.now();const api=await import(pathToFileURL(`${build}/index.js`));const importMs=performance.now()-start;
const input=fs.readFileSync(fixture);
if(mode==='cold'){
 const t=performance.now();const r=new api.EventReaderSync(input,{namespaceAware:ns==='true',documentMode:'fragment'});const constructorMs=performance.now()-t;r.close();console.log(JSON.stringify({importMs,constructorMs}));
}else{
 const samples=[];let message;
 for(let i=0;i<20;i++){const t=performance.now();assert.throws(()=>{const r=new api.StreamReaderSync(input,{namespaceAware:ns==='true'});while(r.next()){};},e=>{message=e.message;return /Duplicate attribute:/.test(message);});samples.push(performance.now()-t);}
 console.log(JSON.stringify({message,samples}));
}
