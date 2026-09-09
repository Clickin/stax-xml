import { performance } from 'node:perf_hooks';
import { initWasm, WasmTokenInputSession, NEED_INPUT } from '/Users/senghyunjo/github/stax-xml/packages/wasm/dist/index.js';
import assert from 'node:assert/strict';
const encoder = new TextEncoder();
const results = [];
for (const variant of ['scalar', 'simd']) {
  await initWasm({ variant });
  for (const size of [16384, 32768, 65536]) {
    const bytes = encoder.encode(`<r a="${'x'.repeat(size)}">${'y'.repeat(size)}<!--${'z'.repeat(size)}--><![CDATA[${'w'.repeat(size)}]]></r>`);
    const timings = [];
    for (let run = 0; run < 4; run++) {
      const session = new WasmTokenInputSession({});
      let tokens = 0;
      const start = performance.now();
      for (let offset = 0; offset < bytes.length; offset += 16) {
        session.pushBytes(bytes.subarray(offset, offset + 16), offset + 16 >= bytes.length);
        for (;;) {
          const type = session.cursor.next();
          if (type === NEED_INPUT || type === null) break;
          tokens++;
          if (type === 'START_ELEMENT') assert.equal(session.cursor.attributeValue(0), 'x'.repeat(size));
        }
      }
      const elapsed = performance.now() - start;
      assert.equal(tokens, 7);
      session.dispose();
      if (run > 0) timings.push(elapsed);
    }
    timings.sort((a,b)=>a-b);
    results.push({variant, size, chunkBytes:16, medianMs:timings[1]});
  }
}
console.log(JSON.stringify(results,null,2));
