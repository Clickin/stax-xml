# Multi-Chunk Batch Shape Audit

Generated: 2026-05-26T10:23:37.279Z

Audits the current sync parser source shape behind Iterable<Uint8Array[]> batch-size experiments. This is source evidence only; it is not a benchmark row and not a runtime-limit conclusion.

## Summary

- Status: source-shape-confirmed
- Source files: 2
- Missing facts: 0

## Source Files

| File | Lines | currentBuffer | pendingTail | concatUint8Arrays |
| --- | ---: | ---: | ---: | ---: |
| packages\stax-xml\src\IterableReader.ts | 1317 | 16 | 11 | 0 |
| packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts | 752 | 63 | 10 | 3 |

## Implementation Surface

- Public single-buffer surfaces: 4
- Single-buffer decode surfaces: 17
- Single-buffer scan helpers: 11
- Span arrays: nameStarts/nameEnds, textStarts/textEnds, attrNameStarts/attrNameEnds, attrValueStarts/attrValueEnds

## Findings

- single-item-batch-direct-view (SOURCE_FACT): Both sync byte readers special-case a single Uint8Array batch without pending tail as a direct view.
  - packages\stax-xml\src\IterableReader.ts:416: if (!hasTail && batch.length === 1)
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:576: if (!hasTail && batch.length === 1)
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:577: return asUint8ArrayView(batch[0]!)
- multi-item-batch-concat (SOURCE_FACT): Both sync byte readers concatenate multi-item Uint8Array batches into one parser buffer before scanning.
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:587: return concatUint8Arrays(buffers, total)
  - packages\stax-xml\src\IterableReader.ts:434: buffer.set(chunk, offset)
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:630: buffer.set(chunk, offset)
- single-buffer-span-model (SOURCE_FACT): Parser spans, materialization, and raw batch frames are indexed into one currentBuffer, so no-concat chunk-array scanning is a parser-core change rather than a benchmark flag.
  - packages\stax-xml\src\IterableReader.ts:104: private currentBuffer: Uint8Array
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:31: private currentBuffer: Uint8Array
  - packages\stax-xml\src\IterableReader.ts:38: nameStarts
  - packages\stax-xml\src\IterableReader.ts:112: nameStarts
  - packages\stax-xml\src\IterableReader.ts:145: nameStarts
  - packages\stax-xml\src\IterableReader.ts:274: nameStarts
  - packages\stax-xml\src\IterableReader.ts:322: nameStarts
  - packages\stax-xml\src\IterableReader.ts:400: nameStarts
  - packages\stax-xml\src\IterableReader.ts:904: nameStarts
  - packages\stax-xml\src\IterableReader.ts:928: nameStarts
  - packages\stax-xml\src\IterableReader.ts:45: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:121: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:152: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:294: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:336: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:363: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:381: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:407: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:917: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:938: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:939: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:940: attrNameStarts
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:50: attrNameStarts
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:192: attrNameStarts
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:202: attrNameStarts
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:211: attrNameStarts
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:491: attrNameStarts
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:528: attrNameStarts
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:554: attrNameStarts
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:564: attrNameStarts
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:565: attrNameStarts
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:567: attrNameStarts
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:147: decodeUtf8(this.currentBuffer
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:156: decodeUtf8(this.currentBuffer
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:164: decodeUtf8(this.currentBuffer
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:173: decodeUtf8(this.currentBuffer
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:202: decodeUtf8(this.currentBuffer
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:211: decodeUtf8(this.currentBuffer
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:385: decodeUtf8(this.currentBuffer
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:388: decodeUtf8(this.currentBuffer
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:436: decodeUtf8(this.currentBuffer
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:528: decodeUtf8(this.currentBuffer
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:531: decodeUtf8(this.currentBuffer
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:541: decodeUtf8(this.currentBuffer
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:544: decodeUtf8(this.currentBuffer
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:554: decodeUtf8(this.currentBuffer
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:557: decodeUtf8(this.currentBuffer
  - packages\stax-xml\src\IterableReader.ts:398: this.frame.buffer = this.currentBuffer
- segmented-no-concat-change-surface (IMPLEMENTATION_SCOPE): A segmented no-concat prototype must either preserve the existing single-buffer public frame ABI by copying at the boundary or introduce segment-aware spans through parser, materialization, and raw-frame consumers.
  - publicSingleBufferSurfaces=4
  - singleBufferDecodeSurfaces=17
  - singleBufferScanHelpers=11
  - spanArrays=nameStarts/nameEnds, textStarts/textEnds, attrNameStarts/attrNameEnds, attrValueStarts/attrValueEnds
  - packages\stax-xml\src\IterableReader.ts:265: buffer(): Uint8Array
  - packages\stax-xml\src\IterableReader.ts:398: frame.buffer = this.currentBuffer
  - packages\stax-xml\src\IterableReader.ts:36: buffer: BufferType
  - packages\stax-xml\src\IterableReader.ts:143: buffer: EMPTY_BUFFER
- bounded-prototype-axis (DESIGN_GUARD): A falsifiable implementation sequence should first separate parser pull frequency from concat copying with a segment-aware byte-scan probe, then only treat a full segmented parser as counterexample-relevant if it preserves the full-string checksum contract.
  - keep source contract: demand-driven Iterable<Uint8Array[]>
  - lower-bound probe: delimiter byte-scan checksum only
  - full counterexample probe: event count plus full-string checksum
  - compare against batchSize=1 and existing grouped-batch concat rows
  - do not use direct ReadableStream rows as the parser-core baseline
- segment-byte-scan-probe-scope (SCOPE_GUARD): The segment-scan-headroom benchmark is allowed as parser-core headroom evidence only; it does not remove the need for a segment-aware XML parser prototype before claiming full StAX throughput.
  - segment-scan-headroom contract: delimiter-byte-scan-no-xml-parse-no-string-materialization
  - fullStringParity=false
  - directReadableStream=false
  - fullArrayBufferParserInput=false
- segment-tokenizer-probe-scope (SCOPE_GUARD): The segment-tokenizer-headroom benchmark raises the no-concat probe from delimiter scanning to XML token-boundary folding, but it still omits string materialization, full XML validation, public event objects, and full StAX checksum parity.
  - segment-tokenizer-headroom contract: xml-token-boundary-no-string-materialization
  - grouped segment-aware tokenization is parser-core headroom evidence only
  - fullStringParity=false
  - directReadableStream=false
  - fullArrayBufferParserInput=false
- segment-tokenizer-string-frontier-scope (SCOPE_GUARD): The segment-tokenizer-string-frontier benchmark adds TextDecoder string materialization on top of token-boundary folding, but it remains a simplified tokenizer frontier rather than public StAX reader parity.
  - segment-tokenizer-string-frontier contract: xml-token-boundary-string-materialization-frontier
  - uses TextDecoder, not Node Buffer, native addons, or lazy getters
  - fullStringParity=false
  - directReadableStream=false
  - fullArrayBufferParserInput=false
- no-concat-prototype-scope (SCOPE_GUARD): A no-concat multi-chunk batch path would need to replace the single-currentBuffer span model or add a segmented-buffer abstraction through scanning, span storage, decoding, and raw-frame exposure.
  - current model: single Uint8Array currentBuffer
  - multi-item batch: concat before scan
  - raw frame: exposes one buffer plus start/end spans

