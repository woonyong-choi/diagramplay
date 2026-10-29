// 그림 검사. 배치가 끝난 장면에서 화면 오류를 찾아 원본 줄 번호와 함께 알린다(docs/design/figure-check.md).
// 항목 목록은 check/items.js, 판정 함수는 check/ 아래 항목별 파일이다.
import { CHECKS } from './items.js';
import { warnStalls } from '../flow/event-budget.js';
import { createFamily, drawnBox, pillBox, titleBox } from './geometry.js';
import { statusBoxes } from '../layout/status.js';
import { hasPill } from '../measure/pills.js';
import { composePanels } from '../layout/panels.js';
import { createProblems } from '../source/problems.js';

// cost: time O(e·p + s + g), heap O(e + s + g), stack O(1)
// vars: e = 선 수, p = 경로 점 수, s = 도형 수, g = 그룹 수
// basis: estimate
/** 판정이 함께 보는 장면 조각. 사각형은 한 번만 계산해 항목들이 나눠 쓴다. */
function createContext(figure, scene, timeline) {
  const edges = scene.edges.filter((e) => e.points.length > 1);
  return {
    hiddenChipWarnings: 0,
    figure,
    scene,
    timeline,
    edges,
    boxes: scene.items.map((it) => ({ ...drawnBox(it), id: it.id, line: it.line, it })),
    pills: edges.flatMap((e) => [
      ...(hasPill(e) && e.labelAt ? [{ ...pillBox(e), edge: e }] : []),
      ...(e.endpointLabels ?? []).map((label) => ({ x: label.x - label.w / 2, y: label.y - label.h / 2, w: label.w, h: label.h, edge: { ...e, label: label.text } })),
    ]),
    statuses: statusBoxes(scene, timeline),
    titles: scene.groups.filter((g) => g.label).map((g) => ({ ...titleBox(g), group: g })),
    family: createFamily(scene),
  };
}

// cost: time O(e²·p² + e·s·p + s² + s·k·r·n + h·p), heap O(e + s), stack O(1)
// vars: e = 선 수, p = 경로 점 수, s = 도형 수, k = 도형당 카드 내용 수, r = 카드 줄 수, n = 줄 글자 수, h = 글 상자 있는 이동 수
// basis: estimate
/** 장면({ figure, scene, timeline })을 검사해 오류와 경고를 problems에 넣는다. 항목 목록 순서대로 판정하고 오류 메시지 앞에 검사 번호를 붙인다. 끝나지 않는 대기(`stalls`)는 경고 `wait-stalled`로 알린다. */
export function checkFigure({ figure, scene, timeline }, problems) {
  const context = createContext(figure, scene, timeline);
  for (const { judge } of CHECKS) judge?.(context, problems);
  warnStalls(figure, timeline, problems);
  return { hiddenChipWarnings: context.hiddenChipWarnings };
}

// cost: time O(check), heap O(s + e), stack O(1)
// vars: check = 그림 검사 시간, s = 도형 수, e = 선 수
// basis: estimate
/** 그래프 배치 후보가 선·라벨·상태 알약의 기하 검사를 통과하는지. 실제 사건 처리와 이동 글 검사는 선택 뒤 build-scene.js의 검사가 맡는다. 배치(layout/graph.js)가 받는 판정이다. */
export function isSoundGraph(figure, scene) {
  const problems = createProblems();
  const timeline = { segs: figure.steps.map((step) => ({ hops: [], status: step.status })) };
  checkFigure({ figure: { ...figure, views: [{ strategy: 'graph' }] }, scene: composePanels([{ strategy: 'graph', scene }]), timeline }, problems);
  return !problems.errors.length;
}
