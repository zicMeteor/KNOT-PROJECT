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

  const refresh = useCallback(async () => {
    try {
      const data = await fetchMe()
      setMe(data)
      setState("in")
    } catch (e) {
      setMe(null)
      setState(e.message === "서버에 연결할 수 없습니다" ? "down" : "out")
    }
  }, [])

  useEffect(() => {
    // 처음 열 때 한 번 확인한다 (응답이 오면 상태를 바꾼다)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
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
        <Notice type="error">서버에 연결할 수 없습니다. 서버가 켜져 있는지 확인한 뒤 새로고침하세요.</Notice>
      </div>
    )
  }
  if (state === "out") return <LoginPage onSignIn={signIn} expired={expired} />
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthGate
