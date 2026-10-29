// 브라우저에서 돈다(play.js와 한 스크립트로 이어 붙는다). 점이 도형에 닿을 때의 도착 후광을 그린다.
// 모습(frame.pulses)이 가리키는 값을 그대로 쓴다.

// 도형 윤곽 후광을 겹칠 윤곽 요소를 찾는 선택자. 모든 도형 종류의 바깥 윤곽은 도형 묶음 바로 아래의 .fl-stroke 요소이고, 종류에 따라 하나(상자, 표, 큐 등)이거나 여럿(저장소: 몸통과 뚜껑)이다.
// 윤곽 요소가 없는 도형은 후광이 없다.
const OUTLINE_SELECTOR = ':scope > .fl-stroke';

/**
 * 후광을 그린다. 도착 후광은 도형 윤곽과 같은 모양의 겹침 선 하나의 불투명도다(면이나 선 굵기를 키우지 않는다).
 * 같은 도형이 여러 곳에 그려져도 후광은 논리 사건 하나이고, 있는 곳마다 같은 값을 쓴다.
 */
function paintPulses(stage, pulses) {
  for (const [id, indices] of stage.nodesById) {
    const level = pulses[`node:${id}`] ?? 0;
    for (const i of indices) for (const overlay of level > 0 ? overlayOf(stage, i) : (stage.overlays[i] ?? [])) writeAttr(stage, overlay, 'opacity', level);
  }
}

// 도형 i의 도착 후광 겹침 선 목록. 도형 윤곽(.fl-stroke)마다 복제해 면을 없애고 그 바로 위에 겹친다. 처음 필요할 때 한 번 만든다.
// 윤곽 요소가 없는 도형은 후광이 없어 빈 목록이다(OUTLINE_SELECTOR).
function overlayOf(stage, i) {
  if (stage.overlays[i] !== undefined) return stage.overlays[i];
  stage.overlays[i] = [...stage.nodes[i].querySelectorAll(OUTLINE_SELECTOR)].map((outline) => {
    const overlay = outline.cloneNode(false);
    overlay.removeAttribute('id');
    // 도착 후광은 도형이 고른 색과 상관없이 공통 UI 강조 색이다(figure.css .fl-pulse).
    overlay.setAttribute('class', 'fl-pulse');
    overlay.setAttribute('opacity', 0);
    overlay.setAttribute('aria-hidden', 'true');
    outline.after(overlay);
    return overlay;
  });
  return stage.overlays[i];
}
