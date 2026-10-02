# React · profile version 1

## Repository checks
Inspect React/runtime versions, package.json/lockfile, rendering entry points, hook/component conventions and test configuration.

## Concepts
State ownership, render snapshots, component identity, derived state, hooks and dependency/lifetime reasoning. Teach the concepts needed for the requested feature.

## Review questions
Does an effect synchronize an external system? Are closures or keys causing stale/wrong identity? Is state duplicated or mutated? What observable behavior supports the conclusion?

## Next extension

A Next lens-comparison entry has four parts: version/routing checks; rendering boundaries; client/server code boundaries; and what component-only review cannot verify. Name each part explicitly, while keeping the explanation proportional to the learner’s request.
Only when Next is present: verify its version and router, server/client component boundaries, routing, rendering/caching and hydration. Do not assume App Router, Pages Router or an API version without repository evidence. A React-only review cannot certify Next server behavior.
