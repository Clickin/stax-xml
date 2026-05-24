# Firefox/SpiderMonkey String Source Pin Audit

Generated: 2026-05-24T10:46:14.406Z

This report is a SOURCE_FACT for the tested Firefox/SpiderMonkey JS string boundary.
It pins exact SpiderMonkey source lines for representation and string-copy APIs; it is not a benchmark, allocation profile, or runtime ceiling proof.

## Source

- Firefox build: 143.0.1 build 20250918214338
- Repository: https://hg.mozilla.org/releases/mozilla-release
- Revision: 644b498d517849c3fb95679e2017e965fe62b77a
- Files: js/src/vm/StringType.h, js/src/vm/StringType.cpp, js/src/vm/StringType-inl.h, js/public/String.h

## Findings

- spidermonkey-jsstring-representation-source-pin (SOURCE_FACT): The pinned SpiderMonkey source defines JS strings as engine GC cells with chars/length representation variants.
  - JSString class line 197
  - JSLinearString class line 1068
  - OwnedChars malloc ownership line 230
  - OwnedChars StringBuffer ownership line 235
- spidermonkey-string-copy-boundary-source-pin (SOURCE_FACT): The pinned public API and internal NewStringCopyN path distinguish ownership-taking APIs from copy APIs and copy counted input into engine-owned chars.
  - public JS_New*StringCopy comment line 59
  - NewStringCopyN declaration line 1979
  - AllocChars line 2151
  - PodCopy line 2159
- spidermonkey-string-source-pin-scope-limit (TRACE_FACT_LIMIT): This source pin constrains string ownership/copy boundaries, but it is not generated-code, profiler, allocation, or throughput evidence.
  - It does not prove that Firefox/SpiderMonkey full-string rows have no remaining optimization headroom.
  - It does not replace SpiderMonkey allocation or codegen traces for the benchmark shapes.

## Selected Anchors

- jsStringSmdoc: js/src/vm/StringType.h:83 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/vm/StringType.h#L83
- conceptualChars: js/src/vm/StringType.h:85 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/vm/StringType.h#L85
- jsStringClass: js/src/vm/StringType.h:197 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/vm/StringType.h#L197
- ownedCharsMalloc: js/src/vm/StringType.h:230 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/vm/StringType.h#L230
- ownedCharsStringBuffer: js/src/vm/StringType.h:235 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/vm/StringType.h#L235
- jsLinearStringClass: js/src/vm/StringType.h:1068 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/vm/StringType.h#L1068
- promotionMayMallocCopy: js/src/vm/StringType.h:1240 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/vm/StringType.h#L1240
- newStringCopyNDeclaration: js/src/vm/StringType.h:1979 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/vm/StringType.h#L1979
- inlineStringAllocation: js/src/vm/StringType-inl.h:31 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/vm/StringType-inl.h#L31
- externalStringConstructor: js/src/vm/StringType-inl.h:681 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/vm/StringType-inl.h#L681
- newStringCopyNImpl: js/src/vm/StringType.cpp:2141 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/vm/StringType.cpp#L2141
- allocChars: js/src/vm/StringType.cpp:2151 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/vm/StringType.cpp#L2151
- podCopy: js/src/vm/StringType.cpp:2159 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/vm/StringType.cpp#L2159
- deflateBranch: js/src/vm/StringType.cpp:2034 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/vm/StringType.cpp#L2034
- publicCopyComment: js/public/String.h:59 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/public/String.h#L59
- publicNewStringCopyN: js/public/String.h:63 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/public/String.h#L63
- publicNewStringCopyUtf8N: js/public/String.h:71 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/public/String.h#L71
- publicGetChars: js/public/String.h:239 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/public/String.h#L239
- publicCopyStringChars: js/public/String.h:253 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/public/String.h#L253
- publicStringBufferAccess: js/public/String.h:493 https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/public/String.h#L493
