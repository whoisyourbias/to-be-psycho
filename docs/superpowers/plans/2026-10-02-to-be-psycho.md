# to-be-psycho v0 Implementation Plan

**Goal:** 학습자가 직접 구현하는 기능 학습을 Claude Code와 Codex에서 돕는 하나의 학습 스킬 패키지를 만든다.

**Architecture:** 공통 메인 스킬이 범위 합의·단계·힌트·상태를 관리하고, 참조 프로필과 읽기 전용 구현 리뷰어를 필요할 때 사용한다. Node 내장 모듈만 사용하는 작은 상태·패키징 함수가 파일 무결성을 처리하며, 호스트 어댑터는 탐색 경로와 실제 권한만 연결한다. 독립 실행 루프나 사용자용 CLI는 만들지 않는다.

**Tech Stack:** Markdown, JSON, JavaScript ESM/JSDoc, Node.js 22 이상, node:test/node:assert, node:fs/node:path/node:crypto. 런타임·개발 외부 의존성 없음. Node 하한은 이 계획의 구현 선택이며 원 설계의 요구 버전은 아니다.

**Spec:** `docs/superpowers/specs/2026-10-02-to-be-psycho-design.md`

## Global Constraints

- “AI는 가이드하고, 코드는 내가 친다”
- “학습자 소스와 테스트를 직접 수정하거나 생성하지 않는다.”
- “학습자가 확정하기 전에는 과제를 시작하지 않는다.”
- “현재 과제를 그대로 완성하는 코드, 복사 가능한 전체 테스트, 교체 패치와 파일 단위 정답은 제공하지 않는다.”
- “별도의 사후 학습 평가 에이전트는 두지 않는다.” 위험 리뷰어는 후속 확장이다.
- “메인 가이드 한 개만 상태를 쓴다.” 상태의 정본은 `.to-be-psycho/state.json` 하나다.
- “v0는 같은 프로젝트의 동시 학습 세션을 지원하지 않는다.”
- “기존 .gitignore는 자동 수정하지 않는다.”
- “기존 CLAUDE.md, AGENTS.md, 사용자 설정, 동명 스킬과 프로젝트 코드를 덮어쓰지 않는다.”
- “실제 검증된 조합만 지원 목록에 올린다.” 대상은 Windows와 macOS, Claude Code와 Codex다.
- 승인된 v0 선택: 학습자가 테스트를 실행하고 결과를 제출한다. 하네스는 학습자 테스트를 작성하거나 실행하지 않는다.
- 이 계획 검토와 실행 방식 선택이 먼저다. 현재 산출물은 계획뿐이며 GitHub push·릴리스·제품 구현을 포함하지 않는다.

## Review Focus

1. 파일 목록에서 빠진 설정·의존성과 동시 편집: 부분 스냅샷으로 현재 통과를 선언하지 않는다. Task 2·7에서 검증한다.
2. 끊긴 저장·손상 JSON·다른 작성자: 정상본과 원본을 보존하고 충돌을 보고한다. Task 3에서 검증한다.
3. Windows 대소문자 별칭·공백·한글·외부 링크: 허용 영역 밖에 쓰거나 기존 파일을 덮어쓰지 않는다. Task 3·6·7에서 검증한다.
4. 여러 질문에 나뉜 정답 유출·파일 속 지시: 누적 힌트와 신뢰 경계를 유지한다. Task 1·4·5에서 검증한다.
5. 차단된 도구·부재한 리뷰어·불완전한 로그: 독립 리뷰나 실행 성공을 꾸며내지 않는다. Task 4·5·7에서 검증한다.

---

## 파일 구성과 순서

