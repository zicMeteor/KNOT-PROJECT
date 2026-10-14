import { request } from "./client"

// 로그인 상태. 로그인을 끈 서버(v1과 같음)면 { auth: false }
export async function fetchMe() {
  const res = await request("/api/auth/me", { method: "GET" }, { authCheck: false })
  return await res.json()
}

export async function login(username, password) {
  const res = await request(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    },
    { authCheck: false, showDetail: true, fallback: "로그인에 실패했습니다. 잠시 후 다시 시도하세요" }
  )
  return await res.json()
}

export async function logout() {
  await request("/api/auth/logout", { method: "POST" }, { authCheck: false }).catch(() => {})
}
