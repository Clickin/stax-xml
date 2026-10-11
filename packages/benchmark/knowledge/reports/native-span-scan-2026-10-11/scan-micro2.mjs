// Micro-gate v2: measure scan over actual text spans (no leading '<').

const TEXT_RE = /[&<\]]|[^\x20-\uD7FF\uE000-\uFFFD]/g;

function jsLoop(buffer, start) {
  const boundary = buffer.indexOf("<", start);
  for (let index = start; index < buffer.length; index++) {
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

function reScan(buffer, start) {
  TEXT_RE.lastIndex = start;
  for (;;) {
    const m = TEXT_RE.exec(buffer);
    if (m === null) return -1;
    const index = m.index;
    const code = m[0].charCodeAt(0);
    if (code === 60) return index;
    if (code === 38) {
      const semi = buffer.indexOf(";", index + 1);
      if (semi < 0) return -1;
      TEXT_RE.lastIndex = semi + 1;
      continue;
    }
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

function spanText(kind, chars) {
  let out = "";
  switch (kind) {
    case "ascii": while (out.length < chars) out += "plain text run with words and more words here "; break;
    case "entities": while (out.length < chars) out += "a &lt; b &amp; c &gt; d &#234; e &#x1F600; f "; break;
    case "unicode": while (out.length < chars) out += "α β γ δ 한글 텍스트 テキスト ру́сский текст "; break;
    case "mixed": while (out.length < chars) out += "mixed text &amp; entity 한글 plain "; break;
  }
  return out;
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
const mode = process.argv[3] ?? "long"; // long | spans

if (mode === "long") {
  const buffer = spanText(kind, 16 * 1024 * 1024);
  const chars = buffer.length;
  const a = timeIt(() => jsLoop(buffer, 0));
  const b = timeIt(() => reScan(buffer, 0));
  console.log(`${kind}/long chars=${(chars / 1e6).toFixed(1)}M jsLoop=${a.toFixed(1)}ms (${(chars / a / 1e3).toFixed(0)}Mc/s) reScan=${b.toFixed(1)}ms (${(chars / b / 1e3).toFixed(0)}Mc/s) speedup=${(a / b).toFixed(2)}x parity=${jsLoop(buffer, 0) === reScan(buffer, 0)}`);
} else {
  const spanLen = Number(process.argv[4] ?? 150);
  const count = Math.floor(16 * 1024 * 1024 / spanLen);
  const spans = Array.from({ length: count }, (_, i) => spanText(kind, spanLen + (i % 7)).slice(0, spanLen));
  const chars = spans.reduce((n, s) => n + s.length, 0);
  let sinkA = 0, sinkB = 0;
  const a = timeIt(() => { for (const s of spans) sinkA += jsLoop(s, 0); });
  const b = timeIt(() => { for (const s of spans) sinkB += reScan(s, 0); });
  console.log(`${kind}/spans(${spanLen}c x ${(count / 1000).toFixed(0)}k) chars=${(chars / 1e6).toFixed(1)}M jsLoop=${a.toFixed(1)}ms (${(chars / a / 1e3).toFixed(0)}Mc/s) reScan=${b.toFixed(1)}ms (${(chars / b / 1e3).toFixed(0)}Mc/s) speedup=${(a / b).toFixed(2)}x sinks=${sinkA === sinkB ? "match" : "MISMATCH"}`);
}
