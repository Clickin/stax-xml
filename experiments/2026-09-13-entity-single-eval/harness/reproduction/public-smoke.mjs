import assert from 'node:assert/strict';
const api=await import(process.argv[2]);
const reader=new api.EventReaderSync('<r xmlns:p="u&amp;x" a="&amp;lt;"><p:s>😀&#65;</p:s></r>');
const events=[...reader];reader.close();assert.equal(events[1].attributes.get('a').value,'&lt;');assert.equal(events[2].namespaceURI,'u&x');assert.equal(events[3].value,'😀A');
const keys=Object.keys(events[1]);assert.deepEqual(keys,['type','name','localName','prefix','namespaceURI','attributes','selfClosing','value','target','data','version','encoding','standalone']);
console.log(JSON.stringify({exports:Object.keys(api).sort(),eventKeys:keys,pass:true}));
