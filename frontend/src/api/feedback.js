import { request } from "./client"

// AI 결과에 대한 좋아요(1)·싫어요(-1). 실패해도 화면 흐름은 막지 않는다
export function sendFeedback(target, value, ref, detail = {}) {
  return request("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, value, ref: ref ?? null, detail }),
  }).catch(() => {})
}

// 화면에서만 알 수 있는 사용 기록 (검색 결과를 열었는지 등). 기다리지 않는다
export function logEvent(event, detail = {}) {
  request("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, detail }),
    keepalive: true,
  }).catch(() => {})
}
