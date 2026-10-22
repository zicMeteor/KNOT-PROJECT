import { request } from "./client"

export async function fetchGraph() {
  let res
  try {
    res = await request("/api/graph")
  } catch {
    throw new Error("그래프를 불러오지 못했습니다")
  }
  return await res.json()
}

export async function fetchCategoryGraph(category) {
  let res
  try {
    res = await request("/api/graph/category/" + encodeURIComponent(category))
  } catch {
    throw new Error("카테고리 그래프를 불러오지 못했습니다")
  }
  const data = await res.json()
  // 서버 키가 nodes가 아니라 tags라서 이름을 맞춰준다
  return { nodes: data.tags, links: data.links }
}

export async function fetchTagContents(tag) {
  let res
  try {
    res = await request(
      "/api/graph/tag/" + encodeURIComponent(tag) + "/contents"
    )
  } catch (e) {
    console.error("fetchTagContents 실패:", e)
    throw new Error("자료 목록을 불러오지 못했습니다")
  }
  const data = await res.json()
  return data.contents.map((c) => ({
    id: c.content_id,
    title: c.title,
    category: c.category,
    summary: c.summary,
    url: c.URL,
    memo: c.memo,
    createdAt: c.created_at,
    tags: c.tags ?? [],
    hasFile: !!c.has_file,
  }))
}