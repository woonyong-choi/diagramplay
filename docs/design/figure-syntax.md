# 그림 문법

정본은 `src/source/grammar.js`다. 아래 표는 `npm run grammar`로 생성한다. 지원 표현은 아키텍처·카드 흐름·시퀀스·ERD·클래스다.

## 줄과 파일 구조

첫 비주석 줄은 `diagramplay`다. 머리(`title`, `subtitle`, `pace`, `width`, `aspect`, `require`), 카드·그룹·값·선·보기 선언, 장면 순서로 쓴다. 블록의 `{`는 여는 줄 끝에, `}`는 별도 줄에 둔다. 글은 큰따옴표로 감싸고 `\\`, `\"`만 이스케이프한다. `#` 뒤는 주석이다. 이름은 소문자로 시작하며 소문자·숫자·단일 하이픈을 쓴다. 테이블 컬럼은 밑줄도 받는다.

## 카드 선언

`person`, `box`, `external`, `store`, `decision`, `queue`는 흐름의 도형이다. 카드 흐름은 시작·종료 점을 따로 만들지 않는다. `box`·사람·외부·저장소·테이블·API 본문은 `text "설명"`, `value n "값" from=0`을 순서대로 담는다. 본문의 값에는 `on=`을 쓰지 않는다. 블록 밖의 값은 `value n "값" on=card from=0`이다. 이름은 문서 전체에서 유일하다.

### 번호, 배지, 아이콘, 복제 개수

