export const BASE = import.meta.env.VITE_API_URL

export async function request(path, options) {
  let res
  try {
    res = await fetch(BASE + path, options)
  } catch (e){
    if (e.name === "AbortError") throw e
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
    const err = new Error(detail)
    err.code = "duplicate"
    throw err
  }
  throw new Error("처리에 실패했습니다. 주소를 확인하고 다시 시도하세요")
}