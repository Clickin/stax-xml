# Multi-Chunk Batch Shape Audit

Generated: 2026-05-24T22:55:24.678Z

Audits the current sync parser source shape behind Iterable<Uint8Array[]> batch-size experiments. This is source evidence only; it is not a benchmark row and not a runtime-limit conclusion.

## Summary

- Status: source-shape-confirmed
- Source files: 2
- Missing facts: 0

## Source Files

| File | Lines | currentBuffer | pendingTail | concatUint8Arrays |
| --- | ---: | ---: | ---: | ---: |
| packages\stax-xml\src\IterableReader.ts | 1282 | 16 | 11 | 0 |
| packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts | 752 | 63 | 10 | 3 |

## Findings

- single-item-batch-direct-view (SOURCE_FACT): Both sync byte readers special-case a single Uint8Array batch without pending tail as a direct view.
  - packages\stax-xml\src\IterableReader.ts:415: if (!hasTail && batch.length === 1)
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:576: if (!hasTail && batch.length === 1)
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:577: return asUint8ArrayView(batch[0]!)
- multi-item-batch-concat (SOURCE_FACT): Both sync byte readers concatenate multi-item Uint8Array batches into one parser buffer before scanning.
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:587: return concatUint8Arrays(buffers, total)
  - packages\stax-xml\src\IterableReader.ts:433: buffer.set(chunk, offset)
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:630: buffer.set(chunk, offset)
- single-buffer-span-model (SOURCE_FACT): Parser spans, materialization, and raw batch frames are indexed into one currentBuffer, so no-concat chunk-array scanning is a parser-core change rather than a benchmark flag.
  - packages\stax-xml\src\IterableReader.ts:104: private currentBuffer: Uint8Array
  - packages\stax-xml\src\iterable\Uint8ArrayCurrentCursor.ts:31: private currentBuffer: Uint8Array
  - packages\stax-xml\src\IterableReader.ts:38: nameStarts
  - packages\stax-xml\src\IterableReader.ts:112: nameStarts
  - packages\stax-xml\src\IterableReader.ts:144: nameStarts
  - packages\stax-xml\src\IterableReader.ts:273: nameStarts
  - packages\stax-xml\src\IterableReader.ts:321: nameStarts
  - packages\stax-xml\src\IterableReader.ts:399: nameStarts
  - packages\stax-xml\src\IterableReader.ts:881: nameStarts
  - packages\stax-xml\src\IterableReader.ts:905: nameStarts
  - packages\stax-xml\src\IterableReader.ts:45: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:121: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:151: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:293: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:335: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:362: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:380: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:406: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:894: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:915: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:916: attrNameStarts
  - packages\stax-xml\src\IterableReader.ts:917: attrNameStarts
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
  - packages\stax-xml\src\IterableReader.ts:397: this.frame.buffer = this.currentBuffer
- no-concat-prototype-scope (SCOPE_GUARD): A no-concat multi-chunk batch path would need to replace the single-currentBuffer span model or add a segmented-buffer abstraction through scanning, span storage, decoding, and raw-frame exposure.
  - current model: single Uint8Array currentBuffer
  - multi-item batch: concat before scan
  - raw frame: exposes one buffer plus start/end spans

