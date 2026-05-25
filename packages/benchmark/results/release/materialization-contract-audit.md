# Materialization Contract Audit

Generated: 2026-05-25T15:11:16.778Z

This audit separates same semantic fields from same runtime object shape.
The external baseline rows are comparable through event count, checksum, and field materialization parity; they are not the same object shape.
It does not prove a JavaScript runtime ceiling.

## Contract

Parity status: same-semantic-fields
Not same object shape: yes
External baseline artifact: G:\programming\stax-xml\packages\benchmark\results\release\external-baseline-1024mib-file-sync-batches.json
External baseline generated: 2026-05-25T15:09:55.076Z
External baseline fixture: G:\programming\stax-xml\packages\benchmark\test-data\node-string-return-1024mib.xml
External baseline fixture size: 1024.00 MiB

Shared full-string checksum fields:
- event type
- element local name
- attribute count
- attribute local name
- attribute value
- trimmed non-empty text
- trimmed non-empty CDATA
- UTF-16-code-unit checksum

## Consumers

| Consumer | Runtime shape | Per-event public object | Source check | Events | Checksum |
| --- | --- | --- | --- | ---: | ---: |
| woodstox | java-xmlstreamreader-cursor | no | yes | 61236571 | -716099804 |
| quick-xml | rust-enum-event-with-buffer-lifetime | no | yes | 61236571 | -716099804 |
| stax-stream | js-stream-batch-index-accessors | no | yes | 61236571 | -716099804 |
| stax-event | js-public-event-object | yes | yes | n/a | n/a |

## Shape Boundary

- Woodstox uses `XMLStreamReader` cursor/accessor calls; it does not create `EventReaderSync` public event objects.
- quick-xml uses Rust enum events tied to a reused buffer; it does not create JavaScript public event objects.
- `EventReaderSync` public event objects are only the JavaScript public-object row.
- `StreamReaderSync` byte batches are a separate JavaScript batch/index-accessor shape.

## Source Checks

| Check | Supported | Evidence |
| --- | --- | --- |
| woodstox-cursor-getters | yes | XMLStreamReader<br>reader.getEventType()<br>reader.getLocalName()<br>reader.getAttributeLocalName(attrIndex)<br>reader.getAttributeValue(attrIndex)<br>reader.getText().trim() |
| quick-xml-buffered-enum-events | yes | read_event_into(&mut buffer)<br>Event::Start(event)<br>event.name().as_ref()<br>attr.key.as_ref()<br>attr.value.as_ref()<br>event.decode()?<br>value.encode_utf16() |
| stax-event-public-objects | yes | new EventReaderSync(xml)<br>event.name<br>Object.entries(event.attributes) |
| stax-stream-index-accessors | yes | new StreamReaderSync(bytes)<br>batch.nameAt(index)<br>batch.attributeNameAt(index, attrIndex)<br>batch.attributeValueAt(index, attrIndex) |
| lazy-getters-negative-ledger | yes | CLAIM-LAZY-GETTERS<br>NEGATIVE_RESULT |

## Findings

- same-semantic-materialization-contract (SOURCE_FACT + BENCH_FACT): The external and JavaScript rows consume the same semantic fields when their event count and checksum match.
  - semantic fields: event type, element local name, attribute count, attribute local name, attribute value, trimmed non-empty text, trimmed non-empty CDATA, UTF-16-code-unit checksum
  - woodstox: events=61236571, checksum=-716099804
  - quick-xml: events=61236571, checksum=-716099804
  - stax-stream: events=61236571, checksum=-716099804
- not-same-object-shape (COUNTEREXAMPLE): The same semantic fields are not the same object shape across Java, Rust, and JavaScript runtimes.
  - woodstox: java-xmlstreamreader-cursor, perEventPublicObject=false
  - quick-xml: rust-enum-event-with-buffer-lifetime, perEventPublicObject=false
  - stax-stream: js-stream-batch-index-accessors, perEventPublicObject=false
  - stax-event: js-public-event-object, perEventPublicObject=true
- runtime-limit-still-unproven (HYPOTHESIS): Object-shape differences and current throughput gaps do not prove a JavaScript runtime ceiling.
  - A 200 MiB/s+ bounded-memory full-string JavaScript row remains a valid counterexample.
  - Partial byte-scan or partial string rows are parser/runtime headroom evidence, not StAX full-materialization proof.
- lazy-getters-remain-rejected (NEGATIVE_RESULT): Lazy getters remain a recorded negative result, not a fresh default optimization candidate.
  - They can improve count-only paths while moving or destabilizing full-string cache/materialization costs.
  - Revisit only with full-string improvement, bounded memory, and no cache-shape regression.

## Guardrails

- Say "same semantic fields" or "same full-string checksum contract", not "same object shape", for Woodstox and quick-xml comparisons.
- Lazy getters remain a recorded negative result unless a new full-string benchmark proves otherwise.
- A language/runtime limit conclusion still requires source facts, trace facts, allocation evidence, browser rows, and failed counterexample searches.
