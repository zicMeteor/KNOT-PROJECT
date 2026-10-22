import { useMemo } from "react"

function tagName(t) {
  return typeof t === "string" ? t : t?.name ?? ""
}

// 비교용으로 다듬기: 소문자, 띄어쓰기 무시 (태그 "자연어 처리"를 "자연어처리"로 쳐도 찾게)
function squash(s) {
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

// 즉시 검색: 검색어를 띄어쓰기로 나눠, 모든 단어가 어딘가에 들어 있는 자료만 남긴다 (AND)
// category가 있으면 그 카테고리만. 결과는 최근 추가 순
export function useLibraryFilter(contents, query, category) {
  // 검색용 문자열은 자료가 바뀔 때만 다시 만든다 (글자 칠 때마다 만들지 않게)
  const indexed = useMemo(
    () => [...contents].sort(byNewest).map((c) => ({ content: c, text: searchText(c) })),
    [contents]
  )

  return useMemo(() => {
    const words = searchWords(query)
    return indexed
      .filter(({ content, text }) => {
        if (category && content.category !== category) return false
        return words.every((w) => text.includes(w))
      })
      .map(({ content }) => content)
  }, [indexed, query, category])
}