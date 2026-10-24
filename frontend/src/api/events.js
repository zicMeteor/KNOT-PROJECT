import { request } from "./client"

// 화면에서만 알 수 있는 사용 기록 (검색 결과를 열었는지 등). 기다리지 않는다
export function logEvent(event, detail = {}) {
  request("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, detail }),
    keepalive: true,
  }).catch(() => {})
}
