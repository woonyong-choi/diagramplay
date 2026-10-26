# 문서

DiagramPlay의 사용법과 설계 문서다. 문서는 한국어로 쓴다. 처음이면 [DiagramPlay 사용법](usage.md)부터 읽는다.

## 시작

- [DiagramPlay 사용법](usage.md): 설치, 첫 그림, 문서 삽입, 명령과 API
- [아키텍처](architecture.md): 구성 요소, 처리 흐름, 지켜야 할 규칙
- [용어](glossary.md): 이 프로젝트만의 말

## 설계

- [그림 문법](design/figure-syntax.md): 원본 문장, 선택 사항, 진단
  - [카드와 보기](design/figure-kinds.md): 순서·타이밍 보기와 상태·테이블·클래스 카드
  - [칸 격자](design/grid.md): 비트 필드, 배열, 스택, 행렬
  - [차트](design/charts.md): 차트 종류, 축, 값 묶음
  - [배치](design/layout.md): 도형 좌표, 선 경로, 좁은 화면 배치
  - [재생](design/playback.md): 시간표, 장면 재생, 재생기 조작
  - [그림 검사](design/figure-check.md): 겹침, 넘침, 선 끝 검사 항목
  - [문서 품질 검사](design/figure-quality.md): 문서 독자 기준의 추가 검사
  - [마크다운 반영과 배포](design/markdown.md): `md` 명령, GitHub Action, npm 패키지
  - [가져오기](design/import.md): Mermaid, DBML, D2, draw.io, Excalidraw 원본 옮기기
  - [문서 스킬 연동](design/docs-integration.md): 문서 스킬의 그림 계약과 색표
  - [표현 범위와 검증 범위](design/expression-coverage.md): 지원 표현, 시험, 화면 검수 범위

## 그림 종류

- [구조 그림](reference/flow.md): 카드와 선, 그래프 보기
  - [구성도](reference/architecture.md): 그룹, 아이콘, 번호 선, 배지
  - [순서 그림](reference/sequence.md): 참여자 사이 메시지 순서
  - [상태 그림](reference/state.md): 상태 카드와 전이
  - [데이터 관계 그림](reference/data.md): 테이블 열과 외래 키
  - [칸 격자](reference/grid.md): 칸 단위 자료 그림
  - [타이밍 그림](reference/timing.md): 시간축 위 값의 상태
  - [차트](reference/charts.md): 차트 카드와 `plot` 보기

## 기록

- [결정 기록](decisions/README.md): 설계를 정한 이유와 버린 선택지
