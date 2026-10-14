// 비워 두면 같은 주소의 /api를 부른다 (개발: vite 프록시, 배포: 서버가 화면도 함께 내보냄)
export const BASE = import.meta.env.VITE_API_URL ?? ""

const DEFAULT_FAILURE = "처리에 실패했습니다. 주소를 확인하고 다시 시도하세요"

// 로그인이 풀렸을 때 화면 전체에 알린다 (useAuth가 듣고 로그인 화면으로 돌린다)
export const UNAUTHORIZED_EVENT = "knot:unauthorized"

export async function request(
  path,
  options,
  { showDetail = false, fallback = DEFAULT_FAILURE, authCheck = true } = {}
) {
  let res
  try {
    // 로그인 쿠키를 함께 보낸다
    res = await fetch(BASE + path, { credentials: "include", ...options })
  } catch (e) {
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

  // 서버가 알려 주는 실패 이유 (DUPLICATE, LOGIN_WALL, AI_QUOTA 등)
  const code = res.headers.get("X-Error-Code")
  const message = typeof detail === "string" ? detail : null

  if (res.status === 401 && authCheck) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    const err = new Error("로그인이 필요합니다. 다시 로그인하세요")
    err.code = "UNAUTHORIZED"
    throw err
  }
  if (code === "DUPLICATE" || (message && message.includes("이미 저장된 URL"))) {
    const err = new Error(message ?? "이미 저장된 자료입니다")
    err.code = "duplicate"
    throw err
  }
  // 사용량 초과는 어느 화면에서든 이유를 그대로 보여 준다
  if (res.status === 429 && message) {
    const err = new Error(message)
    err.code = code ?? "LIMIT"
    throw err
  }
  // 400은 입력 문제, 401은 로그인 화면에서 아이디·비밀번호가 틀린 경우 (authCheck를 끈 요청)
  if (showDetail && (res.status === 400 || (res.status === 401 && !authCheck)) && message) {
    const err = new Error(message)
    err.code = code
    throw err
  }
  const err = new Error(fallback)
  err.code = code
  err.detail = message
  throw err
}
