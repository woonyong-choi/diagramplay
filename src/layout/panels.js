// 보기마다 따로 배치한 판을 위에서 아래로 쌓아 장면 하나로 합친다. 판은 가장 넓은 판의 가운데에 맞추고, 보기 이름(label)이 있으면 판 위에 제목 줄을 둔다.
// 판 제목은 판 폭과 상관없이 모두 그림 왼쪽 여백(FIGURE_PAD)에서 시작한다. 좁은 판의 제목이 가운데로 밀려 판마다 제목 자리가 달라지지 않게 하기 위해서다.
// 판의 폭은 내용 폭과 제목 폭(왼쪽 여백 FIGURE_PAD + 글 + 오른쪽 여백) 중 큰 쪽이고, 내용은 그 폭 안에서 가운데에 놓인다.
import { values } from '@woonyong-choi/design-tokens/tokens.js';
import { FIGURE_PAD } from '../measure/canvas.js';
import { measure } from '../measure/fonts.js';
import { STYLE } from '../measure/texts.js';
import { shiftScene } from './shift.js';

const SIZE = values.spacing.figure;

// cost: time O(p·(s + e·pts)), heap O(p·(s + e·pts)), stack O(1)
// vars: p = 판 수, s = 도형·그룹 수, e = 선 수, pts = 경로 점 수
// basis: estimate
/**
 * 판들을 합친 장면을 만든다.
 */
export function composePanels(panels) {
  const sizes = panels.map(sizeOf);
  const width = Math.max(...sizes.map((s) => s.w));
  const labelH = SIZE.group.title;
  const scene = { items: [], groups: [], edges: [], lifelines: [], notes: [], activations: [], destructions: [], fragments: [], panels: [], width, height: 0 };
  let y = 0;
  panels.forEach((panel, index) => {
    const { w, h, content } = sizes[index];
    const head = panel.label ? labelH : 0;
    const x = (width - w) / 2;
    const place = { dx: x + (w - content) / 2, dy: y + head };
    place_(scene, panel, place, index);
    const box = { x, y, w, h: h + head };
    // 판이 그리는 영역. 제목은 그림 왼쪽 여백에서 시작하므로 제목이 있는 판은 그림 폭 전체를 차지한다. 상자(box)는 내용 폭이라 좁은 판의 제목이 상자 밖에 놓인다.
    const frame = panel.label ? { x: 0, y, w: width, h: h + head } : box;
    scene.panels.push({ index, view: panel.view, strategy: panel.strategy, box, frame, label: panel.label, ...(panel.label ? { labelAt: { x: FIGURE_PAD, y: y + labelH / 2 } } : {}) });
    y += h + head;
  });
  scene.height = y;
  return scene;
}

// cost: time O(n), heap O(1), stack O(1)
// vars: n = 보기 이름 글자 수
// basis: estimate
// 판의 크기. content는 배치한 내용 폭이고 w는 제목이 잘리지 않게 늘린 판 폭이다.
function sizeOf(panel) {
  const source = panel.scene;
  const title = panel.label ? measure(panel.label, STYLE.group.size, STYLE.group.face) + FIGURE_PAD * 2 : 0;
  return { w: Math.max(source.width, title), h: source.height, content: source.width };
}

// cost: time O(s + e·pts), heap O(s + e·pts), stack O(1)
// vars: s = 도형·그룹 수, e = 선 수, pts = 경로 점 수
// basis: estimate
function place_(scene, panel, { dx, dy }, index) {
  if (panel.scene) {
    const part = panel.scene;
    shiftScene(part, dx, dy);
    const tag = (item) => Object.assign(item, { view: panel.view, panel: index });
    scene.items.push(...part.items.map(tag));
    scene.groups.push(...part.groups.map(tag));
    scene.edges.push(...part.edges.map((e) => Object.assign(e, { view: panel.view, panel: index, strategy: panel.strategy })));
    for (const key of ['lifelines', 'notes', 'activations', 'destructions', 'fragments']) scene[key].push(...(part[key] ?? []).map(tag));
    return;
  }
}
