# Real fixture span distribution

Script: span-distribution (node, readFileSync utf8, spans = text between
'>' and '<').

| fixture | chars | spans | text chars | avg len | p50 | p90 | p99 | spans with '&' |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| midsize.xml | 13,584,398 | 709,632 | 5,981,184 | 8.4 | 9 | 13 | 31 | 0 (0.0%) |
| large.xml | 101,882,907 | 5,322,233 | 44,858,873 | 8.4 | 9 | 13 | 31 | 0 (0.0%) |

Implications:

- Text bytes are 44% of the documents; markup is 56%.
- Whole-document char-class scan cost is therefore ~2.3x the text-only
  scan cost per char parity; at measured rates (native 974 Mc/s vs ladder
  ~500 Mc/s) a whole-buffer proof pass ≈ 14.8ms vs ladder ≈ 12ms for
  midsize.xml — a net loss before any per-span overhead.
- The dominant span population is single-digit-length whitespace/indent
  runs; per-span fixed costs (RegExp.exec result-array allocation,
  function-call boundaries) exceed the ladder cost at 8 chars.
- Break-even for exec-per-span ≈ 30-60 chars; threshold chosen 128.
