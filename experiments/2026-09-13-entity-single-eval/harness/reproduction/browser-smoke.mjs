const cases = ['<r a="&amp;&lt;&gt;&quot;&apos;">&amp;lt;&#65;&#x1f600;</r>', '<r xmlns:p="urn:a&amp;b" p:a="&empty;" b="&literalAmp;">한😀</r>', '<r a="한😀">plain</r>', '<r a="\ud800"/>', '<r>&unknown;</r>', '<r a="&#0;"/>', '<r>bad]]></r>', '<?xml version="1.0"?><r><![CDATA[&amp;]]><!--x--><?p data?></r>'];
const options = { namespaceAware: true, autoDecodeEntities: true, addEntities: [{ entity: 'empty', value: '' }, { entity: 'literalAmp', value: '&amp;' }] };
function canonical(event) {
  return Object.keys(event).map(key => [key, typeof event[key], key === 'attributes' && event[key] instanceof Map ? [...event[key]].map(([name, attr]) => [name, Object.keys(attr).map(k => [k, typeof attr[k], attr[k]])]) : event[key]]);
}
function sync(api, input, opts) {
  const reader = new api.EventReaderSync(input, opts), events = [];
  let error;
  try { for (const event of reader) events.push(canonical(event)); }
  catch (e) { error = [e.constructor.name, e.message]; }
  finally { reader.close(); }
  return { events, error };
}
async function asyncTrace(api, bytes, chunks, opts) {
  const input = (async function* () { let offset = 0; for (const length of chunks) { yield bytes.subarray(offset, offset + length); offset += length; } if (offset < bytes.length) yield bytes.subarray(offset); })();
  const reader = new api.EventReader(input, opts), events = [];
  let error;
  try { for await (const event of reader) events.push(canonical(event)); }
  catch (e) { error = [e.constructor.name, e.message]; }
  finally { await reader.close(); }
  return { events, error };
}
export async function correctness(api, byteInputs = true) {
  const rows = [];
  for (let index = 0; index < cases.length; index++) {
    for (const raw of [false, true]) {
      const opts = { ...options, autoDecodeEntities: !raw }, input = cases[index];
      rows.push({ index, raw, mode: 'string', result: sync(api, input, opts) });
      if (byteInputs) {
        const bytes = new TextEncoder().encode(input);
        rows.push({ index, raw, mode: 'bytes', result: sync(api, bytes, opts) });
        for (let split = 1; split < bytes.length; split++) rows.push({ index, raw, mode: `split-${split}`, result: await asyncTrace(api, bytes, [split], opts) });
        for (const size of [1, 2, 3]) rows.push({ index, raw, mode: `chunks-${size}`, result: await asyncTrace(api, bytes, Array.from({ length: Math.floor(bytes.length / size) }, () => size), opts) });
      }
    }
  }
  return rows;
}
export function ordinary(api, source) {
  const reader = new api.EventReaderSync(source, options), ring = new Array(256);
  let count = 0, checksum = 0;
  const started = Date.now();
  for (const event of reader) {
    ring[count++ & 255] = event;
    const text = JSON.stringify(canonical(event));
    for (let i = 0; i < text.length; i++) checksum = Math.imul(checksum ^ text.charCodeAt(i), 16777619) | 0;
  }
  reader.close();
  return { count, checksum, ms: Date.now() - started, retained: ring.filter(Boolean).length };
}
function oneRetained(api, index, mode, scenario) {
  const id = `value-${index}-` + 'x'.repeat(32), value = scenario === 'none' ? id : '&amp;' + id;
  const source = `<root><r a="${value}">${value}</r><pad>${String(index).padStart(16, '0')}${'.'.repeat(262144)}</pad></root>`;
  const reader = new api.EventReaderSync(source, options), kept = [];
  let target = false;
  for (const event of reader) {
    if (event.type === 'START_ELEMENT' && event.name === 'r') { kept.push(event.attributes.get('a').value); target = true; }
    else if (event.type === 'CHARACTERS' && target) kept.push(event.value);
    else if (event.type === 'END_ELEMENT' && event.name === 'r') target = false;
  }
  reader.close();
  if (mode === 'positive-control') kept.push(source);
  return kept;
}
export function retain(api, mode, scenario) {
  const kept = [];
  for (let index = 0; index < 16; index++) kept.push(...oneRetained(api, index, mode, scenario));
  return kept;
}
