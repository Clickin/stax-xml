# SpiderMonkey Taskcluster Debug JS Shell Route Freshness Audit

Resolves the Taskcluster latest win64-debug route and checks whether the current SpiderMonkey debug js-shell evidence still names that route task. This is route freshness evidence only; it is not benchmark, codegen, or same-contract StAX closure evidence.

## Summary

- Status: fresh
- Route fresh: true
- Expected identity matches route: true
- Has expected build identity: true
- Runtime-limit conclusion allowed: false

## Route

- Route: gecko.v2.mozilla-central.latest.firefox.win64-debug
- Index URL: https://firefox-ci-tc.services.mozilla.com/api/index/v1/task/gecko.v2.mozilla-central.latest.firefox.win64-debug
- Task ID: aJLr1DFjQ7urQTpRiIsfRQ
- Fetch status: available
- Fetched at: 2026-06-02T13:32:38.885Z

## Expected Evidence Identity

- Task ID: aJLr1DFjQ7urQTpRiIsfRQ
- Build ID: 20260602093330
- Source revision: 253b8523586577438a3ddf86d67436719feaf6d8

## Findings

- taskcluster-latest-route-resolved (ENVIRONMENT_FACT): Route gecko.v2.mozilla-central.latest.firefox.win64-debug resolved with status=available taskId=aJLr1DFjQ7urQTpRiIsfRQ.
- route-freshness-scope-guard (SCOPE_GUARD): Route freshness proves only that current Taskcluster evidence points at the latest route task; it cannot close emitted-IR or same-contract StAX obligations.
