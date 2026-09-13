import { createHash } from 'node:crypto';
const api=await import(process.argv[2]);
const encoder=new TextEncoder();
const options={addEntities:[{entity:'empty',value:''},{entity:'literal',value:'&amp;'},{entity:'bad',value:'<'}]};
const cases=['<r xmlns:p="u&amp;x" p:a="&amp;lt;" b="&empty;">한😀&#x41;]]&gt;</r>','<?xml version="1.0"?><r/>','<r a="&bad;"/>','<r a="&unknown;\u0000"/>','<r a="\u0000&unknown;"/>','<r>&unknown;]]></r>','<r>]]>&unknown;</r>','<r>&literal;</r>','<r>&amp</r>','<r a="&amp"/>','<r>😀</r>','<r>\ud800</r>','<r a="\udc00"/>','<r><good/></r><bad a="&#0;"/>','<r><![CDATA[&bad;]]><!--&bad;--><?p &bad;?></r>'];
const outputs=[];
function error(e){return [e.constructor.name,e.message];}
function event(e){return JSON.stringify(e,(k,v)=>v instanceof Map?{map:[...v],keys:Object.keys(v),json:v.toJSON()}:v);}
async function run(xml,kind,chunks,raw=false,action='all') {
 const trace=[],parts=chunks?.map(x=>encoder.encode(xml).subarray(...x));let count=0;
 const iterator={next(){trace.push(['input.next',count]);if(action==='input-throw'&&count===1)throw Error('source failure');const p=parts[count++];trace.push(['input.result',p?Buffer.from(p).toString('hex'):null]);return p?{value:p,done:false}:{done:true};},return(){trace.push(['input.return']);if(action==='return-throw')throw Error('cleanup failure');return {done:true};}};
 const source=kind==='string'?xml:kind==='sync'?{[Symbol.iterator]:()=>iterator}:{[Symbol.asyncIterator]:()=>({next:async()=>iterator.next(),return:async()=>iterator.return()})};
 const reader=kind==='async'?new api.EventReader(source,{...options,autoDecodeEntities:!raw}):new api.EventReaderSync(source,{...options,autoDecodeEntities:!raw});
 try{for(;;){trace.push(['next.request']);const n=await reader.next();trace.push(['next.result',n.done?null:event(n.value)]);if(n.done||action==='early')break;}}catch(e){trace.push(['error',...error(e)]);}finally{trace.push(['close.start']);try{await reader.close();trace.push(['close.done']);}catch(e){trace.push(['close.error',...error(e)]);}}
 outputs.push({xml,kind,chunks,raw,action,trace});
}
for(const xml of cases){const bytes=encoder.encode(xml);await run(xml,'string');for(const raw of [false,true])for(const kind of ['sync','async']){
 for(let split=1;split<bytes.length;split++)await run(xml,kind,[[0,split],[split,bytes.length]],raw);
 for(const size of [1,2,3])await run(xml,kind,Array.from({length:Math.ceil(bytes.length/size)},(_,i)=>[i*size,Math.min(bytes.length,(i+1)*size)]),raw);
}}
for(const action of ['early','return-throw','input-throw'])for(const kind of ['sync','async'])await run('<r a="&amp;"><x/></r>',kind,[[0,15],[15,24]],false,action);
// Concurrency and close while genuinely awaiting input (not synthetic END).
for(const mode of ['concurrent','close-pending']){
 const trace=[];let resolve;const pending=new Promise(r=>resolve=r);let calls=0;
 const reader=new api.EventReader({[Symbol.asyncIterator](){return{next(){trace.push(['input.next',calls]);return calls++===0?Promise.resolve({value:encoder.encode('<r/>'),done:false}):pending;},return(){trace.push(['input.return']);resolve({done:true});return Promise.resolve({done:true});}};}});
 await reader.next();await reader.next();await reader.next();const n=reader.next();if(mode==='concurrent'){try{await reader.next();}catch(e){trace.push(['concurrent',...error(e)]);}}await reader.close();trace.push(['pending',await n]);outputs.push({mode,trace});
}
for (const mode of ['normal', 'early', 'parse-error', 'cleanup-error']) {
 const trace=[];
 const stream=new ReadableStream({start(c){c.enqueue(encoder.encode(mode==='parse-error'?'<r a="&unknown;"/>':'<r a="&amp;"/>'));},cancel(){trace.push(['source.cancel']);if(mode==='cleanup-error')throw Error('cancel failed');}});
 const originalGetReader=stream.getReader.bind(stream);
 stream.getReader=()=>{const r=originalGetReader();return{read:async()=>{trace.push(['read']);const result=await r.read();trace.push(['read.result',result.done]);return result;},cancel:async()=>{trace.push(['cancel']);return r.cancel();},releaseLock:()=>{trace.push(['releaseLock']);r.releaseLock();}};};
 const reader=new api.EventReader(stream);
 try {await reader.next(); if(mode!=='early')await reader.next();}catch(e){trace.push(['error',...error(e)]);}
 trace.push(['close.start']);try{await reader.close();trace.push(['close.done']);}catch(e){trace.push(['close.error',...error(e)]);}
 outputs.push({mode:'readable-'+mode,trace,locked:stream.locked});
}
console.log(JSON.stringify({cases:outputs.length,sha256:createHash('sha256').update(JSON.stringify(outputs)).digest('hex'),outputs}));
