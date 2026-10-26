// 단계별 도형 상태 알약을 그린다. 자리는 layout/status.js, 크기와 글자·기호는 measure/pills.js가 정하고, 몸통은 draw/decor.js의 drawStatusPill(면은 알약 부품 draw/pill.js)이 그린다.
import { escapeXml } from '../format/text.js';
import { instancesOf, statusBox, statusPills } from '../layout/status.js';
import { drawStatusPill } from './decor.js';
import { hiddenAttr } from './visible.js';

// cost: time O(p·i), heap O(out), stack O(1)
// vars: p = 알약 수, i = 도형 수, out = 만든 SVG 글자 수
// basis: estimate
/**
 * 상태 알약 층. 알약마다, 그 논리 카드를 그린 모든 도형에 묶음 하나씩 있고 `data-st`(이름과 종류)로 재생기가 찾는다. 처음에는 보이지 않는다.
 * 논리 상태는 하나라 같은 알약은 모든 도형에서 같은 시각 구간에 보인다.
 * @param windows (spans) => 보임 SMIL 요소. 움직이는 SVG가 시각 구간으로 이산 불투명도를 만들고, 재생기는 빈 글을 돌려주고 직접 켠다
 * @param name (논리 id, 도형 번호) => `data-st`의 앞부분. 움직이는 SVG는 도형마다 다르게(도형 번호) 쓰고, 재생기는 논리 id를 써서 한 이름의 알약을 한꺼번에 켠다
 * @returns 알약 층 글. 알약이 없으면 빈 글이다
 */
export function drawStatusPills(scene, timeline, { glyphs, windows, name, isStatic = false }) {
  const drawn = statusPills(timeline).flatMap(({ node, kind, spans }) =>
    instancesOf(scene, node).map((item) => {
      const box = statusBox(scene.items[item], kind);
      return (
        `<g class="fl-status fl-status-${kind}" data-st="${escapeXml(`${name(node, item)}-${kind}`)}" opacity="${isStatic ? 1 : 0}"${hiddenAttr(isStatic)}>` +
        `${drawStatusPill(box, kind, { glyphs, prefix: `status-${item}-${kind}` })}${windows(spans)}</g>`
      );
    }),
  );
  return drawn.length ? `<g class="fl-status-pills">${drawn.join('')}</g>` : '';
}
