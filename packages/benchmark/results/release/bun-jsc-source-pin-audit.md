# Bun/JSC Source Pin Audit

Generated: 2026-05-23T21:56:29.021Z

## Scope

This audit pins JavaScriptCore string-boundary source lines for the exact Bun-patched WebKit revision used by the local Bun/JSC benchmark artifacts. It is evidence for the engine-owned string boundary, not a throughput proof and not a claim that no JavaScript headroom remains.

## Runtime And Source

- Bun: 1.3.13
- Bun revision: 1.3.13+bf2e2cecf
- WebKit commit: 4d5e75ebd84a14edbc7ae264245dcd77fe597c10
- Repository: oven-sh/webkit
- StringImpl::MaxLength: 2,147,483,647 UTF-16 code units
- Source formula: std::numeric_limits<int32_t>::max()
- 1024 MiB generated fixture projection: 1,072,245,626 UTF-16 code units
- 1024 MiB generated fixture headroom: 1,075,238,021 UTF-16 code units

## Anchors

| ID | File | Line | Source | Meaning |
| --- | --- | ---: | --- | --- |
| `jsStringClass` | `Source/JavaScriptCore/runtime/JSString.h` | 102 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/JavaScriptCore/runtime/JSString.h#L102 | JSString cell class |
| `jsStringMaxLength` | `Source/JavaScriptCore/runtime/JSString.h` | 134 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/JavaScriptCore/runtime/JSString.h#L134 | JSString MaxLength |
| `jsStringValueInternal` | `Source/JavaScriptCore/runtime/JSString.h` | 153 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/JavaScriptCore/runtime/JSString.h#L153 | JSString valueInternal |
| `jsStringConstructorStoresString` | `Source/JavaScriptCore/runtime/JSString.h` | 168 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/JavaScriptCore/runtime/JSString.h#L168 | JSString stores WTF::String |
| `jsStringAllocateCell` | `Source/JavaScriptCore/runtime/JSString.h` | 207 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/JavaScriptCore/runtime/JSString.h#L207 | JSString allocateCell |
| `jsStringViewReturnsValue` | `Source/JavaScriptCore/runtime/JSString.h` | 927 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/JavaScriptCore/runtime/JSString.h#L927 | JSString view returns valueInternal |
| `wtfStringClass` | `Source/WTF/wtf/text/WTFString.h` | 61 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/WTFString.h#L61 | WTF::String class |
| `wtfStringMaxLength` | `Source/WTF/wtf/text/WTFString.h` | 338 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/WTFString.h#L338 | WTF::String MaxLength |
| `wtfStringCreateUninitialized` | `Source/WTF/wtf/text/WTFString.h` | 227 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/WTFString.h#L227 | WTF::String createUninitialized |
| `wtfStringImplPointer` | `Source/WTF/wtf/text/WTFString.h` | 348 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/WTFString.h#L348 | WTF::String StringImpl pointer |
| `stringImplMaxLength` | `Source/WTF/wtf/text/StringImpl.h` | 153 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/StringImpl.h#L153 | StringImpl MaxLength |
| `stringImplBufferOwnership` | `Source/WTF/wtf/text/StringImpl.h` | 209 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/StringImpl.h#L209 | StringImpl BufferOwnership |
| `stringImplIsValidLength` | `Source/WTF/wtf/text/StringImpl.h` | 212 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/StringImpl.h#L212 | StringImpl isValidLength |
| `stringImplCreate` | `Source/WTF/wtf/text/StringImpl.h` | 263 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/StringImpl.h#L263 | StringImpl create span |
| `stringImplCreateWithoutCopying` | `Source/WTF/wtf/text/StringImpl.h` | 276 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/StringImpl.h#L276 | StringImpl createWithoutCopying |
| `stringImplTryCreateUninitialized` | `Source/WTF/wtf/text/StringImpl.h` | 283 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/StringImpl.h#L283 | StringImpl tryCreateUninitialized |
| `stringImplCreateInternal` | `Source/WTF/wtf/text/StringImpl.cpp` | 269 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/StringImpl.cpp#L269 | StringImpl createInternal |
| `stringImplCreateUninitializedInternal` | `Source/WTF/wtf/text/StringImpl.cpp` | 274 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/StringImpl.cpp#L274 | StringImpl createUninitializedInternalNonEmpty |
| `stringImplCreateCopyCharacters` | `Source/WTF/wtf/text/StringImpl.cpp` | 275 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/StringImpl.cpp#L275 | StringImpl copyCharacters |
| `stringImplCreate8BitIfPossible` | `Source/WTF/wtf/text/StringImpl.cpp` | 336 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/StringImpl.cpp#L336 | StringImpl create8BitIfPossible |
| `stringImplCreate8BitCopyElements` | `Source/WTF/wtf/text/StringImpl.cpp` | 344 | https://github.com/oven-sh/webkit/blob/4d5e75ebd84a14edbc7ae264245dcd77fe597c10/Source/WTF/wtf/text/StringImpl.cpp#L344 | StringImpl copyElements |

## Findings

### jsc-jsstring-engine-cell-source-pin

Classification: SOURCE_FACT

JavaScriptCore JSString is pinned as a JSCell-backed engine value that stores a WTF::String in the VM-managed cell, not as an arbitrary parser-owned byte-span primitive.

- JSString class line 102
- JSString constructor stores WTF::String line 168
- JSString allocateCell line 207
- JSString view returns valueInternal line 927

### jsc-stringimpl-storage-source-pin

Classification: SOURCE_FACT

WTF::String is pinned as a RefPtr<StringImpl> wrapper, and the ordinary StringImpl create path allocates uninitialized internal storage then copies the supplied character span.

- WTF::String RefPtr<StringImpl> line 348
- StringImpl createInternal line 269
- StringImpl copyCharacters line 275
- StringImpl create8BitIfPossible copyElements line 344

### jsc-string-max-length-source-pin

Classification: SOURCE_FACT

The same pinned WebKit revision defines the JSC/WTF maximum string length as int32 max, matching the Bun/JSC string-limit audit.

- JSString MaxLength line 134
- StringImpl MaxLength line 153
- String::MaxLength line 338
- 1024 MiB generated projection headroom=1,075,238,021 code units

### source-pin-not-throughput-proof

Classification: SCOPE_GUARD

This source pin constrains the engine-owned string boundary only; it is not a throughput proof and does not prove that all JS-runtime headroom has been exhausted.

- No benchmark row is run by this audit.
- No browser Safari/JSC row is run by this audit.
- No claim about a 200 MiB/s ceiling follows from these source lines alone.

## Interpretation

For this Bun/JSC revision, the JavaScript string value boundary is represented by JSC `JSString` cells holding WTF `String` / `StringImpl` storage. The ordinary `StringImpl::create` path allocates engine-managed string storage and copies character spans into it. This supports the narrow claim that portable JavaScript string primitives are engine-owned values rather than parser-owned byte-span views.

The source lines do not prove a throughput ceiling. They also do not reject future JavaScript runtime headroom, projection-specific wins, browser-specific differences, or native engine-internal APIs with different lifetime contracts.
