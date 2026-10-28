# DiagramPlay 사용법

아키텍처, 카드 흐름, 시퀀스, ERD, 클래스를 같은 카드·선·장면으로 그린다. 요청·응답·이벤트·큐·값 변화는 실행 표현이다. 통계 차트와 측정 시계열은 지원하지 않는다.

## 설치와 버전 확인

```sh
npm install diagramplay
npx diagramplay --version
```

## 첫 그림 만들기

`request.diagramplay`에 다음 원본을 적는다. 첫 줄은 옵션 없는 `diagramplay`다.

```diagramplay name=request
diagramplay
title "요청 처리"
box client "클라이언트"
box api "주문 API" {
  text "요청을 검증합니다"
  value pending "접수" from=0
}
store db "주문 DB"
client -> api
api -> db
scene "주문"
  client -> api set="pending+1"
  api -> db
```

![요청 처리](usage-request.svg)<!-- diagramplay -->

```sh
npx diagramplay render request.diagramplay
npx diagramplay check request.diagramplay --strict
```

SVG와 독립 HTML을 만든다. 장면이 없으면 정지 그림이고, 줄이 있는 장면은 기본 한 번 재생한다. `mode=loop`로 반복하고 `mode=static`으로 마지막 상태만 그린다.

## 목적에 맞는 보기 선택하기

| 목적 | 선언과 보기 | 예제 |
|---|---|---|
| 카드 흐름·순서도 | 카드와 선, 기본 `view graph` | [flow](../examples/flow.diagramplay) |
| 아키텍처 | 같은 그래프에 중첩 `group`과 리소스 | [architecture](../examples/architecture.diagramplay) |
| 시퀀스 | 참여자를 선언하고 `view sequence` | [sequence](../examples/sequence.diagramplay) |
| ERD | `table`, 컬럼과 PK/FK, 다중성 | [schema](../examples/schema.diagramplay) |
| 클래스 | `class`, `interface`, 필드·메서드·관계 | [class](../examples/class.diagramplay) |

카드 흐름은 별도 시작·종료 점 없이 첫 카드부터 읽는다. API 요청·응답의 필드도 [api 예제](../examples/api.diagramplay)처럼 남는다. 데이터 관계와 클래스는 그래프 배치와 공통 선을 공유한다. 보기 전략은 `graph`, `sequence` 두 가지다.

## 구조에 장면 추가하기

카드 본문은 `text`와 `value`를 선언한 순서로 놓는다. `show id "설명"`은 내용을 추가하고 `clear id`는 값 줄을 보존하며 설명을 비운다. 다음 장면은 선언 본문에서 다시 시작한다.

- `a -> b`: 한 번 이동. 그래프에는 먼저 선을 선언한다.
- `a -> b & c -> d`: 동시에 출발하는 한 박자.
- `track a, b -> api -> db every=2s time=1500ms`: 여러 출발지의 반복 트래픽. 같은 장면에 박자 줄과 섞지 않는다.
- `light id` 또는 `light table.column`: 도형·그룹·컬럼 강조.
- `wait 1s`: 박자 사이 멈춤.
- `set="n+1"`, `on api n+1`: 도착 시 값 변경.

`when`, `wait`, `reserve`, `timeout`, `else`, `lost`, `legs`, `keep`은 [재생 계약](design/playback.md)을 따른다. 큐와 값의 진행 막대·슬롯 표시는 다이어그램의 현재 상태를 나타낸다. 분석 차트를 생성하는 기능은 아니다.

## NHN Cloud 아키텍처

NHN 공식 박스형 아이콘은 그룹 경계에, 서비스·리소스 아이콘은 독립 카드에만 쓴다. 모든 카드에 아이콘을 붙이지 않는다. 원본 색을 유지하고 일반 역할 아이콘을 자동 삽입하지 않는다. `shape=tile`은 카드 면과 좌우 여백을 유지한다. 테두리 없는 `shape=symbol`은 명시한 경우에만 쓴다.

Region·Availability Zone·Auto Scaling Group은 점선, Cloud·VPC·Subnet·Security Group과 서비스 경계는 실선이다. 알려진 그룹 아이콘은 의미를 자동 적용한다. 아이콘 없는 영역은 `boundary=availability-zone`처럼 뜻을 명시한다. 일반 그룹의 `dashed`는 작성자가 고른다. 전체 이름은 [문법 표](design/figure-syntax.md#문법-표)에 있다.

## 읽는 화면의 동작

일반 HTML은 그림을 컨테이너 가로 폭에 맞춰 축소하며 세로는 길어질 수 있다. 화면 폭 때문에 그래프를 접지 않는다. 전체화면에서는 확대·축소·이동할 수 있다. 조작부는 장면 탭, 문법 복사, HTML 다운로드와 전체화면이다.

## Markdown과 홈페이지에 넣기

Markdown의 `diagramplay` 울타리 블록을 작성한 뒤 실행한다.

```sh
npx diagramplay md README.md
npx diagramplay md README.md --check --strict
```

원본과 도구가 소유한 이미지 줄·SVG를 함께 관리한다. 전체화면과 장면 조작이 필요하면 HTML 결과를 홈페이지에 넣는다. [반영 계약](design/markdown.md)을 따른다.

## CLI 출력과 검사

```sh
npx diagramplay render request.diagramplay --out output
npx diagramplay check request.diagramplay --json
npx diagramplay gallery examples/*.diagramplay --out preview
npx diagramplay import mermaid flow.mmd --out flow.diagramplay
npx diagramplay import dbml schema.dbml --out schema.diagramplay
```

오류가 있으면 결과를 쓰지 않는다. `--strict`는 경고도 실패로 처리한다. `--docs`는 문서 품질 검사를 추가한다. `--budget events=600000`처럼 이름 있는 한도를 올릴 수 있다. 예산 이름은 `events`, `chain`, `chip-index`다. [그림 검사](design/figure-check.md), [문서 품질](design/figure-quality.md), [가져오기](design/import.md)를 참고한다.

## JavaScript에서 조립하기

```js
import { buildFigure, toSvg, toHtml } from 'diagramplay';
const result = await buildFigure(source, { strict: true, baseDir: process.cwd() });
const svg = await toSvg(result, { scene: 0 });
const html = await toHtml(result, '요청 처리');
```

`buildFigure`의 옵션은 `strict`, 사용자 아이콘의 기준 `baseDir`, `allowFileAccess`, `budget`, 명시적 배치 제약 `layoutWidth`다. 기본은 자연 배치이며 `layoutWidth`는 HTML 화면 맞춤 옵션이 아니다. 반환값은 불투명한 빌드 결과다. `toSvg`에는 `scene`, `isStatic`, `name`을, `toHtml`에는 이름과 `{ source }`를 전달한다. 공개 타입의 정본은 [index.d.ts](../src/index.d.ts)다.

예제 목록과 단독 HTML 재생 화면의 테마 선택으로 시스템·라이트·다크를 비교할 수 있다. 테마만 바뀌며 고른 장면과 재생은 유지된다. 삽입 화면은 목록 쪽 선택을 따른다.

개발 작업본에서 `npm run compare`는 복잡한 다섯 표현의 비교 페이지를 만든다. 개요는 전체 구조를 비교하며, 세부 글자와 연결은 상세 화면의 재생·전체화면 확대에서 확인한다.