- `skills/learning-with-to-be-psycho/SKILL.md`: 유일한 메인 학습 스킬
- `core/learning-policy.md`, `core/review-contract.md`, `core/state-format.md`: 공통 규칙·반환 계약·상태 형식
- `core/state.mjs`, `core/snapshot.mjs`, `core/state-store.mjs`, `core/safe-path.mjs`: 검증·근거 식별·안전 저장 함수
- `profiles/{web,vue,react,java-spring,spring-mvc,spring-webflux,spring-boot}.md`: 여섯 스택과 Boot 공통 참조. Nuxt·Next는 Vue·React 파일의 명시적 확장 절
- `adapters/{claude,codex}/`: 호스트 리뷰어 정의와 연결 안내. 학습 규칙 복제 금지
- `AGENTS.md`, `CLAUDE.md`: 이 패키지 자체의 정책과 가져오기 연결. 학습 프로젝트 정책 파일은 건드리지 않음
- `install/package.mjs`, `install/README.md`: 배포 파일 계획·검증·적용 함수와 수동 호출 안내
- `tests/*.test.mjs`, `tests/fixtures/`, `tests/evals/`: 하네스 전용 자동 테스트·행동 평가
- `README.md`, `docs/acceptance.md`, `docs/support-matrix.json`: 시작 안내·인수 기록·검증된 지원 조합

의존 순서: 1 → 2 → 3 → 4 → 5 → 6 → 7. Task 1의 평가 시나리오와 실패 관찰이 스킬 작성보다 먼저다. 각 작업의 commit은 구현 시점의 로컬 체크포인트이며 게시 승인이 아니다. 현재 작업 폴더는 Git 저장소가 아니므로 실행 시작 시 승인된 환경에서 공개 저장소를 clone하고 승인된 설계·계획만 옮긴다. `.artifact-work/` 같은 문서 제작 임시 파일은 가져오지 않는다.

### Task 1: 행동 평가 기준과 실패 기준선 만들기

**Files:** Create `package.json`, `tests/evals/{cases.json,rubric.md,README.md}`, `tests/evals/results/control.jsonl`, `tests/eval-records.test.mjs`, `tests/fixtures/learner/{app.js,app.test.js,package.json}`

**Interfaces:**
- Consumes: 승인된 설계의 학습·리뷰·보호 계약
- Produces: `EvalCase {id, category, turns, expected}`와 `EvalRecord {caseId, variant, repetition, host, model, date, transcript, violations, fileHashesBefore, fileHashesAfter}`. `variant`는 `control|guided`, `violations`는 수동으로 확인한 문자열 배열

- [ ] **Step 1: 평가 rubric을 먼저 작성한다.** 8개 사례 ID를 고정한다: `scope-gate`, `cumulative-hints`, `injection`, `stale-evidence`, `resume-provider`, `review-grounding`, `blocked-tools`, `profile-routing`. 각 사례에 관찰 가능한 실패를 명시한다. profile-routing은 여섯 기본 스택, Boot 공통 참조, Nuxt/Next 확장, 버전 불명 상황을 각각 포함한다. 정답 누출 사례에는 시간 압박·이미 한 노력·권위 주장 세 압박을 함께 넣는다. 학습자 fixture는 평가용일 뿐 실제 학습자 저장소를 사용하지 않는다.
- [ ] **Step 2: 신선한 에이전트로 기준선을 실행한다.** 패키지 없이 같은 학습 요청·fixture·대화 순서를 제공한다. 사례별 최소 5회, 매번 새 문맥에서 실행하고 응답과 도구 호출·파일 전후 해시를 보존한다. 위반 문장과 이유를 직접 읽어 기록한다. 실패가 관찰되지 않은 사례는 규칙을 덧붙일 근거로 삼지 않는다. 관련 실패가 전혀 없으면 스킬을 쓰기 전에 사례 타당성을 검토한다.
- [ ] **Step 3: 평가 기록의 구조 테스트를 작성한다.** 아래 각 assertion을 독립 테스트로 만든다. 빈 결과·복제된 반복 번호가 통과하지 않아야 한다.
  ```js
  assert.equal(cases.length, 8);
  assert.ok(cases.every(c => records.filter(r => r.caseId === c.id && r.variant === 'control').length >= 5));
  assert.ok(records.every(r => r.transcript.length > 0 && r.host && r.model && r.date));
  assert.equal(new Set(records.map(r => `${r.caseId}:${r.variant}:${r.repetition}`)).size, records.length);
  ```
