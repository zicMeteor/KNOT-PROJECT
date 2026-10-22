import { BASE, request } from "./client"

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
    createdAt: c.created_at,
    // ai | ai_short | manual(AI 없이 메모로 저장) | pending
    analysisStatus: c.analysis_status,
    // PDF 자료의 원본을 열 수 있는지
    hasFile: !!c.has_file,
  }))
}

// 보관한 PDF 원본을 여는 주소 (새 탭에서 브라우저의 PDF 보기로 열린다)
export function pdfFileUrl(id) {
  return `${BASE}/api/content/${id}/file`
}

// 저장한 PDF 자료에 원본 파일을 붙인다 (이미 있으면 바꾼다)
export async function uploadPdf(id, file) {
  const form = new FormData()
  form.append("file", file)
  const res = await request(
    `/api/content/${id}/file`,
    { method: "PUT", body: form },
    { showDetail: true, fallback: "PDF 파일을 올리지 못했습니다. 잠시 후 다시 시도하세요" }
  )
  return await res.json()
}

export async function analyzeUrl(url, memo, signal) {
  const res = await request(
    "/api/content/analyze",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url, memo: memo }),
      signal,
    },
    // 400은 실패 이유(로그인 필요, 본문 없음 등)라 서버의 설명을 그대로 보여 준다
    { showDetail: true }
  )
  return await res.json()
}

// 분석에 실패한 페이지의 본문을 사용자가 붙여 넣었을 때 (서버에서 실패 처리를 켰을 때만)
export async function analyzeText(text, url, title, signal) {
  const res = await request(
    "/api/content/analyze-text",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, url: url ?? null, title: title || null }),
      signal,
    },
    { showDetail: true, fallback: "분석에 실패했습니다. 잠시 후 다시 시도하세요" }
  )
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
        // 어떻게 저장까지 왔는지: analyze(보통) / paste(실패 뒤 붙여넣기) / manual(실패 뒤 메모 저장)
        via: content.via ?? "analyze",
      }),
    },
    // 400은 입력 문제(태그 개수, 메모 없음 등)라 서버의 설명을 그대로 보여 준다
    { showDetail: true, fallback: "저장에 실패했습니다. 잠시 후 다시 시도하세요" }
  )
  return await res.json()
}

// 저장한 자료의 제목·카테고리·태그·메모를 고친다
// 다시 분석한 결과를 반영할 때는 summary와 analysis_status도 함께 보낸다
export async function updateContent(id, { title, category, tags, memo, summary, analysisStatus }) {
  const res = await request(
    `/api/content/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || null,
        category,
        tags: tags.map((t) => t.name),
        memo: memo || null,
        summary: analysisStatus ? summary : null,
        analysis_status: analysisStatus ?? null,
      }),
    },
    { showDetail: true, fallback: "수정에 실패했습니다. 잠시 후 다시 시도하세요" }
  )
  return await res.json()
}

// AI 없이 저장한 자료를 다시 분석한다. 결과만 돌려주고 저장은 updateContent로 한다
export async function reanalyzeContent(id, signal) {
  const res = await request(
    `/api/content/${id}/analyze`,
    { method: "POST", signal },
    { showDetail: true, fallback: "분석에 실패했습니다. 잠시 후 다시 시도하세요" }
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
