# 표현 범위와 검증 범위

## 지원하는 표현

| 표현 | 의미 | 대표 원본 |
|---|---|---|
| 카드 흐름 | 요청·응답·분기·반복 트래픽 | [flow](../../examples/flow.diagramplay) |
| 아키텍처 | 중첩 경계·서비스·리소스·연결 | [architecture](../../examples/architecture.diagramplay) |
| 시퀀스 | 메시지 순서·alt/opt/loop/par·생명주기 | [sequence](../../examples/sequence.diagramplay) |
| ERD | 테이블·컬럼·PK/FK·복합 키·다중성 | [schema](../../examples/schema.diagramplay) |
| 클래스 | 클래스·인터페이스·멤버·의미 관계 | [class](../../examples/class.diagramplay) |

API 필드, 카드 설명, 값·큐·상태 알약은 위 다이어그램의 구성 요소다. 큐와 값은 사건에 따라 변하며 별도 분석 그래프를 만들지 않는다.

## 전용 표현이 없는 범위

통계 차트, 시계열 플롯, 측정 추적·타이밍 축, 비트·메모리 격자, 전용 상태도와 시작·종료 점은 제공하지 않는다. 제거된 문장은 오류로 거절한다. 별칭이나 숨겨 둔 렌더러로 유지하지 않는다.

## 예제와 검증 범위

공개 API·문법·보안·배치·메시지 순서·값 이벤트·출력과 패키지는 `test/`가 검사한다. 생성 예제는 `test/examples.test.js`, 키와 관계는 `test/table-keys.test.js`, 클래스·시퀀스는 `test/kinds.test.js`, NHN 부품은 `test/components.test.js`가 검사한다. 브라우저 회귀 검사는 `test/browser/`다.

실제 Chrome의 화면 검수와 자동 검사는 다르다. 실제 모바일 기기·Safari와 모든 대형 구성 조합은 검증 요구사항이며 미완료다. 재생 접근성 전체의 충족을 주장하지 않는다. 검수한 예제·폭·테마와 실행 결과는 연결된 GitHub 이슈에 기록한다.

## 시험 번호 표

시험 이름의 번호는 기존 회귀 조건의 식별자다. 번호를 채우기 위해 제거한 기능의 시험을 남기거나 새 기능을 만들지 않는다. 현행 계약은 각 시험과 위 지원 범위다.
