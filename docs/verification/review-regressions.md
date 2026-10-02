# Independent review and regression verification

Review base: 0ad33b0984541ec7629df66d44921f1b2261d8e9. The original suite passed 128/128 and did not cover these defects. A fresh independent reviewer identified two Important defects and a cleanup ambiguity; the parent elevated cleanup to Important because failure reporting after committed changes could mislead a retry.

One fix pass, commit fd59082ac510ad35fcbeb5c733882b8b57884d44, added eight regression tests. All eight failed before the fixes, then passed; the complete suite at that checkpoint passed 136/136.

1. Incomplete snapshot provenance
   - RED: an unlisted config disappeared; the earlier unknown snapshot ID matched a new complete snapshot and old evidence became current
   - RED: explicit unknown coverage on identical bytes also shared the later complete identity
   - GREEN: unknown captures have an unknown: identity namespace and evidence freshness retains unknown
2. State save/recovery late-writer window
   - RED: another edit during temporary-file write/flush was overwritten after an earlier byte check
   - RED: an initial state created during temp writing was overwritten
   - RED: original or approved backup changed during recovery temp writing was not checked at the commit boundary
   - GREEN: destination and recovery guards run after temp IO, immediately before rename. Other edits remain intact and conflicts are reported
3. Installation cleanup outcome
   - RED: transaction removal or lock removal failed after committed files, overriding the success result with an ambiguous exception
   - RED: rollback succeeded but cleanup failure obscured that outcome
   - GREEN: committed operations report applied-with-cleanup-needed and relative transaction/lock paths plus operation/error codes. Rolled-back outcomes stay truthful with cleanup metadata. Locks remain for manual verification/cleanup; no blind retry or false rollback

No runtime permission boundary was weakened. Residual hostile micro-races and power loss remain documented limitations; no cross-platform atomicity claim was added. No review findings were deferred.

A later behavioral profile-routing omission was handled separately: two small profile text changes (f614c2e), original evidence preserved, five fresh routing samples passed. No unrelated policy or code changes were introduced. Final evidence-record tests brought the full suite to 139/139.
