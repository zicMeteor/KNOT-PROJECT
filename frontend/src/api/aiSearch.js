import { request } from "./client"

const AI_SEARCH_FAILURE = "검색에 실패했습니다. 잠시 후 다시 시도하세요"

// AI 검색: 질문을 LLM이 해석해 태그·키워드로 저장한 자료를 찾는다 (/api/agent/search)
export async function aiSearch(query, signal) {
  const res = await request(
    "/api/agent/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal,
    },
    { fallback: AI_SEARCH_FAILURE }
  )
  const data = await res.json()
  return {
    analysis: data.analysis,
    count: data.count,
    contents: data.contents.map((c) => ({
      id: c.content_id,
      title: c.title,
      category: c.category,
      summary: c.summary,
      url: c.URL,
      createdAt: c.created_at,
      matchType: c.match_type,
      tags: c.tags ?? [],
      hasFile: !!c.has_file,
    })),
  }
}