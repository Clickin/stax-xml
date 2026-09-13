const { EventReader } = await import(process.argv[2]);
const bytes = new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8"?><root/>');
for (const size of [1,2,3,64]) {
 async function* chunks() { for(let i=0;i<bytes.length;i+=size) yield bytes.subarray(i,i+size); }
 const reader=new EventReader(chunks());console.log(size,JSON.stringify(await reader.next()));await reader.close();
}
