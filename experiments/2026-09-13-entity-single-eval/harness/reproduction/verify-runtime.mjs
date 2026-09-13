import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const ts = createRequire('/tmp/stax-entity-single-eval/packages/stax-xml/package.json')('typescript');
function runtime(path) {
  const source = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const transformed = ts.transform(source, [context => {
    const visit = node => {
      let next = ts.visitEachChild(node, visit, context);
      if (ts.canHaveModifiers(next) && ts.getModifiers(next)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) next = ts.factory.replaceModifiers(next, ts.getModifiers(next).filter(m => m.kind !== ts.SyntaxKind.ExportKeyword));
      return next;
    };
    return root => ts.visitNode(root, visit);
  }]);
  const printed = ts.createPrinter({ removeComments: true }).printFile(transformed.transformed[0]);
  transformed.dispose();
  return ts.transpileModule(printed, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, removeComments: true } }).outputText;
}
const baseline = runtime('/tmp/stax-entity-single-eval-r0/packages/stax-xml/src/core/TokenCursor.ts');
const rows = ['W0', 'A1', 'AT1'].map(variant => {
  const actual = runtime(`/tmp/stax-entity-single-eval-evidence/builds/${variant}/src/core/TokenCursor.ts`);
  if (actual !== baseline) throw new Error(`${variant}: ordinary TokenCursor runtime changed`);
  return { variant, runtimeIdentical: true, sha256: createHash('sha256').update(actual).digest('hex') };
});
console.log(JSON.stringify(rows, null, 2));
