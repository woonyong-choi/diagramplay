<h1 align="center">DiagramPlay</h1>

<p align="center">
  텍스트로 구조와 흐름, 값의 변화를 그리는 문서 그림 도구<br>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT 라이선스"></a>
  <a href="https://github.com/woonyong-choi/diagramplay/actions/workflows/ci.yml"><img src="https://github.com/woonyong-choi/diagramplay/actions/workflows/ci.yml/badge.svg" alt="CI"></a><br>
  한국어 | <a href="README.en.md">English</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/showcase/async-orders-ko-dark.svg">
    <img src="docs/assets/showcase/async-orders-ko-light.svg" alt="합성 데이터: 네 곳의 주문이 이벤트 큐로 들어가 재고, 결제, 알림 소비자로 퍼지고, 큐가 차오르며 메일 하나가 유실되는 그림">
  </picture>
</p>

DiagramPlay는 텍스트에 적은 구성 요소와 연결을 배치하고, 이동과 값 변화를 장면으로 만들어 SVG와 HTML로 씁니다. 이 저장소의 데모는 합성 데이터를 사용합니다.

## 빠른 시작

Node.js 20 이상이 필요합니다. 빈 폴더에서 패키지를 설치하고 첫 그림을 만드세요.

```sh
npm i diagramplay
cat > request.diagramplay <<'EOF'
diagramplay
box client "Client"
box server "Server"
client -> server "GET /orders"
scene "Request"
  client -> server
EOF
npx diagramplay render request.diagramplay --html
```

`request.diagramplay`에 적은 요청 흐름을 읽어 현재 폴더에 두 파일을 만듭니다.

```text
request.svg
request.html
```

`request.html`을 브라우저에서 열면 점이 Client에서 Server로 이동합니다. SVG는 문서에 이미지로 넣을 수 있습니다.

직접 원본을 쓰려면 [첫 그림 만들기](docs/usage.md#첫-그림-만들기)를, Markdown에 넣으려면 [문서 삽입 안내](docs/usage.md#markdown과-홈페이지에-넣기)를 읽으세요. 명령 옵션과 진단은 [CLI 출력과 검사](docs/usage.md#cli-출력과-검사)에 있습니다.

## 해결하는 문제

문서에서 요청의 이동과 값 변화를 설명하려면 구조와 실행 순서를 함께 보여 줘야 합니다. DiagramPlay는 상자 같은 구성 요소와 연결을 텍스트로 적고, 시간에 따른 동작을 장면으로 더해 같은 그림에서 보여 줍니다. 아키텍처, 카드 흐름, 시퀀스, ERD와 클래스를 한 원본에서 함께 설명할 수 있습니다.

정지 그림의 배치와 도형을 직접 편집하는 일이 목적이면 그래픽 편집기가 더 맞습니다. DiagramPlay는 텍스트로 관리하는 문서에서 흐름과 값의 변화를 재생할 때 쓰는 도구입니다.

## 작동 방식

1. `.diagramplay` 파일에 구성 요소와 연결을 적고, 장면에 이동과 값 변화를 적습니다.
2. DiagramPlay가 원본을 검사하고 글자 크기를 재어 요소를 배치한 뒤, 장면의 시간표를 만듭니다.
3. SVG는 한 장면을 재생하고, HTML은 탭으로 장면을 고를 수 있게 합니다.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/how-it-works-dark.svg">
  <img src="docs/assets/how-it-works-light.svg" alt="설명용 모형: 텍스트 원본이 배치와 시간표를 거쳐 SVG·HTML로 생성되는 흐름">
</picture>

그림 생성 흐름을 설명하는 예제입니다. [원본](docs/assets/how-it-works.diagramplay)과 [처리 흐름](docs/architecture.md#처리-흐름)을 함께 볼 수 있습니다. 그림 종류를 고르는 방법은 [목적에 맞는 보기 선택하기](docs/usage.md#목적에-맞는-보기-선택하기)에 있습니다.

## 상태

SVG와 HTML 생성, Markdown 그림 갱신, GitHub Action 검사, JavaScript API와 외부 그림 가져오기를 지원합니다. 종류별 기능과 예제는 [지원하는 표현](docs/design/expression-coverage.md#지원하는-표현)에 있습니다.

남은 작업은 [배포 전 시각 결함 수정 #364](https://github.com/woonyong-choi/diagramplay/issues/364), [재생기 그림 내려받기 #150](https://github.com/woonyong-choi/diagramplay/issues/150), [전수 검수와 소스 정리 #251](https://github.com/woonyong-choi/diagramplay/issues/251)에서 추적합니다. 현재 데모는 합성 데이터로 기능을 설명하며 실제 서비스의 성능 측정값이 아닙니다. [검증 범위](docs/design/expression-coverage.md#예제와-검증-범위)와 [지원하지 않는 표현](docs/design/expression-coverage.md#전용-표현이-없는-범위)을 확인하세요.

1.0 전에는 원본 형식과 명령이 예고 없이 바뀔 수 있습니다.

## 문서

- [DiagramPlay 사용법](docs/usage.md): 설치, 첫 그림, 문서 삽입, 명령과 API
- [아키텍처](docs/architecture.md): 구성 요소, 처리 흐름, 지켜야 할 규칙
- [용어](docs/glossary.md): 이 프로젝트만의 말
- [전체 문서](docs/README.md)

## 개발

저장소를 복제하고 의존성을 설치한 뒤 실행하세요.

```sh
git clone https://github.com/woonyong-choi/diagramplay.git
cd diagramplay
npm ci
npm test
npm run check
npm run check:docs
npm run check:sources
npm run check:figures
npm run test:browser
```

`npm run test:browser`는 시스템에 설치된 Chrome을 엽니다. 자동 검사는 실제 브라우저의 화면 검수를 대신하지 않습니다. 기여 절차는 [CONTRIBUTING](.github/CONTRIBUTING.md)에, 디자인 의존성 갱신은 [공통 디자인 가져오기](docs/architecture.md#공통-디자인-가져오기)에 있습니다.

## 라이선스

[MIT](LICENSE)