- [ ] **Step 4: 검증하고 기록한다.** `node --test tests/eval-records.test.mjs` → PASS. `package.json`에 `type: "module"`, `engines.node: ">=22"`, `scripts.test: "node --test tests/*.test.mjs"`만 둔다. 구조 PASS는 행동 PASS가 아니라는 설명을 rubric에 둔다. 기준선은 실패 관찰 자체가 결과이며 제품 통과를 주장하지 않는다.
- [ ] **Step 5: Commit.** `git add package.json tests && git commit -m "test: establish learning behavior baselines"`

### Task 2: 상태와 현재 스냅샷 계약 구현

**Files:** Create `core/{state-format.md,state.mjs,snapshot.mjs}`, `tests/{state,snapshot}.test.mjs`, `tests/fixtures/state-v1.json`

**Interfaces:**
- Produces: `assertState(value: unknown): StateV1`, `captureSnapshot(root: string, input: SnapshotInput): Promise<Snapshot>`, `evidenceFreshness(evidence: Evidence, current: Snapshot): 'current'|'stale'|'unknown'`
- `StateV1`: `{schemaVersion:1, sessionId, project:{id,rootIdentity}, revision, packageVersion, profileVersions, scope:{goal,confirmed,criteria,rationale}, stage:{id,status,openQuestions,nextAction}, attempts:[], hints:[], snapshots:[], evidence:[], reviews:[]}`. 모든 ID는 문자열, revision은 0 이상의 정수, 시간은 ISO 8601이다. stage.status는 `scoping|active|needs-work|ready|complete`
- `SnapshotInput`: `{paths:string[], environment:Record<string,string>, coverage:'complete'|'unknown'}`. `Snapshot`: `{id, environmentId, coverage, files:[{path,sha256}], capturedAt}`
- `Evidence`: `{id, snapshotId:string|null, environmentId:string|null, command, executedAt:string|null, submittedAt, actor:'learner', source:'learner-submitted', result:'pass'|'fail'|'unknown', summary}`. `freshness`는 결과와 별개로 계산하며 과거 근거를 삭제하지 않는다

- [ ] **Step 1: 실패 테스트를 작성한다.** 실제 임시 파일로 미커밋 소스·테스트·설정·lockfile 각각의 변경과 삭제가 ID를 바꾸는지, 환경 변경이 근거를 stale로 만드는지 검증한다. 누락 입력·읽기 실패·스캔 중 변경은 unknown이다. JSON 형식 오류·잘못된 revision·지원하지 않는 schemaVersion도 검사한다.
  ```js
  assert.equal(evidenceFreshness(evidence, sameSnapshot), 'current');
  assert.equal(evidenceFreshness(evidence, changedSnapshot), 'stale');
  assert.equal(evidenceFreshness({...evidence, snapshotId: null}, sameSnapshot), 'unknown');
  assert.equal(evidenceFreshness(evidence, {...sameSnapshot, coverage: 'unknown'}), 'unknown');
  assert.throws(() => assertState({...validState, schemaVersion: 2}), {code:'UNSUPPORTED_SCHEMA'});
  ```
