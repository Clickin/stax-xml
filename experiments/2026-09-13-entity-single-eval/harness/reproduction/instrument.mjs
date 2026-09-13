import ts from '/tmp/stax-entity-single-eval/node_modules/typescript/lib/typescript.js';
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const root = process.argv[2], id = process.argv[3], out = process.argv[4];
if (!root || !id || !out) throw Error('root id out required');
const saved = new Map();
const increment = key => `(globalThis as any).__entitySingleEval.${key} = ((globalThis as any).__entitySingleEval.${key} ?? 0) + 1;`;
function transform(path) {
 let source;
 try { source = readFileSync(path,'utf8'); } catch { return; }
 saved.set(path,source);
 const sf=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true), edits=[];
 function visit(n) {
  const name=n.name?.getText(sf);
  if ((ts.isMethodDeclaration(n)||ts.isFunctionDeclaration(n)||ts.isConstructorDeclaration(n))&&n.body) {
   let prefix='';
   if(name==='decodeEntity') prefix=`(globalThis as any).__entitySingleEval ??= {}; ${increment('decodeEntity')} const __category = (globalThis as any).__entitySingleEvalPhase ?? 'validation'; (globalThis as any).__entitySingleEval[__category] = ((globalThis as any).__entitySingleEval[__category] ?? 0) + 1;`;
   if(ts.isConstructorDeclaration(n)&&n.parent.name?.text==='TokenCursor') prefix=`(globalThis as any).__entitySingleEval ??= {}; const __key = new.target === TokenCursor ? 'cursorReference' : 'cursorMaterializing'; (globalThis as any).__entitySingleEval[__key] = ((globalThis as any).__entitySingleEval[__key] ?? 0) + 1; if (options.autoDecodeEntities === false) { ${increment('rawPolicy')} }`;
   if(name==='normalizeAttributeTail'||name==='normalizeTextTail'||name==='normalizeResumedTail') prefix=increment('builder');
   if(name==='parseStart') prefix+=`if (this.resumeKind !== 0) { ${increment('retry')} }`;
   if(prefix)edits.push([n.body.getStart(sf)+1,n.body.getStart(sf)+1,prefix]);
  }
  if(ts.isCallExpression(n)&&n.expression.getText(sf)==='decodeEntities') {
   let owner=n.parent;
   while(owner&&!ts.isMethodDeclaration(owner))owner=owner.parent;
   const category=owner?.name?.getText(sf)==='parseStart'?'namespace':'materializer';
   edits.push([n.getStart(sf),n.end,`(() => { const __oldPhase = (globalThis as any).__entitySingleEvalPhase; (globalThis as any).__entitySingleEvalPhase = '${category}'; try { return ${n.getText(sf)}; } finally { (globalThis as any).__entitySingleEvalPhase = __oldPhase; } })()`]);
  }
  if(ts.isCallExpression(n)&&n.expression.getText(sf)==='parts.push') edits.push([n.getStart(sf),n.end,`((globalThis as any).__entitySingleEval.fragments = ((globalThis as any).__entitySingleEval.fragments ?? 0) + ${n.arguments.length}, ${n.getText(sf)})`]);
  if(ts.isCallExpression(n)&&n.expression.getText(sf)==='validateAndNormalizeAttributeSpan') edits.push([n.getStart(sf),n.end,`(() => { const __result = ${n.getText(sf)}; ${increment('completedValues')} if (__result === undefined) { ${increment('entityFreeValues')} } else { (globalThis as any).__entitySingleEval.outputUnits = ((globalThis as any).__entitySingleEval.outputUnits ?? 0) + __result.length; } return __result; })()`]);
  if(ts.isReturnStatement(n)&&n.expression&&n.expression.getText(sf).startsWith('this.normalizedAttributeValues[index]')) edits.push([n.getStart(sf),n.getStart(sf),increment('normalizedConsumed')]);
  ts.forEachChild(n,visit);
 }
 visit(sf);
 for(const [a,b,v] of edits.sort((a,b)=>b[0]-a[0]))source=source.slice(0,a)+v+source.slice(b);
 writeFileSync(path,source);
}
try {
 for(const file of ['TokenCursor.ts','internal/MaterializingTokenCursor.ts','internal/entity-normalizer.ts']) transform(`${root}/packages/stax-xml/src/core/${file}`);
 const r=spawnSync('pnpm',['--filter=stax-xml','build'],{cwd:root,encoding:'utf8'});
 mkdirSync(out,{recursive:true});writeFileSync(`${out}/build.log`,r.stdout+r.stderr);
 if(r.status!==0)throw Error(`Instrumented build failed ${id}: ${r.stderr}`);
 cpSync(`${root}/packages/stax-xml/dist`,`${out}/dist`,{recursive:true});
} finally {for(const [path,source]of saved)writeFileSync(path,source);}
