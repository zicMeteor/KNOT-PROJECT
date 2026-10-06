const BASE = import.meta.env.VITE_API_URL

async function request(path, options) {
  let res
  try {
    res = await fetch(BASE + path, options)
  } catch {
    throw new Error("서버에 연결할 수 없습니다")
  }
  if (res.ok) return res

  let detail = null
  try {
    detail = (await res.json()).detail
  } catch {
    // JSON이 아닌 응답(500 등)은 detail 없이 진행
  }
  console.error("API 오류", res.status, detail)

  if (typeof detail === "string" && detail.includes("이미 저장된 URL")) {
    throw new Error(detail)
  }
  throw new Error("처리에 실패했습니다. 주소를 확인하고 다시 시도하세요")
}

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

export async function analyzeUrl(url, memo) {
  const res = await request("/api/content/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: url, memo: memo }),
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