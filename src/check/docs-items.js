// 문서 품질 검사 항목 목록(`--docs`). 번호, 진단 code, 등급, 설명과 기준 수치를 여기 한 곳에 선언하고, 판정 함수는 docs.js와 docs-text.js에 둔다.
// docs/design/figure-quality.md의 "검사 항목" 표가 이 목록과 같아야 하고, 어긋나면 테스트가 실패한다. 표는 `npm run checkdoc`으로 다시 쓴다.
import { values } from '@woonyong-choi/design-tokens/tokens.js';
import { measure } from '../measure/fonts.js';
import { STYLE } from '../measure/texts.js';

/** 기준 수치. 근거는 docs/design/figure-quality.md 메시지와 구현 자리 절이다. */
export const LIMITS = Object.freeze({
  // 꼬리표도 강조도 없으면 같은 모양으로 보는 카드 수
  flat: 4,
  // 강조(appearance=filled, outline) 카드 상한
  focal: 2,
  // 한 그래프 보기의 카드와 선 상한. 본문 단(680)에 최소 폭 카드가 한 줄 4개씩 세 줄 드는 양
  cards: 12,
  edges: 12,
  // 선 글 상한 폭. 선 라벨 글꼴로 잰 한글 10자 폭
  edgeLabel: measure('가'.repeat(10), STYLE.pill.size, STYLE.pill.face),
  // 접힌 사슬의 한 줄 최소 카드 수와 권하는 aspect를 찾아볼 상한
  rowCards: 3,
  aspectMax: 5,
  // 이어지면 계단이 되는 그룹 수
  staircase: 3,
  // 선 없는 카드 상한(이 수 이상이면 경고)
  loose: 2,
  // 문서 본문 단 폭과 가장 작은 그리는 글, 읽히는 가장 작은 글
  column: values.container['body-width'],
  smallestText: values.text['figure-meta'],
  readable: Math.min(...Object.values(values.text.figure)),
});

/**
 * 항목마다 { number, code, severity, title, criterion }. severity는 이 항목이 내는 등급 목록('error', 'warning')이다.
 * 판정 함수는 docs.js의 DOCS_JUDGES가 code로 찾는다.
 */
export const DOCS_CHECKS = [
  { number: 1, code: 'docs-1', severity: ['warning'], title: '종류 꼬리표가 일부 카드에만 있다', criterion: '그래프 보기에서 꼬리표를 받는 카드(`box`, `external`, `store`, 원 모양 제외) 가운데 일부에만 `badge=`가 있다. 꼬리표 없는 카드마다 그 선언 줄에 알린다. `person`은 사람 아이콘이 종류를 대신해 세지 않는다' },
  { number: 2, code: 'docs-2', severity: ['warning'], title: '카드가 모두 같은 모양이다', criterion: '그래프 보기의 `person`, `box`, `external`, `store` 카드가 4개 이상인데 꼬리표도 강조(`appearance=filled`, `outline`)도 하나 없다. 내용 줄(값, 글 줄)이 있는 카드는 세지 않고, 마름모가 있는 순서도와 갈래 없는 사슬은 제외' },
  { number: 3, code: 'docs-3', severity: ['warning'], title: '강조한 카드가 많다', criterion: '`appearance=filled`나 `outline`인 카드가 3개 이상. 그룹은 세지 않는다' },
  { number: 4, code: 'docs-4', severity: ['warning'], title: '이름이나 부제가 접힌다', criterion: '그래프 보기 카드의 이름이나 부제가 카드 최대 폭(`spacing.figure.node.max-width`) 안쪽에 한 줄로 들지 않아 두 줄 이상으로 접힌다. 마름모와 원은 제외' },
  { number: 5, code: 'docs-5', severity: ['warning'], title: '선 글이 길다', criterion: '선 라벨이나 순서 그림 메시지의 잰 폭이 선 라벨 글꼴로 잰 한글 10자 폭을 넘는다' },
  { number: 6, code: 'docs-6', severity: ['warning'], title: '카드나 선이 많다', criterion: '한 그래프 보기에 카드가 12개를 넘거나 선이 12개를 넘는다' },
  { number: 7, code: 'docs-7', severity: ['warning'], title: '접힌 사슬의 한 줄 칸 수가 적다', criterion: '갈래 없는 사슬이 `aspect`나 자동 접기로 가로줄 여러 개에 접혔는데(카드 둘 이상인 줄이 있다) 가장 많이 든 줄도 카드가 2개다. 줄마다 카드 하나인 세로 배치는 접힘이 아니다. 지금 값보다 큰 `aspect`를 5까지 다시 배치해 한 줄 3칸 이상이면서 그림 검사 10번 경고가 없는 첫 값을 권하고, 없으면 사슬을 나누라고 알린다' },
  { number: 8, code: 'docs-8', severity: ['warning'], title: '갈래 있는 그림에 `aspect`가 있다', criterion: '`aspect`를 적었는데 그래프 보기에 갈래 없는 사슬이 아닌 보기가 있다' },
  { number: 9, code: 'docs-9', severity: ['warning'], title: '`width wide`가 있다', criterion: '`width wide`를 적었다. 표시 상한이 넓어져 본문 단에서 그림과 글이 작아진다' },
  { number: 10, code: 'docs-10', severity: ['warning'], title: '그룹이 계단처럼 이어진다', criterion: '서로 다른 맨 바깥 그룹의 카드를 잇는 선이 그룹 3개 이상을 갈래 없이 차례로 잇는다. 안쪽 그룹은 바깥 그룹 방향을 따라 놓여 세지 않는다' },
  { number: 11, code: 'docs-11', severity: ['warning'], title: '선 없는 카드가 있다', criterion: '선이 있는 그래프 보기에 선이 하나도 닿지 않는 카드가 2개 이상이다' },
  { number: 12, code: 'docs-12', severity: ['warning'], title: '순서 그림 장면의 메시지가 많다', criterion: '순서 보기의 한 장면 메시지가 `2 × 참여자 수 − 2`를 넘는다. 구획(`fragment`, `branch`) 안 메시지도 센다' },
  { number: 13, code: 'docs-13', severity: ['warning'], title: '순서 그림에 장면이 여럿이다', criterion: '순서 보기 메시지가 장면 2개 이상에 나뉘어 있다. 정지 SVG는 첫 장면만 보인다' },
  { number: 15, code: 'docs-15', severity: ['error'], title: '요구 항목이 그림에 있다', criterion: '`require` 줄마다 대안 하나 이상이 그림의 보이는 글에 들어 있다. 띄어쓰기는 하나로 접어 비교한다' },
  { number: 16, code: 'docs-16', severity: ['warning'], title: '문서 본문 단에서 읽힌다', criterion: '그림 폭이 본문 단 폭(`container.body-width`, 680)보다 넓을 때, 본문 단으로 줄인 가장 작은 그리는 글(`text.figure-meta`, 11px)이 가장 작은 글 토큰(`text.figure`의 최솟값, 9px) 미만' },
];