선의 `no=1`은 표시 순서이고 재생 순서와 독립이다. `badge="글"`은 짧은 꼬리표, `count=3`은 상자의 복제 수다. 아이콘은 필요할 때만 명시한다. 일반 역할에 자동 아이콘을 넣지 않는다. NHN 박스형은 경계 그룹에, 서비스·리소스는 독립 카드에 놓는다. 공식 원본 색을 유지한다. `shape=tile`은 면·윤곽·이름 좌우 여백을 유지하고 `shape=symbol`은 작성자가 명시한 테두리 없는 표현이다. 사용자 SVG는 `icons custom "icons"`로 등록하고 `icon=custom:name`으로 쓴다. [아이콘 규칙](layout.md#아이콘)을 따른다.

### 도형 색

`tone`은 정의된 색 이름이고 `appearance`는 `plain`, `filled`, `outline`이다. 화면 값은 공통 디자인 토큰이 정한다. 원본에서 CSS나 hex 색을 지정하지 않는다. 상태 알약은 장면의 `status="worker=fail"`처럼 지정한다. 값 변화와 상태 알약은 전용 상태도를 만들지 않는다.

### 값

값은 숫자·낱말·다른 값의 참조다. `display=bar max=100`, `display=slots max=6`은 카드 안 현재 상태 표시다. `set="n+1"`, `on db n-1`은 도착 시 반영하고 `:=`는 식 시작 시점 값을 복사한다. `keep="n"`은 이전 장면의 최종 값을 이어 받는다. 장면 `set=`이 유지 값보다 우선한다. 참조 값은 쓰기 대상이 아니다.

### 큐

`queue q "작업 큐" slots=6`은 찬 칸 수를 자기 이름 `q`로 읽고 쓴다. 0 이하나 용량 초과는 경고다. 정수인 큐·슬롯을 분수로 바꿀 수 없다.

## ERD와 클래스

`table`은 컬럼 형식·PK·unique·nullable·FK·복합 키·삭제 정책을 가진다. 외래 키는 실제 열 연결점으로 이어진다. 관계의 `from="0..*"`, `to="1"`은 표시이며 키 제약을 추정하지 않는다. `api`는 요청·응답 필드를 나타내는 같은 카드 부품이다.

`class`, `interface`는 필드·메서드와 가시성·정적·추상 여부를 가진다. `relation`은 연관·의존·상속·구현·집합·합성을 정하고 공통 선이 알맞은 화살촉과 점선을 그린다. 클래스 멤버는 연결점이 아니다. [상세와 예제](figure-kinds.md)를 참고한다.

## 보기

`view graph [right|down]`은 카드와 관계를 배치한다. `view sequence { ... }`는 참여자 순서를 정한다. 보기가 없으면 전체 그래프 하나다. 보기에 담기지 않은 카드는 기본 그래프로 남는다. 같은 카드가 두 보기에 있으면 의미와 사건은 공유한다. 그래프에서만 본문·컬럼·값을 그린다. [순서 보기](figure-kinds.md#순서-보기)를 따른다.

## 시간 흐름

장면은 `scene "이름"`이다. 비어 있으면 `static`, 줄이 있으면 `once`가 기본이다. `mode=loop`는 반복한다. 박자(`hop`, `show`, `clear`, `light`, `wait`)와 `track`은 같은 장면에 섞지 않는다. 흐름은 선언한 선을 따라가고 시퀀스 메시지는 장면에서 선언한다. `show`는 글을 추가하고 `clear`는 값 줄을 보존한다. 다음 장면은 선언 본문에서 시작한다.

### 조건과 대기

`when`이 거짓이면 출발하지 않는다. `wait`는 조건이 참이 될 때 출발하고 `timeout`·`else`로 만료 경로를 정한다. `reserve`는 출발과 함께 자원을 원자적으로 차지한다. `lost`는 도착 전 소멸 비율, `legs`는 구간별 이동 시간이다. [이벤트 순서와 예약](playback.md)을 따른다.

### 오류와 경고

진단은 위치·심각도·code·메시지를 가진다. 오류가 있으면 출력하지 않고 `--strict`는 경고도 실패로 처리한다. 제거한 문장은 일반 문법 오류이며 호환 어댑터나 숨은 차트 렌더러를 두지 않는다.

### 문법 표

<!-- grammar-table:start -->
| 부분 | 자리 | 낱말 |
|---|---|---|
| 선언 | 테이블 블록 안 | `pk (열, ...)`, `unique (열, ...)`, `fk (열, ...) -> 테이블 (열, ...)` |
| 시작 선언 | 문서 줄 | `diagramplay` |
| 머리 | 문서 줄 | `title`, `subtitle`, `pace`, `aspect`, `width`, `require "글" [or "글" ...]` |
| 선언 | 문서 줄 | `person`, `box`, `external`, `store`, `decision`, `queue`, `group`, `icons`, `value`, `on node id+N`, `table`, `api id "METHOD /url" {`, `class`, `interface`, `view graph|sequence ["label"] [{]`, `a -> b` |
| 선언 | 카드 본문 안 | `text` |
| 선언 | 클래스 블록 안 | `field`, `method` |
| 시간 흐름 | 문서 줄 | `scene "label" [mode=static|once|loop] [speed=1]`, `a -> b`, `track a, b -> c -> d`, `대상:=원천`, `show`, `clear`, `light`, `note`, `activate`, `deactivate`, `fragment`, `branch`, `wait` |

| 선택 사항 | 값 |
|---|---|
| `icons.paint` | `mono`, `source` |
| `fragment.choose` | 글 |
| `fragment.times` | 양의 정수 |
| `fragment.run` | `on`, `off` |
| `group.boundary` | `cloud`, `organization`, `project`, `on-premise`, `region`, `availability-zone`, `auto-scaling-group`, `vpc`, `subnet`, `security-group`, `server-contents`, `instance-contents`, `service` |
| `group.direction` | `right`, `down` |
| `group.dashed` | 값 없음(낱말만) |
| `group.badge` | 글, 최대 8자 |
| `group.icon` | 이름 또는 세트:이름 |
| `group.tone` | `blue`, `yellow`, `red`, `green`, `orange`, `purple`, `cyan`, `gray` |
| `group.appearance` | `plain`, `filled`, `outline` |
| `node.badge` | 글, 최대 8자 |
| `node.icon` | 이름 또는 세트:이름 |
| `node.tone` | `blue`, `yellow`, `red`, `green`, `orange`, `purple`, `cyan`, `gray` |
| `node.appearance` | `plain`, `filled`, `outline` |
| `box.count` | 2 이상 정수 |
| `queue.slots` | 1 이상 32 이하 정수 |
| `queue.from` | 0 이상 slots 이하 정수 |
| `edge.no` | 양의 정수 |
| `scene.mode` | `static`, `once`, `loop` |
| `scene.speed` | 0보다 큰 숫자 |
| `scene.for` | 시간 |
| `scene.status` | `ok`, `warn`, `fail`, `wait` |
| `scene.keep` | 값 이름 목록 |
| `scene.set` | 글 |
| `hop.time` | 시간 |
| `hop.tone` | `blue`, `yellow`, `red`, `green`, `orange`, `purple`, `cyan`, `gray` |
| `hop.set` | 글 |
| `hop.lost` | 0 이상 100 이하 퍼센트 |
| `hop.when` | 조건 글 |
| `hop.wait` | 조건 글 |
| `hop.timeout` | 시간 |
| `hop.else` | 도형 이름 |
| `hop.stuck` | 값 없음(낱말만) |
| `hop.reserve` | 값 식 목록 |
| `track.at` | 시간(0 가능) |
| `track.every` | 시간 |
| `track.time` | 시간 |
| `track.tone` | `blue`, `yellow`, `red`, `green`, `orange`, `purple`, `cyan`, `gray` |
| `track.set` | 글 |
| `track.lost` | 0 이상 100 이하 퍼센트 |
| `track.when` | 조건 글 |
| `track.wait` | 조건 글 |
| `track.timeout` | 시간 |
| `track.else` | 도형 이름 |
| `track.stuck` | 값 없음(낱말만) |
| `track.reserve` | 값 식 목록 |
| `track.legs` | 시간 또는 -의 목록 |
| `value.on` | 도형 이름 |
| `value.from` | 숫자 또는 낱말 |
| `value.display` | bar 또는 slots |
| `value.max` | 양수, slots는 1~32 정수 |
| `value.ref` | 값 이름 |
| `hop.dashed` | 값 없음(낱말만) |
| `hop.create` | 값 없음(낱말만) |
| `hop.destroy` | 값 없음(낱말만) |
| `edge.quiet` | 값 없음(낱말만) |
| `edge.dashed` | 값 없음(낱말만) |
| `edge.head` | `end`, `both`, `none` |
| `box.shape` | `rect`, `tile`, `symbol` |
| `show.tag` | 글 |
| `show.tone` | `blue`, `yellow`, `red`, `green`, `orange`, `purple`, `cyan`, `gray` |
| `show.appearance` | `plain`, `filled`, `outline` |
| `show.meta` | 글 |
| `show.mark` | 글, 최대 8자 |
| `show.mono` | 값 없음(낱말만) |
| `column.pk` | 값 없음(낱말만) |
| `column.unique` | 값 없음(낱말만) |
| `column.nullable` | 값 없음(낱말만) |
| `column.required` | 값 없음(낱말만) |
| `foreignKey.ondelete` | `restrict`, `cascade`, `set-null`, `no-action` |
| `column.fk` | 테이블.열 |
| `classifier.abstract` | 값 없음(낱말만) |
| `member.visibility` | `public`, `private`, `protected`, `package` |
| `member.static` | 값 없음(낱말만) |
| `member.abstract` | 값 없음(낱말만) |
| `relation.relation` | `association`, `dependency`, `inheritance`, `realization`, `aggregation`, `composition` |
| `multiplicity.from` | 출발 쪽 다중성 |
| `multiplicity.to` | 도착 쪽 다중성 |

| 값 목록 | 쓰는 곳 | 값 | 기본값 |
|---|---|---|---|
| `boundary` | `group.boundary` | `cloud`, `organization`, `project`, `on-premise`, `region`, `availability-zone`, `auto-scaling-group`, `vpc`, `subnet`, `security-group`, `server-contents`, `instance-contents`, `service` | 없음 |
| `iconPaint` | `icons.paint` | `mono`, `source` | `mono` |
| `fragmentType` | `fragment 값` | `alt`, `loop`, `par`, `opt` | 없음 |
| `fragmentRun` | `fragment.run` | `on`, `off` | 없음 |
| `direction` | `group.direction` | `right`, `down` | `right` |
| `viewStrategy` |  | `graph`, `sequence` | 없음 |
| `sceneMode` | `scene.mode` | `static`, `once`, `loop` | 줄이 있는 장면은 `once`, 줄이 없는 장면은 `static` |
| `tone` | `group.tone`, `node.tone`, `hop.tone`, `track.tone`, `show.tone` | `blue`, `yellow`, `red`, `green`, `orange`, `purple`, `cyan`, `gray` | 없음 |
| `appearance` | `group.appearance`, `node.appearance`, `show.appearance` | `plain`, `filled`, `outline` | `plain` |
| `head` | `edge.head` | `end`, `both`, `none` | `end` |
| `shape` | `box.shape` | `rect`, `tile`, `symbol` | `rect` |
| `width` | `width 값` | `standard`, `wide` | `standard` |
| `status` | `scene.status` | `ok`, `warn`, `fail`, `wait` | 없음 |
| `deleteAction` | `foreignKey.ondelete` | `restrict`, `cascade`, `set-null`, `no-action` | 없음 |
| `relation` | `relation.relation` | `association`, `dependency`, `inheritance`, `realization`, `aggregation`, `composition` | `association` |
| `visibility` | `member.visibility` | `public`, `private`, `protected`, `package` | 없음 |
<!-- grammar-table:end -->