- [ ] **Step 2: RED 확인.** `node --test tests/state.test.mjs tests/snapshot.test.mjs` → 미구현 계약 때문에 FAIL. 테스트 구문·fixture 오류는 먼저 바로잡는다.
- [ ] **Step 3: 최소 함수와 상태 형식을 작성한다.** 정렬된 상대 경로·바이트 SHA-256·정렬된 환경 항목으로 식별한다. 같은 입력을 두 번 읽어 중간 변경을 감지하며 Git commit만 쓰지 않는다. 입력 목록에는 관련 source/test/config/dependency 파일과 범위 밖 실행 영향 파일을 포함한다. 목록 완전성을 증명할 수 없으면 coverage는 unknown이다. 환경에는 비밀값을 넣지 않으며 raw 로그 대신 비밀을 제거한 요약을 저장한다. hints는 `{id,stageId,attemptId,level:1|2|3,disclosed,at}`; attempts는 `{id,stageId,observation,at}`로 정의한다. 리뷰 세부 형식은 Task 5 계약을 따른다.
- [ ] **Step 4: GREEN과 회귀 확인.** 위 명령과 `npm test` → PASS. 변경 없는 재스캔의 ID는 같고 timestamp만 달라야 한다. 형식 문서와 fixture 필드의 일치도 테스트한다.
- [ ] **Step 5: Commit.** `git add core tests && git commit -m "feat: define portable state and snapshot evidence"`

### Task 3: 충돌·손상에 안전한 작은 저장 도우미 구현

**Files:** Create `core/{safe-path.mjs,state-store.mjs}`, `tests/{safe-path,state-store}.test.mjs`

**Interfaces:**
- Consumes: Task 2의 `assertState(value)`와 `StateV1`
- Produces: `resolveInside(root:string, relativePath:string):Promise<string>`, `loadState(root:string):Promise<StateV1|null>`, `saveState(root:string, next:StateV1, expectedRevision:number|null):Promise<StateV1>`, `recoverState(root:string, approval:{confirmed:true, backupSha256:string}):Promise<StateV1>`
- 오류 code: `UNSAFE_PATH|STATE_CORRUPT|UNSUPPORTED_SCHEMA|REVISION_CONFLICT|STATE_BUSY|RECOVERY_CHANGED`. null은 파일이 실제로 없을 때만 반환. 새 저장 expectedRevision은 null, 저장 revision은 0; 이후 저장은 일치한 revision+1

- [ ] **Step 1: 실패 테스트를 작성한다.** 임시 디렉터리에서 stale revision·두 저장 시도·손상 JSON·지원 불가 스키마·쓰기/rename 실패·백업 복구를 각각 검증한다. 공백·한글 경로, `../`, 절대 경로, 외부 symlink/junction과 기존 링크를 검사한다.
  ```js
  await assert.rejects(saveState(root, next, 0), {code:'REVISION_CONFLICT'});
  assert.deepEqual(await readFile(statePath), originalBytes);
  await assert.rejects(loadState(corruptRoot), {code:'STATE_CORRUPT'});
  assert.equal(await loadState(emptyRoot), null);
  await assert.rejects(resolveInside(root, '../outside'), {code:'UNSAFE_PATH'});
  ```
- [ ] **Step 2: RED 확인.** `node --test tests/safe-path.test.mjs tests/state-store.test.mjs` → FAIL.
- [ ] **Step 3: 안전 저장을 구현한다.** `.to-be-psycho/` 안에서만 쓰며 `wx` 잠금 파일로 겹치는 저장을 거절한다. 잠금 후 revision 재확인 → 정상 기존 JSON의 `.bak` 보존 → 같은 디렉터리의 고유 tmp 쓰기·flush → rename 순서다. 잠금이 남았다고 자동 삭제하지 않는다. 복구는 명시적 승인과 백업 해시 재확인 후 손상 원본을 고유 `.corrupt-*` 파일로 보존하고 수행한다. 실패 시 기존 state/backup을 빈 값으로 대체하지 않는다. 경로 부모의 실제 위치를 검사하고 링크는 보수적으로 거절한다. 함수 내부에서 프로세스·학습자 테스트를 실행하지 않는다.
- [ ] **Step 4: GREEN과 회귀 확인.** 위 명령과 `npm test` → PASS. 실패 주입은 테스트에서 fs 연산을 감싸 재현하며, production에 테스트 전용 스위치를 추가하지 않는다. 임시 fixture 전후 비교에서 상태 영역 외 바이트가 같아야 한다. 실제 OS rename·권한 보장은 Task 7에 남긴다.
- [ ] **Step 5: Commit.** `git add core tests && git commit -m "feat: protect state writes and recovery"`

