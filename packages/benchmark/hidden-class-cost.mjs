// Measures what hidden class (shape) divergence costs.
//   1. synthetic: one hot property-access site fed objects of K shapes
//   2. real: TokenCursor parse after its method ICs were polluted with K instance shapes
// Usage: node ./hidden-class-cost.mjs [--runs=15] [--skip-real]   (also runs under bun)
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};
const RUNS = arg('runs', 15);
const runtime = typeof Bun !== 'undefined' ? `bun ${Bun.version}` : `node ${process.version}`;
const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

function time(fn) {
  const ts = [];
  for (let r = 0; r < RUNS; r++) { const t = performance.now(); fn(); ts.push(performance.now() - t); }
  return median(ts);
}

// ---- 1. synthetic -----------------------------------------------------------
const N = 1024;
const HOT_SRC = `(arr) => {
  let s = 0;
  for (let it = 0; it < 20000; it++)
    for (let i = 0; i < arr.length; i++) { const o = arr[i]; s += (o.end - o.start) + o.depth + o.type; }
  return s;
}`;
function shaped(k, dictionary = false) {
  const arr = [];
  for (let i = 0; i < N; i++) {
    const o = { ['pad' + (i % k)]: 1, type: 0, start: 0, end: 0, depth: 0 };
    o.start = i; o.end = i + 3; o.depth = i & 7; o.type = i & 3;
    if (dictionary) delete o.pad0;
    arr.push(o);
  }
  return arr;
}
function synthetic() {
  console.log(`\n[synthetic] ${runtime}`);
  const cases = [['1 shape', shaped(1)], ['2 shapes', shaped(2)], ['4 shapes', shaped(4)], ['5 shapes', shaped(5)],
    ['8 shapes', shaped(8)], ['16 shapes', shaped(16)], ['dictionary mode', shaped(1, true)]];
  let base;
  for (const [label, arr] of cases) {
    const hot = (0, eval)(HOT_SRC); // fresh function => fresh feedback per case
    hot(arr);
    const ms = time(() => hot(arr));
    base ??= ms;
    console.log(`${label.padEnd(16)} ${ms.toFixed(1).padStart(7)} ms  x${(ms / base).toFixed(2)}`);
  }
}

// ---- 2. real TokenCursor -----------------------------------------------------
async function loadTokenCursor() {
  const require = createRequire(join(here, 'package.json'));
  const { buildSync } = require('esbuild'); // TokenCursor.ts uses const enum, so bundle it
  const outfile = join(mkdtempSync(join(tmpdir(), 'hidden-class-')), 'token-cursor.mjs');
  buildSync({ entryPoints: [join(here, '../stax-xml/src/core/TokenCursor.ts')], bundle: true, format: 'esm', outfile, logLevel: 'error' });
  return (await import(pathToFileURL(outfile).href)).TokenCursor;
}
async function real() {
  const TokenCursor = await loadTokenCursor();
  let xml = '<?xml version="1.0"?><root xmlns:a="u">';
  for (let i = 0; i < 20000; i++) xml += `<item id="${i}" a:k="v${i}"><name>Item &amp; ${i}</name><v>${i * 3}</v><!--c--></item>`;
  xml += '</root>';
  const parse = (make) => {
    const c = make();
    let n = 0;
    for (let t = c.next(); t !== null; t = c.next()) {
      n++;
      for (let i = 0, ac = c.attributeCount(); i < ac; i++) c.attribute(i);
    }
    return n;
  };
  const plain = () => new TokenCursor(xml, true);
  const pollute = (k) => {
    for (let r = 0; r < 300; r++) for (let s = 0; s < k; s++) {
      parse(() => { const c = new TokenCursor('<a x="1"><b>t</b></a>', true); c['__pad' + s] = s; return c; });
    }
  };
  const k = arg('k', -1);
  if (k >= 0) { // child mode
    pollute(k);
    for (let w = 0; w < 5; w++) parse(plain);
    console.log(`@@${time(() => parse(plain))}`);
  }
}

if (process.argv.includes('--child')) { await real(); }
else {
  synthetic();
  if (!process.argv.includes('--skip-real')) {
    const { spawnSync } = await import('node:child_process');
    console.log(`\n[TokenCursor real parse] ${runtime}`);
    let base;
    for (const k of [0, 1, 2, 4, 8]) {
      const out = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--child', `--k=${k}`, `--runs=${RUNS}`], { encoding: 'utf8' });
      const ms = Number(/@@([\d.]+)/.exec(out.stdout)?.[1]);
      if (!Number.isFinite(ms)) { console.error(out.stderr || out.stdout); process.exit(1); }
      base ??= ms;
      console.log(`${(k === 0 ? 'clean' : `${k} extra shapes`).padEnd(16)} ${ms.toFixed(1).padStart(7)} ms  x${(ms / base).toFixed(2)}`);
    }
  }
}
