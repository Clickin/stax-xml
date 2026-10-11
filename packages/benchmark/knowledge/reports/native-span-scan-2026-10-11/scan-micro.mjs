// Micro-gate: per-char JS validation ladder vs native scans (indexOf + irregexp char-class).
// Question: does a native char-class scan beat the current JS loop on realistic text spans?

const TEXT_RE = /[&<\]]|[^\x20-\uD7FF\uE000-\uFFFD]/g;

// Current-kernel-equivalent loop (findTextEndValidated shape, outsideRoot=false path).
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

// Candidate: single native scan; JS dispatch only at interesting chars.
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

// Floors: no-validation cost of each native primitive.
function floorIndexOf(buffer, start) { return buffer.indexOf("<", start); }
function floorRegex(buffer, start) { TEXT_RE.lastIndex = start; return TEXT_RE.exec(buffer); }

function makeDoc(kind, mb) {
  const chunks = [];
  let n = Math.floor((mb * 1024 * 1024) / 90);
  for (let i = 0; i < n; i++) {
    let text;
    if (kind === "ascii") text = `plain text run number ${i} with words and more words here `;
    else if (kind === "entities") text = `a &lt; b &amp; c &gt; d &#234; e &#x1F600; f `;
    else if (kind === "unicode") text = "α β γ δ 한글 텍스트 テキスト ру́сский текст ";
    else text = `mixed ${i} text &amp; entity 한글 `;
    chunks.push("<item>", text, "</item>");
  }
  return chunks.join("");
}

function bench(name, fn, buffer, samples = 9, warmups = 3) {
  for (let w = 0; w < warmups; w++) fn(buffer, 0);
  const times = [];
  for (let s = 0; s < samples; s++) {
    const t0 = process.hrtime.bigint();
    fn(buffer, 0);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  times.sort((a, b) => a - b);
  const med = times[Math.floor(times.length / 2)];
  console.log(`${name.padEnd(22)} median ${med.toFixed(3)} ms  (${(buffer.length / med / 1e3).toFixed(1)} Mchar/s)`);
  return med;
}

const kind = process.argv[2] ?? "ascii";
const mb = Number(process.argv[3] ?? 16);
const buffer = makeDoc(kind, mb);
console.log(`kind=${kind} chars=${(buffer.length / 1e6).toFixed(1)}M`);
const a = bench("jsLoop (current)", jsLoop, buffer);
const b = bench("reScan (candidate)", reScan, buffer);
bench("floor indexOf", floorIndexOf, buffer);
bench("floor regex exec", floorRegex, buffer);
console.log(`candidate/current speedup: ${(a / b).toFixed(2)}x`);
// parity check
if (jsLoop(buffer, 0) !== reScan(buffer, 0)) { console.log("MISMATCH"); process.exit(1); }
console.log("parity OK");
