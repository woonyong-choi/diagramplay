// HTML은 원본 시간표를 유지한 좁은 배치를 함께 싣는다. 브라우저에서 배치나 사건을 다시 계산하지 않는다.
// 좁은 배치는 그래프 판을 좁은 컨테이너 폭(COMPACT_WIDTH)에 맞춰 다시 만든 후보다. 이동 글을 원본보다 더 가리면 쓰지 않는다. 순서 판은 다시 만들지 않고 틀 폭에 맞춰 읽힘 하한까지 줄어든다.
import { reflowFigure } from '../compile/figure.js';
import { COMPACT_WIDTH } from '../measure/canvas.js';
import { values } from '@woonyong-choi/design-tokens/tokens.js';
import { figureContent } from './content.js';

// cost: time O(elk + check + out), heap O(out), stack O(d)
// vars: elk = 배치 시간, check = 그림 검사 시간, out = SVG와 시간표 크기, d = 그룹 깊이
// basis: estimate
/**
 * 좁은 배치의 내용. 컨테이너보다 넓은 그래프 판이 없거나 다시 만들어도 좁아지지 않으면 undefined다.
 * 사건과 시각은 원본 시간표와 같고 그래프의 경로만 다르다. 후보는 이동 글 경고(검사 7번)가 원본보다 늘지 않고 넓은 그래프의 높이를 늘리지 않을 때만 쓴다.
 */
export async function responsiveContent(result, glyphs) {
  const wide = result.scene.panels;
  if (!wide.some((panel) => panel.strategy === 'graph' && panel.box.w > COMPACT_WIDTH)) return;
  const narrow = await reflowGraph(result);
  if (!narrow || movingTextWarnings(narrow) > movingTextWarnings(result) || !keepsGraphHeight(result, narrow)) return;
  if (!narrow.scene.panels.some((panel, i) => panel.box.w < wide[i].box.w)) return;
  const content = figureContent(narrow, glyphs);
  return { content, timeline: narrow.timeline, breakpoint: values.breakpoint.mobile };
}

// 이동 글이 도형·글에 가려지거나 다른 이동 글과 겹친다는 검사 7번 경고 수. 배치 선택이 이미 쓰는 기준과 같다.
const movingTextWarnings = (built) => built.warnings.filter((d) => d.code === 'check-7').length;

// cost: time O(p), heap O(1), stack O(1)
// vars: p = 판 수
// basis: estimate
// 가로 탐색이 여전히 필요한 그래프는 본문 높이와 장면 탭까지의 거리도 함께 늘리지 않는다.
function keepsGraphHeight(wide, narrow) {
  return narrow.scene.panels.every((panel, i) => panel.strategy !== 'graph' || panel.box.w <= COMPACT_WIDTH || panel.box.h <= wide.scene.panels[i].box.h);
}

// 그래프를 좁은 폭에 배치한다. 새 배치에서 사건 시각을 보존할 수 없으면(layout-timing) undefined다. 다른 오류는 그대로 던진다.
async function reflowGraph(result) {
  try {
    return await reflowFigure(result, { layoutWidth: COMPACT_WIDTH });
  } catch (error) {
    if (!error.problems?.some((d) => d.code === 'layout-timing')) throw error;
  }
}
