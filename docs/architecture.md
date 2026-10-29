# 아키텍처

이 도구는 `.diagramplay` 원본 하나를 움직이는 문서 그림 하나로 바꾸는 명령이다. 구성 요소는 셋이고, `cli`가 원본을 읽어 배치하고 검사한 장면과 시간표를 `player`(HTML)와 `svg`(움직이는 SVG)에 담는다.

그림 캔버스는 공통 디자인의 옅은 배경으로 본문과 구분한다. 기본 도형·그룹 윤곽은 같은 `color.figure.outline` 역할을 사용하며, 선택·재생 강조와 지정 색은 유지한다. SVG와 HTML은 이 공통 스타일을 함께 가져온다.

## 외부 연결

| 외부 요소 | 종류 | 주고받는 것 |
|---|---|---|
| `.diagramplay` 원본 | 파일 | 첫 문장 `diagramplay`, 카드, 칸, 선, 값, 보기, 장면 |
| elkjs | 외부 프로그램 | 도형 크기와 연결점 제약, 도형 좌표와 직교 경로 |
| 글꼴 파일 | 파일 | Pretendard, JetBrains Mono의 글자 너비 표와 글자 모양 |
| 공통 디자인 완성본 | 파일 | 토큰·CSS·아이콘·탭·프레임과 파일 해시 |
| repo-docs-figures 스킬 | 외부 프로그램 | `render_figures`가 부르는 `render` 명령과 그 종료 코드 |
| 브라우저 | 외부 프로그램 | 만든 HTML과 SVG |

예제 목록과 명령줄 갤러리는 `src/html/listing.js`의 문서 틀을 함께 사용한다. 예제의 원본·장면 목록은 같은 갤러리의 변형이며, 스타일은 디자인 정본 `styles/diagram/gallery.css`에서 관리한다.

## 구성 요소

| 구성 요소 | 하는 일 | 기술 | 위치 |
|---|---|---|---|
| `cli` | 원본을 읽고, 글을 재고, 배치하고, 그림을 검사하고, 시간표를 만들어 결과 파일을 쓰는 명령 | Node.js, elkjs | `src/`에서 `player/`, `svg/`, `animate/`를 뺀 폴더와 진입 파일(`index.js`, `cli.js`). 마크다운 문서 반영은 `markdown/find.js`, `markdown/run.js` |
| `player` | HTML 안에서 시간표대로 상태를 바꾸고 점을 옮기는 재생기, 전체화면과 전체화면 안의 확대·축소·끌어 옮기기 | 브라우저 JavaScript | `src/player/` |
| `svg` | 시간표를 CSS keyframes와 SMIL로 바꾼 움직이는 SVG | SVG, CSS | `src/svg/`, `src/animate/` |

### 부품 호출 지도

`draw/styles.js`는 공통 효과 정의를 읽을 때 의미 관계선의 기본 `--fx-line-rest` 선언만 `outline` 역할로 매핑한다. 선택자, 선언 순서, 우선순위와 활성·표식 예외는 바꾸지 않는다. SVG와 HTML은 이 결과를 함께 읽으며 사용자 재정의도 같은 cascade를 따른다. 설치된 정본의 기본 선언 계약이 달라지면 명시적으로 실패한다.

공통 부품이 어느 파일에 있고 누가 부르는지다. 종류별 코드는 데이터와 배치 결과만 넘기고, 같은 모양을 자기 파일에서 다시 만들지 않는다. 화살표는 부르는 쪽에서 부품으로 간다.

