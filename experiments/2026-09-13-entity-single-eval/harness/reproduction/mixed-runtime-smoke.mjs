import fs from 'node:fs';
import { consumePublic, importPublicBuild, canonicalTranscript } from '/tmp/stax-entity-single-eval/packages/benchmark/entity-single-eval/consume.mjs';
const api = await importPublicBuild(process.argv[2]);
const big = fs.readFileSync('/Users/senghyunjo/github/stax-xml/packages/benchmark/assets/midsize.xml');
const small = new TextEncoder().encode('<r xmlns:p="urn:a&amp;b" a="&amp;lt;">한😀&#65;</r>');
const rows = [];
const held = [];
for (let round = 0; round < 2; round++) {
  for (const kind of ['event-sync', 'stream-sync', 'event-async', 'stream-async']) {
    for (const [size, input] of [['big', big], ['small', small]]) {
      const result = await consumePublic(api, input, { kind, namespaceAware: true, autoDecodeEntities: true, chunkSize: 65536 });
      if (result.error) throw new Error(JSON.stringify(result.error));
      rows.push({ round, kind, size, eventCount: result.eventCount, checksum: result.checksum, outputCodeUnits: result.outputCodeUnits });
      if (kind.startsWith('event')) {
        const events = result.ring.filter(Boolean);
        held.push({ events, before: JSON.stringify(canonicalTranscript(events)) });
      }
    }
  }
}
for (const item of held) if (JSON.stringify(canonicalTranscript(item.events)) !== item.before) throw new Error('Retained events changed after interleaved readers disposed');
console.log(JSON.stringify({ rows, retainedStable: true }));
