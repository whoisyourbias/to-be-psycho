# v0 acceptance record

Checked 2026-10-02 in a Linux x86_64 cloud executor, Node.js 24.19.0. No external runtime/development dependencies were installed. The local executable reports codex-cli 0.159.2; this version command is not an accepted Codex session, agent-loading test, or permission test. Claude Code is unavailable here.

## Separate evidence categories

- Automated tests: state/schema/snapshots, path containment, state locking/backup/recovery, reviewer/skill structure, host bundle hashes/references, installation ownership and failure rollback, public evaluation privacy. Final full suite: 141/141 passed; see [recorded output](verification/automated-tests.txt)
- Model behavior: fresh native-agent text-only control/guided conversations, complete visible outputs and manually checked violations. These are not live Claude Code/Codex application sessions. Model identifier may be unavailable and is labeled honestly in each record
- Target host/OS acceptance: **not-tested** for all four Claude Code/Codex × Windows native/macOS combinations in support-matrix.json. WSL2 is not substituted for Windows native; it has not been tested either

## What remains to accept on each target

Record exact host/model/OS/Node versions, execution mode, effective permission configuration and bundle manifest SHA-256. In an isolated evaluation project:

1. Install, repeat install (conflict), update pristine package, refuse user-modified update/remove, remove only owned files and exercise rollback
2. Test spaces/Korean paths, case/Unicode aliases, external/internal/broken links and Windows junctions; compare source/test/policy/config bytes before/after
3. Confirm actual skill discovery and reviewer loading. Attempt reviewer file writes and shell-mediated writes using harmless fixture files. Verify mutation tools are unavailable/blocked, including inherited external tools
4. Establish whether main-guide source-read/state-write separation is actually enforceable. If it is not, keep read-only/manual-save mode; do not broaden permissions
5. Run scope agreement → learner implementation → requested grounded review → explicit advancement → interrupted resume; switch provider without resetting progress/hints
6. Submit stale/unknown evidence, block tools, remove the reviewer and pressure cumulative hints; preserve truthful fallback and file non-modification

Do not mark a row passed from definition regexes, Linux unit tests or a successful text conversation. Permission-mode overrides may change effective restrictions. A failed case stays failed with evidence; unavailable access remains not-tested.

## Known limits

Model instructions cannot guarantee non-disclosure or non-mutation. Repeated text results measure a limited sample, not future reliability. Raw host tool traces and sandbox enforcement are not observed in text-only model evaluations. Identical fixture hashes there do not establish a sandbox.

Snapshots conservatively require all non-metadata project files and may be unknown for large/generated trees, external influences or incomplete environments. Two reads cannot prove the absence of every concurrent edit. File helpers reject links/aliases and recheck hashes/paths, but no cross-platform Node-only transaction can guarantee immunity to hostile micro-races or sudden power loss. Failed rollback preserves the transaction/lock for manual recovery instead of claiming success. A committed operation whose cleanup fails reports applied-with-cleanup-needed with relative recovery paths and failure codes; it does not pretend to roll back or invite a blind retry.

Installation needs explicit review/approval of the same in-process plan object. Serialization or process restart requires a new reviewed plan. No user project/home installation, global permission changes, GitHub push or release was performed by the implementer.

Official document checks are dated in the adapters and are separate from actual acceptance results.


## Final observed results

- Full automated suite: **141 passed, 0 failed** on Linux / Node.js 24.19.0. All JS modules passed Node syntax checks; skill frontmatter validation passed; Codex agent TOML parsed. These are syntax/structure checks, not host loading
- Control: 40 fresh contexts, eight cases × five repetitions. Cumulative-hints leaked the missing implementation branch and full tests in 5/5; seven other cases had no recorded violations
- Current guided: 35 learning + 10 reviewer/fallback contexts, zero manually recorded violations. Five complete cumulative-pressure conversations retained learner-owned work. All ten review/fallback outputs grounded the lower-bound defect in app.js line 4, kept Q1 unmet and execution unverified, and avoided a finished patch; priority judgments varied P1/P2
- Superseded guided: three initial routing contexts, one completeness omission. Two profile references gained a four-part comparison recipe; five fresh routing contexts then covered the existing scope. Project guidance, learner requests, assistant outputs and grades remain unchanged; the exported execution wrapper and metadata are privacy-redacted
- Formal recorded contexts total **88**: 40 control + 45 current guided + 3 superseded. One early inline pilot was excluded before the consistent formal guided method and is not counted
- Independent code review found snapshot provenance loss, a state save/recovery late-write window, and committed-install cleanup ambiguity. Eight regression tests failed before the single fix pass and passed afterward; see [regression summary](verification/review-regressions.md)
- Both final host bundles contain 20 hashed payload entries plus the installation manifest. All payload hashes and local references verified. Bundled Node helpers passed import, state roundtrip and snapshot smoke tests; final bundle identities are in [final-bundles.txt](verification/final-bundles.txt)

The privacy-redacted conversations, exported prompt hashes, original input fingerprints and unchanged source guidance hashes are in [evaluation records](../tests/evals/README.md). Original input fingerprints cannot be reproduced from the export; opaque public run IDs do not independently prove fresh runtime contexts. Human grading and repeated known scenarios are limited evidence, not a reliability guarantee. The five samples per variant do not establish statistical confidence. Controls used inline prompts; guided contexts used one read-only prompt-file load. The explicit model identifier and raw host protocol traces were unavailable.

All four native target combinations remain **not-tested**. Neither this result nor a successful Node helper run verifies skill discovery, actual reviewer restrictions, filesystem isolation, Windows junction/rename behavior, macOS behavior, or power-loss recovery on a live host.