### Task 4: 메인 학습 스킬과 여섯 프로필 작성

**Files:** Create `skills/learning-with-to-be-psycho/SKILL.md`, `core/learning-policy.md`, `profiles/{web,vue,react,java-spring,spring-mvc,spring-webflux,spring-boot}.md`, `tests/skill-structure.test.mjs`, `tests/evals/results/guided-learning.jsonl`

**Interfaces:**
- Consumes: Task 1 사례·rubric, Task 2 상태/근거 계약, Task 3 저장 함수
- Produces: 스킬 이름 `learning-with-to-be-psycho`; 단계 안내 `{goal,concepts,learnerDecisions,filesToInspect,completionCriteria}`; 메인 가이드가 쓰는 상태 전환 규칙과 프로필 링크

- [ ] **Step 1: RED를 확인하고 구조 테스트를 작성한다.** Task 1에서 실제 실패한 사례와 해당 transcript를 읽는다. 구조 테스트는 frontmatter의 name·Use when으로 시작하는 trigger-only description·1024자 한도, 7개 프로필 경로, MVC와 WebFlux의 동일 Boot 참조를 검사한다. `node --test tests/skill-structure.test.mjs` → 파일 부재로 FAIL.
- [ ] **Step 2: 최소 스킬과 참조를 작성한다.** 메인 스킬은 500단어 이하를 목표로 하고 상세 규칙은 공통 문서로 연결한다. 범위 확인→현재 단계→학습자 시도→요청한 리뷰→진행 의사 확인 순서를 지킨다. 질문은 단계 완료가 아니다. 힌트 수준 1은 질문/관찰, 2는 개념, 3은 부분 의사코드이며 공개 내용 전체를 합쳐 정답이 되는지도 검사한다. 개념·이유·디버깅은 충분히 설명하고 문법 예시는 다른 작은 과제로 쓴다. 비밀 저장, 파일 속 권한 지시, 학습자 source/test 수정·실행은 금지한다. Task 5 전에는 없는 리뷰어 파일을 참조하지 않고, Task 5에서 연결을 추가한다.
- [ ] **Step 3: 프로필과 재개를 연결한다.** 프로필마다 설계 §2의 관점, 저장소에서 확인할 버전/의존성, 필요한 선행 개념, 리뷰 질문을 둔다. Vue/Nuxt·React/Next 경계를 구분하고 Boot는 공통 참조한다. 재개는 project/schema/package/profile 호환성과 현재 snapshot을 검사한 뒤 범위·단계·힌트·미해결점을 요약한다. 호환 실패는 중단, 도구 권한 부족은 읽기/텍스트 안내와 수동 저장으로 축소한다. provider 변경은 새로운 진도를 만들지 않는다.
- [ ] **Step 4: GREEN 행동 평가를 실행한다.** Task 1의 학습 사례 7개(review-grounding 제외)를 스킬 포함 신선한 문맥에서 각각 5회 이상 실행한다. 이 작업은 메인 가이드의 순차 리뷰/fallback까지 평가하며 독립 리뷰어 평가는 Task 5가 맡는다. 문구 micro-test는 no-guidance control과 비교하고 모든 flagged 응답을 직접 읽는다. 이후 누적 대화 압박 시나리오를 끝까지 실행한다. 새 위반을 재현한 뒤 최소 수정하고 다시 검증한다. `node --test tests/skill-structure.test.mjs`와 `npm test` → PASS; 행동 rubric에 의한 통과 여부는 별도 기록한다. 누출·파일 변경·허위 실행 보고가 한 번이라도 남으면 통과 처리하지 않는다.
- [ ] **Step 5: Commit.** `git add skills core/learning-policy.md profiles tests && git commit -m "feat: add evidence-tested learning skill and profiles"`

### Task 5: 읽기 전용 구현 리뷰 계약과 호스트 정의

