import assert from 'node:assert/strict';
const {EventReaderSync}=await import(process.argv[2]);
const attributes=Array.from({length:16},(_,i)=>`a${i}="v${i}"`).join(' ');
const xml=`<root><r id="one" ${attributes}/><r id="two" ${attributes}/></root>`;
if(process.argv[3]==='xml')process.stdout.write(xml);
else {try{const events=[...new EventReaderSync(xml)];console.log(JSON.stringify({status:'PASS',count:events.length}));}catch(e){console.log(JSON.stringify({status:'FAIL',name:e.constructor.name,message:e.message,xml}));}}
