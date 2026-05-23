# Bun/JSC String Limit Audit

Generated: 2026-05-23T13:07:02.871Z

## Scope

This audit pins a Bun/JSC maximum-string source/runtime fact and compares it against the generated `EventReaderSync` complete-string fixture lengths. It is not a byte-batch runtime ceiling and not a 200 MiB/s impossibility proof.

## Runtime Limit

- Bun: 1.3.13
- Bun revision: 1.3.13+bf2e2cecf
- Bun user agent: Bun/1.3.13
- Bun WebKit commit: 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- StringImpl::MaxLength: 2,147,483,647 UTF-16 code units
- Source formula: std::numeric_limits<int32_t>::max()
- Over-limit probe: RangeError: Out of memory

## Fixture Projections

| Size | Actual UTF-8 | String code units | Estimated UTF-16 | Below JSC limit? |
| --- | ---: | ---: | ---: | --- |
| 512 MiB | 512.0 MiB | 536,122,798 | 1022.6 MiB | yes, 1,611,360,849 code units headroom |
| 1024 MiB | 1024.0 MiB | 1,072,245,626 | 2045.1 MiB | yes, 1,075,238,021 code units headroom |

## EventReaderSync Release Cross-Check

- Node/V8 artifact: G:\programming\stax-xml\packages\benchmark\results\release\event-reader-string-large.json
- Contract: event-reader-sync-string-input-full-object-materialization
- Largest successful Node/V8 complete-string row: 512 MiB
- Node/V8 failed release row: 1024 MiB with Invalid string length

## Source Facts

| ID | Source | Fact |
| --- | --- | --- |
| `bun-uses-javascriptcore` | https://bun.com/docs | Bun describes its JavaScript runtime as built on JavaScriptCore. |
| `bun-patched-webkit-source` | https://bun.com/docs/project/license | Bun documents that it statically links JavaScriptCore/WebKit and points to the patched WebKit mirror. |
| `bun-runtime-webkit-commit` | runtime probe | Local Bun 1.3.13+bf2e2cecf exposes process.versions.webkit=4d5e75ebd84a14edbc7ae264245dcd77fe597c10. |
| `jsc-stringimpl-maxlength` | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/StringImpl.h#L153 | Bun 1.3.13 patched WebKit StringImplShape::MaxLength is std::numeric_limits<int32_t>::max(). |
| `jsc-stringimpl-isvalidlength` | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/StringImpl.h#L1248-L1251 | StringImpl::isValidLength bounds concrete character storage by MaxLength and allocation-size limits for the character type. |

## Findings

### jsc-max-string-source-fact

Bun/JSC exposes a larger single-string source limit than current Node/V8 for this local Bun build.

- bun=1.3.13
- webkit=4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- StringImpl::MaxLength=2,147,483,647
- over-limit probe=RangeError: Out of memory

### jsc-limit-does-not-explain-1gib-v8-failure

The 1024 MiB generated fixture projection is below the Bun/JSC StringImpl::MaxLength source limit.

- 1024 MiB projection=1,072,245,626 code units
- JSC code-unit headroom=1,075,238,021
- Node/V8 release failure=Invalid string length

### scope-boundary

This only distinguishes string-length invariants; it does not prove Bun/JSC can parse a 1 GiB complete string within acceptable memory.

- No 1 GiB Bun EventReaderSync parse row is measured here.
- No browser JSC/Safari runtime row is measured here.
- This is not a byte-batch runtime ceiling.

## Interpretation

The 1024 MiB projection is below the JSC string-length limit for this local Bun build, so the Node/V8 `RangeError: Invalid string length` at 1024 MiB is not a 1 GiB JSC string-length failure. This is a counterexample to porting the V8 complete-string size conclusion directly to Bun/JSC.

This does not prove Bun/JSC can parse the complete 1 GiB string with acceptable memory, and it does not prove anything about browser Safari rows. It only narrows the source-level string-length part of the proof ledger.
