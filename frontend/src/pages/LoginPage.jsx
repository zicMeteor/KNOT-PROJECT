// 로그인 화면: 홈 첫 화면과 같은 검정 배경, 분류 색 오라, 흐린 실 그래프 위에 입력만 둔다
// 가입 화면은 없다. 계정은 관리자가 만들어 준다
import { useEffect, useRef, useState } from "react"
import Notice from "../components/ui/Notice"
import { create, tagGraph } from "../lib/threadGraph"
import styles from "./LoginPage.module.css"

// 배경 그래프용 예시 태그 (실제 자료가 아니라 장식)
const BACKDROP = [
  { cat: "연구", tags: ["Transformer", "Attention", "NLP"] },
  { cat: "학습", tags: ["Transformer", "RAG", "LLM"] },
  { cat: "도구", tags: ["Docker", "Kubernetes", "배포"] },
  { cat: "참고", tags: ["React", "Vite", "CSS"] },
  { cat: "아이디어", tags: ["그래프", "시각화", "Attention"] },
  { cat: "학습", tags: ["Python", "FastAPI", "LLM"] },
  { cat: "참고", tags: ["MySQL", "SQLAlchemy", "Python"] },
]

const SOURCE_URL = "https://github.com/zicMeteor/KNOT-PROJECT"

function LoginPage({ onSignIn, expired }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const canvasRef = useRef(null)
  const passwordRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const g = create(canvasRef.current, {
      data: tagGraph(BACKDROP),
      scale: 0.42,
      labels: "none",
      dust: 70,
      seed: 5,
      speed: 0.03,
    })
    return () => g.destroy()
  }, [])

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    if (!username.trim() || !password) {
      setError({ type: "error", text: "아이디와 비밀번호를 입력하세요." })
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSignIn(username.trim(), password)
    } catch (err) {
      // 틀렸으면 아이디는 남기고 비밀번호만 비운 뒤 그 칸으로
      setPassword("")
      setError({ type: err.code === "LIMIT" ? "warn" : "error", text: err.message })
      passwordRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.screen}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <div className={styles.aura} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />

      <form className={styles.box} onSubmit={submit} noValidate>
        <p className={styles.mark}>KNOT</p>
        <div>
          <h1 className={styles.h1}>로그인</h1>
          <p className={styles.sub}>관리자에게 받은 아이디와 비밀번호를 입력하세요.</p>
        </div>

        {expired && !error && (
          <Notice type="info">로그인이 만료되었습니다. 다시 로그인하면 보던 화면으로 돌아갑니다.</Notice>
        )}
        {error && <Notice type={error.type}>{error.text}</Notice>}

        <div className={styles.fields}>
          <label className={styles.field}>
            <span>아이디</span>
            <input
              className={styles.input}
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </label>
          <label className={styles.field}>
            <span>비밀번호</span>
            <input
              ref={passwordRef}
              className={styles.input}
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>

        <button type="submit" className={styles.btn} disabled={busy}>
          {busy ? "로그인 중…" : "로그인"}
        </button>

        <p className={styles.foot}>
          가입 없이 관리자가 계정을 만들어 드립니다. 비밀번호를 잊었다면 관리자에게 문의하세요.
          <br />
          입력한 링크의 본문은 요약·분류를 위해 AI(Anthropic)로 전송됩니다.
          <br />
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">
            소스 코드 (GitHub · AGPL-3.0)
          </a>
        </p>
      </form>
    </main>
  )
}

export default LoginPage
