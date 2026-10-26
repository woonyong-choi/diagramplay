// 값 모형의 참조 사슬과 값 바꾸기 식 목록. 원본 확인(value-check.js)과 시간표·카드 크기 계산(values.js)이 같은 읽기를 쓴다.

// cost: time O(c), heap O(1), stack O(c)
// vars: c = 참조 사슬 길이
// basis: estimate
/** 참조를 끝까지 따라간 값 이름(from이 있는 값). 참조 순환은 읽을 때 오류라 여기서는 끝이 있다. */
export function rootOf(byId, id) {
  const { ref } = byId.get(id);
  return ref === undefined ? id : rootOf(byId, ref);
}

// 이동이나 흐름의 식 모두: 닿을 때 적용하는 `set=`과 출발할 때 적용하는 `reserve=`
const allSets = ({ sets, condition }) => [...sets, ...(condition?.reserve ?? [])];

// cost: time O(s·h), heap O(h), stack O(1)
// vars: s = 단계 수, h = 단계의 이동과 흐름 수
// basis: estimate
/** 식이 있는 이동, 흐름, `on` 줄 모두. nodes는 경로의 도형 이름이다(칸 이름은 뗀다). `on` 줄은 nodes가 비어 있다. */
export function movesOf(figure) {
  const base = (id) => id.split('.')[0];
  return [
    ...figure.arrivals.map((a) => ({ sets: a.sets, nodes: [] })),
    ...figure.steps.filter((step) => step.sets?.length).map((step) => ({ sets: step.sets, nodes: [] })),
    ...figure.steps.flatMap((step) => [
      ...step.beats.flatMap((beat) => beat.hops.filter((h) => allSets(h).length).map((h) => ({ sets: allSets(h), nodes: [base(h.from), base(h.to)] }))),
      ...step.tracks.filter((t) => allSets(t).length).map((t) => ({ sets: allSets(t), nodes: t.path.map(base) })),
    ]),
  ];
}
