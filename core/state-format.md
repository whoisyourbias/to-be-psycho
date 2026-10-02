# Portable state, schemaVersion 1

The one canonical document is `.to-be-psycho/state.json`. All data must be plain JSON. `assertState` validates and returns the same value; it never coerces or migrates. Unknown fields, dangling attempt/snapshot references, duplicate IDs, invalid UTC timestamps, revisions, and result enums are rejected. Unsupported schemaVersion is a distinct error. The package is version 0.1.0; all initial profile versions are `1`.

## Fields

- `schemaVersion`: integer 1; `sessionId`: stable string
- `project`: `{id, rootIdentity}`; verify the same learner project before resuming, even after a provider change
- `revision`: nonnegative safe integer, assigned by the state store (new=0; update=current+1)
- `packageVersion`: string; `profileVersions`: map of profile IDs to version strings
- `scope`: `{goal, confirmed, criteria:[{id,description}], rationale}`
- `stage`: `{id, status, openQuestions: string[], nextAction}`; status is scoping, active, needs-work, ready or complete; only scoping can be unconfirmed
- `attempts`: `{id,stageId,observation,at}` records
- `hints`: `{id,stageId,attemptId,level,disclosed,at}`; level 1/2/3 and the complete disclosed content, without learner scores
- `snapshots`: `{id,environmentId,coverage,files:[{path,sha256}],capturedAt}`
- `evidence`: `{id,snapshotId,environmentId,command,executedAt,submittedAt,actor,source,result,summary}`; snapshot/environment IDs and executedAt may be null. actor is learner, source learner-submitted, result pass/fail/unknown
- `reviews`: `{id,stageId,snapshotId,independent,findings,criteria,limitations,nextAction}`. Findings contain priority (P0–P3), requirementId, kind (confirmed/risk/preference), file, lineStart, lineEnd, codeEvidence, condition, impact, verification, fixDirection. Review criteria use id, status (met/unmet/unverified), reason

IDs are nonempty strings. Times use UTC ISO 8601 (`2026-10-02T00:00:00.000Z`). Stage IDs in history may name previous stages. Do not save raw logs, credentials or secret values; redact summaries before saving. Validation cannot recognize every secret in prose.

## Snapshot meaning

`captureSnapshot(root,{paths,environment,coverage})` reads bytes twice and inventories twice. Paths are sorted POSIX-relative paths, including all source, tests, configuration, dependency manifests/lockfiles and other potentially influential files. Only root `.git` and `.to-be-psycho` are excluded. Every ordinary file must be listed for complete coverage; generated/dependency directories are not silently excluded. External dependencies/environment details must still be accounted for by the caller. List non-secret version/configuration identity in environment; never pass tokens or environment dumps. Secret-named keys, no environment information, an empty/partial list, unreadable files, links, or detected concurrent changes produce unknown. SHA-256 is an identity, not a security attestation. Two reads cannot guarantee detection of every adversarial race or change after capture.

`evidenceFreshness` returns current only for equal non-null snapshot/environment IDs and complete current coverage. Otherwise it is stale for a known mismatch with complete coverage, unknown for incomplete identities/coverage. The result field is never rewritten. Keep old evidence as history. A learner must associate their run with the captured version; a matching hash does not prove they actually ran a command.

## Saving and recovery

Use the state-store library only when the main guide's actual permissions confine writes to the state directory. Otherwise give the learner a redacted state document for manual saving. Never relax source permissions to save progress. Stop on schema/project/package/profile incompatibility rather than replacing history. Initial package/profile compatibility requires exact versions; upgrades require explicit review outside the automatic resume path.