| 부품 | 측정(잰 값을 배치에 넘긴다) | 그리기(잰 값을 그대로 그린다) | 시험 |
|---|---|---|---|
| 카드 면과 구분선 | `measure/sizes.js`의 `sizeNode`(상자, 사람, 외부, 원통, 갈림길, 원), `table.js`(표, API), `class.js`(클래스, 인터페이스), `sizeParticipant`(순서 보기 참여자), 큐. `compile/scene.js`가 도형마다 한 번 부른다 | `draw/figure.js`의 `drawScene` → `draw/shape.js` → `draw/card.js`의 `drawCard` → `draw/surface.js`의 `drawSurface`. 원통, 갈림길, 원만 `shape.js`가 모양 자체를 그린다. 기본 면색과 외부 도형·그룹·관계선의 점선은 정본 `figure.css`가 맡고 렌더러는 형상과 역할 클래스만 전달한다 | `test/components.test.js`(U1) |
| 카드 머리 | `measure/card.js`의 `headerOf`와 `placeHeader`(표, API, 클래스, 순서 보기 참여자가 같은 머리), 상자와 사람은 같은 `headerDecor`. 폭과 안쪽 여백(`PAD`)을 한 곳에서 정한다. 제목은 아이콘과 배지를 뺀 폭(`room`)에서 줄을 나눈다 | `draw/card.js`의 `drawHead` → `draw/decor.js`의 `drawDecor`(아이콘, 배지, 개수)와 `draw/texts.js` | `test/components.test.js`(U2, U3), `test/text.test.js`(T6~T8) |
| 글 한 줄(text) | `measure/texts.js`의 `STYLE`(글 역할의 크기, 굵기, 줄 높이. 카드 라벨은 regular, 그룹 제목은 15 semibold이고 글자 사이 간격은 CSS와 같은 `tracking.text` 하나다), `textAt`(제목, 열 이름, 형식, 제약, 클래스 멤버가 모두 같은 모양), `stackTexts`, `titleTexts`, `textBlock`(메모와 구획 제목), `textWidth`, `textSpan`, `allTexts`. 글을 읽는 방식은 `format/text.js`의 `isLiteralFace`가 글꼴로 정한다 | `draw/texts.js`의 `drawTexts`. 이동 글 상자가 피할 사각형(`layout/boxes.js`)과 그림 검사 1번(`check/fit.js`)도 같은 `textSpan`을 읽는다 | `test/components.test.js`(U1, U4, U5, U6), `test/text.test.js`(T1~T3, T5, T13) |
| 카드 본문(`text`, `value`, `graph`)과 장면 내용(`show`) | `measure/content.js`의 `sizeContent`가 줄마다 태그, 표시, 본문, 관계 그래프 이름, 값을 text로 재고 `fitValueSlot`, `valueText`가 값 글을 재어 돌려준다 | `draw/content.js`의 `drawContent`와 `draw/values.js`는 잰 text를 `drawTexts`로 그리고 태그 알약, 그래프 도형만 따로 그린다 | `test/cards.test.js`(S8), `test/text.test.js`(T4) |
| 연결선과 선 라벨 | 라벨 알약 크기 `measure/pills.js`의 `sizePill`. 선 끝 표시(다중성 글, 삭제 정책 알약)의 글과 크기는 `layout/end-marks.js`. 선 경로는 `layout/`이 정하고 건드리지 않는다 | `draw/connector.js`의 `drawEdge`(다른 선이 위로 지나는 자리의 끊김은 `draw/crossings.js`의 clipPath), `drawEdgeLabel`(선 라벨 알약과 선 끝 알약) | `test/components.test.js`(U6, U7) |
| 화살촉 | `measure/arrow.js`의 마커 좌표계 | 모양은 `arrowMarker` 하나다. 연결선은 `draw/connector.js`가 `edgeMarker`(보통 화살표와 클래스 관계의 머리)로 선 묶음 안에 정의를 두고 묶음의 `color`를 상속한다. | `test/components.test.js`(U7), `test/component-state.test.js` |
| 켜짐과 평소의 모습 | 없음 | `@woonyong-choi/design-tokens/styles/diagram/figure.css`의 효과 한 벌(`--fx-*`)이 유일한 정의다. 정지 그림의 평소 규칙, HTML 재생기의 `.on` 규칙(`figure.css`, `@woonyong-choi/design-tokens/styles/diagram/player.css`), 움직이는 SVG의 keyframes(`animate/animator.js`, 속성 이름만 쓴다)가 같은 속성을 읽는다. 고른 색(`tone`, `appearance`)은 `draw/paint.js`가 평소 값(`--fx-face`, `--fx-edge-rest`)만 바꾼다. | `test/component-state.test.js`, `test/components.test.js`(U10). 둘은 선언을 읽는 시험이고 계산된 색은 Chrome에서 본 범위만 있다([표현 범위](design/expression-coverage.md#예제와-검증-범위)) |
| 알약 | `measure/pills.js` 하나가 선 라벨 알약과 번호 원(`sizePill`), 배지와 개수(`sizeBadge`), 단계별 상태 알약(`sizeStatus`, `STATUS_KINDS`), 관계 그래프 이름 알약(`miniPillWidth`)의 크기를 잰다. 상태 알약의 자리(도형 모서리)는 `layout/status.js`의 `statusBox`, `statusBoxes`다 | 면은 `draw/pill.js`의 `pillFace` 하나가 변형(`edge`, `number`, `badge`, `status`, `mini`)으로 그린다. 안의 글은 `draw/connector.js`(선 라벨, 번호)와 `draw/decor.js`(배지, 상태 알약의 기호와 글자 `drawStatusPill`)가 놓는다. 상태 알약 층은 `draw/status.js`가 같은 `drawStatusPill`을 부른다 | `test/components.test.js`(U6), `test/exports.test.js` |
| 아이콘 | `measure/decor.js`의 `layoutDecor`가 아이콘 칸 자리를 정한다 | 공통 SVG 원본과 `icons/index.js`의 `loadIcon`이 `iconData`를, 상태 알약의 흑백 기호는 같은 등록부의 `markIcon`이 만들고 `draw/decor.js`가 상자 머리, 그룹 탭, 타일에서 같은 도형을 그린다 | `test/components.test.js`(U8), `test/escaping.test.js`(I2, 사용자 SVG의 안전) |
| 장면 탭과 도구 막대 | 없음 | 공통 `DiagramFrame`(design-tokens `ui/diagram.mjs`)이 도구 막대와, 안에서 부르는 공통 `TabList`로 탭 줄 마크업을 만든다. DiagramPlay는 이것을 `html/player-script.js`의 `figureFrame`으로만 쓰고 `TabList`를 직접 부르지 않는다. 브라우저에서는 공통 `bindToolbar`와 `bindTabs`가 조작과 선택·키보드를 연결하고 `player/play.js`는 장면 재생만 연결한다 | `test/components.test.js`(U9), `test/exports.test.js`(X10, X11) |

값의 `display`와 `max`는 `source/value.js`가 `indicator: { kind, max }`로 합친다. `source/value-check.js`는 참조 선언을 먼저 확인하고 표시가 요구하는 숫자 형식을 참조 사슬 끝의 원천에 모은다. 공통 갱신 경로(`timeline/values.js`)가 이 형식을 확인하므로 `set`, `on`, 단계 초기화와 원자적 예약이 같은 제약을 따른다. 예약은 복사본의 모든 식이 통과한 뒤 상태에 반영한다.

표시 글은 `source/indicators.js`의 `indicatorText`가 만들고 원시 값 집합과 시간표에는 붙이지 않는다. `measure/content.js`가 현재값과 최댓값을 실제 글꼴로 재고 행에 표시 기하를 담는다. 칸은 큐의 `measure/queue.js` 배치를 공유하고 막대는 같은 칸 높이를 쓴다. `draw/values.js`는 그 행을 찾아 글과 채움을 같은 `data-v`와 원시 `data-t` 묶음에 넣는다. 빈 칸과 채움은 기존 `drawSlot`, `fl-queue-slot`, `queue-fill` 역할을 쓴다. SVG의 기간별 창과 HTML 재생기가 이 묶음 전체를 바꾼다. `timeline.values`나 재생기에 표시 메타데이터나 별도 시계를 넣지 않는다.

카드 본문과 `show`는 `source/content.js`의 글·관계 그래프 해석을 공유한다. `timeline/value-texts.js`의 `initialCardRows`가 선언 본문과 값 줄의 순서를 합치고, 각 장면은 이 본문에서 시작한다.

호출의 방향은 `compile/scene.js` → `measure/` → `layout/` → `draw/` → `svg/output.js`, `html/content.js` → `html/output.js`다. `measure/`는 `layout/`, `draw/`, `check/`를 부르지 않고, `layout/`은 `draw/`와 그림 검사(`check/figure.js`, `check/`)를 부르지 않으며, 검사는 `draw/`를 부르지 않는다. `draw/`가 `measure/`와 `layout/`의 값(`STYLE`, `CONTENT`, 알약 크기, 상태 알약 자리)을 읽어 잰 값과 그린 값이 같은 출처를 갖는다. 이동 글 상자가 피할 사각형은 `layout/boxes.js`, 내용 면 자리(`contentBox`)는 `measure/content.js`다. 그래프 배치의 좁은 그룹 후보 판정은 `check/figure.js`의 `isSoundGraph`를 `compile/scene.js`가 `layoutOrFail`에 넘긴다. `src/` 안에 import 순환은 없다.

## 처리 흐름

### 그림 만들기

1. `cli`가 원본을 읽어 문서 모형 하나(`figure`)로 만든다. 첫 문장이 `diagramplay`인지 보고(`source/preamble.js`), 줄을 머리, 선언, 시간 흐름으로 나눠 읽는다. 카드, 칸, 선, 값, 보기, 장면이 모든 카드에 같은 규칙으로 놓이고 그림 종류는 없다. 모형은 받은 원본 글을 그대로(`figure.source`, 줄바꿈과 첫 글자 포함) 간직해, 재생기의 문법 복사가 같은 글을 쓴다. 보기는 이름이 없고, 어느 보기에도 적히지 않은 카드는 기본 보기를 받으며, 보기에는 정해진 순서대로 내부 열쇠 `v1`, `v2`처럼 순서가 붙은 이름이 붙는다(`views-check.js`). 도형과 그룹, `show` 줄의 색은 `tone`과 `appearance`로 모형에 들어간다. 파일을 다 읽은 뒤 이름 공간, 연결점(`카드.칸`), 보기 구성원, 선의 그릴 수 있음, 이동의 보기별 투영을 확인한다(`source/validate.js`, `views-check.js`, `project.js`. [그림 문법](design/figure-syntax.md)).
2. 값 표시 영역의 폭은 모든 장면에서 표시할 문자열의 실제 폭으로 정한다. 이 문자열은 시간표에 따라 달라지고 시간표는 배치에 따라 달라지므로, 값 표시 영역의 폭과 배치·시간표 사이에 순환 의존이 있다. `compile/scene.js`는 값 표시 영역의 폭을 줄이지 않고 배치와 시간표 계산을 최대 네 번 반복하며, 그 안에 폭이 확정되지 않으면 `layout-unstable` 오류를 낸다(`measure/value-slots.js`).
3. 한 번의 되풀이 안에서: 글꼴 파일로 모든 글의 폭을 재 카드 크기와 연결점을 정하고, 보기마다 배치한다. 그래프는 그룹마다 그다음 바깥을 elkjs로 배치하고 경로 조각을 잇는다([배치](design/layout.md)). 순서는 격자 배치다. `layout/panels.js`가 판을 위에서 아래로 쌓아 장면 하나로 합친다.
4. `compile/views.js`가 보기마다 모형을 줄이고(`viewFigure`), 합친 장면에서 시간표를 만든다. 점 이동 시간은 선 길이에 비례해 배치 뒤에 만들고, 이동 하나는 보기마다 hop 하나로 펼치되 시간은 첫 투영이 한 번만 정한다. 모든 선과 가장 큰 카드가 보이는 상태에서 화면 오류를 검사한다([그림 검사](design/figure-check.md)).
5. 오류가 없으면 `cli`가 같은 장면과 시간표로 HTML이나 장면 하나의 움직이는 SVG를 쓴다. SVG는 장면의 `mode`(`static`은 마지막 상태, `once`는 한 번 재생하고 머묾, `loop`는 되풀이)와 `speed`로 재생한다.

### 시간표 모양

`buildFigure`의 결과는 `{ figure, scene, timeline, warnings, valueTexts }`다. `figure.kind`는 없다. 재생기와 SVG가 읽는 계약이다.

- `timeline.steps`: 장면마다 정확히 `{ label: string, mode: 'static' | 'once' | 'loop', speed: number }`다. 문자열 형태는 없다.
- `timeline.segs[]`: `{ si, bi, t0, t1, hops, nodesOn, partsOn, cards, cardsBefore, cardsAt, status?, ... }`. `t0`, `t1`은 논리 시각이다(효과 시간과 박자 뒤 머묾이 없다). 설명 글(`caption`)과 지나간 선을 남기는 목록은 없다. `hops`는 이동마다 보기별 투영 하나씩이고 `edge`는 합친 장면의 선·메시지 번호이며 같은 이동의 투영은 `at`, `ms`, `cut`이 같다.
- `timeline.values[]`: 장면마다 값 줄 `{ si, id, node, t0, t1, initial, changes, periods }`. 바뀌는 순간의 밝힘은 `timeline.pulses`의 값 펄스가 맡는다. 같은 시각의 변화는 마지막 글 하나만 남는다. `node`가 없는 값은 카드에 보이지 않는다. 시각 `t`의 글은 `periods.find(([from, to]) => from <= t && t < to) ?? periods.at(-1)`이다. 장면이 없는 문서는 선언한 값마다 `si`가 없고 길이가 0이며 변화와 펄스가 없는 줄을 하나 갖는다(처음 값을 보이기 위한 줄이고 탭이나 시간을 만들지 않는다).
- `timeline.total`: 장면의 논리 길이의 합이다. 장면이 없거나 모두 길이 0이면 0이고 1ms로 올려 쓰지 않는다. 재생기는 이 값을 쓰지 않는다.
- `timeline.marks`: `{ [키]: [[from, to, si], ...] }`. 조용한 선이 보이는 구간이다(`quiet:번호`). 같은 장면 안에서만 합치고 길이 0 구간도 남기며, 세 번째 값이 구간을 소유한 장면이다. 점이 지나는 동안의 선은 이동 목록(`hops`)에서 구하고, 켜 둔 도형과 부분은 구간(`nodesOn`, `partsOn`)이 가진다.
- `timeline.pulses`: `[{ key, at, si }]` 시각 순. 키는 `value:값 줄 번호`나 `row:도형:줄 번호`이고 `si`는 출처 장면이다. 펄스 모양은 `src/timeline/pulse.js`다(`PULSE`, `PULSE_MS`, `envelopeKeys`).
- `timeline.presentation[si]`: 장면마다 표시 길이(화면 ms). 논리 길이를 `speed`로 나눈 값과 마지막 펄스·선 이탈에 `PULSE_MS`를 더한 값 가운데 큰 것이고, 컴파일러가 한 번 정해(`timeline/marks.js`의 `presentationOf`) 재생기와 SVG가 읽는다([재생](design/playback.md#장면과-재생-방식)).
- `scene`: `{ items, groups, edges, lifelines, notes, activations, destructions, fragments, panels, width, height, tagOrder }`. 도형, 그룹, 선에는 `view`(보기의 내부 열쇠 `v1`, `v2`처럼 순서가 붙은 이름)가 있고 선에는 `strategy`가 있다. 같은 카드가 여러 보기에 그려지면 `items`에 같은 `id`가 여러 번 있다. `panels[]`는 `{ index, view, strategy, box: { x, y, w, h }, label?, labelAt? }`이고 `box.w`는 판의 자연 폭이다.
- 재생기가 해야 할 일: 같은 `id`의 요소는 `querySelectorAll`로 모두 찾고, 시각의 상태는 `periods`의 같은 규칙으로 정하고, 펄스는 `timeline.pulses`로 건다. 애니메이션 끝 이벤트는 논리 상태를 정하지 않는다.

장면 생성은 `compile/scene.js`가 맡고 최초 빌드와 재배치가 같은 카드 크기·배치·충돌 검사를 사용한다.

### 공통 디자인 가져오기

1. 디자인은 `@woonyong-choi/design-tokens` 패키지다. 공통 정본이 생성한 `diagram` 배포 tarball을 `dependencies`에 Git commit URL로 고정하고 `bundleDependencies`로 DiagramPlay 배포물 안에 그대로 묶는다. 그림은 이 묶은 사본의 토큰·CSS·아이콘으로 그려진다. 디자인 패키지가 npm 레지스트리에 없어서, 레지스트리에서 디자인을 찾는 설치 실패를 막기 위해서다.
2. 설치용 commit은 공통 저장소의 기본 브랜치 이력에서 도달 가능한 것을 사용한다. 작업 브랜치를 정리한 뒤에도 같은 원본을 받을 수 있도록 URL과 잠금 파일을 함께 갱신한다. 코드는 패키지 이름으로 가져오고(`@woonyong-choi/design-tokens/ui/index.mjs`) 파일은 `createRequire(import.meta.url).resolve`로 찾는다. 저장소에 디자인 사본을 두지 않는다. `measure/decor.js`는 모듈을 읽을 때 `spacing.figure.icon.brand`가 유한한 양수인지 검사한다. 필드가 없는 구버전은 최소 버전과 필드 이름을 안내하는 오류로 중단하며 숫자로 대체하지 않는다.
3. 디자인을 올릴 때는 정본의 새 `diagram` tarball URL로 `dependencies`와 잠금 파일을 갱신한 뒤 `npm run figures`, `npm test`, `npm run check`를 실행해 PR로 반영한다. DiagramPlay에서 토큰을 합치거나 다시 생성하지 않는다. 전체 카탈로그를 쓰는 호스트는 공통 전체 패키지를 직접 선택할 수 있다.
4. 디자인 패키지는 npm 레지스트리에 배포하지 않고 commit 고정 tarball로만 받는다. composite Action은 실행 의존성만(`--omit=dev`) 잠금 파일대로 설치하고, 디자인도 그 설치에 든다. 의존성 버전 고정 정책은 [AGENTS.md 명령](../AGENTS.md#명령) 절에 있다.
5. 다른 저장소로 파일을 밀어 넣는 자동 전달은 없다. 소비자 저장소는 DiagramPlay 판을 고르고, 그 판에 묶인 디자인이 그림의 디자인이다. 다른 디자인 commit을 쓰는 방법은 [배포](#배포) 절에 있다.

### 재생하기

1. 브라우저가 HTML을 열면 `player`가 장면을 탭으로만 고른다. `static` 장면은 마지막 상태를 그리고, `once`는 한 번 재생한 뒤 마지막 상태에 머물고, `loop`는 같은 장면을 되풀이한다. 다음 장면으로 저절로 넘어가지 않는다.
2. `player`가 박자마다 시간표의 상태를 그대로 그리고 점을 경로 위로 옮긴다([재생](design/playback.md)).
3. 브라우저가 SVG를 열면 `svg` 안의 keyframes와 SMIL이 장면 하나의 시간표를 `mode`와 `speed`대로 재생한다.

## 지켜야 할 규칙

- 배치에 넘긴 도형 크기와 연결점은 그리는 도형과 같다. 선 끝이 도형에서 떨어지는 일을 막기 위해서다.
- elkjs가 돌려준 좌표와 경로 점은 옮기지 않는다. 경로 후처리끼리 충돌하는 일을 막기 위해서다. 예외는 [배치](design/layout.md) 선 그리기 절의 선 끝 계단 펴기 하나다.
- 글 폭은 그림에 넣는 글꼴과 같은 글꼴 파일로 잰다. 잰 폭과 그려진 폭이 어긋나는 일을 막기 위해서다.
- 오류가 하나라도 있으면 결과 파일을 쓰지 않는다. 깨진 그림이 문서에 올라가는 일을 막기 위해서다.
- 같은 원본과 같은 버전은 바이트까지 같은 결과를 낸다. 다시 변환해도 git 차이가 없게 하기 위해서다.
- `player`와 `svg`는 시간표를 읽기만 하고 상태를 다시 계산하지 않는다. HTML과 SVG가 다르게 움직이는 일을 막기 위해서다. 보기가 여럿이어도 이동과 값 변화는 시간표에서 한 번만 계산된다.
- 논리 시각(`t0`, `t1`, `at`, `ms`, 값 구간, 프레임 구간)은 재생 속도, 펄스, 화면 길이가 바꾸지 않는다. 펄스의 꼬리는 화면 길이만 늘린다.
- 값 글자와 카드 크기는 실제 글꼴로 잰 글 폭이다. 렌더러가 같은 글꼴로 같은 줄 나눔을 쓴다.
- 점 이동 곡선과 글 상자 밀어 넣기는 HTML과 SVG가 같은 토큰과 같은 규칙을 쓴다. 규칙은 `src/math/easing.js`, `src/chip/place.js`에 있다. 브라우저 코드(`player/`)는 모듈을 불러올 수 없어 순수 계산을 함수 원문으로 받는다: 이동 곡선은 `math/motion.js`의 `motionMath`, 점이 선에 있는 구간(`hopLegs`)과 글 상자 숨김 불투명도(`fadeAt`)는 `math/hop.js`의 `hopMath`이고, `html/player-script.js`가 두 함수 원문을 재생기 스크립트 앞에 넣으며 빌드(`animate/legs.js`, `chip/clash.js`)는 같은 함수를 가져온다. 글 상자 자리는 예외로, 빌드 때 시간표에 담은 계획을 재생기가 보간만 한다.
- 크기·간격·색·시간은 공통 정본의 토큰만 쓴다. 가져온 사본은 직접 수정하지 않는다.
- 그림은 정의된 부품을 가져다 조립한다(React처럼 합성하되 React에 기대지 않는다). 흐름은 원본 문법 → 공통 모형 → 필요한 배치 → 공통 부품 → 조작부 하나다. 카드(머리와 필드 줄), 연결선과 라벨, 화살촉, 아이콘, 장면 탭, 도구 막대는 모양과 상태를 부품 하나가 소유하고, 종류별 렌더러는 데이터와 필요한 배치 결과만 넘긴다. 같은 토큰을 읽는 것만으로 같은 부품이라 하지 않고, 측정과 그리기는 같은 부품의 역할 규약을 쓴다. 같은 모양이 종류마다 복제되는 일과 같은 시험이 종류마다 되풀이되는 일을 막기 위해서다. 부품이 코드의 어느 파일에 있는지는 [부품 호출 지도](#부품-호출-지도)에 있다.
- 변환 중 네트워크에 접근하지 않는다. 글꼴과 배치 엔진을 모두 함께 배포한다.

## 배포

| 경로 | 내용 | 쓰는 구성 요소 |
|---|---|---|
| npm 패키지 `diagramplay` | `src`, `LICENSE`, `NOTICE`와 묶은 디자인 패키지(`node_modules/@woonyong-choi/design-tokens`)와 그 실행 의존성 | `cli`, `player`, `svg` |

- 묶음은 `npm pack`과 `npm publish`가 만든다. 디자인의 `diagram` tarball은 CSS 축소 도우미와 `esbuild`를 담지 않고 실행 의존성이 `postcss` 하나라, 저장소 `node_modules`를 그대로 묶는다. 묶는 단계에서 따로 빼는 파일은 없다.
- `acceptDependencies`는 묶은 디자인의 `version`(`0.2.0`)을 받아들인다. npm은 묶은 사본의 출처 URL을 기록하지 않아서, URL 지정만 있으면 설치한 쪽의 `npm ls`가 묶은 디자인을 invalid로 판정한다. 디자인 `version`이 바뀌면 이 값도 함께 갱신한다(`test/tooling.test.js` G3).
- 설치하는 쪽은 `npm i diagramplay` 한 번으로 디자인까지 받고 GitHub 주소에 접속하지 않는다. 묶은 패키지는 레지스트리나 tarball URL에서 다시 받지 않는다.
- 묶은 사본은 DiagramPlay 판마다 하나로 정해진다. npm `overrides`는 묶은 패키지를 바꾸지 않는다(npm 10.9.9, 2026-10-27 확인. 상위 패키지 이름 지정, 중첩 지정, `nested` 설치 방식 모두 묶은 사본이 남았다). 다른 디자인 commit으로 그림을 만들려면 그 commit을 `dependencies`에 적은 DiagramPlay Git commit을 설치한다: `npm i "github:woonyong-choi/diagramplay#{commit}"`. 디자인 갱신은 이 저장소에서 고정 commit을 올린 PR과 새 판 배포로 반영한다.
- 호스트 페이지가 자기 디자인 패키지를 따로 설치해도 그림의 CSS는 DiagramPlay에 묶인 사본에서 온다. 같은 디자인으로 보이려면 호스트가 설치한 디자인 commit과 DiagramPlay가 묶은 commit을 맞춘다. 묶은 commit은 설치된 `node_modules/diagramplay/package.json`의 `dependencies`에서 읽는다.

## 기술 선택

| 영역 | 선택 | 고른 이유 |
|---|---|---|
| 층 배치와 직교 경로 | elkjs(ELK layered) | 도형 크기, 연결점, 선 라벨 크기를 받아 겹치지 않게 배치한다. [결정 기록](decisions/2026-10-01-own-syntax-and-layout.md) |
| 글꼴 | Pretendard, JetBrains Mono | 본문은 한글, 라틴, 기호, 숫자 모두 Pretendard 하나다. 참고 문서 페이지와 같은 글꼴이라 그림이 따로 놀지 않는다. 고정폭 JetBrains Mono는 코드(백틱 구간, 테이블 열 타입)에만 쓰고 그 안 한글은 Pretendard로 이어 그린다. 굵기마다 정적 파일이 있는 `pretendard` 패키지로 받는다. 가변 글꼴이나 조각 나뉜 패키지보다 fontkit 측정과 subset-font 자르기가 한 파일에서 끝나서 고른다. 모두 SIL Open Font License라 그림에 넣을 수 있다. 글자 간격은 -0.3px다. |
| 결과 형식 | SVG, HTML | SVG는 README와 설계 문서에 이미지로 들어가고, HTML은 미리보기와 목록 쪽에서 열린다. 둘 다 추가 프로그램이 필요 없다. |
| 공통 디자인 | `@woonyong-choi/design-tokens`(commit 고정, 배포물에 묶음) | 웹과 도표가 같은 토큰·아이콘·탭을 조립한다. 정본에서만 수정하고 배포물에는 고정 commit을 그대로 묶는다. |
| 실행 환경 | Node.js 20 이상 | elkjs와 글꼴 처리를 브라우저 없이 돌린다. |

## 소비자 API와 좁은 화면

공개 API는 `src/index.js`가 내보내는 `buildFigure`, `toSvg`, `toHtml`, `importDiagram`, `IMPORT_FORMATS`, `FigureError`이고 타입은 `src/index.d.ts`다. `buildFigure`가 돌려주는 `BuiltFigure`는 불투명한 값이라 `warnings`만 읽고 나머지는 같은 패키지의 `toSvg`, `toHtml`에 그대로 넘긴다. 내부 모양(`figure`, `scene`, `timeline`)은 공개 계약이 아니다. 소비자 호스트는 빌드 때 `buildFigure(source, { allowFileAccess: false })`로 문서에 포함된 도표를 만들고 `toHtml`의 결과를 저장한다. 이 옵션은 사용자 아이콘 폴더를 읽기 전에 거절한다. 브라우저는 완성된 HTML의 시간표만 재생한다. 그림은 DiagramPlay에 묶인 `@woonyong-choi/design-tokens`를 읽는다([배포](#배포)).

`buildFigure`는 원본의 의미와 배치에서 시간표를 만들며, 내부 함수 `reflowFigure`(`compile/figure.js`. `html/responsive.js`가 부르고 `index.js`는 내보내지 않음)는 기존 시간표의 사건을 보존하고 그래프 보기의 새 배치에 경로만 대응한다. `flow/track-geometry.js`는 경로 기하만 계산하고 `timeline/reflow.js`는 중간 도착 시각을 유지하는 거리 비율을 만든다. 브라우저가 새 사건이나 값을 계산하지 않는 규칙은 같다. 자세한 계약은 [좁은 화면 배치](design/layout.md#좁은-화면을-위한-배치-목표-폭)에 있다.

HTML은 `html/responsive.js`가 좁은 배치 후보를 미리 만들고 `player/responsive.js`가 같은 시계에서 그림만 전환한다. 비활성 template을 사용해 표시 SVG와 ID를 중복하지 않는다. 사건을 다시 실행하거나 탭·조작부를 다시 만들지 않는다. 후보는 이동 글 경고(그림 검사 7번)가 원본 배치보다 늘지 않을 때만 싣고, 후보가 안 되면 원본 배치의 자연 크기를 유지하고 넘치는 부분은 그림 영역에서 가로로 스크롤한다. 세부 계약과 남은 가로 넘침은 [배치 설계](design/layout.md)에 적는다.

공통 tokens.js는 px·ms 값을 계산용 숫자로 내보내고 em 같은 상대 단위는 단위를 보존한다. 측정기는 글자 크기와 함께 해석한다.
