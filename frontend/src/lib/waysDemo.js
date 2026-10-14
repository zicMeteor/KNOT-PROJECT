// 홈 "찾고, 다시 묶습니다" 구간이 내 자료로 보여 줄 만큼 자료가 모였는지 판단한다
// 모자라면 예시 자료로 시연하고, 사용자가 직접 입력한 것은 언제나 내 자료에서 찾는다
import { SAMPLE_CONTENTS } from "../constants/sampleContents"
import { searchText } from "../hooks/useLibraryFilter"
import { tagGraph } from "./threadGraph"

// 내 자료로 바꾸는 기준. 숫자는 각 줄이 제 이야기를 보여 줄 수 있는 최소치다
export const RICH = {
  items: 6, // 전체 자료 수 (목록 5건이 차고, 검색으로 줄어든다)
  tags: 8, // 전체 태그 수 (처음 그래프가 비어 보이지 않는다)
  count: 3, // 시연 태그가 붙은 자료 수 (AI 줄 결과 3건이 다 찬다)
  neighbors: 3, // 시연 태그와 이어진 태그 수 (그래프 줄에서 이웃이 보인다)
  outside: 2, // 시연 태그가 없는 자료 수 (목록 줄에서 검색하면 줄어드는 게 보인다)
}
// 글자 검색 건수를 맞춰 볼 후보 수 (자료가 아주 많아도 홈이 멈추지 않게)
const MAX_CANDIDATES = 20

export function toItems(list) {
  return list.map((c) => ({ cat: c.category, tags: c.tags ?? [] }))
}

// 태그마다 이어진 태그 수 (선을 한 번만 훑는다)
function degrees(graph) {
  const deg = new Map()
  for (const l of graph.links) {
    deg.set(l.source, (deg.get(l.source) ?? 0) + 1)
    deg.set(l.target, (deg.get(l.target) ?? 0) + 1)
  }
  return deg
}

// 태그마다 기준과 견준 값. 자료 많은 순 → 이웃 많은 순 → 이름 순
function ranked(contents, graph, deg) {
  return graph.nodes
    .map((n) => ({ n, deg: deg.get(n.id) ?? 0, outside: contents.length - n.count }))
    .sort((a, b) => b.n.count - a.n.count || b.deg - a.deg || a.n.id.localeCompare(b.n.id))
}

function eligible(r) {
  return r.n.count >= RICH.count && r.deg >= RICH.neighbors && r.outside >= RICH.outside
}

// 시연에 쓸 태그: 기준을 넘는 태그 중 앞 순서
// 목록 검색(글자 포함)으로 찾은 건수가 태그 자료 수와 같은 태그를 먼저 고른다
// ("AI"처럼 짧은 태그는 다른 단어 속에도 들어 있어 목록 줄과 그래프 줄의 숫자가 달라진다)
function pickDemo(contents, list) {
  const cands = list.filter(eligible).slice(0, MAX_CANDIDATES).map((r) => r.n)
  if (cands.length === 0) return null
  const texts = contents.map(searchText)
  const hits = (label) => {
    const words = label.toLowerCase().split(/\s+/).filter(Boolean)
    return texts.filter((t) => words.every((w) => t.includes(w))).length
  }
  return cands.find((n) => hits(n.label) === n.count) ?? cands[0]
}

// mine: 내 자료. rich가 아니면 checks로 무엇이 모자란지 보여 준다
export function waysData(mine) {
  const graph = tagGraph(toItems(mine))
  const list = ranked(mine, graph, degrees(graph))
  const enough = mine.length >= RICH.items && graph.nodes.length >= RICH.tags
  const demo = enough ? pickDemo(mine, list) : null
  // 기준에 가장 가까운 태그: 기준을 넘는 태그가 있으면 그것, 없으면 자료가 가장 많은 태그
  const near = list.find(eligible) ?? list[0] ?? null
  const checks = [
    { label: `자료 ${RICH.items}건 이상`, now: `${mine.length}건`, ok: mine.length >= RICH.items },
    { label: `태그 ${RICH.tags}개 이상`, now: `${graph.nodes.length}개`, ok: graph.nodes.length >= RICH.tags },
    {
      label: `자료 ${RICH.count}건 이상, 이웃 태그 ${RICH.neighbors}개 이상인 태그 (그 태그가 없는 자료도 ${RICH.outside}건 이상)`,
      now: near ? `#${near.n.label}: 자료 ${near.n.count}건, 이웃 ${near.deg}개, 없는 자료 ${near.outside}건` : "태그 없음",
      ok: !!near && eligible(near),
    },
  ]
  return { rich: !!demo, graph, demo, checks }
}

// 예시 자료의 그래프와 시연 태그 (한 번만 계산)
export const SAMPLE_GRAPH = tagGraph(toItems(SAMPLE_CONTENTS))
export const SAMPLE_DEMO = pickDemo(SAMPLE_CONTENTS, ranked(SAMPLE_CONTENTS, SAMPLE_GRAPH, degrees(SAMPLE_GRAPH)))

// 다시 묶기 줄은 언제나 예시로 보여 준다. 바꿀 안은 AI가 만들어야 해서, 내 자료 제목에 지어낸 안을 붙이지 않는다
// "시험 공부용" 목적에 맞게 고른 예시 자료 4건
const REGROUP_IDS = [-26, -20, -27, -28]
export const SAMPLE_REGROUP = REGROUP_IDS.map((id) => SAMPLE_CONTENTS.find((c) => c.id === id)).filter(Boolean)
