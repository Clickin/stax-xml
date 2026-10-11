// Differential parity v4: fast-path threshold edges + EXACT 64 KiB boundary splits.
//
// Boundary protocol (corrected per review):
// - Input is a single Uint8Array -> StreamReaderSync -> fixedByteChunks, which
//   slices at exactly BYTE_CHUNK_SIZE = 65536. (Iterable byte input would go
//   through batchByteChunks, which appends whole chunks: a 7-byte feed makes
//   65541-byte batches, so chunked feeds cannot target 65536 exactly.)
// - Every special's byte offset in the encoded document is asserted before
//   running, so a mis-built fixture fails loudly instead of passing vacuously.
// - Comparison is full event serialization + SHA-256, not length/prefix.

import { createHash } from "node:crypto";

const BASE = process.argv[2];
const CAND = process.argv[3];
const K = 65536;
const enc = new TextEncoder();

function byteIndexOf(bytes, needle, from = 0) {
  outer: for (let i = from; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++)
      if (bytes[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

/** Build `<r>` + a*pad + special + tail + `</r>` and assert byte layout. */
function build(B, special, tail, label) {
  const mid = special === null ? "" : special;
  const xml = `<r>${"a".repeat(B - 3)}${mid}${tail}</r>`;
  const bytes = enc.encode(xml);
  if (special === null) {
    // Crossing case: text span is [3, B + tail.length); assert 65536 is
    // strictly inside it, so the span genuinely straddles the batch split.
    if (!(K > 3 && K < B + tail.length))
      throw new Error(`fixture ${label}: 65536 not inside span [3, ${B + tail.length})`);
    return { xml, bytes, at: B };
  }
  const needle = enc.encode(special);
  const at = byteIndexOf(bytes, needle);
  if (at !== B)
    throw new Error(`fixture ${label}: special at byte ${at}, expected ${B}`);
  return { xml, bytes, at };
}

/**
 * Text span starting exactly at byte 65536: markup before it is sized so the
 * last '>' of the filler end tag lands at 65535 and the first text char at
 * 65536. Asserted on the encoded bytes.
 */
function buildSpanStartAtBoundary(tail) {
  // <r>(3) <i>(3) a*N </i>(4) = 10 + N bytes before the text.
  const N = K - 10;
  const xml = `<r><i>${"a".repeat(N)}</i>${tail}</r>`;
  const bytes = enc.encode(xml);
  if (bytes[K - 1] !== 0x3e) throw new Error(`span-start: byte 65535 is not '>'`);
  if (bytes[K] !== tail.charCodeAt(0))
    throw new Error(`span-start: byte 65536 is not the first tail char`);
  if (byteIndexOf(bytes, enc.encode(tail.slice(0, 8))) !== K)
    throw new Error(`span-start: tail not at 65536`);
  return { xml, bytes, at: K };
}

const A = "a";
const L = 200;
const cases = [];
// Threshold sweep (valid spans).
for (const len of [126, 127, 128, 129, 130, 5000])
  cases.push(["thr" + len, `<r>${A.repeat(len)}</r>`, null]);
// Invalid/interesting content inside >=128-char spans (whole-input eligible).
cases.push(["cdata-long", `<r>${A.repeat(L)}]]>${A.repeat(50)}</r>`, null]);
cases.push(["bracket-only", `<r>${A.repeat(L)}]${A.repeat(10)}</r>`, null]);
cases.push(["brackets-many", `<r>${"]a".repeat(100)}</r>`, null]);
cases.push(["ctrl-long", `<r>${A.repeat(L)}\x01${A.repeat(10)}</r>`, null]);
cases.push(["ctrl-at-0", `<r>\x01${A.repeat(L)}</r>`, null]);
cases.push(["del-0x7f", `<r>${A.repeat(L)}\x7f${A.repeat(10)}</r>`, null]);
cases.push(["fffe-long", `<r>${A.repeat(L)}\uFFFE</r>`, null]);
cases.push(["lone-high-end", `<r>${A.repeat(L)}\uD800</r>`, null]);
cases.push(["lone-high-mid", `<r>${A.repeat(L)}\uD800x${A.repeat(10)}</r>`, null]);
cases.push(["lone-low", `<r>${A.repeat(L)}\uDC00${A.repeat(10)}</r>`, null]);
cases.push(["pair-mid", `<r>${A.repeat(L)}\uD83D\uDE00${A.repeat(10)}</r>`, null]);
cases.push(["ent-mid", `<r>${A.repeat(L)}&amp;${A.repeat(L)}</r>`, null]);
cases.push(["ent-start", `<r>&amp;${A.repeat(L)}</r>`, null]);
cases.push(["ent-unknown-mid", `<r>${A.repeat(L)}&unknown;${A.repeat(L)}</r>`, null]);
cases.push(["ent-numeric-mid", `<r>${A.repeat(L)}&#x1F600;${A.repeat(L)}</r>`, null]);
cases.push(["final-tail-clean", `<r>${A.repeat(L)}`, null]);
cases.push(["final-tail-invalid", `<r>${A.repeat(L)}\x01`, null]);

// Exact 65536 boundary family: {label, special, specialByteOffset, tail}
const T = A.repeat(300);
const boundary = [
  ["bd-span-cross", null, K - 100, T], // 65733-char span crossing 65536 (special=padding only)
  ["bd-span-start-at-k", "SPAN_START", K, "z".repeat(300)], // text begins exactly at 65536
  ["bd-cdata-65535", "]]>", K - 1, T],
  ["bd-cdata-65536", "]]>", K, T],
  ["bd-cdata-65537", "]]>", K + 1, T],
  ["bd-ctrl-65535", "\x01", K - 1, T],
  ["bd-ctrl-65536", "\x01", K, T],
  ["bd-ent-65533", "&amp;", K - 3, T], // &am|p; split 3/2
  ["bd-ent-65534", "&amp;", K - 2, T], // &a|mp; split 2/3
  ["bd-ent-65535", "&amp;", K - 1, T], // &|amp; split 1/4
  ["bd-ent-65536", "&amp;", K, T], // fully in batch 2
  ["bd-ent-65538", "&amp;", K + 2, T], // |&amp; starts 2 into batch 2
  ["bd-han-65534", "한", K - 2, T], // 2-byte/1-byte UTF-8 split
  ["bd-han-65535", "한", K - 1, T], // 1-byte/2-byte UTF-8 split
  ["bd-han-65536", "한", K, T], // fully in batch 2
  ["bd-unknown-ent-65535", "&broken;", K - 1, T], // error entity split across boundary
];

// Streaming mode where the fast path actually executes inside a buffer:
// 260 spans x 300 chars (~78KB); spans after the first batch are interior
// to a 64 KiB batch with their '<' present.
const interiorDoc =
  "<root>" + Array.from({ length: 260 }, () => "<i>" + "x".repeat(300) + "</i>").join("") + "</root>";


async function collect(impl, xml, bytes) {
  const mod = await import(impl);
  try {
    let out;
    const whole = async () => {
      const r = new mod.EventReaderSync(xml, { namespaceAware: true, autoDecodeEntities: true });
      const o = [];
      for (const ev of r) o.push([ev.type, ev.name, ev.value]);
      return o;
    };
    const streamed = async () => {
      // Single Uint8Array -> fixedByteChunks -> exact 65536 decode/push boundaries.
      const r = new mod.StreamReaderSync(bytes, { namespaceAware: true, autoDecodeEntities: true });
      const o = [];
      while (true) {
        const t = r.next();
        if (t === null) break;
        o.push([t, r.name(), r.text()]);
      }
      return o;
    };
    out = await (bytes ? streamed() : whole());
    // Return the FULL serialization: comparing results below is direct
    // string equality. The digest in log lines is display shorthand only.
    return { ser: JSON.stringify(out) };
  } catch (e) {
    return { err: e.message };
  }
}

function brief(result) {
  if (result.err !== undefined) return JSON.stringify(result);
  return {
    sha: createHash("sha256").update(result.ser).digest("hex").slice(0, 16),
    len: result.ser.length,
  };
}

let mismatches = 0;
let checked = 0;
for (const [label, xml] of cases) {
  const a = await collect(BASE, xml, null);
  const b = await collect(CAND, xml, null);
  checked++;
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    mismatches++;
    console.log(`MISMATCH ${label}/whole base=${JSON.stringify(a)} cand=${JSON.stringify(b)}`);
  }
}
for (const [label, special, B, tail] of boundary) {
  const built =
    special === "SPAN_START"
      ? buildSpanStartAtBoundary(tail)
      : build(B, special ?? null, tail, label);
  const { xml, bytes, at } = built;
  for (const [mode, arg] of [["whole", null], ["stream64k", bytes]]) {
    const a = await collect(BASE, xml, arg);
    const b = await collect(CAND, xml, arg);
    checked++;
    const tag =
      special === "SPAN_START" ? "text-span" : special === null ? "span-cross" : JSON.stringify(special);
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      mismatches++;
      console.log(`MISMATCH ${label}/${mode} special=${tag}@${at} base=${JSON.stringify(brief(a))} cand=${JSON.stringify(brief(b))}`);
    } else if (mode === "stream64k") {
      console.log(`ok ${label.padEnd(24)} ${tag}@${at} -> ${JSON.stringify(brief(a))}`);
    }
  }
}
{
  const bytes = enc.encode(interiorDoc);
  const a = await collect(BASE, interiorDoc, bytes);
  const b = await collect(CAND, interiorDoc, bytes);
  checked++;
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    mismatches++;
    console.log(`MISMATCH stream-interior base=${JSON.stringify(a)} cand=${JSON.stringify(b)}`);
  } else console.log(`ok stream-interior         260x300c -> ${JSON.stringify(brief(a))}`);
}
console.log(`${checked} checks run, ${mismatches} mismatches`);
