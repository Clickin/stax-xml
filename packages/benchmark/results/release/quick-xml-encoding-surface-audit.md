# quick-xml Encoding Surface Audit

Generated: 2026-05-25T10:36:29.506Z

Records the current Rust quick-xml comparator feature surface and a non-UTF-8 probe. This is comparator-scope evidence, not a JavaScript runtime benchmark or runtime ceiling proof.

## Comparator Feature Surface

- Cargo.toml: G:\programming\stax-xml\packages\benchmark\external\quick-xml\Cargo.toml
- Dependency line: quick-xml = "0.40.1"
- Feature command: cargo tree -e features --features count-allocations
- quick-xml encoding feature active: no

```text
└── quick-xml feature "default"
```

## UTF-16 Probe

- Status: rejected
- Exit code: 1
- stderr: cannot decode input using UTF-8: invalid utf-8 sequence of 1 bytes from index 0

## Findings

- quick-xml-current-feature-surface (SOURCE_FACT): The current comparator uses the quick-xml default feature surface plus the local count-allocations feature; the quick-xml encoding feature is not active.
  - dependency=quick-xml = "0.40.1"
  - quickXmlFeatureLines=└── quick-xml feature "default"
  - hasEncodingFeature=false
- quick-xml-utf16-probe-rejected (NEGATIVE_RESULT): Under the current comparator feature surface, a UTF-16 XML probe is rejected before producing a same-contract benchmark row.
  - status=rejected
  - exitCode=1
  - stderr=cannot decode input using UTF-8: invalid utf-8 sequence of 1 bytes from index 0
- encoding-surface-scope (SCOPE_GUARD): This audit prevents overclaiming non-UTF-8 quick-xml comparator coverage.
  - Do not treat existing quick-xml allocation counters as non-UTF-8 evidence unless the comparator explicitly enables and verifies that feature surface.
  - This is not JavaScript runtime evidence and not a 200 MiB/s ceiling proof.
