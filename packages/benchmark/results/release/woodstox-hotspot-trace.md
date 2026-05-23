# Woodstox HotSpot Trace

Generated: 2026-05-23T09:00:51.127Z

This report is a TRACE_FACT for one Java/HotSpot build and one XML fixture.
It captures `PrintCompilation` and `PrintInlining` for the Java + Woodstox comparator.
It is not an allocation profile and does not prove Woodstox string/object lifetime behavior.

## Environment

- Java: openjdk version "1.8.0_472"
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\runtime-comparison-16mib.xml
- Fixture size: 16.00 MiB
- Runs: warmups=4, runs=1
- Raw trace: G:\programming\stax-xml\packages\benchmark\results\woodstox-hotspot\woodstox-hotspot-trace.log
- Raw trace committed: no

## Benchmark Result

| Runtime | Throughput | Average | Events | Checksum |
| --- | ---: | ---: | ---: | ---: |
| 1.8.0_472 | 324.7 MiB/s | 49.28 ms | 967967 | -746772258 |

## HotSpot Trace Summary

| Metric | Value |
| --- | ---: |
| Compilation lines | 538 |
| Inlining lines | 2633 |
| WoodstoxBench.consume mentions | 8 |
| Woodstox internal mentions | 2448 |
| Key non-inline lines | 34 |
| PrintInlining evidence | yes |

## Key Inlining Lines

- 109  309       3       com.staxxml.benchmark.WoodstoxBench::foldString (45 bytes)
- 110  315       3       com.ctc.wstx.sr.BasicStreamReader::next (381 bytes)
- com/ctc/wstx/util/XmlChars::    110  317       3       com.ctc.wstx.sr.BasicStreamReader::nextFromTree (978 bytes)
- @ 28   com.ctc.wstx.sr.BasicStreamReader::nextFromTree (978 bytes)   callee is too large
- resetWithShared                                                                @ 9                                @ 301   com.ctc.wstx.sr.BasicStreamReader::nextFromProlog (433 bytes)   callee is too large
- com.ctc.wstx.sr.BasicStreamReader::nextFromProlog (433 bytes)                callee is too large
- @ 342  throwWfcException         com.ctc.wstx.sr.BasicStreamReader::nextFromMultiDocState    @ 157   com.ctc.wstx.util.SymbolTable::copyArrays (55 bytes)   callee is too large
- 113  344       4       com.staxxml.benchmark.WoodstoxBench::foldString (45 bytes)
- 115  309       3       com.staxxml.benchmark.WoodstoxBench::foldString (45 bytes)   made not entrant
- @ 776   com.ctc.wstx.sr.BasicStreamReader::nextFromTreeCommentOrCData (98 bytes)   callee is too large
- 120  381       4       com.ctc.wstx.sr.BasicStreamReader::next (381 bytes)
- @ 28   com.ctc.wstx.sr.BasicStreamReader::nextFromTree (978 bytes)   hot method too big
- 122  315       3       com.ctc.wstx.sr.BasicStreamReader::next (381 bytes)   made not entrant
- 122  330       3       com.ctc.wstx.sr.BasicStreamReader::getLocalName (65 bytes)
- 123  387       4       com.ctc.wstx.sr.BasicStreamReader::nextFromTree (978 bytes)
- 125  391       4       com.ctc.wstx.sr.BasicStreamReader::getLocalName (65 bytes)
- 126  330       3       com.ctc.wstx.sr.BasicStreamReader::getLocalName (65 bytes)   made not entrant
- 130  367       3       com.ctc.wstx.sr.BasicStreamReader::getText (79 bytes)
- 133  362       2       com.ctc.wstx.sr.BasicStreamReader::getAttributeLocalName (28 bytes)
- 134  364       2       com.ctc.wstx.sr.BasicStreamReader::getAttributeValue (28 bytes)
- 134  410       4       com.ctc.wstx.sr.BasicStreamReader::getText (79 bytes)
- (79 bytes)    136  412       4       com.ctc.wstx.sr.BasicStreamReader::getAttributeLocalName (28 bytes)
- @ 36   java.lang.StringBuilder::append                       136  413       4       com.ctc.wstx.sr.BasicStreamReader::getAttributeValue (28 bytes)
- 136  362       2       com.ctc.wstx.sr.BasicStreamReader::getAttributeLocalName (28 bytes)   made not entrant
- 137  317       3       com.ctc.wstx.sr.BasicStreamReader::nextFromTree (978 bytes)   made not entrant
- 138  367       3       com.ctc.wstx.sr.BasicStreamReader::getText (79 bytes)   made not entrant
- 141  426 % !   3       com.staxxml.benchmark.WoodstoxBench::consume @ 39 (459 bytes)
- @ 155   com.ctc.wstx.sr.BasicStreamReader::getLocalName (65 bytes)   callee is too large
- @ 160   com.staxxml.benchmark.WoodstoxBench::foldString (45 bytes)   callee is too large
- @ 195   com.ctc.wstx.sr.BasicStreamReader::getAttributeLocalName (28 bytes)

## Findings

- same-contract-result: Woodstox trace run preserved the full-string checksum benchmark result.
  - events=967967
  - checksum=-746772258
  - throughput=324.7 MiB/s
- hotspot-inlining-visible: HotSpot emitted compilation/inlining lines for the Woodstox comparator boundary.
  - compilationLines=538
  - inliningLines=2633
  - consumeMentions=8
  - woodstoxInternalMentions=2448
- allocation-still-missing: PrintCompilation/PrintInlining does not prove allocation behavior or borrowed/owned string lifetimes.
  - Need JFR, async-profiler, or equivalent allocation sampling before attributing Woodstox speed to allocation shape.
