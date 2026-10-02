# to-be-사이코패스 · to-be-psycho

**AI는 가이드하고 코드는 내가 친다.**

만들고 싶은 기능을 직접 구현하며 배우는 Claude Code / Codex용 스킬 패키지입니다. AI와 작업 범위를 정하고 필요한 개념과 힌트를 얻은 뒤 소스와 테스트는 직접 작성하고 실행합니다. 막히면 질문하고 작성한 코드는 리뷰를 요청하세요.

예를 들어 이렇게 시작합니다.

> learning-with-to-be-psycho로 장바구니 수량 선택 기능을 배우고 싶어. 코드는 내가 작성할게.

## 어떻게 배우나요?

1. **목표와 범위를 정합니다.** 만들 기능, 현재 저장소, 완료 기준을 AI와 합의합니다. 정해진 커리큘럼 대신 지금 만들려는 기능에서 시작합니다.
2. **현재 단계에 집중합니다.** AI는 필요한 개념과 다음 행동을 안내합니다. 질문하거나 힌트를 받았다는 이유로 진도를 넘기지 않습니다.
3. **직접 구현하고 테스트합니다.** 소스와 테스트를 작성한 뒤 실행합니다. 리뷰를 요청할 때는 실행 명령, 환경, 시점, 대상 코드 스냅샷과 비밀을 제거한 결과를 함께 제출하세요.
4. **리뷰하고 다음 단계를 선택합니다.** 합의한 기준과 현재 코드를 확인합니다. 오래된 로그를 현재 통과로 보거나 진행에 동의했다는 이유로 실행 미검증 표시를 지우지 않습니다.

개념과 이유, 디버깅 설명은 충분히 제공합니다. 독립 리뷰어를 사용할 수 없으면 메인 AI가 같은 계약에 따라 순차 리뷰하고 그 사실을 밝힙니다.

## 어떤 기술을 다루나요?

- HTML / CSS / JavaScript
- Vue와 필요한 경우의 Nuxt
- React와 필요한 경우의 Next
- Java / Spring 기초, Spring MVC, Spring WebFlux
- MVC와 WebFlux가 함께 쓰는 Spring Boot 공통 모듈

이 목록은 학습에 참고하는 관점입니다. 실제 버전과 의존성은 프로젝트에서 확인하며 모든 프레임워크와 버전의 동작을 검증했다는 뜻은 아닙니다.

## 설치

Git, Node.js 22 이상과 사용할 Codex 또는 Claude Code를 준비하세요. 외부 npm 의존성은 없습니다. 아래는 **학습할 프로젝트 하나에 설치**하는 방법입니다.

