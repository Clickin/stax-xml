import { correctness, ordinary, retain } from './browser-smoke.mjs';
const api = await import('./builds/AT1/dist/index.js');
const rows = await correctness(api, false);
const timing = ordinary(api, readFile('/Users/senghyunjo/github/stax-xml/packages/benchmark/assets/midsize.xml'));
const retention = [];
let held;
for (const scenario of ['first', 'none']) {
  for (const mode of ['normalized-result', 'positive-control']) {
    held = null;
    for (let turn = 0; turn < 5; turn++) { for (let cycle = 0; cycle < 5; cycle++) gc(); await Promise.resolve(); }
    const before = gcHeapSize();
    held = retain(api, mode, scenario);
    for (let turn = 0; turn < 5; turn++) { for (let cycle = 0; cycle < 5; cycle++) gc(); await Promise.resolve(); }
    const after = gcHeapSize();
    retention.push({ scenario, mode, count: 16, beforeGcHeapSize: before, afterGcHeapSize: after, strings: held.length, units: held.reduce((n, value) => n + value.length, 0), gcCycles: 25 });
  }
}
print(JSON.stringify({ rows, ordinary: timing, retention, byteInput: 'NOT RUN: standalone shell has no TextDecoder; no polyfill inserted' }));
