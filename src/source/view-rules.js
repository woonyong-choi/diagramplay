// 순서 보기의 규칙. 순서 보기는 자기에게 투영된 메시지로 생명주기와 참여자 순서를 확인한다.
import { checkSequenceLife } from './sequence-life.js';
import { sequenceFigure } from '../compile/views.js';

// cost: time O(v·(m + p)), heap O(m), stack O(1)
// vars: v = 순서 보기 수, m = 메시지 수, p = 참여자 수
// basis: estimate
/** 순서 보기마다 투영된 메시지로 생성·소멸·활성 규칙을 확인하고, 보기 블록의 참여자 순서가 처음 보내는 순서와 다르면 그 참여자를 적은 줄에서 경고한다. */
export function checkSequenceViews(figure, problems) {
  for (const view of figure.views.filter((v) => v.strategy === 'sequence')) {
    const sequence = sequenceFigure(figure, view);
    checkSequenceLife(sequence, problems);
    checkParticipantOrder(sequence, view, problems);
  }
}

// 보기 블록의 참여자 순서가 처음 보내는 순서와 다르면 순서가 처음 어긋난 참여자의 줄과 자리에서 경고한다(--strict면 오류). 보내지 않는 참여자는 뒤에 와도 된다.
function checkParticipantOrder(sequence, view, problems) {
  const senders = [];
  for (const beat of sequence.steps.flatMap((s) => s.beats)) {
    for (const hop of beat.hops) if (!senders.includes(hop.from)) senders.push(hop.from);
  }
  const declared = sequence.nodes.map((n) => n.id);
  const expected = [...senders.filter((id) => declared.includes(id)), ...declared.filter((id) => !senders.includes(id))];
  const first = declared.findIndex((id, i) => id !== expected[i]);
  const at = view.members[first];
  if (first >= 0) problems.warn(at?.line ?? view.line, `declare participants in the order they first send: ${expected.join(', ')}`, { column: at?.column });
}
