# Iteration log — design D → E → H → I → J

All ratios candidate/base wall time (paired medians, fresh processes,
alternating order). Below 1.0 = faster. Engine-internal mechanisms are
labelled hypotheses; the measurements themselves are the evidence.

## Design D (indexOf('&') pre-check per span + char-class scan)

Node: ascii 0.858 | unicode 0.920 | entities 1.022 | mixed 1.064 |
attributes 1.002 | midsize 1.166 | large 1.169.

Defect: indexOf('&') with no end bound scans to the next '&' or EOS.
Entity-free documents pay O(tail) per span. Bun wall time scaled
quadratically (1MB=180ms → 2MB=689ms → 4MB=2739ms). Suspected mechanism:
JSC scalar string search without SIMD (hypothesis; not traced). V8's
indexOf hid the same O(spans × tail) blowup.

## Design E ('&' inside the class; '<' bounds every scan; first '&' defers
to the reference loop)

Node: ascii 0.957 | unicode 0.891 | entities 1.030 | mixed 1.064 |
attributes 1.002 | midsize 1.216 | large 1.184.

Bun: ascii 0.984 | unicode 1.112 | entities 1.005 | mixed 0.976.

Bounded by construction, but exec()-per-span fixed cost dominates 8.4-char
spans (real fixtures). Bun unicode regression: Yarr negated multirange
class on two-byte strings (attribution by elimination; not traced).

## Design H (whole-buffer proof memo `textScanCleanTo`, whitespace excluded
from the class)

Node: ascii 0.911 | unicode 0.959 | entities 1.025 | mixed 1.069 |
midsize 1.068 | large 1.045 | stream-midsize 1.102.

Trap found: TAB/LF/CR inside the negated class made every whitespace text
span (the p50=9-char population) match; per-match exec destroyed the memo.
Fixing the class to exclude \t\n\r recovered to the numbers above.

Residual: the proof regex pass itself. midsize.xml full sweep = 14.8ms
(974 Mc/s, 0 matches). The JS ladder it replaces only ever scanned text
bytes (44% of the document, ~10-12ms). Net loss on markup-dense fixtures.

Also measured: single-negated-class encoding (folded, no alternation) is
NOT faster (881 vs 974 Mc/s) — composition, not class shape, sets the rate.

## Design I (threshold 128, extracted reference loop for short spans)

ascii 1.149 — the extracted loop itself is ~15% slower than the same code
inlined in findTextEndValidated (measured 56.7→66.5ms on 43-char-span
ascii). Suspected mechanism: TurboFan field-load specialization vs
argument passing and/or bounds-check elimination differences (hypothesis;
not established by traces — no --trace-turbo graph was inspected).
Abandoned extraction.

## Design J (threshold 128, master's inline loop kept verbatim, native
branch only for spans ≥128 chars)

ascii ~1.00 (neutral by construction), longspan 0.650 (1.54x), midsize/
large neutral, streaming neutral, Bun neutral. Correctness coverage
including threshold edges and 64 KiB decode boundaries: see README
(parity3.mjs, 58/58).
