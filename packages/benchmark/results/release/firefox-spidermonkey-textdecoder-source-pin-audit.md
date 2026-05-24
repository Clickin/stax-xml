# Firefox/SpiderMonkey TextDecoder Source Pin Audit

Generated: 2026-05-24T00:51:17.743Z

## Scope

This audit pins Mozilla Gecko source lines for the DOM `TextDecoder.decode()` host-API boundary used by Firefox/SpiderMonkey. It is source evidence for the pinned `mozilla/gecko-dev` revision only. It is not a Firefox benchmark row, not SpiderMonkey JIT/codegen evidence, not heap/allocation evidence, and not a runtime-ceiling proof.

## Runtime And Source

- Firefox: gecko-dev master snapshot
- Repository: mozilla/gecko-dev
- Revision: 5836a062726f715fda621338a17b51aff30d0a8c
- Files: `dom/encoding/TextDecoder.cpp`, `dom/encoding/TextDecoder.h`, `intl/Encoding.h`

## Anchors

| ID | File | Line | Source | Meaning |
| --- | --- | ---: | --- | --- |
| `textDecoderInit` | `dom/encoding/TextDecoder.cpp` | 19 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L19 | TextDecoder::Init |
| `textDecoderForLabelNoReplacement` | `dom/encoding/TextDecoder.cpp` | 24 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L24 | Encoding::ForLabelNoReplacement |
| `initWithEncoding` | `dom/encoding/TextDecoder.cpp` | 34 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L34 | TextDecoder::InitWithEncoding |
| `encodingNameStored` | `dom/encoding/TextDecoder.cpp` | 36 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L36 | encoding name stored |
| `fatalOptionStored` | `dom/encoding/TextDecoder.cpp` | 38 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L38 | fatal option stored |
| `decoderWithoutBom` | `dom/encoding/TextDecoder.cpp` | 43 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L43 | NewDecoderWithoutBOMHandling |
| `decoderWithBomRemoval` | `dom/encoding/TextDecoder.cpp` | 45 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L45 | NewDecoderWithBOMRemoval |
| `decodeNative` | `dom/encoding/TextDecoder.cpp` | 49 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L49 | TextDecoderCommon::DecodeNative |
| `truncateOutput` | `dom/encoding/TextDecoder.cpp` | 53 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L53 | output string truncate |
| `maxUtf16BufferLength` | `dom/encoding/TextDecoder.cpp` | 56 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L56 | MaxUTF16BufferLength |
| `mutableData` | `dom/encoding/TextDecoder.cpp` | 62 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L62 | GetMutableData |
| `decodeToUtf16WithoutReplacement` | `dom/encoding/TextDecoder.cpp` | 73 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L73 | DecodeToUTF16WithoutReplacement |
| `decodeToUtf16` | `dom/encoding/TextDecoder.cpp` | 80 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L80 | DecodeToUTF16 |
| `setLength` | `dom/encoding/TextDecoder.cpp` | 86 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L86 | SetLength |
| `resetWithoutBom` | `dom/encoding/TextDecoder.cpp` | 95 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L95 | NewDecoderWithoutBOMHandlingInto reset |
| `resetWithBomRemoval` | `dom/encoding/TextDecoder.cpp` | 97 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L97 | NewDecoderWithBOMRemovalInto reset |
| `decodeMethod` | `dom/encoding/TextDecoder.cpp` | 102 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L102 | TextDecoder::Decode |
| `decodeNullInput` | `dom/encoding/TextDecoder.cpp` | 106 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L106 | DecodeNative null input |
| `processTypedArrays` | `dom/encoding/TextDecoder.cpp` | 110 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L110 | ProcessTypedArrays |
| `decodeTypedArrayNative` | `dom/encoding/TextDecoder.cpp` | 112 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L112 | DecodeNative typed array |
| `getEncoding` | `dom/encoding/TextDecoder.cpp` | 116 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.cpp#L116 | GetEncoding |
| `textDecoderBinding` | `dom/encoding/TextDecoder.h` | 12 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.h#L12 | TextDecoderBinding include |
| `encodingHeaderInclude` | `dom/encoding/TextDecoder.h` | 14 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.h#L14 | mozilla/Encoding.h include |
| `textDecoderCommonClass` | `dom/encoding/TextDecoder.h` | 20 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.h#L20 | TextDecoderCommon class |
| `decodeNativeDeclaration` | `dom/encoding/TextDecoder.h` | 38 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.h#L38 | DecodeNative declaration |
| `decoderMember` | `dom/encoding/TextDecoder.h` | 53 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.h#L53 | Decoder storage |
| `encodingNameMember` | `dom/encoding/TextDecoder.h` | 54 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.h#L54 | mEncoding storage |
| `textDecoderClass` | `dom/encoding/TextDecoder.h` | 59 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.h#L59 | TextDecoder class |
| `constructorDeclaration` | `dom/encoding/TextDecoder.h` | 63 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.h#L63 | Constructor declaration |
| `bindingWrap` | `dom/encoding/TextDecoder.h` | 81 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.h#L81 | TextDecoder_Binding::Wrap |
| `initDeclaration` | `dom/encoding/TextDecoder.h` | 91 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.h#L91 | Init declaration |
| `initWithEncodingDeclaration` | `dom/encoding/TextDecoder.h` | 101 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.h#L101 | InitWithEncoding declaration |
| `decodeDeclaration` | `dom/encoding/TextDecoder.h` | 104 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/dom/encoding/TextDecoder.h#L104 | Decode declaration |
| `encodingRsComment` | `intl/Encoding.h` | 10 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L10 | encoding_rs source comment |
| `encodingRsImplementationComment` | `intl/Encoding.h` | 12 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L12 | encoding_rs implementation comment |
| `ffiDecodeNsString` | `intl/Encoding.h` | 41 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L41 | mozilla_encoding_decode_to_nsstring |
| `ffiDecodeNsStringWithBomRemoval` | `intl/Encoding.h` | 45 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L45 | mozilla_encoding_decode_to_nsstring_with_bom_removal |
| `ffiDecodeNsStringWithoutBom` | `intl/Encoding.h` | 49 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L49 | mozilla_encoding_decode_to_nsstring_without_bom_handling |
| `ffiDecodeNsStringWithoutReplacement` | `intl/Encoding.h` | 54 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L54 | mozilla_encoding_decode_to_nsstring_without_bom_handling_and_without_replacement |
| `encodingClass` | `intl/Encoding.h` | 154 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L154 | Encoding class |
| `forLabel` | `intl/Encoding.h` | 171 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L171 | Encoding::ForLabel |
| `forLabelString` | `intl/Encoding.h` | 179 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L179 | Encoding::ForLabel string overload |
| `forLabelNoReplacement` | `intl/Encoding.h` | 198 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L198 | Encoding::ForLabelNoReplacement |
| `forLabelNoReplacementString` | `intl/Encoding.h` | 206 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L206 | Encoding::ForLabelNoReplacement string overload |
| `encodingName` | `intl/Encoding.h` | 235 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L235 | Encoding::Name |
| `decodeWithBomRemoval` | `intl/Encoding.h` | 413 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L413 | DecodeWithBOMRemoval |
| `decodeWithBomRemovalFfi` | `intl/Encoding.h` | 45 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L45 | DecodeWithBOMRemoval FFI |
| `decodeWithoutBomHandling` | `intl/Encoding.h` | 475 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L475 | DecodeWithoutBOMHandling |
| `decodeWithoutBomHandlingFfi` | `intl/Encoding.h` | 49 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L49 | DecodeWithoutBOMHandling FFI |
| `decodeWithoutBomHandlingNoReplacement` | `intl/Encoding.h` | 506 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L506 | DecodeWithoutBOMHandlingAndWithoutReplacement |
| `decodeWithoutBomHandlingNoReplacementFfi` | `intl/Encoding.h` | 54 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L54 | DecodeWithoutBOMHandlingAndWithoutReplacement FFI |
| `newDecoder` | `intl/Encoding.h` | 656 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L656 | NewDecoder |
| `newDecoderFfi` | `intl/Encoding.h` | 657 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L657 | encoding_new_decoder |
| `newDecoderWithBomRemoval` | `intl/Encoding.h` | 681 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L681 | NewDecoderWithBOMRemoval |
| `newDecoderWithBomRemovalFfi` | `intl/Encoding.h` | 682 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L682 | encoding_new_decoder_with_bom_removal |
| `newDecoderWithBomRemovalInto` | `intl/Encoding.h` | 696 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L696 | NewDecoderWithBOMRemovalInto |
| `newDecoderWithBomRemovalIntoFfi` | `intl/Encoding.h` | 697 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L697 | encoding_new_decoder_with_bom_removal_into |
| `newDecoderWithoutBomHandling` | `intl/Encoding.h` | 711 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L711 | NewDecoderWithoutBOMHandling |
| `newDecoderWithoutBomHandlingFfi` | `intl/Encoding.h` | 712 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L712 | encoding_new_decoder_without_bom_handling |
| `newDecoderWithoutBomHandlingInto` | `intl/Encoding.h` | 728 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L728 | NewDecoderWithoutBOMHandlingInto |
| `newDecoderWithoutBomHandlingIntoFfi` | `intl/Encoding.h` | 729 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L729 | encoding_new_decoder_without_bom_handling_into |
| `decoderClass` | `intl/Encoding.h` | 883 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L883 | Decoder class |
| `decoderEncoding` | `intl/Encoding.h` | 896 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L896 | Decoder::Encoding |
| `decoderMaxUtf16BufferLength` | `intl/Encoding.h` | 986 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L986 | Decoder::MaxUTF16BufferLength |
| `decoderMaxUtf16BufferLengthFfi` | `intl/Encoding.h` | 987 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L987 | decoder_max_utf16_buffer_length |
| `decoderDecodeToUtf16` | `intl/Encoding.h` | 1003 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L1003 | Decoder::DecodeToUTF16 |
| `decoderDecodeToUtf16Ffi` | `intl/Encoding.h` | 1008 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L1008 | decoder_decode_to_utf16 FFI |
| `decoderDecodeToUtf16WithoutReplacement` | `intl/Encoding.h` | 1020 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L1020 | Decoder::DecodeToUTF16WithoutReplacement |
| `decoderDecodeToUtf16WithoutReplacementFfi` | `intl/Encoding.h` | 1024 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L1024 | decoder_decode_to_utf16_without_replacement FFI |
| `latin1OptimizationComment` | `intl/Encoding.h` | 1044 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L1044 | SpiderMonkey-style string storage optimization warning |
| `latin1ByteCompatibleUpTo` | `intl/Encoding.h` | 1047 | https://github.com/mozilla/gecko-dev/blob/5836a062726f715fda621338a17b51aff30d0a8c/intl/Encoding.h#L1047 | Latin1ByteCompatibleUpTo |

