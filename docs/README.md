# 문서

DiagramPlay는 아키텍처, 카드 흐름, 시퀀스, ERD, 클래스 다이어그램을 텍스트로 만들고 흐름을 재생한다.

## 시작

- [사용법](usage.md): 설치, 원본, 문서 삽입, CLI와 API
- [아키텍처](architecture.md): 공통 모형과 부품의 소유권
- [용어](glossary.md)

## 설계

- [그림 문법](design/figure-syntax.md): 문장과 선택 사항의 생성 표
- [카드와 보기](design/figure-kinds.md): 카드, 데이터 관계와 시퀀스
- [배치](design/layout.md): 크기, 경로, 자연 배치와 화면 맞춤
- [재생](design/playback.md): 장면, 조건, 값 변화와 시간표
- [그림 검사](design/figure-check.md): 겹침, 넘침, 연결점
- [문서 품질 검사](design/figure-quality.md)
- [마크다운 반영과 배포](design/markdown.md)
- [가져오기](design/import.md): Mermaid와 DBML
- [문서 스킬 연동](design/docs-integration.md)
- [표현 범위와 검증 범위](design/expression-coverage.md)

## 그림 종류

- [카드 흐름](reference/flow.md): 요청, 응답, 분기와 큐
- [아키텍처](reference/architecture.md): 중첩 경계와 리소스
- [시퀀스](reference/sequence.md): 참여자의 메시지 순서
- [ERD와 데이터](reference/data.md): 테이블, 컬럼, 키와 관계
- 클래스와 인터페이스: [카드와 보기](design/figure-kinds.md#클래스), [예제](../examples/class.diagramplay)

## 기록

- [결정 기록](decisions/README.md): 당시의 선택과 배경. 현재 지원 범위는 위 문서를 따른다.
