# Firefox Fetch ReadableStream Timeout Audit

Generated: 2026-05-24T20:20:13.066Z

Timeout audit for Firefox/SpiderMonkey public EventReader over fetch Response.body on a 1 GiB corpus-cycle source.

## Parameters

- Size GiB: 1
- Corpus file: G:\programming\stax-xml\packages\benchmark\assets\books.xml
- Case: fetchReadableStreamFull
- Child timeout: 300.0 s
- Browser timeout: 1200.0 s

## Outcome

- Status: timeout
- Completed within timeout: no
- Implied throughput upper bound: 3.41 MiB/s

## Findings

- firefox-fetch-readable-stream-timeout (NEGATIVE_RESULT): Firefox/SpiderMonkey fetchReadableStreamFull did not complete 1.00 GiB within 300.0 seconds.
  - impliedThroughputUpperBound=3.41 MiB/s
  - case=fetchReadableStreamFull
  - contract=public EventReader full event-object checksum if completed
