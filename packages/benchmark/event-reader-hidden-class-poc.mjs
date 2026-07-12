import { performance } from 'node:perf_hooks';
const { EventReaderSync } = await import(process.env.STAX_XML_MODULE ?? 'stax-xml');

const MIB = 1024 * 1024;
const runs = 12;
const warmups = 3;
const targetBytes = 16 * MIB;
const row = '<item id="42" xmlns:p="urn:p"><name>stax</name><![CDATA[payload]]><!--note--><?meta value?></item>';
const count = Math.ceil(targetBytes / row.length);
const xml = `<root>${row.repeat(count)}</root>`;

function consume() {
  let checksum = 2166136261;
  let events = 0;
  for (const event of new EventReaderSync(xml)) {
    events++;
    checksum = mix(checksum, event.type.length);
    // Deliberately read every runtime field. The TypeScript union is kept as-is;
    // undefined values are folded as zero in the uniform-shape PoC.
    checksum = fold(checksum, event.name);
    checksum = fold(checksum, event.localName);
    checksum = fold(checksum, event.prefix);
    checksum = fold(checksum, event.namespaceURI);
    checksum = fold(checksum, event.value);
    checksum = fold(checksum, event.target);
    checksum = fold(checksum, event.data);
    for (const attribute of event.attributes ?? []) {
      checksum = fold(checksum, attribute.name);
      checksum = fold(checksum, attribute.value);
      checksum = fold(checksum, attribute.localName);
      checksum = fold(checksum, attribute.prefix);
      checksum = fold(checksum, attribute.namespaceURI);
    }
  }
  return { checksum: checksum >>> 0, events };
}

function fold(seed, value) {
  if (value === undefined) return mix(seed, 0);
  let hash = mix(seed, value.length);
  for (let index = 0; index < value.length; index++) hash = mix(hash, value.charCodeAt(index));
  return hash;
}

function mix(seed, value) {
  return Math.imul((seed ^ value) >>> 0, 16777619) >>> 0;
}

for (let index = 0; index < warmups; index++) consume();
const samples = [];
let stable;
for (let index = 0; index < runs; index++) {
  globalThis.gc?.();
  const started = performance.now();
  const result = consume();
  const elapsedMs = performance.now() - started;
  if (stable && (stable.checksum !== result.checksum || stable.events !== result.events)) {
    throw new Error('unstable result');
  }
  stable = result;
  samples.push(elapsedMs);
}

const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
console.log(JSON.stringify({
  fixtureMiB: xml.length / MIB,
  runs,
  warmups,
  averageMs,
  minMs: Math.min(...samples),
  maxMs: Math.max(...samples),
  mibPerSec: xml.length / MIB / (averageMs / 1000),
  ...stable,
}, null, 2));
