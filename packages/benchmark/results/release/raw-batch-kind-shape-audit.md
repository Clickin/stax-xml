# Raw Batch Kind Shape Audit

Generated: 2026-05-25T01:03:34.683Z

Audits which StreamReaderSyncRawBatch discriminant kinds are declared in public types versus actually returned by the current StreamReaderSync.nextRawBatch implementation. This is source/runtime shape evidence, not a throughput benchmark.

## Summary

- Declared raw-batch kinds: `frame`, `soa-string-arena`, `word-table`
- Observed runtime raw-batch kinds: `frame`
- Source return kind literals: `frame`
- word-table available: no
- soa-string-arena available: no
- Unavailable declared kinds: `soa-string-arena`, `word-table`

## Findings

- raw-batch-declared-kinds (SOURCE_FACT): StreamReaderSyncRawBatch currently declares multiple discriminant kinds in public types.
  - frame
  - soa-string-arena
  - word-table
- raw-batch-runtime-kinds (SOURCE_FACT): The current StreamReaderSync.nextRawBatch implementation returns only the kinds observed by this runtime audit.
  - frame: observed
  - frame: source return literal
- word-table-string-arena-unavailable (NEGATIVE_RESULT): Declared raw-batch kinds are not all implemented by the current runtime path.
  - soa-string-arena: declared but not observed
  - word-table: declared but not observed
- shape-scope-guard (SCOPE_GUARD): Unavailable raw-batch kinds are implementation opportunities, not measured performance counterexamples or runtime ceiling proof.
  - No throughput conclusion is allowed from this shape audit.

## Limits

- This artifact does not benchmark a word-table or string-arena implementation.
- Missing availability is not evidence that those layouts would be slow; it only means current release rows have not tested them.
- A future implementation must still pass the same full-string checksum, bounded-memory, and runtime comparison gates.

