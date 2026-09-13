import assert from 'node:assert/strict';
const {EventReaderSync, EventReader, StreamReaderSync} = await import(process.argv[2]);
const id=process.argv[3];
const xml='<root xmlns:p="urn:a&amp;b" a="&amp;&lt;&#65;" empty="&empty;"><p:r b="한글😀"/>text&amp;</root>';
for(const api of ['sync','async','raw','stream']) {
 globalThis.__entitySingleEval={};const options={addEntities:[{entity:'empty',value:''}],autoDecodeEntities:api!=='raw'};
 if(api==='stream'){const reader=new StreamReaderSync(xml,options);while(reader.next()!==null){}reader.close();}
 else if(api==='async'){async function* chunks(){yield new TextEncoder().encode(xml);}const reader=new EventReader(chunks(),options);for await(const event of reader){if(event.attributes)for(const a of event.attributes.values())void a.value;void event.value;}await reader.close();}
 else {const reader=new EventReaderSync(xml,options);for(const event of reader){if(event.attributes)for(const a of event.attributes.values())void a.value;void event.value;}reader.close();}
 const c=globalThis.__entitySingleEval; console.log(JSON.stringify({id,api,c}));
 if(id==='A1'&&api!=='stream'&&api!=='raw'){assert.equal(c.validation,6);assert.equal(c.namespace??0,0);assert.equal(c.materializer,1);assert.equal(c.builder,3);}
 if(id==='AT1'&&api!=='stream'&&api!=='raw'){assert.equal(c.validation,6);assert.equal(c.namespace??0,0);assert.equal(c.materializer??0,0);}
 if(api==='stream')assert.equal(c.cursorMaterializing??0,0);
}