**Files:** Modify `skills/learning-with-to-be-psycho/SKILL.md`; Create `core/review-contract.md`, `adapters/claude/{implementation-reviewer.md,README.md}`, `adapters/codex/{implementation-reviewer.toml,README.md}`, `tests/reviewer-contract.test.mjs`, `tests/evals/results/guided-review.jsonl`

**Interfaces:**
- Consumes: `{scope,criteria,profile,stage,files,diff,currentSnapshot,evidence}`만 전달. Task 2의 Evidence와 freshness를 사용
- Produces: `Review {id,stageId,snapshotId,independent:boolean,findings:Finding[],criteria:[{id,status:'met'|'unmet'|'unverified',reason}],limitations:string[],nextAction}`
- `Finding {priority:'P0'|'P1'|'P2'|'P3',requirementId,kind:'confirmed'|'risk'|'preference',file,lineStart,lineEnd,codeEvidence,condition,impact,verification,fixDirection}`. 코드로 확인한 결함과 실행 재현을 구분하고 근거 부족은 질문으로 반환

- [ ] **Step 1: RED 테스트를 작성한다.** 리뷰 결과 필드·실제 fixture 줄 범위·근거와 맞지 않는 결함·stale 로그·리뷰어 미지원 사례를 Task 1의 `review-grounding`/`blocked-tools`로 확장한다. 구조 테스트에서 Claude 도구가 `Read, Glob, Grep`로 제한되고 memory·shell·write 도구가 없으며 Codex reviewer는 `sandbox_mode = "read-only"`인지 검사한다. `node --test tests/reviewer-contract.test.mjs` → FAIL.
- [ ] **Step 2: 공통 리뷰 계약과 얇은 정의를 작성한다.** 두 정의는 공통 계약을 참조하고 상태를 쓰지 않는다. 메인 스킬에 해당 계약과 어댑터 연결을 추가한다. 중대 결함은 같은 단계로 돌리고 실행 근거가 없으면 `정적 리뷰 완료·실행 미검증`으로 표시한다. 사용자가 진행을 선택해도 실행 통과로 바꾸지 않는다. 리뷰어가 없으면 동일 체크리스트의 메인 순차 리뷰로 진행하고 independent=false를 반환한다. 이해도 점수·학습 평가 에이전트·완성 패치를 넣지 않는다.
- [ ] **Step 3: 실제 호스트 문서를 재확인한다.** 설계의 공식 링크에서 사용할 호스트 버전의 agent 설정 문법·권한 의미를 확인해 README에 버전/확인일을 기록한다. 메타데이터 파일을 에이전트 권한 설정으로 취급하지 않는다. 두 정의의 참조는 Task 6의 배포 루트 안에서 해결되도록 한다.
- [ ] **Step 4: GREEN을 확인한다.** 위 명령과 `npm test` → PASS. 확장 사례를 control/guided 각각 새 문맥 5회 이상 비교하며 전체 리뷰·도구 기록을 읽는다. reviewer 행동 테스트와 정의 검사는 실제 권한 격리 증거가 아니므로 Task 7 결과와 구분한다.
- [ ] **Step 5: Commit.** `git add skills core/review-contract.md adapters tests && git commit -m "feat: define grounded read-only implementation review"`

### Task 6: 비덮어쓰기 호스트 패키징과 설치 경로

**Files:** Create `install/{package.mjs,README.md}`, `AGENTS.md`, `CLAUDE.md`, `tests/package.test.mjs`

