# DiagramPlay

`.diagramplay` 원본 하나를 움직이는 문서 그림 하나(아키텍처, 카드 흐름, 시퀀스, ERD와 클래스 다이어그램)로 바꾸는 명령. 마크다운 문서 안의 ` ```diagramplay ` 블록도 그림으로 반영한다(`diagramplay md`).

설계 문서는 [docs/README.md](docs/README.md)에 있다.

## 구성

`src/` 최상위에는 진입 파일(`index.js` 공개 API, `index.d.ts` 타입 선언, `cli.js` 명령)만 있고, 나머지 소스 파일은 모두 아래 폴더 가운데 하나에 속한다.

| 경로 | 내용 |
|---|---|
| `src/compile/` | 원본 하나를 장면과 시간표로 만드는 순서(`figure.js`의 `buildFigure`, 내부 재배치 `reflowFigure`), 보기마다 크기·배치·글 상자를 정하고 장면을 잇는 곳(`scene.js`), 보기 모형으로 줄이기(`views.js`), 생성 예산(`budget.js`), 원본이 읽는 파일의 경로 경계(`base-path.js`), 명령이 쓰는 원본 읽기·만들기·진단 알림·결과 파일 쓰기(`reported.js`, `diagnostics.js`), `--docs` 문서 품질 검사 실행(`docs-check.js`). 모형은 받은 원본 글을 `figure.source`로 간직한다 |
| `src/source/` | 원본 읽기: 낱말 나누기, 문장 해석, 이름과 규칙 확인, 보기 정하기(이름 없는 보기와 기본 보기, `views-check.js`). 문법 표의 정본은 `grammar.js` |
| `src/measure/` | 글꼴 파일로 글 폭 재기(`fonts.js`), 그림 폭 규칙(`canvas.js`), 카드의 안쪽 여백과 머리(`card.js`), 글 역할과 카드 안 글 한 줄의 자리와 폭(`texts.js`), 카드 내용 줄(`content.js`), 장식 자리(`decor.js`), 도형·테이블·API·클래스·큐 크기(`sizes.js`, `table.js`, `class.js`, `queue.js`), 값 글자 자리(`value-slots.js`) |
| `src/layout/` | elkjs 배치(아키텍처, 카드 흐름, ERD와 클래스)와 시퀀스 배치, 판 합치기(`panels.js`) |
| `src/timeline/` | 시간 흐름을 시간표로 펴기(`compose.js`), 흐름 단계(`flow.js`), 값 바꾸기(`values.js`)와 값 모형 도우미(`value-texts.js`), 카드 줄의 상태(`rows.js`), 재생기가 읽는 표시 정보(`marks.js`, `pulse.js`), 시퀀스 구획 펴기, 이동 시간, 사라짐, 시간 눈금, 기존 사건 시각을 보존하는 재배치(`reflow.js`) |
| `src/flow/` | 조건과 대기의 이벤트 처리(`events.js`, `reserve.js`, `event-support.js`, `event-budget.js`)와 흐름 경로 기하(`track-geometry.js`, `track-pace.js`) |
| `src/chip/` | 점 위에 뜨는 글 상자의 크기와 자리(`place.js`), 박자 이동 계획(`plan.js`), 겹침과 흐려짐(`clash.js`, `fade.js`), 격자 색인, 도형 이름 가림을 피하는 여유(`room.js`) |
| `src/math/` | 빌드와 재생기가 함께 쓰는 순수 수학: 움직임 곡선(`easing.js`, `motion.js`), 이동 구간(`hop.js`), 경로(`route.js`), 최댓값·최솟값(`extremes.js`). `motion.js`와 `hop.js`는 함수 원문을 HTML에 넣는다 |
| `src/color/` | 정식 색 이름(팔레트 계열 일곱과 회색, `tone.js`), 범주 색 순서(`palette.js`) |
| `src/format/` | 출력 숫자 서식(`numbers.js`), SVG 글자와 좌표 다듬기(`text.js`), 파일 이름을 링크 주소로 바꾸기(`href.js`), 테이블 컬럼의 키 표시(`columns.js`) |
| `src/draw/` | 장면 조립(`figure.js`), 카드(`card.js`)와 카드 면(`surface.js`), 카드 안 글(`texts.js`), 장식과 아이콘(`decor.js`), 카드 내용(`content.js`), 연결선과 선 라벨(`connector.js`), 화살촉(`arrow.js`), 색 이름과 표현을 읽는 곳(`look.js`), 공통 CSS 가져오기(`styles.js`, `@woonyong-choi/design-tokens/styles/diagram/`에서 읽음) |
| `src/check/` | 그림 검사(`figure.js`). 항목 목록(`items.js`)과 항목별 판정 파일. `--docs` 문서 품질 검사의 목록은 `docs-items.js`, 판정은 `docs.js`와 `docs-text.js`이고 실행은 `compile/docs-check.js` |
| `src/animate/` | 시간표 기반 SVG 효과(keyframes와 SMIL) |
| `src/svg/` | 스크립트 없이 움직이는 SVG와 멈춘 SVG(`output.js`의 `toSvg`) |
| `src/html/` | HTML 재생기 문서와 목록(`output.js`의 `toHtml`, `listing.js`), 그림 틀(도구 막대 하나와 탭 줄 하나, `player-script.js`) |
| `src/player/` | 브라우저에서 도는 재생기: 시각의 순수 표본 추출(`sample.js`), 시계와 장면 들어가기와 탭 연결(`play.js`), 모습 쓰기(`stage.js`, `effects.js`, `values.js`), 글의 백틱 나누기(`rich-text.js`), 전체화면과 전체화면 안의 확대·축소·끌어 옮기기(`view.js`), 문법 복사와 HTML 다운로드(`export.js`), 이동 곡선(`curve.js`) |
| `src/markdown/` | `md` 명령: 마크다운 블록 찾기와 이미지 줄 넣기(`find.js`, 파일을 다루지 않음), 실행(`run.js`), 원본 접기(`fold.js`), 둘째 장면부터를 `<details>`로 두는 장면 구간(`scenes.js`), CommonMark 블록 구조를 한 번 따라가는 걸음(`tags.js`)과 블록 판별(`blocks.js`), 만든 SVG의 소유 표시(`diagramplay md v2`, `owner.js`), 출력 폴더 잠금(`lock.js`), 파일 쓰기(임시 파일과 rename, 실패 때 되돌리기, `write.js`) |
| `src/import/` | 다른 도구 원본(Mermaid 흐름·시퀀스·ERD·클래스와 DBML) 읽기와 `.diagramplay` 글 쓰기, `import` 명령 실행(`run.js`) |
| `src/icons/` | 공통 카탈로그 읽기와 사용자 SVG 검증. 내장 도형과 조작 아이콘은 design-tokens 정본 |
| `action.yml`, `.github/workflows/` | GitHub Action(composite), CI, `v*` 태그 배포 |
| `examples/` | 표현마다 하나인 예제 원본(`icons/`는 예제가 읽는 자료). 결과는 `npm run catalog`가 `.local/examples/`에 생성 |
| `scripts/` | 문법·검사 문서, 예제·그림 생성, 설치 검사, 크기·비용 참고 검사 |
| `test/` | 공개 진입점과 공통 부품의 계약 시험, 브라우저 시험(`browser/`, 시험 원본 `browser/fixtures/`) |
| `docs/` | 설계 문서, 그림 종류별 레퍼런스(`reference/`), README 그림(`assets/showcase/`) |

## 명령

CI와 태그 릴리스의 runner는 `ubuntu-24.04`로 고정한다. Action 자체는 Node 24 기반 공식 release의 SHA로 고정한다(2026-10-19 확인). 제품 Node 20·22 행렬은 유지하고, composite Action은 호출한 작업에 Node 20 이상이 없을 때만 Node 20(입력 `node-version`)을 설치한다. CI와 release의 기본 권한은 `contents: read`이고 쓰기는 release 작업에만 준다. release의 `check` 작업은 CI `test` 작업과 같은 검사 목록이다(`test/tooling.test.js` G4). 아래 CI 설명의 runner는 이 고정값을 따른다.

```sh
npm test
npm run check
npm run check:sources
npm run check:figures
npm run check:advisory
npm run check:package -- /absolute/new-consumer-path
```

`npm test`는 공개 진입점(`buildFigure`, `toSvg`, `toHtml`, 명령, 마크다운)과 실제 공통 부품의 진입점으로 계약을 확인하는 시험이고 브라우저를 열지 않는다. 같은 요소(카드, 필드, 선, 화살촉, 라벨, 아이콘, 탭, 도구 막대)는 한 부품이 모양과 상태를 소유하므로 그 부품의 시험도 한 곳에 한 번만 두고, 종류마다 같은 색, 두께, 모양 시험을 되풀이하지 않는다. 부품 시험은 둘이다. `test/components.test.js`는 부품의 기하와 구조(잰 값과 그린 값이 같다)를, `test/component-state.test.js`는 움직이는 SVG와 HTML 같은 출력 어댑터가 같은 상태 정의(`--fx-*`)와 표식을 읽는지를 본다. 같은 계약을 두 파일이 되풀이하지 않는다. `test/text.test.js`는 글 읽기와 글 자리(측정이 놓은 자리를 그리는 쪽과 검사가 그대로 읽는가, 긴 제목의 줄바꿈)를, `test/sampler.test.js`는 순수 표본 추출기(`player/sample.js`)를 HTML에 넣는 같은 `PLAYER_SCRIPT`로 Node의 격리 컨텍스트(`node:vm`)에서 돌려 본다. 브라우저 시계와 DOM에 쓰는 일은 이 시험이 보지 않는다. 종류별 시험은 그 종류만의 수학, 의미, 배치 계산을 보고, 조합 시험은 부품 사이의 데이터 전달과 연결만 본다. 시험이 부르는 부품 진입점은 코드가 실제로 쓰는 것이어야 하고, 시험만을 위한 내보내기나 훅을 만들지 않는다. 시험 개수를 목표로 삼지 않는다. 실제 Chrome에서 폭과 테마를 바꿔 가며 그림을 눈으로 보는 화면 검수는 자동 시험이 대신하지 않는 별도의 일이고, 통과한 시험을 화면 검수의 완료로 쓰지 않는다. CI(`ubuntu-24.04`, Node 20과 22)는 `npm ci` 뒤 `npm test`, `npm run check`, `npm run check:sources`, `npm run check:figures`, `npm run check:docs`, Node 22 작업의 `npm run test:browser`(설치된 Chrome에서 좁은 화면 HTML 회귀 검사)와 저장소 밖 tarball 설치 검사(`npm run check:package`)를 돌고, `action` 작업이 추적하는 모든 `.diagramplay`와 `.md`에 저장소 Action을 한 번 돈다. 실행 결과와 날짜는 GitHub Actions 기록과 이슈에 있다.

`npm run check:sources`는 예제, 문서 그림, showcase 원본(`examples`, `docs/assets`, `docs/assets/showcase`의 `.diagramplay`)을 `--strict`로 확인하고, `npm run check:figures`는 폴더를 걸어 찾은 모든 마크다운 문서(`scripts/run-md.mjs`, 울타리 모양과 상관없고 블록을 모두 지운 문서도 포함)의 `md --check --strict`와 showcase·how-it-works SVG가 원본에서 다시 만든 결과와 같은지(`build-showcase.mjs --check`) 본다. 고칠 때는 `npm run figures`다.

의존성 버전 고정 정책:

- 런타임 `dependencies`는 `^` 범위로 적고, 이 저장소와 Action은 `package-lock.json`(`npm ci`)으로 정확한 버전을 고정한다. 배포한 패키지를 설치하는 쪽은 범위 안의 최신을 받는다.
- 정확한 버전으로 적는 것은 범위 안의 새 판이 출력 바이트를 바꿀 수 있는 의존성뿐이다. 지금은 `postcss`(디자인 패키지와 같은 판을 써야 같은 CSS가 나온다)와 `typescript`(선언 검사 결과가 판마다 달라진다)다. 그 밖의 의존성에 정확한 버전을 더하지 않는다.
- 디자인 `@woonyong-choi/design-tokens`는 npm 레지스트리에 배포하지 않고 commit 고정 tarball로만 받는다. `dependencies`에 그 tarball URL을 적고 `bundleDependencies`로 배포물에 묶는다. 주소는 `package.json`과 잠금 파일에만 있고 Action과 `check:package`는 잠금 파일과 배포물로 설치한다. 디자인 도표 tarball의 실행 의존성은 `postcss` 하나라 묶을 때 따로 빼는 단계가 없다. 묶은 사본이 `npm ls`에서 유효하도록 `acceptDependencies`에 디자인 `version`을 적는다. 소비자가 다른 디자인 commit을 쓰는 방법은 [아키텍처의 배포](docs/architecture.md#배포)에 있다.
- 워크플로의 Action은 공식 release의 commit SHA로 고정하고 판 이름을 주석으로 단다.

`npm run check`는 design-tokens의 `design-tokens-check`로 소스의 하드코딩을 검사한다. 디자인은 `dependencies`에 commit을 고정해 배포물에 묶는다. 공통 정본 변경 후 새 commit의 `diagram` 배포 tarball URL로 `dependencies`와 잠금 파일을 갱신하고 `npm run figures`, `npm test`, `npm run check` 순서로 확인한다.

`npm run check:advisory`는 유지보수 힌트를 알린다. 파일 300줄, 함수 40줄, 매개변수 3개(`check-size.mjs`)와 비용 주석 누락(`check-cost-comments.mjs`)을 찾고 항목이 있어도 0으로 끝난다. 두 검사는 줄 시작 모양을 정규식으로 읽어서 여러 줄 매개변수, 블록 주석 안의 중괄호, 메서드 호출 이름이 같은 재귀 판정 등을 틀리게 읽는다. 설계나 정확성의 증거가 아니므로 항목을 없애려고 일관된 코드를 쪼개거나 근거 없는 점근 표기를 적지 않는다. 실행 오류(없는 경로, 잘못된 옵션)는 이 명령도 2로 실패한다. 알고리즘의 실제 복잡도를 설명하는 비용 주석은 계속 쓴다.

## 규칙

- 목적은 흐름이 실행되는 아키텍처·카드 흐름·시퀀스와 ERD·클래스 다이어그램이다. 테이블·컬럼·PK/FK·복합 키·관계·클래스·인터페이스·API 필드는 유지한다. 통계 차트·시계열 플롯·측정 추적·타이밍 축·비트 격자를 범위에 다시 추가하지 않는다. 카드의 설명·값·큐·조건·상태 변화와 트래픽은 핵심이다.
- 표현은 풍부하게 유지하면서 작성은 단순해야 한다. 기본값으로 가능한 그림에 불필요한 옵션·보기·장면 선언을 요구하지 않고, 같은 의미는 같은 문법을 사용한다. D2 같은 문서 그림 도구와 비교할 때 기능 개수보다 실제 글에 넣는 최소 예제의 작성량·읽기 쉬움·수정 범위를 대조한다.
- 애니메이션과 트래픽 효과는 필수 기능이다. 장면별 재생·반복, 동시 이동, 값 변화와 강조를 기능 축소 후보로 취급하지 않는다. 공통 시간표·문법·부품으로 자연스럽게 표현되는지 검수한다.
- DiagramPlay와 homepage는 design-tokens의 같은 토큰·CSS·아이콘·공통 구성 요소·동작을 상속한다. 화면 표현값의 하드코딩과 요소별 마크업·CSS·상태 처리의 재구현은 금지다. 같은 토큰을 읽는 복사 구현도 허용하지 않는다.
- 공통 표현은 design-tokens에서 한 번 구현하고 DiagramPlay는 그림 모형과 배치 결과를 넘겨 조립한다. 차이는 공통 역할의 속성·변형으로 필요한 부분만 재정의한다. 그림 종류나 예제별 CSS·좌표·여백 보정으로 결함을 숨기지 않는다.
- 같은 의미의 선언·참조·장면·트래픽·효과는 하나의 문법과 모형을 사용한다. 그림 종류마다 문법 별칭·파서·상태 전이를 따로 만들지 않는다. 문법의 정본은 `src/source/grammar.js`이며 문서 표는 여기서 생성한다.
- 장면 탭은 홈페이지 문서 탭과 선택·호버·초점·키보드 이동·전환·움직임 줄이기 계약을 공유한다. 장면 재생은 컴파일된 시간표를 읽고 종류마다 별도 재생기를 만들지 않는다.
- Things의 대응 요소와 홈페이지에 삽입한 결과를 실제 크기로 비교한다. 글자·아이콘·정렬·간격, 탭 전환과 애니메이션의 연속성, 라벨 겹침·잘림을 확인한다. 의도된 제품 차이 외의 불일치는 공통 소유 지점에서 수정한다.
- 하드코딩 검사나 공통 소유 검사를 우회하지 않는다. 실제 화면·동작·문법의 일관성을 검수하지 않고 테스트 통과만으로 품질 완료를 선언하지 않는다.

- 디자인 기준은 Things 공식 사이트 [culturedcode.com/things](https://culturedcode.com/things/), [기능 페이지](https://culturedcode.com/things/features/)다. 색의 기준점은 공식 사이트의 solid 2024 기능 아이콘이다. 역할 위계(카드, 판, 선택, 글자 단계)는 공식 2017년 사이트 영상 스틸과 라이트·다크가 함께 있는 2018년 Things 3.7 화면 쌍을 보조로 읽는다. 역할이 같은 요소끼리 비교하고 직접 대응이 없는 그림 요소는 DiagramPlay의 확장으로 구분한다. 사이트 기능 아이콘의 면색은 사이트의 값이지 네이티브 앱 모든 역할의 같은 색이라는 근거가 아니다. 2017·2018년 이미지는 역할 비교용 보조 참고이고 현재 네이티브 버전이라는 근거가 아니며, 2018년 쌍이 다크의 유일한 보조 참고다. Refero 화면은 정규화한 측정값과 재구성 예제라 보조 참고일 뿐 기준이 아니다.
- 진행 기록, 감사 영수증(검수 날짜, 배포 식별자, 통과 개수), 이전에 남긴 검증 근거는 GitHub 이슈 요약에 둔다. `docs/`는 현재 계약과 실제로 확인한 증거 표만 적고 시간순 일지를 쌓지 않는다. 화면으로 확인한 범위(예제, 폭, 라이트·다크, 직접 본 화면, 공식 Things 역할 비교)는 [표현 범위](docs/design/expression-coverage.md#예제와-검증-범위)의 표가 정하고, 개수와 날짜는 적지 않는다. 가능한 모든 조합, 모든 네이티브 Things 화면, 실제 iPhone이나 기기의 Safari를 확인했다고 쓰지 않는다. 자동 시험은 실제 기기를 대신하지 않는다. 확인하지 않은 항목은 "검증 요구사항, 미완료"로 표시하고 확인한 범위 밖을 주장하지 않으며, 이미 고쳐진 결함을 미완료로 남기지 않는다. 자동으로 반복하는 장면에 일시정지 조작이 없으므로 접근성 기준을 모두 충족한다고 쓰지 않는다.
- 색: 핵심 넷(파랑 `#1e6bd6`, 노랑 `#f2d024`, 빨강 `#fa1955`, 초록 `#269c6e`)의 값과 순서는 바꾸지 않고, 대비를 맞추려고 핵심 RGB를 바꾸지 않는다. 확장 색은 후보를 실제 크기 라이트·다크 화면으로 검수한 뒤 고르고, 고른 순서는 한 번 기록한 뒤 뒤에만 더한다. 빌드마다 순서를 다시 찾지 않고 고른 값 밖으로 색상·밝기를 자동으로 옮기지 않는다. 색 수를 넘는 계열은 무늬·모양·직접 라벨로 구분하며 색만으로 구분하지 않는다. 대비는 그 요소가 실제로 그려지는 면(카드, 판, 라이트·다크 테마의 면)과 역할(글자, 선, 면)마다 그 면 위에서 잰다. 검은색·흰색 바탕 위의 계산은 보조 확인일 뿐 기준이 아니다. 노랑처럼 면 위 대비가 낮은 그래픽은 색을 바꾸지 않고 직접 라벨과 모양으로 보완하며, 그 낮은 그래픽 대비를 접근성 기준 충족이라고 쓰지 않는다. 범주 번호가 정하는 점 모양, 선·면적 끝 이름, 범례, 원·도넛 조각 바깥의 이름과 값 직접 라벨이 그 보완이다. 번호 키(`1`, `2`...)로 이름을 대신하지 않는다.
- 디자인 수용은 자동 검사가 아니라 화면 비교로 한다. 모바일 320·390·430px와 데스크톱 실제 크기에서 공식 기준과 나란히 보고, 라이트·다크, 정지·재생 중 상태를 확인한다. 화면 비교는 실제 Chrome에서 사람이 직접 한다. 테스트 통과만으로 일관성이나 디자인 완료를 선언하지 않고 검수하지 않은 변경은 공개하지 않는다.
- 결함을 덮어쓰기 CSS나 예제별 CSS·좌표 보정으로 숨기지 않는다. 공통 규칙을 고친다.
- 그림은 정의된 부품을 가져다 조립한다(React처럼 합성하되 React 의존성은 없다). 흐름은 원본 문법 → 공통 모형 → 필요한 배치 → 공통 부품 → 조작부 하나다. 카드, 필드, 선, 화살촉, 라벨, 아이콘, 탭, 도구 막대의 모양과 상태는 각자 한 부품이 소유하고, 종류별 렌더러는 데이터와 배치 결과만 넘긴다. 같은 토큰을 읽는다는 이유로 같은 부품이라 하지 않고, 종류마다 새 카드, 새 컨트롤, 개별 보정을 만들지 않는다. 측정과 그리기는 같은 부품의 역할 규약을 쓴다. 실제 호출 지도는 [아키텍처](docs/architecture.md#부품-호출-지도)에 있다: 카드는 `compile/scene.js`가 `measure/sizes.js`로 재고(머리는 `measure/card.js`, 글은 `measure/texts.js`) `draw/figure.js`가 `draw/shape.js` → `draw/card.js` → `draw/surface.js`와 `draw/texts.js`로 그리고, 선은 `draw/connector.js` → `draw/arrow.js`, 아이콘은 `icons/` 등록부 → `draw/decor.js`, 도구 막대와 탭 줄은 `html/player-script.js`의 `figureFrame` 하나, 켜짐과 평소의 모습은 `@woonyong-choi/design-tokens/styles/diagram/figure.css`의 `--fx-*` 하나다.
- 뷰어는 사람이 보기만 하는 순수 시각화기다. 자동 스크롤, 화면 안 가시성 대기, 그림 위에 겹쳐 뜨는 고정 탭, 수동 복사 팝업 같은 뷰어 동작을 더하지 않는다. 사용자 조작은 장면 탭, 문법 복사, HTML 다운로드, 전체화면과 전체화면 안의 확대·축소·끌어 옮기기뿐이고 새 재생 설정을 만들지 않는다.
- npm 배포는 사용자가 명시 요청한 경우에만 실행한다. 검증한 기본 브랜치의 `v*` 태그에서 `release.yml`을 실행하고 레지스트리 설치 결과까지 확인한다.
- `package.json`의 `files`는 `src`, `LICENSE`, `NOTICE`만. 바꾸면 `npm pack --dry-run`으로 올라가는 파일을 직접 확인한다
- 원본의 첫 비주석 의미 줄은 숫자나 옵션 없는 `diagramplay`다. 시작 선언이 없거나 잘못되면 줄 위치와 함께 오류다. 옛 이름(`mutoscope`·`thinkflow` 명령, `.muto`·`.thinkflow`, ` ```muto `·` ```thinkflow `, 옛 소유 표시)을 읽거나 옮기거나 안내하는 어댑터, 별칭, 폐기 안내 경로를 두지 않는다. 읽는 확장자는 `.diagramplay`뿐이고 다른 확장자는 일반 오류다. `md`는 `diagramplay md v2` 표시와 `<!-- diagramplay -->` 이미지 줄만 이 도구의 것으로 보고, 그 밖의 표시가 붙은 파일과 줄은 사용자 것으로 두어 가져가지도 덮어쓰지도 지우지도 않는다. 호환을 위해 기존 출력과 옵션을 그대로 두는 제약은 없다
- 렌더러나 그림 CSS를 바꾼 뒤에는 `npm run figures`가 끝난 다음 `npm test`를 실행한다. 생성 그림을 검사하는 테스트와 그림 재생성을 병렬로 돌리지 않는다.
- 커밋 전 `npm test`와 `npm run check` 통과. `npm run check:advisory`는 항목을 읽어 보되 0건을 요구하지 않는다
- 동작, 계약, 설정 변경은 같은 PR에서 설계 문서 갱신
- 문법 표(`figure-syntax.md`)와 검사 표(`figure-check.md`, `figure-quality.md`)는 생성물이다. `src/source/grammar.js`나 `src/check/items.js`, `src/check/docs-items.js`를 고친 뒤 `npm run grammar`, `npm run checkdoc`으로 다시 만들고 표를 손으로 고치지 않는다.
- 새 문서는 `docs/README.md` 문서 목록 안에서만 추가
- 배치에 넘긴 도형 크기와 연결점은 그리는 도형과 동일
- elkjs 경로의 임의 좌표 보정 금지. 예외는 `docs/design/layout.md` 선 그리기 절의 선 끝 계단 펴기와 연결점을 고정한 검사 기반 경로 단축뿐
- 오류가 있으면 결과 파일을 쓰지 않음
- `src/player/`는 시간표를 읽기만 하고 상태를 다시 계산하지 않음
- 화면 값·공통 스타일·아이콘·탭·도구 막대는 design-tokens의 단일 정본에서 가져온다. 설치된 `@woonyong-choi/design-tokens`를 직접 수정하거나 DiagramPlay 토큰 사본을 따로 만들지 않는다. 제품 차이만 공통 역할 속성으로 재정의한다.
- 디자인 갱신은 고정 commit을 올리고 그림을 다시 만든 PR로 반영한다. 다른 저장소로 파일을 전달하는 자동화는 두지 않는다. 홈페이지는 자기 의존성으로 DiagramPlay와 디자인의 commit을 고른다.
