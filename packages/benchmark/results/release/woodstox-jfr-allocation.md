# Woodstox JFR Allocation Sampling

Generated: 2026-05-26T11:05:18.594Z

This report is a TRACE_FACT for one Java/HotSpot build and one XML fixture.
It captures JFR `ObjectAllocationInNewTLAB` and `ObjectAllocationOutsideTLAB` events for the Java + Woodstox comparator process.
It is sampled process-level evidence, not a deterministic allocation census and not proof of every Woodstox object lifetime.

## Environment

- Java: openjdk version "1.8.0_472"
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\runtime-comparison-16mib.xml
- Fixture size: 16.00 MiB
- Runs: warmups=4, runs=1
- JFR settings: profile
- Recording mode: process
- Stack depth: 32
- Raw JFR: G:\programming\stax-xml\packages\benchmark\results\woodstox-jfr\woodstox-allocation.jfr
- Raw JFR committed: no
- Raw allocation JSON: G:\programming\stax-xml\packages\benchmark\results\woodstox-jfr\woodstox-allocation-events.json
- Raw allocation JSON committed: no

## Benchmark Result

| Runtime | Throughput | Average | Events | Checksum |
| --- | ---: | ---: | ---: | ---: |
| 1.8.0_472 | 311.9 MiB/s | 51.30 ms | 967967 | -746772258 |

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

## Allocation Summary

| Metric | Value |
| --- | ---: |
| JFR allocation events | 55 |
| JFR sampled allocation bytes | 3.5 KiB |
| Main-thread allocation events | 49 |
| WoodstoxBench.consume stack events | 48 |
| Woodstox stack events | 48 |
| String-boundary events | 44 |
| Summary ObjectAllocationInNewTLAB count | 55 |
| Summary ObjectAllocationOutsideTLAB count | 0 |

## Top Allocation Classes

| Object class | Samples | Sampled bytes |
| --- | ---: | ---: |
| char[] | 24 | 2.4 KiB |
| java.lang.String | 25 | 600 B |
| java.lang.Thread | 1 | 376 B |
| com.ctc.wstx.sr.Attribute | 4 | 128 B |
| java.lang.Object[] | 1 | 24 B |

## Top Consume-Stack Classes

| Object class | Samples | Sampled bytes |
| --- | ---: | ---: |
| char[] | 23 | 1.9 KiB |
| java.lang.String | 21 | 504 B |
| com.ctc.wstx.sr.Attribute | 4 | 128 B |

## Key Consume Allocation Samples

| Object class | Bytes | Thread | Top frame | Stack prefix |
| --- | ---: | --- | --- | --- |
| char[] | 160 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuffer::contentsAsString <- com.ctc.wstx.sr.BasicStreamReader::getText <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 160 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuffer::contentsAsString <- com.ctc.wstx.sr.BasicStreamReader::getText <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 160 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuffer::contentsAsString <- com.ctc.wstx.sr.BasicStreamReader::getText <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 160 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuffer::contentsAsString <- com.ctc.wstx.sr.BasicStreamReader::getText <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 160 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuffer::contentsAsString <- com.ctc.wstx.sr.BasicStreamReader::getText <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 160 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuffer::contentsAsString <- com.ctc.wstx.sr.BasicStreamReader::getText <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 160 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuffer::contentsAsString <- com.ctc.wstx.sr.BasicStreamReader::getText <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 160 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuffer::contentsAsString <- com.ctc.wstx.sr.BasicStreamReader::getText <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 64 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuffer::contentsAsString <- com.ctc.wstx.sr.BasicStreamReader::getText <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 64 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuffer::contentsAsString <- com.ctc.wstx.sr.BasicStreamReader::getText <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 64 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuffer::contentsAsString <- com.ctc.wstx.sr.BasicStreamReader::getText <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 64 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuffer::contentsAsString <- com.ctc.wstx.sr.BasicStreamReader::getText <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |

## Findings

- same-contract-result: Woodstox JFR run preserved the full-string checksum benchmark result.
  - events=967967
  - checksum=-746772258
  - throughput=311.9 MiB/s
- allocation-samples-visible: JFR emitted allocation samples for the comparator process.
  - allocationEvents=55
  - sampledBytes=3.5 KiB
  - consumeStackEvents=48
  - woodstoxStackEvents=48
- string-materialization-stack-visible: At least one sampled consume stack crosses Woodstox text or attribute accessors into Java String/char materialization.
  - stringBoundaryEvents=44
  - stringBoundarySampledBytes=2.4 KiB
- woodstox-accessor-shape-counters: The Woodstox comparator reports accessor/materialization counters for the same checksum contract.
  - elementLocalNameReads=683270
  - attributeValueReads=284695
  - textReads=284695
  - foldedStrings=1537355
- not-deterministic-census: JFR allocation events are sampled process-level evidence, not a deterministic allocation census.
  - The recording covers JVM startup, warmups, and the measured run because the comparator is launched as a separate process.
  - Use it to identify observed allocation paths, not to prove total allocation volume or all object lifetimes.
