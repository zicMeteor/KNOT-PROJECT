import { createContext, useContext } from "react"

// 로그인 상태: { me, refresh, signIn, signOut }
// me.auth가 false면 로그인을 끈 서버(v1과 같음)라 로그인 화면 없이 바로 쓴다
export const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}
