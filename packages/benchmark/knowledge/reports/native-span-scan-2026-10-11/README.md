# Native char-class text scanning — evidence bundle

Date: 2026-10-11
Baseline: `9a839ffb6824a25c4cc2fa6698e860daea5b5816` (`origin/master`, v1.1.0)
Implementation: branch `perf/native-span-scan`, final design J.
Host: Apple M4, macOS 25.5.0, Node 24.21.0 (V8 13.6.233.17-node.53), Bun 1.3.14 (JSC/Yarr).

## Question

Does additional pure-JS performance headroom exist in the text-validation scan
layer (`findTextEndValidated` + `validateEntitiesSpan` family), using native
string primitives (V8 `SearchString` SIMD indexOf, irregexp compiled
char-class scans) instead of the per-char JS ladder?

Prior evidence did not cover this family: 2025-10 report (7 attempts), 2026-09
entity-single-eval NO-GO, attribute-hash-elimination NO-GO, jz wasm NO-GO,
pure-js-utf16 mixed, tier-sensitivity (Maglev→TurboFan 44% gap). None changed
the scan mechanism itself.

## Primitive result (micro)

Scan primitive, 16.8M-char spans, median of 9 (scan-micro4.mjs):

| family | JS ladder | native scan | speedup |
|---|---:|---:|---:|
| ascii long | 479 Mc/s | 1946 Mc/s | 4.06x |
| unicode long (two-byte) | 469 Mc/s | 1827 Mc/s | 3.90x |
| entities long | 505 Mc/s | 525 Mc/s | 1.04x (design D fallback) |

Headroom at the primitive level is real: 3.5-4x on entity-free spans.

## Why end-to-end transfer is bounded (real fixtures)

`midsize.xml` (13.58 MB) and `large.xml` (101.9 MB):

- text spans: 709,632 / 5,322,233, average **8.4 chars** (p50=9, p99=31)
- entity-bearing spans: **0.0%**
- text bytes: 44% of the document

Consequences measured on the iteration path:

1. **exec() fixed cost dominates short spans.** One RegExp.exec costs more
   than scanning 8 chars in the TurboFan-compiled ladder (break-even
   measured ≈ 30-60 chars; design E: midsize 1.22x slower).
2. **Unbounded indexOf('&') pre-checks are quadratic on JSC.** Design D ran
   1MB=180ms → 4MB=2739ms on Bun (scalar indexOf, no SIMD). V8's SIMD
   indexOf hid the same O(spans × tail) blowup.
3. **Markup share caps the whole-buffer proof scan.** A single regex sweep
   of midsize.xml costs 14.8ms (974 Mc/s) — it scans 100% of bytes while
   the JS ladder only ever scanned the 44% text bytes it replaced
   (~10-12ms). Net loss even with per-span cost zeroed (design H:
   midsize 1.07x, large 1.05x).
4. **The inline ladder's placement is load-bearing.** Extracting the
   identical loop into a module function (identical semantics, args
   instead of field loads) cost ~15% on span-dense documents
   (ascii SYNTH 43c spans: 56.7→66.5ms). Keep the loop inline in
   `findTextEndValidated`.

## Final design J (shipped on perf/native-span-scan)

`findTextEndValidated` keeps master's inline loop verbatim for all spans
below `NATIVE_TEXT_SCAN_MIN = 128` chars (and for outside-root spans). A
single early branch routes spans ≥128 chars through `scanTextForBoundary`
(irregexp char class, `<` bounds the scan at the span boundary, `&` returns
a sentinel that falls back to the inline loop). Attribute-value validation
and resume-path validation are unchanged from master.

Results (paired medians, fresh child processes, alternating order,
candidate/base — below 1.0 is faster):

| fixture | ratio | verdict |
|---|---:|---|
| midsize.xml (13MiB) | ~1.00 | neutral |
| large.xml (97MiB) | ~1.00 | neutral |
| SYNTH ascii (43c spans) | ~1.00 | neutral |
| SYNTH longspan (4464c spans) | **0.63 (1.57x faster)** | wins |
| SYNTH unicode | 0.87-0.96 | wins |
| SYNTH entities | ~1.00-1.03 | neutral |

(Exact numbers: final-ab-node.log, final-ab-stream.log, final-ab-bun.log.)

## Correctness

- 658/658 unit tests, W3C XML TS 805 passed / 203 baseline skips / 0 failed.
  The unit suite covers TokenCursor directly at every chunk size 1..N
  (token-cursor-resume), but its longest entity-bearing text span is 17
  chars, so the ≥128 fast path is not exercised there.
