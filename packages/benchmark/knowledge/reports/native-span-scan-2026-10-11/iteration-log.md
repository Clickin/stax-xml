# Iteration log — design D → E → H → J

All ratios candidate/base wall time (paired medians, fresh processes,
alternating order). Below 1.0 = faster.

## Design D (indexOf('&') pre-check per span + char-class scan)

Node: ascii 0.858 | unicode 0.920 | entities 1.022 | mixed 1.066 |
midsize 1.166 | large 1.169.

Defect: indexOf('&') with no end bound scans to the next '&' or EOS.
Entity-free documents pay O(tail) per span. JSC (scalar indexOf) made it
quadratic: Bun 1MB=180ms, 2MB=689ms, 4MB=2739ms.

## Design E ('&' inside the class; '<' bounds every scan; first '&' defers
to the reference loop)

Node: ascii 0.957 | unicode 0.891 | entities 1.030 | mixed 1.064 |
attributes 1.002 | midsize 1.216 | large 1.184.

Bun: ascii 0.984 | unicode 1.112 | entities 1.005 | mixed 0.976.

Bounded by construction, but exec()-per-span fixed cost dominates 8.4-char
spans (real fixtures). Bun unicode regression: Yarr negated multirange
class on two-byte strings.

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

Also measured: single-negated-class encoding ([^…&…] folded) is NOT faster
than the alternation form (881 vs 974 Mc/s) — composition, not class shape,
sets the scan rate.

## Design I (threshold 128, extracted reference loop for short spans)

ascii 1.149 — the extracted loop itself is ~15% slower than the same code
inlined in findTextEndValidated (TurboFan field-load vs argument
specialization). Abandoned extraction.

## Design J (threshold 128, master's inline loop kept verbatim, native
branch only for spans ≥128 chars)

ascii ~1.00 (neutral by construction), longspan 0.63 (1.57x), midsize/large
neutral. Final.
