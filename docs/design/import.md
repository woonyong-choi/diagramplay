# 가져오기

`diagramplay import mermaid input.mmd --out result.diagramplay`는 Mermaid의 흐름도·시퀀스·ERD·클래스를 옮긴다. DBML은 `diagramplay import dbml schema.dbml`로 테이블·컬럼·키·관계를 옮긴다. 형식을 생략하면 `.mmd`, `.mermaid`, `.dbml` 확장자로 고른다. 표준 입력 `-`는 형식을 명시한다.

## 변환 계약

같은 `.diagramplay` 문법으로 쓰고 공통 빌더로 검사한다. Mermaid 흐름도의 시작·종료 원은 일반 카드가 된다. 지원하지 않는 문장은 `import-skip`, 바꾸어 옮긴 표현은 `import-change` 경고로 원본 줄과 함께 알린다. 모르는 다이어그램 종류나 카드가 없는 원본은 `import` 오류다. 빠진 관계를 임의로 추정하지 않는다.

Mermaid 클래스는 필드·메서드·가시성·관계·다중성을, ERD와 DBML은 컬럼·키와 가능한 외래 키를 보존한다. 정확한 키 제약으로 옮길 수 없는 참조는 경고와 설명 관계로 남긴다. 시퀀스는 메시지·응답·메모·활성 구간·제어 구획을 공통 문법으로 옮긴다.

## API

`importDiagram('mermaid' | 'dbml', text)`는 `{ source, warnings }`를 반환한다. 파일을 읽지 않는다. 알 수 없는 형식은 `TypeError`, 옮길 수 없는 원본은 `FigureError`다. CLI의 `--json`은 원본과 진단을 JSON으로 출력한다. 오류일 때 파일을 쓰지 않는다.