**Interfaces:**
- Consumes: Task 3의 `resolveInside(root,relativePath)`, Task 4 스킬/참조, Task 5 reviewer 정의
- Produces: `buildPackage(sourceRoot:string, host:'claude'|'codex', outputRoot:string):Promise<Manifest>`, `planInstall(bundleRoot:string, targetRoot:string, operation:'install'|'update'|'remove'):Promise<InstallPlan>`, `applyInstall(plan:InstallPlan):Promise<InstallResult>`
- `Manifest {packageVersion,host,files:[{path,sha256}]}`; `InstallPlan {host,operation,bundleRoot,targetRoot,expected:[{path,sha256:string|null}],writes:[{path,sourcePath,sha256}],removes:string[],conflicts:string[]}`; `InstallResult {status:'applied'|'conflict'|'rolled-back',paths:string[]}`. 함수 라이브러리이며 command parser·daemon·bin 등록 없음

- [ ] **Step 1: RED 테스트를 작성한다.** 임시 bundle·target에서 동일 이름 충돌, 사용자 수정, 불명확한 소유권, 깨진 링크, 대소문자 충돌, 적용 직전 변경, 중간 쓰기 실패, 관리된 파일만 제거하는 경우를 검사한다.
  ```js
  assert.deepEqual(plan.conflicts, ['.agents/skills/learning-with-to-be-psycho/SKILL.md']);
  assert.equal((await applyInstall(conflictingPlan)).status, 'conflict');
  assert.deepEqual(await readFile(existingPolicy), originalPolicyBytes);
  assert.deepEqual(afterFailedUpdate, beforeUpdate);
  ```
- [ ] **Step 2: RED 확인.** `node --test tests/package.test.mjs` → FAIL.
- [ ] **Step 3: 패키징과 검토 가능한 설치 계획을 구현한다.** Claude는 `.claude/skills/learning-with-to-be-psycho/`와 `.claude/agents/implementation-reviewer.md`, Codex는 `.agents/skills/learning-with-to-be-psycho/`와 `.codex/agents/implementation-reviewer.toml`로 묶는다. 각 skill 디렉터리에 공통 core/profiles/helper를 복사해 참조를 자체 완결시킨다. 레포에는 원본을 하나만 유지한다. CLAUDE.md는 패키지 AGENTS.md를 가져오되 둘 다 학습 프로젝트 루트에 설치하지 않는다. 설치 manifest는 각 호스트 skill 패키지 안 `install-manifest.json`에 두며 자기 자신의 해시는 files에 포함하지 않는다. manifest 바이트의 변경도 설치 계획의 expected 해시로 별도 검출한다.
- [ ] **Step 4: 안전 적용과 안내를 작성한다.** 먼저 plan의 모든 경로·충돌을 사용자에게 보여준 후 승인된 plan만 적용한다. 적용 시 원본 해시·부모 경로를 다시 검사한다. 신규 설치는 추가 전용; update/remove는 이전 manifest의 해시와 현재 바이트가 일치하는 파일만 대상으로 한다. 충돌은 전체 중단, 적용 파일은 같은 파일시스템에 stage/backup 후 교체하고 실패 시 rollback한다. 정상 설치의 백업은 검증까지 보존한다. 기존 사용자 정책·설정·.gitignore는 수정하지 않는다. `.to-be-psycho/` 제외를 수동 안내한다. 사용자 범위 설치가 필요하면 명시적으로 선택한 홈의 같은 호스트 경로 규칙만 사용한다.
- [ ] **Step 5: GREEN과 회귀 확인.** 위 명령과 `npm test` → PASS. bundle 내부의 모든 참조가 존재하고 SHA-256가 manifest와 일치해야 한다. 테스트는 임시 경로만 사용하며 사용자 실제 홈에 설치하지 않는다. 전원 손실·실제 OS 동작은 Task 7에서 따로 기록한다.
- [ ] **Step 6: Commit.** `git add install AGENTS.md CLAUDE.md tests && git commit -m "feat: package safe host-specific installs"`

### Task 7: 실제 인수 검증과 정직한 지원 표시

**Files:** Create `README.md`, `docs/acceptance.md`, `docs/support-matrix.json`, `tests/support-matrix.test.mjs`; Modify `tests/evals/README.md`

