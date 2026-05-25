# StAX Event Public Object Shape Audit

Generated: 2026-05-25T02:02:08.539Z

Audits why the JavaScript public event object consumer is not a 1 GiB file-backed external-baseline comparator row.

## Summary

- Public object source path present: yes
- 1 GiB materialization audit row present: no
- Low-memory file-backed comparator row omitted: yes
- Conclusion: public-object-source-path-present-but-not-a-file-backed-low-memory-comparator-row

## Source Facts

- staxEventToolDeclared: yes
- staxEventUsesFullUtf8StringInput: yes
- staxEventUsesEventReaderSyncPublicObjects: yes
- fileBackedStreamRowsUseByteBatches: yes

## Materialization Audit Link

- External baseline artifact: G:\programming\stax-xml\packages\benchmark\results\release\external-baseline-1024mib-file-sync-batches.json
- stax-event runtime shape: js-public-event-object
- stax-event per-event public object: yes
- stax-event baseline present: no

## Findings

- public-object-source-path-present (SOURCE_FACT): external-baseline.mjs contains a JavaScript public event object consumer using EventReaderSync.
  - staxEventToolDeclared=true
  - usesFullUtf8StringInput=true
  - usesEventReaderSyncPublicObjects=true
- not-file-backed-low-memory-row (SCOPE_GUARD): The public object consumer requires preloading the whole XML as a UTF-8 JavaScript string in this harness, while file-backed rows use byte batches.
  - fileBackedStreamRowsUseByteBatches=true
  - oneGiBMaterializationAuditBaselinePresent=false
- shape-boundary-preserved (SOURCE_FACT): The materialization contract audit keeps stax-event as the JS public-object shape, separate from Woodstox and quick-xml comparator shapes.
  - staxEventRuntimeShape=js-public-event-object
  - staxEventPerEventPublicObject=true

## Guardrail

- Do not compare the 1 GiB Woodstox/quick-xml file-backed rows as if they also created JavaScript public event objects.
- A future JS public-object 1 GiB row must either accept the full-string preload memory cost explicitly or use a separate streaming public-object reader contract.

