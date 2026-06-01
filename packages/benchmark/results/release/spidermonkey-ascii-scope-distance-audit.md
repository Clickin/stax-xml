# SpiderMonkey ASCII Scope Distance Audit

Generated: 2026-06-01T14:26:51.303Z

Audits the ASCII-only scope in the SpiderMonkey debug js-shell materialized-codegen artifact. For corpus seeds whose bytes are all <= 0x7f, String.fromCharCode over bytes produces the same JavaScript string code units as non-streaming UTF-8 TextDecoder for those spans. This reduces the materialized js-shell scope distance for ASCII corpus seeds, but it still does not make the artifact the unchanged StAX benchmark or close the emitted-code obligation.

## Summary

- All checks pass: yes
- Corpus files checked: 3
- All corpus files ASCII-only: yes
- Materialized corpus seed ASCII-only: yes
- ASCII byte materializer equals UTF-8 TextDecoder for checked ASCII spans: yes
- Reduces SpiderMonkey materialized js-shell scope distance: yes
- Closes emitted-code obligation: no
- Runtime-limit conclusion allowed: no

## Corpus Rows

| File | Bytes | Max byte | Non-ASCII bytes | UTF-8 equivalence |
| --- | ---: | ---: | ---: | --- |
| books.xml | 4551 | 122 | 0 | yes |
| midsize.xml | 14017532 | 121 | 0 | yes |
| large.xml | 105131540 | 121 | 0 | yes |

## Checks

| Check | Status | Evidence |
| --- | --- | --- |
| materialized-source-uses-ascii-byte-materializer | pass | asciiFromBytes=true; fromCharCode=true; processTag=true; foldString=true |
| materialized-workload-folds-semantic-strings | pass | sameSemanticChecksumFields=true; fullStringParity=true; materializedStringCount=245161; materializedObjectCount=223041 |
| materialized-corpus-seed-is-ascii | pass | file=G:\programming\stax-xml\packages\benchmark\assets\books.xml; maxByte=122; nonAsciiByteCount=0 |
| ascii-corpus-byte-to-string-equivalence | pass | books.xml: bytes=4551 maxByte=122 nonAscii=0; midsize.xml: bytes=14017532 maxByte=121 nonAscii=0; large.xml: bytes=105131540 maxByte=121 nonAscii=0 |
| unchanged-stax-closure-still-blocked | pass | sameContractStaxRow=false; unchangedStaxBenchmark=false; closesEmittedIrObligation=false |

## Findings

- spidermonkey-materialized-ascii-utf8-equivalence (SOURCE_FACT): For ASCII-only corpus seeds, the SpiderMonkey js-shell materializer creates the same JS string code units that UTF-8 TextDecoder would create for those byte spans.
  - allCorpusFilesAscii=true
  - materializedCorpusSeedAscii=true
  - asciiByteToStringEquivalentToUtf8=true
- spidermonkey-materialized-codegen-scope-narrowed (SCOPE_GUARD): The ASCII equivalence narrows the materialized js-shell codegen scope gap for ASCII corpus seeds but does not close the unchanged StAX emitted-code obligation.
  - reducesScopeDistance=true
  - closesCodegenObligation=false
  - conclusionAllowed=false
