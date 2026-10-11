// Differential parity v3: fast-path threshold edges + 64KiB decode/push boundary straddles.
const BASE = process.argv[2];
const CAND = process.argv[3];

const A = "a";

function cases() {
  const list = [];
  // Threshold sweep: span lengths around NATIVE_TEXT_SCAN_MIN (128).
  for (const len of [126, 127, 128, 129, 130, 5000]) {
    list.push(["thr" + len, `<r>${A.repeat(len)}</r>`]);
  }
  // Invalid/interesting content inside spans well above the threshold.
  const L = 200;
  list.push(["cdata-long", `<r>${A.repeat(L)}]]>${A.repeat(50)}</r>`]);
  list.push(["bracket-only", `<r>${A.repeat(L)}]${A.repeat(10)}</r>`]);
  list.push(["brackets-many", `<r>${"]a".repeat(100)}</r>`]);
  list.push(["ctrl-long", `<r>${A.repeat(L)}\x01${A.repeat(10)}</r>`]);
  list.push(["ctrl-at-0", `<r>\x01${A.repeat(L)}</r>`]);
  list.push(["del-0x7f", `<r>${A.repeat(L)}\x7f${A.repeat(10)}</r>`]);
  list.push(["fffe-long", `<r>${A.repeat(L)}\uFFFE</r>`]);
  list.push(["lone-high-end", `<r>${A.repeat(L)}\uD800</r>`]);
  list.push(["lone-high-mid", `<r>${A.repeat(L)}\uD800x${A.repeat(10)}</r>`]);
  list.push(["lone-low", `<r>${A.repeat(L)}\uDC00${A.repeat(10)}</r>`]);
  list.push(["pair-mid", `<r>${A.repeat(L)}\uD83D\uDE00${A.repeat(10)}</r>`]);
  // Entities inside long spans (fall back to the inline loop via sentinel).
  list.push(["ent-mid", `<r>${A.repeat(L)}&amp;${A.repeat(L)}</r>`]);
  list.push(["ent-start", `<r>&amp;${A.repeat(L)}</r>`]);
  list.push(["ent-unknown-mid", `<r>${A.repeat(L)}&unknown;${A.repeat(L)}</r>`]);
  list.push(["ent-numeric-mid", `<r>${A.repeat(L)}&#x1F600;${A.repeat(L)}</r>`]);
  // Final tail without '<': boundary < 0 keeps the reference loop by construction.
  list.push(["final-tail-clean", `<r>${A.repeat(L)}`]);
  list.push(["final-tail-invalid", `<r>${A.repeat(L)}\x01`]);
  return list;
}

// 64KiB decode/push boundary straddles: StreamReaderSync re-batches all byte
// input to 64 KiB, so these place long spans and their payloads across offset
// 65536 exactly — the real streaming boundaries.
function boundaryCases() {
  const K = 65536;
  const list = [];
  const span = (pad, tail) => `<r>${A.repeat(pad)}${tail}</r>`;
  // Long span crossing 65536 (3 for '<r>' → text starts at 3).
  list.push(["bd-span-cross", span(K - 100, A.repeat(300))]);
  // Entity right after the boundary inside a crossing span.
  list.push(["bd-entity-after", span(K - 100, `&amp;${A.repeat(300)}`)]);
  // Invalid control char right after the boundary.
  list.push(["bd-ctrl-after", span(K - 100, `\x01${A.repeat(300)}`)]);
  // ]]> straddling the boundary (']' before, ']]>' body across).
  list.push(["bd-cdata-straddle", `<r>${A.repeat(K - 100 - 3)}]]>${A.repeat(50)}</r>`]);
  // Multi-byte UTF-8 char (한, 3 bytes) straddling the boundary.
  const han = "한".repeat(10);
  list.push(["bd-multibyte", `<r>${A.repeat(K - 100 - 5)}${han}${A.repeat(50)}</r>`]);
  // Entity itself straddling: '&am' before 65536, 'p;' after.
  list.push(["bd-entity-straddle", `<r>${A.repeat(K - 100 - 3)}&amp;${A.repeat(300)}</r>`]);
  return list;
}

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
    return { ok: JSON.stringify(out).length, head: JSON.stringify(out).slice(0, 80) };
  } catch (e) {
    return { err: e.message };
  }
}

let mismatches = 0;
let checked = 0;
for (const [label, xml] of [...cases(), ...boundaryCases()]) {
  for (const chunked of [false, true]) {
    const a = await collect(BASE, xml, chunked);
    const b = await collect(CAND, xml, chunked);
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      mismatches++;
      console.log(`MISMATCH ${label} chunked=${chunked}`);
      console.log(`  base: ${JSON.stringify(a).slice(0, 160)}`);
      console.log(`  cand: ${JSON.stringify(b).slice(0, 160)}`);
    }
  }
}
console.log(`${checked} checks run, ${mismatches} mismatches`);

// Sanity: confirm which side actually throws/exits ok for key invalid cases,
// so a double-pass is not masking a missed fast path.
const key = `<r>${A.repeat(200)}]]>${A.repeat(50)}</r>`;
console.log("cdata-long whole:", JSON.stringify(await collect(CAND, key, false)));
console.log("ctrl-long whole:", JSON.stringify(await collect(CAND, `<r>${A.repeat(200)}\x01</r>`, false)));
