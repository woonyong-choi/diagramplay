// 그림 검사. 배치가 끝난 장면에서 화면 오류를 찾아 원본 줄 번호와 함께 알린다(docs/design/figure-check.md).
// 항목 목록은 check/items.js, 판정 함수는 check/ 아래 항목별 파일이다.
import { warnStalls } from '../flow/event-budget.js';
import { composePanels } from '../layout/panels.js';
import { statusBoxes } from '../layout/status.js';
import { hasPill } from '../measure/pills.js';
import { createProblems } from '../source/problems.js';
import { createFamily, drawnBox, pillBox, titleBox } from './geometry.js';
import { CHECKS } from './items.js';

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
  for (const { judge, stage } of CHECKS) if (stage === 'scene') judge?.(context, problems);
  warnStalls(figure, timeline, problems);
  return { hiddenChipWarnings: context.hiddenChipWarnings };
}

// cost: time O(check), heap O(s + e), stack O(1)
// vars: check = 그림 검사 시간, s = 도형 수, e = 선 수
// basis: estimate
/** 그래프 후보의 기하 검사. reference가 있으면 기존 오류 외의 새 오류가 없는지 비교한다. 실제 사건과 이동 글, 최종 그림의 전체 검사는 선택 뒤 compile/scene.js가 맡는다. */
export function isSoundGraph(figure, scene, reference) {
  const errors = graphErrors(figure, scene);
  if (!reference) return !errors.length;
  const existing = new Set(graphErrors(figure, reference).map(error => `${error.code}:${error.line}:${error.message}`));
  return errors.every(error => existing.has(`${error.code}:${error.line}:${error.message}`));
}

// 후보의 국소 경로 단축은 기존의 다른 오류를 늘리지 않는지 비교한다. 최종 그림 검사는 모든 오류를 그대로 판정한다.
function graphErrors(figure, scene) {
  const problems = createProblems();
  const timeline = { segs: figure.steps.map((step) => ({ hops: [], status: step.status })) };
  const copy = { ...scene, items: scene.items.map(item => ({ ...item })), groups: scene.groups.map(group => ({ ...group })), edges: scene.edges.map(edge => ({ ...edge, points: edge.points.map(point => ({ ...point })), labelAt: edge.labelAt && { ...edge.labelAt }, endpointLabels: edge.endpointLabels?.map(label => ({ ...label })) })) };
  checkFigure({ figure: { ...figure, views: [{ strategy: 'graph' }] }, scene: composePanels([{ strategy: 'graph', scene: copy }]), timeline }, problems);
  return problems.errors;
}
