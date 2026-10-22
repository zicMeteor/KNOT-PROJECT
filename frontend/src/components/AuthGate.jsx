import { useCallback, useEffect, useMemo, useState } from "react"
import { fetchMe, login, logout } from "../api/auth"
import { UNAUTHORIZED_EVENT } from "../api/client"
import { AuthContext } from "../hooks/useAuth"
import LoginPage from "../pages/LoginPage"
import Notice from "./ui/Notice"

// 로그인 문지기: 로그인 상태를 확인하는 동안은 빈 화면, 로그인이 필요하면 로그인 화면,
// 로그인돼 있으면 원래 화면(children). 로그인 화면은 주소를 바꾸지 않아서 로그인하면 보던 화면이 그대로 열린다
function AuthGate({ children }) {
  const [me, setMe] = useState(null)
  // checking: 확인 중 / in: 쓸 수 있음 / out: 로그인 필요 / down: 서버에 연결 못 함
  const [state, setState] = useState("checking")
  const [expired, setExpired] = useState(false)
  // down일 때 이유: offline = 서버에 닿지 못함, error = 서버가 오류로 답함
  const [downReason, setDownReason] = useState("offline")

  // initial: 처음 열 때의 확인. 그 뒤의 호출은 AI 사용량을 새로 받는 용도라서,
  // 실패해도 로그인이 풀린 경우(401)가 아니면 화면을 그대로 둔다.
  // (분석 직후 이 요청이 한 번 실패했다고 로그인 화면으로 바꾸면 방금 받은 분석 결과가 사라진다)
  const refresh = useCallback(async ({ initial = false } = {}) => {
    try {
      const data = await fetchMe()
      setMe(data)
      setState("in")
    } catch (e) {
      if (!initial) {
        if (e.status === 401) {
          setExpired(true)
          setMe(null)
          setState("out")
        }
        return
      }
      setMe(null)
      // 로그인이 필요하다는 답(401)일 때만 로그인 화면. 서버 오류(500 등)나 연결 실패를 로그인 문제로 보이게 하지 않는다
      setState(e.status === 401 ? "out" : "down")
      setDownReason(e.status ? "error" : "offline")
    }
  }, [])

  useEffect(() => {
    // 처음 열 때 한 번 확인한다 (응답이 오면 상태를 바꾼다)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh({ initial: true })
  }, [refresh])

  // 쓰는 중에 로그인이 풀리면 (API가 401) 로그인 화면으로
  useEffect(() => {
    function onUnauthorized() {
      setExpired(true)
      setMe(null)
      setState("out")
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const signIn = useCallback(async (username, password) => {
    const data = await login(username, password)
    setExpired(false)
    setMe(data)
    setState("in")
  }, [])

  const signOut = useCallback(async () => {
    await logout()
    setExpired(false)
    setMe(null)
    setState("out")
  }, [])

  const value = useMemo(() => ({ me, refresh, signIn, signOut }), [me, refresh, signIn, signOut])

  if (state === "checking") return <div style={{ minHeight: "100svh", background: "#000" }} />
  if (state === "down") {
    return (
      <div style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: 24 }}>
        <Notice type="error">
          {downReason === "error"
            ? "서버에 문제가 생겨 화면을 열지 못했습니다. 잠시 뒤 새로고침하세요."
            : "서버에 연결할 수 없습니다. 서버가 켜져 있는지 확인한 뒤 새로고침하세요."}
        </Notice>
      </div>
    )
  }
  if (state === "out") return <LoginPage onSignIn={signIn} expired={expired} />
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthGate
