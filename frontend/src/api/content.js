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
    createdAt: c.created_at
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
        analysis_status: content.analysis_status ?? "ai",
        // AI가 처음 제안한 값 (저장 전에 고쳤는지 기록하려고)
        suggested: content.suggested ?? null,
      }),
    },
    { fallback: "저장에 실패했습니다. 잠시 후 다시 시도하세요" }
  )
  return await res.json()
}

// 저장한 자료 하나를 지운다 (되돌릴 수 없다)
export async function deleteContent(id) {
  const res = await request(
    `/api/content/${id}`,
    { method: "DELETE" },
    { fallback: "삭제에 실패했습니다. 잠시 후 다시 시도하세요" }
  )
  return await res.json()
}

// 분석 결과를 저장하지 않고 취소했을 때 그 사실만 기록한다 (시연 결과보고서의 "분석 후 저장 비율"용)
// DB의 자료는 바뀌지 않는다. 기록이 실패해도 화면 흐름은 막지 않는다 (기다리지 않고, 오류는 무시한다)
export function logDiscard(analysis) {
  request("/api/content/discard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: analysis.source ?? "url",
      url: analysis.url ?? null,
      title: analysis.title ?? null,
    }),
    keepalive: true,
  }).catch(() => {})
}
