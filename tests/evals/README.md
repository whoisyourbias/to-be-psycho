# Reproducing behavior evaluations

Use cases.json and the immutable fixture in ../fixtures/learner. Start a new agent context for each case/repetition. Give only the common learner context, fixture bytes and one user turn at a time. Control gets no package guidance. Guided gets the actual skill and only relevant linked references. Keep later turns in that context so cumulative disclosure is tested. Never expose expected/scoring fields to the learner agent.

Record visible learner/assistant turns, exact project guidance content identity, tools actually observed (or an explicit trace-unavailable limitation), before/after SHA-256, execution surface/model label/date, and manually checked violation explanations. Exclude execution paths and coordination instructions from public exports, and label any redaction. Do not save private chain of thought. Do not synthesize independent runs from repeated copies of one response.

Native-agent behavior results are not Claude Code/Codex application acceptance tests. OS/host access that is unavailable stays not-tested. Tests and fixtures belong to this harness, not a learner's project.

## Recorded implementation run (2026-10-02)

Controls used inline task/fixture prompts. Guided contexts used one read-only load of a generated prompt file, then remained text-only. The public export retains project-authored guidance, fixture bytes, learner requests and every assistant response. Execution locators, loading instructions and the initial execution-coordination paragraph are omitted; runId is an opaque public record identifier rather than an independently verifiable runtime context ID. This loading-method difference is an evaluation limitation.

publicPromptHash verifies the exported transcript[0].content. promptHash retains the original input's historical SHA-256 fingerprint, which cannot be reproduced from this redacted export and does not verify that exported content was the exact full input. guidanceHashes still identify the unchanged project source included in each run, and tests verify every embedded guidance section against its recorded hash. A new evaluation may reuse the exported project content, but cannot reconstruct the original execution wrapper from these files. Recorded counts and grades describe the original observed runs; redaction is not a rerun or stronger provenance evidence.

The completed current set comprises 40 controls, 35 main-guide samples and 10 separate reviewer/fallback samples; the final integrity/count gate passed. The second fallback group is an additional five fresh samples of the blocked-tools case, not a new scenario. Model identity was not exposed by the runtime and is recorded as unavailable rather than guessed. All counts are observations, not statistical confidence or live-host guarantees.

Three initial profile-routing guided samples are retained in results/guided-learning-superseded.jsonl with the same privacy redactions. One omitted explicit Nuxt client/server and Next rendering boundaries. The two profile references were clarified within the existing scope, and five new routing samples use their new hashes. Current source-hash checks apply to current results; superseded evidence preserves its original project guidance, learner requests, assistant outputs, grades and guidance hashes.

The automated record tests check sample counts, unique public identifiers, exported prompt/source hashes, visible-turn structure, unchanged fixture bytes, privacy exclusions and the manually recorded violation labels. They cannot independently establish fresh runtime contexts, original full inputs, correct grading or host permission enforcement; read the actual responses and the acceptance limitations.
