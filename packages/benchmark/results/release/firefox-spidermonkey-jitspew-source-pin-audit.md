# Firefox/SpiderMonkey JitSpew Source Pin Audit

Generated: 2026-05-24T22:04:15.143Z

Exact Gecko/SpiderMonkey source-line pinning for the JitSpew/IONFLAGS diagnostic path. This explains the diagnostic dump surface and compile-time gates; it is source evidence, not emitted JIT IR or optimized-code proof.

## Source

- Repository: https://hg.mozilla.org/releases/mozilla-release
- Revision: 644b498d517849c3fb95679e2017e965fe62b77a
- Firefox build: 143.0.1 build 20250918214338

## Anchors

| Anchor | File | Line | URL |
| --- | --- | ---: | --- |
| JitSpewer availability comment | js/src/jit/JitSpewer.h | 144 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/jit/JitSpewer.h#L144 |
| JitSpewer.h JS_JITSPEW guard | js/src/jit/JitSpewer.h | 146 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/jit/JitSpewer.h#L146 |
| non-JS_JITSPEW GraphSpewer backend | js/src/jit/JitSpewer.h | 245 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/jit/JitSpewer.h#L245 |
| non-JS_JITSPEW JitSpewEnabled backend | js/src/jit/JitSpewer.h | 296 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/jit/JitSpewer.h#L296 |
| JitSpewer.cpp JS_JITSPEW guard | js/src/jit/JitSpewer.cpp | 7 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/jit/JitSpewer.cpp#L7 |
| JIT_SPEW_DIR output directory | js/src/jit/JitSpewer.cpp | 21 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/jit/JitSpewer.cpp#L21 |
| IONFLAGS usage text | js/src/jit/JitSpewer.cpp | 341 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/jit/JitSpewer.cpp#L341 |
| IONFLAGS environment read | js/src/jit/JitSpewer.cpp | 410 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/jit/JitSpewer.cpp#L410 |
| ION_SPEW_FILENAME environment read | js/src/jit/JitSpewer.cpp | 534 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/jit/JitSpewer.cpp#L534 |
| codegen channel enable | js/src/jit/JitSpewer.cpp | 459 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/jit/JitSpewer.cpp#L459 |
| JitSpewer.cpp JS_JITSPEW endif | js/src/jit/JitSpewer.cpp | 659 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/jit/JitSpewer.cpp#L659 |
| --enable-jitspew option | js/moz.configure | 521 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/moz.configure#L521 |
| IONFLAGS configure help | js/moz.configure | 523 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/moz.configure#L523 |
| JS_JITSPEW define | js/moz.configure | 526 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/moz.configure#L526 |
| JS_JITSPEW config | js/moz.configure | 527 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/moz.configure#L527 |
| structured spew enabled with jitspew | js/moz.configure | 529 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/moz.configure#L529 |
| js/src moz.build JS_JITSPEW gate | js/src/moz.build | 576 | https://hg.mozilla.org/releases/mozilla-release/file/644b498d517849c3fb95679e2017e965fe62b77a/js/src/moz.build#L576 |

## Findings

- spidermonkey-jitspew-compile-gate-source-pin (SOURCE_FACT): The pinned SpiderMonkey JitSpew implementation is guarded by JS_JITSPEW, and the non-JS_JITSPEW backend reports no active spewing.
  - JitSpewer.h JS_JITSPEW guard: js/src/jit/JitSpewer.h:146
  - non-JS_JITSPEW GraphSpewer backend: js/src/jit/JitSpewer.h:245
  - non-JS_JITSPEW JitSpewEnabled backend: js/src/jit/JitSpewer.h:296
  - JitSpewer.cpp JS_JITSPEW guard: js/src/jit/JitSpewer.cpp:7
- spidermonkey-ionflags-source-pin (SOURCE_FACT): IONFLAGS, ION_SPEW_FILENAME, JIT_SPEW_DIR, and the codegen channel are implemented inside the guarded JitSpewer source path.
  - IONFLAGS usage text: js/src/jit/JitSpewer.cpp:341
  - IONFLAGS environment read: js/src/jit/JitSpewer.cpp:410
  - ION_SPEW_FILENAME environment read: js/src/jit/JitSpewer.cpp:534
  - JIT_SPEW_DIR output directory: js/src/jit/JitSpewer.cpp:21
  - codegen channel enable: js/src/jit/JitSpewer.cpp:459
- spidermonkey-enable-jitspew-build-option-source-pin (SOURCE_FACT): The pinned Gecko configure logic exposes --enable-jitspew and maps it to JS_JITSPEW and JS_STRUCTURED_SPEW.
  - --enable-jitspew option: js/moz.configure:521
  - IONFLAGS configure help: js/moz.configure:523
  - JS_JITSPEW define: js/moz.configure:526
  - JS_JITSPEW config: js/moz.configure:527
  - structured spew enabled with jitspew: js/moz.configure:529
  - js/src moz.build JS_JITSPEW gate: js/src/moz.build:576
- spidermonkey-jitspew-scope-guard (SCOPE_GUARD): This source pin does not prove the installed Firefox binary build flags and does not close the Firefox/SpiderMonkey JIT IR or optimized-code proof obligation.
  - Pair this with a diagnostic dump run or a build configuration artifact before claiming emitted codegen evidence.
  - A no-dump browser result remains a scoped negative result, not proof that SpiderMonkey has no codegen headroom.

This is not emitted JIT IR, not an optimized-code dump, and not a runtime ceiling proof.