- 64/64 differential parity checks (parity2.mjs) vs baseline dist:
  whole-input EventReaderSync + chunked byte streaming, covering ]]>,
  control chars, surrogate pairs/lone halves, unknown/unterminated
  entities, attribute edge cases, custom entities, doctype, whitespace.
  **Coverage qualifier:** StreamReaderSync re-batches all byte input
  through `batchByteChunks`, which appends WHOLE input chunks until the
  64 KiB limit is reached — a 7-byte chunk feed therefore produces
  65,541-byte batches (9363×7), not 65,536-byte ones. Chunked feeds
  cannot target byte offset 65536 exactly; sub-64KiB cursor boundaries
  are covered only by the unit suite (1..N code-unit chunks, longest
  entity-bearing span 17 chars — fast path not exercised there).
- 56/56 differential parity checks (parity4.mjs), the corrected
  threshold/boundary protocol:
  - Input is a single Uint8Array → StreamReaderSync → `fixedByteChunks`,
    which slices at exactly BYTE_CHUNK_SIZE = 65,536 — real 64 KiB
    decode/push boundaries.
  - Every fixture's special is offset-ASSERTED in the encoded bytes
    before running (mis-built fixtures throw, not pass vacuously).
  - Comparison is full event serialization + SHA-256 (parity3 compared
    only length + first 80 chars).
  - Coverage: span lengths 126/127/128/129/130/5000; invalid/valid
    content inside ≥128-char spans; specials at exact offsets 65535/65536/
    65537 (]]>), 65535/65536 (control), 65533–65538 (`&amp;` split at
    every alignment), 65534–65536 (한, both UTF-8 split shapes), split
    `&broken;` error; spans crossing 65536 and starting exactly at 65536;
    plus a 260×300-char interior-span streaming document (the only
    streaming shape in which the fast path executes inside a buffer).
  - Superseded: parity3.mjs's boundary family was mis-built — specials
    landed ~93–97 bytes before 65536 (the 3-byte `<r>` was not accounted
    for), `bd-cdata-straddle` (65,492 B) and `bd-multibyte` (65,514 B)
    never reached 64 KiB at all, and its 7-byte feed produced 65,541-byte
    batches. Its threshold and invalid-placement families remain valid.
- History note: the first parity script fed string chunks to
  StreamReaderSync; both sides threw the identical TypeError, so that
  pass was vacuous. parity2.mjs switched to the real byte-chunk path.

## Verdict

Conditional GO. Primitive headroom is proven (3.5-4x). End-to-end, the win
exists only for documents with long text runs (≥128 chars/span: prose-heavy
XML — XHTML/DOCX/RSS/TEI-like). The repository's own fixtures (span-dense
records, 8.4c average) are exactly at engine parity for this technique and
remain neutral by construction. Bun/JSC: ascii neutral, unicode slightly
slower (Yarr two-byte negated-class scan), documented as a promotion
consideration.

New negative patterns recorded for future experiments (measured effects;
engine-internal causes are hypotheses, see below):

- Native scans must be bounded by the span they serve: an indexOf pre-check
  with no end bound made Bun wall time scale quadratically (measured
  1MB=180ms → 4MB=2739ms).
- exec()-per-span fixed cost exceeds the JS ladder below ~30-60 char spans
  (measured break-even; the allocation profile of RegExpBuiltinExec is the
  suspected, unverified mechanism).
- Whole-buffer proof scans pay the markup share that the ladder never paid
  (measured: 14.8ms regex sweep vs ~12ms of ladder work on midsize.xml).
- Do not extract the inline validation ladder: extraction alone cost ~15%
  on span-dense documents (measured 56.7→66.5ms on ascii SYNTH).

Engine-internal attributions are hypotheses, not traced causes: "JSC lacks
SIMD in String.indexOf" and "TurboFan field-load specialization vs argument
passing / bounds-check elimination" both explain the measurements, but no
engine trace or custom build isolated either mechanism. The V8 SIMD
SearchString claim for indexOf is documented upstream; the JSC side was
inferred from the quadratic scaling alone.

## Files

- scan-micro*.mjs — primitive micro-benchmarks (designs A/C/D iterations).
- micro-outputs.txt — captured micro runs.
- span-distribution.md — real fixture span/entity analysis.
- iteration-log.md — D/E/H measurement history (negative intermediates).
- parity2.mjs, parity-log.txt — differential correctness (64KiB-bounded
  streaming; see qualifier above).
- parity3.mjs, parity3-log.txt — threshold-edge parity (valid) and a
  mis-built boundary family (superseded; see Correctness).
- parity4.mjs, parity4-run.log — corrected threshold/boundary protocol:
  exact-65536 fixedByteChunks input, offset-asserted specials, full
  serialization + SHA-256 comparison. 56/56.
- final-results.txt — design J summary numbers.
