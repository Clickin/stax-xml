// Micro-gate v4: design D — amp pre-check via indexOf, then either original JS loop
// (entities present) or allocation-free char-class regex scan (entity-free span).

const TEXT_RE = /[<\]]|[^\x20-\uD7FF\uE000-\uFFFD]/g; // no '&': pre-checked
const ATTR_DQ = /["<]|[^\x20-\uD7FF\uE000-\uFFFD]/g;   // attribute value, double-quoted
const ATTR_SQ = /['<]|[^\x20-\uD7FF\uE000-\uFFFD]/g;   // attribute value, single-quoted

function jsLoopInner(buffer, index, boundary) {
  for (; index < buffer.length; index++) {
    const code = buffer.charCodeAt(index);
    if (code === 60) return index;
    if (code === 93 && buffer.charCodeAt(index + 1) === 93 && buffer.charCodeAt(index + 2) === 62)
      throw new Error("]]>");
    if (code >= 32 && code < 0xd800) {
      if (code !== 38) continue;
    } else if (code < 32) {
      if (code !== 9 && code !== 10 && code !== 13) throw new Error("invalid");
      continue;
    } else if (code >= 0xd800 && code <= 0xdfff) {
      const low = buffer.charCodeAt(index + 1);
      if (code > 0xdbff || low < 0xdc00 || low > 0xdfff) throw new Error("invalid");
      index++;
      continue;
    } else if (code === 0xfffe || code === 0xffff) {
      throw new Error("invalid");
    } else {
      continue;
    }
    const semi = buffer.indexOf(";", index + 1);
    if (boundary >= 0 && (semi < 0 || semi > boundary)) throw new Error("unterminated");
    if (semi < 0) break;
    index = semi;
  }
  return -1;
}

function jsLoop(buffer, start) {
  return jsLoopInner(buffer, start, buffer.indexOf("<", start));
}

function reScanD(buffer, start) {
  const boundary = buffer.indexOf("<", start);
  const amp = buffer.indexOf("&", start);
  if (amp >= 0 && (boundary < 0 || amp < boundary))
    return jsLoopInner(buffer, start, boundary); // entities present: baseline path
  TEXT_RE.lastIndex = start;
  for (;;) {
    const m = TEXT_RE.exec(buffer);
    if (m === null) return -1;
    const index = m.index;
    const code = m[0].charCodeAt(0);
    if (code === 60) return index;
    if (code === 93) {
      if (buffer.charCodeAt(index + 1) === 93 && buffer.charCodeAt(index + 2) === 62)
        throw new Error("]]>");
      continue;
    }
    if (code >= 0xd800 && code <= 0xdfff) {
      const low = buffer.charCodeAt(index + 1);
      if (code > 0xdbff || low < 0xdc00 || low > 0xdfff) throw new Error("invalid");
      TEXT_RE.lastIndex = index + 2;
      continue;
    }
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) throw new Error("invalid");
    if (code === 0xfffe || code === 0xffff) throw new Error("invalid");
    continue;
  }
}

// Attribute-value end finder: current vs regex with quote in class.
function attrEndJs(text, start, quote) {
  const end = text.indexOf(String.fromCharCode(quote), start);
  if (end < 0) return -1;
  for (let index = start; index < end; index++) {
    const code = text.charCodeAt(index);
    if (code >= 32 && code < 0xd800) {
      if (code === 60) throw new Error("attr <");
      if (code !== 38) continue;
    } else if (code < 32) {
      if (code !== 9 && code !== 10 && code !== 13) throw new Error("invalid");
    } else if (code >= 0xd800 && code <= 0xdfff) {
      if (code > 0xdbff || index + 1 >= end) throw new Error("invalid");
      const low = text.charCodeAt(index + 1);
      if (low < 0xdc00 || low > 0xdfff) throw new Error("invalid");
      index++;
      continue;
    } else if (code < 0xfffe) {
      continue;
    } else {
      throw new Error("invalid");
    }
    if (code === 38) {
      const semi = text.indexOf(";", index + 1);
      if (semi < 0 || semi >= end) throw new Error("unterminated");
      index = semi;
    }
  }
  return end;
}

function attrEndRe(text, start, quote) {
  const amp = text.indexOf("&", start);
  const end = text.indexOf(String.fromCharCode(quote), start);
  if (amp >= 0 && (end < 0 || amp < end)) return attrEndJs(text, start, quote);
  const re = quote === 34 ? ATTR_DQ : ATTR_SQ;
  re.lastIndex = start;
  for (;;) {
    const m = re.exec(text);
    if (m === null) return -1;
    const index = m.index;
    const code = m[0].charCodeAt(0);
    if (code === quote) return index;
    if (code === 60) throw new Error("attr <");
    if (code >= 0xd800 && code <= 0xdfff) {
      const low = text.charCodeAt(index + 1);
      if (code > 0xdbff || low < 0xdc00 || low > 0xdfff) throw new Error("invalid");
      re.lastIndex = index + 2;
      continue;
    }
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) throw new Error("invalid");
    if (code === 0xfffe || code === 0xffff) throw new Error("invalid");
    continue;
  }
}

