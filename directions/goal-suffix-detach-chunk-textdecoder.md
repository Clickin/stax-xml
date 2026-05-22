# Goal: suffix-detach retained strings after chunk TextDecoder decode

## Goal directive draft

Implement a pure-JS fast path that decodes each incoming byte chunk once with
`TextDecoder.decode(chunk, { stream: true })`, scans the decoded chunk string by
index/`charCodeAt`, and materializes only chunk-retained strings through a fixed
`suffix-detach` helper. The goal is to avoid V8 `SlicedString` parent retention
without adding a production `RetainedStringPolicy` or `json-copy` fallback.

## Strategy

1. Decode bytes at chunk granularity, not per span.
2. Run parser/converter matching on the chunk string using indexes and
   `charCodeAt` where possible.
3. Avoid materializing strings for transient matcher checks such as schema path
   comparison, XPath-style tag matching, and parser-local temporary names.
4. For values that outlive the current chunk, materialize with
   `suffix-detach`:

   ```ts
   export const retainedSubstring = (
     chunk: string,
     start: number,
     end: number,
   ): string => {
     const len = end - start;
     return len <= 0 ? "" : (chunk.slice(start, end) + "\0").slice(0, len);
   };
   ```

5. Apply the helper to final object text values, final object attribute values,
   dynamically retained element/attribute keys, and cross-chunk carry strings.
6. Apply this first to the compiled converter path rather than the public event
   object path, because the win depends on reducing retained materialization
   without adding per-event object churn.

## Non-goals

- Do not expose `retainedStringPolicy?: "direct" | "suffix-detach" | "json-copy"`.
- Do not use `json-copy` in production. Keep it only as a benchmark control.
- Do not introduce a `minDetachLen` shortcut until corpus benchmarks prove it is
  worth the extra branch and still preserves the parent-detach invariant.
- Do not replace parser-local index scanning with eager substring creation.

## Benchmark evidence copied from the source note

The source note used a batch retention harness where each batch creates
`2 MiB x 20 chunks = 40 MiB` of large decoded chunk strings while retaining only
about `0.002 MiB` of payload per batch. A slope near `40 MiB/batch` means the
small retained substring still pins the large parent chunk. A slope near
`0 MiB/batch` means the retained string was detached or copied.

| Engine | Method | RSS slope / batch | Expected ratio | Final - baseline | Judgment |
| --- | --- | ---: | ---: | ---: | --- |
| Chromium/V8 | direct | **41.56 MiB** | **103.9%** | **+387.42 MiB** | parent retained |
| Chromium/V8 | suffix | **0.13 MiB** | **0.32%** | +9.97 MiB | detach succeeded |
| Chromium/V8 | JSON | **0.14 MiB** | **0.36%** | +10.06 MiB | hard-copy baseline |
| Firefox/SpiderMonkey | direct | 0.79 MiB | 1.98% | +12.19 MiB | direct also safe |
| Firefox/SpiderMonkey | suffix | -0.86 MiB | -2.14% | -1.81 MiB | safe |
| Firefox/SpiderMonkey | JSON | 0.25 MiB | 0.62% | +5.83 MiB | safe |
| WebKit/JSC | direct | -0.13 MiB | -0.32% | -0.88 MiB | direct also safe |
| WebKit/JSC | suffix | -0.49 MiB | -1.22% | -5.33 MiB | safe |
| WebKit/JSC | JSON | -0.03 MiB | -0.08% | -0.22 MiB | safe |

The key interpretation from the source note:

- Chromium/V8 `direct` is the failure control: expected parent retention is
  `40 MiB/batch`, and observed RSS slope was `41.56 MiB/batch`.
- Chromium/V8 `suffix` is the production candidate: RSS slope fell to
  `0.127 MiB/batch`, and page heap slope fell to `0.0166 MiB/batch`.
- `json-copy` exists only to prove what hard-copy behavior looks like. It is not
  a production fallback.
- Firefox and WebKit did not show parent retention for `direct`, but `suffix`
  also stayed safe, so the implementation can use one fixed retained-string
  helper across engines.

## Implementation boundary

Use this as the initial implementation shape:

```text
Uint8Array chunk
  -> TextDecoder.decode(chunk, { stream: true })
  -> chunk string scanner
  -> matcher work stays index/charCode based
  -> only retained values and carry strings call retainedSubstring()
```

The invariant to preserve is stronger than "avoid big memory in one run":
retained JS object fields and carry strings must not pin prior decoded chunk
strings after the chunk has been consumed.

## Local harness

The local reproduction harness lives under:

```text
packages/benchmark/substring-retention/
```

Use the quick run for a low-cost browser check and the stress run when validating
the actual memory slope:

```bash
node packages/benchmark/substring-retention/run-retention.mjs --quick
node packages/benchmark/substring-retention/run-retention.mjs --stress
```

If Playwright is not installed locally, keep the harness files as the canonical
test shape and install Playwright only in the benchmark environment that will run
the browser retention trial.
