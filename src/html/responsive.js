// HTML의 차트·시간축은 원본 시간표를 유지한 좁은 후보를 함께 싣는다.
// 그래프 좌표와 경로는 창 크기에 따라 바꾸지 않는다. 화면 맞춤과 확대는 뷰어가 맡는다.
import { reflowFigure } from '../compile/figure.js';
import { COMPACT_WIDTH } from '../measure/canvas.js';
import { values } from '@woonyong-choi/design-tokens/tokens.js';
import { figureContent } from './content.js';

const REFLOWED = new Set(['plot', 'time']);

// cost: time O(elk + check + out), heap O(out), stack O(d)
// vars: elk = 배치 시간, check = 그림 검사 시간, out = SVG와 시간표 크기, d = 그룹 깊이
// basis: estimate
/**
 * 차트·시간축의 좁은 배치 내용. 그래프와 순서 판은 같은 배치를 유지한다.
 * 사건과 시각은 원본 시간표와 같고 후보는 이동 글 경고(검사 7번)가 원본보다 늘지 않을 때만 쓴다.
 */
export async function responsiveContent(result, glyphs) {
  const wide = result.scene.panels;
  if (!wide.some((panel) => REFLOWED.has(panel.strategy) && panel.box.w > COMPACT_WIDTH)) return;
  const narrow = await reflowFigure(result, { chartWidth: COMPACT_WIDTH });
  if (movingTextWarnings(narrow) > movingTextWarnings(result)) return;
  if (!narrow?.scene.panels.some((panel, i) => panel.box.w < wide[i].box.w)) return;
  const content = figureContent(narrow, glyphs);
  return { content, timeline: narrow.timeline, breakpoint: values.breakpoint.mobile };
}

// 이동 글이 도형·글에 가려지거나 다른 이동 글과 겹친다는 검사 7번 경고 수. 배치 선택이 이미 쓰는 기준과 같다.
const movingTextWarnings = (built) => built.warnings.filter((d) => d.code === 'check-7').length;