function spanText(kind, chars) {
  let out = "";
  switch (kind) {
    case "ascii": while (out.length < chars) out += "plain text run with words and more words here "; break;
    case "entities": while (out.length < chars) out += "a &lt; b &amp; c &gt; d &#234; e &#x1F600; f "; break;
    case "unicode": while (out.length < chars) out += "α β γ δ 한글 텍스트 テキスト ру́сский текст "; break;
    case "mixed": while (out.length < chars) out += "mixed text &amp; entity 한글 plain "; break;
    case "sparse": while (out.length < chars) out += "words words words words words words words words &amp; more words here "; break;
  }
  return out;
}

function attrText(kind, chars) {
  // tag-shaped: <e a0="value..." a1="..." ...>
  const parts = ["<e"];
  let n = 0;
  while (parts.join("").length < chars) {
    const v = kind === "entities" ? "a &lt; b &amp; c" : kind === "unicode" ? "α β 한글" : "value text here 123";
    parts.push(` a${n++}="${v}"`);
  }
  parts.push(">");
  return parts.join("");
}

function timeIt(fn, runs = 9, warmups = 3) {
  for (let w = 0; w < warmups; w++) fn();
  const times = [];
  for (let s = 0; s < runs; s++) {
    const t0 = process.hrtime.bigint();
    fn();
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

const kind = process.argv[2] ?? "ascii";
const mode = process.argv[3] ?? "long";
const spanLen = Number(process.argv[4] ?? 150);

if (mode === "attr") {
  const text = attrText(kind, 16 * 1024 * 1024);
  const chars = text.length;
  let sinkA = 0, sinkB = 0;
  const a = timeIt(() => { let i = text.indexOf('"') + 1; while (i >= 0 && i < chars) { const e = attrEndJs(text, i, 34); if (e < 0) break; sinkA += e; i = text.indexOf('"', e + 1); if (i < 0) break; i++; } });
  const b = timeIt(() => { let i = text.indexOf('"') + 1; while (i >= 0 && i < chars) { const e = attrEndRe(text, i, 34); if (e < 0) break; sinkB += e; i = text.indexOf('"', e + 1); if (i < 0) break; i++; } });
  console.log(`${kind}/attr chars=${(chars / 1e6).toFixed(1)}M jsLoop=${a.toFixed(1)}ms (${(chars / a / 1e3).toFixed(0)}Mc/s) reD=${b.toFixed(1)}ms (${(chars / b / 1e3).toFixed(0)}Mc/s) speedup=${(a / b).toFixed(2)}x sinks=${sinkA === sinkB ? "match" : "MISMATCH"}`);
} else if (mode === "long") {
  const buffer = spanText(kind, 16 * 1024 * 1024);
  const chars = buffer.length;
  const a = timeIt(() => jsLoop(buffer, 0));
  const b = timeIt(() => reScanD(buffer, 0));
  console.log(`${kind}/long jsLoop=${a.toFixed(1)}ms (${(chars / a / 1e3).toFixed(0)}Mc/s) reD=${b.toFixed(1)}ms (${(chars / b / 1e3).toFixed(0)}Mc/s) speedup=${(a / b).toFixed(2)}x parity=${jsLoop(buffer, 0) === reScanD(buffer, 0)}`);
} else {
  const count = Math.floor(16 * 1024 * 1024 / spanLen);
  const spans = Array.from({ length: count }, (_, i) => spanText(kind, spanLen + (i % 7)).slice(0, spanLen));
  const chars = spans.reduce((n, s) => n + s.length, 0);
  let sinkA = 0, sinkB = 0;
  const a = timeIt(() => { for (const s of spans) sinkA += jsLoop(s, 0); });
  const b = timeIt(() => { for (const s of spans) sinkB += reScanD(s, 0); });
  console.log(`${kind}/spans(${spanLen}c) jsLoop=${a.toFixed(1)}ms (${(chars / a / 1e3).toFixed(0)}Mc/s) reD=${b.toFixed(1)}ms (${(chars / b / 1e3).toFixed(0)}Mc/s) speedup=${(a / b).toFixed(2)}x sinks=${sinkA === sinkB ? "match" : "MISMATCH"}`);
}