## Findings

### gecko-textdecoder-host-api-source-pin

Classification: SOURCE_FACT

Gecko TextDecoder initializes the encoding label through mozilla::Encoding, stores a Decoder, and routes BufferSource input into DecodeNative.

- TextDecoder::Init line 19
- Encoding::ForLabelNoReplacement line 24
- NewDecoderWithoutBOMHandling line 43
- NewDecoderWithBOMRemoval line 45
- ProcessTypedArrays line 110

### gecko-textdecoder-utf16-output-source-pin

Classification: SOURCE_FACT

The pinned Gecko TextDecoder path materializes decoded output into an nsAString UTF-16 buffer through Decoder::DecodeToUTF16 or DecodeToUTF16WithoutReplacement.

- TextDecoderCommon::DecodeNative line 49
- MaxUTF16BufferLength line 56
- GetMutableData line 62
- DecodeToUTF16WithoutReplacement line 73
- DecodeToUTF16 line 80
- SetLength line 86

### gecko-encoding-rs-source-boundary

Classification: SOURCE_FACT

mozilla::Encoding is adapted from encoding_rs C++ bindings and its Decoder methods cross encoding_rs FFI wrappers for UTF-16 decoding.

- encoding_rs adaptation comment line 10
- mozilla_encoding_decode_to_nsstring line 41
- class Encoding final line 154
- class Decoder final line 883
- decoder_decode_to_utf16 line 1008
- decoder_decode_to_utf16_without_replacement line 1024

