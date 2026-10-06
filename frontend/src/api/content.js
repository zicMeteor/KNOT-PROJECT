import { request } from "./client"


export async function fetchContents() {
  let res
  try {
    res = await request("/api/content")
  } catch {
    throw new Error("자료를 불러오지 못했습니다")
  }
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

export async function analyzeUrl(url, memo, signal) {
  const res = await request("/api/content/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: url, memo: memo }),
    signal,
  })
  return await res.json()
}

export async function saveContent(content) {
  const names = content.tags.map((t) => t.name)
  const res = await request("/api/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: content.url,
      memo: content.memo || null,
      title: content.title,
      category: content.category,
      tags: names,
      summary: content.summary,
    }),
  })
  return await res.json()
}