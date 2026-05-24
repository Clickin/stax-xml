# Firefox/SpiderMonkey Allocation Profile

Generated: 2026-05-24T11:47:59.737Z

This report is an ALLOCATION_FACT_LIMIT artifact for Firefox/SpiderMonkey host process-tree memory evidence.
It is not row-level JS heap proof, not portable browser RSS, and not a JavaScript runtime ceiling proof.

## Summary

- Scanned Firefox artifacts: 10
- Variant host-memory rows: 14
- Aggregate host-memory rows: 22
- Full-string probe rows: 12
- Max working set: 9414.8 MiB
- Max private bytes: 9421.2 MiB
- Max process count: 12

## Variant Host-Memory Rows

| Source | Case | Fixture | Events | Checksum | Max working set | Max private bytes |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| firefox-bidi-candidate-headroom-books-corpus.json | stringFull | books.xml 1.00 GiB | 57096514 | -540013997 | 807.2 MiB | 647.8 MiB |
| firefox-bidi-candidate-headroom-books-corpus.json | eventObjectFull | books.xml 1.00 GiB | 57096514 | -540013997 | 879.8 MiB | 720.2 MiB |
| firefox-bidi-candidate-headroom-books-corpus.json | rawFrameNameId | books.xml 1.00 GiB | 57096514 | -540013997 | 761.4 MiB | 605.9 MiB |
| firefox-bidi-candidate-headroom-corpus.json | stringFull | treebank_e.xml 1.00 GiB | 75206126 | -925527041 | 1065.0 MiB | 1007.7 MiB |
| firefox-bidi-candidate-headroom-corpus.json | eventObjectFull | treebank_e.xml 1.00 GiB | 75206126 | -925527041 | 1220.2 MiB | 1164.9 MiB |
| firefox-bidi-candidate-headroom-corpus.json | rawFrameNameId | treebank_e.xml 1.00 GiB | 75206126 | -925527041 | 1060.5 MiB | 1002.8 MiB |
| firefox-bidi-candidate-headroom-projection.json | stringFull | projection-cycle 1.00 GiB | 60416563 | 1441552024 | 673.6 MiB | 549.7 MiB |
| firefox-bidi-candidate-headroom-projection.json | eventObjectFull | projection-cycle 1.00 GiB | 60416563 | 1441552024 | 724.1 MiB | 566.6 MiB |
| firefox-bidi-candidate-headroom-projection.json | rawFrameNameId | projection-cycle 1.00 GiB | 60416563 | 1441552024 | 702.6 MiB | 564.3 MiB |
| firefox-bidi-candidate-headroom-projection.json | projectionLowSelectivity | projection-cycle 1.00 GiB | 33382 | -403434369 | 676.0 MiB | 551.7 MiB |
| firefox-bidi-candidate-headroom-projection.json | projectionHighSelectivity | projection-cycle 1.00 GiB | 3179819 | -2078190377 | 691.6 MiB | 553.3 MiB |
| firefox-bidi-candidate-headroom.json | stringFull | diverse-cycle 1.00 GiB | 45189256 | 1421012805 | 783.2 MiB | 623.3 MiB |
| firefox-bidi-candidate-headroom.json | eventObjectFull | diverse-cycle 1.00 GiB | 45189256 | 1421012805 | 956.2 MiB | 794.4 MiB |
| firefox-bidi-candidate-headroom.json | rawFrameNameId | diverse-cycle 1.00 GiB | 45189256 | 1421012805 | 775.6 MiB | 617.4 MiB |

## Findings

- firefox-host-process-memory-evidence-present (ALLOCATION_FACT_LIMIT): Firefox/SpiderMonkey release artifacts include Windows host process-tree memory evidence for same-contract browser rows.
  - variantHostMemoryRows=14
  - aggregateHostMemoryRows=22
  - fullStringProbeRows=12
- not-js-heap-or-portable-rss (SCOPE_GUARD): Firefox does not expose Chromium performance.memory in page context; these counters are host process-tree evidence, not row-level JS heap proof or portable browser RSS.
  - Rows remain non-counterexamples under the bounded JS heap proof rule.
  - The separate Firefox memory API source-pin audit records the page API absence.

## Scope Limits

- This artifact closes the missing non-V8 browser allocation-evidence family only at the host process-tree level.
- It does not make Firefox rows bounded-memory counterexamples under the row-level JS heap proof rule.
- It does not cover Safari/WebKit browser rows.
