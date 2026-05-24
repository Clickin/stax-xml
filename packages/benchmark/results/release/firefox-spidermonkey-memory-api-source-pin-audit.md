# Firefox/SpiderMonkey Memory API Source Pin Audit

Generated: 2026-05-24T10:31:15.304Z

This report is a SOURCE_FACT for the tested Firefox/SpiderMonkey browser memory API boundary.
It is negative capability evidence for the current BiDi page context, not an allocation profile and not a runtime ceiling proof.

## Runtime

- User agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0
- Firefox version: 143.0.1
- Build ID: 20250918214338
- Source repository: https://hg.mozilla.org/releases/mozilla-release
- Source stamp: 644b498d517849c3fb95679e2017e965fe62b77a
- Executable: C:\Program Files\Mozilla Firefox\firefox.exe

## Page Memory API Probe

- performance.memory: undefined
- performance.measureUserAgentSpecificMemory: undefined
- globalThis.gc: undefined
- SpecialPowers: undefined
- ChromeUtils: undefined
- Cu: undefined
- Components: object
- Components keys: interfaces
- Components.classes: undefined
- Components.interfaces: object
- nsIMemoryReporterManager: undefined

## Findings

- firefox-page-heap-api-unavailable (SOURCE_FACT): The tested Firefox page context does not expose Chromium performance.memory or measureUserAgentSpecificMemory.
  - performance.memory=undefined
  - performance.measureUserAgentSpecificMemory=undefined
- firefox-privileged-memory-reporter-unavailable-to-page-bidi (SOURCE_FACT): The tested BiDi page context does not expose privileged memory reporter globals needed for a JS heap or allocation profile.
  - SpecialPowers=undefined
  - ChromeUtils=undefined
  - Cu=undefined
  - Components.classes=undefined
  - Components.interfaces.nsIMemoryReporterManager=undefined
- host-counter-boundary (TRACE_FACT_LIMIT): Current Firefox benchmark memory remains host process-tree evidence unless a separate privileged/profiler path is added.
  - This audit explains the missing row-level JS heap proof; it does not replace a SpiderMonkey allocation profile.
  - Firefox/SpiderMonkey benchmark rows must stay classified separately from bounded JS heap counterexamples.
