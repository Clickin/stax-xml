# Woodstox HotSpot Trace

Generated: 2026-05-26T11:04:57.724Z

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
| 1.8.0_472 | 322.3 MiB/s | 49.64 ms | 967967 | -746772258 |

## Comparator Shape Counters

| Counter | Value |
| --- | ---: |
| Start elements | 341635 |
| End elements | 341635 |
| Characters events observed | 341635 |
| CDATA events observed | 0 |
| Element local-name reads | 683270 |
| Attribute-count reads | 341635 |
| Attribute local-name reads | 284695 |
| Attribute value reads | 284695 |
| Text reads | 284695 |
| Text trims | 284695 |
| Non-empty text folds | 284695 |
| Folded strings | 1537355 |
| Folded UTF-16 code units | 13759225 |

## HotSpot Trace Summary

| Metric | Value |
| --- | ---: |
| Compilation lines | 537 |
| Inlining lines | 2823 |
| WoodstoxBench.consume mentions | 8 |
| Woodstox internal mentions | 2764 |
| Key non-inline lines | 29 |
| PrintInlining evidence | yes |

## Key Inlining Lines

- 105  297       3       com.staxxml.benchmark.WoodstoxBench::foldString (45 bytes)
- 106  303       3       com.ctc.wstx.sr.BasicStreamReader::next (381 bytes)
- @ 28   com.ctc.wstx.sr.BasicStreamReader::nextFromTree (978 bytes)   callee is too large
- 106  310       3       com.ctc.wstx.sr.BasicStreamReader::nextFromTree (978 bytes)
- @ 390   com.ctc.wstx.util.TextBuffer::resetWithShared                              @ 264   com.ctc.wstx.util.TextBuffer::size    @ 301   com.ctc.wstx.sr.BasicStreamReader::nextFromProlog    107  321       4       java.lang.Math::min (11 bytes)
- @ 21  @ 318   com.ctc.wstx.sr.BasicStreamReader::nextFromProlog (433 bytes)   callee is too large
- @ 342   com.ctc.wstx.sr.BasicStreamReader::nextFromMultiDocState (171 bytes)   callee is too large
- @ 673   com.ctc.wstx.sr.StreamScanner::getNextChar    109  333       4       com.staxxml.benchmark.WoodstoxBench::foldString (45 bytes)
- @ 60                                @ 776   com.ctc.wstx.sr.BasicStreamReader::nextFromTreeCommentOrCData com.ctc.wstx.io.WstxInputData::isNameStartChar (32 bytes)
- 110  297       3       com.staxxml.benchmark.WoodstoxBench::foldString (45 bytes)   made not entrant
- 113  318       3       com.ctc.wstx.sr.BasicStreamReader::getLocalName (65 bytes)
- (5 bytes)    117  370       4       com.ctc.wstx.sr.BasicStreamReader::nextFromTree (978 bytes)
- 117  369       4       com.ctc.wstx.sr.BasicStreamReader::next (381 bytes)
- @ 28   com.ctc.wstx.sr.BasicStreamReader::nextFromTree (978 bytes)   hot method too big
- 119  303       3       com.ctc.wstx.sr.BasicStreamReader::next (381 bytes)   made not entrant
- 121  351       3       com.ctc.wstx.sr.BasicStreamReader::getAttributeLocalName (28 bytes)
- 121  353       3       com.ctc.wstx.sr.BasicStreamReader::getAttributeValue (28 bytes)
- 122  380       4       com.ctc.wstx.sr.BasicStreamReader::getLocalName (65 bytes)
- 122  356       3       com.ctc.wstx.sr.BasicStreamReader::getText (79 bytes)
- 122  318       3       com.ctc.wstx.sr.BasicStreamReader::getLocalName (65 bytes)   made not entrant
- 130  401       4       com.ctc.wstx.sr.BasicStreamReader::getAttributeValue (28 bytes)
- 130  400       4       com.ctc.wstx.sr.BasicStreamReader::getAttributeLocalName (28 bytes)
- 131  351       3       com.ctc.wstx.sr.BasicStreamReader::getAttributeLocalName (28 bytes)   made not entrant
- 132  403       4       com.ctc.wstx.sr.BasicStreamReader::getText (79 bytes)
- 137  356       3       com.ctc.wstx.sr.BasicStreamReader::getText (79 bytes)   made not entrant
- 139  353       3       com.ctc.wstx.sr.BasicStreamReader::getAttributeValue (28 bytes)   made not entrant
- 140  412 % !   3       com.staxxml.benchmark.WoodstoxBench::consume @ 49 (704 bytes)
- 140  310       3       com.ctc.wstx.sr.BasicStreamReader::nextFromTree (978 bytes)   made not entrant
- @ 177   com.ctc.wstx.sr.BasicStreamReader::getLocalName (65 bytes)   callee is too large
- @ 205   com.staxxml.benchmark.WoodstoxBench::foldString (45 bytes)   callee is too large

## Findings

- same-contract-result: Woodstox trace run preserved the full-string checksum benchmark result.
  - events=967967
  - checksum=-746772258
  - throughput=322.3 MiB/s
- hotspot-inlining-visible: HotSpot emitted compilation/inlining lines for the Woodstox comparator boundary.
  - compilationLines=537
  - inliningLines=2823
  - consumeMentions=8
  - woodstoxInternalMentions=2764
- woodstox-accessor-shape-counters: The Woodstox comparator reports accessor/materialization counters for the same checksum contract.
  - elementLocalNameReads=683270
  - attributeValueReads=284695
  - textReads=284695
  - foldedStrings=1537355
- allocation-still-missing: PrintCompilation/PrintInlining does not prove allocation behavior or borrowed/owned string lifetimes.
  - Need JFR, async-profiler, or equivalent allocation sampling before attributing Woodstox speed to allocation shape.
