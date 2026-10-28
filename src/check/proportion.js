// 9번과 10번: 그림 비율과 문서 폭에서 읽힘.
import { ASPECT_MAX, canvasOf, displayRatio } from '../measure/canvas.js';
import { ROOT } from '../layout/model.js';
import { values } from '@woonyong-choi/design-tokens/tokens.js';

// 가장 작은 글 토큰. 그림이 줄어들어도 이보다 작은 글이 되면 읽히지 않는다.
const MIN_READABLE = Math.min(...Object.values(values.text.figure));
// 줄인 글 크기 비교에서 반올림을 넘기 위한 여유
const SIZE_SLACK = 0.01;

// cost: time O(g log g), heap O(g), stack O(1)
// vars: g = 그룹 수
// basis: estimate
// 9번: 보이는 가로세로 비율(내용이 표시 상한보다 좁으면 그 폭 기준, `width wide`는 넓은 폭 기준). 표시 상한 안에 드는 그림은 보지 않는다. 비율을 줄이는 쪽의 그룹 방향이 있으면 그것을, 없으면 aspect를 권한다.
export function checkAspect({ figure, scene }, problems) {
  // 비율은 그래프 보기 하나뿐인 문서의 그림 모양을 가리킨다. 보기가 여럿이면 쌓은 판의 비율이라 그림 모양을 고칠 방법이 판마다 다르다.
  if (figure.views.length !== 1 || figure.views[0].strategy !== 'graph') return;
  const canvas = canvasOf(figure);
  const ratio = displayRatio(scene.width, scene.height, canvas);
  if (ratio <= ASPECT_MAX && ratio >= 1 / ASPECT_MAX) return;
  // 가로세로가 모두 표시 상한 이하인 그림은 줄어들지 않고 그대로 보여 비율이 읽힘을 해치지 않는다.
  if (scene.width <= canvas && scene.height <= canvas) return;
  const isWide = ratio > ASPECT_MAX;
  const group = turnableGroup({ figure, scene }, isWide ? 'down' : 'right', (g) => (isWide ? g.w : g.h));
  let fix;
  if (group) fix = `Set direction=${isWide ? 'down' : 'right'} on group "${group.id}"`;
  else if (figure.aspect !== undefined) fix = `Use a ${isWide ? 'smaller' : 'larger'} aspect than ${figure.aspect}`;
  else fix = 'Use a wider display, or split the figure into an overview and details';
  problems.warn(figure.line, `[check 9] figure aspect ${ratio.toFixed(1)} is outside 1/3 to 3. ${fix}`);
}

// cost: time O(g log g + s·g), heap O(g), stack O(1)
// vars: g = 그룹 수, s = 도형 수
// basis: estimate
// 방향을 바꿔 비율이 달라지는 그룹(안에 둘 이상이 있고 아직 그 방향이 아닌 그룹) 가운데 줄이려는 쪽이 가장 큰 것
function turnableGroup({ figure, scene }, turn, size) {
  const own = new Map(figure.groups.map((g) => [g.id, g.direction]));
  const members = (id) => [...scene.items, ...scene.groups].filter((it) => (it.parent ?? ROOT) === id).length;
  return [...scene.groups].filter((g) => own.get(g.id) !== turn && members(g.id) > 1).sort((a, b) => size(b) - size(a))[0];
}

// 10번: 캔버스 폭(표준 또는 `width wide`)으로 줄였을 때 가장 작은 글(태그 글자)이 가장 작은 글 토큰 이상이다.
export function checkReadable({ figure, scene }, problems) {
  const scale = Math.min(1, canvasOf(figure) / scene.width);
  const smallest = MIN_READABLE * scale;
  if (smallest >= MIN_READABLE - SIZE_SLACK) return;
  problems.warn(figure.line, `[check 10] at canvas width the smallest text is ${smallest.toFixed(1)}px. ${readableFix({ figure, scene })}`);
}

// 문서 폭에서 글자가 작아질 때의 안내. 화면 맞춤을 위해 자동으로 선을 접지 않는다.
function readableFix({ figure, scene }) {
  if (figure.views.every((view) => view.strategy === 'sequence')) return 'Use fewer participants or shorter messages';
  return 'Use a wider display, zoom in, or split it into an overview and a detail figure';
}
