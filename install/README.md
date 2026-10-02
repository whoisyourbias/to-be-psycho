# 패키징과 안전한 설치

Node.js 22 이상. 외부 npm 의존성, 실행 루프, CLI는 없습니다. 이 모듈은 함수 라이브러리입니다. 학습자 코드나 테스트를 실행하지 않습니다. 먼저 README와 실제 지원 상태를 확인하세요.

## 1. 배포물 만들기

이 저장소를 신뢰하는 위치에 내려받고, 비어 있는 출력 디렉터리의 부모를 먼저 만드세요. Node ESM에서 다음 함수를 가져옵니다.

```js
import { buildPackage, planInstall, applyInstall } from './install/package.mjs';
await buildPackage('/absolute/package-root', 'codex', '/absolute/output/codex');
await buildPackage('/absolute/package-root', 'claude', '/absolute/output/claude');
```

호스트별 배포물은 공통 core, profiles와 helper의 복사본을 skill 내부에 포함하고 참조를 다시 연결합니다. 원본은 저장소에서 하나만 관리합니다. `manifest.json`과 skill 내부 `install-manifest.json`은 같은 내용입니다. 매니페스트는 자기 자신의 해시를 포함하지 않습니다. 이것은 무결성/소유권 기록이며 서명 또는 공급망 신뢰 보증이 아닙니다.

## 2. 설치 계획 검토 후 승인

```js
const plan = await planInstall('/absolute/output/codex', '/absolute/learner-project', 'install');
console.log(JSON.stringify(plan, null, 2));
// 사용자에게 targetRoot, 모든 expected/writes/removes와 conflicts를 보여 주고 승인을 받습니다.
// 승인 후 같은 프로세스에서 정확히 같은 plan 객체를 사용합니다.
const result = await applyInstall(plan);
console.log(result);
```

두 호출을 사용자 승인 없이 자동으로 이어 실행하지 마세요. 라이브러리가 승인을 대신하지 않습니다. 프로세스가 종료되거나 계획을 JSON으로 저장해 다시 읽었다면 새 계획을 만들고 다시 검토하세요. 반환 계획의 어떤 값도 변경하지 마세요. 변경/위조된 계획은 conflict입니다.

- Claude: `.claude/skills/learning-with-to-be-psycho/`, `.claude/agents/implementation-reviewer.md`
- Codex: `.agents/skills/learning-with-to-be-psycho/`, `.codex/agents/implementation-reviewer.toml`
- 사용자 범위가 꼭 필요하면 사용자가 명시적으로 선택한 홈을 targetRoot로 사용합니다. 자동 홈 탐색이나 전역 설정 변경은 하지 않습니다
- 프로젝트 루트의 AGENTS.md, CLAUDE.md, 설정과 .gitignore는 설치/수정하지 않습니다. 패키지 정책 파일은 skill 내부에만 복사됩니다
- `.to-be-psycho/`를 버전 관리에서 제외하는 일은 사용자가 직접 수행합니다

기존 동명 파일이나 사용자 수정이 있으면 전체 작업을 멈춥니다. 충돌 파일을 지우거나 이름을 바꿔 문제를 숨기지 마세요. 포터블 안전 경로를 위해 링크/정션/하드링크, 대소문자·Unicode 정규화 별칭, Windows 예약 이름/ADS 및 모호한 경로는 보수적으로 거절합니다. 공백과 한글 경로, 역슬래시 상대 경로는 허용합니다.

## 3. 업데이트 / 제거

동일 API에서 operation을 `update` 또는 `remove`로 정하고 새 승인을 받습니다. 기존 설치 매니페스트의 경로와 해시가 현재 파일과 일치해야 관리 파일로 인정합니다. 매니페스트 바이트도 계획 후 재검사합니다. 제거는 이전 설치가 소유한 파일만 지우고 사용자 파일은 남깁니다. 빈 디렉터리는 남을 수 있습니다.

모든 파일을 같은 파일시스템의 고유 transaction 디렉터리에 먼저 기록/flush하고, 기존 파일은 backup으로 옮긴 뒤 교체합니다. 결과 해시 검증까지 backup을 보존하며 성공 검증 후 정리합니다. 일반 실패는 rollback 후 `rolled-back`; 적용 전 변경/충돌은 `conflict`입니다. 파일 적용·해시 검증이 끝났으나 transaction/lock 정리가 실패하면 `applied-with-cleanup-needed`를 반환합니다. 적용은 완료된 것이므로 재설치/재실행하지 마세요. `cleanup`에는 targetRoot 아래의 transactionPath, lockPath 및 실패한 정리 작업/오류 code가 있습니다. 기존 파일을 복원한 후 정리만 실패한 경우에는 `rolled-back`과 같은 cleanup 정보를 함께 반환합니다. 어느 경우든 다른 writer가 없고 승인 계획의 적용/제거 결과가 맞는지 확인한 다음, 반환된 정확한 경로만 수동 정리하세요. 정리 실패 시 잠금은 자동 해제하지 않으며, 이미 부분 정리되었을 수 있으므로 남은 경로를 먼저 확인합니다. 복구 자체가 안전하지 않으면 `ROLLBACK_FAILED`로 중단하고 transaction/lock을 보존합니다. 수동으로 내용을 비교하고 복구하기 전 삭제하지 마세요. 잠금이 있다고 자동 제거하지 않습니다.

플랜·해시 재검사는 일반 충돌을 줄이지만 전원 손실, 비협조적인 프로세스의 극미세 경로 교체 경쟁, 모든 OS 파일시스템 특성을 보장하지 않습니다. 실제 OS별 인수 결과가 없으면 지원을 주장하지 않습니다.

## 4. 호스트 확인

설치 후 실제 호스트에서 skill 발견, 제한된 reviewer 호출, 소스/테스트 비수정, 셸 경유 쓰기 차단과 상태 영역 분리를 일회용 fixture로 확인합니다. 읽기 전용 권한을 확인할 수 없으면 권한을 넓히지 말고 메인 순차 리뷰와 수동 상태 저장을 사용하세요. 설정 파일만 존재하는 것은 권한 검증이 아닙니다.