설치 함수는 Linux에서 확인했습니다. 실제 Codex·Claude Code의 스킬 발견과 권한 제한, Windows native·macOS 동작은 아직 검증하지 않았습니다. 먼저 [검증 범위](#어디까지-검증했나요)를 확인하세요.

먼저 패키지 저장소를 내려받습니다. 아래 공통 명령은 Windows PowerShell과 macOS/Linux 터미널에 입력합니다.

```sh
git clone https://github.com/whoisyourbias/to-be-psycho.git
cd to-be-psycho
node --version
node
```

`node --version`이 `v22` 이상인지 확인하세요. 별도 `npm install`은 필요 없습니다. `node`를 실행한 뒤 `>`가 보이면 Node 대화형 창입니다. 다음 코드는 셸이 아니라 이 창에 붙여 넣습니다.

```js
const { buildPackage, planInstall, applyInstall } = await import('./install/package.mjs');
const fs = await import('node:fs/promises');
const path = await import('node:path');
const os = await import('node:os');
const source = await fs.realpath(process.cwd());
const staging = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'to-be-psycho-')));
```

이제 **실제로 공부할 프로젝트**의 절대 경로를 지정합니다. 방금 내려받은 `to-be-psycho` 폴더와 구분하세요. 프로젝트 폴더는 이미 있어야 합니다. 아래 둘 중 자신의 운영체제에 맞는 **한 줄만** 골라 실제 경로로 바꿉니다.

Windows 예시입니다. Node 문자열 안에서는 `/`를 쓰면 역슬래시를 두 번 적을 필요가 없습니다.

```js
const target = await fs.realpath('C:/Users/me/projects/my-app');
```

macOS 예시입니다. Linux에서는 `/home/me/projects/my-app`처럼 바꿉니다.

```js
const target = await fs.realpath('/Users/me/projects/my-app');
```

이 창을 닫지 말고 사용할 도구의 설치 방법으로 이어갑니다. Codex와 Claude Code를 모두 설치하려면 한쪽을 마친 뒤 새 Node 창에서 공통 준비부터 다시 시작하세요.

### Codex에 설치

Node 창에서 다음 코드를 실행합니다. 아직 학습 프로젝트에 파일을 쓰지 않고 임시 폴더에 배포물을 만든 뒤 설치 계획을 보여 줍니다.

```js
const bundle = path.join(staging, 'codex');
await buildPackage(source, 'codex', bundle);
const plan = await planInstall(bundle, target, 'install');
console.log(JSON.stringify(plan, null, 2));
```

계획에서 다음을 확인하세요.

- `targetRoot`: 설치하려는 학습 프로젝트가 맞는지
- `expected`, `writes`, `removes`: 확인할 기존 파일, 쓸 파일, 지울 파일이 예상과 같은지. 처음 설치할 때 `removes`는 `[]`입니다
- `conflicts`: `[]`인지. 경로가 하나라도 나오면 멈추고 충돌을 먼저 확인합니다

계획을 읽고 설치하기로 했다면 **같은 Node 창에서** 아래 코드만 실행합니다. `plan`을 수정하거나 JSON으로 저장했다가 다시 읽어 사용하지 마세요.

```js
const result = await applyInstall(plan);
console.log(result);
```

`status: 'applied'`이면 파일 설치가 끝났습니다. 프로젝트에 다음 경로가 생깁니다.

```text
.agents/skills/learning-with-to-be-psycho/
.codex/agents/implementation-reviewer.toml
```

Node 창에 `.exit`를 입력하세요. 터미널에서 학습 프로젝트로 이동한 뒤 `codex`를 실행하고 새 세션에서 스킬이 보이는지 확인합니다.

**Codex 대화창**에 입력합니다. `$`가 포함되어 있으니 터미널 명령으로 실행하지 마세요.

```text
$learning-with-to-be-psycho 장바구니 수량 선택 기능을 배우고 싶어. 코드는 내가 작성할게.
```

리뷰어 설정은 `read-only`와 승인 요청 금지를 지정합니다. 다만 부모 세션의 권한이 자식에게 다시 적용될 수 있으므로 TOML 파일만 보고 읽기 전용이라고 판단하면 안 됩니다. 실제 권한을 확인할 수 없으면 메인 AI의 순차 리뷰와 수동 상태 저장을 사용하세요. 자세한 내용은 [Codex 안내](adapters/codex/README.md)를 참고하세요.

### Claude Code에 설치

공통 준비를 마친 Node 창에서 다음 코드를 실행합니다.

```js
const bundle = path.join(staging, 'claude');
await buildPackage(source, 'claude', bundle);
const plan = await planInstall(bundle, target, 'install');
console.log(JSON.stringify(plan, null, 2));
```

`targetRoot`가 학습 프로젝트인지, `expected`, `writes`, `removes`의 경로가 예상과 같은지 확인합니다. `conflicts`에 경로가 있으면 진행하지 마세요. 처음 설치할 때 `removes`와 `conflicts`는 모두 `[]`여야 합니다.

계획을 읽고 설치하기로 했다면 **같은 Node 창에서** 적용합니다. `plan`을 수정하거나 JSON으로 저장했다가 다시 읽어 사용하지 마세요.

```js
const result = await applyInstall(plan);
console.log(result);
```

`status: 'applied'`이면 다음 경로에 파일이 설치됩니다.

```text
.claude/skills/learning-with-to-be-psycho/
.claude/agents/implementation-reviewer.md
```

Node 창에 `.exit`를 입력하세요. 터미널에서 학습 프로젝트로 이동한 뒤 `claude`를 실행하고 새 세션에서 스킬이 보이는지 확인합니다.

**Claude Code 대화창**에 입력합니다.

```text
/learning-with-to-be-psycho 장바구니 수량 선택 기능을 배우고 싶어. 코드는 내가 작성할게.
```

리뷰어는 `Read`, `Glob`, `Grep`만 사용하도록 설정되어 있습니다. 실제로 그 도구만 제공되는지 확인하세요. 리뷰가 막힌다고 `Bash`, `Write`, `Edit`나 쓰기 가능한 MCP 도구를 추가하면 안 됩니다. 권한 제한을 확인할 수 없으면 메인 AI의 순차 리뷰와 수동 상태 저장을 사용합니다. 자세한 내용은 [Claude Code 안내](adapters/claude/README.md)를 참고하세요.

### 설치 중 막혔다면

- `conflict`: 기존 동명 스킬이나 파일, 바뀐 설치 계획 등을 확인하세요. 기존 파일을 지우거나 덮어써서 통과시키지 마세요
- `ENOENT`: 지정한 학습 프로젝트 경로가 실제로 있는지 확인하세요
- `UNSAFE_PATH`: 링크·정션·하드링크나 모호한 경로를 피하고 일반 폴더를 사용하세요
- `applied-with-cleanup-needed`: 파일 적용은 끝났습니다. 재설치하지 말고 [정리 절차](install/README.md#3-업데이트--제거)를 확인하세요
- Node 창을 닫았다면: 공통 준비부터 새 계획을 만들고 다시 검토하세요. 저장한 계획 JSON은 재사용할 수 없습니다

설치기는 프로젝트 루트의 `AGENTS.md`, `CLAUDE.md`, 설정 파일과 `.gitignore`를 바꾸지 않습니다. 기존 동명 스킬도 덮어쓰지 않습니다. 업데이트와 제거, 사용자 범위 설치는 [상세 설치 안내](install/README.md)를 확인하세요.

`install/package.mjs`는 함수 라이브러리라 실행 명령을 받는 CLI가 없습니다. 위 예시처럼 Node에서 함수를 가져와 사용합니다.

설치 뒤에는 일회용 프로젝트에서 스킬과 리뷰어가 로드되는지, 소스·테스트를 수정하거나 셸로 우회해 쓰지 못하는지 확인하세요. 메인 AI도 상태 영역에만 쓸 수 있어야 합니다. 이를 확인할 수 없으면 권한을 넓히지 말고 읽기·텍스트 안내와 수동 상태 저장을 사용하세요.

## 진도 저장과 재개

[상태 계약](core/state-format.md)에 따라 `.to-be-psycho/state.json` 하나에 합의한 범위, 단계, 시도, 공개한 힌트, 스냅샷, 제출 근거와 리뷰를 저장합니다. `.to-be-psycho/`는 `.gitignore`에 직접 추가하세요. 스킬이 대신 수정하지 않습니다.

다시 시작할 때 프로젝트 신원, 스키마, 패키지·프로필 버전과 현재 스냅샷을 확인합니다. Claude Code와 Codex를 바꿔도 진도와 힌트 이력을 초기화하지 않습니다. 상태를 읽지 못하거나 파일이 손상됐다고 빈 상태로 덮어쓰지 않으며 충돌이나 기존 lock이 있으면 중단합니다.

복구할 때는 정상 백업의 SHA-256을 확인하고 명시적으로 승인한 뒤 `recoverState(root,{confirmed:true,backupSha256})`를 호출합니다. 손상된 원본은 별도로 보존합니다. 실제 쓰기 권한이 검증되지 않았다면 수동 저장·복구를 선택하세요. 업데이트와 제거는 [설치 안내](install/README.md#3-업데이트--제거)를 따릅니다.

## 하지 않는 일

- 학습자의 소스·테스트를 대신 작성·수정하거나 실행하기
- 현재 과제의 완성 코드, 전체 테스트, 교체 패치 제공하기. 여러 힌트를 합쳐 정답이 되는 경우도 제한합니다.
- 이해도 점수나 불이익 부여, 필수 사후 평가 에이전트 실행
- 사용자 정책·설정 변경, 충돌 자동 병합, 동시 학습 세션
- 실행하지 않은 테스트가 통과했다거나, 확인하지 않은 독립 리뷰와 OS 지원을 주장하기

이 패키지는 별도 앱, UI, 실행 에이전트나 정답 차단 보안 필터가 아닙니다. 모델이 지침을 얼마나 따르는지와 실제 호스트 권한에 의존합니다.

## 어디까지 검증했나요?

v0 로컬 구현·검증을 마쳤습니다. Linux / Node.js 24.19.0에서 자동 테스트 **141개가 통과**했고 현재 가이드·리뷰 행동 평가 45회에서 수동으로 기록한 위반은 없습니다. 실패 기준선과 수정 전 결과도 보존했습니다. 행동 평가는 실제 Claude Code·Codex 세션이나 권한 격리를 검증한 결과가 아닙니다.

**Windows native / macOS의 Claude Code·Codex 조합은 네 가지 모두 미검증입니다.** 설치 파일이나 읽기 전용 설정이 있다는 이유만으로 지원과 권한 제한이 검증되지는 않습니다.

검증 근거와 남은 한계는 [인수 기록](docs/acceptance.md), [지원 표](docs/support-matrix.json), [결정과 트레이드오프](docs/decisions-and-tradeoffs.md)에 정리했습니다.

## 개발과 검증

이 패키지의 소스 폴더에서 실행합니다.

```sh
npm test
```

Node builtin test runner만 사용하므로 별도 `npm install`은 필요하지 않습니다. 패키지 자체의 테스트이며 학습자의 코드를 대신 실행하지 않습니다. [행동 평가 방법](tests/evals/README.md)과 [rubric](tests/evals/rubric.md)은 구조 검사와 행동·권한 검증을 구분합니다.

승인된 [설계](docs/superpowers/specs/2026-10-02-to-be-psycho-design.md)와 [계획](docs/superpowers/plans/2026-10-02-to-be-psycho.md)도 함께 보존합니다.
