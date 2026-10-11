// Differential parity v2: baseline vs candidate must produce identical results/errors.
// Streaming path now really runs: byte chunks through TextDecoder + TokenCursor.push.

const BASE = process.argv[2];
const CAND = process.argv[3];

const cases = [
  "<r>a]]>b</r>",
  "<r>a]]b</r>",
  "<r>a\x01b</r>",
  "<r>a\x09b\x0ac\x0bd</r>",
  "<r>a&#xFFFE;b</r>",
  "<r>\uD800</r>",
  "<r>\uDC00x</r>",
  "<r>\uD83D\uDE00</r>",
  "<r>a&unknown;b</r>",
  "<r>a&untermin</r>",
  "<r>ok &lt; ok</r>",
  "<r>\uFFFD\uFFFE</r>",
  "<r>text</r>",
  "<r></r>",
  " <r/> ",
  "x<r/>",
  '<r a="1" a="2"/>',
  "<r a='<'/>",
  '<r a="&lt;ok"/>',
  '<r a="&#x1F600;"/>',
  '<r a="bad\x02char"/>',
  "<r a='dq\"inside'/>",
  '<r a="sq\'inside"/>',
  '<r a="a&amp;b" b="c"/>',
  "<r a=\"unterminated/>",
  "<r>" + "a".repeat(5000) + "]]&gt;" + "b".repeat(5000) + "</r>",
  "<r>" + "x".repeat(3000) + "&amp;" + "y".repeat(3000) + "</r>",
  "<r>" + "한".repeat(2000) + "</r>",
  "<r>" + "]".repeat(100) + "</r>",
  "<r>\n\t indent <i/>\n\t more\t\n</r>",
  "<?xml version='1.0'?><r><!-- c --><?pi data?></r>",
  "<!DOCTYPE r [<!ENTITY e 'v'>]><r>&e;</r>",
];

async function collect(impl, xml, chunked) {
  const mod = await import(impl);
  try {
    let out;
    if (chunked) {
      const bytes = new TextEncoder().encode(xml);
      function* chunks() {
        for (let i = 0; i < bytes.length; i += 7) yield bytes.subarray(i, i + 7);
      }
      const r = new mod.StreamReaderSync(chunks(), {
        namespaceAware: true,
        autoDecodeEntities: true,
      });
      out = [];
      while (true) {
        const t = r.next();
        if (t === null) break;
        out.push([t, r.name(), r.text()]);
      }
    } else {
      const r = new mod.EventReaderSync(xml, {
        namespaceAware: true,
        autoDecodeEntities: true,
      });
      out = [];
      for (const ev of r) out.push([ev.type, ev.name, ev.value]);
    }
    return { ok: JSON.stringify(out) };
  } catch (e) {
    return { err: e.message };
  }
}

let mismatches = 0;
for (const [i, xml] of cases.entries()) {
  for (const chunked of [false, true]) {
    const a = await collect(BASE, xml, chunked);
    const b = await collect(CAND, xml, chunked);
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      mismatches++;
      console.log(`MISMATCH #${i} chunked=${chunked}: ${JSON.stringify(xml.slice(0, 60))}`);
      console.log(`  base: ${JSON.stringify(a).slice(0, 220)}`);
      console.log(`  cand: ${JSON.stringify(b).slice(0, 220)}`);
    }
  }
}
console.log(mismatches === 0 ? `ALL ${cases.length * 2} parity checks passed` : `${mismatches} MISMATCHES`);
