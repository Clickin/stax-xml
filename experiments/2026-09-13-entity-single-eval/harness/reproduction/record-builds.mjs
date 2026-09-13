import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fingerprintDist} from '/tmp/stax-entity-single-eval/packages/benchmark/entity-single-eval.mjs';
const evidence='/tmp/stax-entity-single-eval-evidence';
for(const instrumented of [false,true]){
 const variants=[];
 for(const [id,normalization] of [['R0','reference'],['W0','wiring'],['A1','attributes'],['AT1','attributes-text']]){
  const dist=`${evidence}/${instrumented?'instrumented':'builds'}/${id}/dist`;
  if(!existsSync(`${dist}/index.js`))continue;
  const patch=id==='R0'?null:createHash('sha256').update(readFileSync(`${evidence}/candidates/${id}.patch`)).digest('hex');
  const fingerprint=fingerprintDist(dist);
  variants.push({id,entry:`${dist}/index.js`,converterEntry:`${dist}/converter.js`,sourceSha:'9a839ffb6824a25c4cc2fa6698e860daea5b5816',patchSha256:patch,distSha256:fingerprint.sha256,normalization,instrumented});
  writeFileSync(`${evidence}/${instrumented?'instrumented':'builds'}/${id}/dist-files.json`,JSON.stringify(fingerprint.entries,null,2));
 }
 writeFileSync(`${evidence}/${instrumented?'instrumented-builds':'builds'}.json`,JSON.stringify({schemaVersion:1,baselineSha:'9a839ffb6824a25c4cc2fa6698e860daea5b5816',variants,fixtureSeed:260913,processOrderSeed:90317},null,2));
}
