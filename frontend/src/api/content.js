import { request } from "./client"

export async function fetchContents() {
  let res
  try {
    res = await request("/api/content")
  } catch (e) {
    console.error("fetchContents 실패:", e)
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

export async function analyzePdf(file, signal) {
  const form = new FormData()
  form.append("file", file)
  // Content-Type은 직접 지정하지 않는다 (브라우저가 boundary를 붙여 설정)
  const res = await request(
    "/api/content/analyze-pdf",
    { method: "POST", body: form, signal },
    {
      showDetail: true,
      fallback: "PDF 분석에 실패했습니다. 잠시 후 다시 시도하세요",
    }
  )
  return await res.json()
}

export async function saveContent(content) {
  const names = content.tags.map((t) => t.name)
  const res = await request(
    "/api/content",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: content.url ?? null,
        source: content.source ?? "url",
        memo: content.memo || null,
        title: content.title,
        category: content.category,
        tags: names,
        summary: content.summary,
      }),
    },
    { fallback: "저장에 실패했습니다. 잠시 후 다시 시도하세요" }
  )
  return await res.json()
}