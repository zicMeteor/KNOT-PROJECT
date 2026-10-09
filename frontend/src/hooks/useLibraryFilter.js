import { useMemo } from "react"

function tagName(t) {
  return typeof t === "string" ? t : t?.name ?? ""
}

// 자료 하나를 검색용 문자열 하나로 합친다 (제목·주소·요약·메모·태그, 소문자)
function searchText(c) {
  return [c.title, c.url, c.summary, c.memo, ...(c.tags ?? []).map(tagName)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

// 최근 추가 순: 생성일자(ISO 문자열이라 글자 순 비교 = 시간 순) → 같거나 없으면 id 큰 순
export function byNewest(a, b) {
  const byDate = String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
  return byDate !== 0 ? byDate : b.id - a.id
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
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return indexed
      .filter(({ content, text }) => {
        if (category && content.category !== category) return false
        return words.every((w) => text.includes(w))
      })
      .map(({ content }) => content)
  }, [indexed, query, category])
}