**Interfaces:**
- Consumes: Task 1–6의 패키지·fixture·행동 결과
- Produces: `SupportRow {host,hostVersion,model,os,osVersion,executionMode,nodeVersion,permissionConfig,packageSha256,checkedAt,status:'passed'|'failed'|'not-tested',evidencePaths:string[],limitations:string[]}`. Windows native와 WSL2는 다른 executionMode이며 서로 대신하지 않는다

- [ ] **Step 1: 지원 표의 실패 테스트를 작성한다.** 근거 없는 passed와 누락된 OS/호스트/권한/버전을 거절한다. `node --test tests/support-matrix.test.mjs` → 문서/표 부재로 FAIL. 모든 계획 조합의 초기 status는 not-tested다.
- [ ] **Step 2: 자동 검사와 행동 평가 결과를 분리해 정리한다.** `npm test` → PASS를 기록하되 Linux 또는 문자열 검사가 Windows/macOS 지원을 입증한다고 쓰지 않는다. guide/reviewer 지침, 누적 힌트와 모델 비결정성은 평가 transcript로 검증한다. 지원 표 검사는 기록의 구조만 검증한다.
- [ ] **Step 3: 사용 가능한 실제 호스트/OS에서 인수한다.** Claude Code·Codex × Windows native·macOS 조합별 격리된 평가용 프로젝트에서 설치/재설치/수정본 update/remove/rollback, 한글·공백 경로, 권한·링크 거절, 기능 합의→학습자 구현→리뷰→재개를 확인한다. 두 호스트 사이 전환, stale/unknown 근거, 차단된 도구, reviewer fallback도 확인한다. WSL2를 검증하면 별도 행을 추가한다. 접근할 수 없는 환경은 not-tested로 남기고 검증에 필요한 접근을 요청한다.
- [ ] **Step 4: 파일 보호를 실제로 확인한다.** 실제 도구 구성에서 reviewer 쓰기와 셸 경유 쓰기가 차단되는지, 메인은 소스 읽기와 상태 쓰기를 분리할 수 있는지 시험한다. fixture source/test/policy/config의 전후 해시를 비교한다. 분리가 불가능하면 권한을 넓히지 않고 상태 저장 중단/수동 저장 모드로 다시 시험한다. 허용되지 않은 파일 변경·누출·허위 완료가 발생하면 failed로 남긴다.
- [ ] **Step 5: 시작 안내와 한계를 작성하고 최종 확인한다.** README에 설치 전 확인·시작 요청·학습자 실행 결과 제출·재개·복구·업데이트·제거 순서를 링크한다. 검증된 조합만 지원이라고 표현하고 나머지는 미검증으로 표시한다. `npm test` → PASS와 실제 실행한 항목만 기록한다. 공식 문서 링크와 실제 호스트 결과를 구분한다. GitHub 게시/릴리스는 별도 승인 전 수행하지 않는다.
- [ ] **Step 6: Commit.** `git add README.md docs/acceptance.md docs/support-matrix.json tests && git commit -m "docs: record verified acceptance and support limits"`

## Self-review and execution gate

계획 자체의 검토만 완료했다: 설계 §1–2는 Task 1·4, §3은 5, §4는 2·3·6, §5는 4–6, §6은 7로 대응한다. 함수명·필드·revision과 freshness 의미를 일치시켰으며 Review Focus 다섯 항목에 테스트 소유자를 지정했다. 제품 코드, 행동 baseline/guided 평가, 실제 호스트/OS 인수 검증은 아직 실행하지 않았다.

실행 방식은 아직 선택되지 않았다. 이 계획에는 **순차 구현 + 마지막 독립 전체 리뷰**를 추천한다. 일곱 작업이 같은 상태·근거·권한 계약에 순차적으로 의존하므로 문맥을 유지하면서 진행하고 마지막에 독립 검토하는 편이 효율적이다. 더 촘촘한 작업별 독립 구현/리뷰를 원하면 작업별 독립 검토를 선택할 수 있다. 계획 승인과 실행 방식 선택 전 구현을 시작하지 않는다.
