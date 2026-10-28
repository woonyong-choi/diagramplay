# 아키텍처

카드 흐름·아키텍처·시퀀스·ERD·클래스가 문법, 공통 카드와 관계선, 시간표, SVG·HTML 재생기를 공유한다. 분석 차트와 시계열 측정 모듈은 없다.

## 구성 요소

| 경로 | 소유하는 일 |
|---|---|
| `source/` | 문법 정본, 카드·테이블·클래스·장면 읽기와 의미 검사 |
| `measure/` | 글꼴 측정, 카드·본문·컬럼·멤버·큐·라벨 크기 |
| `layout/` | ELK 그래프와 시퀀스, 컬럼 연결점, 관계 끝 표시 |
| `timeline/`, `flow/` | 장면·메시지·트래픽·조건·예약·값 이벤트 |
| `draw/`, `animate/` | 공통 도형·아이콘·관계선과 시간표의 SVG 효과 |
| `html/`, `player/`, `svg/` | 같은 시간표의 독립 HTML과 SVG 출력 |
| `import/` | Mermaid 흐름·시퀀스·ERD·클래스, DBML |
| `check/`, `markdown/` | 기하·문서 검사와 Markdown 소유 출력 관리 |

### 부품 호출 지도

카드는 `compile/scene.js` → `measure/sizes.js` → `draw/shape.js` → `draw/card.js` → `draw/surface.js`와 `draw/texts.js`다. 테이블은 `measure/table.js`, 클래스는 `measure/class.js`로 컬럼·멤버를 재고 같은 카드 부품으로 그린다. 컬럼 강조와 관계 끝의 다중성·삭제 정책은 SVG와 HTML이 공유한다.

선은 `draw/connector.js` → `draw/arrow.js`, 아이콘은 `icons/` → `draw/decor.js`, 조작부는 `html/player-script.js`의 `figureFrame`이다. 디자인 역할의 모양과 상태는 공통 디자인 패키지에서 가져온다.

## 처리 흐름

원본 읽기·의미 검사 → 사용자 SVG 검사 → 글꼴 측정 → 보기별 배치 → 사건·값 시간표 → 기하 검사 → SVG·HTML 순서다. `buildFigure` 결과는 내부 모형이며 공개 소비자는 `warnings`와 `toSvg`·`toHtml`만 사용한다. 플레이어는 컴파일한 시간표를 읽고 사건·조건·값을 다시 계산하지 않는다.

## 공통 디자인 가져오기

`@woonyong-choi/design-tokens`의 commit 고정 tarball을 의존성으로 받고 배포물에 묶는다. 토큰·CSS·공통 부품·아이콘의 정본은 그 저장소다. 설치된 패키지를 직접 고치거나 소비자 안에 사본을 두지 않는다. NHN 경계의 의미와 원본 아이콘 색도 같은 카탈로그를 읽는다.

## 소비자 API와 좁은 화면

`buildFigure`, `toSvg`, `toHtml`, `importDiagram`, `FigureError`, `IMPORT_FORMATS`를 공개한다. 타입은 `src/index.d.ts`다. 기본 자연 배치 하나를 HTML 컨테이너 가로에 맞추며 세로 높이는 늘 수 있다. 전체화면에서 확대·이동한다. 화면 폭에 따라 배치와 시계를 교체하지 않는다.

## 배포

| 경로 | 내용 | 쓰는 구성 요소 |
|---|---|---|
| npm 패키지 `diagramplay` | `src`, `LICENSE`, `NOTICE`와 묶은 디자인 패키지(`node_modules/@woonyong-choi/design-tokens`)와 그 실행 의존성 | `cli`, `player`, `svg` |

- 묶음은 `npm pack`과 `npm publish`가 만든다. 디자인의 `diagram` tarball은 CSS 축소 도우미와 `esbuild`를 담지 않고 실행 의존성이 `postcss` 하나라, 저장소 `node_modules`를 그대로 묶는다. 묶는 단계에서 따로 빼는 파일은 없다.
- `acceptDependencies`는 묶은 디자인의 `version`(`0.2.0`)을 받아들인다. npm은 묶은 사본의 출처 URL을 기록하지 않아서, URL 지정만 있으면 설치한 쪽의 `npm ls`가 묶은 디자인을 invalid로 판정한다. 디자인 `version`이 바뀌면 이 값도 함께 갱신한다(`test/tooling.test.js` G3).
- 설치하는 쪽은 `npm i diagramplay` 한 번으로 디자인까지 받고 GitHub 주소에 접속하지 않는다. 묶은 패키지는 레지스트리나 tarball URL에서 다시 받지 않는다.
- 묶은 사본은 DiagramPlay 판마다 하나로 정해진다. npm `overrides`는 묶은 패키지를 바꾸지 않는다(npm 10.9.9, 2026-10-27 확인. 상위 패키지 이름 지정, 중첩 지정, `nested` 설치 방식 모두 묶은 사본이 남았다). 다른 디자인 commit으로 그림을 만들려면 그 commit을 `dependencies`에 적은 DiagramPlay Git commit을 설치한다: `npm i "github:woonyong-choi/diagramplay#{commit}"`. 디자인 갱신은 이 저장소에서 고정 commit을 올린 PR과 새 판 배포로 반영한다.
- 호스트 페이지가 자기 디자인 패키지를 따로 설치해도 그림의 CSS는 DiagramPlay에 묶인 사본에서 온다. 같은 디자인으로 보이려면 호스트가 설치한 디자인 commit과 DiagramPlay가 묶은 commit을 맞춘다. 묶은 commit은 설치된 `node_modules/diagramplay/package.json`의 `dependencies`에서 읽는다.
