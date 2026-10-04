export async function fetchContents() {
  const res = await fetch(import.meta.env.VITE_API_URL + "/api/content")
  if (!res.ok) throw new Error("자료를 불러오지 못했습니다")
  const data = await res.json()
  return data.map((c) => ({
    id: c.Content_id,
    title: c.title,
    category: c.category,
    summary: c.summary,
    url: c.URL,
    tags: c.tags,
    memo: c.memo,
  }))
}