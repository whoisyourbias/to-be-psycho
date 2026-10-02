# Vue · profile version 1

## Repository checks
Inspect package.json, lockfile, Vue version, tooling and existing component style; identify Composition/Options API usage before applying version-specific advice.

## Concepts
Reactive dependencies, derived state, component boundaries, props/events, ownership and lifecycle cleanup. Adapt the current stage to experience, not a fixed sequence.

## Review questions
Is a prop being mutated? Is derived state duplicated? What happens when the component unmounts or the request resolves out of order? Are assumptions supported by the installed version?

## Nuxt extension

A Nuxt lens-comparison entry has four parts: version/routing checks; rendering boundaries; client/server code boundaries; and what component-only review cannot verify. Name each part explicitly, while keeping the explanation proportional to the learner’s request.
Only when the repository actually uses Nuxt: inspect its exact dependency version, route/file conventions, rendering mode, hydration, data loading and client/server boundaries. Vue component knowledge alone does not validate Nuxt routing or server behavior. Unknown version means ask/inspect before API-specific claims; this is a review lens, not a claim of live-host support.
