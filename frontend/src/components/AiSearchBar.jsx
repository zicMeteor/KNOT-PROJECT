import { useState } from "react"
import styles from "./AiSearchBar.module.css"

function SearchIcon() {
  return (
    <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

// 그래프 하단의 AI 검색 입력줄. 질문을 보내면 결과는 오른쪽 사이드바와 그래프 강조로 보여준다
function AiSearchBar({ loading, hasResult, onSubmit, onClear }) {
  const [value, setValue] = useState("")

  function handleSubmit(e) {
    e.preventDefault()
    const query = value.trim()
    if (!query || loading) return
    onSubmit(query)
  }

  function handleClear() {
    setValue("")
    onClear()
  }

  const showClear = loading || hasResult || value.length > 0

  return (
    <form className={styles.bar} onSubmit={handleSubmit} role="search">
      <SearchIcon />
      <input
        className={styles.input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="질문으로 자료 찾기 (예: Transformer 관련 자료 보여줘)"
        aria-label="AI 검색 질문"
      />
      {loading && (
        <span className={styles.status} role="status">
          검색 중…
        </span>
      )}
      {showClear && (
        <button
          type="button"
          className={styles.iconBtn}
          onClick={handleClear}
          aria-label="검색 지우기"
          title="지우기"
        >
          <ClearIcon />
        </button>
      )}
      <button type="submit" className={styles.submit} disabled={loading || !value.trim()}>
        찾기
      </button>
    </form>
  )
}

export default AiSearchBar