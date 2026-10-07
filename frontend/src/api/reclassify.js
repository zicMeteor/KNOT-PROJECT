import { request } from "./client"

const PREVIEW_FAILURE = "재분류 미리보기를 만들지 못했습니다. 잠시 후 다시 시도하세요"
const EXECUTE_FAILURE = "재분류를 적용하지 못했습니다. 잠시 후 다시 시도하세요"

export async function previewReclassify(purpose, signal) {
  const res = await request(
    "/api/agent/reclassify/preview",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose }),
      signal,
    },
    { showDetail: true, fallback: PREVIEW_FAILURE }
  )
  return await res.json()
}

export async function executeReclassify(actions) {
  // 서버가 검증하는 필수 키 5개만 보낸다
  const body = actions.map((a) => ({
    content_id: a.content_id,
    change_needed: a.change_needed,
    reason: a.reason,
    category: a.category,
    tags: a.tags,
  }))
  const res = await request(
    "/api/agent/reclassify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions: body }),
    },
    { showDetail: true, fallback: EXECUTE_FAILURE }
  )
  return await res.json()
}