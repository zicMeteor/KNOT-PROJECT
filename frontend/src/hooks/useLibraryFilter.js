import { useMemo } from "react"

function tagName(t) {
  return typeof t === "string" ? t : t?.name ?? ""
}

// 비교용으로 다듬기: 소문자, 띄어쓰기 무시 (태그 "자연어 처리"를 "자연어처리"로 쳐도 찾게)
export function squash(s) {
  return String(s).toLowerCase().replace(/\s+/g, "")
}

// 자료 하나를 검색용 문자열 하나로 합친다 (제목·주소·요약·메모·태그)
// 칸 사이는 띄어쓰기가 아닌 구분 글자로 이어서, 띄어쓰기를 지워도 두 칸이 붙어 엉뚱하게 찾히지 않게 한다
export function searchText(c) {
  return [c.title, c.url, c.summary, c.memo, ...(c.tags ?? []).map(tagName)]
    .filter(Boolean)
    .map(squash)
    .join("\u0001")
}

// 검색어를 단어로 나눈다. 태그를 "#FastAPI"처럼 쳐도 찾게 앞의 #은 뗀다
export function searchWords(query) {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^#+/, ""))
    .filter(Boolean)
}

// 최근 추가 순: 생성일자(ISO 문자열이라 글자 순 비교 = 시간 순) → 같거나 없으면 id 큰 순
export function byNewest(a, b) {
  const byDate = String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
  return byDate !== 0 ? byDate : b.id - a.id
}

// 같은 규칙으로 한 번만 거를 때 (훅 밖에서). 결과 순서는 넣은 순서 그대로
export function filterContents(contents, query, category = null) {
  const words = searchWords(query)
  return contents.filter(
    (c) => (!category || c.category === category) && words.every((w) => searchText(c).includes(w))
  )
}

// 단어가 어느 칸에서 맞았는지에 따른 점수: 제목·태그 이름 그대로 > 태그 일부 > 요약 > 메모 > 주소
const WEIGHT = { title: 8, tagExact: 8, tag: 5, summary: 3, memo: 2, url: 1 }

// 자료 하나를 칸별 비교용 글자로 (자료가 바뀔 때만 만든다)
function fieldsOf(c) {
  return {
    title: squash(c.title ?? ""),
    tags: (c.tags ?? []).map((t) => squash(tagName(t))),
    summary: squash(c.summary ?? ""),
    memo: squash(c.memo ?? ""),
    url: squash(c.url ?? ""),
  }
}

// 단어 하나가 가장 잘 맞은 칸의 점수 (안 맞으면 0)
function wordScore(f, w) {
  if (f.title.includes(w)) return WEIGHT.title
  if (f.tags.includes(w)) return WEIGHT.tagExact
  if (f.tags.some((t) => t.includes(w))) return WEIGHT.tag
  if (f.summary.includes(w)) return WEIGHT.summary
  if (f.memo.includes(w)) return WEIGHT.memo
  if (f.url.includes(w)) return WEIGHT.url
  return 0
}

// 즉시 검색 (검색 엔진처럼): 단어가 하나라도 맞으면 보여 주고, 많이 맞은 자료 → 점수 높은 자료 → 최근 추가 순
// 한 글자 단어("a", "c")는 거의 모든 자료에 들어 있어서, 두 글자 이상 단어가 함께 있으면 그 단어만으로는 보여 주지 않는다
// category가 있으면 그 카테고리만. full: 모든 단어가 맞은 자료 id (없으면 AI로 찾기를 권한다)
export function useLibraryFilter(contents, query, category) {
  // 비교용 글자는 자료가 바뀔 때만 다시 만든다 (글자 칠 때마다 만들지 않게)
  const indexed = useMemo(
    () => [...contents].sort(byNewest).map((c) => ({ content: c, f: fieldsOf(c) })),
    [contents]
  )

  return useMemo(() => {
    const words = searchWords(query)
    const pool = indexed.filter(({ content }) => !category || content.category === category)
    if (words.length === 0) return { items: pool.map(({ content }) => content), full: null }
    const strong = words.some((w) => w.length >= 2)
    const ranked = []
    for (const { content, f } of pool) {
      let hits = 0
      let strongHits = 0
      let score = 0
      for (const w of words) {
        const sc = wordScore(f, w)
        if (sc === 0) continue
        hits++
        if (w.length >= 2) strongHits++
        score += sc
      }
      if (hits === 0 || (strong && strongHits === 0)) continue
      ranked.push({ content, hits, score })
    }
    // sort는 같은 값이면 원래 순서(최근 추가 순)를 지킨다
    ranked.sort((a, b) => b.hits - a.hits || b.score - a.score)
    const full = new Set(ranked.filter((r) => r.hits === words.length).map((r) => r.content.id))
    return { items: ranked.map((r) => r.content), full }
  }, [indexed, query, category])
}