### gecko-spidermonkey-string-optimization-scope-guard

Classification: SCOPE_GUARD

Encoding.h exposes a Latin1ByteCompatibleUpTo helper for SpiderMonkey-style string storage optimizations, but the pinned TextDecoder.cpp path audited here uses the nsAString UTF-16 DecodeNative path. This source fact is not a Firefox benchmark, codegen trace, or runtime-ceiling proof.

- SpiderMonkey-style string storage optimization warning line 1044
- Latin1ByteCompatibleUpTo line 1047
- The audit does not run a Firefox benchmark row.
- The audit does not inspect SpiderMonkey-generated machine code.
- Any 200 MiB/s+ bounded-memory full-string row would still be a counterexample to the broad runtime-limit hypothesis.

## Interpretation

For this Gecko source revision, `TextDecoder.decode()` is a Gecko host-API path. The DOM binding owns a `mozilla::Decoder`, maps labels through `mozilla::Encoding`, processes `BufferSource` input, and materializes decoded output through an `nsAString` UTF-16 buffer before returning through the binding surface.

`intl/Encoding.h` also contains a separate `Latin1ByteCompatibleUpTo` helper documented for SpiderMonkey-style string storage optimizations. That helper is useful scope evidence, but it does not change the audited `TextDecoder.cpp` path into a zero-copy JavaScript string path and it does not prove that Firefox/SpiderMonkey has no remaining performance headroom.

The source pin narrows one non-V8 browser source-boundary gap. It must be paired with Firefox benchmark rows, SpiderMonkey codegen/profiler traces, and allocation evidence before supporting any broader runtime-limit conclusion.
