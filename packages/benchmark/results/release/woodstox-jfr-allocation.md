# Woodstox JFR Allocation Sampling

Generated: 2026-05-23T11:01:26.495Z

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
- Stack depth: 32
- Raw JFR: G:\programming\stax-xml\packages\benchmark\results\woodstox-jfr\woodstox-allocation.jfr
- Raw JFR committed: no
- Raw allocation JSON: G:\programming\stax-xml\packages\benchmark\results\woodstox-jfr\woodstox-allocation-events.json
- Raw allocation JSON committed: no

## Benchmark Result

| Runtime | Throughput | Average | Events | Checksum |
| --- | ---: | ---: | ---: | ---: |
| 1.8.0_472 | 320.3 MiB/s | 49.96 ms | 967967 | -746772258 |

## Allocation Summary

| Metric | Value |
| --- | ---: |
| JFR allocation events | 56 |
| JFR sampled allocation bytes | 3.0 KiB |
| Main-thread allocation events | 50 |
| WoodstoxBench.consume stack events | 49 |
| Woodstox stack events | 48 |
| String-boundary events | 42 |
| Summary ObjectAllocationInNewTLAB count | 56 |
| Summary ObjectAllocationOutsideTLAB count | 0 |

## Top Allocation Classes

| Object class | Samples | Sampled bytes |
| --- | ---: | ---: |
| char[] | 32 | 2.0 KiB |
| java.lang.Thread | 1 | 376 B |
| java.lang.String | 14 | 336 B |
| com.ctc.wstx.sr.Attribute | 6 | 192 B |
| java.io.BufferedInputStream | 1 | 40 B |
| byte[] | 1 | 24 B |
| java.lang.Object[] | 1 | 24 B |

## Top Consume-Stack Classes

| Object class | Samples | Sampled bytes |
| --- | ---: | ---: |
| char[] | 32 | 2.0 KiB |
| java.lang.String | 10 | 240 B |
| com.ctc.wstx.sr.Attribute | 6 | 192 B |
| java.io.BufferedInputStream | 1 | 40 B |

## Key Consume Allocation Samples

| Object class | Bytes | Thread | Top frame | Stack prefix |
| --- | ---: | --- | --- | --- |
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
| char[] | 48 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuilder::getAllValues <- com.ctc.wstx.sr.AttributeCollector::getValue <- com.ctc.wstx.sr.BasicStreamReader::getAttributeValue <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 48 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuilder::getAllValues <- com.ctc.wstx.sr.AttributeCollector::getValue <- com.ctc.wstx.sr.BasicStreamReader::getAttributeValue <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |

## Findings

- same-contract-result: Woodstox JFR run preserved the full-string checksum benchmark result.
  - events=967967
  - checksum=-746772258
  - throughput=320.3 MiB/s
- allocation-samples-visible: JFR emitted allocation samples for the comparator process.
  - allocationEvents=56
  - sampledBytes=3.0 KiB
  - consumeStackEvents=49
  - woodstoxStackEvents=48
- string-materialization-stack-visible: At least one sampled consume stack crosses Woodstox text or attribute accessors into Java String/char materialization.
  - stringBoundaryEvents=42
  - stringBoundarySampledBytes=2.2 KiB
- not-deterministic-census: JFR allocation events are sampled process-level evidence, not a deterministic allocation census.
  - The recording covers JVM startup, warmups, and the measured run because the comparator is launched as a separate process.
  - Use it to identify observed allocation paths, not to prove total allocation volume or all object lifetimes.
