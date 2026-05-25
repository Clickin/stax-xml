# Woodstox Measured-Run JFR Allocation Sampling

Generated: 2026-05-25T11:16:19.746Z

This report is a TRACE_FACT for one Java/HotSpot build and one XML fixture.
It captures JFR `ObjectAllocationInNewTLAB` and `ObjectAllocationOutsideTLAB` events around one measured Java + Woodstox `consume` call after warmup.
It is measured-run sampled evidence, not a deterministic allocation census and not proof of every Woodstox object lifetime.

## Environment

- Java: openjdk version "1.8.0_472"
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Fixture: G:\programming\stax-xml\packages\benchmark\test-data\runtime-comparison-16mib.xml
- Fixture size: 16.00 MiB
- Runs: warmups=4, runs=1
- JFR settings: profile
- Recording mode: measured
- Stack depth: 32
- Raw JFR: G:\programming\stax-xml\packages\benchmark\results\woodstox-jfr\woodstox-measured-allocation-rerun.jfr
- Raw JFR committed: no
- Raw allocation JSON: G:\programming\stax-xml\packages\benchmark\results\woodstox-jfr\woodstox-measured-allocation-rerun-events.json
- Raw allocation JSON committed: no

## Benchmark Result

| Runtime | Throughput | Average | Events | Checksum |
| --- | ---: | ---: | ---: | ---: |
| 1.8.0_472 | 136.6 MiB/s | 117.17 ms | 967967 | -746772258 |

## Allocation Summary

| Metric | Value |
| --- | ---: |
| JFR allocation events | 10 |
| JFR sampled allocation bytes | 472 B |
| Main-thread allocation events | 10 |
| WoodstoxBench.consume stack events | 10 |
| Woodstox stack events | 10 |
| String-boundary events | 9 |
| Summary ObjectAllocationInNewTLAB count | 10 |
| Summary ObjectAllocationOutsideTLAB count | 0 |

## Top Allocation Classes

| Object class | Samples | Sampled bytes |
| --- | ---: | ---: |
| char[] | 6 | 368 B |
| java.lang.String | 3 | 72 B |
| com.ctc.wstx.sr.Attribute | 1 | 32 B |

## Top Consume-Stack Classes

| Object class | Samples | Sampled bytes |
| --- | ---: | ---: |
| char[] | 6 | 368 B |
| java.lang.String | 3 | 72 B |
| com.ctc.wstx.sr.Attribute | 1 | 32 B |

## Key Consume Allocation Samples

| Object class | Bytes | Thread | Top frame | Stack prefix |
| --- | ---: | --- | --- | --- |
| char[] | 160 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuffer::contentsAsString <- com.ctc.wstx.sr.BasicStreamReader::getText <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 64 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuffer::contentsAsString <- com.ctc.wstx.sr.BasicStreamReader::getText <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 48 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuilder::getAllValues <- com.ctc.wstx.sr.AttributeCollector::getValue <- com.ctc.wstx.sr.BasicStreamReader::getAttributeValue <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 48 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuilder::getAllValues <- com.ctc.wstx.sr.AttributeCollector::getValue <- com.ctc.wstx.sr.BasicStreamReader::getAttributeValue <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| com.ctc.wstx.sr.Attribute | 32 B | main | com.ctc.wstx.sr.AttributeCollector::getAttrBuilder | com.ctc.wstx.sr.AttributeCollector::getAttrBuilder <- com.ctc.wstx.sr.BasicStreamReader::handleNonNsAttrs <- com.ctc.wstx.sr.BasicStreamReader::handleStartElem <- com.ctc.wstx.sr.BasicStreamReader::nextFromTree <- com.ctc.wstx.sr.BasicStreamReader::next <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 24 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- java.lang.String::substring <- com.ctc.wstx.sr.Attribute::getValue <- com.ctc.wstx.sr.AttributeCollector::getValue <- com.ctc.wstx.sr.BasicStreamReader::getAttributeValue <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| java.lang.String | 24 B | main | com.ctc.wstx.util.TextBuffer::contentsAsString | com.ctc.wstx.util.TextBuffer::contentsAsString <- com.ctc.wstx.sr.BasicStreamReader::getText <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| java.lang.String | 24 B | main | com.ctc.wstx.util.TextBuilder::getAllValues | com.ctc.wstx.util.TextBuilder::getAllValues <- com.ctc.wstx.sr.AttributeCollector::getValue <- com.ctc.wstx.sr.BasicStreamReader::getAttributeValue <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| char[] | 24 B | main | java.util.Arrays::copyOfRange | java.util.Arrays::copyOfRange <- java.lang.String::<init> <- com.ctc.wstx.util.TextBuilder::getAllValues <- com.ctc.wstx.sr.AttributeCollector::getValue <- com.ctc.wstx.sr.BasicStreamReader::getAttributeValue <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |
| java.lang.String | 24 B | main | com.ctc.wstx.util.TextBuffer::contentsAsString | com.ctc.wstx.util.TextBuffer::contentsAsString <- com.ctc.wstx.sr.BasicStreamReader::getText <- com.staxxml.benchmark.WoodstoxBench::consume <- com.staxxml.benchmark.WoodstoxBench::main |

## Findings

- same-contract-result: Woodstox JFR run preserved the full-string checksum benchmark result.
  - events=967967
  - checksum=-746772258
  - throughput=136.6 MiB/s
- allocation-samples-visible: JFR emitted allocation samples for the measured comparator consume run.
  - allocationEvents=10
  - sampledBytes=472 B
  - consumeStackEvents=10
  - woodstoxStackEvents=10
- string-materialization-stack-visible: At least one sampled consume stack crosses Woodstox text or attribute accessors into Java String/char materialization.
  - stringBoundaryEvents=9
  - stringBoundarySampledBytes=440 B
- not-deterministic-census: JFR allocation events are measured-run sampled evidence, not a deterministic allocation census.
  - The recording starts after warmups and after the pre-run System.gc(), then stops after the measured consume call.
  - Use it to identify observed allocation paths, not to prove total allocation volume or all object lifetimes.
