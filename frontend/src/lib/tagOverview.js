// "전체" 그래프 데이터: 저장한 모든 자료의 태그를 한 그래프로 (디자인 시안 "빛의 실")
// 서버의 전체 그래프(/api/graph)는 카테고리 6개만 주므로, 시안처럼 태그 별자리를 보이려고 화면에서 만든다
//
// 노드 = 태그. id와 name은 서버의 태그 이름 그대로 (카테고리 그래프, 태그 자료 조회와 같은 이름)
//   val: 그 태그를 가진 자료 수 (점 크기)
//   category: 그 태그를 가장 많이 쓴 카테고리 (점 색)
//   showLabel: 자료가 많은 태그 몇 개만 이름을 단다 (다 달면 글자가 겹쳐 읽히지 않는다)
//   catLabel: 카테고리마다 가장 큰 태그 위에 카테고리 이름을 띄운다
// 엣지 = 두 태그를 함께 가진 자료 수 (weight)
import { tagName } from "./contentMeta"

export function buildTagOverview(contents, labelMax = 14) {
  const nodes = new Map()
  const links = new Map()

  for (const c of contents) {
    const tags = [...new Set((c.tags ?? []).map(tagName).filter(Boolean))]
    for (const t of tags) {
      if (!nodes.has(t)) nodes.set(t, { id: t, name: t, val: 0, cats: new Map() })
      const n = nodes.get(t)
      n.val += 1
      n.cats.set(c.category, (n.cats.get(c.category) ?? 0) + 1)
    }
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const [a, b] = tags[i] < tags[j] ? [tags[i], tags[j]] : [tags[j], tags[i]]
        const key = a + "\u0000" + b
        if (!links.has(key)) links.set(key, { source: a, target: b, weight: 0 })
        links.get(key).weight += 1
      }
    }
  }

  const list = [...nodes.values()].map(({ cats, ...n }) => {
    let best = null
    let bestN = -1
    for (const [cat, k] of cats) {
      if (k > bestN) {
        best = cat
        bestN = k
      }
    }
    return { ...n, category: best }
  })

  // 이름을 달 태그: 자료가 많은 순
  const ranked = [...list].sort((a, b) => b.val - a.val || a.name.localeCompare(b.name))
  const labeled = new Set(ranked.slice(0, labelMax).map((n) => n.id))
  // 카테고리 이름을 달 태그: 카테고리마다 가장 큰 것
  const anchor = new Map()
  for (const n of ranked) if (n.category && !anchor.has(n.category)) anchor.set(n.category, n.id)
  const anchors = new Map([...anchor].map(([cat, id]) => [id, cat]))

  return {
    nodes: list.map((n) => ({ ...n, showLabel: labeled.has(n.id), catLabel: anchors.get(n.id) ?? null })),
    links: [...links.values()],
  }
}
