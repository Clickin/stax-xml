let calls=0;
const original=Math.imul;
Math.imul=(a,b)=>{calls++;return original(a,b);};
await import('./workload.mjs');
console.log(JSON.stringify({imulCalls:calls,instrumented:true,timingValid:false}));
