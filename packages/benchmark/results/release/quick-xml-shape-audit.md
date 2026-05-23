# quick-xml Shape Audit

Generated: 2026-05-23T11:27:53.117Z

This report is a SOURCE_FACT for the Rust + quick-xml comparator shape.
It is not an allocation profile, machine-code trace, or proof that JavaScript runtime headroom is exhausted.

## Environment

- Rust: rustc 1.94.1 (e408947bf 2026-03-25)
- Cargo: cargo 1.94.1 (29ea6fb6a 2026-03-24)
- Platform: win32-x64
- CPU: 13th Gen Intel(R) Core(TM) i5-13600K
- Comparator source: G:\programming\stax-xml\packages\benchmark\external\quick-xml\src\main.rs
- quick-xml version: 0.40.1
- quick-xml source: C:\Users\z1z0b\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\quick-xml-0.40.1

## Baseline Anchor

| Tool | Throughput | Woodstox ratio | Events | Checksum | Target |
| --- | ---: | ---: | ---: | ---: | --- |
| quick-xml | 309.8 MiB/s | 0.93x | 967967 | -746772258 | met |

## Source Checks

| Check | Supported | Evidence |
| --- | --- | --- |
| comparator-reuses-read-buffer | yes | read_event_into(&mut buffer)<br>buffer.clear() |
| quick-xml-event-lifetime-tied-to-buffer | yes | Reader::read_event_into<'b>(&mut self, buf: &'b mut Vec<u8>) -> Result<Event<'b>> |
| event-storage-is-cow-bytes | yes | BytesStart Cow<[u8]><br>BytesText Cow<[u8]><br>Attribute value Cow<[u8]> |
| names-and-attributes-fold-bytes | yes | event.name().as_ref()<br>attr.key.as_ref()<br>attr.value.as_ref() |
| attributes-materialized-as-vec | yes | let mut collected = Vec::new()<br>collected.push(attr?) |
| text-decodes-to-cow-str | yes | event.decode()?<br>BytesText::decode -> Cow<str><br>Decoder::decode -> Cow<str> |
| checksum-uses-utf16-units | yes | value.encode_utf16() |
| quick-xml-uses-memchr-scanning | yes | memchr::memchr* in reader source |

## Findings

- same-contract-result (BENCH_FACT): Existing external baseline records quick-xml under the same full-string checksum contract.
  - throughput=309.8 MiB/s
  - woodstoxRatio=0.93x
  - events=967967
  - checksum=-746772258
- not-js-object-shape (SOURCE_FACT): quick-xml comparator uses Rust enum events, borrowed byte views, Cow strings, and a reused buffer rather than JS public event objects.
  - quick-xml-event-lifetime-tied-to-buffer: Reader::read_event_into<'b>(&mut self, buf: &'b mut Vec<u8>) -> Result<Event<'b>>
  - event-storage-is-cow-bytes: BytesStart Cow<[u8]>
  - event-storage-is-cow-bytes: BytesText Cow<[u8]>
  - event-storage-is-cow-bytes: Attribute value Cow<[u8]>
  - comparator-reuses-read-buffer: read_event_into(&mut buffer)
  - comparator-reuses-read-buffer: buffer.clear()
- attribute-vector-materialization (SOURCE_FACT): The current Rust comparator still materializes attributes into a Vec before folding so it can mix the attribute count first.
  - attributes-materialized-as-vec: let mut collected = Vec::new()
  - attributes-materialized-as-vec: collected.push(attr?)
- text-cow-boundary (SOURCE_FACT): Text and CDATA call quick-xml decode and receive Cow<str>; source audit alone does not prove borrowed-vs-owned frequency.
  - text-decodes-to-cow-str: event.decode()?
  - text-decodes-to-cow-str: BytesText::decode -> Cow<str>
  - text-decodes-to-cow-str: Decoder::decode -> Cow<str>
- allocation-not-covered-by-source-audit (MISSING_TRACE_FACT): This source audit is not an allocation profile, machine-code trace, or proof of runtime allocation counts.
  - Use quick-xml-allocation-count.md for measured allocator counters; stack/type attribution and Cow borrowed-vs-owned frequency still require separate evidence.
